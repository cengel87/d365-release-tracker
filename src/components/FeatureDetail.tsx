import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { EnrichedFeature, WatchlistItem } from '../types'
import { fmtDate, statusEmoji } from '../logic'
import { stripHtml } from '../utils/text'
import { Pill } from './Pill'

const IMPACT_OPTIONS: WatchlistItem['impact'][] = ['🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review'].filter(
  (v, i, a) => a.indexOf(v) === i
) as any

export function FeatureDetail({ feature, watched, onToggleWatch, showImpact, identityName, impact, onSetImpact, hideHeader }: {
  feature: EnrichedFeature
  watched: boolean
  onToggleWatch: () => void
  showImpact: boolean
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact']) => void
  hideHeader?: boolean
}) {
  const id = feature['Release Plan ID']
  const notesQ = useQuery({
    queryKey: ['notes', id],
    queryFn: () => api.listNotes(id),
    enabled: Boolean(id),
  })
  const qc = useQueryClient()
  const addNoteMut = useMutation({
    mutationFn: api.addNote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', id] }),
  })

  const [note, setNote] = useState('')

  return (
    <>
      {!hideHeader && (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {statusEmoji(feature.status)} {feature['Feature name']}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>
              {feature['Product name']} · {feature.releaseWave ?? 'TBD'} · {String(feature['Enabled for'] ?? '')}
            </div>
            <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 12 }}>
              EA: {fmtDate(feature.earlyAccessDate)} · Preview: {fmtDate(feature.previewDate)} · GA: {fmtDate(feature.gaDate)}
              {feature.daysToGA !== null && feature.gaDate ? ` · ${feature.daysToGA > 0 ? `${feature.daysToGA}d` : feature.daysToGA < 0 ? `${Math.abs(feature.daysToGA)}d ago` : 'today'}` : ''}
            </div>
          </div>
          <div className="row">
            <button className={`btn small ${watched ? 'danger' : ''}`} onClick={onToggleWatch}>
              {watched ? 'Remove' : 'Add to watchlist'}
            </button>
            {feature.msLink && <a className="btn small" href={feature.msLink} target="_blank" rel="noreferrer">View on Microsoft</a>}
          </div>
        </div>
      )}

      {showImpact && onSetImpact && (
        <div className="row" style={{ marginTop: 10 }}>
          <Pill kind="info">Impact assessment</Pill>
          <select value={impact ?? '🚩 To Review'} onChange={(e) => onSetImpact(e.target.value as any)}>
            {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      )}

      <hr />

      <div className="grid grid2">
        <div className="card" style={{ padding: 14 }}>
          <h3>Business value</h3>
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 13 }}>
            {stripHtml(String(feature['Business value'] ?? '').trim()) || '—'}
          </div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <h3>Feature details</h3>
          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 13 }}>
            {stripHtml(String(feature['Feature details'] ?? '').trim()) || '—'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Team notes</h3>
        {notesQ.isLoading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading notes…</div>}
        {notesQ.isError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Failed to load notes.</div>}
        {notesQ.data && notesQ.data.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No notes yet.</div>}
        {notesQ.data && notesQ.data.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {notesQ.data.slice(0, 10).map(n => (
              <div key={n.id} className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  <b style={{ color: 'var(--text-secondary)' }}>{n.author_name}</b> · {n.created_at.slice(0, 10)}
                </div>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{n.content}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note… (keep it actionable)" />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="badge">Posting as: {identityName || 'Guest'}</span>
            <button
              className="btn"
              disabled={!note.trim() || addNoteMut.isPending}
              onClick={() => {
                addNoteMut.mutate({ release_plan_id: id, author_name: identityName || 'Guest', content: note.trim() })
                setNote('')
              }}
            >
              {addNoteMut.isPending ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Raw JSON (Microsoft feed)</h3>
        <pre>{JSON.stringify(feature, null, 2)}</pre>
      </div>
    </>
  )
}
