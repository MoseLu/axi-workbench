---
stale-doc: true
stale-reason: 历史文档含 axiom-* 用法，未同步更新到 axi-* 命名约定
last-synced: 2026-09-25
synced-by: audit-remediation-2026-09-25
---

# Axi Pet Platform Architecture Map

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AXI-PET PLATFORM LANDSCAPE                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐    │
│  │                          axiom-pet (monorepo)                            │    │
│  │                          Workspace: pnpm + turbo                        │    │
│  │                          Namespace: @proj-airi/*                        │    │
│  └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐            │
│   │   stage-web     │    │  stage-pocket   │    │     server      │            │
│   │   (Vue 3 SPA)   │    │  (Capacitor)    │    │    (Hono)       │            │
│   ├─────────────────┤    ├─────────────────┤    ├─────────────────┤            │
│   │  Framework: Vue │    │  Framework: Vue │    │  Framework: Hono│            │
│   │  Build: Vite    │    │  Build: Vite    │    │  Runtime: Node  │            │
│   │  Platform: Web  │    │  Platform: iOS │    │  Platform:      │            │
│   │                 │    │          /Android│    │  Linux (Railway)│            │
│   │  Stage: Live2D │    │  Stage: Live2D  │    │                 │            │
│   │         /VRM/3D │    │         /VRM/3D │    │  Auth: Better   │            │
│   │                 │    │                 │    │  Auth + OIDC    │            │
│   │  UI: reka-ui    │    │  UI: reka-ui    │    │                 │            │
│   │  + UnoCSS       │    │  + UnoCSS       │    │  DB: PostgreSQL │            │
│   │                 │    │                 │    │  Cache: Redis   │            │
│   │  LLM: xsAI      │    │  LLM: xsAI      │    │                 │            │
│   │  TTS: xsAI      │    │  TTS: xsAI      │    │  WS: WebSocket  │            │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘            │
│            │                        │                       │                     │
│            └────────────────────────┼───────────────────────┘                     │
│                                     │                                             │
│                                     ▼                                             │
│                         ┌───────────────────┐                                     │
│                         │  @proj-airi/*    │                                     │
│                         │  SHARED PACKAGES │                                     │
│                         ├───────────────────┤                                     │
│                         │ stage-ui         │ Live2D/VRM/Spine/Three.js renders  │
│                         │ stage-ui-live2d  │ Live2D scene + Zustand stores       │
│                         │ stage-ui-three   │ R3F 3D scene components            │
│                         │ stage-shared     │ Cross-platform stage contracts       │
│                         │ core-agent       │ Agent orchestration                  │
│                         │ core-character   │ Character definition                 │
│                         │ server-runtime   │ Backend runtime utilities            │
│                         │ server-sdk       │ Backend API client SDK               │
│                         │ plugin-protocol  │ Plugin contract definitions          │
│                         │ plugin-sdk       │ Plugin development kit               │
│                         │ audio            │ Audio pipelines                      │
│                         │ i18n             │ Translations (vue-i18n)              │
│                         │ ui               │ Base UI components (reka-ui)         │
│                         └───────────────────┘                                     │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                    axiom-pet-desktop (separate repo)                     │    │
│   │                    Workspace: pnpm + electron-vite                      │    │
│   │                    Namespace: @axi-pet-desktop/*                        │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                          desktop-pet                                    │    │
│   │                    (Electron + React 19 + R3F)                          │    │
│   ├──────────────────────────────────────────────────────────────────────────┤    │
│   │  Framework: React 19       │  Build: electron-vite + electron-builder │    │
│   │  Renderer: React Three.js  │  Platform: macOS (primary)                │    │
│   │  State: Zustand             │  UI: Radix + UnoCSS + framer-motion       │    │
│   │  Voice: MiniMax API         │  STT: Local (pyenv + whisper MLX)        │    │
│   │  Wake Word: Custom model    │  Entry: Electron main + preload           │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                  axiom-pet-desktop SHARED PACKAGES                      │    │
│   ├──────────────────────────────────────────────────────────────────────────┤    │
│   │  desktop-pet-renderer    │  R3F / VRM rendering                        │    │
│   │  stage-ui-live2d         │  Live2D scene (shared with axiom-pet)        │    │
│   │  ui                      │  Base UI (shared with axiom-pet)              │    │
│   │  core-agent              │  Agent orchestration (shared with axiom-pet) │    │
│   │  electron-screen-capture │  Screen capture for desktop                  │    │
│   │  audio                   │  Audio pipelines (shared with axiom-pet)     │    │
│   │  plugin-protocol         │  Plugin contracts (shared with axiom-pet)    │    │
│   │  server-sdk              │  Backend API client (shared with axiom-pet)   │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Platform Split

| Platform | Repo | App Name | Framework | Build Tool | Target |
|----------|------|----------|-----------|------------|--------|
| Web | axiom-pet | stage-web | Vue 3 | Vite | Browser (PWA) |
| Mobile | axiom-pet | stage-pocket | Vue 3 | Vite + Capacitor | iOS / Android |
| Backend | axiom-pet | server | Hono (Node) | tsc | Railway (Linux) |
| Desktop | axiom-pet-desktop | desktop-pet | React 19 | electron-vite | macOS |

---

## Package Namespace Differences

### axiom-pet (@proj-airi/*)
```json
{
  "@proj-airi/stage-web": "vue-app",
  "@proj-airi/stage-pocket": "capacitor-app",
  "@proj-airi/server": "backend-api",
  "@proj-airi/stage-ui": "shared-ui",
  "@proj-airi/stage-ui-live2d": "live2d-scenes",
  "@proj-airi/core-agent": "agent-core",
  "@proj-airi/server-sdk": "api-client"
}
```

### axiom-pet-desktop (@axi-pet-desktop/*)
```json
{
  "@axi-pet-desktop/desktop-pet": "electron-app",
  "@axi-pet-desktop/desktop-pet-renderer": "r3f-vrm",
  "@axi-pet-desktop/stage-ui-live2d": "live2d-scenes",
  "@axi-pet-desktop/ui": "base-ui"
}
```

**Key Insight**: axiom-pet uses `@proj-airi/*` namespace (upstream heritage from moeru-ai/airi). axiom-pet-desktop uses `@axi-pet-desktop/*` namespace for its packages.

---

## Communication Flows

### Web/Mobile to Backend
```
[stage-web / stage-pocket]
        │
        │  HTTP/REST + WebSocket (ws library)
        ▼
[@proj-airi/server] ────► PostgreSQL + Redis
        │
        │  Pub/Sub (Redis)
        ▼
[WebSocket Broadcast] ────► Other Instances
```

### Desktop to Backend
```
[desktop-pet (Electron)]
        │
        │  HTTP/REST (server-sdk)
        ▼
[@proj-airi/server] ────► PostgreSQL + Redis
```

### Desktop Local Services
```
[desktop-pet]
   ├── Main Process
   │     ├── MiniMax API (cloud TTS/STT)
   │     ├── Local STT (whisper MLX, pyenv)
   │     └── Wake Word Detection (custom model)
   │
   └── Renderer Process (React 19 + R3F)
         ├── VRM Rendering (three.js)
         ├── Live2D Sprite (LayeredPngSprite)
         └── State Management (Zustand)
```

---

## Build Commands

### axiom-pet

```bash
# Web
pnpm -F @proj-airi/stage-web dev        # Development
pnpm -F @proj-airi/stage-web build      # Production build

# Mobile (Capacitor)
pnpm -F @proj-airi/stage-pocket dev:web        # Web preview
pnpm -F @proj-airi/stage-pocket dev:ios        # iOS simulator
pnpm -F @proj-airi/stage-pocket dev:android    # Android emulator

# Backend
pnpm -F @proj-airi/server dev           # Development (dotenvx)
pnpm -F @proj-airi/server build        # Production build
pnpm -F @proj-airi/server start        # Start production server

# Monorepo-wide
pnpm build:packages   # Build all packages
pnpm build:apps      # Build all apps
pnpm typecheck        # TypeScript check
pnpm lint             # ESLint
pnpm test:run         # Run all tests
```

### axiom-pet-desktop

```bash
# Desktop App
pnpm dev              # Development (build:speech + electron-vite dev)
pnpm build            # Production build
pnpm build:mac        # macOS bundle (electron-builder)
pnpm start            # Preview production build

# Desktop Packages
pnpm -F @axi-pet-desktop/desktop-pet typecheck
pnpm -F @axi-pet-desktop/desktop-pet test:run
pnpm -F @axi-pet-desktop/desktop-pet rebuild:mac   # Rebuild native modules

# Voice/Wake Setup
pnpm -F @axi-pet-desktop/desktop-pet setup:stt      # Local STT setup
pnpm -F @axi-pet-desktop/desktop-pet setup:wake    # Wake word model setup
```

---

## Key Files

### axiom-pet

| App/Package | Entry Point | Key Files |
|-------------|-------------|-----------|
| stage-web | `apps/stage-web/` | `vite.config.ts`, `src/main.ts`, `src/App.vue` |
| stage-pocket | `apps/stage-pocket/` | `vite.config.ts`, `src/main.ts`, `capacitor.config.ts` |
| server | `apps/server/` | `src/bin/run.ts`, `src/app.ts`, `src/routes/` |
| stage-ui | `packages/stage-ui/` | `src/components/`, `src/composables/` |
| stage-ui-live2d | `packages/stage-ui-live2d/` | `src/scenes/`, `src/stores/` |

### axiom-pet-desktop

| App/Package | Entry Point | Key Files |
|-------------|-------------|-----------|
| desktop-pet | `apps/desktop-pet/` | `src/main/index.ts`, `src/renderer/index.tsx` |
| desktop-pet-renderer | `packages/desktop-pet-renderer/` | `src/vrm/`, `src/layered-png/` |
| stage-ui-live2d | `packages/stage-ui-live2d/` | `src/scenes/` |

---

## Technology Stack Summary

| Layer | axiom-pet | axiom-pet-desktop |
|-------|-----------|------------------|
| **Frontend Framework** | Vue 3 | React 19 |
| **UI Components** | reka-ui | Radix UI |
| **Styling** | UnoCSS | UnoCSS |
| **3D Rendering** | Three.js + R3F | React Three Fiber |
| **State Management** | Pinia | Zustand |
| **Build Tool** | Vite | electron-vite |
| **Backend Framework** | Hono | N/A (local only) |
| **Database** | PostgreSQL (Railway) | N/A |
| **Cache/PubSub** | Redis | N/A |
| **Authentication** | Better Auth + OIDC | N/A (local STT only) |
| **Voice Provider** | xsAI (cloud) | MiniMax API (cloud) |
| **Packaging** | PWA | electron-builder |

---

## Cross-Platform Shared Code

The two repos share significant code at the package level:

- **stage-ui-live2d**: Live2D scene management (almost identical)
- **ui**: Base UI components
- **core-agent**: Agent orchestration logic
- **plugin-protocol**: Plugin contract definitions
- **server-sdk**: Backend API client
- **audio**: Audio processing pipelines

These packages are forked/duplicated between repos with the namespace being the primary difference (`@proj-airi/*` vs `@axi-pet-desktop/*`).

---

## Architecture Notes

1. **Desktop is fully offline-capable**: desktop-pet uses local whisper MLX for STT and custom wake word detection - no backend dependency for core functionality.

2. **Web/Mobile share the same backend**: Both stage-web and stage-pocket connect to `@proj-airi/server` for authentication, billing (Flux), and real-time chat.

3. **Monorepo boundaries**: axiom-pet is a pnpm turbo monorepo with 46+ packages. axiom-pet-desktop is a lighter monorepo with ~20 packages.

4. **Electron separation**: Desktop was completely migrated out of axiom-pet (2026-07-15 single-runtime migration) to allow independent release cycles and different tech stack (React vs Vue).
