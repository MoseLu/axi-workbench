---
id: axi-docs-zh-projects-pelagic
title: Pelagic — Island (WebGL Procedural Ocean)
type: project
status: published
tags: [Axi Docs, 项目, candidates, webgl, three.js, visual-experiment]
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

> 本 dossier 的权威来源:`/Volumes/code/workspace/candidates/pelagic/`。
> Partition:`candidates/`。Branch:`dev`(领先 `origin/dev` 9 个 commit)。

## Summary

Pelagic 是一个独立发布、仅运行于浏览器的视觉实验,涵盖程序化海洋、天空、
天气、天体力学与昼夜渲染。它不是产品 —— 而是一个刻意可调的"视觉游乐园":
每一项视觉维度(海况、浪幅、天气预设、月相、太阳高度角、相机漂移、时间
流模式)都通过控制面板直接呈现,因此同一渲染只需拖动滑块即可从平静海面
切换到台风。当前活跃技术栈是 Vite + 原生 ES 模块 + Three.js 0.180(依据
`package.json`);**没有** Svelte 迁移,也没有生产部署面。

渲染器以 shader 为核心:手写的频谱 GLSL `seaField(p, detail, footprint)`
同时返回高度及解析曲面导数,`reference-water.js` 材质把这些导数转换为屏幕
空间 Fresnel + 过滤后的太阳光团 + 月亮光团 + 银边,独立的 `underwater-world.js`
提供一个深度感知的体,带光柱、动画焦散、悬浮粒子与代理海床。大气层是一个
全屏天空 shader,绘制太阳盘 + 光环、带昼夜分割线与程序化环形山的月亮盘、
50+ 颗肉眼可见星表(J2000 RA/Dec)、三层程序化星密度层、带尘埃带的银河平面,
以及多尺度卷云层(通过两段可复用 GLSL 字符串 `WORLD_CLOUD_GLSL` 与
`CLOUD_SKY_LIGHTING_GLSL` 在天空与水之间共享)。

一个轻量 **environment bus**(`src/js/environment/bus.js`)集中 clock、
celestial、weather、wind、cloud、precipitation、ocean、lighting 与
observation 信号;用户覆盖严格高于自然值。一条 `EffectComposer` 链
(`RenderPass → UnderwaterCompositePass → UnrealBloomPass → OutputPass`)
以及一个 `quality-manager.js`(自动选择 `desktop-high / desktop-low /
mobile` 配置)使画面在 Retina 笔记本到粗指针手机上都能保持稳定。构建只需
`pnpm dev` / `pnpm build`,Vite 在 `127.0.0.1:5200` 上以 strict-port 模式
服务。

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

不存在远程 / registry 部署或安装步骤。项目暴露自身的本地环境、观测者纬度
(`{31.2304, 121.4737, timeZone: 8}`,位于 `ocean-scene/index.js:88`)与默认
仿真日期(查看者本地时钟的 `new Date()`)。

## Verification

```bash
pnpm test             # node --test exercises quality manager, scene camera,
                      # lunar phase visuals, water field/optics/state, environment
pnpm build            # Vite build with chunk-size warning lifted to 1000 KB
git diff --check      # required by AGENTS.md before commit
```

`README.md` 进一步文档化了视觉 / 交互不变量:shader 是项目核心
(`uSea / uTime / uWeatherSeaMultiplier` 是 JS uniform,其余皆为 GLSL);
`#boot-screen` 至少等待 2 帧后再隐藏;所有 sky / galaxy / sun / moon 资源
均设置 `toneMapped:false`(保留该边界,否则 ACES 会把 HDR 压回去);
`waterMaterial.customProgramCacheKey`(`'pelagic-ocean-foam-v73'`)在顶点 /
片段变更后必须 bump。Legacy CPU 浪 / 泡沫路径保留在 `if (false)` 下,不得
重新启用。

## Architecture Highlights

**Environment bus 作为唯一真理之源。**`createEnvironmentBus`
(`src/js/environment/bus.js`)是编排者:它拥有 `createEnvironmentClock`
(33 ms 最大帧 delta)、`createOverrideStore`(严格高于自然值)、
`createWeatherCycle`(自动 clear → partly-cloudy → rain → clear,18 秒过
渡)以及 `weather/lighting.js` 中的 `deriveLightingState` 策略层。每一次
tick,bus 返回一个冻结的 `snapshot`,包含 `clock`、`celestial`、`wind`、
`weather`、`cloud`、`precipitation`、`ocean`、`lighting`、`observation`
信号。渲染器只读 snapshot —— 它们从不重算天气。`extension-bus.js` 提供只
读扩展钩子,因此扩展不能变更核心环境。

**浪的频谱统一用于位移与光照。**`ocean-scene/water/reference-water.js`
定义 `seaField(p, detail, footprint)`,返回 `(height, ∂h/∂x, ∂h/∂z)`。
顶点 shader 用 `wave.x` 位移 `p.y`,然后片段 shader 重算
`wave = seaField(surface, 1.0, footprint)` 并以
`normalize(vec3(-wave.y, 1.0, -wave.z))` 重建解析法线 —— 共享同一域 warp,
因此在相机环绕时,太阳反射仍附着在运动的水面上。频谱为 18 层,振幅逐层
收缩、`k *= 1.43` 增长,慢速相位调制 `bend = sin(...)`,以及一个 `detail`
LOD 权重在超过约 6 个世界单位后隐藏细纹波。一个并行的 CPU 实现
(`water-field.js`,`DEFAULT_BANDS` 为三条正弦带)用于非 GPU 的水面状态查询
(深度、泡沫),由 `player-water-state.js`(WALK / WADE / SWIM / UNDERWATER
/ EMERGE 状态机)消费。

**大气层作为屏幕空间的全视口 shader。**位于 `ocean-scene/index.js:187` 的
4000×4000 天空面以 `toneMapped:false` 与 `renderOrder: -10` 渲染,与 water
与 cloud 共享 `skyUniforms`,因此一次写入就会流向所有依赖的 shader。片
段 shader 使用 **camera ray**(从 `gl_FragCoord` / `uSkyResolution` 重建)
而非 NDC —— 这使 star、sun、moon 与 cloud 钉在天球上而非屏幕空间。Sun 是
一个小盘(`smoothstep(0.0115, 0.0138, d)`)加上 `exp(-d² × 1800)` 的内辉
与各向异性光环;moon 是一个 `sqrt(1 − dot(plane²))` 的球冠,带程序化月海
与环形山场,以及 `smoothstep(-0.012, 0.02, dot(N, L))` 昼夜分割线。Stars
合成三层程序化层(`starLayer(72×36, 0.948, 0.026, 1.08)` /
`180×90 / 0.86 / 0.016 / 0.72` / `360×180 / 0.90 / 0.011 / 0.38`),星表循
环遍历 `NAKED_EYE_STARS.length` 个条目,打包为 `uCatalogStars[52]` 与
`uCatalogStarColors[52]` uniform —— 每颗星都按 J2000 RA/Dec 转换为屏幕
位置,加上 magnitude-scaled core 与 exponential halo。

**Lighting 作为纯策略函数。**`deriveLightingState({solarAltitude,
lunarAltitude, moonIllumination, sunset, night, seaState, weatherProfile,
cloudDensity, visibleSkyRatio})` 返回 `{sunEnergy, moonEnergy,
sunDominance, moonDominance, windScale, seaMultiplier, cloudCoverage,
cloudThickness, precipitation, precipitationRate, cloudSunEnergy,
cloudMoonEnergy, ambientEnergy}`。它把每一个环境关注点折叠成一个小的
对象,于是 water shader、sky shader、precipitation uniforms 与 bloom
pass 都消费同一个一致状态。

**自适应质量 + 后处理链。**`core/quality-manager.js` 在 `coarsePointer ||
Math.min(width,height) < 600` 时选 `mobile`,在 `pixelRatio > 1.75 ||
width*height > 3_000_000` 时选 `desktop-low`,否则选 `desktop-high`。
`render/pipeline.js` 构建 `EffectComposer → RenderPass →
UnderwaterCompositePass → UnrealBloomPass → OutputPass`;underwater composite
从 EffectComposer 的 render target 读取 `tDiffuse` 与 `tDepth`,写入深度感知
的焦散、光柱与轻微折射失真。`core/profiler.js` 暴露一个 `?debug=1` overlay
(`#fps`、`#telemetry`)。

**Sky/water 卷云耦合。**`atmosphere/cloud-layer.js` 输出两段可复用 GLSL
字符串:`WORLD_CLOUD_GLSL` 提供 `cloudField()`、`cloudRay()` 与
`cloudOpticalDepth()`;`CLOUD_SKY_LIGHTING_GLSL` 嵌入到 sky 片段 shader
中,沿层积分三个 ray sample(near / mid / far),加上一个由 `cloudEdge`
调制的银边项。Sky pass 写入 `uCloudSunOcclusion / uMoonCloudOcclusion`,
water shader 将其乘入自己的 sun lobe 与 moon lobe。

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

项目没有正式的 milestone 文档;进度记录在 `progress.md`、`plans/` 与 git log
中。最近一次交付批次是 star/atmosphere 重构(见 `CHANGELOG.md`),而
`feature/ci-check-design-tokens-entry` 分支将项目接入
`foundation/axi-ui/scripts/check-design-tokens.mjs` + `check-ui-aesthetic.mjs`
gate。

## 备注

- 视觉 / 交互不变量:`#boot-screen` 至少等待 2 帧后再隐藏;sky / galaxy / sun / moon 资源均设置 `toneMapped:false`;`waterMaterial.customProgramCacheKey` 在顶点 / 片段变更后必须 bump。
- Legacy CPU 浪 / 泡沫路径保留在 `if (false)` 下,不得重新启用。
- 观测者纬度为 `{31.2304, 121.4737, timeZone: 8}`(硬编码于 `ocean-scene/index.js:88`);默认仿真日期为查看者本地时钟的 `new Date()`。
- 兄弟候选项目 `/Volumes/code/workspace/candidates/axi-file-preview` 共享该小型 JS state container + subscribe 模式。

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

- 兄弟候选项目:`/Volumes/code/workspace/candidates/axi-file-preview`(axi-file-preview 文档化了 `custom-video-player` + `xlsx-report-renderer` 候选)。
- Workspace governance:`/Volumes/code/workspace/foundation/workspace-governance/`(注册 / 审计 / `workspace.graph.json`)。
- Axi visual 实验与 `/Volumes/code/workspace/candidates/axi-file-preview` 共享 environment bus 模式(小型 JS state container + subscribe)。
- Personal-OS PRD 家族:`/Volumes/code/workspace/docs/prd/01-AxiomaticWorld-Personal-OS-PRD.md`(`PRD.md` 中作为上游 L1 文档引用)。