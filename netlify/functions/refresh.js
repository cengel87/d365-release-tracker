const { ok, bad, corsHeaders, getSupabaseAdmin, fetchAllReleasePlans } = require('./_util')

function stripHtml(s) {
  return String(s ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const TRACKED_FIELDS = [
  'GA date',
  'Public preview date',
  'Early access date',
  'GA Release Wave',
  'Public Preview Release Wave',
  'Enabled for',
  'Business value',
  'Feature details',
  'Investment area',
]

function classify(field) {
  if (field === 'GA date' || field === 'Public preview date' || field === 'Early access date') return 'date_change'
  if (field === 'GA Release Wave' || field === 'Public Preview Release Wave') return 'wave_change'
  if (field === 'Business value' || field === 'Feature details' || field === 'Investment area') return 'description_change'
  return 'status_change'
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const payload = await fetchAllReleasePlans()
    const features = payload.results

    // Load previous full snapshot (single row, id=1)
    const { data: snapRow, error: snapErr } = await sb
      .from('release_snapshots')
      .select('features')
      .eq('id', 1)
      .maybeSingle()
    if (snapErr) throw snapErr

    const prevFeatures = snapRow?.features ?? []
    const isSeeding = prevFeatures.length === 0

    // Build lookup map from previous fetch
    const prevMap = new Map(
      prevFeatures.map(f => [String(f['Release Plan ID'] || '').trim(), f])
    )

    const changeLogRows = []
    const currentIds = new Set()
    let newCount = 0
    let changedCount = 0

    for (const f of features) {
      const rpid = String(f['Release Plan ID'] || '').trim()
      if (!rpid) continue
      currentIds.add(rpid)

      const prev = prevMap.get(rpid)

      if (!prev) {
        // Only log new_feature when we have a real prior baseline, not on first-time seeding
        if (!isSeeding) {
          newCount += 1
          changeLogRows.push({
            release_plan_id: rpid,
            feature_name: String(f['Feature name'] || ''),
            product_name: String(f['Product name'] || ''),
            change_type: 'new_feature',
            field_changed: null,
            old_value: null,
            new_value: null,
          })
        }
        continue
      }

      let changesFound = false
      for (const field of TRACKED_FIELDS) {
        const oldVal = stripHtml(prev[field])
        const newVal = stripHtml(f[field])
        if (oldVal !== newVal) {
          changesFound = true
          changeLogRows.push({
            release_plan_id: rpid,
            feature_name: String(f['Feature name'] || ''),
            product_name: String(f['Product name'] || ''),
            change_type: classify(field),
            field_changed: field,
            old_value: oldVal,
            new_value: newVal,
          })
        }
      }

      if (changesFound) changedCount += 1
    }

    // Detect removed features (only when we have a real baseline)
    if (!isSeeding) {
      for (const [rpid, prevF] of prevMap) {
        if (!currentIds.has(rpid)) {
          changeLogRows.push({
            release_plan_id: rpid,
            feature_name: String(prevF['Feature name'] || ''),
            product_name: String(prevF['Product name'] || ''),
            change_type: 'removed',
            field_changed: null,
            old_value: null,
            new_value: null,
          })
        }
      }
    }

    // Batch insert change log entries
    if (changeLogRows.length > 0) {
      const { error: logErr } = await sb.from('change_log').insert(changeLogRows)
      if (logErr) throw logErr
    }

    // Update the stored full snapshot (upsert single row)
    const { error: upsertErr } = await sb
      .from('release_snapshots')
      .upsert({ id: 1, features, fetched_at: new Date().toISOString() })
    if (upsertErr) throw upsertErr

    return ok({ total: features.length, newCount, changedCount })
  } catch (e) {
    return bad(500, 'Refresh failed', { detail: String(e.message || e) })
  }
}
