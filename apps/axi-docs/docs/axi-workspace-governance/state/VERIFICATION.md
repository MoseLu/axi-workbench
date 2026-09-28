<!-- Layer: 3 | Verification | Module: workspace-root -->
<!-- Parent Architecture: .claude/ARCHITECTURE.md -->
<!-- Auto-generated: scripts/workspace-verification.mjs -->
<!-- Last regenerated: 2026-09-24T02:10:08.510Z -->

# Workspace Verification

工作区级 verify 状态总账。汇总三处来源:
1. `workspace.graph.json` 项目节点 `verify: []` 命令清单
2. 各项目 `VERIFICATION.md` 的最新一次运行记录
3. `~/.axi-todo/tasks.json` 最近 7 天 verify 结果摘要

## Version Target

| Field | Value |
| --- | --- |
| Schema Version | 2026-06-11 |
| Last Regenerated | 2026-09-24T02:10:08.510Z |
| Source | workspace.graph.json + VERIFICATION.md + ~/.axi-todo/tasks.json |

## Summary

- Total projects: 43
- With manifest: 23
- With VERIFICATION.md: 14
- With verify commands: 35
- Milestone nodes: 73
- Axi Todo recent (7d): 0

## Axi Project Verification Matrix

| Project | Last Verified | Status | Verify Commands | Manifest Verification | Source |
| --- | --- | --- | --- | --- | --- |
| `axi-accounts` | - | declared | test -f /Volumes/code/workspace/docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md | verified@2026-08-23 | `/Volumes/code/workspace/docs/axi/VERIFICATION.md` |
| `axi-agent` | 2026-08-23 | verified | PYTHONPATH=. uv run --python 3.12 --with-requirements backend/requirements.txt … | verified@2026-08-23 | `/Volumes/code/workspace/agent-cluster/axi-agent/docs/state/VERIFICATION.md` |
| `axi-apps` | - | unverified | - | - | `/Volumes/code/workspace/foundation/axi-apps/VERIFICATION.md` |
| `axi-coder` | 2026-08-23 | verified | pnpm typecheck \| pnpm test | verified@2026-08-23 | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/VERIFICATION.md` |
| `axi-docs` | - | unverified | - | - | `/Volumes/code/workspace/projects/axi-docs/VERIFICATION.md` |
| `axi-feishu-codex-bridge` | - | declared | PYTHONPATH=src .venv/bin/python -m unittest discover -s tests | verified@2026-08-23 | `/Volumes/code/workspace/agent-cluster/axi-agent/tools/axi-feishu-codex-bridge/VERIFICATION.md` |
| `axi-image-preview` | 2026-08-23 | verified | pnpm test \| pnpm build | verified@2026-08-23 | `/Volumes/code/workspace/workbench/axi-image-preview/VERIFICATION.md` |
| `axi-inbox` | - | unverified | - | - | `/Volumes/code/workspace/foundation/axi-inbox/VERIFICATION.md` |
| `axi-kernel` | 2026-09-21 | verified | - | verified@2026-09-21 | `/Volumes/code/workspace/foundation/axi-kernel/docs/VERIFICATION.md` |
| `axi-model-gateway` | 2026-08-23 | verified | pnpm typecheck | verified@2026-08-23 | `/Volumes/code/workspace/workbench/axi-workbench/apps/axi-coder/VERIFICATION.md` |
| `axi-notify` | - | declared | make test-relay \| make smoke-relay-local | verified@2026-08-23 | `/Volumes/code/workspace/foundation/axi-notify/VERIFICATION.md` |
| `axi-pet` | - | unverified | - | verified@2026-08-23 | `/Volumes/code/workspace/projects/axi-pet/docs/state/VERIFICATION.md` |
| `axi-pet-desktop` | 2026-08-23 | verified | pnpm -F @axi-pet-desktop/desktop-pet typecheck \| pnpm -F @axi-pet-desktop/deskt… | verified@2026-09-14 | `/Volumes/code/workspace/workbench/axi-pet-desktop/VERIFICATION.md` |
| `axi-registry` | - | declared | npm run health | verified@2026-08-23 | `/Volumes/code/workspace/foundation/axi-registry/docs/state/VERIFICATION.md` |
| `axi-rules` | 2026-06-11 | verified | python3 scripts/validate-index.py | verified@2026-08-17 | `/Volumes/code/workspace/foundation/axi-rules/docs/state/VERIFICATION.md` |
| `axi-runtime` | - | unverified | - | - | `/Volumes/code/workspace/foundation/axi-runtime/VERIFICATION.md` |
| `axi-skills` | 2026-06-11 | verified | python3 scripts/verify.py \| python3 scripts/verify_i18n.py --check-manifest-onl… | verified@2026-08-23 | `/Volumes/code/workspace/foundation/axi-skills/docs/state/VERIFICATION.md` |
| `axi-soul-world` | 2026-08-25 | verified | git diff --check \| test -f apps/web-admin/index.html && test -f apps/web-bff/RE… | verified@2026-08-25 | `/Volumes/code/workspace/products/axi-soul-world/docs/VERIFICATION.md` |
| `axi-sync` | - | unverified | - | - | `/Volumes/code/workspace/foundation/axi-sync/VERIFICATION.md` |
| `axi-tauri-starter` | - | declared | test -f scripts/tauri-env.sh | verified@2026-08-23 | `/Volumes/code/workspace/shared/axi-tauri-starter/docs/state/VERIFICATION.md` |
| `axi-ui` | 2026-08-23 | verified | pnpm check:file-lines \| pnpm typecheck \| pnpm test | verified@2026-08-23 | `/Volumes/code/workspace/foundation/axi-ui/docs/state/VERIFICATION.md` |
| `axi-workbench` | 2026-09-13 | verified | pnpm --dir apps/devsvc-dashboard typecheck \| pnpm --dir apps/axi-coder typechec… | verified@2026-09-13 | `/Volumes/code/workspace/workbench/axi-workbench/docs/state/VERIFICATION.md` |
| `axi-workbench-cli` | 2026-09-21 | verified | - | verified@2026-09-21 | `/Volumes/code/workspace/workbench/axi-workbench-cli/docs/VERIFICATION.md` |
| `axi-workbench-desktop-dist` | - | declared | pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-desktop type-che… | - | `/Volumes/code/workspace/distributions/axi-workbench-desktop/VERIFICATION.md` |
| `axi-workbench-mobile-dist` | - | declared | pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-mobile type-chec… | - | `/Volumes/code/workspace/distributions/axi-workbench-mobile/VERIFICATION.md` |
| `axi-workbench-web-dist` | - | declared | pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-web type-check \|… | - | `/Volumes/code/workspace/distributions/axi-workbench-web/VERIFICATION.md` |
| `axi-workspace-governance` | - | declared | pnpm workspace:audit | verified@2026-08-23 | `VERIFICATION.md` |

## Other Managed Projects

| Project | Last Verified | Status | Verify Commands | Source |
| --- | --- | --- | --- | --- |
| `ai-capability` | - | declared | /Users/mose/.cc-connect/bin/ai-capability status --json | `/Users/mose/.cc-connect/VERIFICATION.md` |
| `android-page-patrol` | - | declared | python -m scripts.patrol --help | `/Volumes/code/workspace/tools/android-page-patrol/VERIFICATION.md` |
| `blinko` | - | declared | test -f package.json | `/Volumes/code/workspace/references/blinko/VERIFICATION.md` |
| `cockpit-tools` | - | declared | npm run typecheck \| npm run release:preflight | `/Volumes/code/workspace/references/cockpit-tools/VERIFICATION.md` |
| `codex-app-projects` | - | declared | /Volumes/code/workspace/scripts/workspace-project validate | `/Volumes/code/workspace/VERIFICATION.md` |
| `comfyui` | - | declared | python3 -m py_compile main.py | `/Volumes/code/workspace/references/comfyui/VERIFICATION.md` |
| `dbskill` | - | declared | test -f README.md \| test -d skills \| test -f tools/build-skills.sh | `/Volumes/code/workspace/references/dbskill/VERIFICATION.md` |
| `ielts-vocab` | - | declared | pnpm --dir frontend verify:repo-guards \| python -m pytest backend/tests/test_sp… | `/Volumes/code/workspace/products/ielts-vocab/VERIFICATION.md` |
| `image2prompt` | - | declared | test -f README.md \| test -f manifest.json | `/Volumes/code/workspace/references/image2prompt/VERIFICATION.md` |
| `minimax-tokenplan` | - | declared | /Users/mose/.cc-connect/bin/minimax-tokenplan tools | `/Users/mose/.cc-connect/VERIFICATION.md` |
| `ollama-local` | - | declared | /Users/mose/.cc-connect/bin/ollama-local embed --model mxbai-embed-large:latest… | `/Users/mose/.cc-connect/VERIFICATION.md` |
| `opencodex` | - | declared | test -f README.md \| test -f package.json \| test -f scripts/build-macos-app.sh | `/Volumes/code/workspace/references/opencodex/VERIFICATION.md` |
| `sports-management` | 2026-08-23 | verified | pnpm test | `/Volumes/code/workspace/archive/axi-sports-management-app/VERIFICATION.md` |
| `story-graph` | 2026-09-14 | verified | python3 -m unittest -q tests/test_evidence_pipeline.py \| node --test app/server… | `/Volumes/code/workspace/products/story-graph/docs/HANDOFF.md` |
| `sub2api` | - | declared | test -d . | `/Volumes/code/workspace/references/sub2api/VERIFICATION.md` |
| `voice-assistant-on-device-speech-recognition` | - | declared | test -d /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recog… | `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/VERIFICATION.md` |

## Milestone Verification Roll-up

| Project | Milestone | Status | Has Verification | Snippet |
| --- | --- | --- | --- | --- |
| `axi-image-preview` | M1 | - | no | - |
| `axi-image-preview` | M2 | - | no | - |
| `axi-image-preview` | M3 | - | no | - |
| `axi-image-preview` | M4 | - | no | - |
| `axi-image-preview` | M5 | - | no | - |
| `axi-image-preview` | M6 | - | no | - |
| `axi-notify` | M1 | - | no | - |
| `axi-notify` | M2 | - | no | - |
| `axi-notify` | M3 | - | no | - |
| `axi-notify` | M4 | - | no | - |
| `axi-notify` | M5 | - | no | - |
| `axi-notify` | M6 | - | no | - |
| `axi-pet` | Milestone 1 | - | no | - |
| `axi-pet` | Milestone 2 | - | no | - |
| `axi-pet` | Milestone 3 | - | no | - |
| `axi-pet` | Milestone 4 | - | no | - |
| `axi-pet` | Milestone 5 | - | no | - |
| `axi-registry` | Milestone 1 | - | no | - |
| `axi-registry` | Milestone 2 | - | no | - |
| `axi-registry` | Milestone 3 | - | no | - |
| `axi-skills` | Current Milestone | - | no | - |
| `axi-tauri-starter` | Milestone 1 | - | no | - |
| `axi-tauri-starter` | Milestone 2 | - | no | - |
| `axi-tauri-starter` | Milestone 3 | - | no | - |
| `axi-ui` | Milestone 0 | - | no | - |
| `axi-ui` | Milestone 0.5 | - | no | - |
| `axi-ui` | Milestone 0.6 | - | no | - |
| `axi-ui` | Milestone 0.7 | - | no | - |
| `axi-ui` | Milestone 0.8 | - | no | - |
| `axi-ui` | Milestone 0.9 | - | yes | matrix, and cannot be marked complete without dated evidence. |
| `axi-ui` | Milestone 1 | - | no | - |
| `axi-ui` | Milestone 1.1 | - | no | - |
| `axi-ui` | Milestone 2 | - | no | - |
| `axi-ui` | Milestone 3 | - | no | - |
| `axi-ui` | Documentation Automation Milestone | - | no | - |
| `axi-workbench` | Milestone 0 | - | no | - |
| `axi-workbench` | Milestone 1 | - | no | - |
| `axi-workbench` | Milestone 2 | - | no | - |
| `axi-workbench` | Milestone 3 | - | no | - |
| `axi-workbench` | Milestone 4 | - | no | - |
| `axi-workbench` | Milestone 5 | - | no | - |
| `axi-workspace-governance` | Milestone 1 | - | no | - |
| `axi-workspace-governance` | Milestone 2 | - | no | - |
| `axi-workspace-governance` | Milestone 3 | - | no | - |
| `axi-workspace-governance` | Milestone 4 | - | no | - |
| `axi-workspace-governance` | Milestone 5 | - | no | - |
| `axi-workspace-governance` | Milestone 6 | - | no | - |
| `axi-workspace-governance` | Milestone 7 | - | no | - |
| `blinko` | Milestone 1 | - | no | - |
| `blinko` | Milestone 2 | - | no | - |
| `blinko` | Milestone 3 | - | no | - |
| `cockpit-tools` | Milestone 1 | - | no | - |
| `cockpit-tools` | Milestone 2 | - | no | - |
| `cockpit-tools` | Milestone 3 | - | no | - |
| `codex-app-projects` | Milestone | - | no | - |
| `codex-app-projects` | WRK.1 - Layered Documentation Baseline | - | yes | - |
| `codex-app-projects` | WRK.2 - Axi Docs Workspace Ingestion | - | yes | - |
| `codex-app-projects` | WRK.3 - Governance And Service Consistency | - | yes | - |
| `comfyui` | Milestone 1 | - | no | - |
| `comfyui` | Milestone 2 | - | no | - |
| `comfyui` | Milestone 3 | - | no | - |
| `ielts-vocab` | Current Milestone | - | no | - |
| `image2prompt` | Milestone 1 | - | no | - |
| `image2prompt` | Milestone 2 | - | no | - |
| `image2prompt` | Milestone 3 | - | no | - |
| `opencodex` | Milestone 1 | - | no | - |
| `opencodex` | Milestone 2 | - | no | - |
| `opencodex` | Milestone 3 | - | no | - |
| `sports-management` | Current Milestone (M-CURRENT) | - | no | - |
| `sports-management` | Milestone (M-*) | - | no | - |
| `sub2api` | Milestone 1 | - | no | - |
| `sub2api` | Milestone 2 | - | no | - |
| `sub2api` | Milestone 3 | - | no | - |

## Axi Todo Verify Activity (last 7d)

No recent verify activity in `/Users/mose/.axi-todo/tasks.json`.

## Gaps

- **[missing-verification-file]** `ai-capability` — verify commands declared (/Users/mose/.cc-connect/bin/ai-capability status --json) but VERIFICATION.md not found at /Users/mose/.cc-connect/VERIFICATION.md
- **[missing-verification-file]** `android-page-patrol` — verify commands declared (python -m scripts.patrol --help) but VERIFICATION.md not found at /Volumes/code/workspace/tools/android-page-patrol/VERIFICATION.md
- **[missing-verification-file]** `axi-accounts` — verify commands declared (test -f /Volumes/code/workspace/docs/axi/contracts/AXI_ACCOUNTS_SHARED_SCHEMA.md) but VERIFICATION.md not found at /Volumes/code/workspace/docs/axi/VERIFICATION.md
- **[manifest-missing-verification-key]** `axi-accounts` — manifest declares documents but not documents.verification; run `pnpm workspace:docs:sync` to backfill
- **[missing-verification-file]** `axi-feishu-codex-bridge` — verify commands declared (PYTHONPATH=src .venv/bin/python -m unittest discover -s tests) but VERIFICATION.md not found at /Volumes/code/workspace/agent-cluster/axi-agent/tools/axi-feishu-codex-bridge/VERIFICATION.md
- **[missing-verification-file]** `axi-notify` — verify commands declared (make test-relay, make smoke-relay-local) but VERIFICATION.md not found at /Volumes/code/workspace/foundation/axi-notify/VERIFICATION.md
- **[missing-verification-file]** `axi-registry` — verify commands declared (npm run health) but docs/state/VERIFICATION.md not found at /Volumes/code/workspace/foundation/axi-registry/docs/state/VERIFICATION.md
- **[missing-verification-file]** `axi-tauri-starter` — verify commands declared (test -f scripts/tauri-env.sh) but docs/state/VERIFICATION.md not found at /Volumes/code/workspace/shared/axi-tauri-starter/docs/state/VERIFICATION.md
- **[missing-verification-file]** `axi-workbench-desktop-dist` — verify commands declared (pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-desktop type-check, pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-desktop verify:ci) but VERIFICATION.md not found at /Volumes/code/workspace/distributions/axi-workbench-desktop/VERIFICATION.md
- **[missing-verification-file]** `axi-workbench-mobile-dist` — verify commands declared (pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-mobile type-check, pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-mobile verify:ci) but VERIFICATION.md not found at /Volumes/code/workspace/distributions/axi-workbench-mobile/VERIFICATION.md
- **[missing-verification-file]** `axi-workbench-web-dist` — verify commands declared (pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-web type-check, pnpm --dir /Volumes/code/workspace/distributions/axi-workbench-web verify:ci) but VERIFICATION.md not found at /Volumes/code/workspace/distributions/axi-workbench-web/VERIFICATION.md
- **[missing-verification-file]** `axi-workspace-governance` — verify commands declared (pnpm workspace:audit) but VERIFICATION.md not found at /Volumes/code/workspace/foundation/workspace-governance/VERIFICATION.md
- **[manifest-missing-verification-key]** `axi-workspace-governance` — manifest declares documents but not documents.verification; run `pnpm workspace:docs:sync` to backfill
- **[missing-verification-file]** `blinko` — verify commands declared (test -f package.json) but VERIFICATION.md not found at /Volumes/code/workspace/references/blinko/VERIFICATION.md
- **[missing-verification-file]** `cockpit-tools` — verify commands declared (npm run typecheck, npm run release:preflight) but VERIFICATION.md not found at /Volumes/code/workspace/references/cockpit-tools/VERIFICATION.md
- **[missing-verification-file]** `codex-app-projects` — verify commands declared (/Volumes/code/workspace/scripts/workspace-project validate) but VERIFICATION.md not found at /Volumes/code/workspace/VERIFICATION.md
- **[missing-verification-file]** `comfyui` — verify commands declared (python3 -m py_compile main.py) but VERIFICATION.md not found at /Volumes/code/workspace/references/comfyui/VERIFICATION.md
- **[missing-verification-file]** `dbskill` — verify commands declared (test -f README.md, test -d skills, test -f tools/build-skills.sh) but VERIFICATION.md not found at /Volumes/code/workspace/references/dbskill/VERIFICATION.md
- **[manifest-missing-verification-key]** `dbskill` — manifest declares documents but not documents.verification; run `pnpm workspace:docs:sync` to backfill
- **[missing-verification-file]** `ielts-vocab` — verify commands declared (pnpm --dir frontend verify:repo-guards, python -m pytest backend/tests/test_speech_transcribe.py backend/tests/test_speech_socketio.py) but VERIFICATION.md not found at /Volumes/code/workspace/products/ielts-vocab/VERIFICATION.md
- **[missing-verification-file]** `image2prompt` — verify commands declared (test -f README.md, test -f manifest.json) but VERIFICATION.md not found at /Volumes/code/workspace/references/image2prompt/VERIFICATION.md
- **[missing-verification-file]** `minimax-tokenplan` — verify commands declared (/Users/mose/.cc-connect/bin/minimax-tokenplan tools) but VERIFICATION.md not found at /Users/mose/.cc-connect/VERIFICATION.md
- **[missing-verification-file]** `ollama-local` — verify commands declared (/Users/mose/.cc-connect/bin/ollama-local embed --model mxbai-embed-large:latest --text smoke) but VERIFICATION.md not found at /Users/mose/.cc-connect/VERIFICATION.md
- **[missing-verification-file]** `opencodex` — verify commands declared (test -f README.md, test -f package.json, test -f scripts/build-macos-app.sh) but VERIFICATION.md not found at /Volumes/code/workspace/references/opencodex/VERIFICATION.md
- **[missing-verification-file]** `sub2api` — verify commands declared (test -d .) but VERIFICATION.md not found at /Volumes/code/workspace/references/sub2api/VERIFICATION.md
- **[missing-verification-file]** `voice-assistant-on-device-speech-recognition` — verify commands declared (test -d /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/.gradle, test -f /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/build.gradle.kts) but VERIFICATION.md not found at /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/VERIFICATION.md
- **[milestone-missing-verification]** `axi-image-preview` — M1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-image-preview` — M2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-image-preview` — M3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-image-preview` — M4 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-image-preview` — M5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-image-preview` — M6 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M4 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-notify` — M6 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-pet` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-pet` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-pet` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-pet` — Milestone 4 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-pet` — Milestone 5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-registry` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-registry` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-registry` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-skills` — Current Milestone has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-tauri-starter` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-tauri-starter` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-tauri-starter` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 0 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 0.5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 0.6 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 0.7 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 0.8 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 1.1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-ui` — Documentation Automation Milestone has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 0 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 4 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workbench` — Milestone 5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 4 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 5 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 6 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `axi-workspace-governance` — Milestone 7 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `blinko` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `blinko` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `blinko` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `cockpit-tools` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `cockpit-tools` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `cockpit-tools` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `codex-app-projects` — Milestone has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `comfyui` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `comfyui` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `comfyui` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `ielts-vocab` — Current Milestone has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `image2prompt` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `image2prompt` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `image2prompt` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `opencodex` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `opencodex` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `opencodex` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `sports-management` — Current Milestone (M-CURRENT) has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `sports-management` — Milestone (M-*) has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `sub2api` — Milestone 1 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `sub2api` — Milestone 2 has no `Verification:` section; legacy `Verify:` headings should be renamed
- **[milestone-missing-verification]** `sub2api` — Milestone 3 has no `Verification:` section; legacy `Verify:` headings should be renamed

<!-- MANUAL: regenerate via `node foundation/workspace-governance/scripts/workspace-verification.mjs` -->
