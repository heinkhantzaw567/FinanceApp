export type TxType = 'charge' | 'refund'
export type BankId = 0 | 1 | 2

export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: TxType
  bank_id: BankId
  category: string
  source: 'import' | 'manual' | 'seed'
  created_at: string
}

export interface TransactionInput {
  date: string
  description: string
  amount: number
  type: TxType
  bankId: BankId
  category: string
  source?: 'import' | 'manual' | 'seed'
}

export interface DashboardData {
  month: string
  monthTotals: {
    charges: number
    refunds: number
    netCashFlow: number
  }
  banks: BankStats[]
  monthlySeries: Array<{
    month: string
    charges: number
    refunds: number
  }>
}

export interface BankStats {
  id: BankId
  name: string
  account_type: 'credit' | 'chequing'
  opening_balance: number
  credit_limit: number
  charges: number
  refunds: number
  current_balance: number
  transaction_count: number
}

export interface SpendingBreakdownRow {
  category: string
  transaction_count: number
  amount: number
}

export interface DuplicateCandidate {
  key: string
  date: string
  description: string
  amount: number
  bankId: BankId
}

export interface ParsedImportRow {
  date: string
  description: string
  amount: number
  type: TxType
  bankId: BankId
  category: string
  key: string
  status?: 'new' | 'duplicate'
}

declare global {
  interface Window {
    cashflow: {
      getDashboard: (month: string) => Promise<DashboardData>
      getRecentTransactions: (limit?: number) => Promise<Transaction[]>
      getTransactions: (filters: {
        bankId?: number | null
        type?: TxType | null
        month?: string | null
        category?: string | null
      }) => Promise<Transaction[]>
      getSpendingBreakdown: (month: string, bankId: number | null) => Promise<SpendingBreakdownRow[]>
      getBanks: () => Promise<BankStats[]>
      updateBank: (payload: { id: BankId; openingBalance: number; creditLimit: number }) => Promise<boolean>
      addManualTransaction: (payload: TransactionInput) => Promise<boolean>
      deleteTransaction: (id: string) => Promise<boolean>
      getExistingKeys: (candidates: DuplicateCandidate[]) => Promise<string[]>
      importTransactions: (rows: TransactionInput[]) => Promise<{ imported: number; duplicates: number }>
      clearAllData: () => Promise<boolean>
      onOpenImport: (cb: () => void) => void
    }
  }
}
