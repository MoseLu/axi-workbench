---
id: reference-axi-workspace-project-completion
title: Axi Workspace Project Completion
type: reference
status: evergreen
tags: [workspace, completion, status]
created: 2026-09-24
modified: 2026-09-24
agent-readable: true
---

# Axi Workspace Project Completion

最后生成：2026-09-24

## 摘要

- 已登记项目：43
- Axi 项目：27
- 完成：1
- 可用及以上：12
- 阻塞：0

## 阶段口径

- `unassessed`：还没有足够证据，不猜完成度。
- `building`：核心能力仍在建设。
- `usable`：可被消费，但还有明确缺口。
- `near-complete`：只剩少量收尾。
- `complete`：当前目标已完成，后续只做 polish 或内容扩展。
- `maintenance`：进入维护状态。
- `blocked`：存在阻塞。
- `archived`：归档或参考状态。

## Axi 项目完成矩阵

| Project | Stage | Confidence | Docs | Evidence | Remaining |
|---|---|---|---|---|---|
| `axi-accounts` | 未评估 | 低 | not-applicable | docs:not-applicable<br>handoff:not-applicable<br>... | - |
| `axi-agent` | 未评估 | 高 | ready | projects/axi-agent/backend/app/api/workstation.py (FastAPI runtime)<br>projects/axi-agent/backend/tests/test_runtime_api_smoke.py + test_workstation_agent_tasks.py + test_task_scheduler_mcp_quality.py + test_axi_agent_mcp_client.py (pytest verify)<br>... | Consolidate agent runtime completion evidence into project docs.<br>Keep MCP/transport/bridge consumer checks green as Axi Coder grows.<br>... |
| `axi-apps` | 未评估 | 低 | partial | docs:partial<br>handoff:unready | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-coder` | 可用 | 高 | partial | Product surface and workspace E2E contract tests define the Axi Coder capability boundary.<br>Hosted dashboard registration exposes Axi Coder under /apps/axi-coder/overview.<br>... | Add native Tauri completion command only if the static snapshot stops being sufficient.<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-docs` | 未评估 | 低 | missing | handoff:unready | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-feishu-codex-bridge` | 未评估 | 低 | partial | docs:partial<br>handoff:stale<br>... | 补齐 TODO.md，让待办和里程碑可审计。<br>补齐 MILESTONE.md，让待办和里程碑可审计。<br>... |
| `axi-image-preview` | 完成 | 高 | partial | README documents dev/build/preview and wallpaper MCP commands.<br>package.json exposes test, build, and mcp:wallpapers scripts.<br>... | polish/content expansion |
| `axi-inbox` | 未评估 | 低 | partial | docs:partial<br>handoff:unready | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-kernel` | 未评估 | 低 | partial | docs:partial<br>handoff:verified | 补齐 TODO.md，让待办和里程碑可审计。<br>补齐 MILESTONE.md，让待办和里程碑可审计。<br>... |
| `axi-model-gateway` | 可用 | 中 | partial | ProviderProfile tests guard credential-ref routing without plaintext secrets.<br>Axi Coder proxy handles OpenAI, Claude Messages, and Gemini request shapes.<br>... | Keep gateway status as an infrastructure contract, not a separate product UI.<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-notify` | 可用 | 中 | partial | Relay and local smoke verification are registered in the workspace graph.<br>Axi Coder consumes Notify for mobile companion task and notification return paths.<br>... | Keep mobile workbench evidence and goal artifacts discoverable from project docs.<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `axi-pet` | 未评估 | 中 | partial | Project now lives under /Volumes/code/workspace/projects/axi-pet.<br>Local verification covers stage-web, stage-ui, and stage-layouts typechecks.<br>... | Decide whether to keep upstream AIRI branding internally or run a separate package/product rename pass (see namespace_status).<br>Promote local STT helper into a documented project script if it becomes durable.<br>... |
| `axi-pet-desktop` | 未评估 | 高 | partial | Root AGENTS.md, docs/HANDOFF.md, root CHANGE.md written on 2026-06-19.<br>infra/axi-workspace-governance/workspace.json has axi-pet-desktop entry.<br>... | Add GitHub remote + .github/workflows/* CI lane (P1, owner-approved).<br>Lock contract package version-sync workflow with axi-pet (P1).<br>... |
| `axi-registry` | 可用 | 中 | partial | Workspace graph registers registry health verification.<br>Axi UI declares the registry as its package distribution boundary.<br>... | Keep registry health visible when shared packages are published or consumed.<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `axi-rules` | 未评估 | 低 | partial | docs:partial<br>handoff:stale<br>... | - |
| `axi-runtime` | 未评估 | 低 | partial | docs:partial<br>handoff:unready | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-skills` | 可用 | 中 | ready | Repository verifier covers skill entrypoints, logical names, forbidden runtime artifacts, and generated index output.<br>i18n verifier protects the English runtime source while tracking translation batch coverage.<br>... | Keep the generated skill index and i18n batch manifest synchronized after skill catalog changes. |
| `axi-soul-world` | 未评估 | 中 | partial | products/axi-soul-world/AGENTS.md<br>products/axi-soul-world/docs/project-docs.manifest.json<br>... | Run the Android device behavior flow and record state-specific evidence.<br>Retire the preserved incubation rollback checkout only after owner acceptance.<br>... |
| `axi-sync` | 未评估 | 低 | partial | docs:partial<br>handoff:unready | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `axi-tauri-starter` | 未评估 | 低 | partial | docs:partial<br>handoff:stale<br>... | 补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `axi-ui` | 可用 | 中 | partial | Workspace verify covers file-line guard, typecheck, and tests.<br>Axi Coder and dashboard surfaces consume linked @axi packages.<br>... | Continue additive package hardening without breaking @axi/* style/runtime contracts. |
| `axi-workbench` | 建设中 | 中 | partial | DevSvc Dashboard and Axi Coder are registered as hosted workbench surfaces.<br>Workspace verify covers dashboard, Axi Coder, verification inbox, and fleet console.<br>... | Continue consolidating dashboard/control-plane documentation and evidence.<br>consumes ai-resource-orchestration is a declarative capability edge only. Runtime dispatch flows through task-execution-routing/v1 and must never instantiate a second resource gateway or front the standalone gateway directly. See ADR-005/006 and the resource-search ADR for the cross-project contract surface. |
| `axi-workbench-cli` | 未评估 | 低 | partial | docs:partial<br>handoff:verified | 补齐 TODO.md，让待办和里程碑可审计。<br>补齐 MILESTONE.md，让待办和里程碑可审计。<br>... |
| `axi-workbench-desktop-dist` | 可用 | 高 | legacy | distributions/axi-workbench-desktop/package.json<br>distributions/axi-workbench-desktop/pnpm-workspace.yaml<br>... | Verify Tauri build pipeline<br>Confirm DMG packaging workflow<br>... |
| `axi-workbench-mobile-dist` | 可用 | 高 | legacy | distributions/axi-workbench-mobile/package.json<br>distributions/axi-workbench-mobile/pnpm-workspace.yaml<br>... | Verify mobile-specific build targets<br>Confirm platform-specific package publishing<br>... |
| `axi-workbench-web-dist` | 可用 | 高 | legacy | distributions/axi-workbench-web/package.json<br>distributions/axi-workbench-web/pnpm-workspace.yaml<br>... | Verify CI/CD pipeline integration<br>Confirm package publish workflow<br>... |
| `axi-workspace-governance` | 可用 | 中 | partial | workspace:docs:sync generates catalog and completion docs.<br>workspace-project validate remains the root graph sanity check.<br>... | Keep generated docs, graph, and mirrored Axi Docs sources synchronized after project moves. |

## 其他纳管项目

| Project | Stage | Confidence | Docs | Evidence | Remaining |
|---|---|---|---|---|---|
| `ai-capability` | 未评估 | 低 | missing | handoff:unready<br>verify:/Users/mose/.cc-connect/bin/ai-capability status --json<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `android-page-patrol` | 未评估 | 低 | legacy | docs:legacy<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `blinko` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `cockpit-tools` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `codex-app-projects` | 维护 | 高 | not-applicable | WORKSPACE_INDEX.md declares the root contract.<br>AGENTS.md declares that git work belongs to owning project repositories.<br>... | - |
| `comfyui` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `dbskill` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 TODO.md，让待办和里程碑可审计。<br>补齐 MILESTONE.md，让待办和里程碑可审计。<br>... |
| `ielts-vocab` | 未评估 | 低 | partial | docs:partial<br>handoff:stale<br>... | 补齐 TODO.md，让待办和里程碑可审计。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `image2prompt` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `minimax-tokenplan` | 未评估 | 低 | missing | handoff:unready<br>verify:/Users/mose/.cc-connect/bin/minimax-tokenplan tools<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `ollama-local` | 未评估 | 低 | missing | handoff:unready<br>verify:/Users/mose/.cc-connect/bin/ollama-local embed --model mxbai-embed-large:latest --text smoke<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 TODO.md，让待办和里程碑可审计。<br>... |
| `opencodex` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `sports-management` | 未评估 | 低 | partial | docs:partial<br>handoff:stale<br>... | - |
| `story-graph` | 未评估 | 高 | partial | products/story-graph/AGENTS.md<br>products/story-graph/docs/HANDOFF.md<br>... | Run the focused Python, Node, and viewer build verification from the canonical path.<br>Retire the rollback checkout only after owner acceptance.<br>... |
| `sub2api` | 未评估 | 低 | partial | docs:partial<br>handoff:unready<br>... | 补齐 docs/project-docs.manifest.json 文档接入清单。<br>补齐 VERIFICATION.md：verify 命令已声明但缺沉淀位置。运行 `node bin/axi-todo.mjs verify-log` 或 workspace-verification.mjs 生成。 |
| `voice-assistant-on-device-speech-recognition` | 未评估 | 中 | legacy | incubation.json records full prototype evidence: sherpa-onnx transducer, StubChatEngine swap contract, TTS latency measurements, and promotion criteria<br>End-to-end loop measured 2026-09-18: median first-audio 2170ms, full loop median 2652ms on physical device<br>... | Replace StubChatEngine with real on-device LLM (e.g. Qwen2.5-0.5B-INT4)<br>Identify owning boundary (host/provider/project) for promoted runtime<br>... |

## 备注

- 完成情况来自 `workspace.graph.json` 的 `completion` 声明。
- 文档接入状态、验证命令和缺口由生成器派生，用于辅助判断，不替代项目负责人声明。
