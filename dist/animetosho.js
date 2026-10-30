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

// src/animetosho.js
var BASE = "https://feed.animetosho.org/json";
async function fetchJson(url) {
  const res = await httpGet(url);
  if (!res.ok) throw new Error("AnimeTosho returned HTTP " + res.status);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
function toResult(item) {
  const hash = String(item.info_hash || item.hash || "").toLowerCase();
  if (!hash) return null;
  return {
    title: item.title || item.torrent_name || "",
    link: item.magnet_uri || buildMagnet(hash, item.title || item.torrent_name || ""),
    hash,
    seeders: Number(item.seeders) || 0,
    leechers: Number(item.leechers) || 0,
    downloads: Number(item.torrent_downloaded_count || item.downloads) || 0,
    size: Number(item.total_size || item.size) || 0,
    date: item.timestamp ? new Date(item.timestamp * 1e3) : /* @__PURE__ */ new Date(),
    accuracy: "high"
  };
}
async function fetchByEid(eid) {
  const items = await fetchJson(BASE + "?eid=" + encodeURIComponent(eid));
  return items.map(toResult).filter(Boolean);
}
async function fetchByAid(aid) {
  const items = await fetchJson(BASE + "?aid=" + encodeURIComponent(aid));
  return items.map(toResult).filter(Boolean);
}
async function fetchByText(query) {
  const titles = query.titles || [];
  if (!titles.length) return [];
  const seen = /* @__PURE__ */ new Map();
  const allQueries = [];
  for (const t of titles) {
    allQueries.push(String(t).trim());
    if (query.episode != null) allQueries.push(String(t).trim() + " " + query.episode);
  }
  for (const q of allQueries) {
    try {
      const items = await fetchJson(BASE + "?q=" + encodeURIComponent(q));
      for (const i of items) {
        const r = toResult(i);
        if (r && !seen.has(r.hash)) seen.set(r.hash, r);
      }
    } catch {
      continue;
    }
  }
  return [...seen.values()];
}
async function search(query, mode) {
  const ctx = { mode, exclusions: query.exclusions || [], episode: query.episode };
  let raw = [];
  if (mode === "single" && query.anidbEid != null) {
    try {
      raw = await fetchByEid(query.anidbEid);
    } catch {
      raw = [];
    }
  } else if (query.anilistId != null) {
    try {
      raw = await fetchByAid(query.anilistId);
    } catch {
      raw = [];
    }
  }
  const results = raw.filter((r) => !hitsExclusion(r.title, ctx.exclusions));
  if (query.titles && query.titles.length) {
    const textResults = await fetchByText(query);
    const seen = new Set(results.map((r) => r.hash));
    for (const r of textResults) {
      if (seen.has(r.hash)) continue;
      seen.add(r.hash);
      results.push(r);
    }
  }
  return finalize(results, ctx);
}
var animetosho_default = new class AnimeTosho {
  async single(query) {
    return search(query, "single");
  }
  async batch(query) {
    const results = await search(query, "batch");
    return results.filter((r) => looksLikeBatch(r.title)).map((r) => ({ ...r, type: "batch", accuracy: "low" }));
  }
  async movie(query) {
    return search(query, "movie");
  }
  async test() {
    await fetchJson(BASE + "?q=test");
    return true;
  }
}();
export {
  animetosho_default as default
};
