import { z } from "zod";
export * from "./gateway";
export * from "./routes";
export * from "./failures";
export * from "./health";
export * from "./memory";
export * from "./session";
export * from "./runtime";
export * from "./http-api";
export * from "./resource-search";
export * from "./rule-waiver";
export * from "./eps";

export const resourceKindSchema = z.string().min(1).max(80);
export const operationSchema = z.enum(["search", "inspect", "preview", "generate"]);
export const imageOrientationSchema = z.enum(["original", "landscape", "portrait"]);
export const safetySchema = z.enum(["safe", "flagged", "blocked"]);
export const runStateSchema = z.enum([
  "idle",
  "interpreting",
  "planning",
  "executing",
  "validating",
  "presenting",
  "clarifying",
  "failed",
  "cancelled",
  "image-searching",
  "image-empty-fallback-searching",
  "composing-prompt",
  "image-generating",
]);

export const provenanceSchema = z.object({
  provider: z.string().min(1),
  ref: z.string().min(1),
  version: z.string().optional(),
});

export const resourceCandidateSchema = z.object({
  id: z.string().min(1),
  kind: resourceKindSchema,
  title: z.string().min(1),
  preview: z.string().optional(),
  facts: z.record(z.unknown()),
  provenance: provenanceSchema,
  safety: safetySchema,
});

export const intentSchema = z.object({
  operation: operationSchema,
  resourceKinds: z.array(resourceKindSchema).max(8).default([]),
  constraints: z.record(z.unknown()),
  needsClarification: z.boolean(),
  clarificationReason: z.string().max(400).optional(),
});

export const toolCallSchema = z.object({
  toolId: z.string().min(1).max(120),
  input: z.record(z.unknown()),
  readFrom: z.array(z.object({
    step: z.number().int().min(0).max(8),
    kind: resourceKindSchema,
    factKey: z.string().min(1).max(120),
  })).max(8).optional(),
});

export const clarificationOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
});

export const plannerResultSchema = z.object({
  intent: intentSchema,
  calls: z.array(toolCallSchema).max(3),
  pipeline: z.array(toolCallSchema).max(6).optional(),
  explanation: z.string().max(800).optional(),
  clarification: z.array(clarificationOptionSchema).max(6).optional(),
}).refine(
  (value) => !(value.calls.length && value.pipeline?.length),
  { message: "calls and pipeline are mutually exclusive" },
);

export type ResourceKind = z.infer<typeof resourceKindSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type ImageOrientation = z.infer<typeof imageOrientationSchema>;
export type SafetyClass = z.infer<typeof safetySchema>;
export type RunState = z.infer<typeof runStateSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type ResourceCandidate = z.infer<typeof resourceCandidateSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;
export type PlannerResult = z.infer<typeof plannerResultSchema>;

export type SearchConfidence = "high" | "medium" | "low";

export interface AdapterDescriptor {
  id: string;
  label: string;
  resourceKinds: string[];
  capabilities: Array<"search" | "inspect" | "preview" | "generate">;
  toolId?: string;
}

export interface AdapterSearchResult {
  items: ResourceCandidate[];
  sourceVersion: string;
  confidence: SearchConfidence;
  clarification?: ClarificationOption[];
  warnings?: string[];
  mode: "live" | "fixture";
  /** 1-based page of the provider catalog. 12 is the page size, not the catalog cap. */
  page?: number;
  pageSize?: number;
  totalItems?: number;
  hasMore?: boolean;
}

export interface ResourceAdapter {
  descriptor: AdapterDescriptor;
  search(intent: Intent, signal?: AbortSignal): Promise<AdapterSearchResult>;
}

export interface ToolDefinition {
  id: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  access: "read_only";
  resourceKinds: string[];
}

export interface RunEvent {
  state: RunState;
  label: string;
  detail?: string;
  at: string;
}

export interface RunResult {
  runId: string;
  requestKey: string;
  state: RunState;
  planner: string;
  intent?: Intent;
  explanation?: string;
  items: ResourceCandidate[];
  clarification?: ClarificationOption[];
  warnings: string[];
  trace: RunEvent[];
  error?: string;
  fromCache?: boolean;
  /** Browser-only metadata used to enforce memory generation policy. */
  memoryMetadata?: {
    toolIds: string[];
    usedExternalContext: boolean;
  };
}
