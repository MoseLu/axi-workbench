# Axi Notify Architecture

## 1. Overview

Axi Notify is a mobile notification infrastructure that delivers cloud events to Android devices via Firebase Cloud Messaging (FCM). The system consists of two primary components:

- **Android App** (Kotlin/Jetpack Compose): Receives and displays push notifications
- **Relay Server** (Go/SQLite): Manages device registration, event ingestion, and FCM dispatch

```
axi-workbench/axi-coder → HTTP → Go Relay (SQLite) → FCM → Android
```

## 2. Components

### 2.1 Android App (`android-app/`)

**Technology**: Kotlin + Jetpack Compose + Firebase Messaging

**Package**: `com.mosscoder.notify` (migration to `com.axi.notify` pending)

**Key Packages**:
- `com.mosscoder.notify.fcm` - FCM token management and message handling
- `com.mosscoder.notify.data` - Local storage and repository layer
- `com.mosscoder.notify.feature.*` - UI screens and navigation
- `com.mosscoder.notify.ui.shell` - Compose host shell
- `com.mosscoder.notify.rn.*` - React Native Hermes engine integration
- `com.mosscoder.notify.ui.theme` - Material 3 theming with design tokens

**RN Bundle Support**: The app supports hot-updatable React Native bundles via `MossReactNativeHost`, loading from either:
1. `filesDir/bundles/active.android.bundle` (runtime下发)
2. `assets/rn/preset/index.android.bundle` (内置预设)

### 2.2 Relay Server (`relay-server/`)

**Technology**: Go + SQLite + Firebase Admin SDK

**Entry Point**: `relay-server/main.go`

**Internal Packages**:
- `internal/server` - HTTP server with rate limiting and API key auth
- `internal/relay` - Event processing and FCM dispatch logic
- `internal/store` - SQLite persistence for devices and events

**Database Schema**:
- `devices` - Device registrations with FCM tokens, workspaceId, projectIds
- `events` - Event records with idempotencyKey for deduplication

## 3. Architecture Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ axiom-workbench │     │  Relay Server   │     │  Firebase FCM   │
│  (Event Source) │────▶│   (Go+SQLite)   │────▶│  (Cloud Push)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Android App    │
                                                │  (Kotlin+Compose)│
                                                └─────────────────┘
```

**Message Flow**:
1. Downstream services (axi-workbench, axi-coder) POST events to Relay
2. Relay validates API key (`X-Axi-Notify-Api-Key` or legacy `X-Mosscoder-Api-Key`)
3. Relay checks idempotencyKey in SQLite to prevent duplicates
4. Relay uses Firebase Admin SDK to send data messages to registered devices
5. Android app receives FCM message and displays notification

## 4. Key Features

### 4.1 Multi-tenant Device Registration

Devices register via `PUT /v1/devices` with:
- `workspaceId` - Tenant isolation
- `projectIds` - Subscribe to specific project notifications
- `fcmToken` - Firebase Cloud Messaging token
- `platform`, `deviceId`, `label` - Device metadata

### 4.2 Idempotency

Events include an `idempotencyKey` stored in SQLite. Duplicate keys within the retention window return success without re-sending to FCM.

### 4.3 Rate Limiting

Per-host rate limiting: 25 events/second with burst of 50 (configurable via `EventsPerSecondPerHost` / `EventsBurstPerHost`).

### 4.4 FCM Data Messages

Relay sends data-only messages (no notification payload) to maintain:
- App control over UI presentation
- Consistent appearance with design tokens
- Badge/counter management via `mosscoder_badge_v2` channel

### 4.5 Event Retention

Configurable event retention (default: no pruning, `AXI_NOTIFY_EVENT_RETENTION_DAYS=0` disables).

## 5. Tech Stack

| Component | Technology | Version/Notes |
|-----------|------------|---------------|
| Android | Kotlin | 1.9+ |
| Android UI | Jetpack Compose | Material 3 |
| Android Push | Firebase Messaging | HMS optional |
| React Native | Hermes Engine | Hot-updatable bundles |
| Relay Language | Go | 1.21+ |
| Relay DB | SQLite | mattn/go-sqlite3 |
| Relay Push | Firebase Admin SDK | google.golang.org/api |
| API Spec | OpenAPI 3.1 YAML | `docs/workflows/events.openapi.yaml` |
| Design Tokens | JSON | `docs/workflows/design_tokens.json` |

## 6. Build Commands

### Android App

```bash
# Generate local.properties (required before gradle)
./scripts/write-android-local-properties.sh

# Debug build
make android-debug
# or: cd android-app && ./gradlew :app:assembleDebug

# Lint
make android-lint
# or: cd android-app && ./gradlew :app:lint

# Agent verify (assembleDebug + adb check if device online)
make android-agent-verify
```

**Prerequisites**:
- `ANDROID_HOME` environment variable set
- `google-services.json` in `android-app/app/` (override stub)
- Gradle proxy settings in `android-app/gradle.properties` (comment out if no proxy)

### Relay Server

```bash
# Run tests
make test-relay
# or: cd relay-server && go test ./...

# Local smoke test (random port + temp DB)
make smoke-relay-local

# Run locally (development)
export MOSS_RELAY_API_KEY="dev-only-key"
export AXI_NOTIFY_API_KEY="$MOSS_RELAY_API_KEY"
export MOSS_RELAY_NO_FIREBASE=1  # skip Firebase for local dev
unset GOOGLE_APPLICATION_CREDENTIALS
cd relay-server && go run ./main.go

# Production run
export AXI_NOTIFY_API_KEY="your-key"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-admin.json"
cd relay-server && go run ./main.go
```

**Environment Variables**:
| Variable | Description | Required |
|----------|-------------|----------|
| `AXI_NOTIFY_API_KEY` | API authentication key | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Firebase Admin JSON path | Yes (unless NO_FIREBASE=1) |
| `AXI_NOTIFY_NO_FIREBASE` | Skip Firebase for local dev | No |
| `AXI_NOTIFY_LISTEN` | Listen address (default :8080) | No |
| `AXI_NOTIFY_DB` | SQLite DSN | No |
| `AXI_NOTIFY_EVENT_RETENTION_DAYS` | Event retention (0=infinite) | No |

Legacy variable names (`MOSS_RELAY_*`) are supported for backward compatibility.

## 7. Why Separate from axiom-workbench

| Dimension | axiom-notify | axiom-workbench |
|-----------|--------------|-----------------|
| **Language Runtime** | Go (compiled, single-binary) | Node.js (JavaScript) |
| **Mobile Focus** | Kotlin/Android + Firebase | Web/CLI primary |
| **Domain** | Push notification delivery | General API & workflow orchestration |
| **Scaling Profile** | Stateless relay (horizontal scaling ready) | Stateful API server |
| **Dependency** | Firebase Admin SDK | axiom-workbench is a consumer, not a dependency |

Separation allows independent deployment and scaling of the notification pipeline without coupling to the workbench's release cycle. The relay server's simple Go runtime also provides better cold-start performance for FCM dispatch compared to a Node.js service.
