export function stripHtml(s: string) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function short(v: string | null) {
  const s = String(v ?? '')
  if (s.length <= 140) return s || '(empty)'
  return s.slice(0, 140) + '…'
}
