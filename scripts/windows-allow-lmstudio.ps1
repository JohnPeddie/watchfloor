# Lets the Linux home server reach LM Studio on this PC.
# Run elevated:
#   powershell -ExecutionPolicy Bypass -File scripts\windows-allow-lmstudio.ps1

$ErrorActionPreference = "Stop"
$name = "Watchfloor LM Studio (LAN 1234 from 192.168.8.69)"
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
  Remove-NetFirewallRule -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName $name `
  -Direction Inbound -Action Allow -Protocol TCP -LocalPort 1234 `
  -Profile Private,Domain `
  -RemoteAddress 192.168.8.0/24 | Out-Null

Write-Output "created: $name"
Write-Output "LM Studio must listen on 0.0.0.0:1234 (Developer → Serve on local network), not only 127.0.0.1."
