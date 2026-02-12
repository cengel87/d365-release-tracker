const { createClient } = require('@supabase/supabase-js')

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(body),
  }
}

function ok(body) { return json(200, body) }
function bad(statusCode, message, extra = {}) { return json(statusCode, { error: message, ...extra }) }

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { persistSession: false } })
}

// -------- Microsoft fetch --------
const API_URL = 'https://releaseplans.microsoft.com/en-US/allreleaseplans/'
const HEADERS = {
  'user-agent': 'D365ReleaseTracker/3.0 (Netlify Function)',
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
}

let _cache = { at: 0, payload: null }

function ttlSeconds() {
  const v = Number(process.env.CACHE_TTL_SECONDS || 14400)
  return Number.isFinite(v) && v > 0 ? v : 14400
}

function safeJsonParse(text) {
  try { return JSON.parse(text) } catch (_) {}
  // Fallback: try to extract the first JSON object
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first >= 0 && last > first) {
    const sliced = text.slice(first, last + 1)
    try { return JSON.parse(sliced) } catch (_) {}
  }
  return null
}

async function fetchAllReleasePlans() {
  const now = Date.now()
  const ttl = ttlSeconds() * 1000
  if (_cache.payload && (now - _cache.at) < ttl) return _cache.payload

  const results = []
  for (let page = 1; page <= 20; page++) {
    const url = page === 1 ? API_URL : `${API_URL}?page=${page}`
    const resp = await fetch(url, { headers: HEADERS })
    if (!resp.ok) throw new Error(`Microsoft API error ${resp.status}`)
    const text = await resp.text()
    const data = safeJsonParse(text)
    if (!data || !Array.isArray(data.results)) {
      throw new Error('Unexpected Microsoft API response shape')
    }
    for (const f of data.results) {
      if (f && typeof f === 'object' && f['Feature name']) results.push(f)
    }
    if (!data.morerecords) break
  }

  const payload = {
    fetchedAt: new Date().toISOString(),
    sourceUrl: API_URL,
    results,
  }
  _cache = { at: now, payload }
  return payload
}

module.exports = {
  corsHeaders,
  json,
  ok,
  bad,
  getSupabaseAdmin,
  fetchAllReleasePlans,
}
