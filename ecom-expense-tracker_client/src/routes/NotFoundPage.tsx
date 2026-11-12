import { Link } from 'react-router-dom'
import { FileQuestion, Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-tint p-6 text-primary">
        <FileQuestion size={48} />
      </div>
      <h1 className="text-3xl font-bold text-navy">Page Not Found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6">
        <Link to="/dashboard" className="btn-primary">
          <Home size={16} /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

