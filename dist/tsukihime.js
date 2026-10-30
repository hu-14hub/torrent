// src/lib/shared.js
var BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/xml, text/xml, text/html, application/json, */*"
};
async function httpGet(url, opts = {}) {
  const { headers, ...rest } = opts;
  return fetch(url, { headers: { ...BROWSER_HEADERS, ...headers }, ...rest });
}
var TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://tracker.coppersurfer.tk:6969/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
  "http://nyaa.tracker.wf:7777/announce"
];
function buildMagnet(hash, name) {
  const trackers = TRACKERS.map((t) => "tr=" + encodeURIComponent(t)).join("&");
  const dn = name ? "&dn=" + encodeURIComponent(name) : "";
  return "magnet:?xt=urn:btih:" + String(hash).toLowerCase() + dn + "&" + trackers;
}
function hitsExclusion(title, exclusions) {
  if (!exclusions || !exclusions.length) return false;
  const lower = title.toLowerCase();
  return exclusions.some((kw) => kw && lower.includes(String(kw).toLowerCase()));
}
function finalize(results, ctx) {
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const r of results) {
    if (r.hash && seen.has(r.hash)) continue;
    if (r.hash) seen.add(r.hash);
    unique.push(r);
  }
  return unique;
}
var BATCH_PATTERNS = [
  /\bbatch\b/i,
  /\bcomplete\b/i,
  /\bseason\s*\d+\b/i,
  /\bs\d{1,2}\b(?!\s*e\d)/i,
  /\b\d{1,3}\s*[-~]\s*\d{1,3}\b/
];
function looksLikeBatch(title) {
  if (!title) return false;
  return BATCH_PATTERNS.some((p) => p.test(title));
}

// src/tsukihime.js
var BASE = "https://api.tsukihime.org/v1/search/torrents";
async function fetchTsukihime(query) {
  const url = BASE + "?q=" + encodeURIComponent(query) + "&limit=30&offset=0";
  let res;
  try {
    res = await httpGet(url);
  } catch (err) {
    console.warn("[TsukiHime] Search endpoint not reachable:", err.message);
    return [];
  }
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || !Array.isArray(data.results)) return [];
  return data.results;
}
function toResult(item) {
  const title = item.name || "";
  const hash = item.btih || "";
  if (!title || !hash) return null;
  const size = Number(item.totalsize) || 0;
  const date = item.added_date ? new Date(item.added_date * 1e3) : /* @__PURE__ */ new Date();
  const episode = item.episode_no != null ? item.episode_no : null;
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
    accuracy: "high",
    type: void 0
  };
}
async function runSearch(query, mode) {
  if (!query || !query.titles || !query.titles.length) return [];
  const ctx = { mode, exclusions: query.exclusions || [], episode: query.episode };
  const seen = /* @__PURE__ */ new Map();
  const allQueries = [];
  for (const t of query.titles) {
    allQueries.push(String(t).trim());
    if (query.episode != null) {
      allQueries.push(String(t).trim() + " " + query.episode);
    }
  }
  for (const q of allQueries) {
    try {
      const items = await fetchTsukihime(q);
      for (const item of items) {
        const r = toResult(item);
        if (r && !seen.has(r.hash)) {
          if (hitsExclusion(r.title, ctx.exclusions)) continue;
          seen.set(r.hash, r);
        }
      }
    } catch {
      continue;
    }
  }
  let results = [...seen.values()];
  if (mode !== "batch" && ctx.episode != null) {
    const epFiltered = results.filter((r) => {
      if (r.episode == null) return true;
      return r.episode === ctx.episode;
    });
    if (epFiltered.length > 0) results = epFiltered;
  }
  return finalize(results, ctx);
}
var tsukihime_default = new class TsukiHime {
  async single(query) {
    return runSearch(query, "single");
  }
  async batch(query) {
    const results = await runSearch(query, "batch");
    return results.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch", accuracy: "low" }));
  }
  async movie(query) {
    return runSearch(query, "movie");
  }
  async test() {
    const items = await fetchTsukihime("one piece");
    return Array.isArray(items) && items.length > 0;
  }
}();
export {
  tsukihime_default as default
};
