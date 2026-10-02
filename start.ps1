param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$pythonPath = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) {
    throw 'Create .venv first: python -m venv .venv, then run .\start.ps1 -Install'
}
if ($Install) {
    & $pythonPath -m pip install -r (Join-Path $projectRoot 'backend\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
    Push-Location (Join-Path $projectRoot 'frontend')
    try { npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' } }
    finally { Pop-Location }
}
$backendRoot = Join-Path $projectRoot 'backend'
Push-Location $backendRoot
try {
    & $pythonPath -c "import app.models; from app.database import initialize_database; initialize_database()"
    if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
} finally { Pop-Location }
$logRoot = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$nodePath = (Get-Command node.exe).Source
$frontendRoot = Join-Path $projectRoot 'frontend'
$vitePath = Join-Path $frontendRoot 'node_modules\vite\bin\vite.js'
if (!(Test-Path -LiteralPath $vitePath)) { throw 'Install frontend dependencies with npm ci inside frontend.' }
& $pythonPath (Join-Path $projectRoot 'scripts\start_local.py') $nodePath
if ($LASTEXITCODE -ne 0) { throw 'Server startup failed. Check .runtime logs.' }
