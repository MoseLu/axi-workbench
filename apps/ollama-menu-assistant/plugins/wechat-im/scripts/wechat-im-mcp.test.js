const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const bridgePath = path.join(__dirname, "wechat-im-mcp.js");
const sqliteBinary = process.env.WECHAT_IM_SQLITE_BIN || "sqlite3";

test("Codex session keys preserve the selected home and resume command targets the real thread", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-im-mcp-"));
  const homeA = path.join(root, "codex-a");
  const homeB = path.join(root, "codex-b");
  const workspaceA = path.join(root, "workspace-a");
  const workspaceB = path.join(root, "workspace-b");
  fs.mkdirSync(workspaceA, { recursive: true });
  fs.mkdirSync(workspaceB, { recursive: true });

  const rolloutA = path.join(root, "rollout-a.jsonl");
  const rolloutB = path.join(root, "rollout-b.jsonl");
  fs.writeFileSync(rolloutA, `${rolloutUser("hello a")}\n`);
  fs.writeFileSync(rolloutB, `${rolloutFinal("old answer")}\n`);
  const dbA = createCodexHome(homeA, [
    { id: "thread-a", title: "A", cwd: workspaceA, rolloutPath: rolloutA, updatedAtMs: 1_000 },
  ]);
  const dbB = createCodexHome(homeB, [
    { id: "thread-b", title: "B", cwd: workspaceB, rolloutPath: rolloutB, updatedAtMs: 2_000 },
  ]);
  const instancesPath = path.join(root, "instances.json");
  fs.writeFileSync(
    instancesPath,
    JSON.stringify({ instances: [{ id: "b", name: "B instance", userDataDir: homeB }] })
  );

  const capturePath = path.join(root, "codex-capture.json");
  const fakeCodex = path.join(root, "fake-codex.js");
  fs.writeFileSync(
    fakeCodex,
    [
      "#!/usr/bin/env node",
      "const fs = require('node:fs');",
      "const outputIndex = process.argv.indexOf('-o') + 1;",
      "fs.writeFileSync(process.env.WECHAT_IM_CAPTURE, JSON.stringify({",
      "  args: process.argv.slice(2),",
      "  codexHome: process.env.CODEX_HOME,",
      "  cwd: process.cwd()",
      "}));",
      "if (outputIndex > 0) fs.writeFileSync(process.argv[outputIndex], 'fallback reply');",
      "console.log(JSON.stringify({ type: 'event_msg', payload: { type: 'agent_message', phase: 'final_answer', message: 'fake reply' } }));",
      "",
    ].join("\n")
  );
  fs.chmodSync(fakeCodex, 0o755);

  const bridge = loadBridgeModule({
    WECHAT_IM_CODEX_HOME: homeA,
    WECHAT_IM_CODEX_DB: dbA,
    WECHAT_IM_CODEX_INSTANCES: instancesPath,
    WECHAT_IM_CODEX_BIN: fakeCodex,
    WECHAT_IM_CAPTURE: capturePath,
  });

  const sessions = await bridge.loadCodexSessions(10);
  assert.equal(sessions.length, 2);
  const selectedKey = bridge.selectSessionFromMessage("2", [
    bridge.makeSessionKey("thread-a", homeA),
    bridge.makeSessionKey("thread-b", homeB),
  ]);
  assert.equal(bridge.parseSessionKey(selectedKey).codexHome, homeB);

  const selectedThread = await bridge.loadCodexSession(selectedKey);
  assert.equal(selectedThread.id, "thread-b");
  assert.equal(selectedThread.codexHome, homeB);

  const result = await bridge.runCodexResume(selectedThread, "hello from phone", 5_000);
  const capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
  const resumeIndex = capture.args.indexOf("resume");
  const cdIndex = capture.args.indexOf("-C");

  assert.equal(result.reply, "fake reply");
  assert.equal(result.finalAnswerCount, 1);
  assert.equal(capture.codexHome, homeB);
  assert.equal(capture.cwd, fs.realpathSync(workspaceB));
  assert.equal(capture.args[resumeIndex + 1], "--all");
  assert.equal(capture.args[resumeIndex + 2], "thread-b");
  assert.equal(capture.args[resumeIndex + 3], "hello from phone");
  assert.equal(capture.args[cdIndex + 1], workspaceB);
});

test("bridge_once persists a selected binding and mirror_bound_sessions sends only new final answers", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-im-mcp-"));
  const home = path.join(root, "codex-home");
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(workspace, { recursive: true });
  const rollout = path.join(root, "rollout.jsonl");
  fs.writeFileSync(rollout, `${rolloutUser("question")}\n${rolloutFinal("old answer")}\n`);
  const dbPath = createCodexHome(home, [
    { id: "thread-1", title: "Phone handoff", cwd: workspace, rolloutPath: rollout, updatedAtMs: 2_000 },
  ]);
  const credentialPath = path.join(root, "wechat.json");
  const statePath = path.join(root, "state.json");
  fs.writeFileSync(
    credentialPath,
    JSON.stringify({
      credentials: {
        botToken: "token",
        ilinkBotId: "bot-1",
        baseUrl: "https://wechat.test",
      },
    })
  );

  const sentTexts = [];
  const updates = [
    updateResponse(incomingMessage("会话列表", "msg-1", "ctx-1")),
    updateResponse(incomingMessage("1", "msg-2", "ctx-2")),
  ];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).includes("getupdates")) {
      return jsonResponse(updates.shift() || { ret: 0, msgs: [] });
    }

    const body = JSON.parse(options.body);
    sentTexts.push(body.msg.item_list[0].text_item.text);
    return jsonResponse({ ret: 0 });
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const bridge = loadBridgeModule({
    WECHAT_IM_CREDENTIALS: credentialPath,
    WECHAT_IM_STATE: statePath,
    WECHAT_IM_CODEX_HOME: home,
    WECHAT_IM_CODEX_DB: dbPath,
    WECHAT_IM_CODEX_INSTANCES: path.join(root, "missing-instances.json"),
  });

  const listResult = await bridge.bridgeOnce({ timeoutSeconds: 0, sessionLimit: 5, mirrorUpdates: false });
  assert.equal(listResult.actions[0].kind, "listed_sessions");
  assert.match(sentTexts[0], /Phone handoff/);

  const bindResult = await bridge.bridgeOnce({ timeoutSeconds: 0, sessionLimit: 5, mirrorUpdates: false });
  assert.equal(bindResult.actions[0].kind, "bound_session");
  assert.match(sentTexts[1], /old answer/);

  let state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(state.threadBindings["chat-1"].threadID, "thread-1");
  assert.equal(state.threadBindings["chat-1"].codexHome, home);
  assert.equal(state.threadBindings["chat-1"].lastMirroredFinalAnswerCount, 1);
  assert.equal(state.chatTargets["chat-1"].contextToken, "ctx-2");
  assert.deepEqual(state.pendingThreadSelections, {});

  fs.appendFileSync(rollout, `${rolloutFinal("new answer")}\n`);
  sentTexts.length = 0;
  const mirrorResult = await bridge.mirrorBoundSessionsTool({});
  assert.equal(mirrorResult.mirroredCount, 1);
  assert.deepEqual(sentTexts, ["new answer"]);

  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  assert.equal(state.threadBindings["chat-1"].lastMirroredFinalAnswerCount, 2);

  sentTexts.length = 0;
  const secondMirrorResult = await bridge.mirrorBoundSessionsTool({});
  assert.equal(secondMirrorResult.mirroredCount, 0);
  assert.deepEqual(sentTexts, []);
});

test("bridge_once treats getupdates timeout aborts as an empty poll", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "wechat-im-mcp-"));
  const credentialPath = path.join(root, "wechat.json");
  const statePath = path.join(root, "state.json");
  fs.writeFileSync(
    credentialPath,
    JSON.stringify({
      credentials: {
        botToken: "token",
        ilinkBotId: "bot-1",
        baseUrl: "https://wechat.test",
      },
    })
  );

  const originalFetch = global.fetch;
  global.fetch = async () => {
    const error = new Error("This operation was aborted");
    error.name = "AbortError";
    throw error;
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const bridge = loadBridgeModule({
    WECHAT_IM_CREDENTIALS: credentialPath,
    WECHAT_IM_STATE: statePath,
    WECHAT_IM_CODEX_HOME: root,
    WECHAT_IM_CODEX_DB: path.join(root, "missing-state.sqlite"),
    WECHAT_IM_CODEX_INSTANCES: path.join(root, "missing-instances.json"),
  });

  const result = await bridge.bridgeOnce({ timeoutSeconds: 0, sessionLimit: 5, mirrorUpdates: false });

  assert.equal(result.ok, true);
  assert.equal(result.ret, 0);
  assert.equal(result.messageCount, 0);
  assert.equal(result.actionCount, 0);
  assert.deepEqual(result.actions, []);
});

function loadBridgeModule(env) {
  Object.assign(process.env, env, { WECHAT_IM_MCP_TEST: "1" });
  delete require.cache[require.resolve(bridgePath)];
  return require(bridgePath).__test;
}

function createCodexHome(home, threads) {
  fs.mkdirSync(home, { recursive: true });
  const dbPath = path.join(home, "state_5.sqlite");
  execFileSync(sqliteBinary, [
    dbPath,
    [
      "CREATE TABLE threads (",
      "id TEXT PRIMARY KEY,",
      "rollout_path TEXT NOT NULL,",
      "created_at INTEGER NOT NULL,",
      "updated_at INTEGER NOT NULL,",
      "cwd TEXT NOT NULL,",
      "title TEXT NOT NULL,",
      "archived INTEGER NOT NULL DEFAULT 0,",
      "created_at_ms INTEGER,",
      "updated_at_ms INTEGER",
      ");",
      ...threads.map((thread) => [
        "INSERT INTO threads (id, rollout_path, created_at, updated_at, cwd, title, archived, created_at_ms, updated_at_ms) VALUES (",
        [
          sqlQuote(thread.id),
          sqlQuote(thread.rolloutPath),
          "1",
          "1",
          sqlQuote(thread.cwd),
          sqlQuote(thread.title),
          "0",
          String(thread.updatedAtMs),
          String(thread.updatedAtMs),
        ].join(", "),
        ");",
      ].join("")),
    ].join("\n"),
  ]);
  return dbPath;
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function rolloutUser(text) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "event_msg",
    payload: { type: "user_message", message: text },
  });
}

function rolloutFinal(text) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "event_msg",
    payload: { type: "agent_message", phase: "final_answer", message: text },
  });
}

function incomingMessage(text, messageID, contextToken) {
  return {
    from_user_id: "sender-1",
    group_id: "chat-1",
    message_id: messageID,
    context_token: contextToken,
    create_time_ms: String(Date.now()),
    item_list: [{ type: 1, text_item: { text } }],
  };
}

function updateResponse(message) {
  return {
    ret: 0,
    get_updates_buf: `buf-${message.message_id}`,
    msgs: [message],
  };
}

function jsonResponse(payload) {
  return {
    ok: true,
    text: async () => JSON.stringify(payload),
  };
}
