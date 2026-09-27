import { z } from "zod"

export const PersonalOsLifecycleEnum = z.enum([
  "exploration",
  "building",
  "stalled",
  "usable",
  "shipped",
  "archived",
])

export const PersonalOsViewEnum = z.enum(["today", "in-progress", "stalled", "all"])
export const PersonalOsRuntimeStateEnum = z.enum(["unknown", "stopped", "running", "unhealthy"])
export const PersonalOsAgentRunStatusEnum = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "awaiting_approval",
])

const PersonalOsSourceSchema = z.object({
  project: z.literal("workspace.graph"),
  runtime: z.literal("devsvc"),
  metadata: z.literal("personal-os.sqlite"),
}).strict()

export const ProjectOverlaySchema = z.object({
  projectId: z.string().min(1),
  lifecycleOverride: PersonalOsLifecycleEnum.nullable(),
  finishLine: z.string(),
  usesAxiUi: z.boolean().nullable(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

export const AgentRunSummarySchema = z.object({
  id: z.string().min(1),
  projectId: z.string().nullable(),
  status: PersonalOsAgentRunStatusEnum,
  runtime: z.string().min(1),
  summary: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }).nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
  source: z.literal("control-plane.agent-task"),
}).strict()

export const ProjectRuntimeSchema = z.object({
  state: PersonalOsRuntimeStateEnum,
  registered: z.boolean(),
  serviceIds: z.array(z.string()),
  summary: z.string(),
  checkedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict()

export const ProjectActivitySchema = z.object({
  lastCommitAt: z.string().datetime({ offset: true }).nullable(),
  lastAgentRunAt: z.string().datetime({ offset: true }).nullable(),
  lastActivityAt: z.string().datetime({ offset: true }).nullable(),
  changedEntries: z.number().int().nonnegative(),
  clean: z.boolean().nullable(),
}).strict()

export const ProjectRelationshipsSchema = z.object({
  provides: z.array(z.string()),
  consumes: z.array(z.string()),
  consumers: z.array(z.string()),
}).strict()

export const ProjectQueueItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string(),
  partition: z.string().min(1),
  role: z.string().min(1),
  summary: z.string(),
  status: z.string(),
  lifecycle: PersonalOsLifecycleEnum,
  lifecycleSource: z.enum(["derived", "manual"]),
  overlay: ProjectOverlaySchema,
  finishLine: z.string(),
  usesAxiUi: z.boolean(),
  focus: z.boolean(),
  runtime: ProjectRuntimeSchema,
  activity: ProjectActivitySchema,
  recentAgentRuns: z.array(AgentRunSummarySchema),
  relationships: ProjectRelationshipsSchema,
  source: PersonalOsSourceSchema,
}).strict()

export const PersonalOsQueueEnvelopeSchema = z.object({
  contractVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  source: PersonalOsSourceSchema,
  view: PersonalOsViewEnum,
  focusProjectId: z.string().nullable(),
  items: z.array(ProjectQueueItemSchema),
  warnings: z.array(z.string()),
}).strict()

export const PersonalOsProjectResponseSchema = z.object({
  contractVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  project: ProjectQueueItemSchema,
  overlay: ProjectOverlaySchema.optional(),
  warnings: z.array(z.string()),
}).strict()

export const PersonalOsProjectPatchSchema = z.object({
  lifecycleOverride: PersonalOsLifecycleEnum.nullable().optional(),
  finishLine: z.string().max(500).optional(),
  usesAxiUi: z.boolean().nullable().optional(),
  revision: z.number().int().nonnegative(),
}).strict()

export const PersonalOsFocusSchema = z.object({
  projectId: z.string().nullable(),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

export const PersonalOsFocusResponseSchema = z.object({
  contractVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  focus: PersonalOsFocusSchema,
  warnings: z.array(z.string()),
}).strict()

export const PersonalOsFocusUpdateSchema = z.object({
  projectId: z.string().nullable(),
  revision: z.number().int().nonnegative(),
}).strict()

export type PersonalOsLifecycle = z.infer<typeof PersonalOsLifecycleEnum>
export type PersonalOsView = z.infer<typeof PersonalOsViewEnum>
export type PersonalOsRuntimeState = z.infer<typeof PersonalOsRuntimeStateEnum>
export type ProjectOverlay = z.infer<typeof ProjectOverlaySchema>
export type AgentRunSummary = z.infer<typeof AgentRunSummarySchema>
export type ProjectRuntime = z.infer<typeof ProjectRuntimeSchema>
export type ProjectActivity = z.infer<typeof ProjectActivitySchema>
export type ProjectQueueItem = z.infer<typeof ProjectQueueItemSchema>
export type PersonalOsQueueEnvelope = z.infer<typeof PersonalOsQueueEnvelopeSchema>
export type PersonalOsProjectResponse = z.infer<typeof PersonalOsProjectResponseSchema>
export type PersonalOsProjectPatch = z.infer<typeof PersonalOsProjectPatchSchema>
export type PersonalOsFocus = z.infer<typeof PersonalOsFocusSchema>
export type PersonalOsFocusResponse = z.infer<typeof PersonalOsFocusResponseSchema>
export type PersonalOsFocusUpdate = z.infer<typeof PersonalOsFocusUpdateSchema>
