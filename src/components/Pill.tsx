import React from 'react'

export function Pill({ kind, children }: { kind: 'ok' | 'warn' | 'info' | 'muted', children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>
}
