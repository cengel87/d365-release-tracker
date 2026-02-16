const { ok, bad, corsHeaders, getSupabaseAdmin } = require('./_util')

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders(), body: '' }
  const sb = getSupabaseAdmin()

  try {
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {}
      const release_plan_id = qs.release_plan_id
      const ids = qs.ids // comma-separated list for bulk fetch

      if (ids) {
        // Bulk fetch: return notes for multiple release_plan_ids
        const idList = ids.split(',').map(s => s.trim()).filter(Boolean)
        if (idList.length === 0) return bad(400, 'Empty ids list')
        const { data, error } = await sb
          .from('notes')
          .select('*')
          .in('release_plan_id', idList)
          .order('created_at', { ascending: false })
        if (error) throw error
        return ok(data || [])
      }

      if (!release_plan_id) return bad(400, 'Missing release_plan_id')
      const { data, error } = await sb
        .from('notes')
        .select('*')
        .eq('release_plan_id', String(release_plan_id))
        .order('created_at', { ascending: false })
      if (error) throw error
      return ok(data || [])
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { release_plan_id, author_name, content } = body
      if (!release_plan_id || !author_name || !content) return bad(400, 'Missing required fields')
      const { error } = await sb.from('notes').insert({
        release_plan_id: String(release_plan_id),
        author_name: String(author_name).slice(0, 80),
        content: String(content).slice(0, 4000),
      })
      if (error) throw error
      return ok({ ok: true })
    }

    return bad(405, 'Method not allowed')
  } catch (e) {
    return bad(500, 'Notes error', { detail: String(e.message || e) })
  }
}
