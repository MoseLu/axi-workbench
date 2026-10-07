---
id: axi-docs-en-projects-voice-assistant-on-device-speech-recognition
title: VoiceAssistant — on-device voice loop prototype
type: project
status: published
tags: [Axi Docs, Projects, candidates, voice, on-device, asr, sherpa-onnx, miniMax]
created: 2026-10-07
modified: 2026-10-07
graph-title: Voice Assistant (on-device ASR)
graph-tags: [Projects, candidates, voice, on-device, asr]
description: On-device Android voice loop prototype (sherpa-onnx streaming ASR + MiniMax chat) plus a macOS DesktopAssistant Swift package that hosts the same engine via Xcode frameworks. Registered under candidates/ pending project-maturity-v1.
project:
  id: voice-assistant-on-device-speech-recognition
  partition: candidates
  path: /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition
  source-section: core
---

# VoiceAssistant — on-device voice loop prototype

> Mirror of the project root `README.md` plus deep dives into the
> sherpa-onnx streaming pipeline, the ChatEngine contract, the
> Mac-side TTS proxy, and the new macOS `DesktopAssistant` Swift
> package. Source of truth:
> [`/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md).
> Section: core / Partition: `candidates/`.

## Summary

VoiceAssistant is a paused-prototype incubation project that validates
whether a fully on-device voice loop (streaming Chinese ASR + local
reply model + locally served TTS) can be useful on Android. It carries
two distinct runtime surfaces: an **Android app** (`app/`, Kotlin +
Jetpack Compose) and a **macOS desktop assistant** (`macos/desktop-assistant/`,
Swift Package + SherpaOnnxC + ONNXRuntime frameworks). The Android app
bundles the streaming sherpa-onnx transducer (encoder/decoder/joiner
int8 ONNX) and the `tokens.txt` vocabulary, captures 16 kHz mono PCM,
and feeds it to a streaming `OnlineRecognizer`. The chat layer is
abstracted behind a `ChatEngine` contract so that a real on-device LLM
is a single-file drop-in replacement for `StubChatEngine`.

The current default engine is `MiniMaxChatEngine`, which hits the
MiniMax `/v1/text/chatcompletion_v2` endpoint with a system prompt that
caps reply length to ≤40 Chinese characters (with a `MAX_REPLY_CHARS`
client-side safety net). Synthesis stays on a Mac-side proxy
(`tools/tts-proxy/tts_proxy.py`) that wraps the local
`/Users/mose/.cc-connect/bin/minimax-tokenplan speech` CLI; the app
reaches the proxy via `adb reverse tcp:8090 tcp:8090`. The repo was
moved out of `products/` on 2026-09-25 (product placement requires an
accepted project-maturity-v1 record) and is registered in
`candidates/` with a `incubation.json` record and a `2026-10-18`
reviewBy.

Latest status (2026-09-18 baseline measurements on Xiaomi M2012K10C /
Android 13 / API 33 debug build): ASR median **755 ms** over 10 runs
on 5.2–5.6 s utterances (RTF ≈ 0.14, numThreads=2, zipformer int8);
reply median **3 ms** with `StubChatEngine`; first-audio median
**2,170 ms** (entirely synthesis); full loop speech end → first audio
median **2,652 ms**; peak TOTAL PSS **360.7 MiB** with the recogniser
resident (native heap 263.1 MiB). The decision of 2026-09-18 is that
synthesis stays on the cloud-backed proxy (annual subscription, zero
marginal cost) and PRD acceptance criterion 1 (airplane-mode turn) is
permanently unachievable as written.

**Stage**: prototype (`stage=candidate`, `intent=prototype`,
`reviewBy=2026-10-18`).
**Canonical path**: `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition`.

## Stack

| Surface | Tech | Notes |
| --- | --- | --- |
| Android app | Kotlin 2.0.21 + AGP 8.7.3 + Jetpack Compose (BOM 2024.12.01) | `app/`, `compileSdk=35`, `minSdk=23`, `targetSdk=35`; `arm64-v8a` + `x86_64` ABIs |
| ASR runtime | `sherpa-onnx 1.13.8` AAR (`app/libs/sherpa-onnx-1.13.8.aar`, 48 MB) + int8 zipformer (encoder 173 MB, decoder 12 MB, joiner 3.2 MB) + `tokens.txt` (~189 MB total bundled under `assets/streaming/`) | `.onnx` files excluded from git via `.gitignore` (GitHub 100 MB/file limit); `tokens.txt` tracked |
| Chat | OkHttp 4.12.0 → MiniMax `/v1/text/chatcompletion_v2` (`MiniMaxChatEngine.kt`) + `StubChatEngine` rule-based stand-in (`ChatEngine.kt`) | API key from `local.properties` via `BuildConfig` (`MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`) |
| TTS | HTTP POST to `http://localhost:8090/tts` (`TtsEngine.kt`); proxy runs on the Mac | `voice_id=female-shaonv`; `adb reverse tcp:8090 tcp:8090` |
| UI | Single-activity Jetpack Compose chat surface: avatar, chat bubbles, WeChat-style `InputBar`, debug panel (`MainActivity.kt` + `InputBar.kt`) | Audio capture via `AudioRecord` at `SAMPLE_RATE=16_000`, max 30 s |
| macOS desktop assistant | Swift Package (`Package.swift`, `swift-tools-version: 6.0`) targeting `macOS(.v14)` | Uses vendored `Vendor/sherpa-onnx.xcframework` + `Vendor/onnxruntime.xcframework` + `Vendor/Swift` wrappers; produces `DesktopAssistant`, `DesktopAssistantCoreCheck`, `DesktopAssistantASRCheck` executables |
| Mac voice loop | Local two-pass Paraformer Chinese ASR (replaced sherpa-onnx ASR on macOS) | See git log: `feat(voice): replace macOS ASR with local two-pass Paraformer`, `feat(voice-assistant): use local Chinese Paraformer ASR` |
| TTS proxy | Python 3 stdlib `http.server` + `ThreadingHTTPServer` (`tools/tts-proxy/tts_proxy.py`) | Wraps `minimax-tokenplan speech` CLI under a `threading.Lock`; binds 0.0.0.0, defaults port 8080, `--voice` configurable |
| Toolchain | JDK 17 + Temurin 21; Gradle; AGP 8.7.3; Android SDK 35 | `local.properties` provides Android SDK + MiniMax secrets |
| Evidence | `evidence/measurements.md`, `evidence/decision-brief.md`, `evidence/offline-turn.md`, `evidence/raw/logcat-*.txt` | All evidence dated 2026-09-18 |

## Project Layout

```text
candidates/voice-assistant-on-device-speech-recognition/
├── app/                              ★ Android voice loop
│   ├── build.gradle.kts              # namespace com.mose.voiceassistant, compileSdk=35, minSdk=23
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── assets/
│   │   │   ├── streaming/            # encoder-epoch-99-avg-1.int8.onnx (173 MB, gitignored),
│   │   │   │                         # decoder-epoch-99-avg-1.int8.onnx (12 MB, gitignored),
│   │   │   │                         # joiner-epoch-99-avg-1.int8.onnx (3.2 MB, gitignored),
│   │   │   │                         # tokens.txt (~tracked)
│   │   │   ├── test/                 # zh_0.wav, zh_1.wav (ASR fixtures)
│   │   │   └── avatar/               # ai_avatar.png
│   │   ├── java/com/mose/voiceassistant/
│   │   │   ├── MainActivity.kt       # Compose entry; AudioRecord + OnlineRecognizer lifecycle; Phase state machine
│   │   │   ├── InputBar.kt           # WeChat-style composer (voice/keyboard toggle, emoji + more panels)
│   │   │   ├── ChatEngine.kt         # reply contract + ChatTurn data class + StubChatEngine (rule-based greetings/time/date)
│   │   │   ├── MiniMaxChatEngine.kt  # OkHttp + MiniMax /v1/text/chatcompletion_v2; ≤40 char reply cap
│   │   │   └── TtsEngine.kt          # HTTP POST http://localhost:8090/tts; MediaPlayer playback
│   │   └── res/
│   ├── libs/sherpa-onnx-1.13.8.aar   # 48 MB (gitignored)
│   └── src/main/res/network_security_config.xml  # cleartext to localhost only
├── macos/desktop-assistant/           ★ macOS DesktopAssistant Swift package
│   ├── Package.swift                 # swift-tools-version: 6.0; macOS(.v14)
│   ├── Sources/
│   │   ├── DesktopAssistant/         # Swift app entry
│   │   ├── DesktopAssistantCore/     # business core (MiniMax proxy, decision router, quota panel, assistant answer client)
│   │   │   ├── AppDelegate.swift, ApplicationCatalog.swift
│   │   │   ├── AssistantAnswerClient.swift, CCSwitchCredentialReader.swift, DecisionRouter.swift
│   │   │   ├── DesktopTaskExecutor.swift, HTTPProxyProtocol.swift
│   │   │   ├── MiniMaxProxyConfiguration.swift, MiniMaxProxyServer.swift
│   │   │   ├── QuotaPanelController.swift, VoiceAssistantController.swift
│   │   ├── DesktopAssistantASRCheck/ # standalone ASR verification executable
│   │   └── DesktopAssistantCoreCheck/# standalone core verification executable
│   ├── Vendor/                       # sherpa-onnx.xcframework, onnxruntime.xcframework, Swift wrappers
│   ├── Resources/, Tests/, build/
│   ├── scripts/                      # build-app.sh, install.sh, uninstall.sh, run.sh,
│   │                                 # prepare-asr-models.sh, prepare-asr-runtime.sh, install-agentjev.sh
│   └── README.md
├── tools/tts-proxy/                  ★ local Mac-side HTTP TTS proxy
│   └── tts_proxy.py                  # BaseHTTPRequestHandler + ThreadingHTTPServer
├── evidence/                         ★ measurements + decision trail (2026-09-18)
│   ├── measurements.md               # per-stage latency + peak PSS table
│   ├── decision-brief.md             # "synthesis stays on Mac-side proxy" decision rationale
│   ├── offline-turn.md
│   └── raw/logcat-latency-2026-09-18.txt, logcat-first-audio-2026-09-18.txt
├── build.gradle.kts, settings.gradle.kts, gradle.properties, gradle/libs.versions.toml
├── gradlew, gradlew.bat, gradle/
├── local.properties                  # Android SDK + MiniMax secrets (gitignored)
├── .gitattributes, .gitignore, .githooks, .auditignore
├── .omo/, .workbuddy-ai/             # agent scratch dirs (gitignored)
├── AGENTS.md, README.md, README.zh-CN.md, IDEA.md, DESIGN.md, PRD.md, TASK.md, TODO.md
├── MILESTONE.md, VERIFICATION.md, CHANGELOG.md
├── incubation.json                   # machine-readable record (schemaVersion=1)
└── docs/                             # ancillary docs
```

Do not split `app/` or `macos/desktop-assistant/` into separate
repositories until promotion. Large ONNX binaries must never be
committed; the repo is intentionally source-only.

## Build

```bash
# Android (requires Android SDK via local.properties, JDK 17+ / Temurin 21)
cd /Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8090 tcp:8090          # reach the Mac-side TTS proxy

# Restore gitignored assets first (encoder-epoch-99-avg-1.int8.onnx,
# decoder-epoch-99-avg-1.int8.onnx, joiner-epoch-99-avg-1.int8.onnx,
# app/libs/sherpa-onnx-1.13.8.aar) from an existing working copy.

# macOS desktop assistant
cd macos/desktop-assistant
swift build -c debug --product DesktopAssistant
swift run -c release DesktopAssistantCoreCheck
swift run -c release DesktopAssistantASRCheck /tmp/axi-voice-asr-benchmark/user-test.wav
./scripts/install.sh
launchctl print-disabled gui/$(id -u) | grep desktop-assistant
```

## Verification

```bash
# Build surface
./gradlew :app:assembleDebug --dry-run
test -d app/src/main/assets/streaming && test -d app/src/main/assets/test

# Android tests
./gradlew :app:test

# Manual smoke (per VERIFICATION.md)
# 1. boot device, grant mic permission
# 2. speak a Chinese utterance
# 3. confirm reply and TTS playback
# 4. (optional) run fixtures from assets/test/zh_0.wav and zh_1.wav via the
#    document picker; DebugPanel confirms transcripts through the same OnlineRecognizer

# macOS verification (per VERIFICATION.md)
cd macos/desktop-assistant
./scripts/prepare-asr-runtime.sh
./scripts/prepare-asr-models.sh
swift run -c release DesktopAssistantASRCheck /tmp/axi-voice-asr-benchmark/user-test.wav
./scripts/build-app.sh
./scripts/install.sh

# Workspace governance
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs validate
node /Volumes/code/workspace/foundation/workspace-governance/scripts/workspace-project-cli.mjs handoff-check voice-assistant-on-device-speech-recognition
```

Last verified 2026-09-25 (status: prototype validation in progress).

## Architecture Highlights

The project is organised around three load-bearing seams, and each seam
is explicit in the source so the next iteration can change one without
breaking the others.

The first seam is the `ChatEngine` contract
(`app/src/main/java/com/mose/voiceassistant/ChatEngine.kt`). It is a
single suspend method — `reply(history: List<ChatTurn>, userText:
String): String` — plus a `ChatTurn` data class with `role`, `text`,
`timestampMs`, and `isPartial` fields. The interface comment is
deliberately written to constrain the model that plugs in: it documents
that every reply will be sent to synthesis and therefore spoken aloud,
so reply length is a product constraint. Two implementations exist:
`StubChatEngine` (rule-based greetings/time/date/self-description,
reply capped at <28 chars) and `MiniMaxChatEngine`
(`MiniMaxChatEngine.kt`, OkHttp POST to `/v1/text/chatcompletion_v2`
with a system prompt that caps reply length to ≤40 Chinese characters
plus a client-side `MAX_REPLY_CHARS` safety net). The comment on
`ChatEngine` makes the constraint explicit: an earlier revision of the
stub produced 100+ character replies (~24 s spoken) and any on-device
model must respect the same limit.

The second seam is the streaming ASR pipeline
(`app/src/main/java/com/mose/voiceassistant/MainActivity.kt`). The
`Phase` state machine is `Idle → Recording → Recognizing`; audio
capture uses `AudioRecord` at `SAMPLE_RATE=16_000` Hz mono PCM,
max 30 seconds. The recognizer is `com.k2fsa.sherpa.onnx.OnlineRecognizer`
configured with `OnlineTransducerModelConfig` (zipformer int8); partial
decoding runs on a `Dispatchers.IO` coroutine that polls every 80 ms
and pushes partial transcripts via `MutableStateFlow`. A 2026-09-18
fix gated asset extraction on a completion marker plus a staged-then-
renamed copy (previously the ~189 MB of int8 ONNX weights were
re-copied on every cold start because `ensureAssetFile` only reused
files ending in `.txt`). The `extractAssetsIfNeeded` cycle verified
on device: 4 extractions after `pm clear`, 0 on the following launch.
ASR fixtures (`assets/test/zh_0.wav`, `zh_1.wav`) plus a document
picker path allow validation without a microphone; both fixtures now
produce transcripts through the same `OnlineRecognizer` the microphone
uses (an earlier bug had `runWavFromAssets` only logging a sample
count).

The third seam is the TTS proxy (`tools/tts-proxy/tts_proxy.py`).
The Android app posts `{text, voice_id}` to `http://localhost:8090/tts`
(reached via `adb reverse tcp:8090 tcp:8090`); the proxy serialises
`minimax-tokenplan speech --text ... --voice-id ...` calls behind a
`threading.Lock`, reads the resulting MP3 from disk, and streams the
bytes back. It pins the child process working directory to `/tmp`
because a trashed temp dir would otherwise kill every call with
"Current directory does not exist". A 2026-09-18 quota investigation
recorded in `evidence/decision-brief.md` showed the MiniMax general
pool (text + image + speech share one pool) at 0% remaining in its
5-hour window with status 2, while its weekly window sat at 100%; the
synthesis call path remains billable per-character with one Chinese
character counting as two. That decision — keep synthesis on the
Mac-side proxy — is what froze the architectural shape.

The macOS surface (`macos/desktop-assistant/`) is a separate Swift
Package that shares the same engine approach via vendored
`sherpa-onnx.xcframework` + `onnxruntime.xcframework`. The recent
git log shows the macOS voice loop was replaced with **local two-pass
Paraformer Chinese ASR** (`feat(voice): replace macOS ASR with local
two-pass Paraformer`), distinct from the Android app which still uses
sherpa-onnx streaming transducer. The macOS app exposes
`AssistantAnswerClient`, `DecisionRouter`, `DesktopTaskExecutor`,
`MiniMaxProxyServer`, and `VoiceAssistantController` modules plus a
`QuotaPanelController` for the MiniMax subscription status panel.
Three verification executables are produced: `DesktopAssistant`,
`DesktopAssistantCoreCheck`, and `DesktopAssistantASRCheck`. The
VERIFICATION.md macOS section notes the app remains disabled during
the voice-loop replacement; the previous ASRCheck fix matched
expected fixture text `糖豆糖豆打开壁纸预览搜索美女图片` against
the installed Swift runtime, but live microphone-to-floating-to-agent
TTS remains unverified while the launch agent is disabled.

## Key Modules/Files

| Path | Role |
| --- | --- |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/AGENTS.md` | Read order, package manager rule, runtime boundaries (Android `app/`, Mac `macos/desktop-assistant/`, models under `assets/`, Python tooling under `tools/`), request defaults (no cloud ASR/account sync/external TTS without scope change), verification |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md` | Primary entrypoint; layer table; private repo `https://github.com/MoseLu/axi-assistant-voice`; `dev`/`main` branch policy; large-binaries gitignore + restore matrix |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/IDEA.md` | Hypothesis (`local voice loop on Android`), narrowed 2026-09-18 (synthesis stays on cloud proxy), unknowns, smallest validation, **baseline result table** (ASR 755 ms, first-audio 2,171 ms, PSS 360.7 MiB) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/PRD.md` | Goal, users (single operator, owner device, Chinese), requirements, unknowns (latency budget, TTS proxy permanence, `minSdk 23` realism, owning boundary), acceptance criteria 1 (airplane-mode turn — **unreachable by decision**), 2 (measurement table — satisfied), 3 (named accepting owner — open) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/DESIGN.md` | Approach (freeze the seam, reply first / synthesis last, measure before optimising), reuse table, evidence plan, disposal/promotion policy |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/incubation.json` | Machine-readable record: `stage=prototype`, `intent=prototype`, `domain=voice-assistant`, `capability=on-device-speech-recognition`, `owner=libu`, `reviewBy=2026-10-18`, `promotionCriteria` (3), `projectBoundaries={runtime:false,release:false,data:false,permission:false}`, full evidence entries (asset extraction fix, history fix, wav fixture fix, ASR/reply/loop/PSS measurements, MiniMax quota investigation, decision, length-constraint redesign) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/src/main/java/com/mose/voiceassistant/MainActivity.kt` | Compose entry; audio capture (`AudioRecord` 16 kHz mono PCM, max 30 s); recognizer lifecycle; partial transcript state; WeChat-style `InputBar` state; `MiniMaxChatEngine()` default; `invokeAssistant()` orchestrator (fixed 2026-09-18 to actually pass `engine.reply(history, text)` and the real conversation history) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/src/main/java/com/mose/voiceassistant/ChatEngine.kt` | `interface ChatEngine` + `data class ChatTurn`; written constraint that every reply is synthesized, so length is a product constraint; `StubChatEngine` rule-based greetings/time/date/self-description (capped at <28 chars) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/src/main/java/com/mose/voiceassistant/MiniMaxChatEngine.kt` | OkHttp client; `MINIMAX_BASE_URL/v1/text/chatcompletion_v2`; `Bearer ${BuildConfig.MINIMAX_API_KEY}`; ≤40-char reply cap with `MAX_REPLY_CHARS` safety net; network-error fallback strings |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/src/main/java/com/mose/voiceassistant/TtsEngine.kt` | HTTP POST `http://localhost:8090/tts` (`voice_id=female-shaonv`); saves MP3 into `filesDir/tts_reply_<ts>.mp3`; `MediaPlayer` playback via `TtsPlayer` (stop previous, prepare, start, completion/error listeners) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/src/main/java/com/mose/voiceassistant/InputBar.kt` | WeChat-style composer; `WxIconColor`/`WxFieldBg`/`WxSendGreen` constants; voice/keyboard toggle; emoji + more panels |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/build.gradle.kts` | `namespace=com.mose.voiceassistant`, `compileSdk=35`, `minSdk=23`, `targetSdk=35`; abiFilters `arm64-v8a` + `x86_64`; `BuildConfig` fields from `local.properties`; JNI `.so` uncompressed; `sherpa-onnx-1.13.8.aar` from `libs/`; `okhttp` 4.12.0 |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/gradle/libs.versions.toml` | AGP 8.7.3, Kotlin 2.0.21, Compose BOM 2024.12.01, OkHttp 4.12.0 |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/macos/desktop-assistant/Package.swift` | `swift-tools-version: 6.0`, `macOS(.v14)`; products `DesktopAssistant` + `DesktopAssistantASRCheck`; `SherpaOnnxC` + `ONNXRuntime` binary targets from `Vendor/*.xcframework`; `SherpaOnnx` Swift wrapper target |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/macos/desktop-assistant/Sources/DesktopAssistantCore/` | `AppDelegate`, `ApplicationCatalog`, `AssistantAnswerClient`, `CCSwitchCredentialReader`, `DecisionRouter`, `DesktopTaskExecutor`, `HTTPProxyProtocol`, `MiniMaxProxyConfiguration`, `MiniMaxProxyServer`, `QuotaPanelController`, `VoiceAssistantController` |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/macos/desktop-assistant/scripts/` | `build-app.sh`, `install.sh`, `uninstall.sh`, `run.sh`, `prepare-asr-models.sh`, `prepare-asr-runtime.sh`, `install-agentjev.sh` |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/tools/tts-proxy/tts_proxy.py` | `BaseHTTPRequestHandler` + `ThreadingHTTPServer`; `POST /tts` → `minimax-tokenplan speech`; `GET /health`; serialised via `threading.Lock`; pinned `WORKDIR=/tmp`; reads `text`/`voice_id`, defaults `voice_id=female-shaonv`; `--port` defaults 8080 |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/evidence/measurements.md` | Per-stage latency table: ASR median 755 ms (RTF ≈ 0.14), reply 3 ms (StubChatEngine), first-audio 2170 ms, full loop 2652 ms, peak PSS 360.7 MiB (native 263.1 MiB); Xiaomi M2012K10C (ares), Android 13 / API 33, debug build |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/evidence/decision-brief.md` | Quota investigation + synthesis-stays-on-proxy decision (annual subscription, ~116 MB APK + 60-130 MiB resident cost of on-device TTS ruled out) |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/evidence/offline-turn.md` | Why the screen recording of a complete offline turn does not exist and, under the decision, cannot |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/evidence/raw/logcat-latency-2026-09-18.txt`, `logcat-first-audio-2026-09-18.txt` | Raw logcat captures for the baseline measurements |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/VERIFICATION.md` | macOS desktop-assistant rename + voice-loop replacement commands; Android `assembleDebug --dry-run` smoke |
| `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/MILESTONE.md` | M1 handoff-check, M2 PRD contentisation, M3 next lifecycle stage |

## Milestone Status

| Stage | Goal | Status |
| --- | --- | --- |
| M1 | Handoff-check closed | Active (handoff-check `verified` recorded 2026-09-25) |
| M2 | PRD enters real content (replace stub) | Pending (current `PRD.md` already replaced with real content, but milestone gate not flipped) |
| M3 | Next lifecycle stage based on `stage=candidate` | Pending (depends on owner decision after `2026-10-18` review window) |
| Promotion gate 1 | Real on-device model replaces `StubChatEngine`; end-to-end speech-end → first-audio measured on a physical device | Open (StubChatEngine replaced by `MiniMaxChatEngine`, but that is remote, not on-device) |
| Promotion gate 2 | Loop runs with no developer-machine proxy in the path, or residual dependency accepted by a named owner | Open (`adb reverse` + Mac-side TTS proxy still in path; criterion 3 needs the accepting owner named) |
| Promotion gate 3 | Owning boundary (host / provider / project) accepts the promoted runtime | Open (`Which existing workspace provider or experiment host, if any, should own the promoted runtime?`) |

## Notes

- The PRD acceptance criterion 1 (airplane-mode turn) is permanently unachievable as written per the 2026-09-18 decision; restoring it requires either inverting the synthesis decision or restating the criterion. Per the PRD itself, this is an owner call.
- The macOS `DesktopAssistant` surface is functionally distinct from the Android app (separate ASR: local two-pass Paraformer vs sherpa-onnx streaming transducer), and is currently disabled during voice-loop replacement. Do not treat the two surfaces as interchangeable.
- The repo URL `https://github.com/MoseLu/axi-assistant-voice` (private) is the only branch pair (`dev` default, `main` release); do not create additional long-lived branches without owner approval.
- The Mac-side TTS proxy is a downstream consumer of `/Users/mose/.cc-connect/bin/minimax-tokenplan` and inherits its quota behaviour.

## Authoritative Documents

- [`AGENTS.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/AGENTS.md) — read order, boundaries, request defaults, verification
- [`README.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md) — primary English entrypoint
- [`README.zh-CN.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.zh-CN.md) — Simplified Chinese mirror
- [`IDEA.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/IDEA.md) — hypothesis, narrowed 2026-09-18, baseline result table
- [`PRD.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/PRD.md) — goal, users, requirements, unknowns, acceptance criteria (1 unreachable by decision, 2 satisfied, 3 needs owner), non-goals
- [`DESIGN.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/DESIGN.md) — approach, reuse, evidence plan, disposal/promotion
- [`TASK.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/TASK.md) — open validation tasks
- [`TODO.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/TODO.md) — task tracker
- [`MILESTONE.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/MILESTONE.md) — M1/M2/M3 milestone plan with evidence requirements
- [`VERIFICATION.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/VERIFICATION.md) — verification commands + last-known status
- [`CHANGELOG.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/CHANGELOG.md) — Keep-a-Changelog stub
- [`incubation.json`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/incubation.json) — machine-readable incubation record (schemaVersion 1)
- [`app/build.gradle.kts`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/app/build.gradle.kts) + [`gradle/libs.versions.toml`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/gradle/libs.versions.toml) — Android build manifest
- [`macos/desktop-assistant/Package.swift`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/macos/desktop-assistant/Package.swift) — macOS Swift package manifest
- [`tools/tts-proxy/tts_proxy.py`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/tools/tts-proxy/tts_proxy.py) — TTS proxy
- [`evidence/`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/evidence/) — measurements + decision brief + offline-turn note + raw logcat

## Cross-References

- Workspace graph: [`/Volumes/code/workspace/workspace.graph.json`](/Volumes/code/workspace/workspace.graph.json) — registered under `candidates/` partition; `incubation.json` is the canonical status record.
- The Mac-side TTS proxy is a downstream consumer of [`/Users/mose/.cc-connect/bin/minimax-tokenplan`](/Users/mose/.cc-connect/bin/minimax-tokenplan) and inherits its quota behaviour; the `evidence/decision-brief.md` quota investigation explains the 5-hour-window / weekly-window split.
- The on-device inference runtime pattern (sherpa-onnx + ONNX runtime) is shared with the cc-connect ASR provider documented in `/Users/mose/.cc-connect/ai-capabilities.json` and `/Users/mose/.cc-connect/bin/ai-capability asr`; this prototype does **not** consume that provider — its bundled `sherpa-onnx-1.13.8.aar` is a separate copy kept inside the APK.
- The repo URL `https://github.com/MoseLu/axi-assistant-voice` (private) is the only branch pair (`dev` default, `main` release); do not create additional long-lived branches without owner approval.