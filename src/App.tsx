import { useEffect, useMemo, useState } from 'react'
import BankCards from './components/BankCards'
import Dashboard from './components/Dashboard'
import ImportCSV from './components/ImportCSV'
import ManualEntry from './components/ManualEntry'
import SpendingBreakdown from './components/SpendingBreakdown'
import Transactions from './components/Transactions'
import { currentMonth } from './lib/utils'

type ViewKey = 'dashboard' | 'import' | 'manual' | 'transactions' | 'breakdown' | 'banks'

const NAV_ITEMS: Array<{ key: ViewKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'import', label: 'Import CSV' },
  { key: 'manual', label: 'Add manually' },
  { key: 'transactions', label: 'All transactions' },
  { key: 'breakdown', label: 'Spending' },
  { key: 'banks', label: 'Banks' },
]

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('dashboard')
  const [month, setMonth] = useState(currentMonth())
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    window.cashflow.onOpenImport(() => setActiveView('import'))
  }, [])

  const content = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard month={month} onMonthChange={setMonth} refreshToken={refreshToken} />
      case 'import':
        return <ImportCSV onImported={() => setRefreshToken((t) => t + 1)} />
      case 'manual':
        return <ManualEntry onSaved={() => setRefreshToken((t) => t + 1)} />
      case 'transactions':
        return (
          <Transactions
            refreshToken={refreshToken}
            onChanged={() => setRefreshToken((t) => t + 1)}
          />
        )
      case 'breakdown':
        return <SpendingBreakdown refreshToken={refreshToken} />
      case 'banks':
        return <BankCards refreshToken={refreshToken} onChanged={() => setRefreshToken((t) => t + 1)} />
      default:
        return null
    }
  }, [activeView, month, refreshToken])

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <header className="border-b border-[#1f1f1f] px-6 pb-0 pt-5">
        <nav className="flex flex-wrap gap-2 pb-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveView(item.key)}
              className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                activeView === item.key
                  ? 'border-white bg-white text-[#111111]'
                  : 'border-[#333333] bg-transparent text-[#cccccc] hover:border-[#555555] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="p-6">{content}</main>
    </div>
  )
}

export default App
