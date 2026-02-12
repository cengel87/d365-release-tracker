const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const days = Math.max(1, Math.min(90, Number((event.queryStringParameters || {}).days || 14)))
    const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString()
    const { data, error } = await sb
      .from('change_log')
      .select('*')
      .gte('detected_at', cutoff)
      .order('detected_at', { ascending: false })
      .limit(500)
    if (error) throw error
    return ok(data || [])
  } catch (e) {
    return bad(500, 'Changes error', { detail: String(e.message || e) })
  }
}
