import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ComposedChart, Line,
} from 'recharts'

export function Dashboard({ metrics, upcomingByMonth, byWaveMonth, fetchedAt, sourceUrl }: {
  metrics: { total: number; ga: number; preview: number; early: number; planned: number; upcoming: number }
  upcomingByMonth: { label: string; count: number; highImpact: number }[]
  byWaveMonth: { rows: any[]; waves: string[] }
  fetchedAt: string
  sourceUrl: string
}) {
  // Priority view: a true "timeline" for the next year (12 months)
  const year = useMemo(() => upcomingByMonth.slice(0, 12), [upcomingByMonth])

  const yearStats = useMemo(() => {
    const months = year.length || 1
    const total = year.reduce((s, x) => s + (x.count ?? 0), 0)
    const high = year.reduce((s, x) => s + (x.highImpact ?? 0), 0)
    const avg = total / months
    const peak = year.reduce((best, x) => (x.count > (best?.count ?? -1) ? x : best), null as any)
    const next3 = year.slice(0, 3).reduce((s, x) => s + (x.count ?? 0), 0)
    const next6 = year.slice(0, 6).reduce((s, x) => s + (x.count ?? 0), 0)
    const highPct = total > 0 ? Math.round((high / total) * 100) : 0
    return { total, high, avg, peak, next3, next6, highPct }
  }, [year])

  const timeline = useMemo(() => {
    let cum = 0
    return year.map(m => {
      cum += (m.count ?? 0)
      return { ...m, cumulative: cum }
    })
  }, [year])

  // Recharts colors (explicit, readable on dark backgrounds)
  const colors = {
    grid: 'rgba(148,163,184,0.22)',
    axis: 'rgba(148,163,184,0.75)',
    tooltipBg: 'rgba(2,6,23,0.92)',
    upcoming: '#38bdf8',     // cyan
    highImpact: '#f43f5e',   // rose
    cumulative: '#a78bfa',   // violet
  }

  const wavePalette = ['#22c55e', '#38bdf8', '#a78bfa', '#f59e0b', '#f43f5e', '#60a5fa']

  const WaveChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byWaveMonth.rows.slice(0, 12)}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
        <XAxis dataKey="month" interval={2} tick={{ fill: colors.axis, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.axis, fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: colors.tooltipBg, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12 }}
          labelStyle={{ color: '#e5e7eb' }}
        />
        <Legend wrapperStyle={{ color: '#cbd5e1' }} />
        {byWaveMonth.waves.slice(0, 6).map((w, i) => (
          <Bar
            key={w}
            dataKey={w}
            stackId="a"
            name={w}
            fill={wavePalette[i % wavePalette.length]}
            radius={[6, 6, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )

  const TimelineChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={timeline}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
        <XAxis dataKey="label" interval={2} tick={{ fill: colors.axis, fontSize: 12 }} />
        <YAxis tick={{ fill: colors.axis, fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: colors.tooltipBg, border: '1px solid rgba(148,163,184,0.25)', borderRadius: 12 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(value: any, name: any) => {
            if (name === 'cumulative') return [Number(value).toLocaleString(), 'Cumulative']
            if (name === 'highImpact') return [Number(value).toLocaleString(), 'High-impact (watchlist)']
            if (name === 'count') return [Number(value).toLocaleString(), 'All upcoming GA']
            return [value, name]
          }}
        />
        <Legend wrapperStyle={{ color: '#cbd5e1' }} />
        <Bar dataKey="count" name="All upcoming GA" fill={colors.upcoming} radius={[8, 8, 0, 0]} />
        <Bar dataKey="highImpact" name="High-impact (watchlist)" fill={colors.highImpact} radius={[8, 8, 0, 0]} />
        <Line
          type="monotone"
          dataKey="cumulative"
          name="Cumulative"
          stroke={colors.cumulative}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <div className="grid">
      <div className="metrics">
        <div className="metric"><div className="k">Total</div><div className="v">{metrics.total.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🟢 GA</div><div className="v">{metrics.ga.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🔵 Preview</div><div className="v">{metrics.preview.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🟣 Early Access</div><div className="v">{metrics.early.toLocaleString()}</div></div>
        <div className="metric"><div className="k">⚪ Planned</div><div className="v">{metrics.planned.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🔜 Upcoming (GA)</div><div className="v">{metrics.upcoming.toLocaleString()}</div></div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>GA timeline by month (next 12 months)</h3>
          <div style={{ height: 340 }}>
            <TimelineChart />
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12 }}>
            <div>
              Year outlook: <b style={{ color: 'var(--text)' }}>{yearStats.total.toLocaleString()}</b> upcoming GA ·{' '}
              <b style={{ color: 'var(--text)' }}>{yearStats.high.toLocaleString()}</b> high-impact ({yearStats.highPct}%)
            </div>
            <div>
              Pace: {yearStats.avg.toFixed(1)} / month · Peak: {yearStats.peak?.label ?? '—'} ({(yearStats.peak?.count ?? 0).toLocaleString()})
            </div>
            <div>
              Next 3 months: {yearStats.next3.toLocaleString()} · Next 6 months: {yearStats.next6.toLocaleString()}
            </div>
            <div>
              Data fetched: {fetchedAt}. Source:{' '}
              <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Release Wave “channel” → monthly GA volume (next 12 months)</h3>
          <div style={{ height: 340 }}>
            <WaveChart />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Stacked by <b>Release Wave</b>. If you have many waves, we show the first 6 to keep it readable.
          </div>
        </div>
      </div>

      <div className="card">
        <h3>How to read this</h3>
        <div style={{ color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
          Counts are derived from the Microsoft feed data you already load (same data as Features).
          “High-impact” reflects items marked <b>🔴 High</b> in your shared watchlist.
          Cumulative shows the running total across the year so you can see whether the delivery curve is front-loaded or back-loaded.
        </div>
      </div>
    </div>
  )
}
