import { appendFileSync, chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Annotation, END, MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { createPairingService } from "./pairing.mjs";
import { createIdempotencyService } from "./idempotency.mjs";
import { createPersonalOsService } from "./personal-os.mjs";

const DEFAULT_WORKSPACE_ROOT = "/Volumes/code/workspace";
const WORKSTATION_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEFAULT_MEMORY_DATABASE_URL = "postgres://cc_connect@127.0.0.1:5432/cc_connect_memory?sslmode=disable";
const DEFAULT_AXI_AGENT_PLATFORM_URL = "http://127.0.0.1:8000";
const TEXT_LIMIT = 12_000;
const COMMAND_TIMEOUT_MS = 120_000;
const AGENT_TIMEOUT_MS = 600_000;
const JOB_HEARTBEAT_MS = 30_000;

const BASE_SERVICE_IDS = new Set(["ai-capability", "ollama-local", "workspace-governance", "codex-app-projects", "axi-notify", "axi-accounts", "axi-model-gateway", "axi-docs"]);
const EXTERNAL_CAPABILITY_IDS = new Set(["minimax-tokenplan"]);
const COMMUNICATION_IDS = new Set(["codex-remote-bridge"]);
const IM_IDS = new Set(["axi-mobile"]);
const PHYSICAL_SERVICE_IDS = new Set(["fleet-console"]);
const GOVERNANCE_RELATIONSHIP_TYPES = new Set(["OWNS", "CONTAINS", "PROVIDES_CAPABILITY", "CONSUMES_CAPABILITY", "DEPENDS_ON", "IMPLEMENTS_CONTRACT", "USES_RESOURCE", "DEPLOYED_TO", "GOVERNED_BY", "INHERITS_FROM", "OVERRIDES", "VERIFIED_BY", "ACTED_BY", "AFFECTS", "EVIDENCED_BY", "SUPERSEDES", "ARCHIVES"]);
const GOVERNANCE_CONTRACT_VERSION = 1;
const GOVERNANCE_OBSERVER = "axi-workstation-control-plane";
const GOVERNANCE_COMPLETION_EVIDENCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GOVERNANCE_EXECUTION_EVIDENCE_TTL_MS = 15 * 60 * 1000;
const APPROVAL_TTL_MS = 5 * 60 * 1000;
const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;
const GOVERNANCE_REGISTRY_COLLECTIONS = ["projects", "products", "shared", "infra", "tools", "references", "agent"];
const GOVERNANCE_REGISTRY_OBJECT_TYPES = {
  projects: "project",
  products: "product",
  shared: "shared_foundation",
  infra: "infrastructure",
  tools: "tool",
  references: "reference",
  agent: "agent_platform",
};
const BLOCK_PATTERNS = [
  /\brm\s+-[^\n;|&]*[rf]/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bsecurity\s+find-/i,
  /\bcat\s+[^;\n]*(\.env|credential|secret|token|private[_-]?key)/i,
  /\b(open|expose).*(3001|9443|9090|19999).*(public|公网|0\.0\.0\.0)/i,
  /\b(kubectl|terraform|docker)\s+[^;\n]*(apply|destroy|delete|push)\b/i,
  /生产.*(写|改|删|部署|发布)/,
];

export function createControlPlane(options = {}) {
  const workspaceRoot = workspaceRootOf(options);
  const nodeEnv = options.nodeEnv || process.env.NODE_ENV || "development";
  const cacheDir = options.cacheDir || process.env.AXI_WORKSTATION_CONTROL_CACHE_DIR || process.env.EPAP_CONTROL_CACHE_DIR || join(process.cwd(), ".cache", "epap-control-plane");
  const pairingEnabled = Object.hasOwn(options, "pairingEnabled")
    ? options.pairingEnabled === true
    : resolveMobilePairingEnabled({
        configured: Object.hasOwn(process.env, "AXI_MOBILE_PAIRING_ENABLED"),
        configuredValue: process.env.AXI_MOBILE_PAIRING_ENABLED,
        cacheDir,
        nodeEnv,
      });
  const ownerApprovalSecret = resolveMobilePairingOwnerApprovalSecret({
    configured: Object.hasOwn(options, "ownerApprovalSecret") || Object.hasOwn(process.env, "AXI_OWNER_PAIR_APPROVAL_SECRET"),
    configuredSecret: options.ownerApprovalSecret || process.env.AXI_OWNER_PAIR_APPROVAL_SECRET || "",
    cacheDir,
    pairingEnabled,
    nodeEnv,
  });
  const deps = {
    workspaceRoot,
    graphPath: options.graphPath || join(workspaceRoot, "workspace.graph.json"),
    registryPath: options.registryPath || join(workspaceRoot, "infra", "axi-workspace-governance", "workspace.json"),
    cacheDir,
    memoryDatabaseUrl: Object.hasOwn(options, "memoryDatabaseUrl")
      ? options.memoryDatabaseUrl
      : (process.env.CC_CONNECT_MEMORY_DATABASE_URL || DEFAULT_MEMORY_DATABASE_URL),
    memoryProjectReader: options.memoryProjectReader || (() => readMemoryProjects(memoryDatabaseUrlOf(options))),
    agentTaskExecutor: options.agentTaskExecutor || executeAgentTask,
    roleAgentExecutor: options.roleAgentExecutor || executeRoleAgentRun,
    axiAgentTaskExecutor: options.axiAgentTaskExecutor || executeAxiAgentTask,
    personalOsService: options.personalOsService || null,
    personalOsStore: options.personalOsStore,
    personalOsRuntimeReader: options.personalOsRuntimeReader,
    devsvcOverviewUrl: options.devsvcOverviewUrl,
    heartbeatMs: options.heartbeatMs || JOB_HEARTBEAT_MS,
    codexBin: options.codexBin || process.env.CODEX_BIN || "codex",
    appServerBin: options.appServerBin || process.env.CODEX_APP_SERVER_BIN || "/Applications/Codex.app/Contents/Resources/codex",
    eventSources: options.eventSources || parseEventSources(process.env.AXI_WORKSPACE_EVENT_SOURCES),
    automationSchedulerEnabled: options.enableAutomationScheduler === true,
    automationSchedulerIntervalMs: options.automationSchedulerIntervalMs,
    handoffExpirySchedulerEnabled: options.enableHandoffExpiryScheduler !== false,
    handoffExpirySchedulerIntervalMs: options.handoffExpirySchedulerIntervalMs,
    handoffExpiryMs: normalizeHandoffExpiryMs(Object.hasOwn(options, "handoffExpiryMs") ? options.handoffExpiryMs : process.env.AXI_HANDOFF_EXPIRY_MS),
    onHandoffExpired: typeof options.onHandoffExpired === "function" ? options.onHandoffExpired : null,
    pairingEnabled,
    ownerApprovalSecret,
    pairingTokenSecret: resolveMobilePairingTokenSecret({
      configuredSecret: options.pairingTokenSecret || process.env.AXI_MOBILE_TOKEN_SECRET || "",
      cacheDir,
      pairingEnabled,
      nodeEnv,
    }),
    enforceExecutionPolicy: options.enforceExecutionPolicy !== false,
  };
  return buildControlPlaneSurface(deps);
}

/**
 * 新设备仍需显式开启移动配对；但开发机已经持有私有配对密钥时，重启控制面
 * 必须恢复该既有状态，不能让真机因漏传一个开发环境变量而全部断线。
 * 显式 false（包括空值）与生产环境始终优先，避免把本地缓存变成生产授权来源。
 */
export function resolveMobilePairingEnabled({ configured = false, configuredValue = "", cacheDir, nodeEnv = "development" } = {}) {
  if (configured) return configuredValue === "true";
  if (nodeEnv !== "development" || !cacheDir) return false;
  try {
    return readFileSync(join(cacheDir, "mobile-pairing-token-secret"), "utf8").trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * 本机开发配对密钥绝不进入源码、环境输出或移动端包。
 * 只有显式启用移动配对且非生产环境时，才在控制面私有缓存中创建一个稳定随机值；
 * 重启不会让已配对设备全部失效，生产仍必须从 Secret 注入 AXI_MOBILE_TOKEN_SECRET。
 */
export function resolveMobilePairingTokenSecret({ configuredSecret = "", cacheDir, pairingEnabled = false, nodeEnv = "development" } = {}) {
  const explicit = typeof configuredSecret === "string" ? configuredSecret.trim() : "";
  if (explicit) return explicit;
  if (!pairingEnabled || nodeEnv === "production") return "";

  const secretPath = join(cacheDir, "mobile-pairing-token-secret");
  if (existsSync(secretPath)) {
    const persisted = readFileSync(secretPath, "utf8").trim();
    if (persisted) return persisted;
  }

  mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString("hex");
  writeFileSync(secretPath, `${generated}\n`, { mode: 0o600 });
  chmodSync(secretPath, 0o600);
  return generated;
}

/**
 * The owner approval HMAC is a local development-only bootstrap.  It is
 * persisted beside the device token secret so a DevSvc restart does not make
 * the Web confirmation button fail closed for an otherwise valid local
 * pairing.  Production and explicit configuration always remain authoritative.
 */
export function resolveMobilePairingOwnerApprovalSecret({ configured = false, configuredSecret = "", cacheDir, pairingEnabled = false, nodeEnv = "development" } = {}) {
  const explicit = typeof configuredSecret === "string" ? configuredSecret.trim() : "";
  if (explicit) return explicit;
  if (configured || !pairingEnabled || nodeEnv !== "development" || !cacheDir) return "";

  const secretPath = join(cacheDir, "mobile-owner-approval-secret");
  if (existsSync(secretPath)) {
    const persisted = readFileSync(secretPath, "utf8").trim();
    if (persisted) return persisted;
  }

  mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString("hex");
  writeFileSync(secretPath, `${generated}\n`, { mode: 0o600 });
  chmodSync(secretPath, 0o600);
  return generated;
}

function workspaceRootOf(options) {
  return resolve(options.workspaceRoot || process.env.AXI_WORKSTATION_ROOT || process.env.EPAP_WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT);
}
function memoryDatabaseUrlOf(options) {
  return Object.hasOwn(options, "memoryDatabaseUrl")
    ? options.memoryDatabaseUrl
    : (process.env.CC_CONNECT_MEMORY_DATABASE_URL || DEFAULT_MEMORY_DATABASE_URL);
}

function buildControlPlaneSurface({
  workspaceRoot, graphPath, registryPath, cacheDir, memoryDatabaseUrl, memoryProjectReader,
  agentTaskExecutor, roleAgentExecutor, axiAgentTaskExecutor, heartbeatMs,
  codexBin, appServerBin, ownerApprovalSecret, pairingTokenSecret, pairingEnabled,
  personalOsService, personalOsStore, personalOsRuntimeReader, devsvcOverviewUrl, eventSources,
  enforceExecutionPolicy, automationSchedulerEnabled = false, automationSchedulerIntervalMs,
  handoffExpirySchedulerEnabled = true, handoffExpirySchedulerIntervalMs, handoffExpiryMs = HANDOFF_TTL_MS, onHandoffExpired = null,
}) {
  const pairing = pairingTokenSecret
    ? createPairingService({
        cacheDir,
        tokenSecret: pairingTokenSecret,
        ownerApprovalSecret: ownerApprovalSecret || "",
      })
    : null;
  const idempotency = createIdempotencyService({ cacheDir });
  const runs = new Map();
  const envelopeRuns = new Map();
  // 受管任务和审批在控制面私有缓存中持久化；重启后移动快照仍需能解释
  // 刚完成的诊断，而不能把真实结果退回为空白占位。
  const agentTasks = loadPersistedRecordMap(join(cacheDir, "agent-tasks"));
  const approvals = loadPersistedRecordMap(join(cacheDir, "approvals"));
  const approvalScans = loadPersistedRecordMap(join(cacheDir, "approval-scans"));
  const handoffs = loadPersistedRecordMap(join(cacheDir, "handoffs"));
  const jobs = new Map();
  const jobEnvelopeIndex = new Map();
  const personalOs = personalOsService || createPersonalOsService({
    workspaceRoot,
    graphPath,
    cacheDir,
    store: personalOsStore,
    runtimeReader: personalOsRuntimeReader,
    devsvcOverviewUrl,
    snapshotReader: () => buildSnapshot({ workspaceRoot, graphPath, cacheDir, eventSources, agentTasks, approvals, codexBin, appServerBin }),
  });

  const surface = {
    workspaceRoot,
    graphPath,
    cacheDir,
    pairingEnabled,
    pairing,
    idempotency,
    personalOs,
    snapshot: () => buildSnapshot({ workspaceRoot, graphPath, cacheDir, eventSources, agentTasks, approvals, codexBin, appServerBin }),
    mobileSnapshot: () => buildMobileWorkspaceSnapshot({ workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin }),
    mobileProject: (id) => buildMobileWorkspaceSnapshot({ workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin }).projects.find((project) => project.id === id) || null,
    createApprovalScan: (input) => createApprovalScan({ input, cacheDir, approvals, approvalScans }),
    resolveApprovalScan: (scanToken) => resolveApprovalScan({ scanToken, cacheDir, approvals, approvalScans }),
    getHandoff: (id) => handoffs.get(id) || readJson(join(cacheDir, "handoffs", `${id}.json`), null),
    listHandoffs: ({ status = "", actor = "", owner = "" } = {}) => listHandoffs({ status, actor, owner, cacheDir, handoffs, notifyExpired: onHandoffExpired }),
    handoffExpiry: { durationMs: handoffExpiryMs, defaultDurationMs: HANDOFF_TTL_MS },
    expireHandoffs: () => expirePendingHandoffs({ cacheDir, handoffs, notifyExpired: onHandoffExpired }),
    openHandoff: (id, subject) => openHandoff({ id, subject, cacheDir, handoffs, approvals, notifyExpired: onHandoffExpired }),
    completeHandoff: (id, subject, outcome) => completeHandoff({ id, subject, outcome, cacheDir, handoffs, approvals, notifyExpired: onHandoffExpired }),
    rejectHandoff: (id, subject, reason) => rejectHandoff({ id, subject, reason, cacheDir, handoffs, approvals, notifyExpired: onHandoffExpired }),
    query: (input, options = {}) => {
      const policyEvaluator = options.policyEvaluator || (enforceExecutionPolicy
        ? (policyInput) => evaluateSurfaceExecutionPolicy({ input, policyInput, workspaceRoot, registryPath, cacheDir })
        : null);
      return handleQuery({ input, workspaceRoot, graphPath, cacheDir, runs, envelopeRuns, agentTasks, approvals, agentTaskExecutor, codexBin, appServerBin, policyEvaluator });
    },
    handleCommunicationMessage: (input, messageOptions = {}) => handleCommunicationMessage({
      input,
      options: messageOptions,
      workspaceRoot,
      graphPath,
      cacheDir,
      runs,
      envelopeRuns,
      agentTasks,
      approvals,
      agentTaskExecutor,
      codexBin,
      appServerBin,
      memoryProjectReader,
      policyEvaluator: messageOptions.policyEvaluator || (enforceExecutionPolicy
        ? (policyInput) => evaluateSurfaceExecutionPolicy({ input, policyInput, workspaceRoot, registryPath, cacheDir })
        : null),
    }),
    runCommand: (commandId, internal = {}) => {
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "registered command", cacheDir, { resourceRef: commandId, action: "execute", subjectRef: internal.subjectRef });
      return guard || runCommandById({ commandId, workspaceRoot, graphPath, cacheDir, runs, policyDecisionRef: internal.policyDecisionRef || null });
    },
    runAutomation: (automationId, internal = {}) => {
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "registered automation", cacheDir, { resourceRef: `automation:${automationId}`, action: "execute", subjectRef: internal.subjectRef });
      return guard || runAutomationById({ automationId, workspaceRoot, graphPath, cacheDir, runs, policyDecisionRef: internal.policyDecisionRef || null });
    },
    getRun: (id) => runs.get(id) || readRun(cacheDir, id),
    getAgentTask: (id) => agentTasks.get(id) || readJson(join(cacheDir, "agent-tasks", `${id}.json`), null),
    cancelAgentTask: (id, internal = {}) => {
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "AgentTask cancellation", cacheDir, { resourceRef: `agent-task:${id}`, action: "write", subjectRef: internal.subjectRef });
      return guard || cancelAgentTask({ id, cacheDir, agentTasks, policyDecisionRef: internal.policyDecisionRef || null });
    },
    decideApproval: null, // backfilled below — TDZ-safe bridge
    createJob: (input, internal = {}) => {
      const jobResourceRef = firstString(input?.resourceRef, input?.projectId, input?.targetId, input?.actionId, input?.envelope?.raw?.projectId) || "workspace";
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "control job creation", cacheDir, { allowApproval: true, resourceRef: jobResourceRef, action: "execute", subjectRef: internal.subjectRef });
      return guard || createControlJob({ input: internal.policyDecisionRef ? { ...input, __policyDecisionRef: internal.policyDecisionRef } : input, approvedApprovalId: internal.approvedApprovalId || null, forceApproval: internal.forceApproval === true, approvalSource: internal.approvalSource || "desktop", workspaceRoot, graphPath, cacheDir, jobs, jobEnvelopeIndex, agentTasks, approvals, roleAgentExecutor, axiAgentTaskExecutor, codexBin, appServerBin, heartbeatMs, memoryDatabaseUrl });
    },
    createMobileProjectAction: (input, internal = {}) => {
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "mobile project action", cacheDir, { allowApproval: true, resourceRef: input?.projectId || "workspace", action: "execute", subjectRef: internal.subjectRef });
      if (guard) return guard;
      return createMobileProjectAction({
        input,
        approvedApprovalId: internal.approvedApprovalId || null,
        policyDecisionRef: internal.policyDecisionRef || null,
        forceApproval: internal.forceApproval === true,
        workspaceRoot,
        graphPath,
        cacheDir,
        jobs,
        jobEnvelopeIndex,
        agentTasks,
        approvals,
        roleAgentExecutor,
        axiAgentTaskExecutor,
        codexBin,
        appServerBin,
        heartbeatMs,
        memoryDatabaseUrl,
      });
    },
    getJob: (id) => jobs.get(id) || readJson(join(cacheDir, "jobs", id, "job.json"), null),
    getJobEvents: (id, options = {}) => readJobEvents({ cacheDir, id, afterEventId: options.afterEventId }),
    getJobArtifacts: (id) => listJobArtifacts({ cacheDir, id }),
    getWorkspaceEvents: (options = {}) => readWorkspaceEvents({ cacheDir, sources: eventSources, ...options }),
    getWorkspaceEvent: (id) => readWorkspaceEvents({ cacheDir, sources: eventSources, eventId: id, limit: 1 }).events[0] || null,
    transitionGovernanceRisk: (input = {}, internal = {}) => {
      const policyDecisionRef = firstString(internal.policyDecisionRef, input.policyDecisionRef) || null;
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, policyDecisionRef, "risk transition", cacheDir, { resourceRef: `risk:${firstString(input.id)}`, action: "manage", subjectRef: firstString(internal.subjectRef, input.subjectRef) });
      if (guard) return guard;
      return transitionGovernanceRisk({ input: { ...input, policyDecisionRef }, cacheDir });
    },
    evaluateGovernancePolicy,
    evaluateConfiguredGovernancePolicy: (input = {}) => evaluateConfiguredGovernancePolicy({ input, workspaceRoot, registryPath, cacheDir }),
    getGovernancePolicyDecision: (id) => readJson(join(cacheDir, "policy-decisions", `${safeFileName(id)}.json`), null),
    recordWorkspaceEvent: (event = {}) => appendAuditRecord(cacheDir, event),
    cancelJob: (id, internal = {}) => {
      const guard = requirePolicyDecisionRef(enforceExecutionPolicy, internal.policyDecisionRef, "control job cancellation", cacheDir, { resourceRef: `job:${id}`, action: "write", subjectRef: internal.subjectRef });
      return guard || cancelControlJob({ cacheDir, jobs, id, policyDecisionRef: internal.policyDecisionRef || null });
    },
    normalizeIMEnvelope,
    recordMobileAudit: (event) => recordMobileAudit({ cacheDir, event }),
  };
  // Wire the mobile approval bridge now that the surface exists.
  surface.decideApproval = (input) => {
    const guard = requirePolicyDecisionRef(enforceExecutionPolicy, input?.policyDecisionRef, "approval decision", cacheDir, { resourceRef: `approval:${firstString(input?.id)}`, action: "approve", subjectRef: input?.subjectRef });
    if (guard) return guard;
    return decideApproval({
      input,
      cacheDir,
      approvals,
      agentTasks,
      dispatchApprovedJob: (seed) => surface.createJob(seed, { policyDecisionRef: seed.__policyDecisionRef || null, approvedApprovalId: input.id, approvalSource: seed.__approvalSource || "desktop", subjectRef: firstString(input?.subjectRef, input?.actorRef) }),
      dispatchApprovedMobileAction: (approval) => surface.createMobileProjectAction({
        projectId: approval.projectId,
        actionId: approval.actionId,
        actionType: approval.actionType,
        idempotencyKey: approval.idempotencyKey,
        deviceId: approval.sourceDeviceId,
      }, { approvedApprovalId: approval.id, policyDecisionRef: approval.decisionPolicyDecisionRef || approval.policyDecisionRef || null, subjectRef: `user:${approval.sourceDeviceId}` }),
    });
  };
  surface.decideApprovalScan = (input) => {
    const guard = requirePolicyDecisionRef(enforceExecutionPolicy, input?.policyDecisionRef, "approval scan decision", cacheDir, { resourceRef: `approval-scan:${firstString(input?.scanId)}`, action: "approve", subjectRef: input?.subjectRef });
    if (guard) return { ...guard, ok: false };
    return decideApprovalScan({
      input,
      cacheDir,
      approvalScans,
      handoffs,
      resolveApproval: surface.decideApproval,
      recordAudit: surface.recordMobileAudit,
      handoffExpiryMs,
    });
  };
  const automationScheduler = createAutomationScheduler({
    surface,
    workspaceRoot,
    registryPath,
    cacheDir,
    enabled: automationSchedulerEnabled,
    intervalMs: automationSchedulerIntervalMs,
  });
  surface.runAutomationSchedulerTick = automationScheduler.tick;
  surface.stopAutomationScheduler = automationScheduler.stop;
  surface.automationScheduler = { enabled: automationSchedulerEnabled, intervalMs: automationScheduler.intervalMs };
  automationScheduler.start();
  const handoffExpiryScheduler = createHandoffExpiryScheduler({
    surface,
    enabled: handoffExpirySchedulerEnabled,
    intervalMs: handoffExpirySchedulerIntervalMs,
  });
  surface.runHandoffExpirySweep = handoffExpiryScheduler.tick;
  surface.stopHandoffExpiryScheduler = handoffExpiryScheduler.stop;
  surface.handoffExpiryScheduler = { enabled: handoffExpirySchedulerEnabled, intervalMs: handoffExpiryScheduler.intervalMs };
  handoffExpiryScheduler.start();
  return surface;
}

function createAutomationScheduler({ surface, workspaceRoot, registryPath, cacheDir, enabled = false, intervalMs = 30_000 }) {
  const schedulerIntervalMs = Number.isInteger(intervalMs) && intervalMs > 0 ? intervalMs : 30_000;
  let timer = null;
  let running = false;

  async function tick() {
    if (running) return [];
    running = true;
    try {
      const snapshot = surface.snapshot();
      const results = [];
      for (const automation of snapshot.governance?.automations || []) {
        if (automation.status !== "enabled" || automation.trigger !== "interval") continue;
        const lastRunAt = dateFromValue(automation.lastRunAt);
        if (lastRunAt && Date.now() - lastRunAt.getTime() < automation.intervalSeconds * 1000) continue;
        const correlationId = `automation-tick:${automation.id}:${Date.now()}`;
        const policy = evaluateSurfaceExecutionPolicy({
          input: { subjectRef: `automation:${automation.id}` },
          policyInput: { resourceRef: `automation:${automation.id}`, action: automation.policyAction, correlationId },
          workspaceRoot,
          registryPath,
          cacheDir,
        });
        if (policy.decision.decision !== "allow") {
          results.push({ automationId: automation.id, status: "blocked", policyDecisionRef: policy.decision.id });
          continue;
        }
        const run = surface.runAutomation(automation.id, { policyDecisionRef: policy.decision.id, subjectRef: `automation:${automation.id}` });
        results.push({ automationId: automation.id, status: run?.actions?.[0]?.status || "not_found", runId: run?.id || null, policyDecisionRef: policy.decision.id });
      }
      return results;
    } finally {
      running = false;
    }
  }

  return {
    intervalMs: schedulerIntervalMs,
    start() {
      if (!enabled) return;
      timer = setInterval(() => { void tick(); }, schedulerIntervalMs);
      timer.unref?.();
      void tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
  };
}

function createHandoffExpiryScheduler({ surface, enabled = true, intervalMs = 60_000 }) {
  const schedulerIntervalMs = Number.isInteger(intervalMs) && intervalMs > 0 ? intervalMs : 60_000;
  let timer = null;
  let running = false;

  function tick() {
    if (running) return { ok: true, expired: 0, skipped: true };
    running = true;
    try {
      return surface.expireHandoffs();
    } finally {
      running = false;
    }
  }

  return {
    intervalMs: schedulerIntervalMs,
    start() {
      if (!enabled) return;
      timer = setInterval(() => { tick(); }, schedulerIntervalMs);
      timer.unref?.();
      tick();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    tick,
  };
}

/**
 * Write one mobile_action entry into the existing audit.jsonl ledger
 * (the same file the desktop control plane already uses).  Format:
 *   { auditKind, deviceId, idempotencyKey, projectId, actionId, actionType,
 *     approvalRef, handoffCorrelationId, handoffId, actorRef, sourceActorRef,
 *     sourceOwnerRef,
 *     outcome, reason,
 *     status, occurredAt }
 * chmod 600 on first write; existing files keep their permissions.
 */
export function recordMobileAudit({ cacheDir, event = {} }) {
  if (!cacheDir) return { ok: false, error: "cacheDir required" };
  const payload = {
    auditKind: event.auditKind || "mobile_action",
    deviceId: event.deviceId || null,
    idempotencyKey: event.idempotencyKey || null,
    projectId: event.projectId || null,
    surface: event.surface || "mobile",
    serviceId: event.serviceId || null,
    runId: event.runId || null,
    actionId: event.actionId || null,
    actionType: event.actionType || null,
    approvalRef: event.approvalRef || null,
    policyDecisionRef: event.policyDecisionRef || null,
    handoffCorrelationId: event.handoffCorrelationId || null,
    handoffId: event.handoffId || null,
    actorRef: event.actorRef || null,
    sourceActorRef: event.sourceActorRef || null,
    sourceOwnerRef: event.sourceOwnerRef || null,
    outcome: event.outcome || null,
    reason: event.reason || null,
    status: event.status || "executed",
    occurredAt: Math.floor(Date.now() / 1000),
  };
  appendAuditRecord(cacheDir, payload);
  return { ok: true };
}

/**
 * Create a short-lived opaque approval scan record.  The URI contains only a
 * random record id; the approval object, impact, and permitted decisions stay
 * server-side and are resolved again when the mobile device scans it.
 *
 * This is intentionally a Control Plane operation, not a browser API.  A
 * Web surface may later render the returned URI, but cannot manufacture a
 * project/action pair in the QR payload.
 */
export function createApprovalScan({ input = {}, cacheDir, approvals, approvalScans }) {
  const approvalId = String(input.approvalId || "").trim();
  const approval = approvals?.get(approvalId) || readJson(join(cacheDir, "approvals", `${approvalId}.json`), null);
  if (!approval) return { ok: false, httpStatus: 404, error: "approval not found" };
  if (approval.status !== "pending") return { ok: false, httpStatus: 409, error: "approval is no longer pending" };
  const requestedExpiry = Date.parse(String(input.expiresAt || ""));
  const expiresAt = Number.isFinite(requestedExpiry) && requestedExpiry > Date.now()
    ? new Date(requestedExpiry).toISOString()
    : new Date(Date.now() + 5 * 60 * 1000).toISOString();
  // The source approval's policy is authoritative.  A caller creating a QR
  // record cannot lower a C/D approval into a Mobile-confirmable B action.
  const actionLevel = approvalActionLevel(approval);
  const scan = {
    id: `scan_${randomUUID()}`,
    approvalId: approval.id,
    status: "active",
    actionLevel,
    object: {
      type: "approval",
      id: approval.id,
      projectId: approval.projectId || null,
      actionId: approval.actionId || null,
      actionType: approval.actionType || null,
    },
    impact: approval.actionSummary || "受控动作等待确认。",
    riskLevel: approval.riskLevel || "medium",
    availableDecisions: actionLevel === "B" ? ["approved", "rejected"] : ["handoff", "rejected"],
    expiresAt,
    createdAt: new Date().toISOString(),
  };
  approvalScans?.set(scan.id, scan);
  persistJson(join(cacheDir, "approval-scans", `${scan.id}.json`), scan);
  recordMobileAudit({ cacheDir, event: { auditKind: "approval_scan_created", approvalRef: approval.id, status: "created" } });
  return { ok: true, scanId: scan.id, uri: `axi://approval/${scan.id}`, expiresAt: scan.expiresAt };
}

export function resolveApprovalScan({ scanToken, cacheDir, approvals, approvalScans }) {
  const scanId = String(scanToken || "").trim();
  if (!/^scan_[A-Za-z0-9_-]{8,}$/.test(scanId)) return { ok: false, httpStatus: 400, error: "invalid approval scan token" };
  const scan = approvalScans?.get(scanId) || readJson(join(cacheDir, "approval-scans", `${scanId}.json`), null);
  if (!scan) return { ok: false, httpStatus: 404, error: "approval scan not found" };
  if (scan.status !== "active") return { ok: false, httpStatus: 409, error: "approval scan is no longer active" };
  if (Date.parse(scan.expiresAt) <= Date.now()) {
    scan.status = "expired";
    approvalScans?.set(scan.id, scan);
    persistJson(join(cacheDir, "approval-scans", `${scan.id}.json`), scan);
    return { ok: false, httpStatus: 410, error: "approval scan expired" };
  }
  const approval = approvals?.get(scan.approvalId) || readJson(join(cacheDir, "approvals", `${scan.approvalId}.json`), null);
  if (!approval || approval.status !== "pending") return { ok: false, httpStatus: 409, error: "approval state changed" };
  return {
    ok: true,
    scanId: scan.id,
    approvalId: approval.id,
    object: scan.object,
    impact: scan.impact,
    riskLevel: scan.riskLevel,
    currentStatus: approval.status,
    availableDecisions: scan.availableDecisions,
    expiresAt: scan.expiresAt,
    handoffCorrelationId: `handoff:${scan.id}`,
  };
}

function decideApprovalScan({ input = {}, cacheDir, approvalScans, handoffs, resolveApproval, recordAudit, handoffExpiryMs = HANDOFF_TTL_MS }) {
  // The persisted approval is the authority after a process restart; clients
  // never supply its project, action, or object identifiers.
  const scan = approvalScans?.get(input.scanId) || readJson(join(cacheDir, "approval-scans", `${input.scanId}.json`), null);
  const approval = scan ? readJson(join(cacheDir, "approvals", `${scan.approvalId}.json`), null) : null;
  if (!scan || !approval) return { ok: false, httpStatus: 404, error: "approval scan not found" };
  if (scan.status !== "active" || Date.parse(scan.expiresAt) <= Date.now() || approval.status !== "pending") {
    return { ok: false, httpStatus: 409, error: "approval state changed or expired" };
  }
  if (!scan.availableDecisions.includes(input.decision)) return { ok: false, httpStatus: 422, error: "decision is not allowed for this approval scan" };
  const correlationId = `handoff:${scan.id}`;
  if (input.handoffCorrelationId !== correlationId) {
    return { ok: false, httpStatus: 422, error: "handoff correlation does not match the approval scan" };
  }
  if (input.decision === "handoff") {
    const handoff = {
      id: `handoff_${randomUUID()}`,
      handoffCorrelationId: correlationId,
      sourceSurface: "mobile",
      targetSurface: "web",
      status: "pending",
      approvalId: approval.id,
      object: scan.object,
      impact: scan.impact,
      riskLevel: scan.riskLevel,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + handoffExpiryMs).toISOString(),
      sourceActorRef: firstString(input.subjectRef, input.deviceId) || null,
      sourceOwnerRef: firstString(input.sourceOwnerRef) || null,
    };
    handoffs?.set(handoff.id, handoff);
    persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
    scan.status = "handed_off";
    scan.handoffId = handoff.id;
    approvalScans?.set(scan.id, scan);
    persistJson(join(cacheDir, "approval-scans", `${scan.id}.json`), scan);
    recordAudit({ auditKind: "handoff_created", deviceId: input.deviceId, actorRef: handoff.sourceActorRef, sourceActorRef: handoff.sourceActorRef, sourceOwnerRef: handoff.sourceOwnerRef, idempotencyKey: input.idempotencyKey, approvalRef: approval.id, handoffCorrelationId: correlationId, handoffId: handoff.id, policyDecisionRef: input.policyDecisionRef || null, status: "handed_off" });
    return { ok: true, status: "handed_off", handoff };
  }
  const result = resolveApproval({ id: approval.id, decision: input.decision, policyDecisionRef: input.policyDecisionRef || null });
  if (!result) return { ok: false, httpStatus: 404, error: "approval not found" };
  scan.status = "decided";
  scan.decidedAt = new Date().toISOString();
  approvalScans?.set(scan.id, scan);
  persistJson(join(cacheDir, "approval-scans", `${scan.id}.json`), scan);
  recordAudit({ auditKind: "approval_scan_decided", deviceId: input.deviceId, idempotencyKey: input.idempotencyKey, approvalRef: approval.id, handoffCorrelationId: correlationId, policyDecisionRef: input.policyDecisionRef || null, status: result.status });
  return { ok: true, status: result.status, approval: result, handoffCorrelationId: correlationId };
}

function openHandoff({ id, subject, cacheDir, handoffs, approvals, notifyExpired }) {
  const handoff = handoffs?.get(id) || readJson(join(cacheDir, "handoffs", `${id}.json`), null);
  if (!handoff) return null;
  const access = verifyHandoffOwner({ handoff, subject, cacheDir });
  if (!access.ok) return access;
  expireHandoffIfNeeded({ handoff, cacheDir, handoffs, notifyExpired });
  if (handoff.status === "expired") return handoff;
  const approvalAccess = verifyHandoffApproval({ handoff, subject, cacheDir, approvals, handoffs });
  if (!approvalAccess.ok) return approvalAccess;
  if (handoff.status === "pending") {
    handoff.status = "opened";
    handoff.openedAt = new Date().toISOString();
    handoff.openedBy = subject;
    handoffs?.set(handoff.id, handoff);
    persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
    recordMobileAudit({ cacheDir, event: { auditKind: "handoff_opened", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, status: "opened" } });
  }
  return handoff;
}

function completeHandoff({ id, subject, outcome, cacheDir, handoffs, approvals, notifyExpired }) {
  const handoff = handoffs?.get(id) || readJson(join(cacheDir, "handoffs", `${id}.json`), null);
  if (!handoff) return null;
  const access = verifyHandoffOwner({ handoff, subject, cacheDir });
  if (!access.ok) return access;
  expireHandoffIfNeeded({ handoff, cacheDir, handoffs, notifyExpired });
  if (!["pending", "opened"].includes(handoff.status)) return handoff;
  const approvalAccess = verifyHandoffApproval({ handoff, subject, cacheDir, approvals, handoffs });
  if (!approvalAccess.ok) return approvalAccess;
  handoff.status = "completed";
  handoff.completedAt = new Date().toISOString();
  handoff.finalAction = { outcome, performedBy: subject, occurredAt: handoff.completedAt };
  handoffs?.set(handoff.id, handoff);
  persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
  recordMobileAudit({ cacheDir, event: { auditKind: "handoff_completed", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, outcome, status: "completed" } });
  return handoff;
}

function rejectHandoff({ id, subject, reason, cacheDir, handoffs, approvals, notifyExpired }) {
  const handoff = handoffs?.get(id) || readJson(join(cacheDir, "handoffs", `${id}.json`), null);
  if (!handoff) return null;
  const access = verifyHandoffOwner({ handoff, subject, cacheDir });
  if (!access.ok) return access;
  expireHandoffIfNeeded({ handoff, cacheDir, handoffs, notifyExpired });
  if (!["pending", "opened"].includes(handoff.status)) return handoff;
  const approvalAccess = verifyHandoffApproval({ handoff, subject, cacheDir, approvals, handoffs });
  if (!approvalAccess.ok) return approvalAccess;
  handoff.status = "rejected";
  handoff.rejectedAt = new Date().toISOString();
  handoff.rejectedBy = subject;
  handoff.rejectionReason = reason;
  handoffs?.set(handoff.id, handoff);
  persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
  recordMobileAudit({ cacheDir, event: { auditKind: "handoff_rejected", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, reason, status: "rejected" } });
  return handoff;
}

function listHandoffs({ status = "", actor = "", owner = "", cacheDir, handoffs, notifyExpired }) {
  expirePendingHandoffs({ cacheDir, handoffs, notifyExpired });
  const normalizedStatus = String(status || "").trim();
  const normalizedActor = String(actor || "").trim();
  const normalizedOwner = String(owner || "").trim();
  const allowedStatuses = new Set(["pending", "opened", "completed", "rejected", "expired"]);
  if (normalizedStatus && !allowedStatuses.has(normalizedStatus)) {
    return { ok: false, httpStatus: 400, error: "handoff status must be pending, opened, completed, rejected, or expired" };
  }
  const records = [...(handoffs?.values() || [])]
    .filter((handoff) => !normalizedStatus || handoff.status === normalizedStatus)
    .filter((handoff) => !normalizedActor || handoff.sourceActorRef === normalizedActor)
    .filter((handoff) => !normalizedOwner || !handoff.sourceOwnerRef || handoff.sourceOwnerRef === normalizedOwner)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")) || String(right.id).localeCompare(String(left.id)));
  return { ok: true, handoffs: records };
}

function verifyHandoffOwner({ handoff, subject, cacheDir }) {
  const sourceOwnerRef = firstString(handoff?.sourceOwnerRef);
  if (!sourceOwnerRef || sourceOwnerRef === String(subject || "").trim()) return { ok: true };
  recordMobileAudit({ cacheDir, event: { auditKind: "handoff_access_denied", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, reason: "source owner subject mismatch", status: "denied" } });
  return { ok: false, httpStatus: 403, error: "handoff owner authorization required" };
}

function verifyHandoffApproval({ handoff, subject, cacheDir, approvals, handoffs }) {
  const approvalId = firstString(handoff?.approvalId);
  if (!approvalId) return { ok: true };
  const approval = approvals?.get(approvalId) || readJson(join(cacheDir, "approvals", `${approvalId}.json`), null);
  if (approval?.status === "pending") {
    const expiresAt = dateFromValue(approval.expiresAt);
    if (!expiresAt || expiresAt.getTime() > Date.now()) return { ok: true };
    approval.status = "expired";
    approval.decisionText = "审批已过期。";
    approval.decidedAt = new Date().toISOString();
    approvals?.set(approval.id, approval);
    persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
    handoff.status = "expired";
    handoff.expiredAt = new Date().toISOString();
    handoffs?.set(handoff.id, handoff);
    persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
    appendAuditRecord(cacheDir, {
      auditKind: "approval_expired",
      approvalId: approval.id,
      actorRef: "control-plane",
      objectRef: firstString(approval.projectId, approval.taskId) || approval.id,
      action: "approval_expiration",
      correlationId: firstString(handoff.handoffCorrelationId, approval.envelopeId, approval.id) || approval.id,
      policyDecisionRef: approval.policyDecisionRef || null,
      result: approval.status,
      status: approval.status,
    });
    recordMobileAudit({ cacheDir, event: { auditKind: "handoff_expired", actorRef: "system:approval-expiry", sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: approval.id, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, reason: "linked approval expired", status: "expired" } });
    const reason = "approval expired";
    recordMobileAudit({ cacheDir, event: { auditKind: "handoff_access_denied", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: approval.id, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, reason, status: "denied" } });
    return { ok: false, httpStatus: 409, error: "handoff approval is no longer pending" };
  }
  const reason = approval ? `approval status is ${approval.status || "unknown"}` : "approval record not found";
  recordMobileAudit({ cacheDir, event: { auditKind: "handoff_access_denied", actorRef: subject, sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, reason, status: "denied" } });
  return { ok: false, httpStatus: 409, error: "handoff approval is no longer pending" };
}

function expirePendingHandoffs({ cacheDir, handoffs, notifyExpired }) {
  let expired = 0;
  for (const handoff of handoffs?.values() || []) {
    const before = handoff.status;
    expireHandoffIfNeeded({ handoff, cacheDir, handoffs, notifyExpired });
    if (before !== "expired" && handoff.status === "expired") expired += 1;
  }
  return { ok: true, expired };
}

function expireHandoffIfNeeded({ handoff, cacheDir, handoffs, notifyExpired }) {
  if (["completed", "rejected", "expired"].includes(handoff.status)) return handoff;
  const createdAt = Date.parse(String(handoff.createdAt || ""));
  const configuredExpiry = Date.parse(String(handoff.expiresAt || ""));
  const expiresAt = Number.isFinite(configuredExpiry)
    ? configuredExpiry
    : Number.isFinite(createdAt)
      ? createdAt + HANDOFF_TTL_MS
      : NaN;
  if (!Number.isFinite(expiresAt)) return handoff;
  if (!handoff.expiresAt) handoff.expiresAt = new Date(expiresAt).toISOString();
  if (expiresAt > Date.now()) return handoff;
  handoff.status = "expired";
  handoff.expiredAt = new Date().toISOString();
  handoffs?.set(handoff.id, handoff);
  persistJson(join(cacheDir, "handoffs", `${handoff.id}.json`), handoff);
  recordMobileAudit({ cacheDir, event: { auditKind: "handoff_expired", actorRef: "system:handoff-expiry", sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, status: "expired" } });
  if (typeof notifyExpired === "function") {
    try {
      notifyExpired({ type: "handoff.expired", handoff: { ...handoff } });
      recordMobileAudit({ cacheDir, event: { auditKind: "handoff_expiry_notification_queued", actorRef: "system:handoff-expiry", sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, status: "notification_queued" } });
    } catch {
      recordMobileAudit({ cacheDir, event: { auditKind: "handoff_expiry_notification_failed", actorRef: "system:handoff-expiry", sourceActorRef: handoff.sourceActorRef || null, sourceOwnerRef: handoff.sourceOwnerRef || null, approvalRef: handoff.approvalId, handoffCorrelationId: handoff.handoffCorrelationId, handoffId: handoff.id, status: "notification_failed" } });
    }
  }
  return handoff;
}

function approvalActionLevel(approval) {
  if (["B", "C", "D"].includes(approval?.actionLevel)) return approval.actionLevel;
  if (approval?.riskLevel === "destructive") return "D";
  if (approval?.riskLevel === "high") return "C";
  return "B";
}

/**
 * Mobile is a projection of the workstation control plane, never an
 * independent project registry.  Projects may opt into an HTTPS preview with
 * `mobile.preview` in workspace.graph.json; absent that declaration they get
 * a navigable information card instead of an unsafe guessed URL.
 */
export function buildMobileWorkspaceSnapshot({ workspaceRoot = DEFAULT_WORKSPACE_ROOT, graphPath = join(workspaceRoot, "workspace.graph.json"), registryPath = join(workspaceRoot, "infra", "axi-workspace-governance", "workspace.json"), agentTasks = new Map(), approvals = new Map(), codexBin = "codex", appServerBin = "/Applications/Codex.app/Contents/Resources/codex" } = {}) {
  const snapshot = buildSnapshot({ workspaceRoot, graphPath, registryPath, agentTasks, approvals, codexBin, appServerBin });
  const graph = readJson(graphPath, { projects: {} });
  const completion = readJson(join(workspaceRoot, ".workspace", "project-completion.json"), { projects: [] });
  const completionById = new Map(
    (Array.isArray(completion.projects) ? completion.projects : [])
      .filter((item) => item && typeof item.id === "string")
      .map((item) => [item.id, item]),
  );
  const projects = Object.entries(graph.projects || {}).map(([id, project]) => {
    const resource = snapshot.resources.find((item) => item.id === id);
    const mobile = project.mobile || {};
    const completionEntry = completionById.get(id) || null;
    const preview = mobile.preview || {};
    const previewUrl = typeof preview.url === "string" && /^https:\/\//.test(preview.url) ? preview.url : null;
    const previewMode = previewUrl && ["embedded_web", "external_web"].includes(preview.mode) ? preview.mode : "none";
    const lastVerifiedAt = mobile.lastVerifiedAt || completionEntry?.updatedAt || null;
    const healthState = mobile.health
      ? { health: mobile.health, reasonCode: mobile.reasonCode || reasonCodeForHealth(mobile.health) }
      : deriveMobileHealthState({ resource, completion: completionEntry, lastVerifiedAt });
    const health = healthState.health;
    const progress = mobile.progress || buildMobileProgress(completionEntry);
    const capabilities = normalizedStrings(mobile.capabilities || project.provides || []);
    return {
      id,
      name: project.name || id,
      kind: project.kind || "project",
      status: resource?.status || project.status || "unknown",
      health,
      reasonCode: healthState.reasonCode,
      summary: mobile.summary || project.description || (resource?.provides || []).join("，") || "尚未提供项目摘要。",
      architecture: mobile.architecture || { provides: project.provides || [], consumes: project.consumes || [], contracts: project.contracts || [] },
      phase: mobile.phase || "unknown",
      lastVerifiedAt,
      capabilities,
      progress,
      configuration: buildMobileConfiguration({ id, project, graph, workspaceRoot }),
      preview: {
        mode: previewMode,
        url: previewUrl,
        allowEmbedded: previewMode === "embedded_web" && preview.allowEmbedded === true,
        coverUrl: typeof preview.coverUrl === "string" && /^https:\/\//.test(preview.coverUrl) ? preview.coverUrl : null,
        infoPageUrl: typeof mobile.infoPageUrl === "string" && /^https:\/\//.test(mobile.infoPageUrl) ? mobile.infoPageUrl : null,
        fallbackMessage: previewMode === "none" ? "该项目尚未登记受控预览；请查看项目摘要与架构信息。" : null,
      },
      actions: buildMobileProjectActions({ project: { id, name: project.name || id, health, reasonCode: healthState.reasonCode }, resource }),
      source: "workspace.graph",
    };
  }).sort((left, right) => left.name.localeCompare(right.name));
  const attentionItems = projects
    .flatMap((project) => buildProjectAttention(project))
    .concat(buildRuntimeAttention(snapshot))
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || right.updatedAt.localeCompare(left.updatedAt));
  const summary = {
    total: projects.length,
    healthy: projects.filter((project) => project.health === "healthy").length,
    attention: projects.filter((project) => project.health === "attention").length,
    blocked: projects.filter((project) => project.health === "blocked").length,
    stale: projects.filter((project) => project.health === "stale").length,
    unknown: projects.filter((project) => project.health === "unknown").length,
  };
  const mobileTasks = snapshot.agentTasks
    .map((task) => mobileRunningTask(task))
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  return {
    generatedAt: snapshot.generatedAt,
    source: "workspace.graph",
    summary,
    attentionItems,
    projects,
    runningTasks: mobileTasks
      .filter((task) => !["succeeded", "failed", "cancelled"].includes(task.status)),
    // 已结束的受管任务不是“待处理”事项，但移动端必须能把审批闭环的真实
    // 结果带回项目详情。只投影最近结果，不暴露命令、cwd 或原始 shell 输入。
    recentTasks: mobileTasks
      .filter((task) => ["succeeded", "failed", "cancelled"].includes(task.status))
      .slice(0, 12),
    approvals: snapshot.approvals
      .filter((approval) => approval.status === "pending")
      .map((approval) => mobileApproval(approval)),
  };
}

function normalizedStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
}

function mobileRunningTask(task) {
  const status = task.status || "running";
  const actionType = task.operation === "project_diagnosis"
    ? "project_diagnosis"
    : task.runtime === "registered_command" ? "project_verification" : null;
  const reasonCode = status === "running"
    ? "task_running"
    : status === "failed"
      ? actionType === "project_diagnosis" ? "diagnosis_failed" : "task_execution_failed"
      : status === "cancelled"
        ? "task_cancelled"
        : actionType === "project_diagnosis" ? "diagnosis_completed" : "verification_completed";
  return {
    id: task.id || task.jobId || randomUUID(),
    projectId: task.projectId || task.targetId || null,
    status,
    reasonCode,
    summary: task.summary || "受管任务正在执行。",
    actionType,
    updatedAt: task.completedAt || task.updatedAt || task.startedAt || task.createdAt || new Date().toISOString(),
  };
}

function mobileApproval(approval) {
  return {
    id: approval.id,
    projectId: approval.projectId || null,
    actionId: approval.actionId || null,
    actionType: approval.actionType || null,
    source: approval.source || "control-plane",
    status: approval.status || "pending",
    actionSummary: approval.actionSummary || "存在待审批事项",
    riskLevel: approval.riskLevel || "medium",
    createdAt: approval.createdAt || new Date().toISOString(),
  };
}

function buildMobileProgress(completion) {
  if (!completion) {
    return {
      stage: "unknown",
      confidence: "unknown",
      summary: "尚未生成项目完成度证据。",
      updatedAt: null,
      evidenceCount: 0,
      remaining: [],
    };
  }
  return {
    stage: completion.stage || "unknown",
    confidence: completion.confidence || "unknown",
    summary: completion.summary || "尚未提供进展摘要。",
    updatedAt: completion.updatedAt || null,
    evidenceCount: Array.isArray(completion.evidence) ? completion.evidence.length : 0,
    remaining: normalizedStrings(completion.remaining).slice(0, 8),
  };
}

function buildMobileConfiguration({ id, project, graph, workspaceRoot }) {
  const projectPath = typeof project.path === "string" ? project.path : "";
  const relativePath = projectPath
    ? relative(workspaceRoot, projectPath).replaceAll("\\", "/") || "."
    : null;
  const profiles = Object.entries(graph.profiles || {})
    .filter(([, profile]) => profile?.projectId === id || profile?.project === id || profile?.owner === id)
    .map(([profileId]) => profileId);
  const projectFacts = [
    { key: "kind", label: "类型", value: project.kind || "project" },
    relativePath ? { key: "path", label: "工作区路径", value: relativePath } : null,
    { key: "source", label: "事实源", value: "workspace.graph" },
  ].filter(Boolean);
  const architectureFacts = [
    { key: "provides", label: "提供能力", value: String(normalizedStrings(project.provides).length) },
    { key: "consumes", label: "消费依赖", value: String(normalizedStrings(project.consumes).length) },
    { key: "contracts", label: "公开契约", value: String(normalizedStrings(project.contracts).length) },
  ];
  const runtimeFacts = [
    typeof project.runtime === "string" ? { key: "runtime", label: "运行时", value: project.runtime } : null,
    typeof project.packageManager === "string" ? { key: "packageManager", label: "包管理器", value: project.packageManager } : null,
    profiles.length ? { key: "profiles", label: "启动配置", value: profiles.join("、") } : null,
  ].filter(Boolean);
  return [
    { id: "project", title: "项目", facts: projectFacts },
    { id: "architecture", title: "架构", facts: architectureFacts },
    ...(runtimeFacts.length ? [{ id: "runtime", title: "运行", facts: runtimeFacts }] : []),
  ];
}

function deriveMobileHealthState({ resource, completion, lastVerifiedAt }) {
  if (resource?.status === "missing") return { health: "blocked", reasonCode: "project_unavailable" };
  if (!completion) return { health: "unknown", reasonCode: "evidence_missing" };
  if (completion.stage === "blocked" || completion.stage === "failed") return { health: "blocked", reasonCode: "project_blocked" };
  if (completion.handoff?.status === "unready") return { health: "attention", reasonCode: "handoff_unready" };
  if (isOlderThanDays(lastVerifiedAt, 30) || completion.handoff?.status === "stale") return { health: "stale", reasonCode: "evidence_stale" };
  if (completion.confidence === "low" || completion.stage === "unassessed") return { health: "attention", reasonCode: "evidence_low_confidence" };
  return { health: "healthy", reasonCode: "verified" };
}

function reasonCodeForHealth(health) {
  return {
    blocked: "project_blocked",
    attention: "evidence_low_confidence",
    stale: "evidence_stale",
    unknown: "evidence_missing",
    healthy: "verified",
  }[health] || "evidence_missing";
}

function isOlderThanDays(value, days) {
  if (typeof value !== "string" || !value) return false;
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) return false;
  return Date.now() - epoch > days * 24 * 60 * 60 * 1000;
}

function buildProjectAttention(project) {
  const updatedAt = project.progress?.updatedAt || project.lastVerifiedAt || new Date(0).toISOString();
  switch (project.health) {
    case "blocked":
      return [{ id: `project:${project.id}:blocked`, projectId: project.id, severity: "critical", type: "project_blocked", reasonCode: project.reasonCode, title: `${project.name} 已阻塞`, summary: mobileReasonSummary(project.reasonCode), updatedAt }];
    case "stale":
      return [{ id: `project:${project.id}:stale`, projectId: project.id, severity: "warning", type: "verification_stale", reasonCode: project.reasonCode, title: `${project.name} 待核验`, summary: mobileReasonSummary(project.reasonCode), updatedAt }];
    case "attention":
      return [{ id: `project:${project.id}:attention`, projectId: project.id, severity: "warning", type: "project_attention", reasonCode: project.reasonCode, title: `${project.name} 需要关注`, summary: mobileReasonSummary(project.reasonCode), updatedAt }];
    case "unknown":
      return [{ id: `project:${project.id}:unknown`, projectId: project.id, severity: "info", type: "verification_needed", reasonCode: project.reasonCode, title: `${project.name} 待评估`, summary: mobileReasonSummary(project.reasonCode), updatedAt }];
    default:
      return [];
  }
}

function mobileReasonSummary(reasonCode) {
  return {
    project_unavailable: "项目目录当前不可用，暂不能执行受管核验。",
    evidence_missing: "尚未记录可用的完成度证据，建议先申请只读诊断。",
    project_blocked: "项目已报告阻塞状态，请先查看下一步或申请诊断。",
    handoff_unready: "交接信息尚未就绪，建议复核当前进展。",
    evidence_stale: "最近核验或交接记录已超过有效期。",
    evidence_low_confidence: "当前证据置信度不足，建议复核后再继续。",
    task_execution_failed: "受管任务执行失败，请查看任务结果。",
    diagnosis_failed: "诊断未完成，请查看任务结果后再处理。",
    approval_pending: "该操作正在等待已配对的 owner 审批。",
  }[reasonCode] || "该工作项需要进一步核验。";
}

function buildMobileProjectActions({ project, resource }) {
  const healthCommand = (resource?.commands || []).find(isMobileReadOnlyHealthCommand);
  const actions = [];
  if (healthCommand) {
    actions.push({
      actionId: "verify",
      commandId: healthCommand.id,
      label: "重新核验",
      intent: healthCommand.intent,
      autoExecutable: true,
      actionType: "project_verification",
      actionLevel: "B",
      executionMode: "immediate",
      riskLevel: "low",
      summary: "运行已登记的只读核验，并记录可追溯结果。",
    });
  }
  if (resource?.status === "available" && project.health !== "healthy") {
    actions.push({
      actionId: "diagnose",
      commandId: `diagnose:${project.id}`,
      label: "申请诊断",
      intent: "project_diagnosis",
      autoExecutable: false,
      actionType: "project_diagnosis",
      actionLevel: "B",
      executionMode: "requires_approval",
      riskLevel: "medium",
      summary: "只读复核项目状态与证据，不修改项目文件。",
    });
  }
  return actions;
}

function isMobileReadOnlyHealthCommand(command) {
  if (!command?.autoExecutable || command.intent !== "run_health") return false;
  const source = String(command.command || "");
  return !/\b(?:npm|pnpm|yarn)\s+(?:install|add|remove|update|publish)\b|\b(?:gradlew|\.\/gradlew)\b[^\n;|&]*(?:\bclean\b|\bassemble\b|\binstall\b|\bpublish\b)|\b(?:git\s+(?:commit|push|pull|merge|rebase|checkout|switch|reset|clean))\b/i.test(source);
}

function buildRuntimeAttention(snapshot) {
  const now = snapshot.generatedAt;
  const taskItems = snapshot.agentTasks
    .filter((task) => ["failed", "blocked", "rejected_rework", "policy_violation"].includes(task.status))
    .map((task) => ({
      id: `task:${task.id || task.jobId || `${task.projectId || "unknown"}:${task.status}:${task.updatedAt || now}`}`,
      // Registered mobile health checks retain their resource target in targetId.
      // Keep that association when surfacing a failed task so mobile can put the
      // result back under its project instead of showing an orphaned alert.
      projectId: task.projectId || task.targetId || null,
      severity: task.status === "failed" ? "critical" : "warning",
      type: "task_attention",
      reasonCode: task.runtime === "project_diagnosis" && task.status === "failed" ? "diagnosis_failed" : "task_execution_failed",
      title: task.summary || task.title || "任务需要关注",
      summary: mobileReasonSummary(task.runtime === "project_diagnosis" && task.status === "failed" ? "diagnosis_failed" : "task_execution_failed"),
      updatedAt: task.updatedAt || now,
    }));
  const approvalItems = snapshot.approvals
    .filter((approval) => approval.status === "pending")
    .map((approval) => ({
      id: `approval:${approval.id}`,
      projectId: approval.projectId || null,
      severity: "info",
      type: "approval_pending",
      reasonCode: "approval_pending",
      title: approval.actionSummary || "存在待审批事项",
      summary: mobileReasonSummary("approval_pending"),
      updatedAt: approval.createdAt || now,
    }));
  return taskItems.concat(approvalItems);
}

function severityRank(value) {
  return { critical: 3, warning: 2, info: 1 }[value] || 0;
}

function normalizeApprovalRecord(approval) {
  if (dateFromValue(approval?.expiresAt)) return approval;
  const createdAt = validIsoDate(approval?.createdAt) || new Date().toISOString();
  return {
    ...approval,
    createdAt,
    expiresAt: new Date(new Date(createdAt).getTime() + APPROVAL_TTL_MS).toISOString(),
  };
}

export function buildSnapshot({ workspaceRoot = DEFAULT_WORKSPACE_ROOT, graphPath = join(workspaceRoot, "workspace.graph.json"), registryPath = join(workspaceRoot, "infra", "axi-workspace-governance", "workspace.json"), cacheDir = "", eventSources = [], agentTasks = new Map(), approvals = new Map(), codexBin = "codex", appServerBin = "/Applications/Codex.app/Contents/Resources/codex" } = {}) {
  const graph = readJson(graphPath, { projects: {}, profiles: {} });
  const registry = readJson(registryPath, null);
  const generatedAt = new Date().toISOString();
  const resolvedEventSources = eventSources.length ? eventSources : resolveDeclaredWorkspaceEventSources({ graph, registry });
  const risks = loadPersistedRecordMap(join(cacheDir, "risks"));
  const incidents = loadPersistedRecordMap(join(cacheDir, "incidents"));
  const evidenceRecords = loadPersistedRecordMap(join(cacheDir, "evidence"));
  const policyDecisions = loadPersistedRecordMap(join(cacheDir, "policy-decisions"));
  const automationRecords = loadPersistedRecordMap(join(cacheDir, "automations"));
  const resources = Object.entries(graph.projects || {}).map(([id, project]) =>
    buildResource({ id, project, graph, workspaceRoot })
  );

  const communicationGatewayPath = resolveOptionalPath({
    workspaceRoot: WORKSTATION_ROOT,
    envNames: ["AXI_COMMUNICATION_GATEWAY_ROOT"],
    canonicalRelative: ["services", "communication-gateway"],
  });
  const ccConnectPath = resolveOptionalPath({
    workspaceRoot,
    envNames: ["AXI_CC_CONNECT_ROOT", "CC_CONNECT_HOME"],
  });
  const notifyProjectPath = resolveRegisteredProjectPath({ id: "axi-notify", workspaceRoot, graph, registry, registryPath });
  const mobilePath = resolveOptionalPath({
    workspaceRoot,
    envNames: ["AXI_MOBILE_ROOT"],
    declaredPath: notifyProjectPath ? join(notifyProjectPath, "android-app") : "",
  });
  const notifyPath = resolveOptionalPath({
    workspaceRoot,
    envNames: ["AXI_NOTIFY_ROOT"],
    declaredPath: notifyProjectPath,
  });
  const fleetConsolePath = resolveOptionalPath({
    workspaceRoot,
    envNames: ["AXI_FLEET_CONSOLE_ROOT"],
    canonicalRelative: ["infra", "fleet-console"],
  });

  addOptionalResource(resources, {
    id: "communication-gateway",
    name: "Axi Workstation Communication Gateway",
    layer: "communication",
    kind: "chat-codex-style-gateway",
    path: communicationGatewayPath || undefined,
    status: pathBackedStatus(communicationGatewayPath),
    provides: ["route-binding", "pairing", "approval-routing", "attachment-refs", "im-rendering"],
    metadata: {
      role: "communication_gateway",
      focus: "Own transport adapters, route pairing, approval commands, attachment references, and response rendering.",
    },
  });
  addOptionalResource(resources, {
    id: "cc-connect",
    name: "cc-connect",
    layer: "communication",
    kind: "im-gateway",
    path: ccConnectPath || undefined,
    status: pathBackedStatus(ccConnectPath),
    provides: ["message-normalization", "im-routing", "feishu-transport"],
    metadata: {
      role: "communication_gateway",
      focus: "Normalize IM events, route messages, send receipts, and keep transport concerns out of product logic.",
    },
  });
  addOptionalResource(resources, {
    id: "feishu",
    name: "Feishu",
    layer: "im",
    kind: "intelligence-station",
    path: ccConnectPath || undefined,
    status: pathBackedStatus(ccConnectPath),
    provides: ["briefings", "status-intelligence", "alerts"],
    metadata: {
      role: "intelligence_station",
      focus: "Push and query concise project intelligence, progress, alerts, and situational awareness.",
    },
  });
  addOptionalResource(resources, {
    id: "axi-mobile",
    name: "Axi Mobile",
    layer: "im",
    kind: "mobile-workbench",
    path: mobilePath || undefined,
    status: pathBackedStatus(mobilePath),
    provides: ["mobile-workbench", "command-workspace", "notification-inbox"],
    metadata: {
      role: "role_execution_surface",
      focus: "承接个人上下文、告警和受控的角色执行动作；完整后台管理仍由 Web 控制中心负责。",
    },
  });
  addOptionalResource(resources, {
    id: "axi-notify",
    name: "Axi Notify",
    layer: "base_service",
    kind: "notification-relay",
    path: notifyPath || undefined,
    status: pathBackedStatus(notifyPath),
    provides: ["relay-notifications", "workflow-events", "mobile-event-inbox"],
    metadata: {
      role: "notification_service",
      focus: "Relay auditable workflow events to the Axi Mobile inbox and notification surface.",
    },
  });
  addOptionalResource(resources, {
    id: "wechat-private",
    name: "WeChat Private Chat",
    layer: "im",
    kind: "lightweight-remote-chat",
    status: "planned",
    provides: ["private-chat-commands", "pairing", "approval-replies"],
    metadata: {
      role: "lightweight_remote_chat",
      focus: "Use personal private chat as a lightweight remote Axi Workstation entry after route pairing.",
    },
  });
  addOptionalResource(resources, {
    id: "fleet-console",
    name: "Fleet Console",
    layer: "physical_service",
    kind: "physical-resource-registry",
    path: fleetConsolePath || undefined,
    status: pathBackedStatus(fleetConsolePath),
    provides: ["machine-registry", "ansible-ops", "monitoring-targets"],
  });

  const axiResources = buildAxiResourceSnapshot({ generatedAt, graph, resources, agentTasks });
  const profiles = Object.entries(graph.profiles || {}).map(([id, profile]) => ({
    id,
    description: profile.description || "",
    projects: profile.projects || [],
    commands: [
      ...(profile.health || profile.verify || profile.start || []).map((command, index) =>
        makeCommand({ ownerId: `profile:${id}`, intent: "run_health", label: `Profile ${id} command ${index + 1}`, command, cwd: workspaceRoot, index })
      ),
      ...(profile.remediation || []).map((command, index) =>
        makeCommand({ ownerId: `profile:${id}`, intent: "run_remediation", label: `Profile ${id} remediation ${index + 1}`, command, cwd: workspaceRoot, index })
      ),
    ],
  }));

  return {
    generatedAt,
    resources: resources.sort((left, right) => layerRank(left.layer) - layerRank(right.layer) || left.id.localeCompare(right.id)),
    routes: [],
    approvals: Array.from(approvals.values()).map(normalizeApprovalRecord),
    agentTasks: Array.from(agentTasks.values()),
    runtimes: inspectAgentRuntimes({ codexBin, appServerBin }),
    axiResources,
    governance: buildGovernanceSnapshot({ workspaceRoot, graphPath, registryPath, graph, registry, resources, generatedAt, cacheDir, eventSources: resolvedEventSources, evidenceRecords: Array.from(evidenceRecords.values()), risks: Array.from(risks.values()), incidents: Array.from(incidents.values()), policyDecisions: Array.from(policyDecisions.values()), automationRecords: Array.from(automationRecords.values()) }),
    profiles,
};
}

/**
 * Build the first read-only Governance Object + Evidence projection.
 *
 * Registry and graph are deliberately kept as separate declarations.  The
 * projection chooses the registry for canonical identity fields when both
 * sources know an object, but preserves conflicts and source references so a
 * later importer can resolve them without last-write-wins data loss.
 */
export function buildGovernanceSnapshot({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  graphPath = join(workspaceRoot, "workspace.graph.json"),
  registryPath = join(workspaceRoot, "infra", "axi-workspace-governance", "workspace.json"),
  graph = readJson(graphPath, { projects: {} }),
  registry = readJson(registryPath, null),
  resources = [],
  generatedAt = new Date().toISOString(),
  cacheDir = "",
  eventSources = [],
  evidenceRecords = [],
  risks = [],
  incidents = [],
  policyDecisions = [],
  automationRecords = [],
} = {}) {
  const observedAt = validIsoDate(generatedAt) || new Date().toISOString();
  const observedDate = new Date(observedAt);
  const graphProjects = isRecord(graph?.projects) ? graph.projects : {};
  const registryEntries = readGovernanceRegistryEntries(registry);
  const registryById = new Map(registryEntries.map((entry) => [entry.id, entry]));
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const ids = [...new Set([...Object.keys(graphProjects), ...registryEntries.map((entry) => entry.id)])].sort();
  const governanceObjectRefs = new Set(ids);
  const evidence = evidenceRecords.filter(isRecord).map((record) => refreshPersistedEvidence(record, observedDate));
  const documents = [];
  const conflicts = [];
  const warnings = [];
  const automations = buildGovernanceAutomations({ graph, resources, graphPath, evidence, now: observedDate, automationRecords });

  const units = ids.map((id) => {
    const graphProject = isRecord(graphProjects[id]) ? graphProjects[id] : {};
    const registryEntry = registryById.get(id) || null;
    const resource = resourceById.get(id) || null;
    const graphDeclaredPath = declaredAbsolutePath(graphProject.path, workspaceRoot);
    const registryDeclaredPath = declaredAbsolutePath(registryEntry?.path, dirname(registryPath));
    const unitConflicts = [];

    if (graphDeclaredPath && registryDeclaredPath && graphDeclaredPath !== registryDeclaredPath) {
      unitConflicts.push({
        subjectRef: id,
        field: "path",
        values: [
          { source: "workspace.graph", value: graphDeclaredPath },
          { source: "workspace.registry", value: registryDeclaredPath },
        ],
      });
    }

    const graphOwner = firstString(graphProject.ownerRef, graphProject.owner);
    const registryOwner = firstString(registryEntry?.ownerRef, registryEntry?.owner);
    if (graphOwner && registryOwner && graphOwner !== registryOwner) {
      unitConflicts.push({
        subjectRef: id,
        field: "ownerRef",
        values: [
          { source: "workspace.graph", value: graphOwner },
          { source: "workspace.registry", value: registryOwner },
        ],
      });
    }

    const graphType = firstString(graphProject.objectType, graphProject.governanceUnitType);
    const registryType = firstString(
      registryEntry?.objectType,
      registryEntry && GOVERNANCE_REGISTRY_OBJECT_TYPES[registryEntry.collection],
    );
    if (graphType && registryType && graphType !== registryType) {
      unitConflicts.push({
        subjectRef: id,
        field: "objectType",
        values: [
          { source: "workspace.graph", value: graphType },
          { source: "workspace.registry", value: registryType },
        ],
      });
    }

    conflicts.push(...unitConflicts);
    for (const conflict of unitConflicts) warnings.push(`identity_conflict:${conflict.subjectRef}:${conflict.field}`);

    const evidenceRefs = [];
    evidenceRefs.push(...evidence.filter((item) => item.subjectRef === id).map((item) => item.id));
    if (Object.hasOwn(graphProjects, id)) {
      evidenceRefs.push(addGovernanceEvidence(evidence, {
        id: `evidence:${id}:graph`,
        source: "workspace.graph",
        evidenceType: "declaration",
        observedAt,
        confidence: "medium",
        status: "declared",
        subjectRef: id,
        artifactRef: graphPath,
        now: observedDate,
      }));
    }
    if (registryEntry) {
      evidenceRefs.push(addGovernanceEvidence(evidence, {
        id: `evidence:${id}:registry`,
        source: "workspace.registry",
        evidenceType: "declaration",
        observedAt,
        confidence: "high",
        status: "declared",
        subjectRef: id,
        artifactRef: registryPath,
        now: observedDate,
      }));
    }

    const canonicalPath = registryDeclaredPath || graphDeclaredPath || resource?.path || "";
    evidenceRefs.push(addGovernanceEvidence(evidence, {
      id: `evidence:${id}:structure`,
      source: "control-plane.filesystem",
      evidenceType: "structural",
      observedAt,
      confidence: canonicalPath && !isForeignAbsolutePath(canonicalPath) ? "high" : "low",
      status: canonicalPath
        ? isForeignAbsolutePath(canonicalPath) ? "unknown" : (existsSync(canonicalPath) ? "available" : "missing")
        : "unknown",
      subjectRef: id,
      artifactRef: canonicalPath || null,
      now: observedDate,
    }));

    const completion = isRecord(graphProject.completion) ? graphProject.completion : null;
    if (completion) {
      const completionObservedAt = validIsoDate(completion.updatedAt) || observedAt;
      const completionExpiry = new Date(new Date(completionObservedAt).getTime() + GOVERNANCE_COMPLETION_EVIDENCE_TTL_MS).toISOString();
      const completionEvidenceId = addGovernanceEvidence(evidence, {
        id: `evidence:${id}:completion`,
        source: "workspace.graph.completion",
        evidenceType: "declaration",
        observedAt: completionObservedAt,
        confidence: completion.confidence,
        status: completion.stage || "declared",
        subjectRef: id,
        artifactRef: governanceStrings(completion.evidence)[0] || graphPath,
        expiresAt: completionExpiry,
        now: observedDate,
      });
      evidenceRefs.push(completionEvidenceId);
      if (evidence.at(-1)?.freshness === "stale") warnings.push(`evidence_stale:${id}:completion`);
    }

    const ownerRef = firstString(registryOwner, graphOwner) || "unknown";
    const ownerEvidenceRef = registryOwner
      ? `evidence:${id}:registry`
      : graphOwner
        ? `evidence:${id}:graph`
        : undefined;
    const ownerStatus = ownerRef !== "unknown"
      ? "resolved"
      : isExternalGovernanceUnit(graphProject, registryEntry)
        ? "external"
        : "unknown";
    if (ownerRef === "unknown") warnings.push(`owner_unresolved:${id}`);
    const objectType = firstString(
      registryType,
      graphType,
      registryEntry && GOVERNANCE_REGISTRY_OBJECT_TYPES[registryEntry.collection],
      registryEntry?.kind,
      graphProject.kind,
      "unknown",
    );
    const lifecycle = firstString(registryEntry?.lifecycle, graphProject.lifecycle, "unknown");
    const status = firstString(resource?.status, registryEntry?.status, "unknown");
    const name = firstString(registryEntry?.name, graphProject.name, resource?.name, id);
    const declarations = {
      ...(Object.hasOwn(graphProjects, id) ? { graph: graphPath } : {}),
      ...(registryEntry ? { registry: registryPath } : {}),
    };
    const documentProjection = buildProjectDocuments({ id, ownerRef, graphProject, registryEntry, projectRoot: canonicalPath, evidence, documents, warnings, conflicts, now: observedDate });
    evidenceRefs.push(...documentProjection.evidenceRefs);
    const documentRefs = documentProjection.documentRefs;
    const unitFreshness = aggregateGovernanceFreshness(evidence, evidenceRefs);
    const health = buildGovernanceHealth({ id, ownerRef, conflicts: unitConflicts, evidence, evidenceRefs });

    return {
      id,
      objectType,
      name,
      scope: "workspace",
      ownerRef,
      ...(ownerEvidenceRef ? { ownerEvidenceRef } : {}),
      ownerStatus,
      lifecycle,
      status,
      identityStatus: unitConflicts.length ? "conflict" : registryEntry && Object.hasOwn(graphProjects, id) ? "aligned" : "partial",
      freshness: unitFreshness,
      health,
      sourceOfTruth: firstString(registryEntry?.sourceOfTruth, registryEntry ? registryPath : "", graphProject.sourceOfTruth, graphPath),
      ...(canonicalPath ? { path: canonicalPath } : {}),
      ...(firstString(graphProject.kind, registryEntry?.kind) ? { kind: firstString(graphProject.kind, registryEntry?.kind) } : {}),
      declarations,
      relationships: buildGovernanceRelationships({ id, graphProject, registryEntry, graphPath, registryPath, knownObjectRefs: governanceObjectRefs, warnings }),
      policyBindings: governanceStrings(graphProject.policyBindings || registryEntry?.policyBindings),
      evidenceRefs,
      documentRefs,
    };
  });

  const relationships = deriveGovernanceRelationships(units);
  applyDependencyHealthRollup(units, relationships);
  const impact = buildGovernanceImpact(units, relationships);
  const coverage = {
    unitCount: units.length,
    ownerResolvedCount: units.filter((unit) => unit.ownerStatus === "resolved").length,
    ownerUnknownCount: units.filter((unit) => unit.ownerStatus === "unknown").length,
    ownerExternalCount: units.filter((unit) => unit.ownerStatus === "external").length,
    identityAlignedCount: units.filter((unit) => unit.identityStatus === "aligned").length,
    identityPartialCount: units.filter((unit) => unit.identityStatus === "partial").length,
    identityConflictCount: units.filter((unit) => unit.identityStatus === "conflict").length,
  };
  const declaredProjects = Object.values(graphProjects).filter(isRecord);
  const executionCoverage = {
    declaredProjectCount: declaredProjects.length,
    healthDeclaredCount: declaredProjects.filter((project) => Array.isArray(project.health) && project.health.length > 0).length,
    verifyDeclaredCount: declaredProjects.filter((project) => Array.isArray(project.verify) && project.verify.length > 0).length,
    remediationDeclaredCount: declaredProjects.filter((project) => Array.isArray(project.remediation) && project.remediation.length > 0).length,
  };
  const dependencyEdges = relationships.filter((relationship) => relationship.relationshipType === "DEPENDS_ON");
  const relationshipMetadataCoverage = {
    dependencyEdgeCount: dependencyEdges.length,
    scopeDeclaredCount: dependencyEdges.filter((relationship) => relationship.scope !== undefined).length,
    requirednessDeclaredCount: dependencyEdges.filter((relationship) => relationship.requiredness !== undefined).length,
    dependencyPhaseDeclaredCount: dependencyEdges.filter((relationship) => relationship.dependencyPhase !== undefined).length,
    environmentDeclaredCount: dependencyEdges.filter((relationship) => relationship.environment !== undefined).length,
    versionConstraintDeclaredCount: dependencyEdges.filter((relationship) => relationship.versionConstraint !== undefined).length,
    validityWindowDeclaredCount: dependencyEdges.filter((relationship) => relationship.validFrom !== undefined || relationship.validTo !== undefined).length,
  };
  const relationshipMetadataGaps = dependencyEdges.flatMap((relationship) => {
    const missing = [
      ["requiredness", relationship.requiredness === undefined],
      ["dependencyPhase", relationship.dependencyPhase === undefined],
      ["environment", relationship.environment === undefined],
      ["versionConstraint", relationship.versionConstraint === undefined],
      ["validityWindow", relationship.validFrom === undefined && relationship.validTo === undefined],
    ].filter(([, absent]) => absent).map(([field]) => field);
    return missing.length ? [{ sourceRef: relationship.sourceRef, targetRef: relationship.targetRef, relationshipType: "DEPENDS_ON", missing, provenance: relationship.provenance }] : [];
  });
  if (dependencyEdges.some((relationship) => relationship.requiredness === undefined || relationship.dependencyPhase === undefined || relationship.environment === undefined || relationship.versionConstraint === undefined || (relationship.validFrom === undefined && relationship.validTo === undefined))) {
    warnings.push(`relationship_metadata_incomplete:${dependencyEdges.length}`);
  }
  const ruleProjection = buildGovernanceRules({ graph, graphPath, registry, registryPath, evidence, warnings, conflicts, now: observedDate });
  relationships.push(...ruleProjection.relationships);
  const rules = ruleProjection.rules;
  const resolvedEventSources = eventSources.length ? eventSources : resolveDeclaredWorkspaceEventSources({ graph, registry });
  const events = readWorkspaceEvents({ cacheDir, sources: resolvedEventSources, limit: null }).events;
  const eventCoverage = {
    declaredSourceCount: resolvedEventSources.length,
    loadedSourceCount: new Set(events.map((event) => event.source)).size,
    eventCount: events.length,
    surfaceCount: new Set(events.map((event) => event.surfaceRef).filter(Boolean)).size,
    projectCount: new Set(events.map((event) => event.projectRef).filter(Boolean)).size,
    serviceCount: new Set(events.map((event) => event.serviceRef).filter(Boolean)).size,
  };
  const waivers = buildGovernanceWaivers({ risks, events, now: observedDate });
  const violations = buildGovernanceViolations({ units, documents, rules, conflicts, evidence, events, waivers, now: observedDate });
  const authorization = buildGovernanceAuthorization({ registry, registryPath, workspaceRoot });
  warnings.push(...authorization.warnings);

  if (!registry) warnings.push("workspace_registry_unavailable");
  return {
    contractVersion: GOVERNANCE_CONTRACT_VERSION,
    generatedAt: observedAt,
    sources: {
      graph: graphPath,
      ...(registry ? { registry: registryPath } : {}),
    },
    units,
    evidence,
    relationships,
    impact,
    coverage,
    executionCoverage,
    relationshipMetadataCoverage,
    relationshipMetadataGaps,
    eventCoverage,
    documents,
    rules,
    events,
    risks: risks.filter(isRecord),
    incidents: incidents.filter(isRecord),
    violations,
    waivers,
    automations,
    governanceDocuments: buildWorkspaceGovernanceDocuments({ graph, now: observedDate }),
    policyDecisions: policyDecisions.filter(isRecord).map((decision) => {
      const eventRefs = events.filter((event) => event.policyDecisionRef === decision.id).map((event) => event.eventId);
      return eventRefs.length ? { ...decision, eventRefs } : decision;
    }),
    authorization,
    conflicts,
    warnings: [...new Set(warnings)],
  };
}

/**
 * TASK6: Build GovernanceDocument read model from workspace.graph.json declarations.
 * Each GovernanceDocument has owner, evidenceRefs, requirement, and requirementSource.
 */
function buildWorkspaceGovernanceDocuments({ graph, now }) {
  const declarations = Array.isArray(graph?.governanceDocuments) ? graph.governanceDocuments : [];
  return declarations.map((doc) => {
    // Validate evidence files exist
    const evidenceRefs = Array.isArray(doc.evidenceRefs) ? doc.evidenceRefs : [];
    const availableEvidence = evidenceRefs.filter((ref) => {
      if (!ref || typeof ref !== "string") return false;
      // Check if it's a path reference (starts with / or contains file extensions)
      if (ref.startsWith("/")) {
        return existsSync(ref);
      }
      return true;
    });

    // Determine status based on evidence availability
    let status = "present";
    if (evidenceRefs.length === 0) {
      status = "unknown";
    } else if (availableEvidence.length === 0) {
      status = "missing";
    } else if (availableEvidence.length < evidenceRefs.length) {
      status = "partial";
    }

    return {
      id: doc.id || `doc:unknown:${now.getTime()}`,
      name: doc.name || "Unnamed Document",
      description: doc.description || "",
      requirement: doc.requirement || "optional",
      requirementSource: doc.requirementSource || "unknown",
      ownerRef: doc.owner || "unknown",
      evidenceRefs,
      availableEvidenceRefs: availableEvidence,
      policyRef: doc.policyRef || null,
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      effectiveAt: doc.effectiveAt || null,
      status,
      source: "workspace.graph.governanceDocuments",
    };
  });
}

function isExternalGovernanceUnit(graphProject, registryEntry) {
  return graphProject?.external === true
    || registryEntry?.external === true
    || String(graphProject?.kind || registryEntry?.kind || "").startsWith("reference-")
    || String(graphProject?.lifecycle || registryEntry?.lifecycle || "").includes("reference");
}

function resolveDeclaredWorkspaceEventSources({ graph, registry }) {
  const graphSources = graph?.eventSources || graph?.event_sources;
  const registrySources = registry?.settings?.eventSources || registry?.settings?.event_sources;
  const sources = Array.isArray(graphSources) ? graphSources : Array.isArray(registrySources) ? registrySources : [];
  return sources.filter((source) => typeof source === "string" || (source && typeof source === "object" && typeof source.path === "string"));
}

function buildGovernanceWaivers({ risks, events = [], now }) {
  // TASK6: Support both waived and revoked status
  return risks.filter((risk) => isRecord(risk) && (risk.status === "waived" || risk.status === "revoked")).flatMap((risk) => {
    const sourceRiskRef = firstString(risk.id);
    const subjectRef = firstString(risk.targetRef);
    const reason = firstString(risk.statusReason, risk.reason);
    if (!sourceRiskRef || !subjectRef || !reason) return [];

    // TASK6: Support revoked status with revokedBy and revokedAt
    const isRevoked = risk.status === "revoked";
    const expiresAt = validIsoDate(risk.dueAt);
    let status = isRevoked ? "revoked" : (expiresAt && new Date(expiresAt).getTime() <= now.getTime() ? "expired" : "active");

    const eventRefs = events.filter((event) => event.objectRef === subjectRef || event.objectRef === sourceRiskRef).map((event) => event.eventId);

    const waiver = {
      id: `waiver:${sourceRiskRef}`,
      subjectRef,
      sourceRiskRef,
      ownerRef: firstString(risk.ownerRef, "unknown"),
      reason,
      status,
      evidenceRefs: Array.isArray(risk.evidenceRefs) ? risk.evidenceRefs.filter((value) => typeof value === "string") : [],
      eventRefs,
      issuedAt: validIsoDate(risk.updatedAt || risk.detectedAt) || now,
      source: firstString(risk.source, "control-plane.risk"),
    };

    // TASK6: Add revoked metadata when waiver is revoked
    if (isRevoked) {
      waiver.revokedBy = risk.revokedBy || risk.ownerRef || "unknown";
      waiver.revokedAt = validIsoDate(risk.revokedAt) || now;
    }

    if (expiresAt && !isRevoked) {
      waiver.expiresAt = expiresAt;
    }

    return [waiver];
  });
}

function buildGovernanceViolations({ units, documents, rules, conflicts, evidence, events = [], waivers = [], now }) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const rulesById = new Map(rules.map((rule) => [rule.id, rule]));
  const waiversBySubject = new Map(waivers.filter((waiver) => waiver.status === "active").map((waiver) => [waiver.subjectRef, waiver]));
  const violations = [];
  for (const document of documents) {
    const forbiddenPresent = document.requirement === "forbidden" && document.status === "present";
    if (!document.required && !forbiddenPresent) continue;
    if (!forbiddenPresent && document.status !== "missing" && document.status !== "stale" && document.status !== "conflict") continue;
    const waiver = waiversBySubject.get(document.subjectRef);
    const eventRefs = events.filter((event) => event.objectRef === document.subjectRef).map((event) => event.eventId);
    violations.push({
      id: `violation:${document.id}:${document.status}`,
      subjectRef: document.subjectRef,
      violationType: forbiddenPresent ? "document_forbidden_present" : `document_${document.status}`,
      severity: "warning",
      status: waiver ? "waived" : "open",
      ownerRef: document.ownerRef,
      reason: forbiddenPresent ? `forbidden document present: ${document.entrypoint}` : `document ${document.status}: ${document.entrypoint}`,
      evidenceRefs: [document.evidenceRef],
      eventRefs,
      source: document.source,
      detectedAt: now,
      ...(waiver ? { waiverRef: waiver.id } : {}),
    });
  }
  for (const [index, conflict] of conflicts.entries()) {
    const ownerRef = unitsById.get(conflict.subjectRef)?.ownerRef || rulesById.get(conflict.subjectRef)?.ownerRef || "unknown";
    const waiver = waiversBySubject.get(conflict.subjectRef);
    const eventRefs = events.filter((event) => event.objectRef === conflict.subjectRef).map((event) => event.eventId);
    const sourceEvidenceRefs = unitsById.get(conflict.subjectRef)?.evidenceRefs?.filter((ref) => ref.endsWith(":graph") || ref.endsWith(":registry"))
      || rules.filter((rule) => rule.id === conflict.subjectRef).map((rule) => rule.evidenceRef).filter(Boolean);
    const evidenceRef = sourceEvidenceRefs?.[0] || addGovernanceEvidence(evidence, {
      id: `evidence:violation:conflict:${index + 1}`,
      source: "control-plane.conflict-projection",
      evidenceType: "declaration",
      observedAt: now.toISOString(),
      confidence: "high",
      status: "conflict",
      subjectRef: conflict.subjectRef,
      artifactRef: null,
      now,
    });
    violations.push({
      id: `violation:${conflict.subjectRef}:${conflict.field}`,
      subjectRef: conflict.subjectRef,
      violationType: "declaration_conflict",
      severity: "warning",
      status: waiver ? "waived" : "open",
      ownerRef,
      reason: `conflicting declaration: ${conflict.field}`,
      evidenceRefs: [evidenceRef],
      eventRefs,
      source: "control-plane.conflict-projection",
      detectedAt: now,
      ...(waiver ? { waiverRef: waiver.id } : {}),
    });
  }
  return violations;
}

function buildGovernanceAuthorization({ registry, registryPath, workspaceRoot }) {
  const configured = readConfiguredGovernanceGrants({ registry, registryPath, workspaceRoot });
  return {
    status: configured.status,
    source: configured.source,
    ownerRef: configured.ownerRef,
    policyVersion: configured.policyVersion,
    grantCount: configured.grants.length,
    warnings: configured.warnings,
  };
}

/**
 * Normalize the existing append-only audit ledger into the Phase 4 event
 * contract. Source ledgers remain authoritative; this is a safe read model
 * with no raw payload passthrough and no mutation of historical records.
 */
export function readWorkspaceEvents({ cacheDir, sources = [], eventId = "", afterEventId = "", eventType = "", actorRef = "", objectRef = "", surfaceRef = "", projectRef = "", serviceRef = "", runRef = "", since = "", limit = 100 } = {}) {
  const ledgerSources = dedupeEventSources([
    ...(cacheDir ? [{ path: join(cacheDir, "audit.jsonl"), source: "control-plane.audit.jsonl" }] : []),
    ...sources,
  ]);
  const normalized = [];
  for (const ledger of ledgerSources) {
    if (!existsSync(ledger.path)) continue;
    const ledgerFiles = statSync(ledger.path).isDirectory()
      ? readdirSync(ledger.path).filter((file) => file.endsWith(".jsonl")).sort().map((file) => ({
        path: join(ledger.path, file),
        source: `${ledger.source}/${file}`,
      }))
      : [ledger];
    for (const ledgerFile of ledgerFiles) {
      const records = readFileSync(ledgerFile.path, "utf8")
        .split(/\r?\n/u)
        .map((line) => {
          try { return line.trim() ? JSON.parse(line) : null; } catch { return null; }
        })
        .filter(Boolean);
      let previousHash = null;
      for (const [index, record] of records.entries()) {
        normalized.push(normalizeWorkspaceEvent(record, index, previousHash, ledgerFile.source));
        previousHash = firstString(record.eventHash) || null;
      }
    }
  }
  const filtered = normalized
    .filter((event) => !eventId || event.eventId === eventId)
    .filter((event) => !eventType || event.eventType === eventType)
    .filter((event) => !actorRef || event.actorRef === actorRef)
    .filter((event) => !objectRef || event.objectRef === objectRef)
    .filter((event) => !surfaceRef || event.surfaceRef === surfaceRef)
    .filter((event) => !projectRef || event.projectRef === projectRef)
    .filter((event) => !serviceRef || event.serviceRef === serviceRef)
    .filter((event) => !runRef || event.runRef === runRef)
    .filter((event) => !since || event.occurredAt >= since)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.recordedAt.localeCompare(right.recordedAt) || left.eventId.localeCompare(right.eventId));
  const afterIndex = afterEventId ? filtered.findIndex((event) => event.eventId === afterEventId) : -1;
  const pageSource = filtered.slice(afterIndex >= 0 ? afterIndex + 1 : 0);
  const pageSize = limit === null ? pageSource.length : Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;
  const events = pageSource.slice(0, pageSize);
  return {
    events,
    nextCursor: pageSource.length > events.length ? events.at(-1)?.eventId || null : null,
  };
}

function normalizeWorkspaceEvent(record, index, previousHash = null, source = "control-plane.audit.jsonl") {
  const fallbackEventId = source === "control-plane.audit.jsonl" ? `audit:${index + 1}` : `audit:${source}:${index + 1}`;
  const eventId = firstString(record.eventId, record.id, record.auditId) || fallbackEventId;
  const eventType = firstString(
    record.eventType,
    record.auditKind === "job_event" && record.type ? `job.${record.type}` : "",
    record.auditKind,
    record.type,
    record.intent,
    "observation",
  );
  const occurredAt = eventDate(record.occurredAt || record.createdAt || record.completedAt) || new Date(0).toISOString();
  const actorRef = firstString(record.actorRef, record.actor, record.ownerSubject, record.deviceId, record.envelope?.senderId) || "unknown";
  const objectRef = firstString(record.objectRef, record.handoffId, record.projectId, record.approvalRef, record.approvalId, record.jobId, record.taskId, record.targetId) || "workspace";
  const correlationId = firstString(record.correlationId, record.handoffCorrelationId, record.envelope?.raw?.correlationId) || eventId;
  const hash = calculateAuditHash(record, previousHash);
  const storedHash = firstString(record.eventHash);
  const storedPreviousHash = firstString(record.previousEventHash) || null;
  const integrityStatus = storedHash
    ? storedHash === hash && storedPreviousHash === previousHash ? "verified" : "invalid"
    : "unverified";
  return {
    eventId,
    eventType,
    occurredAt,
    recordedAt: eventDate(record.recordedAt) || occurredAt,
    actorRef,
    ...(firstString(record.surface) ? { surfaceRef: record.surface } : {}),
    ...(firstString(record.projectId) ? { projectRef: record.projectId } : {}),
    ...(firstString(record.serviceId) ? { serviceRef: record.serviceId } : {}),
    ...(firstString(record.runId) ? { runRef: record.runId } : {}),
    scopeRef: firstString(record.scopeRef, record.scope) || "workspace",
    objectRef,
    action: firstString(record.action, record.auditKind, record.type, record.intent) || eventType,
    ...(firstString(record.beforeRef) ? { beforeRef: record.beforeRef } : {}),
    ...(firstString(record.afterRef) ? { afterRef: record.afterRef } : {}),
    correlationId,
    ...(firstString(record.causationId) ? { causationId: record.causationId } : {}),
    ...(firstString(record.policyDecisionRef) ? { policyDecisionRef: record.policyDecisionRef } : {}),
    evidenceRefs: Array.isArray(record.evidenceRefs) ? record.evidenceRefs.filter((value) => typeof value === "string") : [],
    result: firstString(record.result, record.status, record.verdict) || "observed",
    source,
    retentionClass: record.retentionClass === "legal_hold" || record.retentionClass === "extended" ? record.retentionClass : "default",
    immutable: true,
    integrity: { status: integrityStatus, hash, previousHash },
  };
}

function dedupeEventSources(sources) {
  const seen = new Set();
  return sources
    .map((value) => {
      if (typeof value === "string") {
        const path = expandEventSourcePath(value);
        return { path, source: value };
      }
      if (!value || typeof value !== "object") return null;
      const path = expandEventSourcePath(firstString(value.path));
      return path ? { path, source: firstString(value.source, value.id) || path } : null;
    })
    .filter((value) => value && !seen.has(value.path) && seen.add(value.path));
}

function expandEventSourcePath(value) {
  if (!value) return "";
  let expanded = value.replace(/^~(?=\/|$)/u, process.env.HOME || "~");
  expanded = expanded.replace(/\$\{([A-Z_][A-Z0-9_]*)\}|\$([A-Z_][A-Z0-9_]*)/gu, (match, braced, plain) => {
    const name = braced || plain;
    return Object.hasOwn(process.env, name) ? process.env[name] : match;
  });
  return expanded;
}

function parseEventSources(value) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Evaluate a Workspace RBAC grant set without mutating any source of truth.
 * Scope inheritance is explicit, deny always wins, and no matching grant is
 * a secure default deny. Group expansion and grant loading stay with the
 * future identity/registry owner rather than being inferred here.
 */
export function evaluateGovernancePolicy({ subjectRef, scopeRef = "workspace", resourceRef, action, grants = [], now = new Date(), policyVersion = "workspace-rbac-v1", correlationId = "" } = {}) {
  const createdAt = validIsoDate(now) || new Date().toISOString();
  const current = new Date(createdAt);
  const matching = grants
    .filter((grant) => grant && grant.subjectRef === subjectRef && grant.action === action)
    .filter((grant) => grant.resourceRef === "*" || grant.resourceRef === resourceRef)
    .filter((grant) => grantMatchesScope(grant, scopeRef, resourceRef))
    .filter((grant) => grantIsActive(grant, current))
    .sort((left, right) => Number(right.priority || 0) - Number(left.priority || 0) || String(left.id).localeCompare(String(right.id)));
  const matchedGrantRefs = matching.map((grant) => grant.id);
  const denied = matching.filter((grant) => grant.effect === "deny");
  const evidenceRequired = matching.filter((grant) => grant.effect === "require_additional_evidence");
  const approvalRequired = matching.filter((grant) => grant.effect === "require_approval");
  const allowed = matching.filter((grant) => grant.effect === "allow");
  const decision = denied.length
    ? "deny"
    : evidenceRequired.length
      ? "require_additional_evidence"
      : approvalRequired.length
        ? "require_approval"
        : allowed.length
          ? "allow"
          : "deny";
  const reason = denied.length
    ? "deny_precedence"
    : evidenceRequired.length
      ? "additional_evidence_required"
      : approvalRequired.length
        ? "approval_required"
        : allowed.length
          ? "matched_allow_grant"
          : "no_matching_grant";
  const expiryTimes = matching
    .map((grant) => dateFromValue(grant.validTo)?.getTime())
    .filter((value) => Number.isFinite(value));
  const expiresAt = expiryTimes.length ? new Date(Math.min(...expiryTimes)).toISOString() : null;
  const decisionId = `policy-decision:${randomUUID()}`;
  return {
    id: decisionId,
    subjectRef,
    scopeRef,
    resourceRef,
    action,
    decision,
    reason,
    matchedGrantRefs,
    policyVersion,
    correlationId: firstString(correlationId, decisionId),
    createdAt,
    expiresAt,
    evidenceRefs: [...new Set(matching.flatMap((grant) => Array.isArray(grant.evidenceRefs) ? grant.evidenceRefs : []))],
    denyPrecedence: true,
  };
}

function evaluateConfiguredGovernancePolicy({ input = {}, workspaceRoot, registryPath, cacheDir = "" }) {
  const registry = readJson(registryPath, null);
  const configured = readConfiguredGovernanceGrants({ registry, registryPath, workspaceRoot });
  const decision = evaluateGovernancePolicy({
    subjectRef: firstString(input.subjectRef) || "unknown",
    scopeRef: firstString(input.scopeRef) || "workspace",
    resourceRef: firstString(input.resourceRef) || "unknown",
    action: firstString(input.action) || "read",
    grants: configured.grants,
    policyVersion: configured.policyVersion,
    correlationId: input.correlationId,
  });
  const evidence = createPolicyDecisionEvidence({ cacheDir, decision, grantsSource: configured.source });
  if (evidence) decision.evidenceRefs = [...new Set([...decision.evidenceRefs, evidence.id])];
  persistImmutableJson(join(cacheDir, "policy-decisions", `${safeFileName(decision.id)}.json`), decision);
  return { decision, grantsSource: configured.source, warnings: configured.warnings };
}

function createPolicyDecisionEvidence({ cacheDir, decision, grantsSource }) {
  if (!cacheDir) return null;
  const expiresAt = decision.expiresAt ? validIsoDate(decision.expiresAt) : null;
  const evidence = {
    id: `evidence:policy:${randomUUID()}`,
    observationKey: `policy:${decision.correlationId}`,
    source: "control-plane.policy",
    evidenceType: "process",
    observedAt: decision.createdAt,
    observer: GOVERNANCE_OBSERVER,
    confidence: "high",
    expiresAt,
    freshness: expiresAt ? new Date(expiresAt).getTime() <= new Date(decision.createdAt).getTime() ? "stale" : "fresh" : "not_configured",
    status: decision.decision,
    subjectRef: decision.resourceRef,
    artifactRef: grantsSource || null,
  };
  persistJson(join(cacheDir, "evidence", `${safeFileName(evidence.id)}.json`), evidence);
  return evidence;
}

function readConfiguredGovernanceGrants({ registry, registryPath, workspaceRoot }) {
  const rbac = isRecord(registry?.settings?.rbac) ? registry.settings.rbac : {};
  const grantsRef = firstString(rbac.grants, registry?.settings?.rbacGrants);
  const policyVersion = firstString(rbac.version) || "workspace-rbac-v1";
  const ownerRef = firstString(rbac.ownerRef, rbac.owner) || "unknown";
  if (!grantsRef) return { grants: [], policyVersion, source: null, ownerRef, status: "unconfigured", warnings: ["workspace_rbac_grants_unconfigured"] };
  const grantsPath = declaredAbsolutePath(grantsRef, dirname(registryPath));
  if (!grantsPath || isForeignAbsolutePath(grantsPath)) {
    return { grants: [], policyVersion, source: grantsPath || grantsRef, ownerRef, status: "unresolved", warnings: [`workspace_rbac_grants_unresolved:${grantsRef}`] };
  }
  const payload = readJson(grantsPath, null);
  if (!payload) return { grants: [], policyVersion, source: grantsPath, ownerRef, status: "missing", warnings: [`workspace_rbac_grants_missing:${grantsRef}`] };
  const rawGrants = Array.isArray(payload) ? payload : Array.isArray(payload.grants) ? payload.grants : [];
  const seenGrantIds = new Set();
  let invalidEntry = false;
  let duplicateGrantId = false;
  const grants = rawGrants
    .map((grant) => {
      const normalized = normalizeConfiguredGrant(grant, grantsPath);
      if (!normalized) invalidEntry = true;
      return normalized;
    })
    .filter((grant) => {
      if (!grant) return false;
      if (seenGrantIds.has(grant.id)) {
        duplicateGrantId = true;
        return false;
      }
      seenGrantIds.add(grant.id);
      return true;
    });
  const warnings = [
    ...(invalidEntry ? ["workspace_rbac_grants_invalid_entries"] : []),
    ...(duplicateGrantId ? ["workspace_rbac_grants_duplicate_ids"] : []),
  ];
  return {
    grants,
    policyVersion: firstString(payload.version) || policyVersion,
    source: grantsPath,
    ownerRef: firstString(payload.ownerRef, payload.owner, ownerRef) || "unknown",
    status: warnings.length ? "invalid" : "configured",
    warnings,
  };
}

const GOVERNANCE_SCOPE_TYPES = new Set(["workspace", "unit", "object"]);
const GOVERNANCE_ACTIONS = new Set(["read", "write", "execute", "deploy", "manage", "approve", "admin"]);
const GOVERNANCE_DECISIONS = new Set(["allow", "deny", "require_approval", "require_additional_evidence"]);
const GOVERNANCE_INHERITANCE = new Set(["required", "default", "optional", "forbidden"]);

function normalizeConfiguredGrant(grant, source) {
  if (!isRecord(grant)) return null;
  const required = ["id", "subjectRef", "roleRef", "scopeType", "scopeRef", "resourceRef", "action", "effect", "inheritance"];
  if (required.some((field) => !firstString(grant[field]))) return null;
  if (!GOVERNANCE_SCOPE_TYPES.has(grant.scopeType) || !GOVERNANCE_ACTIONS.has(grant.action) || !GOVERNANCE_DECISIONS.has(grant.effect) || !GOVERNANCE_INHERITANCE.has(grant.inheritance)) return null;
  if (grant.priority !== undefined && (!Number.isInteger(grant.priority) || grant.priority < 0)) return null;
  for (const field of ["validFrom", "validTo"]) {
    if (grant[field] !== undefined && grant[field] !== null && !dateFromValue(grant[field])) return null;
  }
  const validFrom = dateFromValue(grant.validFrom);
  const validTo = dateFromValue(grant.validTo);
  if (validFrom && validTo && validFrom >= validTo) return null;
  return {
    ...grant,
    source: firstString(grant.source) || `workspace-rbac:${source}`,
    priority: Number.isInteger(grant.priority) && grant.priority >= 0 ? grant.priority : 0,
    overrides: Array.isArray(grant.overrides) ? grant.overrides.filter((value) => typeof value === "string") : [],
    evidenceRefs: Array.isArray(grant.evidenceRefs) ? grant.evidenceRefs.filter((value) => typeof value === "string") : [],
  };
}

function grantMatchesScope(grant, scopeRef, resourceRef) {
  if (grant.inheritance === "forbidden") return grant.scopeRef === scopeRef || grant.scopeRef === resourceRef;
  return grant.scopeRef === "workspace" || grant.scopeRef === scopeRef || grant.scopeRef === resourceRef;
}

function grantIsActive(grant, now) {
  const validFrom = dateFromValue(grant.validFrom);
  const validTo = dateFromValue(grant.validTo);
  return (!validFrom || validFrom <= now) && (!validTo || validTo > now);
}

function dateFromValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDate(value) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  return validIsoDate(value);
}

function calculateAuditHash(record, previousEventHash = null) {
  const payload = { ...record };
  delete payload.eventHash;
  delete payload.previousEventHash;
  return createHash("sha256")
    .update(JSON.stringify({ previousEventHash, record: payload }))
    .digest("hex");
}

function appendAuditRecord(cacheDir, record) {
  mkdirSync(cacheDir, { recursive: true, mode: 0o700 });
  const path = join(cacheDir, "audit.jsonl");
  const previousEventHash = lastAuditEventHash(path);
  const payload = {
    ...record,
    eventId: firstString(record.eventId, record.id, record.auditId) || randomUUID(),
    recordedAt: firstString(record.recordedAt) || new Date().toISOString(),
    previousEventHash,
  };
  payload.eventHash = calculateAuditHash(payload, previousEventHash);
  const isNew = !existsSync(path);
  appendFileSync(path, `${JSON.stringify(payload)}\n`, isNew ? { mode: 0o600 } : undefined);
  if (isNew) {
    try { chmodSync(path, 0o600); } catch { /* tolerate fs without chmod */ }
  }
  return payload;
}

function lastAuditEventHash(path) {
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, "utf8").split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].trim()) continue;
    try {
      const record = JSON.parse(lines[index]);
      // A legacy/unparseable tail intentionally starts a new verifiable
      // segment; linking across an unverified record would be misleading.
      return firstString(record.eventHash) || null;
    } catch {
      return null;
    }
  }
  return null;
}

function buildGovernanceRules({ graph, graphPath, registry, registryPath, evidence, warnings, conflicts, now }) {
  const rules = [];
  const relationships = [];
  const seenRules = new Map();
  const graphRules = Array.isArray(graph?.rules) ? graph.rules : [];
  for (const [index, value] of graphRules.entries()) {
    const normalized = normalizeGovernanceRule(value, index);
    if (!normalized) continue;
    const { id, statement, ownerRef, priority, inheritance, expiresAt, inheritedFrom, overrides } = normalized;
    const evidenceRef = addGovernanceEvidence(evidence, {
      id: `evidence:workspace:rule:graph:${index + 1}`,
      source: "workspace.graph.rules",
      evidenceType: "declaration",
      observedAt: now.toISOString(),
      confidence: "medium",
      status: "declared",
      subjectRef: "workspace",
      artifactRef: graphPath || null,
      expiresAt,
      now,
    });
    const rule = {
      id,
      subjectRef: "workspace",
      statement,
      scope: "workspace",
      ownerRef,
      ...(priority === undefined ? {} : { priority }),
      status: "declared",
      inheritance,
      expiresAt,
      freshness: evidence.find((item) => item.id === evidenceRef)?.freshness || "not_configured",
      inheritedFrom,
      overrides,
      source: "workspace.graph.rules",
      evidenceRef,
    };
    registerRuleConflict(seenRules, rule, conflicts, warnings);
    rules.push(rule);
    for (const targetRef of inheritedFrom) relationships.push(makeGovernanceRuleRelationship(id, targetRef, "INHERITS_FROM"));
    for (const targetRef of overrides) relationships.push(makeGovernanceRuleRelationship(id, targetRef, "OVERRIDES"));
    if (rule.freshness === "stale") warnings.push(`rule_stale:${id}`);
    if (ownerRef === "unknown") warnings.push(`rule_owner_unresolved:${id}`);
  }

  const policyRef = isRecord(registry?.settings)
    ? firstString(registry.settings.projectAdmission?.policy, registry.settings.policy)
    : "";
  if (policyRef) {
    const policyPath = declaredAbsolutePath(policyRef, dirname(registryPath));
    const status = !policyPath || isForeignAbsolutePath(policyPath)
      ? "unknown"
      : existsSync(policyPath) ? "present" : "missing";
    const evidenceRef = addGovernanceEvidence(evidence, {
      id: "evidence:workspace:rule:registry-policy",
      source: "workspace.registry.policy",
      evidenceType: "structural",
      observedAt: now.toISOString(),
      confidence: status === "present" ? "high" : "low",
      status,
      subjectRef: "workspace",
      artifactRef: policyPath || null,
      now,
    });
    rules.push({
      id: "rule:workspace:registry-policy",
      subjectRef: "workspace",
      statement: `admission policy: ${policyRef}`,
      scope: "workspace",
      ownerRef: "unknown",
      status,
      expiresAt: null,
      freshness: "not_configured",
      inheritedFrom: [],
      overrides: [],
      inheritance: "default",
      source: "workspace.registry.policy",
      evidenceRef,
    });
    if (status === "missing") warnings.push(`rule_missing:workspace:${policyRef}`);
  }
  return { rules, relationships };
}

function normalizeGovernanceRule(value, index) {
  const object = isRecord(value) ? value : {};
  const statement = typeof value === "string" ? value.trim() : firstString(object.statement, object.description);
  if (!statement) return null;
  const priority = Number.isInteger(object.priority) && object.priority >= 0 ? object.priority : typeof value === "string" ? index + 1 : undefined;
  return {
    id: firstString(object.id) || `rule:workspace:graph:${index + 1}`,
    statement,
    ownerRef: firstString(object.ownerRef, object.owner) || "unknown",
    priority,
    inheritance: ["required", "default", "optional", "forbidden"].includes(object.inheritance) ? object.inheritance : "default",
    expiresAt: validIsoDate(object.expiresAt) || null,
    inheritedFrom: governanceStrings(object.inheritedFrom || object.inheritsFrom),
    overrides: governanceStrings(object.overrides),
  };
}

function registerRuleConflict(seenRules, rule, conflicts, warnings) {
  const previous = seenRules.get(rule.id);
  if (previous) {
    for (const field of ["statement", "ownerRef", "priority", "inheritance", "expiresAt", "inheritedFrom", "overrides"]) {
      if (JSON.stringify(previous[field]) === JSON.stringify(rule[field])) continue;
      conflicts.push({
        subjectRef: rule.id,
        field: `rule.${field}`,
        values: [
          { source: previous.source, value: previous[field] },
          { source: rule.source, value: rule[field] },
        ],
      });
      warnings.push(`rule_conflict:${rule.id}:${field}`);
    }
  } else {
    seenRules.set(rule.id, rule);
  }
}

function makeGovernanceRuleRelationship(sourceRef, targetRef, relationshipType) {
  return {
    sourceRef,
    targetRef,
    relationshipType,
    scope: "workspace",
    provenance: "workspace.graph.rules",
    confidence: "medium",
  };
}

function buildProjectDocuments({ id, ownerRef, graphProject, registryEntry, projectRoot, evidence, documents, warnings, conflicts, now }) {
  const graphRequirements = graphProject.document_requirements || graphProject.documentRequirements;
  const registryRequirements = registryEntry?.document_requirements || registryEntry?.documentRequirements;
  if (Array.isArray(graphRequirements) && Array.isArray(registryRequirements)
    && JSON.stringify(graphRequirements) !== JSON.stringify(registryRequirements)) {
    conflicts.push({
      subjectRef: id,
      field: "document_requirements",
      values: [
        { source: "workspace.graph.document_requirements", value: graphRequirements },
        { source: "workspace.registry.document_requirements", value: registryRequirements },
      ],
    });
    warnings.push(`document_requirement_conflict:${id}`);
  }
  const declaredRequirements = graphRequirements || registryRequirements;
  const requirements = Array.isArray(declaredRequirements)
    ? declaredRequirements
    : governanceStrings(graphProject.docs_entrypoints || graphProject.docsEntrypoints).map((entrypoint) => ({ entrypoint }));
  const documentRefs = [];
  const evidenceRefs = [];
  for (const [index, rawRequirement] of requirements.entries()) {
    const requirementRecord = isRecord(rawRequirement) ? rawRequirement : { entrypoint: rawRequirement };
    const entrypoint = firstString(requirementRecord.entrypoint, requirementRecord.uri, requirementRecord.documentType);
    if (!entrypoint) continue;
    const requirement = ["required", "default", "optional", "forbidden"].includes(requirementRecord.requirement)
      ? requirementRecord.requirement
      : "required";
    const required = typeof requirementRecord.required === "boolean" ? requirementRecord.required : requirement === "required";
    const requirementSource = firstString(requirementRecord.requirementSource, requirementRecord.source,
      Array.isArray(graphRequirements)
        ? "workspace.graph.document_requirements"
        : Array.isArray(registryRequirements) ? "workspace.registry.document_requirements" : "workspace.graph.docs_entrypoints");
    const freshnessIntervalSeconds = parseGovernanceDurationSeconds(requirementRecord.freshnessIntervalSeconds ?? requirementRecord.freshness_interval);
    const declaredPath = projectRoot && !isForeignAbsolutePath(projectRoot)
      ? declaredAbsolutePath(entrypoint, projectRoot)
      : "";
    const documentPath = declaredPath || null;
    let status = !documentPath || isForeignAbsolutePath(documentPath)
      ? "unknown"
      : existsSync(documentPath) ? "present" : "missing";
    if (status === "present" && freshnessIntervalSeconds) {
      try {
        if (now.getTime() - statSync(documentPath).mtimeMs > freshnessIntervalSeconds * 1000) status = "stale";
      } catch {
        status = "unknown";
      }
    }
    const evidenceRef = addGovernanceEvidence(evidence, {
      id: `evidence:${id}:document:${index + 1}`,
      source: requirementSource,
      evidenceType: "structural",
      observedAt: now.toISOString(),
      confidence: status === "present" ? "high" : "low",
      status,
      subjectRef: id,
      artifactRef: documentPath,
      now,
    });
    const documentId = `document:${id}:${index + 1}`;
    documents.push({
      id: documentId,
      subjectRef: id,
      ownerRef,
      entrypoint,
      path: documentPath,
      required,
      requirement,
      requirementSource,
      ...(freshnessIntervalSeconds ? { freshnessIntervalSeconds } : {}),
      status,
      source: requirementSource,
      evidenceRef,
    });
    if (status === "missing") warnings.push(`document_missing:${id}:${entrypoint}`);
    documentRefs.push(documentId);
    evidenceRefs.push(evidenceRef);
  }
  return { documentRefs, evidenceRefs };
}

function parseGovernanceDurationSeconds(value) {
  if (Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/iu);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase()];
  const seconds = amount * multiplier;
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function buildGovernanceHealth({ id, ownerRef, conflicts, evidence, evidenceRefs }) {
  const unitEvidence = evidence.filter((item) => evidenceRefs.includes(item.id));
  const structural = unitEvidence.find((item) => item.evidenceType === "structural");
  const missingDocument = unitEvidence.find((item) => item.source === "workspace.graph.docs_entrypoints" && item.status === "missing");
  const operationalEvidence = unitEvidence.filter((item) => ["process", "endpoint", "behavioral", "deployment", "production"].includes(item.evidenceType));
  const failedOperational = operationalEvidence.find((item) => ["failed", "error", "unhealthy", "critical"].includes(String(item.status).toLowerCase()));

  if (failedOperational) {
    return {
      status: "critical",
      reason: "operational_evidence_failed",
      evidenceRefs,
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "investigate_failed_observation",
    };
  }
  if (conflicts.length) {
    return {
      status: "warning",
      reason: "identity_conflict",
      evidenceRefs: evidenceRefs.filter((ref) => ref.endsWith(":graph") || ref.endsWith(":registry")),
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "reconcile_registry_graph",
    };
  }
  if (structural?.status === "missing") {
    return {
      status: "warning",
      reason: "structural_missing",
      evidenceRefs: structural ? [structural.id] : evidenceRefs,
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "restore_declared_artifact",
    };
  }
  if (missingDocument) {
    return {
      status: "warning",
      reason: "documentation_missing",
      evidenceRefs: unitEvidence.filter((item) => item.source === "workspace.graph.docs_entrypoints" && item.status === "missing").map((item) => item.id),
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "restore_required_document",
    };
  }
  if (unitEvidence.some((item) => item.freshness === "stale")) {
    return {
      status: "warning",
      reason: "evidence_stale",
      evidenceRefs: unitEvidence.filter((item) => item.freshness === "stale").map((item) => item.id),
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "refresh_verification_evidence",
    };
  }
  if (ownerRef === "unknown") {
    return {
      status: "unknown",
      reason: "owner_unresolved",
      evidenceRefs,
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "resolve_owner_mapping",
    };
  }
  if (!operationalEvidence.length) {
    return {
      status: "unknown",
      reason: "runtime_evidence_missing",
      evidenceRefs,
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "collect_runtime_evidence",
    };
  }
  if (unitEvidence.some((item) => item.freshness === "unknown" || item.freshness === "not_configured")) {
    return {
      status: "unknown",
      reason: "evidence_unknown",
      evidenceRefs,
      affectedObjectRefs: [id],
      ownerRef,
      recommendedAction: "collect_current_evidence",
    };
  }
  return {
    status: "healthy",
    reason: "verified",
    evidenceRefs,
    affectedObjectRefs: [id],
    ownerRef,
    recommendedAction: "keep_observing",
  };
}

function deriveGovernanceRelationships(units) {
  const unitIds = new Set(units.map((unit) => unit.id));
  const providersByCapability = new Map();
  for (const unit of units) {
    for (const relationship of unit.relationships) {
      if (relationship.relationshipType !== "PROVIDES_CAPABILITY") continue;
      const providers = providersByCapability.get(relationship.targetRef) || [];
      providers.push(unit.id);
      providersByCapability.set(relationship.targetRef, providers);
    }
  }

  for (const unit of units) {
    const existing = new Set(unit.relationships.map((relationship) => `${relationship.relationshipType}:${relationship.targetRef}`));
    for (const relationship of [...unit.relationships]) {
      if (relationship.relationshipType !== "CONSUMES_CAPABILITY") continue;
      const capabilityProviders = providersByCapability.get(relationship.targetRef) || [];
      const providerRefs = capabilityProviders.length
        ? capabilityProviders
        : unitIds.has(relationship.targetRef) ? [relationship.targetRef] : [];
      for (const providerRef of providerRefs) {
        if (providerRef === unit.id) continue;
        const key = `DEPENDS_ON:${providerRef}`;
        if (existing.has(key)) continue;
        unit.relationships.push({
          sourceRef: unit.id,
          targetRef: providerRef,
          relationshipType: "DEPENDS_ON",
          provenance: capabilityProviders.length ? "derived:governance.capability" : "derived:governance.consumer-reference",
          confidence: "medium",
        });
        existing.add(key);
      }
    }
  }

  return units.flatMap((unit) => unit.relationships);
}

function buildGovernanceImpact(units, relationships) {
  const unitIds = new Set(units.map((unit) => unit.id));
  const upstream = new Map(units.map((unit) => [unit.id, new Set()]));
  const downstream = new Map(units.map((unit) => [unit.id, new Set()]));

  for (const relationship of relationships) {
    if (relationship.relationshipType !== "DEPENDS_ON" || !unitIds.has(relationship.targetRef)) continue;
    upstream.get(relationship.sourceRef)?.add(relationship.targetRef);
    downstream.get(relationship.targetRef)?.add(relationship.sourceRef);
  }

  return units.map((unit) => ({
    subjectRef: unit.id,
    directUpstreamRefs: sortedRefs(upstream.get(unit.id)),
    directDownstreamRefs: sortedRefs(downstream.get(unit.id)),
    transitiveUpstreamRefs: sortedRefs(collectReachable(unit.id, upstream)),
    transitiveDownstreamRefs: sortedRefs(collectReachable(unit.id, downstream)),
  }));
}

function applyDependencyHealthRollup(units, relationships) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  for (const relationship of relationships) {
    if (relationship.relationshipType !== "DEPENDS_ON") continue;
    const source = unitsById.get(relationship.sourceRef);
    const target = unitsById.get(relationship.targetRef);
    if (!source || !target || source.health.status === "critical") continue;
    if (target.health.status === "critical") {
      source.health = {
        status: "critical",
        reason: "dependency_failed",
        evidenceRefs: [...new Set([...source.health.evidenceRefs, ...target.health.evidenceRefs])],
        affectedObjectRefs: [...new Set([source.id, target.id])],
        ownerRef: source.ownerRef,
        recommendedAction: "investigate_failed_dependency",
      };
    } else if (target.health.status === "warning" && source.health.status === "healthy") {
      source.health = {
        status: "warning",
        reason: "dependency_degraded",
        evidenceRefs: [...new Set([...source.health.evidenceRefs, ...target.health.evidenceRefs])],
        affectedObjectRefs: [...new Set([source.id, target.id])],
        ownerRef: source.ownerRef,
        recommendedAction: "investigate_dependency_health",
      };
    } else if (target.health.status === "unknown" && source.health.status === "healthy") {
      source.health = {
        status: "unknown",
        reason: "dependency_unknown",
        evidenceRefs: [...new Set([...source.health.evidenceRefs, ...target.health.evidenceRefs])],
        affectedObjectRefs: [...new Set([source.id, target.id])],
        ownerRef: source.ownerRef,
        recommendedAction: "collect_dependency_evidence",
      };
    }
  }
}

function collectReachable(startRef, graph) {
  const visited = new Set();
  const queue = [...(graph.get(startRef) || [])];
  while (queue.length) {
    const current = queue.shift();
    if (!current || current === startRef || visited.has(current)) continue;
    visited.add(current);
    for (const next of graph.get(current) || []) queue.push(next);
  }
  return visited;
}

function sortedRefs(refs) {
  return [...(refs || [])].sort();
}

function readGovernanceRegistryEntries(registry) {
  if (!isRecord(registry)) return [];
  return GOVERNANCE_REGISTRY_COLLECTIONS.flatMap((collection) => {
    const value = registry[collection];
    const entries = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];
    return entries
      .filter((entry) => isRecord(entry) && typeof entry.id === "string" && entry.id.trim())
      .map((entry) => ({ ...entry, collection }));
  });
}

function buildGovernanceRelationships({ id, graphProject, registryEntry, graphPath, registryPath, knownObjectRefs = new Set(), warnings = [] }) {
  const relationships = [];
  const add = (values, relationshipType, provenance) => {
    for (const targetRef of governanceStrings(values)) {
      relationships.push({
        sourceRef: id,
        targetRef,
        relationshipType,
        scope: "workspace",
        provenance,
        confidence: "medium",
      });
    }
  };
  const addExplicit = (values, provenance) => {
    if (!Array.isArray(values)) return;
    for (const value of values) {
      if (!isRecord(value)) continue;
      const targetRef = firstString(value.targetRef, value.target, value.targetId);
      const relationshipType = firstString(value.relationshipType, value.type);
      if (!targetRef || !GOVERNANCE_RELATIONSHIP_TYPES.has(relationshipType)) continue;
      const sourceRef = firstString(value.sourceRef, id);
      if (sourceRef !== id) {
        warnings.push(`relationship_source_mismatch:${id}:${sourceRef}`);
        continue;
      }
      if (sourceRef === targetRef) {
        warnings.push(`relationship_self_reference:${id}:${relationshipType}`);
        continue;
      }
      if (relationshipType === "DEPENDS_ON" && !knownObjectRefs.has(targetRef)) {
        warnings.push(`relationship_target_unknown:${id}:${targetRef}`);
        continue;
      }
      const relationship = {
        sourceRef,
        targetRef,
        relationshipType,
        scope: firstString(value.scope, "workspace"),
        provenance: firstString(value.provenance, provenance),
        confidence: normalizeGovernanceConfidence(value.confidence),
      };
      for (const field of ["requiredness", "dependencyPhase", "environment", "versionConstraint"]) {
        const fieldValue = firstString(value[field]);
        if (fieldValue) relationship[field] = fieldValue;
      }
      for (const field of ["validFrom", "validTo"]) {
        const dateValue = validIsoDate(value[field]);
        if (dateValue) relationship[field] = dateValue;
      }
      relationships.push(relationship);
    }
  };
  addExplicit(graphProject.relationships, graphPath);
  addExplicit(registryEntry?.relationships, registryPath);
  add(graphProject.provides, "PROVIDES_CAPABILITY", graphPath);
  add(graphProject.consumes, "CONSUMES_CAPABILITY", graphPath);
  add(graphProject.contracts, "IMPLEMENTS_CONTRACT", graphPath);
  add(registryEntry?.provides, "PROVIDES_CAPABILITY", registryPath);
  add(registryEntry?.consumes, "CONSUMES_CAPABILITY", registryPath);
  add(registryEntry?.contracts, "IMPLEMENTS_CONTRACT", registryPath);
  return relationships;
}

function addGovernanceEvidence(target, input) {
  const now = input.now instanceof Date && !Number.isNaN(input.now.getTime()) ? input.now : new Date();
  const observedAt = validIsoDate(input.observedAt) || now.toISOString();
  const expiresAt = input.expiresAt ? validIsoDate(input.expiresAt) : null;
  const freshness = expiresAt
    ? new Date(expiresAt).getTime() <= now.getTime() ? "stale" : "fresh"
    : "not_configured";
  const evidence = {
    id: input.id,
    observationKey: firstString(input.observationKey, input.id),
    source: input.source,
    evidenceType: input.evidenceType,
    observedAt,
    observer: GOVERNANCE_OBSERVER,
    confidence: normalizeGovernanceConfidence(input.confidence),
    expiresAt,
    freshness,
    status: input.status || "observed",
    subjectRef: input.subjectRef,
    artifactRef: input.artifactRef || null,
  };
  target.push(evidence);
  return evidence.id;
}

function refreshPersistedEvidence(record, now) {
  const observedAt = validIsoDate(record.observedAt) || now.toISOString();
  const expiresAt = record.expiresAt ? validIsoDate(record.expiresAt) : null;
  return {
    ...record,
    source: firstString(record.source, "control-plane.persisted"),
    evidenceType: firstString(record.evidenceType, "unknown"),
    observedAt,
    observer: firstString(record.observer, GOVERNANCE_OBSERVER),
    confidence: normalizeGovernanceConfidence(record.confidence || "low"),
    observationKey: firstString(record.observationKey, record.id),
    expiresAt,
    freshness: expiresAt ? new Date(expiresAt).getTime() <= now.getTime() ? "stale" : "fresh" : record.freshness || "unknown",
    status: firstString(record.status, "unknown"),
    subjectRef: firstString(record.subjectRef, "unknown"),
    artifactRef: record.artifactRef || null,
  };
}

function buildGovernanceAutomations({ graph, resources, graphPath, evidence, now, automationRecords = [] }) {
  const declarations = Array.isArray(graph?.automations) ? graph.automations : [];
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
  const persistedById = new Map(automationRecords.filter(isRecord).map((record) => [record.id, record]));
  return declarations
    .filter(isRecord)
    .map((declaration, index) => {
      const id = firstString(declaration.id) || `automation:unregistered:${index + 1}`;
      const targetRef = firstString(declaration.targetRef, declaration.projectId);
      const ownerRef = firstString(declaration.ownerRef);
      const commandId = firstString(declaration.commandId);
      const resource = resourceById.get(targetRef);
      const command = resource?.commands.find((item) => item.id === commandId);
      const commandIsSafe = command && ["run_health", "run_verify"].includes(command.intent) && command.autoExecutable && command.ownerRef === ownerRef;
      const trigger = declaration.trigger === "interval" ? "interval" : "manual";
      const intervalSeconds = Number.isInteger(declaration.intervalSeconds) && declaration.intervalSeconds > 0 ? declaration.intervalSeconds : null;
      const declarationEvidenceRef = addGovernanceEvidence(evidence, {
        id: `evidence:${id}:declaration`,
        source: graphPath,
        evidenceType: "declaration",
        observedAt: now.toISOString(),
        confidence: "high",
        status: "declared",
        subjectRef: id,
        artifactRef: graphPath,
        now,
      });
      const enabled = declaration.enabled !== false;
      const status = !targetRef || !ownerRef || !commandId ? "unregistered" : !enabled ? "paused" : !commandIsSafe || (trigger === "interval" && !intervalSeconds) ? "blocked" : "enabled";
      const persisted = persistedById.get(id);
      return {
        id,
        targetRef: targetRef || "unknown",
        ownerRef: ownerRef || "unknown",
        source: firstString(declaration.source, graphPath),
        commandId: commandId || "unregistered",
        policyAction: "execute",
        trigger,
        ...(intervalSeconds ? { intervalSeconds } : {}),
        status,
        enabled,
        evidenceRefs: [declarationEvidenceRef],
        ...(validIsoDate(persisted?.lastRunAt || declaration.lastRunAt) ? { lastRunAt: validIsoDate(persisted?.lastRunAt || declaration.lastRunAt) } : {}),
      };
    });
}

function aggregateGovernanceFreshness(evidence, refs) {
  const values = refs.map((ref) => evidence.find((item) => item.id === ref)?.freshness).filter(Boolean);
  if (values.includes("stale")) return "stale";
  if (values.includes("unknown")) return "unknown";
  if (values.includes("fresh")) return "fresh";
  return "not_configured";
}

function normalizeGovernanceConfidence(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function governanceStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()))];
}

function declaredAbsolutePath(value, basePath) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  return isForeignAbsolutePath(trimmed) ? trimmed : resolve(basePath, trimmed);
}

function isForeignAbsolutePath(value) {
  return /^[A-Za-z]:[\\/]/.test(String(value || "")) || String(value || "").startsWith("\\\\");
}

function validIsoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveRegisteredProjectPath({ id, workspaceRoot, graph, registry, registryPath }) {
  const registryEntry = readGovernanceRegistryEntries(registry).find((entry) => entry.id === id);
  const registryPathValue = declaredAbsolutePath(registryEntry?.path, dirname(registryPath));
  if (registryPathValue) return registryPathValue;
  return declaredAbsolutePath(graph?.projects?.[id]?.path, workspaceRoot);
}

function resolveOptionalPath({ workspaceRoot, envNames = [], declaredPath = "", canonicalRelative = [], legacyRelative = [] }) {
  const configured = firstString(...envNames.map((name) => process.env[name]));
  if (configured) return isForeignAbsolutePath(configured) ? configured : resolve(workspaceRoot, configured);
  if (declaredPath) return declaredPath;
  const candidates = [];
  if (canonicalRelative.length) candidates.push(join(workspaceRoot, ...canonicalRelative));
  if (legacyRelative.length) candidates.push(join(workspaceRoot, ...legacyRelative));
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function pathBackedStatus(path) {
  return path ? isForeignAbsolutePath(path) ? "unknown" : (existsSync(path) ? "available" : "missing") : "unknown";
}

function buildResource({ id, project, graph, workspaceRoot }) {
  const path = declaredAbsolutePath(project.path, workspaceRoot);
  const commands = [];
  for (const [index, command] of (project.health || []).entries()) {
    commands.push(makeCommand({ ownerId: id, intent: "run_health", label: `Run ${id} health`, command, cwd: path || workspaceRoot, index }));
  }
  for (const [index, command] of (project.verify || []).entries()) {
    commands.push(makeCommand({ ownerId: id, intent: "run_verify", label: `Run ${id} verify`, command, cwd: path || workspaceRoot, index }));
  }
  for (const [index, command] of (project.remediation || []).entries()) {
    commands.push(makeCommand({ ownerId: id, intent: "run_remediation", label: `Run ${id} remediation`, command, cwd: path || workspaceRoot, index }));
  }

  return {
    id,
    name: firstString(project.name, titleFromId(id)),
    layer: classifyLayer(id, project),
    kind: project.kind || "resource",
    path,
    status: path ? (existsSync(path) ? "available" : "missing") : "unknown",
    provides: project.provides || [],
    consumes: project.consumes || [],
    contracts: project.contracts || [],
    commands,
    metadata: {
      git: readGitStatus(path),
      consumers: findConsumers(graph, id),
    },
  };
}

function buildAxiResourceSnapshot({ generatedAt, graph, resources, agentTasks = new Map() }) {
  const graphIds = new Set(Object.keys(graph?.projects || {}));
  const project = resources.filter(isProjectResource).map((resource) =>
    createAxiResourceView({ resource, category: "project", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const service = resources.filter(isServiceResource).map((resource) =>
    createAxiResourceView({ resource, category: "service", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const server = resources.filter(isServerResource).map((resource) =>
    createAxiResourceView({ resource, category: "server", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const credentialRef = resources.filter(isCredentialRefResource).map((resource) =>
    createAxiResourceView({ resource, category: "credential_ref", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const provider = resources.filter(isProviderResource).map((resource) =>
    createAxiResourceView({ resource, category: "provider", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const docSource = resources.filter(isDocSourceResource).map((resource) =>
    createAxiResourceView({ resource, category: "doc_source", source: graphIds.has(resource.id) ? "workspace.graph" : "workspace.optional" })
  );
  const agentArtifact = Array.from(agentTasks.values()).map((task) =>
    createAxiAgentArtifactView(task)
  );

  return {
    generatedAt,
    project,
    service,
    server,
    credential_ref: credentialRef,
    provider,
    doc_source: docSource,
    agent_artifact: agentArtifact,
  };
}

function createAxiResourceView({ resource, category, source }) {
  return {
    id: `${category}:${resource.id}`,
    category,
    name: resource.name,
    label: resource.name,
    ownerId: resource.id,
    resourceId: resource.id,
    layer: resource.layer,
    kind: resource.kind,
    path: resource.path || undefined,
    status: resource.status,
    source,
    ref: resource.path || resource.id,
    summary: resource.metadata?.focus || resource.metadata?.role || resource.kind,
    provides: resource.provides || [],
    consumes: resource.consumes || [],
    contracts: resource.contracts || [],
    commands: resource.commands || [],
    metadata: resource.metadata,
  };
}

function createAxiAgentArtifactView(task) {
  return {
    id: `agent_artifact:${task.id}`,
    category: "agent_artifact",
    name: task.summary || task.prompt,
    label: task.summary || task.prompt,
    ownerId: task.targetId || task.routeKey || task.id,
    resourceId: task.targetId,
    kind: task.runtime,
    path: task.cwd,
    status: task.status,
    source: "control-plane.agent-task",
    ref: task.approvalId,
    summary: task.summary || task.prompt,
    provides: [],
    consumes: [],
    contracts: [],
    commands: [],
    metadata: {
      routeKey: task.routeKey,
      requestedRuntime: task.requestedRuntime,
      approvalId: task.approvalId,
      stdout: task.stdout,
      stderr: task.stderr,
    },
  };
}

function isProjectResource(resource) {
  return resource.layer === "software";
}

function isServiceResource(resource) {
  return resource.layer === "base_service" || resource.layer === "communication";
}

function isServerResource(resource) {
  return resource.layer === "physical_service";
}

function isCredentialRefResource(resource) {
  return resourceMatches(resource, [
    "credential",
    "credential ref",
    "credential-ref",
    "secret ref",
    "secret-ref",
    "verification inbox",
    "oauth",
    "otp",
  ]) || ["axi-accounts", "cockpit-tools", "imap", "axi-coder"].includes(resource.id);
}

function isProviderResource(resource) {
  return resourceMatches(resource, [
    "provider",
    "provider profile",
    "model gateway",
    "model routing",
    "model-routing",
    "cli route",
    "ollama",
    "sub2api",
  ]) || ["axi-model-gateway", "axi-coder", "ai-capability", "ollama-local", "minimax-tokenplan", "sub2api"].includes(resource.id);
}

function isDocSourceResource(resource) {
  return resourceMatches(resource, [
    "docs",
    "documentation",
    "knowledge",
    "manifest",
    "sop",
    "prd",
    "tdd",
  ]) || ["axi-docs", "app-search-system"].includes(resource.id);
}

function resourceMatches(resource, terms) {
  const haystack = [
    resource.id,
    resource.name,
    resource.kind,
    resource.path || "",
    ...(resource.provides || []),
    ...(resource.consumes || []),
    ...(resource.contracts || []),
    resource.metadata?.role || "",
    resource.metadata?.focus || "",
  ].join(" ").toLowerCase();
  return terms.some((term) => haystack.includes(term.toLowerCase()));
}

function classifyLayer(id, project) {
  if (BASE_SERVICE_IDS.has(id)) return "base_service";
  if (EXTERNAL_CAPABILITY_IDS.has(id)) return "external_capability";
  if (COMMUNICATION_IDS.has(id)) return "communication";
  if (IM_IDS.has(id)) return "im";
  if (PHYSICAL_SERVICE_IDS.has(id)) return "physical_service";
  if ((project.kind || "").includes("capability")) return "base_service";
  if ((project.kind || "").includes("provider")) return "base_service";
  return "software";
}

function makeCommand({ ownerId, intent, label, command, cwd, index }) {
  return {
    id: `${ownerId}:${intent}:${index}`,
    ownerRef: ownerId,
    source: "workspace.graph",
    executorRef: "control-plane.registered-command",
    intent,
    label,
    command,
    cwd,
    autoExecutable: intent !== "run_remediation" && isSafeRegisteredCommand(command),
  };
}

export function normalizeIMEnvelope(input = {}, { strict = false } = {}) {
  const raw = input.raw && typeof input.raw === "object" ? input.raw : input;
  const missing = ["channel", "conversationId", "senderId", "text"].filter((key) => !firstString(input[key], raw[key]));
  if (strict && missing.length) {
    return {
      error: `通信层消息不是标准 IMEnvelope，缺少字段：${missing.join(", ")}`,
      missing,
    };
  }

  return {
    id: firstString(input.id, raw.id) || randomUUID(),
    channel: firstString(input.channel, raw.channel) || "unknown",
    conversationId: firstString(input.conversationId, raw.conversationId) || "default",
    senderId: firstString(input.senderId, raw.senderId) || "unknown",
    text: normalizeText(firstString(input.text, raw.text)),
    receivedAt: input.receivedAt || new Date().toISOString(),
    raw,
  };
}

function normalizeText(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return String(parsed.text || parsed.content || parsed.prompt || trimmed).trim();
  } catch {
    return trimmed;
  }
}

async function handleQuery({ input, workspaceRoot, graphPath, cacheDir, runs, envelopeRuns, agentTasks = new Map(), approvals = new Map(), agentTaskExecutor = executeAgentTask, codexBin = "codex", appServerBin = "/Applications/Codex.app/Contents/Resources/codex", policyEvaluator = null }) {
  const envelope = normalizeIMEnvelope(input?.envelope || input || {});
  if (envelopeRuns.has(envelope.id)) {
    return runs.get(envelopeRuns.get(envelope.id));
  }

  const snapshot = buildSnapshot({ workspaceRoot, graphPath });
  const parsed = parseIntent(envelope.text, snapshot);
  const run = {
    id: randomUUID(),
    envelope,
    intent: parsed.intent,
    targetId: parsed.targetId,
    accepted: parsed.intent !== "blocked_action",
    blockedReason: parsed.blockedReason,
    summary: "",
    actions: [],
    createdAt: new Date().toISOString(),
  };
  runs.set(run.id, run);
  envelopeRuns.set(envelope.id, run.id);

  if (parsed.intent === "blocked_action") {
    run.summary = `已拒绝执行：${parsed.blockedReason}`;
    run.actions.push({ status: "blocked", summary: run.summary });
  } else if (parsed.intent === "start_agent_task") {
    const policy = await evaluateExecutionPolicy(policyEvaluator, { resourceRef: parsed.targetId || "workspace", action: "execute", correlationId: envelope.id });
    if (!policy.ok) {
      run.accepted = false;
      run.blockedReason = policy.reason;
      run.summary = `已拒绝执行：${policy.reason}`;
      run.actions.push({ status: "blocked", summary: run.summary });
      run.metadata = { policyDecisionRef: policy.decisionRef };
    } else {
      const task = createAgentTask({ parsed, envelope, input, workspaceRoot, cacheDir, agentTasks, approvals, agentTaskExecutor, codexBin, appServerBin, policyDecisionRef: policy.decisionRef });
      run.targetId = parsed.targetId;
      run.summary = task.summary || `已创建受管 AgentTask：${task.id}`;
      run.actions.push({ status: task.status === "failed" ? "failed" : "succeeded", summary: run.summary, stdout: JSON.stringify(task), evidenceRefs: task.evidenceRefs || [] });
      run.metadata = {
        agentTaskId: task.id,
        runtime: task.runtime,
        requestedRuntime: task.requestedRuntime,
        ...(policy.decisionRef ? { policyDecisionRef: policy.decisionRef } : {}),
        ...(task.riskRef ? { riskRef: task.riskRef } : {}),
        ...(task.incidentRef ? { incidentRef: task.incidentRef } : {}),
      };
    }
  } else if (parsed.command && input?.dryRun !== true) {
    const policy = await evaluateExecutionPolicy(policyEvaluator, { resourceRef: parsed.targetId || "workspace", action: "execute", correlationId: envelope.id });
    if (!policy.ok) {
      run.accepted = false;
      run.blockedReason = policy.reason;
      run.summary = `已拒绝执行：${policy.reason}`;
      run.actions.push({ status: "blocked", summary: run.summary });
      run.metadata = { policyDecisionRef: policy.decisionRef };
    } else {
      const result = executeManagedCommand(parsed.command);
      const issue = result.status === "failed"
        ? createExecutionIssue({ cacheDir, workspaceRoot, targetRef: parsed.targetId || "workspace", riskType: "command_failure", severity: "critical", likelihood: "likely", reason: result.summary, sourceAssessmentRef: null, policyDecisionRef: policy.decisionRef, correlationId: envelope.id })
        : null;
      const executionEvidence = result.status === "succeeded" ? createExecutionEvidence({ cacheDir, targetRef: parsed.targetId || "workspace", status: "succeeded" }) : null;
      result.evidenceRefs = issue?.risk.evidenceRefs || (executionEvidence ? [executionEvidence.id] : []);
      run.actions.push(result);
      run.summary = summarizeExecution(parsed, result);
      run.metadata = {
        ...(policy.decisionRef ? { policyDecisionRef: policy.decisionRef } : {}),
        ...(issue ? { riskRef: issue.risk.id, incidentRef: issue.incident.id } : {}),
      };
    }
  } else {
    run.summary = summarizeIntent(parsed, snapshot);
    if (parsed.command) {
      run.actions.push({ commandId: parsed.command.id, status: "skipped", summary: "dryRun=true，未执行命令" });
    }
  }

  run.completedAt = new Date().toISOString();
  persistRun(cacheDir, run);
  return run;
}

async function evaluateExecutionPolicy(policyEvaluator, input) {
  if (typeof policyEvaluator !== "function") return { ok: true };
  const response = await policyEvaluator(input);
  const decision = response?.decision || {};
  if (decision.decision === "allow") return { ok: true, decisionRef: decision.id };
  return {
    ok: false,
    decisionRef: decision.id,
    reason: `Workspace policy ${decision.decision || "deny"}: ${decision.reason || "no_matching_grant"}`,
  };
}

function evaluateSurfaceExecutionPolicy({ input, policyInput, workspaceRoot, registryPath, cacheDir }) {
  const envelope = input?.envelope || input || {};
  const actorRef = firstString(input?.subjectRef, envelope?.subjectRef, envelope?.senderId) || "unknown";
  const response = evaluateConfiguredGovernancePolicy({
    input: { ...policyInput, subjectRef: actorRef },
    workspaceRoot,
    registryPath,
    cacheDir,
  });
  appendAuditRecord(cacheDir, {
    eventType: "policy_decision.evaluated",
    actorRef,
    scopeRef: firstString(policyInput?.scopeRef) || "workspace",
    objectRef: firstString(policyInput?.resourceRef) || "unknown",
    action: firstString(policyInput?.action) || "execute",
    correlationId: firstString(policyInput?.correlationId) || response.decision.id,
    policyDecisionRef: response.decision.id,
    evidenceRefs: response.decision.evidenceRefs,
    result: response.decision.decision,
    status: response.decision.decision,
  });
  return response;
}

function requirePolicyDecisionRef(enforceExecutionPolicy, policyDecisionRef, action, cacheDir, { allowApproval = false, resourceRef = "", action: expectedAction = "", subjectRef = "" } = {}) {
  if (!enforceExecutionPolicy) return null;
  const expected = { resourceRef, action: expectedAction };
  const reference = firstString(policyDecisionRef);
  if (!/^policy-decision:[A-Za-z0-9-]+$/.test(reference)) {
    return {
      ok: false,
      accepted: false,
      httpStatus: 403,
      status: 403,
      error: `policy decision required before ${action}`,
    };
  }
  const decision = readJson(join(cacheDir || "", "policy-decisions", `${safeFileName(reference)}.json`), null);
  if (!decision) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision not found before ${action}` };
  }
  if (!subjectRef) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision subject required before ${action}` };
  }
  if (expected.resourceRef && decision.resourceRef !== expected.resourceRef) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision resource does not match ${action}` };
  }
  if (expected.action && decision.action !== expected.action) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision action does not match ${action}` };
  }
  if (subjectRef && decision.subjectRef !== subjectRef) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision subject does not match ${action}` };
  }
  if (decision.decision !== "allow" && !(allowApproval && decision.decision === "require_approval")) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision ${decision.decision || "deny"} cannot authorize ${action}` };
  }
  const expiresAt = dateFromValue(decision.expiresAt);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return { ok: false, accepted: false, httpStatus: 403, status: 403, error: `policy decision expired before ${action}` };
  }
  return null;
}

async function handleCommunicationMessage({ input, options, workspaceRoot, graphPath, cacheDir, runs, envelopeRuns, agentTasks, approvals, agentTaskExecutor, codexBin, appServerBin, memoryProjectReader, policyEvaluator = null }) {
  const direction = firstString(input?.direction, input?.messageDirection) || "inbound";
  if (direction !== "inbound") {
    return {
      ignored: true,
      direction,
      summary: `已忽略非入站通信消息：${direction}`,
    };
  }

  const normalized = normalizeIMEnvelope(input?.envelope || input || {}, { strict: true });
  if (normalized.error) {
    return {
      ignored: true,
      summary: normalized.error,
      missing: normalized.missing,
    };
  }
  const envelope = normalized;
  if (options?.intelligenceOnly && !isMemoryProjectListQuery(envelope.text)) {
    return {
      ignored: true,
      summary: "已忽略非情报站项目查询消息。",
    };
  }
  const run = isMemoryProjectListQuery(envelope.text)
    ? handleMemoryProjectListQuery({ input, envelope, cacheDir, runs, envelopeRuns, memoryProjectReader })
    : await handleQuery({
      input: {
        envelope,
        dryRun: input?.dryRun,
        runtimePreference: envelope.raw?.runtimePreference || input?.runtimePreference,
      },
      workspaceRoot,
      graphPath,
      cacheDir,
      runs,
      envelopeRuns,
      agentTasks,
      approvals,
        agentTaskExecutor,
        codexBin,
        appServerBin,
        policyEvaluator,
      });

  return {
    ignored: false,
    run,
    response: buildCommunicationResponse(run),
  };
}

function handleMemoryProjectListQuery({ input, envelope, cacheDir, runs, envelopeRuns, memoryProjectReader }) {
  if (envelopeRuns.has(envelope.id)) {
    return runs.get(envelopeRuns.get(envelope.id));
  }

  const projects = memoryProjectReader();
  const run = {
    id: randomUUID(),
    envelope,
    intent: "list_resources",
    accepted: true,
    summary: summarizeMemoryProjects(projects),
    actions: [{
      status: "succeeded",
      summary: `已从记忆面读取 ${projects.length} 个项目。`,
      stdout: JSON.stringify(projects),
    }],
    metadata: {
      source: "cc_project_states",
      language: "zh-CN",
      mode: "memory_only",
      userInputMode: "natural_language",
      forbiddenDiscovery: ["ls", "find", "rg", "tree", "filesystem"],
    },
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  runs.set(run.id, run);
  envelopeRuns.set(envelope.id, run.id);
  persistRun(cacheDir, run);
  return run;
}

function parseIntent(text, snapshot) {
  const query = String(text || "").trim();
  const lowered = query.toLowerCase();
  const blockedReason = blockedReasonFor(query);
  if (blockedReason) return { intent: "blocked_action", blockedReason };

  const target = findTargetResource(query, snapshot);
  if (/(remediation|remediate|修复|整改|恢复|补救)/i.test(query)) {
    const command = target?.commands.find((item) => item.intent === "run_remediation");
    return command ? { intent: "run_remediation", targetId: target.id, command } : { intent: "status_query", targetId: target?.id };
  }
  if (/(agent|codex|执行|开始|启动|处理)/i.test(lowered)) {
    return { intent: "start_agent_task", targetId: target?.id };
  }
  if (/(依赖|depends?|consumer|消费|谁用|用到)/i.test(query)) {
    return { intent: "explain_dependency", targetId: target?.id };
  }
  if (/(health|健康|巡检|检查)/i.test(query)) {
    const command = target?.commands.find((item) => item.intent === "run_health");
    return command ? { intent: "run_health", targetId: target.id, command } : { intent: "status_query", targetId: target?.id };
  }
  if (/(verify|验证|测试|test|typecheck|build)/i.test(query)) {
    const command = target?.commands.find((item) => item.intent === "run_verify");
    return command ? { intent: "run_verify", targetId: target.id, command } : { intent: "status_query", targetId: target?.id };
  }
  if (/(列出|有哪些|list|资源|能力)/i.test(query)) {
    return { intent: "list_resources", targetId: target?.id };
  }
  return { intent: "status_query", targetId: target?.id };
}

function findTargetResource(query, snapshot) {
  const lowered = query.toLowerCase();
  const sorted = [...snapshot.resources].sort((left, right) => right.id.length - left.id.length);
  return sorted.find((resource) =>
    lowered.includes(resource.id.toLowerCase()) ||
    lowered.includes(resource.name.toLowerCase()) ||
    resource.provides.some((item) => lowered.includes(item.toLowerCase()))
  );
}

function summarizeIntent(parsed, snapshot) {
  if (parsed.intent === "explain_dependency" && parsed.targetId) {
    const target = snapshot.resources.find((item) => item.id === parsed.targetId);
    if (!target) return "未找到目标资源。";
    const consumers = target.metadata?.consumers || [];
    return `${target.id} 消费 ${target.consumes.length} 个资源：${target.consumes.join(", ") || "无"}；被 ${consumers.length} 个资源消费：${consumers.join(", ") || "无"}。`;
  }
  if (parsed.intent === "list_resources") {
    return summarizeSnapshot(snapshot);
  }
  if (parsed.intent === "start_agent_task") {
    return "已识别为 agent 任务请求；v1 仅允许通过注册通信层创建受管任务，本次没有匹配到可自动执行的白名单命令。";
  }
  return summarizeSnapshot(snapshot);
}

function summarizeSnapshot(snapshot) {
  const counts = snapshot.resources.reduce((acc, resource) => {
    acc[resource.layer] = (acc[resource.layer] || 0) + 1;
    return acc;
  }, {});
  const dirty = snapshot.resources
    .filter((resource) => Number(resource.metadata?.git?.changedEntries || 0) > 0)
    .map((resource) => `${resource.id}(${resource.metadata.git.changedEntries})`);
  const axiResources = snapshot.axiResources ? [
    `Axi 资源视图：项目 ${snapshot.axiResources.project.length}，服务 ${snapshot.axiResources.service.length}，服务器 ${snapshot.axiResources.server.length}，凭据引用 ${snapshot.axiResources.credential_ref.length}，provider ${snapshot.axiResources.provider.length}，文档源 ${snapshot.axiResources.doc_source.length}，Agent artifact ${snapshot.axiResources.agent_artifact.length}。`,
  ] : [];
  return [
    `当前纳管 ${snapshot.resources.length} 个资源：软件层 ${counts.software || 0}，基础服务层 ${counts.base_service || 0}，通信层 ${counts.communication || 0}，IM层 ${counts.im || 0}，物理服务层 ${counts.physical_service || 0}，外接能力层 ${counts.external_capability || 0}。`,
    dirty.length ? `有未提交改动：${dirty.join(", ")}。` : "纳管 git 项目未发现未提交改动。",
    ...axiResources,
  ].join(" ");
}

function summarizeMemoryProjects(projects) {
  if (!projects.length) {
    return [
      "**当前项目**",
      "",
      "记忆面暂时没有可用的项目状态记录。",
      "",
      "数据源：`cc_project_states`",
    ].join("\n");
  }

  const rows = projects.map((project, index) => (
    `${index + 1}. \`${project.project}\`\n   记忆条目：${project.featureCount}｜最近活动：${formatDateTime(project.lastActivity)}`
  ));
  return [
    "**当前项目**",
    "",
    `共从记忆面读取到 **${projects.length}** 个项目。`,
    "",
    ...rows,
    "",
    "说明：本结果只读取记忆面 `cc_project_states`，没有扫描目录或工作区索引。",
  ].join("\n");
}

function summarizeExecution(parsed, result) {
  const target = parsed.targetId ? `${parsed.targetId} ` : "";
  if (result.status === "blocked") return `已拒绝 ${target}${parsed.intent}：${result.summary}`;
  if (result.status === "succeeded") return `${target}${parsed.intent} 执行成功。${result.summary}`;
  return `${target}${parsed.intent} 执行失败。${result.summary}`;
}

function createAgentTask({ parsed, envelope, input, workspaceRoot, cacheDir, agentTasks, agentTaskExecutor, codexBin, appServerBin, policyDecisionRef = null }) {
  const snapshot = buildSnapshot({ workspaceRoot, graphPath: join(workspaceRoot, "workspace.graph.json"), agentTasks, approvals: new Map(), codexBin, appServerBin });
  const target = parsed.targetId ? snapshot.resources.find((item) => item.id === parsed.targetId) : null;
  const requestedRuntime = input?.runtimePreference || envelope.raw?.runtimePreference || (envelope.channel === "mosscoder" ? "codex_app" : "codex_cli");
  const runtime = requestedRuntime === "codex_app" && !isCodexAppAvailable(appServerBin) ? "codex_cli" : requestedRuntime;
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    routeKey: envelope.raw?.routeKey,
    runtime,
    requestedRuntime,
    status: "running",
    prompt: envelope.text,
    targetId: parsed.targetId,
    cwd: target?.path || workspaceRoot,
    ...(policyDecisionRef ? { policyDecisionRef } : {}),
    summary: requestedRuntime !== runtime ? `codex_app 不可用，已降级到 ${runtime}。` : `已使用 ${runtime} 创建受管任务。`,
    createdAt: now,
    startedAt: now,
  };
  agentTasks.set(task.id, task);

  if (input?.dryRun === true) {
    task.status = "queued";
    task.completedAt = new Date().toISOString();
    task.summary = `dryRun=true，已验证 AgentTask 创建参数，未启动 ${runtime}。`;
  } else {
    const result = agentTaskExecutor({ task, codexBin, appServerBin });
    task.status = result.status;
    task.summary = result.summary;
    task.stdout = result.stdout;
    task.stderr = result.stderr;
    task.completedAt = new Date().toISOString();
  }
  const issue = task.status === "failed"
    ? createExecutionIssue({ cacheDir, workspaceRoot, targetRef: task.targetId || task.id, riskType: "agent_task_failure", severity: "critical", likelihood: "likely", reason: task.summary || "受管 AgentTask 执行失败。", sourceAssessmentRef: task.id, policyDecisionRef, correlationId: firstString(envelope.raw?.correlationId) || envelope.id })
    : null;
  if (issue) {
    task.riskRef = issue.risk.id;
    task.incidentRef = issue.incident.id;
    task.evidenceRefs = issue.risk.evidenceRefs;
  } else if (task.status === "succeeded") {
    const evidence = createExecutionEvidence({ cacheDir, targetRef: task.targetId || task.id, status: "succeeded", artifactRef: null, observedAt: task.completedAt });
    task.evidenceRefs = evidence ? [evidence.id] : [];
  }
  persistAgentTask(cacheDir, task);
  appendAuditRecord(cacheDir, {
    auditKind: "agent_task.created",
    taskId: task.id,
    actorRef: envelope.senderId,
    objectRef: task.id,
    action: "create",
    correlationId: firstString(envelope.raw?.correlationId) || envelope.id,
    policyDecisionRef: policyDecisionRef || null,
    status: task.status,
  });
  return task;
}

function createMobileProjectAction({ input = {}, approvedApprovalId = null, policyDecisionRef = null, forceApproval = false, workspaceRoot, graphPath, cacheDir, jobs, jobEnvelopeIndex, agentTasks, approvals, roleAgentExecutor, axiAgentTaskExecutor, codexBin, appServerBin, heartbeatMs, memoryDatabaseUrl }) {
  const rawExecutionFields = ["text", "command", "cwd", "workdir", "workingDirectory", "envelope"]
    .filter((key) => Object.hasOwn(input, key));
  if (rawExecutionFields.length) {
    return { ok: false, httpStatus: 400, error: `mobile project actions do not accept raw execution fields: ${rawExecutionFields.join(", ")}` };
  }
  const resolved = resolveMobileProjectAction({ input, workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin });
  if (!resolved.ok) return resolved;
  const envelope = buildMobileProjectActionEnvelope({ input, action: resolved.action });
  return createControlJob({
    input: { ...input, envelope },
    resolvedMobileAction: { ...resolved, approvedApprovalId, policyDecisionRef, forceApproval },
    workspaceRoot,
    graphPath,
    cacheDir,
    jobs,
    jobEnvelopeIndex,
    agentTasks,
    approvals,
    roleAgentExecutor,
    axiAgentTaskExecutor,
    codexBin,
    appServerBin,
    heartbeatMs,
    memoryDatabaseUrl,
  });
}

function resolveMobileProjectAction({ input = {}, workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin }) {
  const projectId = String(input.projectId || "").trim();
  const actionId = String(input.actionId || "").trim();
  const actionType = String(input.actionType || "").trim();
  const mobileSnapshot = buildMobileWorkspaceSnapshot({ workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin });
  const project = mobileSnapshot.projects.find((item) => item.id === projectId);
  if (!project) return { ok: false, httpStatus: 404, error: "project not found" };
  const action = project.actions.find((item) => item.actionId === actionId);
  if (!action) return { ok: false, httpStatus: 422, error: "unsupported mobile project action" };
  if (action.actionType !== actionType) return { ok: false, httpStatus: 422, error: "actionType does not match registered action" };

  const snapshot = buildSnapshot({ workspaceRoot, graphPath, agentTasks, approvals, codexBin, appServerBin });
  const resource = snapshot.resources.find((item) => item.id === projectId);
  if (!resource || resource.status !== "available") return { ok: false, httpStatus: 422, error: "project is not available for managed action" };
  const command = action.executionMode === "immediate"
    ? resource.commands.find((item) => item.id === action.commandId && isMobileReadOnlyHealthCommand(item))
    : null;
  if (action.executionMode === "immediate" && !command) {
    return { ok: false, httpStatus: 422, error: "registered action is no longer safe to execute" };
  }
  return { ok: true, project, resource, action, command };
}

function buildMobileProjectActionEnvelope({ input, action }) {
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  return {
    id: `mobile-action:${idempotencyKey}`,
    channel: "axi-mobile",
    conversationId: `mobile:${input.deviceId || "paired-owner"}`,
    senderId: input.deviceId || "paired-owner",
    text: action.label,
    receivedAt: new Date().toISOString(),
    raw: {
      source: "mobile_project_action",
      projectId: input.projectId,
      actionId: action.actionId,
      actionType: action.actionType,
      idempotencyKey,
    },
  };
}

function assessProjectDiagnosis() {
  return {
    kind: "ops",
    complexity: "small",
    estimatedDuration: "sync",
    requiresOrchestration: false,
    requiresAudit: true,
    requiresApproval: true,
    requiresLibrarian: false,
    risk: "medium",
    summary: "项目只读诊断，需要 owner 明确审批",
    nextUpdateSeconds: 30,
  };
}

function createControlJob({ input, resolvedMobileAction = null, approvedApprovalId = null, forceApproval = false, approvalSource = "desktop", workspaceRoot, graphPath, cacheDir, jobs, jobEnvelopeIndex, agentTasks, approvals, roleAgentExecutor, axiAgentTaskExecutor, codexBin, appServerBin, heartbeatMs, memoryDatabaseUrl }) {
  const envelope = normalizeIMEnvelope(input?.envelope || input || {});
  if (jobEnvelopeIndex.has(envelope.id)) {
    const existingId = jobEnvelopeIndex.get(envelope.id);
    const existing = jobs.get(existingId) || readJson(join(cacheDir, "jobs", existingId, "job.json"), null);
    return buildJobAcceptedResult(existing, latestJobEvent({ cacheDir, id: existingId }));
  }

  const registeredCommand = resolvedMobileAction?.action.executionMode === "immediate"
    ? { targetId: resolvedMobileAction.project.id, command: resolvedMobileAction.command }
    : selectRegisteredCommand({ text: envelope.text, workspaceRoot, graphPath });
  const projectDiagnosis = resolvedMobileAction?.action.executionMode === "requires_approval"
    ? { targetId: resolvedMobileAction.project.id, project: resolvedMobileAction.project, resource: resolvedMobileAction.resource, action: resolvedMobileAction.action }
    : null;
  const axiAgentTask = registeredCommand || projectDiagnosis ? null : selectAxiAgentTask({ text: envelope.text, workspaceRoot, graphPath });
  const assessment = registeredCommand
    ? assessRegisteredCommand(registeredCommand.command)
    : projectDiagnosis
      ? assessProjectDiagnosis()
      : axiAgentTask
      ? assessAxiAgentTask(axiAgentTask)
      : assessTask(envelope.text);

  // DevHub / Axi Mobile stage-B item 7: requiresApproval gate.
  // When the assessment says the action needs explicit owner approval,
  // we DO NOT enqueue the job.  Instead we file a pending ApprovalRequest
  // that the owner reviews via the existing decideApproval path; once
  // approved, decideApproval re-enters createControlJob with the same
  // envelope id and the gate short-circuits because the envelope id is
  // already indexed by the approval entry.  The replay-safe index
  // (jobEnvelopeIndex) is intentionally NOT populated here so a future
  // direct createJob() with the same envelope id would still be gated
  // by the approval's riskLevel rather than collapsing to a duplicate.
  if ((forceApproval || assessment.requiresApproval || resolvedMobileAction?.forceApproval) && !approvedApprovalId && !resolvedMobileAction?.approvedApprovalId) {
    const approval = {
      id: `apr_${randomUUID()}`,
      routeKey: envelope.raw?.routeKey || envelope.channel || "mobile",
      runId: undefined,
      taskId: undefined,
      actionSummary: assessment.summary,
      riskLevel: assessment.risk,
      status: "pending",
      source: resolvedMobileAction ? "mobile_project_action" : approvalSource,
      sourceDeviceId: input?.deviceId || null,
      projectId: input?.projectId || null,
      actionId: input?.actionId || null,
      idempotencyKey: input?.idempotencyKey || null,
      actionType: input?.actionType || null,
      actionLevel: resolvedMobileAction?.action.actionLevel || approvalActionLevel({ riskLevel: assessment.risk }),
      policyDecisionRef: firstString(input?.__policyDecisionRef, resolvedMobileAction?.policyDecisionRef) || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
      envelopeId: envelope.id,
      envelopeText: envelope.text,
    };
    approvals.set(approval.id, approval);
    persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
    appendAuditRecord(cacheDir, {
      auditKind: "approval_requested",
      approvalId: approval.id,
      deviceId: approval.sourceDeviceId,
      idempotencyKey: approval.idempotencyKey,
      projectId: approval.projectId,
      actionId: approval.actionId,
      actionType: approval.actionType,
      riskLevel: approval.riskLevel,
      policyDecisionRef: approval.policyDecisionRef || null,
      occurredAt: Math.floor(Date.now() / 1000),
    });
    return { status: "pending_approval", approvalId: approval.id, riskLevel: approval.riskLevel, actionSummary: approval.actionSummary, expiresAt: approval.expiresAt };
  }

  const now = new Date();
  const job = {
    id: randomUUID(),
    envelope,
    routeKey: envelope.raw?.routeKey,
    status: "received",
    assessment,
    currentStage: "received",
    summary: `已接收 ${assessment.kind} 任务，正在进入编排队列。`,
    nextUpdateAt: new Date(now.getTime() + assessment.nextUpdateSeconds * 1000).toISOString(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    metadata: {
      requestedRuntime: envelope.raw?.runtimePreference || (envelope.channel === "mosscoder" ? "codex_app" : "codex_cli"),
      workspaceRoot,
      ...(resolvedMobileAction?.approvedApprovalId ? { approvalId: resolvedMobileAction.approvedApprovalId } : {}),
      ...(approvedApprovalId ? { approvalId: approvedApprovalId } : {}),
      ...(firstString(input?.__policyDecisionRef, resolvedMobileAction?.policyDecisionRef) ? { policyDecisionRef: firstString(input?.__policyDecisionRef, resolvedMobileAction?.policyDecisionRef) } : {}),
      ...(registeredCommand ? { executionMode: "registered_command", commandId: registeredCommand.command.id } : {}),
      ...(projectDiagnosis ? { executionMode: "project_diagnosis", actionId: projectDiagnosis.action.actionId, reasonCode: projectDiagnosis.project.reasonCode } : {}),
      ...(axiAgentTask ? { executionMode: "axi_agent", operation: axiAgentTask.operation } : {}),
    },
  };
  jobs.set(job.id, job);
  jobEnvelopeIndex.set(envelope.id, job.id);
  persistJob(cacheDir, job);
  appendJobEvent(cacheDir, job, { type: "received", status: job.status, message: "任务已接收，已写入控制面队列。", data: { envelopeId: envelope.id } });
  transitionJob(cacheDir, job, "assessed", `任务评估完成：${assessment.summary}`, { assessment });
  transitionJob(cacheDir, job, "queued", "任务已入队，等待 workflow runtime 编排。");

  setImmediate(() => {
    const execution = registeredCommand
      ? runRegisteredCommandJob({ job, registeredCommand, cacheDir, jobs, agentTasks })
      : projectDiagnosis
        ? runProjectDiagnosisJob({ job, projectDiagnosis, cacheDir, jobs, agentTasks })
        : axiAgentTask
        ? runAxiAgentJob({ job, axiAgentTask, cacheDir, jobs, agentTasks, axiAgentTaskExecutor })
        : runWorkflowJob({ job, workspaceRoot, cacheDir, jobs, roleAgentExecutor, codexBin, appServerBin, heartbeatMs, memoryDatabaseUrl });
    Promise.resolve(execution).catch((error) => failJob(cacheDir, job, `workflow runtime 失败：${error?.message || String(error)}`));
  });

  return buildJobAcceptedResult(job, latestJobEvent({ cacheDir, id: job.id }));
}

function buildJobAcceptedResult(job, latestEvent) {
  return {
    ignored: false,
    accepted: true,
    job,
    latestEvent,
    response: buildJobAcceptedResponse(job),
  };
}

function buildJobAcceptedResponse(job) {
  return {
    id: randomUUID(),
    channel: job.envelope.channel,
    conversationId: job.envelope.conversationId,
    inReplyTo: job.envelope.id,
    text: [
      "**Axi Workstation 任务已入队**",
      "",
      `任务编号：\`${job.id}\``,
      `任务类型：\`${job.assessment.kind}\`｜复杂度：\`${job.assessment.complexity}\`｜风险：\`${job.assessment.risk}\``,
      `预计周期：\`${job.assessment.estimatedDuration}\``,
      `当前阶段：${job.currentStage}`,
      `下次更新：${formatDateTime(job.nextUpdateAt)}`,
      "",
      "我会持续记录状态事件；长任务不会再阻塞当前 IM 请求。",
    ].join("\n"),
    format: job.envelope.channel === "feishu" ? "feishu_markdown" : "card",
    language: "zh-CN",
    auditId: job.id,
    createdAt: new Date().toISOString(),
  };
}

function selectReadOnlyRegisteredCommand({ text, workspaceRoot, graphPath }) {
  const selected = selectRegisteredCommand({ text, workspaceRoot, graphPath });
  return selected?.command.intent === "run_health" && selected.command.autoExecutable ? selected : null;
}

function selectRegisteredCommand({ text, workspaceRoot, graphPath }) {
  const snapshot = buildSnapshot({ workspaceRoot, graphPath });
  const parsed = parseIntent(text, snapshot);
  if (!parsed.command || !["run_health", "run_verify", "run_remediation"].includes(parsed.intent)) return null;
  return { targetId: parsed.targetId, command: parsed.command };
}

function assessRegisteredCommand(command) {
  const remediation = command.intent === "run_remediation";
  return {
    kind: "ops",
    complexity: "small",
    estimatedDuration: "sync",
    requiresOrchestration: false,
    requiresAudit: true,
    requiresApproval: remediation,
    requiresLibrarian: false,
    risk: remediation ? "high" : "low",
    summary: remediation ? "ops / high / registered remediation command，需要 owner 审批" : "ops / small / registered read-only command",
    nextUpdateSeconds: 30,
  };
}

function selectAxiAgentTask({ text, workspaceRoot, graphPath }) {
  const query = String(text || "").trim();
  if (!/\baxi-agent\b/i.test(query)) return null;

  const snapshot = buildSnapshot({ workspaceRoot, graphPath });
  const resource = snapshot.resources.find((item) => item.id === "axi-agent");
  if (!resource || resource.status === "missing") return null;

  if (/(审计|质量|quality|gate|review|检查)/i.test(query)) {
    return {
      targetId: "axi-agent",
      operation: "quality_gate",
      prompt: extractAxiAgentQualityPrompt(query),
      gateIds: ["code_quality"],
      cwd: resource.path || workspaceRoot,
    };
  }

  if (/(git|status|状态|只读|tool|工具|artifact|结果)/i.test(query)) {
    return {
      targetId: "axi-agent",
      operation: "tool_result_artifact",
      prompt: extractAxiAgentToolPrompt(query),
      toolName: "swarm_git_status",
      toolArguments: { repoPath: resource.path || workspaceRoot },
      cwd: resource.path || workspaceRoot,
    };
  }

  return null;
}

function extractAxiAgentToolPrompt(text) {
  return String(text || "")
    .replace(/^.*?\baxi-agent\b\s*/i, "")
    .trim() || String(text || "").trim();
}

function extractAxiAgentQualityPrompt(text) {
  return String(text || "")
    .replace(/^.*?\baxi-agent\b\s*/i, "")
    .replace(/^(审计|质量检查|quality gate|quality review|review|检查)\s*/i, "")
    .trim() || String(text || "").trim();
}

function assessAxiAgentTask(task = {}) {
  const isToolResult = task.operation === "tool_result_artifact";
  return {
    kind: isToolResult ? "ops" : "code",
    complexity: "small",
    estimatedDuration: "sync",
    requiresOrchestration: false,
    requiresAudit: true,
    requiresApproval: false,
    requiresLibrarian: false,
    risk: "low",
    summary: isToolResult ? "ops / small / axi-agent readonly tool result" : "code / small / axi-agent quality gate",
    nextUpdateSeconds: 30,
  };
}

function runRegisteredCommandJob({ job, registeredCommand, cacheDir, jobs, agentTasks }) {
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    routeKey: job.routeKey,
    runtime: "registered_command",
    requestedRuntime: "registered_command",
    status: "running",
    prompt: job.envelope.text,
    targetId: registeredCommand.targetId,
    cwd: registeredCommand.command.cwd,
    summary: registeredCommand.command.intent === "run_remediation" ? "执行已登记且经审批的整改命令。" : "执行已登记的只读命令。",
    createdAt: now,
    startedAt: now,
  };
  agentTasks.set(task.id, task);
  job.metadata = { ...job.metadata, agentTaskId: task.id };
  persistAgentTask(cacheDir, task);
  persistJob(cacheDir, job);
  transitionJob(cacheDir, job, "executing", `通过受管 AgentTask 执行 ${registeredCommand.targetId} ${registeredCommand.command.intent}。`);
  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "executing",
    message: `registered_command 开始：${registeredCommand.command.label}`,
    data: { taskId: task.id, commandId: registeredCommand.command.id },
  });

  const result = executeManagedCommand(registeredCommand.command, { allowRegisteredRemediation: Boolean(job.metadata?.approvalId) });
  task.status = result.status === "succeeded" ? "succeeded" : "failed";
  task.summary = result.summary;
  task.stdout = result.stdout;
  task.stderr = result.stderr;
  task.completedAt = new Date().toISOString();
  const artifactPath = join(jobDir(cacheDir, job.id), "artifacts", "registered-command.json");
  persistJson(artifactPath, {
    taskId: task.id,
    targetId: task.targetId,
    commandId: registeredCommand.command.id,
    status: task.status,
    summary: task.summary,
    stdout: task.stdout,
    stderr: task.stderr,
    exitCode: result.exitCode,
    completedAt: task.completedAt,
  });
  if (task.status === "succeeded") {
    const evidence = createExecutionEvidence({ cacheDir, targetRef: task.targetId, status: "succeeded", artifactRef: artifactPath, observedAt: task.completedAt });
    task.evidenceRefs = evidence ? [evidence.id] : [];
  }
  persistAgentTask(cacheDir, task);
  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "executing",
    message: `registered_command 完成：${task.summary}`,
    data: { taskId: task.id, commandId: registeredCommand.command.id, status: task.status },
  });

  const audit = {
    id: randomUUID(),
    jobId: job.id,
    verdict: task.status === "succeeded" ? "pass" : "reject",
    summary: task.status === "succeeded" ? "已登记命令执行并审计通过。" : "已登记命令执行失败。",
    findings: task.status === "succeeded" ? [] : [task.summary],
    evidenceRefs: task.evidenceRefs || [],
    createdAt: new Date().toISOString(),
  };
  job.auditReport = audit;
  persistJson(join(jobDir(cacheDir, job.id), "audit-report.json"), audit);
  appendJobEvent(cacheDir, job, { type: "audit", status: "auditing", message: audit.summary, data: { verdict: audit.verdict, taskId: task.id } });
  if (task.status !== "succeeded") {
    const failedJob = failJob(cacheDir, job, audit.summary);
    task.evidenceRefs = failedJob.metadata?.evidenceRefs || [];
    failedJob.auditReport = { ...audit, evidenceRefs: task.evidenceRefs };
    persistAgentTask(cacheDir, task);
    persistJson(join(jobDir(cacheDir, job.id), "audit-report.json"), failedJob.auditReport);
    persistJob(cacheDir, failedJob);
    jobs.set(job.id, failedJob);
    return failedJob;
  }

  transitionJob(cacheDir, job, "notified", "注册命令结果已准备给通信层回推。");
  transitionJob(cacheDir, job, "completed", "注册命令执行完成。");
  job.completedAt = new Date().toISOString();
  persistJob(cacheDir, job);
  jobs.set(job.id, job);
  return job;
}

function runProjectDiagnosisJob({ job, projectDiagnosis, cacheDir, jobs, agentTasks }) {
  const now = new Date().toISOString();
  const { project, resource, action } = projectDiagnosis;
  const diagnosis = {
    projectId: project.id,
    projectName: project.name,
    health: project.health,
    reasonCode: project.reasonCode,
    source: "workspace.graph",
    checkedAt: now,
    findings: [
      { code: project.reasonCode, summary: mobileReasonSummary(project.reasonCode) },
      { code: "progress", summary: project.progress?.summary || "尚未提供进展摘要。" },
      { code: "evidence", summary: `已登记 ${project.progress?.evidenceCount || 0} 条证据。` },
    ],
    nextStep: project.actions.some((item) => item.actionId === "verify")
      ? "可在项目详情执行重新核验。"
      : "请根据诊断结果补充项目证据或更新交接信息。",
  };
  const task = {
    id: randomUUID(),
    routeKey: job.routeKey,
    runtime: "project_diagnosis",
    requestedRuntime: "project_diagnosis",
    operation: "project_diagnosis",
    status: "running",
    prompt: `对 ${project.name} 执行受控只读诊断。仅复核控制面状态和登记证据；不读取凭据、不执行 Shell、不修改项目文件。`,
    targetId: project.id,
    cwd: resource.path,
    readOnly: true,
    projectFileWrite: false,
    writeScope: [],
    approvalId: job.metadata?.approvalId || null,
    summary: "正在汇总项目状态与登记证据。",
    createdAt: now,
    startedAt: now,
  };
  agentTasks.set(task.id, task);
  job.metadata = { ...job.metadata, agentTaskId: task.id, projectFileWrite: false };
  persistAgentTask(cacheDir, task);
  persistJob(cacheDir, job);
  transitionJob(cacheDir, job, "executing", `通过受管 AgentTask 对 ${project.name} 执行只读诊断。`);
  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "executing",
    message: "project_diagnosis 开始：仅复核控制面状态和证据。",
    data: { taskId: task.id, projectId: project.id, actionId: action.actionId, readOnly: true, projectFileWrite: false },
  });

  task.status = "succeeded";
  task.summary = "只读诊断完成，未修改项目文件。";
  task.stdout = JSON.stringify(diagnosis);
  task.completedAt = new Date().toISOString();
  persistAgentTask(cacheDir, task);
  persistJson(join(jobDir(cacheDir, job.id), "artifacts", "project-diagnosis.json"), {
    taskId: task.id,
    targetId: task.targetId,
    runtime: task.runtime,
    readOnly: true,
    projectFileWrite: false,
    diagnosis,
    completedAt: task.completedAt,
  });
  const audit = {
    id: randomUUID(),
    jobId: job.id,
    verdict: "pass",
    summary: "项目只读诊断已完成，未修改项目文件。",
    findings: [],
    createdAt: new Date().toISOString(),
  };
  job.auditReport = audit;
  persistJson(join(jobDir(cacheDir, job.id), "audit-report.json"), audit);
  appendJobEvent(cacheDir, job, {
    type: "audit",
    status: "auditing",
    message: audit.summary,
    data: { verdict: audit.verdict, taskId: task.id, projectFileWrite: false },
  });
  transitionJob(cacheDir, job, "notified", "只读诊断结果已准备给移动端展示。");
  transitionJob(cacheDir, job, "completed", "项目只读诊断完成。");
  job.completedAt = new Date().toISOString();
  persistJob(cacheDir, job);
  jobs.set(job.id, job);
  return job;
}

async function runAxiAgentJob({ job, axiAgentTask, cacheDir, jobs, agentTasks, axiAgentTaskExecutor }) {
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    routeKey: job.routeKey,
    runtime: "axi_agent",
    requestedRuntime: "axi_agent",
    status: "running",
    prompt: axiAgentTask.prompt,
    targetId: axiAgentTask.targetId,
    cwd: axiAgentTask.cwd,
    summary: `通过 Axi Agent 平台执行受限任务：${axiAgentTask.operation}。`,
    createdAt: now,
    startedAt: now,
  };
  agentTasks.set(task.id, task);
  job.metadata = { ...job.metadata, agentTaskId: task.id };
  persistAgentTask(cacheDir, task);
  persistJob(cacheDir, job);
  transitionJob(cacheDir, job, "executing", `通过受管 AgentTask 委派 Axi Agent 执行 ${axiAgentTask.operation}。`);
  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "executing",
    message: `axi_agent ${axiAgentTask.operation} 开始。`,
    data: { taskId: task.id, targetId: task.targetId, operation: axiAgentTask.operation },
  });

  const result = await axiAgentTaskExecutor({
    operation: axiAgentTask.operation,
    agentTaskId: task.id,
    prompt: axiAgentTask.prompt,
    gateIds: axiAgentTask.gateIds,
    toolName: axiAgentTask.toolName,
    toolArguments: axiAgentTask.toolArguments,
    cwd: axiAgentTask.cwd,
  });
  const passed = result?.passed !== false && result?.status === "succeeded";
  task.status = passed ? "succeeded" : "failed";
  task.summary = result?.summary || (passed ? "Axi Agent quality gate passed." : "Axi Agent quality gate failed.");
  task.stdout = truncate(result?.text || result?.stdout || "");
  task.stderr = truncate(result?.stderr || "");
  task.completedAt = new Date().toISOString();
  persistAgentTask(cacheDir, task);
  persistJson(join(jobDir(cacheDir, job.id), "artifacts", "axi-agent-task.json"), {
    taskId: task.id,
    targetId: task.targetId,
    operation: axiAgentTask.operation,
    runtime: task.runtime,
    status: task.status,
    passed,
    source: result?.source,
    tool: result?.tool,
    toolName: axiAgentTask.toolName,
    toolArguments: axiAgentTask.toolArguments,
    summary: task.summary,
    text: task.stdout,
    stderr: task.stderr,
    completedAt: task.completedAt,
  });
  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "executing",
    message: `axi_agent ${axiAgentTask.operation} 完成：${task.summary}`,
    data: { taskId: task.id, status: task.status, source: result?.source, tool: result?.tool },
  });

  const audit = {
    id: randomUUID(),
    jobId: job.id,
    verdict: passed ? "pass" : "reject",
    summary: passed ? `Axi Agent ${axiAgentTask.operation} 通过，审计通过。` : `Axi Agent ${axiAgentTask.operation} 未通过。`,
    findings: passed ? [] : [task.summary],
    createdAt: new Date().toISOString(),
  };
  job.auditReport = audit;
  persistJson(join(jobDir(cacheDir, job.id), "audit-report.json"), audit);
  appendJobEvent(cacheDir, job, { type: "audit", status: "auditing", message: audit.summary, data: { verdict: audit.verdict, taskId: task.id, source: result?.source, tool: result?.tool } });
  if (!passed) {
    failJob(cacheDir, job, audit.summary);
    jobs.set(job.id, job);
    return job;
  }

  transitionJob(cacheDir, job, "notified", `Axi Agent ${axiAgentTask.operation} 结果已准备给通信层回推。`);
  transitionJob(cacheDir, job, "completed", `Axi Agent ${axiAgentTask.operation} 执行完成。`);
  job.completedAt = new Date().toISOString();
  persistJob(cacheDir, job);
  jobs.set(job.id, job);
  return job;
}

async function runWorkflowJob({ job, workspaceRoot, cacheDir, jobs, roleAgentExecutor, codexBin, appServerBin, heartbeatMs, memoryDatabaseUrl }) {
  let heartbeat = null;
  try {
    heartbeat = setInterval(() => {
      if (["completed", "failed", "cancelled", "policy_violation"].includes(job.status)) return;
      job.nextUpdateAt = new Date(Date.now() + heartbeatMs).toISOString();
      job.updatedAt = new Date().toISOString();
      persistJob(cacheDir, job);
      appendJobEvent(cacheDir, job, {
        type: "heartbeat",
        status: job.status,
        message: `仍在执行，当前阶段：${job.currentStage}。`,
      });
    }, heartbeatMs);

    await runLangGraphWorkflow({ job, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin, memoryDatabaseUrl });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    jobs.set(job.id, job);
  }
}

async function runLangGraphWorkflow({ job, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin, memoryDatabaseUrl }) {
  const context = { workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin, memoryDatabaseUrl };
  const WorkflowState = Annotation.Root({
    job: Annotation(),
    plan: Annotation(),
    audit: Annotation(),
    failed: Annotation(),
  });
  const graph = new StateGraph(WorkflowState)
    .addNode("planning", (state) => langGraphPlanningNode(state, context))
    .addNode("documenting", (state) => langGraphDocumentingNode(state, context))
    .addNode("executing", (state) => langGraphExecutingNode(state, context))
    .addNode("master_collecting", (state) => langGraphMasterCollectingNode(state, context))
    .addNode("auditing", (state) => langGraphAuditingNode(state, context))
    .addNode("rejected_rework", (state) => langGraphRejectedReworkNode(state, context))
    .addNode("passed", (state) => langGraphPassedNode(state, context))
    .addNode("archiving", (state) => langGraphArchivingNode(state, context))
    .addEdge(START, "planning")
    .addEdge("planning", "documenting")
    .addEdge("documenting", "executing")
    .addEdge("executing", "master_collecting")
    .addEdge("master_collecting", "auditing")
    .addConditionalEdges("auditing", (state) => state.audit?.verdict === "pass" ? "passed" : "rejected_rework")
    .addEdge("rejected_rework", END)
    .addEdge("passed", "archiving")
    .addEdge("archiving", END)
    .compile({ checkpointer: new MemorySaver() });

  appendJobEvent(cacheDir, job, {
    type: "checkpoint",
    status: job.status,
    message: "LangGraph workflow runtime 已启动。",
    data: { framework: "langgraph", threadId: job.id },
  });
  const result = await graph.invoke({ job, plan: null, audit: null, failed: null }, {
    configurable: { thread_id: job.id },
  });
  persistJson(join(jobDir(cacheDir, job.id), "langgraph-state.json"), {
    threadId: job.id,
    jobId: result.job?.id || job.id,
    status: result.job?.status || job.status,
    planId: result.plan?.id,
    auditVerdict: result.audit?.verdict,
    failed: result.failed || null,
    updatedAt: new Date().toISOString(),
  });
}

async function langGraphPlanningNode(state, context) {
  const { job } = state;
  const { cacheDir, workspaceRoot, roleAgentExecutor, codexBin, appServerBin } = context;
  transitionJob(cacheDir, job, "planning", "master 开始拆解任务并制定 worker 目标。");
  const plan = makeWorkflowPlan(job);
  job.plan = plan;
  job.workflowRuntime = { framework: "langgraph", threadId: job.id, checkpoint: "planning" };
  persistWorkflowPlan(cacheDir, plan);
  persistJob(cacheDir, job);
  appendJobEvent(cacheDir, job, { type: "assignment", status: job.status, message: `已生成 ${plan.assignments.length} 个角色 assignment。`, data: { assignmentIds: plan.assignments.map((item) => item.id), framework: "langgraph" } });

  const master = await runAssignment({ job, assignment: plan.assignments.find((item) => item.role === "master"), workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  if (master.status !== "succeeded") return { job: failJob(cacheDir, job, "master 编排失败。"), plan, failed: "master" };
  return { job, plan };
}

async function langGraphDocumentingNode(state, context) {
  if (state.failed) return state;
  const { job, plan } = state;
  const { cacheDir, workspaceRoot, roleAgentExecutor, codexBin, appServerBin } = context;
  transitionJob(cacheDir, job, "documenting", "librarian 开始创建任务路线和上下文包。");
  const librarianPrep = await runAssignment({ job, assignment: plan.assignments.find((item) => item.id.endsWith(":librarian-prep")), workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  if (librarianPrep.status !== "succeeded") return { job: failJob(cacheDir, job, "librarian 前置归档失败。"), plan, failed: "librarian-prep" };
  return { job, plan };
}

async function langGraphExecutingNode(state, context) {
  if (state.failed) return state;
  const { job, plan } = state;
  const { cacheDir, workspaceRoot, roleAgentExecutor, codexBin, appServerBin } = context;
  transitionJob(cacheDir, job, "executing", "worker 开始执行明确任务。");
  const workerAssignments = plan.assignments.filter((item) => item.role === "worker");
  const workerResult = await runWorkerAssignments({ job, assignments: workerAssignments, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  if (workerResult.status !== "succeeded") return { job: failJob(cacheDir, job, workerResult.summary), plan, failed: "worker" };
  return { job, plan };
}

function langGraphMasterCollectingNode(state, context) {
  if (state.failed) return state;
  const { job, plan } = state;
  const { cacheDir } = context;
  transitionJob(cacheDir, job, "worker_self_audit", "worker 已完成自审计，master 开始收集结果。");
  transitionJob(cacheDir, job, "master_collecting", "master 汇总 worker 结果并准备提交 auditor。");
  return { job, plan };
}

async function langGraphAuditingNode(state, context) {
  if (state.failed) {
    return {
      ...state,
      audit: {
        id: randomUUID(),
        jobId: state.job.id,
        verdict: "reject",
        summary: `前置阶段失败：${state.failed}`,
        findings: [String(state.failed)],
        createdAt: new Date().toISOString(),
      },
    };
  }
  const { job, plan } = state;
  const { cacheDir, workspaceRoot, roleAgentExecutor, codexBin, appServerBin } = context;
  transitionJob(cacheDir, job, "auditing", "auditor 开始只读审计。");
  const auditor = await runAssignment({ job, assignment: plan.assignments.find((item) => item.role === "auditor"), workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin, readOnly: true });
  const audit = {
    id: randomUUID(),
    jobId: job.id,
    verdict: auditor.status === "succeeded" ? "pass" : "reject",
    summary: auditor.status === "succeeded" ? "auditor 只读审计通过。" : "auditor 只读审计拒绝。",
    findings: auditor.status === "succeeded" ? [] : [auditor.summary || "auditor failed"],
    createdAt: new Date().toISOString(),
  };
  job.auditReport = audit;
  persistJson(join(jobDir(cacheDir, job.id), "audit-report.json"), audit);
  appendJobEvent(cacheDir, job, { type: "audit", status: "auditing", message: audit.summary, data: { verdict: audit.verdict } });
  return { job, plan, audit };
}

function langGraphRejectedReworkNode(state, context) {
  const { job, audit } = state;
  const { cacheDir } = context;
  transitionJob(cacheDir, job, "rejected_rework", "auditor 拒绝，本轮标记为需要返工。");
  failJob(cacheDir, job, audit?.summary || "auditor reject，需要 master 重新分配返工。");
  return { ...state, job, failed: state.failed || "auditor" };
}

function langGraphPassedNode(state, context) {
  const { job, plan, audit } = state;
  const { cacheDir } = context;
  transitionJob(cacheDir, job, "passed", "auditor 通过，进入 librarian 归档。");
  return { job, plan, audit };
}

async function langGraphArchivingNode(state, context) {
  const { job, plan, audit } = state;
  const { cacheDir, workspaceRoot, roleAgentExecutor, codexBin, appServerBin, memoryDatabaseUrl } = context;
  transitionJob(cacheDir, job, "archiving", "librarian 开始归档 MEMORY/EXPERIENCE/CHANGELOG 摘要。");
  const librarianArchive = await runAssignment({ job, assignment: plan.assignments.find((item) => item.id.endsWith(":librarian-archive")), workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  const archive = {
    id: randomUUID(),
    jobId: job.id,
    summary: librarianArchive.status === "succeeded" ? "librarian 已完成归档。" : "librarian 归档未完整完成。",
    artifacts: listJobArtifacts({ cacheDir, id: job.id }).artifacts.map((item) => item.path),
    memoryUpdates: [job.summary],
    createdAt: new Date().toISOString(),
  };
  job.archive = archive;
  persistJson(join(jobDir(cacheDir, job.id), "archive.json"), archive);
  appendJobEvent(cacheDir, job, { type: "archive", status: "archiving", message: archive.summary, data: { artifactCount: archive.artifacts.length } });
  mirrorJobSummaryBestEffort({ cacheDir, job, memoryDatabaseUrl });
  transitionJob(cacheDir, job, "notified", "任务完成事件已准备给通信层回推。");
  transitionJob(cacheDir, job, "completed", "长任务执行完成。");
  job.completedAt = new Date().toISOString();
  persistJob(cacheDir, job);
  return { job, plan, audit };
}

async function runAssignment({ job, assignment, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin, readOnly = false }) {
  if (!assignment) return { status: "skipped", summary: "assignment missing" };
  assignment.status = "running";
  assignment.startedAt = new Date().toISOString();
  persistAssignment(cacheDir, job.id, assignment);
  appendJobEvent(cacheDir, job, { type: "agent_run", status: job.status, role: assignment.role, message: `${assignment.role} 开始：${assignment.title}`, data: { assignmentId: assignment.id } });
  const run = makeAgentRun({ job, assignment, workspaceRoot });
  persistAgentRun(cacheDir, run);
  const result = await roleAgentExecutor({ job, assignment, run, codexBin, appServerBin, cacheDir, readOnly });
  run.status = result.status;
  run.summary = result.summary;
  run.stdoutPath = result.stdoutPath || run.stdoutPath;
  run.stderrPath = result.stderrPath || run.stderrPath;
  run.completedAt = new Date().toISOString();
  assignment.status = result.status === "succeeded" ? "succeeded" : "failed";
  assignment.completedAt = run.completedAt;
  persistAgentRun(cacheDir, run);
  persistAssignment(cacheDir, job.id, assignment);
  appendJobEvent(cacheDir, job, { type: "agent_run", status: job.status, role: assignment.role, message: `${assignment.role} 完成：${result.summary}`, data: { assignmentId: assignment.id, runId: run.id, status: run.status } });
  return result;
}

async function runWorkerAssignments({ job, assignments, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin }) {
  if (!assignments.length) return { status: "succeeded", summary: "没有 worker assignment。" };
  const runOne = (assignment) => runWorkerWithSelfCorrection({ job, assignment, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });

  if (canRunAssignmentsInParallel(assignments)) {
    const results = await Promise.all(assignments.map(runOne));
    const failed = results.find((result) => result.status !== "succeeded");
    return failed || { status: "succeeded", summary: "所有 worker 并行执行完成。" };
  }

  for (const assignment of assignments) {
    const result = await runOne(assignment);
    if (result.status !== "succeeded") return result;
  }
  return { status: "succeeded", summary: "所有 worker 顺序执行完成。" };
}

async function runWorkerWithSelfCorrection({ job, assignment, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin }) {
  let result = await runAssignment({ job, assignment, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  if (result.status === "succeeded") return result;

  appendJobEvent(cacheDir, job, {
    type: "agent_run",
    status: "worker_self_audit",
    role: "worker",
    message: `worker 自审计未达标，触发一次自修正：${assignment.title}`,
    data: { assignmentId: assignment.id, firstFailure: result.summary },
  });
  assignment.status = "queued";
  assignment.prompt = [
    assignment.prompt,
    "",
    "自修正要求：上一次执行未达标。请先列出缺口，再在原 write scope 内修正，完成后重新验证并输出自审计结果。",
  ].join("\n");
  persistAssignment(cacheDir, job.id, assignment);

  result = await runAssignment({ job, assignment, workspaceRoot, cacheDir, roleAgentExecutor, codexBin, appServerBin });
  if (result.status === "succeeded") return result;
  return { ...result, summary: `worker 自修正后仍失败：${assignment.title}。${result.summary || ""}` };
}

function canRunAssignmentsInParallel(assignments) {
  if (assignments.length < 2) return false;
  if (assignments.some((assignment) => !assignment.writeScope?.length)) return false;
  for (let index = 0; index < assignments.length; index += 1) {
    for (let other = index + 1; other < assignments.length; other += 1) {
      if (writeScopesOverlap(assignments[index].writeScope, assignments[other].writeScope)) return false;
    }
  }
  return true;
}

function writeScopesOverlap(left = [], right = []) {
  return left.some((leftScope) => right.some((rightScope) => {
    const leftValue = resolve(String(leftScope));
    const rightValue = resolve(String(rightScope));
    return leftValue === rightValue || leftValue.startsWith(`${rightValue}/`) || rightValue.startsWith(`${leftValue}/`);
  }));
}

function assessTask(text) {
  const query = String(text || "");
  const lowered = query.toLowerCase();
  const kind = /(rm|部署|生产|端口|服务器|adb|docker|kubectl|terraform|ops|运维)/i.test(lowered)
    ? "ops"
    : /(代码|开发|实现|网页|游戏|bug|构建|测试|codex|agent|从 0 到 1|从0到1)/i.test(query)
      ? "code"
      : /(文档|README|PRD|TDD|CHANGELOG|MILESTONE|MEMORY|TODO)/i.test(query)
        ? "docs"
        : /(协作|调研|分析|计划|整理)/i.test(query)
          ? "coworker"
          : "chat";
  const complexity = query.length > 600 || /(从 0 到 1|从0到1|完整|端到端|多项目|编排)/i.test(query) ? "large" : query.length > 160 ? "medium" : "small";
  const risk = blockedReasonFor(query) ? "destructive" : kind === "ops" ? "high" : kind === "code" ? "medium" : "low";
  const estimatedDuration = kind === "chat" && complexity === "small" ? "sync" : complexity === "large" ? "long_running" : "minutes";
  return {
    kind,
    complexity,
    estimatedDuration,
    requiresOrchestration: kind !== "chat",
    requiresAudit: ["code", "ops", "docs"].includes(kind),
    requiresApproval: risk === "destructive",
    requiresLibrarian: kind !== "chat",
    risk,
    summary: `${kind} / ${complexity} / ${estimatedDuration}`,
    nextUpdateSeconds: 30,
  };
}

function makeWorkflowPlan(job) {
  const now = new Date().toISOString();
  const basePrompt = job.envelope.text;
  const writeScope = inferWriteScope(basePrompt);
  const primaryTarget = writeScope[0] || "用户指定目录";
  const assignments = [
    {
      id: `${job.id}:master`,
      role: "master",
      title: "拆解任务并制定 worker 目标",
      prompt: [
        "你是 Axi Workstation master。只做编排，不修改文件。",
        "请把用户任务拆成明确目标、验收标准、worker write scope 和风险点。",
        `用户任务：\n${basePrompt}`,
      ].join("\n\n"),
      writeScope: [],
      status: "queued",
      createdAt: now,
    },
    {
      id: `${job.id}:librarian-prep`,
      role: "librarian",
      title: "创建任务路线和上下文包",
      prompt: [
        "你是 Axi Workstation librarian。只输出任务路线、TODO 和归档计划，不修改业务文件。",
        "请为本任务准备文档/记忆归档路线。",
        `用户任务：\n${basePrompt}`,
      ].join("\n\n"),
      writeScope: [],
      status: "queued",
      createdAt: now,
    },
    {
      id: `${job.id}:worker-main`,
      role: "worker",
      title: "执行用户请求并自审计",
      prompt: [
        "你是 Axi Workstation worker。你只负责执行明确任务，并在完成后自审计。",
        "不要做泛化工作区探索，不要修改目标目录之外的任何文件。",
        `本次唯一允许写入范围：${primaryTarget}`,
        "直接实现一个最小但完整的静态网页项目，优先使用 HTML/CSS/JS，避免安装依赖。",
        "必须包含俄罗斯方块核心玩法、README、问题记录、验证记录。",
        "完成后用本地静态服务器或等价命令验证页面可访问，并输出中文自审计结果。",
        `用户任务：\n${basePrompt}`,
      ].join("\n\n"),
      writeScope,
      status: "queued",
      createdAt: now,
    },
    {
      id: `${job.id}:auditor`,
      role: "auditor",
      title: "只读审计任务完成情况",
      prompt: [
        "你是 Axi Workstation auditor。只读审计，不修改文件。",
        "请评估任务是否满足用户目标、是否有验证证据、是否有越权写入风险。",
        `用户任务：\n${basePrompt}`,
      ].join("\n\n"),
      writeScope: [],
      status: "queued",
      createdAt: now,
    },
    {
      id: `${job.id}:librarian-archive`,
      role: "librarian",
      title: "归档执行情报和经验",
      prompt: [
        "你是 Axi Workstation librarian。请根据任务完成情况输出归档摘要、MEMORY/EXPERIENCE 建议和后续 TODO。",
        "不要修改业务文件，只输出归档内容。",
        `用户任务：\n${basePrompt}`,
      ].join("\n\n"),
      writeScope: [],
      status: "queued",
      createdAt: now,
    },
  ];
  return {
    id: randomUUID(),
    jobId: job.id,
    summary: `为 ${job.assessment.kind} 任务生成 master/librarian/worker/auditor/librarian 工作流。`,
    assignments,
    createdAt: now,
  };
}

function inferWriteScope(text) {
  const scopes = [];
  const absoluteMatches = String(text || "").match(/\/Volumes\/code\/projects\/[^\s，。；\n]+/g) || [];
  scopes.push(...absoluteMatches);
  return Array.from(new Set(scopes));
}

function executeAgentTask({ task, codexBin }) {
  if (task.runtime === "codex_app") {
    return {
      status: "failed",
      summary: "codex_app 运行时当前只做可用性探测；请启用 app-server 协议适配后再执行。",
    };
  }
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "-c",
    'approval_policy="never"',
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "-C",
    task.cwd || process.cwd(),
    task.prompt,
  ];
  const result = spawnSync(codexBin, args, {
    encoding: "utf8",
    timeout: AGENT_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    status: result.status === 0 ? "succeeded" : "failed",
    summary: result.status === 0 ? "Codex CLI 任务执行成功。" : `Codex CLI 任务执行失败，退出码 ${result.status ?? "signal"}。`,
    stdout: truncate(result.stdout || ""),
    stderr: truncate(result.stderr || result.error?.message || ""),
  };
}

async function executeAxiAgentTask({ operation, agentTaskId, prompt, gateIds, toolName, toolArguments }) {
  if (!["quality_gate", "tool_result_artifact"].includes(operation)) {
    return {
      status: "failed",
      passed: false,
      summary: `Axi Agent operation is not supported: ${operation}`,
    };
  }
  if (typeof fetch !== "function") {
    return {
      status: "failed",
      passed: false,
      summary: "当前 Node.js 运行时缺少 fetch，无法调用 Axi Agent Platform API。",
    };
  }

  const baseUrl = process.env.AXI_AGENT_PLATFORM_URL || DEFAULT_AXI_AGENT_PLATFORM_URL;
  const endpointPath = operation === "quality_gate"
    ? "/api/v1/workstation/agent-tasks/quality-gate"
    : "/api/v1/workstation/agent-tasks/tool-result";
  const endpoint = new URL(endpointPath, baseUrl).toString();
  const body = operation === "quality_gate"
    ? {
      agentTaskId,
      prompt,
      gateIds,
      source: "axi-workstation",
    }
    : {
      agentTaskId,
      prompt,
      toolName,
      toolArguments: toolArguments || {},
      source: "axi-workstation",
    };
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      status: "failed",
      passed: false,
      summary: `Axi Agent Platform 不可达：${error?.message || String(error)}`,
    };
  }

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { text };
  }
  if (!response.ok) {
    return {
      status: "failed",
      passed: false,
      summary: `Axi Agent Platform 返回 ${response.status}。`,
      stderr: truncate(text),
    };
  }

  return {
    status: payload.status || (payload.passed ? "succeeded" : "failed"),
    passed: payload.passed === true,
    source: payload.source,
    tool: payload.tool,
    summary: payload.summary || "Axi Agent quality gate completed.",
    text: payload.text || text,
  };
}

function cancelAgentTask({ id, cacheDir, agentTasks, policyDecisionRef = null }) {
  const task = agentTasks.get(id) || readJson(join(cacheDir, "agent-tasks", `${id}.json`), null);
  if (!task) return null;
  if (["succeeded", "failed", "cancelled"].includes(task.status)) return task;
  task.status = "cancelled";
  task.summary = "任务已取消。";
  task.completedAt = new Date().toISOString();
  if (policyDecisionRef) task.policyDecisionRef = policyDecisionRef;
  agentTasks.set(id, task);
  persistAgentTask(cacheDir, task);
  appendAuditRecord(cacheDir, {
    auditKind: "agent_task.cancelled",
    taskId: task.id,
    actorRef: "control-plane",
    objectRef: task.id,
    action: "cancel",
    correlationId: firstString(task.correlationId) || task.id,
    policyDecisionRef: policyDecisionRef || task.policyDecisionRef || null,
    status: task.status,
  });
  return task;
}

function decideApproval({ input, cacheDir, approvals, agentTasks, dispatchApprovedJob, dispatchApprovedMobileAction }) {
  const storedApproval = approvals.get(input.id) || readJson(join(cacheDir, "approvals", `${input.id}.json`), null);
  const approval = storedApproval ? normalizeApprovalRecord(storedApproval) : null;
  if (!approval) return null;
  if (approval.status !== "pending") return approval;
  if (dateFromValue(approval.expiresAt)?.getTime() <= Date.now()) {
    approval.status = "expired";
    approval.decisionText = "审批已过期。";
    approval.decidedAt = new Date().toISOString();
    approvals.set(approval.id, approval);
    persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
    appendAuditRecord(cacheDir, {
      auditKind: "approval_expired",
      approvalId: approval.id,
      actorRef: "control-plane",
      objectRef: firstString(approval.projectId, approval.taskId) || approval.id,
      action: "approval_decision",
      correlationId: firstString(approval.envelopeId, approval.id) || approval.id,
      policyDecisionRef: approval.policyDecisionRef || null,
      result: approval.status,
      status: approval.status,
    });
    return approval;
  }
  approval.status = input.decision === "approved" ? "approved" : "rejected";
  approval.decisionText = input.decisionText || "";
  approval.decidedAt = new Date().toISOString();
  if (firstString(input.policyDecisionRef)) approval.decisionPolicyDecisionRef = firstString(input.policyDecisionRef);
  approvals.set(approval.id, approval);
  persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
  appendAuditRecord(cacheDir, {
    auditKind: "policy_decision",
    approvalId: approval.id,
    actorRef: firstString(input.actorRef, input.subjectRef, input.deviceId) || "unknown",
    objectRef: firstString(approval.projectId, approval.taskId) || approval.id,
    action: "approval_decision",
    beforeRef: "approval:pending",
    afterRef: `approval:${approval.status}`,
    correlationId: firstString(input.correlationId, approval.handoffCorrelationId, approval.envelopeId) || approval.id,
    policyDecisionRef: firstString(input.policyDecisionRef, approval.policyDecisionRef) || approval.id,
    result: approval.status,
    status: approval.status,
  });
  if (approval.taskId) {
    const task = agentTasks.get(approval.taskId);
    if (task && task.status === "awaiting_approval" && approval.status === "rejected") {
      task.status = "cancelled";
      task.summary = "审批已拒绝，任务取消。";
      task.completedAt = new Date().toISOString();
      persistAgentTask(cacheDir, task);
    }
  }
  // Mobile project actions are resolved afresh from the current registry.
  // Approval replay never trusts client text, a working directory, or a shell command.
  if (approval.status === "approved" && approval.source === "mobile_project_action" && dispatchApprovedMobileAction) {
    const jobResult = dispatchApprovedMobileAction(approval);
    const dispatchedId = jobResult?.job?.id || jobResult?.id;
    if (dispatchedId) {
      approval.dispatchedJobId = dispatchedId;
    } else if (jobResult?.error) {
      approval.dispatchError = jobResult.error;
    }
    persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
  }
  // Legacy mobile-pairing approvals retain their historical bridge so existing
  // non-project communication routes remain compatible.  The /mobile/v1/jobs
  // endpoint no longer reaches this branch.
  if (approval.status === "approved" && ["desktop", "mobile_pairing"].includes(approval.source) && dispatchApprovedJob) {
    const seeded = {
      __approvalSource: approval.source,
      envelope: {
        id: approval.envelopeId,
        channel: "unknown",
        conversationId: "control-plane",
        senderId: "approval-bridge",
        text: approval.envelopeText || "",
        receivedAt: new Date().toISOString(),
        raw: { routeKey: approval.routeKey, sourceDeviceId: approval.sourceDeviceId, projectId: approval.projectId, idempotencyKey: approval.idempotencyKey, actionType: approval.actionType },
      },
      idempotencyKey: approval.idempotencyKey,
      actionType: approval.actionType,
      projectId: approval.projectId,
      deviceId: approval.sourceDeviceId,
      __policyDecisionRef: approval.decisionPolicyDecisionRef || approval.policyDecisionRef || null,
    };
    const jobResult = dispatchApprovedJob(seeded);
    const dispatchedId = jobResult?.job?.id || jobResult?.id;
    if (dispatchedId) {
      approval.dispatchedJobId = dispatchedId;
      persistJson(join(cacheDir, "approvals", `${approval.id}.json`), approval);
    }
  }
  return approval;
}

function runAutomationById({ automationId, workspaceRoot, graphPath, cacheDir, runs, policyDecisionRef = null }) {
  const snapshot = buildSnapshot({ workspaceRoot, graphPath, cacheDir });
  const automation = snapshot.governance?.automations.find((item) => item.id === automationId);
  if (!automation) return null;
  if (automation.status !== "enabled") {
    return {
      id: randomUUID(),
      envelope: { id: `automation:${automation.id}:${Date.now()}`, channel: "unknown", conversationId: "control-plane", senderId: "api", text: automation.id, receivedAt: new Date().toISOString() },
      intent: "run_health",
      targetId: automation.targetRef,
      accepted: false,
      blockedReason: `registered automation is ${automation.status}`,
      summary: `已拒绝执行自动化：${automation.id} 未处于 enabled 状态。`,
      actions: [{ commandId: automation.commandId, status: "blocked", summary: `自动化状态为 ${automation.status}。` }],
      metadata: { automationId: automation.id, ...(policyDecisionRef ? { policyDecisionRef } : {}) },
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
  }
  const run = runCommandById({ commandId: automation.commandId, workspaceRoot, graphPath, cacheDir, runs, policyDecisionRef, automationId: automation.id });
  if (!run) return null;
  persistJson(join(cacheDir, "automations", `${safeFileName(automation.id)}.json`), { ...automation, lastRunAt: new Date().toISOString() });
  appendAuditRecord(cacheDir, {
    auditKind: "automation.executed",
    actorRef: "control-plane",
    objectRef: automation.id,
    action: "execute",
    correlationId: run.envelope.id,
    policyDecisionRef: policyDecisionRef || null,
    evidenceRefs: run.actions?.[0]?.evidenceRefs || [],
    result: run.actions?.[0]?.status || "observed",
    status: run.actions?.[0]?.status || "observed",
  });
  return run;
}

function runCommandById({ commandId, workspaceRoot, graphPath, cacheDir, runs, policyDecisionRef = null, automationId = null }) {
  const snapshot = buildSnapshot({ workspaceRoot, graphPath });
  const command = snapshot.resources.flatMap((resource) => resource.commands).concat(snapshot.profiles.flatMap((profile) => profile.commands)).find((item) => item.id === commandId);
  if (!command) return null;
  const result = executeManagedCommand(command);
  const issue = result.status === "failed"
    ? createExecutionIssue({ cacheDir, workspaceRoot, targetRef: command.ownerId || command.id.split(":")[0], riskType: "command_failure", severity: "critical", likelihood: "likely", reason: result.summary, sourceAssessmentRef: null, policyDecisionRef, correlationId: `command:${command.id}` })
    : null;
  const executionEvidence = result.status === "succeeded" ? createExecutionEvidence({ cacheDir, targetRef: command.ownerId || command.id.split(":")[0], status: "succeeded" }) : null;
  result.evidenceRefs = issue?.risk.evidenceRefs || (executionEvidence ? [executionEvidence.id] : []);
  const run = {
    id: randomUUID(),
    envelope: {
      id: `command:${commandId}:${Date.now()}`,
      channel: "unknown",
      conversationId: "control-plane",
      senderId: "api",
      text: command.label,
      receivedAt: new Date().toISOString(),
    },
    intent: command.intent,
    accepted: result.status !== "blocked",
    blockedReason: result.status === "blocked" ? result.summary : undefined,
    summary: result.summary,
    actions: [result],
    metadata: {
      ...(automationId ? { automationId } : {}),
      ...(policyDecisionRef ? { policyDecisionRef } : {}),
      ...(issue ? { riskRef: issue.risk.id, incidentRef: issue.incident.id } : {}),
    },
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  runs.set(run.id, run);
  persistRun(cacheDir, run);
  appendAuditRecord(cacheDir, {
    auditKind: "command.executed",
    actorRef: "control-plane",
    objectRef: command.id,
    action: "execute",
    correlationId: run.envelope.id,
    policyDecisionRef: policyDecisionRef || null,
    result: result.status,
    status: result.status,
  });
  return run;
}

function executeManagedCommand(command, { allowRegisteredRemediation = false } = {}) {
  const blockedReason = blockedReasonFor(command.command);
  const argv = parseRegisteredCommand(command.command);
  const remediationApproved = command.intent === "run_remediation" && allowRegisteredRemediation;
  if ((!command.autoExecutable && !remediationApproved) || !argv || blockedReason) {
    return {
      commandId: command.id,
      status: "blocked",
      summary: blockedReason || "命令不是可自动执行的单一注册程序。",
    };
  }
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd: command.cwd,
    shell: false,
    encoding: "utf8",
    timeout: COMMAND_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  return {
    commandId: command.id,
    status: result.status === 0 ? "succeeded" : "failed",
    summary: result.status === 0 ? "命令退出码 0。" : `命令退出码 ${result.status ?? "signal"}。`,
    stdout: truncate(result.stdout || ""),
    stderr: truncate(result.stderr || result.error?.message || ""),
    exitCode: result.status,
  };
}

const REGISTERED_EXECUTABLES = new Set(["cargo", "node", "npm", "pnpm", "python", "python3", "swift", "test", "uv", "yarn"]);

function parseRegisteredCommand(value) {
  const source = String(value || "").trim();
  if (!source || /[\r\n;&|<>`$]/.test(source)) return null;
  const argv = [];
  let token = "";
  let quote = "";
  let escaped = false;
  const pushToken = () => {
    if (token) argv.push(token);
    token = "";
  };

  for (const character of source) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (quote === "'") {
      if (character === "'") quote = "";
      else token += character;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = "";
      else token += character;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      pushToken();
      continue;
    }
    token += character;
  }
  if (escaped || quote) return null;
  pushToken();
  if (!argv.length) return null;
  const executable = argv[0].split("/").pop();
  if (!REGISTERED_EXECUTABLES.has(executable) || argv[0].includes("=")) return null;
  if (argv.some((argument) => argument.startsWith("="))) return null;
  return argv;
}

function buildCommunicationResponse(run) {
  return {
    id: randomUUID(),
    channel: run.envelope.channel,
    conversationId: run.envelope.conversationId,
    inReplyTo: run.envelope.id,
    text: formatCommunicationReply(run),
    format: run.envelope.channel === "feishu" ? "feishu_markdown" : "markdown",
    language: run.metadata?.language || "zh-CN",
    auditId: run.id,
    createdAt: new Date().toISOString(),
  };
}

function formatCommunicationReply(run) {
  if (run.metadata?.mode === "memory_only") {
    return run.summary;
  }
  const action = run.actions?.[0];
  const detail = action?.status === "failed" && action.stderr ? `\n\nstderr:\n${truncate(action.stderr).slice(0, 1200)}` : "";
  return `**Axi Workstation 控制面**\n\n${run.summary}\n\n审计编号：\`${run.id}\`${detail}`;
}

function isSafeRegisteredCommand(command) {
  return !blockedReasonFor(command) && Boolean(parseRegisteredCommand(command));
}

function blockedReasonFor(text) {
  const value = String(text || "");
  if (!value.trim()) return "空命令不可执行。";
  const matched = BLOCK_PATTERNS.find((pattern) => pattern.test(value));
  return matched ? `命中安全拦截规则：${matched}` : "";
}

function readGitStatus(projectPath) {
  if (!projectPath || !existsSync(projectPath)) return null;
  const inside = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: projectPath, encoding: "utf8", timeout: 5_000 });
  if (inside.status !== 0) return null;
  const branch = spawnSync("git", ["branch", "--show-current"], { cwd: projectPath, encoding: "utf8", timeout: 5_000 });
  const status = spawnSync("git", ["status", "--porcelain"], { cwd: projectPath, encoding: "utf8", timeout: 5_000 });
  const lastCommit = spawnSync("git", ["log", "-1", "--format=%cI"], { cwd: projectPath, encoding: "utf8", timeout: 5_000 });
  const changedEntries = status.stdout ? status.stdout.trim().split(/\r?\n/).filter(Boolean).length : 0;
  return {
    branch: branch.stdout.trim(),
    changedEntries,
    clean: changedEntries === 0,
    lastCommitAt: lastCommit.status === 0 && lastCommit.stdout.trim() ? lastCommit.stdout.trim() : null,
  };
}

function findConsumers(graph, id) {
  return Object.entries(graph.projects || {})
    .filter(([, project]) => (project.consumes || []).includes(id))
    .map(([projectId]) => projectId);
}

function addOptionalResource(resources, resource) {
  if (!resources.some((item) => item.id === resource.id)) {
    resources.push({
      consumes: [],
      contracts: [],
      commands: [],
      metadata: {},
      ...resource,
    });
  }
}

function isMemoryProjectListQuery(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return (
    /项目/.test(value) &&
    /(哪些|列表|清单|有什么|有多少|当前|现在|目前)/.test(value) &&
    !/(目录|文件夹|扫描|查目录|遍历|工作区索引|workspace index|ls|find|rg|tree)/i.test(value)
  );
}

function readMemoryProjects(databaseUrl) {
  const sql = [
    "SELECT project, count(*) AS feature_count, max(last_activity) AS last_activity",
    "FROM cc_project_states",
    "GROUP BY project",
    "ORDER BY max(last_activity) DESC, project ASC;",
  ].join(" ");
  const result = spawnSync("psql", [databaseUrl, "-tA", "-F", "\t", "-c", sql], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 512 * 1024,
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [project, featureCount, lastActivity] = line.split("\t");
      return {
        project,
        featureCount: Number(featureCount || 0),
        lastActivity,
      };
    })
    .filter((item) => item.project);
}

function inspectAgentRuntimes({ codexBin, appServerBin }) {
  return [
    {
      kind: "codex_cli",
      available: commandAvailable(codexBin, ["--version"]),
      command: codexBin,
      summary: "默认受管 AgentTask 运行时。",
    },
    {
      kind: "codex_app",
      available: isCodexAppAvailable(appServerBin),
      command: appServerBin,
      fallbackKind: "codex_cli",
      summary: "Codex App app-server 运行时；不可用时降级到 codex_cli。",
    },
    {
      kind: "axi_agent",
      available: Boolean(process.env.AXI_AGENT_PLATFORM_URL),
      command: process.env.AXI_AGENT_PLATFORM_URL || DEFAULT_AXI_AGENT_PLATFORM_URL,
      summary: "Axi Agent Platform 受限服务运行时；首个合同为 quality_gate。",
    },
  ];
}

function isCodexAppAvailable(appServerBin) {
  return (process.env.AXI_WORKSTATION_ENABLE_CODEX_APP_RUNTIME === "1" || process.env.EPAP_ENABLE_CODEX_APP_RUNTIME === "1") && commandAvailable(appServerBin, ["app-server", "--help"]);
}

function commandAvailable(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5_000, maxBuffer: 128 * 1024 });
  return result.status === 0;
}

async function executeRoleAgentRun({ assignment, run, codexBin, cacheDir, readOnly = false }) {
  if (assignment.role !== "worker" && assignment.role !== "librarian" && assignment.role !== "master" && assignment.role !== "auditor") {
    return { status: "failed", summary: `未知 agent role：${assignment.role}` };
  }
  const runDirectory = join(jobDir(cacheDir, run.jobId), "artifacts", run.id);
  mkdirSync(runDirectory, { recursive: true });
  const stdoutPath = join(runDirectory, "stdout.jsonl");
  const stderrPath = join(runDirectory, "stderr.log");
  const sandbox = assignment.role === "worker" ? "workspace-write" : "read-only";
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "-c",
    'approval_policy="never"',
    "--skip-git-repo-check",
    "--sandbox",
    readOnly ? "read-only" : sandbox,
    "-C",
    run.cwd || process.cwd(),
    assignment.prompt,
  ];

  return new Promise((resolve) => {
    const child = spawn(codexBin, args, {
      cwd: run.cwd || process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, AGENT_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => appendFileSync(stdoutPath, chunk));
    child.stderr.on("data", (chunk) => appendFileSync(stderrPath, chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      appendFileSync(stderrPath, `${error.message}\n`);
      resolve({ status: "failed", summary: `${assignment.role} 启动失败：${error.message}`, stdoutPath, stderrPath });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const ok = code === 0;
      resolve({
        status: ok ? "succeeded" : "failed",
        summary: ok ? `${assignment.role} 运行成功。` : `${assignment.role} 运行失败：${signal || code}。`,
        stdoutPath,
        stderrPath,
      });
    });
  });
}

function makeAgentRun({ job, assignment, workspaceRoot }) {
  return {
    id: randomUUID(),
    jobId: job.id,
    assignmentId: assignment.id,
    role: assignment.role,
    runtime: job.metadata?.requestedRuntime === "codex_app" ? "codex_cli" : (job.metadata?.requestedRuntime || "codex_cli"),
    status: "running",
    cwd: workspaceRoot,
    startedAt: new Date().toISOString(),
  };
}

function transitionJob(cacheDir, job, status, message, data = {}) {
  job.status = status;
  job.currentStage = status;
  job.summary = message;
  job.updatedAt = new Date().toISOString();
  job.nextUpdateAt = new Date(Date.now() + JOB_HEARTBEAT_MS).toISOString();
  persistJob(cacheDir, job);
  appendJobEvent(cacheDir, job, { type: status === "completed" ? "completed" : "status", status, message, data });
}

function createExecutionIssue({ cacheDir, workspaceRoot, targetRef, riskType, severity, likelihood, reason, sourceAssessmentRef = null, policyDecisionRef = null, correlationId }) {
  if (!cacheDir) return null;
  const detectedAt = new Date().toISOString();
  const riskId = `risk:${randomUUID()}`;
  const incidentId = `incident:${randomUUID()}`;
  const owner = resolveGovernanceOwner({ workspaceRoot, targetRef });
  const evidence = createExecutionEvidence({ cacheDir, targetRef, status: "failed", artifactRef: sourceAssessmentRef || null, observedAt: detectedAt });
  const risk = {
    id: riskId,
    targetRef: firstString(targetRef) || "workspace",
    riskType,
    severity,
    likelihood,
    status: "open",
    ownerRef: owner.ownerRef,
    ownerSource: owner.source,
    reason: firstString(reason) || "受控执行失败。",
    sourceAssessmentRef,
    impactSnapshotRef: null,
    ...(policyDecisionRef ? { policyDecisionRef } : {}),
    evidenceRefs: [evidence.id],
    correlationId: firstString(correlationId) || riskId,
    detectedAt,
    dueAt: null,
    resolvedAt: null,
    source: "control-plane.execution",
    incidentRef: incidentId,
  };
  const incident = {
    id: incidentId,
    riskRef: riskId,
    targetRef: risk.targetRef,
    severity,
    status: "open",
    ownerRef: owner.ownerRef,
    ownerSource: owner.source,
    summary: risk.reason,
    evidenceRefs: [evidence.id],
    correlationId: risk.correlationId,
    createdAt: detectedAt,
    resolvedAt: null,
    source: "control-plane.execution",
  };
  persistJson(join(cacheDir, "risks", `${safeFileName(risk.id)}.json`), risk);
  persistJson(join(cacheDir, "incidents", `${safeFileName(incident.id)}.json`), incident);
  appendAuditRecord(cacheDir, {
    auditKind: "risk.created",
    actorRef: "control-plane",
    objectRef: risk.targetRef,
    action: "create",
    correlationId: risk.correlationId,
    policyDecisionRef: policyDecisionRef || null,
    result: risk.status,
    status: risk.status,
    evidenceRefs: risk.evidenceRefs,
  });
  appendAuditRecord(cacheDir, {
    auditKind: "incident.created",
    actorRef: "control-plane",
    objectRef: incident.targetRef,
    action: "create",
    correlationId: incident.correlationId,
    policyDecisionRef: policyDecisionRef || null,
    result: incident.status,
    status: incident.status,
    evidenceRefs: incident.evidenceRefs,
  });
  return { risk, incident };
}

function createExecutionEvidence({ cacheDir, targetRef, status, artifactRef = null, observedAt = new Date().toISOString(), observationKey = "" }) {
  if (!cacheDir) return null;
  const observed = validIsoDate(observedAt) || new Date().toISOString();
  const expiresAt = new Date(new Date(observed).getTime() + GOVERNANCE_EXECUTION_EVIDENCE_TTL_MS).toISOString();
  const evidence = {
    id: `evidence:execution:${randomUUID()}`,
    observationKey: firstString(observationKey, `execution:${targetRef || "workspace"}`),
    source: "control-plane.execution",
    evidenceType: "behavioral",
    observedAt: observed,
    observer: GOVERNANCE_OBSERVER,
    confidence: "high",
    expiresAt,
    freshness: "fresh",
    status,
    subjectRef: firstString(targetRef) || "workspace",
    artifactRef: artifactRef || null,
  };
  persistJson(join(cacheDir, "evidence", `${safeFileName(evidence.id)}.json`), evidence);
  return evidence;
}

function resolveGovernanceOwner({ workspaceRoot, targetRef }) {
  const target = firstString(targetRef);
  if (!target || !workspaceRoot) return { ownerRef: "unknown", source: "unresolved" };
  const registryPath = join(workspaceRoot, "infra", "axi-workspace-governance", "workspace.json");
  const registryEntry = readGovernanceRegistryEntries(readJson(registryPath, null)).find((entry) => entry.id === target);
  const registryOwner = firstString(registryEntry?.ownerRef, registryEntry?.owner);
  if (registryOwner) return { ownerRef: registryOwner, source: "workspace.registry" };
  const graphProject = readJson(join(workspaceRoot, "workspace.graph.json"), null)?.projects?.[target];
  const graphOwner = firstString(graphProject?.ownerRef, graphProject?.owner);
  if (graphOwner) return { ownerRef: graphOwner, source: "workspace.graph" };
  return { ownerRef: "unknown", source: "unresolved" };
}

function transitionGovernanceRisk({ input = {}, cacheDir }) {
  const riskId = firstString(input.id);
  if (!riskId || !cacheDir) return { ok: false, httpStatus: 404, error: "risk not found" };
  const risk = readJson(join(cacheDir, "risks", `${safeFileName(riskId)}.json`), null);
  if (!risk) return { ok: false, httpStatus: 404, error: "risk not found" };
  const current = risk.status;
  const next = firstString(input.status);
  const transitions = {
    open: new Set(["acknowledged", "resolved", "waived"]),
    acknowledged: new Set(["open", "resolved", "waived"]),
    resolved: new Set(),
    waived: new Set(),
  };
  if (current === next) return { ok: true, risk, incident: risk.incidentRef ? readJson(join(cacheDir, "incidents", `${safeFileName(risk.incidentRef)}.json`), null) : null };
  if (!transitions[current]?.has(next)) return { ok: false, httpStatus: 409, error: `risk transition not allowed: ${current} -> ${next}` };
  const reason = firstString(input.reason);
  if (["resolved", "waived"].includes(next) && !reason) return { ok: false, httpStatus: 422, error: "reason is required when resolving or waiving a risk" };
  const now = new Date().toISOString();
  risk.status = next;
  risk.updatedAt = now;
  if (reason) risk.statusReason = reason;
  risk.resolvedAt = ["resolved", "waived"].includes(next) ? now : null;
  persistJson(join(cacheDir, "risks", `${safeFileName(risk.id)}.json`), risk);

  const incident = risk.incidentRef
    ? readJson(join(cacheDir, "incidents", `${safeFileName(risk.incidentRef)}.json`), null)
    : null;
  if (incident) {
    incident.status = next === "open" ? "open" : next === "acknowledged" ? "acknowledged" : "resolved";
    incident.updatedAt = now;
    if (reason) incident.statusReason = reason;
    incident.resolvedAt = ["resolved", "waived"].includes(next) ? now : null;
    persistJson(join(cacheDir, "incidents", `${safeFileName(incident.id)}.json`), incident);
  }
  const actorRef = firstString(input.actorRef) || "unknown";
  const policyDecisionRef = firstString(input.policyDecisionRef) || null;
  const correlationId = firstString(input.correlationId, risk.correlationId, risk.id) || risk.id;
  appendAuditRecord(cacheDir, {
    auditKind: "risk.transitioned",
    actorRef,
    objectRef: risk.targetRef,
    action: "manage",
    correlationId,
    policyDecisionRef,
    beforeRef: `risk:${current}`,
    afterRef: `risk:${next}`,
    result: next,
    status: next,
  });
  if (incident) appendAuditRecord(cacheDir, {
    auditKind: "incident.transitioned",
    actorRef,
    objectRef: incident.targetRef,
    action: "manage",
    correlationId,
    policyDecisionRef,
    beforeRef: `incident:${current}`,
    afterRef: `incident:${incident.status}`,
    result: incident.status,
    status: incident.status,
  });
  return { ok: true, risk, incident };
}

function failJob(cacheDir, job, message) {
  const issue = job.metadata?.riskRef
    ? null
    : createExecutionIssue({
        cacheDir,
        workspaceRoot: job.metadata?.workspaceRoot || "",
        targetRef: firstString(job.metadata?.targetRef, job.metadata?.projectId, job.envelope?.raw?.projectId, job.id) || job.id,
        riskType: "execution_failure",
        severity: ["high", "destructive"].includes(job.assessment?.risk) ? "critical" : "warning",
        likelihood: "likely",
        reason: message,
        sourceAssessmentRef: job.id,
        policyDecisionRef: job.metadata?.policyDecisionRef || null,
        correlationId: firstString(job.envelope?.id, job.id) || job.id,
      });
  if (issue) job.metadata = { ...(job.metadata || {}), riskRef: issue.risk.id, incidentRef: issue.incident.id, evidenceRefs: issue.risk.evidenceRefs };
  job.status = "failed";
  job.currentStage = "failed";
  job.summary = message;
  job.updatedAt = new Date().toISOString();
  job.completedAt = new Date().toISOString();
  persistJob(cacheDir, job);
  appendJobEvent(cacheDir, job, { type: "failed", status: "failed", message, data: issue ? { riskRef: issue.risk.id, incidentRef: issue.incident.id } : {} });
  return job;
}

function cancelControlJob({ cacheDir, jobs, id, policyDecisionRef = null }) {
  const job = jobs.get(id) || readJson(join(cacheDir, "jobs", id, "job.json"), null);
  if (!job) return null;
  if (["completed", "failed", "cancelled", "policy_violation"].includes(job.status)) return job;
  job.status = "cancelled";
  job.currentStage = "cancelled";
  job.summary = "任务已取消。";
  job.updatedAt = new Date().toISOString();
  job.completedAt = new Date().toISOString();
  if (policyDecisionRef) {
    job.metadata = { ...(job.metadata || {}), lastPolicyDecisionRef: policyDecisionRef };
  }
  jobs.set(id, job);
  persistJob(cacheDir, job);
  appendJobEvent(cacheDir, job, { type: "cancelled", status: "cancelled", message: "任务已取消。", data: { policyDecisionRef } });
  appendAuditRecord(cacheDir, {
    auditKind: "job.cancelled",
    actorRef: "control-plane",
    objectRef: job.id,
    action: "cancel",
    correlationId: firstString(job.envelope?.id, job.id) || job.id,
    policyDecisionRef: policyDecisionRef || null,
    result: job.status,
    status: job.status,
  });
  return job;
}

function jobDir(cacheDir, id) {
  return join(cacheDir, "jobs", id);
}

function persistJob(cacheDir, job) {
  persistJson(join(jobDir(cacheDir, job.id), "job.json"), job);
}

function persistWorkflowPlan(cacheDir, plan) {
  persistJson(join(jobDir(cacheDir, plan.jobId), "plan.json"), plan);
  for (const assignment of plan.assignments) persistAssignment(cacheDir, plan.jobId, assignment);
}

function persistAssignment(cacheDir, jobId, assignment) {
  persistJson(join(jobDir(cacheDir, jobId), "assignments", `${safeFileName(assignment.id)}.json`), assignment);
}

function persistAgentRun(cacheDir, run) {
  persistJson(join(jobDir(cacheDir, run.jobId), "agent-runs", `${run.id}.json`), run);
}

function appendJobEvent(cacheDir, job, event) {
  const payload = {
    id: event.id || randomUUID(),
    jobId: job.id,
    type: event.type,
    status: event.status,
    role: event.role,
    message: event.message,
    data: event.data || {},
    createdAt: new Date().toISOString(),
  };
  const eventsPath = join(jobDir(cacheDir, job.id), "events.jsonl");
  mkdirSync(dirname(eventsPath), { recursive: true });
  appendFileSync(eventsPath, `${JSON.stringify(payload)}\n`);
  appendAuditRecord(cacheDir, { ...payload, auditKind: "job_event" });
  return payload;
}

function readJobEvents({ cacheDir, id, afterEventId }) {
  const eventsPath = join(jobDir(cacheDir, id), "events.jsonl");
  if (!existsSync(eventsPath)) return { events: [] };
  const events = readFileSync(eventsPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (!afterEventId) return { events };
  const index = events.findIndex((event) => event.id === afterEventId);
  return { events: index >= 0 ? events.slice(index + 1) : events };
}

function latestJobEvent({ cacheDir, id }) {
  const events = readJobEvents({ cacheDir, id }).events;
  return events[events.length - 1] || null;
}

function listJobArtifacts({ cacheDir, id }) {
  const base = jobDir(cacheDir, id);
  if (!existsSync(base)) return { artifacts: [] };
  const artifacts = [];
  collectFiles(base, artifacts);
  return { artifacts: artifacts.map((path) => ({ path })) };
}

function collectFiles(directory, out) {
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, name.name);
    if (name.isDirectory()) collectFiles(child, out);
    else out.push(child);
  }
}

function mirrorJobSummaryBestEffort({ cacheDir, job, memoryDatabaseUrl }) {
  try {
    const mirrorPath = join(cacheDir, "memory-mirror", "job-summaries.jsonl");
    mkdirSync(dirname(mirrorPath), { recursive: true });
    appendFileSync(mirrorPath, `${JSON.stringify({ id: job.id, status: job.status, summary: job.summary, archive: job.archive?.summary, updatedAt: job.updatedAt })}\n`);
  } catch {
    // Best-effort mirror must never affect the control-plane authority files.
  }
  try {
    mirrorJobSummaryToPostgres({ databaseUrl: memoryDatabaseUrl, job });
  } catch {
    // PostgreSQL is a best-effort memory mirror; local job artifacts remain authoritative.
  }
}

function mirrorJobSummaryToPostgres({ databaseUrl, job }) {
  if (!databaseUrl) return;
  const summary = {
    id: job.id,
    status: job.status,
    kind: job.assessment?.kind,
    complexity: job.assessment?.complexity,
    risk: job.assessment?.risk,
    summary: job.summary,
    archive: job.archive?.summary,
    updatedAt: job.updatedAt,
  };
  const sql = [
    "CREATE TABLE IF NOT EXISTS epap_control_job_summaries (",
    "id text PRIMARY KEY,",
    "status text NOT NULL,",
    "kind text,",
    "complexity text,",
    "risk text,",
    "summary text,",
    "archive_summary text,",
    "updated_at timestamptz,",
    "payload jsonb NOT NULL",
    ");",
    "INSERT INTO epap_control_job_summaries (id, status, kind, complexity, risk, summary, archive_summary, updated_at, payload)",
    `VALUES (${sqlQuote(summary.id)}, ${sqlQuote(summary.status)}, ${sqlQuote(summary.kind)}, ${sqlQuote(summary.complexity)}, ${sqlQuote(summary.risk)}, ${sqlQuote(summary.summary)}, ${sqlQuote(summary.archive)}, ${sqlQuote(summary.updatedAt)}, ${sqlQuote(JSON.stringify(summary))}::jsonb)`,
    "ON CONFLICT (id) DO UPDATE SET",
    "status = EXCLUDED.status,",
    "kind = EXCLUDED.kind,",
    "complexity = EXCLUDED.complexity,",
    "risk = EXCLUDED.risk,",
    "summary = EXCLUDED.summary,",
    "archive_summary = EXCLUDED.archive_summary,",
    "updated_at = EXCLUDED.updated_at,",
    "payload = EXCLUDED.payload;",
  ].join(" ");
  spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 256 * 1024,
  });
}

function sqlQuote(value) {
  if (value === undefined || value === null || value === "") return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function safeFileName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function firstString(...values) {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

function normalizeHandoffExpiryMs(value) {
  const numeric = typeof value === "string" && /^\d+$/u.test(value.trim()) ? Number(value.trim()) : value;
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : HANDOFF_TTL_MS;
}

function formatDateTime(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function persistRun(cacheDir, run) {
  mkdirSync(cacheDir, { recursive: true });
  const runPath = join(cacheDir, "runs", `${run.id}.json`);
  mkdirSync(dirname(runPath), { recursive: true });
  writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
  appendAuditRecord(cacheDir, run);
}

function persistAgentTask(cacheDir, task) {
  persistJson(join(cacheDir, "agent-tasks", `${task.id}.json`), task);
}

function persistJson(filePath, payload) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function persistImmutableJson(filePath, payload) {
  mkdirSync(dirname(filePath), { recursive: true });
  try {
    writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
}

function readRun(cacheDir, id) {
  const runPath = join(cacheDir, "runs", `${id}.json`);
  if (!existsSync(runPath)) return null;
  return readJson(runPath, null);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function loadPersistedRecordMap(directory) {
  if (!existsSync(directory)) return new Map();
  const records = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => readJson(join(directory, entry.name), null))
    .filter((record) => record && typeof record.id === "string" && record.id);
  return new Map(records.map((record) => [record.id, record]));
}

function titleFromId(id) {
  return id.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function layerRank(layer) {
  return ["im", "communication", "software", "base_service", "physical_service", "external_capability"].indexOf(layer);
}

function truncate(text) {
  const value = String(text || "");
  return value.length > TEXT_LIMIT ? `${value.slice(0, TEXT_LIMIT)}\n[truncated ${value.length - TEXT_LIMIT} chars]` : value;
}
