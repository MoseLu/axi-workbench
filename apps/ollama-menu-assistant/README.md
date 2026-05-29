# Ollama Menu Assistant

本地 Ollama 的原生 macOS 助手：常驻菜单栏，支持 `Option+Space` 快速呼出，用本机模型完成聊天、项目问答、文件附件理解、工作区工具调用和可选的微信 IM 自动回复。

## 功能

- 原生 SwiftUI/AppKit macOS 应用，支持菜单栏状态、独立主窗口和开机启动。
- 连接本地 `http://127.0.0.1:11434`，只列出支持 `completion` 的 Ollama 模型。
- 默认优先使用 `main:latest`；如果不存在，会选择本地可用模型。
- 支持快速、均衡、专家三种路由模式，并可按图片附件自动切到视觉模型。
- 支持拖放或选择附件：图片会走 Ollama vision payload，文本文件会截取内容放入提示词。
- 支持项目工作区：侧栏可绑定本地文件夹，模型能获得有限文件树和关键文件摘录。
- 内置工作区工具：列目录、读文件、搜索、`rg`、安全 shell、写文件、补丁、移动和删除等。
- 内置 Assistant skills，可通过 `/skill-name` 形式显式调用，也可由模型按描述选择。
- 本地保存会话、项目、附件引用和工具事件，支持置顶、重命名和归档。
- 支持语音输入，需要 macOS 麦克风和语音识别权限。
- 支持可选桌面宠物 helper app。
- 可在设置里手动启用微信 IM 桥接，收到微信消息后用当前模型生成并发送回复。

## 环境要求

- macOS 14 或更新版本。
- Xcode / Swift toolchain，包声明为 `swift-tools-version: 6.3`。
- 本机已安装并运行 Ollama。
- 至少安装一个支持 `completion` 的 Ollama 模型，建议准备 `main:latest`。
- 如果要处理图片附件，需要本地安装支持 `vision` 的模型，例如 `qwen3-vl`、`gemma3`、`qwen2.5vl`、`llava` 或 MiniCPM-V 系列。

## 快速开始

启动 Ollama，并确认模型可用：

```zsh
ollama list
```

运行测试和调试构建：

```zsh
swift test
swift build
```

构建 `.app`：

```zsh
./scripts/build_app.sh
```

脚本会输出应用路径，默认是：

```text
dist/Ollama Menu Assistant.app
```

安装到 `/Applications`：

```zsh
./scripts/install_app.sh
```

构建、安装并打开应用：

```zsh
./scripts/open_app.sh
```

## 常用命令

```zsh
swift test
swift build
./scripts/render_snapshots.sh
./scripts/make_icns.sh
./scripts/build_pet_runner_app.sh
./scripts/build_app.sh
./scripts/install_app.sh
./scripts/open_app.sh
```

## 使用说明

打开应用后，可以从菜单栏图标或 `Option+Space` 呼出主窗口。应用启动时会刷新本地 Ollama 模型列表，离线时会显示离线状态；修复 Ollama 后可在设置里刷新模型。

侧栏的“项目”可以选择一个本地文件夹。绑定项目后，当前会话会带上该工作区的有限文件树和关键文件摘录；当模型需要更多细节时，它可以通过工作区工具继续读取、搜索或操作文件。

输入框支持直接拖入文件和图片。文本附件会按大小限制截取内容，图片附件会以 base64 传给 Ollama；如果当前没有视觉模型，应用会提示先安装可用的 vision 模型。

输入 `/` 会出现 bundled skills 的建议菜单。选择一个 skill 后，本轮请求会读取对应 `SKILL.md` 并按其说明执行。

## 权限模式

工作区工具受当前会话的权限模式控制：

- `默认权限`：允许工作区内只读工具和安全读类 shell 命令。
- `自动审查`：允许模型请求写入；应用会先做静态审查，并优先使用沙箱执行命令。
- `完全访问`：允许本地命令和文件写入，但仍保留超时、输出截断和工具事件记录。

默认模式适合日常问答和代码阅读。需要让模型改文件时，再切换到更高权限。

## 本地数据

应用数据默认保存在：

```text
~/Library/Application Support/OllamaMenuAssistant/
```

主要文件：

- `conversations.sqlite3`：当前会话库，包含项目、会话、消息、附件引用和工具事件。
- `conversation-library.json`：旧版会话库文件；如果数据库为空，应用会自动导入。
- `recent-conversations.json`：更早的旧版最近会话文件；如果数据库为空，应用也会自动导入。
- `im-conversation-bindings.json`：微信 IM 会话和本地会话的绑定关系。

开机启动通过下面的 LaunchAgent 管理：

```text
~/Library/LaunchAgents/com.mose.OllamaMenuAssistant.login.plist
```

## 微信 IM 桥接

微信 IM 默认关闭。启用后，应用会读取本机 MiniMax/Mavis 的微信凭证：

```text
~/.mavis/credentials/main/wechat.json
```

应用不会在界面显示令牌。桥接开启后会长轮询 iLink，收到微信消息时创建或复用本地会话，并用当前模型生成回复发送回微信。IM 回复使用默认权限模式，不会绑定项目工作区。

## 桌面宠物资源

应用会扫描 `~/Library/Application Support/OllamaMenuAssistant/Pets/*/pet.json`，并在设置的宠物菜单里显示 `displayName`。新增宠物时创建一个新目录即可：

```text
~/Library/Application Support/OllamaMenuAssistant/Pets/<pet-id>/
  pet.json
  spritesheet.redraw.webp
```

2D `pet.json` 至少需要 `id`、`displayName` 和 `spritesheetPath`；`description` 可选：

```json
{
  "id": "<pet-id>",
  "displayName": "宠物名",
  "description": "optional",
  "spritesheetPath": "spritesheet.webp"
}
```

图集仍使用 8 列、每帧 `192x208`。Runner 会优先读取 `spritesheet.redraw.webp`，其次是 `spritesheet.directional.webp`，最后才是 `spritesheetPath` 指向的文件。

3D 宠物可以改用 `modelPath`。Runner 使用 macOS SceneKit 加载模型，优先使用 `.scn`、`.dae`、`.usdz` 或 `.obj` 这类系统可读格式：

```json
{
  "id": "<pet-id>",
  "displayName": "宠物名",
  "description": "optional",
  "modelPath": "model.dae"
}
```

## 项目结构

```text
Sources/OllamaMenuAssistant/    主应用、模型路由、Ollama 客户端、工作区工具和 SwiftUI 界面
Sources/OllamaPetRunner/         桌面宠物 helper app
Resources/                      Info.plist、图标和 bundled skills
Tests/                          OllamaMenuAssistant 与 OllamaPetRunner 测试
scripts/                        构建、安装、图标、快照和宠物资源脚本
docs/                           补充设计和资源说明
```

## 快照和图标

重新生成 UI 快照：

```zsh
./scripts/render_snapshots.sh
```

输出目录：

```text
artifacts/snapshots/
```

重新生成 app 图标：

```zsh
./scripts/make_icns.sh
```

输出文件：

```text
Resources/AppIcon.png
Resources/AppIcon.icns
Resources/AppIcon.iconset/
```

## 排查

- 模型列表为空：确认 Ollama 正在运行，且 `ollama list` 中至少有一个支持 `completion` 的模型。
- 显示离线：确认 `http://127.0.0.1:11434` 可访问，然后在设置里刷新模型。
- 图片附件不可用：安装支持 `vision` 的模型后刷新模型列表。
- `Option+Space` 无法注册：该快捷键可能已被其他应用占用。
- 语音输入失败：到系统设置里允许麦克风和语音识别权限。
- 桌面宠物无法启动：重新执行 `./scripts/build_app.sh`，确保 `Ollama Pet Runner.app` 被嵌入到主应用。
