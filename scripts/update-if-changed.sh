#!/usr/bin/env bash
# If origin/main has moved, fast-forward and rebuild.
# Optional cron/systemd helper so a git push updates the server without SSH.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "Not a git checkout: $ROOT" >&2
  exit 1
fi

git fetch origin
local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse origin/main)"

if [ "$local_sha" = "$remote_sha" ]; then
  echo "Already on origin/main ($local_sha)"
  exit 0
fi

echo "Updating $local_sha → $remote_sha"
exec "$ROOT/scripts/deploy.sh"
