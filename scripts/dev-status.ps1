$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== Docker Compose ==="
docker compose ps

Write-Host ""
Write-Host "=== LocalStack Health ==="
try {
    $localstack = Invoke-RestMethod "http://localhost:4566/_localstack/health"
    $localstack | ConvertTo-Json -Depth 6
} catch {
    Write-Host "LocalStack not reachable at http://localhost:4566"
}

Write-Host ""
Write-Host "=== API Health ==="
try {
    $apiHealth = Invoke-RestMethod "http://localhost:4000/health"
    $apiHealth | ConvertTo-Json -Depth 6
} catch {
    Write-Host "API not reachable at http://localhost:4000"
}

Write-Host ""
Write-Host "=== API Readiness ==="
try {
    $apiReady = Invoke-RestMethod "http://localhost:4000/ready"
    $apiReady | ConvertTo-Json -Depth 6
} catch {
    Write-Host "API readiness endpoint not reachable yet"
}