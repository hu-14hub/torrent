# Hayase Extension Pack — Torrent Sources

A professional Hayase / Mihon extension pack providing **7 auto-updating anime torrent sources**:

| # | Source | ID | Site | Accuracy | Best For |
|---|--------|-----|------|----------|----------|
| 1 | Nyaa | `custom.nyaa` | nyaa.si | Medium | Raw firehose search, every anime upload |
| 2 | AnimeTosho | `custom.animetosho` | feed.animetosho.net | High | Aggregator with exact ID lookup |
| 3 | Seadex | `custom.seadex` | releases.moe | High | Community-curated best releases |
| 4 | SubsPlease | `custom.subsplease` | subsplease.org | High | Currently-airing weekly fansubs |
| 5 | Yameii (Dubs) | `custom.yameii` | nyaa.si | High | English dub uploads (single uploader) |
| 6 | ToonsHub | `custom.toonshub` | nyaa.si | High | Dual-audio and subbed variants |
| 7 | TsukiHime | `custom.tsukihime` | api.tsukihime.org | High | Anime release index via public API |

**Repository:** https://github.com/hu-14hub/torrent  
**License:** GPL-3.0

---

## Installation

### Import into Hayase

1. Open **Hayase**.
2. Navigate to **Settings → Extensions → Repositories**.
3. Paste the manifest URL:

   ```
   https://raw.githubusercontent.com/hu-14hub/torrent/main/hayase/index.json
   ```

4. Click **Import Extensions**.
5. Go to the **Extensions** tab and toggle each source on or off as desired.

Hayase automatically polls the `update` URL on every launch, so future updates are applied automatically — simply restart Hayase to receive new versions.

---

## Configuration

### Replace the AnimeTosho Domain (Optional)

The AnimeTosho extension is pre-configured for `feed.animetosho.net`. To use your own mirror:

1. In `hayase/index.json`, update the AnimeTosho entry's `url` field with the Base64-encoded value of your domain URL:

   ```powershell
   [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('https://your-domain.com'))
   ```

2. Update the `BASE` constant in `src/animetosho.js`:

   ```js
   const BASE = 'https://your-domain.com/json'
   ```

3. Rebuild and redeploy (see **Build & Deploy** below).

---

## Build & Deploy

The extension bundles in `dist/` are compiled from `src/` using [tsup](https://tsup.egoist.dev/).

### Prerequisites

- Node.js (v18 or later)
- npm

### Build

```bash
npm install
npm run build
```

This generates the following files in `dist/`:

- `nyaa.js`
- `animetosho.js`
- `seadex.js`
- `subsplease.js`
- `yameii.js`
- `toonshub.js`
- `tsukihime.js`

### Deploy

Host the `dist/` directory on a public static file host (GitHub raw, GitHub Pages, etc.), then update every `code` and `update` URL in `hayase/index.json` to point to your hosted bundles.

---

## Project Structure

```
hayase-extension-pack/
├── hayase/
│   └── index.json          # Extension manifest (import URL for Hayase)
├── src/
│   ├── lib/
│   │   └── shared.js       # Shared HTTP, magnet, and matching helpers
│   ├── nyaa.js             # Nyaa source
│   ├── animetosho.js       # AnimeTosho source (custom domain)
│   ├── seadex.js           # Seadex source
│   ├── subsplease.js       # SubsPlease source
│   ├── yameii.js           # Yameii (dubs) source
│   ├── toonshub.js         # ToonsHub source
│   └── tsukihime.js        # TsukiHime source (public API)
├── dist/                   # Built extension bundles
├── package.json            # npm project configuration
├── tsup.config.js          # Bundler configuration
└── README.md
```

---

## Extension API

Each source exports a default object with the following methods:

| Method | Purpose |
|--------|---------|
| `single(query)` | Search for a specific episode |
| `batch(query)` | Search for batch / season packs |
| `movie(query)` | Search for movies |
| `test()` | Connection check (runs on Hayase launch) |

### Query Object

| Property | Type | Description |
|----------|------|-------------|
| `titles` | `string[]` | Anime titles to search for |
| `episode` | `number` | Target episode number |
| `episodeCount` | `number` | Total episode count of the anime |
| `anilistId` | `number` | AniList ID |
| `anidbAid` | `number` | AniDB anime ID |
| `anidbEid` | `number` | AniDB episode ID |
| `exclusions` | `string[]` | Keywords to exclude from results |
| `episodeCandidates` | `Set<number>` | Alternative episode numbers to match |
| `showSeason` | `number` | Season number |
| `showYears` | `number[]` | Release years |

### Result Object

Each result must return:

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | Release title |
| `link` | `string` | Magnet URL |
| `hash` | `string` | Torrent info hash (lowercase) |
| `seeders` | `number` | Seed count |
| `leechers` | `number` | Leech count |
| `downloads` | `number` | Download count |
| `size` | `number` | File size in bytes |
| `date` | `Date` | Release date |
| `accuracy` | `string` | Match accuracy (`high`, `medium`, `low`) |
| `type` | `string` | Optional: `'batch'` for batch releases |

---

## License

GPL-3.0