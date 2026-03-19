import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { EnrichedFeature, WatchlistItem } from './types'
import { applyFilters, enrich } from './logic'

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
  const setFlaggedFor = useMutation({
    mutationFn: api.setFlaggedFor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })
  const setAnalysisStatus = useMutation({
    mutationFn: api.setAnalysisStatus,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const products = useMemo(() => Array.from(new Set(all.map(x => x['Product name']).filter(Boolean))).sort(), [all])
  const waves = useMemo(() => Array.from(new Set(all.map(x => x.releaseWave).filter(Boolean) as string[])).sort(), [all])
  const enablements = useMemo(() => Array.from(new Set(all.map(x => String(x['Enabled for'] ?? '')).filter(Boolean))).sort(), [all])


  const selectedImpact = useMemo(() => {
    if (!selectedId) return undefined
    return (watchQ.data ?? []).find(w => w.release_plan_id === selectedId)?.impact
  }, [watchQ.data, selectedId])

  const selectedFlaggedFor = useMemo(() => {
    if (!selectedId) return undefined
    return (watchQ.data ?? []).find(w => w.release_plan_id === selectedId)?.flagged_for
  }, [watchQ.data, selectedId])

  const selectedAnalysisStatus = useMemo(() => {
    if (!selectedId) return undefined
    return (watchQ.data ?? []).find(w => w.release_plan_id === selectedId)?.analysis_status
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
                  all={all}
                  watchItems={watchQ.data ?? []}
                  fetchedAt={releaseQ.data.fetchedAt}
                  sourceUrl={releaseQ.data.sourceUrl}
                  onOpenDetail={(id) => openDetail(id, 'watchlist')}
                />
              )}

              {tab === 'Features' && (
                <Features
                  filtered={filtered}
                  products={products}
                  waves={waves}
                  enablements={enablements}
                  filters={filters}
                  setFilters={setFilters}
                  watchItems={watchQ.data ?? []}
                  onOpenDetail={(id) => openDetail(id, 'feature')}
                />
              )}

              {tab === 'Watchlist' && (
                <Watchlist
                  all={all}
                  watch={watchQ.data ?? []}
                  onOpenDetail={(id) => openDetail(id, 'watchlist')}
                  waves={waves}
                  products={products}
                  enablements={enablements}
                />
              )}

              {tab === 'Changes' && <Changes watchIds={watchIds} watchItems={watchQ.data ?? []} waves={waves} allFeatures={all} />}

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
            flaggedFor={selectedFlaggedFor}
            onSetFlaggedFor={(flagged_for) => {
              if (!selectedId) return
              setFlaggedFor.mutate({ release_plan_id: selectedId, flagged_for })
            }}
            analysisStatus={selectedAnalysisStatus}
            onSetAnalysisStatus={(analysis_status) => {
              if (!selectedId) return
              setAnalysisStatus.mutate({ release_plan_id: selectedId, analysis_status })
            }}
          />
        </div>
      )}
    </IdentityGate>
  )
}
