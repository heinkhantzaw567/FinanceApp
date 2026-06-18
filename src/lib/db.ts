import type {
  BankId,
  BankStats,
  DashboardData,
  DuplicateCandidate,
  SpendingBreakdownRow,
  Transaction,
  TransactionInput,
  TxType,
} from './types'

export async function getDashboard(month: string): Promise<DashboardData> {
  return window.cashflow.getDashboard(month)
}

export async function getRecentTransactions(limit = 10): Promise<Transaction[]> {
  return window.cashflow.getRecentTransactions(limit)
}

export async function getTransactions(filters: {
  bankId?: number | null
  type?: TxType | null
  month?: string | null
  category?: string | null
}): Promise<Transaction[]> {
  return window.cashflow.getTransactions(filters)
}

export async function getSpendingBreakdown(
  month: string,
  bankId: number | null
): Promise<SpendingBreakdownRow[]> {
  return window.cashflow.getSpendingBreakdown(month, bankId)
}

export async function getBanks(): Promise<BankStats[]> {
  return window.cashflow.getBanks()
}

export async function updateBank(payload: {
  id: BankId
  openingBalance: number
  creditLimit: number
}): Promise<boolean> {
  return window.cashflow.updateBank(payload)
}

export async function addManualTransaction(payload: TransactionInput): Promise<boolean> {
  return window.cashflow.addManualTransaction(payload)
}

export async function deleteTransaction(id: string): Promise<boolean> {
  return window.cashflow.deleteTransaction(id)
}

export async function getExistingKeys(candidates: DuplicateCandidate[]): Promise<string[]> {
  return window.cashflow.getExistingKeys(candidates)
}

export async function importTransactions(rows: TransactionInput[]): Promise<{ imported: number; duplicates: number }> {
  return window.cashflow.importTransactions(rows)
}

export async function clearAllData(): Promise<boolean> {
  return window.cashflow.clearAllData()
}

export async function recategorizeAll(): Promise<{ updated: number }> {
  return window.cashflow.recategorizeAll()
}
