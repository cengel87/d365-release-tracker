import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import type { EnrichedFeature, WatchlistItem, ChangeLogItem } from '../types'
import { api } from '../api'
import { monthKey, monthLabel, fmtDate } from '../logic'
import { labelChangeType } from '../utils/changes'
import { Pill } from './Pill'

type Props = {
  all: EnrichedFeature[]
  watchItems: WatchlistItem[]
  fetchedAt: string
  sourceUrl: string
  onOpenDetail: (id: string) => void
}

const IMPACT_COLORS: Record<string, string> = {
  '🔴 Mitigation Required': '#fb7185',
  '🟡 Minor Impact': '#fbbf24',
  '🟢 No Impact': '#34d399',
  '🚩 To Review': '#94a3b8',
}

const IMPACT_ORDER = ['🔴 Mitigation Required', '🟡 Minor Impact', '🟢 No Impact', '🚩 To Review'] as const

const ANALYSIS_COLORS: Record<string, string> = {
  'Reviewed': '#34d399',
  'In Progress': '#fbbf24',
  'Not Applicable': '#64748b',
}

const FLAGGED_COLORS: Record<string, string> = {
  'Business': '#38bdf8',
  'Tech Team': '#a78bfa',
  'Both': '#fb7185',
  'BTA Only': '#fbbf24',
  '': '#64748b',
}

export function Dashboard({ all, watchItems, fetchedAt, sourceUrl, onOpenDetail }: Props) {
  // Join watchlist with enriched features
  const featureMap = useMemo(() => {
    const m = new Map<string, EnrichedFeature>()
    for (const f of all) m.set(f['Release Plan ID'], f)
    return m
  }, [all])

  // Only include features that haven't yet reached GA (upcoming only)
  const joined = useMemo(() =>
    watchItems
      .map(w => ({ w, f: featureMap.get(w.release_plan_id) }))
      .filter((x): x is { w: WatchlistItem; f: EnrichedFeature } => !!x.f && x.f.status !== 'Generally Available'),
    [watchItems, featureMap]
  )

  const watchIdSet = useMemo(() => new Set(watchItems.map(w => w.release_plan_id)), [watchItems])

  // Fetch recent changes
  const changesQ = useQuery({
    queryKey: ['changes', 30],
    queryFn: () => api.listChanges(30),
  })

  // ── KPI metrics ──
  const kpis = useMemo(() => {
    const total = joined.length
    const byImpact = { high: 0, medium: 0, low: 0, toReview: 0 }
    const byAnalysis = { reviewed: 0, inProgress: 0, notApplicable: 0 }
    let ga30 = 0, ga60 = 0, ga90 = 0

    for (const { w, f } of joined) {
      if (w.impact === '🔴 Mitigation Required') byImpact.high++
      else if (w.impact === '🟡 Minor Impact') byImpact.medium++
      else if (w.impact === '🟢 No Impact') byImpact.low++
      else byImpact.toReview++

      if (w.analysis_status === 'Reviewed') byAnalysis.reviewed++
      else if (w.analysis_status === 'In Progress') byAnalysis.inProgress++
      else byAnalysis.notApplicable++

      if (f.daysToGA !== null && f.daysToGA > 0) {
        if (f.daysToGA <= 30) ga30++
        if (f.daysToGA <= 60) ga60++
        if (f.daysToGA <= 90) ga90++
      }
    }
    return { total, byImpact, byAnalysis, ga30, ga60, ga90 }
  }, [joined])

  // ── Chart 1: Watchlist GA Timeline by impact ──
  const gaTimeline = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const future = joined.filter(({ f }) => f.gaDate && f.gaDate > today)
    const map = new Map<string, { month: string; label: string; high: number; medium: number; low: number; toReview: number }>()
    for (const { w, f } of future) {
      const k = monthKey(f.gaDate!)
      const label = monthLabel(f.gaDate!)
      const prev = map.get(k) ?? { month: k, label, high: 0, medium: 0, low: 0, toReview: 0 }
      if (w.impact === '🔴 Mitigation Required') prev.high++
      else if (w.impact === '🟡 Minor Impact') prev.medium++
      else if (w.impact === '🟢 No Impact') prev.low++
      else prev.toReview++
      map.set(k, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 12)
  }, [joined])

  // Analysis donut (overall)
  const analysisPie = useMemo(() => [
    { name: 'Reviewed', value: kpis.byAnalysis.reviewed, color: ANALYSIS_COLORS['Reviewed'] },
    { name: 'In Progress', value: kpis.byAnalysis.inProgress, color: ANALYSIS_COLORS['In Progress'] },
    { name: 'Not Applicable', value: kpis.byAnalysis.notApplicable, color: ANALYSIS_COLORS['Not Applicable'] },
  ].filter(d => d.value > 0), [kpis])

  // ── Chart 3: Flagged-for breakdown ──
  const flaggedData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { w } of joined) {
      const key = w.flagged_for || 'Unflagged'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count,
      color: FLAGGED_COLORS[label === 'Unflagged' ? '' : label] ?? '#64748b',
    }))
  }, [joined])

  // ── Chart 4: Upcoming deadlines (next milestone per feature only) ──
  const deadlines = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const milestones: { id: string; name: string; product: string; type: string; date: Date; impact: string }[] = []
    for (const { w, f } of joined) {
      if (w.analysis_status === 'Not Applicable') continue
      // Find the nearest future milestone for this feature
      const candidates: { type: string; date: Date }[] = []
      if (f.earlyAccessDate && f.earlyAccessDate > today) candidates.push({ type: 'Early Access', date: f.earlyAccessDate })
      if (f.previewDate && f.previewDate > today) candidates.push({ type: 'Preview', date: f.previewDate })
      if (f.gaDate && f.gaDate > today) candidates.push({ type: 'GA', date: f.gaDate })
      if (candidates.length === 0) continue
      const next = candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0]
      milestones.push({ id: w.release_plan_id, name: f['Feature name'], product: f['Product name'], type: next.type, date: next.date, impact: w.impact })
    }
    return milestones.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 10)
  }, [joined])

  // ── Recent watchlist changes ──
  const recentChanges = useMemo(() => {
    if (!changesQ.data) return []
    return changesQ.data
      .filter(c => watchIdSet.has(c.release_plan_id))
      .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
      .slice(0, 12)
  }, [changesQ.data, watchIdSet])

  // ── Shared chart styling ──
  const colors = {
    grid: 'rgba(148,163,184,0.08)',
    axis: 'rgba(148,163,184,0.50)',
    tooltipBg: 'rgba(10,10,10,0.95)',
    tooltipBorder: 'rgba(148,163,184,0.15)',
  }
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

  // ── Empty state ──
  if (joined.length === 0) {
    return (
      <div className="grid">
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <h3 style={{ textTransform: 'none', fontSize: 18, color: 'var(--text)', marginBottom: 8 }}>No watchlist items yet</h3>
          <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
            Add features to your watchlist from the <b style={{ color: 'var(--text)' }}>Features</b> tab to see your team's dashboard here.
            The dashboard tracks impact, analysis progress, upcoming deadlines, and recent changes for your watchlisted items.
          </p>
        </div>
      </div>
    )
  }

  const completedCount = kpis.byAnalysis.reviewed + kpis.byAnalysis.notApplicable
  const completedPct = kpis.total > 0 ? Math.round((completedCount / kpis.total) * 100) : 0

  return (
    <div className="grid">
      {/* ── Overview ── */}
      <div className="card dash-overview">
        <div className="dash-overview-header">
          <div>
            <h3 style={{ margin: 0 }}>Watchlist Overview</h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Upcoming features only — excludes already GA</span>
          </div>
          <Pill kind="info">{kpis.total} tracked</Pill>
        </div>
        <div className="dash-overview-grid">
          <div className="dash-stat-group">
            <div className="dash-stat-group-label">Impact</div>
            <div className="dash-stat-row">
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#fb7185' }} />{kpis.byImpact.high} Mitigation</span>
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#fbbf24' }} />{kpis.byImpact.medium} Minor</span>
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#34d399' }} />{kpis.byImpact.low} No Impact</span>
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#94a3b8' }} />{kpis.byImpact.toReview} To Review</span>
            </div>
          </div>
          <div className="dash-stat-group">
            <div className="dash-stat-group-label">Analysis — {completedPct}% complete</div>
            <div className="dash-stat-row">
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#34d399' }} />{kpis.byAnalysis.reviewed} Reviewed</span>
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#64748b' }} />{kpis.byAnalysis.notApplicable} N/A</span>
              <span className="dash-stat"><span className="dash-dot" style={{ background: '#fbbf24' }} />{kpis.byAnalysis.inProgress} In Progress</span>
            </div>
          </div>
          <div className="dash-stat-group">
            <div className="dash-stat-group-label">GA Countdown</div>
            <div className="dash-stat-row">
              <span className="dash-stat"><b style={{ color: '#fb7185' }}>{kpis.ga30}</b> in 30d</span>
              <span className="dash-stat"><b style={{ color: '#fbbf24' }}>{kpis.ga60}</b> in 60d</span>
              <span className="dash-stat"><b style={{ color: '#38bdf8' }}>{kpis.ga90}</b> in 90d</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid2">
        {/* Watchlist GA Timeline */}
        <div className="card">
          <h3>Watchlist GA Timeline</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Upcoming watchlisted features by scheduled GA month, stacked by impact. Features already GA are excluded.
          </p>
          <div style={{ height: 300 }}>
            {gaTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gaTimeline}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="label" interval={1} tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
                  <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle} />
                  <Legend wrapperStyle={legendStyle} />
                  <Bar dataKey="high" name="Mitigation Required" stackId="a" fill={IMPACT_COLORS['🔴 Mitigation Required']} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="medium" name="Minor Impact" stackId="a" fill={IMPACT_COLORS['🟡 Minor Impact']} />
                  <Bar dataKey="low" name="No Impact" stackId="a" fill={IMPACT_COLORS['🟢 No Impact']} />
                  <Bar dataKey="toReview" name="To Review" stackId="a" fill={IMPACT_COLORS['🚩 To Review']} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
                No upcoming GA dates on watchlisted features
              </div>
            )}
          </div>
        </div>

        {/* Analysis Progress */}
        <div className="card">
          <h3>Analysis Progress</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Overall review completion across all upcoming watchlisted features.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 0' }}>
            {/* Donut */}
            {analysisPie.length > 0 && (
              <div style={{ width: 180, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={analysisPie}
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {analysisPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', color: 'var(--text)', fontSize: 28, fontWeight: 700, marginTop: -4 }}>
                  {completedPct}%
                </div>
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>complete</div>
              </div>
            )}
            {/* Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {analysisPie.map(d => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, minWidth: 100 }}>{d.name}</span>
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{d.value}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    ({kpis.total > 0 ? Math.round((d.value / kpis.total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid2">
        {/* Flagged-for breakdown */}
        <div className="card">
          <h3>Flagged For</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Distribution of upcoming watchlist items by team assignment.
          </p>
          <div style={{ height: 300 }}>
            {flaggedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flaggedData}>
                  <CartesianGrid stroke={colors.grid} vertical={false} />
                  <XAxis dataKey="label" tick={axisProps} axisLine={{ stroke: colors.grid }} tickLine={false} />
                  <YAxis tick={axisProps} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={labelStyle} itemStyle={itemStyle} cursor={cursorStyle} />
                  <Bar dataKey="count" name="Items" radius={[4, 4, 0, 0]}>
                    {flaggedData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: 13 }}>
                No flagged items
              </div>
            )}
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="card">
          <h3>Upcoming Watchlist Deadlines</h3>
          <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
            Next upcoming milestone per watchlisted feature, sorted by date. One entry per feature.
          </p>
          <div className="deadline-list">
            {deadlines.length > 0 ? deadlines.map((d, i) => (
              <div
                key={`${d.id}-${d.type}-${i}`}
                className="deadline-row"
                onClick={() => onOpenDetail(d.id)}
              >
                <div className="deadline-date">{fmtDate(d.date)}</div>
                <span className={`deadline-badge deadline-badge--${d.type.toLowerCase().replace(' ', '-')}`}>{d.type}</span>
                <span className="deadline-impact" style={{ color: IMPACT_COLORS[d.impact] ?? '#94a3b8' }}>
                  {d.impact.replace(/^.+\s/, '')}
                </span>
                <div className="deadline-name ellipsis">{d.name}</div>
              </div>
            )) : (
              <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                No upcoming milestones
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Recent Watchlist Changes ── */}
      <div className="card">
        <h3>Recent Watchlist Changes</h3>
        <p style={{ margin: '0 0 8px 0', color: 'var(--muted)', fontSize: 12, lineHeight: 1.5 }}>
          Changes detected in the last 30 days on your watchlisted features.
        </p>
        {recentChanges.length > 0 ? (
          <div className="recent-changes-list">
            {recentChanges.map(c => (
              <div
                key={c.id}
                className="recent-change-row"
                onClick={() => onOpenDetail(c.release_plan_id)}
              >
                <span className="recent-change-type">{labelChangeType(c.change_type)}</span>
                <span className="recent-change-name ellipsis">{c.feature_name}</span>
                {c.field_changed && <span className="recent-change-field">{c.field_changed}</span>}
                <span className="recent-change-date">
                  {new Date(c.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
            {changesQ.isLoading ? 'Loading changes...' : 'No recent changes on watchlisted features'}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ color: 'var(--muted)', fontSize: 11, opacity: 0.7, padding: '4px 0' }}>
        Data fetched: {fetchedAt}. Source:{' '}
        <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
      </div>
    </div>
  )
}
