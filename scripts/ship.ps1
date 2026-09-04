# Push this checkout to GitHub, then rebuild Watchfloor on the home server.
#
#   $env:WATCHFLOOR_SSH_USER = "your-linux-login"
#   .\scripts\ship.ps1
#
# Optional:
#   .\scripts\ship.ps1 -SkipPush          # server rebuild only
#   .\scripts\ship.ps1 -User flaz -Server 192.168.8.69

param(
  [string]$Server = $(if ($env:WATCHFLOOR_SERVER) { $env:WATCHFLOOR_SERVER } else { "192.168.8.69" }),
  [string]$User = $(if ($env:WATCHFLOOR_SSH_USER) { $env:WATCHFLOOR_SSH_USER } else { "" }),
  [string]$RemoteDir = $(if ($env:WATCHFLOOR_REMOTE_DIR) { $env:WATCHFLOOR_REMOTE_DIR } else { "~/watchfloor" }),
  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

if (-not $User) {
  Write-Error @"
Set your Linux SSH login first, then rerun:

  `$env:WATCHFLOOR_SSH_USER = 'your-linux-username'
  .\scripts\ship.ps1
"@
}

if (-not $SkipPush) {
  Write-Host "Pushing HEAD to origin…"
  git push origin HEAD
  if ($LASTEXITCODE -ne 0) {
    Write-Error "git push failed. Use an account that can write JohnPeddie/watchfloor, then rerun."
  }
}

$remote = "${User}@${Server}"
Write-Host "Deploying on ${remote}:${RemoteDir}…"
ssh $remote "cd $RemoteDir && chmod +x scripts/deploy.sh scripts/update-if-changed.sh && ./scripts/deploy.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Remote deploy failed."
}

Write-Host "Done. Dashboard: http://${Server}:3050"
