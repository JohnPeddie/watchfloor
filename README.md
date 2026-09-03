# WATCHFLOOR

Personal OSINT command centre: daily Global Radar–style briefs, RSS ingest, an interactive day/night globe, and oil/FX panels — presented in a Material 3 dark watchfloor UI.

Runs entirely on your own machine. No API keys, no cloud services, no paywalled scrapers.

## What it does

- **Ingests** curated RSS feeds across seven lanes (UK, UK Defence, Conflict, Oil & Gas, Markets, Cyber, Intel).
- **Extracts** the full article body and every usable image from each source page.
- **Summarises** extractively — a lead-biased sentence scorer produces the analysis, and a rules engine derives a "so what" implication from the assigned tags.
- **Classifies** each item with sector tags (`DEFENCE`, `ENERGY`, `CYBER`, `KINETIC`, …), a signal precedence (`FLASH` / `IMMEDIATE` / `ROUTINE`), and an Admiralty-code source grade.
- **Plots** geolocated stories on a globe lit by the real-time solar terminator, with NASA night-lights city glow on the dark side and article thumbnails as markers.

## Quick start (laptop)

```bash
npm install
npm run db:setup
npm run ingest
npm run brief
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The layout adapts to the
screen it is on:

| Width | Layout |
| --- | --- |
| Below 768px (phones) | One pane at a time via the bottom navigation bar. The app bar and lane chips slide away as you scroll so the reporting gets the full screen, and return when you scroll back up. |
| 768–1279px (tablets) | Two columns — reporting on the left (brief above the stream), globe and analysis on the right. Lane chips stay as a horizontal row. |
| 1280px and up (desktop) | Three columns, with the vertical lane rail on the far left. |

To reach it from a phone or tablet on the same network, serve on all
interfaces and ask for the current URL:

```bash
npm run dev:lan
npm run where
```

`npm run where` matters because the laptop's DHCP address changes whenever it
joins a different network. It lists every address the dashboard answers on and
flags which ones survive a network change.

To run it on a Linux server and reach it from anywhere on your network, see
**[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

> **Windows ARM64 (Snapdragon):** Prisma uses `engineType = "binary"` so the x64 query engine can run under emulation. Keep `PRISMA_CLIENT_ENGINE_TYPE=binary` in `.env` (see `.env.example`).

### Layout

- **Nav rail** (far left): lane and tag filtering.
- **Brief pane** (left): the day's authored Global Radar Report. Click a story to fly the globe to it.
- **Globe** (centre): live day/night terminator, country boundaries, and pins for brief stories and geolocated articles. Clicking a pin opens the detail sheet.
- **Traffic pane** (centre, below): the full article feed with thumbnails, tags, precedence and source grades.
- **Insight pane** (right): Brent, WTI, GBP/USD and FTSE sparklines, classification breakdown, and collection status.
- **Detail sheet**: image carousel, extracted analysis, implication, source link and related articles.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run db:setup` | Create SQLite DB + seed sample brief |
| `npm run db:seed` | Re-seed the sample Global Radar Report |
| `npm run ingest` | CLI RSS ingest |
| `npm run brief` | Build today's brief (authored file if present, else generated) |
| `npm run summarize` | Re-summarise articles with the active provider |
| `npm run enrich` | Backfill body text, images, analysis and geocoding on stored articles |
| `npm run reclassify` | Re-apply tag/precedence rules to stored articles |
| `npm run stats` | Report enrichment coverage |
| `npm run where` | Print every URL the dashboard is reachable on |
| `npm run dev` | Local Next.js server |
| `npm run dev:lan` | Dev server bound to all interfaces, for phones and tablets |
| `npm run build && npm start` | Production mode on this machine |

Useful flags:

```bash
npm run brief -- --date=2026-09-02     # rebuild a specific day
npm run brief -- --auto --dry-run      # preview generated stories, write nothing
npm run brief -- --auto --stories=5    # ignore any authored file
npm run summarize -- --limit=25        # bounded batch
npm run summarize -- --all             # re-do everything
```

## How summarisation works

There are two products — a per-article read and the daily brief — and both go
through one provider interface in
[`src/lib/summarize/types.ts`](src/lib/summarize/types.ts). Swapping the engine
is an environment variable, not a code change.

| Provider | `SUMMARIZER` | Behaviour |
|---|---|---|
| Rules engine | `rules` (default) | Frequency-scored sentence extraction plus tag-driven implication templates. Offline, instant, always available. |
| Ollama | `ollama` | A local LLM writes the analysis, the implication, each brief story and the bottom line. |

Two properties make this safe to leave pointed at Ollama permanently:

- **Automatic fallback.** Every run probes the provider first. If the model
  host is off, unreachable, or missing the model, the run degrades to the rules
  engine rather than failing, and says so. The dashboard's Summarisation card
  shows when this has happened.
- **Provenance.** Each article records which provider wrote its analysis in
  `analysisSource`. Ingest never overwrites a summary from a better provider
  with a rule-generated one, and `npm run summarize` targets only what is
  missing or stale — so enabling Ollama upgrades the backlog and later runs
  become no-ops.

Ingest deliberately stays on the offline engine to keep collection fast; the
LLM runs as a separate pass.

### Authoring a brief by hand

A file at `content/briefs/YYYY-MM-DD.json` always wins over generation for
that date, so a written product is never clobbered by a scheduled run. See
[`content/briefs/2026-09-02.json`](content/briefs/2026-09-02.json) for the
shape. Each story's `match` array links it to ingested articles by headline
substring, which populates "Related reporting" in the detail sheet.

With no authored file, `npm run brief` clusters the last 30 hours of reporting
by headline overlap, shared location and shared themes, ranks the clusters by
urgency, corroboration and standing relevance, and writes up the top seven.

### Enabling Ollama

```bash
ollama pull llama3.1:8b
```

```
SUMMARIZER=ollama
OLLAMA_BASE_URL=http://192.168.1.50:11434   # wherever the model runs
OLLAMA_MODEL=llama3.1:8b
```

```bash
curl -s localhost:3000/api/summarizer   # confirm reachable, not degraded
npm run summarize -- --limit=50         # upgrade existing summaries
```

Full network setup, including binding Ollama to the LAN, is in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#adding-the-ollama-summariser).

### Feeds

Curated list: [`config/feeds.ts`](config/feeds.ts). Lanes: UK, UK Defence, Conflict, Oil & Gas, Markets, Cyber, Intel.

### Home server (Docker)

```bash
docker compose up -d --build
```

SQLite persists in the `watchfloor-data` volume. Point `OLLAMA_BASE_URL` at your host Ollama if needed.

### Notes

- News is ingested via **RSS plus on-page extraction** of the publisher's own article HTML — no paywall circumvention. Only headlines, short extracts and links are stored; follow the source link to read the full piece.
- Classification strip is cosmetic (`OSINT // UNCLASSIFIED`) for UI feel only.
- Geolocation uses a small place gazetteer — refine pins in brief stories as needed.
- Summaries are rule-based extraction, not generative. Expect the odd awkward sentence until Ollama is wired in.

### Credits

Globe textures are NASA imagery in the public domain: [Blue Marble](https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) for the daylit side and [VIIRS Black Marble](https://visibleearth.nasa.gov/images/79765/night-lights-2012-map) for night lights. Country boundaries derive from [Natural Earth](https://www.naturalearthdata.com/) via world-atlas.
