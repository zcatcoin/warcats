# ESP Rendering Lab

A dependency-free browser prototype for boxes, skeletons, team colours, and distance labels. Open `index.html` in a browser. Use the toggles, FOV slider and pause button to inspect the rendering.

**This is a sample-data renderer, not a working WARDOGS cheat.** It does not read the game, attach to processes, or obtain live player information.

`renderer.js` separates the sample provider from perspective projection and rendering. A future data adapter must supply world-space entity positions, joint positions, team IDs and camera data. The current coordinate convention is +Y up and +Z forward, with metres as units. FOV is vertical; yaw and pitch are radians. Skeleton joint ordering is defined by the sample provider and `links` array. Engine-specific coordinates and joint ordering must be converted by the adapter.

Projection rejects points at or behind the near plane. Skeletons crossing that plane are currently skipped as a whole. Distance is measured from the camera to the entity origin. This prototype is a standalone scene, not a transparent desktop overlay.
