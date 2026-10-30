import { buildMagnet, hitsExclusion, looksLikeBatch, finalize } from './lib/shared.js'
import { httpGet } from './lib/shared.js'

// TsukiHime extension source (https://tsukihime.org/)
// Uses the public API: https://api.tsukihime.org/v1/search/torrents?q=<query>&limit=30&offset=0

const BASE = 'https://api.tsukihime.org/v1/search/torrents'
const SOURCE_DEFAULT = 'high'

async function fetchTsukihime (query) {
  const url = BASE + '?q=' + encodeURIComponent(query) + '&limit=30&offset=0'
  let res
  try {
    res = await httpGet(url)
  } catch (err) {
    console.warn('[TsukiHime] Search endpoint not reachable:', err.message)
    return []
  }
  if (!res.ok) return []
  const data = await res.json()
  if (!data || !Array.isArray(data.results)) return []
  return data.results
}

function toResult (item) {
  const title = item.name || ''
  const hash = item.btih || ''
  if (!title || !hash) return null

  const size = Number(item.totalsize) || 0
  const date = item.added_date ? new Date(item.added_date * 1000) : new Date()
  const episode = item.episode_no != null ? item.episode_no : null

  return {
    title,
    link: buildMagnet(hash, title),
    hash: String(hash).toLowerCase(),
    seeders: 0,
    leechers: 0,
    downloads: 0,
    size,
    date,
    episode,
    accuracy: 'high',
    type: undefined
  }
}

async function runSearch (query, mode) {
  if (!query || !query.titles || !query.titles.length) return []
  const ctx = { mode, exclusions: query.exclusions || [], episode: query.episode }
  const seen = new Map()
  const allQueries = []

  for (const t of query.titles) {
    allQueries.push(String(t).trim())
    if (query.episode != null) {
      allQueries.push(String(t).trim() + ' ' + query.episode)
    }
  }

  for (const q of allQueries) {
    try {
      const items = await fetchTsukihime(q)
      for (const item of items) {
        const r = toResult(item)
        if (r && !seen.has(r.hash)) {
          if (hitsExclusion(r.title, ctx.exclusions)) continue
          seen.set(r.hash, r)
        }
      }
    } catch { continue }
  }

  let results = [...seen.values()]

  // Filter by episode if specified and not batch mode
  if (mode !== 'batch' && ctx.episode != null) {
    const epFiltered = results.filter(r => {
      if (r.episode == null) return true // include results without episode info
      return r.episode === ctx.episode
    })
    if (epFiltered.length > 0) results = epFiltered
  }

  return finalize(results, ctx)
}

export default new class TsukiHime {
  async single (query) {
    return runSearch(query, 'single')
  }

  async batch (query) {
    const results = await runSearch(query, 'batch')
    return results.filter(r => looksLikeBatch(r.title)).map(r => ({ ...r, type: 'batch', accuracy: 'low' }))
  }

  async movie (query) {
    return runSearch(query, 'movie')
  }

  async test () {
    const items = await fetchTsukihime('one piece')
    return Array.isArray(items) && items.length > 0
  }
}()