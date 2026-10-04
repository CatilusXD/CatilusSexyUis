# go.ps1  —  right-click → Run with PowerShell  (auto-elevates to admin)
# Does everything: git pull → build driver → build exe → load driver → launch.
# Place kdmapper.exe in THIS folder, in ui\SynapseUI\, or in C:\apexbuild\.
#Requires -Version 5.1
Set-StrictMode -Off
$ErrorActionPreference = "Stop"

# ── Self-elevate ──────────────────────────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal]
          [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "Not admin — re-launching elevated..."
    Start-Process powershell.exe `
        "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" `
        -Verb RunAs
    exit
}

$root    = $PSScriptRoot                           # SEND_TO_THUNDER\
$uiDir   = Join-Path $root  "ui\SynapseUI"        # project dir (has .sln)
$slnDir  = Join-Path $root  "ui"                  # SynapseUI.sln lives here
$sln     = Join-Path $slnDir "SynapseUI.sln"
$exeOut  = Join-Path $slnDir "bin\Release-x64\SynapseRebornApex.exe"
$drvOut  = "C:\apexbuild\vesper_drv.sys"
$buildDir= "C:\apexbuild"

function Banner($msg) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Die($msg) {
    Write-Host ""
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

function Ok($msg) { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Info($msg){ Write-Host "[..] $msg" -ForegroundColor Yellow }

# ── Step 1: git pull ──────────────────────────────────────────────────────────
Banner "Step 1 — Pull latest fixes"
try {
    $branch = & git -C $root rev-parse --abbrev-ref HEAD 2>&1
    Info "Branch: $branch"
    & git -C $root fetch origin $branch 2>&1 | Write-Host
    & git -C $root pull origin $branch 2>&1 | Write-Host
    Ok "Git pull done"
} catch {
    Write-Host "[WARN] Git pull failed: $_" -ForegroundColor Yellow
    Write-Host "       Continuing with local files..."
}

# ── Step 2: Enter VS dev shell ────────────────────────────────────────────────
Banner "Step 2 — Locate Visual Studio"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { Die "vswhere not found. Install Visual Studio 2022." }

$vsBase = & $vswhere -latest -products * -property installationPath 2>$null
if (-not $vsBase -or -not (Test-Path $vsBase)) { Die "No Visual Studio installation found." }
Ok "VS: $vsBase"

$dvsDll = "$vsBase\Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
if (-not (Test-Path $dvsDll)) { Die "DevShell DLL not found: $dvsDll" }
Import-Module $dvsDll -ErrorAction Stop
Enter-VsDevShell -VsInstallPath $vsBase -SkipAutomaticLocation -DevCmdArguments "-arch=x64 -no_logo" | Out-Null
Ok "VS dev shell active"

# ── Step 3: Build kernel driver ───────────────────────────────────────────────
Banner "Step 3 — Build kernel driver"
$drvScript = Join-Path $uiDir "build_driver.ps1"
if (-not (Test-Path $drvScript)) { Die "build_driver.ps1 not found at: $drvScript" }
& $drvScript
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Die "Driver build failed (exit $LASTEXITCODE)" }
if (-not (Test-Path $drvOut)) { Die "Driver output not found: $drvOut" }
Ok "Driver built: $drvOut"

# ── Step 4: Build exe via MSBuild ─────────────────────────────────────────────
Banner "Step 4 — Build exe (MSBuild)"
if (-not (Test-Path $sln)) { Die "Solution not found: $sln" }
Info "Running MSBuild..."
& msbuild $sln /p:Configuration=Release /p:Platform=x64 /m /nologo /verbosity:minimal
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { Die "MSBuild failed (exit $LASTEXITCODE)" }
if (-not (Test-Path $exeOut)) { Die "Exe not found after build: $exeOut" }
Ok "Exe built: $exeOut"

# ── Step 5: Find kdmapper ─────────────────────────────────────────────────────
Banner "Step 5 — Find kdmapper"
$kdPaths = @(
    (Join-Path $root    "kdmapper.exe"),
    (Join-Path $uiDir   "kdmapper.exe"),
    (Join-Path $buildDir "kdmapper.exe"),
    (Join-Path $root    "..\kdmapper.exe"),
    "$env:USERPROFILE\Downloads\kdmapper.exe"
)
$kdmapper = $null
foreach ($p in $kdPaths) {
    if (Test-Path $p) { $kdmapper = (Resolve-Path $p).Path; break }
}
if (-not $kdmapper) {
    Write-Host ""
    Write-Host "[!] kdmapper.exe not found in any of these locations:" -ForegroundColor Red
    $kdPaths | ForEach-Object { Write-Host "      $_" }
    Write-Host ""
    Write-Host "  Paste the full path to kdmapper.exe:" -ForegroundColor Yellow
    $kdmapper = (Read-Host "  Path").Trim().Trim('"')
    if (-not (Test-Path $kdmapper)) { Die "kdmapper not found: $kdmapper" }
}
Ok "kdmapper: $kdmapper"

# ── Step 6: Load driver ───────────────────────────────────────────────────────
Banner "Step 6 — Load kernel driver"

# Kill any previous synapse instance so driver re-maps cleanly
Get-Process -Name "SynapseRebornApex" -ErrorAction SilentlyContinue |
    Stop-Process -Force -ErrorAction SilentlyContinue

Info "Running kdmapper..."
$kd = Start-Process -FilePath $kdmapper -ArgumentList "`"$drvOut`"" `
    -Wait -PassThru -NoNewWindow 2>&1
Write-Host "  kdmapper exit: $($kd.ExitCode)"

# Verify via regedit key written by the driver
Start-Sleep -Milliseconds 500
$dreg = Get-ItemProperty "HKLM:\SOFTWARE\VesperDrv" -ErrorAction SilentlyContinue
if ($dreg) {
    $done = $dreg.SetupDone
    if ($done -eq 99) {
        Ok "Driver loaded! SetupDone=99"
    } else {
        Write-Host "[WARN] Driver registry present but SetupDone=$done (expected 99)" -ForegroundColor Yellow
        Write-Host "       IoCreateDevice=$($dreg.IoCreateDevice)  IoCreateSymlink=$($dreg.IoCreateSymlink)"
        Write-Host "       If kdmapper gave 'WDAC block' error, disable Memory Integrity in"
        Write-Host "       Windows Security → Device Security → Core Isolation, then reboot."
    }
} else {
    Write-Host "[WARN] VesperDrv registry key not found — driver may not have loaded." -ForegroundColor Yellow
    Write-Host "       Check kdmapper output above for errors."
}

# ── Step 7: Launch the cheat ──────────────────────────────────────────────────
Banner "Step 7 — Launch SynapseRebornApex"
Write-Host ""
Write-Host "  IMPORTANT: Apex must be running in WINDOWED BORDERLESS mode." -ForegroundColor Yellow
Write-Host "  (Apex Settings → Video → Display Mode → Windowed Borderless)" -ForegroundColor Yellow
Write-Host ""
Info "Starting SynapseRebornApex.exe ..."
Start-Process -FilePath $exeOut -WorkingDirectory (Split-Path $exeOut)

# ── Step 8: Watch diag.txt ────────────────────────────────────────────────────
Banner "Step 8 — Waiting for diag.txt"
$diag = "C:\apexbuild\diag.txt"
Info "Waiting up to 30s for Apex to be detected and diag.txt to appear..."
$waited = 0
while (-not (Test-Path $diag) -and $waited -lt 30) {
    Start-Sleep -Seconds 1
    $waited++
    Write-Host "." -NoNewline
}
Write-Host ""

if (Test-Path $diag) {
    Ok "diag.txt found — contents:"
    Write-Host ""
    Write-Host ("-" * 60) -ForegroundColor DarkGray
    Get-Content $diag | Write-Host
    Write-Host ("-" * 60) -ForegroundColor DarkGray
    Write-Host ""
    Write-Host ">>> PASTE THE ABOVE OUTPUT BACK TO MOMMY <<<" -ForegroundColor Magenta
    notepad $diag
} else {
    Write-Host "[WARN] diag.txt not written after 30s." -ForegroundColor Yellow
    Write-Host "       This means either:"
    Write-Host "       1. The driver didn't load (check Step 6 warnings above)"
    Write-Host "       2. Apex is not running yet — launch Apex, wait 5s, then check C:\apexbuild\diag.txt"
}

Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
