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
  if (field === 'Business value' || field === 'Feature details') return 'description_change'
  return 'status_change'
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const payload = await fetchAllReleasePlans()
    const features = payload.results

    let newCount = 0
    let changedCount = 0

    for (const f of features) {
      const rpid = String(f['Release Plan ID'] || '').trim()
      if (!rpid) continue

      // Latest snapshot
      const { data: prevRows, error: prevErr } = await sb
        .from('feature_snapshots')
        .select('id, snapshot_data, fetched_at')
        .eq('release_plan_id', rpid)
        .order('fetched_at', { ascending: false })
        .limit(1)
      if (prevErr) throw prevErr
      const prev = prevRows && prevRows[0]

      if (!prev) {
        await sb.from('feature_snapshots').insert({ release_plan_id: rpid, snapshot_data: f })
        // First time, treat as new (but don't explode on the very first install; that's okay)
        newCount += 1
        await sb.from('change_log').insert({
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
          await sb.from('change_log').insert({
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
        await sb.from('feature_snapshots').insert({ release_plan_id: rpid, snapshot_data: f })
      }
    }

    return ok({ total: features.length, newCount, changedCount })
  } catch (e) {
    return bad(500, 'Refresh failed', { detail: String(e.message || e) })
  }
}
