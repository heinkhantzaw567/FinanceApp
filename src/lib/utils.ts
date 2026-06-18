import type { BankId, ParsedImportRow, TxType } from './types'

export const BANK_OPTIONS: Array<{ id: BankId; label: string }> = [
  { id: 0, label: 'TD Credit Card' },
  { id: 1, label: 'BMO Credit Card' },
  { id: 2, label: 'TD Chequing' },
  { id: 4, label: 'BMO Chequing' },
  { id: 3, label: 'Other' },
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

// ── Transfer detection ────────────────────────────────────────────────────────

export type AccountKey = 'td_credit' | 'td_chequing' | 'bmo_credit' | 'bmo_chequing' | 'other'

export const TRANSFER_KEYWORDS: Record<AccountKey, RegExp[]> = {
  td_credit: [
    /^PAYMENT/i,
    /^INTERNET PAYMENT/i,
    /^ONLINE PAYMENT/i,
  ],
  td_chequing: [
    /TFR-TO/i,
    /TFR-FR/i,
    /\bTD VISA\b/i,
    /VISA PAYMENT/i,
    /INTERNET TRANSFER/i,
    /ONLINE TRANSFER/i,
  ],
  bmo_credit: [
    /^PAYMENT/i,
    /PAYMENT RECEIVED/i,
    /TRSF FROM/i,
    /TRSF DE/i,
  ],
  bmo_chequing: [
    /^BMO MASTERCARD/i,
    /^BMO MC\b/i,
    /MASTERCARD PAYMENT/i,
    /TF 0005191237197655547/i,
    /^ONLINE TRANSFER/i,
    /^INTERNET TRANSFER/i,
    /^TFR\b/i,
  ],
  other: [],
}

export function isTransferByKeyword(description: string, accountKey: AccountKey): boolean {
  return TRANSFER_KEYWORDS[accountKey].some((p) => p.test(description))
}

export function accountTypeForBankId(bankId: BankId): 'credit' | 'chequing' {
  return bankId === 2 || bankId === 4 ? 'chequing' : 'credit'
}

export function accountKeyForBankId(bankId: BankId): AccountKey {
  switch (bankId) {
    case 0: return 'td_credit'
    case 1: return 'bmo_credit'
    case 2: return 'td_chequing'
    case 4: return 'bmo_chequing'
    default: return 'other'
  }
}

// ── General helpers ───────────────────────────────────────────────────────────

export function parseNumber(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return raw
  if (!raw) return Number.NaN
  return Number(String(raw).replace(/[$,\s]/g, '').trim())
}

export function normalizeDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day   = slashMatch[2].padStart(2, '0')
    const year  = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]
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
    list.push(`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`)
  }
  return list
}

export function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, monthNum - 1, 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
}

export function classifyByKeyword(description: string): 'charge' | 'refund' {
  const upper = description.toUpperCase()
  return KEYWORDS.some((k) => upper.includes(k)) ? 'refund' : 'charge'
}

export function categorizeExpense(description: string): string {
  const upper = description.toUpperCase()

  if (upper.includes('RENT') || upper.includes('LEASE')) return 'Rent'

  if (upper.includes('E-TRANSFER') || upper.includes('E-TFR') || upper.includes('ETRNSFR'))
    return 'E-Transfer'

  if (
    upper.includes('TD VISA') ||
    upper.includes('CREDIT CARD') ||
    upper.includes('CREDITCARD') ||
    upper.includes('TF 0005191237197655547')
  ) return 'Credit Card Payment'

  // Transport — checked before any GOOGLE / PRESTO pattern below
  if (
    upper.includes('PRESTO') ||
    upper.includes('TTC') ||
    upper.includes('GO TRANSIT') ||
    upper.includes('UBER') ||
    upper.includes('LYFT') ||
    upper.includes('TAXI')
  ) return 'Transport & Transit'

  // Groceries
  if (
    upper.includes('GROCERY') ||
    upper.includes('GROCERIES') ||
    upper.includes('METRO') ||
    upper.includes('LOBLAWS') ||
    upper.includes('SOBEYS') ||
    upper.includes('FOOD BASICS') ||
    upper.includes('T&T SUPERMARKET') ||
    upper.includes('HMART') ||
    upper.includes('H-MART') ||
    upper.includes('FRESHCO') ||
    upper.includes('RABBA FINE FOODS') ||
    upper.includes('WHOLE FOODS') ||
    upper.includes('FARM BOY') ||
    upper.includes('NO FRILLS') ||
    upper.includes('SUPERSTORE')
  ) return 'Groceries'

  // Dining & Restaurants
  if (
    upper.startsWith('TST-') ||         // Toast POS — virtually always restaurants
    upper.includes('STARBUCKS') ||
    upper.includes('SBUX') ||
    upper.includes('CHARTWELLS') ||
    upper.includes('CHATIME') ||
    upper.includes('POPEYES') ||
    upper.includes('KRISPY KREME') ||
    upper.includes('MCDONALD') ||
    upper.includes('TIM HORTONS') ||
    upper.includes('HOT POT') ||
    upper.includes('DUMPLING') ||
    upper.includes('SUSHI') ||
    upper.includes('RAMEN') ||
    upper.includes('PIZZA') ||
    upper.includes('RESTAURANT') ||
    upper.includes('CAFE') ||
    upper.includes('COFFEE') ||
    upper.includes('BAKERY') ||
    upper.includes('CREPE') ||
    upper.includes('NOODLE') ||
    upper.includes('KIMCHI') ||
    upper.includes('KOREAN') ||
    upper.includes('THAI') ||
    upper.includes('VIETNAMESE') ||
    upper.includes('GRILL') ||
    upper.includes('BURGER') ||
    upper.includes('TACO') ||
    upper.includes('WINGS') ||
    upper.includes('BRUNCH') ||
    upper.includes('BISTRO') ||
    upper.includes('DINER') ||
    upper.includes('KERNELS POPCORN') ||
    upper.includes('KREAM') ||
    upper.includes('THE ALLEY')
  ) return 'Dining & Restaurants'

  // Health & Pharmacy
  if (
    upper.includes('SHOPPERS DRUG MART') ||
    upper.includes('REXALL') ||
    upper.includes('PHARMACY') ||
    upper.includes('FIT4LESS') ||
    upper.includes('FITNESS') ||
    upper.includes('GYM') ||
    upper.includes('HAIR SALON') ||
    upper.includes('BARBER') ||
    upper.includes('DENTAL') ||
    upper.includes('MEDICAL') ||
    upper.includes('CLINIC') ||
    upper.includes('HOSPITAL')
  ) return 'Health & Pharmacy'

  // Shopping & Clothing
  if (
    upper.includes('AMAZON') ||
    upper.includes('AMZN') ||
    upper.includes('WINNERS') ||
    upper.includes('FOOT LOCKER') ||
    upper.includes('SEPHORA') ||
    upper.includes('BEST BUY') ||
    upper.includes('CANADIAN TIRE') ||
    upper.includes('DOLLARAMA') ||
    upper.includes('WALMART') ||
    upper.includes('COSTCO') ||
    upper.includes('SPORT CHEK') ||
    upper.includes('H&M') ||
    upper.includes('ZARA') ||
    upper.includes('UNIQLO')
  ) return 'Shopping & Clothing'

  // Phone & Internet
  if (
    upper.includes('FREEDOM MOBILE') ||
    upper.includes('ROGERS') ||
    upper.includes('BELL CANADA') ||
    upper.includes('TELUS') ||
    upper.includes('FIDO') ||
    upper.includes('KOODO') ||
    upper.includes('PUBLIC MOBILE') ||
    upper.includes('VIRGIN MOBILE')
  ) return 'Phone & Internet'

  // Entertainment & Subscriptions
  if (
    upper.includes('NETFLIX') ||
    upper.includes('SPOTIFY') ||
    upper.includes('DISNEY') ||
    upper.includes('APPLE.COM/BILL') ||
    upper.includes('ANTHROPIC') ||
    upper.includes('OPENAI') ||
    upper.includes('DIGITALOCEAN') ||
    upper.includes('NAMECHEAP') ||
    upper.includes('NAME-CHEAP') ||
    upper.includes('YOUTUBE') ||
    upper.includes('TWITCH') ||
    upper.includes('STEAM') ||
    upper.includes('XBOX') ||
    upper.includes('PLAYSTATION')
  ) return 'Entertainment & Subscriptions'

  return 'Other'
}

export function duplicateKey(row: {
  date: string
  description: string
  amount: number
  bankId: BankId
}): string {
  return [row.date, row.description.trim().toUpperCase(), row.amount.toFixed(2), String(row.bankId)].join('|')
}

export function txTypeLabel(type: TxType): string {
  if (type === 'charge') return 'Charge'
  if (type === 'refund') return 'Refund'
  return 'Transfer'
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
