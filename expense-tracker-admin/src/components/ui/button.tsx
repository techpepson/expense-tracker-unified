import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[#2563EB] text-white shadow-[0_4px_12px_rgba(37,99,235,0.28)] hover:bg-[#1D4ED8] active:bg-[#1E40AF]',
        outline:
          'border border-[#BFDBFE] bg-[var(--surface-card)] text-[#1E3A8A] dark:text-[#DBEAFE] hover:bg-[#EFF6FF] dark:hover:bg-[#172554]',
        destructive:
          'border border-[#FCA5A5] bg-[var(--surface-card)] text-[#B91C1C] hover:bg-red-50 dark:hover:bg-red-950/30',
        ghost:
          'text-[#475569] dark:text-slate-300 hover:bg-[#EFF6FF] hover:text-[#1E3A8A] dark:hover:bg-[#172554] dark:hover:text-white',
        secondary:
          'bg-[#EFF6FF] text-[#1E3A8A] hover:bg-[#DBEAFE] dark:bg-[#172554] dark:text-[#DBEAFE] dark:hover:bg-[#1E3A8A]',
      },
      size: {
        default: 'h-[44px] px-4 py-2',
        sm: 'h-9 px-3 text-xs rounded-[8px]',
        icon: 'h-[44px] w-[44px]',
        iconSm: 'h-9 w-9 rounded-[8px]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

