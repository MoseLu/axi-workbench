import { z } from "zod"
import { ProjectSchema } from "../entities/project"

export const CreateProjectInput = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
})

export const UpdateProjectInput = CreateProjectInput.partial()

export const ProjectFilterQuery = z.object({
  status: z.enum(["active", "archived", "draft", "completed"]).optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
})

export type CreateProjectInput = z.infer<typeof CreateProjectInput>
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>
export type ProjectFilterQuery = z.infer<typeof ProjectFilterQuery>
