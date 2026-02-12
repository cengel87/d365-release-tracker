import React, { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { ChangeLogItem, EnrichedFeature, WatchlistItem } from './types'
import { applyFilters, enrich, fmtDate, monthKey, monthLabel, statusEmoji } from './logic'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'

type Tab = 'Dashboard' | 'Features' | 'Watchlist' | 'Changes' | 'Help'
type DetailMode = 'feature' | 'watchlist'

const IMPACT_OPTIONS: WatchlistItem['impact'][] = ['🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review'].filter(
  (v, i, a) => a.indexOf(v) === i
) as any

function useIdentity() {
  const [name, setName] = useState(() => localStorage.getItem('d365_name') || '')
  const [editing, setEditing] = useState(() => !localStorage.getItem('d365_name'))

  function save(n: string) {
    const cleaned = n.trim()
    localStorage.setItem('d365_name', cleaned)
    setName(cleaned)
    setEditing(false)
  }

  return { name, editing, setEditing, save }
}

function Pill({ kind, children }: { kind: 'ok' | 'warn' | 'info' | 'muted', children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>
}

function parseDateInput(v: string): Date | null {
  if (!v) return null
  const d = new Date(v + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateInput(d: Date | null): string {
  if (!d) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function stripHtml(s: string) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function App() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('Dashboard')
  const ident = useIdentity()

  const releaseQ = useQuery({
    queryKey: ['releasePlans'],
    queryFn: api.fetchReleasePlans,
  })

  const watchQ = useQuery({
    queryKey: ['watchlist'],
    queryFn: api.getWatchlist,
  })

  const refreshMut = useMutation({
    mutationFn: api.refreshChangesNow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['changes'] })
      qc.invalidateQueries({ queryKey: ['releasePlans'] })
    },
  })

  const all = useMemo(() => {
    if (!releaseQ.data?.results) return [] as EnrichedFeature[]
    return enrich(releaseQ.data.results)
  }, [releaseQ.data])

  const [featureSort, setFeatureSort] = useState<{ key: string; dir: 'asc' | 'desc' }>(() => ({
    key: 'ga', dir: 'asc'
  }))

  const [filters, setFilters] = useState(() => ({
    search: '',
    products: [] as string[],
    statuses: [] as EnrichedFeature['status'][],
    waves: [] as string[],
    enabledFor: [] as string[],
    gaStart: null as Date | null,
    gaEnd: null as Date | null,
  }))

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered]
    const dir = featureSort.dir === 'asc' ? 1 : -1
    const k = featureSort.key

    const getVal = (f: EnrichedFeature) => {
      switch (k) {
        case 'status': return f.status ?? ''
        case 'product': return f['Product name'] ?? ''
        case 'feature': return f['Feature name'] ?? ''
        case 'wave': return f.releaseWave ?? ''
        case 'ga': return f.gaDate ? f.gaDate.getTime() : Number.POSITIVE_INFINITY // TBD last
        case 'enablement': return String(f['Enabled for'] ?? '')
        default: return ''
      }
    }

    arr.sort((a, b) => {
      const av = getVal(a) as any
      const bv = getVal(b) as any

      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })

    return arr
  }, [filtered, featureSort])


  const watchIds = useMemo(() => new Set((watchQ.data ?? []).map(w => w.release_plan_id)), [watchQ.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => all.find(f => f['Release Plan ID'] === selectedId) ?? null, [all, selectedId])

  // Modal state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMode, setDetailMode] = useState<DetailMode>('feature')

  function openDetail(id: string, mode: DetailMode) {
    setSelectedId(id)
    setDetailMode(mode)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
  }

  const addWatch = useMutation({
    mutationFn: api.addWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
  const rmWatch = useMutation({
    mutationFn: api.removeWatchlist,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
  const setImpact = useMutation({
    mutationFn: api.setImpact,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const products = useMemo(() => Array.from(new Set(all.map(x => x['Product name']).filter(Boolean))).sort(), [all])
  const waves = useMemo(() => Array.from(new Set(all.map(x => x.releaseWave).filter(Boolean) as string[])).sort(), [all])
  const enablements = useMemo(() => Array.from(new Set(all.map(x => String(x['Enabled for'] ?? '')).filter(Boolean))).sort(), [all])

  const metrics = useMemo(() => {
    const total = all.length
    const ga = all.filter(x => x.status === 'Generally Available').length
    const preview = all.filter(x => x.status === 'Public Preview').length
    const early = all.filter(x => x.status === 'Early Access').length
    const planned = all.filter(x => x.status === 'Planned').length
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const upcoming = all.filter(x => x.gaDate && x.gaDate > today).length
    return { total, ga, preview, early, planned, upcoming }
  }, [all])

  const upcomingByMonth = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const future = all.filter(x => x.gaDate && x.gaDate > today) as (EnrichedFeature & { gaDate: Date })[]
    const map = new Map<string, { month: string, label: string, count: number, highImpact: number }>()
    const impacts = new Map((watchQ.data ?? []).map(w => [w.release_plan_id, w.impact] as const))
    for (const f of future) {
      const k = monthKey(f.gaDate)
      const label = monthLabel(f.gaDate)
      const prev = map.get(k) ?? { month: k, label, count: 0, highImpact: 0 }
      prev.count += 1
      if (impacts.get(f['Release Plan ID']) === '🔴 High') prev.highImpact += 1
      map.set(k, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 18)
  }, [all, watchQ.data])

  const byWaveMonth = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const future = all.filter(x => x.gaDate && x.gaDate > today && x.releaseWave) as (EnrichedFeature & { gaDate: Date, releaseWave: string })[]
    const map = new Map<string, any>()
    for (const f of future) {
      const wave = f.releaseWave
      const month = monthLabel(f.gaDate)
      const key = `${wave}__${month}`
      const prev = map.get(key) ?? { wave, month, count: 0 }
      prev.count += 1
      map.set(key, prev)
    }
    const wavesSet = Array.from(new Set(future.map(x => x.releaseWave))).sort()
    const monthsSet = Array.from(new Set(future.map(x => monthKey(x.gaDate)))).sort().slice(0, 18)
    const monthLabelMap = new Map(monthsSet.map(mk => {
      const d = new Date(mk + '-01T00:00:00')
      return [mk, monthLabel(d)] as const
    }))
    const rows = monthsSet.map(mk => {
      const d = new Date(mk + '-01T00:00:00')
      const month = monthLabel(d)
      const row: Record<string, any> = { month }
      for (const wv of wavesSet) row[wv] = 0
      for (const wv of wavesSet) {
        const key = `${wv}__${month}`
        const v = map.get(key)?.count ?? 0
        row[wv] = v
      }
      return row
    })
    return { rows, waves: wavesSet, monthLabelMap }
  }, [all])

  const selectedImpact = useMemo(() => {
    if (!selectedId) return undefined
    return (watchQ.data ?? []).find(w => w.release_plan_id === selectedId)?.impact
  }, [watchQ.data, selectedId])

  function toggleSelectedWatch() {
    if (!selected) return
    const id = selected['Release Plan ID']
    if (!id) return
    if (watchIds.has(id)) rmWatch.mutate(id)
    else addWatch.mutate({ release_plan_id: id, feature_name: selected['Feature name'], product_name: selected['Product name'] })
  }

  if (ident.editing) {
    return (
      <div className="container">
        <div className="card">
          <div className="h-title">👋 Quick identity (for notes)</div>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Enter a display name. This is stored in your browser only and sent with any notes you post.
          </p>
          <div className="row">
            <input
              className="input"
              placeholder="e.g., Alex Chen"
              defaultValue={ident.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ident.save((e.target as HTMLInputElement).value)
              }}
            />
            <button
              className="btn"
              onClick={() => {
                const el = document.querySelector('input.input') as HTMLInputElement | null
                ident.save(el?.value ?? '')
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <div className="h-title">
          🚀 D365 & Power Platform Release Tracker <span className="badge">Netlify + Supabase</span>
        </div>
        <div className="row">
          <span className="badge">👤 {ident.name || 'Guest'}</span>
          <button className="btn secondary small" onClick={() => ident.setEditing(true)}>Edit name</button>
          <button className="btn small" disabled={refreshMut.isPending} onClick={() => refreshMut.mutate()}>
            {refreshMut.isPending ? 'Refreshing…' : '🔄 Refresh & detect changes'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {(['Dashboard', 'Features', 'Watchlist', 'Changes', 'Help'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {releaseQ.isLoading && <div className="card">Loading Microsoft release plans…</div>}
      {releaseQ.isError && (
        <div className="card">
          <b>Failed to load data.</b>
          <div style={{ color: 'var(--muted)', marginTop: 6 }}>{String(releaseQ.error)}</div>
        </div>
      )}

      {releaseQ.data && (
        <>
          {tab === 'Dashboard' && (
            <Dashboard
              metrics={metrics}
              upcomingByMonth={upcomingByMonth}
              byWaveMonth={byWaveMonth}
              fetchedAt={releaseQ.data.fetchedAt}
              sourceUrl={releaseQ.data.sourceUrl}
            />
          )}

          {tab === 'Features' && (
            <Features
              filtered={sortedFiltered}
              products={products}
              waves={waves}
              enablements={enablements}
              filters={filters}
              setFilters={setFilters}
              watchIds={watchIds}
              onOpenDetail={(id) => openDetail(id, 'feature')}
              featureSort={featureSort}
              setFeatureSort={setFeatureSort}
            />

          )}

          {tab === 'Watchlist' && (
            <Watchlist
              all={all}
              watch={watchQ.data ?? []}
              onOpenDetail={(id) => openDetail(id, 'watchlist')}
            />
          )}

          {tab === 'Changes' && <Changes />}

          {tab === 'Help' && <Help fetchedAt={releaseQ.data.fetchedAt} sourceUrl={releaseQ.data.sourceUrl} />}
        </>
      )}

      <FeatureModal
        open={detailOpen}
        mode={detailMode}
        onClose={closeDetail}
        feature={selected}
        watched={selected ? watchIds.has(selected['Release Plan ID']) : false}
        onToggleWatch={toggleSelectedWatch}
        identityName={ident.name || 'Guest'}
        impact={selectedImpact}
        onSetImpact={(impact) => {
          if (!selectedId) return
          setImpact.mutate({ release_plan_id: selectedId, impact })
        }}
      />
    </div>
  )
}

function Dashboard({ metrics, upcomingByMonth, byWaveMonth, fetchedAt, sourceUrl }: {
  metrics: { total: number; ga: number; preview: number; early: number; planned: number; upcoming: number }
  upcomingByMonth: { label: string; count: number; highImpact: number }[]
  byWaveMonth: { rows: any[]; waves: string[] }
  fetchedAt: string
  sourceUrl: string
}) {
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
          <h3>Upcoming GA features by month (next 18 months)</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={upcomingByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={2} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="All upcoming GA" />
                <Bar dataKey="highImpact" name="High-impact (watchlist)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 12 }}>
            Data fetched: {fetchedAt}. Source:{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
          </div>
        </div>

        <div className="card">
          <h3>Release Wave “channel” → monthly GA volume</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWaveMonth.rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" interval={2} />
                <YAxis />
                <Tooltip />
                <Legend />
                {byWaveMonth.waves.slice(0, 6).map((w) => (
                  <Bar key={w} dataKey={w} stackId="a" name={w} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Stacked by <b>Release Wave</b>. If you have many waves, we show the first 6 to keep it readable.
          </div>
        </div>
      </div>
    </div>
  )
}

function Features(props: {
  filtered: EnrichedFeature[]
  products: string[]
  waves: string[]
  enablements: string[]
  filters: any
  setFilters: (v: any) => void
  watchIds: Set<string>
  onOpenDetail: (id: string) => void
  featureSort: { key: string; dir: 'asc' | 'desc' }
  setFeatureSort: (v: { key: string; dir: 'asc' | 'desc' }) => void
}) {
  const {
    filtered, products, waves, enablements,
    filters, setFilters, watchIds, onOpenDetail,
    featureSort, setFeatureSort
  } = props

  const toggleSort = (key: string) => {
    if (featureSort.key === key) {
      setFeatureSort({ key, dir: featureSort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      setFeatureSort({ key, dir: 'asc' })
    }
  }

  const arrow = (key: string) => {
    if (featureSort.key !== key) return ''
    return featureSort.dir === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="row">
            <input
              className="input"
              style={{ minWidth: 260 }}
              placeholder="Search keywords…"
              value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />

            <select
              value={filters.statuses[0] ?? ''}
              onChange={(e) => {
                const v = e.target.value as any
                setFilters({ ...filters, statuses: v ? [v] : [] })
              }}
            >
              <option value="">All statuses</option>
              <option value="Generally Available">🟢 Generally Available</option>
              <option value="Public Preview">🔵 Public Preview</option>
              <option value="Early Access">🟣 Early Access</option>
              <option value="Planned">⚪ Planned</option>
            </select>

            <select
              value={filters.products[0] ?? ''}
              onChange={(e) => setFilters({ ...filters, products: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">All products</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              value={filters.waves[0] ?? ''}
              onChange={(e) => setFilters({ ...filters, waves: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">All waves</option>
              {waves.map(w => <option key={w} value={w}>{w}</option>)}
            </select>

            <select
              value={filters.enabledFor[0] ?? ''}
              onChange={(e) => setFilters({ ...filters, enabledFor: e.target.value ? [e.target.value] : [] })}
            >
              <option value="">All enablement</option>
              {enablements.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            {/* GA date range (if you already added these to filters + applyFilters) */}
            <input
              className="input"
              type="date"
              value={filters.gaStart ? new Date(filters.gaStart).toISOString().slice(0, 10) : ''}
              onChange={(e) => setFilters({ ...filters, gaStart: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })}
              title="GA start date"
            />
            <input
              className="input"
              type="date"
              value={filters.gaEnd ? new Date(filters.gaEnd).toISOString().slice(0, 10) : ''}
              onChange={(e) => setFilters({ ...filters, gaEnd: e.target.value ? new Date(e.target.value + 'T00:00:00') : null })}
              title="GA end date"
            />
          </div>

          <div className="row">
            <Pill kind="muted">{filtered.length.toLocaleString()} features</Pill>
            <button
              className="btn secondary small"
              onClick={() => setFilters({ search: '', products: [], statuses: [], waves: [], enabledFor: [], gaStart: null, gaEnd: null })}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10 }}>
          Sorting: click table headers. Open details: click any row (Esc closes modal).
        </div>
      </div>

      <div className="card fullwidth-table">
        <h3>Feature list</h3>

        <div className="table-wrap">
          <table className="features-table">
            <thead>
              <tr>
                <th>👁️</th>
                <th className="sortable" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th className="sortable" onClick={() => toggleSort('product')}>Product{arrow('product')}</th>
                <th className="sortable" onClick={() => toggleSort('feature')}>Feature{arrow('feature')}</th>
                <th className="sortable" onClick={() => toggleSort('wave')}>Wave{arrow('wave')}</th>
                <th className="sortable" onClick={() => toggleSort('ga')}>GA{arrow('ga')}</th>
                <th className="sortable" onClick={() => toggleSort('enablement')}>Enablement{arrow('enablement')}</th>
              </tr>
            </thead>

            <tbody>
              {filtered.slice(0, 800).map(f => {
                const id = f['Release Plan ID']
                const watched = watchIds.has(id)

                return (
                  <tr
                    key={id}
                    className="row-clickable"
                    onClick={() => onOpenDetail(id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td title={watched ? 'In watchlist' : ''}>{watched ? '👁️' : ''}</td>
                    <td title={`${f.status}`}>{statusEmoji(f.status)} {f.status}</td>
                    <td title={String(f['Product name'] ?? '')}>{f['Product name']}</td>
                    <td title={String(f['Feature name'] ?? '')}><b>{f['Feature name']}</b></td>
                    <td title={String(f.releaseWave ?? 'TBD')}>{f.releaseWave ?? 'TBD'}</td>
                    <td title={fmtDate(f.gaDate)}>{fmtDate(f.gaDate)}</td>
                    <td title={String(f['Enabled for'] ?? '')}>{String(f['Enabled for'] ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          Showing up to 800 rows for performance. Refine filters to narrow down.
        </div>
      </div>
    </div>
  )
}


function FeatureDetail({ feature, watched, onToggleWatch, showImpact, identityName, impact, onSetImpact, hideHeader }: {
  feature: EnrichedFeature
  watched: boolean
  onToggleWatch: () => void
  showImpact: boolean
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact']) => void
  hideHeader?: boolean
}) {
  const id = feature['Release Plan ID']
  const notesQ = useQuery({
    queryKey: ['notes', id],
    queryFn: () => api.listNotes(id),
    enabled: Boolean(id),
  })
  const qc = useQueryClient()
  const addNoteMut = useMutation({
    mutationFn: api.addNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', id] }),
  })

  const [note, setNote] = useState('')

  return (
    <>
      {!hideHeader && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {statusEmoji(feature.status)} {feature['Feature name']}
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4 }}>
              {feature['Product name']} · {feature.releaseWave ?? 'TBD'} · {String(feature['Enabled for'] ?? '')}
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 12 }}>
              EA: {fmtDate(feature.earlyAccessDate)} · Preview: {fmtDate(feature.previewDate)} · GA: {fmtDate(feature.gaDate)}
              {feature.daysToGA !== null && feature.gaDate ? ` · ${feature.daysToGA > 0 ? `${feature.daysToGA}d` : feature.daysToGA < 0 ? `${Math.abs(feature.daysToGA)}d ago` : 'today'}` : ''}
            </div>
          </div>
          <div className="row">
            <button className={`btn small ${watched ? 'danger' : ''}`} onClick={onToggleWatch}>
              {watched ? '👁️ Remove' : '👁️ Add to watchlist'}
            </button>
            {feature.msLink && <a className="btn small" href={feature.msLink} target="_blank" rel="noreferrer">🔗 Microsoft</a>}
          </div>
        </div>
      )}


      {showImpact && onSetImpact && (
        <div className="row" style={{ marginTop: 10 }}>
          <Pill kind="info">Impact assessment</Pill>
          <select value={impact ?? '🚩 To Review'} onChange={(e) => onSetImpact(e.target.value as any)}>
            {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      <hr />

      <div className="grid grid2">
        <div className="card" style={{ padding: 12 }}>
          <h3>Business value</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {stripHtml(String(feature['Business value'] ?? '').trim()) || '—'}
          </div>
        </div>
        <div className="card" style={{ padding: 12 }}>
          <h3>Feature details</h3>
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {stripHtml(String(feature['Feature details'] ?? '').trim()) || '—'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Team notes</h3>
        {notesQ.isLoading && <div style={{ color: 'var(--muted)' }}>Loading notes…</div>}
        {notesQ.isError && <div style={{ color: 'var(--muted)' }}>Failed to load notes.</div>}
        {notesQ.data && notesQ.data.length === 0 && <div style={{ color: 'var(--muted)' }}>No notes yet.</div>}
        {notesQ.data && notesQ.data.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {notesQ.data.slice(0, 10).map(n => (
              <div key={n.id} className="card" style={{ padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <b>{n.author_name}</b> · {n.created_at.slice(0, 10)}
                </div>
                <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.content}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note… (keep it actionable)" />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="badge">Posting as: {identityName || 'Guest'}</span>
            <button
              className="btn"
              disabled={!note.trim() || addNoteMut.isPending}
              onClick={() => {
                addNoteMut.mutate({ release_plan_id: id, author_name: identityName || 'Guest', content: note.trim() })
                setNote('')
              }}
            >
              {addNoteMut.isPending ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Raw JSON (from Microsoft feed)</h3>
        <pre>{JSON.stringify(feature, null, 2)}</pre>
      </div>
    </>
  )
}

function Watchlist(props: {
  all: EnrichedFeature[]
  watch: WatchlistItem[]
  onOpenDetail: (id: string) => void
}) {
  const { all, watch, onOpenDetail } = props
  const joined = useMemo(() => {
    const byId = new Map(all.map(f => [f['Release Plan ID'], f] as const))
    return watch
      .map(w => ({ w, f: byId.get(w.release_plan_id) }))
      .filter(x => Boolean(x.f))
  }, [all, watch])

  return (
    <div className="grid">
      <div className="card fullwidth-table">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Team watchlist</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Shared across the team (Supabase)</div>
          </div>
          <Pill kind="info">{joined.length} tracked</Pill>
        </div>

        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Impact</th>
                <th>Status</th>
                <th>Product</th>
                <th>Feature</th>
                <th>Wave</th>
                <th>GA</th>
              </tr>
            </thead>
            <tbody>
              {joined.map(({ w, f }) => {
                const ff = f!
                return (
                  <tr key={w.release_plan_id} onClick={() => onOpenDetail(w.release_plan_id)} style={{ cursor: 'pointer' }}>
                    <td>{w.impact}</td>
                    <td>{statusEmoji(ff.status)} {ff.status}</td>
                    <td>{ff['Product name']}</td>
                    <td><b>{ff['Feature name']}</b></td>
                    <td>{ff.releaseWave ?? 'TBD'}</td>
                    <td>{fmtDate(ff.gaDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h3>Export (CSV)</h3>
          <button className="btn secondary" onClick={() => {
            const rows = joined.map(({ w, f }) => ({
              impact: w.impact,
              status: f!.status,
              product: f!['Product name'],
              feature: f!['Feature name'],
              wave: f!.releaseWave ?? '',
              early_access: fmtDate(f!.earlyAccessDate),
              preview: fmtDate(f!.previewDate),
              ga: fmtDate(f!.gaDate),
              enabled_for: String(f!['Enabled for'] ?? ''),
              release_plan_id: w.release_plan_id,
              ms_link: f!.msLink ?? '',
            }))
            const csv = toCsv(rows)
            download(`watchlist_${new Date().toISOString().slice(0, 10)}.csv`, csv)
          }}>
            Download watchlist CSV
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureModal(props: {
  open: boolean
  onClose: () => void
  feature: EnrichedFeature | null
  mode: DetailMode
  watched: boolean
  onToggleWatch: () => void
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact']) => void
}) {
  const { open, onClose, feature, mode, watched, onToggleWatch, identityName, impact, onSetImpact } = props

  // Escape to close + lock background scroll
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">
              {feature ? `${statusEmoji(feature.status)} ${feature['Feature name']}` : 'Details'}
            </div>
            {feature && (
              <div className="modal-subtitle">
                {feature['Product name']} · {feature.releaseWave ?? 'TBD'} · GA: {fmtDate(feature.gaDate)}
              </div>
            )}
          </div>

          <div className="modal-actions">
            {feature && (
              <>
                <button className={`btn small ${watched ? 'danger' : ''}`} onClick={onToggleWatch}>
                  {watched ? '👁️ Remove' : '👁️ Add to watchlist'}
                </button>
                {feature.msLink && (
                  <a className="btn small" href={feature.msLink} target="_blank" rel="noreferrer">🔗 Microsoft</a>
                )}
              </>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          {!feature && <div style={{ color: 'var(--muted)' }}>No feature selected.</div>}

          {feature && (
            <FeatureDetail
              feature={feature}
              watched={watched}
              onToggleWatch={onToggleWatch}
              showImpact={mode === 'watchlist'}
              identityName={identityName}
              impact={impact ?? '🚩 To Review'}
              onSetImpact={onSetImpact}
              hideHeader={true}
            />

          )}
        </div>
      </div>
    </div>
  )
}

function Changes() {
  const [days, setDays] = useState(14)
  const q = useQuery({ queryKey: ['changes', days], queryFn: () => api.listChanges(days) })

  const groups = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of (q.data ?? [])) m.set(c.change_type, (m.get(c.change_type) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [q.data])

  const chartData = useMemo(() => {
    const items = q.data ?? []
    const byDay = new Map<string, number>()
    for (const c of items) {
      const day = c.detected_at.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    return Array.from(byDay.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
  }, [q.data])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Change feed (auto-detected)</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Runs on demand via “Refresh & detect changes”.</div>
          </div>
          <div className="row">
            <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>Changes per day</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" interval={2} />
                <YAxis />
                <Tooltip />
                <Line dataKey="count" name="Changes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Summary</h3>
          {groups.length === 0 && <div style={{ color: 'var(--muted)' }}>No changes found in this period.</div>}
          {groups.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {groups.map(([t, c]) => (
                <div key={t} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{labelChangeType(t)}</span>
                  <Pill kind="info">{c}</Pill>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Recent changes</h3>
        {q.isLoading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
        {q.isError && <div style={{ color: 'var(--muted)' }}>Failed: {String(q.error)}</div>}
        {q.data && q.data.length === 0 && <div style={{ color: 'var(--muted)' }}>No changes in this period.</div>}
        {q.data && q.data.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {q.data.slice(0, 60).map(c => (
              <div key={c.id} className="card" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800 }}>{labelChangeType(c.change_type)} · {c.feature_name}</div>
                  <span className="badge">{c.detected_at.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>{c.product_name} · ID: {c.release_plan_id}</div>
                {c.field_changed && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <b>{c.field_changed}:</b> {short(c.old_value)} → {short(c.new_value)}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <a className="btn small" href={buildMsVerifyLink(c.product_name, c.feature_name)} target="_blank" rel="noreferrer">
                    🔗 Verify on Microsoft
                  </a>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Raw JSON</summary>
                  <pre>{JSON.stringify(c, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function buildMsVerifyLink(productName: string, featureName: string) {
  const appName = productName.replace('Dynamics 365 ', '').replace('Microsoft ', '').trim()
  const params = new URLSearchParams({ app: appName, q: featureName })
  return `https://releaseplans.microsoft.com/en-us/?${params.toString()}`
}

function labelChangeType(t: ChangeLogItem['change_type'] | string) {
  const m: Record<string, string> = {
    new_feature: '🆕 New',
    date_change: '📅 Date',
    status_change: '🔄 Status',
    description_change: '📝 Description',
    wave_change: '🌊 Wave',
    removed: '🗑️ Removed',
  }
  return m[t] ?? t
}

function short(v: string | null) {
  const s = String(v ?? '')
  if (s.length <= 140) return s || '(empty)'
  return s.slice(0, 140) + '…'
}

function Help({ fetchedAt, sourceUrl }: { fetchedAt: string, sourceUrl: string }) {
  return (
    <div className="grid">
      <div className="card">
        <h3>What this app does</h3>
        <ul style={{ marginTop: 8, color: 'var(--muted)' }}>
          <li><b>Microsoft feed</b> (proxy via Netlify function) + direct “View on Microsoft” link per feature.</li>
          <li><b>Watchlist + Impact assessment</b> (team shared) + <b>notes</b>.</li>
          <li><b>Meaningful charts</b>: upcoming GA by month + release-wave “channel” view.</li>
          <li><b>Change detection</b>: on-demand refresh stores snapshots and logs changes.</li>
          <li><b>Raw JSON</b> shown for transparency and troubleshooting.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Status legend</h3>
        <div className="row" style={{ gap: 12 }}>
          <Pill kind="ok">🟢 Generally Available</Pill>
          <Pill kind="info">🔵 Public Preview</Pill>
          <Pill kind="info">🟣 Early Access</Pill>
          <Pill kind="muted">⚪ Planned</Pill>
        </div>
        <hr />
        <h3>Data source</h3>  
        <p style={{ color: 'var(--muted)' }}>
          Fetched: {fetchedAt}.
          Source endpoint:{' '}
          <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a>
        </p>
        <p style={{ color: 'var(--muted)', marginTop: 8 }}>
          Microsoft warns delivery timelines can change and features may be delayed or removed; always verify critical items on the official site.
        </p>
        <hr />
        <code>Microsoft important changes</code>
        <a href="https://learn.microsoft.com/en-us/power-platform/important-changes-coming" target="_blank" rel="noreferrer"><br />
          🔗 Power Platform — Important changes & deprecations
        </a>
      </div>
    </div>
  )
}

function toCsv(rows: Record<string, any>[]) {
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
  const esc = (v: any) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  const header = cols.join(',')
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n')
  return header + '\n' + body
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
