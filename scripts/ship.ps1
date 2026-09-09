# Push this checkout to origin, then rebuild Watchfloor on the server in .env.
#
# Fill deploy/site.env.example into .env first (WATCHFLOOR_SERVER, WATCHFLOOR_SSH_USER).
#
#   .\scripts\ship.ps1
#   .\scripts\ship.ps1 -SkipPush

param(
  [string]$Server = "",
  [string]$User = "",
  [string]$RemoteDir = "",
  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Read-DotEnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path $Path)) { return $null }
  foreach ($line in Get-Content $Path) {
    if ($line -match "^\s*$Key=(.*)$") {
      return $Matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$envFile = @(
  (Join-Path $Root "deploy\site.env"),
  (Join-Path $Root ".env")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $Server) { $Server = $env:WATCHFLOOR_SERVER }
if (-not $Server -and $envFile) { $Server = Read-DotEnvValue $envFile "WATCHFLOOR_SERVER" }

if (-not $User) { $User = $env:WATCHFLOOR_SSH_USER }
if (-not $User -and $envFile) { $User = Read-DotEnvValue $envFile "WATCHFLOOR_SSH_USER" }

if (-not $RemoteDir) { $RemoteDir = $env:WATCHFLOOR_REMOTE_DIR }
if (-not $RemoteDir -and $envFile) { $RemoteDir = Read-DotEnvValue $envFile "WATCHFLOOR_REMOTE_DIR" }
if (-not $RemoteDir) { $RemoteDir = "~/watchfloor" }

if (-not $User -or -not $Server -or $Server -eq "YOUR_SERVER" -or $User -eq "YOUR_SSH_USER") {
  Write-Error @"
Set the deploy host in .env (from deploy/site.env.example):

  WATCHFLOOR_SERVER=your.server.hostname
  WATCHFLOOR_SSH_USER=your-linux-username

Or pass -Server and -User.
"@
}

if (-not $SkipPush) {
  Write-Host "Pushing HEAD to origin…"
  git push origin HEAD
  if ($LASTEXITCODE -ne 0) {
    Write-Error "git push failed. Check that this checkout can write to origin, then rerun."
  }
}

$remote = "${User}@${Server}"
Write-Host "Deploying on ${remote}:${RemoteDir}…"
ssh $remote "cd $RemoteDir && chmod +x scripts/deploy.sh scripts/update-if-changed.sh && ./scripts/deploy.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Error "Remote deploy failed."
}

$port = "3050"
if ($envFile) {
  $fromEnv = Read-DotEnvValue $envFile "WATCHFLOOR_PORT"
  if ($fromEnv) { $port = $fromEnv }
}
Write-Host "Done. Dashboard: http://${Server}:${port}"
