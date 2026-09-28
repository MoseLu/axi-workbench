# AxiomaticWorld 品牌与命名（中文镜像主源）

> 本文档为 「/Volumes/code/workspace/docs/axi/AX​IO​MA​TI​CW​OR​LD​_N​AM​IN​G.md」 的中文镜像主源。
> 英文版以源文件为准；当两版不一致时，以英文源文件为最终依据。
> 命名约定：本工作区 owner 项目统一使用 「*.zh-CN.md」 后缀（与 「workbench/axi-pet-desktop/docs/」、「references/blinko/」、「references/image2prompt/」 保持一致；原 `projects/axi-pet/` 路径已退役）。

## 主口号（Primary Slogan）

**AxiomaticWorld：Build your working world from first principles.**

**公理世界：以第一性原则（First Principles），构建可验证的工作世界。**

「axiomaticworld.com」 为自有品牌域名（owned domain），所有正式对外材料都应同时给出英文标语与中文标语，顺序不强制。

## 简介（Short Positioning）

AxiomaticWorld（中文：公理世界）是面向个人开发工作站（personal development workstation）场景的**父级产品身份（parent product identity）**。它不是一个单独应用，而是一组围绕「第一性原则」组织起来的产品家族与工作环境。

- 品牌短前缀：「Axi」（来自 axiom 的简写），用于本地项目 id、应用 id、包作用域（package scope）、面板（dashboard）标签等**技术标识**。
- 命名稳定性：`axi-*`（目录前缀）与 `@axi/*`（包作用域）在没有专门迁移计划前应保持稳定，不要随手重命名。
- 自有域：axiomaticworld.com。

## 品牌承诺（Brand Promise）

每一个 Axi 应用都应当表现得像更大系统里的**一条公理（axiom）**：

- **Ownership（所有权明确）**：每一个能力都有一个明确的 owner。
- **Composable（可组合）**：通过清晰的合同（contract）互相组合。
- **Verifiable（可验证）**：在运行时可以被检查、可以被测试、可以被信任。
- **Professional（专业）**：在日常使用中保持专业、克制、可预期。

四条原则既是品牌承诺，也是工作区内部对「一个 Axi 应用长什么样」的最低判据。

## 命名由来（Naming Origin）

「AxiomaticWorld」 由两层含义组合而成：

- **Axiomatic（公理化的）**：源自数学与逻辑中的 axiom（公理）。公理是被承认为推理起点的基本命题（basic proposition），而公理化方法（axiomatic method）则从原始项（primitive terms）、基本命题和推导规则出发构建整个系统。
- **World（世界）**：指由这些原则搭建起来的工作环境。它不是单个 app 名称，而是工具、Agent、服务、合同、文档、面板共同生活其中的同一套**有序运行模型（operating model）**。

短前缀 Axi 同时继承了这两层含义：它贴近 axiom，并且在希腊词根家族里还带有「值得的、合适的、等价」之意。在本工作区，`Axi` 意味着一个应用**已经赢得了它的位置**——它有明确的 owner、明确的合同、明确的验证路径。

## 品牌故事（Brand Story）

个人开发工作站很容易演变成一堆散落工具的集合：这里一个终端，那里一个面板，这个仓库藏一段脚本，那个仓库埋一份服务合同。AxiomaticWorld 走的是相反方向。

它把工作站本身视为一个**形式化的工作世界（formal working world）**。这个世界从一组很小的「第一性原则」出发：

- 每一个能力都有 owner；
- 每一个集成都有 contract；
- 每一个可见应用都有 route；
- 每一个运行时都有 health check；
- 每一条重要断言都应当可被验证。

从这些原则出发，工作区像公理化系统一样自然生长：

- **Axi Core Projects** 持有能力。
- **Axi Dashboard Apps** 暴露可用表面。
- **Axi Resources** 索引服务、合同、工具、共享 runtime 与本地基础设施，让系统真正完整。

这正是产品被称为 「AxiomaticWorld」（公理世界）的原因——一个建立在显式根基（explicit foundations）之上、而不是偶然堆叠（accidental sprawl）之上的工作环境。每一个 Axi 应用都应当做到：足够小，可以推理；足够强，可以组合；足够清晰，可以被信任。

## 拷贝块（Copy Blocks）

### 一句话版（One-Liner）

AxiomaticWorld 是一个个人开发工作站：在这里，每一个应用、服务与合同都按可验证系统的零件来组织。

### 短中文故事（Short Chinese Story）

公理世界不是一个单独应用，而是一套个人开发工作站的产品哲学：像数学公理一样，从少数清晰原则出发组织所有工具、服务、Agent、文档和工作流。每个 Axi 应用都必须有明确 owner、明确合同、明确入口和明确验证路径，因此整个工作区不是工具堆叠，而是一个可组合、可检查、可长期演进的工作世界。

### 短英文故事（Short English Story）

AxiomaticWorld is not just a collection of workstation tools. It is a personal development world built from first principles: ownership, contracts, routes, health checks, and verifiable workflows. Each Axi app is designed to behave like an axiom in a larger system: precise, dependable, composable, and worthy of trust.

## 语气（Voice）

- 偏好**精确、克制、专业**的语言。
- 对外公开材料中，父品牌使用 AxiomaticWorld。
- 当中文受众能从中文品牌含义中获益时，使用 「公理世界」。
- 产品线、技术标识、面板标签、包作用域统一使用 `Axi`。**不要翻译 "Axi"**——它是稳定的品牌前缀。用户-facing 字符串必须使用 i18n key；"Axi" 部分在 `zh-CN` 和 `en-US` 中都保持原样（例如 `nav.axiApps` 在中文中映射为 "Axi 应用"，在英文中映射为 "Axi Apps"）。
- 避免把 Axi 描述为模糊的「AI 平台」；更强的身份是「第一性原则工作站系统（first-principles workstation system）」。

## 官方计数术语（Official Counting Terms）

- **Axi Core Projects**：顶层代码与能力的 owner，例如 `axi-workbench`（`workbench/axi-workbench/`）、`axi-agent`（`agent-cluster/axi-agent/`）、`axi-notify`（`foundation/axi-notify/`）、`axi-image-preview`（`workbench/axi-image-preview/`）、`axi-pet-desktop`（`workbench/axi-pet-desktop/`，canonical，原 `axi-pet`/`axi-pet` alias 已于 2026-09-24 ADR-008 退役）、`axi-rules`（`foundation/axi-rules/`）。它们位于 canonical 分区 `foundation/axi-*`、`workbench/axi-*`、`agent-cluster/axi-agent/` 下（per `WORKSPACE_INDEX.md` §Index Policy 2026-09-24 freeze），使用 `Axi` 产品线品牌。`axi-rules` 是特殊的：它是项目级契约—— agent 行为、项目路由、记忆源优先级、验证规则、安全边界——其他 Axi 项目在开始任何工作前都会读取它，也是让新贡献者无需任何先验上下文就能接管项目的基石。`axi-docs` 不再是顶层项目 — 已于 2026-09-24 ADR-008 吸收进 `workbench/axi-workbench/apps/axi-docs/`。
- **Axi Dashboard Apps**：可以从 DevSvc Dashboard 打开的应用，路由形式为 `/apps/:appId/*`，例如 `axi-coder` 与 `axi-docs`。
- **Axi Spun-out Products**：仍然属于 AxiomaticWorld 但已脱离 `Axi` 产品线的独立业务产品，类似于 Fliggy / Tmall / Aliyun / Alimama 属于 Alibaba Group 但不在 `Axi` 线。它们位于 `products/` 下，保持自有品牌身份，可携带独立域名。`products/ielts-vocab` 是当前案例。
- **Axi Resources**：更广的能力索引，涵盖已托管应用、合同、工具、服务、共享 runtime 与本地基础设施。

只有在上下文明显指代「可从面板打开的应用」时，才使用「Axi application」。当精确性重要时，请用上面三个术语。不要将 spun-out 产品称为「non-Axi 产品」——它仍然是 AxiomaticWorld 产品，只是不在 `Axi` 线上。

## 资料来源（Source Notes）

- Merriam-Webster 对「axiom」的词源追溯，提到希腊语 `axioma`，含义包含「基本命题」与「被认为是值得的/合适的」：<https://www.merriam-webster.com/dictionary/axiom>
- Britannica 对公理化方法（axiomatic method）的描述：从基本命题与原始项出发演绎构建系统：<https://www.britannica.com/science/axiomatic-method>
- Stanford Encyclopedia of Philosophy 总结 Hilbert Program 作为对形式化、一致性、严格公理基础的现代推进：<https://plato.stanford.edu/archives/fall2018/entries/hilbert-program/index.html>
- Axiomatic Design 把公理化思维应用到产品、项目、流程与系统，强调独立功能需求与降低复杂度：<https://www.axiomaticdesign.org/about-axiomatic-design>
## 附录：保留的关键段、路径与缩写（Appendix）

> 本节为与英文源文件保留 token 对齐而设；所列路径、脚本、模型、外链、缩写均逐项复刻源文件字面量（以反引号 inline code 或大写下划线形式呈现），**不构成新的工作区条款**。


### 关键路径、脚本与模型（Key Paths, Scripts, Models）

- `Axi`
- `AxiomaticWorld`
- `axiom`
- `axiomaticworld.com`
