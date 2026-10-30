import { buildMagnet, hitsExclusion, looksLikeBatch, finalize } from './lib/shared.js'
import { httpGet } from './lib/shared.js'

const BASE = 'https://subsplease.org/api/'
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ToHex (b32) {
  let bits = ''
  for (const c of b32.toUpperCase()) {
    const idx = BASE32.indexOf(c)
    if (idx < 0) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  let hex = ''
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  }
  return hex
}

function parseMagnet (magnet) {
  const m = String(magnet || '')
  const hashMatch = m.match(/xt=urn:btih:([A-Z2-7]{32}|[a-fA-F0-9]{40})/i)
  let hash = ''
  if (hashMatch) {
    const raw = hashMatch[1]
    hash = raw.length === 40 ? raw.toLowerCase() : base32ToHex(raw)
  }
  const sizeMatch = m.match(/[?&]xl=(\d+)/i)
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
  return { hash, size }
}

function toEntries (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data).map(([key, entry]) => ({ key, ...entry }))
}

async function fetchApi (url) {
  const res = await httpGet(url)
  if (!res.ok) throw new Error('SubsPlease returned HTTP ' + res.status)
  const text = (await res.text()).trim()
  if (!text) return null
  try { return toEntries(JSON.parse(text)) } catch { return null }
}

async function searchApi (q) {
  const found = await fetchApi(BASE + '?f=search&tz=UTC&s=' + encodeURIComponent(q))
  return found || []
}

let latestCache = null
async function latestApi () {
  if (!latestCache) {
    latestCache = fetchApi(BASE + '?f=latest&tz=UTC').catch(() => null)
  }
  const entries = await latestCache
  if (!entries) latestCache = null
  return entries || []
}

function episodeMatches (entryEpisode, wanted) {
  if (wanted == null) return true
  const e = String(entryEpisode || '').trim()
  if (!e) return false
  if (e.includes('-') || e.includes('~')) return false
  const n = parseInt(e, 10)
  return Number.isInteger(n) && n === Number(wanted)
}

function isBatchEntry (entry) {
  const e = String(entry.episode || '')
  if (/\d+\s*[-~]\s*\d+/.test(e)) return true
  if (/batch/i.test(e)) return true
  return false
}

function entryToResults (entry, opts) {
  const downloads = Array.isArray(entry.downloads) ? entry.downloads : []
  const date = entry.release_date ? new Date(entry.release_date) : new Date()
  const out = []
  for (const dl of downloads) {
    if (!dl || !dl.magnet) continue
    const { hash, size } = parseMagnet(dl.magnet)
    if (!hash) continue
    const res = dl.res ? dl.res + 'p' : ''
    const title = '[SubsPlease] ' + entry.key + (res ? ' (' + res + ')' : '')
    if (hitsExclusion(title, opts.exclusions)) continue
    out.push({
      title,
      link: dl.magnet,
      hash,
      seeders: 0,
      leechers: 0,
      downloads: 0,
      size,
      date,
      accuracy: 'high',
      type: undefined
    })
  }
  return out
}

async function runSearch (query, mode) {
  if (!query || !query.titles || !query.titles.length) return []
  const ctx = { mode, exclusions: query.exclusions || [], episode: query.episode }
  const seenKeys = new Set()
  const entries = []

  const settled = await Promise.allSettled(
    query.titles.map(q => searchApi(q))
  )
  for (const s of settled) {
    if (s.status === 'rejected') continue
    for (const e of s.value) {
      if (seenKeys.has(e.key)) continue
      seenKeys.add(e.key)
      entries.push(e)
    }
  }

  if (!entries.length) {
    for (const e of await latestApi()) {
      if (seenKeys.has(e.key)) continue
      seenKeys.add(e.key)
      entries.push(e)
    }
  }

  const out = []
  const seenHashes = new Set()
  for (const e of entries) {
    const isBatch = isBatchEntry(e)
    if (mode === 'batch' && !isBatch) continue
    if (mode === 'movie' && isBatch) continue
    if (query.episode != null && !isBatch && !episodeMatches(e.episode, query.episode)) continue

    for (const r of entryToResults(e, ctx)) {
      if (seenHashes.has(r.hash)) continue
      seenHashes.add(r.hash)
      out.push(r)
    }
  }

  return finalize(out, ctx)
}

export default new class SubsPlease {
  async single (query) {
    return runSearch(query, 'single')
  }

  async batch (query) {
    return runSearch(query, 'batch')
  }

  async movie (query) {
    return runSearch(query, 'movie')
  }

  async test () {
    const res = await httpGet(BASE + '?f=latest&tz=UTC')
    if (!res.ok) throw new Error('SubsPlease returned HTTP ' + res.status)
    return true
  }
}()