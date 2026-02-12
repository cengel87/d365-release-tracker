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

async function isFirstSync(sb) {
  console.log('Checking if first sync...');
  try {
    const { count, error } = await sb
      .from('feature_snapshots')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    return (count ?? 0) === 0;
  } catch (e) {
    console.error('Error in isFirstSync:', e);
    throw e;
  }
}

function classify(field) {
  if (field === 'GA date' || field === 'Public preview date' || field === 'Early access date') return 'date_change'
  if (field === 'GA Release Wave' || field === 'Public Preview Release Wave') return 'wave_change'
  if (field === 'Business value' || field === 'Feature details') return 'description_change'
  return 'status_change'
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  // Allow GET for direct testing (treat as POST)
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin();
    console.log('Supabase initialized successfully');

    const firstSync = await isFirstSync(sb);
    console.log('First sync check:', firstSync);

    console.log('Fetching release plans...');
    const payload = await fetchAllReleasePlans();
    const features = payload.results;
    console.log(`Fetched ${features.length} features`);

    let newCount = 0;
    let changedCount = 0;

    if (firstSync) {
      // Baseline mode: batch insert snapshots only; no change logs
      const batchSize = 200;
      const newSnapshots = features
        .map((f) => {
          const rpid = String(f?.['Release Plan ID'] || '').trim();
          if (!rpid) return null;
          return { release_plan_id: rpid, snapshot_data: f };
        })
        .filter(Boolean);

      console.log(`Preparing to insert ${newSnapshots.length} snapshots in batches of ${batchSize}`);

      for (let i = 0; i < newSnapshots.length; i += batchSize) {
        const batch = newSnapshots.slice(i, i + batchSize);
        console.log(`Inserting batch ${i / batchSize + 1} with ${batch.length} rows...`);
        try {
          const { error } = await sb.from('feature_snapshots').insert(batch);
          if (error) throw error;
        } catch (e) {
          console.error('Error inserting snapshot batch:', e);
          throw e;
        }
      }

      console.log('Baseline snapshots inserted');
      return ok({
        total: features.length,
        newCount: 0,
        changedCount: 0,
        baseline: true,
        message: 'Baseline snapshots created. No changes logged on first sync.',
      });
    }

    // Normal mode: bulk fetch latest snapshots
    const allRpids = features.map((f) => String(f?.['Release Plan ID'] || '').trim()).filter(Boolean);
    console.log(`Fetching snapshots for ${allRpids.length} RPIDs...`);
    let allSnapshots;
    try {
      const { data, error } = await sb
        .from('feature_snapshots')
        .select('release_plan_id, snapshot_data')
        .in('release_plan_id', allRpids)
        .order('fetched_at', { ascending: false });
      if (error) throw error;
      allSnapshots = data;
    } catch (e) {
      console.error('Error fetching snapshots:', e);
      throw e;
    }

    const snapshotMap = new Map();
    allSnapshots.forEach((s) => {
      if (!snapshotMap.has(s.release_plan_id)) snapshotMap.set(s.release_plan_id, s.snapshot_data || {});
    });
    console.log(`Fetched ${snapshotMap.size} existing snapshots`);

    const newSnapshots = [];
    const changeLogs = [];

    console.log('Processing features...');
    for (const f of features) {
      const rpid = String(f?.['Release Plan ID'] || '').trim();
      if (!rpid) continue;

      const prevData = snapshotMap.get(rpid);
      let changesFound = false;

      if (!prevData) {
        newSnapshots.push({ release_plan_id: rpid, snapshot_data: f });
        changeLogs.push({
          release_plan_id: rpid,
          feature_name: String(f?.['Feature name'] || ''),
          product_name: String(f?.['Product name'] || ''),
          change_type: 'new_feature',
          field_changed: null,
          old_value: null,
          new_value: null,
        });
        newCount += 1;
        continue;
      }

      for (const field of TRACKED_FIELDS) {
        const oldVal = String(prevData?.[field] ?? '').trim();
        const newVal = String(f?.[field] ?? '').trim();
        if (oldVal !== newVal) {
          changesFound = true;
          changeLogs.push({
            release_plan_id: rpid,
            feature_name: String(f?.['Feature name'] || ''),
            product_name: String(f?.['Product name'] || ''),
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

    // Batch insert new snapshots and change logs
    const batchSize = 200;
    console.log(`Inserting ${newSnapshots.length} new snapshots in batches...`);
    for (let i = 0; i < newSnapshots.length; i += batchSize) {
      const batch = newSnapshots.slice(i, i + batchSize);
      console.log(`Inserting snapshot batch ${i / batchSize + 1} with ${batch.length} rows...`);
      try {
        const { error } = await sb.from('feature_snapshots').insert(batch);
        if (error) throw error;
      } catch (e) {
        console.error('Error inserting snapshot batch:', e);
        throw e;
      }
    }

    console.log(`Inserting ${changeLogs.length} change logs in batches...`);
    for (let i = 0; i < changeLogs.length; i += batchSize) {
      const batch = changeLogs.slice(i, i + batchSize);
      console.log(`Inserting change log batch ${i / batchSize + 1} with ${batch.length} rows...`);
      try {
        const { error } = await sb.from('change_log').insert(batch);
        if (error) throw error;
      } catch (e) {
        console.error('Error inserting change log batch:', e);
        throw e;
      }
    }

    console.log(`Processed: ${newCount} new, ${changedCount} changed`);

    return ok({ total: features.length, newCount, changedCount, baseline: false });
  } catch (e) {
    console.error('Full refresh error:', e); // Log full error object
    return bad(500, 'Refresh failed', { detail: String(e?.message || e) });
  }
}