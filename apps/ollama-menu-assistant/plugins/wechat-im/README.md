# WeChat IM Codex Plugin

This plugin exposes a WeChat iLink bridge to Codex through MCP.
It is designed for phone handoff: bind a WeChat chat to a real Codex thread, resume that same thread through the same Codex CLI/backend configuration used by the Codex app, and mirror recent Codex answers back to the phone.

## Credentials

By default the MCP server reads:

```text
~/.mavis/credentials/main/wechat.json
```

Expected shape:

```json
{
  "platform": "wechat",
  "credentials": {
    "botToken": "YOUR_ILINK_BOT_TOKEN",
    "ilinkBotId": "YOUR_BOT_USER_ID",
    "baseUrl": "https://ilinkai.weixin.qq.com"
  }
}
```

You can override paths with environment variables:

```text
WECHAT_IM_CREDENTIALS=/path/to/wechat.json
WECHAT_IM_STATE=/path/to/state.json
WECHAT_IM_CODEX_HOME=/path/to/codex-home
WECHAT_IM_CODEX_DB=/path/to/state_5.sqlite
WECHAT_IM_CODEX_INSTANCES=/path/to/cockpit/codex_instances.json
WECHAT_IM_CODEX_BIN=/path/to/codex
```

## MCP Tools

- `status`: checks WeChat state, Codex thread access, and current bindings.
- `poll_updates`: long-polls iLink once, stores the newest chat target, and returns incoming text or transcribed voice messages.
- `remember_target`: manually stores a chat ID and context token.
- `send_text`: sends text to the stored target, or to an explicit `chatID` and `contextToken`.
- `sync_conversation`: formats and sends a current-session handoff transcript.
- `list_codex_sessions`: lists recent real Codex threads from the default Codex home and Cockpit-registered Codex instances.
- `bind_codex_session`: binds a WeChat chat to one Codex thread.
- `resume_codex_session`: resumes the bound Codex thread with its original `CODEX_HOME` and captures the assistant reply.
- `sync_codex_session`: sends the recent turns from a Codex thread to WeChat.
- `mirror_bound_sessions`: forwards new Codex final answers from bound threads back to WeChat.
- `bridge_once`: one-shot dispatcher for poll -> choose session -> resume Codex -> mirror replies.

## Session takeover

If a WeChat chat is not bound yet, `bridge_once` can return the recent Codex sessions and let the user reply with a number to take one over.
Sending `会话列表` / `session list` shows the options again, `取消` / `cancel` exits the chooser, and `解绑` / `unbind` clears the current binding.
