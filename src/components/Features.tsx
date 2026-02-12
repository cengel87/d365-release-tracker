import React from 'react'
import type { EnrichedFeature } from '../types'
import { fmtDate, statusEmoji } from '../logic'
import { Pill } from './Pill'

export function Features(props: {
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

            {/* GA date range */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium"><code>   GA Date Range:   </code></label>

              <input
                className="input"
                type="date"
                value={filters.gaStart ? new Date(filters.gaStart).toISOString().slice(0, 10) : ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    gaStart: e.target.value
                      ? new Date(e.target.value + 'T00:00:00')
                      : null,
                  })
                }
                title="GA start date"
              />

              <input
                className="input"
                type="date"
                value={filters.gaEnd ? new Date(filters.gaEnd).toISOString().slice(0, 10) : ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    gaEnd: e.target.value
                      ? new Date(e.target.value + 'T00:00:00')
                      : null,
                  })
                }
                title="GA end date"
              />
            </div>

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
                    <td title={`${f.status}`}>{statusEmoji(f.status)}</td>
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

        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
          Showing up to 800 rows for performance. Refine filters to narrow down.
        </div>
      </div>
    </div>
  )
}
