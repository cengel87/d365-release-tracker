import type { ChangeLogItem } from '../types'

export function labelChangeType(t: ChangeLogItem['change_type'] | string) {
  const m: Record<string, string> = {
    new_feature: '🆕 New',
    date_change: '📅 Date',
    status_change: '🔄 Status',
    description_change: '📝 Description',
    wave_change: '🌊 Wave',
    removed: '🗑️ Removed',
  }
  return m[t] ?? t
}
