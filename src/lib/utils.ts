import type { BankId, ParsedImportRow, TxType } from './types'

export const BANK_OPTIONS: Array<{ id: BankId; label: string }> = [
  { id: 0, label: 'TD Credit Card' },
  { id: 1, label: 'BMO Credit Card' },
  { id: 2, label: 'TD Chequing' },
]

export const KEYWORDS = ['REFUND', 'CREDIT', 'REVERSAL', 'CASHBACK', 'REBATE']
export const PAYMENT_SKIP_PATTERN = /^PAYMENT\b/i

export const CATEGORY_OPTIONS = [
  'Groceries',
  'Dining & Restaurants',
  'Transport & Transit',
  'Phone & Internet',
  'Utilities',
  'Entertainment & Subscriptions',
  'Shopping & Clothing',
  'Health & Pharmacy',
  'Investment (XEQT)',
  'Education & Books',
  'Travel',
  'Credit Card Payment',
  'Cashback & Rewards',
  'Rent',
  'Paycheck',
  'E-Transfer',
  'Income',
  'Other',
]

export function parseNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return raw
  }

  if (!raw) {
    return Number.NaN
  }

  return Number(String(raw).replace(/[$,\s]/g, '').trim())
}

export function normalizeDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) {
    return null
  }

  if (/^\d{8}$/.test(value)) {
    const year = value.slice(0, 4)
    const month = value.slice(4, 6)
    const day = value.slice(6, 8)
    return `${year}-${month}-${day}`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day = slashMatch[2].padStart(2, '0')
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
    return `${year}-${month}-${day}`
  }

  return null
}

export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`
}

export function buildMonthOptions(count = 18): string[] {
  const list: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
    list.push(month)
  }
  return list
}

export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum - 1, 1)
  return date.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(value)
}

export function classifyByKeyword(description: string): TxType {
  const upper = description.toUpperCase()
  return KEYWORDS.some((keyword) => upper.includes(keyword)) ? 'refund' : 'charge'
}

export function duplicateKey(row: {
  date: string
  description: string
  amount: number
  bankId: BankId
}): string {
  return [
    row.date,
    row.description.trim().toUpperCase(),
    row.amount.toFixed(2),
    String(row.bankId),
  ].join('|')
}

export function txTypeLabel(type: TxType): string {
  return type === 'charge' ? 'Charge' : 'Refund'
}

export function prepareDuplicateCandidates(rows: ParsedImportRow[]) {
  return rows.map((row) => ({
    key: row.key,
    date: row.date,
    description: row.description,
    amount: row.amount,
    bankId: row.bankId,
  }))
}
