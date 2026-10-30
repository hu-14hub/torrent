import {
  buildMagnet, parseSize, pickTag, pickItems, httpGet,
  buildQueries, searchContext, collectFeed, finalize, hitsExclusion, decodeEntities
} from './lib/shared.js'

// TsukiHime extension source (https://tsukihime.org/)
// NOTE: TsukiHime's pages appear to be JavaScript-rendered. You will need to
// inspect the site's network tab (F12) to find the exact JSON API or HTML
// selectors, then update the fetchTsukihime() and parseItem() functions below.

const BASE = 'https://tsukihime.org'
const SOURCE_DEFAULT = 'high'

// Helper: convert a relative or absolute URL to absolute
function absoluteUrl (href) {
  if (!href) return ''
  if (href.startsWith('http')) return href
  if (href.startsWith('/')) return BASE + href
  return BASE + '/' + href
}

async function fetchTsukihime (query) {
  // TODO: Replace this with TsukiHime's actual search/API endpoint.
  // Common patterns:
  //   GET https://tsukihime.org/api/search?q=<query>
  //   GET https://tsukihime.org/animes?q=<query>
  //   GET https://tsukihime.org/search?query=<query>
  //
  // The current homepage returned no server-rendered release list, so the site
  // likely loads data via JavaScript. Inspect the Network tab in DevTools to
  // find the real endpoint and update this URL accordingly.
  const url = BASE + '/api/search?q=' + encodeURIComponent(query)
  let res
  try {
    res = await httpGet(url)
  } catch (err) {
    // If the API endpoint doesn't exist yet, return empty results
    // and log so the developer knows to update it.
    console.warn('[TsukiHime] Search endpoint not reachable:', err.message)
    return []
  }
  if (!res.ok) return []

  const contentType = res.headers && res.headers.get ? res.headers.get('content-type') : ''
  if (contentType.includes('application/json')) {
    return await res.json()
  }
  const text = await res.text()
  return pickItems(text)
}

// TODO: Update this parser to match TsukiHime's actual data structure.
// If the API returns JSON, parse the JSON array directly.
// If it returns HTML, use pickItems + pickTag to extract <item> elements.
function parseItem (raw, opts) {
  let title, hash, size, seeders, leechers, date

  if (typeof raw === 'object' && raw !== null) {
    // JSON API response
    title = raw.title || raw.name || raw.release_title || ''
    hash = raw.info_hash || raw.hash || raw.infohash || ''
    size = raw.size || raw.size_bytes || 0
    seeders = raw.seeders || raw.seeds || 0
    leechers = raw.leechers || raw.peers || 0
    date = raw.date || raw.pubDate || raw.uploaded_at || new Date()
  } else {
    // HTML/RSS fallback
    title = pickTag(raw, 'title')
    hash = pickTag(raw, 'infoHash') || pickTag(raw, 'hash') || ''
    size = parseSize(pickTag(raw, 'size'))
    seeders = parseInt(pickTag(raw, 'seeders'), 10) || 0
    leechers = parseInt(pickTag(raw, 'leechers'), 10) || 0
    date = pickTag(raw, 'pubDate') || new Date()
  }

  if (!title || !hash) return null
  if (hitsExclusion(title, opts.exclusions)) return null

  const hashLower = String(hash).toLowerCase()
  const parsedDate = date ? new Date(date) : new Date()
  const dateObj = Number.isFinite(parsedDate.getTime()) ? parsedDate : new Date(0)

  return {
    title: decodeEntities(title),
    link: buildMagnet(hashLower, title),
    hash: hashLower,
    seeders,
    leechers,
    downloads: 0,
    size: typeof size === 'number' ? size : parseSize(String(size)),
    date: dateObj,
    accuracy: 'high',
    type: undefined
  }
}

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []
  const ctx = searchContext(query, opts.batch ? 'batch' : 'single')
  const queries = buildQueries(query.titles, { limit: 2, episode: query.episode, anilistId: query.anilistId })
  const shaped = await collectFeed(
    queries,
    fetchTsukihime,
    raw => parseItem(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  )
  return finalize(shaped, ctx)
}

export default new class TsukiHime {
  async single (query) {
    return runSearch(query, { episode: query.episode })
  }

  async batch (query) {
    const results = await runSearch(query, { batch: true })
    return results.filter(r => /batch|complete|season/i.test(r.title))
  }

  async movie (query) {
    return runSearch(query, { movie: true })
  }

  async test () {
    try {
      await fetchTsukihime('one piece')
      return true
    } catch (err) {
      console.warn('[TsukiHime] test() failed:', err.message)
      return false
    }
  }
}()