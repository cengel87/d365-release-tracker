import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { EnrichedFeature, WatchlistItem } from './types'
import { applyFilters, enrich, monthKey, monthLabel } from './logic'

import { IdentityGate } from './components/IdentityGate'
import { Header } from './components/Header'
import { Tabs } from './components/Tabs'
import { Dashboard } from './components/Dashboard'
import { Features } from './components/Features'
import { Watchlist } from './components/Watchlist'
import { Changes } from './components/Changes'
import { Help } from './components/Help'
import { FeatureModal } from './components/FeatureModal'

export type Tab = 'Dashboard' | 'Features' | 'Watchlist' | 'Changes' | 'Help'
export type DetailMode = 'feature' | 'watchlist'

export default function App() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('Dashboard')

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

  const upcomingPreviewByMonth = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const future = all.filter(x => x.previewDate && x.previewDate > today) as (EnrichedFeature & { previewDate: Date })[]
    const map = new Map<string, { month: string; label: string; count: number; highImpact: number }>()
    const impacts = new Map((watchQ.data ?? []).map(w => [w.release_plan_id, w.impact] as const))
    for (const f of future) {
      const k = monthKey(f.previewDate)
      const label = monthLabel(f.previewDate)
      const prev = map.get(k) ?? { month: k, label, count: 0, highImpact: 0 }
      prev.count += 1
      if (impacts.get(f['Release Plan ID']) === '🔴 High') prev.highImpact += 1
      map.set(k, prev)
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month)).slice(0, 18)
  }, [all, watchQ.data])

  const upcomingEarlyAccessByMonth = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const future = all.filter(x => x.earlyAccessDate && x.earlyAccessDate > today) as (EnrichedFeature & { earlyAccessDate: Date })[]
    const map = new Map<string, { month: string; label: string; count: number; highImpact: number }>()
    const impacts = new Map((watchQ.data ?? []).map(w => [w.release_plan_id, w.impact] as const))
    for (const f of future) {
      const k = monthKey(f.earlyAccessDate)
      const label = monthLabel(f.earlyAccessDate)
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
    return { rows, waves: wavesSet }
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

  return (
    <IdentityGate>
      {(ident) => (
        <div className="container">
          <Header
            identityName={ident.name || 'Guest'}
            onEditName={() => ident.setEditing(true)}
            refreshing={refreshMut.isPending}
            onRefresh={() => refreshMut.mutate()}
          />

          <Tabs tab={tab} setTab={setTab} />

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
                  upcomingPreviewByMonth={upcomingPreviewByMonth}
                  upcomingEarlyAccessByMonth={upcomingEarlyAccessByMonth}
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

              {tab === 'Changes' && <Changes watchIds={watchIds} />}

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
      )}
    </IdentityGate>
  )
}
