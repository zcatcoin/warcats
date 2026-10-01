# Windows overlay

This is a native transparent, click-through desktop overlay. It renders supplied snapshots over the selected process's foreground client area. It does not yet obtain WARDOGS player data. No sample entities are generated.

Build with Windows PowerShell:

```powershell
.\desktop\build.ps1
```

With the game running in windowed or borderless mode:

```powershell
.\desktop\start.ps1
```

The tray icon provides boxes, skeletons, distances, teammates, visibility and Exit controls. Ctrl+Shift+End exits when the hotkey is available. The overlay hides when the game loses focus or is minimized, follows its client rectangle, and exits when the target process exits. Exclusive fullscreen is unsupported. Native window alignment, click-through and multi-monitor DPI behavior still require an interactive check on the target machine.

## Snapshot input

Default input is `desktop/live.json`; override with `-SnapshotPath`. An external producer must write the snapshot schema from the root README, replacing the file atomically to avoid partial reads. Supply all 16 documented world-space joints, camera and team data. The producer must use the target client viewport's camera/projection. The overlay cannot establish whether input actually came from the game.

Files older than 500 milliseconds, substantially future-dated files, missing files and invalid frames clear entities. A producer must stop publishing when its own source becomes stale; merely rewriting old coordinates is not a fresh measurement. No offsets or SDK declarations are treated as runtime-verified. File input is an initial local integration interface, not a high-performance acquisition transport.

The build runs headless checks for projection, near-plane rejection, roll, malformed input and stale frames. No live WARDOGS acquisition or in-game rendering has been validated.
