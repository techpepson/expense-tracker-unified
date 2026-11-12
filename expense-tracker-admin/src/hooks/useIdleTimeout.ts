import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const

export interface IdleTimeoutOptions {
  /** Idle time before showing warning dialog (default: 30 minutes). */
  idleMs?: number
  /** Countdown duration in the warning dialog before auto sign-out (default: 60 seconds). */
  warningMs?: number
  enabled: boolean
  onIdleSignOut: () => void
}

export function useIdleTimeout({
  idleMs = 30 * 60 * 1000,
  warningMs = 60 * 1000,
  enabled,
  onIdleSignOut,
}: IdleTimeoutOptions) {
  const [warningOpen, setWarningOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000))
  const idleTimerRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  const warningOpenRef = useRef(false)

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (countdownRef.current !== null) {
      window.clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const scheduleIdleTimer = useCallback(() => {
    clearTimers()
    if (!enabled) return
    idleTimerRef.current = window.setTimeout(() => {
      warningOpenRef.current = true
      setWarningOpen(true)
      const totalSec = Math.max(1, Math.ceil(warningMs / 1000))
      setSecondsLeft(totalSec)
      const deadline = Date.now() + warningMs
      countdownRef.current = window.setInterval(() => {
        const rem = Math.ceil((deadline - Date.now()) / 1000)
        if (rem <= 0) {
          clearTimers()
          warningOpenRef.current = false
          setWarningOpen(false)
          onIdleSignOut()
        } else {
          setSecondsLeft(rem)
        }
      }, 1000)
    }, idleMs)
  }, [clearTimers, enabled, idleMs, onIdleSignOut, warningMs])

  const staySignedIn = useCallback(() => {
    warningOpenRef.current = false
    setWarningOpen(false)
    scheduleIdleTimer()
  }, [scheduleIdleTimer])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      return
    }
    scheduleIdleTimer()
    const onActivity = () => {
      if (!warningOpenRef.current) scheduleIdleTimer()
    }
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true })
    return () => {
      clearTimers()
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity)
    }
  }, [clearTimers, enabled, scheduleIdleTimer])

  return {
    warningOpen,
    secondsLeft,
    staySignedIn,
  }
}
