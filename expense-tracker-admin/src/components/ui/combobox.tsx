import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  hint?: string
}

export function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an item…',
  searchPlaceholder = 'Search items…',
  emptyText = 'No matching items',
  disabled = false,
  ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    searchRef.current?.focus()
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          setQuery('')
          setOpen((o) => !o)
        }}
        className={cn(
          'flex h-[44px] w-full items-center justify-between rounded-[10px] border border-[var(--border-input)] bg-[var(--surface-card)] px-3.5 py-2 text-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer',
          !selected && 'text-[#475569]/70 dark:text-slate-400',
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-[#475569]" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-40 mt-1 rounded-[12px] border border-[var(--border-card)] bg-[var(--surface-card)] p-1.5 shadow-xl"
        >
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#475569]" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-9 w-full rounded-[8px] border border-[var(--border-input)] bg-[var(--surface-page)] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-[var(--text-secondary)]">{emptyText}</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-[#EFF6FF] font-medium text-[#1E3A8A] dark:bg-[#172554] dark:text-white'
                        : 'hover:bg-[#EFF6FF]/60 dark:hover:bg-[#172554]/60',
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    <span className="flex items-center gap-2">
                      {opt.hint && <span className="text-xs text-[var(--text-secondary)]">{opt.hint}</span>}
                      {isSelected && <Check className="h-4 w-4 text-[#2563EB]" />}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

