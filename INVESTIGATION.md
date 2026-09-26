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

A documented developer interface or replay sample could resolve this. Otherwise, binary/runtime reverse engineering would be a separate investigation with uncertain feasibility; it has not been performed by this project. More rendering polish will not resolve the missing data source.

Only these observations are published. No local account settings, save files, binaries, or telemetry contents are included.
