import { contextBridge, ipcRenderer } from 'electron'

type TxType = 'charge' | 'refund'
type BankId = 0 | 1

type TransactionInput = {
  date: string
  description: string
  amount: number
  type: TxType
  bankId: BankId
  category: string
  source?: 'import' | 'manual' | 'seed'
}

type TransactionFilter = {
  bankId?: number | null
  type?: TxType | null
  month?: string | null
  category?: string | null
}

type DuplicateCandidate = {
  key: string
  date: string
  description: string
  amount: number
  bankId: BankId
}

const api = {
  getDashboard: (month: string) => ipcRenderer.invoke('cashflow:get-dashboard', month),
  getRecentTransactions: (limit = 10) => ipcRenderer.invoke('cashflow:get-recent-transactions', limit),
  getTransactions: (filters: TransactionFilter) => ipcRenderer.invoke('cashflow:get-transactions', filters),
  getSpendingBreakdown: (month: string, bankId: number | null) =>
    ipcRenderer.invoke('cashflow:get-spending-breakdown', month, bankId),
  getBanks: () => ipcRenderer.invoke('cashflow:get-banks'),
  updateBank: (payload: { id: BankId; openingBalance: number; creditLimit: number }) =>
    ipcRenderer.invoke('cashflow:update-bank', payload),
  addManualTransaction: (payload: TransactionInput) =>
    ipcRenderer.invoke('cashflow:add-manual-transaction', payload),
  deleteTransaction: (id: string) => ipcRenderer.invoke('cashflow:delete-transaction', id),
  getExistingKeys: (candidates: DuplicateCandidate[]) =>
    ipcRenderer.invoke('cashflow:get-existing-keys', candidates),
  importTransactions: (rows: TransactionInput[]) => ipcRenderer.invoke('cashflow:import-transactions', rows),
  clearAllData: () => ipcRenderer.invoke('cashflow:clear-all'),
}

contextBridge.exposeInMainWorld('cashflow', api)
