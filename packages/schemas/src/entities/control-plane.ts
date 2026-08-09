import { z } from "zod"

export const LayerKindEnum = z.enum([
  "im",
  "communication",
  "software",
  "base_service",
  "physical_service",
  "external_capability",
])

export const ControlIntentEnum = z.enum([
  "status_query",
  "run_health",
  "run_verify",
  "start_workflow",
  "start_agent_task",
  "list_resources",
  "explain_dependency",
  "blocked_action",
])

export const IMEnvelopeSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(["feishu", "wecom", "wechat", "mosscoder", "cc-connect", "unknown"]),
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  text: z.string().min(1),
  receivedAt: z.coerce.date(),
  raw: z.record(z.string(), z.unknown()).optional(),
})

export const AgentRuntimeKindEnum = z.enum(["codex_cli", "codex_app", "registered_command", "axi_agent"])

export const TaskKindEnum = z.enum(["chat", "coworker", "code", "ops", "docs"])
export const TaskComplexityEnum = z.enum(["small", "medium", "large"])
export const TaskRiskEnum = z.enum(["low", "medium", "high", "destructive"])
export const ControlJobStatusEnum = z.enum([
  "received",
  "assessed",
  "queued",
  "planning",
  "documenting",
  "executing",
  "worker_self_audit",
  "master_collecting",
  "auditing",
  "rejected_rework",
  "passed",
  "archiving",
  "notified",
  "completed",
  "failed",
  "cancelled",
  "policy_violation",
])
export const AgentRoleEnum = z.enum(["master", "worker", "auditor", "librarian"])

export const AgentRuntimeSchema = z.object({
  kind: AgentRuntimeKindEnum,
  available: z.boolean().default(false),
  command: z.string().optional(),
  fallbackKind: AgentRuntimeKindEnum.optional(),
  summary: z.string().optional(),
})

export const RouteBindingSchema = z.object({
  id: z.string().min(1),
  routeKey: z.string().min(1),
  channel: IMEnvelopeSchema.shape.channel,
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  trusted: z.boolean().default(false),
  profile: z.enum(["intelligence", "workbench", "wechat_private"]).default("intelligence"),
  runtimePreference: AgentRuntimeKindEnum.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const PairingChallengeSchema = z.object({
  id: z.string().min(1),
  routeKey: z.string().min(1),
  channel: IMEnvelopeSchema.shape.channel,
  conversationId: z.string().min(1),
  senderId: z.string().min(1),
  code: z.string().min(4),
  status: z.enum(["pending", "confirmed", "expired", "cancelled"]),
  expiresAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  confirmedAt: z.coerce.date().optional(),
})

export const AttachmentRefSchema = z.object({
  id: z.string().min(1),
  routeKey: z.string().optional(),
  channel: IMEnvelopeSchema.shape.channel,
  filename: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  storagePath: z.string().min(1),
  createdAt: z.coerce.date(),
})

export const ApprovalRequestSchema = z.object({
  id: z.string().min(1),
  routeKey: z.string().min(1),
  runId: z.string().optional(),
  taskId: z.string().optional(),
  actionSummary: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "destructive"]),
  status: z.enum(["pending", "approved", "rejected", "expired"]),
  decisionText: z.string().optional(),
  source: z.enum(["desktop", "mobile_pairing"]).default("desktop"),
  sourceDeviceId: z.string().optional(),
  projectId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  actionType: z.string().optional(),
  createdAt: z.coerce.date(),
  decidedAt: z.coerce.date().optional(),
})

// Mobile approval scans intentionally carry only an opaque scan id.  The
// preview below is returned after the Control Plane has reloaded the object,
// checked the paired device, and evaluated current policy.  It is shared so
// Web handoff and Mobile never disagree on the cross-surface contract.
export const ApprovalScanObjectSchema = z.object({
  type: z.literal("approval"),
  id: z.string().min(1),
  projectId: z.string().min(1).nullable(),
  actionId: z.string().min(1).nullable(),
  actionType: z.string().min(1).nullable(),
})

export const ApprovalScanPreviewSchema = z.object({
  ok: z.literal(true),
  scanId: z.string().min(1),
  approvalId: z.string().min(1),
  object: ApprovalScanObjectSchema,
  impact: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "destructive"]),
  currentStatus: z.literal("pending"),
  availableDecisions: z.array(z.enum(["approved", "rejected", "handoff"])).min(1),
  expiresAt: z.coerce.date(),
  handoffCorrelationId: z.string().min(1),
})

// The client is deliberately unable to provide a project, action, approval,
// or object id.  The server derives each one from the scan record.
export const MobileApprovalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "handoff"]),
  idempotencyKey: z.string().min(8).max(200),
  handoffCorrelationId: z.string().min(1).max(200),
}).strict()

export const HandoffContextSchema = z.object({
  id: z.string().min(1),
  handoffCorrelationId: z.string().min(1),
  sourceSurface: z.enum(["mobile", "web"]),
  targetSurface: z.enum(["mobile", "web", "specialist"]),
  status: z.enum(["pending", "opened", "completed", "rejected"]),
  approvalId: z.string().min(1).nullable(),
  object: ApprovalScanObjectSchema,
  impact: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "destructive"]),
  createdAt: z.coerce.date(),
  openedAt: z.coerce.date().optional(),
  openedBy: z.string().min(1).optional(),
  completedAt: z.coerce.date().optional(),
  finalAction: z.object({
    outcome: z.string().min(1),
    performedBy: z.string().min(1),
    occurredAt: z.coerce.date(),
  }).optional(),
})

export type ApprovalScanPreview = z.infer<typeof ApprovalScanPreviewSchema>
export type MobileApprovalDecision = z.infer<typeof MobileApprovalDecisionSchema>
export type HandoffContext = z.infer<typeof HandoffContextSchema>

export const AgentTaskSchema = z.object({
  id: z.string().min(1),
  routeKey: z.string().optional(),
  runtime: AgentRuntimeKindEnum,
  requestedRuntime: AgentRuntimeKindEnum.optional(),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "awaiting_approval"]),
  prompt: z.string().min(1),
  targetId: z.string().optional(),
  cwd: z.string().optional(),
  summary: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  approvalId: z.string().optional(),
  createdAt: z.coerce.date(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
})

export const TaskAssessmentSchema = z.object({
  kind: TaskKindEnum,
  complexity: TaskComplexityEnum,
  estimatedDuration: z.enum(["sync", "minutes", "long_running"]),
  requiresOrchestration: z.boolean(),
  requiresAudit: z.boolean(),
  requiresApproval: z.boolean().default(false),
  requiresLibrarian: z.boolean(),
  risk: TaskRiskEnum,
  summary: z.string(),
  nextUpdateSeconds: z.number().int().positive().default(30),
})

export const AgentAssignmentSchema = z.object({
  id: z.string().min(1),
  role: AgentRoleEnum,
  title: z.string().min(1),
  prompt: z.string().min(1),
  writeScope: z.array(z.string()).default([]),
  status: z.enum(["queued", "running", "succeeded", "failed", "skipped", "rejected"]).default("queued"),
  createdAt: z.coerce.date(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
})

export const WorkflowPlanSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  summary: z.string(),
  assignments: z.array(AgentAssignmentSchema),
  createdAt: z.coerce.date(),
})

export const AgentRunSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  assignmentId: z.string().min(1),
  role: AgentRoleEnum,
  runtime: AgentRuntimeKindEnum,
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled", "policy_violation"]),
  cwd: z.string().optional(),
  stdoutPath: z.string().optional(),
  stderrPath: z.string().optional(),
  summary: z.string().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
})

export const TaskEventSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  type: z.enum(["received", "assessment", "status", "assignment", "agent_run", "heartbeat", "audit", "archive", "checkpoint", "completed", "failed", "cancelled"]),
  status: ControlJobStatusEnum.optional(),
  role: AgentRoleEnum.optional(),
  message: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
})

export const AuditReportSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  verdict: z.enum(["pass", "reject", "policy_violation"]),
  summary: z.string(),
  findings: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
})

export const LibrarianArchiveSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  summary: z.string(),
  artifacts: z.array(z.string()).default([]),
  memoryUpdates: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
})

export const ControlJobSchema = z.object({
  id: z.string().min(1),
  envelope: IMEnvelopeSchema,
  routeKey: z.string().optional(),
  status: ControlJobStatusEnum,
  assessment: TaskAssessmentSchema,
  plan: WorkflowPlanSchema.optional(),
  auditReport: AuditReportSchema.optional(),
  archive: LibrarianArchiveSchema.optional(),
  currentStage: z.string().min(1),
  summary: z.string(),
  nextUpdateAt: z.coerce.date(),
  workflowRuntime: z.object({
    framework: z.enum(["langgraph"]),
    threadId: z.string().min(1),
    checkpoint: z.string().min(1).optional(),
  }).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const ManagedCommandSchema = z.object({
  id: z.string().min(1),
  intent: ControlIntentEnum,
  label: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().min(1),
  autoExecutable: z.boolean(),
})

export const ManagedResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  layer: LayerKindEnum,
  kind: z.string().min(1),
  path: z.string().optional(),
  status: z.string().optional(),
  provides: z.array(z.string()).default([]),
  consumes: z.array(z.string()).default([]),
  contracts: z.array(z.string()).default([]),
  commands: z.array(ManagedCommandSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const AxiResourceCategoryEnum = z.enum([
  "project",
  "service",
  "server",
  "credential_ref",
  "provider",
  "doc_source",
  "agent_artifact",
])

export const AxiResourceViewSchema = z.object({
  id: z.string().min(1),
  category: AxiResourceCategoryEnum,
  name: z.string().min(1),
  label: z.string().min(1),
  ownerId: z.string().min(1),
  resourceId: z.string().optional(),
  layer: LayerKindEnum.optional(),
  kind: z.string().min(1),
  path: z.string().optional(),
  status: z.string().optional(),
  source: z.string().min(1),
  ref: z.string().optional(),
  summary: z.string().optional(),
  provides: z.array(z.string()).default([]),
  consumes: z.array(z.string()).default([]),
  contracts: z.array(z.string()).default([]),
  commands: z.array(ManagedCommandSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const AxiResourceSnapshotSchema = z.object({
  generatedAt: z.coerce.date(),
  project: z.array(AxiResourceViewSchema).default([]),
  service: z.array(AxiResourceViewSchema).default([]),
  server: z.array(AxiResourceViewSchema).default([]),
  credential_ref: z.array(AxiResourceViewSchema).default([]),
  provider: z.array(AxiResourceViewSchema).default([]),
  doc_source: z.array(AxiResourceViewSchema).default([]),
  agent_artifact: z.array(AxiResourceViewSchema).default([]),
})

export const ControlActionResultSchema = z.object({
  commandId: z.string().optional(),
  status: z.enum(["skipped", "blocked", "running", "succeeded", "failed"]),
  summary: z.string(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  exitCode: z.number().int().nullable().optional(),
})

export const ControlRunSchema = z.object({
  id: z.string().min(1),
  envelope: IMEnvelopeSchema,
  intent: ControlIntentEnum,
  targetId: z.string().optional(),
  accepted: z.boolean(),
  blockedReason: z.string().optional(),
  summary: z.string(),
  actions: z.array(ControlActionResultSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
  completedAt: z.coerce.date().optional(),
})

export const CommunicationResponseEnvelopeSchema = z.object({
  id: z.string().min(1),
  channel: IMEnvelopeSchema.shape.channel,
  conversationId: z.string().min(1),
  inReplyTo: z.string().min(1),
  text: z.string().min(1),
  format: z.enum(["markdown", "feishu_markdown", "card"]),
  language: z.string().min(1).default("zh-CN"),
  auditId: z.string().min(1),
  createdAt: z.coerce.date(),
})

export const CommunicationMessageResultSchema = z.object({
  ignored: z.boolean(),
  direction: z.string().optional(),
  summary: z.string().optional(),
  accepted: z.boolean().optional(),
  job: ControlJobSchema.optional(),
  latestEvent: TaskEventSchema.optional(),
  run: ControlRunSchema.optional(),
  response: CommunicationResponseEnvelopeSchema.optional(),
})

export const ControlSnapshotSchema = z.object({
  generatedAt: z.coerce.date(),
  resources: z.array(ManagedResourceSchema),
  routes: z.array(RouteBindingSchema).default([]),
  approvals: z.array(ApprovalRequestSchema).default([]),
  agentTasks: z.array(AgentTaskSchema).default([]),
  runtimes: z.array(AgentRuntimeSchema).default([]),
  axiResources: AxiResourceSnapshotSchema.optional(),
  profiles: z.array(z.object({
    id: z.string().min(1),
    description: z.string().optional(),
    projects: z.array(z.string()).default([]),
    commands: z.array(ManagedCommandSchema).default([]),
  })),
})

export type LayerKind = z.infer<typeof LayerKindEnum>
export type ControlIntent = z.infer<typeof ControlIntentEnum>
export type IMEnvelope = z.infer<typeof IMEnvelopeSchema>
export type AgentRuntimeKind = z.infer<typeof AgentRuntimeKindEnum>
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>
export type RouteBinding = z.infer<typeof RouteBindingSchema>
export type PairingChallenge = z.infer<typeof PairingChallengeSchema>
export type AttachmentRef = z.infer<typeof AttachmentRefSchema>
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>
export type AgentTask = z.infer<typeof AgentTaskSchema>
export type TaskKind = z.infer<typeof TaskKindEnum>
export type TaskAssessment = z.infer<typeof TaskAssessmentSchema>
export type ControlJobStatus = z.infer<typeof ControlJobStatusEnum>
export type AgentRole = z.infer<typeof AgentRoleEnum>
export type AgentAssignment = z.infer<typeof AgentAssignmentSchema>
export type WorkflowPlan = z.infer<typeof WorkflowPlanSchema>
export type AgentRun = z.infer<typeof AgentRunSchema>
export type TaskEvent = z.infer<typeof TaskEventSchema>
export type AuditReport = z.infer<typeof AuditReportSchema>
export type LibrarianArchive = z.infer<typeof LibrarianArchiveSchema>
export type ControlJob = z.infer<typeof ControlJobSchema>
export type ManagedCommand = z.infer<typeof ManagedCommandSchema>
export type ManagedResource = z.infer<typeof ManagedResourceSchema>
export type AxiResourceCategory = z.infer<typeof AxiResourceCategoryEnum>
export type AxiResourceView = z.infer<typeof AxiResourceViewSchema>
export type AxiResourceSnapshot = z.infer<typeof AxiResourceSnapshotSchema>
export type ControlActionResult = z.infer<typeof ControlActionResultSchema>
export type ControlRun = z.infer<typeof ControlRunSchema>
export type ControlSnapshot = z.infer<typeof ControlSnapshotSchema>
export type CommunicationResponseEnvelope = z.infer<typeof CommunicationResponseEnvelopeSchema>
export type CommunicationMessageResult = z.infer<typeof CommunicationMessageResultSchema>
