import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
  variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading,
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1e293b]">
        <div className="flex items-start gap-3">
          {variant === 'danger' && (
            <div className="mt-0.5 rounded-full bg-red-100 p-2">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h2 id="confirm-title" className="text-base font-semibold text-body">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn-outline text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={variant === 'danger' ? 'btn-destructive text-sm' : 'btn-primary text-sm'}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook to manage confirmation state
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean
    resolve?: (ok: boolean) => void
  }>({ open: false })

  const confirm = (): Promise<boolean> =>
    new Promise((resolve) => setState({ open: true, resolve }))

  const handleConfirm = () => {
    state.resolve?.(true)
    setState({ open: false })
  }
  const handleCancel = () => {
    state.resolve?.(false)
    setState({ open: false })
  }

  return { isOpen: state.open, confirm, handleConfirm, handleCancel }
}

