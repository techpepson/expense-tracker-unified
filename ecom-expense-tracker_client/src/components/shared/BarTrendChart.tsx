import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { MONTH_NAMES } from '@/lib/formatters'
import { formatGHS } from '@/lib/money'
import { useMemo } from 'react'

interface BarTrendChartProps {
  data: { month: number; total: number }[]
  currentMonth: number
  label?: string
}

export function BarTrendChart({ data, currentMonth, label }: BarTrendChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: MONTH_NAMES[d.month - 1] ?? String(d.month),
        value: d.total,
        isCurrent: d.month === currentMonth,
      })),
    [data, currentMonth]
  )

  return (
    <div className="card">
      {label && (
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted">
          {label}
        </p>
      )}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={18} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="name"
              interval={0}
              tick={{ fontSize: 11, fontWeight: 500, fill: '#334155' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              formatter={(v) => (v != null ? formatGHS(Number(v)) : '')}
              contentStyle={{ borderRadius: 10, fontSize: 13 }}
              cursor={{ fill: '#eff6ff' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.isCurrent ? '#2563eb' : '#bfdbfe'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

