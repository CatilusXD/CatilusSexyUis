# build_driver.ps1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $vswhere)) { Write-Error "vswhere not found"; exit 1 }

$vsBase = & $vswhere -latest -products * -property installationPath 2>$null
if (-not $vsBase -or -not (Test-Path $vsBase)) { Write-Error "No VS found"; exit 1 }
Write-Host "VS: $vsBase"

$dvsDll = "$vsBase\Common7\Tools\Microsoft.VisualStudio.DevShell.dll"
if (-not (Test-Path $dvsDll)) { Write-Error "DevShell DLL not found: $dvsDll"; exit 1 }
Import-Module $dvsDll -ErrorAction Stop
Enter-VsDevShell -VsInstallPath $vsBase -SkipAutomaticLocation -DevCmdArguments "-arch=x64 -no_logo" | Out-Null

$kitsRoot = "C:\Program Files (x86)\Windows Kits\10"
if (-not (Test-Path $kitsRoot)) { Write-Error "WDK not found"; exit 1 }

$wdkVer = Get-ChildItem "$kitsRoot\Include" | Where-Object { $_.Name -match '^\d' } | Sort-Object Name | Select-Object -Last 1 -ExpandProperty Name
if (-not $wdkVer) { Write-Error "No WDK version found"; exit 1 }
Write-Host "WDK: $wdkVer"

$kmInc     = "$kitsRoot\Include\$wdkVer\km"
$sharedInc = "$kitsRoot\Include\$wdkVer\shared"
$kmLib     = "$kitsRoot\Lib\$wdkVer\km\x64"

foreach ($p in $kmInc, $sharedInc, $kmLib) {
    if (-not (Test-Path $p)) { Write-Error "Path not found: $p"; exit 1 }
}

New-Item -ItemType Directory -Force -Path C:\apexbuild | Out-Null
$outDir    = "C:\apexbuild"
$driverSrc = "$PSScriptRoot\driver\driver.cpp"

Write-Host "Compiling driver.cpp ..."
$compileArgs = @(
    "/nologo", "/c", "/kernel", "/GS-", "/GR-", "/EHs-c-",
    "/Gz", "/Zp8", "/O2", "/W3", "/WX-",
    "/DNDEBUG", "/D_AMD64_", "/D_WIN64",
    "/I`"$kmInc`"", "/I`"$sharedInc`"",
    "`"$driverSrc`"",
    "/Fo`"$outDir\driver.obj`""
)
$proc = Start-Process -FilePath "cl.exe" -ArgumentList $compileArgs -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) { Write-Error "Compile failed (exit $($proc.ExitCode))"; exit 1 }

Write-Host "Linking vesper_drv.sys ..."
$linkArgs = @(
    "/nologo", "/NODEFAULTLIB",
    "/SUBSYSTEM:NATIVE", "/DRIVER",
    "/ENTRY:DriverEntry", "/ALIGN:0x40",
    "/LIBPATH:`"$kmLib`"",
    "ntoskrnl.lib",
    "`"$outDir\driver.obj`"",
    "/OUT:`"$outDir\vesper_drv.sys`""
)
$proc = Start-Process -FilePath "link.exe" -ArgumentList $linkArgs -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) { Write-Error "Link failed (exit $($proc.ExitCode))"; exit 1 }

$size = (Get-Item "$outDir\vesper_drv.sys").Length
Write-Host "Done: $outDir\vesper_drv.sys ($size bytes)"