export function toCsv(rows: Record<string, any>[], columns?: { key: string; label: string }[]) {
  const cols = columns ?? Array.from(new Set(rows.flatMap(r => Object.keys(r)))).map(k => ({ key: k, label: k }))
  const esc = (v: any) => {
    const s = String(v ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  const header = cols.map(c => esc(c.label)).join(',')
  const body = rows.map(r => cols.map(c => esc(r[c.key])).join(',')).join('\r\n')
  return header + '\r\n' + body
}

export function download(name: string, content: string) {
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
