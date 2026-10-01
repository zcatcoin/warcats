param([int]$GameProcessId = 0, [string]$SnapshotPath = (Join-Path $PSScriptRoot 'live.json'))
$ErrorActionPreference = 'Stop'
if ($GameProcessId -eq 0) {
    $games = @(Get-Process -Name 'WardogsClient-Win64-Shipping' -ErrorAction SilentlyContinue)
    if ($games.Count -ne 1) { throw 'Start WARDOGS first, or supply -GameProcessId for the target window.' }
    $GameProcessId = $games[0].Id
}
$exe = Join-Path $PSScriptRoot 'bin\WarcatsOverlay.exe'
if (-not (Test-Path -LiteralPath $exe)) { & (Join-Path $PSScriptRoot 'build.ps1') }
Start-Process -FilePath $exe -ArgumentList @($GameProcessId, ('"' + [IO.Path]::GetFullPath($SnapshotPath) + '"')) -WindowStyle Hidden
