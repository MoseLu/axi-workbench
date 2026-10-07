---
id: axi-docs-en-projects-tidewater-reference
title: Tidewater Reference
type: project
status: published
tags: [Axi Docs, Projects, references, third-party, graphics, webgpu, wgsl, javascript, vite, ocean-simulation]
created: 2026-10-07
modified: 2026-10-07
graph-title: Tidewater Reference
graph-tags: [Projects, references, graphics, webgpu]
description: Third-party reference mirror of `dgreenheck/tidewater` — a real-time tropical island / ocean fishing game on raw `WebGPU` + `WGSL` with a custom three.js-compatible CPU engine. Studied for ocean rendering, FFT water simulation, and small-engine architecture. Built on `GPU.js` + `WebGPU` + `WGSL` + `OceanFFT.js` + `ShoreSim.js` + `TemporalUpscale.js` + `AntiAlias.js` + `Vite ^8.3.0`.
project:
  id: tidewater-reference
  partition: references/short-term
  path: /Volumes/code/workspace/references/short-term/tidewater-reference
  upstream: https://github.com/dgreenheck/tidewater
  source-section: reference
---

# Tidewater Reference

> Read-only reference mirror of upstream Tidewater (Dylan Greenheck, MIT).
> Source of truth for upstream product intent is the upstream repository;
> the local `AGENTS.md` stub governs how Axi treats it.
> Section: reference / Partition: `references/short-term/`.

## Summary

Tidewater is a real-time tropical island fishing game that runs in the browser on raw `WebGPU` + `WGSL` with a custom rendering engine — no three.js runtime, no Babylon, no PlayCanvas. The CPU side is a three.js-compatible math/scene/geometry layer (`src/engine/`) so the author can move workloads back and forth between the original three.js branch and the WebGPU-native branch without rewriting everything; the GPU side is a hand-written, no-framework WebGPU layer (`src/engine/webgpu.js`, `src/engine/gpu/GPU.js`, `src/engine/render/`) with `Material`, `ComputeKernel`, `ShaderModule`, `RenderTarget`, `FullscreenPass`, and `SkinnedModel` primitives.

For Axi, this is a renderer and simulation reference, not a product to clone or operate. The patterns Axi should study here are: (1) the single `GPU` singleton + one-command-encoder-per-frame submission discipline, (2) the four-cascade Tessendorf FFT ocean (`src/ocean/OceanFFT.js`, 256-point radix-2 IFFT per row, four packed complex fields per cascade), (3) the shallow-water "swash" simulation that drives the wet-sand line up and down the beach (`src/ocean/ShoreSim.js` + `ShoreWaves.js`), (4) the temporal upscaler + jittered-history TAA in `src/post/TemporalUpscale.js` and `AntiAlias.js`, (5) the per-frame `G` global uniforms (`frame.sunDir`, `frame.time`, jittered view-proj) that every system binds against without re-uploading, and (6) the URL-knob discipline (`?fly`, `?noAudio`, `?noClouds`, `?noCaustics`, `?noVeg`, `?noSim`, `?bench`, `?auto`, `?shots=…`) that lets a single static build be debugged and benchmarked from the address bar.

**Stage**: reference snapshot, third-party. **Lifecycle**: read-only mirror. **Canonical path**: `/Volumes/code/workspace/references/short-term/tidewater-reference`. **Upstream**: `https://github.com/dgreenheck/tidewater` (playable at `https://dgreenheck.github.io/tidewater/`). **Upstream license**: MIT. **Axi overlay**: branch `agent/audit-fix-a09-tidewater-agents`, last local commit `b594c25 docs(tidewater-reference): add AGENTS.md stub`. **Working tree**: clean on the local audit branch.

## Stack

`JavaScript (ES modules)`, `Vite ^8.3.0`, `webgpu ^0.6.1`, `WebGPU`, `WGSL`, `Custom three.js-compatible API`, `GLTF/GLB parser`, `GPU singleton`, `ShaderModule`, `SkinnedModel`, `Tessendorf FFT`, `Horvath/JONSWAP`, `CDLOD`, `Hillaire 2020 PBR atmosphere`, `TAAU`, `SMAA`, `GTAO`, `GitHub Pages`, `MIT`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — Custom WebGPU + WGSL engine (no three.js runtime) | shipped | `src/engine/webgpu.js` (public exports `GPU`, `Material`, `ComputeKernel`, `ShaderModule`, `RenderTarget`, `FullscreenPass`, `loadGLB`) |
| M2 — Three.js-compatible math / scene / geometry layer | shipped | `src/engine/index.js` re-exports math + scene + geometry; primitive geometries `Box/Sphere/Cylinder/Cone/Plane/Circle/Torus/Lathe/Icosahedron/Tube/RoundedBox` |
| M3 — Per-frame `GPU` singleton + encoder + submit hooks | shipped | `src/engine/gpu/GPU.js` (252 LOC) with adapter/device/limits + pre-built samplers + per-frame encoder |
| M4 — Four-cascade Tessendorf FFT ocean | shipped | `src/ocean/OceanFFT.js` (656 LOC) — 256-point radix-2 IFFT per row, four packed complex fields (`c0 = Dx + i Dz`, `c1 = Dy + i dDx/dz`, `c2 = dDy/dx + i dDy/dz`, `c3 = dDx/dx + i dDz/dz`) |
| M5 — Shallow-water "swash" simulation | shipped | `src/ocean/ShoreSim.js` + `src/ocean/ShoreWaves.js` (697 LOC) + `Breakers.js` + `SurfFoam.js` |
| M6 — GLTF/GLB loader + GPU skinning | shipped | `src/engine/loaders/GLTF.js` + `src/engine/render/Skinning.js` (`SkinnedModel.create`, motion-vector-aware) |
| M7 — Reversed-Z, jittered-history TAA + SMAA | shipped | `src/post/TemporalUpscale.js` + `src/post/AntiAlias.js` (configurable Off / 2x / 4x / 8x / 16x in the UI) |
| M8 — GTAO + underwater composite + air haze | shipped | `src/post/PostFX.js` (722 LOC) orchestrates `Underwater.js`, `AirHaze.js`, `GTAO.js`, `MotionBlur.js`, `LensFlare.js`, `LensDroplets.js` |
| M9 — Hillaire 2020 PBR sky + volumetric clouds | shipped | `src/sky/Atmosphere.js` + `Sky.js` + `Clouds.js` + `SkyProClouds.js` |
| M10 — Cascaded shadow maps + ground bounce | shipped | `src/engine/render/Shadows.js` (`SunShadows`, `DEPTH_FORMAT = depth32float`, reversed-Z) + `src/materials/GroundBounce.js` |
| M11 — CDLOD streaming terrain + procedural + scanned content | shipped | `src/core/CDLOD.js` + `src/world/TerrainGPU.js` + `Village.js` + `Pier.js` + `Reef.js` + `Vegetation.js` + `BoatModel.js` |
| M12 — Gameplay (rod / bites / fight / cooler / vendors) | shipped | `src/game/Game.js` (571 LOC) + ~15 sibling modules (`FishingRod`, `Bites`, `CatchMinigame`, `FishStand`, `Chandlery`, `Guide`, `Minimap`) |
| M13 — URL-knob discipline + reference shots | shipped | `?fly`, `?noAudio`, `?noClouds`, `?noHaze`, `?noCaustics`, `?noVeg`, `?noSim`, `?bench`, `?auto=<job>`, `?shots=…`, `?wdbg=N` |
| M14 — GitHub Pages CI/CD | shipped | `.github/workflows/deploy.yml` (build → upload artifact → deploy on push to `main`) |
| M15 — Axi overlay docs | shipped | `AGENTS.md` stub at the reference repo root |

## Build & Install

Axi does not build or install this reference; the upstream build recipes that `package.json` documents remain valid for the snapshot:

```bash
cd /Volumes/code/workspace/references/short-term/tidewater-reference
npm install         # ~50 MB, pulls vite + webgpu only
npm run dev         # vite dev server:  http://127.0.0.1:5189
npm run build       # static build in dist/
npm test            # node-only: node test/game-logic.mjs && node test/engine-smoke.mjs
```

System requirements (from `README.md`):

- A browser with WebGPU (recent Chrome, Edge, Safari)
- A capable GPU — targets 60 fps at 2560×1267 on an Apple M5 Pro; dynamic resolution scales the render down on slower machines
- The first load compiles several hundred shaders; subsequent visits are faster because the browser caches them

URL options the static build exposes (from `README.md`):

| Option | Effect |
|---|---|
| `?fly` | Start in the free camera |
| `?noAudio` / `?noClouds` / `?noHaze` / `?noCaustics` / `?noVeg` / `?noSim` | Disable individual systems (shaders still compile) |
| `?bench` | Runs the frame-time benchmark in `core/Bench.js`; polyfills rAF in hidden tabs for automation |
| `?auto=<job>` | Drives a named benchmark job |
| `?shots=view1,view2[&tag=…][&dt=…]` | Reference shots of the named views |
| `?wdbg=N` | Set the water shader's `debugMode` |

## Architecture Highlights

**One GPU singleton, one command encoder per frame.** All GPU work flows through `src/engine/gpu/GPU.js`: a module-level singleton holding `device`, `queue`, `context`, `format`, `features`, `limits`, pre-created samplers (`linearRepeat`, `linearClamp`, `linearMirror`, `anisoRepeat`, `aniso4Repeat`, `anisoClamp`, `nearestClamp`, `nearestRepeat`, `shadow`), and a single per-frame `encoder` that systems record into via `GPU.getEncoder()` and then submit with `GPU.submit()`. `GPU.onSubmit(before, after)` lets readback hooks register themselves; `GPU.beginFrame()` increments the frame counter and returns the encoder. The convention is that everything that happens in a frame happens in submission order, which is what makes "queue.writeBuffer twice in one frame keeps only the last value" a documented footgun rather than a mystery.

**Shared WGSL via `ShaderModule` with a prefix discipline.** Where three.js/TSL would expose a function (`terrainGPU.heightAt(xz)`, `clouds.shadow(xz)`, `shoreSim.sample(xz)`), Tidewater's WebGPU layer exposes a `ShaderModule` whose methods are WGSL functions named `<prefix><Method>` (e.g. `shoreEvaluate`, `terrainSample`, `cloudShadow`). The module list, binding layout, and uniform block are shared between all shaders that import it. Bind groups are layered: group 0 = `frame` uniforms + shared samplers, group 1 = module + material resources, group 2 = per-draw. This is the convention described in `docs/PORTING.md` and is what lets the ocean, terrain, and shore systems call into each other without re-uploading textures or constants.

**The four-cascade FFT ocean is the centrepiece.** `src/ocean/OceanFFT.js` runs exactly two compute dispatches per frame for all cascades: a row pass that time-evolves the spectrum (`h0 → h(k,t)`), builds four packed complex fields, and performs a 256-point radix-2 IFFT per row in workgroup memory; then a column pass that does the column IFFT, sign correction, Jacobian-based foam accumulation, and writes displacement / derivative array textures. The packed complex fields are: `c0 = Dx + i Dz`, `c1 = Dy + i dDx/dz`, `c2 = dDy/dx + i dDy/dz`, `c3 = dDx/dx + i dDz/dz` — four real fields per complex IFFT so the water shader can sample displacement, derivatives, and foam Jacobian in a single `textureSampleLevel` call. The four cascades have non-integer-ratio tile sizes (`[733, 157, 33.3, 7.1]`) to avoid visible repetition, and the spectrum is Horvath/JONSWAP with a wind speed, fetch, swell, peak enhancement, and short-waves fade knob.

**Reversed-Z, jittered history, motion-vector-driven TAA.** `SceneRenderer` exports `SCENE_FORMATS` (color + velocity + mask) and `DEPTH_FORMAT = depth32float` cleared to 0 with sky pixels at depth 0. `FrameUniforms` (the `G` global) carries `cameraPos`, `view`, `proj`, `viewProj` (jittered), `viewProjNoJitter`, `prevViewProjNoJitter` (needed for motion vectors and `staticVelocity` objects), `invViewProj`, `near`, `far`, `resolution`, and `sunDir` — every shader binds against the same uniform block so the CPU never re-uploads per-system constants. Velocity is in UV space (y down, current minus previous), which is what makes the temporal upscaler (`src/post/TemporalUpscale.js`) work alongside SMAA-on-jittered-frames (`src/post/AntiAlias.js`, configurable Off / 2x / 4x / 8x / 16x in the UI).

**The shallow-water sim is its own pipeline, not part of the FFT.** The "swash running up and down the sand" is `src/ocean/ShoreSim.js` + `ShoreWaves.js` + `Breakers.js` — a separate simulation that reads the FFT displacement and adds a depth-aware breaker field with peeling shoulders, whitewater, spray, and foam lace. The wet-sand line under thin water is rendered with a dedicated opaque pass (see commit `35d9e1e "Swash film: show the opaque pass's wet sand under thin water"`). The `?noSim` URL knob lets a viewer turn the swash sim off without touching the FFT.

**Asset pipeline is offline and reproducible.** `tools/characters/`, `tools/props/`, and `tools/audio/` contain the scripts that fetch, resize, retarget, bake, and decimate upstream sources (Microsoft Rocketbox avatars, Poly Haven scans, Freesound recordings) into the `public/models/` and `public/audio/` form the engine expects. Every asset directory carries its own `CREDITS.md` (MIT for Rocketbox, CC0 for Poly Haven and Freesound), and the root `CREDITS.md` aggregates them with the MIT code license. The whale model is the only procedural asset (its side profile is traced from a NOAA Fisheries public-domain illustration). This is the workflow Axi should mirror for any 3D-content reference.

**Composition root is one 745-line `App.js`.** `src/App.js` instantiates every subsystem (engine, scene renderer, GPU buffers, sky, world, ocean, materials, lighting, post, player, game, audio) and wires them into the frame loop. There is no DI container and no module-side singleton; the App constructor reads URL query string flags into `this.qs` and exposes them as `app.qs.has('noAudio')` etc., which is the same knob surface that `?bench&auto=…&shots=…` use.

**Benchmarks and reference shots are first-class.** `src/core/Bench.js` + `BenchSeed.js` drive the frame loop themselves when `?bench` is set and produce JSON frame-time reports; `DebugViews.js` exposes named camera views for `?shots=view1,view2`. The `main.js` bootstrap polyfills `requestAnimationFrame` in hidden tabs so the benchmark still runs under automation. This is the pattern Axi should adopt for any "reference shot of a deterministic state" workflow.

## Notes

- Engine exports (`src/engine/webgpu.js`): `GPU`, `Material`, `ComputeKernel`, `ShaderModule`, `RenderTarget`, `FullscreenPass`, `SkinnedModel`, `loadGLB`, `commonModule`, `SceneLighting`, `FrameUniforms`, `Texture`, `UniformBlock`, `StorageBuffer`, `Readback`, `Mipmaps`, `MeshRenderer`, `SunShadows`.
- `GPU.js` (252 LOC) holds `device`, `queue`, `context`, `format`, `features`, `limits`, pre-created samplers (`linearRepeat`, `linearClamp`, `linearMirror`, `anisoRepeat`, `aniso4Repeat`, `anisoClamp`, `nearestClamp`, `nearestRepeat`, `shadow`), per-frame `encoder`, and `GPU.onSubmit(before, after)` hooks.
- `ShaderModule` exposes WGSL functions with `<prefix><Method>` naming (`shoreEvaluate`, `terrainSample`, `cloudShadow`); bind groups layered group 0 = `frame` uniforms + shared samplers, group 1 = module + material resources, group 2 = per-draw.
- `OceanFFT.js` (656 LOC) runs two compute dispatches per frame: row pass (time-evolves `h0 → h(k,t)`, builds four packed complex fields, 256-point radix-2 IFFT per row in workgroup memory) + column pass (column IFFT, sign correction, Jacobian-based foam, displacement / derivative array textures).
- Packed complex fields: `c0 = Dx + i Dz`, `c1 = Dy + i dDx/dz`, `c2 = dDy/dx + i dDy/dz`, `c3 = dDx/dx + i dDz/dz` — four real fields per complex IFFT so the water shader can sample displacement, derivatives, and foam Jacobian in a single `textureSampleLevel` call.
- Cascade tile sizes are `[733, 157, 33.3, 7.1]` (non-integer-ratio to avoid repetition); spectrum is Horvath/JONSWAP with wind speed, fetch, swell, peak enhancement, short-waves fade knobs.
- `FrameUniforms` (the `G` global) carries `cameraPos`, `view`, `proj`, `viewProj` (jittered), `viewProjNoJitter`, `prevViewProjNoJitter`, `invViewProj`, `near`, `far`, `resolution`, `sunDir`.
- Reversed-Z: `DEPTH_FORMAT = depth32float` cleared to 0; sky pixels at depth 0; `SCENE_FORMATS` exports color + velocity + mask.
- TAA + SMAA: `src/post/TemporalUpscale.js` (jittered history + still-pixel history retention) + `src/post/AntiAlias.js` (configurable Off / 2x / 4x / 8x / 16x in the UI).
- Post-chain: `src/post/PostFX.js` (722 LOC) orchestrates `Underwater.js`, `AirHaze.js`, `GTAO.js`, `MotionBlur.js`, `LensFlare.js`, `LensDroplets.js`, `TemporalUpscale.js`, `AntiAlias.js`.
- Sky: `src/sky/Atmosphere.js` (Hillaire 2020 PBR) + `Sky.js` + `Clouds.js` + `SkyProClouds.js` (volumetric cumulus + cirrus with cloud shadows on land).
- Shadows: `src/engine/render/Shadows.js` (`SunShadows` cascaded shadow maps + `sunShadow(P, N, pixel)` WGSL helper); `src/materials/GroundBounce.js` (ground bounce light + contact shadows + local lights).
- Three.js-compatible re-exports: `src/engine/index.js` (9 LOC) re-exports math + scene + geometry; primitive geometries `Box/Sphere/Cylinder/Cone/Plane/Circle/Torus/Lathe/Icosahedron/Tube/RoundedBox`.
- GLTF/GLB loader: `src/engine/loaders/GLTF.js` (`loadGLB`, `parseGLB`, `decodeImage`); GPU skinning via storage-buffer joints in `src/engine/render/Skinning.js` (`SkinnedModel.create(gltf)`).
- Composition root is `src/App.js` (745 LOC); URL query string flags loaded into `this.qs`, exposed as `app.qs.has('noAudio')` etc.
- URL knobs: `?fly`, `?noAudio`, `?noClouds`, `?noHaze`, `?noCaustics`, `?noVeg`, `?noSim`, `?bench`, `?auto=<job>`, `?shots=view1,view2[&tag=…][&dt=…]`, `?wdbg=N`.
- Benchmarks + reference shots: `src/core/Bench.js` + `BenchSeed.js` + `DebugViews.js`; `main.js` polyfills `requestAnimationFrame` in hidden tabs so the benchmark still runs under automation.
- Assets: Microsoft Rocketbox avatars (MIT), Poly Haven scans (CC0), Freesound recordings (CC0, 42 CC0 field recordings under `public/audio/`); whale model is procedural (NOAA Fisheries public-domain illustration); every asset directory carries its own `CREDITS.md`; root `CREDITS.md` aggregates them.
- Porting guide: `docs/PORTING.md` (~150 LOC) covers three.js/TSL → WebGPU/WGSL porting (bind groups, velocity convention, reversed-Z).
- CI/CD: `.github/workflows/deploy.yml` (~50 LOC) — build → upload artifact → GitHub Pages on push to `main`.

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Tidewater Reference".
- Project root: `/Volumes/code/workspace/references/short-term/tidewater-reference`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/short-term/tidewater-reference/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/references/short-term/tidewater-reference/README.md`
- Upstream repository: `https://github.com/dgreenheck/tidewater`
- Upstream playable build: `https://dgreenheck.github.io/tidewater/`
- Workspace registry entry: `/Volumes/code/workspace/foundation/workspace-governance/workspace.json` under `references.tidewater-reference`; graph node at `/Volumes/code/workspace/workspace.graph.json` → `.projects.tidewater-reference`.
- Sister reference mirrors in `references/short-term/`: `comfyui` (image-generation engine reference, Python), `blinko` (TypeScript inbox), `opencodex` (Node + Swift codex gateway).
- Mac video path that uses a comparable FFT/LOD approach: `/Users/mose/Documents/Codex/2026-05-18/ltx-video-13b-0-9-8`.