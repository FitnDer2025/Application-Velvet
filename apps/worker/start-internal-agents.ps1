$ErrorActionPreference = 'Stop'

$workerDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $workerDirectory '../..')
$environmentFile = Join-Path $workerDirectory '.env.internal.local'
$exampleFile = Join-Path $workerDirectory '.env.internal.example'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 24 ou plus récent est requis.' -ForegroundColor Red
  Write-Host 'Installe Node.js, ferme PowerShell, puis relance ce script.'
  exit 1
}

$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) {
  Write-Host "Version Node détectée : $(node --version). Node.js 24 ou plus récent est requis." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $environmentFile)) {
  Copy-Item $exampleFile $environmentFile
  Write-Host 'Le fichier apps/worker/.env.internal.local vient d’être créé.' -ForegroundColor Yellow
  Write-Host 'Complète DATABASE_URL et, facultativement, OPENAI_API_KEY puis relance le script.'
  Start-Process notepad.exe $environmentFile
  exit 1
}

$environmentText = Get-Content $environmentFile -Raw
if ($environmentText -notmatch '(?m)^DATABASE_URL=.+') {
  Write-Host 'DATABASE_URL est vide dans apps/worker/.env.internal.local.' -ForegroundColor Red
  Start-Process notepad.exe $environmentFile
  exit 1
}

Push-Location $repositoryRoot
try {
  if (-not (Test-Path (Join-Path $repositoryRoot 'node_modules'))) {
    Write-Host 'Installation locale des dépendances Velvet…' -ForegroundColor Cyan
    npm install
  }

  Write-Host ''
  Write-Host 'Moteur Velvet IA interne démarré.' -ForegroundColor Green
  Write-Host 'Laisse cette fenêtre ouverte pendant tes tests. Ctrl+C pour arrêter.'
  Write-Host ''

  node --env-file="$environmentFile" apps/worker/src/worker.mjs
} finally {
  Pop-Location
}
