import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Pill } from './Pill'
import { labelChangeType } from '../utils/changes'
import { buildMsVerifyLink } from '../utils/msLinks'
import { short } from '../utils/text'

export function Changes() {
  const [days, setDays] = useState(14)
  const q = useQuery({ queryKey: ['changes', days], queryFn: () => api.listChanges(days) })

  const groups = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of (q.data ?? [])) m.set(c.change_type, (m.get(c.change_type) ?? 0) + 1)
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [q.data])

  const chartData = useMemo(() => {
    const items = q.data ?? []
    const byDay = new Map<string, number>()
    for (const c of items) {
      const day = c.detected_at.slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    return Array.from(byDay.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day))
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
            <select value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>Changes per day</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" interval={2} />
                <YAxis />
                <Tooltip />
                <Line dataKey="count" name="Changes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Summary</h3>
          {groups.length === 0 && <div style={{ color: 'var(--muted)' }}>No changes found in this period.</div>}
          {groups.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {groups.map(([t, c]) => (
                <div key={t} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{labelChangeType(t)}</span>
                  <Pill kind="info">{c}</Pill>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Recent changes</h3>
        {q.isLoading && <div style={{ color: 'var(--muted)' }}>Loading…</div>}
        {q.isError && <div style={{ color: 'var(--muted)' }}>Failed: {String(q.error)}</div>}
        {q.data && q.data.length === 0 && <div style={{ color: 'var(--muted)' }}>No changes in this period.</div>}
        {q.data && q.data.length > 0 && (
          <div style={{ display: 'grid', gap: 10 }}>
            {q.data.slice(0, 60).map(c => (
              <div key={c.id} className="card" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 800 }}>{labelChangeType(c.change_type)} · {c.feature_name}</div>
                  <span className="badge">{c.detected_at.slice(0, 16).replace('T', ' ')}</span>
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>{c.product_name} · ID: {c.release_plan_id}</div>
                {c.field_changed && (
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <b>{c.field_changed}:</b> {short(c.old_value)} → {short(c.new_value)}
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <a className="btn small" href={buildMsVerifyLink(c.product_name, c.feature_name)} target="_blank" rel="noreferrer">
                    🔗 Verify on Microsoft
                  </a>
                </div>
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>Raw JSON</summary>
                  <pre>{JSON.stringify(c, null, 2)}</pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
