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
function parseSize(text) {
  if (!text) return 0;
  const m = text.match(/([\d.]+)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i);
  if (!m) return 0;
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const mult = {
    b: 1,
    kib: 1024,
    kb: 1e3,
    mib: 1024 ** 2,
    mb: 1e3 ** 2,
    gib: 1024 ** 3,
    gb: 1e3 ** 3,
    tib: 1024 ** 4,
    tb: 1e3 ** 4
  }[unit] || 1;
  return Math.round(value * mult);
}
function decodeEntities(str) {
  return String(str).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function pickTag(xml, tag) {
  const open = "<" + tag + ">";
  const close = "</" + tag + ">";
  const i = xml.indexOf(open);
  if (i === -1) return "";
  const j = xml.indexOf(close, i + open.length);
  if (j === -1) return "";
  let val = xml.slice(i + open.length, j);
  if (val.startsWith("<![CDATA[") && val.endsWith("]]>")) {
    val = val.slice(9, -3);
  }
  return decodeEntities(val).trim();
}
function pickItems(xml) {
  const out = [];
  let cursor = 0;
  while (true) {
    const start = xml.indexOf("<item>", cursor);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    out.push(xml.slice(start + 6, end));
    cursor = end + 7;
  }
  return out;
}
function hitsExclusion(title, exclusions) {
  if (!exclusions || !exclusions.length) return false;
  const lower = title.toLowerCase();
  return exclusions.some((kw) => kw && lower.includes(String(kw).toLowerCase()));
}
function buildQueries(titles, { limit = 2, episode, anilistId, episodeCandidates } = {}) {
  const queries = [];
  for (const title of titles) {
    if (!title) continue;
    const base = String(title).trim();
    if (episode != null) {
      queries.push(base + " " + episode);
      if (episodeCandidates && episodeCandidates.size) {
        for (const n of episodeCandidates) queries.push(base + " " + n);
      }
    } else {
      queries.push(base);
    }
    if (queries.length >= limit * titles.length) break;
  }
  if (anilistId) queries.push("aid=" + anilistId);
  return queries;
}
function searchContext(query, mode = "single") {
  const exclusions = query.exclusions || [];
  return {
    mode,
    exclusions,
    episode: query.episode,
    anilistId: query.anilistId
  };
}
async function collectFeed(queries, fetchFn, itemMapper, ctx, defaultAccuracy) {
  const results = [];
  for (const q of queries) {
    try {
      const items = await fetchFn(q);
      for (const raw of items) {
        const r = itemMapper(raw, { exclusions: ctx.exclusions });
        if (r) {
          r.accuracy = r.accuracy || defaultAccuracy;
          results.push(r);
        }
      }
    } catch (err) {
      continue;
    }
  }
  return results;
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

// src/tsukihime.js
var BASE = "https://tsukihime.org";
var SOURCE_DEFAULT = "high";
async function fetchTsukihime(query) {
  const url = BASE + "/api/search?q=" + encodeURIComponent(query);
  let res;
  try {
    res = await httpGet(url);
  } catch (err) {
    console.warn("[TsukiHime] Search endpoint not reachable:", err.message);
    return [];
  }
  if (!res.ok) return [];
  const contentType = res.headers && res.headers.get ? res.headers.get("content-type") : "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  return pickItems(text);
}
function parseItem(raw, opts) {
  let title, hash, size, seeders, leechers, date;
  if (typeof raw === "object" && raw !== null) {
    title = raw.title || raw.name || raw.release_title || "";
    hash = raw.info_hash || raw.hash || raw.infohash || "";
    size = raw.size || raw.size_bytes || 0;
    seeders = raw.seeders || raw.seeds || 0;
    leechers = raw.leechers || raw.peers || 0;
    date = raw.date || raw.pubDate || raw.uploaded_at || /* @__PURE__ */ new Date();
  } else {
    title = pickTag(raw, "title");
    hash = pickTag(raw, "infoHash") || pickTag(raw, "hash") || "";
    size = parseSize(pickTag(raw, "size"));
    seeders = parseInt(pickTag(raw, "seeders"), 10) || 0;
    leechers = parseInt(pickTag(raw, "leechers"), 10) || 0;
    date = pickTag(raw, "pubDate") || /* @__PURE__ */ new Date();
  }
  if (!title || !hash) return null;
  if (hitsExclusion(title, opts.exclusions)) return null;
  const hashLower = String(hash).toLowerCase();
  const parsedDate = date ? new Date(date) : /* @__PURE__ */ new Date();
  const dateObj = Number.isFinite(parsedDate.getTime()) ? parsedDate : /* @__PURE__ */ new Date(0);
  return {
    title: decodeEntities(title),
    link: buildMagnet(hashLower, title),
    hash: hashLower,
    seeders,
    leechers,
    downloads: 0,
    size: typeof size === "number" ? size : parseSize(String(size)),
    date: dateObj,
    accuracy: "high",
    type: void 0
  };
}
async function runSearch(query, opts) {
  if (!query.titles || !query.titles.length) return [];
  const ctx = searchContext(query, opts.batch ? "batch" : "single");
  const queries = buildQueries(query.titles, { limit: 2, episode: query.episode, anilistId: query.anilistId });
  const shaped = await collectFeed(
    queries,
    fetchTsukihime,
    (raw) => parseItem(raw, { exclusions: ctx.exclusions }),
    ctx,
    SOURCE_DEFAULT
  );
  return finalize(shaped, ctx);
}
var tsukihime_default = new class TsukiHime {
  async single(query) {
    return runSearch(query, { episode: query.episode });
  }
  async batch(query) {
    const results = await runSearch(query, { batch: true });
    return results.filter((r) => /batch|complete|season/i.test(r.title));
  }
  async movie(query) {
    return runSearch(query, { movie: true });
  }
  async test() {
    try {
      await fetchTsukihime("one piece");
      return true;
    } catch (err) {
      console.warn("[TsukiHime] test() failed:", err.message);
      return false;
    }
  }
}();
export {
  tsukihime_default as default
};
