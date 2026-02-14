export type ReleaseFeature = {
  "Release Plan ID": string
  "Feature name": string
  "Product name": string
  ProductId?: string
  "Early access date"?: string | null
  "Public preview date"?: string | null
  "GA date"?: string | null
  "Public Preview Release Wave"?: string | null
  "GA Release Wave"?: string | null
  "Investment area"?: string | null
  "Business value"?: string | null
  "Feature details"?: string | null
  "Enabled for"?: string | null
  "Last Gitcommit date"?: string | null
}

export type EnrichedFeature = ReleaseFeature & {
  status: 'Generally Available' | 'Public Preview' | 'Early Access' | 'Planned'
  releaseWave: string | null
  gaDate: Date | null
  previewDate: Date | null
  earlyAccessDate: Date | null
  daysToGA: number | null
  msLink: string | null
}

export type FlaggedFor = 'Business' | 'Tech Team' | 'Both' | ''

export type WatchlistItem = {
  release_plan_id: string
  feature_name: string
  product_name: string
  impact: '🔴 High' | '🟡 Medium' | '🟢 Low' | '🚩 To Review'
  flagged_for: FlaggedFor
  added_at: string
}

export type Note = {
  id: string
  release_plan_id: string
  author_name: string
  content: string
  created_at: string
}

export type ChangeLogItem = {
  id: string
  release_plan_id: string
  feature_name: string
  product_name: string
  change_type: 'new_feature'|'date_change'|'status_change'|'description_change'|'wave_change'|'removed'
  field_changed: string | null
  old_value: string | null
  new_value: string | null
  detected_at: string
}
