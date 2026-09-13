import { z } from "zod"

export const LayerKindEnum = z.enum([
  "im",
  "communication",
  "software",
  "base_service",
  "physical_service",
  "external_capability",
])

export const GovernanceEvidenceTypeEnum = z.enum([
  "declaration",
  "structural",
  "process",
  "endpoint",
  "behavioral",
  "deployment",
  "production",
  "unknown",
])

export const GovernanceEvidenceFreshnessEnum = z.enum(["fresh", "stale", "unknown", "not_configured"])
export const GovernanceEvidenceConfidenceEnum = z.enum(["low", "medium", "high"])
export const GovernanceHealthStatusEnum = z.enum(["healthy", "warning", "critical", "unknown"])
export const GovernanceDocumentStatusEnum = z.enum(["present", "missing", "stale", "conflict", "unknown"])
export const GovernanceDocumentRequirementEnum = z.enum(["required", "default", "optional", "forbidden"])
export const GovernanceRuleStatusEnum = z.enum(["declared", "present", "missing", "unknown"])

export const GovernanceEvidenceSchema = z.object({
  id: z.string().min(1),
  observationKey: z.string().min(1),
  source: z.string().min(1),
  evidenceType: GovernanceEvidenceTypeEnum,
  observedAt: z.coerce.date(),
  observer: z.string().min(1),
  confidence: GovernanceEvidenceConfidenceEnum,
  expiresAt: z.coerce.date().nullable(),
  freshness: GovernanceEvidenceFreshnessEnum,
  status: z.string().min(1),
  subjectRef: z.string().min(1),
  artifactRef: z.string().min(1).nullable(),
}).strict()

export const GovernanceRelationshipTypeEnum = z.enum([
  "OWNS",
  "CONTAINS",
  "PROVIDES_CAPABILITY",
  "CONSUMES_CAPABILITY",
  "DEPENDS_ON",
  "IMPLEMENTS_CONTRACT",
  "USES_RESOURCE",
  "DEPLOYED_TO",
  "GOVERNED_BY",
  "INHERITS_FROM",
  "OVERRIDES",
  "VERIFIED_BY",
  "ACTED_BY",
  "AFFECTS",
  "EVIDENCED_BY",
  "SUPERSEDES",
  "ARCHIVES",
])

export const GovernanceRelationshipSchema = z.object({
  sourceRef: z.string().min(1),
  targetRef: z.string().min(1),
  relationshipType: GovernanceRelationshipTypeEnum,
  scope: z.string().min(1).optional(),
  requiredness: z.enum(["required", "default", "optional", "forbidden"]).optional(),
  dependencyPhase: z.string().min(1).optional(),
  environment: z.string().min(1).optional(),
  versionConstraint: z.string().min(1).optional(),
  validFrom: z.coerce.date().nullable().optional(),
  validTo: z.coerce.date().nullable().optional(),
  provenance: z.string().min(1),
  confidence: GovernanceEvidenceConfidenceEnum,
}).strict()

export const GovernanceIdentityStatusEnum = z.enum(["aligned", "partial", "conflict"])

export const GovernanceHealthSchema = z.object({
  status: GovernanceHealthStatusEnum,
  reason: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  affectedObjectRefs: z.array(z.string()).default([]),
  ownerRef: z.string().min(1),
  recommendedAction: z.string().min(1),
}).strict()

export const GovernanceRiskSeverityEnum = z.enum(["warning", "critical"])
export const GovernanceRiskLikelihoodEnum = z.enum(["possible", "likely", "certain"])
export const GovernanceRiskStatusEnum = z.enum(["open", "acknowledged", "resolved", "waived"])
export const GovernanceRiskSchema = z.object({
  id: z.string().min(1),
  targetRef: z.string().min(1),
  riskType: z.string().min(1),
  severity: GovernanceRiskSeverityEnum,
  likelihood: GovernanceRiskLikelihoodEnum,
  status: GovernanceRiskStatusEnum,
  ownerRef: z.string().min(1),
  ownerSource: z.string().min(1).optional(),
  reason: z.string().min(1),
  statusReason: z.string().min(1).optional(),
  sourceAssessmentRef: z.string().min(1).nullable(),
  impactSnapshotRef: z.string().min(1).nullable().optional(),
  policyDecisionRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  correlationId: z.string().min(1),
  detectedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  dueAt: z.coerce.date().nullable(),
  resolvedAt: z.coerce.date().nullable(),
  source: z.string().min(1),
  incidentRef: z.string().min(1),
}).strict()

export const GovernanceIncidentStatusEnum = z.enum(["open", "acknowledged", "resolved"])
export const GovernanceIncidentSchema = z.object({
  id: z.string().min(1),
  riskRef: z.string().min(1),
  targetRef: z.string().min(1),
  severity: GovernanceRiskSeverityEnum,
  status: GovernanceIncidentStatusEnum,
  ownerRef: z.string().min(1),
  ownerSource: z.string().min(1).optional(),
  summary: z.string().min(1),
  statusReason: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  correlationId: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  resolvedAt: z.coerce.date().nullable(),
  source: z.string().min(1),
}).strict()

export const GovernanceViolationStatusEnum = z.enum(["open", "acknowledged", "resolved", "waived"])
export const GovernanceViolationSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.string().min(1),
  violationType: z.string().min(1),
  severity: GovernanceRiskSeverityEnum,
  status: GovernanceViolationStatusEnum,
  ownerRef: z.string().min(1),
  reason: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
  eventRefs: z.array(z.string()).default([]),
  source: z.string().min(1),
  detectedAt: z.coerce.date(),
  statusReason: z.string().min(1).optional(),
  waiverRef: z.string().min(1).optional(),
}).strict()

export const GovernanceWaiverSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.string().min(1),
  sourceRiskRef: z.string().min(1),
  ownerRef: z.string().min(1),
  reason: z.string().min(1),
  status: z.enum(["active", "expired", "revoked"]),
  evidenceRefs: z.array(z.string()).default([]),
  eventRefs: z.array(z.string()).default([]),
  issuedAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable().optional(),
  source: z.string().min(1),
}).strict()

export const GovernanceRiskTransitionRequestSchema = z.object({
  status: GovernanceRiskStatusEnum,
  reason: z.string().min(1).max(2000).optional(),
  correlationId: z.string().min(1).max(200).optional(),
}).strict()

export const GovernanceUnitSchema = z.object({
  id: z.string().min(1),
  objectType: z.string().min(1),
  name: z.string().min(1),
  scope: z.literal("workspace"),
  ownerRef: z.string().min(1),
  ownerEvidenceRef: z.string().min(1).optional(),
  ownerStatus: z.enum(["resolved", "unknown", "external"]),
  lifecycle: z.string().min(1),
  status: z.string().min(1),
  identityStatus: GovernanceIdentityStatusEnum,
  freshness: GovernanceEvidenceFreshnessEnum,
  health: GovernanceHealthSchema,
  sourceOfTruth: z.string().min(1),
  path: z.string().optional(),
  kind: z.string().min(1).optional(),
  declarations: z.object({
    graph: z.string().min(1).optional(),
    registry: z.string().min(1).optional(),
  }).strict(),
  relationships: z.array(GovernanceRelationshipSchema).default([]),
  policyBindings: z.array(z.string()).default([]),
  evidenceRefs: z.array(z.string()).default([]),
  documentRefs: z.array(z.string()).default([]),
}).strict()

export const GovernanceConflictSchema = z.object({
  subjectRef: z.string().min(1),
  field: z.string().min(1),
  values: z.array(z.object({
    source: z.string().min(1),
    value: z.unknown(),
  }).strict()).min(2),
}).strict()

export const GovernanceImpactSchema = z.object({
  subjectRef: z.string().min(1),
  directUpstreamRefs: z.array(z.string()).default([]),
  directDownstreamRefs: z.array(z.string()).default([]),
  transitiveUpstreamRefs: z.array(z.string()).default([]),
  transitiveDownstreamRefs: z.array(z.string()).default([]),
}).strict()

export const GovernanceCoverageSchema = z.object({
  unitCount: z.number().int().nonnegative(),
  ownerResolvedCount: z.number().int().nonnegative(),
  ownerUnknownCount: z.number().int().nonnegative(),
  ownerExternalCount: z.number().int().nonnegative(),
  identityAlignedCount: z.number().int().nonnegative(),
  identityPartialCount: z.number().int().nonnegative(),
  identityConflictCount: z.number().int().nonnegative(),
}).strict()

export const GovernanceExecutionCoverageSchema = z.object({
  declaredProjectCount: z.number().int().nonnegative(),
  healthDeclaredCount: z.number().int().nonnegative(),
  verifyDeclaredCount: z.number().int().nonnegative(),
  remediationDeclaredCount: z.number().int().nonnegative(),
}).strict()

export const GovernanceRelationshipMetadataCoverageSchema = z.object({
  dependencyEdgeCount: z.number().int().nonnegative(),
  scopeDeclaredCount: z.number().int().nonnegative(),
  requirednessDeclaredCount: z.number().int().nonnegative(),
  dependencyPhaseDeclaredCount: z.number().int().nonnegative(),
  environmentDeclaredCount: z.number().int().nonnegative(),
  versionConstraintDeclaredCount: z.number().int().nonnegative(),
  validityWindowDeclaredCount: z.number().int().nonnegative(),
}).strict()

export const GovernanceRelationshipMetadataGapSchema = z.object({
  sourceRef: z.string().min(1),
  targetRef: z.string().min(1),
  relationshipType: z.literal("DEPENDS_ON"),
  missing: z.array(z.enum(["requiredness", "dependencyPhase", "environment", "versionConstraint", "validityWindow"])).min(1),
  provenance: z.string().min(1),
}).strict()

export const GovernanceEventCoverageSchema = z.object({
  declaredSourceCount: z.number().int().nonnegative(),
  loadedSourceCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  surfaceCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  serviceCount: z.number().int().nonnegative(),
}).strict()

export const GovernanceDocumentSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.string().min(1),
  ownerRef: z.string().min(1),
  entrypoint: z.string().min(1),
  path: z.string().nullable(),
  required: z.boolean(),
  requirement: GovernanceDocumentRequirementEnum,
  requirementSource: z.string().min(1),
  freshnessIntervalSeconds: z.number().int().positive().optional(),
  status: GovernanceDocumentStatusEnum,
  source: z.string().min(1),
  evidenceRef: z.string().min(1),
}).strict()

export const GovernanceRuleSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.literal("workspace"),
  statement: z.string().min(1),
  scope: z.literal("workspace"),
  ownerRef: z.string().min(1),
  priority: z.number().int().nonnegative().optional(),
  status: GovernanceRuleStatusEnum,
  inheritance: z.enum(["required", "default", "optional", "forbidden"]),
  expiresAt: z.coerce.date().nullable(),
  freshness: GovernanceEvidenceFreshnessEnum,
  inheritedFrom: z.array(z.string()).default([]),
  overrides: z.array(z.string()).default([]),
  source: z.string().min(1),
  evidenceRef: z.string().min(1),
}).strict()

export const GovernanceAuthorizationStatusEnum = z.enum(["configured", "unconfigured", "missing", "unresolved", "invalid"])
export const GovernanceAuthorizationSchema = z.object({
  status: GovernanceAuthorizationStatusEnum,
  source: z.string().nullable(),
  ownerRef: z.string().min(1),
  policyVersion: z.string().min(1),
  grantCount: z.number().int().nonnegative(),
  warnings: z.array(z.string()).default([]),
}).strict()

export const WorkspaceEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.coerce.date(),
  recordedAt: z.coerce.date(),
  actorRef: z.string().min(1),
  surfaceRef: z.string().min(1).optional(),
  projectRef: z.string().min(1).optional(),
  serviceRef: z.string().min(1).optional(),
  runRef: z.string().min(1).optional(),
  scopeRef: z.string().min(1),
  objectRef: z.string().min(1),
  action: z.string().min(1),
  beforeRef: z.string().nullable().optional(),
  afterRef: z.string().nullable().optional(),
  correlationId: z.string().min(1),
  causationId: z.string().min(1).optional(),
  policyDecisionRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  result: z.string().min(1),
  source: z.string().min(1),
  retentionClass: z.enum(["default", "extended", "legal_hold"]).default("default"),
  immutable: z.literal(true).default(true),
  integrity: z.object({
    status: z.enum(["verified", "unverified", "invalid"]),
    hash: z.string().min(1),
    previousHash: z.string().nullable(),
  }).strict(),
}).strict()

export const WorkspaceEventPageSchema = z.object({
  events: z.array(WorkspaceEventSchema),
  nextCursor: z.string().nullable(),
}).strict()

export const GovernanceSubjectTypeEnum = z.enum(["user", "agent", "service", "group"])
export const GovernanceScopeTypeEnum = z.enum(["workspace", "unit", "object"])
export const GovernanceActionEnum = z.enum(["read", "write", "execute", "deploy", "manage", "approve", "admin"])
export const GovernancePolicyDecisionEnum = z.enum(["allow", "deny", "require_approval", "require_additional_evidence"])
export const GovernanceInheritanceModeEnum = z.enum(["required", "default", "optional", "forbidden"])

export const GovernanceAutomationStatusEnum = z.enum(["enabled", "paused", "blocked", "unregistered"])
export const GovernanceAutomationTriggerEnum = z.enum(["manual", "interval"])
export const GovernanceAutomationSchema = z.object({
  id: z.string().min(1),
  targetRef: z.string().min(1),
  ownerRef: z.string().min(1),
  source: z.string().min(1),
  commandId: z.string().min(1),
  policyAction: GovernanceActionEnum,
  trigger: GovernanceAutomationTriggerEnum,
  intervalSeconds: z.number().int().positive().optional(),
  status: GovernanceAutomationStatusEnum,
  enabled: z.boolean(),
  evidenceRefs: z.array(z.string()).default([]),
  lastRunAt: z.coerce.date().optional(),
}).strict()

export const GovernanceSubjectSchema = z.object({
  id: z.string().min(1),
  subjectType: GovernanceSubjectTypeEnum,
  name: z.string().min(1),
  source: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
}).strict()

export const GovernanceRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
}).strict()

export const GovernanceGrantSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.string().min(1),
  roleRef: z.string().min(1),
  scopeType: GovernanceScopeTypeEnum,
  scopeRef: z.string().min(1),
  resourceRef: z.string().min(1),
  action: GovernanceActionEnum,
  effect: GovernancePolicyDecisionEnum,
  inheritance: GovernanceInheritanceModeEnum,
  priority: z.number().int().nonnegative().default(0),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
  overrides: z.array(z.string()).default([]),
  source: z.string().min(1),
  evidenceRefs: z.array(z.string()).default([]),
}).strict()

export const GovernancePolicyDecisionSchema = z.object({
  id: z.string().min(1),
  subjectRef: z.string().min(1),
  scopeRef: z.string().min(1),
  resourceRef: z.string().min(1),
  action: GovernanceActionEnum,
  decision: GovernancePolicyDecisionEnum,
  reason: z.string().min(1),
  matchedGrantRefs: z.array(z.string()).default([]),
  policyVersion: z.string().min(1),
  correlationId: z.string().min(1),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  approvalRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  eventRefs: z.array(z.string()).optional(),
  denyPrecedence: z.literal(true),
}).strict()

export const GovernancePolicyDecisionResponseSchema = z.object({
  decision: GovernancePolicyDecisionSchema,
  grantsSource: z.string().nullable(),
  warnings: z.array(z.string()).default([]),
}).strict()

export const GovernanceSnapshotSchema = z.object({
  contractVersion: z.literal(1),
  generatedAt: z.coerce.date(),
  sources: z.object({
    graph: z.string().min(1),
    registry: z.string().min(1).optional(),
  }).strict(),
  units: z.array(GovernanceUnitSchema),
  evidence: z.array(GovernanceEvidenceSchema),
  relationships: z.array(GovernanceRelationshipSchema).default([]),
  impact: z.array(GovernanceImpactSchema).default([]),
  coverage: GovernanceCoverageSchema,
  executionCoverage: GovernanceExecutionCoverageSchema,
  relationshipMetadataCoverage: GovernanceRelationshipMetadataCoverageSchema,
  relationshipMetadataGaps: z.array(GovernanceRelationshipMetadataGapSchema).default([]),
  eventCoverage: GovernanceEventCoverageSchema,
  documents: z.array(GovernanceDocumentSchema).default([]),
  rules: z.array(GovernanceRuleSchema).default([]),
  events: z.array(WorkspaceEventSchema).default([]),
  risks: z.array(GovernanceRiskSchema).default([]),
  incidents: z.array(GovernanceIncidentSchema).default([]),
  violations: z.array(GovernanceViolationSchema).default([]),
  waivers: z.array(GovernanceWaiverSchema).default([]),
  automations: z.array(GovernanceAutomationSchema).default([]),
  policyDecisions: z.array(GovernancePolicyDecisionSchema).default([]),
  authorization: GovernanceAuthorizationSchema.optional(),
  conflicts: z.array(GovernanceConflictSchema).default([]),
  warnings: z.array(z.string()).default([]),
}).strict()

export const ControlIntentEnum = z.enum([
  "status_query",
  "run_health",
  "run_verify",
  "run_remediation",
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

/**
 * Web creates this short-lived transaction for a phone camera. The scan token
 * is a one-time bearer for the scan step only; it is neither a Web session nor
 * an owner approval credential.
 */
export const WebPairingQrTransactionSchema = z.object({
  webPairingId: z.string().regex(/^webpair_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  expiresAt: z.number().int().positive(),
  gatewayUrl: z.string().url().optional(),
}).strict()

/** Serialized into the QR image, never returned by an owner status endpoint. */
export const WebPairingQrPayloadSchema = z.object({
  kind: z.literal("axi-mobile-pair-v1"),
  webPairingId: z.string().regex(/^webpair_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  gatewayUrl: z.string().url().optional(),
}).strict()

export const WebPairingQrStatusSchema = z.object({
  status: z.enum(["waiting_scan", "scanned", "approved", "expired"]),
  expiresAt: z.number().int().positive(),
  deviceName: z.string().min(1).optional(),
}).strict()

/** Phone-to-gateway request after CameraX/ML Kit has decoded the QR payload. */
export const QrPairScanRequestSchema = z.object({
  webPairingId: z.string().regex(/^webpair_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  publicKeyHex: z.string().regex(/^[0-9a-fA-F]{64,512}$/),
  publicKeyAlgorithm: z.enum(["Ed25519", "ES256"]),
  deviceName: z.string().min(1).max(200),
}).strict()

/**
 * The code remains only in device-local secure storage for status polling.
 * It intentionally omits scanToken, owner identity, and browser credentials.
 */
export const QrPairScanResponseSchema = z.object({
  ok: z.literal(true),
  pairingId: z.string().regex(/^pair_[A-Za-z0-9_-]{36}$/),
  code: z.string().regex(/^\d{6}$/),
  expiresAt: z.number().int().positive(),
}).strict()

/** A browser that has no session receives this transaction from the Gateway.
 * `pollToken` stays in browser memory, while the camera QR contains only the
 * scan token. Neither token is a browser session or an owner credential. */
export const WebLoginQrTransactionSchema = z.object({
  webLoginId: z.string().regex(/^weblogin_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  pollToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
  expiresAt: z.number().int().positive(),
}).strict()

/** Serialized into the computer-login QR image; `pollToken` is intentionally absent. */
export const WebLoginQrPayloadSchema = z.object({
  kind: z.literal("axi-web-login-v1"),
  webLoginId: z.string().regex(/^weblogin_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
}).strict()

/** Sent by a pre-authorized phone only. The device bearer comes from the
 * Control Plane interceptor, never from this JSON body. */
export const WebLoginQrScanRequestSchema = z.object({
  webLoginId: z.string().regex(/^weblogin_[A-Za-z0-9_-]{16,}$/),
  scanToken: z.string().regex(/^[A-Za-z0-9_-]{32,}$/),
}).strict()

export const WebLoginQrScanResponseSchema = z.object({
  ok: z.literal(true),
  status: z.literal("approved"),
}).strict()

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
  source: z.enum(["desktop", "mobile_pairing", "mobile_project_action"]).default("desktop"),
  sourceDeviceId: z.string().optional(),
  projectId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  actionType: z.string().optional(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
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
  status: z.enum(["pending", "opened", "completed", "rejected", "expired"]),
  approvalId: z.string().min(1).nullable(),
  sourceActorRef: z.string().min(1).nullable().optional(),
  sourceOwnerRef: z.string().min(1).nullable().optional(),
  object: ApprovalScanObjectSchema,
  impact: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "destructive"]),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  openedAt: z.coerce.date().optional(),
  openedBy: z.string().min(1).optional(),
  completedAt: z.coerce.date().optional(),
  rejectedAt: z.coerce.date().optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectionReason: z.string().min(1).optional(),
  expiredAt: z.coerce.date().optional(),
  finalAction: z.object({
    outcome: z.string().min(1),
    performedBy: z.string().min(1),
    occurredAt: z.coerce.date(),
  }).optional(),
})

export type ApprovalScanPreview = z.infer<typeof ApprovalScanPreviewSchema>
export type MobileApprovalDecision = z.infer<typeof MobileApprovalDecisionSchema>
export type HandoffContext = z.infer<typeof HandoffContextSchema>
export type WebPairingQrTransaction = z.infer<typeof WebPairingQrTransactionSchema>
export type WebPairingQrPayload = z.infer<typeof WebPairingQrPayloadSchema>
export type WebPairingQrStatus = z.infer<typeof WebPairingQrStatusSchema>
export type QrPairScanRequest = z.infer<typeof QrPairScanRequestSchema>
export type QrPairScanResponse = z.infer<typeof QrPairScanResponseSchema>
export type WebLoginQrTransaction = z.infer<typeof WebLoginQrTransactionSchema>
export type WebLoginQrPayload = z.infer<typeof WebLoginQrPayloadSchema>
export type WebLoginQrScanRequest = z.infer<typeof WebLoginQrScanRequestSchema>
export type WebLoginQrScanResponse = z.infer<typeof WebLoginQrScanResponseSchema>

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
  policyDecisionRef: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string()).default([]),
  riskRef: z.string().min(1).optional(),
  incidentRef: z.string().min(1).optional(),
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
  evidenceRefs: z.array(z.string()).default([]),
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
  ownerRef: z.string().min(1),
  source: z.string().min(1),
  executorRef: z.string().min(1),
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
  evidenceRefs: z.array(z.string()).default([]),
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
  governance: GovernanceSnapshotSchema.optional(),
  profiles: z.array(z.object({
    id: z.string().min(1),
    description: z.string().optional(),
    projects: z.array(z.string()).default([]),
    commands: z.array(ManagedCommandSchema).default([]),
  })),
})

export type LayerKind = z.infer<typeof LayerKindEnum>
export type GovernanceEvidenceType = z.infer<typeof GovernanceEvidenceTypeEnum>
export type GovernanceEvidenceFreshness = z.infer<typeof GovernanceEvidenceFreshnessEnum>
export type GovernanceEvidenceConfidence = z.infer<typeof GovernanceEvidenceConfidenceEnum>
export type GovernanceHealthStatus = z.infer<typeof GovernanceHealthStatusEnum>
export type GovernanceDocumentStatus = z.infer<typeof GovernanceDocumentStatusEnum>
export type GovernanceRuleStatus = z.infer<typeof GovernanceRuleStatusEnum>
export type GovernanceEvidence = z.infer<typeof GovernanceEvidenceSchema>
export type GovernanceRelationshipType = z.infer<typeof GovernanceRelationshipTypeEnum>
export type GovernanceRelationship = z.infer<typeof GovernanceRelationshipSchema>
export type GovernanceIdentityStatus = z.infer<typeof GovernanceIdentityStatusEnum>
export type GovernanceHealth = z.infer<typeof GovernanceHealthSchema>
export type GovernanceRisk = z.infer<typeof GovernanceRiskSchema>
export type GovernanceIncident = z.infer<typeof GovernanceIncidentSchema>
export type GovernanceViolation = z.infer<typeof GovernanceViolationSchema>
export type GovernanceWaiver = z.infer<typeof GovernanceWaiverSchema>
export type GovernanceAutomation = z.infer<typeof GovernanceAutomationSchema>
export type GovernanceAutomationTrigger = z.infer<typeof GovernanceAutomationTriggerEnum>
export type GovernanceRiskTransitionRequest = z.infer<typeof GovernanceRiskTransitionRequestSchema>
export type GovernanceUnit = z.infer<typeof GovernanceUnitSchema>
export type GovernanceConflict = z.infer<typeof GovernanceConflictSchema>
export type GovernanceImpact = z.infer<typeof GovernanceImpactSchema>
export type GovernanceDocument = z.infer<typeof GovernanceDocumentSchema>
export type GovernanceRule = z.infer<typeof GovernanceRuleSchema>
export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>
export type WorkspaceEventPage = z.infer<typeof WorkspaceEventPageSchema>
export type GovernanceSubjectType = z.infer<typeof GovernanceSubjectTypeEnum>
export type GovernanceScopeType = z.infer<typeof GovernanceScopeTypeEnum>
export type GovernanceAction = z.infer<typeof GovernanceActionEnum>
export type GovernancePolicyDecision = z.infer<typeof GovernancePolicyDecisionEnum>
export type GovernanceInheritanceMode = z.infer<typeof GovernanceInheritanceModeEnum>
export type GovernanceSubject = z.infer<typeof GovernanceSubjectSchema>
export type GovernanceRole = z.infer<typeof GovernanceRoleSchema>
export type GovernanceGrant = z.infer<typeof GovernanceGrantSchema>
export type GovernancePolicyDecisionRecord = z.infer<typeof GovernancePolicyDecisionSchema>
export type GovernancePolicyDecisionResponse = z.infer<typeof GovernancePolicyDecisionResponseSchema>
export type GovernanceAuthorization = z.infer<typeof GovernanceAuthorizationSchema>
export type GovernanceSnapshot = z.infer<typeof GovernanceSnapshotSchema>
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
