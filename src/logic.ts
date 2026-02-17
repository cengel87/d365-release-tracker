import { differenceInCalendarDays, format } from 'date-fns'
import type { AnalysisStatus, EnrichedFeature, ReleaseFeature } from './types'

const STATUS_EMOJI: Record<EnrichedFeature['status'], string> = {
  'Generally Available': '🟢',
  'Public Preview': '🔵',
  'Early Access': '🟣',
  'Planned': '⚪',
}

export function statusEmoji(s: EnrichedFeature['status']) {
  return STATUS_EMOJI[s] ?? '⚪'
}

const ANALYSIS_STATUS_EMOJI: Record<AnalysisStatus, string> = {
  'Not Applicable': '🚫',
  'In Progress': '🔶',
  'Reviewed': '✅',
}

export function analysisStatusEmoji(s: AnalysisStatus): string {
  return ANALYSIS_STATUS_EMOJI[s] ?? '🔶'
}

function parseDate(v: unknown): Date | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s || s === 'N/A' || s === 'TBD') return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function buildMsLink(productName: string, featureName: string): string {
  const appName = productName.replace('Dynamics 365 ', '').replace('Microsoft ', '').trim()
  const params = new URLSearchParams({ app: appName, q: featureName })
  return `https://releaseplans.microsoft.com/en-us/?${params.toString()}`
}

export function enrich(features: ReleaseFeature[], now = new Date()): EnrichedFeature[] {
  const today = new Date(now)
  today.setHours(0,0,0,0)

  return features
    .filter(f => f && typeof f === 'object' && (f as any)['Feature name'])
    .map((f) => {
      const gaDate = parseDate(f['GA date'])
      const previewDate = parseDate(f['Public preview date'])
      const earlyAccessDate = parseDate(f['Early access date'])

      let status: EnrichedFeature['status'] = 'Planned'
      if (gaDate && gaDate <= today) status = 'Generally Available'
      else if (previewDate && previewDate <= today) status = 'Public Preview'
      else if (earlyAccessDate && earlyAccessDate <= today) status = 'Early Access'

      const releaseWave = (String(f['GA Release Wave'] ?? '').trim() || String(f['Public Preview Release Wave'] ?? '').trim() || null) as string | null

      const daysToGA = gaDate ? differenceInCalendarDays(gaDate, today) : null

      return {
        ...f,
        "Release Plan ID": String(f['Release Plan ID'] ?? ''),
        status,
        releaseWave,
        gaDate,
        previewDate,
        earlyAccessDate,
        daysToGA,
        msLink: f['Product name'] && f['Feature name'] ? buildMsLink(f['Product name'], f['Feature name']) : null,
      }
    })
    // Most recent updates first (if present), else keep stable
    .sort((a,b) => (parseDate(b['Last Gitcommit date'])?.getTime() ?? 0) - (parseDate(a['Last Gitcommit date'])?.getTime() ?? 0))
}

export type Filters = {
  search: string
  products: string[]
  statuses: EnrichedFeature['status'][]
  waves: string[]
  enabledFor: string[]
  gaStart?: Date | null
  gaEnd?: Date | null
}

export function applyFilters(all: EnrichedFeature[], f: Filters): EnrichedFeature[] {
  const s = f.search.trim().toLowerCase()
  return all.filter(x => {
    if (f.products.length && !f.products.includes(x['Product name'])) return false
    if (f.statuses.length && !f.statuses.includes(x.status)) return false
    if (f.waves.length && !(x.releaseWave && f.waves.includes(x.releaseWave))) return false
    if (f.enabledFor.length && !f.enabledFor.includes(String(x['Enabled for'] ?? ''))) return false

    if (f.gaStart && f.gaEnd) {
      if (!x.gaDate) return false
      if (x.gaDate < f.gaStart || x.gaDate > f.gaEnd) return false
    }

    if (s) {
      const hay = [
        x['Feature name'],
        x['Product name'],
        x['Business value'],
        x['Feature details'],
        x['Investment area'],
      ].map(v => String(v ?? '').toLowerCase()).join(' ')
      if (!hay.includes(s)) return false
    }
    return true
  })
}

export function fmtDate(d: Date | null): string {
  if (!d) return 'TBD'
  return format(d, 'yyyy-MM-dd')
}

export function monthKey(d: Date): string {
  return format(d, 'yyyy-MM')
}

export function monthLabel(d: Date): string {
  return format(d, 'MMM yyyy')
}
