# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Documentation (自动发现)

This project uses a layered documentation architecture created by `/deepinit`. Claude Code should automatically discover and read these files:

**Discovery order:**
1. Read `AGENTS.md` in the current directory and parent directories — these contain AI guidance for each module
2. Read `TODO.md` to understand current tasks and priorities
3. Read `MILESTONE.md` to understand version roadmap and project status

**Documentation layers:**

| Layer | Location | Documents | Scope |
|-------|----------|-----------|-------|
| L2 | Project root | `AGENTS.md`, `TODO.md`, `MILESTONE.md` | Whole project |
| L3 | `backend/`, `frontend/` | `AGENTS.md`, `TODO.md`, `MILESTONE.md` | Independent modules |
| L4+ | Subdirectories | `AGENTS.md` | Inherits parent TODO/MILESTONE |

**Traceability:** `MILESTONE.md` → `TODO.md` → `AGENTS.md` → source files

## Build Commands

**Full build (all platforms):**
```bash
build_all.bat
```
Builds backend exe, React web bundle, Control Electron app, Display Electron app, and Android APK.

**Individual builds:**
```bash
# Backend (Python → exe)
cd backend
pyinstaller sop_server.spec

# Frontend web bundle
cd frontend
pnpm build                      # Web bundle → frontend/build/
pnpm build:control              # Control variant
pnpm build:display              # Display variant

# Electron desktop apps
cd frontend/control
pnpm build                      # Control Electron app → frontend/control/dist/

cd frontend/display
pnpm build                      # Display Electron app → frontend/display/dist/
pnpm exec cap sync android      # Sync Capacitor for Android
cd android && ./gradlew assembleDebug  # Build APK
```

## Architecture

**Backend (Python Flask):**
- Entry: `backend/server.py` (Flask app on port 8765)
- API routes: `backend/api.py` (documents, devices, search, health)
- Auth: `backend/auth.py` (JWT authentication, password management)
- Database: `backend/models.py` (SQLAlchemy models: Document, Job, Device, User)
- Device management: `backend/device_manager.py` (registration, heartbeat, OTA push, test device cleanup)
- Vector search: `backend/chroma/` (ChromaDB for semantic SOP search)
- Data storage: `backend/data/sop.db` (SQLite), `backend/data/pdf_images/`, `backend/data/chroma_db/`

**Frontend (React + Multi-platform):**
- Shared codebase with two entry points:
  - `frontend/src/control/` — Admin control panel (device management, SOP search)
  - `frontend/src/display/` — Device display app (SOP viewing on tablets/phones)
- Shared components: `frontend/src/shared/` (reusable UI components, hooks)
- API layer: `frontend/src/services/` (HTTP client for backend API)
- Platforms:
  - Web: `pnpm build` → `frontend/build/`
  - Electron desktop: `frontend/control/` and `frontend/display/` (separate Electron apps)
  - Android: Capacitor in `frontend/display/android/`

**OTA Update Flow:**
1. Build frontend: `pnpm build` → `frontend/build/`
2. Publish bundle: `python backend/publish_bundle.py` → `backend/bundle_updates/bundle.zip`
3. Backend broadcasts to online devices → devices download and auto-update

## Development Workflow

**Backend development:**
```bash
cd backend
python server.py                # Start Flask dev server on http://localhost:8765
# Or with auto-reload:
# python -c "from server import app; from werkzeug.serving import run_simple; run_simple('0.0.0.0', 8765, app, use_reloader=True)"
```

**Frontend development:**
```bash
cd frontend
pnpm start                      # React dev server on http://localhost:3000
```

**Testing APIs:**
```bash
# Health check
curl -X POST http://localhost:8765/api/health

# Login (get JWT token)
curl -X POST http://localhost:8765/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Device list (authenticated)
curl -X GET http://localhost:8765/api/devices \
  -H "Authorization: Bearer <token>"

# Cleanup test devices
curl -X POST http://localhost:8765/api/devices/cleanup-test \
  -H "Authorization: Bearer <token>"
```

## Key Technical Details

**Authentication:**
- JWT tokens for all API endpoints except `/api/auth/login` and `/api/health`
- Default admin credentials created on first run: `admin` / (random 16-char password, see console output)
- Password change required on first login (`must_change_password` field in User model)

**Device Management:**
- Devices register via UUID, report heartbeat every 2 minutes
- Backend marks devices offline if no heartbeat for 5 minutes (configurable)
- Test devices (random UUID format) can be cleaned up via `/api/devices/cleanup-test`
- Old offline devices cleaned via `/api/devices/cleanup-old?days=30`

**Vector Search (ChromaDB):**
- SOP documents embedded and stored in ChromaDB
- Sync PDFs to vector DB: `python backend/sync_sop.py`
- Build embeddings: `python backend/build_embedding.py` (or parallel: `python backend/build_parallel.py`)

**Static Resources:**
- SOP PDFs and images stored in `asserts/` directory
- Organized by product line (PA组件包装SOP/, 成品包装SOP/, 装配SOP/, etc.)
- Synced to backend via `sync_sop.py`

## Git Workflow

Branch naming: `feature/<name>` (default), `fix-debug/<name>`, `hotfix/<name>`, `release/<name>`
Main branches: `main` (production), `dev` (development)

Auto git-session-hook runs on session start:
- Creates feature branch if working on main/master
- Prompts to create PR if large changes (>2000 lines)
- Reminds of unmerged PRs

Commands: `/github-init`, `/create-pr`
