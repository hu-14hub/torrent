# Hayase Extension Pack (Custom)

A custom Hayase / Mihon torrent extension pack with **7 sources**:
Nyaa, AnimeTosho (custom domain), Seadex, SubsPlease, Yameii, ToonsHub,
and **TsukiHime** (`https://tsukihime.org/`).

Based on the [anitorrent](https://github.com/anh9000/anitorrent) structure.

**Repository:** https://github.com/hu-14hub/torrent

## Files

```
hayase-extension-pack/
├── hayase/index.json          # Extension manifest (import URL for Hayase)
├── package.json               # npm project config
├── tsup.config.js             # Bundler config (builds dist/*.js)
├── README.md
├── src/
│   ├── lib/shared.js          # Shared HTTP, magnet, RSS helpers
│   ├── nyaa.js                # Nyaa source
│   ├── animetosho.js          # AnimeTosho (custom domain)
│   ├── seadex.js              # Seadex source
│   ├── subsplease.js          # SubsPlease source
│   ├── yameii.js              # Yameii (dubs) source
│   ├── toonshub.js            # ToonsHub source
│   └── tsukihime.js           # TsukiHime source (https://tsukihime.org/)
└── dist/                      # Built extension bundles (hosted on GitHub)
```

## What this pack does

| # | Source | ID | Site | Notes |
|---|--------|-----|------|-------|
| 1 | Nyaa | `custom.nyaa` | nyaa.si | Raw firehose search |
| 2 | AnimeTosho | `custom.animetosho` | `feed.animetosho.org` | Replace `url` in index.json with your custom domain |
| 3 | Seadex | `custom.seadex` | releases.moe | Curated best releases |
| 4 | SubsPlease | `custom.subsplease` | subsplease.org | Weekly fansubs |
| 5 | Yameii (Dubs) | `custom.yameii` | nyaa.si | English dub uploads |
| 6 | ToonsHub | `custom.toonshub` | nyaa.si | Dual-audio / subbed |
| 7 | **TsukiHime** | `custom.tsukihime` | **tsukihime.org** | **New episode source** |

## Install in Hayase

1. Open Hayase.
2. Go to **Settings > Extensions > Repositories**.
3. Paste this manifest URL:
   ```
   https://raw.githubusercontent.com/hu-14hub/torrent/main/hayase/index.json
   ```
4. Click **Import Extensions**.
5. Go to the **Extensions** tab and toggle each source on/off as desired.

Hayase auto-polls the `update` URL on every launch, so future updates flow in
automatically — just restart Hayase.

## Step 1: Replace the AnimeTosho domain (optional)

In `hayase/index.json`, find the AnimeTosho entry and change its `url` field:

```json
"url": "aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3Jn",
```

That value is Base64 for `https://feed.animetosho.org`. To use your own domain:

1. Take your domain URL, e.g. `https://my-animetosho-mirror.com`
2. Base64-encode it (PowerShell):
   ```powershell
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('https://my-animetosho-mirror.com'))
   ```
3. Replace the `url` value in `hayase/index.json`.
4. Also update the `BASE` constant in `src/animetosho.js`:
   ```js
   const BASE = 'https://my-animetosho-mirror.com'
   ```

## Step 2: Configure TsukiHime

TsukiHime's homepage loads content via JavaScript, so the extension needs the real
API/search endpoint. In `src/tsukihime.js`:

1. Update `fetchTsukihime()` to point at TsukiHime's actual search/API URL.
2. Update `parseItem()` to match the JSON fields or HTML selectors TsukiHime returns.

Open TsukiHime in your browser, press **F12 → Network**, search for an anime, and look
for the XHR/fetch request. Copy its URL and response shape into `src/tsukihime.js`.

## Extension API (for adding more sources)

Each source exports a default object with these methods:

| Method | Purpose |
|--------|---------|
| `single(query)` | Search for a specific episode |
| `batch(query)` | Search for batch / season packs |
| `movie(query)` | Search for movies |
| `test()` | Connection check (runs on Hayase launch) |

The `query` object contains: `titles` (array of strings), `episode` (number),
`anilistId`, `episodeCount`, `exclusions`, `episodeCandidates`.

Each result must return: `title`, `link` (magnet URL), `hash`, `seeders`,
`leechers`, `size`, `date`, `accuracy`, `type` (optional: `'batch'`).

## License

GPL-3.0