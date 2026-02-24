import { z } from "zod"
import { WorkflowDefinitionSchema } from "../entities/workflow"

export const CreateWorkflowInput = WorkflowDefinitionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
})

export const UpdateWorkflowInput = CreateWorkflowInput.partial()

export const TriggerWorkflowInput = z.object({
  workflowId: z.string().uuid(),
  inputs: z.record(z.unknown()).optional(),
})

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowInput>
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowInput>
export type TriggerWorkflowInput = z.infer<typeof TriggerWorkflowInput>
