export function toCsv(rows: Record<string, any>[]) {
  const cols = Array.from(new Set(rows.flatMap(r => Object.keys(r))))
  const esc = (v: any) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  const header = cols.join(',')
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n')
  return header + '\n' + body
}

export function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
