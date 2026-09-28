# AxiomaticWorld Brand And Naming

## Primary Slogan

**AxiomaticWorld: Build your working world from first principles.**

**公理世界：以第一性原则，构建可验证的工作世界。**

## Short Positioning

AxiomaticWorld, also written as 公理世界, is the parent product identity for the
personal development workstation. The owned domain is `axiomaticworld.com`.

`Axi` is the short product prefix used for local project ids, app ids, package
scopes, and dashboard labels. Keep technical identifiers such as `axi-*` and
`@axi/*` stable unless a dedicated migration is planned.

## Brand Promise

Every Axi application should behave like an axiom in a larger system:
explicit in ownership, composable through contracts, verifiable in operation,
and professional in daily use.

## Naming Origin

`AxiomaticWorld` combines two ideas:

- **Axiomatic** comes from the language of axioms. In mathematics and logic, an
  axiom is a foundational principle accepted as a starting point for reasoning,
  and the axiomatic method builds systems from primitive terms, basic
  propositions, and rules of deduction.
- **World** means the working environment created by those principles. It is not
  a single app name. It is the world where tools, agents, services, contracts,
  documents, and dashboards live under one coherent operating model.

The shorter prefix `Axi` inherits both meanings. It is close to `axiom`, and its
Greek root family also carries the sense of something worthy, fitting, or of
equal value. For this workspace, `Axi` means that an app has earned its place by
having a clear owner, a clear contract, and a clear verification path.

## Brand Story

A personal development workstation can easily become a pile of tools: a terminal
here, a dashboard there, a script hidden in one repo, a service contract buried
in another. AxiomaticWorld is the opposite direction.

It treats the workstation as a formal working world. The world begins with a
small set of first principles: every capability has an owner, every integration
has a contract, every visible app has a route, every runtime has a health check,
and every important claim should be verifiable.

From those principles, the workspace grows like an axiomatic system. Axi Core
Projects own the capabilities. Axi Dashboard Apps expose the usable surfaces.
Axi Resources index the services, contracts, tools, shared runtimes, and local
infrastructure that make the system complete.

That is why the product is called AxiomaticWorld, or 公理世界. It is a working
environment built from explicit foundations instead of accidental sprawl. Each
Axi application should feel precise, dependable, and professionally bounded:
small enough to reason about, strong enough to compose, and clear enough to
trust.

## Copy Blocks

### One-Liner

AxiomaticWorld is a personal development workstation where every app, service,
and contract is organized like part of a verifiable system.

### Short Chinese Story

公理世界不是一个单独应用，而是一套个人开发工作站的产品哲学：像数学公理一样，从少数清晰原则出发组织所有工具、服务、Agent、文档和工作流。每个 Axi 应用都必须有明确 owner、明确合同、明确入口和明确验证路径，因此整个工作区不是工具堆叠，而是一个可组合、可检查、可长期演进的工作世界。

### Short English Story

AxiomaticWorld is not just a collection of workstation tools. It is a personal
development world built from first principles: ownership, contracts, routes,
health checks, and verifiable workflows. Each Axi app is designed to behave like
an axiom in a larger system: precise, dependable, composable, and worthy of
trust.

## Voice

- Prefer precise, calm, professional language.
- Use "AxiomaticWorld" for the parent brand and public-facing story.
- Use "公理世界" when the audience benefits from the Chinese brand meaning.
- Use "Axi" for product lines, technical identifiers, dashboard labels, and
  package scopes. **Do not translate "Axi"** in any locale — it is a stable
  brand prefix. User-facing strings must use i18n keys; the "Axi" portion
  stays as-is in both `zh-CN` and `en-US` locales (e.g., `nav.axiApps` maps
  to "Axi 应用" in Chinese and "Axi Apps" in English).
- Avoid describing Axi as a vague "AI platform"; the stronger identity is a
  first-principles workstation system.

## Official Counting Terms

- **Axi Core Projects**: top-level code and capability owners, such as
  `axi-workbench` (`workbench/axi-workbench/`), `axi-agent` (`agent-cluster/axi-agent/`),
  `axi-notify` (`foundation/axi-notify/`), `axi-image-preview` (`workbench/axi-image-preview/`),
  `axi-pet-desktop` (`workbench/axi-pet-desktop/`; canonical, the historical `axi-pet` and
  `axi-pet` aliases are retired per ADR-008), and `axi-rules` (`foundation/axi-rules/`).
  They live under the canonical partitions `foundation/axi-*`, `workbench/axi-*`, and
  `agent-cluster/axi-agent/` (per `WORKSPACE_INDEX.md` §Index Policy 2026-09-24 freeze),
  using the `Axi` product line branding. `axi-rules` is special: it is the project-level
  contract — agent behavior, project routing, memory source precedence, verification rules,
  safety boundaries — that every other Axi project reads before any work begins, and the
  foundation that lets a new contributor onboard a project with no prior context.
  `axi-docs` is no longer a top-level project — it was absorbed into
  `workbench/axi-workbench/apps/axi-docs/` per ADR-008.
- **Axi Dashboard Apps**: applications that can be opened from the DevSvc
  Dashboard under `/apps/:appId/*`, such as `axi-coder` and `axi-docs`.
- **Axi Spun-out Products**: standalone business products that still belong to
  AxiomaticWorld but no longer sit under the `Axi` product line, the way Fliggy
  / Tmall / Aliyun / Alimama sit under Alibaba Group but not under the `Axi`
  line. They live under `products/`, keep their own brand identity, and may
  carry their own domain. `products/ielts-vocab` is the current example.
- **Axi Resources**: the broader capability index, including hosted apps,
  contracts, tools, services, shared runtimes, and local infrastructure.

Use "Axi application" only when the context clearly means a dashboard-openable
app. Use the four terms above when precision matters: do not call a
spun-out product a "non-Axi product" — it is still an AxiomaticWorld product,
just not on the `Axi` line.

## Source Notes

- Merriam-Webster traces "axiom" through Greek `axioma`, with meanings around a
  fundamental proposition and what is considered worthy or suitable:
  <https://www.merriam-webster.com/dictionary/axiom>
- Britannica describes the axiomatic method as building a system by deduction
  from basic propositions and primitive terms:
  <https://www.britannica.com/science/axiomatic-method>
- Stanford Encyclopedia of Philosophy summarizes Hilbert's program as a modern
  push toward formalization, consistency, and rigorous axiomatic foundations:
  <https://plato.stanford.edu/archives/fall2018/entries/hilbert-program/index.html>
- Axiomatic Design applies axiomatic thinking to products, projects, processes,
  and systems, emphasizing independent functional requirements and reduced
  complexity:
  <https://www.axiomaticdesign.org/about-axiomatic-design>
