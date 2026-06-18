"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = require("crypto");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
// ── Globals ───────────────────────────────────────────────────────────────────
let tdDb;
let bmoDb;
let mainWindow = null;
let tray = null;
let isQuitting = false;
const APP_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAFXElEQVR42u3dXU4qSwBGUSbgCJyBg3HUvjomDQ8khkig6R+6ei+S9UpSJd/G67nK6XSwx9v7xw+s5eRh2CAUBg+CYPQgBkYPYmD4IASGD0Jg+CAExg/FCPgiQjQEvnAQjYAvGAQj4IsE0RD4wkA0Ar4gEI2ALwREI+ALANEIuHiIRsCFQzQCLhrCEXDJEA2AC4ZoBFwsRCPgQiEcAZcJ0QC4SIhGwAVCOAIuD6IBcHEQjoBLg2gAXBiEI+CyIBoAFwXhCLgkEACgFgAXBOEIuBwQAKAWABcD4Qi4FBAAQACATABcCIQj4DJAAAABAAQAEABAAAABAAQAEABg8AC4CAhHwCWAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAK9xfrgHASA2+lsPAYDo+MsREAAO/637lIcAwCDv4EuPvxgBAWDob90FQACI/je7AAgA0eH/fXx+f/1rzuPWc14TANjh+OdE4NHxCwC8cPwCIABEh//oUAVAADjY8KeOdK3nFQDY8fCnRuCZ5xUA2Gj85+d4NgD3IvDscwoAbDD8izkBuI7BEs8jALDR+JcMwFIEADYYvgAIAIHx33tuARAAYu/6AiAAxIcvAAJAfPwCIABEhy8AAkDgh3wCIAB41xcAAcDwBUAAMH4BEADawxcAASDwQz4BEAC86wuAAGD4AiAAGL8ACADt4QuAABD4IZ8ACADe9QVAADB8ARAAjF8ABID28AVAAAj8kE8ABADv+gIgABi+AAgAxi8AAsCywx81BAIgAMa/0kMABIDg8P0rgAAQH/4oERAAATD8CUMWAAEQgOA7/pznEgABYOBv9S8vziWeY28DEAABMPoJo11z/AIgAOx0+AIgAAIQHr4ACIAAHPif8qa8SNd6XgEQAHY8/KkRGGEAAiAA6f9Xf86LdY2wCIAAsOEv6Sz1wp0zegEQAF70m3n1AQiAAKR/JVcABEAAwr+LLwACIADhP8IhAAIgAOG/viMAAiAA4T+7JQACIADhv7cnAAIgAAMM3wCcXwC82xuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA8wuA4RuA4RuA8wuA4RuA8wvAVsMXAAEQgPDwfTquAAiA8fsZgAAIQH38AiAAAiAAAiAAAjDy+H06rgAIQPA7AJ+NJwACEAyAD8cUAAEI/iuAT8cVAAEI/Y9APh1XAAQgHACfjisAAiAAPh1XAARAAHw6rgAIgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgAAYgPMLgBeA8zu/AHgBOL/zC4AXgPM7vwB4ATi/8wuAF4DzO78AeAE4v/MLgBeA8zu/AHgBOL/zC4AXgPM7vwB4ATi/8wuAF4DzO78AeAE4v/MLACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAC4CJAAIBcAM4PFwHR8QsACIALAQEABAAQAEAAAAEABAAQAOAgARABCI9fAEAAXAwIAJALgAhAePwCAALggqAaABGA8PgFAATARUE1ICIA4fELAMQDIAIQHr8AQDwAIgDh8QsAxAMgAhAevwhAfPwCAPEAiACExy8CEB+/CEB8/AIA8QCIAITHLwIQH78IQHz8IgDx8YsAxMcvAhAfvwhAfPxCAPHhiwAYvwhAffxCAPHhiwAYvxBAffhCAIYvBGD4YoDRe4gBRu8hCBi8h1Bg2Bs/fgF9QmaUOb+hoAAAAABJRU5ErkJggg==';
// ── Pure helpers ──────────────────────────────────────────────────────────────
function normalizeAmount(value) {
    return Math.round(Math.abs(value) * 100) / 100;
}
function monthBounds(month) {
    const [yearRaw, monthRaw] = month.split('-');
    const year = Number(yearRaw);
    const mi = Number(monthRaw) - 1;
    return {
        start: formatDate(new Date(year, mi, 1)),
        end: formatDate(new Date(year, mi + 1, 0)),
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
    for (let i = count - 1; i >= 0; i -= 1)
        months.push(shiftMonth(endMonth, -i));
    return months;
}
function accountTypeForBankId(bankId) {
    return bankId === 2 || bankId === 4 ? 'chequing' : 'credit';
}
function accountKeyForBankId(bankId) {
    switch (bankId) {
        case 0: return 'td_credit';
        case 1: return 'bmo_credit';
        case 2: return 'td_chequing';
        case 4: return 'bmo_chequing';
        default: return 'other';
    }
}
// ── Bank routing ──────────────────────────────────────────────────────────────
function bankRoute(bankId) {
    const isBmo = bankId === 1 || bankId === 4;
    return {
        db: isBmo ? bmoDb : tdDb,
        table: isBmo ? 'bmo_transactions' : 'td_transactions',
        banksTable: isBmo ? 'bmo_banks' : 'td_banks',
        accountType: accountTypeForBankId(bankId),
        accountKey: accountKeyForBankId(bankId),
    };
}
// ── Transfer keyword registry ─────────────────────────────────────────────────
const TRANSFER_KEYWORDS = {
    td_credit: [/^PAYMENT/i, /^INTERNET PAYMENT/i, /^ONLINE PAYMENT/i],
    td_chequing: [/TFR-TO/i, /TFR-FR/i, /\bTD VISA\b/i, /VISA PAYMENT/i, /INTERNET TRANSFER/i, /ONLINE TRANSFER/i],
    bmo_credit: [/^PAYMENT/i, /PAYMENT RECEIVED/i, /TRSF FROM/i, /TRSF DE/i],
    bmo_chequing: [/^BMO MASTERCARD/i, /^BMO MC\b/i, /MASTERCARD PAYMENT/i, /TF 0005191237197655547/i, /^ONLINE TRANSFER/i, /^INTERNET TRANSFER/i, /^TFR\b/i],
    other: [],
};
// Patterns that indicate the chequing side is sending money out (Layer 3)
const OUTGOING_CHEQUING_PATTERN = /TFR-TO|INTERNET TRANSFER|ONLINE TRANSFER/i;
// ── Transfer detection ────────────────────────────────────────────────────────
function detectAndTagTransfer(row, route) {
    const { db, table, accountType, accountKey } = route;
    // Layer 1 — keyword match
    if (TRANSFER_KEYWORDS[accountKey].some((p) => p.test(row.description))) {
        return {
            type: 'transfer',
            transfer_direction: accountType === 'credit' ? 'in' : 'out',
        };
    }
    // Layer 2 — intra-DB amount match (same DB, different account_type, same date+amount)
    const intraMatch = db.prepare(`
    SELECT id, account_type FROM ${table}
    WHERE date = ? AND amount = ? AND account_type != ? AND type != 'transfer'
    LIMIT 1
  `).get(row.date, row.amount, accountType);
    if (intraMatch) {
        // Update the already-inserted counterpart
        const counterpartDirection = intraMatch.account_type === 'credit' ? 'in' : 'out';
        db.prepare(`UPDATE ${table} SET type = 'transfer', transfer_direction = ? WHERE id = ?`)
            .run(counterpartDirection, intraMatch.id);
        return {
            type: 'transfer',
            transfer_direction: accountType === 'credit' ? 'in' : 'out',
        };
    }
    // Layer 3 — cross-DB chequing match (TD Chequing ↔ BMO Chequing)
    if (accountType === 'chequing') {
        const otherDb = db === tdDb ? bmoDb : tdDb;
        const otherTable = db === tdDb ? 'bmo_transactions' : 'td_transactions';
        const crossMatch = otherDb.prepare(`
      SELECT id FROM ${otherTable}
      WHERE date = ? AND amount = ? AND account_type = 'chequing' AND type != 'transfer'
      LIMIT 1
    `).get(row.date, row.amount);
        if (crossMatch) {
            const isOutgoing = OUTGOING_CHEQUING_PATTERN.test(row.description);
            const currentDirection = isOutgoing ? 'out' : 'in';
            const counterpartDirection = isOutgoing ? 'in' : 'out';
            otherDb.prepare(`UPDATE ${otherTable} SET type = 'transfer', transfer_direction = ? WHERE id = ?`)
                .run(counterpartDirection, crossMatch.id);
            return { type: 'transfer', transfer_direction: currentDirection };
        }
    }
    return { type: row.type, transfer_direction: null };
}
// ── Category logic (mirrors src/lib/utils.ts categorizeExpense — keep in sync) ─
function categorizeExpense(description) {
    const upper = description.toUpperCase();
    if (upper.includes('RENT') || upper.includes('LEASE'))
        return 'Rent';
    if (upper.includes('E-TRANSFER') || upper.includes('E-TFR') || upper.includes('ETRNSFR'))
        return 'E-Transfer';
    if (upper.includes('TD VISA') ||
        upper.includes('CREDIT CARD') ||
        upper.includes('CREDITCARD') ||
        upper.includes('TF 0005191237197655547'))
        return 'Credit Card Payment';
    if (upper.includes('PRESTO') ||
        upper.includes('TTC') ||
        upper.includes('GO TRANSIT') ||
        upper.includes('UBER') ||
        upper.includes('LYFT') ||
        upper.includes('TAXI'))
        return 'Transport & Transit';
    if (upper.includes('GROCERY') || upper.includes('GROCERIES') || upper.includes('METRO') ||
        upper.includes('LOBLAWS') || upper.includes('SOBEYS') || upper.includes('FOOD BASICS') ||
        upper.includes('T&T SUPERMARKET') || upper.includes('HMART') || upper.includes('H-MART') ||
        upper.includes('FRESHCO') || upper.includes('RABBA FINE FOODS') ||
        upper.includes('WHOLE FOODS') || upper.includes('FARM BOY') ||
        upper.includes('NO FRILLS') || upper.includes('SUPERSTORE'))
        return 'Groceries';
    if (upper.startsWith('TST-') ||
        upper.includes('STARBUCKS') || upper.includes('SBUX') || upper.includes('CHARTWELLS') ||
        upper.includes('CHATIME') || upper.includes('POPEYES') || upper.includes('KRISPY KREME') ||
        upper.includes('MCDONALD') || upper.includes('TIM HORTONS') ||
        upper.includes('HOT POT') || upper.includes('DUMPLING') || upper.includes('SUSHI') ||
        upper.includes('RAMEN') || upper.includes('PIZZA') || upper.includes('RESTAURANT') ||
        upper.includes('CAFE') || upper.includes('COFFEE') || upper.includes('BAKERY') ||
        upper.includes('CREPE') || upper.includes('NOODLE') || upper.includes('KIMCHI') ||
        upper.includes('KOREAN') || upper.includes('THAI') || upper.includes('VIETNAMESE') ||
        upper.includes('GRILL') || upper.includes('BURGER') || upper.includes('TACO') ||
        upper.includes('WINGS') || upper.includes('BRUNCH') || upper.includes('BISTRO') ||
        upper.includes('DINER') || upper.includes('KERNELS POPCORN') ||
        upper.includes('KREAM') || upper.includes('THE ALLEY'))
        return 'Dining & Restaurants';
    if (upper.includes('SHOPPERS DRUG MART') || upper.includes('REXALL') ||
        upper.includes('PHARMACY') || upper.includes('FIT4LESS') || upper.includes('FITNESS') ||
        upper.includes('GYM') || upper.includes('HAIR SALON') || upper.includes('BARBER') ||
        upper.includes('DENTAL') || upper.includes('MEDICAL') || upper.includes('CLINIC') ||
        upper.includes('HOSPITAL'))
        return 'Health & Pharmacy';
    if (upper.includes('AMAZON') || upper.includes('AMZN') || upper.includes('WINNERS') ||
        upper.includes('FOOT LOCKER') || upper.includes('SEPHORA') || upper.includes('BEST BUY') ||
        upper.includes('CANADIAN TIRE') || upper.includes('DOLLARAMA') ||
        upper.includes('WALMART') || upper.includes('COSTCO') || upper.includes('SPORT CHEK') ||
        upper.includes('H&M') || upper.includes('ZARA') || upper.includes('UNIQLO'))
        return 'Shopping & Clothing';
    if (upper.includes('FREEDOM MOBILE') || upper.includes('ROGERS') ||
        upper.includes('BELL CANADA') || upper.includes('TELUS') || upper.includes('FIDO') ||
        upper.includes('KOODO') || upper.includes('PUBLIC MOBILE') || upper.includes('VIRGIN MOBILE'))
        return 'Phone & Internet';
    if (upper.includes('NETFLIX') || upper.includes('SPOTIFY') || upper.includes('DISNEY') ||
        upper.includes('APPLE.COM/BILL') || upper.includes('ANTHROPIC') || upper.includes('OPENAI') ||
        upper.includes('DIGITALOCEAN') || upper.includes('NAMECHEAP') || upper.includes('NAME-CHEAP') ||
        upper.includes('YOUTUBE') || upper.includes('TWITCH') || upper.includes('STEAM') ||
        upper.includes('XBOX') || upper.includes('PLAYSTATION'))
        return 'Entertainment & Subscriptions';
    return 'Other';
}
// ── Balance calculation ───────────────────────────────────────────────────────
function computeBalance(row) {
    if (row.account_type === 'chequing') {
        return row.opening_balance + row.refunds + row.transfers_in - row.charges - row.transfers_out;
    }
    // credit card liability
    return row.opening_balance + row.charges - row.refunds - row.transfers_in;
}
// ── Bank stats query (shared shape for both DBs) ──────────────────────────────
function queryBankStats(db, txTable, banksTable) {
    return db.prepare(`
    SELECT
      b.id, b.name, b.account_type, b.opening_balance, b.credit_limit,
      COALESCE(SUM(CASE WHEN t.type = 'charge'               THEN t.amount END), 0) AS charges,
      COALESCE(SUM(CASE WHEN t.type = 'refund'               THEN t.amount END), 0) AS refunds,
      COALESCE(SUM(CASE WHEN t.transfer_direction = 'in'     THEN t.amount END), 0) AS transfers_in,
      COALESCE(SUM(CASE WHEN t.transfer_direction = 'out'    THEN t.amount END), 0) AS transfers_out,
      COUNT(CASE WHEN t.type != 'transfer' THEN t.id END)                           AS transaction_count
    FROM ${banksTable} b
    LEFT JOIN ${txTable} t ON t.bank_id = b.id
    GROUP BY b.id, b.name, b.account_type, b.opening_balance, b.credit_limit
    ORDER BY b.id ASC
  `).all();
}
// ── Database setup ────────────────────────────────────────────────────────────
function createSchema(db, txTable, banksTable) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS ${txTable} (
      id                 TEXT PRIMARY KEY,
      date               TEXT NOT NULL,
      description        TEXT NOT NULL,
      amount             REAL NOT NULL,
      type               TEXT NOT NULL CHECK(type IN ('charge','refund','transfer')),
      transfer_direction TEXT          CHECK(transfer_direction IN ('in','out')),
      account_type       TEXT NOT NULL CHECK(account_type IN ('credit','chequing')),
      bank_id            INTEGER NOT NULL,
      category           TEXT NOT NULL,
      source             TEXT NOT NULL,
      created_at         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${banksTable} (
      id              INTEGER PRIMARY KEY,
      name            TEXT NOT NULL,
      account_type    TEXT NOT NULL DEFAULT 'credit',
      opening_balance REAL DEFAULT 0,
      credit_limit    REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_${txTable}_date     ON ${txTable}(date);
    CREATE INDEX IF NOT EXISTS idx_${txTable}_bank     ON ${txTable}(bank_id);
    CREATE INDEX IF NOT EXISTS idx_${txTable}_type     ON ${txTable}(type);
    CREATE INDEX IF NOT EXISTS idx_${txTable}_category ON ${txTable}(category);
  `);
}
function migrateFromLegacy(userDataPath) {
    const oldDbPath = path_1.default.join(userDataPath, 'cashflow.db');
    if (!fs_1.default.existsSync(oldDbPath))
        return;
    const already = tdDb.prepare(`SELECT value FROM settings WHERE key = 'legacy_migrated'`).get()?.value;
    if (already === 'true')
        return;
    const oldDb = new better_sqlite3_1.default(oldDbPath, { readonly: true });
    try {
        // Copy bank settings (opening_balance, credit_limit)
        for (const row of oldDb.prepare(`SELECT id, opening_balance, credit_limit FROM banks`).all()) {
            const r = bankRoute(row.id);
            r.db.prepare(`UPDATE ${r.banksTable} SET opening_balance = ?, credit_limit = ? WHERE id = ?`)
                .run(row.opening_balance, row.credit_limit, row.id);
        }
        // Copy transactions, reclassify Credit Card Payments as transfers
        const txs = oldDb.prepare(`SELECT * FROM transactions`).all();
        const insertTd = tdDb.prepare(`
      INSERT OR IGNORE INTO td_transactions
        (id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
        const insertBmo = bmoDb.prepare(`
      INSERT OR IGNORE INTO bmo_transactions
        (id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `);
        const migrateTd = tdDb.transaction(() => {
            for (const tx of txs) {
                const r = bankRoute(tx.bank_id);
                if (r.db !== tdDb)
                    continue;
                const isPayment = tx.category === 'Credit Card Payment';
                insertTd.run(tx.id, tx.date, tx.description, tx.amount, isPayment ? 'transfer' : tx.type, isPayment ? (r.accountType === 'credit' ? 'in' : 'out') : null, r.accountType, tx.bank_id, tx.category, tx.source, tx.created_at);
            }
        });
        const migrateBmo = bmoDb.transaction(() => {
            for (const tx of txs) {
                const r = bankRoute(tx.bank_id);
                if (r.db !== bmoDb)
                    continue;
                const isPayment = tx.category === 'Credit Card Payment';
                insertBmo.run(tx.id, tx.date, tx.description, tx.amount, isPayment ? 'transfer' : tx.type, isPayment ? (r.accountType === 'credit' ? 'in' : 'out') : null, r.accountType, tx.bank_id, tx.category, tx.source, tx.created_at);
            }
        });
        migrateTd();
        migrateBmo();
        tdDb.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('legacy_migrated','true')`).run();
    }
    finally {
        oldDb.close();
    }
}
function ensureDbs() {
    const userDataPath = electron_1.app.getPath('userData');
    tdDb = new better_sqlite3_1.default(path_1.default.join(userDataPath, 'td.db'));
    bmoDb = new better_sqlite3_1.default(path_1.default.join(userDataPath, 'bmo.db'));
    createSchema(tdDb, 'td_transactions', 'td_banks');
    createSchema(bmoDb, 'bmo_transactions', 'bmo_banks');
    // Settings live in td.db
    tdDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    // Seed banks
    tdDb.prepare(`
    INSERT OR IGNORE INTO td_banks (id, name, account_type, opening_balance, credit_limit) VALUES
      (0, 'TD Credit Card', 'credit',   0, 0),
      (2, 'TD Chequing',    'chequing', 0, 0),
      (3, 'Other',          'credit',   0, 0)
  `).run();
    bmoDb.prepare(`
    INSERT OR IGNORE INTO bmo_banks (id, name, account_type, opening_balance, credit_limit) VALUES
      (1, 'BMO Credit Card', 'credit',   0, 0),
      (4, 'BMO Chequing',    'chequing', 0, 0)
  `).run();
    migrateFromLegacy(userDataPath);
}
// ── Notification ──────────────────────────────────────────────────────────────
function checkAndNotify() {
    if (!mainWindow)
        return;
    const current = monthId(new Date());
    const row = tdDb.prepare('SELECT value FROM settings WHERE key = ?').get('last_notified_month');
    if (row?.value === current)
        return;
    const { start, end } = monthBounds(current);
    const { count: tdCount } = tdDb.prepare('SELECT COUNT(*) AS count FROM td_transactions WHERE date BETWEEN ? AND ?').get(start, end);
    const { count: bmoCount } = bmoDb.prepare('SELECT COUNT(*) AS count FROM bmo_transactions WHERE date BETWEEN ? AND ?').get(start, end);
    tdDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('last_notified_month', current);
    if (tdCount + bmoCount > 0)
        return;
    if (!electron_1.Notification.isSupported())
        return;
    const [yearStr, monthStr] = current.split('-');
    const monthLabel = new Date(Number(yearStr), Number(monthStr) - 1, 1).toLocaleString('en-US', {
        month: 'long', year: 'numeric',
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
// ── Window / Tray ─────────────────────────────────────────────────────────────
function setupTray() {
    const icon = electron_1.nativeImage.createFromDataURL(APP_ICON_DATA_URL).resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(icon);
    tray.setToolTip('Cashflow Tracker');
    tray.setContextMenu(electron_1.Menu.buildFromTemplate([
        { label: 'Open', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
        { type: 'separator' },
        { label: 'Quit', click: () => electron_1.app.quit() },
    ]));
    tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
    tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}
function createWindow() {
    const isDev = !electron_1.app.isPackaged;
    mainWindow = new electron_1.BrowserWindow({
        width: 1280, height: 840, minWidth: 1200, minHeight: 800,
        backgroundColor: '#08101a',
        icon: electron_1.nativeImage.createFromDataURL(APP_ICON_DATA_URL),
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173').catch((err) => console.error('[main] loadURL failed:', err));
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html')).catch((err) => console.error('[main] loadFile failed:', err));
    }
}
// ── IPC handlers ──────────────────────────────────────────────────────────────
function registerIpcHandlers() {
    // ── Dashboard ──────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:get-dashboard', (_event, month) => {
        const { start, end } = monthBounds(month);
        // Month totals — exclude transfers from income/expense figures
        const tdTotals = tdDb.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
      FROM td_transactions
      WHERE date BETWEEN ? AND ? AND type != 'transfer'
    `).get(start, end);
        const bmoTotals = bmoDb.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'charge' THEN amount END), 0) AS charges,
        COALESCE(SUM(CASE WHEN type = 'refund' THEN amount END), 0) AS refunds
      FROM bmo_transactions
      WHERE date BETWEEN ? AND ? AND type != 'transfer'
    `).get(start, end);
        const charges = normalizeAmount(tdTotals.charges + bmoTotals.charges);
        const refunds = normalizeAmount(tdTotals.refunds + bmoTotals.refunds);
        // Bank balances — all time, transfers separated
        const allBanks = [
            ...queryBankStats(tdDb, 'td_transactions', 'td_banks'),
            ...queryBankStats(bmoDb, 'bmo_transactions', 'bmo_banks'),
        ]
            .sort((a, b) => a.id - b.id)
            .map((row) => ({ ...row, current_balance: normalizeAmount(computeBalance(row)) }));
        // 6-month series — both DBs, transfers excluded
        const seriesMonths = monthSeries(month, 6);
        const monthlySeries = seriesMonths.map((m) => {
            const b = monthBounds(m);
            const td = tdDb.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type='charge' THEN amount END),0) AS charges,
               COALESCE(SUM(CASE WHEN type='refund' THEN amount END),0) AS refunds
        FROM td_transactions WHERE date BETWEEN ? AND ? AND type != 'transfer'
      `).get(b.start, b.end);
            const bmo = bmoDb.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type='charge' THEN amount END),0) AS charges,
               COALESCE(SUM(CASE WHEN type='refund' THEN amount END),0) AS refunds
        FROM bmo_transactions WHERE date BETWEEN ? AND ? AND type != 'transfer'
      `).get(b.start, b.end);
            return { month: m, charges: normalizeAmount(td.charges + bmo.charges), refunds: normalizeAmount(td.refunds + bmo.refunds) };
        });
        return {
            month,
            monthTotals: { charges, refunds, netCashFlow: normalizeAmount(refunds - charges) },
            banks: allBanks,
            monthlySeries,
        };
    });
    // ── Recent transactions ────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:get-recent-transactions', (_event, limit) => {
        const cols = 'id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at';
        const tdRows = tdDb.prepare(`SELECT ${cols} FROM td_transactions  ORDER BY date DESC, created_at DESC LIMIT ?`).all(limit);
        const bmoRows = bmoDb.prepare(`SELECT ${cols} FROM bmo_transactions ORDER BY date DESC, created_at DESC LIMIT ?`).all(limit);
        return [...tdRows, ...bmoRows]
            .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
            .slice(0, limit);
    });
    // ── All transactions ───────────────────────────────────────────────────────
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
            const b = monthBounds(filters.month);
            where.push('date BETWEEN ? AND ?');
            params.push(b.start, b.end);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const cols = 'id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at';
        const orderSql = 'ORDER BY date DESC, created_at DESC';
        // If bankId is specified, only hit the relevant DB
        if (typeof filters.bankId === 'number') {
            const { db, table } = bankRoute(filters.bankId);
            return db.prepare(`SELECT ${cols} FROM ${table} ${whereSql} ${orderSql}`).all(...params);
        }
        const tdRows = tdDb.prepare(`SELECT ${cols} FROM td_transactions  ${whereSql} ${orderSql}`).all(...params);
        const bmoRows = bmoDb.prepare(`SELECT ${cols} FROM bmo_transactions ${whereSql} ${orderSql}`).all(...params);
        return [...tdRows, ...bmoRows]
            .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    });
    // ── Spending breakdown ─────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:get-spending-breakdown', (_event, month, bankId) => {
        const { start, end } = monthBounds(month);
        function query(db, table, bankFilter, p) {
            return db.prepare(`
        SELECT category, COUNT(*) AS transaction_count, COALESCE(SUM(amount),0) AS amount
        FROM ${table}
        WHERE date BETWEEN ? AND ? AND type = 'charge' ${bankFilter}
        GROUP BY category ORDER BY amount DESC
      `).all(...p);
        }
        let rows;
        if (bankId !== null) {
            const { db, table } = bankRoute(bankId);
            rows = query(db, table, 'AND bank_id = ?', [start, end, bankId]);
        }
        else {
            const tdRows = query(tdDb, 'td_transactions', '', [start, end]);
            const bmoRows = query(bmoDb, 'bmo_transactions', '', [start, end]);
            const merged = new Map();
            for (const r of [...tdRows, ...bmoRows]) {
                if (merged.has(r.category)) {
                    const e = merged.get(r.category);
                    e.transaction_count += r.transaction_count;
                    e.amount += r.amount;
                }
                else {
                    merged.set(r.category, { ...r });
                }
            }
            rows = [...merged.values()].sort((a, b) => b.amount - a.amount);
        }
        return rows.map((r) => ({ ...r, amount: normalizeAmount(r.amount) }));
    });
    // ── Banks ──────────────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:get-banks', () => {
        return [
            ...queryBankStats(tdDb, 'td_transactions', 'td_banks'),
            ...queryBankStats(bmoDb, 'bmo_transactions', 'bmo_banks'),
        ]
            .sort((a, b) => a.id - b.id)
            .map((row) => ({ ...row, current_balance: normalizeAmount(computeBalance(row)) }));
    });
    // ── Update bank settings ───────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:update-bank', (_event, payload) => {
        const { db, banksTable } = bankRoute(payload.id);
        db.prepare(`UPDATE ${banksTable} SET opening_balance = ?, credit_limit = ? WHERE id = ?`)
            .run(normalizeAmount(payload.openingBalance), normalizeAmount(payload.creditLimit), payload.id);
        return true;
    });
    // ── Add manual transaction ─────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:add-manual-transaction', (_event, payload) => {
        const route = bankRoute(payload.bankId);
        const amount = normalizeAmount(payload.amount);
        const detected = detectAndTagTransfer({ ...payload, amount }, route);
        route.db.prepare(`
      INSERT INTO ${route.table}
        (id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run((0, crypto_1.randomUUID)(), payload.date, payload.description, amount, detected.type, detected.transfer_direction, route.accountType, payload.bankId, payload.category, payload.source ?? 'manual', new Date().toISOString());
        return true;
    });
    // ── Delete transaction ─────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:delete-transaction', (_event, id) => {
        tdDb.prepare('DELETE FROM td_transactions  WHERE id = ?').run(id);
        bmoDb.prepare('DELETE FROM bmo_transactions WHERE id = ?').run(id);
        return true;
    });
    // ── Duplicate key check ────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:get-existing-keys', (_event, candidates) => {
        if (candidates.length === 0)
            return [];
        const tdRows = tdDb.prepare('SELECT date, description, amount, bank_id FROM td_transactions').all();
        const bmoRows = bmoDb.prepare('SELECT date, description, amount, bank_id FROM bmo_transactions').all();
        const existingSet = new Set([...tdRows, ...bmoRows].map((r) => `${r.date}|${r.description.trim().toUpperCase()}|${r.amount.toFixed(2)}|${r.bank_id}`));
        return candidates
            .filter((c) => {
            const k = `${c.date}|${c.description.trim().toUpperCase()}|${normalizeAmount(c.amount).toFixed(2)}|${c.bankId}`;
            return existingSet.has(k);
        })
            .map((c) => c.key);
    });
    // ── Import transactions ────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:import-transactions', (_event, payload) => {
        let imported = 0;
        let duplicates = 0;
        for (const row of payload) {
            const route = bankRoute(row.bankId);
            const amount = normalizeAmount(row.amount);
            const dup = route.db.prepare(`
        SELECT id FROM ${route.table}
        WHERE date = ? AND description = ? AND amount = ? AND bank_id = ? LIMIT 1
      `).get(row.date, row.description, amount, row.bankId);
            if (dup) {
                duplicates++;
                continue;
            }
            const detected = detectAndTagTransfer({ ...row, amount }, route);
            route.db.prepare(`
        INSERT INTO ${route.table}
          (id, date, description, amount, type, transfer_direction, account_type, bank_id, category, source, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run((0, crypto_1.randomUUID)(), row.date, row.description, amount, detected.type, detected.transfer_direction, route.accountType, row.bankId, row.category, row.source ?? 'import', new Date().toISOString());
            imported++;
        }
        return { imported, duplicates };
    });
    // ── Re-categorize all existing charge transactions ─────────────────────────
    electron_1.ipcMain.handle('cashflow:recategorize-all', () => {
        let updated = 0;
        for (const { db, table } of [
            { db: tdDb, table: 'td_transactions' },
            { db: bmoDb, table: 'bmo_transactions' },
        ]) {
            const rows = db.prepare(`SELECT id, description FROM ${table} WHERE type = 'charge'`).all();
            const update = db.prepare(`UPDATE ${table} SET category = ? WHERE id = ?`);
            const run = db.transaction(() => {
                for (const row of rows) {
                    const newCat = categorizeExpense(row.description);
                    update.run(newCat, row.id);
                    updated++;
                }
            });
            run();
        }
        return { updated };
    });
    // ── Clear all data ─────────────────────────────────────────────────────────
    electron_1.ipcMain.handle('cashflow:clear-all', () => {
        tdDb.prepare('DELETE FROM td_transactions').run();
        bmoDb.prepare('DELETE FROM bmo_transactions').run();
        return true;
    });
}
// ── App lifecycle ─────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    ensureDbs();
    registerIpcHandlers();
    createWindow();
    setupTray();
    checkAndNotify();
    setInterval(() => checkAndNotify(), 4 * 60 * 60 * 1000);
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
}).catch((err) => {
    console.error('[main] startup error:', err);
    electron_1.app.exit(1);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('before-quit', () => {
    isQuitting = true;
    if (tdDb)
        tdDb.close();
    if (bmoDb)
        bmoDb.close();
});
