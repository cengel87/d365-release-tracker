import React, { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { ChangeLogItem, EnrichedFeature, WatchlistItem } from './types'
import { applyFilters, enrich, fmtDate, monthKey, monthLabel, statusEmoji } from './logic'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts'

type Tab = 'Dashboard'|'Features'|'Watchlist'|'Changes'|'Help'

const IMPACT_OPTIONS: WatchlistItem['impact'][] = ['🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review']

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

function Pill({ kind, children }: { kind: 'ok'|'warn'|'info'|'muted', children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>
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

  const watchIds = useMemo(() => new Set((watchQ.data ?? []).map(w => w.release_plan_id)), [watchQ.data])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => all.find(f => f['Release Plan ID'] === selectedId) ?? null, [all, selectedId])

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
    const today = new Date(); today.setHours(0,0,0,0)
    const upcoming = all.filter(x => x.gaDate && x.gaDate > today).length
    return { total, ga, preview, early, planned, upcoming }
  }, [all])

  const upcomingByMonth = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0)
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
    return Array.from(map.values()).sort((a,b) => a.month.localeCompare(b.month)).slice(0, 18)
  }, [all, watchQ.data])

  const byWaveMonth = useMemo(() => {
    // Semi-annual "channel": Release Wave (e.g., 2025 wave 2) and within it, monthly GA counts.
    const today = new Date(); today.setHours(0,0,0,0)
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
    // Make it stacked-friendly: list rows by month, with wave series keys.
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

  if (ident.editing) {
    return (
      <div className="container">
        <div className="card">
          <div className="h-title">👋 Quick identity (for notes)</div>
          <p style={{color:'var(--muted)', marginTop:6}}>
            Enter a display name. This is stored in your browser only and sent with any notes you post.
          </p>
          <div className="row">
            <input className="input" placeholder="e.g., Alex Chen" defaultValue={ident.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ident.save((e.target as HTMLInputElement).value)
              }}
            />
            <button className="btn" onClick={() => {
              const el = document.querySelector('input.input') as HTMLInputElement | null
              ident.save(el?.value ?? '')
            }}>Continue</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <div className="h-title">🚀 D365 & Power Platform Release Tracker <span className="badge">Netlify + Supabase</span></div>
        <div className="row">
          <span className="badge">👤 {ident.name || 'Guest'}</span>
          <button className="btn secondary small" onClick={() => ident.setEditing(true)}>Edit name</button>
          <button className="btn small" disabled={refreshMut.isPending} onClick={() => refreshMut.mutate()}>
            {refreshMut.isPending ? 'Refreshing…' : '🔄 Refresh & detect changes'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {(['Dashboard','Features','Watchlist','Changes','Help'] as Tab[]).map(t => (
          <button key={t} className={`tab ${tab===t ? 'active':''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {releaseQ.isLoading && <div className="card">Loading Microsoft release plans…</div>}
      {releaseQ.isError && <div className="card">
        <b>Failed to load data.</b>
        <div style={{color:'var(--muted)', marginTop:6}}>{String(releaseQ.error)}</div>
      </div>}

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
              all={all}
              filtered={filtered}
              products={products}
              waves={waves}
              enablements={enablements}
              filters={filters}
              setFilters={setFilters}
              watchIds={watchIds}
              setSelectedId={setSelectedId}
              selected={selected}
              onToggleWatch={(f) => {
                const id = f['Release Plan ID']
                if (!id) return
                if (watchIds.has(id)) rmWatch.mutate(id)
                else addWatch.mutate({ release_plan_id: id, feature_name: f['Feature name'], product_name: f['Product name'] })
              }}
            />
          )}

          {tab === 'Watchlist' && (
            <Watchlist
              all={all}
              watch={watchQ.data ?? []}
              watchIds={watchIds}
              setSelectedId={setSelectedId}
              selected={selected}
              onToggleWatch={(id) => rmWatch.mutate(id)}
              onSetImpact={(id, impact) => setImpact.mutate({ release_plan_id: id, impact })}
              impactOptions={IMPACT_OPTIONS}
              identityName={ident.name || 'Guest'}
            />
          )}

          {tab === 'Changes' && (
            <Changes />
          )}

          {tab === 'Help' && (
            <Help fetchedAt={releaseQ.data.fetchedAt} sourceUrl={releaseQ.data.sourceUrl} />
          )}
        </>
      )}
    </div>
  )
}

function Dashboard({ metrics, upcomingByMonth, byWaveMonth, fetchedAt, sourceUrl }: {
  metrics: { total:number; ga:number; preview:number; early:number; planned:number; upcoming:number }
  upcomingByMonth: { label:string; count:number; highImpact:number }[]
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
          <div style={{height: 320}}>
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
          <div style={{marginTop:10, color:'var(--muted)', fontSize:12}}>
            Data fetched: {fetchedAt}. Source: <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
          </div>
        </div>

        <div className="card">
          <h3>Release Wave “channel” → monthly GA volume</h3>
          <div style={{height: 320}}>
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
          <div style={{color:'var(--muted)', fontSize:12}}>
            Stacked by <b>Release Wave</b>. If you have many waves, we show the first 6 to keep it readable.
          </div>
        </div>
      </div>
    </div>
  )
}

function Features(props: {
  all: EnrichedFeature[]
  filtered: EnrichedFeature[]
  products: string[]
  waves: string[]
  enablements: string[]
  filters: any
  setFilters: (v:any)=>void
  watchIds: Set<string>
  setSelectedId: (id:string)=>void
  selected: EnrichedFeature | null
  onToggleWatch: (f:EnrichedFeature)=>void
}) {
  const { filtered, products, waves, enablements, filters, setFilters, watchIds, setSelectedId, selected, onToggleWatch } = props

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="row">
            <input className="input" style={{minWidth:260}} placeholder="Search keywords…" value={filters.search}
              onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
            <select value={filters.statuses[0] ?? ''} onChange={(e) => {
              const v = e.target.value as any
              setFilters({ ...filters, statuses: v ? [v] : [] })
            }}>
              <option value="">All statuses</option>
              <option value="Generally Available">🟢 Generally Available</option>
              <option value="Public Preview">🔵 Public Preview</option>
              <option value="Early Access">🟣 Early Access</option>
              <option value="Planned">⚪ Planned</option>
            </select>
            <select value={filters.products[0] ?? ''} onChange={(e) => setFilters({ ...filters, products: e.target.value ? [e.target.value] : [] })}>
              <option value="">All products</option>
              {products.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filters.waves[0] ?? ''} onChange={(e) => setFilters({ ...filters, waves: e.target.value ? [e.target.value] : [] })}>
              <option value="">All waves</option>
              {waves.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={filters.enabledFor[0] ?? ''} onChange={(e) => setFilters({ ...filters, enabledFor: e.target.value ? [e.target.value] : [] })}>
              <option value="">All enablement</option>
              {enablements.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className="row">
            <Pill kind="muted">{filtered.length.toLocaleString()} features</Pill>
            <button className="btn secondary small" onClick={() => setFilters({ search:'', products:[], statuses:[], waves:[], enabledFor:[], gaStart:null, gaEnd:null })}>
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <h3>Feature list</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>👁️</th>
                  <th>Status</th>
                  <th>Product</th>
                  <th>Feature</th>
                  <th>Wave</th>
                  <th>GA</th>
                  <th>Enablement</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 800).map(f => {
                  const id = f['Release Plan ID']
                  const watched = watchIds.has(id)
                  return (
                    <tr key={id} onClick={() => setSelectedId(id)} style={{cursor:'pointer'}}>
                      <td>{watched ? '👁️' : ''}</td>
                      <td>{statusEmoji(f.status)} {f.status}</td>
                      <td>{f['Product name']}</td>
                      <td><b>{f['Feature name']}</b></td>
                      <td>{f.releaseWave ?? 'TBD'}</td>
                      <td>{fmtDate(f.gaDate)}</td>
                      <td>{String(f['Enabled for'] ?? '')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{color:'var(--muted)', fontSize:12, marginTop:8}}>
            Showing up to 800 rows for performance. Refine filters to narrow down.
          </div>
        </div>

        <div className="card">
          <h3>Details</h3>
          {!selected && <div style={{color:'var(--muted)'}}>Select a feature row to view details.</div>}
          {selected && (
            <FeatureDetail
              feature={selected}
              watched={watchIds.has(selected['Release Plan ID'])}
              onToggleWatch={() => onToggleWatch(selected)}
              showImpact={false}
              identityName=""
            />
          )}
        </div>
      </div>
    </div>
  )
}

function FeatureDetail({ feature, watched, onToggleWatch, showImpact, identityName, impact, onSetImpact }: {
  feature: EnrichedFeature
  watched: boolean
  onToggleWatch: ()=>void
  showImpact: boolean
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact'])=>void
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
      <div className="row" style={{justifyContent:'space-between'}}>
        <div>
          <div style={{fontSize:16, fontWeight:800}}>
            {statusEmoji(feature.status)} {feature['Feature name']}
          </div>
          <div style={{color:'var(--muted)', marginTop:4}}>
            {feature['Product name']} · {feature.releaseWave ?? 'TBD'} · {String(feature['Enabled for'] ?? '')}
          </div>
          <div style={{color:'var(--muted)', marginTop:4, fontSize:12}}>
            EA: {fmtDate(feature.earlyAccessDate)} · Preview: {fmtDate(feature.previewDate)} · GA: {fmtDate(feature.gaDate)}
            {feature.daysToGA !== null && feature.gaDate ? ` · ${feature.daysToGA > 0 ? `${feature.daysToGA}d` : feature.daysToGA < 0 ? `${Math.abs(feature.daysToGA)}d ago` : 'today'}` : ''}
          </div>
        </div>
        <div className="row">
          <button className={`btn small ${watched ? 'danger':''}`} onClick={onToggleWatch}>
            {watched ? '👁️ Remove' : '👁️ Add to watchlist'}
          </button>
          {feature.msLink && <a className="btn small" href={feature.msLink} target="_blank" rel="noreferrer">🔗 Microsoft</a>}
        </div>
      </div>

      {showImpact && onSetImpact && (
        <div className="row" style={{marginTop:10}}>
          <Pill kind="info">Impact assessment</Pill>
          <select value={impact ?? '🚩 To Review'} onChange={(e) => onSetImpact(e.target.value as any)}>
            {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      <hr />

      <div className="grid grid2">
        <div className="card" style={{padding:12}}>
          <h3>Business value</h3>
          <div style={{whiteSpace:'pre-wrap'}}>{String(feature['Business value'] ?? '').trim() || '—'}</div>
        </div>
        <div className="card" style={{padding:12}}>
          <h3>Feature details</h3>
          <div style={{whiteSpace:'pre-wrap'}}>{String(feature['Feature details'] ?? '').trim() || '—'}</div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3>Team notes</h3>
        {notesQ.isLoading && <div style={{color:'var(--muted)'}}>Loading notes…</div>}
        {notesQ.isError && <div style={{color:'var(--muted)'}}>Failed to load notes.</div>}
        {notesQ.data && notesQ.data.length === 0 && <div style={{color:'var(--muted)'}}>No notes yet.</div>}
        {notesQ.data && notesQ.data.length > 0 && (
          <div style={{display:'grid', gap:8}}>
            {notesQ.data.slice(0, 10).map(n => (
              <div key={n.id} className="card" style={{padding:10}}>
                <div style={{fontSize:12, color:'var(--muted)'}}><b>{n.author_name}</b> · {n.created_at.slice(0,10)}</div>
                <div style={{marginTop:4, whiteSpace:'pre-wrap'}}>{n.content}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop:10}}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note… (keep it actionable)" />
          <div className="row" style={{justifyContent:'space-between', marginTop:8}}>
            <span className="badge">Posting as: {identityName || 'Guest'}</span>
            <button className="btn" disabled={!note.trim() || addNoteMut.isPending} onClick={() => {
              addNoteMut.mutate({ release_plan_id: id, author_name: identityName || 'Guest', content: note.trim() })
              setNote('')
            }}>
              {addNoteMut.isPending ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3>Raw JSON (from Microsoft feed)</h3>
        <pre>{JSON.stringify(feature, null, 2)}</pre>
      </div>
    </>
  )
}

function Watchlist(props: {
  all: EnrichedFeature[]
  watch: WatchlistItem[]
  watchIds: Set<string>
  setSelectedId: (id:string)=>void
  selected: EnrichedFeature | null
  onToggleWatch: (id:string)=>void
  onSetImpact: (id:string, impact: WatchlistItem['impact'])=>void
  impactOptions: WatchlistItem['impact'][]
  identityName: string
}) {
  const { all, watch, watchIds, setSelectedId, selected, onToggleWatch, onSetImpact, impactOptions, identityName } = props
  const joined = useMemo(() => {
    const byId = new Map(all.map(f => [f['Release Plan ID'], f] as const))
    return watch
      .map(w => ({ w, f: byId.get(w.release_plan_id) }))
      .filter(x => Boolean(x.f))
  }, [all, watch])

  return (
    <div className="split">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div><h3 style={{margin:0}}>Team watchlist</h3><div style={{color:'var(--muted)', fontSize:12}}>Shared across the team (Supabase)</div></div>
          <Pill kind="info">{joined.length} tracked</Pill>
        </div>
        <div className="table-wrap" style={{marginTop:10}}>
          <table style={{minWidth: 800}}>
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
              {joined.map(({w,f}) => {
                const ff = f!
                return (
                  <tr key={w.release_plan_id} onClick={() => setSelectedId(w.release_plan_id)} style={{cursor:'pointer'}}>
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
      </div>

      <div className="card">
        <h3>Details</h3>
        {!selected || !watchIds.has(selected['Release Plan ID']) ? (
          <div style={{color:'var(--muted)'}}>Select a watchlist item to view details and update impact.</div>
        ) : (
          <FeatureDetail
            feature={selected}
            watched={true}
            onToggleWatch={() => onToggleWatch(selected['Release Plan ID'])}
            showImpact={true}
            identityName={identityName}
            impact={(watch.find(w => w.release_plan_id === selected['Release Plan ID'])?.impact) ?? '🚩 To Review'}
            onSetImpact={(impact) => onSetImpact(selected['Release Plan ID'], impact)}
          />
        )}

        <div className="card" style={{marginTop:12}}>
          <h3>Export (CSV)</h3>
          <button className="btn secondary" onClick={() => {
            const rows = joined.map(({w,f}) => ({
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
            download(`watchlist_${new Date().toISOString().slice(0,10)}.csv`, csv)
          }}>
            Download watchlist CSV
          </button>
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
    return Array.from(m.entries()).sort((a,b) => b[1]-a[1])
  }, [q.data])

  const chartData = useMemo(() => {
    // simple line: changes per day
    const items = q.data ?? []
    const byDay = new Map<string, number>()
    for (const c of items) {
      const day = c.detected_at.slice(0,10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    return Array.from(byDay.entries())
      .map(([day,count]) => ({ day, count }))
      .sort((a,b) => a.day.localeCompare(b.day))
  }, [q.data])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>
            <h3 style={{margin:0}}>Change feed (auto-detected)</h3>
            <div style={{color:'var(--muted)', fontSize:12}}>Runs on demand via “Refresh & detect changes”.</div>
          </div>
          <div className="row">
            <select value={String(days)} onChange={(e)=>setDays(Number(e.target.value))}>
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
          <div style={{height: 280}}>
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
          {groups.length === 0 && <div style={{color:'var(--muted)'}}>No changes found in this period.</div>}
          {groups.length > 0 && (
            <div style={{display:'grid', gap:8}}>
              {groups.map(([t,c]) => (
                <div key={t} className="row" style={{justifyContent:'space-between'}}>
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
        {q.isLoading && <div style={{color:'var(--muted)'}}>Loading…</div>}
        {q.isError && <div style={{color:'var(--muted)'}}>Failed: {String(q.error)}</div>}
        {q.data && q.data.length === 0 && <div style={{color:'var(--muted)'}}>No changes in this period.</div>}
        {q.data && q.data.length > 0 && (
          <div style={{display:'grid', gap:10}}>
            {q.data.slice(0, 60).map(c => (
              <div key={c.id} className="card" style={{padding:10}}>
                <div className="row" style={{justifyContent:'space-between'}}>
                  <div style={{fontWeight:800}}>{labelChangeType(c.change_type)} · {c.feature_name}</div>
                  <span className="badge">{c.detected_at.slice(0,16).replace('T',' ')}</span>
                </div>
                <div style={{color:'var(--muted)', marginTop:4}}>{c.product_name} · ID: {c.release_plan_id}</div>
                {c.field_changed && (
                  <div style={{marginTop:6, fontSize:13}}>
                    <b>{c.field_changed}:</b> {short(c.old_value)} → {short(c.new_value)}
                  </div>
                )}
                <div style={{marginTop:8}}>
                  <a className="btn small" href={buildMsVerifyLink(c.product_name, c.feature_name)} target="_blank" rel="noreferrer">🔗 Verify on Microsoft</a>
                </div>
                <details style={{marginTop:8}}>
                  <summary style={{cursor:'pointer', color:'var(--muted)'}}>Raw JSON</summary>
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
        <h3>What this app keeps (high-value only)</h3>
        <ul style={{marginTop:8, color:'var(--muted)'}}>
          <li><b>Microsoft feed</b> (proxy via Netlify function) + direct “View on Microsoft” link per feature.</li>
          <li><b>Watchlist + Impact assessment</b> (team shared) + <b>notes</b>.</li>
          <li><b>Meaningful charts</b>: upcoming GA by month + release-wave “channel” view.</li>
          <li><b>Change detection</b>: on-demand refresh stores snapshots and logs changes.</li>
          <li><b>Raw JSON</b> shown for transparency and troubleshooting.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Status legend</h3>
        <div className="row" style={{gap:12}}>
          <Pill kind="ok">🟢 Generally Available</Pill>
          <Pill kind="info">🔵 Public Preview</Pill>
          <Pill kind="info">🟣 Early Access</Pill>
          <Pill kind="muted">⚪ Planned</Pill>
        </div>
        <hr />
        <h3>Data source</h3>
        <div style={{color:'var(--muted)'}}>
          Fetched: {fetchedAt}. Source endpoint: <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a>
        </div>
        <div style={{color:'var(--muted)', marginTop:8}}>
          Microsoft warns delivery timelines can change and features may be delayed or removed; always verify critical items on the official site.
        </div>
        <hr />
        <h3>Microsoft important changes</h3>
        <a className="btn" href="https://learn.microsoft.com/en-us/power-platform/important-changes-coming" target="_blank" rel="noreferrer">
          🔗 Power Platform — Important changes & deprecations
        </a>
      </div>
    </div>
  )
}

function toCsv(rows: Record<string, any>[]) {
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
  const esc = (v:any) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"','""')}"`
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
