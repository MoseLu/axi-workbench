---
id: axi-docs-zh-projects-tidewater-reference
title: Tidewater 参考
type: project
status: published
tags: [Axi Docs, 项目, references, third-party, graphics, webgpu, wgsl, javascript, vite, ocean-simulation]
created: 2026-10-07
modified: 2026-10-07
graph-title: Tidewater 参考
graph-tags: [Projects, references, graphics, webgpu]
description: 第三方参考镜像 `dgreenheck/tidewater` —— 基于裸 `WebGPU` + `WGSL` 的实时热带岛屿 / 海洋钓鱼游戏，配有兼容 three.js 的自定义 CPU 引擎。供研究海洋渲染、FFT 水体模拟以及小型引擎架构。基于 `GPU.js` + `WebGPU` + `WGSL` + `OceanFFT.js` + `ShoreSim.js` + `TemporalUpscale.js` + `AntiAlias.js` + `Vite ^8.3.0`。
project:
  id: tidewater-reference
  partition: references/short-term
  path: /Volumes/code/workspace/references/short-term/tidewater-reference
  upstream: https://github.com/dgreenheck/tidewater
  source-section: reference
---

# Tidewater 参考

> 对上游 Tidewater（Dylan Greenheck，MIT）的只读参考镜像。上游产品意图的权威源是上游仓库；本地 `AGENTS.md` 存根规定 Axi 如何对待它。
> 章节：reference / 分区：`references/short-term/`。

## 概要

Tidewater 是一个浏览器中的实时热带岛屿钓鱼游戏，跑在裸 `WebGPU` + `WGSL` 之上，自带一套自定义渲染引擎——没有 three.js runtime、没有 Babylon、没有 PlayCanvas。CPU 一侧是兼容 three.js 的数学 / 场景 / 几何层（`src/engine/`），让作者能在原始 three.js 分支与 WebGPU 原生分支之间迁移工作负载而无需重写一切；GPU 一侧是手写、无框架的 WebGPU 层（`src/engine/webgpu.js`、`src/engine/gpu/GPU.js`、`src/engine/render/`），提供 `Material`、`ComputeKernel`、`ShaderModule`、`RenderTarget`、`FullscreenPass`、`SkinnedModel` 等原语。

对 Axi 来说，这是一个渲染与模拟参考，不是一个值得克隆或运营的产品。值得 Axi 研究的模式是：(1) 单一 `GPU` 单例 + 每帧一条命令编码器的提交纪律；(2) 四级级联 Tessendorf FFT 海洋（`src/ocean/OceanFFT.js`，每行 256 点基-2 IFFT，每个级联四个打包复杂字段）；(3) 驱动沙滩上湿沙线上下移动的浅水"swash"模拟（`src/ocean/ShoreSim.js` + `ShoreWaves.js`）；(4) `src/post/TemporalUpscale.js` 与 `AntiAlias.js` 中的时序上采样 + 抖动历史 TAA；(5) 每帧的 `G` 全局 uniform（`frame.sunDir`、`frame.time`、抖动 view-proj），每个系统都绑定同一份而无需重新上传；(6) URL 旋钮纪律（`?fly`、`?noAudio`、`?noClouds`、`?noCaustics`、`?noVeg`、`?noSim`、`?bench`、`?auto`、`?shots=…`），让单一静态构建可从地址栏调试与基准测试。

**阶段**：第三方参考快照。**生命周期**：只读镜像。**权威路径**：`/Volumes/code/workspace/references/short-term/tidewater-reference`。**上游**：`https://github.com/dgreenheck/tidewater`（可玩版本 `https://dgreenheck.github.io/tidewater/`）。**上游许可**：MIT。**Axi overlay**：分支 `agent/audit-fix-a09-tidewater-agents`，最近本地提交 `b594c25 docs(tidewater-reference): add AGENTS.md stub`。**工作树**：在本地 audit 分支上干净。

## Stack

`JavaScript (ES modules)`, `Vite ^8.3.0`, `webgpu ^0.6.1`, `WebGPU`, `WGSL`, `Custom three.js-compatible API`, `GLTF/GLB parser`, `GPU singleton`, `ShaderModule`, `SkinnedModel`, `Tessendorf FFT`, `Horvath/JONSWAP`, `CDLOD`, `Hillaire 2020 PBR atmosphere`, `TAAU`, `SMAA`, `GTAO`, `GitHub Pages`, `MIT`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — 自定义 WebGPU + WGSL 引擎（无 three.js runtime） | 已交付 | `src/engine/webgpu.js`（公开导出 `GPU`、`Material`、`ComputeKernel`、`ShaderModule`、`RenderTarget`、`FullscreenPass`、`loadGLB`） |
| M2 — 兼容 three.js 的数学 / 场景 / 几何层 | 已交付 | `src/engine/index.js` 重导出 math + scene + geometry；基本几何体 `Box/Sphere/Cylinder/Cone/Plane/Circle/Torus/Lathe/Icosahedron/Tube/RoundedBox` |
| M3 — 每帧 `GPU` 单例 + 编码器 + submit 钩子 | 已交付 | `src/engine/gpu/GPU.js`（252 LOC）含 adapter/device/limits + 预建采样器 + 每帧 encoder |
| M4 — 四级级联 Tessendorf FFT 海洋 | 已交付 | `src/ocean/OceanFFT.js`（656 LOC）—— 每行 256 点基-2 IFFT，四个打包复杂字段（`c0 = Dx + i Dz`、`c1 = Dy + i dDx/dz`、`c2 = dDy/dx + i dDy/dz`、`c3 = dDx/dx + i dDz/dz`） |
| M5 — 浅水"swash"模拟 | 已交付 | `src/ocean/ShoreSim.js` + `src/ocean/ShoreWaves.js`（697 LOC）+ `Breakers.js` + `SurfFoam.js` |
| M6 — GLTF/GLB 加载器 + GPU 蒙皮 | 已交付 | `src/engine/loaders/GLTF.js` + `src/engine/render/Skinning.js`（`SkinnedModel.create`，motion-vector-aware） |
| M7 — Reversed-Z、抖动历史 TAA + SMAA | 已交付 | `src/post/TemporalUpscale.js` + `src/post/AntiAlias.js`（UI 中可配置 Off / 2x / 4x / 8x / 16x） |
| M8 — GTAO + 水下合成 + 空气霾 | 已交付 | `src/post/PostFX.js`（722 LOC）编排 `Underwater.js`、`AirHaze.js`、`GTAO.js`、`MotionBlur.js`、`LensFlare.js`、`LensDroplets.js` |
| M9 — Hillaire 2020 PBR 天空 + 体云 | 已交付 | `src/sky/Atmosphere.js` + `Sky.js` + `Clouds.js` + `SkyProClouds.js` |
| M10 — 级联阴影贴图 + 地面反弹 | 已交付 | `src/engine/render/Shadows.js`（`SunShadows`、`DEPTH_FORMAT = depth32float`、reversed-Z）+ `src/materials/GroundBounce.js` |
| M11 — CDLOD 流式地形 + 程序化 + 扫描内容 | 已交付 | `src/core/CDLOD.js` + `src/world/TerrainGPU.js` + `Village.js` + `Pier.js` + `Reef.js` + `Vegetation.js` + `BoatModel.js` |
| M12 — 游戏玩法（rod / bites / fight / cooler / vendors） | 已交付 | `src/game/Game.js`（571 LOC）+ ~15 个兄弟模块（`FishingRod`、`Bites`、`CatchMinigame`、`FishStand`、`Chandlery`、`Guide`、`Minimap`） |
| M13 — URL 旋钮纪律 + 参考帧 | 已交付 | `?fly`、`?noAudio`、`?noClouds`、`?noHaze`、`?noCaustics`、`?noVeg`、`?noSim`、`?bench`、`?auto=<job>`、`?shots=…`、`?wdbg=N` |
| M14 — GitHub Pages CI/CD | 已交付 | `.github/workflows/deploy.yml`（build → upload artifact → push 到 `main` 后部署） |
| M15 — Axi overlay 文档 | 已交付 | 在 reference repo 根目录的 `AGENTS.md` 存根 |

## Build & Install

Axi 不构建也不安装这个参考；`package.json` 中记录的上游构建步骤对当前快照仍然有效：

```bash
cd /Volumes/code/workspace/references/short-term/tidewater-reference
npm install         # ~50 MB，仅拉取 vite + webgpu
npm run dev         # vite dev server:  http://127.0.0.1:5189
npm run build       # 在 dist/ 产出静态构建
npm test            # 仅 Node：node test/game-logic.mjs && node test/engine-smoke.mjs
```

系统要求（来自 `README.md`）：

- 支持 WebGPU 的浏览器（较新 Chrome、Edge、Safari）
- 一块能跑得动的 GPU —— 在 Apple M5 Pro 上目标 60 fps @ 2560×1267；在更弱的机器上动态分辨率会自动下调
- 首次加载会编译数百个着色器；后续访问因浏览器缓存会更快

静态构建支持的 URL 选项（来自 `README.md`）：

| 选项 | 作用 |
|---|---|
| `?fly` | 启动时进入自由相机 |
| `?noAudio` / `?noClouds` / `?noHaze` / `?noCaustics` / `?noVeg` / `?noSim` | 关闭单个系统（着色器仍然编译） |
| `?bench` | 跑 `core/Bench.js` 的帧时间基准；在隐藏标签页里 polyfill rAF 以适配自动化 |
| `?auto=<job>` | 驱动一个具名基准任务 |
| `?shots=view1,view2[&tag=…][&dt=…]` | 取具名视图的参考帧 |
| `?wdbg=N` | 设置水体着色器的 `debugMode` |

## Architecture Highlights

**一个 GPU 单例，每帧一条命令编码器。** 所有 GPU 工作都流经 `src/engine/gpu/GPU.js`：一个模块级单例，持有 `device`、`queue`、`context`、`format`、`features`、`limits`、预创建采样器（`linearRepeat`、`linearClamp`、`linearMirror`、`anisoRepeat`、`aniso4Repeat`、`anisoClamp`、`nearestClamp`、`nearestRepeat`、`shadow`）以及一条每帧 `encoder`，系统通过 `GPU.getEncoder()` 写入，再用 `GPU.submit()` 提交。`GPU.onSubmit(before, after)` 让 readback 钩子注册自身；`GPU.beginFrame()` 自增帧计数并返回 encoder。约定是：帧内发生的一切按提交顺序发生，正是这一约定让"queue.writeBuffer twice in one frame keeps only the last value"成为一个被记录在案的 footgun，而非不解之谜。

**通过 `ShaderModule` 的前缀纪律共享 WGSL。** 当 three.js/TSL 暴露函数（`terrainGPU.heightAt(xz)`、`clouds.shadow(xz)`、`shoreSim.sample(xz)`）时，Tidewater 的 WebGPU 层暴露 `ShaderModule`，其方法是名为 `<prefix><Method>` 的 WGSL 函数（例如 `shoreEvaluate`、`terrainSample`、`cloudShadow`）。模块列表、绑定布局与 uniform 块在所有 import 该模块的着色器之间共享。bind group 分层为：组 0 = `frame` uniforms + shared samplers，组 1 = module + material resources，组 2 = per-draw。这是 `docs/PORTING.md` 中描述的约定，也是海洋、地形、岸滨系统能彼此调用而无需重传纹理或常量的关键。

**四级级联 FFT 海洋是核心。** `src/ocean/OceanFFT.js` 每帧为所有级联运行恰好两次 compute dispatch：一次行 pass，时间演化频谱（`h0 → h(k,t)`）、构建四个打包复杂字段、在 workgroup memory 中对每行做 256 点基-2 IFFT；然后一次列 pass，做列 IFFT、符号纠正、基于 Jacobian 的泡沫累积，并把位移 / 导数写入数组纹理。打包复杂字段为：`c0 = Dx + i Dz`、`c1 = Dy + i dDx/dz`、`c2 = dDy/dx + i dDy/dz`、`c3 = dDx/dx + i dDz/dz`——每个复数 IFFT 对应四个实数字段，让水体着色器在单次 `textureSampleLevel` 调用中即可采样位移、导数与泡沫 Jacobian。四个级联采用非整数比的 tile 大小（`[733, 157, 33.3, 7.1]`）以避免可见重复，频谱使用 Horvath/JONSWAP 并开放风速、fetch、涌浪、峰放大、短波淡出等旋钮。

**Reversed-Z、抖动历史、由 motion vector 驱动的 TAA。** `SceneRenderer` 导出 `SCENE_FORMATS`（color + velocity + mask）和 `DEPTH_FORMAT = depth32float`，depth 清零时天空像素也保持深度 0。`FrameUniforms`（即 `G` 全局）携带 `cameraPos`、`view`、`proj`、`viewProj`（抖动）、`viewProjNoJitter`、`prevViewProjNoJitter`（motion vector 与 `staticVelocity` 对象所需）、`invViewProj`、`near`、`far`、`resolution` 与 `sunDir`——每个着色器都绑定同一份 uniform 块，CPU 从不为每个系统重新上传。velocity 用 UV 空间（y 向下、当前减历史），这是时序上采样器（`src/post/TemporalUpscale.js`）能与 SMAA-on-jittered-frames（`src/post/AntiAlias.js`，UI 中可配置 Off / 2x / 4x / 8x / 16x）配合工作的原因。

**浅水模拟自成一条管线，并非 FFT 的一部分。** "swash 在沙滩上跑上跑下"由 `src/ocean/ShoreSim.js` + `ShoreWaves.js` + `Breakers.js` 实现——一个独立模拟，读取 FFT 位移并叠加深度感知的破碎波场，配以剥离肩、白浪、喷雾、泡沫蕾边。浅水下的湿沙线由专门的不透明 pass 渲染（见提交 `35d9e1e "Swash film: show the opaque pass's wet sand under thin water"`）。`?noSim` URL 旋钮让观看者无需碰 FFT 即可关闭 swash 模拟。

**资产管线离线且可复现。** `tools/characters/`、`tools/props/`、`tools/audio/` 中的脚本负责从上游源（Microsoft Rocketbox avatars、Poly Haven 扫描、Freesound 录音）拉取、缩放、重定向、烘焙、减面，到引擎所需的 `public/models/` 与 `public/audio/` 形式。每个资产目录都自带 `CREDITS.md`（Rocketbox 为 MIT，Poly Haven 与 Freesound 为 CC0），根 `CREDITS.md` 把它们与 MIT 代码许可汇总在一起。鲸鱼模型是唯一的程序化资产（其侧面轮廓来自 NOAA Fisheries 公共领域插图）。这是 Axi 在任何 3D 内容参考上应当复刻的工作流。

**组合根是一个 745 行的 `App.js`。** `src/App.js` 实例化每个子系统（engine、scene renderer、GPU buffers、sky、world、ocean、materials、lighting、post、player、game、audio），并把它们接入帧循环。没有 DI 容器，也没有模块级单例；App 构造函数把 URL 查询串 flag 读进 `this.qs` 并暴露为 `app.qs.has('noAudio')` 等，与 `?bench&auto=…&shots=…` 共用同一份旋钮面。

**基准测试与参考帧是一等公民。** `src/core/Bench.js` + `BenchSeed.js` 在 `?bench` 设置时自行驱动帧循环并产出 JSON 帧时间报告；`DebugViews.js` 为 `?shots=view1,view2` 暴露具名相机视图。`main.js` 引导代码在隐藏标签页中 polyfill `requestAnimationFrame`，让基准测试在自动化下也能跑。这是 Axi 在任何"确定性状态参考帧"工作流中应当借鉴的模式。

## 说明

- 引擎导出（`src/engine/webgpu.js`）：`GPU`、`Material`、`ComputeKernel`、`ShaderModule`、`RenderTarget`、`FullscreenPass`、`SkinnedModel`、`loadGLB`、`commonModule`、`SceneLighting`、`FrameUniforms`、`Texture`、`UniformBlock`、`StorageBuffer`、`Readback`、`Mipmaps`、`MeshRenderer`、`SunShadows`。
- `GPU.js`（252 LOC）持有 `device`、`queue`、`context`、`format`、`features`、`limits`、预创建采样器（`linearRepeat`、`linearClamp`、`linearMirror`、`anisoRepeat`、`aniso4Repeat`、`anisoClamp`、`nearestClamp`、`nearestRepeat`、`shadow`）、每帧 `encoder`，以及 `GPU.onSubmit(before, after)` 钩子。
- `ShaderModule` 暴露带 `<prefix><Method>` 命名的 WGSL 函数（`shoreEvaluate`、`terrainSample`、`cloudShadow`）；bind group 分层为组 0 = `frame` uniforms + shared samplers，组 1 = module + material resources，组 2 = per-draw。
- `OceanFFT.js`（656 LOC）每帧跑两次 compute dispatch：行 pass（时间演化 `h0 → h(k,t)`、构建四个打包复杂字段、在 workgroup memory 中每行 256 点基-2 IFFT）+ 列 pass（列 IFFT、符号纠正、基于 Jacobian 的泡沫、位移 / 导数数组纹理）。
- 打包复杂字段：`c0 = Dx + i Dz`、`c1 = Dy + i dDx/dz`、`c2 = dDy/dx + i dDy/dz`、`c3 = dDx/dx + i dDz/dz`——每个复数 IFFT 对应四个实数字段，让水体着色器在单次 `textureSampleLevel` 调用中即可采样位移、导数与泡沫 Jacobian。
- 级联 tile 大小为 `[733, 157, 33.3, 7.1]`（非整数比以避免重复）；频谱为 Horvath/JONSWAP，配风速、fetch、涌浪、峰放大、短波淡出旋钮。
- `FrameUniforms`（即 `G` 全局）携带 `cameraPos`、`view`、`proj`、`viewProj`（抖动）、`viewProjNoJitter`、`prevViewProjNoJitter`、`invViewProj`、`near`、`far`、`resolution`、`sunDir`。
- Reversed-Z：`DEPTH_FORMAT = depth32float` 清零；天空像素深度为 0；`SCENE_FORMATS` 导出 color + velocity + mask。
- TAA + SMAA：`src/post/TemporalUpscale.js`（抖动历史 + 静止像素历史保留）+ `src/post/AntiAlias.js`（UI 中可配置 Off / 2x / 4x / 8x / 16x）。
- 后期链：`src/post/PostFX.js`（722 LOC）编排 `Underwater.js`、`AirHaze.js`、`GTAO.js`、`MotionBlur.js`、`LensFlare.js`、`LensDroplets.js`、`TemporalUpscale.js`、`AntiAlias.js`。
- 天空：`src/sky/Atmosphere.js`（Hillaire 2020 PBR）+ `Sky.js` + `Clouds.js` + `SkyProClouds.js`（体云 cumulus + cirrus，并对陆地投下云阴影）。
- 阴影：`src/engine/render/Shadows.js`（`SunShadows` 级联阴影贴图 + `sunShadow(P, N, pixel)` WGSL 帮助函数）；`src/materials/GroundBounce.js`（地面反弹光 + 接触阴影 + local lights）。
- 兼容 three.js 的重导出：`src/engine/index.js`（9 LOC）重导出 math + scene + geometry；基本几何体 `Box/Sphere/Cylinder/Cone/Plane/Circle/Torus/Lathe/Icosahedron/Tube/RoundedBox`。
- GLTF/GLB 加载器：`src/engine/loaders/GLTF.js`（`loadGLB`、`parseGLB`、`decodeImage`）；GPU 蒙皮通过 `src/engine/render/Skinning.js` 的存储缓冲骨骼实现（`SkinnedModel.create(gltf)`）。
- 组合根是 `src/App.js`（745 LOC）；URL 查询串 flag 加载到 `this.qs`，暴露为 `app.qs.has('noAudio')` 等。
- URL 旋钮：`?fly`、`?noAudio`、`?noClouds`、`?noHaze`、`?noCaustics`、`?noVeg`、`?noSim`、`?bench`、`?auto=<job>`、`?shots=view1,view2[&tag=…][&dt=…]`、`?wdbg=N`。
- 基准测试 + 参考帧：`src/core/Bench.js` + `BenchSeed.js` + `DebugViews.js`；`main.js` 在隐藏标签页中 polyfill `requestAnimationFrame`，让基准测试在自动化下也能跑。
- 资产：Microsoft Rocketbox avatars（MIT）、Poly Haven 扫描（CC0）、Freesound 录音（CC0，`public/audio/` 下 42 段 CC0 现场录音）；鲸鱼模型为程序化（NOAA Fisheries 公共领域插图）；每个资产目录都自带 `CREDITS.md`；根 `CREDITS.md` 汇总。
- 移植指南：`docs/PORTING.md`（~150 LOC）涵盖 three.js/TSL → WebGPU/WGSL 移植（bind group、velocity 约定、reversed-Z）。
- CI/CD：`.github/workflows/deploy.yml`（~50 LOC）—— build → upload artifact → push 到 `main` 后部署到 GitHub Pages。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Tidewater Reference"。
- 项目根目录：`/Volumes/code/workspace/references/short-term/tidewater-reference`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/short-term/tidewater-reference/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/references/short-term/tidewater-reference/README.md`
- 上游仓库：`https://github.com/dgreenheck/tidewater`
- 上游可玩构建：`https://dgreenheck.github.io/tidewater/`
- 工作区注册项：`/Volumes/code/workspace/foundation/workspace-governance/workspace.json` 中 `references.tidewater-reference`；图节点 `/Volumes/code/workspace/workspace.graph.json` → `.projects.tidewater-reference`。
- `references/short-term/` 中的姐妹参考镜像：`comfyui`（图像生成引擎参考，Python）、`blinko`（TypeScript inbox）、`opencodex`（Node + Swift codex gateway）。
- 采用可比 FFT/LOD 思路的 Mac 视频路径：`/Users/mose/Documents/Codex/2026-05-18/ltx-video-13b-0-9-8`。