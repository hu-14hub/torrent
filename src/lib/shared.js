// Shared helpers for Hayase torrent extensions.
// Minimal single-source-of-truth: fix matching logic here, all sources inherit it.

export const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/xml, text/xml, text/html, application/json, */*'
}

export async function httpGet (url, opts = {}) {
  const { headers, ...rest } = opts
  return fetch(url, { headers: { ...BROWSER_HEADERS, ...headers }, ...rest })
}

export const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'http://nyaa.tracker.wf:7777/announce'
]

export function buildMagnet (hash, name) {
  const trackers = TRACKERS.map(t => 'tr=' + encodeURIComponent(t)).join('&')
  const dn = name ? '&dn=' + encodeURIComponent(name) : ''
  return 'magnet:?xt=urn:btih:' + String(hash).toLowerCase() + dn + '&' + trackers
}

export function parseSize (text) {
  if (!text) return 0
  const m = text.match(/([\d.]+)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i)
  if (!m) return 0
  const value = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  const mult = {
    b: 1, kib: 1024, kb: 1000,
    mib: 1024 ** 2, mb: 1000 ** 2,
    gib: 1024 ** 3, gb: 1000 ** 3,
    tib: 1024 ** 4, tb: 1000 ** 4
  }[unit] || 1
  return Math.round(value * mult)
}

export function decodeEntities (str) {
  return String(str)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function pickTag (xml, tag) {
  const open = '<' + tag + '>'
  const close = '</' + tag + '>'
  const i = xml.indexOf(open)
  if (i === -1) return ''
  const j = xml.indexOf(close, i + open.length)
  if (j === -1) return ''
  let val = xml.slice(i + open.length, j)
  if (val.startsWith('<![CDATA[') && val.endsWith(']]>')) {
    val = val.slice(9, -3)
  }
  return decodeEntities(val).trim()
}

export function pickItems (xml) {
  const out = []
  let cursor = 0
  while (true) {
    const start = xml.indexOf('<item>', cursor)
    if (start === -1) break
    const end = xml.indexOf('</item>', start)
    if (end === -1) break
    out.push(xml.slice(start + 6, end))
    cursor = end + 7
  }
  return out
}

export function hitsExclusion (title, exclusions) {
  if (!exclusions || !exclusions.length) return false
  const lower = title.toLowerCase()
  return exclusions.some(kw => kw && lower.includes(String(kw).toLowerCase()))
}

// Build search queries from titles. Returns array of query strings.
export function buildQueries (titles, { limit = 2, episode, anilistId, episodeCandidates } = {}) {
  const queries = []
  for (const title of titles) {
    if (!title) continue
    const base = String(title).trim()
    if (episode != null) {
      queries.push(base + ' ' + episode)
      if (episodeCandidates && episodeCandidates.size) {
        for (const n of episodeCandidates) queries.push(base + ' ' + n)
      }
    } else {
      queries.push(base)
    }
    if (queries.length >= limit * titles.length) break
  }
  if (anilistId) queries.push('aid=' + anilistId)
  return queries
}

// Simple search context builder
export function searchContext (query, mode = 'single') {
  const exclusions = query.exclusions || []
  return {
    mode,
    exclusions,
    episode: query.episode,
    anilistId: query.anilistId
  }
}

// Collect and shape results from a feed fetch function
export async function collectFeed (queries, fetchFn, itemMapper, ctx, defaultAccuracy) {
  const results = []
  for (const q of queries) {
    try {
      const items = await fetchFn(q)
      for (const raw of items) {
        const r = itemMapper(raw, { exclusions: ctx.exclusions })
        if (r) {
          r.accuracy = r.accuracy || defaultAccuracy
          results.push(r)
        }
      }
    } catch (err) {
      // Silently skip failed queries, continue with others
      continue
    }
  }
  return results
}

export function finalize (results, ctx) {
  // Deduplicate by hash
  const seen = new Set()
  const unique = []
  for (const r of results) {
    if (r.hash && seen.has(r.hash)) continue
    if (r.hash) seen.add(r.hash)
    unique.push(r)
  }
  return unique
}

export const BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
]

export function looksLikeBatch (title) {
  if (!title) return false
  return BATCH_PATTERNS.some(p => p.test(title))
}