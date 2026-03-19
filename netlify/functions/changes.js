const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const params = event.queryStringParameters || {}
    const featureId = params.release_plan_id

    let query = sb.from('change_log').select('*')

    if (featureId) {
      // Fetch all changes for a specific feature (no day limit)
      query = query.eq('release_plan_id', featureId)
    } else {
      const days = Math.max(1, Math.min(90, Number(params.days || 14)))
      const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString()
      query = query.gte('detected_at', cutoff)
    }

    const { data, error } = await query
      .order('detected_at', { ascending: false })
      .limit(5000)
    if (error) throw error
    return ok(data || [])
  } catch (e) {
    return bad(500, 'Changes error', { detail: String(e.message || e) })
  }
}
