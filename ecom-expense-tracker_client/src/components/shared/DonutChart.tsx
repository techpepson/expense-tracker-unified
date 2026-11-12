import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { CHART_COLORS } from '@/lib/constants'
import { formatGHS } from '@/lib/money'
import { useMemo } from 'react'

interface DonutChartProps {
  data: { name: string; value: number }[]
  label?: string
}

export function DonutChart({ data, label }: DonutChartProps) {
  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data])

  return (
    <div className="card">
      {label && (
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="h-52 w-full lg:w-56 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                dataKey="value"
                stroke="none"
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => (v != null ? formatGHS(Number(v)) : '')}
                contentStyle={{ borderRadius: 10, fontSize: 13 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend bars */}
        <div className="flex-1 space-y-2.5">
          {data.map((entry, i) => {
            const pct = total > 0 ? (entry.value / total) * 100 : 0
            return (
              <div key={entry.name}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-body">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {entry.name}
                  </span>
                  <span className="text-muted">
                    {pct.toFixed(1)}% · {formatGHS(entry.value)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-light-blue">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

