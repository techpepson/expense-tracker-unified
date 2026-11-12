import { formatGHS } from '@/lib/money'
import { cn } from '@/lib/utils'

interface CurrencyTextProps {
  amount: number
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function CurrencyText({ amount, className, size = 'md' }: CurrencyTextProps) {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
    xl: 'text-3xl font-bold',
  }[size]

  return (
    <span className={cn(sizeClass, className)}>{formatGHS(amount)}</span>
  )
}

