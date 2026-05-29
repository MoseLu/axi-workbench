import { z } from "zod"
import { ProjectSchema } from "../entities/project"

export const ProjectResponse = ProjectSchema

export const ProjectListResponse = z.object({
  items: z.array(ProjectSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
})

export type ProjectResponse = z.infer<typeof ProjectResponse>
export type ProjectListResponse = z.infer<typeof ProjectListResponse>
