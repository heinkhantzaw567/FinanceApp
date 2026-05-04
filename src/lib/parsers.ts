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
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim()) ?? ''
  const upper = firstLine.toUpperCase()

  // TD Chequing: quoted YYYY-MM-DD date (must check before header keywords)
  if (/^"?\d{4}-\d{2}-\d{2}"?/.test(firstLine.trim())) {
    return 2
  }

  // Header-based detection
  if (upper.includes('DEBIT') || upper.includes('CREDIT')) {
    return 0
  }
  if (upper.includes('ITEM#') || upper.includes('AMOUNT')) {
    return 1
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

  for (const row of rows) {
    if (row.length < 3) {
      continue
    }

    const headerLike = row.some((cell) => /item#|date|description|amount/i.test(cell))
    if (headerLike) {
      continue
    }

    const hasItemCol = row.length >= 4
    const dateRaw = hasItemCol ? row[1] : row[0]
    const descriptionRaw = hasItemCol ? row[2] : row[1]
    const amountRaw = hasItemCol ? row[3] : row[2]

    const date = normalizeDate(dateRaw ?? '')
    const description = normalizeDescription(descriptionRaw)
    const amount = parseNumber(amountRaw)

    if (!date || !description || !Number.isFinite(amount) || amount === 0) {
      continue
    }

    // Skip credit-card-payment rows
    if (PAYMENT_SKIP_PATTERN.test(description)) {
      continue
    }

    const keywordType = classifyByKeyword(description)
    const type = keywordType === 'refund' ? 'refund' : amount > 0 ? 'refund' : 'charge'

    parsed.push(buildRow(date, description, amount, 1, type))
  }

  return parsed
}

export function parseTdChequingCsv(csvText: string): ParsedImportRow[] {
  const rows = parseRows(csvText)
  const parsed: ParsedImportRow[] = []

  for (const row of rows) {
    // Columns: date, description, debit, credit, balance
    if (row.length < 4) {
      continue
    }

    const date = normalizeDate(row[0] ?? '')
    const description = normalizeDescription(row[1])
    const credit = parseNumber(row[3]) // col 3 = money in

    if (!date || !description || !Number.isFinite(credit) || credit <= 0) {
      continue
    }

    // Classify chequing income by description
    let category = 'Income'
    const upper = description.toUpperCase()
    if (upper.includes('PAY') && !upper.includes('PAYPAL')) {
      category = 'Paycheck'
    } else if (upper.includes('E-TRANSFER') || upper.includes('E-TFR')) {
      category = 'E-Transfer'
    } else if (upper.includes('PAYPAL') || upper.includes('STRIPE')) {
      category = 'Income'
    }

    const row2: ParsedImportRow = {
      date,
      description,
      amount: Math.round(credit * 100) / 100,
      type: 'refund',
      bankId: 2,
      category,
      key: duplicateKey({ date, description, amount: Math.round(credit * 100) / 100, bankId: 2 }),
    }
    parsed.push(row2)
  }

  return parsed
}
