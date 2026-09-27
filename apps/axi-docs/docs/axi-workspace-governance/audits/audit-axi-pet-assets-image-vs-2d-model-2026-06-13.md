---
title: axi-pet 资产"图卡 vs 2D/3D 模型"静态审计
date: 2026-06-13
type: audit
status: complete
module: axi-pet
tags: [assets, character, live2d, vrm, spine, pmx, display-models, stage]
problem_type: inventory-gap
source:
  - /Volumes/code/workspace/infra/axi-workspace-governance/docs/audits/audit-axi-pet-assets-image-vs-2d-model-2026-06-13.md
mirror:
  - /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/audits/audit-axi-pet-assets-image-vs-2d-model-2026-06-13.md
related:
  - /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/audits/axi-docs-coverage-2026-06-10.md
  - /Volumes/code/workspace/projects/axi-workbench/apps/axi-docs/docs/axi-workspace-governance/audits/proposal-dispose-codex-plus-app-2026-06-10.md
---

# axi-pet 资产"图卡 vs 2D/3D 模型"静态审计

> 审计日期：2026-06-13
> 来源：用户反馈"桌面只能看到图片而非 2D/3D 模型"
> 范围：`/Volumes/code/workspace/projects/axi-pet`
> 方法：仓库静态扫描 + CodeGraph 索引定位；不读取用户机器 IndexedDB / localforage 实际内容。

## 1. 结论摘要

当前仓库把"角色图卡"和"Stage 可渲染模型"拆成两条独立链路：

- **图卡链路**：`coverUrl` / `avatarUrl` / `characterAvatarUrl` / `coverBackgroundUrl` 属于 character schema 和角色卡页面，用于列表、封面、头像展示。
- **模型链路**：`DisplayModelFormat` + `displayModelsPresets` + `settings-stage-model` 决定 Stage 渲染器，只内置 2 个 Live2D ZIP 和 2 个 VRM 模型。
- **Stage 渲染链路**：`Stage.vue` 只按 `stageModelRenderer` 渲染 Live2D / VRM / Spine / Godot，不消费 character 图卡字段；`disabled` 时没有图卡兜底。

所以，用户在模型选择页看到的"图片"通常是 `previewImage` 缩略图，不等于 Live2D/VRM/Spine 运行时模型。用户在主 Stage 看不到模型时，主要静态风险不是"图卡替代模型"，而是模型选择/导入/渲染器映射进入 `disabled` 或未加载状态后缺少清晰 UI 反馈。

## 2. 资产盘点

### 2.1 可渲染模型预设

证据：`packages/stage-ui/src/stores/display-models.ts:22-55`

| id | format | name | 模型资源 | 缩略图 |
|---|---|---|---|---|
| `preset-live2d-1` | `live2d-zip` | `Hiyori (Pro)` | `packages/stage-ui/src/assets/live2d/models/hiyori_pro_zh.zip` | `packages/stage-ui/src/assets/live2d/models/hiyori/preview.png` |
| `preset-live2d-2` | `live2d-zip` | `Hiyori (Free)` | `packages/stage-ui/src/assets/live2d/models/hiyori_free_zh.zip` | `packages/stage-ui/src/assets/live2d/models/hiyori/preview.png` |
| `preset-vrm-1` | `vrm` | `AvatarSample_A` | `packages/stage-ui/src/assets/vrm/models/AvatarSample-A/AvatarSample_A.vrm` | `packages/stage-ui/src/assets/vrm/models/AvatarSample-A/preview.png` |
| `preset-vrm-2` | `vrm` | `AvatarSample_B` | `packages/stage-ui/src/assets/vrm/models/AvatarSample-B/AvatarSample_B.vrm` | `packages/stage-ui/src/assets/vrm/models/AvatarSample-B/preview.png` |

仓库中排除 `.cache`、`dist`、`node_modules` 后，模型类文件只命中上述 4 个内置模型文件。未发现内置 Spine ZIP、PMX、PMD 模型资源。

### 2.2 模型格式枚举

证据：`packages/stage-ui/src/stores/display-models.ts:8-16`

代码声明接受 7 类 display model 格式：

- `live2d-zip`
- `live2d-directory`
- `vrm`
- `spine-zip`
- `pmx-zip`
- `pmx-directory`
- `pmd`

但当前 UI 导入入口只开放 Live2D ZIP、VRM、Spine ZIP：`packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue:131-137`。

### 2.3 角色图卡字段

证据：

- `packages/stage-ui/src/types/character.ts:66-85`
- `apps/server/src/schemas/characters.ts:13-79`
- `apps/server/src/schemas/characters.ts:150-171`

图卡字段和模型关系是后端/前端 schema 层面的独立关系：

- `character.coverUrl` 是必填图卡字段。
- `character.avatarUrl` 是可选头像字段。
- `characterCovers.foregroundUrl` / `backgroundUrl` 是额外封面资源。
- `avatarModel` 表通过 `characterId` 关联角色，保存 `type` 和 `config`，不是 `coverUrl` 的派生字段。

也就是说，一个角色可以有图卡但没有任何 Stage display model；也可以有 avatar model 元数据但未被当前桌面 Stage 自动绑定为选中 display model。

## 3. 渲染链路事实

### 3.1 Stage renderer 映射

证据：`packages/stage-ui/src/stores/settings/stage-model.ts:45-60`

`resolveBuiltInStageModelRenderer()` 当前只把 3 类格式映射到可渲染器：

- `Live2dZip` -> `live2d`
- `VRM` -> `vrm`
- `SpineZip` -> `spine`
- 其他格式 -> `disabled`

因此 `Live2dDirectory`、`PMXZip`、`PMXDirectory`、`PMD` 即使出现在 store 里，也会被映射为 `disabled`。

### 3.2 Stage 组件条件渲染

证据：`packages/stage-ui/src/components/scenes/Stage.vue:941-1008`

`Stage.vue` 只在以下条件下渲染模型子树：

- `stageModelRenderer === 'live2d' && showStage`
- `stageModelRenderer === 'vrm' && showStage`
- `stageModelRenderer === 'spine' && showStage`
- `stageModelRenderer === 'godot'`

对 `Stage.vue` 和桌面 renderer 目录扫描 `coverUrl|avatarUrl|characterAvatarUrl|coverBackgroundUrl` 无命中；图卡字段只在 `packages/stage-pages/src/pages/v2/index.vue:41-61,78-106,140-153,240-253` 用作角色卡页面展示。

结论：主 Stage 没有 character 图卡兜底。`disabled` 状态下不是显示角色图卡，而是不渲染 Live2D/VRM/Spine 子树。

### 3.3 模型选择页缩略图

证据：

- `packages/stage-ui/src/stores/display-models.ts:112-127`
- `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue:273-295`

导入 Live2D/VRM/Spine 时会尝试生成 `previewImage`。模型选择页优先展示 `model.previewImage`，没有预览图时展示 "Preview unavailable" 占位。

这解释了"看到图片"的常见误解：模型列表卡片展示的是预览缩略图，不代表 Stage 正在渲染模型。

## 4. 缺口清单

| ID | 严重度 | 缺口 | 当前证据 | 用户影响 |
|---|---:|---|---|---|
| G1 | P0 | Stage `disabled` 无显式空态/错误态 | `Stage.vue:941-1008` 无 disabled 分支；图卡字段无命中 | 模型缺失、格式不支持或加载失败时，用户只能感知"没看到模型"，难以定位原因 |
| G2 | P0 | `Live2dDirectory` / PMX / PMD schema 与渲染支持不一致 | `DisplayModelFormat` 声明 7 类，renderer 只支持 3 类 | 未来一旦这些格式进入 store，会静默进入 `disabled` |
| G3 | P1 | 内置模型预设只有 Live2D + VRM，无 Spine/PMX/PMD 预设 | `displayModelsPresets` 只有 4 项；资产扫描无 Spine/PMX/PMD | 用户想验证 Spine 或 MMD 路线时没有开箱样例 |
| G4 | P1 | Character 图卡与 Stage 选中 display model 没有契约桥接 | `character` / `avatarModel` 有关系，Stage 只读 display model store | 从角色卡进入聊天/舞台时，图卡角色不保证能驱动模型 |
| G5 | P2 | 模型选择页只显示格式标签，不显示"可渲染/仅占位/缺预览"状态 | `model-selector.vue:319-322` 只显示 `mapFormatRenderer[model.format]` | 用户容易把预览图当成模型运行状态 |
| G6 | P2 | 治理镜像曾存在 `bucket/airi.json` 语义误导风险 | 当前 `AGENTS.md:37` 已修正为 scoop manifest；git diff 显示旧文案曾称 Live2D 资源清单 | 历史草稿或旧 agent 可能仍引用过期说法；当前仓库状态已修正 |

## 5. 非缺口澄清

- `bucket/airi.json` 当前不是角色资源清单，当前 `AGENTS.md:37` 已明确标注为 Windows scoop 安装包 manifest，不应纳入宠物/角色资产审计。
- `apps/stage-web/.cache/assets/js/CubismSdkForWeb-*` 里有 Live2D SDK sample 资源，但 `.cache` 是非入口，不应当作产品内置角色资源。
- `apps/stage-web/dist/assets/*` 里能看到构建后的 zip/vrm/hash 文件，但 `dist` 是构建产物，不是源资产入口。
- `docs/content/**/assets/*` 是文档和博客图片/视频，不是 Stage display model 预设。

## 6. 建议修复顺序

### P0：消除静默失败

1. 在 `Stage.vue` 增加 `stageModelRenderer === 'disabled'` 的明确空态，至少显示当前选中模型名、格式和不支持/未加载原因。
2. 在 `resolveBuiltInStageModelRenderer()` 对 `Live2dDirectory`、PMX、PMD 加显式注释或 typed guard，避免未来导入路径误以为这些格式已可渲染。
3. 在模型选择页给不可渲染格式显示状态标签；当前 UI 虽未暴露 PMX/PMD 导入入口，但 store/schema 已声明这些格式。

### P1：补足开箱验证资源

1. 增加 1 个许可证清晰的 Spine ZIP 预设，并把它加入 `displayModelsPresets`。
2. 若计划支持 MMD/PMX/PMD，先补 renderer 选型和失败提示，再开放导入入口；不要只扩展 enum。

### P1：建立角色卡到 Stage 的契约

1. 明确角色 `avatarModels` 是否应该映射为 `DisplayModel`。
2. 如果角色卡能进入 Stage，应定义"角色只有图卡无模型"时的 UI：图卡兜底、推荐导入模型、或禁止进入 Stage。

## 7. 验证记录

本次审计运行/读取的关键检查：

```bash
codegraph_status /Volumes/code/workspace/projects/axi-pet
rg -n "DisplayModelFormat|preset-live2d|preset-vrm|previewImage|resolveBuiltInStageModelRenderer|stageModelRenderer|coverUrl|avatarUrl|characterAvatarUrl|coverBackgroundUrl|PMX|PMD|Spine" packages apps plugins services
find /Volumes/code/workspace/projects/axi-pet \
  -path '*/node_modules' -prune -o \
  -path '*/.git' -prune -o \
  -path '*/.cache' -prune -o \
  -path '*/dist' -prune -o \
  -type f \( -iname '*.zip' -o -iname '*.vrm' -o -iname '*.model3.json' -o -iname '*.moc3' -o -iname '*.atlas' -o -iname '*.skel' -o -iname '*.pmx' -o -iname '*.pmd' \) -print
rg -n "coverUrl|avatarUrl|characterAvatarUrl|coverBackgroundUrl" packages/stage-ui/src/components/scenes/Stage.vue apps/stage-tamagotchi/src/renderer apps/stage-web/src/pages/index.vue apps/stage-pocket/src/pages/index.vue packages/stage-pages/src
```

静态验证结论：

- CodeGraph 索引可用：`Files indexed: 10159`，`Total nodes: 190281`。
- 源资产入口 `packages/stage-ui/src/assets` 中只有 Live2D ZIP、VRM 和对应 preview 图。
- 排除 `.cache`、`dist`、`node_modules` 后，仓库未发现内置 Spine/PMX/PMD 模型源文件。
- 主 Stage 与桌面 renderer 不消费 character 图卡字段；角色卡页面消费这些字段。

---

*本审计只覆盖仓库静态层；用户本机 IndexedDB / localforage 中的自定义 display model 需要另行授权导出后才能审计。*
