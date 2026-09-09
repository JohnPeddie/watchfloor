#!/usr/bin/env bash
# Rebuild and restart Watchfloor on this machine.
# Safe to run repeatedly. Data lives in the Docker volume and is not wiped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "No .env found. Copy the template and fill in hosts before deploying:" >&2
  echo "  cp deploy/site.env.example .env" >&2
  exit 1
fi

if grep -Eq 'YOUR_LLM_HOST|YOUR_SERVER|YOUR_SSH_USER' .env; then
  echo ".env still contains YOUR_* placeholders. Edit it, then rerun." >&2
  exit 1
fi

if [ -d .git ]; then
  echo "Resetting to origin/main…"
  git fetch origin
  git reset --hard origin/main
  chmod +x scripts/deploy.sh scripts/update-if-changed.sh 2>/dev/null || true
fi

echo "Building and starting containers…"
docker compose up -d --build

PORT="$(grep -E '^WATCHFLOOR_PORT=' .env | cut -d= -f2- | tr -d '"' | tr -d "'" || true)"
PORT="${PORT:-3050}"

echo "Waiting for /api/health…"
ok=0
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1 \
    || wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" 2>/dev/null; then
    ok=1
    break
  fi
  sleep 2
done

if [ "$ok" -ne 1 ]; then
  echo "App did not become healthy in time. Recent logs:" >&2
  docker compose logs --tail=80 app
  exit 1
fi

echo
echo "Watchfloor is up."
echo "  Local:  http://127.0.0.1:${PORT}"
if command -v hostname >/dev/null 2>&1; then
  lan="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "${lan:-}" ]; then
    echo "  LAN:    http://${lan}:${PORT}"
  fi
fi
echo
docker compose ps
echo
echo "LLM probe (degraded:true is fine if the model host is off):"
curl -fsS "http://127.0.0.1:${PORT}/api/summarizer" 2>/dev/null | head -c 800 || true
echo
