import {
  buildMagnet, parseSize, pickTag, pickItems, httpGet,
  buildQueries, searchContext, collectFeed, finalize, hitsExclusion
} from './lib/shared.js'

const SOURCE_DEFAULT = 'medium'
const NYAA_BASE = 'https://nyaa.si'
const ANIME_CATEGORY = '1_2'

async function rssSearch (query) {
  const url = NYAA_BASE + '/?page=rss&q=' + encodeURIComponent(query) +
    '&c=' + ANIME_CATEGORY + '&s=id&o=desc'
  const res = await httpGet(url)
  if (!res.ok) {
    throw new Error('Nyaa returned HTTP ' + res.status)
  }
  const text = await res.text()
  if (!text.includes('<rss') && !text.includes('<item>')) {
    throw new Error('Nyaa returned an unexpected response')
  }
  return pickItems(text)
}

function itemToResult (raw, opts) {
  const title = pickTag(raw, 'title')
  const hash = pickTag(raw, 'nyaa:infoHash').toLowerCase()
  if (!title || !hash) return null

  if (hitsExclusion(title, opts.exclusions)) return null

  const seeders = parseInt(pickTag(raw, 'nyaa:seeders'), 10) || 0
  const leechers = parseInt(pickTag(raw, 'nyaa:leechers'), 10) || 0
  const downloads = parseInt(pickTag(raw, 'nyaa:downloads'), 10) || 0
  const size = parseSize(pickTag(raw, 'nyaa:size'))
  const pubDate = pickTag(raw, 'pubDate')
  const parsed = pubDate ? new Date(pubDate) : new Date()
  const date = Number.isFinite(parsed.getTime()) ? parsed : new Date(0)
  const trusted = /^yes$/i.test(pickTag(raw, 'nyaa:trusted'))

  return {
    title,
    link: buildMagnet(hash, title),
    hash,
    seeders,
    leechers,
    downloads,
    size,
    date,
    _trusted: trusted,
    accuracy: 'medium',
    type: undefined
  }
}

async function runSearch (query, opts) {
  if (!query.titles || !query.titles.length) return []
  const ctx = searchContext(query, opts.batch ? 'batch' : 'single')
  const queries = buildQueries(query.titles, { limit: 2, episode: opts.episode, anilistId: query.anilistId })
  const shaped = await collectFeed(
    queries,
    rssSearch,
    raw => itemToResult(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  )
  return finalize(shaped, ctx)
}

export default new class Nyaa {
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
    await rssSearch('one piece')
    return true
  }
}()