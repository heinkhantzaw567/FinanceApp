import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { randomUUID } from 'crypto'
import Database from 'better-sqlite3'

type TxType = 'charge' | 'refund'
type BankId = 0 | 1

interface TransactionInput {
  date: string
  description: string
  amount: number
  type: TxType
  bankId: BankId
  category: string
  source?: 'import' | 'manual'
}

interface TransactionFilter {
  bankId?: number | null
  type?: TxType | null
  month?: string | null
  category?: string | null
}

interface DuplicateCandidate {
  key: string
  date: string
  description: string
  amount: number
  bankId: BankId
}

let db: Database.Database

function normalizeAmount(value: number): number {
  return Math.round(Math.abs(value) * 100) / 100
}

function monthBounds(month: string): { start: string; end: string } {
  const [yearRaw, monthRaw] = month.split('-')
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const startDate = new Date(year, monthIndex, 1)
  const endDate = new Date(year, monthIndex + 1, 0)
  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  }
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = `${date.getMonth() + 1}`.padStart(2, '0')
  const dd = `${date.getDate()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function monthId(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number): string {
  const [yearRaw, monthRaw] = month.split('-')
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1 + delta, 1)
  return monthId(date)
}

function monthSeries(endMonth: string, count: number): string[] {
  const months: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(shiftMonth(endMonth, -i))
  }
  return months
}

function ensureDb(): void {
  const dbPath = path.join(app.getPath('userData'), 'cashflow.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('charge', 'refund')),
      bank_id INTEGER NOT NULL CHECK(bank_id IN (0, 1, 2)),
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banks (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'credit',
      opening_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
  `)

  db.prepare(
    `INSERT OR IGNORE INTO banks (id, name, account_type, opening_balance, credit_limit) VALUES
      (0, 'TD Credit Card', 'credit', 0, 0),
      (1, 'BMO Credit Card', 'credit', 0, 0),
      (2, 'TD Chequing', 'chequing', 0, 0)`
  ).run()

}

function createWindow(): void {
  const isDev = !app.isPackaged
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#08101a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('cashflow:get-dashboard', (_event, month: string) => {
    const { start, end } = monthBounds(month)

    const monthTotals = db
      .prepare(
        `
        SELECT
          COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
          COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
        FROM transactions
        WHERE date BETWEEN ? AND ?
      `
      )
      .get(start, end) as { charges: number; refunds: number }

    const bankRows = db
      .prepare(
        `
        SELECT
          b.id,
          b.name,
          b.account_type,
          b.opening_balance,
          b.credit_limit,
          COALESCE(SUM(CASE WHEN t.type = 'charge' THEN t.amount END), 0) AS charges,
          COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount END), 0) AS refunds,
          COUNT(t.id) AS transaction_count
        FROM banks b
        LEFT JOIN transactions t ON t.bank_id = b.id
        GROUP BY b.id, b.name, b.account_type, b.opening_balance, b.credit_limit
        ORDER BY b.id ASC
      `
      )
      .all() as Array<{
      id: BankId
      name: string
      account_type: 'credit' | 'chequing'
      opening_balance: number
      credit_limit: number
      charges: number
      refunds: number
      transaction_count: number
    }>

    const seriesMonths = monthSeries(month, 6)
    const monthlySeries = seriesMonths.map((monthPoint) => {
      const bounds = monthBounds(monthPoint)
      const value = db
        .prepare(
          `
          SELECT
            COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
            COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
          FROM transactions
          WHERE date BETWEEN ? AND ?
        `
        )
        .get(bounds.start, bounds.end) as { charges: number; refunds: number }

      return {
        month: monthPoint,
        charges: normalizeAmount(value.charges),
        refunds: normalizeAmount(value.refunds),
      }
    })

    const banks = bankRows.map((row) => {
      // Credit cards: liability grows with charges, shrinks with refunds/payments
      // Chequing: balance grows with income (refunds), shrinks with debits (charges)
      const currentBalance =
        row.account_type === 'chequing'
          ? row.opening_balance + row.refunds - row.charges
          : row.opening_balance + row.charges - row.refunds
      return {
        ...row,
        current_balance: normalizeAmount(currentBalance),
      }
    })

    return {
      month,
      monthTotals: {
        charges: normalizeAmount(monthTotals.charges),
        refunds: normalizeAmount(monthTotals.refunds),
        netCashFlow: normalizeAmount(monthTotals.refunds - monthTotals.charges),
      },
      banks,
      monthlySeries,
    }
  })

  ipcMain.handle('cashflow:get-recent-transactions', (_event, limit: number) => {
    return db
      .prepare(
        `
        SELECT id, date, description, amount, type, bank_id, category, source, created_at
        FROM transactions
        ORDER BY date DESC, created_at DESC
        LIMIT ?
      `
      )
      .all(limit)
  })

  ipcMain.handle('cashflow:get-transactions', (_event, filters: TransactionFilter) => {
    const where: string[] = []
    const params: Array<string | number> = []

    if (typeof filters.bankId === 'number') {
      where.push('bank_id = ?')
      params.push(filters.bankId)
    }

    if (filters.type) {
      where.push('type = ?')
      params.push(filters.type)
    }

    if (filters.category && filters.category !== 'All') {
      where.push('category = ?')
      params.push(filters.category)
    }

    if (filters.month) {
      const bounds = monthBounds(filters.month)
      where.push('date BETWEEN ? AND ?')
      params.push(bounds.start, bounds.end)
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    return db
      .prepare(
        `
        SELECT id, date, description, amount, type, bank_id, category, source, created_at
        FROM transactions
        ${whereSql}
        ORDER BY date DESC, created_at DESC
      `
      )
      .all(...params)
  })

  ipcMain.handle('cashflow:get-spending-breakdown', (_event, month: string, bankId: number | null) => {
    const bounds = monthBounds(month)
    const params: Array<string | number> = [bounds.start, bounds.end]
    const bankFilter = typeof bankId === 'number' ? 'AND bank_id = ?' : ''
    if (typeof bankId === 'number') {
      params.push(bankId)
    }

    return db
      .prepare(
        `
        SELECT
          category,
          COUNT(*) AS transaction_count,
          COALESCE(SUM(amount), 0) AS amount
        FROM transactions
        WHERE date BETWEEN ? AND ?
          AND type = 'charge'
          ${bankFilter}
        GROUP BY category
        ORDER BY amount DESC
      `
      )
      .all(...params)
  })

  ipcMain.handle('cashflow:get-banks', () => {
    return db
      .prepare(
        `
        SELECT
          b.id,
          b.name,
          b.account_type,
          b.opening_balance,
          b.credit_limit,
          COALESCE(SUM(CASE WHEN t.type = 'charge' THEN t.amount END), 0) AS charges,
          COALESCE(SUM(CASE WHEN t.type = 'refund' THEN t.amount END), 0) AS refunds,
          COUNT(t.id) AS transaction_count
        FROM banks b
        LEFT JOIN transactions t ON t.bank_id = b.id
        GROUP BY b.id, b.name, b.account_type, b.opening_balance, b.credit_limit
        ORDER BY b.id ASC
      `
      )
      .all()
      .map((row: any) => ({
        ...row,
        current_balance: normalizeAmount(
          row.account_type === 'chequing'
            ? row.opening_balance + row.refunds - row.charges
            : row.opening_balance + row.charges - row.refunds
        ),
      }))
  })

  ipcMain.handle('cashflow:update-bank', (_event, payload: { id: BankId; openingBalance: number; creditLimit: number }) => {
    db.prepare('UPDATE banks SET opening_balance = ?, credit_limit = ? WHERE id = ?').run(
      normalizeAmount(payload.openingBalance),
      normalizeAmount(payload.creditLimit),
      payload.id
    )
    return true
  })

  ipcMain.handle('cashflow:add-manual-transaction', (_event, payload: TransactionInput) => {
    db.prepare(
      `
      INSERT INTO transactions (id, date, description, amount, type, bank_id, category, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      randomUUID(),
      payload.date,
      payload.description,
      normalizeAmount(payload.amount),
      payload.type,
      payload.bankId,
      payload.category,
      payload.source ?? 'manual',
      new Date().toISOString()
    )

    return true
  })

  ipcMain.handle('cashflow:delete-transaction', (_event, id: string) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
    return true
  })

  ipcMain.handle('cashflow:get-existing-keys', (_event, candidates: DuplicateCandidate[]) => {
    const check = db.prepare(
      'SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ? AND bank_id = ? LIMIT 1'
    )

    const matches: string[] = []
    for (const item of candidates) {
      const found = check.get(item.date, item.description, normalizeAmount(item.amount), item.bankId) as
        | { id: string }
        | undefined
      if (found) {
        matches.push(item.key)
      }
    }

    return matches
  })

  ipcMain.handle('cashflow:import-transactions', (_event, payload: TransactionInput[]) => {
    const check = db.prepare(
      'SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ? AND bank_id = ? LIMIT 1'
    )
    const insert = db.prepare(
      `
      INSERT INTO transactions (id, date, description, amount, type, bank_id, category, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )

    let imported = 0
    let duplicates = 0

    const transaction = db.transaction((rows: TransactionInput[]) => {
      for (const row of rows) {
        const amount = normalizeAmount(row.amount)
        const existing = check.get(row.date, row.description, amount, row.bankId)
        if (existing) {
          duplicates += 1
          continue
        }

        insert.run(
          randomUUID(),
          row.date,
          row.description,
          amount,
          row.type,
          row.bankId,
          row.category,
          row.source ?? 'import',
          new Date().toISOString()
        )
        imported += 1
      }
    })

    transaction(payload)

    return { imported, duplicates }
  })

  ipcMain.handle('cashflow:clear-all', () => {
    db.prepare('DELETE FROM transactions').run()
    return true
  })
}

app.whenReady().then(() => {
  ensureDb()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (db) {
    db.close()
  }
})
