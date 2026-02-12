const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

const IMPACT = new Set(['🔴 High', '🟡 Medium', '🟢 Low', '🚩 To Review'])

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const body = JSON.parse(event.body || '{}')
    const { release_plan_id, impact } = body
    if (!release_plan_id || !impact || !IMPACT.has(impact)) return bad(400, 'Invalid payload')
    const { error } = await sb
      .from('watchlist')
      .update({ impact })
      .eq('release_plan_id', String(release_plan_id))
    if (error) throw error
    return ok({ ok: true })
  } catch (e) {
    return bad(500, 'Impact update error', { detail: String(e.message || e) })
  }
}
