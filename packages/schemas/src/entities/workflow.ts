import { z } from "zod"
import { UUIDSchema } from "../common"

export const WorkflowStatusEnum = z.enum(["draft", "active", "paused", "archived"])

export const WorkflowDefinitionSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  definition: z.record(z.string(), z.unknown()), // DAG JSON
  status: WorkflowStatusEnum,
  createdBy: UUIDSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const WorkflowInstanceStatusEnum = z.enum([
  "pending", "running", "completed", "failed", "cancelled"
])

export const WorkflowInstanceSchema = z.object({
  id: UUIDSchema,
  workflowId: UUIDSchema,
  status: WorkflowInstanceStatusEnum,
  triggeredBy: UUIDSchema,
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  error: z.string().optional(),
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>
export type WorkflowInstance = z.infer<typeof WorkflowInstanceSchema>
