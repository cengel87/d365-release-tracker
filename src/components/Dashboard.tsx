import React, { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ComposedChart, Line,
} from 'recharts'

export function Dashboard({ metrics, upcomingByMonth, upcomingPreviewByMonth, upcomingEarlyAccessByMonth, byWaveMonth, fetchedAt, sourceUrl }: {
  metrics: { total: number; ga: number; preview: number; early: number; planned: number; upcoming: number }
  upcomingByMonth: { label: string; count: number; highImpact: number }[]
  upcomingPreviewByMonth: { label: string; count: number; highImpact: number }[]
  upcomingEarlyAccessByMonth: { label: string; count: number; highImpact: number }[]
  byWaveMonth: { rows: any[]; waves: string[] }
  fetchedAt: string
  sourceUrl: string
}) {
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

  // Public Preview pipeline stats
  const previewYear = useMemo(() => upcomingPreviewByMonth.slice(0, 12), [upcomingPreviewByMonth])
  const previewStats = useMemo(() => {
    const months = previewYear.length || 1
    const total = previewYear.reduce((s, x) => s + (x.count ?? 0), 0)
    const high = previewYear.reduce((s, x) => s + (x.highImpact ?? 0), 0)
    const avg = total / months
    const peak = previewYear.reduce((best, x) => (x.count > (best?.count ?? -1) ? x : best), null as any)
    const next3 = previewYear.slice(0, 3).reduce((s, x) => s + (x.count ?? 0), 0)
    return { total, high, avg, peak, next3 }
  }, [previewYear])

  // Early Access pipeline stats
  const earlyYear = useMemo(() => upcomingEarlyAccessByMonth.slice(0, 12), [upcomingEarlyAccessByMonth])
  const earlyStats = useMemo(() => {
    const months = earlyYear.length || 1
    const total = earlyYear.reduce((s, x) => s + (x.count ?? 0), 0)
    const high = earlyYear.reduce((s, x) => s + (x.highImpact ?? 0), 0)
    const avg = total / months
    const peak = earlyYear.reduce((best, x) => (x.count > (best?.count ?? -1) ? x : best), null as any)
    const next3 = earlyYear.slice(0, 3).reduce((s, x) => s + (x.count ?? 0), 0)
    return { total, high, avg, peak, next3 }
  }, [earlyYear])

  const colors = {
    grid: 'rgba(148,163,184,0.08)',
    axis: 'rgba(148,163,184,0.50)',
    tooltipBg: 'rgba(6,9,15,0.95)',
    tooltipBorder: 'rgba(148,163,184,0.15)',
    upcoming: '#38bdf8',
    highImpact: '#fb7185',
    cumulative: '#a78bfa',
    preview: '#60a5fa',
    earlyAccess: '#c084fc',
  }

  const wavePalette = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#60a5fa']

  const tooltipStyle = {
    background: colors.tooltipBg,
    border: `1px solid ${colors.tooltipBorder}`,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    padding: '10px 14px',
  }

  const axisProps = { fill: colors.axis, fontSize: 11 }
  const legendStyle = { color: '#94a3b8', fontSize: 12, paddingTop: 8 }
  const labelStyle = { color: '#f1f5f9', fontWeight: 600, marginBottom: 4 }
  const itemStyle = { color: '#cbd5e1', fontSize: 12 }
  const cursorStyle = { fill: 'rgba(56,189,248,0.04)' }

  const WaveChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={byWaveMonth.rows.slice(0, 12)}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="month" interval={2} tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
        <YAxis tick={axisProps} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle} />
        <Legend wrapperStyle={legendStyle} />
        {byWaveMonth.waves.slice(0, 6).map((w, i) => (
          <Bar
            key={w}
            dataKey={w}
            stackId="a"
            name={w}
            fill={wavePalette[i % wavePalette.length]}
            radius={i === byWaveMonth.waves.slice(0, 6).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )

  const TimelineChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={timeline}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="label" interval={2} tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
        <YAxis tick={axisProps} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle}
          formatter={(value: any, name: any) => {
            if (name === 'cumulative') return [Number(value).toLocaleString(), 'Cumulative']
            if (name === 'highImpact') return [Number(value).toLocaleString(), 'High-impact (watchlist)']
            if (name === 'count') return [Number(value).toLocaleString(), 'All upcoming GA']
            return [value, name]
          }}
        />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="count" name="All upcoming GA" fill={colors.upcoming} radius={[4, 4, 0, 0]} />
        <Bar dataKey="highImpact" name="High-impact (watchlist)" fill={colors.highImpact} radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="cumulative" name="Cumulative" stroke={colors.cumulative} strokeWidth={2} dot={false} strokeLinecap="round" />
      </ComposedChart>
    </ResponsiveContainer>
  )

  const PreviewTimelineChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={previewYear}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="label" interval={2} tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
        <YAxis tick={axisProps} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle}
          formatter={(value: any, name: any) => {
            if (name === 'highImpact') return [Number(value).toLocaleString(), 'High-impact (watchlist)']
            if (name === 'count') return [Number(value).toLocaleString(), 'Entering Public Preview']
            return [value, name]
          }}
        />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="count" name="Entering Public Preview" fill={colors.preview} radius={[4, 4, 0, 0]} />
        <Bar dataKey="highImpact" name="High-impact (watchlist)" fill={colors.highImpact} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  const EarlyAccessTimelineChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={earlyYear}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis dataKey="label" interval={2} tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
        <YAxis tick={axisProps} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle}
          formatter={(value: any, name: any) => {
            if (name === 'highImpact') return [Number(value).toLocaleString(), 'High-impact (watchlist)']
            if (name === 'count') return [Number(value).toLocaleString(), 'Entering Early Access']
            return [value, name]
          }}
        />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="count" name="Entering Early Access" fill={colors.earlyAccess} radius={[4, 4, 0, 0]} />
        <Bar dataKey="highImpact" name="High-impact (watchlist)" fill={colors.highImpact} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  return (
    <div className="grid">
      <div className="metrics">
        <div className="metric"><div className="k">Total</div><div className="v">{metrics.total.toLocaleString()}</div></div>
        <div className="metric"><div className="k">GA</div><div className="v" style={{ color: '#34d399' }}>{metrics.ga.toLocaleString()}</div></div>
        <div className="metric"><div className="k">Preview</div><div className="v" style={{ color: '#38bdf8' }}>{metrics.preview.toLocaleString()}</div></div>
        <div className="metric"><div className="k">Early Access</div><div className="v" style={{ color: '#a78bfa' }}>{metrics.early.toLocaleString()}</div></div>
        <div className="metric"><div className="k">Planned</div><div className="v" style={{ color: '#94a3b8' }}>{metrics.planned.toLocaleString()}</div></div>
        <div className="metric"><div className="k">Upcoming GA</div><div className="v" style={{ color: '#fbbf24' }}>{metrics.upcoming.toLocaleString()}</div></div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>GA Timeline (next 12 months)</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Features scheduled to become Generally Available. Cyan bars show monthly count,
            rose bars highlight high-impact watchlist items. The violet line tracks cumulative delivery.
          </p>
          <div style={{ height: 340 }}>
            <TimelineChart />
          </div>
          <div style={{ marginTop: 12, display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Year outlook: <b style={{ color: 'var(--text)' }}>{yearStats.total.toLocaleString()}</b> upcoming GA{' · '}
              <b style={{ color: 'var(--text)' }}>{yearStats.high.toLocaleString()}</b> high-impact ({yearStats.highPct}%)
            </div>
            <div>
              Pace: {yearStats.avg.toFixed(1)} / month{' · '}Peak: {yearStats.peak?.label ?? '—'} ({(yearStats.peak?.count ?? 0).toLocaleString()})
            </div>
            <div>
              Next 3 months: {yearStats.next3.toLocaleString()}{' · '}Next 6 months: {yearStats.next6.toLocaleString()}
            </div>
            <div style={{ opacity: 0.7 }}>
              Data fetched: {fetchedAt}. Source:{' '}
              <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>GA Volume by Release Wave (next 12 months)</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Same GA features stacked by Release Wave to show which wave is driving the most changes.
          </p>
          <div style={{ height: 340 }}>
            <WaveChart />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, opacity: 0.8 }}>
            Showing up to 6 release waves. Waves are color-coded and stacked within each month.
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>Public Preview Pipeline (next 12 months)</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Features with a scheduled Public Preview date. Track this to plan evaluation and testing windows before GA.
          </p>
          <div style={{ height: 340 }}>
            <PreviewTimelineChart />
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Upcoming previews: <b style={{ color: 'var(--text)' }}>{previewStats.total.toLocaleString()}</b>{' · '}
              <b style={{ color: 'var(--text)' }}>{previewStats.high.toLocaleString()}</b> high-impact
            </div>
            <div>
              Pace: {previewStats.avg.toFixed(1)} / month{' · '}Peak: {previewStats.peak?.label ?? '—'} ({(previewStats.peak?.count ?? 0).toLocaleString()})
            </div>
            <div>
              Next 3 months: {previewStats.next3.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Early Access Pipeline (next 12 months)</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Features with a scheduled Early Access date. Monitor this to prepare for opt-in adoption ahead of GA.
          </p>
          <div style={{ height: 340 }}>
            <EarlyAccessTimelineChart />
          </div>
          <div style={{ marginTop: 10, display: 'grid', gap: 6, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Upcoming early access: <b style={{ color: 'var(--text)' }}>{earlyStats.total.toLocaleString()}</b>{' · '}
              <b style={{ color: 'var(--text)' }}>{earlyStats.high.toLocaleString()}</b> high-impact
            </div>
            <div>
              Pace: {earlyStats.avg.toFixed(1)} / month{' · '}Peak: {earlyStats.peak?.label ?? '—'} ({(earlyStats.peak?.count ?? 0).toLocaleString()})
            </div>
            <div>
              Next 3 months: {earlyStats.next3.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>How to read this dashboard</h3>
        <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
          All counts are derived from the Microsoft Release Plans feed (same data as the Features tab).
          "High-impact" reflects items marked High in your shared watchlist.
          The top row focuses on GA milestones — the cumulative line shows whether the delivery curve is front-loaded or back-loaded.
          The bottom row tracks the Public Preview and Early Access pipelines using their respective scheduled dates.
          A feature may appear in multiple charts if it has dates set for multiple stages.
        </div>
      </div>
    </div>
  )
}
