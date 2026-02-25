# Map & Simulation Scalability Plan

## Objective
Enable the concurrent rendering and simulation of 10,000 to 100,000+ aircraft instances moving in real-time without degrading UI responsiveness or crashing the browser main thread.

## Current Limitations (MVP Architecture)
- **Main Thread Processing**: All Great Circle math and state updates happen on the JavaScript main thread.
- **GeoJSON Serialization**: Thousands of points are serialized to GeoJSON and sent to the GPU every frame via `setData()`, creating a massive memory and bus bottleneck.
- **React/Zustand Reconciliation**: State updates to large arrays trigger expensive virtual DOM diffing or store subscriber overhead.

---

## Phase 0: Algorithmic Optimizations (Implemented)
*Eliminating the worst CPU-side bottlenecks within the existing MapLibre layer architecture.*

### 1. O(1) Airport Lookups
Planned: replace `airports.find(a => a.iata === ...)` linear scans with a `Map<string, Airport>` index built via `useMemo`. At 10K routes with ~4 lookups each, this eliminates ~240M string comparisons per update cycle.

### 2. Viewport Culling
Both arc geometry computation and aircraft position updates now skip entities outside the current map viewport. Uses AABB overlap tests with generous great-circle curvature margins. At typical zoom levels, this eliminates 70-90% of geometry computation.

### 3. Zoom-Adaptive LOD (Level of Detail)
Arc segment count scales with zoom level: 8 segments at z<2, up to 50 at z>8. At low zoom (world view), this reduces coordinate count by ~85% with no visible quality difference. Cache is invalidated when LOD tier changes.

### 4. Arc Geometry Memoization
Computed arc coordinates are cached in a `Map<string, [number, number][]>` keyed by `origin-dest-segments`. Global route arcs (which rarely change) are computed once and reused across frames. Cache invalidates automatically on LOD tier changes.

### 5. requestAnimationFrame Flight Animation
Aircraft position interpolation now runs via `requestAnimationFrame` instead of `setInterval(..., 1000)`, providing smooth 60fps movement. Uses React refs to avoid stale closures without re-registering the RAF loop on every state change.

### 6. Debounced Viewport Updates
Arc re-computation on pan/zoom is debounced at 150ms to avoid thrashing during continuous map interaction.

### 7. Two-Layer SDF Livery Rendering
Aircraft icons use MapLibre's SDF (Signed Distance Field) icon rendering to display per-airline livery colors without generating unique bitmaps per airline. Each aircraft type has two SVG icons:
- **Body layer**: the airplane silhouette, tinted with the airline's `primary` livery color via `icon-color`.
- **Accent layer**: detail shapes (engine rings, wing stripes, tail details) overlaid at the same position/rotation, tinted with the airline's `secondary` livery color.

Both layers read `primaryColor` and `secondaryColor` from GeoJSON feature properties, falling back to neutral defaults when no livery is set. This scales to unlimited airlines with zero icon atlas regeneration — only two draw calls per fleet source (player + global), regardless of how many distinct liveries are visible.

### 8. React StrictMode WebGL Compatibility
React 19 StrictMode double-mounts components in dev (Mount → Unmount → Re-mount). Map cleanup is deferred via `setTimeout(100ms)` so that StrictMode's immediate re-mount can cancel the pending `map.remove()` and reuse the still-alive WebGL context. This prevents "WebGL context was lost" crashes during development.

---

## Phase A: Custom WebGL/WebGPU Layer (Rendering Scale)
*Moving from CPU-driven positions to GPU-calculated positions.*

### 1. Shader-Based Interpolation
Instead of calculating the current `[lat, lng]` in JavaScript, we pass the "Flight Plan" constants to the GPU in a single vertex buffer.
- **Buffer Data per Aircraft**:
  ```typescript
  [
    Origin_Lng, Origin_Lat, 
    Dest_Lng, Dest_Lat, 
    Departure_Tick, 
    Duration_Ticks, 
    Icon_Type
  ]
  ```
- **Vertex Shader Logic**:
  - Receive `u_current_tick` as a global uniform.
  - Calculate `progress = (u_current_tick - Departure_Tick) / Duration_Ticks`.
  - Perform **SLERP (Spherical Linear Interpolation)** directly in the shader.
  - Calculate bearing by looking at `progress + epsilon`.
- **Result**: Zero CPU work for movement. 100k planes move as cheaply as 1.

### 2. Instanced Rendering
Use `gl.drawArraysInstanced` to draw all aircraft icons in a single draw call.
- Use a single icon atlas (SDF-based for sharp icons at any zoom).
- GPU handles the transform/rotation/offset per instance.

---

## Phase B: Off-Main-Thread Simulation (Logic Scale)
*Moving the engine logic out of the UI thread.*

### 1. Web Worker Engine
Move the `processTick` and financial engine into a dedicated **Web Worker**.
- UI thread only handles rendering and user input.
- Worker processes aircraft state transitions and emits "delta" events.
- Communications via `SharedArrayBuffer` for zero-copy state sharing (requires strict COOP/COEP headers).

### 2. Spatial Indexing
Use a library like `rbush` or a customized Quadtree to optimize spatial queries.
- Only calculate detail for aircraft within the current camera frustum.
- Optimize "Conflict Detection" or "Airport Congestion" logic using 2D spatial queries.

---

## Phase C: Data Synchronization (Multiplayer Scale)
*Handling global state across Nostr effectively.*

### 1. Vectorized Events
Instead of publishing full fleet states, publish compressed binary events or NIP-XX vector updates.
- Only publish "Flight Dispatched" and "Flight Landed" events.
- Clients reconstruct the movement in between using deterministic math (Epoch Sync).

### 2. Lazy Loading Competitors
Only load and simulate other players' planes that are "nearby" or "on shared routes" to save memory.

---

## Technical Feasibility Log
| Strategy | Difficulty | Impact | Status |
|----------|------------|--------|--------|
| O(1) Airport Index | Low | Algorithmic Speed | **Implemented** |
| Viewport Culling | Low | Rendering Speed | **Implemented** |
| Zoom-Adaptive LOD | Low | Rendering Speed | **Implemented** |
| Arc Memoization | Low | CPU Reduction | **Implemented** |
| RAF Flight Animation | Low | Visual Quality | **Implemented** |
| Two-Layer SDF Livery | Low | Visual Identity | **Implemented** |
| StrictMode WebGL Fix | Low | Dev Stability | **Implemented** |
| Custom WebGL Layer | High | Rendering Speed | Proposed |
| Web Worker Engine | Medium | UI Stability | Proposed |
| Shader Interpolation | High | Zero CPU Cost | Proposed |
| Spatial Indexing | Medium | Algorithmic Speed | Proposed |
