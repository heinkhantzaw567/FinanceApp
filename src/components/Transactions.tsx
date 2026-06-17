import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { deleteTransaction, getTransactions } from '../lib/db'
import type { Transaction, TxType } from '../lib/types'
import {
  BANK_OPTIONS,
  CATEGORY_OPTIONS,
  buildMonthOptions,
  formatCurrency,
  formatMonthLabel,
  txTypeLabel,
} from '../lib/utils'

interface TransactionsProps {
  refreshToken: number
  onChanged: () => void
}

function bankLabel(bankId: number): string {
  return BANK_OPTIONS.find((b) => b.id === bankId)?.label ?? 'Unknown'
}

export default function Transactions({ refreshToken, onChanged }: TransactionsProps) {
  const [rows, setRows] = useState<Transaction[]>([])
  const [month, setMonth] = useState('')
  const [bankId, setBankId] = useState('all')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('All')

  const monthOptions = useMemo(() => ['', ...buildMonthOptions(24)], [])

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, bankId, type, category, refreshToken])

  async function loadRows() {
    const result = await getTransactions({
      month: month || null,
      bankId: bankId === 'all' ? null : Number(bankId),
      type: type === 'all' ? null : (type as TxType),
      category,
    })
    setRows(result)
  }

  async function removeRow(id: string) {
    if (!window.confirm('Delete this transaction?')) {
      return
    }
    await deleteTransaction(id)
    await loadRows()
    onChanged()
  }

  function exportCsv() {
    const data = rows.map((row) => ({
      Date: row.date,
      Description: row.description,
      Bank: bankLabel(row.bank_id),
      Type: txTypeLabel(row.type),
      Category: row.category,
      Amount: row.amount,
    }))

    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'cashflow-transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const totals = useMemo(() => {
    const charges = rows.filter((row) => row.type === 'charge').reduce((sum, row) => sum + row.amount, 0)
    const refunds = rows.filter((row) => row.type === 'refund').reduce((sum, row) => sum + row.amount, 0)
    return {
      charges,
      refunds,
      net: refunds - charges,
    }
  }, [rows])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">All transactions</p>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-full border border-[#333333] px-5 py-2 text-sm font-medium text-[#cccccc] hover:border-[#555555] hover:text-white"
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <select
          value={bankId}
          onChange={(e) => setBankId(e.target.value)}
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="all">All Banks</option>
          {BANK_OPTIONS.map((bank) => (
            <option key={bank.id} value={bank.id}>{bank.label}</option>
          ))}
        </select>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="all">All Types</option>
          <option value="charge">Charge</option>
          <option value="refund">Refund</option>
        </select>

        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">All Months</option>
          {monthOptions.filter(Boolean).map((opt) => (
            <option key={opt} value={opt}>{formatMonthLabel(opt)}</option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="All">All Categories</option>
          {CATEGORY_OPTIONS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <section className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-4">
        <div className="max-h-[460px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] text-left">
                {['Date','Description','Bank','Type','Category','Amount',''].map((h) => (
                  <th key={h} className="py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-3 pr-3 text-[#888888]">{row.date}</td>
                  <td className="py-3 pr-3 text-white">{row.description}</td>
                  <td className="py-3 pr-3 text-[#888888]">{bankLabel(row.bank_id)}</td>
                  <td className={`py-3 pr-3 font-medium ${row.type === 'charge' ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {txTypeLabel(row.type)}
                  </td>
                  <td className="py-3 pr-3 text-[#888888]">{row.category}</td>
                  <td className={`py-3 pr-3 text-right font-semibold ${row.type === 'charge' ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                    {row.type === 'charge' ? '-' : '+'}{formatCurrency(row.amount)}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="rounded-full border border-[#ef4444]/50 px-3 py-1 text-xs text-[#ef4444] hover:bg-[#ef4444]/10"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 border-t border-[#1f1f1f] pt-4 text-sm">
          <span className="text-[#888888]">Expenses: <strong className="text-[#ef4444]">{formatCurrency(totals.charges)}</strong></span>
          <span className="text-[#888888]">Income: <strong className="text-[#22c55e]">{formatCurrency(totals.refunds)}</strong></span>
          <span className="text-[#888888]">Net: <strong className="text-white">{formatCurrency(totals.net)}</strong></span>
        </div>
      </section>
    </div>
  )
}
