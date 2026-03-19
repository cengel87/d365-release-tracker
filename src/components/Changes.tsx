import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import type { ChangeLogItem, EnrichedFeature, WatchlistItem } from '../types'
import { analysisStatusEmoji } from '../logic'
import { Pill } from './Pill'
import { labelChangeType } from '../utils/changes'
import { buildMsVerifyLink } from '../utils/msLinks'
import { wordDiff } from '../utils/diff'

type FeatureChangeGroup = {
  release_plan_id: string
  feature_name: string
  product_name: string
  latest_detected: string
  changes: ChangeLogItem[]
  changeTypes: string[]
}

type SortKey = 'detected_at' | 'change_type' | 'product_name' | 'feature_name' | 'changes'

export function Changes({ watchIds, watchItems, waves, allFeatures }: { watchIds: Set<string>; watchItems: WatchlistItem[]; waves: string[]; allFeatures: EnrichedFeature[] }) {
  const watchMap = useMemo(() => new Map(watchItems.map(w => [w.release_plan_id, w])), [watchItems])
  const waveMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of allFeatures) {
      if (f.releaseWave) m.set(f['Release Plan ID'], f.releaseWave)
    }
    return m
  }, [allFeatures])
  const [days, setDays] = useState(14)
  const q = useQuery({ queryKey: ['changes', days], queryFn: () => api.listChanges(days) })

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => ({
    key: 'detected_at',
    dir: 'desc',
  }))

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [changeTypeFilter, setChangeTypeFilter] = useState<string | null>(null)
  const [waveFilter, setWaveFilter] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSort = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    else setSort({ key, dir: 'asc' })
  }

  const arrow = (key: SortKey) => {
    if (sort.key !== key) return ''
    return sort.dir === 'asc' ? ' ▲' : ' ▼'
  }

  // Group raw changes by release_plan_id
  const groups = useMemo(() => {
    const items = q.data ?? []
    const map = new Map<string, FeatureChangeGroup>()

    for (const c of items) {
      const id = c.release_plan_id
      const prev = map.get(id)
      if (prev) {
        prev.changes.push(c)
        if (c.detected_at > prev.latest_detected) prev.latest_detected = c.detected_at
        if (!prev.changeTypes.includes(c.change_type)) prev.changeTypes.push(c.change_type)
      } else {
        map.set(id, {
          release_plan_id: id,
          feature_name: c.feature_name,
          product_name: c.product_name,
          latest_detected: c.detected_at,
          changes: [c],
          changeTypes: [c.change_type],
        })
      }
    }

    // Sort individual changes within each group by detected_at descending
    for (const g of map.values()) {
      g.changes.sort((a, b) => (b.detected_at ?? '').localeCompare(a.detected_at ?? ''))
    }

    return Array.from(map.values())
  }, [q.data])

  // Sort groups
  const sorted = useMemo(() => {
    const arr = [...groups]
    const dir = sort.dir === 'asc' ? 1 : -1

    const getVal = (g: FeatureChangeGroup) => {
      switch (sort.key) {
        case 'detected_at': return g.latest_detected
        case 'product_name': return g.product_name
        case 'feature_name': return g.feature_name
        case 'change_type': return g.changeTypes.length
        case 'changes': return g.changes.length
        default: return ''
      }
    }

    arr.sort((a, b) => {
      const av = getVal(a)
      const bv = getVal(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir
    })

    return arr
  }, [groups, sort])

  // Filter groups by change type and wave
  const filtered = useMemo(() => {
    let result = sorted
    if (changeTypeFilter) result = result.filter(g => g.changeTypes.includes(changeTypeFilter))
    if (waveFilter) result = result.filter(g => waveMap.get(g.release_plan_id) === waveFilter)
    return result
  }, [sorted, changeTypeFilter, waveFilter, waveMap])

  // Summary stats
  const summary = useMemo(() => {
    const rawTotal = (q.data ?? []).length
    const m = new Map<string, number>()
    for (const c of (q.data ?? [])) m.set(c.change_type, (m.get(c.change_type) ?? 0) + 1)
    const top = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
    return { rawTotal, featureCount: groups.length, top }
  }, [q.data, groups])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Change feed</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Auto-detected on demand via Refresh.</div>
          </div>
          <div className="row">
            <Pill kind="muted">{summary.featureCount.toLocaleString()} feature{summary.featureCount !== 1 ? 's' : ''}</Pill>
            <Pill kind="muted">{summary.rawTotal.toLocaleString()} change{summary.rawTotal !== 1 ? 's' : ''}</Pill>
            <span
              className={`pill btn${changeTypeFilter === null ? ' active' : ''}`}
              onClick={() => setChangeTypeFilter(null)}
            >All</span>
            {summary.top.map(([t, c]) => (
              <span
                key={t}
                className={`pill info btn${changeTypeFilter === t ? ' active' : ''}`}
                onClick={() => setChangeTypeFilter(prev => prev === t ? null : t)}
              >{labelChangeType(t)}: {c}</span>
            ))}
            <select value={waveFilter ?? ''} onChange={(e) => setWaveFilter(e.target.value || null)}>
              <option value="">All waves</option>
              {waves.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card fullwidth-table">
        <h3>Recent changes</h3>

        {q.isLoading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
        {q.isError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Failed: {String(q.error)}</div>}
        {q.data && q.data.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No changes in this period.</div>}

        {q.data && q.data.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="changes-table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th className="sortable" style={{ width: 150 }} onClick={() => toggleSort('detected_at')}>Detected{arrow('detected_at')}</th>
                  <th className="sortable" style={{ width: 220 }} onClick={() => toggleSort('product_name')}>Product{arrow('product_name')}</th>
                  <th className="sortable" style={{ width: 360 }} onClick={() => toggleSort('feature_name')}>Feature{arrow('feature_name')}</th>
                  <th style={{ width: 40, textAlign: 'center' }} title="Analysis status">🔍</th>
                  <th className="sortable" style={{ width: 90 }} onClick={() => toggleSort('changes')}>Changes{arrow('changes')}</th>
                  <th className="sortable" style={{ width: 220 }} onClick={() => toggleSort('change_type')}>Types{arrow('change_type')}</th>
                  <th style={{ width: 110 }}>Verify</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(g => {
                  const isOpen = expanded.has(g.release_plan_id)
                  const when = g.latest_detected.slice(0, 16).replace('T', ' ')
                  const url = buildMsVerifyLink(g.product_name, g.feature_name)
                  const watchItem = watchMap.get(g.release_plan_id)
                  const isWatched = watchIds.has(g.release_plan_id)

                  return (
                    <React.Fragment key={g.release_plan_id}>
                      {/* Summary row */}
                      <tr className="changes-summary" onClick={() => toggleExpand(g.release_plan_id)}>
                        <td>
                          <span className={`expand-icon${isOpen ? ' open' : ''}`}>▶</span>
                        </td>
                        <td title={g.latest_detected}>{when}</td>
                        <td title={g.product_name}>{g.product_name}</td>
                        <td title={g.feature_name}><b>{g.feature_name}</b></td>
                        <td style={{ textAlign: 'center' }} title={watchItem?.analysis_status ?? ''}>
                          {watchItem ? analysisStatusEmoji(watchItem.analysis_status ?? 'In Progress') : ''}
                        </td>
                        <td>
                          <span className="count-badge">
                            {g.changes.length} change{g.changes.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td>
                          <div className="change-badges">
                            {g.changeTypes.map(t => (
                              <span key={t} className="change-badge">{labelChangeType(t)}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <a
                            className="btn small"
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Verify
                          </a>
                        </td>
                      </tr>

                      {/* Diff panel (when expanded) */}
                      {isOpen && (
                        <tr className="changes-detail-panel">
                          <td colSpan={8} style={{ padding: 0 }}>
                            <div className="diff-panel">
                              {g.changes.map(c => {
                                const detWhen = (c.detected_at ?? '').slice(0, 16).replace('T', ' ')

                                if (c.change_type === 'new_feature' || c.change_type === 'removed') {
                                  return (
                                    <div key={c.id} className="diff-change">
                                      <div className="diff-change-header">
                                        <span className="change-badge">{labelChangeType(c.change_type)}</span>
                                        <span className="diff-timestamp">{detWhen}</span>
                                      </div>
                                      <div className="diff-body-simple">
                                        {c.change_type === 'new_feature' ? 'Feature added to release plan' : 'Feature removed from release plan'}
                                      </div>
                                    </div>
                                  )
                                }

                                const oldVal = c.old_value ?? ''
                                const newVal = c.new_value ?? ''
                                const segments = wordDiff(oldVal, newVal)
                                const isShort = oldVal.length <= 80 && newVal.length <= 80

                                return (
                                  <div key={c.id} className="diff-change">
                                    <div className="diff-change-header">
                                      <span className="change-badge">{labelChangeType(c.change_type)}</span>
                                      <span className="diff-field">{c.field_changed}</span>
                                      <span className="diff-timestamp">{detWhen}</span>
                                    </div>
                                    {isShort ? (
                                      <div className="diff-body-short">
                                        <div className="diff-line-old"><span className="diff-gutter">-</span>{oldVal || '(empty)'}</div>
                                        <div className="diff-line-new"><span className="diff-gutter">+</span>{newVal || '(empty)'}</div>
                                      </div>
                                    ) : (
                                      <div className="diff-body-unified">
                                        {segments.map((seg, i) => (
                                          <span key={i} className={seg.type === 'added' ? 'diff-add' : seg.type === 'removed' ? 'diff-del' : undefined}>
                                            {seg.text}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {(q.data ?? []).length >= 5000 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 10, opacity: 0.8 }}>
            Results capped at 5,000 changes. Narrow the time range or filter by wave for more specific results.
          </div>
        )}
      </div>
    </div>
  )
}
