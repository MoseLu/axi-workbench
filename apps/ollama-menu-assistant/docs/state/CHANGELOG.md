# Changelog

All notable changes to Ollama Menu Assistant are documented in this file.

## Unreleased

### Changed

- Added native macOS titlebar double-click zoom and restore behavior to the assistant window.

## 0.0.1 - 2026-05-07

Initial public release of Ollama Menu Assistant, a native macOS menu-bar assistant for local Ollama models.

### Added

- Native macOS assistant shell with menu-bar presence, main assistant window, `Option+Space` global hotkey, launch-at-login support, and SwiftUI/AppKit interface.
- Local Ollama integration against `http://127.0.0.1:11434`, including model discovery, running-model status, model details, context length detection, and streaming chat.
- Model routing modes for quick, balanced, and expert responses, with automatic vision-model routing for image attachments and fallback handling for empty or refusal-like outputs.
- Local Agent Runtime gateway that classifies tasks, retrieves project knowledge, scores model candidates, scopes capabilities, runs tool-aware conversations, records fallback decisions, and stores local runtime traces.
- Capability registry for workspace tools, bundled skills, project knowledge search, and enabled plugin MCP tools.
- Project knowledge index backed by SQLite FTS, with hybrid hash-vector retrieval when an embedding-capable model is present and full-text fallback when it is not.
- Local plugin management, including discovery from the Ollama Menu Assistant plugin library, enable/disable state from local runtime config, plugin browsing, plugin management views, and plugin metadata parsing.
- MCP plugin runtime for enabled plugins, including HTTP and stdio server configuration from `.mcp.json`, namespaced MCP tool registration, `tools/list`, `tools/call`, timeout handling, and trace metadata.
- Bundled Assistant skills discovery, slash-command skill invocation, skill reading tools, and selected-skill injection through the runtime.
- Workspace tools for listing directories, reading files, stat, glob, filename search, text search, ripgrep search, compact trees, safe shell commands, file writing, patch application, moving paths, and deletion under permission controls.
- Tool permission modes for default read-only operation, auto-review writes, and full-access execution, with workspace-bound path checks, symlink protection, destructive command filtering, shell sandboxing, timeout handling, and output truncation.
- Project workspace support with local folder binding, file tree snapshots, key file excerpts, project startup commands, terminal/run panels, Git branch controls, workspace change summaries, and file preview sidebar.
- Conversation library backed by SQLite, including projects, conversations, messages, attachments, tool events, active conversation restoration, pinned chats, archived chats, edited titles, message editing, retry, and navigation history.
- Context window usage estimation for active model, existing messages, draft text, attachments, and project context.
- Assistant message rendering with local Markdown parsing, tables, code fences, internal directive hiding, image-payload collapsing, copy actions, timestamps, tool activity summaries, and workspace change summaries.
- Composer attachment support for text files, ordinary files, and images, including drag-and-drop, file picker selection, attachment previews, and vision payload preparation.
- Local automations with TOML-backed store, automation panel, schedule calculation, daily and weekly recurrence, enabled/disabled state, next-run calculation, and app lifecycle scheduler.
- Optional WeChat IM bridge using local iLink/Mavis credentials, conversation binding, long polling, inbound message handling, generated replies, reply chunking, and status reporting.
- Speech input support through macOS microphone and speech recognition permissions.
- Optional desktop pet runner helper app with pet catalog scanning from Application Support, localized pet display names, dynamic pet selections, runner lifecycle control, and Assistant pet atlas support.
- Runtime observability panel in Usage settings, showing task classification, routing scores, selected model, knowledge hits, capability invocations, fallback state, errors, and local trace clearing.
- Settings panels for general behavior, appearance, IM, archived conversations, usage traces, plugin browsing, plugin management, automations, workspace controls, and app personalization.
- App icon resources and snapshot-friendly UI controls for visual QA.

### Changed

- Replaced direct chat execution with the local Agent Runtime path for normal assistant chats and IM replies.
- Moved model selection from mostly static name preference toward capability-aware scoring using task labels, vision/tool requirements, context length, model size, loaded state, and failure/tool-success statistics.
- Scoped skill usage so explicit slash skills are prioritized and automatic skill injection is limited to relevant matches instead of always exposing every skill.
- Unified workspace tools, skills, project knowledge, and plugin MCP tools under a single capability model for routing and traceability.
- Improved assistant panel navigation, sidebar row layout, plugin and automation destinations, conversation rows, hover actions, action slot stability, and compact panel sizing.
- Improved pet selection compatibility for legacy values and localized scanned pet names.
- Refreshed app icon assets.

### Fixed

- Prevented workspace tools from following symlinks outside the selected workspace under default and auto-review permission modes.
- Preserved workspace tool metadata in conversation storage and assistant activity summaries.
- Kept image payloads out of user-facing message text and context-window estimates where appropriate.
- Avoided treating normal assistant answers as refusals while still detecting empty, Chinese, and English refusal-like outputs.
- Ensured SQLite-backed stores handle migrations, active conversation state, automation files, knowledge indexing, and trace logs reliably.
- Fixed UI sizing and scrolling edge cases for compact assistant windows and settings panels.

### Tests

- Added coverage for Ollama chunk parsing, model catalog defaults, routing, fallback selection, context window estimation, response refusal detection, Markdown rendering, chat display sanitization, conversation persistence, workspace context, workspace tools, workspace change loading, plugin discovery, runtime gateway behavior, project knowledge retrieval, MCP HTTP/stdio calls, automations, pet selection, assistant panel layout, and pet runner behavior.
- Verified the release with `swift test` passing 119 tests.

### Notes

- This release is local-first. Model prompts, conversations, project indexes, runtime traces, plugin metadata, and automations are stored on the user's Mac unless an enabled integration or MCP tool explicitly calls an external service.
- Ollama must be running locally, and at least one completion-capable model must be installed.
- Vision requests require a local vision-capable Ollama model.
