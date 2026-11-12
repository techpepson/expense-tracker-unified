import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared'

export function NotFoundPage() {
  return (
    <div className="py-16">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="404 — Page not found"
        description="The administrator page you are looking for does not exist or has moved."
        action={
          <Button asChild>
            <Link to="/dashboard">Return to Dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}

