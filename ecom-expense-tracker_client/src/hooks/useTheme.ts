import { useThemeStore } from '@/stores/themeStore'
import { useEffect } from 'react'

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return { theme, setTheme, toggleTheme }
}

