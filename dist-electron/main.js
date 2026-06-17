"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let db;
let mainWindow = null;
let tray = null;
let isQuitting = false;
const APP_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAFXElEQVR42u3dXU4qSwBGUSbgCJyBg3HUvjomDQ8khkig6R+6ei+S9UpSJd/G67nK6XSwx9v7xw+s5eRh2CAUBg+CYPQgBkYPYmD4IASGD0Jg+CAExg/FCPgiQjQEvnAQjYAvGAQj4IsE0RD4wkA0Ar4gEI2ALwREI+ALANEIuHiIRsCFQzQCLhrCEXDJEA2AC4ZoBFwsRCPgQiEcAZcJ0QC4SIhGwAVCOAIuD6IBcHEQjoBLg2gAXBiEI+CyIBoAFwXhCLgkEACgFgAXBOEIuBwQAKAWABcD4Qi4FBAAQACATABcCIQj4DJAAAABAAQAEABAAAABAAQAEABg8AC4CAhHwCWAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAK9xfrgHASA2+lsPAYDo+MsREAAO/637lIcAwCDv4EuPvxgBAWDob90FQACI/je7AAgA0eH/fXx+f/1rzuPWc14TANjh+OdE4NHxCwC8cPwCIABEh//oUAVAADjY8KeOdK3nFQDY8fCnRuCZ5xUA2Gj85+d4NgD3IvDscwoAbDD8izkBuI7BEs8jALDR+JcMwFIEADYYvgAIAIHx33tuARAAYu/6AiAAxIcvAAJAfPwCIABEhy8AAkDgh3wCIAB41xcAAcDwBUAAMH4BEADawxcAASDwQz4BEAC86wuAAGD4AiAAGL8ACADt4QuAABD4IZ8ACADe9QVAADB8ARAAjF8ABID28AVAAAj8kE8ABADv+gIgABi+AAgAxi8AAsCywx81BAIgAMa/0kMABIDg8P0rgAAQH/4oERAAATD8CUMWAAEQgOA7/pznEgABYOBv9S8vziWeY28DEAABMPoJo11z/AIgAOx0+AIgAAIQHr4ACIAAHPif8qa8SNd6XgEQAHY8/KkRGGEAAiAA6f9Xf86LdY2wCIAAsOEv6Sz1wp0zegEQAF70m3n1AQiAAKR/JVcABEAAwr+LLwACIADhP8IhAAIgAOG/viMAAiAA4T+7JQACIADhv7cnAAIgAAMM3wCcXwC82xuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA0RuA8wuA4RuA8wvAVsMXAAEQgPDwfTquAAiA8fsZgAAIQH38AiAAAiAAAiAAAjDy+H06rgAIQPA7AJ+NJwACEAyAD8cUAAEI/iuAT8cVAAEI/Y9APh1XAAQgHACfjisAAiAAPh1XAARAAHw6rgAIgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgBeA8zu/AHgBOL/zC4AXgPM7vwB4ATi/8wuAF4DzO78AeAE4v/MLgBeA8zu/AHgBOL/zC4AXgPM7vwB4ATi/8wuAF4DzO78AeAE4v/MLACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAC4CJAAIBcAM4PFwHR8QsACIALAQEABAAQAEAAAAEABAAQAOAgARABCI9fAEAAXAwIAJALgAhAePwCAALggqAaABGA8PgFAATARUE1ICIA4fELAMQDIAIQHr8AQDwAIgDh8QsAxAMgAhAevwhAfPwCAPEAiACExy8CEB+/CEB8/AIA8QCIAITHLwIQH78IQHz8IgDx8YsAxMcvAhAfvwhAfPxCAPHhiwAYvwhAffxCAPHhiwAYvxBAffhCAIYvBGD4YoDRe4gBRu8hCBi8h1Bg2Bs/fgF9QmaUOb+hoAAAAABJRU5ErkJggg==';
function normalizeAmount(value) {
    return Math.round(Math.abs(value) * 100) / 100;
}
function monthBounds(month) {
    const [yearRaw, monthRaw] = month.split('-');
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    const startDate = new Date(year, monthIndex, 1);
    const endDate = new Date(year, monthIndex + 1, 0);
    return {
        start: formatDate(startDate),
        end: formatDate(endDate),
    };
}
function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, '0');
    const dd = `${date.getDate()}`.padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
function monthId(date) {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}
function shiftMonth(month, delta) {
    const [yearRaw, monthRaw] = month.split('-');
    const date = new Date(Number(yearRaw), Number(monthRaw) - 1 + delta, 1);
    return monthId(date);
}
function monthSeries(endMonth, count) {
    const months = [];
    for (let i = count - 1; i >= 0; i -= 1) {
        months.push(shiftMonth(endMonth, -i));
    }
    return months;
}
function ensureDb() {
    const dbPath = path_1.default.join(electron_1.app.getPath('userData'), 'cashflow.db');
    db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('charge', 'refund')),
      bank_id INTEGER NOT NULL,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
  `);
    // --- Migrations (must run BEFORE any INSERT that references new columns) ---
    // 1. Add account_type to banks if missing (old schema had no such column)
    const bankCols = db.pragma('table_info(banks)').map((c) => c.name);
    if (!bankCols.includes('account_type')) {
        db.exec(`ALTER TABLE banks ADD COLUMN account_type TEXT NOT NULL DEFAULT 'credit'`);
        db.prepare(`UPDATE banks SET account_type = 'chequing' WHERE id = 2`).run();
    }
    // 2. Widen bank_id CHECK constraint from (0,1) → (0,1,2) if needed.
    //    SQLite can't ALTER constraints, so recreate the table.
    const txCreate = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'`).get()?.sql ?? '';
    if (txCreate.includes('(0, 1)') && !txCreate.includes('(0, 1, 2)')) {
        db.exec(`
      ALTER TABLE transactions RENAME TO transactions_old;
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('charge', 'refund')),
        bank_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO transactions SELECT * FROM transactions_old;
      DROP TABLE transactions_old;
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    `);
    }
    // 3. Drop bank_id CHECK constraint to allow any bank id (supports user-added banks).
    //    Re-read txCreate since migration 2 may have just rewritten it.
    const txCreate2 = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'`).get()?.sql ?? '';
    if (txCreate2.includes('CHECK(bank_id IN')) {
        db.exec(`
      ALTER TABLE transactions RENAME TO transactions_old;
      CREATE TABLE transactions (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('charge', 'refund')),
        bank_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      INSERT INTO transactions SELECT * FROM transactions_old;
      DROP TABLE transactions_old;
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_bank ON transactions(bank_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    `);
    }
    // --- Seed bank rows (after migrations so account_type column is guaranteed present) ---
    db.prepare(`INSERT OR IGNORE INTO banks (id, name, account_type, opening_balance, credit_limit) VALUES
      (0, 'TD Credit Card', 'credit', 0, 0),
      (1, 'BMO Credit Card', 'credit', 0, 0),
      (2, 'TD Chequing', 'chequing', 0, 0),
      (3, 'Other', 'credit', 0, 0),
      (4, 'BMO Chequing', 'chequing', 0, 0)`).run();
}
function checkAndNotify() {
    if (!mainWindow)
        return;
    const current = monthId(new Date());
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('last_notified_month');
    const lastNotified = row?.value ?? '';
    if (current === lastNotified)
        return;
    const { start, end } = monthBounds(current);
    const { count } = db
        .prepare('SELECT COUNT(*) AS count FROM transactions WHERE date BETWEEN ? AND ?')
        .get(start, end);
    // Record that we've checked this month regardless of whether we notify
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_notified_month', current);
    // Already imported data this month — no notification needed
    if (count > 0)
        return;
    if (!electron_1.Notification.isSupported())
        return;
    const [yearStr, monthStr] = current.split('-');
    const monthLabel = new Date(Number(yearStr), Number(monthStr) - 1, 1).toLocaleString('en-US', {
        month: 'long',
        year: 'numeric',
    });
    const notification = new electron_1.Notification({
        title: 'Cashflow Tracker',
        body: `It's ${monthLabel} — time to download your TD and BMO statements.`,
    });
    notification.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('open-import');
        }
    });
    notification.show();
}
function setupTray() {
    const icon = electron_1.nativeImage.createFromDataURL(APP_ICON_DATA_URL).resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    tray.setToolTip('Cashflow Tracker');
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Open',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                electron_1.app.quit();
            },
        },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
    tray.on('double-click', () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
function createWindow() {
    const isDev = !electron_1.app.isPackaged;
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 840,
        minWidth: 1200,
        minHeight: 800,
        backgroundColor: '#08101a',
        icon: electron_1.nativeImage.createFromDataURL(APP_ICON_DATA_URL),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Hide to tray instead of closing
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173').catch((err) => {
            console.error('[main] loadURL failed:', err);
        });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html')).catch((err) => {
            console.error('[main] loadFile failed:', err);
        });
    }
}
function registerIpcHandlers() {
    electron_1.ipcMain.handle('cashflow:get-dashboard', (_event, month) => {
        const { start, end } = monthBounds(month);
        const monthTotals = db
            .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
          COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
        FROM transactions
        WHERE date BETWEEN ? AND ?
      `)
            .get(start, end);
        const bankRows = db
            .prepare(`
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
      `)
            .all();
        const seriesMonths = monthSeries(month, 6);
        const monthlySeries = seriesMonths.map((monthPoint) => {
            const bounds = monthBounds(monthPoint);
            const value = db
                .prepare(`
          SELECT
            COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
            COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
          FROM transactions
          WHERE date BETWEEN ? AND ?
        `)
                .get(bounds.start, bounds.end);
            return {
                month: monthPoint,
                charges: normalizeAmount(value.charges),
                refunds: normalizeAmount(value.refunds),
            };
        });
        const banks = bankRows.map((row) => {
            // Credit cards: liability grows with charges, shrinks with refunds/payments
            // Chequing: balance grows with income (refunds), shrinks with debits (charges)
            const currentBalance = row.account_type === 'chequing'
                ? row.opening_balance + row.refunds - row.charges
                : row.opening_balance + row.charges - row.refunds;
            return {
                ...row,
                current_balance: normalizeAmount(currentBalance),
            };
        });
        return {
            month,
            monthTotals: {
                charges: normalizeAmount(monthTotals.charges),
                refunds: normalizeAmount(monthTotals.refunds),
                netCashFlow: normalizeAmount(monthTotals.refunds - monthTotals.charges),
            },
            banks,
            monthlySeries,
        };
    });
    electron_1.ipcMain.handle('cashflow:get-recent-transactions', (_event, limit) => {
        return db
            .prepare(`
        SELECT id, date, description, amount, type, bank_id, category, source, created_at
        FROM transactions
        ORDER BY date DESC, created_at DESC
        LIMIT ?
      `)
            .all(limit);
    });
    electron_1.ipcMain.handle('cashflow:get-transactions', (_event, filters) => {
        const where = [];
        const params = [];
        if (typeof filters.bankId === 'number') {
            where.push('bank_id = ?');
            params.push(filters.bankId);
        }
        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.category && filters.category !== 'All') {
            where.push('category = ?');
            params.push(filters.category);
        }
        if (filters.month) {
            const bounds = monthBounds(filters.month);
            where.push('date BETWEEN ? AND ?');
            params.push(bounds.start, bounds.end);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        return db
            .prepare(`
        SELECT id, date, description, amount, type, bank_id, category, source, created_at
        FROM transactions
        ${whereSql}
        ORDER BY date DESC, created_at DESC
      `)
            .all(...params);
    });
    electron_1.ipcMain.handle('cashflow:get-spending-breakdown', (_event, month, bankId) => {
        const bounds = monthBounds(month);
        const params = [bounds.start, bounds.end];
        const bankFilter = typeof bankId === 'number' ? 'AND bank_id = ?' : '';
        if (typeof bankId === 'number') {
            params.push(bankId);
        }
        return db
            .prepare(`
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
      `)
            .all(...params);
    });
    electron_1.ipcMain.handle('cashflow:get-banks', () => {
        return db
            .prepare(`
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
      `)
            .all()
            .map((row) => ({
            ...row,
            current_balance: normalizeAmount(row.account_type === 'chequing'
                ? row.opening_balance + row.refunds - row.charges
                : row.opening_balance + row.charges - row.refunds),
        }));
    });
    electron_1.ipcMain.handle('cashflow:update-bank', (_event, payload) => {
        db.prepare('UPDATE banks SET opening_balance = ?, credit_limit = ? WHERE id = ?').run(normalizeAmount(payload.openingBalance), normalizeAmount(payload.creditLimit), payload.id);
        return true;
    });
    electron_1.ipcMain.handle('cashflow:add-manual-transaction', (_event, payload) => {
        db.prepare(`
      INSERT INTO transactions (id, date, description, amount, type, bank_id, category, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run((0, crypto_1.randomUUID)(), payload.date, payload.description, normalizeAmount(payload.amount), payload.type, payload.bankId, payload.category, payload.source ?? 'manual', new Date().toISOString());
        return true;
    });
    electron_1.ipcMain.handle('cashflow:delete-transaction', (_event, id) => {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        return true;
    });
    electron_1.ipcMain.handle('cashflow:get-existing-keys', (_event, candidates) => {
        if (candidates.length === 0)
            return [];
        // Single query — fetch all existing fingerprints and match in JS.
        // Avoids N round-trips to SQLite for large CSV files.
        const existing = db
            .prepare('SELECT date, description, amount, bank_id FROM transactions')
            .all();
        const existingSet = new Set(existing.map((r) => `${r.date}|${r.description.trim().toUpperCase()}|${r.amount.toFixed(2)}|${r.bank_id}`));
        return candidates
            .filter((c) => {
            const k = `${c.date}|${c.description.trim().toUpperCase()}|${normalizeAmount(c.amount).toFixed(2)}|${c.bankId}`;
            return existingSet.has(k);
        })
            .map((c) => c.key);
    });
    electron_1.ipcMain.handle('cashflow:import-transactions', (_event, payload) => {
        const check = db.prepare('SELECT id FROM transactions WHERE date = ? AND description = ? AND amount = ? AND bank_id = ? LIMIT 1');
        const insert = db.prepare(`
      INSERT INTO transactions (id, date, description, amount, type, bank_id, category, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        let imported = 0;
        let duplicates = 0;
        const transaction = db.transaction((rows) => {
            for (const row of rows) {
                const amount = normalizeAmount(row.amount);
                const existing = check.get(row.date, row.description, amount, row.bankId);
                if (existing) {
                    duplicates += 1;
                    continue;
                }
                insert.run((0, crypto_1.randomUUID)(), row.date, row.description, amount, row.type, row.bankId, row.category, row.source ?? 'import', new Date().toISOString());
                imported += 1;
            }
        });
        transaction(payload);
        return { imported, duplicates };
    });
    electron_1.ipcMain.handle('cashflow:clear-all', () => {
        db.prepare('DELETE FROM transactions').run();
        return true;
    });
}
electron_1.app.whenReady().then(() => {
    ensureDb();
    registerIpcHandlers();
    createWindow();
    setupTray();
    checkAndNotify();
    // Re-check on month rollover if app stays open overnight
    setInterval(() => checkAndNotify(), 4 * 60 * 60 * 1000);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch((err) => {
    console.error('[main] startup error:', err);
    electron_1.app.exit(1);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    if (db) {
        db.close();
    }
});
