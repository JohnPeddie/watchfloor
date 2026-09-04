# Allows LAN clients to reach the dashboard on its port.
# Run elevated: powershell -ExecutionPolicy Bypass -File scripts\firewall-3050.ps1
$name = "Watchfloor dashboard (LAN 3050)"
Get-NetFirewallRule -DisplayName "Watchfloor dashboard (LAN 3000)" -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue |
    Remove-NetFirewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $name `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3050 `
    -Profile Any -RemoteAddress LocalSubnet, 100.64.0.0/10, 172.16.0.0/12 | Out-Null
Write-Output "created: $name"
