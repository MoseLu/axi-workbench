import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCommunicationGateway,
  startPair,
  confirmPair,
  registerMossCoderDevice,
  handleMossCoderRelayEvent,
} from "../src/gateway.mjs";

function makeFreshState() {
  return {
    routes: {},
    pairings: {},
    approvals: {},
    attachments: {},
    receipts: {},
    devices: {},
    mossCoderOutbox: {},
  };
}

function makeTempCacheDir() {
  const dir = mkdtempSync(join(tmpdir(), "communication-gateway-test-"));
  return dir;
}

function makeEnvelope({ channel = "feishu", conversationId = "chat-1", senderId = "ou-user", text = "你好", id = "msg-1" } = {}) {
  return {
    envelope: {
      id,
      channel,
      conversationId,
      senderId,
      text,
      receivedAt: new Date().toISOString(),
      raw: {},
    },
  };
}

test("registerMossCoderDevice stores the FCM token and returns 200 with a stable deviceDbId", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const token = "abcdef0123456789";

  const ok = registerMossCoderDevice({
    input: { fcmToken: token, label: "Test Phone" },
    state,
    cacheDir,
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.statusCode, 200);
  assert.ok(ok.deviceDbId, "deviceDbId should be set");

  // Re-registering the same token must return the same deviceDbId (idempotent).
  const again = registerMossCoderDevice({
    input: { fcmToken: token },
    state,
    cacheDir,
  });
  assert.equal(again.ok, true);
  assert.equal(again.deviceDbId, ok.deviceDbId, "deviceDbId should be stable across registrations");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("registerMossCoderDevice rejects tokens that are too short", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();

  const result = registerMossCoderDevice({
    input: { fcmToken: "short" },
    state,
    cacheDir,
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 422);
  assert.match(result.error, /fcmToken/);

  rmSync(cacheDir, { recursive: true, force: true });
});

test("startPair issues a pending challenge with a 6-digit code and saves state", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();

  const envelope = makeEnvelope({ id: "msg-pair-1" }).envelope;
  const challenge = startPair({
    input: { envelope },
    state,
    cacheDir,
  });

  assert.equal(challenge.status, "pending");
  assert.match(challenge.code, /^\d{6}$/, "pair code should be 6 digits");
  assert.ok(challenge.id, "challenge id should be set");
  assert.equal(challenge.routeKey, "feishu:chat-1:ou-user");
  assert.ok(state.pairings[challenge.id], "challenge should be persisted in state.pairings");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("confirmPair with the correct code marks the route as trusted", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();

  const envelope = makeEnvelope({ id: "msg-confirm-1" }).envelope;
  const challenge = startPair({
    input: { envelope },
    state,
    cacheDir,
  });

  const result = confirmPair({
    input: { ...envelope, code: challenge.code },
    state,
    cacheDir,
  });

  assert.equal(result.paired, true);
  assert.ok(result.route, "route should be returned on success");
  assert.equal(result.route.trusted, true);
  assert.equal(result.route.channel, "feishu");
  assert.equal(result.route.runtimePreference, "codex_cli");
  assert.equal(state.pairings[challenge.id].status, "confirmed");
  assert.equal(state.routes[result.route.routeKey].trusted, true);

  rmSync(cacheDir, { recursive: true, force: true });
});

test("confirmPair rejects unknown codes without mutating state", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();

  const envelope = makeEnvelope({ id: "msg-bad-code" }).envelope;
  startPair({ input: { envelope }, state, cacheDir });

  const result = confirmPair({
    input: { ...envelope, code: "000000" },
    state,
    cacheDir,
  });

  assert.equal(result.paired, false);
  assert.match(result.summary, /不存在/);
  assert.equal(state.routes["feishu:chat-1:ou-user"], undefined, "no route should be created on bad code");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("confirmPair rejects expired codes", () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();

  const envelope = makeEnvelope({ id: "msg-expired" }).envelope;
  const challenge = startPair({ input: { envelope }, state, cacheDir });

  // Backdate the challenge so it is already past PAIR_TTL_MS.
  challenge.expiresAt = new Date(Date.now() - 60_000).toISOString();

  const result = confirmPair({
    input: { ...envelope, code: challenge.code },
    state,
    cacheDir,
  });

  assert.equal(result.paired, false);
  assert.match(result.summary, /过期/);

  rmSync(cacheDir, { recursive: true, force: true });
});

test("startPair + confirmPair round-trip via the public createCommunicationGateway facade", () => {
  const cacheDir = makeTempCacheDir();
  const gateway = createCommunicationGateway({ cacheDir });

  const envelope = makeEnvelope({ id: "msg-round-trip" }).envelope;
  const challenge = gateway.startPair({ envelope });

  assert.match(challenge.code, /^\d{6}$/);

  const result = gateway.confirmPair({ ...envelope, code: challenge.code });
  assert.equal(result.paired, true);
  assert.equal(result.route.trusted, true);

  rmSync(cacheDir, { recursive: true, force: true });
});

test("registerMossCoderDevice via the public facade also persists", () => {
  const cacheDir = makeTempCacheDir();
  const gateway = createCommunicationGateway({ cacheDir });

  const result = gateway.registerMossCoderDevice({
    fcmToken: "long-enough-fcm-token-1234567890",
    label: "Facade Phone",
  });
  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);

  const state = gateway.listState();
  assert.equal(state.devices.length, 1);
  assert.equal(state.devices[0].label, "Facade Phone");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("handleMossCoderRelayEvent rejects malformed payloads with 422", async () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const seenMessages = new Map();
  const controlPlaneClient = async () => ({ accepted: true });

  // No idempotencyKey → must fail.
  const result = await handleMossCoderRelayEvent({
    input: { workspaceId: "ws", sessionId: "sess", actor: "human", type: "human.message" },
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 422);
  assert.match(result.error, /idempotencyKey/);

  rmSync(cacheDir, { recursive: true, force: true });
});

test("handleMossCoderRelayEvent ignores non-human events and does not touch state", async () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const seenMessages = new Map();
  let controlPlaneCalls = 0;
  const controlPlaneClient = async () => {
    controlPlaneCalls++;
    return { accepted: true };
  };

  const result = await handleMossCoderRelayEvent({
    input: {
      idempotencyKey: "abcdef12",
      workspaceId: "ws_local",
      projectId: "epap",
      sessionId: "sess-1",
      actor: "agent",
      type: "agent.message",
      payload: { _type: "agent.message", title: "auto", body: "auto-body" },
    },
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "ignored");
  assert.equal(controlPlaneCalls, 0, "control-plane must not be called for non-human events");
  assert.equal(Object.keys(state.routes).length, 0, "no route should be created for ignored events");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("handleMossCoderRelayEvent accepts a valid human.message and routes through the control-plane client", async () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const seenMessages = new Map();
  let lastControlPlanePayload;
  const controlPlaneClient = async (payload) => {
    lastControlPlanePayload = payload;
    return {
      accepted: true,
      job: { id: "job-1", status: "received" },
      latestEvent: { id: "ev-1", type: "received", jobId: "job-1" },
      response: { text: "已接收" },
    };
  };

  const result = await handleMossCoderRelayEvent({
    input: {
      idempotencyKey: "abcdef1234",
      workspaceId: "ws_local",
      projectId: "epap",
      sessionId: "sess-1",
      actor: "human",
      type: "human.message",
      payload: {
        _type: "human.message",
        title: "User",
        body: "看下当前项目的状态",
      },
    },
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });

  assert.equal(result.ignored, false);
  assert.equal(result.accepted, true);
  assert.equal(result.job?.id, "job-1");
  assert.ok(lastControlPlanePayload, "control-plane should have been called");
  assert.equal(lastControlPlanePayload.envelope.channel, "mosscoder");
  assert.equal(lastControlPlanePayload.envelope.text, "看下当前项目的状态");
  // The relay path should have trusted the mosscoder route so subsequent messages flow.
  const routeKey = "mosscoder:sess-1:android-user";
  assert.equal(state.routes[routeKey]?.trusted, true);

  // Receipt should be persisted.
  const receipts = Object.values(state.receipts);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].channel, "mosscoder");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("handleMossCoderRelayEvent is idempotent on the same idempotencyKey", async () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const seenMessages = new Map();
  let calls = 0;
  const controlPlaneClient = async () => {
    calls++;
    return {
      accepted: true,
      job: { id: "job-idem", status: "received" },
      latestEvent: { id: "ev-idem", type: "received", jobId: "job-idem" },
    };
  };

  const event = {
    idempotencyKey: "abcdef9999",
    workspaceId: "ws_local",
    projectId: "epap",
    sessionId: "sess-idem",
    actor: "human",
    type: "human.message",
    payload: { _type: "human.message", title: "U", body: "帮我看一下" },
  };

  const first = await handleMossCoderRelayEvent({
    input: event,
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });
  const second = await handleMossCoderRelayEvent({
    input: event,
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });

  assert.equal(first.accepted, true);
  assert.deepEqual(second, first, "second call should return the cached response");
  assert.equal(calls, 1, "control-plane must not be re-invoked for a duplicate idempotencyKey");

  rmSync(cacheDir, { recursive: true, force: true });
});

test("handleMossCoderRelayEvent rejects when payload _type does not match event type", async () => {
  const cacheDir = makeTempCacheDir();
  const state = makeFreshState();
  const seenMessages = new Map();
  const controlPlaneClient = async () => ({ accepted: true });

  const result = await handleMossCoderRelayEvent({
    input: {
      idempotencyKey: "abcdef8888",
      workspaceId: "ws",
      sessionId: "sess",
      actor: "human",
      type: "human.message",
      payload: { _type: "agent.message", title: "T", body: "B" },
    },
    state,
    cacheDir,
    seenMessages,
    controlPlaneClient,
  });
  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 422);
  assert.match(result.error, /_type/);

  rmSync(cacheDir, { recursive: true, force: true });
});