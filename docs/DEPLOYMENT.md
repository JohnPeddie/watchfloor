# Hosting Watchfloor on a Linux server over the local network

This walks through putting Watchfloor on a Linux box and reaching it from any
device on your network — laptop, phone, tablet — without exposing it to the
internet.

Two routes are covered. **Docker Compose** is the recommended one and is what
the rest of this document assumes. **Bare Node with systemd** is documented at
the end for machines where you would rather not run Docker.

- [Before you start](#before-you-start)
- [Route A: Docker Compose](#route-a-docker-compose-recommended)
- [Making it reachable on the LAN](#making-it-reachable-on-the-lan)
- [A friendly hostname instead of an IP](#a-friendly-hostname-instead-of-an-ip)
- [Port 80 with a reverse proxy](#port-80-with-a-reverse-proxy)
- [Scheduled collection](#scheduled-collection)
- [Adding the Ollama summariser](#adding-the-ollama-summariser)
- [Backups](#backups)
- [Updating](#updating)
- [Route B: bare Node with systemd](#route-b-bare-node-with-systemd)
- [Troubleshooting](#troubleshooting)

---

## Before you start

You need:

- A 64-bit Linux machine (x86_64 or arm64 — a Raspberry Pi 4/5 is fine), kept
  powered on.
- Around 2 GB of free disk for images and the database.
- SSH access, or a keyboard on the box itself.
- The server and your other devices on the same network or VLAN.

Check the architecture and distribution:

```bash
uname -m          # x86_64 or aarch64
cat /etc/os-release
```

### Install Docker

On Debian, Ubuntu or Raspberry Pi OS:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in so the group change applies, then confirm it works without
`sudo`:

```bash
docker run --rm hello-world
docker compose version
```

> If `docker compose version` fails but `docker-compose` works, you have the
> older standalone tool. Substitute `docker-compose` for `docker compose`
> throughout, or install the plugin: `sudo apt install docker-compose-plugin`.

---

## Route A: Docker Compose (recommended)

### 1. Get the code onto the server

```bash
sudo apt update && sudo apt install -y git
git clone https://github.com/JohnPeddie/watchfloor.git
cd watchfloor
```

### 2. Configure it

The compose file reads a `.env` file sitting next to it. Start from the
template:

```bash
cp .env.example .env
nano .env
```

For a first run the defaults are fine. The values that matter for LAN hosting:

| Variable | Default | What it does |
|---|---|---|
| `WATCHFLOOR_BIND` | `0.0.0.0` | Interface to publish on. `0.0.0.0` means every device on the network can connect. Set `127.0.0.1` to restrict to the server itself. |
| `WATCHFLOOR_PORT` | `3000` | Port on the host. Change if 3000 is taken. |
| `SUMMARIZER` | `rules` | `rules` is offline and always works. Switch to `ollama` later. |
| `CYCLE_SECONDS` | `3600` | Seconds between automatic collection runs. |
| `TZ` | `Europe/London` | Affects timestamps in logs. |

Note that `DATABASE_URL` is **not** read from this file for the containers —
compose sets it explicitly to the path inside the data volume. Leave the value
in `.env` alone; it is used for local development on your laptop.

### 3. Build and start

```bash
docker compose up -d --build
```

The first build takes several minutes because it compiles the Next.js
application. Three services come up in order:

1. `migrate` applies the database schema to the volume, then exits. Seeing it
   as `Exited (0)` is correct and expected — it is not a crash.
2. `app` serves the dashboard, and reports healthy once `/api/health` responds.
3. `scheduler` starts collecting on the interval you configured.

Check the state:

```bash
docker compose ps
docker compose logs -f app
```

### 4. Load the first brief and collect

The database starts empty. Populate it:

```bash
# Pull the feeds
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"fetchImages":true,"maxPerFeed":12}'

# Build today's brief
curl -X POST http://localhost:3000/api/brief \
  -H 'Content-Type: application/json' -d '{}'
```

Then confirm the app considers itself well:

```bash
curl -s http://localhost:3000/api/health
```

You want `"status":"ok"` with a non-zero article count.

---

## Making it reachable on the LAN

### 1. Find the server's address

```bash
hostname -I | awk '{print $1}'
```

Say that prints `192.168.1.42`. From any other device on the network, open:

```
http://192.168.1.42:3000
```

### 2. Give the server a fixed address

If the address comes from DHCP it will eventually change and your bookmarks
will break. Two ways to fix it, and the first is usually easier:

**Reserve it on your router.** Find the DHCP or LAN settings, locate the
server by its MAC address, and assign a static lease. Nothing to configure on
the server.

**Or set it on the server** with NetworkManager:

```bash
nmcli connection show                     # find the connection name
sudo nmcli connection modify "Wired connection 1" \
  ipv4.method manual \
  ipv4.addresses 192.168.1.42/24 \
  ipv4.gateway 192.168.1.1 \
  ipv4.dns "192.168.1.1,1.1.1.1"
sudo nmcli connection up "Wired connection 1"
```

Pick an address outside your router's DHCP pool so nothing else is handed the
same one.

### 3. Open the firewall

Only needed if a firewall is active. Check with `sudo ufw status`.

```bash
# Allow just your local subnet, not the whole world
sudo ufw allow from 192.168.1.0/24 to any port 3000 proto tcp
sudo ufw reload
```

On Fedora, RHEL or CentOS:

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

> **Do not port-forward this on your router.** There is no authentication in
> front of the dashboard, and `/api/ingest` will fetch arbitrary URLs on
> request. Keep it inside your network. If you want access while away, use a
> VPN or Tailscale rather than exposing the port.

---

## A friendly hostname instead of an IP

Typing an IP address gets old. Options, cheapest first.

### mDNS — `http://watchfloor.local:3000`

Works out of the box from Macs, iPhones, iPads and most Linux desktops.
Windows needs Bonjour installed, which it often already has.

```bash
sudo apt install -y avahi-daemon
sudo hostnamectl set-hostname watchfloor
sudo systemctl restart avahi-daemon
```

### Hosts file on each device

Crude but reliable. Add to `/etc/hosts` (macOS and Linux) or
`C:\Windows\System32\drivers\etc\hosts` (Windows, as Administrator):

```
192.168.1.42    watchfloor
```

### Router-level DNS

The most convenient if your router supports it — one change covers every
device automatically. Look for "Local DNS", "DNS host names" or "static DNS
entries" in the admin interface and map `watchfloor` to the server's address.
Pi-hole and OPNsense both do this well.

---

## Port 80 with a reverse proxy

To drop the `:3000`, put Caddy in front. It is a single binary with a
three-line config.

First, bind the app to localhost only, so the proxy is the sole entry point.
In `.env`:

```
WATCHFLOOR_BIND=127.0.0.1
```

Then `docker compose up -d` to apply it. Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Replace `/etc/caddy/Caddyfile` with:

```caddyfile
http://watchfloor.local, http://192.168.1.42 {
	reverse_proxy 127.0.0.1:3000
}
```

```bash
sudo systemctl reload caddy
sudo ufw allow from 192.168.1.0/24 to any port 80 proto tcp
```

The dashboard is now at `http://watchfloor.local`.

> Skip HTTPS on a LAN-only deployment. A public certificate needs a public
> domain, and a self-signed one produces browser warnings on every device.
> Plain HTTP inside your own network is the pragmatic choice here. If you do
> want TLS, Caddy's `tls internal` will issue a local certificate, but you
> must then install its root CA on every client device.

---

## Scheduled collection

The `scheduler` service handles this already. It calls the app over HTTP on a
loop — ingest, then a batch of summaries, then rebuild the brief. Driving it
through the API rather than writing to the database directly matters: SQLite
tolerates exactly one writer comfortably, and this keeps the app as that
writer.

Adjust the cadence in `.env`:

```
CYCLE_SECONDS=1800      # every 30 minutes
SUMMARIZE_BATCH=20      # articles re-summarised per cycle
```

```bash
docker compose up -d scheduler
docker compose logs -f scheduler
```

### If you would rather use cron

Remove or comment out the `scheduler` service, then:

```bash
crontab -e
```

```cron
# Collect hourly, rebuild the brief at 06:00
17 * * * * curl -fsS -m 600 -X POST http://localhost:3000/api/ingest -H 'Content-Type: application/json' -d '{"fetchImages":true,"maxPerFeed":12}' >/dev/null
0  6 * * * curl -fsS -m 600 -X POST http://localhost:3000/api/brief -H 'Content-Type: application/json' -d '{}' >/dev/null
```

### Writing your own brief

Automatic generation is a fallback. A hand-written brief always wins for its
date. Drop a file at `content/briefs/YYYY-MM-DD.json` — copy
`content/briefs/2026-09-02.json` as a template — and the next brief build will
import it instead of generating one. Because the file is baked into the image,
rebuild after adding one:

```bash
docker compose up -d --build app
curl -X POST http://localhost:3000/api/brief -H 'Content-Type: application/json' -d '{}'
```

Each story's `match` array links it to real ingested articles by headline
substring, which is what populates "Related reporting" in the detail sheet.
Entries containing `+` require every part to be present, so
`"tanker+killed"` matches only headlines with both words.

---

## Adding the Ollama summariser

Until this is set up, summaries come from the offline rules engine. Ollama
replaces them with written prose.

### 1. Install Ollama

On the machine that will run the model — the same server, or a beefier box
with a GPU:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b
```

`llama3.1:8b` is a sensible starting point at roughly 5 GB. On a Pi or a
low-memory server try `llama3.2:3b`. With a 12 GB or larger GPU,
`llama3.1:70b` or `qwen2.5:32b` produce noticeably better writing.

### 2. Let it listen on the network

By default Ollama binds to localhost only, so nothing else can reach it. If
the model host is a **different machine** from Watchfloor:

```bash
sudo systemctl edit ollama
```

Add:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo ufw allow from 192.168.1.0/24 to any port 11434 proto tcp
```

Verify from the Watchfloor server:

```bash
curl -s http://192.168.1.50:11434/api/tags
```

That should list your pulled models. If it hangs or refuses, Ollama is still
bound to localhost or the firewall is blocking it.

### 3. Point Watchfloor at it

In `.env`:

```
SUMMARIZER=ollama

# Ollama on the same Docker host as Watchfloor:
OLLAMA_BASE_URL=http://host.docker.internal:11434

# Ollama on another machine:
# OLLAMA_BASE_URL=http://192.168.1.50:11434

OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT_MS=120000
```

```bash
docker compose up -d app
curl -s http://localhost:3000/api/summarizer
```

You are looking for `"degraded": false` and the ollama provider showing
`"reachable": true`. If `degraded` is true, the `detail` field says why —
usually the host being unreachable or the model not being pulled.

### 4. Upgrade the existing summaries

Every article records which summariser produced its analysis, so switching
provider makes the old rule-generated ones eligible for replacement. The
scheduler drains this backlog automatically at `SUMMARIZE_BATCH` per cycle.
To push it along:

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H 'Content-Type: application/json' -d '{"limit":50}'
```

The response includes `remaining`, so you can watch the backlog fall. Once it
reaches zero, briefs and article summaries are all model-written.

**What runs where.** Ingest deliberately keeps using the fast offline
summariser so collection stays quick, and it will never overwrite a summary
that came from a better provider. The LLM work happens in the separate
summarise pass. If the model host goes down, everything continues on the rules
engine and the Summarisation card in the dashboard shows the degradation.

---

## Backups

Everything lives in one SQLite file inside the `watchfloor_watchfloor-data`
volume. Back it up with SQLite's own online backup, which is safe to run while
the app is writing:

```bash
mkdir -p ~/backups
docker compose exec -T app sh -c \
  'sqlite3 /app/data/watchfloor.db ".backup /app/data/backup.db"' 2>/dev/null \
  || docker compose cp app:/app/data/watchfloor.db ~/backups/watchfloor-$(date +%F).db
```

The runtime image has no `sqlite3` binary, so the fallback copy is what will
normally run. For a guaranteed-consistent copy, stop the app first:

```bash
docker compose stop app scheduler
docker compose cp app:/app/data/watchfloor.db ~/backups/watchfloor-$(date +%F).db
docker compose start app scheduler
```

A weekly cron entry is enough:

```cron
30 4 * * 0 cd /home/youruser/watchfloor && docker compose cp app:/app/data/watchfloor.db /home/youruser/backups/watchfloor-$(date +\%F).db
```

To restore, stop the stack, copy the file back to
`app:/app/data/watchfloor.db`, and start it again.

---

## Updating

```bash
cd watchfloor
git pull
docker compose up -d --build
```

The `migrate` service reapplies the schema on every start, so model changes
are picked up without any manual step. Your data is in the volume and survives
rebuilds.

To roll back, check out the previous commit and rebuild:

```bash
git log --oneline -5
git checkout <previous-sha>
docker compose up -d --build
```

---

## Route B: bare Node with systemd

For machines where Docker is unwelcome.

```bash
# Node 22 via nodesource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git

git clone https://github.com/JohnPeddie/watchfloor.git
sudo mv watchfloor /opt/watchfloor
cd /opt/watchfloor

sudo useradd --system --home /opt/watchfloor watchfloor
sudo mkdir -p /var/lib/watchfloor
sudo chown -R watchfloor:watchfloor /opt/watchfloor /var/lib/watchfloor
```

Create `/opt/watchfloor/.env`:

```
DATABASE_URL="file:/var/lib/watchfloor/watchfloor.db"
SUMMARIZER="rules"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="llama3.1:8b"
```

Build and initialise:

```bash
sudo -u watchfloor npm ci
sudo -u watchfloor npx prisma db push --skip-generate
sudo -u watchfloor npm run build
sudo -u watchfloor npm run ingest
sudo -u watchfloor npm run brief
```

Create `/etc/systemd/system/watchfloor.service`:

```ini
[Unit]
Description=Watchfloor intelligence dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=watchfloor
WorkingDirectory=/opt/watchfloor
EnvironmentFile=/opt/watchfloor/.env
# Bind all interfaces so the LAN can reach it.
Environment=HOSTNAME=0.0.0.0
Environment=PORT=3000
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

# Basic hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/watchfloor

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now watchfloor
sudo systemctl status watchfloor
```

For scheduled collection, add a timer.
`/etc/systemd/system/watchfloor-collect.service`:

```ini
[Unit]
Description=Watchfloor collection cycle

[Service]
Type=oneshot
User=watchfloor
WorkingDirectory=/opt/watchfloor
EnvironmentFile=/opt/watchfloor/.env
ExecStart=/usr/bin/npm run ingest
ExecStart=/usr/bin/npm run summarize -- --limit=25
ExecStart=/usr/bin/npm run brief
```

`/etc/systemd/system/watchfloor-collect.timer`:

```ini
[Unit]
Description=Run Watchfloor collection hourly

[Timer]
OnBootSec=5min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now watchfloor-collect.timer
systemctl list-timers watchfloor-collect.timer
```

---

## Troubleshooting

**Reachable on the server but not from other devices.**
Confirm what the port is bound to:

```bash
sudo ss -tlnp | grep 3000
```

`0.0.0.0:3000` or `*:3000` is correct. `127.0.0.1:3000` means it is
localhost-only — set `WATCHFLOOR_BIND=0.0.0.0` and re-run
`docker compose up -d`. If the binding looks right, the firewall is the next
suspect, then client-side isolation on the router (many access points have an
"AP isolation" or "guest network" setting that blocks device-to-device
traffic).

**`migrate` shows as exited.**
That is correct. It applies the schema and stops. Check it succeeded with
`docker compose logs migrate` — you want "Your database is now in sync".

**Health check failing, app restarting.**
`docker compose logs app`. Most often the data volume is not writable; the
container runs as UID 1001 and the volume must be owned by it. Recreating the
volume fixes a permissions mess, at the cost of the data:
`docker compose down && docker volume rm watchfloor_watchfloor-data`.

**Empty dashboard.**
Nothing has been collected. Run the ingest and brief calls from step 4. If
ingest reports errors per feed, check outbound DNS and HTTPS from the server:
`curl -sI https://feeds.bbci.co.uk/news/uk/rss.xml`.

**"database is locked".**
Two processes are writing at once. Do not run the CLI scripts against the same
database file while the container is running — use the HTTP endpoints instead,
which is what the scheduler does.

**Summaries still look mechanical after enabling Ollama.**
Check `curl -s http://localhost:3000/api/summarizer`. If `degraded` is true,
the fallback is active and the `detail` field explains why. If it is false,
the backlog simply has not drained yet — see step 4 of the Ollama section.

**Globe is blank or slow on a phone.**
It needs WebGL. Older or low-end devices struggle with the texture load; turn
off the Imagery toggle to drop the article thumbnails, which is the most
expensive layer.
