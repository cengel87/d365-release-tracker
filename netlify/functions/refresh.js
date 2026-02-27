const { ok, bad, corsHeaders, getSupabaseAdmin, fetchAllReleasePlans } = require('./_util')

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

    // --- Bulk-fetch all latest snapshots in a single query ---
    // Fetch all rows ordered by fetched_at desc; deduplicate to latest per rpid in JS.
    const { data: allSnaps, error: snapErr } = await sb
      .from('feature_snapshots')
      .select('release_plan_id, snapshot_data, fetched_at')
      .order('fetched_at', { ascending: false })
    if (snapErr) throw snapErr

    const prevMap = new Map()
    for (const s of allSnaps || []) {
      if (!prevMap.has(s.release_plan_id)) {
        prevMap.set(s.release_plan_id, s)
      }
    }

    // --- Compare and accumulate rows to insert (no per-feature DB calls) ---
    const changeLogRows = []
    const newSnapRows = []
    const currentIds = new Set()

    let newCount = 0
    let changedCount = 0

    for (const f of features) {
      const rpid = String(f['Release Plan ID'] || '').trim()
      if (!rpid) continue
      currentIds.add(rpid)

      const prev = prevMap.get(rpid)

      if (!prev) {
        newCount += 1
        newSnapRows.push({ release_plan_id: rpid, snapshot_data: f })
        changeLogRows.push({
          release_plan_id: rpid,
          feature_name: String(f['Feature name'] || ''),
          product_name: String(f['Product name'] || ''),
          change_type: 'new_feature',
          field_changed: null,
          old_value: null,
          new_value: null,
        })
        continue
      }

      const prevData = prev.snapshot_data || {}
      let changesFound = false

      for (const field of TRACKED_FIELDS) {
        const oldVal = String(prevData[field] ?? '').trim()
        const newVal = String(f[field] ?? '').trim()
        if (oldVal !== newVal) {
          changesFound = true
          changeLogRows.push({
            release_plan_id: rpid,
            feature_name: String(f['Feature name'] || ''),
            product_name: String(f['Product name'] || ''),
            change_type: classify(field),
            field_changed: field,
            old_value: oldVal.slice(0, 500),
            new_value: newVal.slice(0, 500),
          })
        }
      }

      if (changesFound) {
        changedCount += 1
        newSnapRows.push({ release_plan_id: rpid, snapshot_data: f })
      }
    }

    // --- Detect removed features ---
    for (const [rpid, snapRow] of prevMap) {
      if (!currentIds.has(rpid)) {
        const prevData = snapRow.snapshot_data || {}
        changeLogRows.push({
          release_plan_id: rpid,
          feature_name: String(prevData['Feature name'] || ''),
          product_name: String(prevData['Product name'] || ''),
          change_type: 'removed',
          field_changed: null,
          old_value: null,
          new_value: null,
        })
      }
    }

    // --- Bulk inserts ---
    if (newSnapRows.length > 0) {
      const { error: snapInsErr } = await sb.from('feature_snapshots').insert(newSnapRows)
      if (snapInsErr) throw snapInsErr
    }
    if (changeLogRows.length > 0) {
      const { error: logInsErr } = await sb.from('change_log').insert(changeLogRows)
      if (logInsErr) throw logInsErr
    }

    return ok({ total: features.length, newCount, changedCount })
  } catch (e) {
    return bad(500, 'Refresh failed', { detail: String(e.message || e) })
  }
}
