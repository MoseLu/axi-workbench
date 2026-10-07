---
id: axi-docs-en-projects-blinko
title: Blinko Reference
type: project
status: published
tags: [Axi Docs, Projects, references, reference, inbox, ai-first, tauri, monorepo]
created: 2026-10-07
modified: 2026-10-07
graph-title: Blinko Reference
graph-tags: [Projects, references, inbox]
description: Open-source self-hosted, AI-first card note-taking application. `Blinko` is a Bun + TypeScript monorepo pairing a Tauri shell with a tRPC + Express + Prisma (Postgres) backend that uses the `Mastra` AI stack and `Model Context Protocol` (`MCP`) to expose the inbox itself as agent-callable tools (`upsertBlinkoTool`, `searchBlinkoTool`, `updateBlinkoTool`, `deleteBlinkoTool`, `scheduledTaskTool`, `webSearchTool`, `McpClientManager`).
project:
  id: blinko
  partition: references
  path: /Volumes/code/workspace/references/short-term/blinko
  source-section: reference
---

# Blinko Reference

> Workspace project dossier. Source of truth: `/Volumes/code/workspace/references/short-term/blinko`.
> Section: reference / Partition: `references/`.

## Summary

`Blinko` is an open-source, self-hosted, AI-first card note-taking application that bills itself as a place to capture "flash thoughts or sudden inspiration — those fleeting ideas that pop into mind". It ships as a Bun + TypeScript monorepo that pairs a Tauri desktop/mobile shell with a tRPC + Express + Prisma (Postgres) backend, and it aggressively leans on the **Mastra AI stack** plus the **Model Context Protocol (MCP)** to turn the in-app AI assistant into a first-class participant in your note graph. Notes have three discrete types — `BLINKO` (0, ephemeral flash), `NOTE` (1, long-form) and `TODO` (2, tracked task) — and can be hashtagged (`#tag`), shared publicly with expiring URLs, attached to conversations with the AI assistant, embedded in markdown knowledge graphs, or fed into a vector store for natural-language RAG retrieval. The repo advertises multi-platform support via Tauri (macOS / Windows / Android / Linux) and a one-liner `curl | bash` Docker installer; production deployment uses `docker-compose.prod.yml` with a Postgres 14 service and an embedded pg-boss queue.

For Axi, Blinko is the most directly applicable inbox-style reference because it solves a problem Axi already cares about: **how do you make a personal inbox AI-native without losing the speed-of-capture that makes inboxes useful?** Blinko encodes the answer in its data model: every `note` row is intentionally tiny (`id`, `type`, `content`, `isArchived`, `isRecycle`, `isShare`, `isTop`, `isReviewed`, `metadata`, `accountId`), every action is a flag (`isTop`, `isArchived`, `isRecycle`), and "AI" is not a separate surface — it is a column on the same row that any query can join on (`embeddingUpsert`, `embeddingDelete`, `embeddingInsertAttachments` in `server/routerTrpc/ai.ts`). The AI tool layer (`server/aiServer/tools/createBlinko.ts`, `searchBlinko.ts`, `updateBlinko.ts`, `deleteBlinko.ts`, `webSearch.ts`, `scheduledTask.ts`) shows how to expose the inbox itself as **agent-callable tools**: the AI assistant can create, search, update, delete notes and schedule tasks because the same tRPC procedures the UI calls are exposed as Mastra tools. The `McpClientManager` (`server/aiServer/mcp/McpClientManager.ts`) extends the same idea outward — the assistant can talk to user-defined MCP servers (stdio, SSE, or streamable-HTTP) on demand, with a 5-minute idle eviction policy. Axi's inbox product should adopt this exact three-type schema (flash / note / todo) and the same tool-wrapping pattern.

A second value is the **provider-and-model registry as data, not code**. The Prisma models `aiProviders`, `aiModels`, `mcpServers` (`prisma/schema.prisma` lines 270+) store every configured provider (OpenAI / Anthropic / Gemini / DeepSeek / OpenRouter / xAI / Azure / Ollama / Voyage) and model in the database; the `LLMProvider` class (`server/aiServer/providers/LLMProvider.ts`) is a thin switch on `config.provider.toLowerCase()` that calls the matching `@ai-sdk/*` factory and returns a `LanguageModelV1`. Adding a new provider is a database row plus a `case` branch, not a code change. The `AiModelFactory.GetProvider()` (`server/aiServer/aiModelFactory.ts`) sits between the DB rows and the Mastra `Agent`, with a per-model dimension table for the vector store (`mxbai-embed-large: 1024`, `nomic-embed-text: 768`, `bge-large-en: 1024` — `aiModelFactory.ts` lines 175-200) so the same `LibSQLVector` can be reused across embedding models. Axi's `ai-capability` router can use this same pattern: persist providers as rows, dispatch via a single switch in the LLMProvider, expose the result as a tool the agent can pick.

## Stack

`Bun 1.2.8`, `TypeScript`, `Tauri 2.x`, `Vite`, `React 18`, `HeroUI`, `MobX`, `tRPC`, `Express`, `Prisma`, `Postgres 14`, `Mastra`, `MCP`, `pg-boss`, `pg_dump`, `@ai-sdk/*`, `LibSQLVector`, `Vditor`, `Docker`, `Helm`, `trpc-to-openapi`, `JWT`, `OAuth`, `LangChain`

## Milestone Status

| Milestone | Status | Evidence |
| --- | --- | --- |
| M1 — Inbox schema (BLINKO / NOTE / TODO + JSON metadata) | shipped | `prisma/schema.prisma` lines 70-97 with `tagsToNote`, `noteReference`, `noteHistory`, `attachments` joins |
| M2 — tRPC surface (18 routers) | shipped | `server/routerTrpc/_app.ts` mounts `ai`, `notes`, `tags`, `users`, `attachments`, `config`, `public`, `task`, `aiTask`, `analytics`, `comments`, `follows`, `notifications`, `plugin`, `conversation`, `message`, `mcpServers`, `fonts` |
| M3 — AI assistant + Mastra agent + eight tools | shipped | `server/aiServer/tools/{createBlinko,createComment,deleteBlinko,scheduledTask,searchBlinko,updateBlinko,webExtra,webSearch}.ts` registered on the Mastra agent |
| M4 — MCP client (stdio / SSE / streamable-HTTP, 5-min idle eviction) | shipped | `server/aiServer/mcp/McpClientManager.ts` with `IDLE_TIMEOUT = 5 * 60 * 1000` and `CLEANUP_INTERVAL = 60 * 1000` |
| M5 — pg-boss scheduler + cron-driven AI tasks | shipped | `server/jobs/{baseScheduleJob,recommandJob,aiScheduledTaskJob}.ts`; social-feed refresh every 6h |
| M6 — Tauri shell + quick-capture floating UI | shipped | `app/src/pages/{quicknote,quickai,quicktool}.tsx` + `app/tauri-plugin-blinko` (custom Tauri plugin for local FS bridge) |
| M7 — OpenAPI from tRPC + multi-provider auth | shipped | `trpc-to-openapi` with `.meta({ openapi })`; `passport-*` strategies for Apple / Discord / Facebook / GitHub / Google / Line / Slack / Spotify / Twitch / Twitter |
| M8 — Production Docker + Helm | shipped | `dockerfile` (multi-stage Bun + Node + Vite), `docker-compose.yml` / `docker-compose.prod.yml`, `helm/` |
| M9 — Axi overlay docs | shipped | full `blinko` overlay suite at the reference repo root |

## Build & Install

Three install paths are advertised, in order of preference for local development:

```bash
# 1. Local dev (Bun monorepo)
git clone https://github.com/blinko-space/blinko
cd blinko
bun install                                       # workspace install
pnpm prisma:generate && pnpm prisma:migrate:dev   # schema bootstrap
pnpm dev                                          # = "cd app && bun run tauri dev"

# Frontend only:
pnpm dev:frontend          # vite dev server, hot reload, port 1111 by default

# Backend only:
pnpm dev:backend           # bun --env-file ../.env --watch index.ts, port 1111

# Build web assets only (for embedding into the server):
pnpm build:web

# 2. Docker (production-like, one command)
docker compose up -d        # Postgres + blinko-website
# OR the canonical one-liner:
curl -s https://raw.githubusercontent.com/blinko-space/blinko/main/install.sh | bash

# 3. Helm (Kubernetes)
helm install blinko ./helm
```

Type-check the whole repo with the dedicated blinko types config: `pnpm build:blinko:types` (`tsc -p tsconfig.blinko.json`).

The repo requires `bun >= 1.0.0` and `node >= 20.0.0` (declared in `engines` in root `package.json`). The Tauri side targets **Tauri 2.x** (`@tauri-apps/api ^2.5.0`, `@tauri-apps/cli 2.5.0`) and ships scripts for desktop (`tauri:dev`, `tauri:desktop:build`) and Android (`tauri:android:dev`, `tauri:android:build`).

## Architecture Highlights

**Schema is small and intentionally schema-less where it matters.** The `notes` table (`prisma/schema.prisma` lines 70-97) carries only flags: `type` (BLINKO=0, NOTE=1, TODO=2), `content`, `isArchived`, `isRecycle`, `isShare`, `isTop`, `isReviewed`, `sharePassword`, `shareEncryptedUrl`, `shareExpiryDate`, `shareMaxView`, `shareViewCount`, `metadata` (JSON), `accountId`, `sortOrder`, timestamps. Anything richer — links to other notes, hashtags, attachments, AI summary, share audit — is a relation or a JSON blob on `metadata`. `tagsToNote` is the join table for `#tag` extraction; `noteReference` (`@@unique([fromNoteId, toNoteId])`) is the directed graph that powers `[[wikilink]]` resolution and `BlinkoReference`. `noteHistory` keeps every version with a `version` counter for "view history". `attachments` carries upload metadata plus a `metadata` JSON column for client-side hints. The "follows social graph" (`follows` rows with `followType: following|follower`) is bolted on next to the inbox, so the same user can host both a private inbox and a federated microblog.

**The Prisma `aiProviders` and `aiModels` tables are the registry.** `aiProviders` (line 270) holds `(id, title, provider, baseURL, apiKey, config: Json, sortOrder)` and `aiModels` (visible later in the schema) holds capability flags stored as a JSON column `capabilities`, which is queried with Prisma's JSON path filter (`path: [capability], equals: true` — `server/aiServer/aiModelFactory.ts` `getAiModelsByCapability`). Capabilities follow the `ModelCapabilities` interface in `app/src/store/aiSettingStore.tsx`: `inference`, `tools`, `image`, `imageGeneration`, `video`, `audio`, `embedding`, `rerank`. This means a single `(provider, model)` row can be picked for any of eight different jobs, and the same Mastra `Agent` can swap backends without code changes — the agent only sees a `LanguageModelV1`.

**The `LLMProvider` is a tiny dispatch switch on `config.provider`.** `server/aiServer/providers/LLMProvider.ts` accepts an `LLMConfig` (`provider`, `apiKey`, `baseURL`, `modelKey`, `apiVersion`) and returns `LanguageModelV1` from the appropriate `@ai-sdk/*` factory (`createOpenAI`, `createAnthropic`, `createGoogleGenerativeAI`, `createOllama`, `createDeepSeek`, `createOpenRouter`, `createXai`, `createAzure`). Every provider's `fetch` is replaced with `this.proxiedFetch` (defined on `BaseProvider`) so a corporate HTTP proxy can be inserted transparently. This is exactly the pattern Axi's `ai-capability` router needs: a single source of truth for which provider serves which job, swap-able at runtime via DB rows.

**Mastra is the agent runtime; the same tRPC procedures the UI uses become agent tools.** `server/aiServer/aiModelFactory.ts` builds a Mastra `Agent` from the resolved `LanguageModelV1` plus a tool set: `upsertBlinkoTool`, `createCommentTool`, `searchBlinkoTool`, `updateBlinkoTool`, `deleteBlinkoTool`, `createScheduledTaskTool`, `deleteScheduledTaskTool`, `listScheduledTasksTool`, `webSearchTool` (Tavily), `webExtra`, and any tools contributed by user-configured MCP servers via `getMcpMastraTools`. Each tool is `createTool({ id, description, inputSchema: z.object(...), execute })`; for `upsertBlinkoTool` (`server/aiServer/tools/createBlinko.ts`) the execute function calls back into the **same** tRPC router via `userCaller(...)` to upsert the note. This means the AI assistant never goes around the API — it uses the same code paths the UI uses, with the same auth. The schema for the tool mirrors the schema for the UI; a feature added to one is automatically available to the other. (`searchBlinkoTool` and `updateBlinkoTool` follow the same pattern.) This is the cleanest demonstration of "the inbox IS the agent's memory" in any reference repo in this batch.

**MCP is wired in as a first-class user-configured extension surface.** `server/aiServer/mcp/McpClientManager.ts` is a singleton that lazily connects to MCP servers stored in the `mcpServers` Prisma table, supports **stdio**, **SSE**, and **streamable-HTTP** transports, evicts connections after a 5-minute idle window (`IDLE_TIMEOUT = 5 * 60 * 1000`), and exposes `getMcpMastraTools` so any registered MCP server's tools become part of the Mastra agent's tool list. This is the same idea as the registry: per-server configuration lives in the database, the runtime is one shared client manager, and the agent picks them up automatically.

**Streaming chat is a generator tRPC mutation, not a WebSocket.** The `completions` procedure in `server/routerTrpc/ai.ts` (`mutation(async function* ({ input, ctx }) { … })`) yields `{ notes }` first (the RAG hit list) and then yields `{ chunk }` for each chunk of `responseStream.fullStream`. The client-side `aiChatBox.tsx` consumes the iterator and progressively renders markdown. This is the same shape as Anthropic / OpenAI streaming responses but routed through tRPC's superjson, which keeps the API contract type-safe and the same procedure works in both the web UI and the Tauri shell.

**Background jobs run on `pg-boss`, with schedules stored in Postgres itself.** `server/lib/pgBoss.ts` wraps pg-boss as a singleton; `server/jobs/baseScheduleJob.ts` is an abstract base class with `Start(cronSchedule, ...)`, `Stop()`, `isScheduled()`, `registerWorker()`. Concrete jobs: `ArchiveJob` (move old notes to recycle), `DBJob` (pg_dump backup), `RebuildEmbeddingJob` (re-vectorize the inbox after model swap), `RecommandJob` (social-feed refresh every 6h, only schedules if there are followings — line 36 `private static maxConcurrency = 5`, line 41 `static async initialize()`), `AIScheduledTaskJob` (user-defined prompts scheduled with their own cron strings, surfaced via `aiScheduledTaskRouter`). Job names live in `shared/lib/sharedConstant.ts` so the same string is used by the worker and any UI that wants to enqueue.

**The Tauri shell adds platform-native capture without duplicating logic.** `app/src/pages/quicknote.tsx` uses `isInTauri()` to detect the desktop shell, then `invoke('resize_quicknote_window', { height })` to size the floating capture window to its content, debounced with a 100 ms timeout. The page overrides `window.history.pushState` and `replaceState` so the capture window doesn't navigate. A custom Tauri plugin `tauri-plugin-blinko/` (referenced from `app/package.json` as `file:./tauri-plugin-blinko`) bridges the desktop runtime with the web frontend. This pattern — "quick capture" floating window + platform-native shortcuts + Tauri commands — is what enables "open app, type, hit cmd+enter, close" with sub-second latency.

**Auth is multi-provider via `passport-*` plus `@auth/express`.** `server/routerExpress/auth/` registers strategies for Apple, Discord, Facebook, GitHub, Google, Line, Slack, Spotify, Twitch, Twitter, and local (username/password). Sessions use `express-session` with the `session` Prisma model (`sid`, `data`, `expiresAt`, indexed on `expiresAt`). The `verifyToken` helper (`server/lib/helper.ts`) is reused by the AI tools to authenticate internal calls — even the agent's own writes go through the same JWT path as the UI.

**OpenAPI is generated from the same tRPC routers.** `trpc-to-openapi` is registered at `server/index.ts` via `createOpenApiExpressMiddleware`, and `swagger.ts` builds an OpenAPI document that is served via `swagger-ui-express`. Every `.meta({ openapi: { method, path, summary, protect, tags } })` annotation on a procedure is reflected automatically — for example `noteRouter.list` (line 27 of `server/routerTrpc/note.ts`) declares `POST /v1/note/list`. This is how an inbox product exposes its API to third-party clients without writing two sets of routes.

## Notes

- Three-type note schema (`BLINKO` / `NOTE` / `TODO`) plus the `notes` table with `metadata: Json`; `isArchived` / `isRecycle` / `isShare` / `isTop` / `isReviewed` are columns on `notes` rather than extra tables.
- Provider + model registry lives in Prisma (`aiProviders`, `aiModels`, `mcpServers`); `LLMProvider.getLanguageModel` is a switch on `config.provider` returning `LanguageModelV1` from the matching `@ai-sdk/*` factory.
- AI tool layer (`server/aiServer/tools/{createBlinko,createComment,deleteBlinko,scheduledTask,searchBlinko,updateBlinko,webExtra,webSearch}.ts`) wraps the same tRPC procedures the UI uses via `userCaller(...)`; the schema mirrors the UI schema, so features added to one are automatically available to the other.
- MCP server lifecycle in `McpClientManager.ts` (`IDLE_TIMEOUT = 5 * 60 * 1000`, `CLEANUP_INTERVAL = 60 * 1000`) handles `stdio`, `SSE`, and `streamable-HTTP` transports; `getMcpMastraTools` adds registered MCP tools to the Mastra agent.
- Embedding-dimension table in `aiModelFactory.ts` lines 175-200 (`mxbai-embed-large: 1024`, `nomic-embed-text: 768`, `bge-large-en: 1024`) lets a single `LibSQLVector` index serve multiple embedding models.
- `pg-boss` job contract (`baseScheduleJob.ts`) is the template for `ArchiveJob`, `DBJob`, `RebuildEmbeddingJob`, `RecommandJob` (every 6h if `follows.count() > 0`), and `AIScheduledTaskJob` (user-defined cron prompts).
- Tauri quick-capture UX: `app/src/pages/quicknote.tsx` overrides `history.pushState`, debounces `invoke('resize_quicknote_window', { height })`, and works with the custom `tauri-plugin-blinko` plugin for the local FS bridge.
- Streaming chat as a generator tRPC mutation (`completions` in `ai.ts`) yields `{ notes }` then `{ chunk }` chunks; the same procedure serves the web UI and the Tauri shell via superjson.
- OpenAPI from tRPC (`trpc-to-openapi`) exposes the same API the UI uses to third-party clients without writing a second router; `.meta({ openapi: { method, path, summary, protect, tags } })` annotations are reflected automatically.

## Cross-References

- Workspace entry: [`WORKSPACE_INDEX.md`](/Volumes/code/workspace/WORKSPACE_INDEX.md) — partition table row "Blinko Reference".
- Project root: `/Volumes/code/workspace/references/short-term/blinko`
- Project `AGENTS.md`: `/Volumes/code/workspace/references/short-term/blinko/AGENTS.md`
- Project `README.md`: `/Volumes/code/workspace/references/short-term/blinko/README.md`
- Upstream repository: `https://github.com/blinko-space/blinko`
- **Axi inbox / `axi-inbox`**: the three-type note schema (BLINKO / NOTE / TODO) plus the tiny `notes` table with `metadata: Json` is the cleanest data model for a personal inbox seen in this batch. Lift the `isArchived / isRecycle / isShare / isTop / isReviewed` flag set as well — every flag is a column on `notes`, no extra tables needed.
- **Axi `ai-capability` router**: copy the registry-as-DB pattern. Persist `aiProviders` / `aiModels` rows with JSON capability flags; let `LLMProvider.getLanguageModel` be a switch on `config.provider` returning a `LanguageModelV1` from the matching `@ai-sdk/*` factory. Adding a new provider becomes one DB row plus one `case` branch.
- **Axi MCP integration**: the `McpClientManager` singleton (lazy connect + idle eviction + multi-transport) is the right shape. The 5-minute idle timeout in `McpClientManager.ts` (`IDLE_TIMEOUT = 5 * 60 * 1000`) plus 1-minute cleanup interval (`CLEANUP_INTERVAL = 60 * 1000`) is a workable default.
- **Agent-callable inbox**: the pattern in `server/aiServer/tools/createBlinko.ts` — `createTool({ id, description, inputSchema, execute })` where `execute` calls the same tRPC procedure the UI uses via `userCaller(...)` — is exactly what Axi agents need so their writes go through the same auth, validation, and audit path as the user's.
- **Streaming chat as a tRPC generator mutation**: `completions` in `ai.ts` yields `{ notes }` then `{ chunk }` chunks; the same shape can be reused in Axi's chat products.
- **Tauri capture window**: `app/src/pages/quicknote.tsx` (override `history.pushState`, debounced `invoke('resize_quicknote_window', { height })`) is a working floating-capture UX. Axi's Mac/Windows capture tools can copy it directly.
- **OpenAPI from tRPC**: `trpc-to-openapi` plus `.meta({ openapi: { method, path, summary, protect, tags } })` is a clean way to expose the same API the UI uses to third-party clients without writing a second router.
- **Job scheduling as data**: `server/jobs/baseScheduleJob.ts` plus the `AIScheduledTaskJob` example shows how to let users define their own cron prompts, persisted in `aiScheduledTask` and run by `pg-boss`. Axi's "user-defined automation" features should look like this.
- **Embedding-dimension table** (`aiModelFactory.ts` lines 175-200) is the simplest possible answer to "how do I keep one vector store across multiple embedding models" — useful when Axi's embedding provider changes mid-project.