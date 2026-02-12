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

async function isFirstSync(supabaseAdmin) {
  const { count, error } = await supabaseAdmin
    .from('feature_snapshots')
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return (count ?? 0) === 0
}

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

    const firstSync = await isFirstSync(sb)

    const payload = await fetchAllReleasePlans()
    const features = Array.isArray(payload?.results) ? payload.results : []

    let newCount = 0
    let changedCount = 0

    // Baseline mode: store snapshots only; NO change_log rows
    if (firstSync) {
      // Insert snapshots in batches to avoid giant single requests
      const batchSize = 200
      for (let i = 0; i < features.length; i += batchSize) {
        const batch = features.slice(i, i + batchSize)

        const rows = batch
          .map((f) => {
            const rpid = String(f?.['Release Plan ID'] || '').trim()
            if (!rpid) return null
            return { release_plan_id: rpid, snapshot_data: f }
          })
          .filter(Boolean)

        if (rows.length) {
          const { error } = await sb.from('feature_snapshots').insert(rows)
          if (error) throw error
        }
      }

      return ok({
        total: features.length,
        newCount: 0,
        changedCount: 0,
        baseline: true,
        message: 'Baseline snapshots created. No changes logged on first sync.',
      })
    }

    // Normal mode: compare to latest snapshot and log diffs
    for (const f of features) {
      const rpid = String(f?.['Release Plan ID'] || '').trim()
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

      // New feature since we have an existing baseline
      if (!prev) {
        await sb.from('feature_snapshots').insert({ release_plan_id: rpid, snapshot_data: f })
        newCount += 1

        const { error: logErr } = await sb.from('change_log').insert({
          release_plan_id: rpid,
          feature_name: String(f?.['Feature name'] || ''),
          product_name: String(f?.['Product name'] || ''),
          change_type: 'new_feature',
          field_changed: null,
          old_value: null,
          new_value: null,
        })
        if (logErr) throw logErr

        continue
      }

      const prevData = prev.snapshot_data || {}
      let changesFound = false

      for (const field of TRACKED_FIELDS) {
        const oldVal = String(prevData?.[field] ?? '').trim()
        const newVal = String(f?.[field] ?? '').trim()

        if (oldVal !== newVal) {
          changesFound = true

          const { error: logErr } = await sb.from('change_log').insert({
            release_plan_id: rpid,
            feature_name: String(f?.['Feature name'] || ''),
            product_name: String(f?.['Product name'] || ''),
            change_type: classify(field),
            field_changed: field,
            old_value: oldVal.slice(0, 500),
            new_value: newVal.slice(0, 500),
          })
          if (logErr) throw logErr
        }
      }

      if (changesFound) {
        changedCount += 1
        const { error: snapErr } = await sb.from('feature_snapshots').insert({ release_plan_id: rpid, snapshot_data: f })
        if (snapErr) throw snapErr
      }
    }

    return ok({ total: features.length, newCount, changedCount, baseline: false })
  } catch (e) {
    return bad(500, 'Refresh failed', { detail: String(e?.message || e) })
  }
}
