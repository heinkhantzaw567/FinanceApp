import { useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { getExistingKeys, importTransactions } from '../lib/db'
import { detectCsvBank, parseBmoCsv, parseTdChequingCsv, parseTdCsv } from '../lib/parsers'
import type { BankId, ParsedImportRow, TransactionInput } from '../lib/types'
import { formatCurrency, prepareDuplicateCandidates, txTypeLabel } from '../lib/utils'

interface ImportCSVProps {
  onImported: () => void
}

export default function ImportCSV({ onImported }: ImportCSVProps) {
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [error, setError] = useState<string>('')

  const duplicateCount = useMemo(
    () => rows.filter((row) => row.status === 'duplicate').length,
    [rows]
  )

  async function processFile(file: File, forcedBankId?: BankId) {
    setLoading(true)
    setError('')
    setSummary('')

    try {
      const text = await file.text()
      const detected = detectCsvBank(text) ?? forcedBankId ?? null
      if (detected === null) {
        setError('Could not detect CSV format. Use a TD, BMO, or TD Chequing CSV export.')
        setRows([])
        return
      }

      const parsed =
        detected === 0 ? parseTdCsv(text)
        : detected === 2 ? parseTdChequingCsv(text)
        : parseBmoCsv(text)
      if (parsed.length === 0) {
        setError('No valid rows were found in this file.')
        setRows([])
        return
      }

      const existingKeys = new Set(await getExistingKeys(prepareDuplicateCandidates(parsed)))
      const withStatus = parsed.map((row) => ({
        ...row,
        status: existingKeys.has(row.key) ? 'duplicate' : 'new',
      }))

      setRows(withStatus)
      setSummary(`${withStatus.length} rows parsed.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>, bankId: BankId) {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file, bankId)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>, bankId: BankId) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) {
      processFile(file, bankId)
    }
  }

  async function confirmImport() {
    const toImport: TransactionInput[] = rows
      .filter((row) => row.status === 'new')
      .map((row) => ({
        date: row.date,
        description: row.description,
        amount: row.amount,
        type: row.type,
        bankId: row.bankId,
        category: row.category,
        source: 'import',
      }))

    if (toImport.length === 0) {
      setSummary('No new rows to import.')
      return
    }

    setLoading(true)
    const result = await importTransactions(toImport)
    setLoading(false)

    setSummary(`${result.imported} imported, ${result.duplicates + duplicateCount} duplicates skipped`)
    setRows([])
    onImported()
  }

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Import CSV</p>

      <div className="grid gap-4 md:grid-cols-3">
        <DropZone
          label="TD Credit Card"
          subtext="Date, Description, Debit, Credit"
          onDrop={(event) => onDrop(event, 0)}
          onFileChange={(event) => handleInputChange(event, 0)}
        />
        <DropZone
          label="BMO Credit Card"
          subtext="Item#, Date, Description, Amount"
          onDrop={(event) => onDrop(event, 1)}
          onFileChange={(event) => handleInputChange(event, 1)}
        />
        <DropZone
          label="TD Chequing"
          subtext="Date, Description, Debit, Credit, Balance"
          onDrop={(event) => onDrop(event, 2)}
          onFileChange={(event) => handleInputChange(event, 2)}
        />
      </div>

      {loading && (
        <p className="rounded-lg border border-[#1f1f1f] bg-[#1a1a1a] p-3 text-sm text-[#888888]">
          Parsing CSV...
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 text-sm text-[#ef4444]">
          {error}
        </p>
      )}
      {summary && (
        <p className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-sm text-[#22c55e]">
          {summary}
        </p>
      )}

      {rows.length > 0 && (
        <section className="space-y-4 rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">
              Preview — {rows.length} rows
            </p>
            <button
              type="button"
              onClick={confirmImport}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#111111] hover:bg-[#e5e5e5]"
            >
              Confirm Import
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[#1f1f1f] text-left">
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">Date</th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">Description</th>
                  <th className="py-2 pr-3 text-xs font-semibold uppercase tracking-widest text-[#666666]">Type</th>
                  <th className="py-2 pr-3 text-right text-xs font-semibold uppercase tracking-widest text-[#666666]">Amount</th>
                  <th className="py-2 text-xs font-semibold uppercase tracking-widest text-[#666666]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f]">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="py-3 pr-3 text-[#888888]">{row.date}</td>
                    <td className="py-3 pr-3 text-white">{row.description}</td>
                    <td className={`py-3 pr-3 font-medium ${row.type === 'charge' ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                      {txTypeLabel(row.type)}
                    </td>
                    <td className="py-3 pr-3 text-right text-white">{formatCurrency(row.amount)}</td>
                    <td className={`py-3 font-medium ${row.status === 'duplicate' ? 'text-[#f59e0b]' : 'text-[#22c55e]'}`}>
                      {row.status === 'duplicate' ? 'Duplicate' : 'New'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function DropZone({
  label,
  subtext,
  onDrop,
  onFileChange,
}: {
  label: string
  subtext: string
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div
      className="rounded-xl border border-dashed border-[#333333] bg-[#1a1a1a] p-6 transition-colors hover:border-[#555555]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-[#666666]">{subtext}</p>
      <label className="mt-5 inline-flex cursor-pointer rounded-full border border-[#333333] px-4 py-2 text-sm font-medium text-[#cccccc] hover:border-[#555555] hover:text-white">
        Choose file
        <input type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
      </label>
      <p className="mt-2 text-xs text-[#444444]">or drag and drop</p>
    </div>
  )
}
