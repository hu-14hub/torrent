import { buildMagnet, finalize } from './lib/shared.js'
import { httpGet } from './lib/shared.js'

const BASE = 'https://releases.moe/api/collections/entries/records'

function totalSize (files) {
  if (!Array.isArray(files)) return 0
  let s = 0
  for (const f of files) {
    const len = Number(f && f.length)
    if (Number.isFinite(len)) s += len
  }
  return s
}

function firstFilename (files) {
  if (!Array.isArray(files) || !files.length) return ''
  const f = files.find(x => x && x.name)
  return f ? f.name : ''
}

function cleanReleaseTitle (filename) {
  if (!filename) return ''
  return filename
    .replace(/\s*-?\s*S\d{1,2}E\d{1,3}(?:v\d)?\b/gi, '')
    .replace(/\s+-\s+\d{1,4}(?:v\d)?\b/g, '')
    .replace(/\.(mkv|mp4|avi|m2ts|webm)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBatchRelease (files) {
  if (!Array.isArray(files)) return false
  const videoFiles = files.filter(f => f && f.name && /\.(mkv|mp4|avi|m2ts|webm)$/i.test(f.name))
  if (videoFiles.length > 1) return true
  return totalSize(files) > 10 * 1024 ** 3
}

async function fetchByAnilist (anilistId) {
  const url = BASE +
    '?expand=trs' +
    '&perPage=10' +
    '&filter=' + encodeURIComponent('(alID=' + Number(anilistId) + ')')
  const res = await httpGet(url)
  if (!res.ok) throw new Error('Seadex returned HTTP ' + res.status)
  const data = await res.json()
  if (!data || !Array.isArray(data.items)) return []
  return data.items
}

function flattenTrs (items) {
  const out = []
  for (const entry of items) {
    const trs = entry && entry.expand && entry.expand.trs
    if (!Array.isArray(trs)) continue
    for (const tr of trs) {
      if (!tr || !tr.infoHash) continue
      out.push(tr)
    }
  }
  return out
}

function toResult (tr) {
  const hash = String(tr.infoHash || '').toLowerCase()
  if (!hash) return null
  const cleanName = cleanReleaseTitle(firstFilename(tr.files))
  const group = tr.releaseGroup ? '[' + tr.releaseGroup + '] ' : ''
  const dual = tr.dualAudio ? ' (Dual Audio)' : ''
  const title = group + (cleanName || tr.releaseGroup || 'release') + dual
  const batch = isBatchRelease(tr.files)
  return {
    title,
    link: buildMagnet(hash, cleanName),
    hash,
    seeders: 0,
    leechers: 0,
    downloads: 0,
    size: totalSize(tr.files),
    date: tr.created ? new Date(tr.created) : new Date(),
    accuracy: 'high',
    type: tr.isBest ? 'best' : (batch ? 'batch' : 'alt')
  }
}

async function search (query) {
  if (!query || !query.anilistId) return []
  const items = await fetchByAnilist(query.anilistId)
  const seen = new Set()
  const out = []
  for (const tr of flattenTrs(items)) {
    const r = toResult(tr)
    if (!r || seen.has(r.hash)) continue
    seen.add(r.hash)
    out.push(r)
  }
  return finalize(out, { mode: 'single', exclusions: [] })
}

export default new class Seadex {
  async single (query) { return search(query) }
  async batch (query) { return search(query) }
  async movie (query) { return search(query) }

  async test () {
    const res = await httpGet(BASE + '?perPage=1')
    if (!res.ok) throw new Error('Seadex returned HTTP ' + res.status)
    return true
  }
}()