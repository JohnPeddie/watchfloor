# WATCHFLOOR

Personal OSINT command centre: a daily brief, RSS ingest, an interactive
day/night globe, markets, and hazard overlays — presented as a Material 3
watchfloor.

Runs on your own machines. No API keys, no cloud services, no paywalled
scrapers.

| Role | Address | What it does |
| --- | --- | --- |
| Production dashboard | `192.168.8.69:3050` | Linux home server, Docker |
| Local LLM | `192.168.8.60:1234` | This PC, LM Studio (Gemma / whatever is loaded) |

If the PC is off, the dashboard still works. Daily briefs fall back to the
rules engine, and the UI warns that local LLM summaries are offline.

**Deploy and update the server:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- **Ingests** curated RSS feeds across seven lanes (UK, UK Defence, Conflict, Oil & Gas, Markets, Cyber, Intel). Holdings cap at 300 articles; oldest drop first.
- **Extracts** the article body and usable images from each source page.
- **Classifies** each item with sector tags, a signal precedence (`FLASH` / `IMMEDIATE` / `PRIORITY` / `ROUTINE`), and an Admiralty-code source grade. That path is rules-only — the model never summarises the whole stream.
- **Briefs** the day: at least five stories, up to twelve when the day is busy. A local LLM writes those items and the BLUF when it is reachable.
- **Plots** geolocated stories on a globe with the real-time solar terminator, plus warzone and tropical-cyclone overlays.
- **Tracks** Brent/WTI, FTSE, GBP/USD, and sector ETF proxies (tech, defence, oil & gas, AI, cyber).

## Layouts

The shell follows the device, not a collapsed version of the desktop.

| Surface | What you get |
| --- | --- |
| PC / large desktop | Original three-column watchfloor: lane rail, brief, globe over the stream, insight column. |
| Laptop width | Brief + globe over the stream. Markets and the summariser card appear at desktop width; the LLM-offline strip in the app bar still shows. |
| Galaxy Z Fold inner | Brief / Articles / Markets tabs, list beside the globe. |
| Fold cover / phone | One pane at a time with a bottom nav. |

Theme, collect, fullscreen, and (when the workstation is down) the LLM-offline warning sit in the app bar. Collection cadence and the morning brief slot are in the settings cog.

## Quick start (this PC)

```bash
npm install
npm run db:setup
npm run ingest
npm run brief
npm run dev
```

Open [http://localhost:3050](http://localhost:3050). Port **3050** is deliberate so it does not collide with whatever else is on 3000.

To try it from a phone on the same network:

```bash
npm run dev:lan
npm run where
```

> **Windows ARM64 (Snapdragon):** keep `PRISMA_CLIENT_ENGINE_TYPE=binary` in `.env` (see `.env.example`).

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run db:setup` | Create SQLite DB + seed sample brief |
| `npm run db:seed` | Re-seed the sample Global Radar Report |
| `npm run ingest` | CLI RSS ingest |
| `npm run brief` | Build today's brief (authored file if present, else generated) |
| `npm run summarize` | Re-apply extractive rules analysis to stored articles |
| `npm run enrich` | Backfill body text, images, analysis and geocoding on stored articles |
| `npm run reclassify` | Re-apply tag/precedence rules to stored articles |
| `npm run stats` | Report enrichment coverage |
| `npm run where` | Print every URL the dashboard is reachable on |
| `npm run dev` | Local Next.js server |
| `npm run dev:lan` | Dev server bound to all interfaces |
| `npm run build && npm start` | Production mode on this machine |

```bash
npm run brief -- --date=2026-09-02     # rebuild a specific day
npm run brief -- --auto --dry-run      # preview generated stories, write nothing
npm run brief -- --auto --stories=5    # ignore any authored file
npm run summarize -- --limit=25
```

From Windows, ship a commit to the home server (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#updating-production)):

```powershell
$env:WATCHFLOOR_SSH_USER = "your-linux-login"
.\scripts\ship.ps1
```

## How summarisation works

Two products, two engines.

- **Each article** is tagged and summarised by the rules engine. Collection stays fast and offline.
- **The daily brief** is the only LLM job. Clusters of corroborating reports go to LM Studio, which writes the items and the bottom line. If that host is down, the same clusters are written extractively instead.

| Provider | `SUMMARIZER` | What the LLM writes |
|---|---|---|
| Rules engine | `rules` | Nothing — brief items are extractive too. |
| LM Studio / OpenAI-compat | `openai` or `lmstudio` | Daily brief items and the BLUF, via `/v1/chat/completions`. |
| Ollama | `ollama` | Same, if you point `OLLAMA_BASE_URL` at an Ollama host. |

Leave `SUMMARIZER=lmstudio` set permanently. Ingest never calls the model.

### Authoring a brief by hand

A file at `content/briefs/YYYY-MM-DD.json` always wins over generation for that date. See [`content/briefs/2026-09-02.json`](content/briefs/2026-09-02.json) for the shape. Each story's `match` array links it to ingested articles by headline substring.

### LM Studio on this PC

1. Load the model. Turn **reasoning / thinking** off — Watchfloor needs a JSON object.
2. Developer → start the server on port **1234**. For the home server, bind **0.0.0.0** / enable Serve on local network.
3. Allow TCP 1234 from the LAN (elevated): `powershell -ExecutionPolicy Bypass -File scripts\windows-allow-lmstudio.ps1`

On this PC, a local `.env` can keep `OPENAI_BASE_URL=http://127.0.0.1:1234/v1`. On the server, `deploy/env.production` points at `http://192.168.8.60:1234/v1`.

```bash
curl -s localhost:3050/api/summarizer   # degraded: false when LM Studio is up
```

## Feeds

Curated list: [`config/feeds.ts`](config/feeds.ts).

## Notes

- News is ingested via **RSS plus on-page extraction** of the publisher's own article HTML — no paywall circumvention. Follow the source link to read the full piece.
- The classification strip (`OSINT // UNCLASSIFIED`) is cosmetic.
- Geolocation uses a small place gazetteer; refine pins in authored briefs as needed.
- Adding the dashboard to a phone home screen over plain HTTP is a bookmark. Chrome only hides the address bar permanently (installed WebAPK) on HTTPS, for example a Tailscale link. The in-app fullscreen control still works on HTTP.

## Credits

Globe textures are NASA imagery in the public domain: [Blue Marble](https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) for the daylit side and [VIIRS Black Marble](https://visibleearth.nasa.gov/images/79765/night-lights-2012-map) for night lights. Country boundaries derive from [Natural Earth](https://www.naturalearthdata.com/) via world-atlas.
