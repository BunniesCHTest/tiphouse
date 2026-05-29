$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:Path = "C:\Program Files\nodejs;" + $env:Path

Write-Host "Starting Docker services: postgres + redis"
& "C:\Program Files\Docker\Docker\resources\bin\docker.exe" compose --env-file .env up -d postgres redis

Write-Host "Generating Prisma client"
& "C:\Program Files\nodejs\npm.cmd" run prisma:generate -w apps/backend

Write-Host "Applying database migrations"
& "C:\Program Files\nodejs\npm.cmd" run prisma:dev -w apps/backend -- --name init

Write-Host "Seeding database"
& "C:\Program Files\nodejs\npm.cmd" run db:seed

Write-Host "Building backend and frontend"
& "C:\Program Files\nodejs\npm.cmd" run build -w apps/backend
& "C:\Program Files\nodejs\npm.cmd" run build -w apps/frontend

Write-Host "Starting backend on http://127.0.0.1:4000"
Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" -ArgumentList "run","start","-w","apps/backend" -WorkingDirectory $root -WindowStyle Hidden

Write-Host "Starting frontend on http://127.0.0.1:3000"
Start-Process -FilePath "C:\Program Files\nodejs\npm.cmd" -ArgumentList "run","start","-w","apps/frontend" -WorkingDirectory $root -WindowStyle Hidden

Write-Host "TipHouse local production stack is starting."
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend:  http://127.0.0.1:4000/api"
