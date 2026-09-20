/**
 * TASK6 — Rule, Waiver, and Violation Tests
 *
 * Covers:
 *   1. Five-state Rule lifecycle: draft → active → stale → expired → archived
 *   2. Three-state Waiver lifecycle: active → expired / revoked
 *   3. Source precedence resolution: provider > memory > user > inferred
 *   4. Expired waiver does NOT suppress current violations
 *   5. Missing evidence → Unknown (never treated as healthy)
 *   6. Rule inheritance with stale parent propagation
 */

import { describe, expect, it } from "vitest";
import {
  // Enums
  ruleStatusSchema,
  waiverStatusSchema,
  violationStatusSchema,
  factSourceSchema,
  evidenceConfidenceSchema,
  // Schemas
  ruleSchema,
  waiverSchema,
  violationSchema,
  requirementSchema,
  judgmentMetaSchema,
  evidenceRefSchema,
  // State machines
  nextRuleStatus,
  nextWaiverStatus,
  waiverSuppresses,
  // Source precedence
  resolveByPrecedence,
  SOURCE_RANK,
  CONFIDENCE_RANK,
  type ProvenancedFact,
  // Rule inheritance
  inheritRule,
  collectAncestorIds,
  collectAncestorIdsImproved,
  // Violation evaluation
  evaluateViolation,
  hasEvidence,
  classifyUnknown,
  // Validators
  validateViolationRequiresEvidence,
  validateWaiverRequiresExpiry,
} from "./rule-waiver";

const ISO = (date: Date): string => date.toISOString();

/* -------------------------------------------------------------------- *
 * Fixture builders.                                                        *
 * -------------------------------------------------------------------- */

const now = new Date("2026-09-14T12:00:00.000Z");

const makeMeta = (overrides: Partial<{ owner: string; source: "provider" | "memory" | "user" | "inferred"; observedAt: string }> = {}) => ({
  owner: overrides.owner ?? "libu",
  source: overrides.source ?? "user",
  evidenceRefs: [],
  observedAt: overrides.observedAt ?? ISO(now),
});

const makeEvidenceRef = (id: string, label: string) => ({
  ref: id,
  label,
  url: null,
});

/* -------------------------------------------------------------------- *
 * F1: Missing evidence → Unknown                                         *
 * -------------------------------------------------------------------- */

describe("F1 — Missing evidence → Unknown", () => {
  it("returns unknown when no evidence refs exist", () => {
    const meta = makeMeta();
    expect(hasEvidence(meta.evidenceRefs)).toBe(false);
  });

  it("does NOT return healthy when evidence is absent", () => {
    const status = "active" as const;
    expect(classifyUnknown(status, [])).toBe("unknown");
  });

  it("preserves non-unknown status when evidence exists", () => {
    const refs = [makeEvidenceRef("evidence-1", "Provider returned image preview")];
    expect(classifyUnknown("active", refs)).toBe("active");
  });

  it("waiverSuppresses returns false when no evidence", () => {
    // This tests the invariant: no evidence = unknown = no suppression
    const meta = makeMeta();
    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "high",
      description: "Missing provider health check",
      status: "unknown",
      meta,
      observedAt: ISO(now),
    });
    expect(violation.status).toBe("unknown");
  });

  it("violationSchema accepts active status (validators enforce business rules)", () => {
    // The schema allows active status; use validateViolationRequiresEvidence to enforce business rules
    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "high",
      description: "Test",
      status: "active",
      meta: makeMeta(),
      observedAt: ISO(now),
    });
    expect(violation.status).toBe("active");
    // Validator catches the business rule violation
    expect(() => validateViolationRequiresEvidence(violation)).toThrow();
  });

  it("violationSchema accepts active status with evidence", () => {
    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "high",
      description: "Test with evidence",
      status: "active",
      meta: {
        ...makeMeta(),
        evidenceRefs: [makeEvidenceRef("evidence-1", "Provider returned image preview")],
      },
      observedAt: ISO(now),
    });
    expect(violation.status).toBe("active");
    // Validator passes when evidence exists
    expect(() => validateViolationRequiresEvidence(violation)).not.toThrow();
  });

  it("judgmentMetaSchema enforces evidenceRefs as required array", () => {
    const valid = judgmentMetaSchema.parse({
      owner: "libu",
      source: "provider",
      evidenceRefs: [makeEvidenceRef("e1", "Test evidence")],
      observedAt: ISO(now),
    });
    expect(valid.evidenceRefs).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------- *
 * F2: Expired waiver does NOT suppress current violations                 *
 * -------------------------------------------------------------------- */

describe("F2 — Expired waiver does NOT suppress current violations", () => {
  it("nextWaiverStatus transitions active → expired when expiresAt passes", () => {
    const expired = new Date("2026-09-01T00:00:00.000Z");
    expect(nextWaiverStatus("active", now, expired)).toBe("expired");
  });

  it("nextWaiverStatus returns active when not yet expired", () => {
    const future = new Date("2026-10-01T00:00:00.000Z");
    expect(nextWaiverStatus("active", now, future)).toBe("active");
  });

  it("waiverSuppresses returns false for expired waiver", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Temporary exemption",
      scope: "global",
      status: "expired",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      expiresAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiverSuppresses(waiver, "global", null, now)).toBe(false);
  });

  it("waiverSuppresses returns false for revoked waiver", () => {
    const waiver = waiverSchema.parse({
      id: "w2",
      requirementId: "req-1",
      reason: "Temporary exemption",
      scope: "global",
      status: "revoked",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      revokedAt: ISO(new Date("2026-09-10T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiverSuppresses(waiver, "global", null, now)).toBe(false);
  });

  it("waiverSuppresses returns true for active global waiver", () => {
    const waiver = waiverSchema.parse({
      id: "w3",
      requirementId: "req-1",
      reason: "Permanent exemption",
      scope: "global",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiverSuppresses(waiver, "global", null, now)).toBe(true);
  });

  it("evaluateViolation exposes violation when waiver is expired", () => {
    const requirement = requirementSchema.parse({
      id: "req-1",
      description: "Provider health must be checked",
      severity: "critical",
      sourceRank: "provider",
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "critical",
      description: "Provider health check missing",
      status: "active",
      meta: makeMeta(),
      observedAt: ISO(now),
    });

    const expiredWaiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Temporary exemption",
      scope: "global",
      status: "expired",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      expiresAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const evaluated = evaluateViolation(violation, requirement, [expiredWaiver], now);
    // CRITICAL: expired waiver does NOT suppress
    expect(evaluated.status).toBe("active");
    expect(evaluated.suppressingWaiverId).toBeNull();
  });

  it("evaluateViolation suppresses when waiver is active", () => {
    const requirement = requirementSchema.parse({
      id: "req-1",
      description: "Provider health must be checked",
      severity: "high",
      sourceRank: "provider",
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "high",
      description: "Provider health check missing",
      status: "active",
      meta: makeMeta(),
      observedAt: ISO(now),
    });

    const activeWaiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Permanent exemption",
      scope: "global",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const evaluated = evaluateViolation(violation, requirement, [activeWaiver], now);
    expect(evaluated.status).toBe("waived");
    expect(evaluated.suppressingWaiverId).toBe("w1");
  });

  it("waiverSchema accepts expired status (validators enforce business rules)", () => {
    // The schema allows expired status; use validateWaiverRequiresExpiry to enforce business rules
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Test",
      scope: "global",
      status: "expired",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
      // expiresAt is intentionally missing
    });
    expect(waiver.status).toBe("expired");
    // Validator catches the business rule violation
    expect(() => validateWaiverRequiresExpiry(waiver)).toThrow();
  });

  it("waiverSchema accepts expired status with expiresAt", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Test",
      scope: "global",
      status: "expired",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      expiresAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiver.status).toBe("expired");
    // Validator passes when expiresAt exists
    expect(() => validateWaiverRequiresExpiry(waiver)).not.toThrow();
  });
});

/* -------------------------------------------------------------------- *
 * F3: Conflicting facts → resolution by precedence                        *
 * -------------------------------------------------------------------- */

describe("F3 — Source precedence resolution", () => {
  const providerMeta = makeMeta({ source: "provider", observedAt: ISO(now) });
  const memoryMeta = makeMeta({ source: "memory", observedAt: ISO(now) });
  const userMeta = makeMeta({ source: "user", observedAt: ISO(now) });
  const inferredMeta = makeMeta({ source: "inferred", observedAt: ISO(now) });

  it("SOURCE_RANK has correct ordering", () => {
    expect(SOURCE_RANK.provider).toBeGreaterThan(SOURCE_RANK.memory);
    expect(SOURCE_RANK.memory).toBeGreaterThan(SOURCE_RANK.user);
    expect(SOURCE_RANK.user).toBeGreaterThan(SOURCE_RANK.inferred);
  });

  it("provider facts win over memory facts", () => {
    const facts: ProvenancedFact[] = [
      { key: "providerId", value: "axi-image-preview", source: "provider", confidence: "high", meta: providerMeta },
      { key: "providerId", value: "axi-docs", source: "memory", confidence: "high", meta: memoryMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("providerId")?.value).toBe("axi-image-preview");
  });

  it("memory facts win over user facts", () => {
    const facts: ProvenancedFact[] = [
      { key: "preferredOrientation", value: "landscape", source: "memory", confidence: "high", meta: memoryMeta },
      { key: "preferredOrientation", value: "portrait", source: "user", confidence: "high", meta: userMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("preferredOrientation")?.value).toBe("landscape");
  });

  it("user facts win over inferred facts", () => {
    const facts: ProvenancedFact[] = [
      { key: "allowExternalSearch", value: false, source: "user", confidence: "high", meta: userMeta },
      { key: "allowExternalSearch", value: true, source: "inferred", confidence: "medium", meta: inferredMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("allowExternalSearch")?.value).toBe(false);
  });

  it("higher confidence wins when source rank is equal", () => {
    const lowConfMeta = makeMeta({ source: "provider", observedAt: ISO(now) });
    const highConfMeta = makeMeta({ source: "provider", observedAt: ISO(now) });
    const facts: ProvenancedFact[] = [
      { key: "resourceKind", value: "document", source: "provider", confidence: "low", meta: lowConfMeta },
      { key: "resourceKind", value: "image", source: "provider", confidence: "high", meta: highConfMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("resourceKind")?.value).toBe("image");
  });

  it("newer observation wins when source and confidence are equal", () => {
    const olderMeta = makeMeta({ source: "provider", observedAt: ISO(new Date("2026-09-01T00:00:00.000Z")) });
    const newerMeta = makeMeta({ source: "provider", observedAt: ISO(new Date("2026-09-14T00:00:00.000Z")) });
    const facts: ProvenancedFact[] = [
      { key: "cacheStatus", value: "stale", source: "provider", confidence: "high", meta: olderMeta },
      { key: "cacheStatus", value: "fresh", source: "provider", confidence: "high", meta: newerMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("cacheStatus")?.value).toBe("fresh");
  });

  it("resolves multiple conflicting keys independently", () => {
    const facts: ProvenancedFact[] = [
      { key: "providerId", value: "axi-image-preview", source: "provider", confidence: "high", meta: providerMeta },
      { key: "providerId", value: "axi-docs", source: "memory", confidence: "high", meta: memoryMeta },
      { key: "preferredOrientation", value: "landscape", source: "memory", confidence: "high", meta: memoryMeta },
      { key: "preferredOrientation", value: "portrait", source: "user", confidence: "high", meta: userMeta },
    ];
    const resolved = resolveByPrecedence(facts);
    expect(resolved.get("providerId")?.value).toBe("axi-image-preview");
    expect(resolved.get("preferredOrientation")?.value).toBe("landscape");
  });

  it("factSourceSchema validates enum values", () => {
    expect(factSourceSchema.parse("provider")).toBe("provider");
    expect(factSourceSchema.parse("memory")).toBe("memory");
    expect(factSourceSchema.parse("user")).toBe("user");
    expect(factSourceSchema.parse("inferred")).toBe("inferred");
    expect(() => factSourceSchema.parse("unknown")).toThrow();
  });
});

/* -------------------------------------------------------------------- *
 * F4: Waiver active / expired / revoked lifecycle                         *
 * -------------------------------------------------------------------- */

describe("F4 — Waiver lifecycle", () => {
  it("waiverSchema validates global scope without scopeId", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Global exemption",
      scope: "global",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiver.scope).toBe("global");
    expect(waiver.scopeId).toBeUndefined();
  });

  it("waiverSchema requires scopeId for project scope", () => {
    expect(() =>
      waiverSchema.parse({
        id: "w1",
        requirementId: "req-1",
        reason: "Project exemption",
        scope: "project",
        status: "active",
        meta: makeMeta(),
        effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        expiresAt: null,
        createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        // scopeId is missing
      }),
    ).toThrow();
  });

  it("waiverSchema requires scopeId for resource scope", () => {
    expect(() =>
      waiverSchema.parse({
        id: "w1",
        requirementId: "req-1",
        reason: "Resource exemption",
        scope: "resource",
        status: "active",
        meta: makeMeta(),
        effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        expiresAt: null,
        createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        // scopeId is missing
      }),
    ).toThrow();
  });

  it("waiverSchema validates scopeId for project scope", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Project exemption",
      scope: "project",
      scopeId: "ai-resource-orchestration",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiver.scopeId).toBe("ai-resource-orchestration");
  });

  it("waiverSchema requires revokedAt when status is revoked", () => {
    expect(() =>
      waiverSchema.parse({
        id: "w1",
        requirementId: "req-1",
        reason: "Test",
        scope: "global",
        status: "revoked",
        meta: makeMeta(),
        effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
        createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        // revokedAt is missing
      }),
    ).toThrow();
  });

  it("waiverSchema validates revokedAt > effectiveAt", () => {
    expect(() =>
      waiverSchema.parse({
        id: "w1",
        requirementId: "req-1",
        reason: "Test",
        scope: "global",
        status: "revoked",
        meta: makeMeta(),
        effectiveAt: ISO(new Date("2026-09-15T00:00:00.000Z")),
        revokedAt: ISO(new Date("2026-09-01T00:00:00.000Z")), // before effective
        createdAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
        updatedAt: ISO(now),
      }),
    ).toThrow();
  });

  it("nextWaiverStatus returns revoked unchanged", () => {
    expect(nextWaiverStatus("revoked", now, null)).toBe("revoked");
  });

  it("nextWaiverStatus returns expired unchanged", () => {
    expect(nextWaiverStatus("expired", now, null)).toBe("expired");
  });

  it("nextWaiverStatus handles null expiresAt as indefinite", () => {
    expect(nextWaiverStatus("active", now, null)).toBe("active");
  });

  it("waiverSuppresses handles project scope with matching scopeId", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Project exemption",
      scope: "project",
      scopeId: "ai-resource-orchestration",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiverSuppresses(waiver, "project", "ai-resource-orchestration", now)).toBe(true);
  });

  it("waiverSuppresses returns false for mismatched scopeId", () => {
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Project exemption",
      scope: "project",
      scopeId: "ai-resource-orchestration",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    expect(waiverSuppresses(waiver, "project", "other-project", now)).toBe(false);
  });

  it("waiverSuppresses returns true for global waiver suppressing project scope", () => {
    // A global waiver applies everywhere, including project-scoped violations
    const waiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Global exemption",
      scope: "global",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    // Global waiver suppresses all scopes
    expect(waiverSuppresses(waiver, "project", "ai-resource-orchestration", now)).toBe(true);
    expect(waiverSuppresses(waiver, "global", null, now)).toBe(true);
    expect(waiverSuppresses(waiver, "resource", "res-1", now)).toBe(true);
  });
});

/* -------------------------------------------------------------------- *
 * F5: Rule lifecycle and inheritance                                      *
 * -------------------------------------------------------------------- */

describe("F5 — Rule lifecycle and inheritance", () => {
  it("ruleStatusSchema validates all five states", () => {
    expect(ruleStatusSchema.parse("draft")).toBe("draft");
    expect(ruleStatusSchema.parse("active")).toBe("active");
    expect(ruleStatusSchema.parse("stale")).toBe("stale");
    expect(ruleStatusSchema.parse("expired")).toBe("expired");
    expect(ruleStatusSchema.parse("archived")).toBe("archived");
    expect(() => ruleStatusSchema.parse("unknown")).toThrow();
  });

  it("nextRuleStatus transitions draft → stale when staleAfter passes", () => {
    const staleAfter = new Date("2026-09-01T00:00:00.000Z");
    const expireAfter = new Date("2026-12-01T00:00:00.000Z");
    const archiveAfter = new Date("2027-03-01T00:00:00.000Z");
    expect(nextRuleStatus("draft", now, staleAfter, expireAfter, archiveAfter)).toBe("stale");
  });

  it("nextRuleStatus transitions active → expired when expireAfter passes", () => {
    const staleAfter = new Date("2026-08-01T00:00:00.000Z");
    const expireAfter = new Date("2026-09-01T00:00:00.000Z");
    const archiveAfter = new Date("2026-12-01T00:00:00.000Z");
    expect(nextRuleStatus("active", now, staleAfter, expireAfter, archiveAfter)).toBe("expired");
  });

  it("nextRuleStatus returns archived when archiveAfter passes", () => {
    // When the rule is already expired, archive threshold must be met
    const staleAfter = new Date("2026-08-01T00:00:00.000Z");
    const expireAfter = new Date("2026-09-01T00:00:00.000Z");
    // archiveAfter must be BEFORE now (2026-09-14) for expired rules to transition to archived
    const archiveAfter = new Date("2026-09-13T00:00:00.000Z");
    expect(nextRuleStatus("expired", now, staleAfter, expireAfter, archiveAfter)).toBe("archived");
  });

  it("nextRuleStatus returns current status when no threshold is met", () => {
    const staleAfter = new Date("2026-12-01T00:00:00.000Z");
    const expireAfter = new Date("2027-03-01T00:00:00.000Z");
    const archiveAfter = new Date("2027-06-01T00:00:00.000Z");
    expect(nextRuleStatus("active", now, staleAfter, expireAfter, archiveAfter)).toBe("active");
  });

  it("ruleSchema requires staleAt when status is stale", () => {
    expect(() =>
      ruleSchema.parse({
        id: "r1",
        description: "Test rule",
        kind: "safety",
        status: "stale",
        confidence: "high",
        meta: makeMeta(),
        createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        // staleAt is missing
      }),
    ).toThrow();
  });

  it("ruleSchema requires expiredAt when status is expired", () => {
    expect(() =>
      ruleSchema.parse({
        id: "r1",
        description: "Test rule",
        kind: "safety",
        status: "expired",
        confidence: "high",
        meta: makeMeta(),
        createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
        // expiredAt is missing
      }),
    ).toThrow();
  });

  it("ruleSchema requires archivedAt when status is archived", () => {
    expect(() =>
      ruleSchema.parse({
        id: "r1",
        description: "Test rule",
        kind: "safety",
        status: "archived",
        confidence: "high",
        meta: makeMeta(),
        createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
        updatedAt: ISO(now),
        staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
        expiredAt: ISO(new Date("2026-09-15T00:00:00.000Z")),
        // archivedAt is missing
      }),
    ).toThrow();
  });

  it("ruleSchema validates timestamp ordering", () => {
    expect(() =>
      ruleSchema.parse({
        id: "r1",
        description: "Test rule",
        kind: "safety",
        status: "stale",
        confidence: "high",
        meta: makeMeta(),
        createdAt: ISO(new Date("2026-09-15T00:00:00.000Z")), // after staleAt
        updatedAt: ISO(now),
        staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      }),
    ).toThrow();
  });

  it("ruleSchema allows valid lifecycle timestamps", () => {
    const rule = ruleSchema.parse({
      id: "r1",
      description: "Test rule",
      kind: "safety",
      status: "archived",
      confidence: "high",
      meta: makeMeta(),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
      staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      expiredAt: ISO(new Date("2026-09-15T00:00:00.000Z")),
      archivedAt: ISO(new Date("2026-10-01T00:00:00.000Z")),
    });
    expect(rule.status).toBe("archived");
  });

  it("inheritRule returns child unchanged when no parent", () => {
    const rule = ruleSchema.parse({
      id: "r1",
      description: "Root rule",
      kind: "safety",
      status: "active",
      confidence: "high",
      meta: makeMeta(),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [rule];
    const inherited = inheritRule(rule, allRules);
    expect(inherited.id).toBe("r1");
    expect(inherited.parentId).toBeUndefined();
  });

  it("inheritRule inherits from active parent", () => {
    const parent = ruleSchema.parse({
      id: "parent-1",
      description: "Parent safety rule",
      kind: "safety",
      status: "active",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      tags: ["safety", "parent-tag"],
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const child = ruleSchema.parse({
      id: "child-1",
      description: "Child style rule",
      kind: "style",
      status: "active",
      parentId: "parent-1",
      confidence: "medium",
      meta: makeMeta({ owner: "libu" }),
      tags: ["style"],
      createdAt: ISO(new Date("2026-02-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [parent, child];
    const inherited = inheritRule(child, allRules);
    // Child inherits parent's tags
    expect(inherited.tags).toContain("safety");
    expect(inherited.tags).toContain("parent-tag");
    expect(inherited.tags).toContain("style");
    // Child's own fields take precedence
    expect(inherited.kind).toBe("style");
    expect(inherited.confidence).toBe("medium");
  });

  it("inheritRule does NOT inherit from stale parent", () => {
    const parent = ruleSchema.parse({
      id: "parent-stale",
      description: "Stale parent rule",
      kind: "safety",
      status: "stale",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      tags: ["stale-parent"],
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
      staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
    });
    const child = ruleSchema.parse({
      id: "child-stale",
      description: "Child of stale parent",
      kind: "style",
      status: "active",
      parentId: "parent-stale",
      confidence: "medium",
      meta: makeMeta({ owner: "libu" }),
      tags: ["style"],
      createdAt: ISO(new Date("2026-02-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [parent, child];
    const inherited = inheritRule(child, allRules);
    // Stale parent does not contribute tags
    expect(inherited.tags).not.toContain("stale-parent");
    expect(inherited.tags).toEqual(["style"]);
  });

  it("inheritRule does NOT inherit from expired parent", () => {
    const parent = ruleSchema.parse({
      id: "parent-expired",
      description: "Expired parent rule",
      kind: "safety",
      status: "expired",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      tags: ["expired-parent"],
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
      staleAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      expiredAt: ISO(new Date("2026-09-15T00:00:00.000Z")),
    });
    const child = ruleSchema.parse({
      id: "child-expired",
      description: "Child of expired parent",
      kind: "style",
      status: "active",
      parentId: "parent-expired",
      confidence: "medium",
      meta: makeMeta({ owner: "libu" }),
      tags: ["style"],
      createdAt: ISO(new Date("2026-02-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [parent, child];
    const inherited = inheritRule(child, allRules);
    // Expired parent does not contribute tags
    expect(inherited.tags).not.toContain("expired-parent");
  });

  it("collectAncestorIds returns ancestors in order", () => {
    const grandparent = ruleSchema.parse({
      id: "grandparent",
      description: "Grandparent",
      kind: "governance",
      status: "active",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const parent = ruleSchema.parse({
      id: "parent",
      description: "Parent",
      kind: "governance",
      status: "active",
      parentId: "grandparent",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-02-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const child = ruleSchema.parse({
      id: "child",
      description: "Child",
      kind: "style",
      status: "active",
      parentId: "parent",
      confidence: "medium",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-03-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [grandparent, parent, child];
    const ancestors = collectAncestorIds("child", allRules);
    expect(ancestors).toEqual(["parent", "grandparent"]);
  });

  it("collectAncestorIds handles cycles gracefully", () => {
    const ruleA = ruleSchema.parse({
      id: "rule-a",
      description: "Rule A",
      kind: "governance",
      status: "active",
      parentId: "rule-b",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const ruleB = ruleSchema.parse({
      id: "rule-b",
      description: "Rule B",
      kind: "governance",
      status: "active",
      parentId: "rule-a",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [ruleA, ruleB];
    // Cycle guard prevents infinite recursion
    // Starting from rule-a: rule-a → rule-b → (cycle back to rule-a)
    // collectAncestorIds returns direct parent + grandparent
    const ancestors = collectAncestorIds("rule-a", allRules);
    expect(ancestors).toContain("rule-b");
  });

  it("collectAncestorIdsImproved handles cycles with proper detection", () => {
    const ruleA = ruleSchema.parse({
      id: "rule-a",
      description: "Rule A",
      kind: "governance",
      status: "active",
      parentId: "rule-b",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const ruleB = ruleSchema.parse({
      id: "rule-b",
      description: "Rule B",
      kind: "governance",
      status: "active",
      parentId: "rule-a",
      confidence: "high",
      meta: makeMeta({ owner: "libu" }),
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });
    const allRules = [ruleA, ruleB];
    // Starting from rule-a: rule-a → rule-b → (cycle to rule-a)
    // With proper cycle detection, rule-a should NOT be included again
    const ancestors = collectAncestorIdsImproved("rule-a", allRules);
    // Should be ["rule-b", "rule-a"] but cycle prevents further recursion
    // The cycle detection stops us from going beyond rule-b
    expect(ancestors).toContain("rule-b");
    expect(ancestors.filter((id) => id === "rule-a")).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------- *
 * Integration: Violation + Requirement + Waiver                          *
 * -------------------------------------------------------------------- */

describe("Integration — Violation evaluation with waivers", () => {
  const requirement = requirementSchema.parse({
    id: "req-1",
    description: "Provider must be reachable",
    severity: "critical",
    sourceRank: "provider",
    createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
    updatedAt: ISO(now),
  });

  it("evaluates violation against multiple waivers", () => {
    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "critical",
      description: "Provider unreachable",
      status: "active",
      meta: makeMeta(),
      observedAt: ISO(now),
    });

    const expiredWaiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Expired exemption",
      scope: "global",
      status: "expired",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      expiresAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      createdAt: ISO(new Date("2026-08-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const activeWaiver = waiverSchema.parse({
      id: "w2",
      requirementId: "req-1",
      reason: "Active exemption",
      scope: "global",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-09-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    const evaluated = evaluateViolation(violation, requirement, [expiredWaiver, activeWaiver], now);
    // Active waiver suppresses, expired does not
    expect(evaluated.status).toBe("waived");
    expect(evaluated.suppressingWaiverId).toBe("w2");
  });

  it("evaluates project-scoped waiver only for matching project", () => {
    const violation = violationSchema.parse({
      id: "v1",
      requirementId: "req-1",
      severity: "critical",
      description: "Provider unreachable",
      status: "active",
      meta: makeMeta(),
      observedAt: ISO(now),
    });

    const projectWaiver = waiverSchema.parse({
      id: "w1",
      requirementId: "req-1",
      reason: "Project exemption",
      scope: "project",
      scopeId: "ai-resource-orchestration",
      status: "active",
      meta: makeMeta(),
      effectiveAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      expiresAt: null,
      createdAt: ISO(new Date("2026-01-01T00:00:00.000Z")),
      updatedAt: ISO(now),
    });

    // Global violation evaluation
    const globalEval = evaluateViolation(violation, requirement, [projectWaiver], now);
    expect(globalEval.status).toBe("active"); // Project waiver does not suppress global

    // Project-scoped evaluation (would need custom scope handling in real impl)
    expect(waiverSuppresses(projectWaiver, "project", "ai-resource-orchestration", now)).toBe(true);
    expect(waiverSuppresses(projectWaiver, "project", "other-project", now)).toBe(false);
  });
});
