import React, { useMemo, useState } from 'react'
import type { EnrichedFeature, WatchlistItem } from '../types'
import { fmtDate, statusEmoji } from '../logic'
import { Pill } from './Pill'
import { toCsv, download } from '../utils/csv'

type SortKey = 'impact' | 'flaggedFor' | 'status' | 'product' | 'feature' | 'wave' | 'ga' | 'enabledFor'

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

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => ({
    key: 'ga',
    dir: 'asc',
  }))

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
      // Higher severity first if sorting asc? We’ll keep emoji order intuitive:
      // High < Medium < Low < To Review (so ascending = more urgent first)
      const m: Record<string, number> = {
        '🔴 High': 0,
        '🟡 Medium': 1,
        '🟢 Low': 2,
        '🚩 To Review': 3,
      }
      return m[String(impact ?? '')] ?? 99
    }

    const getVal = (row: { w: WatchlistItem; f: EnrichedFeature | undefined }) => {
      const ff = row.f!
      switch (sort.key) {
        case 'impact': return impactRank(row.w.impact)
        case 'flaggedFor': return String(row.w.flagged_for ?? '')
        case 'status': return String(ff.status ?? '')
        case 'product': return String(ff['Product name'] ?? '')
        case 'feature': return String(ff['Feature name'] ?? '')
        case 'wave': return String(ff.releaseWave ?? '')
        case 'ga': return ff.gaDate ? ff.gaDate.getTime() : Number.POSITIVE_INFINITY // TBD last
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

  return (
    <div className="grid">
      <div className="card fullwidth-table">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Team watchlist</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Shared across the team via Supabase</div>
          </div>
          <Pill kind="info">{sortedJoined.length} tracked</Pill>
        </div>

        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="watchlist-table">
            <thead>
              <tr>
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
              {sortedJoined.map(({ w, f }) => {
                const ff = f!
                return (
                  <tr
                    key={w.release_plan_id}
                    onClick={() => onOpenDetail(w.release_plan_id)}
                    style={{ cursor: 'pointer' }}
                    className="row-clickable"
                  >
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
          <button className="btn secondary" onClick={() => {
            const rows = sortedJoined.map(({ w, f }) => ({
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
