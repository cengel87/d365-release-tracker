const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  const sb = getSupabaseAdmin()

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await sb
        .from('watchlist')
        .select('*')
        .order('added_at', { ascending: false })
      if (error) throw error
      return ok(data || [])
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { release_plan_id, feature_name, product_name } = body
      if (!release_plan_id || !feature_name || !product_name) return bad(400, 'Missing required fields')
      const { error } = await sb
        .from('watchlist')
        .upsert({
          release_plan_id: String(release_plan_id),
          feature_name: String(feature_name),
          product_name: String(product_name),
          impact: '🚩 To Review',
        analysis_status: 'In Progress',
        }, { onConflict: 'release_plan_id' })
      if (error) throw error
      return ok({ ok: true })
    }

    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}')
      const { release_plan_id } = body
      if (!release_plan_id) return bad(400, 'Missing release_plan_id')
      const { error } = await sb.from('watchlist').delete().eq('release_plan_id', String(release_plan_id))
      if (error) throw error
      return ok({ ok: true })
    }

    return bad(405, 'Method not allowed')
  } catch (e) {
    return bad(500, 'Watchlist error', { detail: String(e.message || e) })
  }
}
