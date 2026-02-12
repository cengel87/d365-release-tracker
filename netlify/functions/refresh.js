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

    console.log(`Fetched ${features.length} features`); // For logs

    const allRpids = features.map(f => String(f['Release Plan ID'] || '').trim()).filter(Boolean);

    // Bulk fetch all latest snapshots
    const { data: allSnapshots, error: snapErr } = await sb
      .from('feature_snapshots')
      .select('release_plan_id, snapshot_data')
      .in('release_plan_id', allRpids)
      .order('fetched_at', { ascending: false });
    if (snapErr) throw snapErr;

    // Map for quick lookup (latest per RPID)
    const snapshotMap = new Map();
    allSnapshots.forEach(s => {
      if (!snapshotMap.has(s.release_plan_id)) snapshotMap.set(s.release_plan_id, s.snapshot_data || {});
    });

    const newSnapshots = [];
    const changeLogs = [];
    let newCount = 0;
    let changedCount = 0;

    for (const f of features) {
      const rpid = String(f['Release Plan ID'] || '').trim()
      if (!rpid) continue;

      const prevData = snapshotMap.get(rpid);
      let changesFound = false;

      if (!prevData) {
        newSnapshots.push({ release_plan_id: rpid, snapshot_data: f });
        changeLogs.push({
          release_plan_id: rpid,
          feature_name: String(f['Feature name'] || ''),
          product_name: String(f['Product name'] || ''),
          change_type: 'new_feature',
          field_changed: null,
          old_value: null,
          new_value: null,
        });
        newCount += 1;
        continue;
      }

      for (const field of TRACKED_FIELDS) {
        const oldVal = String(prevData[field] ?? '').trim();
        const newVal = String(f[field] ?? '').trim();
        if (oldVal !== newVal) {
          changesFound = true;
          changeLogs.push({
            release_plan_id: rpid,
            feature_name: String(f['Feature name'] || ''),
            product_name: String(f['Product name'] || ''),
            change_type: classify(field),
            field_changed: field,
            old_value: oldVal.slice(0, 500),
            new_value: newVal.slice(0, 500),
          });
        }
      }

      if (changesFound) {
        newSnapshots.push({ release_plan_id: rpid, snapshot_data: f });
        changedCount += 1;
      }
    }

    // Batch insert new snapshots
    const batchSize = 200;
    for (let i = 0; i < newSnapshots.length; i += batchSize) {
      const batch = newSnapshots.slice(i, i + batchSize);
      const { error } = await sb.from('feature_snapshots').insert(batch);
      if (error) throw error;
    }

    // Batch insert change logs
    for (let i = 0; i < changeLogs.length; i += batchSize) {
      const batch = changeLogs.slice(i, i + batchSize);
      const { error } = await sb.from('change_log').insert(batch);
      if (error) throw error;
    }

    console.log(`Processed: ${newCount} new, ${changedCount} changed`); // For logs

    return ok({ total: features.length, newCount, changedCount })
  } catch (e) {
    console.error(e); // Log full error
    return bad(500, 'Refresh failed', { detail: String(e.message || e) })
  }
}