---
id: axi-docs-zh-projects-image2prompt
title: Image2Prompt 参考
type: project
status: published
tags: [Axi Docs, 项目, references, reference, browser-extension, vision-llm]
created: 2026-10-07
modified: 2026-10-07
graph-title: Image2Prompt 参考
graph-tags: [Projects, references, browser-extension]
description: Manifest V3 Chrome/Edge 参考扩展，单击即可将网页上的任意图片转成 AI 可用的文本 prompt。`image2prompt` 是浏览器扩展在 AI-first 产品形态下的模式参考，核心契约由 `manifest.json` + `background.js` + `content.js` + `chrome.storage` 构成，后端模型为 `Gemini 2.5 Flash` 和 `Zhipu GLM-4V`。
project:
  id: image2prompt
  partition: references
  path: /Volumes/code/workspace/references/short-term/image2prompt
  source-section: reference
---

# Image2Prompt 参考

> 工作区项目档案。权威入口：`/Volumes/code/workspace/references/short-term/image2prompt`。
> 章节：reference / 分区：`references/`。

## 概要

`image2prompt` 是一个自包含、零运行时依赖的 **Manifest V3 Chrome/Edge 扩展**，能将网页上的图片单击后一键生成 AI 可用的文本 prompt。当用户把鼠标悬停在 `<img>` 元素上时，右下角会浮现一个小的"编辑"角标；点击后会调用配置好的视觉大模型（Gemini 2.5 Flash 或 Zhipu GLM-4V），把模型的回复解析为文生图 prompt，自动复制到剪贴板，并可选择跳转到用户偏好的图像生成站点（OpenAI / Gemini ImageFX / Midjourney / 即梦 / 可灵 / Doubao / 海螺AI / Stable Diffusion Web / 自定义平台），prompt 预填在新标签页里。该扩展开源、免费、无构建步骤，仅使用浏览器原生接口（`chrome.storage`、`chrome.runtime`、`chrome.tabs`）加上两个知名的 HTTPS 接口。

对 Axi 来说，该项目是 **AI-first 产品形态下浏览器扩展 UX 的模式参考**。它示范了 Axi 浏览器扩展所需的完整可工作链路——content script 拦截图片、常驻的 prompt 生成 service worker、提供 API key + 模型 + UX 配置的 options 页、多语言 prompt 模板、剪贴板与跳转。整套设计把面向第三方用户的产品保持完全自包含（无打包器、无 npm 运行时依赖），可以以"未打包"方式加载，也可以无需 CI 构建产物直接发布到 Chrome Web Store。Axi 任何"右键图片 / 在页面上做某个 AI 行为"的产品形态都可以直接复用存储结构、content-script 守护模式和平台 URL 模板，而无需重复发明。

第二个价值是 **manifest 驱动的权限模型** 和 `host_permissions` 白名单（`<all_urls>` 加上 `generativelanguage.googleapis.com` 和 `open.bigmodel.cn`）。它干净地示范了如何给视觉模型扩展收敛权限边界：content script 跑在每个页面，但只对两个 API host 发请求。Axi 的 `axi-capability-routing` 网关在新增 provider 集成时可以吸收相同的 host 分配模式，避免再次广播通配 host 权限。

## Stack

`MV3`, `Chrome / Edge`, `Gemini 2.5 Flash`, `Zhipu GLM-4V`, `ES modules`, `Jest 29`, `<all_urls>`, `chrome.storage`, `chrome.runtime`, `chrome.tabs`

## Milestone Status

| 里程碑 | 状态 | 证据 |
| --- | --- | --- |
| M1 — Manifest V3 + content/background 拆分 | 已交付 | `manifest.json` 配置 `manifest_version: 3` 与 `background.type: "module"`，`content_scripts` 设置 `run_at: document_idle` |
| M2 — 多 provider 的 prompt 模板化 | 已交付 | `PROMPT_LANGUAGE_RULES`（20 种语言）+ `PROVIDER_DEFAULTS` + `BUILTIN_PLATFORMS`（8 个平台 + customPlatforms） |
| M3 — Options 页 UX（API key、模型、历史记录） | 已交付 | `options.html`（300 LOC）+ `options.js`（2567 LOC）+ `options.css`（1496 LOC），采用 shadcn 风格的视觉 |
| M4 — 纯函数单元测试覆盖 | 已交付 | `tests/background.test.js` + `tests/content.test.js`，由 `tests/package.json`（jest@^29.7.0）驱动 |
| M5 — Axi overlay 文档（AGENTS、INDEX、PRD、TDD、TODO、MILESTONE、CHANGELOG） | 已交付 | 在 reference repo 根目录完整的 `image2prompt` overlay 套件 |

## Build & Install

由于扩展以原始文件形式分发，没有打包器，因此安装流程就是构建流程。

```bash
# 1. 克隆上游仓库
git clone https://github.com/pingan8787/image2prompt.git

# 2. 打开 Chrome / Edge 扩展页
#    chrome://extensions/  (右上角启用 Developer mode)
# 3. 点击 "Load unpacked" 并选择项目根目录。
#    也可以直接把整个文件夹拖到扩展页上。
```

可选——运行 Jest 单元测试，覆盖纯辅助函数：

```bash
cd /Volumes/code/workspace/references/short-term/image2prompt/tests
npm install        # 仅安装 jest
npm test           # 运行 background.test.js + content.test.js
```

没有 `tsc`，没有 `vite build`，没有 `pnpm build`。解压仓库看到的就是整个扩展。

## Architecture Highlights

**MV3 content script 是全站注入，但 host 暴露面很窄。** `manifest.json` 中 `content_scripts` 设置 `matches: ["<all_urls>"]` 和 `run_at: "document_idle"`，因此 content script 会在每个页面加载。`host_permissions` 列表很窄——`<all_urls>` 用于取图，再加上 `https://generativelanguage.googleapis.com/*` 和 `https://open.bigmodel.cn/*` 用于两个视觉后端——从而保持最小攻击面，并允许扩展无需代理就能调用 Gemini 和 Zhipu。这正是 Axi 在浏览器侧加入 AI 能力时想要的拆分：广注入以读取页面状态，但 `fetch` 只发往少量明确的白名单。

**Content script 处理一切 UI，service worker 处理一切网络与持久状态。** `content.js` 在 `mouseenter` 上为每张图片挂"编辑"按钮，在 `mouseleave` 上移除，并使用 `i2pTracked` 数据集 key（`const DATASET_KEY = "i2pTracked"`，第 44 行）避免对同一元素重复注册监听。点击按钮后通过 `collectImagePayload`（第 905-950 行）抓取图片（要么解码 `data:` URL，要么用 `credentials: "include"` 拉取原始 `img.currentSrc`），然后通过 `chrome.runtime.sendMessage` 把消息发给后台 worker。`background.js` 中的 service worker 组装 prompt（拼接系统指令、宽高比指令、语言指令以及可选的自定义用户指令），调用模型，清洗响应，再以 `appendGenerationHistory`（第 641 行）把一条历史写入 `chrome.storage.local` 中的 `HISTORY_STORAGE_KEY = "generationHistory"`，上限 `MAX_HISTORY_ENTRIES = 100`，最后回传。

**Prompt 生成模板化、多语言化，并非硬编码。** `background.js` 中的 `PROMPT_LANGUAGE_RULES`（第 43-180 行）定义了 20 种语言条目（`en-US`、`en-GB`、`zh-CN`、`ja-JP`、`ko-KR`、`fr-FR`、`de-DE`、`es-ES`、`es-MX`、`it-IT`、`pt-BR`、`ru-RU`、`hi-IN`、`ar-AE`、`nl-NL`、`tr-TR`、`th-TH`、`vi-VN`、`id-ID`、`pl-PL`），每条带一个 `directive`，拼入系统 prompt 以强制模型只用该语言回复。丰富度档位（`concise`、`standard`、`detailed`、`very-detailed`——`getRichnessInstruction` 第 844 行）和宽高比后处理（`appendAspectRatioToPrompt` 第 817 行）同样数据驱动，因此新增一种输出风格只需新增一条记录，不必改调用点。

**Provider / Platform 间接层让扩展真正多模型化。** `background.js` 的 `PROVIDER_DEFAULTS` 与 `options.js` 的 `LLM_PROVIDERS` 以声明式描述每个模型 provider；`options.js` 的 `BUILTIN_PLATFORMS`（第 382-423 行）以 `{ id, labels, url }` 描述每个下游图像生成器，其中 `{{prompt}}` 模板在跳转时被替换。用户可以通过 `customPlatforms` 注册额外平台。跳转本身实现在 `buildPlatformUrl`（content.js 第 890 行），根据 URL 形态对 prompt 编码，并替换 `{{prompt}}` 或追加 `?prompt=` / `&prompt=`。这是 Axi 任何"扩展 → AI → 跳转产品"形态可以借鉴的最干净的"扩展 → AI → 跳产品"模型。

**所有设置与历史都通过 `chrome.storage.local` 客户端存储，并在加载时与默认值合并。** `background.js` 与 `options.js` 都定义了相同的 `DEFAULT_CONFIG` 形状（每个文件顶部可见）。启动时调用 `chrome.storage.sync.get(...)`（options 页同时读 `chrome.storage.local`），把保存的值合并在默认值之上。这种"重复的默认值 + 加载时合并"的模式让扩展在 schema 演进中保持兼容：缺失的 key 静默回退到默认值，旧 key（`geminiApiKey`、`zhipuApiKey`、`model`、`zhipuModel`）由 `sanitizeProviderSettings`（background.js 第 949 行）迁移到新的 `providerSettings` 形态。

## 说明

- `manifest.json` 声明 `manifest_version: 3`，`background.type: "module"`；content script 与 service worker 配对（`background.js` 1021 LOC + `content.js` 1050 LOC）是规范的 MV3 / 扩展范例。
- host 暴露面刻意收窄——`<all_urls>` 用于取图，加上 `generativelanguage.googleapis.com` 和 `open.bigmodel.cn` 用于两个后端；任何 `axi-*-extension` 产品都可以照搬这套拆分。
- provider + platform 模板是数据，不是代码：`PROMPT_LANGUAGE_RULES`（20 种语言）、`PROVIDER_DEFAULTS`、`BUILTIN_PLATFORMS`（8 个平台）、`customPlatforms` 注册、`buildPlatformUrl` 中 `{{prompt}}` URL 重写。
- 设置 + 历史持久化走 `chrome.storage.local`（`HISTORY_STORAGE_KEY = "generationHistory"`，上限 `MAX_HISTORY_ENTRIES = 100`）；遗留 key `geminiApiKey` 与 `zhipuApiKey` 由 `sanitizeProviderSettings`（background.js 第 949 行）迁移。
- 纯辅助函数覆盖：`sanitizeDomain`、`normalizeHostname`、`isDomainBlocked`、`parseDataUrl`、`arrayBufferToBase64`、`sanitizeHistoryEntry`、`appendAspectRatioToPrompt`、`buildPlatformUrl`，由 `tests/background.test.js` + `tests/content.test.js` 在 `tests/package.json`（jest@^29.7.0）下驱动。
- 剪贴板回退链：`copyToClipboard`（content.js 第 865 行）——先尝试 `navigator.clipboard.writeText`，失败回退到隐藏 `<textarea>` + `document.execCommand("copy")`。可被任何 Axi 工具链跨 content / popup / background 上下文复用。
- `chrome.storage` 的 schema 迁移是任何 Axi 扩展在不破坏已安装用户前提下平滑演进存储形状的干净范例。

## Cross-References

- 工作区入口：[`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — 分区表行 "Image2Prompt Reference"。
- 项目根目录：`/Volumes/code/workspace/references/short-term/image2prompt`
- 项目 `AGENTS.md`：`/Volumes/code/workspace/references/short-term/image2prompt/AGENTS.md`
- 项目 `README.md`：`/Volumes/code/workspace/references/short-term/image2prompt/README.md`
- 上游仓库：`https://github.com/pingan8787/image2prompt`
- **Axi 浏览器扩展形态**（任何未来的 `axi-*-extension` 产品）：复用 `<all_urls>` content-script + 窄 `host_permissions` 拆分、`i2pTracked` 数据集去重模式、`applyButtonAppearance` CSS 变量样式绑定、`buildPlatformUrl` 中 `{{prompt}}` 模板替换。
- **AI 能力路由（`/Users/mose/.cc-connect/bin/ai-capability`）**：`LLM_PROVIDERS` 声明式表和 `sanitizeProviderSettings` 迁移与路由注册表是同一种形态；该扩展示范了如何通过编辑一条表项就增加一个新 provider，无需修改调用点。
- **视觉 prompt 生成能力**——任何想为文本在"描述这张图片"按钮上的 Axi 产品：`collectImagePayload` 流程（`data:` URL vs `fetch` 配合 `credentials: "include"`，由 `arrayBufferToBase64` 做 base64 编码，从 `blob.type` 推断 mime）就是规范实现。
- **i18n**：`UI_STRINGS` 与 `TEXT_CONTENT` 模式（单个 `language` 字段、两张扁平字符串表、`getUiString(key)` 查询 + 英文回退）是一种低依赖、以交付原生双语 UI 的方式，无需引入 `react-i18next` 或 `i18next`。
- **剪贴板回退链**：`copyToClipboard`（content.js 第 865 行）——在 document 有焦点时尝试 `navigator.clipboard.writeText`，否则回退到隐藏 `<textarea>` + `document.execCommand("copy")`。值得在 Axi 跨 content / popup / background 上下文的工具中复用。
- **`chrome.storage` 中的 schema 迁移**：`sanitizeProviderSettings`（background.js 第 949 行）是把旧扁平 key（`geminiApiKey`、`zhipuApiKey`）平滑过渡到新的嵌套 `providerSettings` 形态而不破坏现有用户的干净范例。