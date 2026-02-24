import { z } from "zod"
import { UUIDSchema } from "../common"

export const FileMetaSchema = z.object({
  id: UUIDSchema,
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive(),
  path: z.string(),
  uploadedBy: UUIDSchema,
  createdAt: z.coerce.date(),
})

export type FileMeta = z.infer<typeof FileMetaSchema>
