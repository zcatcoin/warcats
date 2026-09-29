# SDK comparison and reader readiness

Inspected 2026-09-29. This is an integration note for the existing renderer, not a runtime-validated offset profile.

## Conclusion

We have enough information to define candidate layouts and offline validation cases, but **not enough to claim a working live WARDOGS data reader**. No process access, live pointer chain, entity sample, faction comparison, bone pose or rendered-camera sample has been validated.

"Confirmed" below means explicitly declared in the supplied generated SDK. It does not mean independently verified against the installed executable. "Inferred" means a semantic correspondence based on type, owner, order and nearby fields. An inferred name must not silently replace the generated name in implementation.

## Inputs and provenance

- Old input: `5.6.1-458870+++Wardogs+Public-Playtest-Wardogs/CppSDK/SDK`.
- New input: `5.7.4-Wardogs/CppSDK/SDK`. Its umbrella header identifies `5.7.4`, without a changelist.
- Installed executable metadata reports `++Wardogs+Live-CL-501228`.
- Downloaded new ZIP SHA-256: `37f5a334e8997b9acbee8a5b0c5929472cc86bfbd4fb3ae2dfc7dfed62553198`. This matches the archive hash printed in forum post #859. It ties the archive to the post, not to a verified game executable or safety guarantee.
- The source references below are filenames and one-based line numbers within the corresponding SDK input. Neither SDK nor the forum PDFs are copied into this repository.

## Player definitions

**Confirmed declarations:** both dumps retain `APawn -> ABHMoverPawn -> AWDMoverCharacter -> AWDMoverPlayerCharacter`. Old `BHMover_classes.hpp:358`, `WDGame_classes.hpp:5532,5711`; new `BHMover_classes.hpp:708`, `WDGame_classes.hpp:857,1132`.

`AWDMoverCharacter::VitalityComponent` remains an explicitly named `UWDCharacterVitalityComponent*`, but moves from `0x05D0` to `0x0738`. Old `WDGame_classes.hpp:5545`; new `WDGame_classes.hpp:870`. This does not identify health values inside that component.

**Inferred mappings:**

- Old `APlayerController::AcknowledgedPawn`, `APawn*` at `0x0358`, plausibly corresponds to `_aaabaofnedgmmcimkhibm` at `0x0360` in the new controller. Type and surrounding controller fields support the match; the new declaration does not confirm the original name. Old `Engine_classes.hpp:16204`; new `Engine_classes.hpp:27027`.
- Old `AGameStateBase::PlayerArray`, `TArray<APlayerState*>` at `0x02C8`, plausibly corresponds to `_aaaaledkjiccnbpjmngef` at `0x02D0`. Old `Engine_classes.hpp:9482`; new `Engine_classes.hpp:32184`. The array type is explicit; the semantic name and runtime completeness remain unverified.

## Mesh and skeleton

**Confirmed declarations:** old `ABHMoverPawn` declares `CharacterMeshComponent` as `UBHSkeletalMeshComponentBudgeted*` at `0x0380`. New `ABHMoverPawn` declares a pointer of the same type named `_aaabgmlomckkgapmmkiej` at `0x0390`. Old `BHMover_classes.hpp:367`; new `BHMover_classes.hpp:718`.

**Inferred mapping:** the newer pointer is a strong candidate for the old character mesh, based on its owning class and distinctive type. That correspondence is not independently verified.

**Unresolved:** actual runtime bone-transform storage, local-to-world composition, pose freshness, LOD effects, and whether the historical 177-bone list matches each current character mesh. New headers retain `GetBoneName`, `GetNumBones` and `GetSocketTransform` declarations (`Engine_classes.hpp:2751,2758,1189`). Function declarations do not provide an external memory transport or prove an external pose-buffer layout.

## Team and faction

**Confirmed declarations:** `AWDPlayerStateSession::FactionComponent` remains a named `UWDFactionComponent*`, moving from `0x04C0` to `0x04F0`. `SquadComponent` moves from `0x04C8` to `0x04F8`. These are separate components; squad is not a substitute for faction. Old `WDGame_classes.hpp:12615,12616`; new `WDGame_classes.hpp:15312,15313`.

`GetFactionTag()` remains declared on both session player state and faction component. The generated implementations locate a UFunction and invoke `UObject::ProcessEvent`; they do not reveal the native getter's body or implement an out-of-process read. New `WDGame_functions.cpp:21069,25438`.

**Inferred mappings:** in `UWDFactionComponent`, old `DefaultFactionTag` at `0x00F8` plausibly corresponds to `_aaabbopphaepncdkepkhh` at `0x0100`; old replicated `FactionTag` at `0x0108` plausibly corresponds to `_aaaakiakheffmkpbejagj` at `0x0110`. Types, ordering and replication flags support these candidates. Old `WDGame_classes.hpp:35507,35509`; new `WDGame_classes.hpp:22052,22054`.

**Unresolved:** observed local-versus-remote faction values, unassigned/spectator cases, lifecycle changes and name/tag interpretation against the installed build.

## Camera

**Confirmed declarations:** `APlayerController::PlayerCameraManager` retains its name and type but moves from `0x0368` to `0x0370`. Old `Engine_classes.hpp:16206`; new `Engine_classes.hpp:27029`.

`FMinimalViewInfo` explicitly retains `Location` at `0x0000`, `Rotation` at `0x0018`, `FOV` at `0x0030`, and `AspectRatio` at `0x005C`. Old `Engine_structs.hpp:13679-13695`; new `Engine_structs.hpp:7798-7814`.

`FCameraCacheEntry::POV` stays at `0x0010`, but its declared payload size grows from `0x08C0` to `0x08D0`. Cache-entry size grows from `0x08D0` to `0x08E0`. Old `Engine_structs.hpp:15062-15067`; new `Engine_structs.hpp:15613-15618`.

**Inferred mappings:** the old `CameraCachePrivate` at `0x1530` and `LastFrameCameraCachePrivate` at `0x1E00` plausibly correspond to `_aaabcpeolcebmdlfnglik` at `0x1560` and `_aaabllkflijahjopngdhl` at `0x1E40`. Both new members are explicitly `FCameraCacheEntry`, but current-versus-previous semantics are inferred. Old `Engine_classes.hpp:18471,18472`; new `Engine_classes.hpp:36711,36712`.

**Unresolved:** which camera state matches final rendering during movement, ADS, vehicles and camera effects; coordinate conversion; FOV interpretation and aspect constraints. The browser renderer's vertical FOV convention cannot be assumed to match these values directly.

## Reader prerequisites still missing

1. **Exact build association:** no executable hash or changelist in the new SDK ties it conclusively to installed `501228`.
2. **Data acquisition:** no working external transport has been implemented or demonstrated. Generated wrappers use local pointers and game function calls; they are not a standalone memory reader.
3. **Pointer and container validation:** no live root, world, player collection, ownership chain or object lifetime has been checked. Static declarations alone cannot validate these.
4. **Names and tags:** new `Basic.hpp` uses a direct `FNamePool` path in `FName::GetRawString`; its zero `AppendString` constant is not by itself evidence that this path is broken. SDK and forum name-pool constants differ, and their base conventions must not be assumed interchangeable.
5. **Pose and projection validation:** no synchronized sample proves that bone positions, transforms and camera values produce correct boxes/skeletons.

A meaningful next validation artifact would pair a known-build scene-data capture with independently observed camera/player movement. It would let us check candidate mappings, units, transforms and timing. Synthetic JSON only tests our renderer and cannot establish game compatibility.

No SDK functions were executed, no protection bypass was attempted, and no game process or files were modified during this comparison. No guessed mapping has been integrated into the renderer.
