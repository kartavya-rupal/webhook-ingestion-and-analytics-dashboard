$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "Starting local infrastructure..."
docker compose up -d

Write-Host "Waiting for LocalStack to become ready..."
$maxAttempts = 30
$attempt = 0
$ready = $false

while ($attempt -lt $maxAttempts) {
    try {
        $health = Invoke-RestMethod "http://localhost:4566/_localstack/health"
        if ($health.services.s3 -eq "running" -and $health.services.sqs -eq "running") {
            $ready = $true
            break
        }
    } catch {
        # keep waiting
    }

    Start-Sleep -Seconds 2
    $attempt++
}

if (-not $ready) {
    throw "LocalStack is not ready. Check Docker Compose logs."
}

Write-Host "Bootstrapping LocalStack..."
& .\scripts\bootstrap-localstack.ps1

Write-Host ""
Write-Host "Local infra is ready."
Write-Host "Next steps:"
Write-Host "1. Run npm run db:migrate"
Write-Host "2. Run npm run dev:all"
Write-Host "3. Open http://localhost:3000"
Write-Host ""
Write-Host "Use npm run dev:status to verify the stack."