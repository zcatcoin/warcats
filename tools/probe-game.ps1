param([int]$GameProcessId = 0, [switch]$SelfTest)
$ErrorActionPreference = 'Stop'
if ($SelfTest) { $GameProcessId = $PID }
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
  [DllImport("ntdll.dll")] public static extern int NtQueryObject(IntPtr h, int kind, IntPtr buffer, uint size, out uint needed);
 }
}
'@
}
$result = [ordered]@{ processId = $GameProcessId; controlProcess = [bool]$SelfTest; checkedUtc = [DateTime]::UtcNow.ToString('o'); requestedAccess = '0x0410'; grantedAccess = $null; memoryReadGranted = $null; queryGranted = $null; handleQueryStatus = $null; openError = $null; imagePath = $null; imagePathError = $null; build = $null; moduleError = $null; headerReadError = $null; headerSignature = $null }
$probeHandle = [Warcats.Diagnostics.Native]::OpenProcess(0x410, $false, $GameProcessId)
if ($probeHandle -eq [IntPtr]::Zero) {
    $result.openError = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    [pscustomobject]$result | ConvertTo-Json
    exit 1
}
try {
    # PUBLIC_OBJECT_BASIC_INFORMATION: four ULONGs plus ten reserved ULONGs.
    # https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryobject
    $handleInfo = [Runtime.InteropServices.Marshal]::AllocHGlobal(56)
    try {
        $infoLength = [uint32]0
        $result.handleQueryStatus = [Warcats.Diagnostics.Native]::NtQueryObject($probeHandle, 0, $handleInfo, 56, [ref]$infoLength)
        if ($result.handleQueryStatus -eq 0) {
            $granted = [Runtime.InteropServices.Marshal]::ReadInt32($handleInfo, 4)
            $result.grantedAccess = '0x{0:X4}' -f $granted
            $result.memoryReadGranted = ($granted -band 0x10) -ne 0
            $result.queryGranted = ($granted -band 0x400) -ne 0
        }
    } finally { [Runtime.InteropServices.Marshal]::FreeHGlobal($handleInfo) }
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
$result['outcome'] = if ($result.headerSignature -eq 'MZ') { 'ExecutableHeaderReadable' } elseif ($result.memoryReadGranted -eq $false) { 'MemoryReadPermissionNotGranted' } else { 'ReadabilityNotEstablished' }
[pscustomobject]$result | ConvertTo-Json
# Success means only the executable signature was readable, never that SDK layouts are verified.
if ($result.headerSignature -ne 'MZ') { exit 1 }
