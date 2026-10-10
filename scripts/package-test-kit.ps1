[CmdletBinding()]
param(
    # Measurements to ship when the release itself was not re-measured (client-only changes).
    [string]$EvaluationVersion = ''
)
$ErrorActionPreference = "Stop"
# Archive of the 0.1.x test kit, kept for reference only.
throw "Archive : ce script assemblait le kit d'essai 0.1.x. Les versions passent désormais par l'installateur signé (release GitHub) et la mise à jour intégrée ; il n'y a plus de kit à produire."
$repo = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $repo "package.json") -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "Unexpected release version" }
if (-not $EvaluationVersion) { $EvaluationVersion = $version }
$release = Join-Path $repo "release"
$kit = Join-Path $release "Overtype-$version-test-kit"
$installer = Join-Path $release "Overtype_${version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $installer)) { throw "Build and copy the installer to $installer first" }
New-Item -ItemType Directory -Path $kit -Force | Out-Null
Copy-Item -LiteralPath $installer -Destination $kit
$serverFiles = git -C $repo ls-files server
if ($LASTEXITCODE -ne 0) { throw "Cannot list tracked server files" }
foreach ($relative in $serverFiles) {
    $destination = Join-Path $kit $relative
    New-Item -ItemType Directory -Path (Split-Path $destination -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repo $relative) -Destination $destination
}
Copy-Item -LiteralPath (Join-Path $repo "docs/ESSAIS-$version.md") -Destination (Join-Path $kit "LIRE-POUR-TESTER.md")
Copy-Item -LiteralPath (Join-Path $repo "docs/VALIDATION.md") -Destination $kit
Copy-Item -LiteralPath (Join-Path $repo "public/THIRD-PARTY-INTERACTION-LICENSES.txt") -Destination $kit
$evaluation = Join-Path $kit "evaluation"
New-Item -ItemType Directory -Path $evaluation -Force | Out-Null
Copy-Item -Path (Join-Path $release "evaluation-$EvaluationVersion/*") -Destination $evaluation
Copy-Item -LiteralPath (Join-Path $repo "docs/evaluation/$EvaluationVersion/README.md") -Destination $evaluation
# Launches the installed client with a synthetic engine: real capture, labelled simulated answers.
# ASCII on purpose: cmd echoes in the console code page.
@'
@echo off
setlocal
set "EXE=%LOCALAPPDATA%\Overtype\Overtype.exe"
if not exist "%EXE%" set "EXE=%~dp0Overtype.exe"
if not exist "%EXE%" (
  echo Overtype.exe introuvable. Installez d'abord l'application, ou copiez ce fichier dans son dossier.
  pause
  exit /b 1
)
tasklist /FI "IMAGENAME eq Overtype.exe" | find /I "Overtype.exe" >nul
if not errorlevel 1 (
  echo Quittez d'abord Overtype depuis l'icone de notification, puis relancez ce fichier.
  pause
  exit /b 1
)
start "" "%EXE%" --simulate-inference
echo Overtype est lance en mode simule : selectionnez un texte puis Ctrl+Alt+T.
'@ | Set-Content -LiteralPath (Join-Path $kit "Mode-simule.cmd") -Encoding ASCII
@"
Overtype $version - kit d'essai Windows pour un autre poste

1. Installer avec Overtype_${version}_x64-setup.exe (par utilisateur, sans droits administrateur).
2. Tester l'interface sans serveur : Mode-simule.cmd lance le client en mode simulé
   (capture réelle, réponse synthétique). Sélectionner un texte puis Ctrl+Alt+T.
   Sortir la souris de la bulle : elle se replie en onglet en bas de l'écran ; le survoler la rouvre.
3. Vraie traduction, seulement si ce poste a Docker Desktop (moteur Linux) et une carte NVIDIA :
   powershell -NoProfile -ExecutionPolicy Bypass -File .\server\start.ps1 -Profile fast
   puis Réglages, mode Rapide, Enregistrer et vérifier le moteur. Les poids (~4 Go) se téléchargent au premier lancement.
   Un serveur distant n'est accepté qu'en HTTPS : hors périmètre de ce kit.
4. Quitter Overtype depuis l'icône de notification avant toute réinstallation.

LIRE-POUR-TESTER.md détaille l'installation, les points à observer et quoi rapporter.
VALIDATION.md distingue les contrôles automatiques faits et ce qui reste à confirmer à l'œil.
evaluation contient les mesures de la version $EvaluationVersion (résultats synthétiques, aucun texte utilisateur).
Les moteurs écoutent uniquement en local. Fermer le client ne décharge pas les modèles.
Pour arrêter uniquement ces moteurs sans effacer leurs caches :
docker compose -f .\server\compose.yaml --profile fast --profile quality down
"@ | Set-Content -LiteralPath (Join-Path $kit "COMMENCER.txt") -Encoding UTF8
$manifest = [ordered]@{
    version = $version
    evaluationVersion = $EvaluationVersion
    sourceCommit = (git -C $repo rev-parse HEAD)
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    installerSha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
    simulation = $false
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $kit "manifest.json") -Encoding UTF8
$archive = Join-Path $release "Overtype-$version-test-kit.zip"
Compress-Archive -Path (Join-Path $kit '*') -DestinationPath $archive -Force
Get-Item -LiteralPath $archive | Select-Object FullName,Length
