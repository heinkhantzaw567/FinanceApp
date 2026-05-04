import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { addManualTransaction } from '../lib/db'
import type { BankId, TxType } from '../lib/types'
import { BANK_OPTIONS, CATEGORY_OPTIONS, currentMonth, normalizeDate } from '../lib/utils'

interface ManualEntryProps {
  onSaved: () => void
}

export default function ManualEntry({ onSaved }: ManualEntryProps) {
  const [date, setDate] = useState(`${currentMonth()}-01`)
  const [type, setType] = useState<TxType>('charge')
  const [bankId, setBankId] = useState<BankId>(0)
  const [category, setCategory] = useState<string>('Groceries')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedDate = normalizeDate(date)
    const parsedAmount = Number(amount)

    if (!normalizedDate || !description.trim() || !(parsedAmount > 0)) {
      setMessage('Please provide a valid date, description, and amount.')
      return
    }

    await addManualTransaction({
      date: normalizedDate,
      description: description.trim(),
      amount: parsedAmount,
      type,
      bankId,
      category,
      source: 'manual',
    })

    setDescription('')
    setAmount('')
    setMessage('Transaction saved.')
    onSaved()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#666666]">Add manually</p>
      <form
        onSubmit={submit}
        className="grid gap-4 rounded-xl border border-[#1f1f1f] bg-[#1a1a1a] p-5 md:grid-cols-2"
      >
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
            required
          />
        </Field>

        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TxType)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
          >
            <option value="charge">Charge</option>
            <option value="refund">Refund / Credit</option>
          </select>
        </Field>

        <Field label="Bank">
          <select
            value={bankId}
            onChange={(e) => setBankId(Number(e.target.value) as BankId)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
          >
            {BANK_OPTIONS.map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description" span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white placeholder-[#555555] focus:outline-none"
            placeholder="e.g. Metro Grocery"
            required
          />
        </Field>

        <Field label="Amount (CAD)" span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm text-white placeholder-[#555555] focus:outline-none"
            placeholder="0.00"
            required
          />
        </Field>

        <div className="flex items-center gap-4 md:col-span-2">
          <button
            type="submit"
            className="rounded-full bg-white px-6 py-2 text-sm font-medium text-[#111111] hover:bg-[#e5e5e5]"
          >
            Save Transaction
          </button>
          {message && <p className="text-sm text-[#22c55e]">{message}</p>}
        </div>
      </form>
    </div>
  )
}

function Field({ label, children, span = false }: { label: string; children: ReactNode; span?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold uppercase tracking-widest text-[#666666] ${span ? 'md:col-span-2' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}
