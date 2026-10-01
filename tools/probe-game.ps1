param([int]$GameProcessId = 0)
$ErrorActionPreference = 'Stop'
if ($GameProcessId -eq 0) {
    $games = @(Get-Process -Name 'WardogsClient-Win64-Shipping' -ErrorAction SilentlyContinue)
    if ($games.Count -ne 1) { throw 'Expected one running WARDOGS process; supply -GameProcessId otherwise.' }
    $GameProcessId = $games[0].Id
}
if (-not ('Warcats.Diagnostics.Native' -as [type])) {
    Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
namespace Warcats.Diagnostics {
 public static class Native {
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool QueryFullProcessImageName(IntPtr p,uint flags,StringBuilder path,ref uint size);
  [DllImport("psapi.dll", SetLastError=true)] public static extern bool EnumProcessModulesEx(IntPtr p,IntPtr[] modules,uint size,out uint needed,uint filter);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] b,UIntPtr n,out UIntPtr read);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
 }
}
'@
}
$result = [ordered]@{ processId = $GameProcessId; checkedUtc = [DateTime]::UtcNow.ToString('o'); openError = $null; imagePath = $null; imagePathError = $null; build = $null; moduleError = $null; headerReadError = $null; headerSignature = $null }
$probeHandle = [Warcats.Diagnostics.Native]::OpenProcess(0x410, $false, $GameProcessId)
if ($probeHandle -eq [IntPtr]::Zero) {
    $result.openError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [pscustomobject]$result | ConvertTo-Json
    exit 1
}
try {
    $imagePath = New-Object Text.StringBuilder 32768
    $pathSize = [uint32]32768
    if ([Warcats.Diagnostics.Native]::QueryFullProcessImageName($probeHandle, 0, $imagePath, [ref]$pathSize)) {
        $result.imagePath = $imagePath.ToString()
        $result.build = [Diagnostics.FileVersionInfo]::GetVersionInfo($result.imagePath).ProductVersion
    } else { $result.imagePathError = [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
    $modules = New-Object IntPtr[] 1024
    $needed = [uint32]0
    if ([Warcats.Diagnostics.Native]::EnumProcessModulesEx($probeHandle, $modules, ([IntPtr]::Size * $modules.Length), [ref]$needed, 3)) {
        if ($needed -ge [IntPtr]::Size -and $modules[0] -ne [IntPtr]::Zero) {
            $bytes = New-Object byte[] 2
            $readCount = [UIntPtr]::Zero
            if ([Warcats.Diagnostics.Native]::ReadProcessMemory($probeHandle, $modules[0], $bytes, [UIntPtr]2, [ref]$readCount) -and $readCount.ToUInt64() -eq 2) {
                $result.headerSignature = [Text.Encoding]::ASCII.GetString($bytes)
            } else { $result.headerReadError = [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
        }
    } else { $result.moduleError = [Runtime.InteropServices.Marshal]::GetLastWin32Error() }
} finally { [void][Warcats.Diagnostics.Native]::CloseHandle($probeHandle) }
[pscustomobject]$result | ConvertTo-Json
# Success means only the executable signature was readable, never that SDK layouts are verified.
if ($result.headerSignature -ne 'MZ') { exit 1 }
