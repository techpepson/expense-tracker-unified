import { useParams, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/shared/PageHeader'
import { ExpenseForm } from './components/ExpenseForm'
import { useExpense } from '@/api/expenses'
import { PageSkeleton } from '@/components/shared/LoadingSkeleton'
import { useAuth } from '@/hooks/useAuth'
import { useEffect } from 'react'
import { toast } from 'sonner'

export function EditExpensePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: expense, isLoading } = useExpense(id ?? '')

  useEffect(() => {
    if (expense && user && expense.created_by !== user.id && user.role !== 'admin') {
      toast.error('You can only edit expenses you created')
      navigate(`/expenses/${expense.id}`)
    }
  }, [expense, user, navigate])

  if (isLoading || !expense) {
    return <PageSkeleton />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${expense.item_name}`}
        subtitle={`Update details for expense #${expense.id.slice(0, 8)}`}
      />
      <ExpenseForm expense={expense} mode="standard" />
    </div>
  )
}

