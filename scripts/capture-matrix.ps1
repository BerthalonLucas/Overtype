param(
    [string]$Executable = "$env:USERPROFILE\Apps\Overtype\Overtype.exe",
    [int]$Port = 9227,
    [string]$OutputDirectory = '',
    # A fresh data folder per run: the build-target executable would otherwise read and
    # rewrite the installed app's settings.json and history (%APPDATA%\com.flowtranslate.desktop).
    [string]$DataDirectory = '',
    # Optional settings.json copied into that folder before launch (e.g. uiVersion « ilot »).
    [string]$SettingsFile = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $projectRoot 'release\native-ui-probe' }
$resolvedExe = (Resolve-Path -LiteralPath $Executable).Path
if (Get-Process -Name Overtype -ErrorAction SilentlyContinue) {
    throw 'Fermez Overtype avant ce test : le contrôle ne doit pas rejoindre une session utilisateur existante.'
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    throw "Le port $Port est occupé. Choisissez un autre port."
}
$previousArgs = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
$previousData = $env:WEBVIEW2_USER_DATA_FOLDER
$previousEndpoint = $env:FLOWTRANSLATE_CDP_URL
$previousDataDir = $env:FLOWTRANSLATE_DATA_DIR
if (-not $DataDirectory) { $DataDirectory = Join-Path $projectRoot "release\native-data\$([guid]::NewGuid())" }
New-Item -ItemType Directory -Force -Path $DataDirectory | Out-Null
if ($SettingsFile) { Copy-Item -LiteralPath $SettingsFile -Destination (Join-Path $DataDirectory 'settings.json') -Force }
$testProcess = $null
try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
    $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $projectRoot "release\native-profiles\$([guid]::NewGuid())"
    $env:FLOWTRANSLATE_CDP_URL = "http://127.0.0.1:$Port"
    $env:FLOWTRANSLATE_DATA_DIR = $DataDirectory
    # The notice then names the capture step that gave up (no text is ever included).
    $env:FLOWTRANSLATE_CAPTURE_TRACE = '1'
    # 0.6: a fresh data folder would open the first-run setup over the applications under test.
    $env:FLOWTRANSLATE_SKIP_SETUP = '1'
    $testProcess = Start-Process -FilePath $resolvedExe -ArgumentList '--simulate-inference' -WindowStyle Hidden -PassThru
    # The probe inspects the HWNDs of this process only (scripts/inspect-native-windows.ps1).
    $env:FLOWTRANSLATE_TEST_PID = "$($testProcess.Id)"
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $null = Invoke-RestMethod "$env:FLOWTRANSLATE_CDP_URL/json/version" -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw 'WebView2 ne répond pas sur le port de test.' }
    & node (Join-Path $PSScriptRoot 'capture-matrix.mjs') $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Le test WebView2 a échoué. Voir la sortie précédente.' }
} finally {
    # Only stop the process launched by this test, never all Overtype processes.
    if ($testProcess -and -not $testProcess.HasExited) { $testProcess.Kill(); $testProcess.WaitForExit(5000) | Out-Null }
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArgs
    $env:WEBVIEW2_USER_DATA_FOLDER = $previousData
    $env:FLOWTRANSLATE_CDP_URL = $previousEndpoint
    $env:FLOWTRANSLATE_DATA_DIR = $previousDataDir
    Remove-Item Env:FLOWTRANSLATE_TEST_PID -ErrorAction SilentlyContinue
    Remove-Item Env:FLOWTRANSLATE_CAPTURE_TRACE -ErrorAction SilentlyContinue
    Remove-Item Env:FLOWTRANSLATE_SKIP_SETUP -ErrorAction SilentlyContinue
}
