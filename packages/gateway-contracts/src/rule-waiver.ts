/**
 * TASK6 — Document Requirement, Rule and Waiver Closure
 *
 * Provides a formal requirement source precedence system, rule inheritance
 * propagation, stale/expired state machine, and waiver lifecycle (active/
 * expired/revoked) for the resource orchestration domain.
 *
 * Five-state lifecycle for Rules:
 *   draft → active → stale → expired → archived
 *
 * Waiver lifecycle:
 *   active → expired (time-based)
 *   active → revoked (owner action)
 *   expired → archived (automatic or owner action)
 *   revoked → archived (automatic)
 *
 * Key invariants enforced by this module:
 *   1. Missing evidence is never treated as "healthy" — Unknown is the
 *      safe default when no evidence is available.
 *   2. Expired waivers do NOT suppress current violations — the violation
 *      remains visible when the waiver is expired.
 *   3. External facts are never fabricated to refresh results.
 *
 * Source precedence (highest to lowest):
 *   1. provider-returned facts (provider: true, observedAt: timestamp)
 *   2. memory entries (memory: true, observedAt: timestamp)
 *   3. user-provided explicit facts (user: true)
 *   4. inferred facts (inferred: true) — lowest confidence
 *
 * Every judgment carries: owner, source, evidenceRefs[], observedAt
 */

import { z } from "zod";

/* -------------------------------------------------------------------- *
 * Enums — stable, adding values is non-breaking.                        *
 * -------------------------------------------------------------------- */

/** Rule lifecycle states. */
export const ruleStatusSchema = z.enum(["draft", "active", "stale", "expired", "archived"]);
export type RuleStatus = z.infer<typeof ruleStatusSchema>;

/** Waiver lifecycle states. */
export const waiverStatusSchema = z.enum(["active", "expired", "revoked"]);
export type WaiverStatus = z.infer<typeof waiverStatusSchema>;

/** Evidence confidence levels. */
export const evidenceConfidenceSchema = z.enum(["low", "medium", "high"]);
export type EvidenceConfidence = z.infer<typeof evidenceConfidenceSchema>;

/** Fact provenance sources. */
export const factSourceSchema = z.enum(["provider", "memory", "user", "inferred"]);
export type FactSource = z.infer<typeof factSourceSchema>;

/* -------------------------------------------------------------------- *
 * Evidence — every judgment carries provenance.                         *
 * -------------------------------------------------------------------- */

const isoTimestampSchema = z.string().datetime({ offset: false });

export const evidenceRefSchema = z.object({
  /** Stable identifier for the evidence source. */
  ref: z.string().min(1).max(120),
  /** Human-readable label for display in Inspector. */
  label: z.string().min(1).max(200),
  /** URI or path to the evidence (may be null for anonymous sources). */
  url: z.string().url().nullable().optional(),
}).strict();
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const judgmentMetaSchema = z.object({
  /** Owner responsible for this judgment. */
  owner: z.string().min(1).max(80),
  /** Primary source of the fact. */
  source: factSourceSchema,
  /** Evidence supporting this judgment. */
  evidenceRefs: z.array(evidenceRefSchema).max(16).default([]),
  /** ISO-8601 wall-clock when the fact was observed. */
  observedAt: isoTimestampSchema,
}).strict();
export type JudgmentMeta = z.infer<typeof judgmentMetaSchema>;

/* -------------------------------------------------------------------- *
 * Document Requirement — a verifiable rule with source precedence.     *
 * -------------------------------------------------------------------- */

export const requirementSeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type RequirementSeverity = z.infer<typeof requirementSeveritySchema>;

/** Precedence rank for requirement sources (higher = more authoritative). */
export const requirementSourceRankSchema = z.enum(["provider", "memory", "user", "inferred"]);
export type RequirementSourceRank = z.infer<typeof requirementSourceRankSchema>;

export const requirementSchema = z.object({
  id: z.string().min(1).max(80),
  /** Human-readable rule description. */
  description: z.string().min(1).max(400),
  severity: requirementSeveritySchema,
  /** Source precedence rank (provider > memory > user > inferred). */
  sourceRank: requirementSourceRankSchema,
  /** Tags for grouping and filtering. */
  tags: z.array(z.string().min(1).max(40)).max(16).default([]),
  /** Active waiver ids that suppress this requirement. */
  waiverIds: z.array(z.string().min(1).max(80)).max(32).default([]),
  /** When true, this requirement is currently suppressed by an active waiver. */
  isWaived: z.boolean().default(false),
  /** ISO-8601 when this requirement was defined. */
  createdAt: isoTimestampSchema,
  /** ISO-8601 when this requirement was last updated. */
  updatedAt: isoTimestampSchema,
}).strict();
export type Requirement = z.infer<typeof requirementSchema>;

/* -------------------------------------------------------------------- *
 * Rule — versioned rule with lifecycle states.                          *
 * -------------------------------------------------------------------- */

export const ruleKindSchema = z.enum(["style", "safety", "format", "governance"]);
export type RuleKind = z.infer<typeof ruleKindSchema>;

export const ruleSchema = z.object({
  id: z.string().min(1).max(80),
  /** Human-readable rule description. */
  description: z.string().min(1).max(400),
  kind: ruleKindSchema,
  /** Lifecycle status. */
  status: ruleStatusSchema,
  /** Parent rule id for inheritance (null for root rules). */
  parentId: z.string().min(1).max(80).nullable().optional(),
  /** Tags for grouping and filtering. */
  tags: z.array(z.string().min(1).max(40)).max(16).default([]),
  /** Confidence level for inferred rules. */
  confidence: evidenceConfidenceSchema,
  /** Provenance metadata. */
  meta: judgmentMetaSchema,
  /** ISO-8601 when this rule was defined. */
  createdAt: isoTimestampSchema,
  /** ISO-8601 when this rule was last updated. */
  updatedAt: isoTimestampSchema,
  /** ISO-8601 when this rule became stale. */
  staleAt: isoTimestampSchema.nullable().optional(),
  /** ISO-8601 when this rule expired. */
  expiredAt: isoTimestampSchema.nullable().optional(),
  /** ISO-8601 when this rule was archived. */
  archivedAt: isoTimestampSchema.nullable().optional(),
}).strict().superRefine((value, ctx) => {
  // staleAt must be present when status is stale or expired
  if ((value.status === "stale" || value.status === "expired") && !value.staleAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "staleAt is required when status is stale or expired",
      path: ["staleAt"],
    });
  }
  // expiredAt must be present when status is expired or archived
  if ((value.status === "expired" || value.status === "archived") && !value.expiredAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiredAt is required when status is expired or archived",
      path: ["expiredAt"],
    });
  }
  // archivedAt must be present when status is archived
  if (value.status === "archived" && !value.archivedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "archivedAt is required when status is archived",
      path: ["archivedAt"],
    });
  }
  // Timestamps must be in order: createdAt <= staleAt <= expiredAt <= archivedAt
  if (value.staleAt && value.staleAt < value.createdAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "staleAt must be >= createdAt",
      path: ["staleAt"],
    });
  }
  if (value.expiredAt && value.staleAt && value.expiredAt < value.staleAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiredAt must be >= staleAt",
      path: ["expiredAt"],
    });
  }
  if (value.archivedAt && value.expiredAt && value.archivedAt < value.expiredAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "archivedAt must be >= expiredAt",
      path: ["archivedAt"],
    });
  }
});
export type Rule = z.infer<typeof ruleSchema>;

/* -------------------------------------------------------------------- *
 * Waiver — suppresses a requirement for a bounded scope.                *
 * -------------------------------------------------------------------- */

export const waiverScopeSchema = z.enum(["global", "project", "resource"]);
export type WaiverScope = z.infer<typeof waiverScopeSchema>;

export const waiverSchema = z.object({
  id: z.string().min(1).max(80),
  /** Requirement id this waiver suppresses. */
  requirementId: z.string().min(1).max(80),
  /** Human-readable reason for the waiver. */
  reason: z.string().min(1).max(400),
  /** Scope of the waiver. */
  scope: waiverScopeSchema,
  /** Project or resource id when scope is not global. */
  scopeId: z.string().min(1).max(120).nullable().optional(),
  /** Lifecycle status. */
  status: waiverStatusSchema,
  /** Provenance metadata. */
  meta: judgmentMetaSchema,
  /** ISO-8601 when the waiver becomes effective. */
  effectiveAt: isoTimestampSchema,
  /** ISO-8601 when the waiver expires (null = indefinite). */
  expiresAt: isoTimestampSchema.nullable().optional(),
  /** ISO-8601 when the waiver was revoked (null = not revoked). */
  revokedAt: isoTimestampSchema.nullable().optional(),
  /** ISO-8601 when the waiver was created. */
  createdAt: isoTimestampSchema,
  /** ISO-8601 when the waiver was last updated. */
  updatedAt: isoTimestampSchema,
}).strict().superRefine((value, ctx) => {
  // scope=project or scope=resource requires scopeId
  if ((value.scope === "project" || value.scope === "resource") && !value.scopeId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scopeId is required when scope is project or resource",
      path: ["scopeId"],
    });
  }
  // revokedAt must be present when status is revoked
  if (value.status === "revoked" && !value.revokedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "revokedAt is required when status is revoked",
      path: ["revokedAt"],
    });
  }
  // revokedAt must be after effectiveAt
  if (value.revokedAt && value.revokedAt < value.effectiveAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "revokedAt must be >= effectiveAt",
      path: ["revokedAt"],
    });
  }
  // expiresAt must be after effectiveAt
  if (value.expiresAt && value.expiresAt < value.effectiveAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiresAt must be >= effectiveAt",
      path: ["expiresAt"],
    });
  }
});
export type Waiver = z.infer<typeof waiverSchema>;

/* -------------------------------------------------------------------- *
 * Violation — a broken requirement with evidence.                       *
 * -------------------------------------------------------------------- */

export const violationSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type ViolationSeverity = z.infer<typeof violationSeveritySchema>;

/** Violation status — Unknown when no evidence is available. */
export const violationStatusSchema = z.enum(["active", "resolved", "waived", "unknown"]);
export type ViolationStatus = z.infer<typeof violationStatusSchema>;

export const violationSchema = z.object({
  id: z.string().min(1).max(80),
  /** Requirement id that was violated. */
  requirementId: z.string().min(1).max(80),
  /** Severity of the violation. */
  severity: violationSeveritySchema,
  /** Human-readable description of the violation. */
  description: z.string().min(1).max(400),
  /** Current status of the violation. */
  status: violationStatusSchema,
  /** Provenance metadata. */
  meta: judgmentMetaSchema,
  /** Active waiver id that suppressed this violation (if any). */
  suppressingWaiverId: z.string().min(1).max(80).nullable().optional(),
  /** ISO-8601 when the violation was first observed. */
  observedAt: isoTimestampSchema,
  /** ISO-8601 when the violation was resolved (null = not resolved). */
  resolvedAt: isoTimestampSchema.nullable().optional(),
}).strict();
export type Violation = z.infer<typeof violationSchema>;

/* -------------------------------------------------------------------- *
 * State Machine Transitions — pure functions, no side effects.         *
 * -------------------------------------------------------------------- */

/**
 * Compute the next Rule status given the current status and a timestamp.
 * Returns the new status without mutating the input.
 *
 * Transition table:
 *   draft + time ≥ staleAfter → stale
 *   stale + time ≥ expireAfter → expired
 *   expired + time ≥ archiveAfter → archived
 *   active + time ≥ staleAfter → stale
 *   active + time ≥ expireAfter → expired
 *   Any status + explicit archive() → archived
 */
export const nextRuleStatus = (
  currentStatus: RuleStatus,
  now: Date,
  staleAfter: Date,
  expireAfter: Date,
  archiveAfter: Date,
): RuleStatus => {
  // Already archived — terminal state
  if (currentStatus === "archived") return "archived";
  // When already expired, only check archive threshold
  if (currentStatus === "expired") {
    if (now >= archiveAfter) return "archived";
    return "expired";
  }
  // When already stale, check both expire and archive thresholds
  if (currentStatus === "stale") {
    if (now >= archiveAfter) return "archived";
    if (now >= expireAfter) return "expired";
    return "stale";
  }
  // For draft and active, apply the full transition table
  if (now >= archiveAfter) return "archived";
  if (now >= expireAfter) return "expired";
  if (now >= staleAfter) return "stale";
  return currentStatus;
};

/**
 * Compute the next Waiver status given the current status and a timestamp.
 * Returns the new status without mutating the input.
 *
 * Critical invariant: expired waiver does NOT suppress current violations.
 * The caller must re-evaluate suppression after this transition.
 *
 * Transition table:
 *   active + now ≥ expiresAt → expired
 *   active + explicit revoke() → revoked
 *   expired + automatic or explicit → archived (handled by caller)
 *   revoked + automatic → archived (handled by caller)
 */
export const nextWaiverStatus = (
  currentStatus: WaiverStatus,
  now: Date,
  expiresAt: Date | null | undefined,
): WaiverStatus => {
  if (currentStatus === "revoked") return "revoked";
  if (currentStatus === "expired") return "expired";
  // Time-based expiration
  if (expiresAt && now >= expiresAt) return "expired";
  return "active";
};

/**
 * Evaluate whether a waiver suppresses a requirement at a given scope.
 * Returns false when:
 *   - waiver is expired
 *   - waiver is revoked
 *   - waiver scope does not cover the target scope
 *   - waiver scopeId does not match (for project/resource scopes)
 *
 * This function enforces the invariant: expired waiver does not suppress.
 */
export const waiverSuppresses = (
  waiver: Waiver,
  targetScope: WaiverScope,
  targetScopeId: string | null,
  now: Date,
): boolean => {
  void now
  // CRITICAL: expired waiver never suppresses
  if (waiver.status === "expired") return false;
  // Revoked waiver never suppresses
  if (waiver.status === "revoked") return false;
  // Global waiver suppresses everything
  if (waiver.scope === "global") return true;
  // Scope must match
  if (waiver.scope !== targetScope) return false;
  // For project/resource scope, scopeId must match
  if (waiver.scopeId !== targetScopeId) return false;
  return true;
};

/* -------------------------------------------------------------------- *
 * Source Precedence Resolution.                                         *
 * -------------------------------------------------------------------- */

/** Fact with provenance for precedence resolution. */
export interface ProvenancedFact {
  readonly key: string;
  readonly value: string | number | boolean;
  readonly source: FactSource;
  readonly confidence: EvidenceConfidence;
  readonly meta: JudgmentMeta;
}

/**
 * Resolve conflicting facts by source precedence.
 * Higher source rank wins; ties broken by confidence, then recency.
 *
 * Precedence order (highest to lowest):
 *   1. provider — from registered provider adapters
 *   2. memory — from local memory store
 *   3. user — explicitly provided by user
 *   4. inferred — derived by LLM inference (lowest confidence)
 *
 * Missing evidence → Unknown (never treat as healthy).
 */
export const SOURCE_RANK: Record<FactSource, number> = {
  provider: 4,
  memory: 3,
  user: 2,
  inferred: 1,
} as const;

export const CONFIDENCE_RANK: Record<EvidenceConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

export const resolveByPrecedence = (facts: ReadonlyArray<ProvenancedFact>): Map<string, ProvenancedFact> => {
  const resolved = new Map<string, ProvenancedFact>();

  for (const fact of facts) {
    const existing = resolved.get(fact.key);
    if (!existing) {
      resolved.set(fact.key, fact);
      continue;
    }

    // Compare by source precedence
    const existingRank = SOURCE_RANK[existing.source];
    const incomingRank = SOURCE_RANK[fact.source];
    if (incomingRank > existingRank) {
      resolved.set(fact.key, fact);
      continue;
    }
    if (incomingRank < existingRank) continue;

    // Same source rank — compare by confidence
    const existingConf = CONFIDENCE_RANK[existing.confidence];
    const incomingConf = CONFIDENCE_RANK[fact.confidence];
    if (incomingConf > existingConf) {
      resolved.set(fact.key, fact);
      continue;
    }
    if (incomingConf < existingConf) continue;

    // Same confidence — compare by recency (newer wins)
    const existingTime = new Date(existing.meta.observedAt).getTime();
    const incomingTime = new Date(fact.meta.observedAt).getTime();
    if (incomingTime > existingTime) {
      resolved.set(fact.key, fact);
    }
  }

  return resolved;
};

/* -------------------------------------------------------------------- *
 * Rule Inheritance — parent-child propagation.                           *
 * -------------------------------------------------------------------- */

/**
 * Compute the effective rule by traversing the inheritance chain.
 * Child rules override parent rules for the same key.
 * Inactive (stale/expired/archived) parents do not contribute to inheritance.
 */
export const inheritRule = (
  rule: Rule,
  allRules: ReadonlyArray<Rule>,
): Rule => {
  if (!rule.parentId) return rule;

  const parent = allRules.find((r) => r.id === rule.parentId);
  if (!parent) return rule;

  // Inactive parents do not contribute inheritance
  if (parent.status === "stale" || parent.status === "expired" || parent.status === "archived") {
    return rule;
  }

  // Recursively inherit from parent
  const inherited = inheritRule(parent, allRules);

  // Child overrides parent's fields
  return {
    id: rule.id,
    parentId: rule.parentId,
    description: rule.description,
    kind: rule.kind, // Preserve child's kind
    tags: [...new Set([...inherited.tags, ...rule.tags])],
    confidence: rule.confidence,
    meta: rule.meta,
    status: rule.status,
    createdAt: inherited.createdAt,
    updatedAt: rule.updatedAt,
    staleAt: rule.staleAt,
    expiredAt: rule.expiredAt,
    archivedAt: rule.archivedAt,
  };
};

/**
 * Collect all ancestor rule ids for a given rule.
 * Used for cycle detection and diagnostic display.
 */
export const collectAncestorIds = (
  ruleId: string,
  allRules: ReadonlyArray<Rule>,
  visited: Set<string> = new Set(),
): ReadonlyArray<string> => {
  if (visited.has(ruleId)) return []; // Cycle guard
  visited.add(ruleId);

  const rule = allRules.find((r) => r.id === ruleId);
  if (!rule?.parentId) return [];

  const ancestors: string[] = [rule.parentId];
  const parentAncestors = collectAncestorIds(rule.parentId, allRules, visited);
  ancestors.push(...parentAncestors);
  return ancestors;
};

/* -------------------------------------------------------------------- *
 * Violation Evaluation.                                                 *
 * -------------------------------------------------------------------- */

/**
 * Evaluate a violation against current waivers and requirements.
 * Returns the evaluated violation with resolved status.
 *
 * Key invariant: expired waivers do NOT suppress current violations.
 * This function re-evaluates waiver status on every call.
 */
export const evaluateViolation = (
  violation: Violation,
  requirement: Requirement,
  waivers: ReadonlyArray<Waiver>,
  now: Date,
): Violation => {
  const requirementWaivers = waivers.filter((w) => w.requirementId === requirement.id);
  let suppressingWaiverId: string | null = null;

  for (const waiver of requirementWaivers) {
    const expiresAtDate = waiver.expiresAt ? new Date(waiver.expiresAt) : null;
    const currentStatus = nextWaiverStatus(waiver.status, now, expiresAtDate);
    if (currentStatus === "expired") continue; // CRITICAL: expired does not suppress
    if (currentStatus === "revoked") continue;

    // Check scope coverage
    if (waiverSuppresses(waiver, "global", null, now)) {
      suppressingWaiverId = waiver.id;
      break;
    }
  }

  let status = violation.status;
  if (violation.status === "active" && suppressingWaiverId) {
    status = "waived";
  }

  return {
    ...violation,
    status,
    suppressingWaiverId,
    meta: {
      ...violation.meta,
      observedAt: now.toISOString(),
    },
  };
};

/**
 * Check if evidence is available for a judgment.
 * Missing evidence → Unknown status (never treat as healthy).
 */
export const hasEvidence = (evidenceRefs: ReadonlyArray<EvidenceRef>): boolean => {
  return evidenceRefs.length > 0;
};

/**
 * Classify a judgment as Unknown when no evidence is available.
 * This enforces the invariant: missing evidence is never treated as healthy.
 */
export const classifyUnknown = (
  status: ViolationStatus,
  evidenceRefs: ReadonlyArray<EvidenceRef>,
): ViolationStatus => {
  if (!hasEvidence(evidenceRefs) && status !== "unknown") {
    return "unknown";
  }
  return status;
};

/* -------------------------------------------------------------------- *
 * Business Rule Validators — enforce domain invariants.                      *
 * -------------------------------------------------------------------- */

/**
 * Validates that an active violation has at least one evidence reference.
 * Throws with a descriptive message when the invariant is violated.
 *
 * Invariant: missing evidence is never treated as healthy.
 */
export const validateViolationRequiresEvidence = (violation: Violation): void => {
  if (violation.status === "active" && !hasEvidence(violation.meta.evidenceRefs)) {
    throw new Error(
      `Violation ${violation.id} has status=active but no evidence refs. ` +
        "Active violations must have evidence to avoid false positives.",
    );
  }
};

/**
 * Validates that an expired waiver has an expiresAt timestamp.
 * Throws with a descriptive message when the invariant is violated.
 *
 * Invariant: expired waivers must have a time-based expiration.
 */
export const validateWaiverRequiresExpiry = (waiver: Waiver): void => {
  if (waiver.status === "expired" && !waiver.expiresAt) {
    throw new Error(
      `Waiver ${waiver.id} has status=expired but no expiresAt. ` +
        "Expired waivers must have an expiration timestamp.",
    );
  }
};

/* -------------------------------------------------------------------- *
 * Improved Ancestor Collection with proper cycle detection.                  *
 * -------------------------------------------------------------------- */

/**
 * Collect all ancestor rule ids for a given rule.
 * Used for cycle detection and diagnostic display.
 *
 * The cycle guard prevents infinite recursion by tracking visited nodes.
 * When a cycle is detected, only the first occurrence of each node is included.
 */
export const collectAncestorIdsImproved = (
  ruleId: string,
  allRules: ReadonlyArray<Rule>,
  visited: Set<string> = new Set(),
  collecting: Set<string> = new Set(),
): ReadonlyArray<string> => {
  if (collecting.has(ruleId)) {
    // Cycle detected — stop collecting
    return [];
  }

  const rule = allRules.find((r) => r.id === ruleId);
  if (!rule?.parentId) return [];

  collecting.add(ruleId);

  const ancestors: string[] = [rule.parentId];

  // Recursively collect from parent if not visited
  if (!visited.has(rule.parentId)) {
    const parentAncestors = collectAncestorIdsImproved(rule.parentId, allRules, visited, collecting);
    ancestors.push(...parentAncestors);
  }

  visited.add(ruleId);
  collecting.delete(ruleId);
  return ancestors;
};
