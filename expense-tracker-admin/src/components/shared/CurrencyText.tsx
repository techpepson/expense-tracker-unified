import { useCurrency } from '@/api'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

export function CurrencyText({
  amount,
  currency,
  className,
}: {
  amount: number
  currency?: string
  className?: string
}) {
  const defaultCurrency = useCurrency()
  return (
    <span className={cn('tabular-nums font-medium', className)}>
      {formatMoney(amount, currency ?? defaultCurrency)}
    </span>
  )
}

