import React from 'react'
import { useIdentity } from '../hooks/useIdentity'

export function IdentityGate({ children }: { children: (ident: ReturnType<typeof useIdentity>) => React.ReactNode }) {
  const ident = useIdentity()

  // Wait for the auth-user check to finish before deciding what to show
  if (!ident.resolved) {
    return null
  }

  if (ident.editing) {
    return (
      <div className="container">
        <div className="card">
          <div className="h-title">Quick identity setup</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
            Enter a display name. This is stored in your browser only and sent with any notes you post.
          </p>
          <div className="row">
            <input
              className="input"
              placeholder="e.g., Alex Chen"
              defaultValue={ident.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ident.save((e.target as HTMLInputElement).value)
              }}
            />
            <button
              className="btn"
              onClick={() => {
                const el = document.querySelector('input.input') as HTMLInputElement | null
                ident.save(el?.value ?? '')
              }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children(ident)}</>
}
