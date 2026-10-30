import { buildMagnet, hitsExclusion, looksLikeBatch, finalize } from './lib/shared.js'
import { httpGet } from './lib/shared.js'

const BASE = 'https://feed.animetosho.net/json'
const SOURCE_DEFAULT = 'high'

async function fetchJson (url) {
  const res = await httpGet(url)
  if (!res.ok) throw new Error('AnimeTosho returned HTTP ' + res.status)
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

function toResult (item) {
  const hash = String(item.info_hash || item.hash || '').toLowerCase()
  if (!hash) return null
  return {
    title: item.title || item.torrent_name || '',
    link: item.magnet_uri || buildMagnet(hash, item.title || item.torrent_name || ''),
    hash,
    seeders: Number(item.seeders) || 0,
    leechers: Number(item.leechers) || 0,
    downloads: Number(item.torrent_downloaded_count || item.downloads) || 0,
    size: Number(item.total_size || item.size) || 0,
    date: item.timestamp ? new Date(item.timestamp * 1000) : new Date(),
    accuracy: 'high'
  }
}

async function fetchByEid (eid) {
  const items = await fetchJson(BASE + '?eid=' + encodeURIComponent(eid))
  return items.map(toResult).filter(Boolean)
}

async function fetchByAid (aid) {
  const items = await fetchJson(BASE + '?aid=' + encodeURIComponent(aid))
  return items.map(toResult).filter(Boolean)
}

async function fetchByText (query) {
  const titles = query.titles || []
  if (!titles.length) return []
  const seen = new Map()
  const allQueries = []
  for (const t of titles) {
    allQueries.push(String(t).trim())
    if (query.episode != null) allQueries.push(String(t).trim() + ' ' + query.episode)
  }
  for (const q of allQueries) {
    try {
      const items = await fetchJson(BASE + '?q=' + encodeURIComponent(q))
      for (const i of items) {
        const r = toResult(i)
        if (r && !seen.has(r.hash)) seen.set(r.hash, r)
      }
    } catch { continue }
  }
  return [...seen.values()]
}

async function search (query, mode) {
  const ctx = { mode, exclusions: query.exclusions || [], episode: query.episode }
  let raw = []

  if (mode === 'single' && query.anidbEid != null) {
    try { raw = await fetchByEid(query.anidbEid) } catch { raw = [] }
  } else if (query.anilistId != null) {
    try { raw = await fetchByAid(query.anilistId) } catch { raw = [] }
  }

  const results = raw.filter(r => !hitsExclusion(r.title, ctx.exclusions))

  if (query.titles && query.titles.length) {
    const textResults = await fetchByText(query)
    const seen = new Set(results.map(r => r.hash))
    for (const r of textResults) {
      if (seen.has(r.hash)) continue
      seen.add(r.hash)
      results.push(r)
    }
  }

  return finalize(results, ctx)
}

export default new class AnimeTosho {
  async single (query) {
    return search(query, 'single')
  }

  async batch (query) {
    const results = await search(query, 'batch')
    return results.filter(r => looksLikeBatch(r.title)).map(r => ({ ...r, type: 'batch', accuracy: 'low' }))
  }

  async movie (query) {
    return search(query, 'movie')
  }

  async test () {
    await fetchJson(BASE + '?q=test')
    return true
  }
}()