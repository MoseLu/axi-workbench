import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fromCcConnectMessage, fromFeishuMessage, fromMossCoderMessage, fromWeChatMessage, renderCommunicationResponse } from "../src/envelopes.mjs";
import { createCommunicationGateway } from "../src/gateway.mjs";
import { createControlPlane } from "../../control-plane/src/control-plane.mjs";

async function waitFor(predicate, timeoutMs = 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return predicate();
}

test("normalizes Feishu messages into a control-plane IMEnvelope", () => {
  const message = fromFeishuMessage({
    raw: {
      message: {
        message_id: "m1",
        chat_id: "chat-1",
        content: "{\"text\":\"当前项目有哪些？\"}",
      },
      sender: { sender_id: { open_id: "ou-user" } },
    },
  });

  assert.equal(message.envelope.id, "m1");
  assert.equal(message.envelope.channel, "feishu");
  assert.equal(message.envelope.conversationId, "chat-1");
  assert.equal(message.envelope.senderId, "ou-user");
  assert.equal(message.envelope.text, "当前项目有哪些？");
});

test("normalizes cc-connect transport messages at the communication layer", () => {
  const message = fromCcConnectMessage({
    id: "cc-m1",
    session_key: "feishu:chat:user",
    platform: "feishu",
    user_id: "ou-user",
    text: "当前项目有哪些？",
  });

  assert.equal(message.envelope.id, "cc-m1");
  assert.equal(message.envelope.channel, "feishu");
  assert.equal(message.envelope.conversationId, "feishu:chat:user");
  assert.equal(message.envelope.senderId, "ou-user");
  assert.equal(message.envelope.text, "当前项目有哪些？");
});

test("normalizes MossCoder and WeChat messages into IMEnvelope", () => {
  const moss = fromMossCoderMessage({ id: "m1", sessionId: "desk", userId: "u", prompt: "让 Codex 检查 ielts-vocab" });
  const wechat = fromWeChatMessage({ msg_id: "w1", fromUserName: "wx-user", content: "当前项目有哪些？" });

  assert.equal(moss.envelope.channel, "mosscoder");
  assert.equal(moss.envelope.text, "让 Codex 检查 ielts-vocab");
  assert.equal(wechat.envelope.channel, "wechat");
  assert.equal(wechat.envelope.conversationId, "wx-user");
});

test("renders control-plane responses without business decisions", () => {
  const rendered = renderCommunicationResponse({
    response: {
      channel: "feishu",
      conversationId: "chat-1",
      text: "**当前项目**\n\n1. `ielts-vocab`",
      format: "feishu_markdown",
      language: "zh-CN",
      auditId: "run-1",
    },
  });

  assert.equal(rendered.deliverable, true);
  assert.equal(rendered.channel, "feishu");
  assert.equal(rendered.format, "feishu_markdown");
  assert.equal(rendered.language, "zh-CN");
  assert.match(rendered.text, /当前项目/);
});

test("requires pairing before forwarding transport messages", async () => {
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async () => {
      throw new Error("unpaired messages must not reach control plane");
    },
  });

  const result = await gateway.handleTransportMessage("wechat", {
    msg_id: "w-pair-1",
    fromUserName: "wx-user",
    content: "当前项目有哪些？",
  });

  assert.equal(result.ignored, true);
  assert.equal(result.pairingRequired, true);
  assert.match(result.response.text, /\/pair/);
});

test("paired routes forward standard envelopes only once and keep attachment refs", async () => {
  const forwarded = [];
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async (message) => {
      forwarded.push(message);
      return {
        run: { id: "run-1", summary: "ok" },
        response: {
          channel: message.envelope.channel,
          conversationId: message.envelope.conversationId,
          text: "已收到",
          format: "markdown",
          language: "zh-CN",
          auditId: "run-1",
        },
      };
    },
  });

  const first = await gateway.handleTransportMessage("wechat", {
    msg_id: "w-pair-2",
    fromUserName: "wx-user",
    content: "hello",
  });
  const code = first.challenge.code;
  const paired = await gateway.handleTransportMessage("wechat", {
    msg_id: "w-pair-3",
    fromUserName: "wx-user",
    content: `/pair ${code}`,
  });
  const sent = await gateway.handleTransportMessage("wechat", {
    msg_id: "w-msg-1",
    fromUserName: "wx-user",
    content: "让 Codex 检查 ielts-vocab",
    attachments: [{ id: "att-1", filename: "a.png", storagePath: "/tmp/a.png" }],
  });
  const duplicate = await gateway.handleTransportMessage("wechat", {
    msg_id: "w-msg-1",
    fromUserName: "wx-user",
    content: "让 Codex 检查 ielts-vocab",
  });

  assert.equal(paired.paired, true);
  assert.equal(sent.ignored, false);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].envelope.channel, "wechat");
  assert.equal(forwarded[0].envelope.raw.attachments[0].id, "att-1");
  assert.equal(duplicate.response.text, sent.response.text);
});

test("approval commands create decisions without forwarding business messages", async () => {
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async () => ({ response: { channel: "wechat", conversationId: "wx-user", text: "ok", format: "markdown", language: "zh-CN", auditId: "run" } }),
  });
  const first = await gateway.handleTransportMessage("wechat", { msg_id: "w-app-1", fromUserName: "wx-user", content: "hello" });
  await gateway.handleTransportMessage("wechat", { msg_id: "w-app-2", fromUserName: "wx-user", content: `/pair ${first.challenge.code}` });
  gateway.state.approvals["approval-1"] = {
    id: "approval-1",
    routeKey: "wechat:wx-user:wx-user",
    actionSummary: "danger",
    riskLevel: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const decision = await gateway.handleTransportMessage("wechat", { msg_id: "w-app-3", fromUserName: "wx-user", content: "/NO approval-1 不执行" });

  assert.equal(decision.approval.status, "rejected");
  assert.match(decision.response.text, /已拒绝/);
});

test("paired MossCoder long tasks return accepted job cards without waiting for completion", async () => {
  const forwarded = [];
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async (message) => {
      forwarded.push(message);
      return {
        ignored: false,
        accepted: true,
        latestEvent: { id: "event-1", jobId: "job-1", type: "status", message: "queued", createdAt: new Date().toISOString() },
        job: {
          id: "job-1",
          envelope: message.envelope,
          status: "queued",
          assessment: { kind: "code", complexity: "medium", estimatedDuration: "minutes", requiresOrchestration: true, requiresAudit: true, requiresLibrarian: true, risk: "medium", summary: "code / medium / minutes", nextUpdateSeconds: 30 },
          currentStage: "queued",
          summary: "已入队",
          nextUpdateAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        response: {
          id: "response-1",
          channel: "mosscoder",
          conversationId: "desk",
          inReplyTo: message.envelope.id,
          text: "任务编号：`job-1`",
          format: "card",
          language: "zh-CN",
          auditId: "job-1",
          createdAt: new Date().toISOString(),
        },
      };
    },
  });
  const first = await gateway.handleTransportMessage("mosscoder", { id: "moss-pair-1", conversationId: "desk", senderId: "tester", text: "hello" });
  await gateway.handleTransportMessage("mosscoder", { id: "moss-pair-2", conversationId: "desk", senderId: "tester", text: `/pair ${first.challenge.code}` });
  const sent = await gateway.handleTransportMessage("mosscoder", { id: "moss-task-1", conversationId: "desk", senderId: "tester", text: "从0到1实现俄罗斯方块网页游戏" });
  const duplicate = await gateway.handleTransportMessage("mosscoder", { id: "moss-task-1", conversationId: "desk", senderId: "tester", text: "从0到1实现俄罗斯方块网页游戏" });

  assert.equal(sent.accepted, true);
  assert.equal(sent.job.id, "job-1");
  assert.equal(sent.response.format, "card");
  assert.equal(forwarded.length, 1);
  assert.equal(Object.values(gateway.state.receipts)[0].lastDeliveredEventId, "event-1");
  assert.equal(duplicate.job.id, sent.job.id);
});

test("MossCoder relay-compatible human.message events enter the control-plane job path", async () => {
  const forwarded = [];
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async (message) => {
      forwarded.push(message);
      return {
        ignored: false,
        accepted: true,
        latestEvent: { id: "event-relay-1", jobId: "job-relay-1", type: "status", message: "queued", createdAt: new Date().toISOString() },
        job: {
          id: "job-relay-1",
          envelope: message.envelope,
          status: "queued",
          assessment: { kind: "code", complexity: "medium", estimatedDuration: "minutes", requiresOrchestration: true, requiresAudit: true, requiresLibrarian: true, risk: "medium", summary: "code / medium / minutes", nextUpdateSeconds: 30 },
          currentStage: "queued",
          summary: "已入队",
          nextUpdateAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        response: {
          id: "response-relay-1",
          channel: "mosscoder",
          conversationId: "session-1",
          inReplyTo: message.envelope.id,
          text: "任务编号：`job-relay-1`",
          format: "card",
          language: "zh-CN",
          auditId: "job-relay-1",
          createdAt: new Date().toISOString(),
        },
      };
    },
  });

  const registered = gateway.registerMossCoderDevice({ fcmToken: "fake-token-12345", label: "adb-device" });
  const sent = await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-message-1",
    workspaceId: "ws-local",
    projectId: "axi-workstation-e2e",
    sessionId: "session-1",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "继续沟通",
      body: "从0到1实现俄罗斯方块网页游戏",
      collapseKey: "session-1",
    },
  });

  assert.equal(registered.ok, true);
  assert.equal(sent.accepted, true);
  assert.equal(sent.job.id, "job-relay-1");
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].envelope.channel, "mosscoder");
  assert.equal(forwarded[0].envelope.conversationId, "session-1");
  assert.equal(forwarded[0].envelope.text, "从0到1实现俄罗斯方块网页游戏");
  assert.equal(forwarded[0].envelope.raw.provider, "mosscoder-relay");
  assert.equal(Object.values(gateway.state.routes)[0].trusted, true);
});

test("MossCoder relay polling materializes job progress as structured workflow events", async () => {
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async (message) => ({
      ignored: false,
      accepted: true,
      latestEvent: { id: "event-1", jobId: "job-1", type: "status", message: "已入队", createdAt: new Date().toISOString() },
      job: {
        id: "job-1",
        envelope: message.envelope,
        status: "queued",
        assessment: { kind: "code", complexity: "medium", estimatedDuration: "minutes", requiresOrchestration: true, requiresAudit: true, requiresLibrarian: true, risk: "medium", summary: "code / medium / minutes", nextUpdateSeconds: 30 },
        currentStage: "queued",
        summary: "已入队",
        nextUpdateAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      response: {
        id: "response-1",
        channel: "mosscoder",
        conversationId: "session-1",
        inReplyTo: message.envelope.id,
        text: "任务编号：`job-1`\n状态：已入队",
        format: "card",
        language: "zh-CN",
        auditId: "job-1",
        createdAt: new Date().toISOString(),
      },
    }),
    controlPlaneEventsClient: async (jobId, afterEventId) => ({
      events: afterEventId === "event-1" ? [
        { id: "event-2", jobId, type: "heartbeat", status: "executing", message: "仍在执行，当前阶段：executing", createdAt: new Date().toISOString() },
        { id: "event-3", jobId, type: "completed", status: "completed", message: "任务完成，审计通过。", createdAt: new Date().toISOString() },
      ] : [],
    }),
  });

  const sent = await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-message-2",
    workspaceId: "ws-local",
    projectId: "axi-workstation-e2e",
    sessionId: "session-1",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "继续沟通",
      body: "从0到1实现俄罗斯方块网页游戏",
      collapseKey: "session-1",
    },
  });

  const firstPoll = await gateway.pollMossCoderEvents({ sessionId: "session-1" });
  const secondPoll = await gateway.pollMossCoderEvents({
    sessionId: "session-1",
    after: firstPoll.events.at(-1).idempotencyKey,
  });

  assert.equal(sent.job.id, "job-1");
  assert.equal(firstPoll.events.length, 3);
  assert.equal(firstPoll.events[0].actor, "agent");
  assert.equal(firstPoll.events[0].type, "workflow.job.accepted");
  assert.equal(firstPoll.events[0].payload._type, "workflow.job.accepted");
  assert.equal(firstPoll.events[0].payload.jobId, "job-1");
  assert.match(firstPoll.events[0].payload.title, /Axi Workstation/);
  assert.equal(firstPoll.events[0].payload.taskKind, "code");
  assert.equal(firstPoll.events[0].payload.stage, "queued");
  assert.match(firstPoll.events[0].payload.body, /任务：job-1/);
  assert.match(firstPoll.events[0].payload.body, /当前阶段：已入队/);
  assert.doesNotMatch(firstPoll.events[0].payload.body, /任务编号/);
  assert.equal(firstPoll.events[1].type, "workflow.job.event");
  assert.equal(firstPoll.events[1].payload.stage, "executing");
  assert.match(firstPoll.events[1].payload.body, /当前阶段：执行中/);
  assert.match(firstPoll.events[1].payload.body, /仍在执行/);
  assert.equal(firstPoll.events[2].type, "workflow.job.completed");
  assert.equal(firstPoll.events[2].payload.stage, "completed");
  assert.equal(firstPoll.events[2].payload.terminal, true);
  assert.equal(Object.values(gateway.state.receipts)[0].status, "completed");
  assert.deepEqual(secondPoll.events, []);
});

test("MossCoder relay polling turns missing job progress into a terminal readable event", async () => {
  const gateway = createCommunicationGateway({
    cacheDir: mkdtempSync(join(tmpdir(), "epap-gateway-")),
    controlPlaneClient: async (message) => ({
      ignored: false,
      accepted: true,
      latestEvent: { id: "event-1", jobId: "job-404", type: "status", status: "queued", message: "已入队", createdAt: new Date().toISOString() },
      job: {
        id: "job-404",
        envelope: message.envelope,
        status: "queued",
        assessment: { kind: "code", complexity: "medium", estimatedDuration: "minutes", requiresOrchestration: true, requiresAudit: true, requiresLibrarian: true, risk: "medium", summary: "code / medium / minutes", nextUpdateSeconds: 30 },
        currentStage: "queued",
        summary: "已入队",
        nextUpdateAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      response: {
        id: "response-404",
        channel: "mosscoder",
        conversationId: "session-404",
        inReplyTo: message.envelope.id,
        text: "任务编号：`job-404`",
        format: "card",
        language: "zh-CN",
        auditId: "job-404",
        createdAt: new Date().toISOString(),
      },
    }),
    controlPlaneEventsClient: async () => {
      throw new Error("control-plane request failed: 404");
    },
  });

  await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-message-404",
    workspaceId: "ws-local",
    projectId: "axi-workstation-e2e",
    sessionId: "session-404",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "继续沟通",
      body: "查看任务进度",
      collapseKey: "session-404",
    },
  });

  const polled = await gateway.pollMossCoderEvents({ sessionId: "session-404" });

  assert.equal(polled.events.at(-1).payload.terminal, true);
  assert.match(polled.events.at(-1).payload.body, /进度同步中断/);
  assert.match(polled.events.at(-1).payload.body, /可以直接继续发送新指令/);
  assert.equal(Object.values(gateway.state.receipts)[0].status, "failed");
});

test("Axi Mobile read-only fleet health query closes the Workstation audit and notify loop", async () => {
  const root = mkdtempSync(join(tmpdir(), "axi-workstation-e2e-"));
  mkdirSync(join(root, "infra", "fleet-console"), { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({
    projects: {
      "fleet-console": {
        path: join(root, "infra", "fleet-console"),
        kind: "ops-tool",
        provides: ["server-fleet-registry"],
        health: ["node -e \"console.log('fleet healthy')\""],
        contracts: [],
      },
    },
    profiles: {},
  }));
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".control-cache"),
    memoryDatabaseUrl: null,
  });
  const gateway = createCommunicationGateway({
    cacheDir: join(root, ".gateway-cache"),
    controlPlaneClient: (message) => controlPlane.createJob(message),
    controlPlaneEventsClient: (jobId, afterEventId) => controlPlane.getJobEvents(jobId, { afterEventId }),
  });

  const sent = await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-health-1",
    workspaceId: "ws-local",
    projectId: "axi-ops",
    sessionId: "mobile-health",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "只读巡检",
      body: "检查 fleet-console 健康",
      collapseKey: "mobile-health",
    },
  });
  const completed = await waitFor(() => {
    const job = controlPlane.getJob(sent.job.id);
    return job?.status === "completed" ? job : null;
  });
  const events = controlPlane.getJobEvents(sent.job.id).events;
  const task = controlPlane.getAgentTask(completed.metadata.agentTaskId);
  const notificationEvents = await gateway.pollMossCoderEvents({ sessionId: "mobile-health" });

  assert.equal(sent.accepted, true);
  assert.equal(completed.status, "completed");
  assert.equal(task.runtime, "registered_command");
  assert.equal(task.targetId, "fleet-console");
  assert.match(task.stdout, /fleet healthy/);
  assert.ok(events.some((event) => event.type === "audit" && event.data.verdict === "pass"));
  assert.ok(controlPlane.getJobArtifacts(sent.job.id).artifacts.some((artifact) => artifact.path.endsWith("registered-command.json")));
  assert.ok(notificationEvents.events.some((event) => event.type === "workflow.job.completed"));
});

test("Axi Mobile can request an Axi Agent quality audit and receive a terminal event", async () => {
  const root = mkdtempSync(join(tmpdir(), "axi-agent-mobile-e2e-"));
  const agentPath = join(root, "projects", "enterprise-workspace", "projects", "axi-agent-platform");
  mkdirSync(agentPath, { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({
    projects: {
      "axi-agent": {
        path: agentPath,
        kind: "agent-owner",
        provides: ["agent-task-runtime"],
        contracts: [],
      },
    },
    profiles: {},
  }));
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".control-cache"),
    memoryDatabaseUrl: null,
    axiAgentTaskExecutor: async (request) => ({
      agentTaskId: request.agentTaskId,
      runtime: "axi_agent_mcp",
      status: "succeeded",
      passed: true,
      source: "axi-agent-mcp",
      tool: "swarm_validate_with_gates",
      summary: "Axi Agent quality gate passed.",
      text: "质量门控验证结果",
    }),
  });
  const gateway = createCommunicationGateway({
    cacheDir: join(root, ".gateway-cache"),
    controlPlaneClient: (message) => controlPlane.createJob(message),
    controlPlaneEventsClient: (jobId, afterEventId) => controlPlane.getJobEvents(jobId, { afterEventId }),
  });

  const sent = await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-agent-audit-1",
    workspaceId: "ws-local",
    projectId: "axi-agent",
    sessionId: "mobile-agent-audit",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "Agent 审计",
      body: "让 axi-agent 审计 function add(a, b) { return a + b; }",
      collapseKey: "mobile-agent-audit",
    },
  });
  const completed = await waitFor(() => {
    const job = controlPlane.getJob(sent.job.id);
    return job?.status === "completed" ? job : null;
  });
  const events = await gateway.pollMossCoderEvents({ sessionId: "mobile-agent-audit" });

  assert.equal(completed.metadata.executionMode, "axi_agent");
  assert.equal(controlPlane.getAgentTask(completed.metadata.agentTaskId).runtime, "axi_agent");
  assert.ok(controlPlane.getJobArtifacts(sent.job.id).artifacts.some((artifact) => artifact.path.endsWith("axi-agent-task.json")));
  assert.ok(events.events.some((event) => event.type === "workflow.job.completed"));
});

test("Axi Mobile can request an Axi Agent read-only tool result and receive a terminal event", async () => {
  const root = mkdtempSync(join(tmpdir(), "axi-agent-mobile-tool-e2e-"));
  const agentPath = join(root, "projects", "enterprise-workspace", "projects", "axi-agent-platform");
  mkdirSync(agentPath, { recursive: true });
  writeFileSync(join(root, "workspace.graph.json"), JSON.stringify({
    projects: {
      "axi-agent": {
        path: agentPath,
        kind: "agent-owner",
        provides: ["agent-task-runtime"],
        contracts: [],
      },
    },
    profiles: {},
  }));
  const controlPlane = createControlPlane({
    workspaceRoot: root,
    cacheDir: join(root, ".control-cache"),
    memoryDatabaseUrl: null,
    axiAgentTaskExecutor: async (request) => ({
      agentTaskId: request.agentTaskId,
      runtime: "axi_agent_mcp",
      status: "succeeded",
      passed: true,
      source: "axi-agent-mcp",
      tool: "swarm_git_status",
      summary: "Axi Agent read-only MCP tool completed.",
      text: "Git 状态\n工作区干净",
    }),
  });
  const gateway = createCommunicationGateway({
    cacheDir: join(root, ".gateway-cache"),
    controlPlaneClient: (message) => controlPlane.createJob(message),
    controlPlaneEventsClient: (jobId, afterEventId) => controlPlane.getJobEvents(jobId, { afterEventId }),
  });

  const sent = await gateway.handleMossCoderRelayEvent({
    idempotencyKey: "human-agent-tool-1",
    workspaceId: "ws-local",
    projectId: "axi-agent",
    sessionId: "mobile-agent-tool",
    actor: "human",
    type: "human.message",
    payload: {
      _type: "human.message",
      title: "Agent Tool",
      body: "让 axi-agent 只读查看 git status 并返回 artifact",
      collapseKey: "mobile-agent-tool",
    },
  });
  const completed = await waitFor(() => {
    const job = controlPlane.getJob(sent.job.id);
    return job?.status === "completed" ? job : null;
  });
  const events = await gateway.pollMossCoderEvents({ sessionId: "mobile-agent-tool" });

  assert.equal(completed.metadata.executionMode, "axi_agent");
  assert.equal(completed.metadata.operation, "tool_result_artifact");
  assert.equal(controlPlane.getAgentTask(completed.metadata.agentTaskId).runtime, "axi_agent");
  assert.ok(controlPlane.getJobArtifacts(sent.job.id).artifacts.some((artifact) => artifact.path.endsWith("axi-agent-task.json")));
  assert.ok(events.events.some((event) => event.type === "workflow.job.completed"));
});
