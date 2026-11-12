import { useCallback, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { toast } from 'sonner'
import { setUnauthorizedHandler, useLogout, useMe } from '@/api'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { useAuthStore } from '@/stores/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const token = useAuthStore((s) => s.token)
  const navigate = useNavigate()
  const logout = useLogout()
  useMe(!!token)

  useEffect(() => {
    setUnauthorizedHandler(() => {
      toast.error('Your session has expired. Please sign in again.')
      navigate('/login', { replace: true })
    })
    return () => setUnauthorizedHandler(null)
  }, [navigate])

  const handleIdleSignOut = useCallback(async () => {
    await logout()
    toast.info('Signed out due to 30 minutes of inactivity.')
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const { warningOpen, secondsLeft, staySignedIn } = useIdleTimeout({
    enabled: !!token,
    onIdleSignOut: handleIdleSignOut,
  })

  return (
    <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <Dialog open={warningOpen} onOpenChange={(open) => !open && staySignedIn()}>
        <DialogContent hideClose>
          <DialogHeader>
            <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#DBEAFE] text-[#2563EB]">
              <Clock className="h-5 w-5" />
            </div>
            <DialogTitle>Still working?</DialogTitle>
            <DialogDescription>
              You have been inactive for 30 minutes. For security, you will be signed out in{' '}
              <strong className="text-[#1E3A8A] dark:text-white">{secondsLeft}s</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleIdleSignOut}>
              Sign out now
            </Button>
            <Button onClick={staySignedIn}>Stay signed in</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

