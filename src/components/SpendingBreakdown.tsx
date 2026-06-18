import { useEffect, useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getSpendingBreakdown } from '../lib/db'
import type { SpendingBreakdownRow } from '../lib/types'
import { BANK_OPTIONS, buildMonthOptions, formatCurrency, formatMonthLabel } from '../lib/utils'

interface SpendingBreakdownProps {
  refreshToken: number
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#14b8a6', '#0ea5e9', '#6366f1']

export default function SpendingBreakdown({ refreshToken }: SpendingBreakdownProps) {
  const [month, setMonth] = useState(buildMonthOptions(1)[0])
  const [bankFilter, setBankFilter] = useState<string>('all')
  const [rows, setRows] = useState<SpendingBreakdownRow[]>([])

  const monthOptions = useMemo(() => buildMonthOptions(24), [])

  useEffect(() => {
    async function load() {
      const bankId = bankFilter === 'all' ? null : Number(bankFilter)
      const result = await getSpendingBreakdown(month, bankId)
      setRows(result)
    }

    load()
  }, [month, bankFilter, refreshToken])

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.amount, 0), [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Spending breakdown</p>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
          >
            {monthOptions.map((opt) => (
              <option key={opt} value={opt}>{formatMonthLabel(opt)}</option>
            ))}
          </select>
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="all">Combined</option>
            {BANK_OPTIONS.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#666666]">Category distribution</p>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={rows} dataKey="amount" nameKey="category" innerRadius={65} outerRadius={110}>
                  {rows.map((entry, index) => (
                    <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#666666]">Details</p>
          <div className="max-h-72 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] text-left">
                  {['Category','Amount','%','#'].map((h) => (
                    <th key={h} className="py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {rows.map((row) => (
                  <tr key={row.category}>
                    <td className="py-3 pr-3 text-white">{row.category}</td>
                    <td className="py-3 pr-3 text-[#ef4444]">{formatCurrency(row.amount)}</td>
                    <td className="py-3 pr-3 text-[#888888]">
                      {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '0%'}
                    </td>
                    <td className="py-3 text-[#888888]">{row.transaction_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 border-t border-[#1f1f1f] pt-4 text-sm text-[#888888]">
            Total: <strong className="text-[#ef4444]">{formatCurrency(total)}</strong>
          </div>
        </section>
      </div>
    </div>
  )
}
