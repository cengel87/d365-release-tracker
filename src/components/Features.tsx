import React, { useMemo, useState } from 'react'
import type { AnalysisStatus, EnrichedFeature, WatchlistItem } from '../types'
import { analysisStatusEmoji, fmtDate, statusEmoji, statusShort } from '../logic'
import { Pill } from './Pill'

const ANALYSIS_RANK: Record<AnalysisStatus, number> = {
  'In Progress': 0,
  'Reviewed': 1,
  'Not Applicable': 2,
}

export function Features(props: {
  filtered: EnrichedFeature[]
  products: string[]
  waves: string[]
  enablements: string[]
  filters: any
  setFilters: (v: any) => void
  watchItems: WatchlistItem[]
  onOpenDetail: (id: string) => void
}) {
  const {
    filtered, products, waves, enablements,
    filters, setFilters, watchItems, onOpenDetail,
  } = props

  const watchMap = useMemo(
    () => new Map(watchItems.map(w => [w.release_plan_id, w])),
    [watchItems]
  )

  const [featureSort, setFeatureSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'ga', dir: 'asc',
  })
  const [hideCompleted, setHideCompleted] = useState(false)

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

  const sortedFiltered = useMemo(() => {
    let arr = [...filtered]

    // Hide Reviewed / Not Applicable watched items when toggle is on
    if (hideCompleted) {
      arr = arr.filter(f => {
        const w = watchMap.get(f['Release Plan ID'])
        if (!w) return true // unwatched — always show
        return w.analysis_status !== 'Reviewed' && w.analysis_status !== 'Not Applicable'
      })
    }

    const dir = featureSort.dir === 'asc' ? 1 : -1
    const k = featureSort.key

    const getVal = (f: EnrichedFeature): string | number => {
      switch (k) {
        case 'analysisStatus': {
          const w = watchMap.get(f['Release Plan ID'])
          // Unwatched features go last
          if (!w) return 99
          return ANALYSIS_RANK[w.analysis_status ?? 'In Progress'] ?? 99
        }
        case 'status': return f.status ?? ''
        case 'product': return f['Product name'] ?? ''
        case 'feature': return f['Feature name'] ?? ''
        case 'wave': return f.releaseWave ?? ''
        case 'ga': return f.gaDate ? f.gaDate.getTime() : Number.POSITIVE_INFINITY
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
  }, [filtered, featureSort, watchMap, hideCompleted])

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

            {/* GA date range */}
            <div className="field">
              <span className="label">GA Date Range</span>
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input"
                  type="date"
                  value={filters.gaStart ? new Date(filters.gaStart).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      gaStart: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
                    })
                  }
                  title="GA start date"
                />
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
                <input
                  className="input"
                  type="date"
                  value={filters.gaEnd ? new Date(filters.gaEnd).toISOString().slice(0, 10) : ''}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      gaEnd: e.target.value ? new Date(e.target.value + 'T00:00:00') : null,
                    })
                  }
                  title="GA end date"
                />
              </div>
            </div>

          </div>

          <div className="row">
            <Pill kind="muted">{sortedFiltered.length.toLocaleString()} features</Pill>
            <span
              className={`pill btn${hideCompleted ? ' active' : ''}`}
              onClick={() => setHideCompleted(v => !v)}
              title="Hide watchlist items marked Reviewed or Not Applicable"
            >
              ✅🚫 Hide done
            </span>
            <button
              className="btn secondary small"
              onClick={() => {
                setFilters({ search: '', products: [], statuses: [], waves: [], enabledFor: [], gaStart: null, gaEnd: null })
                setHideCompleted(false)
              }}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, opacity: 0.8 }}>
          Click table headers to sort. Click any row to view details (Esc to close).
        </div>
      </div>

      <div className="card fullwidth-table">
        <h3>Feature list</h3>

        <div className="table-wrap">
          <table className="features-table">
            <thead>
              <tr>
                <th className="sortable" title="Analysis status" onClick={() => toggleSort('analysisStatus')}>🔍{arrow('analysisStatus')}</th>
                <th className="sortable" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th className="sortable" onClick={() => toggleSort('product')}>Product{arrow('product')}</th>
                <th className="sortable" onClick={() => toggleSort('feature')}>Feature{arrow('feature')}</th>
                <th className="sortable" onClick={() => toggleSort('wave')}>Wave{arrow('wave')}</th>
                <th className="sortable" onClick={() => toggleSort('ga')}>GA{arrow('ga')}</th>
                <th className="sortable" onClick={() => toggleSort('enablement')}>Enablement{arrow('enablement')}</th>
              </tr>
            </thead>

            <tbody>
              {sortedFiltered.slice(0, 800).map(f => {
                const id = f['Release Plan ID']
                const watchItem = watchMap.get(id)
                const analysisStatus = watchItem?.analysis_status ?? null

                return (
                  <tr
                    key={id}
                    className="row-clickable"
                    onClick={() => onOpenDetail(id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td title={analysisStatus ?? ''}>{analysisStatus ? analysisStatusEmoji(analysisStatus) : ''}</td>
                    <td title={`${f.status}`}>{statusEmoji(f.status)} {statusShort(f.status)}</td>
                    <td title={String(f['Product name'] ?? '')}>{f['Product name']}</td>
                    <td title={String(f['Feature name'] ?? '')}>{f['Feature name']}</td>
                    <td title={String(f.releaseWave ?? 'TBD')}>{f.releaseWave ?? 'TBD'}</td>
                    <td title={fmtDate(f.gaDate)}>{fmtDate(f.gaDate)}</td>
                    <td title={String(f['Enabled for'] ?? '')}>{String(f['Enabled for'] ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, opacity: 0.8 }}>
          Showing up to 800 rows. Refine filters to narrow results.
        </div>
      </div>
    </div>
  )
}
