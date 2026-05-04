import Papa from 'papaparse'
import type { BankId, ParsedImportRow } from './types'
import { classifyByKeyword, duplicateKey, normalizeDate, parseNumber, PAYMENT_SKIP_PATTERN } from './utils'

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
    category: 'Other',
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

    // Skip credit-card-payment rows (e.g. "PAYMENT - THANK YOU")
    if (PAYMENT_SKIP_PATTERN.test(description)) {
      continue
    }

    const type = classifyByKeyword(description)
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

    // Skip credit-card-payment rows
    if (PAYMENT_SKIP_PATTERN.test(description)) {
      continue
    }

    // Skip BMO transfer payments: "TRSF FROM/DE ACCT/CPT ..."
    if (/^TRSF (FROM|DE)\b/i.test(description)) {
      continue
    }

    // In BMO exports: positive = charge (you spent), negative = credit/refund
    const keywordType = classifyByKeyword(description)
    const type: 'charge' | 'refund' =
      keywordType === 'refund' ? 'refund' : amount < 0 ? 'refund' : 'charge'

    parsed.push(buildRow(date, description, Math.abs(amount), 1, type))
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
      let category = 'Other'
      if (upper.includes('RENT') || upper.includes('LEASE')) {
        category = 'Rent'
      } else if (upper.includes('E-TRANSFER') || upper.includes('E-TFR')) {
        category = 'E-Transfer'
      } else if (
        upper.includes('TD VISA') ||
        upper.includes('BMO') ||
        upper.includes('CREDIT CARD') ||
        upper.includes('CREDITCARD')
      ) {
        category = 'Credit Card Payment'
      } else if (
        upper.includes('GROCERY') ||
        upper.includes('GROCERIES') ||
        upper.includes('METRO') ||
        upper.includes('LOBLAWS') ||
        upper.includes('SOBEYS') ||
        upper.includes('FOOD BASICS')
      ) {
        category = 'Groceries'
      }
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
