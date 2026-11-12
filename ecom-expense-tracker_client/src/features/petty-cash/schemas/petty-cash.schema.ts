import { z } from 'zod'

export const pettyCashEntrySchema = z.object({
  entry_type: z.enum(['cash_in', 'cash_out', 'charge']),
  amount: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .positive('Amount must be positive'),
  entry_date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
})

export type PettyCashEntryFormValues = z.infer<typeof pettyCashEntrySchema>

