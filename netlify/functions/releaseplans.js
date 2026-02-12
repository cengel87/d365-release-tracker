const { ok, bad, corsHeaders, fetchAllReleasePlans } = require('./_util')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed')

  try {
    const payload = await fetchAllReleasePlans()
    return ok(payload)
  } catch (e) {
    return bad(500, 'Failed to fetch Microsoft release plans', { detail: String(e.message || e) })
  }
}
