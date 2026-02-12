import React, { useMemo } from 'react'
import type { EnrichedFeature, WatchlistItem } from '../types'
import { fmtDate, statusEmoji } from '../logic'
import { Pill } from './Pill'
import { toCsv, download } from '../utils/csv'

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
