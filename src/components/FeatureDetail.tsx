import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { AnalysisStatus, ChangeLogItem, EnrichedFeature, FlaggedFor, WatchlistItem } from '../types'
import { fmtDate, statusEmoji } from '../logic'
import { stripHtml } from '../utils/text'
import { labelChangeType } from '../utils/changes'
import { Pill } from './Pill'

const IMPACT_OPTIONS: WatchlistItem['impact'][] = ['🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review'].filter(
  (v, i, a) => a.indexOf(v) === i
) as any

const ANALYSIS_STATUS_OPTIONS: AnalysisStatus[] = ['In Progress', 'Reviewed', 'Not Applicable']

const FLAGGED_FOR_OPTIONS: { value: FlaggedFor; label: string }[] = [
  { value: '', label: 'Not set' },
  { value: 'Business', label: 'Business' },
  { value: 'Tech Team', label: 'Tech Team' },
  { value: 'Both', label: 'Both' },
  { value: 'BTA Only', label: 'BTA Only' },
]

function FeatureChangeLog({ featureId }: { featureId: string }) {
  const changesQ = useQuery({
    queryKey: ['featureChanges', featureId],
    queryFn: () => api.listFeatureChanges(featureId),
    enabled: Boolean(featureId),
  })

  const changes = changesQ.data ?? []
  if (changesQ.isLoading) return null
  if (changes.length === 0) return null

  return (
    <details className="collapsible-section" style={{ marginTop: 14 }}>
      <summary className="collapsible-header">
        <span className="collapsible-chevron">▶</span>
        <h3 style={{ margin: 0 }}>Change log</h3>
        <Pill kind="muted">{changes.length}</Pill>
      </summary>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {changes.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13, padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.detected_at.slice(0, 10)}</span>
            <span className="change-badge" style={{ display: 'inline-flex', padding: '2px 6px', borderRadius: 6, fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', whiteSpace: 'nowrap' }}>{labelChangeType(c.change_type)}</span>
            {c.field_changed && <span style={{ color: 'var(--text)', fontWeight: 600 }}>{c.field_changed}</span>}
            {c.old_value != null && c.new_value != null && (
              <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#fca5a5' }}>{c.old_value.slice(0, 60)}{c.old_value.length > 60 ? '…' : ''}</span>
                {' → '}
                <span style={{ color: '#6ee7b7' }}>{c.new_value.slice(0, 60)}{c.new_value.length > 60 ? '…' : ''}</span>
              </span>
            )}
            {c.change_type === 'new_feature' && <span style={{ color: 'var(--ok)' }}>Feature added</span>}
            {c.change_type === 'removed' && <span style={{ color: 'var(--danger)' }}>Feature removed</span>}
          </div>
        ))}
      </div>
    </details>
  )
}

export function FeatureDetail({ feature, watched, onToggleWatch, showImpact, showNotes, identityName, impact, onSetImpact, flaggedFor, onSetFlaggedFor, analysisStatus, onSetAnalysisStatus, hideHeader }: {
  feature: EnrichedFeature
  watched: boolean
  onToggleWatch: () => void
  showImpact: boolean
  showNotes: boolean
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact']) => void
  flaggedFor?: FlaggedFor
  onSetFlaggedFor?: (flaggedFor: FlaggedFor) => void
  analysisStatus?: AnalysisStatus
  onSetAnalysisStatus?: (status: AnalysisStatus) => void
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
        <div className="row" style={{ marginTop: 10, gap: 16, flexWrap: 'wrap' }}>
          <div className="row">
            <Pill kind="info">Impact</Pill>
            <select value={impact ?? '🚩 To Review'} onChange={(e) => onSetImpact(e.target.value as any)}>
              {IMPACT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {onSetFlaggedFor && (
            <div className="row">
              <Pill kind="info">Flagged for</Pill>
              <select value={flaggedFor ?? ''} onChange={(e) => onSetFlaggedFor(e.target.value as FlaggedFor)}>
                {FLAGGED_FOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
          {onSetAnalysisStatus && (
            <div className="row">
              <Pill kind="info">Analysis</Pill>
              <select value={analysisStatus ?? 'In Progress'} onChange={(e) => onSetAnalysisStatus(e.target.value as AnalysisStatus)}>
                {ANALYSIS_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <hr />

      {showNotes && (
        <div className="card">
          <h3>Team notes</h3>
          {notesQ.isLoading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading notes…</div>}
          {notesQ.isError && <div style={{ color: 'var(--danger)', fontSize: 13 }}>Failed to load notes.</div>}
          {notesQ.data && notesQ.data.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>No notes yet.</div>}
          {notesQ.data && notesQ.data.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {notesQ.data.slice(0, 10).map(n => (
                <div key={n.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    <b style={{ color: 'var(--text)' }}>{n.author_name}</b> · {n.created_at.slice(0, 10)}
                  </div>
                  <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text)', fontSize: 13, lineHeight: 1.6 }}>{n.content}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note… (keep it actionable)" />
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="badge">Posting as: {identityName || 'Guest'}</span>
              <button
                className="btn small"
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
      )}

      <div className="grid grid2" style={{ marginTop: 14 }}>
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

      <FeatureChangeLog featureId={id} />

      <details className="collapsible-section" style={{ marginTop: 14 }}>
        <summary className="collapsible-header">
          <span className="collapsible-chevron">▶</span>
          <h3 style={{ margin: 0 }}>Raw JSON (Microsoft feed)</h3>
        </summary>
        <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
          <pre>{JSON.stringify(feature, null, 2)}</pre>
        </div>
      </details>
    </>
  )
}
