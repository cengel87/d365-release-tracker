const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

const ANALYSIS_STATUS = new Set(['Not Applicable', 'In Progress', 'Reviewed'])

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const body = JSON.parse(event.body || '{}')
    const { release_plan_id, analysis_status } = body
    if (!release_plan_id || !analysis_status || !ANALYSIS_STATUS.has(analysis_status)) return bad(400, 'Invalid payload')
    const { error } = await sb
      .from('watchlist')
      .update({ analysis_status })
      .eq('release_plan_id', String(release_plan_id))
    if (error) throw error
    return ok({ ok: true })
  } catch (e) {
    return bad(500, 'Analysis status update error', { detail: String(e.message || e) })
  }
}
