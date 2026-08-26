const { createClient } = require('@supabase/supabase-js')
const DEFAULT_TTL_SECONDS = 4 * 60 * 60; // 4 hours

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
  const raw = process.env.CACHE_TTL_SECONDS;
  const v = raw ? Number(raw) : DEFAULT_TTL_SECONDS;
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TTL_SECONDS;
}

function safeJsonParse(text) {
  try { return JSON.parse(text) } catch (_) {}
  // Fallback: strip leading whitespace/BOM, fix invalid backslash escapes, then retry
  let cleaned = text.replace(/^\s+/, '')
  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) cleaned = cleaned.slice(first, last + 1)
  // Fix invalid JSON backslash escapes (e.g. \M, \P from Windows paths in MS data)
  // Replace lone backslashes not followed by a valid JSON escape char with \\
  cleaned = cleaned.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
  try { return JSON.parse(cleaned) } catch (_) {}
  return null
}

const PAGE_TIMEOUT_MS = 20000; // Microsoft's API can take 5-10s+ per page, more under concurrent load
const PAGE_RETRIES = 2
const MAX_PAGES = 20

async function fetchOnePageAttempt(page) {
  const url = page === 1 ? API_URL : `${API_URL}?page=${page}`
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!resp.ok) throw new Error(`Microsoft API error ${resp.status}`)
    const text = await resp.text()
    const data = safeJsonParse(text)
    if (!data || !Array.isArray(data.results)) {
      throw new Error('Unexpected Microsoft API response shape')
    }
    return data
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchOnePage(page) {
  let lastErr
  for (let attempt = 1; attempt <= PAGE_RETRIES; attempt++) {
    try {
      return await fetchOnePageAttempt(page)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

function collectFeatures(data, into) {
  for (const f of data.results) {
    if (f && typeof f === 'object' && f['Feature name']) into.push(f)
  }
}

async function fetchAllReleasePlans() {
  const now = Date.now()
  const ttl = ttlSeconds() * 1000
  if (_cache.payload && (now - _cache.at) < ttl) return _cache.payload

  const results = []
  const first = await fetchOnePage(1)
  collectFeatures(first, results)

  if (first.morerecords) {
    // The API reports total record/page counts, so remaining pages can be
    // fetched in parallel instead of one-by-one (which is too slow overall
    // to fit in a serverless function's execution limit).
    const perPage = Number(first.maxrecordsperpage) || first.results.length || 100
    const total = Number(first.totalrecords)
    const totalPages = Number.isFinite(total) && perPage > 0
      ? Math.min(MAX_PAGES, Math.ceil(total / perPage))
      : MAX_PAGES

    const pageNumbers = []
    for (let page = 2; page <= totalPages; page++) pageNumbers.push(page)

    const pages = await Promise.all(pageNumbers.map(fetchOnePage))
    for (const data of pages) collectFeatures(data, results)
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