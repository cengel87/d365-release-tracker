import React from 'react'
import type { Tab } from '../App'

export function Tabs({ tab, setTab }: { tab: Tab, setTab: (t: Tab) => void }) {
  return (
    <div className="tabs">
      {(['Dashboard', 'Features', 'Watchlist', 'Changes', 'Help'] as Tab[]).map(t => (
        <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
      ))}
    </div>
  )
}
