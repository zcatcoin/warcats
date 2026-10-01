# ESP Rendering Lab

A dependency-free browser prototype for boxes, skeletons, team colours, and distance labels. Open `index.html` in a browser. Use the toggles, FOV slider and pause button to inspect the rendering.

A [native Windows overlay](desktop/README.md) now accepts continuously updated snapshot files and follows a foreground game window. Build it with `desktop/build.ps1`. It has no game-data reader yet and shows no players without an external producer.

**This is a sample-data renderer, not a working WARDOGS cheat.** It does not read the game, attach to processes, or obtain live player information.

See [INVESTIGATION.md](INVESTIGATION.md) for verified local inspection findings and the unresolved integration requirements.

The [SDK comparison](SDK-COMPARISON.md) distinguishes explicit declarations in the old and new dumps from inferred field mappings and explains why the live reader is still unverified.

## Recorded snapshot import

Click **Export sample snapshot** for a valid example, then **Load JSON** to display it. Files stay in your browser; no upload or game connection occurs. Imported snapshots are static and use their own camera/FOV; sample animation and FOV controls resume with **Return to sample data**. Invalid imports retain the previous scene and display an error. Maximum file size is 16 MiB, with at most 256 entities per frame.

The JSON envelope requires `schemaVersion: 1`, `units: "metres"`, and `coordinates: "y-up-z-forward"`, plus `camera` and `entities`. Camera position and entity positions are `{x,y,z}` objects. Camera yaw/pitch/optional roll use radians and FOV uses vertical degrees. Positive roll rotates camera right toward world up when yaw/pitch are zero. Entity IDs must be unique strings; team is `friendly` or `enemy`.

Each entity has exactly 16 world-space bone positions ordered: head, neck, torso, pelvis, left shoulder, left elbow, left hand, right shoulder, right elbow, right hand, left hip, left knee, left foot, right hip, right knee, right foot. These are renderer slots, not WARDOGS bone indices. A source adapter must resolve actual joints and transform them into this convention; the historical SDK is not automatically compatible. Camera roll is supported, but aspect-ratio constraints, off-axis projection and scope-specific rendering are not modeled.

## Recorded sessions

Click **Export sample recording**, then import the downloaded JSON. This generated 10-second example includes moving players and a moving camera; it is not captured from WARDOGS. Use Pause/Resume, the timeline, and 0.25–2× speed. Seeking pauses playback. At the end, **Replay** starts from zero. Returning to sample mode resets playback.

Recordings use the same version, unit and coordinate fields as snapshots, plus `kind: "recording"` and `frames: [{time, camera, entities}, ...]`. Times are seconds, start at zero and strictly increase. Limits are 2–600 frames and 3600 seconds. Each frame supplies the entire scene; missing entities disappear. The renderer holds the most recent frame between timestamps without interpolation. Long gaps therefore hold stale positions; this format is for offline inspection, not a live feed.

Run checks with `node --test tests/snapshot.test.js tests/recording.test.js`.

`renderer.js` separates the sample provider from perspective projection and rendering. A future data adapter must supply world-space entity positions, joint positions, team IDs and camera data. The current coordinate convention is +Y up and +Z forward, with metres as units. FOV is vertical; yaw and pitch are radians. Skeleton joint ordering is defined by the sample provider and `links` array. Engine-specific coordinates and joint ordering must be converted by the adapter.

Projection rejects points at or behind the near plane. Skeletons crossing that plane are currently skipped as a whole. Distance is measured from the camera to the entity origin. This browser prototype is a standalone scene. The separate desktop application provides the transparent overlay.
