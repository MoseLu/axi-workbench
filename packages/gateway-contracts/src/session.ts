import { z } from "zod";

/**
 * SES-MVP-002/003 — Session contract.
 *
 * Two responsibilities:
 *
 *   1. The on-disk record shape (`SessionRecordSchema` + `SessionEntrySchema` +
 *      `SessionResultSnapshotSchema`). Used by `packages/session` for the
 *      versioned JSON store. Unknown fields are rejected so the JSON record
 *      does not become a free-form escape hatch for secrets, absolute paths,
 *      data URLs or raw provider payloads.
 *
 *   2. The gateway HTTP wire format (list, create, get, append, patch, delete,
 *      export). Used by `apps/gateway` to validate every `/sessions*` request
 *      before touching the store.
 *
 * Style rules (matching the rest of contracts):
 *   - Pure schemas and tiny types; no transport, no fetch, no logger,
 *     no filesystem, no React, no Node imports.
 *   - Unknown fields rejected (`.strict()` where appropriate).
 *   - Stable enums only — adding a new value is a non-breaking change;
 *     renaming or removing a value requires a contract bump.
 *
 * The session runtime is independent of memory (see `memory-runtime` ADR).
 * Date keys use the browser-local `YYYY-MM-DD`; the gateway validates
 * format and calendar date but never re-interprets timezone.
 */

export const sessionSchemaVersion = 1 as const;
export const sessionApiContractVersion = 1 as const;

/* ------------------------------------------------------------------ *
 * Enums                                                              *
 * ------------------------------------------------------------------ */

export const sessionKindSchema = z.enum(["daily", "manual"]);
export type SessionKind = z.infer<typeof sessionKindSchema>;

export const sessionStatusSchema = z.enum(["active", "archived"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const sessionEntryRoleSchema = z.enum(["user", "assistant", "system"]);
export type SessionEntryRole = z.infer<typeof sessionEntryRoleSchema>;

export const sessionEntryOutcomeSchema = z.enum([
  "running",
  "presenting",
  "clarifying",
  "failed",
  "cancelled",
  "interrupted",
]);
export type SessionEntryOutcome = z.infer<typeof sessionEntryOutcomeSchema>;

export const sessionResultStateSchema = z.enum(["presenting", "clarifying", "failed"]);
export type SessionResultState = z.infer<typeof sessionResultStateSchema>;

export const sessionResultItemKindSchema = z.enum([
  "image",
  "document",
  "skill",
  "project",
  "ui",
  "icon",
]);
export type SessionResultItemKind = z.infer<typeof sessionResultItemKindSchema>;

/* ------------------------------------------------------------------ *
 * Primitive helpers                                                  *
 * ------------------------------------------------------------------ */

const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a `YYYY-MM-DD` date key.
 *
 * The gateway does **not** re-interpret timezone. Workbench is responsible
 * for sending a browser-local date key; the gateway only enforces format
 * and calendar validity. See TODO-SESSION-MANAGEMENT-MVP.md §4.1.
 */
export const dateKeySchema = z
  .string()
  .regex(dateKeyRegex, "dateKey must match YYYY-MM-DD")
  .refine(
    (value) => {
      const [yStr, mStr, dStr] = value.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (!Number.isInteger(y) || y < 1970 || y > 9999) return false;
      if (!Number.isInteger(m) || m < 1 || m > 12) return false;
      if (!Number.isInteger(d) || d < 1 || d > 31) return false;
      const probe = new Date(Date.UTC(y, m - 1, d));
      return (
        probe.getUTCFullYear() === y &&
        probe.getUTCMonth() === m - 1 &&
        probe.getUTCDate() === d
      );
    },
    { message: "dateKey is not a real calendar date" },
  );

/**
 * Project id is an opaque, server-registered id. It must NOT look like
 * a filesystem path, URL or file URI.
 */
export const sessionProjectIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/, "projectId must be opaque (letters, digits, _ . :)")
  .refine((value) => !value.includes(".."), { message: "projectId must not contain '..'" })
  .refine((value) => !/^[a-z]+:\/\//i.test(value), { message: "projectId must not be a URI" });

export const sessionIdSchema = z
  .string()
  .min(8)
  .max(80)
  .regex(/^ses_[A-Za-z0-9_-]+$/, "sessionId must start with 'ses_' and use safe chars");

export const sessionRevisionSchema = z.number().int().min(0).max(1_000_000);

/**
 * Hard cap on a single entry's text. The store refuses longer text with
 * `session_limit`; UI surfaces a short notice and offers export / delete.
 */
export const SESSION_ENTRY_TEXT_MAX = 8_000;

export const sessionEntryTextSchema = z
  .string()
  .max(SESSION_ENTRY_TEXT_MAX, `entry text exceeds ${SESSION_ENTRY_TEXT_MAX} chars`);

/**
 * Diagnostic only. Range matches the valid IANA UTC offset span. Never
 * embedded in titles, planner prompts or storage keys.
 */
export const timezoneOffsetMinutesSchema = z.number().int().min(-840).max(840);

/* ------------------------------------------------------------------ *
 * Snapshot (the only result shape allowed in session JSON)           *
 * ------------------------------------------------------------------ */

export const sessionResultItemSchema = z
  .object({
    id: z.string().min(1).max(120),
    kind: sessionResultItemKindSchema,
    title: z.string().min(1).max(200),
    description: z.string().max(400).optional(),
    previewAvailable: z.boolean().optional(),
  })
  .strict();

export const sessionResultSnapshotSchema = z
  .object({
    state: sessionResultStateSchema,
    explanation: z.string().max(800).optional(),
    warnings: z.array(z.string().max(400)).max(8).default([]),
    items: z.array(sessionResultItemSchema).max(20),
  })
  .strict();
export type SessionResultSnapshot = z.infer<typeof sessionResultSnapshotSchema>;

/* ------------------------------------------------------------------ *
 * Entry                                                              *
 * ------------------------------------------------------------------ */

export const sessionEntrySchema = z
  .object({
    id: z.string().min(1).max(80),
    role: sessionEntryRoleSchema,
    text: sessionEntryTextSchema,
    createdAt: z.string().datetime({ offset: true }),
    runId: z.string().min(1).max(120).optional(),
    outcome: sessionEntryOutcomeSchema.optional(),
    result: sessionResultSnapshotSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.role === "assistant" && !value.outcome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assistant entries must declare an outcome",
      });
    }
    if (value.role !== "assistant" && value.outcome && value.outcome !== "running") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only assistant entries may declare a final outcome",
      });
    }
    if (value.role !== "assistant" && value.result) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only assistant entries may carry a result snapshot",
      });
    }
  });
export type SessionEntry = z.infer<typeof sessionEntrySchema>;

/* ------------------------------------------------------------------ *
 * Record                                                             *
 * ------------------------------------------------------------------ */

export const sessionRecordSchema = z
  .object({
    id: sessionIdSchema,
    schemaVersion: z.literal(1),
    projectId: sessionProjectIdSchema,
    dateKey: dateKeySchema,
    kind: sessionKindSchema,
    status: sessionStatusSchema,
    title: z.string().min(0).max(120),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    revision: sessionRevisionSchema,
    messageCount: z.number().int().min(0).max(10_000),
    lastMessagePreview: z.string().max(200).optional(),
    entries: z.array(sessionEntrySchema).max(1_000),
  })
  .strict();
export type SessionRecord = z.infer<typeof sessionRecordSchema>;

/**
 * Public, redacted projection used by HTTP responses. Mirrors `SessionRecord`
 * but enforces `entries` is already redacted and projections omit the raw
 * store-only fields. The gateway is responsible for calling the redactor
 * before sending; the schema exists so handlers cannot accidentally leak.
 */
export const sessionRecordProjectionSchema = sessionRecordSchema;
export type SessionRecordProjection = SessionRecord;

/* ------------------------------------------------------------------ *
 * HTTP requests / responses                                         *
 * ------------------------------------------------------------------ */

export const sessionListQuerySchema = z
  .object({
    dateKey: dateKeySchema,
    timezoneOffsetMinutes: timezoneOffsetMinutesSchema.optional(),
  })
  .strict();
export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

export const sessionSummarySchema = z
  .object({
    id: sessionIdSchema,
    projectId: sessionProjectIdSchema,
    dateKey: dateKeySchema,
    kind: sessionKindSchema,
    status: sessionStatusSchema,
    title: z.string().max(120),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    revision: sessionRevisionSchema,
    messageCount: z.number().int().min(0).max(10_000),
    lastMessagePreview: z.string().max(200).optional(),
  })
  .strict();
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionListResponseSchema = z
  .object({
    summaries: z.array(sessionSummarySchema).max(500),
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;

export const sessionCreateRequestSchema = z
  .object({
    projectId: sessionProjectIdSchema,
    dateKey: dateKeySchema,
    kind: sessionKindSchema,
    title: z.string().min(0).max(120).optional(),
    timezoneOffsetMinutes: timezoneOffsetMinutesSchema.optional(),
  })
  .strict();
export type SessionCreateRequest = z.infer<typeof sessionCreateRequestSchema>;

export const sessionCreateResponseSchema = z
  .object({
    session: sessionSummarySchema,
    created: z.boolean(),
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionCreateResponse = z.infer<typeof sessionCreateResponseSchema>;

export const sessionDetailResponseSchema = z
  .object({
    session: sessionRecordProjectionSchema,
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionDetailResponse = z.infer<typeof sessionDetailResponseSchema>;

export const sessionAppendEntrySchema = z
  .object({
    role: sessionEntryRoleSchema,
    text: sessionEntryTextSchema,
    runId: z.string().min(1).max(120).optional(),
    outcome: sessionEntryOutcomeSchema.optional(),
    result: sessionResultSnapshotSchema.optional(),
    expectedRevision: sessionRevisionSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.role === "assistant" && !value.outcome) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assistant append requires outcome",
      });
    }
    if (value.role !== "assistant" && value.result) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only assistant append may carry result snapshot",
      });
    }
  });
export type SessionAppendEntry = z.infer<typeof sessionAppendEntrySchema>;

export const sessionAppendRequestSchema = z
  .object({
    entry: sessionAppendEntrySchema,
    expectedRevision: sessionRevisionSchema.optional(),
  })
  .strict();
export type SessionAppendRequest = z.infer<typeof sessionAppendRequestSchema>;

export const sessionAppendResponseSchema = z
  .object({
    summary: sessionSummarySchema,
    entry: sessionEntrySchema,
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionAppendResponse = z.infer<typeof sessionAppendResponseSchema>;

export const sessionPatchSchema = z
  .object({
    title: z.string().min(0).max(120).optional(),
    status: z.enum(["active", "archived"]).optional(),
    expectedRevision: sessionRevisionSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined || value.status !== undefined,
    { message: "patch must change title or status" },
  );
export type SessionPatch = z.infer<typeof sessionPatchSchema>;

export const sessionPatchResponseSchema = z
  .object({
    summary: sessionSummarySchema,
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionPatchResponse = z.infer<typeof sessionPatchResponseSchema>;

export const sessionDeleteRequestSchema = z
  .object({
    confirm: z.literal(true),
    expectedRevision: sessionRevisionSchema.optional(),
  })
  .strict();
export type SessionDeleteRequest = z.infer<typeof sessionDeleteRequestSchema>;

export const sessionDeleteResponseSchema = z
  .object({
    deleted: z.literal(true),
    id: sessionIdSchema,
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionDeleteResponse = z.infer<typeof sessionDeleteResponseSchema>;

export const sessionExportRequestSchema = z
  .object({
    sessionId: sessionIdSchema,
  })
  .strict();
export type SessionExportRequest = z.infer<typeof sessionExportRequestSchema>;

export const sessionExportResponseSchema = z
  .object({
    session: sessionRecordProjectionSchema,
    exportedAt: z.string().datetime({ offset: true }),
    contractVersion: z.number().int().min(1),
  })
  .strict();
export type SessionExportResponse = z.infer<typeof sessionExportResponseSchema>;

/* ------------------------------------------------------------------ *
 * Active session preference (workbench-only, narrow surface)         *
 * ------------------------------------------------------------------ */

export const activeSessionPreferenceSchema = z
  .object({
    projectId: sessionProjectIdSchema,
    dateKey: dateKeySchema,
    sessionId: sessionIdSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type ActiveSessionPreference = z.infer<typeof activeSessionPreferenceSchema>;

/* ------------------------------------------------------------------ *
 * Limits (exported for UI / store to read without re-typing)         *
 * ------------------------------------------------------------------ */

export const SESSION_LIMITS = {
  /** Hard cap on a single entry text. */
  entryText: SESSION_ENTRY_TEXT_MAX,
  /** Hard cap on entries per session. */
  entriesPerSession: 1_000,
  /** Soft cap on total sessions before prompting cleanup. */
  sessions: 500,
  /** Bounded planner context window. */
  contextTurns: 12,
  contextChars: 6_000,
} as const;

/* ------------------------------------------------------------------ *
 * Bounded conversation context (planner-facing, separate from memory) *
 * ------------------------------------------------------------------ */

export const conversationTurnSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    text: sessionEntryTextSchema,
  })
  .strict();
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

/**
 * Planner-facing recent-dialogue window. The workbench/gateway may carry
 * `sessionId` / `dateKey` for routing, but the planner prompt must only
 * consume `turns` — never the store path, entry ids, or result snapshots.
 */
export const conversationContextSchema = z
  .object({
    sessionId: sessionIdSchema,
    dateKey: dateKeySchema,
    turns: z.array(conversationTurnSchema).max(SESSION_LIMITS.contextTurns),
  })
  .strict();
export type ConversationContext = z.infer<typeof conversationContextSchema>;
