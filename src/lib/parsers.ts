import Papa from 'papaparse'
import type { BankId, ColMapping, ParsedImportRow } from './types'
import {
  accountTypeForBankId,
  categorizeExpense,
  classifyByKeyword,
  duplicateKey,
  normalizeDate,
  parseNumber,
  PAYMENT_SKIP_PATTERN,
} from './utils'

function normalizeDescription(raw: string | number | null | undefined): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ')
}

function buildRow(
  date: string,
  description: string,
  amount: number,
  bankId: BankId,
  accountType: 'credit' | 'chequing',
  typeOverride?: 'charge' | 'refund'
): ParsedImportRow {
  const type = typeOverride ?? classifyByKeyword(description)
  const normalizedAmount = Math.round(Math.abs(amount) * 100) / 100
  return {
    date,
    description,
    amount: normalizedAmount,
    type,
    transfer_direction: null,
    account_type: accountType,
    bankId,
    category: type === 'charge' ? categorizeExpense(description) : 'Other',
    key: duplicateKey({ date, description, amount: normalizedAmount, bankId }),
  }
}

function parseRows(csvText: string): string[][] {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true })
  return parsed.data
    .filter((row) => Array.isArray(row))
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
}

export function detectCsvBank(csvText: string): BankId | null {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim())
  const firstLine = lines[0] ?? ''
  const allText = lines.slice(0, 4).join(' ').toUpperCase()

  if (/^"?\d{4}-\d{2}-\d{2}"?/.test(firstLine.trim())) return 2
  if (allText.includes('TRANSACTION TYPE')) return 4
  if (allText.includes('ITEM #') || allText.includes('ITEM#')) return 1
  if (allText.includes('DEBIT') || allText.includes('CREDIT')) return 0
  if (/^\d{2}\/\d{2}\/\d{4},/.test(firstLine.trim())) return 0
  return null
}

export function parseTdCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    if (row.length < 3) continue
    if (row.some((cell) => /date|description|debit|credit/i.test(cell))) continue

    const date = normalizeDate(row[0] ?? '')
    const description = normalizeDescription(row[1])
    const debit = parseNumber(row[2])
    const credit = parseNumber(row[3])

    if (!date || !description) continue

    const debitValid  = Number.isFinite(debit)  && debit  > 0
    const creditValid = Number.isFinite(credit) && credit > 0

    if (!debitValid && !creditValid) continue

    const amount = creditValid ? credit : debit
    const type: 'charge' | 'refund' = creditValid ? 'refund' : classifyByKeyword(description)
    parsed.push(buildRow(date, description, amount, 0, 'credit', type))
  }

  return parsed
}

export function parseBmoCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    if (row.length < 3) continue

    const rowText = row.join(' ').toUpperCase()
    if (
      rowText.includes('ITEM #') ||
      rowText.includes('ITEM#') ||
      rowText.includes('TRANSACTION DATE') ||
      rowText.includes('FOLLOWING DATA')
    ) continue

    // 5-col no-header format: Date(MM/DD/YYYY), Description, Debit, Credit, Balance
    // This is the format BMO online banking exports for credit card activity.
    if (row.length === 5 && normalizeDate(row[0] ?? '')) {
      const date        = normalizeDate(row[0] ?? '')
      const description = normalizeDescription(row[1])
      const debit       = parseNumber(row[2])
      const credit      = parseNumber(row[3])
      if (!date || !description) continue
      const debitValid  = Number.isFinite(debit)  && debit  > 0
      const creditValid = Number.isFinite(credit) && credit > 0
      if (!debitValid && !creditValid) continue
      const amount = creditValid ? credit : debit
      const type: 'charge' | 'refund' = creditValid ? 'refund' : classifyByKeyword(description)
      parsed.push(buildRow(date, description, amount, 1, 'credit', type))
      continue
    }

    let date: string | null = null
    let description = ''
    let amount = Number.NaN

    if (row.length >= 6) {
      // 6-col: Item#, Card#, TxDate(YYYYMMDD), PostDate, Amount, Description
      date        = normalizeDate(row[2] ?? '')
      description = normalizeDescription(row[5])
      amount      = parseNumber(row[4])
    } else if (row.length >= 4) {
      // Legacy 4-col: Item#, Date, Description, Amount
      date        = normalizeDate(row[1] ?? '')
      description = normalizeDescription(row[2])
      amount      = parseNumber(row[3])
    } else {
      // 3-col fallback: Date, Description, Amount
      date        = normalizeDate(row[0] ?? '')
      description = normalizeDescription(row[1])
      amount      = parseNumber(row[2])
    }

    if (!date || !description || !Number.isFinite(amount) || amount === 0) continue

    const keywordType = classifyByKeyword(description)
    const type: 'charge' | 'refund' =
      keywordType === 'refund' ? 'refund' : amount < 0 ? 'refund' : 'charge'

    parsed.push(buildRow(date, description, Math.abs(amount), 1, 'credit', type))
  }

  return parsed
}

export function parseBmoChequingCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    if (row.length < 5) continue

    const rowText = row.join(' ').toUpperCase()
    if (rowText.includes('TRANSACTION TYPE') || rowText.includes('TRANSACTION AMOUNT')) continue

    const txType    = row[1]?.trim().toUpperCase()
    const date      = normalizeDate(row[2] ?? '')
    const rawAmount = parseNumber(row[3])
    const description = normalizeDescription(row[4])

    if (!date || !description || !Number.isFinite(rawAmount) || rawAmount === 0) continue

    const amount = Math.round(Math.abs(rawAmount) * 100) / 100
    const upper  = description.toUpperCase()

    if (txType === 'CREDIT') {
      let category = 'Income'
      if (upper.includes('PAY') && !upper.includes('PAYPAL')) category = 'Paycheck'
      else if (upper.includes('ETRNSFR') || upper.includes('E-TRANSFER') || upper.includes('E-TFR')) category = 'E-Transfer'
      parsed.push({
        date, description, amount,
        type: 'refund',
        transfer_direction: null,
        account_type: 'chequing',
        bankId: 4,
        category,
        key: duplicateKey({ date, description, amount, bankId: 4 }),
      })
    } else if (txType === 'DEBIT') {
      parsed.push({
        date, description, amount,
        type: 'charge',
        transfer_direction: null,
        account_type: 'chequing',
        bankId: 4,
        category: categorizeExpense(description),
        key: duplicateKey({ date, description, amount, bankId: 4 }),
      })
    }
  }

  return parsed
}

export function parseTdChequingCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    if (row.length < 4) continue

    const date = normalizeDate(row[0] ?? '')
    const description = normalizeDescription(row[1])
    if (!date || !description) continue

    const withdrawal = parseNumber(row[2])
    const deposit    = parseNumber(row[3])
    const withdrawalValid = Number.isFinite(withdrawal) && withdrawal > 0
    const depositValid    = Number.isFinite(deposit)    && deposit    > 0
    const upper = description.toUpperCase()

    if (depositValid) {
      let category = 'Income'
      if (upper.includes('PAY') && !upper.includes('PAYPAL')) category = 'Paycheck'
      else if (upper.includes('E-TRANSFER') || upper.includes('E-TFR')) category = 'E-Transfer'
      const amount = Math.round(deposit * 100) / 100
      parsed.push({
        date, description, amount,
        type: 'refund',
        transfer_direction: null,
        account_type: 'chequing',
        bankId: 2,
        category,
        key: duplicateKey({ date, description, amount, bankId: 2 }),
      })
    } else if (withdrawalValid) {
      const amount = Math.round(withdrawal * 100) / 100
      parsed.push({
        date, description, amount,
        type: 'charge',
        transfer_direction: null,
        account_type: 'chequing',
        bankId: 2,
        category: categorizeExpense(description),
        key: duplicateKey({ date, description, amount, bankId: 2 }),
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

  const dateCol   = find('date', 'trans', 'posted', 'posting')
  const descCol   = find('description', 'memo', 'payee', 'narrative', 'detail')
  const debitCol  = find('debit', 'withdrawal', 'money out', 'dr')
  const creditCol = find('credit', 'deposit', 'money in', 'cr')
  const amountCol = find('amount', 'transaction amount', 'value')
  const hasSplit  = debitCol >= 0 || creditCol >= 0

  return {
    dateCol:    dateCol   >= 0 ? dateCol   : 0,
    descCol:    descCol   >= 0 ? descCol   : 1,
    amountMode: hasSplit ? 'split' : 'single',
    amountCol:  amountCol >= 0 ? amountCol : (hasSplit ? -1 : 2),
    debitCol:   debitCol  >= 0 ? debitCol  : -1,
    creditCol:  creditCol >= 0 ? creditCol : -1,
    hasHeader:  true,
  }
}

export function parseGenericCsv(csvText: string, mapping: ColMapping, bankId: BankId): ParsedImportRow[] {
  const rows     = parseRows(csvText)
  const dataRows = mapping.hasHeader ? rows.slice(1) : rows
  const parsed: ParsedImportRow[] = []
  const accountType = accountTypeForBankId(bankId)

  for (const row of dataRows) {
    const date        = normalizeDate(row[mapping.dateCol] ?? '')
    const description = normalizeDescription(row[mapping.descCol])
    if (!date || !description) continue
    if (PAYMENT_SKIP_PATTERN.test(description)) continue

    let amount = Number.NaN
    let type: 'charge' | 'refund' = 'charge'

    if (mapping.amountMode === 'single') {
      const raw = parseNumber(row[mapping.amountCol] ?? '')
      if (!Number.isFinite(raw) || raw === 0) continue
      amount = Math.abs(raw)
      type   = raw < 0 ? 'refund' : classifyByKeyword(description)
    } else {
      const debit  = mapping.debitCol  >= 0 ? parseNumber(row[mapping.debitCol]  ?? '') : Number.NaN
      const credit = mapping.creditCol >= 0 ? parseNumber(row[mapping.creditCol] ?? '') : Number.NaN
      const debitValid  = Number.isFinite(debit)  && debit  > 0
      const creditValid = Number.isFinite(credit) && credit > 0
      if (!debitValid && !creditValid) continue
      if (creditValid) { amount = credit; type = 'refund' }
      else { amount = debit; type = classifyByKeyword(description) === 'refund' ? 'refund' : 'charge' }
    }

    parsed.push(buildRow(date, description, amount, bankId, accountType, type))
  }

  return parsed
}
