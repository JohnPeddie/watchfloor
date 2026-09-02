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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
| `npm run enrich` | Backfill body text, images, analysis and geocoding on stored articles |
| `npm run reclassify` | Re-apply tag/precedence rules to stored articles |
| `npm run stats` | Report enrichment coverage |
| `npm run dev` | Local Next.js server |
| `npm run build && npm start` | Production mode on this machine |

### Authoring a daily brief (manual / agent)

Until Ollama is enabled, briefs are authored data — not auto-summarised. Edit [`prisma/seed.ts`](prisma/seed.ts) or insert via Prisma / SQLite:

- `DailyBrief.date` — `YYYY-MM-DD`
- `DailyBrief.title` — e.g. `Global Radar Report – Monday, 31 August 2026`
- `BriefStory` rows — `headline`, `body` (paragraphs separated by blank lines), optional `placeLabel` / `lat` / `lng`

Re-run `npm run db:seed` after editing the seed file.

### Local LLM later

1. Install [Ollama](https://ollama.com) and pull a model (`ollama pull llama3.2`).
2. Set in `.env`:

```
SUMMARIZER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
```

3. Call `getSummarizer()` from a future brief-generation script/API — the stub lives in [`src/lib/summarizer/`](src/lib/summarizer/).

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
