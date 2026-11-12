import { useState } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { ExpenseForm } from './components/ExpenseForm'
import { Layers, PlusCircle } from 'lucide-react'

export function AddExpensePage() {
  const [mode, setMode] = useState<'standard' | 'quick'>('standard')

  return (
    <div>
      <PageHeader
        title="Add Expense"
        subtitle="Record a new company expense"
        actions={
          <div className="flex rounded-xl border border-[#e0ecff] bg-white p-1">
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                mode === 'standard'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-body'
              }`}
              onClick={() => setMode('standard')}
            >
              <PlusCircle size={15} />
              Standard
            </button>
            <button
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                mode === 'quick'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-body'
              }`}
              onClick={() => setMode('quick')}
            >
              <Layers size={15} />
              Quick entry
            </button>
          </div>
        }
      />
      {mode === 'quick' && (
        <div className="mb-4 rounded-xl bg-tint px-4 py-3 text-sm text-muted">
          <strong className="text-body">Quick entry mode:</strong> Add multiple items from one
          shopping trip sharing the same date and category, then save them all at once.
        </div>
      )}
      <ExpenseForm mode={mode} />
    </div>
  )
}

