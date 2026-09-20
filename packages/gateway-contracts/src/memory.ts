import { z } from "zod";

/**
 * MEM-MVP-002/003 — Memory contract.
 *
 * Two responsibilities:
 *
 *   1. The on-disk entry shape (`MemoryEntrySchema` + file wrapper).
 *      Used by `packages/memory` for the versioned JSON store. Unknown
 *      facts keys are rejected so the JSON `record` does not become a
 *      free-form escape hatch for secrets or absolute paths.
 *
 *   2. The gateway HTTP wire format (settings, search, entries,
 *      approve/reject/delete/export/clear). Used by `apps/gateway` to
 *      validate every `/memory/*` request before touching the store.
 *
 * Style rules (matching the rest of contracts):
 *   - Pure schemas and tiny types; no transport, no fetch, no logger,
 *     no filesystem, no React, no Node imports.
 *   - Unknown fields rejected (`.strict()` where appropriate).
 *   - Stable enums only — adding a new value is a non-breaking change;
 *     renaming or removing a value requires a contract bump.
 *
 * Adding `/memory/*` endpoints is additive (no apiContractVersion bump
 * required as long as existing field semantics stay intact).
 */

export const memorySchemaVersion = 1 as const;
export const memoryApiContractVersion = 1 as const;

/* ------------------------------------------------------------------ *
 * Enums (MVP defaults — see TODO-MEMORY-MVP.md §3).                   *
 * ------------------------------------------------------------------ */

export const memoryScopeSchema = z.enum(["global", "project"]);
export type MemoryScope = z.infer<typeof memoryScopeSchema>;

export const memoryKindSchema = z.enum(["preference", "decision", "task", "constraint"]);
export type MemoryKind = z.infer<typeof memoryKindSchema>;

export const memoryStatusSchema = z.enum(["pending", "active", "archived"]);
export type MemoryStatus = z.infer<typeof memoryStatusSchema>;

export const memorySourceSchema = z.enum(["explicit", "inferred", "imported"]);
export type MemorySource = z.infer<typeof memorySourceSchema>;

export const memorySensitivitySchema = z.enum(["normal", "sensitive", "blocked"]);
export type MemorySensitivity = z.infer<typeof memorySensitivitySchema>;

export const memoryConfidenceSchema = z.enum(["low", "medium", "high"]);
export type MemoryConfidence = z.infer<typeof memoryConfidenceSchema>;

/* ------------------------------------------------------------------ *
 * Facts allowlist (MEM-MVP-006).                                       *
 *                                                                       *
 * MVP only allows a bounded set of facts keys per kind. Unknown keys   *
 * are rejected so a schema-bypass via `record` is impossible. Each    *
 * value must be a primitive (string/number/boolean); nested objects /  *
 * arrays are not part of MVP.                                          *
 * ------------------------------------------------------------------ */

const primitiveFactSchema = z.union([z.string().max(400), z.number().finite(), z.boolean()]);

const preferenceFactsSchema = z.object({
  preferredResourceKind: primitiveFactSchema.optional(),
  preferredOrientation: primitiveFactSchema.optional(),
  preferredResultCount: primitiveFactSchema.optional(),
}).strict();

const decisionFactsSchema = z.object({
  decisionTopic: primitiveFactSchema,
  decisionValue: primitiveFactSchema,
  projectId: primitiveFactSchema.optional(),
}).strict();

const taskFactsSchema = z.object({
  taskTitle: primitiveFactSchema,
  taskStatus: primitiveFactSchema,
  dueAt: primitiveFactSchema.optional(),
}).strict();

const constraintFactsSchema = z.object({
  avoidProvider: primitiveFactSchema.optional(),
  allowExternalSearch: primitiveFactSchema.optional(),
  safetyPreference: primitiveFactSchema.optional(),
}).strict();

/**
 * Validate a facts payload against the allowlist for the given kind.
 * Returns the typed record when valid; throws otherwise.
 *
 * Callers should treat any thrown `ZodError` as a hard rejection so the
 * entry never reaches the store. Negative tests assert that unknown
 * fields are rejected.
 */
export const validateFactsForKind = (kind: MemoryKind, value: unknown): Record<string, string | number | boolean> => {
  switch (kind) {
    case "preference":
      return preferenceFactsSchema.parse(value) as Record<string, string | number | boolean>;
    case "decision":
      return decisionFactsSchema.parse(value) as Record<string, string | number | boolean>;
    case "task":
      return taskFactsSchema.parse(value) as Record<string, string | number | boolean>;
    case "constraint":
      return constraintFactsSchema.parse(value) as Record<string, string | number | boolean>;
  }
};

/* ------------------------------------------------------------------ *
 * MemoryEntry — versioned persisted shape.                             *
 * ------------------------------------------------------------------ */

export const memoryTagSchema = z.string().min(1).max(40).regex(/^[^\s]+$/u, "tag must not contain whitespace");
export type MemoryTag = z.infer<typeof memoryTagSchema>;

const memoryIsoTimestampSchema = z.string().datetime({ offset: false });

const memoryEvidenceHashSchema = z.string().regex(/^[a-f0-9]{16,128}$/iu, "evidenceHash must be a hex digest");

/**
 * Use a lazy + refine pattern so the kind-specific facts schema is
 * selected by the `kind` field. Each branch is `.strict()` so unknown
 * keys fail closed.
 */
export const memoryEntrySchema = z.object({
  id: z.string().min(1).max(80),
  schemaVersion: z.literal(memorySchemaVersion),
  scope: memoryScopeSchema,
  projectId: z.string().min(1).max(120).optional(),
  kind: memoryKindSchema,
  status: memoryStatusSchema,
  summary: z.string().min(1).max(800),
  facts: z.record(primitiveFactSchema),
  tags: z.array(memoryTagSchema).max(16).default([]),
  source: memorySourceSchema,
  sensitivity: memorySensitivitySchema,
  confidence: memoryConfidenceSchema,
  evidenceHash: memoryEvidenceHashSchema.optional(),
  createdAt: memoryIsoTimestampSchema,
  updatedAt: memoryIsoTimestampSchema,
  lastUsedAt: memoryIsoTimestampSchema.optional(),
  expiresAt: memoryIsoTimestampSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.scope === "project" && !value.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scope=project entries must include projectId",
      path: ["projectId"],
    });
  }
  if (value.scope === "global" && value.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scope=global entries must not include projectId",
      path: ["projectId"],
    });
  }
  if (value.expiresAt && value.expiresAt <= value.updatedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "expiresAt must be later than updatedAt",
      path: ["expiresAt"],
    });
  }
  // Reject unknown facts keys for the entry's kind. Catch-all so we
  // never let a `record` escape hatch smuggle in secret-shaped data.
  try {
    validateFactsForKind(value.kind, value.facts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        ctx.addIssue({ ...issue, path: ["facts", ...issue.path] });
      }
    } else {
      throw error;
    }
  }
});

export type MemoryEntry = z.infer<typeof memoryEntrySchema>;

/** Top-level on-disk shape (MEM-MVP-005). */
export const memoryFileSchema = z.object({
  schemaVersion: z.literal(memorySchemaVersion),
  updatedAt: memoryIsoTimestampSchema,
  entries: z.array(memoryEntrySchema).max(500),
}).strict();
export type MemoryFile = z.infer<typeof memoryFileSchema>;

/* ------------------------------------------------------------------ *
 * MemorySettings (MEM-MVP-007).                                       *
 * ------------------------------------------------------------------ */

export const memorySettingsSchema = z.object({
  useMemory: z.boolean(),
  generateMemory: z.boolean(),
  externalContextProtection: z.boolean(),
  defaultScope: memoryScopeSchema,
  // Server-resolved opaque projectId; browser never sends a filesystem
  // path here (MEM-MVP-011). Keep length bounded so callers cannot use
  // the field to smuggle long opaque blobs.
  defaultProjectId: z.string().min(1).max(120).optional(),
}).strict();
export type MemorySettings = z.infer<typeof memorySettingsSchema>;

export const memorySettingsPatchSchema = memorySettingsSchema.partial().strict();
export type MemorySettingsPatch = z.infer<typeof memorySettingsPatchSchema>;

export const memorySettingsResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  settings: memorySettingsSchema,
}).strict();
export type MemorySettingsResponse = z.infer<typeof memorySettingsResponseSchema>;

/* ------------------------------------------------------------------ *
 * Planner context (MEM-MVP-008/014).                                   *
 *                                                                       *
 * Strict, allowlist-only projection of an active memory entry. The    *
 * planner never receives the store path, evidenceHash, or other       *
 * server-only fields.                                                 *
 * ------------------------------------------------------------------ */

export const plannerMemoryEntrySchema = z.object({
  id: z.string().min(1).max(80),
  kind: memoryKindSchema,
  summary: z.string().min(1).max(800),
  facts: z.record(primitiveFactSchema),
  scope: memoryScopeSchema,
}).strict();
export type PlannerMemoryEntry = z.infer<typeof plannerMemoryEntrySchema>;

export const plannerMemoryContextSchema = z.object({
  memories: z.array(plannerMemoryEntrySchema).max(5),
}).strict();
export type PlannerMemoryContext = z.infer<typeof plannerMemoryContextSchema>;

/* ------------------------------------------------------------------ *
 * HTTP wire shapes (MEM-MVP-003).                                     *
 * ------------------------------------------------------------------ */

export const memorySearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  scope: memoryScopeSchema.optional(),
  projectId: z.string().min(1).max(120).optional(),
  kinds: z.array(memoryKindSchema).max(4).optional(),
  limit: z.number().int().min(1).max(5).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.scope === "project" && !value.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scope=project requires projectId",
      path: ["projectId"],
    });
  }
  if (value.scope === "global" && value.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scope=global must not include projectId",
      path: ["projectId"],
    });
  }
});
export type MemorySearchRequest = z.infer<typeof memorySearchRequestSchema>;

export const memorySearchResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  memories: z.array(plannerMemoryEntrySchema).max(5),
}).strict();
export type MemorySearchResponse = z.infer<typeof memorySearchResponseSchema>;

export const memoryListResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  entries: z.array(memoryEntrySchema).max(500),
}).strict();
export type MemoryListResponse = z.infer<typeof memoryListResponseSchema>;

export const memoryEntryResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  entry: memoryEntrySchema,
}).strict();
export type MemoryEntryResponse = z.infer<typeof memoryEntryResponseSchema>;

export const memoryAckResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  ok: z.literal(true),
}).strict();
export type MemoryAckResponse = z.infer<typeof memoryAckResponseSchema>;

/** Body for approve: caller cannot change summary/facts; just promotes status. */
export const memoryApproveRequestSchema = z.object({
  /** Optional explicit confidence override (still bounded to the enum). */
  confidence: memoryConfidenceSchema.optional(),
}).strict();
export type MemoryApproveRequest = z.infer<typeof memoryApproveRequestSchema>;

/** Body for clear: explicit scope + confirm=true (no shortcuts, MEM-MVP-008.1). */
export const memoryClearRequestSchema = z.object({
  scope: memoryScopeSchema,
  projectId: z.string().min(1).max(120).optional(),
  confirm: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.scope === "project" && !value.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "scope=project requires projectId",
      path: ["projectId"],
    });
  }
});
export type MemoryClearRequest = z.infer<typeof memoryClearRequestSchema>;

/** Export shape: stable, redacted view that contains no path / secret / raw evidence. */
export const memoryExportResponseSchema = z.object({
  contractVersion: z.literal(memoryApiContractVersion),
  requestId: z.string().min(1).max(80),
  exportedAt: memoryIsoTimestampSchema,
  file: memoryFileSchema,
}).strict();
export type MemoryExportResponse = z.infer<typeof memoryExportResponseSchema>;

/** Body for post-run contribution (MEM-MVP-015). Browser sends a redacted summary;
 *  the gateway's idle extractor decides whether to convert it into a candidate. */
export const memoryContributionRequestSchema = z.object({
  projectId: z.string().min(1).max(120).optional(),
  sessionId: z.string().min(1).max(80),
  userInput: z.string().min(1).max(800),
  summary: z.string().max(800).optional(),
  outcome: z.enum(["presenting", "clarifying", "cancelled", "failed", "safety-confirmed", "fallback"]),
  usedExternalContext: z.boolean(),
  /** Safe planner tool ids used for the gateway-side policy decision. */
  toolIds: z.array(z.string().min(1).max(120)).max(8).optional(),
}).strict();
export type MemoryContributionRequest = z.infer<typeof memoryContributionRequestSchema>;
