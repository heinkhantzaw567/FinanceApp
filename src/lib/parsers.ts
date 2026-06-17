import Papa from 'papaparse'
import type { BankId, ColMapping, ParsedImportRow } from './types'
import { categorizeExpense, classifyByKeyword, duplicateKey, normalizeDate, parseNumber, PAYMENT_SKIP_PATTERN } from './utils'

function normalizeDescription(raw: string | number | null | undefined): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ')
}

function buildRow(
  date: string,
  description: string,
  amount: number,
  bankId: BankId,
  typeOverride?: 'charge' | 'refund'
): ParsedImportRow {
  const type = typeOverride ?? classifyByKeyword(description)
  const normalizedAmount = Math.round(Math.abs(amount) * 100) / 100
  return {
    date,
    description,
    amount: normalizedAmount,
    type,
    bankId,
    category: type === 'charge' ? categorizeExpense(description) : 'Other',
    key: duplicateKey({ date, description, amount: normalizedAmount, bankId }),
  }
}

function parseRows(csvText: string): string[][] {
  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  })

  return parsed.data
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
}

export function detectCsvBank(csvText: string): BankId | null {
  // Look at first few lines — BMO has a preamble before the real header
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  const firstLine = lines[0] ?? ''
  const allText = lines.slice(0, 4).join(' ').toUpperCase()

  // TD Chequing: quoted YYYY-MM-DD date at start of first data line
  if (/^"?\d{4}-\d{2}-\d{2}"?/.test(firstLine.trim())) {
    return 2
  }

  // BMO Chequing: "Transaction Type" column with CREDIT/DEBIT values (may appear after a preamble line)
  if (allText.includes('TRANSACTION TYPE')) {
    return 4
  }

  // BMO: has "Item #" column (may appear after a preamble line)
  if (allText.includes('ITEM #') || allText.includes('ITEM#')) {
    return 1
  }

  // TD Credit with header
  if (allText.includes('DEBIT') || allText.includes('CREDIT')) {
    return 0
  }

  // Headerless TD credit card: starts with MM/DD/YYYY date
  if (/^\d{2}\/\d{2}\/\d{4},/.test(firstLine.trim())) {
    return 0
  }

  return null
}

export function parseTdCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    if (row.length < 3) {
      continue
    }

    const headerLike = row.some((cell) => /date|description|debit|credit/i.test(cell))
    if (headerLike) {
      continue
    }

    const date = normalizeDate(row[0] ?? '')
    const description = normalizeDescription(row[1])
    const debit = parseNumber(row[2])
    const credit = parseNumber(row[3])

    if (!date || !description) {
      continue
    }

    const debitValid = Number.isFinite(debit) && debit > 0
    const creditValid = Number.isFinite(credit) && credit > 0

    if (!debitValid && !creditValid) {
      continue
    }

    const amount = creditValid ? credit : debit

    // Payment rows (e.g. "PAYMENT - THANK YOU") are imported, not skipped — the credit
    // column already marks them as refunds, which correctly offsets the chequing-side
    // charge that funded the payment.
    const type: 'charge' | 'refund' = creditValid ? 'refund' : classifyByKeyword(description)
    parsed.push(buildRow(date, description, amount, 0, type))
  }

  return parsed
}

export function parseBmoCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  // Actual BMO format (6 columns):
  // Item #, Card #, Transaction Date (YYYYMMDD), Posting Date, Transaction Amount, Description
  // File also has a preamble line before the header row.

  for (const row of rows) {
    // Need at least 6 columns for the new format, or 3 for legacy
    if (row.length < 3) {
      continue
    }

    // Skip header and preamble rows
    const rowText = row.join(' ').toUpperCase()
    if (
      rowText.includes('ITEM #') ||
      rowText.includes('ITEM#') ||
      rowText.includes('TRANSACTION DATE') ||
      rowText.includes('FOLLOWING DATA')
    ) {
      continue
    }

    let date: string | null = null
    let description = ''
    let amount = Number.NaN

    if (row.length >= 6) {
      // New format: Item#, Card#, TxDate, PostDate, Amount, Description
      date = normalizeDate(row[2] ?? '')
      description = normalizeDescription(row[5])
      amount = parseNumber(row[4])
    } else if (row.length >= 4) {
      // Legacy format: Item#, Date, Description, Amount
      date = normalizeDate(row[1] ?? '')
      description = normalizeDescription(row[2])
      amount = parseNumber(row[3])
    } else {
      // 3-column fallback: Date, Description, Amount
      date = normalizeDate(row[0] ?? '')
      description = normalizeDescription(row[1])
      amount = parseNumber(row[2])
    }

    if (!date || !description || !Number.isFinite(amount) || amount === 0) {
      continue
    }

    // Payment rows (e.g. "PAYMENT - THANK YOU", "TRSF FROM/DE ACCT/CPT ...") are imported,
    // not skipped — they post as negative amounts and become refunds below, which correctly
    // offsets the chequing-side charge that funded the payment.

    // In BMO exports: positive = charge (you spent), negative = credit/refund
    const keywordType = classifyByKeyword(description)
    const type: 'charge' | 'refund' =
      keywordType === 'refund' ? 'refund' : amount < 0 ? 'refund' : 'charge'

    parsed.push(buildRow(date, description, Math.abs(amount), 1, type))
  }

  return parsed
}

export function parseBmoChequingCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    // Columns: Card #, Transaction Type (CREDIT/DEBIT), Date Posted (YYYYMMDD), Amount (signed), Description
    if (row.length < 5) {
      continue
    }

    const rowText = row.join(' ').toUpperCase()
    if (rowText.includes('TRANSACTION TYPE') || rowText.includes('TRANSACTION AMOUNT')) {
      continue
    }

    const txType = row[1]?.trim().toUpperCase()
    const date = normalizeDate(row[2] ?? '')
    const rawAmount = parseNumber(row[3])
    const description = normalizeDescription(row[4])

    if (!date || !description || !Number.isFinite(rawAmount) || rawAmount === 0) {
      continue
    }

    const amount = Math.round(Math.abs(rawAmount) * 100) / 100
    const upper = description.toUpperCase()

    if (txType === 'CREDIT') {
      let category = 'Income'
      if (upper.includes('PAY') && !upper.includes('PAYPAL')) {
        category = 'Paycheck'
      } else if (upper.includes('ETRNSFR') || upper.includes('E-TRANSFER') || upper.includes('E-TFR')) {
        category = 'E-Transfer'
      }
      parsed.push({
        date,
        description,
        amount,
        type: 'refund',
        bankId: 4,
        category,
        key: duplicateKey({ date, description, amount, bankId: 4 }),
      })
    } else if (txType === 'DEBIT') {
      const category = categorizeExpense(description)
      parsed.push({
        date,
        description,
        amount,
        type: 'charge',
        bankId: 4,
        category,
        key: duplicateKey({ date, description, amount, bankId: 4 }),
      })
    }
  }

  return parsed
}

export function sniffCsvHeaders(csvText: string): { headers: string[]; preview: string[][] } {
  const rows = parseRows(csvText)
  if (rows.length === 0) return { headers: [], preview: [] }
  return { headers: rows[0], preview: rows.slice(1, 5) }
}

export function autoDetectColMapping(headers: string[]): ColMapping {
  const h = headers.map((x) => x.toLowerCase().trim())

  const find = (...names: string[]) => {
    for (const name of names) {
      const idx = h.findIndex((x) => x.includes(name))
      if (idx >= 0) return idx
    }
    return -1
  }

  const dateCol = find('date', 'trans', 'posted', 'posting')
  const descCol = find('description', 'memo', 'payee', 'narrative', 'detail')
  const debitCol = find('debit', 'withdrawal', 'money out', 'dr')
  const creditCol = find('credit', 'deposit', 'money in', 'cr')
  const amountCol = find('amount', 'transaction amount', 'value')

  const hasSplit = debitCol >= 0 || creditCol >= 0

  return {
    dateCol: dateCol >= 0 ? dateCol : 0,
    descCol: descCol >= 0 ? descCol : 1,
    amountMode: hasSplit ? 'split' : 'single',
    amountCol: amountCol >= 0 ? amountCol : (hasSplit ? -1 : 2),
    debitCol: debitCol >= 0 ? debitCol : -1,
    creditCol: creditCol >= 0 ? creditCol : -1,
    hasHeader: true,
  }
}

export function parseGenericCsv(csvText: string, mapping: ColMapping, bankId: BankId): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const dataRows = mapping.hasHeader ? rows.slice(1) : rows
  const parsed: ParsedImportRow[] = []

  for (const row of dataRows) {
    const date = normalizeDate(row[mapping.dateCol] ?? '')
    const description = normalizeDescription(row[mapping.descCol])
    if (!date || !description) continue
    if (PAYMENT_SKIP_PATTERN.test(description)) continue

    let amount = Number.NaN
    let type: 'charge' | 'refund' = 'charge'

    if (mapping.amountMode === 'single') {
      const raw = parseNumber(row[mapping.amountCol] ?? '')
      if (!Number.isFinite(raw) || raw === 0) continue
      amount = Math.abs(raw)
      type = raw < 0 ? 'refund' : classifyByKeyword(description)
    } else {
      const debit = mapping.debitCol >= 0 ? parseNumber(row[mapping.debitCol] ?? '') : Number.NaN
      const credit = mapping.creditCol >= 0 ? parseNumber(row[mapping.creditCol] ?? '') : Number.NaN
      const debitValid = Number.isFinite(debit) && debit > 0
      const creditValid = Number.isFinite(credit) && credit > 0
      if (!debitValid && !creditValid) continue
      if (creditValid) {
        amount = credit
        type = 'refund'
      } else {
        amount = debit
        type = classifyByKeyword(description) === 'refund' ? 'refund' : 'charge'
      }
    }

    parsed.push(buildRow(date, description, amount, bankId, type))
  }

  return parsed
}

export function parseTdChequingCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    // Columns: date, description, withdrawal, deposit, balance
    if (row.length < 4) {
      continue
    }

    const date = normalizeDate(row[0] ?? '')
    const description = normalizeDescription(row[1])
    if (!date || !description) {
      continue
    }

    const withdrawal = parseNumber(row[2]) // col 2 = money out
    const deposit = parseNumber(row[3])    // col 3 = money in
    const withdrawalValid = Number.isFinite(withdrawal) && withdrawal > 0
    const depositValid = Number.isFinite(deposit) && deposit > 0
    const upper = description.toUpperCase()

    if (depositValid) {
      let category = 'Income'
      if (upper.includes('PAY') && !upper.includes('PAYPAL')) {
        category = 'Paycheck'
      } else if (upper.includes('E-TRANSFER') || upper.includes('E-TFR')) {
        category = 'E-Transfer'
      }
      const amount = Math.round(deposit * 100) / 100
      parsed.push({
        date,
        description,
        amount,
        type: 'refund',
        bankId: 2,
        category,
        key: duplicateKey({ date, description, amount, bankId: 2 }),
      })
    } else if (withdrawalValid) {
      const category = categorizeExpense(description)
      const amount = Math.round(withdrawal * 100) / 100
      parsed.push({
        date,
        description,
        amount,
        type: 'charge',
        bankId: 2,
        category,
        key: duplicateKey({ date, description, amount, bankId: 2 }),
      })
    }
  }

  return parsed
}
