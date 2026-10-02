param(
    # The per-user install of the NSIS installer (0.5.0); pass -Executable for a build target.
    [string]$Executable = "$env:LOCALAPPDATA\Overtype\Overtype.exe",
    [int]$Port = 9227,
    [string]$OutputDirectory = '',
    # A fresh data folder per run: the build-target executable would otherwise read and
    # rewrite the installed app's settings.json and history (%APPDATA%\com.flowtranslate.desktop).
    [string]$DataDirectory = '',
    # settings.json copied into that folder before launch. By default the probe's own
    # (scripts/native-ui-settings/<Theme>.json): the demo opens the reader the probe checks first,
    # no global shortcut is registered, and the Îlot (uiVersion's default) runs its journey.
    [string]$SettingsFile = '',
    [ValidateSet('light', 'dark')]
    [string]$Theme = 'light',
    # Delay between simulated words (FLOWTRANSLATE_SIMULATE_WORD_MS): the Îlot's work pill and its
    # halo window must last long enough for the probe's region and halo checks.
    [int]$WordMs = 1000
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
$previousWordMs = $env:FLOWTRANSLATE_SIMULATE_WORD_MS
if (-not $DataDirectory) { $DataDirectory = Join-Path $projectRoot "release\native-data\$([guid]::NewGuid())" }
New-Item -ItemType Directory -Force -Path $DataDirectory | Out-Null
if (-not $SettingsFile) { $SettingsFile = Join-Path $PSScriptRoot "native-ui-settings\$Theme.json" }
Copy-Item -LiteralPath $SettingsFile -Destination (Join-Path $DataDirectory 'settings.json') -Force
$testProcess = $null
try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=$Port"
    $env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $projectRoot "release\native-profiles\$([guid]::NewGuid())"
    $env:FLOWTRANSLATE_CDP_URL = "http://127.0.0.1:$Port"
    $env:FLOWTRANSLATE_DATA_DIR = $DataDirectory
    $env:FLOWTRANSLATE_SIMULATE_WORD_MS = "$WordMs"
    $testProcess = Start-Process -FilePath $resolvedExe -ArgumentList '--demo-selection' -WindowStyle Hidden -PassThru
    # The probe inspects the HWNDs of this process only (scripts/inspect-native-windows.ps1).
    $env:FLOWTRANSLATE_TEST_PID = "$($testProcess.Id)"
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        try { $null = Invoke-RestMethod "$env:FLOWTRANSLATE_CDP_URL/json/version" -TimeoutSec 1; $ready = $true; break } catch { Start-Sleep -Milliseconds 250 }
    }
    if (-not $ready) { throw 'WebView2 ne répond pas sur le port de test.' }
    & node (Join-Path $PSScriptRoot 'probe-native-ui.mjs') $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Le test WebView2 a échoué. Voir la sortie précédente.' }
} finally {
    # Only stop the process launched by this test, never all Overtype processes.
    if ($testProcess -and -not $testProcess.HasExited) { $testProcess.Kill(); $testProcess.WaitForExit(5000) | Out-Null }
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArgs
    $env:WEBVIEW2_USER_DATA_FOLDER = $previousData
    $env:FLOWTRANSLATE_CDP_URL = $previousEndpoint
    $env:FLOWTRANSLATE_DATA_DIR = $previousDataDir
    $env:FLOWTRANSLATE_SIMULATE_WORD_MS = $previousWordMs
    Remove-Item Env:FLOWTRANSLATE_TEST_PID -ErrorAction SilentlyContinue
}
