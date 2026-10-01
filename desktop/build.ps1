$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x C# compiler is required.' }
$output = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Path $output -Force | Out-Null
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "/out:$output\WarcatsOverlay.exe" (Join-Path $PSScriptRoot 'Overlay.cs')
if ($LASTEXITCODE -ne 0) { throw 'Overlay compilation failed.' }
$report = Join-Path $output 'self-test.txt'
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$check = Start-Process -FilePath (Join-Path $output 'WarcatsOverlay.exe') -ArgumentList @('--self-test', ('"' + $report + '"')) -WindowStyle Hidden -Wait -PassThru
if ($check.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report)) { throw 'Overlay checks failed.' }
Get-Content -LiteralPath $report
Write-Output "Built $output\WarcatsOverlay.exe"
