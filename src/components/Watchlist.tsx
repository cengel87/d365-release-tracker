import React, { useMemo, useState } from 'react'
import type { AnalysisStatus, EnrichedFeature, Note, WatchlistItem } from '../types'
import { analysisStatusEmoji, fmtDate, statusEmoji } from '../logic'
import { api } from '../api'
import { Pill } from './Pill'
import { toCsv, download } from '../utils/csv'

type SortKey = 'analysisStatus' | 'impact' | 'flaggedFor' | 'status' | 'product' | 'feature' | 'wave' | 'ga' | 'enabledFor'

const IMPACT_OPTIONS: Array<WatchlistItem['impact'] | null> = [null, '🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review']
const ANALYSIS_OPTIONS: Array<AnalysisStatus | null> = [null, 'In Progress', 'Reviewed', 'Not Applicable']

export function Watchlist(props: {
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

  const [exporting, setExporting] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => ({
    key: 'ga',
    dir: 'asc',
  }))
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisStatus | null>(null)
  const [impactFilter, setImpactFilter] = useState<WatchlistItem['impact'] | null>(null)

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
    return sortedJoined.filter(({ w }) => {
      if (analysisFilter && w.analysis_status !== analysisFilter) return false
      if (impactFilter && w.impact !== impactFilter) return false
      return true
    })
  }, [sortedJoined, analysisFilter, impactFilter])

  return (
    <div className="grid">
      <div className="card fullwidth-table">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Team watchlist</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Shared across the team via Supabase</div>
          </div>
          <Pill kind="info">{filteredJoined.length} tracked</Pill>
        </div>

        {/* Filter pills */}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 60 }}>Analysis:</span>
            {ANALYSIS_OPTIONS.map(v => (
              <span
                key={v ?? '__all'}
                className={`pill btn${analysisFilter === v ? ' active' : ''}`}
                onClick={() => setAnalysisFilter(v)}
              >
                {v === null ? 'All' : `${analysisStatusEmoji(v)} ${v}`}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 60 }}>Impact:</span>
            {IMPACT_OPTIONS.map(v => (
              <span
                key={v ?? '__all'}
                className={`pill btn${impactFilter === v ? ' active' : ''}`}
                onClick={() => setImpactFilter(v)}
              >
                {v === null ? 'All' : v}
              </span>
            ))}
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
                    <td>{statusEmoji(ff.status)}</td>
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
          <button className="btn secondary" disabled={exporting} onClick={async () => {
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
              const rows = filteredJoined.map(({ w, f }) => {
                const notes = notesByFeature.get(w.release_plan_id) ?? []
                const notesStr = notes.map(n => `[${n.author_name}] ${n.content}`).join(' | ')
                return {
                  analysis_status: w.analysis_status ?? 'In Progress',
                  impact: w.impact,
                  flagged_for: w.flagged_for || '',
                  status: f!.status,
                  product: f!['Product name'],
                  feature: f!['Feature name'],
                  wave: f!.releaseWave ?? '',
                  early_access: fmtDate(f!.earlyAccessDate),
                  preview: fmtDate(f!.previewDate),
                  ga: fmtDate(f!.gaDate),
                  enabled_for: String(f!['Enabled for'] ?? ''),
                  notes: notesStr,
                  release_plan_id: w.release_plan_id,
                  ms_link: f!.msLink ?? '',
                }
              })
              const csv = toCsv(rows)
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
