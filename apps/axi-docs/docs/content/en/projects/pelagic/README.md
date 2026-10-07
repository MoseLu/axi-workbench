---
id: axi-docs-en-projects-pelagic
title: Pelagic — Island (WebGL Procedural Ocean)
type: project
status: published
tags: [Axi Docs, Projects, candidates, webgl, three.js, visual-experiment]
created: 2026-10-07
modified: 2026-10-07
graph-title: Pelagic
graph-tags: [Projects, candidates, visual-experiment]
description: Standalone Vite + Three.js / WebGL procedural-ocean visual experiment with light environment bus, post-process pipeline, and tunable sky/ocean/weather/time controls.
project:
  id: pelagic
  partition: candidates
  path: /Volumes/code/workspace/candidates/pelagic
  source-section: core
---

# Pelagic — Island (WebGL Procedural Ocean)

> Source of truth for this dossier: `/Volumes/code/workspace/candidates/pelagic/`.
> Partition: `candidates/`. Branch: `dev` (9 commits ahead of `origin/dev`).

## Summary

Pelagic is an independently released, browser-only WebGL visual experiment for
procedural ocean, sky, weather, celestial mechanics, and time-of-day rendering.
It is not a product — it is a deliberately tunable "visual playground": every
visual dimension (sea state, wave amplitude, weather preset, lunar phase, sun
altitude, camera drift, time-flow mode) is exposed through the in-DOM control
panel so the same render changes from flat calm to typhoon simply by dragging
a slider. The active stack is Vite + native ES modules + Three.js 0.180
(per `package.json`); there is **no Svelte migration** and no production
deployment surface.

The renderer is shader-led: a hand-written spectrum GLSL `seaField(p, detail,
footprint)` produces both height and analytic surface derivatives, the
`reference-water.js` material turns those derivatives into screen-space Fresnel
+ filtered sun lobe + moon lobe + silver lining, and a separate
`underwater-world.js` provides a depth-aware volume with light shafts, animated
caustics, suspended motes, and a proxy seabed. The atmosphere is a full-screen
sky shader that draws sun disk + halo, moon disk with terminator and procedural
craters, a 50+ star naked-eye catalog (J2000 RA/Dec), three procedural star
density layers, galactic plane with dust lane, and a multi-scale cirrus layer
shared between sky and water via two reusable GLSL strings (`WORLD_CLOUD_GLSL`
and `CLOUD_SKY_LIGHTING_GLSL`).

A lightweight **environment bus** (`src/js/environment/bus.js`) centralizes
clock, celestial, weather, wind, cloud, precipitation, ocean, lighting, and
observation signals; user overrides strictly outrank natural values. An
`EffectComposer` chain (`RenderPass → UnderwaterCompositePass → UnrealBloomPass
→ OutputPass`) and a `quality-manager.js` that auto-selects
`desktop-high / desktop-low / mobile` profiles keep the visual steady from
Retina laptops down to coarse-pointer phones. Build is a single `pnpm dev` /
`pnpm build` with Vite serving on `127.0.0.1:5200` in strict-port mode.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Build / dev server | Vite 5+ (`vite.config.js`, `strictPort: 5200`) | Custom plugin rewrites `src/html/index.html` to `/`, raises `chunkSizeWarningLimit` to 1000 KB for Three.js |
| Runtime renderer | Three.js 0.180.0 + addons (`Water`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`) | Native ES module entry at `src/js/index.js` → `ocean-scene/index.js` |
| Shading | Custom GLSL ES via `THREE.ShaderMaterial` | `reference-water.js`, `cloud-layer.js`, `underwater-world.js`, `mechanical-clock.js`, `render/pipeline.js` (composite pass) |
| Time / clock | Custom JS clock module + `performance.now()` minute keys | `environment/clock.js`, `time-flow/index.js`, `local-time/index.js` |
| State bus | Plain JS + `Map` subscriptions + `Object.freeze` snapshots | `environment/bus.js`, `environment/signals.js` |
| Asset pipeline | CanvasTexture (radial dial, nebula, roughness), HTMLCanvasElement-driven equirectangular environment | `mechanical-clock.js`, `paintEnvironment()` in `ocean-scene/index.js` |
| Tests | `node:test` (built-in Node ≥ 18) | `tests/p0-foundation.test.js`, `environment.test.js`, `water-foundation.test.js` |
| Package manager | pnpm 10.33.2 (`packageManager` pinned in `package.json`) | Node ≥ 18 required |
| Fonts | Manrope + DM Mono via Google Fonts | Loaded in `index.html` |

## Project Layout

```text
pelagic/
├── package.json                   # pnpm@10.33.2, three 0.180.0, vite latest
├── pnpm-lock.yaml
├── vite.config.js                 # Root entry rewrite plugin, port 5200 strict
├── README.md / DESIGN.md / PRD.md / CHANGELOG.md / CHANGE.md / TASK.md / TODO.md
├── public/
│   ├── seagull.svg                # favicon
│   └── assets/clock/              # brushed-gunmetal.png, metal-roughness.png,
│                                  # moon-albedo.png, moon-phase-sprites.png
├── outputs/                       # reference captures (not a build input)
├── plans/                         # design iteration plans
├── progress.md
├── tests/
│   ├── p0-foundation.test.js      # quality manager, scene camera, lunar phases
│   ├── environment.test.js
│   └── water-foundation.test.js
├── docs/
│   ├── HANDOFF.md                 # zero-context takeover brief
│   ├── logs/
│   └── project-docs.manifest.json
├── dist/                          # `pnpm build` output
└── src/
    ├── html/index.html            # single canvas #water-canvas + control panel + boot screen
    ├── css/
    │   ├── index.css              # aggregator
    │   ├── core/                  # base + theme tokens
    │   ├── scene/                 # canvas + loading overlay
    │   ├── controls/              # control borders
    │   ├── control-panel/         # panel footer (drift, reset)
    │   ├── local-time/            # mechanical ring decorations
    │   ├── time-flow/             # capsule track CSS vars
    │   └── ocean-scene/           # scene-specific styles
    └── js/
        ├── index.js               # sole JS entry → ocean-scene/index.js
        ├── environment/           # bus.js, clock.js, signals.js, overrides.js,
        │                          # weather-cycle.js, extension-bus.js, index.js
        ├── ocean-scene/
        │   ├── index.js           # 2250-line scene assembler
        │   ├── precipitation-system.js
        │   ├── underwater-world.js
        │   ├── water/
        │   │   ├── index.js, reference-water.js, water-field.js,
        │   │   ├── water-optics.js, player-water-state.js
        │   └── atmosphere/
        │       ├── index.js, lighting-state.js, cloud-layer.js,
        │       └── star-catalog.js   (NAKED_EYE_STARS, GALACTIC_NORTH_POLE)
        ├── render/pipeline.js     # EffectComposer + UnderwaterCompositePass
        ├── core/
        │   ├── quality-manager.js # desktop-high / desktop-low / mobile
        │   └── profiler.js        # FPS / telemetry
        ├── control-panel/index.js # sea / weather / wind / cloud / star / etc.
        ├── scene-camera/index.js  # pointer orbit + damped easing
        ├── local-time/
        │   ├── index.js           # lunar calendar, time dial
        │   ├── mechanical-clock.js # embedded Three.js clock face
        │   └── phase-visuals.js
        ├── time-flow/index.js     # custom / actual / stopped modes
        ├── weather/
        │   ├── index.js, state.js # subscribe model
        │   ├── presets.js         # 8 weather profiles
        │   └── lighting.js        # deriveLightingState (policy layer)
        └── shared/index.js        # describeSeaState, formatTime, renderClockNumerals
```

## Build & Install

```bash
# Install
pnpm install          # Node ≥ 18, pnpm ≥ 10

# Dev server (port 5200, strict — Vite errors if taken)
pnpm dev              # → http://127.0.0.1:5200/
pnpm dev              # debug telemetry: http://127.0.0.1:5200/?debug=1

# Production build (Vite, output -> ../dist)
pnpm build

# Preview built bundle
pnpm preview

# Unit tests
pnpm test             # node --test tests/*.test.js
```

There is no remote / registry deploy and no installation step. The project
exposes its own local environment, observer latitude (`{31.2304, 121.4737,
timeZone: 8}` in `ocean-scene/index.js:88`), and default simulation date
(`new Date()` of the viewer's local clock).

## Verification

```bash
pnpm test             # node --test exercises quality manager, scene camera,
                      # lunar phase visuals, water field/optics/state, environment
pnpm build            # Vite build with chunk-size warning lifted to 1000 KB
git diff --check      # required by AGENTS.md before commit
```

`README.md` further documents visual / interaction invariants: shader is the
heart of the project (`uSea / uTime / uWeatherSeaMultiplier` are JS uniforms
the rest is GLSL), `#boot-screen` waits at least 2 frames before hiding, all
sky / galaxy / sun / moon resources are `toneMapped:false` (preserve this
boundary or ACES will compress HDR back), and `waterMaterial.customProgramCacheKey`
bump (`'pelagic-ocean-foam-v73'`) is required after vertex/fragment changes.
The legacy CPU wave/foam path is preserved under `if (false)` and must not be
re-enabled.

## Architecture Highlights

**Environment bus as the single source of truth.** `createEnvironmentBus`
(`src/js/environment/bus.js`) is the choreographer: it owns the
`createEnvironmentClock` (33 ms max frame delta), the `createOverrideStore`
(strictly outranking natural values), `createWeatherCycle` (auto clear →
partly-cloudy → rain → clear with 18-second transitions), and the
`deriveLightingState` policy layer in `weather/lighting.js`. Each tick the
bus returns a frozen `snapshot` with `clock`, `celestial`, `wind`, `weather`,
`cloud`, `precipitation`, `ocean`, `lighting`, and `observation` signals.
The renderers only ever read the snapshot — they never recompute weather.
`extension-bus.js` provides a read-only extension hook so extension objects
cannot mutate core environment.

**Wave spectrum unified for displacement and lighting.**
`ocean-scene/water/reference-water.js` defines `seaField(p, detail, footprint)`
which returns `(height, ∂h/∂x, ∂h/∂z)`. The vertex shader displaces `p.y`
with `wave.x`, then the fragment shader recomputes `wave = seaField(surface,
1.0, footprint)` and rebuilds the analytic normal as
`normalize(vec3(-wave.y, 1.0, -wave.z))` — sharing the same domain warp so
the reflection of the sun stays attached to the moving surface when the
camera orbits. The spectrum is 18 layers with progressively shrinking
amplitude and `k *= 1.43` growth, slow phase modulation
`bend = sin(...)`, and a `detail` LOD weight that hides fine ripples
beyond ~6 world units. A parallel CPU implementation
(`water-field.js` with `DEFAULT_BANDS` of three sine bands) exists for
non-GPU water state queries (depth, foam) used by `player-water-state.js`
(WALK / WADE / SWIM / UNDERWATER / EMERGE transitions).

**Atmosphere as screen-space full-viewport shader.** The 4000×4000 sky plane
at `ocean-scene/index.js:187` is rendered with `toneMapped:false` and
`renderOrder: -10`, sharing `skyUniforms` with both water and clouds so a
single write flows to every dependent shader. The fragment shader uses the
**camera ray** (reconstructed from `gl_FragCoord` / `uSkyResolution`) rather
than NDC — this keeps stars, sun, moon, and clouds pinned to the celestial
sphere instead of screen-space. Sun is a small disk
(`smoothstep(0.0115, 0.0138, d)`) plus an `exp(-d² × 1800)` inner glow and
anisotropic halo; moon is a `sqrt(1 − dot(plane²))` spherical cap with
procedural mare/crater fields and a `smoothstep(-0.012, 0.02, dot(N, L))`
terminator. Stars combine three procedural layers
(`starLayer(72×36, 0.948, 0.026, 1.08)` / `180×90 / 0.86 / 0.016 / 0.72` /
`360×180 / 0.90 / 0.011 / 0.38`) with the catalog star loop running over
`NAKED_EYE_STARS.length` entries packed into `uCatalogStars[52]` and
`uCatalogStarColors[52]` uniforms — every catalog star is rendered with its
J2000 RA/Dec converted to a screen position plus a magnitude-scaled core and
exponential halo.

**Lighting as a pure policy function.** `deriveLightingState({solarAltitude,
lunarAltitude, moonIllumination, sunset, night, seaState, weatherProfile,
cloudDensity, visibleSkyRatio})` returns `{sunEnergy, moonEnergy,
sunDominance, moonDominance, windScale, seaMultiplier, cloudCoverage,
cloudThickness, precipitation, precipitationRate, cloudSunEnergy,
cloudMoonEnergy, ambientEnergy}`. It collapses every environmental concern
into a single small object so the water shader, the sky shader, the
precipitation uniforms, and the bloom pass all consume one consistent state.

**Adaptive quality + post-processing chain.** `core/quality-manager.js` picks
`mobile` when `coarsePointer || Math.min(width,height) < 600`,
`desktop-low` when `pixelRatio > 1.75 || width*height > 3_000_000`, else
`desktop-high`. `render/pipeline.js` builds
`EffectComposer → RenderPass → UnderwaterCompositePass → UnrealBloomPass →
OutputPass`; the underwater composite reads `tDiffuse` and `tDepth` from the
EffectComposer's render target and writes depth-aware caustics, light
shafts, and a small refraction distortion. `core/profiler.js` exposes an
optional `?debug=1` overlay (`#fps`, `#telemetry`).

**Sky/water cirrus coupling.** `atmosphere/cloud-layer.js` exports two
reusable GLSL strings: `WORLD_CLOUD_GLSL` provides `cloudField()`,
`cloudRay()`, and `cloudOpticalDepth()`; `CLOUD_SKY_LIGHTING_GLSL` is
embedded inside the sky fragment shader and integrates three ray samples
(near / mid / far) against the layer, plus a silver-lining term modulated
by `cloudEdge`. The sky pass writes `uCloudSunOcclusion / uMoonCloudOcclusion`
which the water shader multiplies into its sun lobe and moon lobe.

## Key Modules/Files

| Module / file | Role | Lines |
| --- | --- | --- |
| `src/js/ocean-scene/index.js` | Scene assembler: renderer, scene, camera, sky plane, sky dome, ocean mesh with `onBeforeCompile` Gerstner displacement, three.js `Water` for reflection, precipitation system, render pipeline, animation loop | 2250 |
| `src/js/ocean-scene/water/reference-water.js` | Active water `ShaderMaterial`: GLSL `seaField` (18-layer spectrum + analytic derivatives), Fresnel, sun core/sheen/aureole, moon core/sheen, underwater composite colour, haze | 193 |
| `src/js/ocean-scene/water/water-field.js` | CPU `createWaterField({baseLevel, seabedDepth, bands})` returning `{height, normal, foam, depth}` queries for non-GPU consumers | 59 |
| `src/js/ocean-scene/water/water-optics.js` | Bounded `createWaterOptics({absorption, scattering, ior, turbidity, baseColor})` and `waterOpticsToUniforms()` bridge | 36 |
| `src/js/ocean-scene/water/player-water-state.js` | `WALK / WADE / SWIM / UNDERWATER / EMERGE` state machine driven by depth and dive intent | 42 |
| `src/js/ocean-scene/atmosphere/star-catalog.js` | `NAKED_EYE_STARS` (52 frozen `{name, ra, dec, magnitude, color}` entries from Sirius to Alphecca) + `GALACTIC_NORTH_POLE` | 63 |
| `src/js/ocean-scene/atmosphere/cloud-layer.js` | Exports `WORLD_CLOUD_GLSL` (multi-scale cirrus + optical depth) and `CLOUD_SKY_LIGHTING_GLSL` | 130 |
| `src/js/ocean-scene/underwater-world.js` | Underwater volume sphere + seabed plane + 900 GPU motes; back-side transparent shader with shafts + caustics + sun alignment | 195 |
| `src/js/ocean-scene/precipitation-system.js` | `MAX_DROPS = 1400` rain point cloud with `LinearCongruential` RNG, fade-in/out, wind-advected velocities | 94 |
| `src/js/environment/bus.js` | `createEnvironmentBus({defaults})`: clock step + override store + weather cycle + lighting policy + freeze-shallow snapshot | 261 |
| `src/js/environment/clock.js` | `createEnvironmentClock` with `MAX_DELTA_SECONDS = 0.033` | 28 |
| `src/js/environment/weather-cycle.js` | Auto clear → partly-cloudy → rain → clear state machine, 18 s transitions | 80+ |
| `src/js/environment/overrides.js` | `createOverrideStore` — path-keyed overrides that strictly outrank natural values | 47 |
| `src/js/environment/signals.js` | `ENVIRONMENT_SIGNALS`, `WEATHER_MODES`, `DEFAULT_ENVIRONMENT_DEFAULTS` | 31 |
| `src/js/weather/presets.js` | 8 weather profiles (clear / partly-cloudy / overcast / rain×3 / typhoon×2) | 69 |
| `src/js/weather/lighting.js` | `deriveLightingState` — single lighting policy function | 51 |
| `src/js/weather/state.js` | Weather state container with `getSnapshot / setWeather / setType / setIntensity / subscribe` | small |
| `src/js/render/pipeline.js` | `EffectComposer` chain + `UnderwaterCompositePass` depth-aware caustics/shafts | 179 |
| `src/js/core/quality-manager.js` | `desktop-high / desktop-low / mobile` profiles auto-selected from viewport | 65 |
| `src/js/core/profiler.js` | FPS + telemetry overlay used by `?debug=1` | small |
| `src/js/control-panel/index.js` | Sea / weather / wind / cloud / star / drift / reset UI wiring | mid |
| `src/js/scene-camera/index.js` | Pointer-orbit with yaw/pitch damping (`1 − exp(−damping · delta)`) | 39 |
| `src/js/local-time/index.js` | Lunar calendar (30 ticks, 8 hit nodes) + mechanical clock + time dial | mid |
| `src/js/local-time/mechanical-clock.js` | Embedded Three.js scene for the mechanical clock face (radial dial + nebula canvas textures, brushed-gunmetal PNGs) | mid |
| `src/js/local-time/phase-visuals.js` | `getLunarNodeAngle / getLunarNodePhase / getSelectedLunarNode / getPhaseVisualState` | small |
| `src/js/time-flow/index.js` | `custom / actual / stopped` modes, minute-key follow logic | 132 |
| `vite.config.js` | Custom plugin to expose `src/html/index.html` at `/`, strict port 5200 | 49 |

## Milestone Status

The project does not carry a formal milestone document; progress is tracked in
`progress.md`, `plans/`, and the git log. The most recent shipped batch was a
star/atmosphere refactor (logged in `CHANGELOG.md`), and `feature/ci-check-design-tokens-entry`
branch brings the project onto the `foundation/axi-ui/scripts/check-design-tokens.mjs`
+ `check-ui-aesthetic.mjs` gates.

## Notes

- Visual / interaction invariants: `#boot-screen` waits at least 2 frames before hiding; sky/galaxy/sun/moon resources are `toneMapped:false`; `waterMaterial.customProgramCacheKey` must be bumped after vertex/fragment changes.
- The legacy CPU wave/foam path is preserved under `if (false)` and must not be re-enabled.
- Observer latitude is `{31.2304, 121.4737, timeZone: 8}` (hard-coded in `ocean-scene/index.js:88`); simulation date defaults to `new Date()` of the viewer's local clock.
- Sibling candidate project `/Volumes/code/workspace/candidates/axi-file-preview` shares the small JS state-container with subscribe pattern.

## Authoritative Documents

- [`/Volumes/code/workspace/candidates/pelagic/README.md`](/Volumes/code/workspace/candidates/pelagic/README.md) — primary entrypoint, complete module/feature description
- [`/Volumes/code/workspace/candidates/pelagic/AGENTS.md`](/Volumes/code/workspace/candidates/pelagic/AGENTS.md) — scope, read order, verification rules
- [`/Volumes/code/workspace/candidates/pelagic/PRD.md`](/Volumes/code/workspace/candidates/pelagic/PRD.md) — product requirements (G1–G3, N1–N3) declaring "不迁 Svelte"
- [`/Volumes/code/workspace/candidates/pelagic/DESIGN.md`](/Volumes/code/workspace/candidates/pelagic/DESIGN.md) — high-level design statement
- [`/Volumes/code/workspace/candidates/pelagic/CHANGELOG.md`](/Volumes/code/workspace/candidates/pelagic/CHANGELOG.md) — star/atmosphere refactor log
- [`/Volumes/code/workspace/candidates/pelagic/CHANGE.md`](/Volumes/code/workspace/candidates/pelagic/CHANGE.md) — short change record
- [`/Volumes/code/workspace/candidates/pelagic/docs/HANDOFF.md`](/Volumes/code/workspace/candidates/pelagic/docs/HANDOFF.md) — zero-context takeover brief
- [`/Volumes/code/workspace/candidates/pelagic/vite.config.js`](/Volumes/code/workspace/candidates/pelagic/vite.config.js) — Vite root entry rewrite + strict port
- [`/Volumes/code/workspace/candidates/pelagic/src/js/environment/bus.js`](/Volumes/code/workspace/candidates/pelagic/src/js/environment/bus.js) — single source of truth for environment state
- [`/Volumes/code/workspace/candidates/pelagic/src/js/ocean-scene/index.js`](/Volumes/code/workspace/candidates/pelagic/src/js/ocean-scene/index.js) — scene assembler and animation loop
- [`/Volumes/code/workspace/candidates/pelagic/src/js/ocean-scene/water/reference-water.js`](/Volumes/code/workspace/candidates/pelagic/src/js/ocean-scene/water/reference-water.js) — water shader
- [`/Volumes/code/workspace/candidates/pelagic/src/js/render/pipeline.js`](/Volumes/code/workspace/candidates/pelagic/src/js/render/pipeline.js) — EffectComposer + underwater composite
- [`/Volumes/code/workspace/candidates/pelagic/tests/p0-foundation.test.js`](/Volumes/code/workspace/candidates/pelagic/tests/p0-foundation.test.js) — quality / camera / lunar phase tests

## Cross-References

- Sibling candidate project: `/Volumes/code/workspace/candidates/axi-file-preview` (axi-file-preview documents the `custom-video-player` + `xlsx-report-renderer` candidate).
- Workspace governance: `/Volumes/code/workspace/foundation/workspace-governance/` (registration / audit / `workspace.graph.json`).
- Axi visual experiments share the environment bus pattern with `/Volumes/code/workspace/candidates/axi-file-preview` (small JS state container with subscribe model).
- Personal-OS PRD family: `/Volumes/code/workspace/docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md` (referenced from `PRD.md` as the upstream L1 document).