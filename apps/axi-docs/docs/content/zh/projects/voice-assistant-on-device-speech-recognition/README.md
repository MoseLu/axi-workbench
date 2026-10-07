---
id: axi-docs-zh-projects-voice-assistant-on-device-speech-recognition
title: VoiceAssistant — on-device voice loop prototype
type: project
status: published
tags: [Axi Docs, 项目, candidates, voice, on-device, asr, sherpa-onnx, miniMax]
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

> 项目根 `README.md` 的镜像,深入剖析 sherpa-onnx 流式 pipeline、
> `ChatEngine` 合约、Mac 侧 TTS 代理,以及新的 macOS `DesktopAssistant`
> Swift package。源文件:
> [`/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md`](/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition/README.md)。
> Section: core / Partition: `candidates/`。

## Summary

`VoiceAssistant` 是一个已暂停的原型 incubation 项目,用于验证在 Android
上完全端侧的语音循环(流式中文 ASR + 本地回复模型 + 本地服务 TTS)是否
可用。它承载两个不同的运行时表面:**Android 应用**(`app/`,Kotlin +
Jetpack Compose)与 **macOS 桌面助理**(`macos/desktop-assistant/`,Swift
Package + SherpaOnnxC + ONNXRuntime frameworks)。Android 应用打包了流式
sherpa-onnx transducer(encoder/decoder/joiner int8 ONNX)与 `tokens.txt`
词汇表,采集 16 kHz 单声道 PCM,并送入流式 `OnlineRecognizer`。chat 层抽
象在 `ChatEngine` 合约之后,这样真正的端侧 LLM 就是 `StubChatEngine`
的单文件 drop-in 替代品。

当前默认引擎是 `MiniMaxChatEngine`,它调用 MiniMax
`/v1/text/chatcompletion_v2` endpoint,system prompt 设定回复长度上限
≤40 个中文字符(并带有 `MAX_REPLY_CHARS` 客户端安全网)。合成仍然
保留在 Mac 侧代理(`tools/tts-proxy/tts_proxy.py`),该代理包装本地
`/Users/mose/.cc-connect/bin/minimax-tokenplan speech` CLI;应用通过
`adb reverse tcp:8090 tcp:8090` 抵达代理。仓库于 2026-09-25 从
`products/` 移出(产品安置需要已接受的 project-maturity-v1 记录),
并以 `incubation.json` 记录与 `2026-10-18` 的 reviewBy 在 `candidates/`
注册。

最新状态(2026-09-18 在 Xiaomi M2012K10C / Android 13 / API 33 debug
build 上的基线测量):5.2–5.6 s 语音中 ASR median **755 ms**(RTF ≈ 0.14,
numThreads=2,zipformer int8);`StubChatEngine` 下 reply median **3 ms**;
first-audio median **2,170 ms**(完全来自合成);完整循环 speech end →
first audio median **2,652 ms**;recogniser 常驻时峰值 TOTAL PSS **360.7
MiB**(native heap 263.1 MiB)。2026-09-18 的决策是合成继续留在云端代理
(年度订阅,零边际成本),而 PRD 验收标准 1(飞行模式 turn)按现状无法达成。

**Stage**: prototype(`stage=candidate`,`intent=prototype`,`reviewBy=2026-10-18`)。
**Canonical path**: `/Volumes/code/workspace/candidates/voice-assistant-on-device-speech-recognition`。

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

在升级之前不要将 `app/` 或 `macos/desktop-assistant/` 拆为独立仓库。大型
ONNX binary 绝不能入仓;仓库有意保持 source-only。

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

最近一次验证 2026-09-25(状态:原型验证进行中)。

## Architecture Highlights

项目围绕三个承重接缝展开,每个接缝在源码中都写明,使下一次迭代可以单点
修改而不破坏其他。

第一个接缝是 `ChatEngine` 合约(`app/src/main/java/com/mose/voiceassistant/ChatEngine.kt`)。
它是一个单一 suspend 方法 —— `reply(history: List<ChatTurn>, userText:
String): String` —— 外加一个 `ChatTurn` data class,包含 `role`、`text`、
`timestampMs`、`isPartial` 字段。接口注释有意地限制插入的模型:它说明
每次回复都会被送到合成端、从而被朗读出来,因此回复长度是一种产品约束。
存在两个实现:`StubChatEngine`(基于规则的问候/时间/日期/自我介绍,回复
上限 <28 字符)和 `MiniMaxChatEngine`(`MiniMaxChatEngine.kt`,OkHttp POST
到 `/v1/text/chatcompletion_v2`,system prompt 将回复长度限制为 ≤40 个
中文字符,并配有客户端 `MAX_REPLY_CHARS` 安全网)。`ChatEngine` 上的注释
显式给出这一约束:早期版本的 stub 产生 100+ 字符的回复(约 24 s 朗读),
任何端侧模型都必须遵守同一上限。

第二个接缝是流式 ASR pipeline(`app/src/main/java/com/mose/voiceassistant/MainActivity.kt`)。
`Phase` 状态机为 `Idle → Recording → Recognizing`;音频采集使用
`AudioRecord`,采样率 `SAMPLE_RATE=16_000` Hz 单声道 PCM,最长 30 秒。
识别器为 `com.k2fsa.sherpa.onnx.OnlineRecognizer`,配置 `OnlineTransducerModelConfig`
(zipformer int8);partial 解码运行在 `Dispatchers.IO` 协程上,每 80 ms
轮询并通过 `MutableStateFlow` 推送 partial 转写。2026-09-18 的修复把资
产抽取门控为"完成标记 + 分阶段后重命名复制"(此前 ~189 MB 的 int8 ONNX
权重在每次冷启动都会被重新拷贝,因为 `ensureAssetFile` 只重用以 `.txt`
结尾的文件)。`extractAssetsIfNeeded` 循环在设备上验证:`pm clear` 后 4
次抽取,随后启动 0 次抽取。ASR fixtures(`assets/test/zh_0.wav`、`zh_1.wav`)
加上 document picker 路径允许无麦克风验证;两个 fixtures 现在都通过麦克风
所用的同一个 `OnlineRecognizer` 产出转写(此前一个 bug 让
`runWavFromAssets` 只记录采样数)。

第三个接缝是 TTS 代理(`tools/tts-proxy/tts_proxy.py`)。Android 应用将
`{text, voice_id}` POST 到 `http://localhost:8090/tts`(通过
`adb reverse tcp:8090 tcp:8090` 抵达);代理在 `threading.Lock` 之后串行
调用 `minimax-tokenplan speech --text ... --voice-id ...`,从磁盘读取
生成的 MP3 并流式返回。它把子进程的工作目录钉在 `/tmp`,因为被清空的
临时目录会以"Current directory does not exist"终止每次调用。
2026-09-18 的配额调查(记录于 `evidence/decision-brief.md`)显示,MiniMax
通用池(文本 + 图像 + 语音共享一个池)在其 5 小时窗口中剩余 0%、状态 2,
而其周窗口为 100%;synthesis 调用路径仍按字符计费,一个中文字符计为两
个。"合成留在 Mac 侧代理"的决策正是冻结架构形态的决定。

macOS 表面(`macos/desktop-assistant/`)是单独的 Swift Package,通过
vendor 的 `sherpa-onnx.xcframework` + `onnxruntime.xcframework` 共享同一
引擎路径。最近的 git log 显示 macOS 语音循环被替换为 **本地两遍
Paraformer 中文 ASR**(`feat(voice): replace macOS ASR with local two-pass
Paraformer`),与仍然使用 sherpa-onnx 流式 transducer 的 Android 应用不同。
macOS 应用暴露 `AssistantAnswerClient`、`DecisionRouter`、
`DesktopTaskExecutor`、`MiniMaxProxyServer` 与 `VoiceAssistantController`
模块,外加用于 MiniMax 订阅状态面板的 `QuotaPanelController`。生成三个
验证可执行文件:`DesktopAssistant`、`DesktopAssistantCoreCheck` 与
`DesktopAssistantASRCheck`。`VERIFICATION.md` 的 macOS 章节注明应用在语
音循环替换期间保持禁用;此前的 ASRCheck 修复让预期文本 `糖豆糖豆打开壁纸
预览搜索美女图片` 与已安装的 Swift runtime 匹配,但在 launch agent 禁用
期间,真实的麦克风→悬浮→agent TTS 仍属未验证。

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

## 备注

- PRD 验收标准 1(飞行模式 turn)按 2026-09-18 决策无法达成;要恢复它,要么
  反转合成决策,要么重述该标准。按 PRD 本身,这是 owner 决断。
- macOS `DesktopAssistant` 表面在功能上与 Android 应用不同(分离 ASR:
  本地两遍 Paraformer vs sherpa-onnx 流式 transducer),且在语音循环替换
  期间当前处于禁用。请勿将两个表面视为可互换。
- 仓库 URL `https://github.com/MoseLu/axi-assistant-voice`(私有)是唯一
  的分支对(`dev` 默认,`main` 发布);未经 owner 批准不得新增长期分支。
- Mac 侧 TTS 代理是 `/Users/mose/.cc-connect/bin/minimax-tokenplan` 的下
  游消费者,并继承其配额行为。

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
- Mac 侧 TTS 代理是 [`/Users/mose/.cc-connect/bin/minimax-tokenplan`](/Users/mose/.cc-connect/bin/minimax-tokenplan) 的下游消费者,并继承其配额行为;`evidence/decision-brief.md` 中的配额调查解释了 5 小时窗口 / 周窗口的划分。
- 端侧推理运行时模式(sherpa-onnx + ONNX runtime)与 cc-connect ASR provider 共享,该 provider 记录于 `/Users/mose/.cc-connect/ai-capabilities.json` 与 `/Users/mose/.cc-connect/bin/ai-capability asr`;本原型 **不** 消费该 provider —— 其打包的 `sherpa-onnx-1.13.8.aar` 是 APK 内的另一份独立副本。
- 仓库 URL `https://github.com/MoseLu/axi-assistant-voice`(私有)是唯一的分支对(`dev` 默认,`main` 发布);未经 owner 批准不得新增长期分支。