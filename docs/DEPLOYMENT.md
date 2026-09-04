# Deploy Watchfloor on the home server

This is the runbook for **this** household.

| Machine | Address | Role |
| --- | --- | --- |
| Linux home server | `192.168.8.69` | Production dashboard (Docker), port **3050** |
| Windows workstation | `192.168.8.60` | LM Studio on port **1234** — writes daily brief items only |

The server never needs the PC to be on. Feeds, the globe, markets, and the article stream keep working. When LM Studio cannot be reached, daily briefs use the rules engine and the dashboard shows **LLM offline**.

Do not port-forward 3050 on the router. There is no login in front of the app. Away-from-home access should go through a VPN or Tailscale.

---

## What you will do

1. On this PC: let the server talk to LM Studio (firewall + bind address).
2. On the Linux box: install Docker, clone the repo, copy the production env, start the stack.
3. Open `http://192.168.8.69:3050` from a phone or laptop on the LAN.
4. Later: push from this PC and run `scripts/ship.ps1` so the server rebuilds.

Total time on a quiet network is usually 15–25 minutes, most of it the first Docker build.

---

## Part 1 — This PC (192.168.8.60)

The production container on `.69` calls `http://192.168.8.60:1234/v1`. That only works if LM Studio is listening on the LAN, not just localhost.

### 1. LM Studio

1. Load the model you want (Gemma is fine).
2. Turn **reasoning / thinking** off.
3. Open **Developer** and start the local server on port **1234**.
4. Bind to all interfaces: **Serve on local network** / listen on `0.0.0.0`, not only `127.0.0.1`.

Check from this PC:

```powershell
curl http://127.0.0.1:1234/v1/models
```

You want a JSON list of loaded models.

### 2. Windows firewall

In an **elevated** PowerShell, from the repo:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\windows-allow-lmstudio.ps1
```

That allows TCP **1234** from `192.168.8.0/24`.

---

## Part 2 — First install on the Linux server (192.168.8.69)

SSH in:

```bash
ssh YOUR_LINUX_USER@192.168.8.69
```

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
git clone https://github.com/JohnPeddie/watchfloor.git ~/watchfloor
cd ~/watchfloor
```

Use SSH (`git@github.com:JohnPeddie/watchfloor.git`) instead if the repo is private.

### 3. Production env

```bash
cp deploy/env.production .env
```

That file already points the LLM at `http://192.168.8.60:1234/v1` and publishes the dashboard on all interfaces, port 3050. Edit `.env` only if those addresses change.

`DATABASE_URL` in `.env` is ignored by Compose — the container always uses the SQLite file on the `watchfloor-data` volume.

### 4. Open port 3050 on the server

Only if a firewall is active (`sudo ufw status`):

```bash
sudo ufw allow from 192.168.8.0/24 to any port 3050 proto tcp
sudo ufw reload
```

### 5. Build and start

```bash
chmod +x scripts/deploy.sh scripts/update-if-changed.sh
./scripts/deploy.sh
```

The first image build takes several minutes. `migrate` applying the schema and then exiting with code 0 is correct.

When it finishes you should be able to open:

```
http://192.168.8.69:3050
```

### 6. First collection

The in-app scheduler (settings cog) will ingest on its interval and write the morning brief after the configured time. To fill an empty database immediately, from the server:

```bash
curl -X POST http://127.0.0.1:3050/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"fetchImages":true,"maxPerFeed":12}'

curl -X POST http://127.0.0.1:3050/api/brief \
  -H 'Content-Type: application/json' -d '{}'
```

If the PC is off, that brief still writes — with the rules engine.

Confirm:

```bash
curl -s http://127.0.0.1:3050/api/health
curl -s http://127.0.0.1:3050/api/summarizer
```

Health should be `"status":"ok"`. Summarizer `"degraded": true` is expected when LM Studio is not running; `"degraded": false` when this PC is up and the server can reach port 1234.

---

## Part 3 — Prove the two machines can talk

From the **server**:

```bash
curl -sS --max-time 5 http://192.168.8.60:1234/v1/models
```

- **JSON with models** — LM Studio is reachable. Use **Rebuild** on the brief pane (or `POST /api/brief` from part 2.6) and the items should come from the model. **Collect** only refreshes the RSS holdings.
- **Hang / connection refused** — the PC is off, LM Studio is bound to localhost only, or the Windows firewall is blocking. The dashboard stays up either way.

From inside the container (same check the app makes):

```bash
cd ~/watchfloor
docker compose exec app wget -qO- --timeout=5 http://192.168.8.60:1234/v1/models
```

If the host `curl` works but this fails, the Docker bridge cannot reach the LAN. Fixes that usually work, in order:

1. Restart Docker: `sudo systemctl restart docker` then `./scripts/deploy.sh`.
2. Confirm IP forwarding: `sysctl net.ipv4.ip_forward` should be `1`.
3. Last resort: in `docker-compose.yml` under `app`, set `network_mode: host`, remove the `ports:` block, and recreate the container. Host mode publishes 3050 directly on the server.

---

## Updating production

Changes do not appear on `.69` until the server pulls and rebuilds. GitHub cannot reach this LAN by itself.

### From this PC (usual path)

1. Commit on `main` (when you want to).
2. Push with an account that can write `JohnPeddie/watchfloor`.
3. Deploy:

```powershell
$env:WATCHFLOOR_SSH_USER = "your-linux-login"
.\scripts\ship.ps1
```

`ship.ps1` runs `git push origin HEAD`, SSHs to `192.168.8.69`, and runs `scripts/deploy.sh` (fast-forward `main`, `docker compose up -d --build`). SQLite in the volume is not wiped.

Rebuild-only, if you already pushed:

```powershell
$env:WATCHFLOOR_SSH_USER = "your-linux-login"
.\scripts\ship.ps1 -SkipPush
```

If `git push` returns **403**, GitHub is authenticated as an account without write access. Switch credentials (GitHub CLI `gh auth login`, or a PAT/SSH key for `JohnPeddie`) and push again.

### From the server

```bash
cd ~/watchfloor
./scripts/deploy.sh
```

### Hands-off: pull every five minutes

If you would rather only `git push` from the PC, install a user cron on the server:

```bash
crontab -e
```

```cron
*/5 * * * * /home/YOUR_LINUX_USER/watchfloor/scripts/update-if-changed.sh >> /home/YOUR_LINUX_USER/watchfloor/update.log 2>&1
```

That script no-ops when `origin/main` has not moved, and rebuilds when it has. The server still needs read access to the GitHub repo (`git fetch`).

---

## Day-to-day operations

| Task | How |
| --- | --- |
| Open the floor | `http://192.168.8.69:3050` |
| Collection interval / morning brief | Settings cog on the dashboard (in-app scheduler) |
| Manual collect | Collect button, or `POST /api/ingest` |
| Rebuild today's brief | `POST /api/brief` |
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

Then try `http://watchfloor.local:3050`. Or add `192.168.8.69    watchfloor` to each device's hosts file.

### Reverse proxy on port 80

Bind the app to localhost first (`WATCHFLOOR_BIND=127.0.0.1` in `.env`, then `./scripts/deploy.sh`) and put Caddy in front:

```caddyfile
http://watchfloor.local, http://192.168.8.69 {
	reverse_proxy 127.0.0.1:3050
}
```

Skip public HTTPS on a LAN-only box. For an installed Android/PWA that hides the address bar, use Tailscale HTTPS instead.

### Bare Node (no Docker)

Only if you will not run Docker. Install Node 22, clone to `/opt/watchfloor`, put the database at `/var/lib/watchfloor/watchfloor.db`, and run `npm start` under systemd with `HOSTNAME=0.0.0.0` and `OPENAI_BASE_URL=http://192.168.8.60:1234/v1`. Prefer Compose; it already handles schema pushes and the data volume.

---

## Troubleshooting

**Dashboard loads on the server but not from a phone.**
`sudo ss -tlnp | grep 3050` should show `0.0.0.0:3050`. If it is `127.0.0.1`, set `WATCHFLOOR_BIND=0.0.0.0` and redeploy. Next suspects: `ufw`, then AP/client isolation on the Wi-Fi.

**`migrate` is Exited (0).**
Expected. `docker compose logs migrate` should say the database is in sync.

**Healthcheck flapping.**
`docker compose logs app`. The process runs as UID 1001; the volume must be writable by that user.

**Empty dashboard.**
Nothing has been collected yet — run the ingest/brief curls in part 2.6. If ingest errors per feed, check outbound HTTPS: `curl -sI https://feeds.bbci.co.uk/news/uk/rss.xml`.

**"database is locked".**
Two writers. Do not run `npm run ingest` against the volume while the container is up; use the HTTP APIs.

**LLM chip stays on while this PC is running.**
Work through part 3. Typical causes: LM Studio bound to `127.0.0.1`, firewall, or the PC on a different subnet than `.69`.

**`git push` 403 from this PC.**
Wrong GitHub identity. The clone is `JohnPeddie/watchfloor`; the account Git is using must have write access.
