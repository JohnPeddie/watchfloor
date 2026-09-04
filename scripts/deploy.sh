#!/usr/bin/env bash
# Rebuild and restart Watchfloor on this machine (the Linux home server).
# Safe to run repeatedly. Data lives in the Docker volume and is not wiped.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  if [ -f deploy/env.production ]; then
    echo "No .env found — copying deploy/env.production"
    cp deploy/env.production .env
  else
    echo "No .env and no deploy/env.production template." >&2
    exit 1
  fi
fi

if [ -d .git ]; then
  echo "Pulling origin/main…"
  git fetch origin
  git pull --ff-only origin main
fi

echo "Building and starting containers…"
docker compose up -d --build

echo "Waiting for /api/health…"
ok=0
for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:3050/api/health >/dev/null 2>&1 \
    || wget -q -O /dev/null http://127.0.0.1:3050/api/health 2>/dev/null; then
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
echo "  Local:  http://127.0.0.1:3050"
if command -v hostname >/dev/null 2>&1; then
  lan="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "${lan:-}" ]; then
    echo "  LAN:    http://${lan}:3050"
  fi
fi
echo
docker compose ps
echo
echo "LLM probe (PC at 192.168.8.60). degraded:true is fine if that machine is off:"
curl -fsS http://127.0.0.1:3050/api/summarizer 2>/dev/null | head -c 800 || true
echo
