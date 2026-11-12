import { useEffect } from 'react'
import { X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useSidebarStore } from '@/stores/sidebarStore'

export function MobileDrawer() {
  const { isOpen, close } = useSidebarStore()

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        className="fixed inset-y-0 left-0 z-50 w-60 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <button
          className="absolute right-3 top-3 rounded-full p-1 text-white/70 hover:text-white"
          onClick={close}
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
        <Sidebar onClose={close} />
      </div>
    </>
  )
}

