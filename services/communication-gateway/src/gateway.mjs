import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fromCcConnectMessage, fromFeishuMessage, fromMossCoderMessage, fromWeChatMessage, renderCommunicationResponse } from "./envelopes.mjs";

const DEFAULT_CONTROL_PLANE_URL = "http://127.0.0.1:8092";
const DEFAULT_CACHE_DIR = ".cache/epap-communication-gateway";
const PAIR_TTL_MS = 10 * 60 * 1000;

export function createCommunicationGateway(options = {}) {
  const cacheDir = resolve(options.cacheDir || process.env.AXI_WORKSTATION_COMMUNICATION_CACHE_DIR || process.env.EPAP_COMMUNICATION_CACHE_DIR || join(process.cwd(), DEFAULT_CACHE_DIR));
  const controlPlaneUrl = options.controlPlaneUrl || process.env.AXI_WORKSTATION_CONTROL_PLANE_URL || process.env.EPAP_CONTROL_PLANE_URL || DEFAULT_CONTROL_PLANE_URL;
  const controlPlaneClient = options.controlPlaneClient || ((message) => postJson(`${controlPlaneUrl}/jobs`, message));
  const controlPlaneEventsClient = options.controlPlaneEventsClient || ((jobId, afterEventId = "") => {
    const query = afterEventId ? `?afterEventId=${encodeURIComponent(afterEventId)}` : "";
    return getJson(`${controlPlaneUrl}/jobs/${encodeURIComponent(jobId)}/events${query}`);
  });
  const state = loadState(cacheDir);
  const seenMessages = new Map();

  return {
    cacheDir,
    state,
    startPair: (input) => startPair({ input, state, cacheDir }),
    confirmPair: (input) => confirmPair({ input, state, cacheDir }),
    handleTransportMessage: (channel, input) => handleTransportMessage({ channel, input, state, cacheDir, seenMessages, controlPlaneClient }),
    registerMossCoderDevice: (input) => registerMossCoderDevice({ input, state, cacheDir }),
    handleMossCoderRelayEvent: (input) => handleMossCoderRelayEvent({ input, state, cacheDir, seenMessages, controlPlaneClient }),
    pollMossCoderEvents: (input = {}) => pollMossCoderEvents({ input, state, cacheDir, controlPlaneEventsClient }),
    renderResponse: renderCommunicationResponse,
    sendResponse: (channel, input) => sendResponse({ channel, input }),
    listState: () => ({
      routes: Object.values(state.routes),
      pairings: Object.values(state.pairings),
      approvals: Object.values(state.approvals),
      attachments: Object.values(state.attachments),
      receipts: Object.values(state.receipts),
      devices: Object.values(state.devices),
      mossCoderOutbox: Object.values(state.mossCoderOutbox),
    }),
  };
}

export async function handleTransportMessage({ channel, input, state, cacheDir, seenMessages, controlPlaneClient }) {
  const message = adaptByChannel(channel, input);
  const envelope = message.envelope;
  const routeKey = routeKeyFor(envelope);
  const text = envelope.text.trim();

  if (seenMessages.has(envelope.id)) {
    return seenMessages.get(envelope.id);
  }

  const pairCode = parsePairCommand(text);
  if (pairCode) {
    const result = confirmPair({ input: { ...envelope, routeKey, code: pairCode }, state, cacheDir });
    const response = {
      ignored: false,
      paired: result.paired,
      response: {
        channel: envelope.channel,
        conversationId: envelope.conversationId,
        text: result.paired ? "配对成功，当前会话已接入 Axi Workstation。" : result.summary,
        format: envelope.channel === "feishu" ? "feishu_markdown" : "markdown",
        language: "zh-CN",
      },
    };
    seenMessages.set(envelope.id, response);
    return response;
  }

  const approval = parseApprovalDecision(text);
  if (approval) {
    const decision = decideApproval({ input: { ...approval, routeKey }, state, cacheDir });
    const response = {
      ignored: false,
      approval: decision.approval,
      response: {
        channel: envelope.channel,
        conversationId: envelope.conversationId,
        text: decision.summary,
        format: envelope.channel === "feishu" ? "feishu_markdown" : "markdown",
        language: "zh-CN",
      },
    };
    seenMessages.set(envelope.id, response);
    return response;
  }

  const route = state.routes[routeKey];
  if (!route?.trusted) {
    const challenge = ensurePairing({ envelope, routeKey, state, cacheDir });
    const response = {
      ignored: true,
      pairingRequired: true,
      challenge,
      response: {
        channel: envelope.channel,
        conversationId: envelope.conversationId,
        text: `该会话尚未配对。请在聊天中发送：/pair ${challenge.code}`,
        format: envelope.channel === "feishu" ? "feishu_markdown" : "markdown",
        language: "zh-CN",
      },
    };
    seenMessages.set(envelope.id, response);
    return response;
  }

  const attachments = normalizeAttachments({ input, envelope, routeKey, state, cacheDir });
  if (attachments.length) saveState(cacheDir, state);
  const result = await controlPlaneClient({
    envelope: {
      ...envelope,
      raw: {
        ...envelope.raw,
        routeKey,
        routeProfile: route.profile,
        runtimePreference: route.runtimePreference,
        attachments,
      },
    },
  });
  const receipt = {
    id: randomUUID(),
    routeKey,
    messageId: envelope.id,
    channel: envelope.channel,
    conversationId: envelope.conversationId,
    workspaceId: envelope.raw?.workspaceId,
    projectId: envelope.raw?.projectId,
    sessionId: envelope.raw?.sessionId || envelope.conversationId,
    jobId: result.job?.id,
    status: result.accepted ? "accepted" : "completed",
    lastDeliveredEventId: result.latestEvent?.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.receipts[receipt.id] = receipt;
  if (envelope.channel === "mosscoder" && result.response?.text) {
    enqueueMossCoderAgentMessage({
      state,
      receipt,
      sourceId: result.response.id || `${receipt.id}:accepted`,
      title: "Axi Workstation 已接收任务",
      body: bodyForAcceptedJob(result.job, result.latestEvent),
      terminal: false,
      job: result.job,
      taskEvent: result.latestEvent,
      eventTypeOverride: "workflow.job.accepted",
    });
  }
  saveState(cacheDir, state);
  const response = {
    ignored: false,
    accepted: result.accepted,
    job: result.job,
    latestEvent: result.latestEvent,
    receipt,
    run: result.run,
    attachments,
    response: renderCommunicationResponse(result),
  };
  seenMessages.set(envelope.id, response);
  return response;
}

async function pollMossCoderEvents({ input, state, cacheDir, controlPlaneEventsClient }) {
  const sessionId = String(input.sessionId || "").trim();
  const after = String(input.after || input.afterIdempotencyKey || "").trim();
  for (const receipt of Object.values(state.receipts)) {
    if (receipt.channel !== "mosscoder" || !receipt.jobId) continue;
    if (sessionId && receipt.sessionId !== sessionId && receipt.conversationId !== sessionId) continue;
    if (receipt.status === "completed" || receipt.status === "failed") continue;
    let result;
    try {
      result = await controlPlaneEventsClient(receipt.jobId, receipt.lastDeliveredEventId || "");
    } catch (error) {
      enqueueMossCoderAgentMessage({
        state,
        receipt,
        sourceId: `${receipt.jobId}:poll-error-terminal:${receipt.lastDeliveredEventId || "start"}`,
        title: "Axi Workstation 进度同步中断",
        body: bodyForProgressSyncError(receipt.jobId, error),
        terminal: true,
      });
      receipt.status = "failed";
      receipt.updatedAt = new Date().toISOString();
      continue;
    }
    const events = Array.isArray(result?.events) ? result.events : [];
    for (const event of events) {
      enqueueMossCoderAgentMessage({
        state,
        receipt,
        sourceId: event.id,
        title: titleForTaskEvent(event),
        body: bodyForTaskEvent(event, receipt.jobId),
        terminal: isTerminalTaskEvent(event),
        taskEvent: event,
      });
      receipt.lastDeliveredEventId = event.id;
      if (event.type === "completed") receipt.status = "completed";
      if (event.type === "failed" || event.type === "cancelled") receipt.status = "failed";
      receipt.updatedAt = new Date().toISOString();
    }
  }
  saveState(cacheDir, state);
  return {
    status: "ok",
    events: mossCoderOutboxEventsForSession({ state, sessionId, after }),
  };
}

function enqueueMossCoderAgentMessage({ state, receipt, sourceId, title, body, terminal, job, taskEvent, eventTypeOverride }) {
  state.mossCoderOutbox ||= {};
  const idempotencyKey = `epap:${receipt.jobId || receipt.id}:${sourceId}`;
  if (state.mossCoderOutbox[idempotencyKey]) return state.mossCoderOutbox[idempotencyKey];
  const now = new Date().toISOString();
  const status = taskEvent?.status || job?.status || job?.currentStage || "queued";
  const eventType = eventTypeOverride || (terminal
    ? (status === "failed" || status === "cancelled" || status === "policy_violation" ? "workflow.job.failed" : "workflow.job.completed")
    : "workflow.job.event");
  const event = {
    idempotencyKey,
    workspaceId: receipt.workspaceId || "ws_local",
    projectId: receipt.projectId || "epap",
    sessionId: receipt.sessionId || receipt.conversationId,
    actor: "agent",
    type: eventType,
    payload: {
      _type: eventType,
      title,
      body,
      jobId: receipt.jobId,
      taskKind: job?.assessment?.kind,
      status,
      stage: status,
      role: taskEvent?.role,
      agentRunId: taskEvent?.data?.runId || taskEvent?.data?.agentRunId,
      progressMessage: taskEvent?.message || body,
      risk: job?.assessment?.risk,
      complexity: job?.assessment?.complexity,
      estimatedDuration: job?.assessment?.estimatedDuration,
      auditId: receipt.jobId,
      collapseKey: receipt.sessionId || receipt.conversationId,
      terminal: Boolean(terminal),
    },
    createdAt: now,
  };
  state.mossCoderOutbox[idempotencyKey] = event;
  return event;
}

function mossCoderOutboxEventsForSession({ state, sessionId, after }) {
  state.mossCoderOutbox ||= {};
  const events = Object.values(state.mossCoderOutbox)
    .filter((event) => !sessionId || event.sessionId === sessionId)
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
  if (!after) return events;
  const index = events.findIndex((event) => event.idempotencyKey === after);
  return index >= 0 ? events.slice(index + 1) : events;
}

function titleForTaskEvent(event) {
  if (event.type === "completed") return "Axi Workstation 任务已完成";
  if (event.type === "failed" || event.type === "cancelled") return "Axi Workstation 任务未完成";
  if (event.type === "heartbeat") return "Axi Workstation 任务仍在执行";
  if (event.type === "audit") return "Axi Workstation 审计进度";
  if (event.type === "archive") return "Axi Workstation 归档进度";
  return "Axi Workstation 任务进度";
}

function bodyForTaskEvent(event, jobId) {
  const stage = event.status ? `当前阶段：${stageLabel(event.status)}` : "";
  const role = event.role ? `负责角色：${roleLabel(event.role)}` : "";
  return [
    `任务：${shortJobId(jobId)}`,
    stage,
    role,
    cleanTaskMessage(event.message),
    `审计编号：${jobId}`,
  ].filter(Boolean).join("\n");
}

function bodyForAcceptedJob(job, latestEvent) {
  const jobId = job?.id || latestEvent?.jobId || "unknown";
  const assessment = job?.assessment;
  const stage = latestEvent?.status || job?.status || job?.currentStage || "queued";
  return [
    `任务：${shortJobId(jobId)}`,
    `类型：${taskKindLabel(assessment?.kind)} · ${complexityLabel(assessment?.complexity)}`,
    `当前阶段：${stageLabel(stage)}`,
    assessment?.summary ? `评估：${assessment.summary}` : "",
    `下次更新：约 ${assessment?.nextUpdateSeconds || 30} 秒内`,
    `审计编号：${jobId}`,
  ].filter(Boolean).join("\n");
}

function bodyForProgressSyncError(jobId, error) {
  return [
    `任务：${shortJobId(jobId)}`,
    "当前阶段：进度同步中断",
    "说明：本地控制面暂时无法读取这个任务的后续事件，可能是服务重启或任务记录已清理。",
    "你可以直接继续发送新指令，我会重新建立任务链路。",
    `审计编号：${jobId}`,
    `技术原因：${error?.message || String(error)}`,
  ].filter(Boolean).join("\n");
}

function shortJobId(jobId) {
  const value = String(jobId || "").trim();
  if (!value || value === "unknown") return "未分配";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function stageLabel(stage) {
  const value = String(stage || "").trim().toLowerCase();
  const labels = {
    received: "已接收",
    assessed: "已评估",
    queued: "已入队",
    planning: "规划中",
    documenting: "文档整理中",
    executing: "执行中",
    worker_self_audit: "Worker 自检中",
    master_collecting: "Master 汇总中",
    auditing: "审计中",
    rejected_rework: "退回返工",
    passed: "审计通过",
    archiving: "归档中",
    notified: "已通知",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[value] || stage || "未知";
}

function roleLabel(role) {
  const value = String(role || "").trim().toLowerCase();
  const labels = {
    master: "Master 调度",
    worker: "Worker 执行",
    auditor: "Auditor 审计",
    librarian: "Librarian 文档归档",
  };
  return labels[value] || role;
}

function taskKindLabel(kind) {
  const value = String(kind || "").trim().toLowerCase();
  const labels = {
    chat: "聊天",
    coworker: "协作",
    code: "编码",
    ops: "运维",
    docs: "文档",
  };
  return labels[value] || "任务";
}

function complexityLabel(complexity) {
  const value = String(complexity || "").trim().toLowerCase();
  const labels = {
    low: "轻量",
    medium: "中等",
    high: "复杂",
  };
  return labels[value] || "待评估";
}

function cleanTaskMessage(message) {
  return String(message || "")
    .replace(/\b(received|assessed|queued|planning|documenting|executing|worker_self_audit|master_collecting|auditing|rejected_rework|passed|archiving|notified|completed|failed|cancelled)\b/g, (matched) => stageLabel(matched))
    .trim();
}

function isTerminalTaskEvent(event) {
  return event.type === "completed" || event.type === "failed" || event.type === "cancelled";
}

export function startPair({ input, state, cacheDir }) {
  const envelope = input.envelope || input;
  const routeKey = input.routeKey || routeKeyFor(envelope);
  const now = new Date();
  const challenge = {
    id: randomUUID(),
    routeKey,
    channel: envelope.channel,
    conversationId: envelope.conversationId,
    senderId: envelope.senderId,
    code: String(Math.floor(100000 + Math.random() * 900000)),
    status: "pending",
    expiresAt: new Date(now.getTime() + PAIR_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
  };
  state.pairings[challenge.id] = challenge;
  saveState(cacheDir, state);
  return challenge;
}

export function confirmPair({ input, state, cacheDir }) {
  const routeKey = input.routeKey || routeKeyFor(input);
  const now = new Date();
  const challenge = Object.values(state.pairings).find((item) =>
    item.routeKey === routeKey &&
    item.code === input.code &&
    item.status === "pending"
  );
  if (!challenge) {
    return { paired: false, summary: "配对失败：配对码不存在或已使用。" };
  }
  if (new Date(challenge.expiresAt).getTime() < now.getTime()) {
    challenge.status = "expired";
    saveState(cacheDir, state);
    return { paired: false, summary: "配对失败：配对码已过期，请重新发起配对。" };
  }

  challenge.status = "confirmed";
  challenge.confirmedAt = now.toISOString();
  state.routes[routeKey] = {
    id: state.routes[routeKey]?.id || randomUUID(),
    routeKey,
    channel: challenge.channel,
    conversationId: challenge.conversationId,
    senderId: challenge.senderId,
    trusted: true,
    profile: profileForChannel(challenge.channel),
    runtimePreference: challenge.channel === "mosscoder" ? "codex_app" : "codex_cli",
    createdAt: state.routes[routeKey]?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
  };
  saveState(cacheDir, state);
  return { paired: true, route: state.routes[routeKey], challenge };
}

export function decideApproval({ input, state, cacheDir }) {
  const approval = state.approvals[input.id];
  if (!approval || approval.routeKey !== input.routeKey) {
    return { decided: false, summary: "审批失败：未找到该会话下的审批请求。" };
  }
  if (approval.status !== "pending") {
    return { decided: false, approval, summary: `审批已处理：${approval.status}` };
  }
  approval.status = input.decision === "approved" ? "approved" : "rejected";
  approval.decisionText = input.decisionText || "";
  approval.decidedAt = new Date().toISOString();
  saveState(cacheDir, state);
  return { decided: true, approval, summary: approval.status === "approved" ? `已批准审批：${approval.id}` : `已拒绝审批：${approval.id}` };
}

function ensurePairing({ envelope, routeKey, state, cacheDir }) {
  const existing = Object.values(state.pairings).find((item) => item.routeKey === routeKey && item.status === "pending");
  if (existing) return existing;
  return startPair({ input: { ...envelope, routeKey }, state, cacheDir });
}

function normalizeAttachments({ input, envelope, routeKey, state, cacheDir }) {
  const rawAttachments = Array.isArray(input.attachments) ? input.attachments : Array.isArray(envelope.raw?.attachments) ? envelope.raw.attachments : [];
  return rawAttachments.map((item) => {
    const attachment = {
      id: item.id || randomUUID(),
      routeKey,
      channel: envelope.channel,
      filename: item.filename || item.name || "attachment",
      mimeType: item.mimeType || item.contentType,
      sizeBytes: Number.isInteger(item.sizeBytes) ? item.sizeBytes : undefined,
      storagePath: item.storagePath || item.path || join(cacheDir, "uploads", item.filename || item.name || "attachment"),
      createdAt: item.createdAt || new Date().toISOString(),
    };
    state.attachments[attachment.id] = attachment;
    return attachment;
  });
}

function registerMossCoderDevice({ input, state, cacheDir }) {
  const token = String(input.fcmToken || input.token || "").trim();
  if (token.length < 10) {
    return { ok: false, statusCode: 422, error: "fcmToken too short" };
  }
  const device = {
    id: state.devices[token]?.id || randomUUID(),
    fcmToken: token,
    label: input.label || "MossCoder Android",
    channel: "mosscoder",
    trusted: true,
    updatedAt: new Date().toISOString(),
  };
  state.devices[token] = device;
  saveState(cacheDir, state);
  return { ok: true, statusCode: 200, deviceDbId: device.id };
}

async function handleMossCoderRelayEvent({ input, state, cacheDir, seenMessages, controlPlaneClient }) {
  const event = normalizeMossCoderRelayEvent(input);
  if (event.error) {
    return { ok: false, statusCode: 422, error: event.error };
  }
  if (event.actor !== "human" || event.type !== "human.message") {
    return { ok: true, statusCode: 200, status: "ignored", summary: `已忽略非用户输入事件：${event.actor}/${event.type}` };
  }
  const payload = event.payload || {};
  const envelope = {
    id: event.idempotencyKey,
    channel: "mosscoder",
    conversationId: event.sessionId,
    senderId: "android-user",
    text: String(payload.body || "").trim(),
    receivedAt: new Date().toISOString(),
    raw: {
      provider: "mosscoder-relay",
      workspaceId: event.workspaceId,
      projectId: event.projectId,
      sessionId: event.sessionId,
      idempotencyKey: event.idempotencyKey,
      title: payload.title,
    },
  };
  const routeKey = routeKeyFor(envelope);
  trustRoute({ envelope, routeKey, state, cacheDir, profile: "workbench", runtimePreference: "codex_cli" });
  return handleTransportMessage({ channel: "mosscoder", input: { envelope }, state, cacheDir, seenMessages, controlPlaneClient });
}

function normalizeMossCoderRelayEvent(input = {}) {
  const payload = typeof input.payload === "string" ? parseJson(input.payload, {}) : (input.payload || {});
  const event = {
    idempotencyKey: String(input.idempotencyKey || "").trim(),
    workspaceId: String(input.workspaceId || "").trim(),
    projectId: String(input.projectId || "").trim(),
    sessionId: String(input.sessionId || "").trim(),
    actor: String(input.actor || "").trim(),
    type: String(input.type || "").trim(),
    payload,
  };
  if (event.idempotencyKey.length < 8) return { error: "idempotencyKey required (min 8)" };
  if (!event.workspaceId || !event.sessionId) return { error: "workspaceId and sessionId required" };
  if (!["human", "agent", "system"].includes(event.actor)) return { error: "actor must be human|agent|system" };
  if (!["ping", "agent.message", "human.message", "todo", "workflow.job.accepted", "workflow.job.event", "workflow.job.completed", "workflow.job.failed"].includes(event.type)) return { error: "unsupported type" };
  if (payload._type !== event.type) return { error: `payload._type must match ${event.type}` };
  if (event.type.endsWith(".message") && (!payload.title || !payload.body)) return { error: "title and body required" };
  if (event.type.startsWith("workflow.job.") && (!payload.title || !payload.body || !payload.jobId)) return { error: "title, body and jobId required" };
  return event;
}

function trustRoute({ envelope, routeKey, state, cacheDir, profile, runtimePreference }) {
  state.routes[routeKey] = {
    id: state.routes[routeKey]?.id || randomUUID(),
    routeKey,
    channel: envelope.channel,
    conversationId: envelope.conversationId,
    senderId: envelope.senderId,
    trusted: true,
    profile: profile || profileForChannel(envelope.channel),
    runtimePreference: runtimePreference || (envelope.channel === "mosscoder" ? "codex_app" : "codex_cli"),
    createdAt: state.routes[routeKey]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveState(cacheDir, state);
  return state.routes[routeKey];
}

function adaptByChannel(channel, input) {
  if (input?.envelope) return { envelope: input.envelope };
  if (channel === "feishu") return fromFeishuMessage(input);
  if (channel === "mosscoder") return fromMossCoderMessage(input);
  if (channel === "wechat") return fromWeChatMessage(input);
  if (channel === "cc-connect") return fromCcConnectMessage(input);
  return { envelope: input.envelope || input };
}

function sendResponse({ channel, input }) {
  return {
    delivered: false,
    channel,
    summary: "当前版本只生成可投递响应，不直接调用 IM 发送 SDK。",
    response: renderCommunicationResponse(input),
  };
}

function parsePairCommand(text) {
  const matched = String(text || "").trim().match(/^\/pair\s+(\S+)$/i);
  return matched?.[1] || "";
}

function parseApprovalDecision(text) {
  const matched = String(text || "").trim().match(/^\/(OK|NO)\s+(\S+)(?:\s+(.+))?$/i);
  if (!matched) return null;
  return {
    decision: matched[1].toUpperCase() === "OK" ? "approved" : "rejected",
    id: matched[2],
    decisionText: matched[3] || "",
  };
}

function profileForChannel(channel) {
  if (channel === "mosscoder") return "workbench";
  if (channel === "wechat") return "wechat_private";
  return "intelligence";
}

function routeKeyFor(envelope) {
  return [envelope.channel, envelope.conversationId, envelope.senderId].join(":");
}

function loadState(cacheDir) {
  const statePath = join(cacheDir, "state.json");
  if (!existsSync(statePath)) {
    return emptyState();
  }
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8"));
    return {
      routes: parsed.routes || {},
      pairings: parsed.pairings || {},
      approvals: parsed.approvals || {},
      attachments: parsed.attachments || {},
      receipts: parsed.receipts || {},
      devices: parsed.devices || {},
      mossCoderOutbox: parsed.mossCoderOutbox || {},
    };
  } catch {
    return emptyState();
  }
}

function emptyState() {
  return { routes: {}, pairings: {}, approvals: {}, attachments: {}, receipts: {}, devices: {}, mossCoderOutbox: {} };
}

function saveState(cacheDir, state) {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`control-plane request failed: ${response.status}`);
  }
  return response.json();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`control-plane request failed: ${response.status}`);
  }
  return response.json();
}
