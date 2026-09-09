# Deploy Watchfloor

Docker on a machine you control. There is no login in front of the app — do not
port-forward it on a public router.

Hosts, LLM URLs, and SSH targets are **not** in git. Before the first deploy:

```bash
cp deploy/site.env.example .env
```

Edit `.env` and replace every `YOUR_*` value. `scripts/deploy.sh` will refuse
to start until those placeholders are gone.

---

## What you will do

1. On the machine that runs LM Studio: bind the server to all interfaces and open the firewall.
2. On the dashboard host: install Docker, clone the repo, copy and edit `.env`, start the stack.
3. Open `http://<dashboard-host>:3050` from a device on the same network.
4. Later: push from a development machine and run `scripts/ship.ps1` so the server rebuilds.

---

## Part 1 — Model host (LM Studio)

The dashboard container calls `OPENAI_BASE_URL` from `.env`. That only works if
LM Studio is listening on the network, not just localhost.

### 1. LM Studio

1. Load the model you want.
2. Turn **reasoning / thinking** off.
3. Open **Developer** and start the local server on port **1234**.
4. Bind to all interfaces: **Serve on local network** / listen on `0.0.0.0`, not only `127.0.0.1`.

Check on that machine:

```powershell
curl http://127.0.0.1:1234/v1/models
```

You want a JSON list of loaded models.

### 2. Windows firewall

In an **elevated** PowerShell, from the repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows-allow-lmstudio.ps1
```

That allows TCP **1234** from the local subnet. Pass `-RemoteAddress` if you need a tighter prefix.

---

## Part 2 — First install on the dashboard host

SSH in as whatever user will own the checkout.

### 1. Install Docker

Debian / Ubuntu:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Log out and back in so the group applies, then:

```bash
docker run --rm hello-world
docker compose version
```

If `docker compose` is missing: `sudo apt install -y docker-compose-plugin`.

Also install git and curl if they are not already there:

```bash
sudo apt update && sudo apt install -y git curl
```

### 2. Clone the repo

```bash
git clone <your-repo-url> ~/watchfloor
cd ~/watchfloor
```

### 3. Site env

```bash
cp deploy/site.env.example .env
```

Set at least:

| Variable | Meaning |
| --- | --- |
| `OPENAI_BASE_URL` | LM Studio, e.g. `http://<llm-host>:1234/v1` |
| `OLLAMA_BASE_URL` | Usually `http://host.docker.internal:11434` if Ollama is on this host |
| `WATCHFLOOR_HOST_IPS` | This host's LAN IPs, comma-separated, so Docker can rewrite hairpin NAT |
| `WATCHFLOOR_SERVER` | Hostname or IP used by `scripts/ship.ps1` |
| `WATCHFLOOR_SSH_USER` | SSH user for `scripts/ship.ps1` |

`DATABASE_URL` in `.env` is ignored by Compose — the container always uses the SQLite file on the `watchfloor-data` volume. Switch provider later in Settings without a rebuild.

### 4. Open port 3050 on the server

Only if a firewall is active (`sudo ufw status`):

```bash
sudo ufw allow from <your-lan-cidr> to any port 3050 proto tcp
sudo ufw reload
```

### 5. Build and start

```bash
chmod +x scripts/deploy.sh scripts/update-if-changed.sh
./scripts/deploy.sh
```

The first image build takes several minutes. `migrate` applying the schema and then exiting with code 0 is correct.

When it finishes, open `http://<dashboard-host>:3050`.

### 6. First collection

The in-app scheduler (Settings, next to the theme toggle) will ingest on its interval and write briefs after the configured start time. To fill an empty database immediately, from the server:

```bash
curl -X POST http://127.0.0.1:3050/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"fetchImages":true,"maxPerFeed":12}'

curl -X POST http://127.0.0.1:3050/api/brief \
  -H 'Content-Type: application/json' -d '{}'
```

If the model host is off, that brief still writes — with the rules engine.

Confirm:

```bash
curl -s http://127.0.0.1:3050/api/health
curl -s http://127.0.0.1:3050/api/summarizer
```

Health should be `"status":"ok"`. Summarizer `"degraded": true` is expected when the model host is not running.

---

## Part 3 — Prove the two machines can talk

From the **dashboard host**, using the LLM URL you put in `.env`:

```bash
curl -sS --max-time 5 "$OPENAI_BASE_URL/models"
```

(Load `.env` first, or substitute the URL.)

- **JSON with models** — LM Studio is reachable. Use **Rebuild** on the brief pane (or `POST /api/brief` from part 2.6) and the items should come from the model. **Collect** only refreshes the RSS holdings.
- **Hang / connection refused** — the model host is off, LM Studio is bound to localhost only, or a firewall is blocking. The dashboard stays up either way.

From inside the container (same check the app makes):

```bash
cd ~/watchfloor
docker compose exec app wget -qO- --timeout=5 http://host.docker.internal:1234/v1/models
```

Use the URL from `.env` if LM Studio is not on the Docker host. If the host `curl` works but this fails, the Docker bridge cannot reach that address. Fixes that usually work, in order:

1. Restart Docker: `sudo systemctl restart docker` then `./scripts/deploy.sh`.
2. Confirm IP forwarding: `sysctl net.ipv4.ip_forward` should be `1`.
3. Set `WATCHFLOOR_HOST_IPS` to this machine's LAN addresses so loopback/hairpin URLs are rewritten to `host.docker.internal`.

---

## Updating production

Changes do not appear on the dashboard host until that machine pulls and rebuilds.

### From a development machine (usual path)

1. Commit on `main` (when you want to).
2. Push to origin.
3. Deploy (reads `WATCHFLOOR_SERVER` and `WATCHFLOOR_SSH_USER` from `.env`):

```powershell
.\scripts\ship.ps1
```

`ship.ps1` runs `git push origin HEAD`, SSHs to the host in `.env`, and runs `scripts/deploy.sh` (fast-forward `main`, `docker compose up -d --build`). SQLite in the volume is not wiped.

Rebuild-only, if you already pushed:

```powershell
.\scripts\ship.ps1 -SkipPush
```

If `git push` returns **403**, Git is authenticated as an account without write access to origin.

### From the server

```bash
cd ~/watchfloor
./scripts/deploy.sh
```

### Hands-off: pull every five minutes

If you would rather only `git push` from the development machine, install a user cron on the server:

```bash
crontab -e
```

```cron
*/5 * * * * /home/YOUR_LINUX_USER/watchfloor/scripts/update-if-changed.sh >> /home/YOUR_LINUX_USER/watchfloor/update.log 2>&1
```

That script no-ops when `origin/main` has not moved, and rebuilds when it has. The server still needs read access to origin (`git fetch`).

---

## Day-to-day operations

| Task | How |
| --- | --- |
| Open the floor | `http://<dashboard-host>:3050` |
| Collection interval / brief slots / LLM host | Settings in the app bar (next to light/dark) |
| Manual collect | Collect button, or `POST /api/ingest` |
| Rebuild today's brief | Rebuild on the brief pane, or `POST /api/brief` |
| Why it matters (one article) | Open a report, spark on that block |
| Logs | `cd ~/watchfloor && docker compose logs -f app` |
| Stop | `docker compose stop` |
| Start | `docker compose start` |
| Wipe the database (destructive) | `docker compose down && docker volume rm watchfloor_watchfloor-data` |

Do not enable Compose `--profile legacy-cron`. That extra curl loop would double-run ingest and briefs on top of the in-app scheduler.

Hand-written briefs still win: add `content/briefs/YYYY-MM-DD.json`, ship a new build, then `POST /api/brief`.

### Backups

```bash
mkdir -p ~/backups
cd ~/watchfloor
docker compose stop app
docker compose cp app:/app/data/watchfloor.db ~/backups/watchfloor-$(date +%F).db
docker compose start app
```

Weekly cron is enough. To restore: stop `app`, copy the file back onto `app:/app/data/watchfloor.db`, start `app`.

---

## Optional extras

### Friendly name

```bash
sudo apt install -y avahi-daemon
sudo hostnamectl set-hostname watchfloor
```

Then try `http://watchfloor.local:3050`, or add the dashboard host to each device's hosts file.

### Bare Node (no Docker)

Only if you will not run Docker. Install Node 22, put the database somewhere writable, and run `npm start` with `HOSTNAME=0.0.0.0` and the LLM URL from `.env`. Prefer Compose; it already handles schema pushes and the data volume.

---

## Troubleshooting

**Dashboard loads on the server but not from another device.**
`sudo ss -tlnp | grep 3050` should show `0.0.0.0:3050`. If it is `127.0.0.1`, set `WATCHFLOOR_BIND=0.0.0.0` and redeploy. Next suspects: host firewall, then AP/client isolation on the Wi-Fi.

**`migrate` is Exited (0).**
Expected. `docker compose logs migrate` should say the database is in sync.

**Healthcheck flapping.**
`docker compose logs app`. The process runs as UID 1001; the volume must be writable by that user.

**Empty dashboard.**
Nothing has been collected yet — run the ingest/brief curls in part 2.6. If ingest errors per feed, check outbound HTTPS.

**"database is locked".**
Two writers. Do not run `npm run ingest` against the volume while the container is up; use the HTTP APIs.

**LLM chip stays on while the model host is running.**
Work through part 3. Typical causes: LM Studio bound to `127.0.0.1`, firewall, or a different subnet.

**Ollama from Docker is unreachable even though `curl 127.0.0.1:11434` works on the host.**
The container cannot use the host’s loopback, and hairpin NAT to the host LAN IP often fails. Bind Ollama with `OLLAMA_HOST=0.0.0.0:11434`, set Settings (or `OLLAMA_BASE_URL`) to `http://host.docker.internal:11434`, and list the host LAN IPs in `WATCHFLOOR_HOST_IPS`. Prefer a 3B-class model on small CPU hosts.

**`git push` 403 from the development machine.**
Wrong git identity. The account Git is using must have write access to origin.

**`deploy.sh` says placeholders remain.**
`.env` still contains `YOUR_LLM_HOST` or `YOUR_SERVER`. Edit it from `deploy/site.env.example`.
