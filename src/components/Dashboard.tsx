import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDashboard, getRecentTransactions } from '../lib/db'
import type { DashboardData, Transaction } from '../lib/types'
import { BANK_OPTIONS, buildMonthOptions, formatCurrency, formatMonthLabel } from '../lib/utils'

interface DashboardProps {
  month: string
  onMonthChange: (month: string) => void
  refreshToken: number
}

function bankLabel(bankId: number): string {
  return BANK_OPTIONS.find((b) => b.id === bankId)?.label ?? 'Unknown'
}

export default function Dashboard({ month, onMonthChange, refreshToken }: DashboardProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [recentRows, setRecentRows] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const [dashboardResult, recentResult] = await Promise.all([
        getDashboard(month),
        getRecentTransactions(10),
      ])
      if (!active) return
      setDashboard(dashboardResult)
      setRecentRows(recentResult)
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [month, refreshToken])

  const monthOptions = useMemo(() => buildMonthOptions(24), [])

  if (loading || !dashboard) {
    return <p className="py-10 text-center text-sm text-[#666666]">Loading...</p>
  }

  const td = dashboard.banks.find((b) => b.id === 0)
  const bmo = dashboard.banks.find((b) => b.id === 1)
  const chequing = dashboard.banks.find((b) => b.id === 2)
  const net = dashboard.monthTotals.netCashFlow
  const netPositive = net >= 0

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Month selector */}
      <div className="flex justify-end">
        <select
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:outline-none"
        >
          {monthOptions.map((opt) => (
            <option key={opt} value={opt}>
              {formatMonthLabel(opt)}
            </option>
          ))}
        </select>
      </div>

      {/* Bank balance cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="TD CREDIT" value={formatCurrency(td?.current_balance ?? 0)} />
        <StatCard label="BMO CREDIT" value={formatCurrency(bmo?.current_balance ?? 0)} />
        <StatCard label="CHEQUING" value={formatCurrency(chequing?.current_balance ?? 0)} valueClass="text-[#22c55e]" />
      </div>

      {/* Income / Expenses / Net cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="INCOME (MONTH)"
          value={formatCurrency(dashboard.monthTotals.refunds)}
          valueClass="text-[#22c55e]"
        />
        <StatCard
          label="EXPENSES (MONTH)"
          value={formatCurrency(dashboard.monthTotals.charges)}
          valueClass="text-[#ef4444]"
        />
        <StatCard
          label="NET (MONTH)"
          value={`${netPositive ? '+' : ''}${formatCurrency(net)}`}
          valueClass={netPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}
        />
      </div>

      {/* Cash flow this month */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">
          Cash Flow This Month
        </p>
        <div className="divide-y divide-[#1f1f1f] rounded-xl border border-[#1f1f1f]">
          <CashFlowRow
            label="Income"
            value={formatCurrency(dashboard.monthTotals.refunds)}
            valueClass="text-[#22c55e]"
          />
          <CashFlowRow
            label="Expenses"
            value={formatCurrency(dashboard.monthTotals.charges)}
            valueClass="text-[#ef4444]"
          />
        </div>
      </section>

      {/* 6-month chart */}
      <section className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#666666]">
          Monthly Overview
        </p>
        <div className="h-52 w-full">
          <ResponsiveContainer>
            <BarChart data={dashboard.monthlySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                stroke="#333"
                tick={{ fill: '#888', fontSize: 11 }}
              />
              <YAxis stroke="#333" tick={{ fill: '#888', fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, color: '#fff' }}
                labelStyle={{ color: '#888' }}
              />
              <Legend wrapperStyle={{ color: '#888', fontSize: 12 }} />
              <Bar dataKey="charges" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              <Bar dataKey="refunds" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent transactions */}
      <section className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#666666]">
          Recent Transactions
        </p>
        <div className="divide-y divide-[#1f1f1f]">
          {recentRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{row.description}</p>
                <p className="mt-0.5 text-xs text-[#666666]">
                  {row.date} · {bankLabel(row.bank_id)} · {row.category}
                </p>
              </div>
              <span
                className={`ml-4 shrink-0 text-sm font-semibold ${
                  row.type === 'charge' ? 'text-[#ef4444]' : 'text-[#22c55e]'
                }`}
              >
                {row.type === 'charge' ? '-' : '+'}
                {formatCurrency(row.amount)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}

function CashFlowRow({
  label,
  value,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-[#888888]">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}
