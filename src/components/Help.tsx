import React from 'react'
import { Pill } from './Pill'

export function Help({ fetchedAt, sourceUrl }: { fetchedAt: string, sourceUrl: string }) {
  return (
    <div className="grid">

      {/* ── Quick start ── */}
      <div className="card">
        <h3>Quick start</h3>
        <ol style={{ marginTop: 8, paddingLeft: 20, lineHeight: 1.8 }}>
          <li><b>Browse</b> — go to the <b>Features</b> tab and filter by status, product, wave, or keyword to find what's relevant to your team.</li>
          <li><b>Investigate</b> — click any row to open the detail panel; read the business value, feature details, and Microsoft's original description.</li>
          <li><b>Track it</b> — add the feature to the <b>Watchlist</b>, set an impact level and "Flagged for" field, then add team notes so context is shared.</li>
          <li><b>Stay current</b> — check the <b>Changes</b> tab after each refresh to see what Microsoft has updated (new dates, status changes, removals).</li>
        </ol>
      </div>

      {/* ── Status legend ── */}
      <div className="card">
        <h3>Status legend</h3>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <Pill kind="ok">Generally Available</Pill>
          <Pill kind="info">Public Preview</Pill>
          <Pill kind="ea">Early Access</Pill>
          <Pill kind="muted">Planned</Pill>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 10 }}>
          Short codes used in tables: <b>GA</b> · <b>PP</b> (Public Preview) · <b>EA</b> (Early Access) · <b>PL</b> (Planned)
        </p>
      </div>

      {/* ── Features tab ── */}
      <div className="card">
        <h3>Features tab</h3>
        <ul style={{ marginTop: 8, lineHeight: 1.8 }}>
          <li><b>Search</b> — keyword filter matches feature name and description.</li>
          <li><b>Filters</b> — narrow by Status, Product, Release Wave, or Enablement type.</li>
          <li><b>GA date range</b> — set a "from" and "to" date to focus on a specific delivery window.</li>
          <li><b>Hide done</b> — toggle to hide watchlist items marked <i>Reviewed</i> or <i>Not Applicable</i>.</li>
          <li><b>Sortable columns</b> — click any column header to sort ▲ / ▼; click again to reverse.</li>
          <li>Up to <b>800 features</b> are shown per load.</li>
        </ul>
      </div>

      {/* ── Watchlist & feature detail ── */}
      <div className="card">
        <h3>Watchlist &amp; feature detail</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          The watchlist is <b>shared across the team</b> via Supabase — everyone sees the same impact, flags, and notes.
        </p>

        <h4 style={{ marginTop: 12 }}>Impact</h4>
        <ul style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>🔴 <b>Mitigation Required</b> — Feature is used in MDC and is deprecated, removed, or fundamentally changed. Requires proactive mitigation or re-engineering. Likely impacts development and/or change management.</li>
          <li>🟡 <b>Minor Impact</b> — Feature is used in MDC and will continue to work mostly as-is. Introduces small behavioral, UI, naming, or configuration changes. May require light development effort or change management.</li>
          <li>🟢 <b>No Impact</b> — Feature is used in MDC but continues to work without impact, has an optional alternate, or is a new feature not currently used that may enhance MDC. No mandatory development or mitigation required.</li>
          <li>🚩 <b>To Review</b> — Not yet assessed. Default for newly added watchlist items.</li>
        </ul>

        <h4 style={{ marginTop: 12 }}>Flagged for</h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Business · Tech Team · Both · BTA Only
        </p>

        <h4 style={{ marginTop: 12 }}>Analysis status</h4>
        <ul style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>🔶 <b>In Progress</b> — default for new items; actively being assessed.</li>
          <li>✅ <b>Reviewed</b> — assessment complete. "Hide done" removes these from the Features tab.</li>
          <li>🚫 <b>Not Applicable</b> — confirmed irrelevant. Also hidden by "Hide done".</li>
        </ul>

        <h4 style={{ marginTop: 12 }}>Tips</h4>
        <ul style={{ fontSize: 13, lineHeight: 1.8 }}>
          <li>Team notes include author name and date — enter your name on the identity prompt to attribute notes.</li>
          <li>Press <kbd style={{ background: 'var(--panel2)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--border)' }}>Esc</kbd> to close the detail panel.</li>
          <li><b>Download watchlist CSV</b> (bottom of Watchlist tab) exports all fields, notes, and MS links.</li>
        </ul>
      </div>

      {/* ── Changes tab ── */}
      <div className="card">
        <h3>Changes tab</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Each time you refresh the feed, the app stores a snapshot and diffs it against the previous one. Change types:
        </p>
        <ul style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
          <li><code>new_feature</code> — feature newly appeared in the Microsoft feed.</li>
          <li><code>date_change</code> — GA, preview, or early-access date was updated.</li>
          <li><code>status_change</code> — availability status changed (e.g. Planned → GA).</li>
          <li><code>description_change</code> — business value or feature details text was edited.</li>
          <li><code>wave_change</code> — release wave identifier changed.</li>
          <li><code>removed</code> — feature is no longer present in the feed.</li>
        </ul>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>
          Use the time-window filter (last <b>7</b> · <b>14</b> · <b>30</b> days) to scope the view. Click a row to expand individual change details and verify on Microsoft's site.
        </p>
      </div>

      {/* ── Dashboard ── */}
      <div className="card">
        <h3>Dashboard</h3>
        <ul style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>
          <li><b>GA Timeline</b> — bar chart of upcoming GA features by month (next 12 months) with a cumulative delivery line.</li>
          <li><b>GA by Release Wave</b> — stacked bar showing how many GAs fall in each release wave.</li>
          <li><b>Public Preview Pipeline</b> — features currently entering preview stage.</li>
          <li><b>Early Access Pipeline</b> — features currently in early access.</li>
          <li><b>Year outlook</b> — delivery pace, peak months, and 3 / 6-month GA forecasts.</li>
        </ul>
      </div>

      {/* ── Data & disclaimer ── */}
      <div className="card">
        <h3>Data source</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          Fetched: {fetchedAt}.{' '}
          Source:{' '}
          <a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a>
        </p>
        <p style={{ color: 'var(--muted)', marginTop: 8, fontSize: 13 }}>
          Microsoft warns delivery timelines can change and features may be delayed or removed; always verify critical items on the official site.
        </p>
        <hr />
        <h3>Important changes &amp; deprecations</h3>
        <a href="https://learn.microsoft.com/en-us/power-platform/important-changes-coming" target="_blank" rel="noreferrer">
          Power Platform — Important changes &amp; deprecations
        </a>
      </div>

    </div>
  )
}
