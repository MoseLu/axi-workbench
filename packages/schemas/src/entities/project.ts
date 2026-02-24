import { z } from "zod"
import { UUIDSchema } from "../common"

export const ProjectStatusEnum = z.enum(["active", "archived", "draft", "completed"])

export const ProjectSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  status: ProjectStatusEnum,
  ownerId: UUIDSchema,
  teamId: UUIDSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Project = z.infer<typeof ProjectSchema>
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>
