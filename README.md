# Cashflow Tracker (Desktop + Local SQLite)

Personal cash flow tracker for a Canadian student using TD and BMO credit cards.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Electron
- better-sqlite3 (local SQLite)
- Papa Parse (CSV parsing)
- Recharts

## Run

1. Install dependencies:

```bash
npm install
```

2. Browser dev mode:

```bash
npm run dev
```

3. Desktop app mode (Vite + Electron):

```bash
npm run electron
```

4. Production build:

```bash
npm run build
```

5. Package desktop distributable:

```bash
npm run dist
```

## Local Data Storage

SQLite database location:

app.getPath('userData')/cashflow.db

This means all user data is stored locally on the machine and persists across app restarts and updates.

## Notes

- No external APIs, no cloud, no authentication.
- All data comes from CSV imports or manual entry.
