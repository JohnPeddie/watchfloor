# WATCHFLOOR

Personal OSINT command centre: a daily brief, RSS ingest, an interactive
day/night globe, a desk of weather and markets, and hazard overlays —
presented as a Material 3 watchfloor.

Runs on your own machines. No API keys, no cloud services, no paywalled
scrapers.

Hosts and LLM URLs are not in this repo. Copy
[`deploy/site.env.example`](deploy/site.env.example) to `.env` and fill it in
before you deploy.

**Deploy:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What it does

- **Ingests** curated RSS feeds across UK, defence, conflict, cyber, energy, markets, tech, US, sport, and intel. Holdings size is set in Settings (default 300); oldest drop first. UK desk and defence feeds take a full ingest quota; US political, consumer-tech, and US market wires take about a third; niche sport feeds take a quarter so they cannot crowd the stream.
- **Extracts** the article body and usable images from each source page.
- **Classifies** each item with sector tags, a signal precedence (`FLASH` / `IMMEDIATE` / `PRIORITY` / `ROUTINE`), and an Admiralty-code source grade. That path is rules-only — the model never summarises the whole stream.
- **Briefs** the day: at least five stories, more when the day is busy. A local LLM writes those items and the BLUF when it is reachable.
- **Plots** geolocated stories on a globe with the real-time solar terminator, plus warzone and tropical-cyclone overlays. How many photos sit on the globe is set in Settings; the rest are small yellow dots. Generic US reports are spread across the country rather than stacked on Washington.
- **Tracks** Brent/WTI, FTSE, GBP/USD, and sector ETF proxies (tech, defence, oil & gas, AI, cyber).
- **Checks** the weather: current conditions and a five-day outlook for a searchable city (Open-Meteo), plus UK Met Office warnings. Change city from the weather card or Settings.
- **Shows** the live UK national terrorism threat level in the app bar (desktop), from the official MI5 feed. The chip opens [MI5’s threat-levels page](https://www.mi5.gov.uk/threats-and-advice/terrorism-threat-levels).

Weather, warnings, and the threat chip are fail-soft: a down feed keeps the last good cache (or an empty card) and does not blank the dashboard.

## Layouts

The shell follows the device, not a collapsed version of the desktop.

| Surface | What you get |
| --- | --- |
| PC / large desktop | Three-column watchfloor: lane rail, brief, globe over the stream, insight column. UK threat chip in the app bar. |
| Laptop width | Brief + globe over the stream. The insight column and threat chip appear at desktop width; the LLM-offline strip in the app bar still shows. |
| Tablet / foldable inner | Brief / Articles / Markets tabs, list beside the globe. Markets is the desk of insight cards. |
| Phone / foldable cover | One pane at a time with a bottom nav: Brief, Articles, Globe, Desk. |

Theme, settings, collect, fullscreen, and (when the model host is down) the LLM-offline warning sit in the app bar. Collection cadence, holdings size, globe photos, weather city, insight-card order, brief slots, and which local model to use are in Settings.

Reorder the desk cards (weather, energy, markets, sectors, precedence, classification, collection, summarisation) under Settings → Insights. The same order is used on the phone Desk tab, the tablet Markets tab, and the PC side pane.

## How classification works

Every collected article is tagged and graded by keyword rules in
[`src/lib/classify.ts`](src/lib/classify.ts). No model is involved.

**Tags** come from word lists (NATO, ransomware, Bank of England, and so on).
Matches are whole words, so `uk` does not fire inside `Ukrainians`. A hit in
the headline counts three times as much as one in the excerpt. At most four
tags are kept. Theatre tags — KINETIC, TERROR, NUCLEAR, ESPIONAGE — need
stronger evidence than sector tags, so a court story is not labelled as a war.
The collecting feed can seed a sector tag (BBC UK → UK, a cyber feed → CYBER)
but never a theatre tag.

**Precedence** is a second, smaller list plus how old the item is:

| Grade | What it needs |
| --- | --- |
| **FLASH** | Two distinct flash words in the **headline**, published in the last 12 hours |
| **IMMEDIATE** | One flash word in the headline, last 24 hours |
| **PRIORITY** | Two flash/immediate words in title+excerpt, or one such word plus DEFENCE / CYBER / ENERGY / KINETIC |
| **ROUTINE** | Everything else |

US-only copy then drops one rung, so a Pentagon story that would be IMMEDIATE
becomes PRIORITY unless the text (or a UK feed) also earns a UK tag.

**Confidence** (15–92%) is keyword density, not “this report is true.”

The **summary** on the article is a separate extractive pass: a few informative
sentences from the body. The canned **Why it matters** line is a UK-desk
template from the strongest substance tag. Open a report and use the spark to
ask the local LLM to rewrite that one line; the rest of the stream stays
rules-only.

After changing the word lists, re-tag stored articles with
`npm run reclassify`. That does not re-fetch pages, and it does not overwrite
an LLM why-it-matters line.

## Quick start (development)

```bash
cp .env.example .env
npm install
npm run db:setup
npm run ingest
npm run brief
npm run dev
```

Open [http://localhost:3050](http://localhost:3050). Port **3050** is deliberate so it does not collide with whatever else is on 3000.

To try it from another device on the same network:

```bash
npm run dev:lan
npm run where
```

> **Windows ARM64:** keep `PRISMA_CLIENT_ENGINE_TYPE=binary` in `.env` (see `.env.example`).

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
| `npm test` | Typecheck plus guards for errors that have broken the Docker `next build` |
| `npm run typecheck` | TypeScript only (`tsc --noEmit`) |
| `npm run dev` | Local Next.js server |
| `npm run dev:lan` | Dev server bound to all interfaces |
| `npm run build && npm start` | Production mode on this machine |

```bash
npm run brief -- --date=2026-09-02     # rebuild a specific day
npm run brief -- --auto --dry-run      # preview generated stories, write nothing
npm run brief -- --auto --stories=5    # ignore any authored file
npm run summarize -- --limit=25
```

From a development machine, ship a commit to the server named in `.env` (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md#updating-production)):

```powershell
.\scripts\ship.ps1
```

## How summarisation works

Two products, two engines — plus one optional click.

- **Each article** is tagged and summarised by the rules engine. Collection stays fast and offline.
- **The daily brief** is the main LLM job. Clusters of corroborating reports go to LM Studio or Ollama, which writes the items and the bottom line. If that host is down, the same clusters are written extractively instead.
- **Why it matters** on an open article can be rewritten by the same model when you click the spark. That is one article at a time, and only when you ask.

| Provider | `SUMMARIZER` / Settings | What the LLM writes |
|---|---|---|
| Rules engine | `rules` | Nothing — brief items are extractive too. |
| LM Studio / OpenAI-compat | `lmstudio` or `openai` | Daily brief items, the BLUF, and on-demand why-it-matters, via `/v1/chat/completions`. |
| Ollama | `ollama` | Same, via `/api/generate`. From Docker, point at `host.docker.internal`, not loopback. |

Leave `SUMMARIZER=lmstudio` (or `ollama`) set permanently. Ingest never calls the model. After a brief or a why-it-matters click, Ollama is asked to unload the weights.

### Authoring a brief by hand

A file at `content/briefs/YYYY-MM-DD.json` always wins over generation for that date. See [`content/briefs/2026-09-02.json`](content/briefs/2026-09-02.json) for the shape. Each story's `match` array links it to ingested articles by headline substring.

### LM Studio

1. Load the model. Turn **reasoning / thinking** off — Watchfloor needs a JSON object.
2. Developer → start the server on port **1234**. For a remote dashboard, bind **0.0.0.0** / enable Serve on local network.
3. Allow TCP 1234 from the LAN (elevated): `powershell -ExecutionPolicy Bypass -File scripts\windows-allow-lmstudio.ps1`

A local `.env` can keep `OPENAI_BASE_URL=http://127.0.0.1:1234/v1`. On the dashboard host, set the LLM URL in `.env` from [`deploy/site.env.example`](deploy/site.env.example). Switch provider and host in Settings without a rebuild.

```bash
curl -s localhost:3050/api/summarizer   # degraded: false when the chosen host is up
```

### Ollama on the same host as Docker

Bind Ollama to all interfaces (`OLLAMA_HOST=0.0.0.0:11434`). From the container, loopback and the host's own LAN IP are the wrong addresses — use `host.docker.internal`, and list the host LAN IPs in `WATCHFLOOR_HOST_IPS` so they are rewritten. On a small CPU-only box, a 3B-class model such as `qwen2.5:3b` is the realistic size.

## Feeds

Curated list: [`config/feeds.ts`](config/feeds.ts). Lanes on a feed seed sector tags only; the wording still has to earn kinetic, terror, nuclear, or espionage.

## Notes

- News is ingested via **RSS plus on-page extraction** of the publisher's own article HTML — no paywall circumvention. Follow the source link to read the full piece.
- The classification strip (`OSINT // UNCLASSIFIED`) is cosmetic. The real tags and precedence live on each article.
- Geolocation uses a small place gazetteer; refine pins in authored briefs as needed.
- Weather and the UK threat level are public HTTPS feeds. They need outbound access from the dashboard host; they do not need API keys.
- Adding the dashboard to a phone home screen over plain HTTP is a bookmark. Chrome only hides the address bar permanently (installed WebAPK) on HTTPS. The in-app fullscreen control still works on HTTP.

## Credits

Globe textures are NASA imagery in the public domain: [Blue Marble](https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) for the daylit side and [VIIRS Black Marble](https://visibleearth.nasa.gov/images/79765/night-lights-2012-map) for night lights. Country boundaries derive from [Natural Earth](https://www.naturalearthdata.com/) via world-atlas.

Forecast data by [Open-Meteo](https://open-meteo.com/). UK warnings from the [Met Office](https://www.metoffice.gov.uk/). National terrorism threat level from [MI5 / JTAC](https://www.mi5.gov.uk/threats-and-advice/terrorism-threat-levels). The weather card is a desk check, not a substitute for Met Office notices.
