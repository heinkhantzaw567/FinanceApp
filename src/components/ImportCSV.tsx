import { useMemo, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { getExistingKeys, importTransactions } from '../lib/db'
import { autoDetectColMapping, detectCsvBank, parseBmoChequingCsv, parseBmoCsv, parseGenericCsv, parseTdChequingCsv, parseTdCsv, sniffCsvHeaders } from '../lib/parsers'
import type { BankId, ColMapping, ParsedImportRow, TransactionInput } from '../lib/types'
import { formatCurrency, prepareDuplicateCandidates, txTypeLabel } from '../lib/utils'

interface ImportCSVProps {
  onImported: () => void
}

interface GenericSetup {
  file: File
  headers: string[]
  preview: string[][]
  mapping: ColMapping
}

export default function ImportCSV({ onImported }: ImportCSVProps) {
  const [rows, setRows] = useState<ParsedImportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [genericSetup, setGenericSetup] = useState<GenericSetup | null>(null)

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
      // forcedBankId from the drop zone takes priority over auto-detection.
      // Auto-detection is only a fallback (e.g. future drag-anywhere support).
      const detected = forcedBankId ?? detectCsvBank(text) ?? null
      if (detected === null) {
        setError('Could not detect CSV format. Use a TD, BMO, or TD Chequing CSV export.')
        setRows([])
        return
      }

      const parsed =
        detected === 0 ? parseTdCsv(text)
        : detected === 2 ? parseTdChequingCsv(text)
        : detected === 4 ? parseBmoChequingCsv(text)
        : parseBmoCsv(text)
      if (parsed.length === 0) {
        setError('No valid rows were found in this file.')
        setRows([])
        return
      }

      const existingKeys = new Set(await getExistingKeys(prepareDuplicateCandidates(parsed)))
      const withStatus = parsed.map((row) => ({
        ...row,
        status: (existingKeys.has(row.key) ? 'duplicate' : 'new') as 'new' | 'duplicate',
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

  async function processGenericFile(file: File) {
    setError('')
    setSummary('')
    setRows([])
    try {
      const text = await file.text()
      const { headers, preview } = sniffCsvHeaders(text)
      if (headers.length === 0) {
        setError('Could not read CSV file.')
        return
      }
      const mapping = autoDetectColMapping(headers)
      setGenericSetup({ file, headers, preview, mapping })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file.')
    }
  }

  async function parseWithMapping() {
    if (!genericSetup) return
    setLoading(true)
    setError('')
    setSummary('')
    try {
      const text = await genericSetup.file.text()
      const parsed = parseGenericCsv(text, genericSetup.mapping, 3)
      if (parsed.length === 0) {
        setError('No valid rows found. Check your column mapping.')
        setLoading(false)
        return
      }
      const existingKeys = new Set(await getExistingKeys(prepareDuplicateCandidates(parsed)))
      const withStatus = parsed.map((row) => ({
        ...row,
        status: (existingKeys.has(row.key) ? 'duplicate' : 'new') as 'new' | 'duplicate',
      })) as ParsedImportRow[]
      setRows(withStatus)
      setSummary(`${withStatus.length} rows parsed.`)
      setGenericSetup(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file.')
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
    try {
      const result = await importTransactions(toImport)
      setSummary(`${result.imported} imported, ${result.duplicates + duplicateCount} duplicates skipped`)
      setRows([])
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Import CSV</p>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
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
        <DropZone
          label="BMO Chequing"
          subtext="Card#, Type, Date Posted, Amount, Description"
          onDrop={(event) => onDrop(event, 4)}
          onFileChange={(event) => handleInputChange(event, 4)}
        />
        <DropZone
          label="Other Bank"
          subtext="Any CSV — map columns below"
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) processGenericFile(f) }}
          onFileChange={(e) => { const f = e.target.files?.[0]; if (f) processGenericFile(f) }}
        />
      </div>

      {genericSetup && (
        <GenericMapper
          setup={genericSetup}
          onChange={setGenericSetup}
          onParse={parseWithMapping}
          loading={loading}
        />
      )}

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

function ColSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string
  headers: string[]
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-[#666666]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white"
      >
        <option value={-1}>— none —</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>{i}: {h || `(col ${i})`}</option>
        ))}
      </select>
    </div>
  )
}

function GenericMapper({
  setup,
  onChange,
  onParse,
  loading,
}: {
  setup: GenericSetup
  onChange: (s: GenericSetup) => void
  onParse: () => void
  loading: boolean
}) {
  const { headers, preview, mapping } = setup

  function update(patch: Partial<ColMapping>) {
    onChange({ ...setup, mapping: { ...mapping, ...patch } })
  }

  return (
    <section className="space-y-4 rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">
        Map columns — {setup.file.name}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ColSelect label="Date" headers={headers} value={mapping.dateCol} onChange={(v) => update({ dateCol: v })} />
        <ColSelect label="Description" headers={headers} value={mapping.descCol} onChange={(v) => update({ descCol: v })} />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Amount type</label>
          <div className="flex gap-3 pt-1">
            {(['single', 'split'] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-center gap-2 text-sm text-[#cccccc]">
                <input
                  type="radio"
                  checked={mapping.amountMode === mode}
                  onChange={() => update({ amountMode: mode })}
                  className="accent-white"
                />
                {mode === 'single' ? 'Single' : 'Debit / Credit'}
              </label>
            ))}
          </div>
        </div>

        {mapping.amountMode === 'single' ? (
          <ColSelect label="Amount" headers={headers} value={mapping.amountCol} onChange={(v) => update({ amountCol: v })} />
        ) : (
          <>
            <ColSelect label="Debit (money out)" headers={headers} value={mapping.debitCol} onChange={(v) => update({ debitCol: v })} />
            <ColSelect label="Credit (money in)" headers={headers} value={mapping.creditCol} onChange={(v) => update({ creditCol: v })} />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#cccccc]">
          <input
            type="checkbox"
            checked={mapping.hasHeader}
            onChange={(e) => update({ hasHeader: e.target.checked })}
            className="accent-white"
          />
          First row is a header
        </label>
      </div>

      {preview.length > 0 && (
        <div className="overflow-auto rounded-lg border border-[#1f1f1f]">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold text-[#666666]">{h || `col ${i}`}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {preview.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-[#888888]">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={onParse}
        disabled={loading}
        className="rounded-full bg-white px-5 py-2 text-sm font-medium text-[#111111] hover:bg-[#e5e5e5] disabled:opacity-50"
      >
        {loading ? 'Parsing…' : 'Parse CSV'}
      </button>
    </section>
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
