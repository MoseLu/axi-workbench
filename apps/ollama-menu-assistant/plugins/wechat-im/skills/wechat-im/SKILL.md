---
name: wechat-im
description: Use when the user wants to continue a real Codex thread through WeChat, sync the active session to a phone, poll WeChat iLink messages, or send Codex replies to WeChat.
---

# WeChat IM Handoff

Use this skill when the user asks to connect Codex to WeChat, continue from a phone, or sync the current session to IM.
The WeChat side should bind to an actual Codex thread and continue it through the same Codex CLI/backend configuration used by the Codex app, not through a separate shadow conversation.

## Workflow

1. Check `status` before sending. If credentials or Codex thread access are missing, tell the user which path is missing.
2. Use `list_codex_sessions` to inspect the available real Codex threads when the phone side needs to take over a session.
3. Use `bind_codex_session` or `bridge_once` so the WeChat chat attaches to one actual Codex thread.
4. Use `resume_codex_session` or `bridge_once` to continue that thread with the user's WeChat message.
5. Use `sync_codex_session` or `mirror_bound_sessions` to send recent Codex context or new Codex replies back to WeChat.

## Privacy

Do not send full transcripts by default. Send a short handoff summary plus recent turns unless the user explicitly asks for the full conversation.

## Credentials

Default credential file:

```text
~/.mavis/credentials/main/wechat.json
```

Environment overrides:

```text
WECHAT_IM_CREDENTIALS=/path/to/wechat.json
WECHAT_IM_STATE=/path/to/state.json
WECHAT_IM_CODEX_HOME=/path/to/codex-home
WECHAT_IM_CODEX_DB=/path/to/state_5.sqlite
WECHAT_IM_CODEX_INSTANCES=/path/to/cockpit/codex_instances.json
WECHAT_IM_CODEX_BIN=/path/to/codex
```
