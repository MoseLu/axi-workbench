import { z } from "zod"
import { TaskSchema } from "../entities/task"

export const TaskResponse = TaskSchema

export const TaskListResponse = z.object({
  items: z.array(TaskSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
})

export type TaskResponse = z.infer<typeof TaskResponse>
export type TaskListResponse = z.infer<typeof TaskListResponse>
