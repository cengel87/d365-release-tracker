import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

export function Dashboard({ metrics, upcomingByMonth, byWaveMonth, fetchedAt, sourceUrl }: {
  metrics: { total: number; ga: number; preview: number; early: number; planned: number; upcoming: number }
  upcomingByMonth: { label: string; count: number; highImpact: number }[]
  byWaveMonth: { rows: any[]; waves: string[] }
  fetchedAt: string
  sourceUrl: string
}) {
  return (
    <div className="grid">
      <div className="metrics">
        <div className="metric"><div className="k">Total</div><div className="v">{metrics.total.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🟢 GA</div><div className="v">{metrics.ga.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🔵 Preview</div><div className="v">{metrics.preview.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🟣 Early Access</div><div className="v">{metrics.early.toLocaleString()}</div></div>
        <div className="metric"><div className="k">⚪ Planned</div><div className="v">{metrics.planned.toLocaleString()}</div></div>
        <div className="metric"><div className="k">🔜 Upcoming (GA)</div><div className="v">{metrics.upcoming.toLocaleString()}</div></div>
      </div>

      <div className="grid grid2">
        <div className="card">
          <h3>Upcoming GA features by month (next 18 months)</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={upcomingByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" interval={2} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" name="All upcoming GA" />
                <Bar dataKey="highImpact" name="High-impact (watchlist)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 10, color: 'var(--muted)', fontSize: 12 }}>
            Data fetched: {fetchedAt}. Source:{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">Microsoft Release Plans API</a>
          </div>
        </div>

        <div className="card">
          <h3>Release Wave “channel” → monthly GA volume</h3>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byWaveMonth.rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" interval={2} />
                <YAxis />
                <Tooltip />
                <Legend />
                {byWaveMonth.waves.slice(0, 6).map((w) => (
                  <Bar key={w} dataKey={w} stackId="a" name={w} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            Stacked by <b>Release Wave</b>. If you have many waves, we show the first 6 to keep it readable.
          </div>
        </div>
      </div>
    </div>
  )
}
