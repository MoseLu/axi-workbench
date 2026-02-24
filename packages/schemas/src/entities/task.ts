import { z } from "zod"
import { UUIDSchema } from "../common"

export const TaskStatusEnum = z.enum(["todo", "in_progress", "review", "done", "cancelled"])
export const TaskPriorityEnum = z.enum(["low", "medium", "high", "urgent"])

export const TaskSchema = z.object({
  id: UUIDSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: TaskStatusEnum,
  priority: TaskPriorityEnum,
  projectId: UUIDSchema,
  assigneeId: UUIDSchema.optional(),
  dueDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Task = z.infer<typeof TaskSchema>
export type TaskStatus = z.infer<typeof TaskStatusEnum>
export type TaskPriority = z.infer<typeof TaskPriorityEnum>
