import React, { useEffect } from 'react'
import type { EnrichedFeature, FlaggedFor, WatchlistItem } from '../types'
import type { DetailMode } from '../App'
import { fmtDate, statusEmoji } from '../logic'
import { FeatureDetail } from './FeatureDetail'

export function FeatureModal(props: {
  open: boolean
  onClose: () => void
  feature: EnrichedFeature | null
  mode: DetailMode
  watched: boolean
  onToggleWatch: () => void
  identityName: string
  impact?: WatchlistItem['impact']
  onSetImpact?: (impact: WatchlistItem['impact']) => void
  flaggedFor?: FlaggedFor
  onSetFlaggedFor?: (flaggedFor: FlaggedFor) => void
}) {
  const { open, onClose, feature, mode, watched, onToggleWatch, identityName, impact, onSetImpact, flaggedFor, onSetFlaggedFor } = props

  // Escape to close + lock background scroll
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <div className="modal-title">
              {feature ? `${statusEmoji(feature.status)} ${feature['Feature name']}` : 'Details'}
            </div>
            {feature && (
              <div className="modal-subtitle">
               {feature['Product name']} · {feature.releaseWave ?? 'TBD'} · GA: {fmtDate(feature.gaDate)} · {feature['Enabled for'] ?? ''}
              </div>
            )}
          </div>

          <div className="modal-actions">
            {feature && (
              <>
                <button className={`btn small ${watched ? 'danger' : ''}`} onClick={onToggleWatch}>
                  {watched ? 'Remove' : 'Add to watchlist'}
                </button>
                {feature.msLink && (
                  <a className="btn small" href={feature.msLink} target="_blank" rel="noreferrer">View on Microsoft</a>
                )}
              </>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="modal-body">
          {!feature && <div style={{ color: 'var(--muted)' }}>No feature selected.</div>}

          {feature && (
            <FeatureDetail
              feature={feature}
              watched={watched}
              onToggleWatch={onToggleWatch}
              showImpact={mode === 'watchlist'}
              identityName={identityName}
              impact={impact ?? '🚩 To Review'}
              onSetImpact={onSetImpact}
              flaggedFor={flaggedFor ?? ''}
              onSetFlaggedFor={onSetFlaggedFor}
              hideHeader={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}
