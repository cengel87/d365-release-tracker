import React, { useMemo, useState } from 'react'
import type { AnalysisStatus, EnrichedFeature, FlaggedFor, Note, WatchlistItem } from '../types'
import { analysisStatusEmoji, fmtDate, statusEmoji, statusShort } from '../logic'
import { api } from '../api'
import { Pill } from './Pill'
import { toCsv, download } from '../utils/csv'

type SortKey = 'analysisStatus' | 'impact' | 'flaggedFor' | 'status' | 'product' | 'feature' | 'wave' | 'ga' | 'enabledFor'

export function Watchlist(props: {
  all: EnrichedFeature[]
  watch: WatchlistItem[]
  onOpenDetail: (id: string) => void
  waves: string[]
  products: string[]
  enablements: string[]
}) {
  const { all, watch, onOpenDetail, waves, products, enablements } = props

  const joined = useMemo(() => {
    const byId = new Map(all.map(f => [f['Release Plan ID'], f] as const))
    return watch
      .map(w => ({ w, f: byId.get(w.release_plan_id) }))
      .filter(x => Boolean(x.f))
  }, [all, watch])

  const [exporting, setExporting] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => ({
    key: 'ga',
    dir: 'asc',
  }))
  const [search, setSearch] = useState('')
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisStatus | ''>('')
  const [impactFilter, setImpactFilter] = useState<WatchlistItem['impact'] | ''>('')
  const [flaggedForFilter, setFlaggedForFilter] = useState<FlaggedFor | '__all'>('__all')
  const [waveFilter, setWaveFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<EnrichedFeature['status'] | ''>('')
  const [gaStart, setGaStart] = useState<string>('')
  const [gaEnd, setGaEnd] = useState<string>('')

  const toggleSort = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    else setSort({ key, dir: 'asc' })
  }

  const arrow = (key: SortKey) => {
    if (sort.key !== key) return ''
    return sort.dir === 'asc' ? ' ▲' : ' ▼'
  }

  const sortedJoined = useMemo(() => {
    const arr = [...joined]
    const dir = sort.dir === 'asc' ? 1 : -1

    const impactRank = (impact: WatchlistItem['impact'] | string | undefined) => {
      const m: Record<string, number> = {
        '🔴 High': 0,
        '🟡 Medium': 1,
        '🟢 Low': 2,
        '🚩 To Review': 3,
      }
      return m[String(impact ?? '')] ?? 99
    }

    const analysisRank = (s: AnalysisStatus | string | undefined) => {
      const m: Record<string, number> = {
        'In Progress': 0,
        'Reviewed': 1,
        'Not Applicable': 2,
      }
      return m[String(s ?? '')] ?? 99
    }

    const getVal = (row: { w: WatchlistItem; f: EnrichedFeature | undefined }) => {
      const ff = row.f!
      switch (sort.key) {
        case 'analysisStatus': return analysisRank(row.w.analysis_status)
        case 'impact': return impactRank(row.w.impact)
        case 'flaggedFor': return String(row.w.flagged_for ?? '')
        case 'status': return String(ff.status ?? '')
        case 'product': return String(ff['Product name'] ?? '')
        case 'feature': return String(ff['Feature name'] ?? '')
        case 'wave': return String(ff.releaseWave ?? '')
        case 'ga': return ff.gaDate ? ff.gaDate.getTime() : Number.POSITIVE_INFINITY
        case 'enabledFor': return String(ff['Enabled for'] ?? '')
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
  }, [joined, sort])

  const filteredJoined = useMemo(() => {
    const s = search.trim().toLowerCase()
    const gaStartDate = gaStart ? new Date(gaStart + 'T00:00:00') : null
    const gaEndDate = gaEnd ? new Date(gaEnd + 'T00:00:00') : null
    return sortedJoined.filter(({ w, f }) => {
      if (analysisFilter && w.analysis_status !== analysisFilter) return false
      if (impactFilter && w.impact !== impactFilter) return false
      if (flaggedForFilter !== '__all' && w.flagged_for !== flaggedForFilter) return false
      if (waveFilter && f?.releaseWave !== waveFilter) return false
      if (productFilter && f?.['Product name'] !== productFilter) return false
      if (statusFilter && f?.status !== statusFilter) return false
      if (gaStartDate && gaEndDate && f) {
        if (!f.gaDate) return false
        if (f.gaDate < gaStartDate || f.gaDate > gaEndDate) return false
      }
      if (s && f) {
        const hay = [f['Feature name'], f['Product name'], f['Business value'], f['Feature details']].map(v => String(v ?? '').toLowerCase()).join(' ')
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [sortedJoined, search, analysisFilter, impactFilter, flaggedForFilter, waveFilter, productFilter, statusFilter, gaStart, gaEnd])

  const hasAnyFilter = search || analysisFilter || impactFilter || flaggedForFilter !== '__all' || waveFilter || productFilter || statusFilter || gaStart || gaEnd

  return (
    <div className="grid">
      <div className="card fullwidth-table">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Team watchlist</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Shared across the team via Supabase</div>
          </div>
          <div className="row">
            <Pill kind="info">{filteredJoined.length} tracked</Pill>
            {hasAnyFilter && (
              <button
                className="btn secondary small"
                onClick={() => {
                  setSearch(''); setAnalysisFilter(''); setImpactFilter('');
                  setFlaggedForFilter('__all'); setWaveFilter(''); setProductFilter('');
                  setStatusFilter(''); setGaStart(''); setGaEnd('')
                }}
              >Clear filters</button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <input
            className="input"
            style={{ minWidth: 200 }}
            placeholder="Search keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select value={impactFilter} onChange={e => setImpactFilter(e.target.value as any)}>
            <option value="">All impacts</option>
            <option value="🔴 High">🔴 High</option>
            <option value="🟡 Medium">🟡 Medium</option>
            <option value="🟢 Low">🟢 Low</option>
            <option value="🚩 To Review">🚩 To Review</option>
          </select>

          <select value={analysisFilter} onChange={e => setAnalysisFilter(e.target.value as any)}>
            <option value="">All analysis</option>
            <option value="In Progress">🔶 In Progress</option>
            <option value="Reviewed">✅ Reviewed</option>
            <option value="Not Applicable">🚫 Not Applicable</option>
          </select>

          <select value={flaggedForFilter} onChange={e => setFlaggedForFilter(e.target.value as any)}>
            <option value="__all">All teams</option>
            <option value="Business">Business</option>
            <option value="Tech Team">Tech Team</option>
            <option value="Both">Both</option>
            <option value="BTA Only">BTA Only</option>
            <option value="">Unflagged</option>
          </select>

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">All statuses</option>
            <option value="Generally Available">🟢 Generally Available</option>
            <option value="Public Preview">🔵 Public Preview</option>
            <option value="Early Access">🟣 Early Access</option>
            <option value="Planned">⚪ Planned</option>
          </select>

          <select value={productFilter} onChange={e => setProductFilter(e.target.value)}>
            <option value="">All products</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select value={waveFilter} onChange={e => setWaveFilter(e.target.value)}>
            <option value="">All waves</option>
            {waves.map(w => <option key={w} value={w}>{w}</option>)}
          </select>

          <div className="field">
            <span className="label">GA Date Range</span>
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                type="date"
                value={gaStart}
                onChange={e => setGaStart(e.target.value)}
                title="GA start date"
              />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
              <input
                className="input"
                type="date"
                value={gaEnd}
                onChange={e => setGaEnd(e.target.value)}
                title="GA end date"
              />
            </div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="watchlist-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => toggleSort('analysisStatus')} title="Analysis status">🔍{arrow('analysisStatus')}</th>
                <th className="sortable" onClick={() => toggleSort('impact')}>Impact{arrow('impact')}</th>
                <th className="sortable" onClick={() => toggleSort('flaggedFor')}>Flagged for{arrow('flaggedFor')}</th>
                <th className="sortable" onClick={() => toggleSort('status')}>Status{arrow('status')}</th>
                <th className="sortable" onClick={() => toggleSort('product')}>Product{arrow('product')}</th>
                <th className="sortable" onClick={() => toggleSort('feature')}>Feature{arrow('feature')}</th>
                <th className="sortable" onClick={() => toggleSort('wave')}>Wave{arrow('wave')}</th>
                <th className="sortable" onClick={() => toggleSort('ga')}>GA{arrow('ga')}</th>
                <th className="sortable" onClick={() => toggleSort('enabledFor')}>Enabled for{arrow('enabledFor')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredJoined.map(({ w, f }) => {
                const ff = f!
                return (
                  <tr
                    key={w.release_plan_id}
                    onClick={() => onOpenDetail(w.release_plan_id)}
                    style={{ cursor: 'pointer' }}
                    className="row-clickable"
                  >
                    <td title={w.analysis_status ?? 'In Progress'}>{analysisStatusEmoji(w.analysis_status ?? 'In Progress')}</td>
                    <td>{w.impact}</td>
                    <td>{w.flagged_for || '—'}</td>
                    <td>{statusEmoji(ff.status)} {statusShort(ff.status)}</td>
                    <td>{ff['Product name']}</td>
                    <td>{ff['Feature name']}</td>
                    <td>{ff.releaseWave ?? 'TBD'}</td>
                    <td>{fmtDate(ff.gaDate)}</td>
                    <td>{String(ff['Enabled for'] ?? '')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginTop: 14 }}>
          <h3>Export</h3>
          <button className="btn secondary small" disabled={exporting} onClick={async () => {
            setExporting(true)
            try {
              const ids = filteredJoined.map(({ w }) => w.release_plan_id)
              const allNotes = ids.length > 0 ? await api.listNotesBulk(ids) : []
              const notesByFeature = new Map<string, Note[]>()
              for (const n of allNotes) {
                const arr = notesByFeature.get(n.release_plan_id) ?? []
                arr.push(n)
                notesByFeature.set(n.release_plan_id, arr)
              }
              const stripEmoji = (s: string) => s.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]+\s*/u, '')
              const cleanText = (s: string | null | undefined) => String(s ?? '').replace(/\r?\n/g, ' ').trim()
              const rows = filteredJoined.map(({ w, f }) => {
                const ff = f!
                const notes = notesByFeature.get(w.release_plan_id) ?? []
                const notesStr = notes
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(n => {
                    const date = new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    return `${n.author_name} (${date}): ${n.content.replace(/\r?\n/g, ' ')}`
                  })
                  .join('\n')
                return {
                  product: ff['Product name'],
                  feature: ff['Feature name'],
                  ms_link: ff.msLink ?? '',
                  business_value: cleanText(ff['Business value']),
                  feature_details: cleanText(ff['Feature details']),
                  wave: ff.releaseWave ?? '',
                  early_access: fmtDate(ff.earlyAccessDate),
                  preview: fmtDate(ff.previewDate),
                  ga: fmtDate(ff.gaDate),
                  enabled_for: String(ff['Enabled for'] ?? ''),
                  impact: stripEmoji(w.impact),
                  flagged_for: w.flagged_for || '',
                  analysis_status: w.analysis_status ?? 'In Progress',
                  notes: notesStr,
                }
              })
              const columns = [
                { key: 'product', label: 'Product' },
                { key: 'feature', label: 'Feature' },
                { key: 'ms_link', label: 'MS Link' },
                { key: 'business_value', label: 'Business Value' },
                { key: 'feature_details', label: 'Feature Details' },
                { key: 'wave', label: 'Wave' },
                { key: 'early_access', label: 'Early Access' },
                { key: 'preview', label: 'Public Preview' },
                { key: 'ga', label: 'GA Date' },
                { key: 'enabled_for', label: 'Enabled For' },
                { key: 'impact', label: 'Impact' },
                { key: 'flagged_for', label: 'Flagged For' },
                { key: 'analysis_status', label: 'Analysis Status' },
                { key: 'notes', label: 'Notes' },
              ]
              const csv = toCsv(rows, columns)
              download(`watchlist_${new Date().toISOString().slice(0, 10)}.csv`, csv)
            } catch (e) {
              console.error('CSV export failed', e)
            } finally {
              setExporting(false)
            }
          }}>
            {exporting ? 'Exporting…' : 'Download watchlist CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
