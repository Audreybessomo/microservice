# Lancer dans PowerShell administrateur depuis la copie du projet sur Windows Server.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$docker = 'C:\Program Files\docker\docker.exe'
$compose = 'C:\Program Files\docker\docker-compose.exe'

if (-not (Test-Path $docker)) {
    throw "Docker est introuvable : $docker"
}
if (-not (Test-Path $compose)) {
    throw 'Docker Compose manque. Suivre docs/DEPLOIEMENT-WINDOWS.md avant de relancer.'
}

Push-Location $projectRoot
$previousBuildkit = $env:DOCKER_BUILDKIT
try {
    $osType = & $docker info --format '{{.OSType}}'
    if ($LASTEXITCODE -ne 0 -or $osType -ne 'windows') {
        throw 'Le moteur Docker doit etre demarre en mode conteneurs Windows.'
    }
    & $compose -f compose.windows.yml config --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Configuration Compose invalide.' }

    # Les builds Windows utilisent ici le constructeur classique.
    $env:DOCKER_BUILDKIT = '0'
    & $docker build --isolation=process -f Dockerfile.windows -t mini-boutique:windows .
    if ($LASTEXITCODE -ne 0) { throw 'La construction a echoue. Les conteneurs ne sont pas lances.' }

    & $compose -f compose.windows.yml up -d --no-build
    if ($LASTEXITCODE -ne 0) { throw 'Le demarrage a echoue. Consulter les journaux Compose.' }
    & $compose -f compose.windows.yml ps
    if ($LASTEXITCODE -ne 0) { throw 'Impossible de lire l etat des conteneurs.' }
    Write-Host 'Conteneurs lances. Verifier les API comme indique dans docs/DEPLOIEMENT-WINDOWS.md.'
}
finally {
    $env:DOCKER_BUILDKIT = $previousBuildkit
    Pop-Location
}
