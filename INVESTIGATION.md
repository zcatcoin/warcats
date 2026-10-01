# WARDOGS integration status

Read-only local inspection on 2026-09-27. No game files were modified and no game process was attached to.

## Observations

- The installed shipping client reports product/file version `++Wardogs+Live-CL-501228`.
- Searches of loose files in the installed Engine and Wardogs directories did not find SDK documentation, replay exports, or a documented entity-data interface.
- The local Saved directory contains Config, Logs, SaveGames, Cache, and Telemetry directories. Telemetry contained no files when inspected. Logs contained no top-level files, so no runtime replay or spectator markers could be checked.
- The inspected user configuration mentions vehicle telemetry HUD elements. Those settings do not establish an external telemetry export.
- Content/Paks contains 16 `.pak`, 16 `.sig`, 17 `.ucas`, and 17 `.utoc` files. These are packaged content; their presence does not establish access to live entity state. Container contents were not inspected.

## What remains unknown

These findings do not prove replay or spectator functionality is absent. They establish only that this inspection did not discover a usable data interface. No entity layouts, bone mappings, camera layouts, memory offsets, or live acquisition method have been verified.

The repository remains a sample-data rendering prototype. It is not ready to run against WARDOGS, and launching the HTML alongside the game will not make it track players.

## Integration requirements

Before implementing a real adapter, obtain and validate a data source that supplies timestamped entity IDs, team IDs, world positions, joint positions, and camera pose/projection. Confirm units, coordinate handedness, vertical versus horizontal FOV, joint ordering, update rate, and stale-data handling against a captured sample. Implementing an adapter without that evidence would require guessing.

A documented developer interface or replay sample could resolve this. The initial static binary inspection below did not establish a data source. Runtime reverse engineering has not been performed. More rendering polish will not resolve the missing data source.

Only these observations are published. No local account settings, save files, binaries, or telemetry contents are included.

## Initial static executable inspection

The reproducible `tools/inspect_pe.py` script reads PE headers, standard import descriptors and a fixed list of ASCII/UTF-16LE markers without loading or executing the input. Reports are in `analysis/` and include SHA-256 hashes identifying the inspected files.

- The shipping client is an x64 PE32+ executable with zero COFF symbol entries. Its standard import table lists only `coreinit.dll`.
- `coreinit.dll` and `runtime.dll` are also x64 PE32+ files with zero COFF symbol entries.
- None of the selected markers (including `PlayerCameraManager`, `SkeletalMeshComponent`, `GetBoneTransform`, and several guessed WD class names) appeared in the three files in either encoding. This is a bounded substring scan, not an exhaustive symbol or reflection analysis.
- `runtime.dll` has sections named `packer0`, `packer1`, and other `packer` variants. Together with the limited client import table, this suggests a packing/loading layer. It does not establish the protection mechanism or the purpose of either DLL.

No player, bone or camera layout was identified. A zero COFF symbol count does not rule out other debug metadata, and a missing plain-text marker does not rule out its corresponding functionality. Standard imports exclude delay imports and dynamically resolved dependencies.

The next deeper technical stage would be disassembly and analysis of the loading layer. This scan does not supply offsets or a live-memory acquisition method. No unpacking, protection bypass, injection, or runtime attachment was attempted.
# Runtime check — 2026-10-02

The user confirmed the native overlay status text is visible over the windowed game. This verifies visibility, not entity projection or click-through behavior.

The running executable now reports `++Wardogs+Live-CL-507060`, matching the supplied archive's build label. Earlier references below to installed build 501228 are historical. Matching labels do not independently verify generated field layouts.

A normal Windows query/read handle opened successfully. `QueryFullProcessImageName` returned the expected game executable. `EnumProcessModulesEx` failed with Win32 error 5 (Access denied), so this check did not locate the main module or successfully read any game memory. This does not establish the cause of the denial or prove every acquisition method impossible. No live entity/camera reader has been implemented.

Repeat using `tools/probe-game.ps1` in a desktop PowerShell session. It reports API errors separately and attempts only a two-byte executable signature read if module enumeration succeeds. It does not change process memory, request debug privileges or install a driver.
