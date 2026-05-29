#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const SDK_VERSION = "0.9.0";
const TEXT_LIMIT = 4096;
const MESSAGE_TYPE_BOT = 2;
const MESSAGE_STATE_FINISH = 2;
const MESSAGE_ITEM_TEXT = 1;
const MESSAGE_ITEM_VOICE = 3;
const STALE_MESSAGE_INTERVAL_MS = 30 * 60 * 1000;
const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_CREDENTIAL_PATH = path.join(os.homedir(), ".mavis", "credentials", "main", "wechat.json");
const DEFAULT_STATE_PATH = path.join(os.homedir(), ".codex", "wechat-im", "state.json");
const STATE_DB_FILE = "state_5.sqlite";
const DEFAULT_CODEX_HOME = path.join(os.homedir(), ".codex");
const DEFAULT_CODEX_DB_PATH = path.join(DEFAULT_CODEX_HOME, STATE_DB_FILE);
const DEFAULT_COCKPIT_INSTANCES_PATH = path.join(
  os.homedir(),
  ".antigravity_cockpit",
  "codex_instances.json"
);
const DEFAULT_CODEX_BIN = "codex";
const DEFAULT_SQLITE_BIN = "sqlite3";
const DEFAULT_CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_SESSION_LIST = 12;

const credentialPath = process.env.WECHAT_IM_CREDENTIALS || DEFAULT_CREDENTIAL_PATH;
const statePath = process.env.WECHAT_IM_STATE || DEFAULT_STATE_PATH;
const codexDbPath = process.env.WECHAT_IM_CODEX_DB || DEFAULT_CODEX_DB_PATH;
const codexHomePath = process.env.WECHAT_IM_CODEX_HOME || path.dirname(codexDbPath);
const codexInstancesPath = process.env.WECHAT_IM_CODEX_INSTANCES || DEFAULT_COCKPIT_INSTANCES_PATH;
const codexBinary = process.env.WECHAT_IM_CODEX_BIN || DEFAULT_CODEX_BIN;
const sqliteBinary = process.env.WECHAT_IM_SQLITE_BIN || DEFAULT_SQLITE_BIN;

let stdinBuffer = Buffer.alloc(0);

if (require.main === module) {
  startStdioServer();
}

function startStdioServer() {
  process.stdin.on("data", (chunk) => {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    let request;
    while ((request = nextFrame()) !== null) {
      void handleRequest(request);
    }
  });

  process.stdin.resume();
}

function nextFrame() {
  const separator = Buffer.from("\r\n\r\n");
  const headerEnd = stdinBuffer.indexOf(separator);
  if (headerEnd === -1) {
    return null;
  }

  const header = stdinBuffer.subarray(0, headerEnd).toString("utf8");
  const lengthLine = header
    .split("\r\n")
    .find((line) => line.toLowerCase().startsWith("content-length:"));
  if (!lengthLine) {
    stdinBuffer = stdinBuffer.subarray(headerEnd + separator.length);
    return null;
  }

  const length = Number.parseInt(lengthLine.split(":").slice(1).join(":").trim(), 10);
  if (!Number.isFinite(length)) {
    stdinBuffer = stdinBuffer.subarray(headerEnd + separator.length);
    return null;
  }

  const bodyStart = headerEnd + separator.length;
  const bodyEnd = bodyStart + length;
  if (stdinBuffer.length < bodyEnd) {
    return null;
  }

  const body = stdinBuffer.subarray(bodyStart, bodyEnd).toString("utf8");
  stdinBuffer = stdinBuffer.subarray(bodyEnd);
  return JSON.parse(body);
}

async function handleRequest(request) {
  try {
    if (request.method === "initialize") {
      writeResponse(request.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "wechat-im", version: "0.2.0" },
      });
      return;
    }

    if (request.method === "tools/list") {
      writeResponse(request.id, { tools: toolDefinitions() });
      return;
    }

    if (request.method === "tools/call") {
      const result = await callTool(request.params || {});
      writeResponse(request.id, result);
      return;
    }

    writeResponse(request.id, {});
  } catch (error) {
    writeError(request.id, error && error.message ? error.message : String(error));
  }
}

function writeResponse(id, result) {
  writeJSON({ jsonrpc: "2.0", id, result });
}

function writeError(id, message) {
  writeJSON({ jsonrpc: "2.0", id, error: { code: -32000, message } });
}

function writeJSON(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function toolDefinitions() {
  return [
    {
      name: "status",
      description: "Check WeChat iLink state, Codex session access, and current WeChat-to-Codex bindings.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "poll_updates",
      description: "Poll WeChat iLink once and remember the newest incoming chat as the active target.",
      inputSchema: {
        type: "object",
        properties: {
          timeoutSeconds: {
            type: "number",
            description: "Long-poll timeout. Keep at or below 10 seconds for Codex MCP calls.",
          },
        },
      },
    },
    {
      name: "remember_target",
      description: "Store a WeChat chat ID and context token as the active target for later sends.",
      inputSchema: {
        type: "object",
        properties: {
          chatID: { type: "string" },
          contextToken: { type: "string" },
        },
        required: ["chatID", "contextToken"],
      },
    },
    {
      name: "send_text",
      description: "Send text to WeChat, using the active target unless chatID and contextToken are provided.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string" },
          chatID: { type: "string" },
          contextToken: { type: "string" },
        },
        required: ["text"],
      },
    },
    {
      name: "sync_conversation",
      description: "Send a compact handoff transcript to WeChat.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          transcript: { type: "string" },
          chatID: { type: "string" },
          contextToken: { type: "string" },
        },
        required: ["transcript"],
      },
    },
    {
      name: "list_codex_sessions",
      description: "List recent Codex sessions from the local Codex thread database.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
      },
    },
    {
      name: "bind_codex_session",
      description: "Bind a WeChat chat to a real Codex thread id, optionally syncing the recent thread context back to WeChat.",
      inputSchema: {
        type: "object",
        properties: {
          threadID: { type: "string" },
          codexHome: { type: "string" },
          chatID: { type: "string" },
          contextToken: { type: "string" },
          syncToChat: { type: "boolean" },
        },
        required: ["threadID"],
      },
    },
    {
      name: "resume_codex_session",
      description: "Send a new prompt into an existing Codex thread using the same Codex CLI/backend config as the Codex app, then optionally relay the reply to WeChat.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          threadID: { type: "string" },
          codexHome: { type: "string" },
          chatID: { type: "string" },
          contextToken: { type: "string" },
          sendReply: { type: "boolean" },
          timeoutSeconds: { type: "number" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "sync_codex_session",
      description: "Read a Codex thread's recent turns and send them to WeChat as a handoff summary.",
      inputSchema: {
        type: "object",
        properties: {
          threadID: { type: "string" },
          codexHome: { type: "string" },
          chatID: { type: "string" },
          contextToken: { type: "string" },
        },
      },
    },
    {
      name: "mirror_bound_sessions",
      description: "Send any new assistant final answers from bound Codex sessions back to their WeChat chats.",
      inputSchema: {
        type: "object",
        properties: {
          chatID: { type: "string" },
        },
      },
    },
    {
      name: "bridge_once",
      description: "Poll WeChat once, let the user choose among Codex sessions if needed, resume the bound Codex thread for new messages, and mirror new Codex answers back to WeChat.",
      inputSchema: {
        type: "object",
        properties: {
          timeoutSeconds: { type: "number" },
          sessionLimit: { type: "number" },
          mirrorUpdates: { type: "boolean" },
        },
      },
    },
  ];
}

async function callTool(params) {
  const name = params.name;
  const args = params.arguments || {};

  switch (name) {
    case "status":
      return contentResult(await statusPayload());
    case "poll_updates":
      return contentResult(await pollUpdates(args));
    case "remember_target":
      return contentResult(rememberTarget(args));
    case "send_text":
      return contentResult(await sendTextTool(args));
    case "sync_conversation":
      return contentResult(await syncConversation(args));
    case "list_codex_sessions":
      return contentResult(await listCodexSessionsTool(args));
    case "bind_codex_session":
      return contentResult(await bindCodexSession(args));
    case "resume_codex_session":
      return contentResult(await resumeCodexSessionTool(args));
    case "sync_codex_session":
      return contentResult(await syncCodexSessionTool(args));
    case "mirror_bound_sessions":
      return contentResult(await mirrorBoundSessionsTool(args));
    case "bridge_once":
      return contentResult(await bridgeOnce(args));
    default:
      throw new Error(`Unknown WeChat IM tool: ${name}`);
  }
}

function contentResult(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

async function statusPayload() {
  const state = loadState();

  let credentialsOK = false;
  let credentialError = null;
  try {
    loadCredentials();
    credentialsOK = true;
  } catch (error) {
    credentialError = error.message;
  }

  let codexOK = false;
  let codexError = null;
  let codexVersion = null;
  let sessionPreview = [];
  try {
    codexVersion = await getCodexVersion();
    sessionPreview = await loadCodexSessions(3);
    codexOK = true;
  } catch (error) {
    codexError = error.message;
  }

  return {
    ok: credentialsOK && codexOK,
    credentialPath,
    credentialError,
    statePath,
    codexDbPath,
    codexHomePath,
    codexInstancesPath,
    codexHomes: loadCodexHomes().map((home) => ({
      instanceID: home.instanceID,
      instanceName: home.instanceName,
      running: home.running,
      codexHome: home.codexHome,
      dbPath: home.dbPath,
      dbExists: fs.existsSync(home.dbPath),
    })),
    codexBinary,
    sqliteBinary,
    codexVersion,
    codexError,
    activeChatID: state.lastChatID || null,
    hasContextToken: Boolean(state.lastContextToken),
    getUpdatesBuffer: state.getUpdatesBuffer || "",
    lastMessageAt: state.lastMessageAt || null,
    boundChatCount: Object.keys(state.threadBindings).length,
    pendingSelectionCount: Object.keys(state.pendingThreadSelections).length,
    sessionPreview,
  };
}

async function pollUpdates(args) {
  const { response, messages, state } = await pollUpdatesOnce(args);
  return {
    ok: responseOK(response),
    ret: response.ret || 0,
    errcode: response.errcode || 0,
    errmsg: response.errmsg || "",
    messageCount: messages.length,
    messages,
    activeChatID: state.lastChatID || null,
  };
}

function rememberTarget(args) {
  const chatID = stringArg(args.chatID, "chatID");
  const contextToken = stringArg(args.contextToken, "contextToken");
  const state = loadState();
  rememberChatTargetInState(state, chatID, contextToken, new Date().toISOString());
  saveState(state);
  return {
    ok: true,
    activeChatID: chatID,
    hasContextToken: true,
  };
}

async function sendTextTool(args) {
  const text = stringArg(args.text, "text");
  const target = resolveTarget(args);
  const sentChunks = await sendText(target.chatID, target.contextToken, text);
  return {
    ok: true,
    chatID: target.chatID,
    sentChunks,
  };
}

async function syncConversation(args) {
  const transcript = stringArg(args.transcript, "transcript");
  const title = stringValue(args.title) || "Codex session";
  const text = [`Codex 会话已同步：${title}`, "", transcript.trim()].join("\n").trim();
  const target = resolveTarget(args);
  const sentChunks = await sendText(target.chatID, target.contextToken, text);
  return {
    ok: true,
    chatID: target.chatID,
    sentChunks,
  };
}

async function listCodexSessionsTool(args) {
  const limit = clampNumber(args.limit, 1, 50, MAX_SESSION_LIST);
  const sessions = await loadCodexSessions(limit);
  return {
    ok: true,
    sessions,
  };
}

async function bindCodexSession(args) {
  const threadID = stringArg(args.threadID, "threadID");
  const thread = await loadCodexSession(threadID, stringValue(args.codexHome));
  if (!thread) {
    throw new Error(`Codex thread was not found: ${threadID}`);
  }

  const state = loadState();
  const target = resolveTarget(args, state);
  const snapshot = readRolloutSnapshot(thread.rolloutPath);

  state.threadBindings[target.chatID] = {
    threadID: thread.id,
    codexHome: thread.codexHome,
    instanceName: thread.instanceName,
    lastMirroredFinalAnswerCount: snapshot.finalAnswers.length,
    updatedAt: new Date().toISOString(),
  };
  state.lastSyncedThreadID = thread.id;
  delete state.pendingThreadSelections[target.chatID];
  saveState(state);

  let sentChunks = 0;
  if (booleanValue(args.syncToChat, true)) {
    const text = buildThreadHandoffText(thread, snapshot);
    sentChunks = await sendText(target.chatID, target.contextToken, text, { state });
  }

  saveState(state);
  return {
    ok: true,
    chatID: target.chatID,
    threadID: thread.id,
    title: thread.title,
    sentChunks,
  };
}

async function resumeCodexSessionTool(args) {
  const prompt = stringArg(args.prompt, "prompt");
  const state = loadState();
  const thread = await resolveThreadFromArgs(args, state);
  const timeoutMilliseconds = clampNumber(
    args.timeoutSeconds,
    1,
    30 * 60,
    DEFAULT_CODEX_TIMEOUT_MS / 1000
  ) * 1000;
  const result = await runCodexResume(thread, prompt, timeoutMilliseconds);

  let sentChunks = 0;
  if (booleanValue(args.sendReply, true)) {
    const target = resolveTarget(args, state);
    sentChunks = await sendText(target.chatID, target.contextToken, result.reply, { state });
    state.threadBindings[target.chatID] = {
      threadID: thread.id,
      codexHome: thread.codexHome,
      instanceName: thread.instanceName,
      lastMirroredFinalAnswerCount: result.finalAnswerCount,
      updatedAt: new Date().toISOString(),
    };
    state.lastSyncedThreadID = thread.id;
    saveState(state);
  }

  return {
    ok: true,
    threadID: thread.id,
    title: thread.title,
    reply: result.reply,
    sentChunks,
  };
}

async function syncCodexSessionTool(args) {
  const state = loadState();
  const thread = await resolveThreadFromArgs(args, state);
  const snapshot = readRolloutSnapshot(thread.rolloutPath);
  const text = buildThreadHandoffText(thread, snapshot);

  let sentChunks = 0;
  if (hasTarget(args, state)) {
    const target = resolveTarget(args, state);
    sentChunks = await sendText(target.chatID, target.contextToken, text, { state });
    state.threadBindings[target.chatID] = {
      threadID: thread.id,
      codexHome: thread.codexHome,
      instanceName: thread.instanceName,
      lastMirroredFinalAnswerCount: snapshot.finalAnswers.length,
      updatedAt: new Date().toISOString(),
    };
    state.lastSyncedThreadID = thread.id;
    saveState(state);
  }

  return {
    ok: true,
    threadID: thread.id,
    title: thread.title,
    transcript: text,
    sentChunks,
  };
}

async function mirrorBoundSessionsTool(args) {
  const state = loadState();
  const actions = await mirrorBoundSessionsInternal(state, stringValue(args.chatID));
  saveState(state);
  return {
    ok: true,
    mirroredCount: actions.length,
    actions,
  };
}

async function bridgeOnce(args) {
  const state = loadState();
  const timeoutSeconds = clampNumber(args.timeoutSeconds, 0, 10, 5);
  const sessionLimit = clampNumber(args.sessionLimit, 1, 50, MAX_SESSION_LIST);
  const { response, messages } = await pollUpdatesOnce({ timeoutSeconds }, state);
  const actions = [];

  for (const message of messages) {
    const action = await handleIncomingBridgeMessage(state, message, sessionLimit);
    if (action) {
      actions.push(action);
    }
  }

  if (booleanValue(args.mirrorUpdates, true)) {
    const mirrored = await mirrorBoundSessionsInternal(state);
    actions.push(...mirrored);
  }

  saveState(state);
  return {
    ok: responseOK(response),
    ret: response.ret || 0,
    errcode: response.errcode || 0,
    errmsg: response.errmsg || "",
    messageCount: messages.length,
    actionCount: actions.length,
    actions,
  };
}

async function handleIncomingBridgeMessage(state, message, sessionLimit) {
  rememberChatTargetInState(state, message.chatID, message.contextToken, message.timestamp);
  const chatID = message.chatID;
  const text = stringValue(message.text);
  const pending = state.pendingThreadSelections[chatID];

  if (requestsSessionUnbind(text)) {
    delete state.threadBindings[chatID];
    delete state.pendingThreadSelections[chatID];
    const reply = "已解除当前微信聊天和 Codex 会话的绑定。发送“会话列表”可重新接管。";
    await sendText(chatID, message.contextToken, reply, { state });
    return { kind: "unbound_session", chatID };
  }

  if (pending) {
    if (requestsCancel(text)) {
      delete state.pendingThreadSelections[chatID];
      await sendText(chatID, message.contextToken, "已取消会话选择。", { state });
      return { kind: "cancelled_selection", chatID };
    }

    const selectedSessionKey = selectSessionFromMessage(text, pending.sessionKeys);
    if (selectedSessionKey) {
      const thread = await loadCodexSession(selectedSessionKey);
      if (!thread) {
        delete state.pendingThreadSelections[chatID];
        await sendText(chatID, message.contextToken, "选中的 Codex 会话不存在了，请重新发送“会话列表”。", { state });
        return { kind: "missing_selected_session", chatID, sessionKey: selectedSessionKey };
      }

      const snapshot = readRolloutSnapshot(thread.rolloutPath);
      state.threadBindings[chatID] = {
        threadID: thread.id,
        codexHome: thread.codexHome,
        instanceName: thread.instanceName,
        lastMirroredFinalAnswerCount: snapshot.finalAnswers.length,
        updatedAt: new Date().toISOString(),
      };
      state.lastSyncedThreadID = thread.id;
      delete state.pendingThreadSelections[chatID];
      saveState(state);

      await sendText(chatID, message.contextToken, buildThreadHandoffText(thread, snapshot), { state });
      return { kind: "bound_session", chatID, threadID: thread.id, title: thread.title };
    }

    const sessions = await hydrateSessionSelection(pending.sessionKeys);
    const reply = buildSessionSelectionPrompt(sessions, true);
    await sendText(chatID, message.contextToken, reply, { state });
    return { kind: "invalid_selection", chatID };
  }

  const binding = state.threadBindings[chatID];
  if (requestsSessionList(text) || !binding) {
    const sessions = await loadCodexSessions(sessionLimit);
    if (!sessions.length) {
      const reply = "当前没有可接管的 Codex 会话。请先在桌面 Codex 启动一个会话。";
      await sendText(chatID, message.contextToken, reply, { state });
      return { kind: "no_sessions", chatID };
    }

    state.pendingThreadSelections[chatID] = {
      sessionKeys: sessions.map((session) => session.key),
      requestedAt: new Date().toISOString(),
    };
    const reply = buildSessionSelectionPrompt(sessions, false);
    await sendText(chatID, message.contextToken, reply, { state });
    return { kind: "listed_sessions", chatID, sessions: sessions.map((session) => session.key) };
  }

  const thread = await loadCodexSession(binding.threadID, binding.codexHome);
  if (!thread) {
    delete state.threadBindings[chatID];
    const sessions = await loadCodexSessions(sessionLimit);
    if (!sessions.length) {
      await sendText(chatID, message.contextToken, "原来绑定的 Codex 会话找不到了，而且当前没有其他可接管会话。", { state });
      return { kind: "missing_bound_session", chatID };
    }

    state.pendingThreadSelections[chatID] = {
      sessionKeys: sessions.map((session) => session.key),
      requestedAt: new Date().toISOString(),
    };
    await sendText(chatID, message.contextToken, buildSessionSelectionPrompt(sessions, false), { state });
    return { kind: "relisted_sessions", chatID };
  }

  const result = await runCodexResume(thread, text, DEFAULT_CODEX_TIMEOUT_MS);
  state.threadBindings[chatID] = {
    threadID: thread.id,
    codexHome: thread.codexHome,
    instanceName: thread.instanceName,
    lastMirroredFinalAnswerCount: result.finalAnswerCount,
    updatedAt: new Date().toISOString(),
  };
  state.lastSyncedThreadID = thread.id;
  await sendText(chatID, message.contextToken, result.reply, { state });
  return {
    kind: "resumed_session",
    chatID,
    threadID: thread.id,
    title: thread.title,
    replyPreview: trimForChat(result.reply, 240),
  };
}

async function mirrorBoundSessionsInternal(state, onlyChatID = "") {
  const actions = [];
  const chatIDs = onlyChatID ? [onlyChatID] : Object.keys(state.threadBindings);

  for (const chatID of chatIDs) {
    const binding = state.threadBindings[chatID];
    const target = state.chatTargets[chatID];
    if (!binding || !target || !target.contextToken) {
      continue;
    }

    const thread = await loadCodexSession(binding.threadID, binding.codexHome);
    if (!thread || !thread.rolloutPath) {
      continue;
    }

    const snapshot = readRolloutSnapshot(thread.rolloutPath);
    const alreadyMirrored = integerValue(binding.lastMirroredFinalAnswerCount, 0);
    const newFinalAnswers = snapshot.finalAnswers.slice(alreadyMirrored);
    if (!newFinalAnswers.length) {
      continue;
    }

    for (const [offset, answer] of newFinalAnswers.entries()) {
      await sendText(chatID, target.contextToken, trimForChat(answer.text, 3600), { state });
      binding.lastMirroredFinalAnswerCount = alreadyMirrored + offset + 1;
      binding.updatedAt = new Date().toISOString();
      actions.push({
        kind: "mirrored_update",
        chatID,
        threadID: thread.id,
        title: thread.title,
        timestamp: answer.timestamp || null,
      });
    }

    binding.lastMirroredFinalAnswerCount = snapshot.finalAnswers.length;
  }

  return actions;
}

async function pollUpdatesOnce(args, providedState) {
  const credentials = loadCredentials();
  const state = providedState || loadState();
  const timeoutSeconds = clampNumber(args.timeoutSeconds, 0, 10, 5);
  const body = {
    get_updates_buf: state.getUpdatesBuffer || "",
    base_info: { channel_version: SDK_VERSION },
  };
  let response;
  try {
    response = await postJSON(credentials, "ilink/bot/getupdates", body, timeoutSeconds + 2);
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }
    response = { ret: 0, errcode: 0, errmsg: "", msgs: [], timedOut: true };
  }

  if (response.get_updates_buf) {
    state.getUpdatesBuffer = response.get_updates_buf;
  }

  const messages = Array.isArray(response.msgs)
    ? response.msgs.map((raw) => parseIncomingMessage(raw, credentials.ilinkBotID)).filter(Boolean)
    : [];

  const newest = messages[messages.length - 1];
  if (newest) {
    rememberChatTargetInState(state, newest.chatID, newest.contextToken, newest.timestamp);
  }

  if (!providedState) {
    saveState(state);
  }

  return { response, messages, state };
}

async function loadCodexSessions(limit) {
  const homes = loadCodexHomes();
  const cappedLimit = Math.max(1, Number(limit) || MAX_SESSION_LIST);

  const sessions = [];
  for (const home of homes) {
    if (!fs.existsSync(home.dbPath)) {
      continue;
    }
    const sql = await makeCodexSessionQuery(home.dbPath, "t.archived = 0", cappedLimit);
    const rows = await querySqlRows(sql, home.dbPath);
    sessions.push(...rows.map((row) => makeSessionRecord(row, home)));
  }

  sessions.sort((left, right) => {
    if (left.running !== right.running) {
      return left.running ? -1 : 1;
    }
    const leftRank = sessionStatusRank(left.goalStatus);
    const rightRank = sessionStatusRank(right.goalStatus);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return (right.updatedAtMs || 0) - (left.updatedAtMs || 0);
  });
  return selectSessionsForDisplay(sessions, cappedLimit);
}

async function loadCodexSession(threadID, codexHome = "") {
  const parsedKey = parseSessionKey(stringArg(threadID, "threadID"));
  const normalizedThreadID = parsedKey.threadID;
  const requestedHome = stringValue(codexHome) || parsedKey.codexHome;
  const homes = requestedHome
    ? [makeCodexHomeRecord("__direct__", "Codex", requestedHome)]
    : loadCodexHomes();
  for (const home of homes) {
    if (!fs.existsSync(home.dbPath)) {
      continue;
    }
    const sql = await makeCodexSessionQuery(home.dbPath, `t.id = ${sqlQuote(normalizedThreadID)}`, 1);
    const rows = await querySqlRows(sql, home.dbPath);
    if (rows.length) {
      return makeSessionRecord(rows[0], home);
    }
  }

  return null;
}

function makeSessionRecord(columns, home) {
  const id = stringValue(columns[0]);
  const title = stringValue(columns[1]) || "Untitled Codex Session";
  const cwd = stringValue(columns[2]);
  const updatedAtMs = integerValue(columns[3], 0);
  const rolloutPath = stringValue(columns[4]);
  const goalStatus = stringValue(columns[5]) || "idle";
  return {
    id,
    title,
    cwd,
    cwdLabel: cwd ? shortPath(cwd) : "",
    updatedAt: updatedAtMs > 0 ? new Date(updatedAtMs).toISOString() : null,
    updatedAtLabel: updatedAtMs > 0 ? formatTimestamp(updatedAtMs) : "",
    updatedAtMs,
    rolloutPath,
    goalStatus,
    key: makeSessionKey(id, home.codexHome),
    codexHome: home.codexHome,
    instanceID: home.instanceID,
    instanceName: home.instanceName,
    running: home.running,
    dbPath: home.dbPath,
  };
}

function selectSessionsForDisplay(sessions, limit) {
  const selected = [];
  const selectedKeys = new Set();
  const runningHomes = [...new Set(sessions.filter((session) => session.running).map((session) => session.codexHome))];

  for (const codexHome of runningHomes) {
    const session = sessions.find((item) => item.codexHome === codexHome && item.running);
    if (!session || selectedKeys.has(session.key)) {
      continue;
    }
    selected.push(session);
    selectedKeys.add(session.key);
    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const session of sessions) {
    if (selectedKeys.has(session.key)) {
      continue;
    }
    selected.push(session);
    selectedKeys.add(session.key);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

async function makeCodexSessionQuery(dbPath, whereClause, limit) {
  const hasThreadGoals = await sqliteTableExists(dbPath, "thread_goals");
  const goalSelect = hasThreadGoals ? "coalesce(g.status, '')" : "''";
  const goalJoin = hasThreadGoals ? "LEFT JOIN thread_goals g ON g.thread_id = t.id" : "";
  const goalOrder = hasThreadGoals
    ? "CASE g.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,"
    : "";

  return [
    "SELECT",
    "  t.id,",
    "  replace(replace(replace(coalesce(t.title, ''), char(13), ' '), char(9), ' '), char(10), ' '),",
    "  replace(replace(replace(coalesce(t.cwd, ''), char(13), ' '), char(9), ' '), char(10), ' '),",
    "  coalesce(t.updated_at_ms, t.updated_at * 1000),",
    "  replace(replace(replace(coalesce(t.rollout_path, ''), char(13), ' '), char(9), ' '), char(10), ' '),",
    `  ${goalSelect}`,
    "FROM threads t",
    goalJoin,
    `WHERE ${whereClause}`,
    "ORDER BY",
    goalOrder ? `  ${goalOrder}` : "",
    "  coalesce(t.updated_at_ms, t.updated_at * 1000) DESC",
    `LIMIT ${Math.max(1, Number(limit) || MAX_SESSION_LIST)}`,
  ]
    .filter(Boolean)
    .join(" ");
}

async function sqliteTableExists(dbPath, tableName) {
  const rows = await querySqlRows(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${sqlQuote(tableName)} LIMIT 1`,
    dbPath
  );
  return rows.length > 0;
}

function loadCodexHomes() {
  const store = loadCockpitCodexInstanceStore();
  const homes = [
    makeCodexHomeRecord(
      "__default__",
      "默认实例",
      codexHomePath,
      codexDbPath,
      isPidRunning(store.defaultSettings && store.defaultSettings.lastPid)
    ),
  ];
  const seen = new Set(homes.map((home) => home.codexHome));

  for (const instance of Array.isArray(store.instances) ? store.instances : []) {
    const codexHome = stringValue(instance.userDataDir);
    if (!codexHome || seen.has(codexHome)) {
      continue;
    }
    seen.add(codexHome);
    homes.push(
      makeCodexHomeRecord(
        stringValue(instance.id) || `instance-${homes.length + 1}`,
        stringValue(instance.name) || `Codex 实例 ${homes.length + 1}`,
        codexHome,
        "",
        isPidRunning(instance.lastPid)
      )
    );
  }

  return homes;
}

function loadCockpitCodexInstanceStore() {
  if (!fs.existsSync(codexInstancesPath)) {
    return {};
  }
  try {
    const payload = JSON.parse(fs.readFileSync(codexInstancesPath, "utf8"));
    return payload && typeof payload === "object" ? payload : {};
  } catch {
    return {};
  }
}

function makeCodexHomeRecord(instanceID, instanceName, codexHome, explicitDbPath = "", running = false) {
  const normalizedHome = path.resolve(stringArg(codexHome, "codexHome"));
  return {
    instanceID,
    instanceName,
    codexHome: normalizedHome,
    dbPath: stringValue(explicitDbPath) || path.join(normalizedHome, STATE_DB_FILE),
    running: Boolean(running),
  };
}

function isPidRunning(pid) {
  const value = Number(pid);
  if (!Number.isFinite(value) || value <= 0) {
    return false;
  }
  try {
    process.kill(value, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function makeSessionKey(threadID, codexHome) {
  return `${threadID}@@${Buffer.from(codexHome, "utf8").toString("base64url")}`;
}

function parseSessionKey(value) {
  const raw = stringValue(value);
  const marker = raw.lastIndexOf("@@");
  if (marker === -1) {
    return { threadID: raw, codexHome: "" };
  }

  const threadID = raw.slice(0, marker);
  const encodedHome = raw.slice(marker + 2);
  try {
    return {
      threadID,
      codexHome: Buffer.from(encodedHome, "base64url").toString("utf8"),
    };
  } catch {
    return { threadID: raw, codexHome: "" };
  }
}

function sessionStatusRank(status) {
  switch (status) {
    case "active":
      return 0;
    case "paused":
      return 1;
    default:
      return 2;
  }
}

async function querySqlRows(sql, dbPath) {
  assertCodexDatabaseExists(dbPath);
  const { stdout } = await execFileAsync(sqliteBinary, [dbPath, "-separator", "\t", sql], {
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function getCodexVersion() {
  const { stdout } = await execFileAsync(codexBinary, ["--version"], {
    maxBuffer: 128 * 1024,
  });
  return stringValue(stdout);
}

async function runCodexResume(thread, prompt, timeoutMilliseconds) {
  const outputPath = path.join(
    os.tmpdir(),
    `wechat-im-codex-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`
  );
  try {
    const args = buildCodexResumeArgs(thread, outputPath, prompt);
    const { stdout } = await execFileAsync(
      codexBinary,
      args,
      {
        cwd: codexResumeWorkingDirectory(thread),
        env: { ...process.env, CODEX_HOME: thread.codexHome || codexHomePath },
        maxBuffer: 12 * 1024 * 1024,
        timeout: Math.max(1_000, timeoutMilliseconds),
      }
    );

    let reply = parseCodexReply(stdout);
    if (!reply && fs.existsSync(outputPath)) {
      reply = stringValue(fs.readFileSync(outputPath, "utf8"));
    }
    if (!reply) {
      throw new Error(`Codex resumed ${thread.id}, but no assistant reply was captured.`);
    }

    const refreshedThread = (await loadCodexSession(thread.id, thread.codexHome)) || thread;
    const snapshot = readRolloutSnapshot(refreshedThread.rolloutPath);
    return {
      threadID: thread.id,
      reply,
      finalAnswerCount: snapshot.finalAnswers.length,
    };
  } finally {
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // Ignore cleanup failure.
    }
  }
}

function buildCodexResumeArgs(thread, outputPath, prompt) {
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--json",
    "-o",
    outputPath,
  ];
  const cwd = stringValue(thread.cwd);
  if (cwd) {
    args.push("-C", cwd);
  }
  args.push("resume", "--all", thread.id, prompt);
  return args;
}

function codexResumeWorkingDirectory(thread) {
  const cwd = stringValue(thread.cwd);
  if (!cwd) {
    return process.cwd();
  }
  try {
    if (fs.statSync(cwd).isDirectory()) {
      return cwd;
    }
  } catch {
    // Fall back to the MCP server cwd if the original workspace was removed.
  }
  return process.cwd();
}

function parseCodexReply(stdout) {
  let reply = "";
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !line.startsWith("{")) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (parsed.type === "item.completed" && parsed.item && parsed.item.type === "agent_message") {
      reply = stringValue(parsed.item.text) || reply;
      continue;
    }

    if (parsed.type === "event_msg" && parsed.payload && parsed.payload.type === "agent_message") {
      if (stringValue(parsed.payload.phase) === "final_answer") {
        reply = stringValue(parsed.payload.message) || reply;
      }
      continue;
    }

    if (parsed.type === "response_item" && parsed.payload && parsed.payload.type === "message") {
      const content = Array.isArray(parsed.payload.content) ? parsed.payload.content : [];
      const text = content
        .filter((item) => item && item.type === "output_text")
        .map((item) => stringValue(item.text))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) {
        reply = text;
      }
    }
  }
  return reply.trim();
}

function readRolloutSnapshot(rolloutPath) {
  if (!rolloutPath || !fs.existsSync(rolloutPath)) {
    return { turns: [], finalAnswers: [] };
  }

  const turns = [];
  const finalAnswers = [];
  const lines = fs.readFileSync(rolloutPath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("{")) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (parsed.type !== "event_msg" || !parsed.payload) {
      continue;
    }

    if (parsed.payload.type === "user_message") {
      const text = stringValue(parsed.payload.message);
      if (text) {
        turns.push({
          role: "user",
          text,
          timestamp: stringValue(parsed.timestamp),
        });
      }
      continue;
    }

    if (parsed.payload.type === "agent_message" && stringValue(parsed.payload.phase) === "final_answer") {
      const text = stringValue(parsed.payload.message);
      if (text) {
        const item = {
          role: "assistant",
          text,
          timestamp: stringValue(parsed.timestamp),
        };
        turns.push(item);
        finalAnswers.push(item);
      }
    }
  }

  return { turns, finalAnswers };
}

async function hydrateSessionSelection(sessionKeys) {
  const sessions = [];
  for (const sessionKey of sessionKeys) {
    const thread = await loadCodexSession(sessionKey);
    if (thread) {
      sessions.push(thread);
    }
  }
  return sessions;
}

function buildSessionSelectionPrompt(sessions, invalidSelection) {
  const header = invalidSelection
    ? "没认出你要接管哪一个 Codex 会话，请直接回复编号。"
    : "找到这些 Codex 会话，回复编号即可接管。";
  const lines = sessions.map((session, index) => `${index + 1}. ${formatSessionLabel(session)}`);
  return [header, ...lines, "发送“会话列表”可重新查看，发送“取消”可退出选择。"].join("\n");
}

function formatSessionLabel(session) {
  const parts = [
    session.title || "Untitled Codex Session",
    session.updatedAtLabel || "",
  ].filter(Boolean);

  if (session.cwdLabel) {
    parts.push(session.cwdLabel);
  }
  if (session.instanceName) {
    parts.push(session.running ? `${session.instanceName} 运行中` : session.instanceName);
  }
  if (session.goalStatus && session.goalStatus !== "idle") {
    parts.push(`[${session.goalStatus}]`);
  }
  return parts.join(" · ");
}

function buildThreadHandoffText(thread, snapshot) {
  const title = stringValue(thread.title) || "Untitled Codex Session";
  const header = [`已接入 Codex 会话：${title}`];
  if (thread.instanceName) {
    header.push(`Codex 实例：${thread.instanceName}`);
  }
  if (thread.cwd) {
    header.push(`工作目录：${thread.cwd}`);
  }

  const recentTurns = snapshot.turns
    .slice(-6)
    .map((turn) => `${turn.role === "assistant" ? "Codex" : "你"}: ${trimForChat(turn.text, 700)}`)
    .filter(Boolean);

  if (!recentTurns.length) {
    return trimForChat(header.join("\n"), 3600);
  }

  return trimForChat([...header, "", "最近对话：", ...recentTurns].join("\n"), 3600);
}

function resolveTarget(args, providedState) {
  const state = providedState || loadState();
  const explicitChatID = stringValue(args.chatID);
  const chatID = explicitChatID || state.lastChatID;
  if (!chatID) {
    throw new Error("No active WeChat target. Poll updates first or pass chatID.");
  }

  const target = state.chatTargets[chatID] || {};
  const fallbackContextToken = !explicitChatID || explicitChatID === state.lastChatID ? state.lastContextToken : "";
  const contextToken = stringValue(args.contextToken) || stringValue(target.contextToken) || fallbackContextToken;
  if (!contextToken) {
    throw new Error("No active WeChat target context token. Poll updates first or pass contextToken.");
  }

  return { chatID, contextToken };
}

function hasTarget(args, providedState) {
  try {
    resolveTarget(args, providedState);
    return true;
  } catch {
    return false;
  }
}

async function resolveThreadFromArgs(args, state) {
  const explicitThreadID = stringValue(args.threadID);
  if (explicitThreadID) {
    const thread = await loadCodexSession(explicitThreadID, stringValue(args.codexHome));
    if (!thread) {
      throw new Error(`Codex thread was not found: ${explicitThreadID}`);
    }
    return thread;
  }

  const target = resolveTarget(args, state);
  const binding = state.threadBindings[target.chatID];
  if (!binding || !binding.threadID) {
    throw new Error("This WeChat chat is not bound to a Codex session yet.");
  }

  const thread = await loadCodexSession(binding.threadID, binding.codexHome);
  if (!thread) {
    throw new Error(`The bound Codex thread no longer exists: ${binding.threadID}`);
  }
  return thread;
}

async function sendText(chatID, contextToken, text, options = {}) {
  const credentials = loadCredentials();
  const chunks = chunkText(text, TEXT_LIMIT);
  for (const chunk of chunks) {
    const body = makeSendTextPayload(chatID, contextToken, chunk);
    await postJSON(credentials, "ilink/bot/sendmessage", body, 15);
  }

  const state = options.state || loadState();
  rememberChatTargetInState(state, chatID, contextToken, new Date().toISOString());
  if (options.threadID) {
    state.lastSyncedThreadID = options.threadID;
  }
  if (!options.state) {
    saveState(state);
  }

  return chunks.length;
}

function makeSendTextPayload(chatID, contextToken, text) {
  return {
    msg: {
      from_user_id: "",
      to_user_id: chatID,
      client_id: `sdk-wx-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
      message_type: MESSAGE_TYPE_BOT,
      message_state: MESSAGE_STATE_FINISH,
      item_list: [
        {
          type: MESSAGE_ITEM_TEXT,
          text_item: { text },
        },
      ],
      context_token: contextToken,
    },
    base_info: { channel_version: SDK_VERSION },
  };
}

async function postJSON(credentials, endpoint, body, timeoutSeconds) {
  if (typeof fetch !== "function") {
    throw new Error("This MCP server requires Node.js 18 or newer for fetch().");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutSeconds) * 1000);
  const bodyText = JSON.stringify(body);

  try {
    const response = await fetch(endpointURL(credentials.baseURL, endpoint), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyText).toString(),
        AuthorizationType: "ilink_bot_token",
        Authorization: `Bearer ${credentials.botToken}`,
        "X-WECHAT-UIN": randomWechatUIN(),
      },
      body: bodyText,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${endpoint} failed: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

function endpointURL(baseURL, endpoint) {
  const normalizedBase = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
  return new URL(endpoint, normalizedBase).toString();
}

function loadCredentials() {
  if (!fs.existsSync(credentialPath)) {
    throw new Error(`WeChat credentials were not found at ${credentialPath}.`);
  }
  const payload = JSON.parse(fs.readFileSync(credentialPath, "utf8"));
  const credentials = payload.credentials || {};
  const botToken = stringValue(credentials.botToken);
  if (!botToken) {
    throw new Error("WeChat credentials are invalid: botToken is empty.");
  }
  return {
    botToken,
    ilinkBotID: stringValue(credentials.ilinkBotId) || stringValue(credentials.ilinkBotID) || "",
    baseURL: stringValue(credentials.baseUrl) || stringValue(credentials.baseURL) || DEFAULT_BASE_URL,
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(fs.readFileSync(statePath, "utf8")));
  } catch {
    return normalizeState({});
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(normalizeState(state), null, 2)}\n`);
}

function normalizeState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};
  return {
    getUpdatesBuffer: stringValue(state.getUpdatesBuffer),
    lastChatID: stringValue(state.lastChatID),
    lastContextToken: stringValue(state.lastContextToken),
    lastMessageAt: stringValue(state.lastMessageAt),
    lastSyncedThreadID: stringValue(state.lastSyncedThreadID),
    chatTargets: normalizeChatTargets(state.chatTargets),
    threadBindings: normalizeThreadBindings(state.threadBindings),
    pendingThreadSelections: normalizePendingSelections(state.pendingThreadSelections),
  };
}

function normalizeChatTargets(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const [chatID, target] of Object.entries(value)) {
    const nextTarget = target && typeof target === "object" ? target : {};
    const contextToken = stringValue(nextTarget.contextToken);
    if (!chatID || !contextToken) {
      continue;
    }
    normalized[chatID] = {
      contextToken,
      lastMessageAt: stringValue(nextTarget.lastMessageAt),
    };
  }
  return normalized;
}

function normalizeThreadBindings(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const [chatID, binding] of Object.entries(value)) {
    const nextBinding = binding && typeof binding === "object" ? binding : {};
    const threadID = stringValue(nextBinding.threadID);
    if (!chatID || !threadID) {
      continue;
    }
    normalized[chatID] = {
      threadID,
      codexHome: stringValue(nextBinding.codexHome),
      instanceName: stringValue(nextBinding.instanceName),
      lastMirroredFinalAnswerCount: integerValue(nextBinding.lastMirroredFinalAnswerCount, 0),
      updatedAt: stringValue(nextBinding.updatedAt),
    };
  }
  return normalized;
}

function normalizePendingSelections(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const normalized = {};
  for (const [chatID, selection] of Object.entries(value)) {
    const nextSelection = selection && typeof selection === "object" ? selection : {};
    const legacyThreadIDs = Array.isArray(nextSelection.threadIDs)
      ? nextSelection.threadIDs.map((item) => stringValue(item)).filter(Boolean)
      : [];
    const sessionKeys = Array.isArray(nextSelection.sessionKeys)
      ? nextSelection.sessionKeys.map((item) => stringValue(item)).filter(Boolean)
      : legacyThreadIDs;
    if (!chatID || !sessionKeys.length) {
      continue;
    }
    normalized[chatID] = {
      sessionKeys,
      requestedAt: stringValue(nextSelection.requestedAt),
    };
  }
  return normalized;
}

function rememberChatTargetInState(state, chatID, contextToken, timestamp) {
  state.lastChatID = stringValue(chatID);
  state.lastContextToken = stringValue(contextToken);
  state.lastMessageAt = stringValue(timestamp);
  state.chatTargets[chatID] = {
    contextToken: stringValue(contextToken),
    lastMessageAt: stringValue(timestamp),
  };
}

function parseIncomingMessage(raw, botID) {
  if (!raw || raw.from_user_id === botID) {
    return null;
  }

  const senderID = stringValue(raw.from_user_id);
  const contextToken = stringValue(raw.context_token);
  if (!senderID || !contextToken) {
    return null;
  }

  const text = Array.isArray(raw.item_list)
    ? raw.item_list
        .map((item) => {
          if (item.type === MESSAGE_ITEM_TEXT) {
            return stringValue(item.text_item && item.text_item.text);
          }
          if (item.type === MESSAGE_ITEM_VOICE) {
            return stringValue(item.voice_item && item.voice_item.text);
          }
          return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim()
    : "";
  if (!text) {
    return null;
  }

  let timestampDate = new Date();
  if (raw.create_time_ms) {
    const timestampMilliseconds = Number(raw.create_time_ms);
    if (Number.isFinite(timestampMilliseconds)) {
      timestampDate = new Date(timestampMilliseconds);
    }
  }
  if (Date.now() - timestampDate.getTime() > STALE_MESSAGE_INTERVAL_MS) {
    return null;
  }

  return {
    chatID: stringValue(raw.group_id) || senderID,
    senderID,
    messageID: stringValue(raw.message_id) || stringValue(raw.client_id) || String(Date.now()),
    contextToken,
    text,
    timestamp: timestampDate.toISOString(),
  };
}

function responseOK(response) {
  return (response.ret || 0) === 0 && (response.errcode || 0) === 0;
}

function selectSessionFromMessage(text, sessionKeys) {
  const numberMatch = text.match(/\b([1-9][0-9]*)\b/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    if (index >= 0 && index < sessionKeys.length) {
      return sessionKeys[index];
    }
  }

  const idMatches = text.match(/[0-9a-fA-F-]{4,36}/g) || [];
  for (const match of idMatches) {
    const normalized = match.toLowerCase();
    const found = sessionKeys.find((sessionKey) => {
      const parsed = parseSessionKey(sessionKey);
      return parsed.threadID.toLowerCase().startsWith(normalized);
    });
    if (found) {
      return found;
    }
  }

  return "";
}

function requestsSessionList(text) {
  const normalized = text.toLowerCase();
  return [
    "会话",
    "会话列表",
    "最近的会话",
    "最近会话",
    "接管会话",
    "切换会话",
    "session",
    "sessions",
    "session list",
    "takeover",
    "take over",
    "switch session",
  ].some((keyword) => normalized.includes(keyword));
}

function requestsSessionUnbind(text) {
  const normalized = text.toLowerCase();
  return ["解绑", "取消绑定", "release session", "unbind"].some((keyword) => normalized.includes(keyword));
}

function requestsCancel(text) {
  const normalized = text.toLowerCase();
  return normalized === "取消" || normalized === "cancel";
}

function chunkText(text, limit) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("text is empty.");
  }
  const chunks = [];
  for (let index = 0; index < trimmed.length; index += limit) {
    chunks.push(trimmed.slice(index, index + limit));
  }
  return chunks;
}

function trimForChat(value, limit) {
  const trimmed = stringValue(value);
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, Math.max(0, limit - 3))}...`;
}

function shortPath(value) {
  const normalized = stringValue(value);
  if (!normalized) {
    return "";
  }
  const base = path.basename(normalized);
  return base || normalized;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return sameDay ? `${hours}:${minutes}` : `${month}-${day} ${hours}:${minutes}`;
}

function stringArg(value, name) {
  const result = stringValue(value);
  if (!result) {
    throw new Error(`${name} is required.`);
  }
  return result;
}

function stringValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function integerValue(value, fallback) {
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : fallback;
}

function booleanValue(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function assertCodexDatabaseExists(dbPath = codexDbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Codex thread database was not found at ${dbPath}.`);
  }
}

function randomWechatUIN() {
  const value = Math.floor(Math.random() * 0xffffffff).toString();
  return Buffer.from(value, "utf8").toString("base64");
}

function isAbortError(error) {
  if (!error) {
    return false;
  }
  return (
    error.name === "AbortError" ||
    error.code === "ABORT_ERR" ||
    /aborted|abort/i.test(String(error.message || ""))
  );
}

if (process.env.WECHAT_IM_MCP_TEST === "1") {
  module.exports.__test = {
    bridgeOnce,
    buildCodexResumeArgs,
    loadCodexSession,
    loadCodexSessions,
    makeSessionKey,
    mirrorBoundSessionsTool,
    parseSessionKey,
    readRolloutSnapshot,
    runCodexResume,
    selectSessionFromMessage,
  };
}
