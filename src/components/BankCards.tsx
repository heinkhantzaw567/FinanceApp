import { useEffect, useState } from 'react'
import { clearAllData, getBanks, recategorizeAll, updateBank } from '../lib/db'
import type { BankStats } from '../lib/types'
import { formatCurrency } from '../lib/utils'

interface BankCardsProps {
  refreshToken: number
  onChanged: () => void
}

export default function BankCards({ refreshToken, onChanged }: BankCardsProps) {
  const [rows, setRows] = useState<BankStats[]>([])

  useEffect(() => {
    load()
  }, [refreshToken])

  async function load() {
    const result = await getBanks()
    setRows(result)
  }

  async function saveBank(row: BankStats) {
    await updateBank({
      id: row.id,
      openingBalance: Number(row.opening_balance),
      creditLimit: Number(row.credit_limit),
    })
    await load()
    onChanged()
  }

  async function clearAll() {
    if (!window.confirm('Delete ALL transactions? This cannot be undone.')) return
    await clearAllData()
    await load()
    onChanged()
  }

  async function recategorize() {
    const result = await recategorizeAll()
    onChanged()
    window.alert(`Re-categorized ${result.updated} transactions.`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Banks</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={recategorize}
            className="rounded-full border border-[#333333] px-4 py-2 text-sm font-medium text-[#cccccc] hover:border-[#555555] hover:text-white"
          >
            Re-categorize all
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-full border border-[#ef4444]/60 px-4 py-2 text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/10"
          >
            Clear all data
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((row) => {
          const usage = row.credit_limit > 0 ? row.current_balance / row.credit_limit : 0
          const warn = usage >= 0.85

          return (
            <article key={row.id} className="space-y-4 rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">{row.name}</p>

              <div className="divide-y divide-[#1f1f1f] rounded-lg border border-[#1f1f1f]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-[#888888]">
                    {row.account_type === 'chequing' ? 'Account balance' : 'Current balance (liability)'}
                  </span>
                  <span className={`text-sm font-bold ${row.account_type === 'chequing' ? 'text-[#22c55e]' : 'text-white'}`}>
                    {formatCurrency(row.current_balance)}
                  </span>
                </div>
                {row.account_type === 'chequing' ? (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-[#888888]">Total income imported</span>
                    <span className="text-sm font-semibold text-[#22c55e]">{formatCurrency(row.refunds)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-[#888888]">Total charges</span>
                      <span className="text-sm font-semibold text-[#ef4444]">{formatCurrency(row.charges)}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-[#888888]">Total refunds</span>
                      <span className="text-sm font-semibold text-[#22c55e]">{formatCurrency(row.refunds)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-[#888888]">Transactions</span>
                  <span className="text-sm text-white">{row.transaction_count}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-widest text-[#666666]">
                  Opening balance
                  <input
                    type="number"
                    step="0.01"
                    value={row.opening_balance}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, opening_balance: value } : item)))
                    }}
                    className="rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </label>
                {row.account_type === 'credit' && (
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-widest text-[#666666]">
                    Credit limit (optional)
                    <input
                      type="number"
                      step="0.01"
                      value={row.credit_limit}
                      onChange={(e) => {
                        const value = Number(e.target.value)
                        setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, credit_limit: value } : item)))
                      }}
                      className="rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
                    />
                  </label>
                )}
              </div>

              {warn && row.account_type === 'credit' && (
                <p className="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3 text-sm text-[#f59e0b]">
                  Approaching credit limit — {(usage * 100).toFixed(0)}% used.
                </p>
              )}

              <button
                type="button"
                onClick={() => saveBank(row)}
                className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#111111] hover:bg-[#e5e5e5]"
              >
                Save settings
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
