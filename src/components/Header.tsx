import React from 'react'

export function Header(props: {
  identityName: string
  onEditName: () => void
  refreshing: boolean
  onRefresh: () => void
}) {
  const { identityName, onEditName, refreshing, onRefresh } = props

  return (
    <div className="header">
      <div className="h-title">
        🚀 D365 & Power Platform Release Tracker <span className="badge">Netlify + Supabase</span>
      </div>
      <div className="row">
        <span className="badge">👤 {identityName || 'Guest'}</span>
        <button className="btn secondary small" onClick={onEditName}>Edit name</button>
        <button className="btn small" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? 'Refreshing…' : '🔄 Refresh & detect changes'}
        </button>
      </div>
    </div>
  )
}
