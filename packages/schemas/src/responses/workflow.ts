import { z } from "zod"
import { WorkflowDefinitionSchema, WorkflowInstanceSchema } from "../entities/workflow"

export const WorkflowResponse = WorkflowDefinitionSchema
export const WorkflowInstanceResponse = WorkflowInstanceSchema

export const WorkflowListResponse = z.object({
  items: z.array(WorkflowDefinitionSchema),
  total: z.number().int(),
})

export const WorkflowInstanceListResponse = z.object({
  items: z.array(WorkflowInstanceSchema),
  total: z.number().int(),
})

export type WorkflowResponse = z.infer<typeof WorkflowResponse>
export type WorkflowListResponse = z.infer<typeof WorkflowListResponse>
export type WorkflowInstanceResponse = z.infer<typeof WorkflowInstanceResponse>
export type WorkflowInstanceListResponse = z.infer<typeof WorkflowInstanceListResponse>
