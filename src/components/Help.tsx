import React from 'react'
import { Pill } from './Pill'

export function Help({ fetchedAt, sourceUrl }: { fetchedAt: string, sourceUrl: string }) {
  return (
    <div className="grid">
      <div className="card">
        <h3>What this app does</h3>
        <ul style={{ marginTop: 8 }}>
          <li><b>Microsoft feed</b> (proxy via Netlify function) + direct "View on Microsoft" link per feature.</li>
          <li><b>Watchlist + Impact assessment</b> (team shared) + <b>notes</b>.</li>
          <li><b>Meaningful charts</b>: upcoming GA by month + release-wave "channel" view.</li>
          <li><b>Change detection</b>: on-demand refresh stores snapshots and logs changes.</li>
          <li><b>Raw JSON</b> shown for transparency and troubleshooting.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Status legend</h3>
        <div className="row" style={{ gap: 10 }}>
          <Pill kind="ok">Generally Available</Pill>
          <Pill kind="info">Public Preview</Pill>
          <Pill kind="info">Early Access</Pill>
          <Pill kind="muted">Planned</Pill>
        </div>
        <hr />
        <h3>Data source</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Fetched: {fetchedAt}.
          Source:{' '}
          <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a>
        </p>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>
          Microsoft warns delivery timelines can change and features may be delayed or removed; always verify critical items on the official site.
        </p>
        <hr />
        <h3>Important changes</h3>
        <a href="https://learn.microsoft.com/en-us/power-platform/important-changes-coming" target="_blank" rel="noreferrer">
          Power Platform — Important changes & deprecations
        </a>
      </div>
    </div>
  )
}
