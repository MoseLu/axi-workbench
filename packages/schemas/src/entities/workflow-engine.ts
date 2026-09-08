import { z } from "zod"
import { UUIDSchema } from "../common"

const WorkflowEngineJsonObjectSchema = z.record(z.string(), z.unknown())

/** Runtime status values published by the durable Python workflow engine. */
export const WorkflowEngineWorkflowStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "waiting_approval",
])

export const WorkflowEngineStepStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "waiting",
])

export const WorkflowEngineStepTypeEnum = z.enum([
  "task",
  "condition",
  "delay",
  "parallel",
  "http",
  "approval",
  "bounded_agent",
  "approved_effect",
])

export const WorkflowEngineApprovalStatusEnum = z.enum(["pending", "approved", "rejected"])

export const WorkflowEngineStepSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1),
  step_type: WorkflowEngineStepTypeEnum,
  config: WorkflowEngineJsonObjectSchema.default({}),
  status: WorkflowEngineStepStatusEnum,
  result: WorkflowEngineJsonObjectSchema.nullable().optional(),
  error: z.string().nullable().optional(),
})

/**
 * Durable, owner-scoped review record. `effectAction` is the exact action that
 * was digest-bound before an approved effect can run.
 */
export const WorkflowEngineApprovalSchema = z.object({
  id: UUIDSchema,
  workflowId: UUIDSchema,
  stepId: UUIDSchema,
  stepName: z.string().min(1),
  prompt: z.string().min(1),
  approvers: z.array(z.string()).default([]),
  status: WorkflowEngineApprovalStatusEnum,
  requestedAt: z.coerce.date(),
  decidedAt: z.coerce.date().nullable().optional(),
  decidedBy: z.string().nullable().optional(),
  decisionComment: z.string().nullable().optional(),
  actionDigest: z.string().nullable().optional(),
  effectAction: WorkflowEngineJsonObjectSchema.nullable().optional(),
  grantPermissions: z.array(z.string()).default([]),
})

export const WorkflowEngineLifecycleEventSchema = z.object({
  schemaVersion: z.string().min(1),
  eventType: z.string().min(1),
  eventId: z.string().optional(),
  producer: z.string().optional(),
  traceId: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  occurredAt: z.coerce.date().optional(),
  payload: WorkflowEngineJsonObjectSchema.optional(),
}).passthrough()

export const WorkflowEngineExecutionSchema = z.object({
  workflow_id: UUIDSchema,
  status: WorkflowEngineWorkflowStatusEnum,
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable().optional(),
  steps: z.array(WorkflowEngineStepSchema),
  result: WorkflowEngineJsonObjectSchema.nullable().optional(),
  error: z.string().nullable().optional(),
  pendingApproval: WorkflowEngineApprovalSchema.nullable().optional(),
  routingDecisions: z.record(z.string(), WorkflowEngineJsonObjectSchema).default({}),
  lifecycleEvents: z.array(WorkflowEngineLifecycleEventSchema).default([]),
})

export const WorkflowEngineWorkflowSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  triggerTopic: z.string().nullable().optional(),
  steps: z.array(WorkflowEngineStepSchema),
  status: WorkflowEngineWorkflowStatusEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  executed_at: z.coerce.date().nullable().optional(),
  result: WorkflowEngineJsonObjectSchema.nullable().optional(),
})

export type WorkflowEngineWorkflowStatus = z.infer<typeof WorkflowEngineWorkflowStatusEnum>
export type WorkflowEngineStepStatus = z.infer<typeof WorkflowEngineStepStatusEnum>
export type WorkflowEngineStepType = z.infer<typeof WorkflowEngineStepTypeEnum>
export type WorkflowEngineApprovalStatus = z.infer<typeof WorkflowEngineApprovalStatusEnum>
export type WorkflowEngineStep = z.infer<typeof WorkflowEngineStepSchema>
export type WorkflowEngineApproval = z.infer<typeof WorkflowEngineApprovalSchema>
export type WorkflowEngineLifecycleEvent = z.infer<typeof WorkflowEngineLifecycleEventSchema>
export type WorkflowEngineExecution = z.infer<typeof WorkflowEngineExecutionSchema>
export type WorkflowEngineWorkflow = z.infer<typeof WorkflowEngineWorkflowSchema>
