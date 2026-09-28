---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# Project Cross-Reference Index

> **NOTE (2026-09-25)**: 3 个 provider 已从 `workspace.graph.json` 删除（absorbed 2026-09-24 ADR-008）：`axiom-pet`、`axiom-artboard`、`axiom-proxy-companion`；`axiom-docs` + `ai-resource-orchestration` 已 absorb 进 `workbench/axi-workbench/apps/`，但作为 graph alias 保留（ADR-007 grandfathered）。`axi-model-gateway` 于 2026-09-25 标记 deprecated（图内保留）。`voice-assistant-on-device-speech-recognition` 于 2026-09-25 迁至 `candidates/` 并完成登记。本文不自动重新生成；下次 governance `workspace:registry:sync` 时刷新 `/.workspace/registry.json`。

## Provides -> Consumed By (declared in registry)

| Provider | Provides | Consumed By |
|----------|----------|-------------|
| codex-app-projects | project-discovery, cross-project-rules | axi-workbench, axi-pet-desktop, axi-rules, axi-feishu-codex-bridge (**note**: `axiom-pet` removed 2026-09-24) |
| axi-workbench | workstation-control-plane, axi-dashboard-host, project-development-workbench, ops-dashboard, docs-search-surface, verification-inbox, local-ai-menu-assistant, axi-app-scaffolder, workflow-agent-orchestration-v1 | axi-coder, cockpit-tools |
| axi-coder | project-development-workbench, mac-desktop-client, mobile-companion-client, cli-orchestration, agent-task-console, model-routing-adapter, terminal-sessions, artifact-review | (none in registry - consumers[] is empty) |
| axi-model-gateway (deprecated 2026-09-25) | provider-profile-contract, credential-ref-routing, cli-compatible-model-proxy | axi-coder |
| axi-agent | agent-runtime-owner, managed-agent-tasks, workstation-agent-task-api, mcp-quality-gate-runtime, agent-tool-runtime, terminal-agent-transport, remote-codex-session-bridge, local-task-ledger, bounded-agent-runtime-v1 | axi-workbench, axi-coder |
| axi-notify | relay-server, workflow-contracts, mobile-event-inbox, android-agent-notification-client, mobile-workbench, android-workspace-donor, workflow-agent-donor | axi-workbench, axi-coder |
| axi-image-preview | image-preview, wallpaper-gallery-preview, visual-reference-preview | (none in registry - `ai-resource-orchestration` removed) |
| axi-pet-desktop | desktop-tamagotchi-app, desktop-pet-macos-vrm, electron-bridge-packages, stage-core-self-contained, godot-desktop-integration | (none in registry) |
| axi-docs | docs-hub, knowledge-browser, docs-mcp, agent-safe-docs-context-v1 (alias-only; canonical implementation now in `workbench/axi-workbench/apps/axi-docs/`) | axi-workbench, axi-agent, axi-rules (**note**: `ai-resource-orchestration` removed) |
| axi-accounts | account-assets-contract, credential-ref-contract, provider-credential-ref-contract, verification-inbox-target | axi-workbench, axi-coder, axi-model-gateway |
| ai-capability | asr, image-recognition, ocr, document-extraction, llm, image-generation, audio-generation, video-generation, embedding, vector-memory-health | axi-workbench, axi-agent, axi-pet-desktop, ielts-vocab, axi-model-gateway (deprecated), voice-assistant (**note**: `axiom-pet` removed; `axi-model-gateway` retained but deprecated 2026-09-25) |
| ollama-local | local-llm, local-vlm, local-embedding | axi-workbench, axi-agent, ielts-vocab, axi-feishu-codex-bridge, axi-model-gateway (deprecated) (**note**: `axi-model-gateway` retained but deprecated 2026-09-25) |
| minimax-tokenplan | web-search, image-understanding-fallback, image-generation, speech-generation, music-generation, lyrics, music-cover | axi-workbench, axi-agent, axi-pet-desktop, ielts-vocab, axi-model-gateway (deprecated), voice-assistant (**note**: `axiom-pet` / `ai-resource-orchestration` removed; `axi-model-gateway` retained but deprecated 2026-09-25) |
| ielts-vocab | ielts-learning-app, upload-asr-api, realtime-asr-socket, tts-backend | (none in registry) |
| story-graph | story-graph-workbench, novel-relationship-graph, evidence-driven-story-analysis | (none in registry) |
| ai-resource-orchestration | resource-orchestration-workbench, bounded-resource-tool-selection, deterministic-resource-validation (alias-only; canonical implementation now in `workbench/axi-workbench/apps/resource-orchestration/` + `@axi/resource-*` + `services/resource-gateway/`) | axi-workbench, axi-agent, axi-soul-world (**note**: graph node is alias, retained per ADR-007) |
| axi-ui | axi-design-tokens, axi-preset-library, axi-core-primitives, axi-shell-admin-chrome, axi-settings-panel, axi-crud-runtime, axi-widgets, axi-addons | axi-workbench, axi-agent, axi-image-preview, story-graph, axi-workbench-web-dist, axi-workbench-mobile-dist, axi-workbench-desktop-dist |
| axi-registry | axi-private-package-registry | axi-workbench, axi-agent, axi-ui, story-graph, axi-workbench-web-dist, axi-workbench-mobile-dist, axi-workbench-desktop-dist |
| axi-rules | agent-routing-rules, workspace-rule-index, memory-source-precedence, task-routing-policy-v1 | axi-workbench, axi-agent, axi-feishu-codex-bridge |
| axi-feishu-codex-bridge | feishu-codex-bridge, feishu-codex-channel-adapter, feishu-bot-runtime | (none in registry) |
| axi-workspace-governance | workspace-registry, project-catalog, workspace-audit, task-execution-routing/v1 | axi-workbench, axi-agent, axi-rules (**note**: `axiom-docs` removed per ADR-008) |
| axi-tauri-starter | tauri-shell-template, tauri-cache-bootstrap | axi-workbench, cockpit-tools (**note**: physical project at `foundation/axi-ui` history; verify existence before use) |
| axi-skills | codex-skill-catalog, shared-agent-skill-source, apm-agent-context-package, skill-i18n-batch-contract, global-skill-root-cutover | (none in registry - `ai-resource-orchestration` removed) |
| axi-soul-world | axi-soul-world-product-contract, axi-soul-world-local-first-runtime-boundary, axi-mood-private-records | (none in registry) |
| axi-workbench-web-dist | axi-workbench-web-distribution, axi-workbench-web-standalone | (none in registry) |
| axi-workbench-mobile-dist | axi-workbench-mobile-distribution, axi-workbench-mobile-standalone | (none in registry) |
| axi-workbench-desktop-dist | axi-workbench-desktop-distribution, axi-workbench-desktop-standalone, tauri-desktop-app | (none in registry) |
| voice-assistant-on-device-speech-recognition (candidates/, 2026-09-25) | on-device-speech-recognition, voice-loop-prototype, android-voice-assistant | (none in registry) |
| sports-management | sports-management-web, sports-management-mobile, sports-management-backend | (none in registry) |
| sub2api | subscription-api-tooling | axi-workbench, axi-model-gateway, axi-agent |

---

## Actual Code Dependencies (found via grep)

### axi-workbench apps consuming @axi/* packages from foundation/axi-ui:

| Consumer | Imports | Provider |
|----------|---------|----------|
| axi-coder | @axi/core, @axi/shell, @axi/tokens | foundation/axi-ui |
| devsvc-dashboard | @axi/addons, @axi/core, @axi/crud, @axi/presets, @axi/settings, @axi/shell, @axi/tokens, @axi/widgets | foundation/axi-ui |
| workbench-mobile | @axi/core, @axi/tokens | foundation/axi-ui |
| workbench-desktop | @axi/workbench-desktop (app name) | foundation/axi-ui |
| workbench-shared | @axi/workstation-contracts, @axi/api-client | foundation/axi-ui |

### axi-workbench packages consuming @axi/* packages:

| Consumer | Imports | Provider |
|----------|---------|----------|
| api-client | @axi/workstation-contracts, @axi/types | foundation/axi-ui |
| workbench-foundation | @axi/core, @axi/workstation-contracts | foundation/axi-ui |
| schemas | @axi/workstation-contracts | foundation/axi-ui |

### axiom-pet apps consuming @proj-airi/* packages (upstream namespace - intentional):

| Consumer | Imports | Provider |
|----------|---------|----------|
| component-calling | @proj-airi/ui | axiom-pet/packages |
| server | @proj-airi/drizzle-orm-browser-migrator, @proj-airi/server-schema, @proj-airi/server-sdk-shared | axiom-pet/packages |
| stage-pocket | @proj-airi/audio, @proj-airi/ccc, @proj-airi/drizzle-duckdb-wasm, @proj-airi/font-chillroundm, @proj-airi/font-cjkfonts-allseto, @proj-airi/font-xiaolai, @proj-airi/i18n, @proj-airi/pipelines-audio, @proj-airi/server-sdk, @proj-airi/stage-layouts, @proj-airi/stage-shared, @proj-airi/stage-ui, @proj-airi/stage-ui-three | axiom-pet/packages |

### axiom-pet source code imports:

| Consumer | Imports | Provider |
|----------|---------|----------|
| core-agent | @proj-airi/server-shared/types, @proj-airi/stream-kit, @proj-airi/server-sdk | axiom-pet/packages |
| electron-vueuse | @proj-airi/electron-eventa | axiom-pet/packages |
| airi-screenshot | @proj-airi/vishot-runner-electron | axiom-pet/packages |

---

## Missing Registry Entries

| Consumer | Imports | Registry Status |
|----------|---------|----------------|
| axi-coder | @axi/shell, @axi/core, @axi/tokens | NOT DECLARED as consumes in registry - consumes[] only lists: axi-workbench, axi-agent, axi-model-gateway, axi-accounts, axi-notify |
| devsvc-dashboard (axi-workbench app) | @axi/addons, @axi/core, @axi/crud, @axi/presets, @axi/settings, @axi/shell, @axi/tokens, @axi/widgets | axi-workbench does NOT list axi-ui in its consumers[] (axi-ui is in consumes[] of axi-workbench but devsvc-dashboard is an app within axi-workbench) |
| axi-coder | @axi/workstation-contracts (via workbench-foundation) | NOT DECLARED - axi-coder does not consume axi-workbench packages |
| axi-workbench | @axi/workstation-contracts, @axi/types, @axi/workbench-foundation | axi-workbench consumes axi-ui but NOT the internal @axi/* packages it actually depends on |
| axiom-pet apps | @proj-airi/* internal packages | These are intra-project, not registry-level - OK |
| story-graph | @axi/ui, @axi/registry | Properly declared in registry |

---

## Orphaned Provides (provided but no consumer in registry)

| Provider | Provides | Consumer Count |
|----------|---------|---------------|
| axi-coder | project-development-workbench, mac-desktop-client, mobile-companion-client, cli-orchestration, agent-task-console, model-routing-adapter, terminal-sessions, artifact-review | 0 (consumers[] is empty) |
| axi-pet-desktop | desktop-tamagotchi-app, desktop-pet-macos-vrm, electron-bridge-packages, stage-core-self-contained, godot-desktop-integration | 0 |
| ielts-vocab | ielts-learning-app, upload-asr-api, realtime-asr-socket, tts-backend | 0 |
| story-graph | story-graph-workbench, novel-relationship-graph, evidence-driven-story-analysis | 0 |
| axi-feishu-codex-bridge | feishu-codex-bridge, feishu-codex-channel-adapter, feishu-bot-runtime | 0 |
| axi-soul-world | axi-soul-world-product-contract, axi-soul-world-local-first-runtime-boundary, axi-mood-private-records | 0 |
| axi-workbench-web-dist | axi-workbench-web-distribution, axi-workbench-web-standalone | 0 |
| axi-workbench-mobile-dist | axi-workbench-mobile-distribution, axi-workbench-mobile-standalone | 0 |
| axi-workbench-desktop-dist | axi-workbench-desktop-distribution, axi-workbench-desktop-standalone, tauri-desktop-app | 0 |
| voice-assistant-on-device-speech-recognition | on-device-speech-recognition, voice-loop-prototype, android-voice-assistant | 0 |
| sports-management | sports-management-web, sports-management-mobile, sports-management-backend | 0 |
| axi-kernel | object-registry, schema-migrations, change-stream-source, sync-v1 (kernel↔workspace) | 0 (consumers field absent in graph.json; consumed by 6 Personal OS siblings) |
| axi-workbench-cli | workbench-cli, project-scanner, health-checks-v1, project-graph-v1, workspace-dashboard-v1, inference-stage-techstack-doctype, declared-relations-writer, prd02-bench-measurements | 0 (consumers field absent; data plane of axi-workbench per manages=["axi-workbench"]) |
| axi-inbox | inbox-collect, inbox-transform, inbox-state-machine | 0 (consumers field absent) |
| axi-sync | change-stream-collector, git-collector, l0-l3-impact-rating, change-queue-state-machine, daily-change-report | 0 (consumers field absent) |
| axi-runtime | rule-engine, skill-registry, agent-gateway, scheduler, runtime-invocation-recording | 0 (consumers field absent) |
| axi-apps | share-list-add-remove, workspace-aggregate, mobile-readonly-json | 0 (consumers field absent) |

> **Removed (absorbed 2026-09-24 ADR-008)**: `axiom-pet`, `axiom-artboard`, `axiom-proxy-companion` (physical checkout of `axiom-proxy-companion` deleted 2026-09-17; only dossier retained under `workbench/axi-workbench/apps/axi-docs/docs/content/{en,zh}/projects/axi-proxy-companion/`).

---

## Registry Consistency Issues

### 1. axi-coder missing @axi/* package declarations
- **Issue**: axi-coder's `consumes[]` does not include `axi-ui` even though its package.json declares dependencies on `@axi/core`, `@axi/shell`, `@axi/tokens`
- **Severity**: High - actual code depends on packages that are not declared in registry

### 2. axi-workbench missing internal @axi/* package declarations
- **Issue**: axi-workbench's `consumes[]` includes `axi-ui` but not the internal `@axi/workstation-contracts`, `@axi/types`, `@axi/workbench-foundation` packages that its own packages depend on
- **Severity**: Medium - intra-workbench dependencies not tracked

### 3. devsvc-dashboard @axi/* dependencies not tracked at app level
- **Issue**: axi-workbench/apps/devsvc-dashboard uses 8 @axi/* packages, but there's no way to know which apps within axi-workbench depend on what
- **Severity**: Low - covered by axi-workbench consuming axi-ui

### 4. axiom-pet namespace usage
- **Note**: axiom-pet intentionally uses `@proj-airi/*` namespace (kept-upstream-intent per namespace_status)
- **This is NOT an error** - it's a documented decision

---

## Summary Statistics

- **Total Projects**: 35
- **Projects with no consumers**: 14 (40%)
- **Missing @axi/* declarations in axi-coder**: 3 packages (@axi/core, @axi/shell, @axi/tokens)
- **Missing @axi/* declarations in axi-workbench internal packages**: 3 packages (@axi/workstation-contracts, @axi/types, @axi/workbench-foundation)
- **External/Infra projects**: ai-capability, ollama-local, minimax-tokenplan (3)
- **Distribution projects**: 3 (web, mobile, desktop)

