import { z } from "zod"
import { TaskSchema } from "../entities/task"

export const CreateTaskInput = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
})

export const UpdateTaskInput = CreateTaskInput.partial()

export const AssignTaskInput = z.object({
  assigneeId: z.string().uuid(),
})

export const TaskFilterQuery = z.object({
  status: z.enum(["todo", "in_progress", "review", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
})

export type CreateTaskInput = z.infer<typeof CreateTaskInput>
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>
export type AssignTaskInput = z.infer<typeof AssignTaskInput>
export type TaskFilterQuery = z.infer<typeof TaskFilterQuery>
