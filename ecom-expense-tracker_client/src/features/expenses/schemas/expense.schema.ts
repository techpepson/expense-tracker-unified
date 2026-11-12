import { z } from 'zod'

export const expenseSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  item_id: z.string().min(1, 'Item is required'),
  item_name_suggestion: z.string().optional(),
  unit_cost: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Max 2 decimal places'),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .positive('Quantity must be positive')
    .int('Quantity must be a whole number'),
  description: z.string().optional(),
  expense_date: z.string().min(1, 'Date is required'),
  expense_type: z.enum(['individual', 'shared_operational']),
  notes: z.string().optional(),
})

export type ExpenseFormValues = z.infer<typeof expenseSchema>

export const quickEntryRowSchema = z.object({
  item_id: z.string().min(1, 'Item is required'),
  item_name_suggestion: z.string().optional(),
  unit_cost: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be positive'),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .positive('Quantity must be positive')
    .int('Quantity must be a whole number'),
  description: z.string().optional(),
})

export const quickEntrySchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  expense_date: z.string().min(1, 'Date is required'),
  expense_type: z.enum(['individual', 'shared_operational']),
  rows: z.array(quickEntryRowSchema).min(1, 'Add at least one item'),
})

export type QuickEntryFormValues = z.infer<typeof quickEntrySchema>

