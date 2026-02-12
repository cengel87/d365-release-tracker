import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Pill } from './Pill'
import { labelChangeType } from '../utils/changes'
import { buildMsVerifyLink } from '../utils/msLinks'
import { short } from '../utils/text'

type SortKey = 'detected_at' | 'change_type' | 'product_name' | 'feature_name' | 'field_changed' | 'release_plan_id'

export function Changes() {
  const [days, setDays] = useState(14)
  const q = useQuery({ queryKey: ['changes', days], queryFn: () => api.listChanges(days) })

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>(() => ({
    key: 'detected_at',
    dir: 'desc',
  }))

  const toggleSort = (key: SortKey) => {
    if (sort.key === key) setSort({ key, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    else setSort({ key, dir: 'asc' })
  }

  const arrow = (key: SortKey) => {
    if (sort.key !== key) return ''
    return sort.dir === 'asc' ? ' ▲' : ' ▼'
  }

  const sorted = useMemo(() => {
    const items = [...(q.data ?? [])]
    const dir = sort.dir === 'asc' ? 1 : -1

    const getVal = (c: any) => {
      switch (sort.key) {
        case 'detected_at': return String(c.detected_at ?? '')
        case 'change_type': return String(c.change_type ?? '')
        case 'product_name': return String(c.product_name ?? '')
        case 'feature_name': return String(c.feature_name ?? '')
        case 'field_changed': return String(c.field_changed ?? '')
        case 'release_plan_id': return String(c.release_plan_id ?? '')
        default: return ''
      }
    }

    items.sort((a, b) => {
      const av = getVal(a)
      const bv = getVal(b)
      return av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' }) * dir
    })

    return items
  }, [q.data, sort])

  const summary = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of (q.data ?? [])) m.set(c.change_type, (m.get(c.change_type) ?? 0) + 1)
    const top = Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4)
    return { total: (q.data ?? []).length, top }
  }, [q.data])

  return (
    <div className="grid">
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>Change feed (auto-detected)</h3>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Runs on demand via “Refresh & detect changes”.</div>
          </div>
          <div className="row">
            <Pill kind="muted">{summary.total.toLocaleString()} items</Pill>
            {summary.top.map(([t, c]) => (
              <Pill key={t} kind="info">{labelChangeType(t)}: {c}</Pill>
            ))}
            <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card fullwidth-table">
        <h3>Recent changes</h3>

        {q.isLoading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
        {q.isError && <div style={{ color: 'var(--muted)' }}>Failed: {String(q.error)}</div>}
        {q.data && q.data.length === 0 && <div style={{ color: 'var(--muted)' }}>No changes in this period.</div>}

        {q.data && q.data.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table className="changes-table" style={{ minWidth: 1200 }}>
              <thead>
                <tr>
                  <th className="sortable" onClick={() => toggleSort('detected_at')}>Detected{arrow('detected_at')}</th>
                  <th className="sortable" onClick={() => toggleSort('change_type')}>Type{arrow('change_type')}</th>
                  <th className="sortable" onClick={() => toggleSort('product_name')}>Product{arrow('product_name')}</th>
                  <th className="sortable" onClick={() => toggleSort('feature_name')}>Feature{arrow('feature_name')}</th>
                  <th className="sortable" onClick={() => toggleSort('field_changed')}>Field{arrow('field_changed')}</th>
                  <th>Change</th>
                  <th className="sortable" onClick={() => toggleSort('release_plan_id')}>Release Plan ID{arrow('release_plan_id')}</th>
                  <th>Verify</th>
                </tr>
              </thead>

              <tbody>
                {sorted.slice(0, 500).map(c => {
                  const when = String(c.detected_at ?? '').slice(0, 16).replace('T', ' ')
                  const type = labelChangeType(c.change_type)
                  const changeText = c.field_changed ? `${short(c.old_value)} → ${short(c.new_value)}` : '—'
                  const url = buildMsVerifyLink(c.product_name, c.feature_name)

                  return (
                    <tr key={c.id} className="row-clickable" style={{ cursor: 'pointer' }} onClick={() => window.open(url, '_blank', 'noreferrer')}>
                      <td title={String(c.detected_at ?? '')}>{when}</td>
                      <td title={String(c.change_type ?? '')}>{type}</td>
                      <td title={String(c.product_name ?? '')}>{c.product_name}</td>
                      <td title={String(c.feature_name ?? '')}><b>{c.feature_name}</b></td>
                      <td title={String(c.field_changed ?? '')}>{c.field_changed ?? '—'}</td>
                      <td title={changeText}>{changeText}</td>
                      <td title={String(c.release_plan_id ?? '')}>{c.release_plan_id}</td>
                      <td>
                        <a className="btn small" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          🔗 Microsoft
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {q.data && q.data.length > 500 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
            Showing up to 500 rows for performance. Narrow the time range if needed.
          </div>
        )}
      </div>
    </div>
  )
}
