$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Stopping local infrastructure..."
docker compose down --remove-orphans

Write-Host "Local infrastructure stopped."