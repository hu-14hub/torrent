import {
  buildMagnet, parseSize, pickTag, pickItems, httpGet,
  buildQueries, searchContext, collectFeed, finalize, hitsExclusion
} from './lib/shared.js'

const BASE = 'https://releases.moe'
const SOURCE_DEFAULT = 'high'

async function fetchFeed (query) {
  const url = BASE + '/?q=' + encodeURIComponent(query)
  const res = await httpGet(url)
  if (!res.ok) {
    throw new Error('Seadex returned HTTP ' + res.status)
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('Seadex returned an unexpected response')
  }
  return pickItems(text)
}

function itemToResult (raw, opts) {
  const title = pickTag(raw, 'title')
  const hash = pickTag(raw, 'infoHash') || pickTag(raw, 'nyaa:infoHash')
  if (!title || !hash) return null

  if (hitsExclusion(title, opts.exclusions)) return null

  const hashLower = String(hash).toLowerCase()
  const seeders = parseInt(pickTag(raw, 'seeders'), 10) || 0
  const leechers = parseInt(pickTag(raw, 'leechers'), 10) || 0
  const size = parseSize(pickTag(raw, 'size'))
  const pubDate = pickTag(raw, 'pubDate')
  const parsed = pubDate ? new Date(pubDate) : new Date()
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date(0)

  return {
    title,
    link: buildMagnet(hashLower, title),
    hash: hashLower,
    seeders,
    leechers,
    downloads: 0,
    size,
    date,
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
    fetchFeed,
    raw => itemToResult(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  )
  return finalize(shaped, ctx)
}

export default new class Seadex {
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
    await fetchFeed('one piece')
    return true
  }
}()