export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 rounded-lg bg-light-blue/60" />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card animate-pulse space-y-3">
      <div className="h-4 w-24 rounded bg-light-blue/60" />
      <div className="h-8 w-32 rounded bg-light-blue/60" />
      <div className="h-3 w-20 rounded bg-light-blue/40" />
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-light-blue/60" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <LoadingSkeleton />
    </div>
  )
}

