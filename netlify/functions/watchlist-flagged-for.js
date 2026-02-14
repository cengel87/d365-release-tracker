const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

const FLAGGED_FOR = new Set(['Business', 'Tech Team', 'Both', ''])

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  try {
    const sb = getSupabaseAdmin()
    const body = JSON.parse(event.body || '{}')
    const { release_plan_id, flagged_for } = body
    if (!release_plan_id || !FLAGGED_FOR.has(flagged_for)) return bad(400, 'Invalid payload')
    const { error } = await sb
      .from('watchlist')
      .update({ flagged_for: flagged_for || null })
      .eq('release_plan_id', String(release_plan_id))
    if (error) throw error
    return ok({ ok: true })
  } catch (e) {
    return bad(500, 'Flagged-for update error', { detail: String(e.message || e) })
  }
}
