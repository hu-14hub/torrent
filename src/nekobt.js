// Nekobt.to extension source (https://nekobt.to)
// Uses the JSON API: https://nekobt.to/api/v1/torrents/search

import { buildMagnet, hitsExclusion, finalize } from './lib/shared.js'
import { httpGet } from './lib/shared.js'

const BASE = 'https://nekobt.to/api/v1'
const SOURCE_DEFAULT = 'high'

async function fetchNekobt (query) {
  const url = BASE + '/torrents/search?query=' + encodeURIComponent(query) + '&limit=30&offset=0'
  let res
  try {
    res = await httpGet(url)
  } catch (err) {
    console.warn('[Nekobt] Search endpoint not reachable:', err.message)
    return []
  }
  if (!res.ok) return []
  const data = await res.json()
  if (!data || !data.data || !Array.isArray(data.data.results)) return []
  return data.data.results
}

function toResult (item) {
  const title = item.title || item.name || ''
  const hash = item.info_hash || item.hash || ''
  if (!title || !hash) return null

  return {
    title,
    link: buildMagnet(hash, title),
    hash: String(hash).toLowerCase(),
    seeders: Number(item.seeders) || 0,
    leechers: Number(item.leechers) || 0,
    downloads: Number(item.downloads) || 0,
    size: Number(item.size) || 0,
    date: item.added_date ? new Date(item.added_date * 1000) : new Date(),
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
      const items = await fetchNekobt(q)
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

export default new class Nekobt {
  async single (query) {
    return runSearch(query, 'single')
  }

  async batch (query) {
    const results = await runSearch(query, 'batch')
    return results.filter(r => /batch|complete|season/i.test(r.title)).map(r => ({ ...r, type: 'batch', accuracy: 'low' }))
  }

  async movie (query) {
    return runSearch(query, 'movie')
  }

  async test () {
    const items = await fetchNekobt('one piece')
    return Array.isArray(items) && items.length > 0
  }
}()