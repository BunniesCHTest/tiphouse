$ErrorActionPreference = "Continue"

$frontend = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000 -TimeoutSec 5
Write-Host "Frontend status:" $frontend.StatusCode

$backend = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/api/page/bunniesch -TimeoutSec 5
Write-Host "Backend status:" $backend.StatusCode
Write-Host $backend.Content
