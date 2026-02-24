import { z } from "zod"

export const SortOrderEnum = z.enum(["asc", "desc"])

export const SortSchema = z.object({
  field: z.string(),
  order: SortOrderEnum,
})

export type SortOrder = z.infer<typeof SortOrderEnum>
export type Sort = z.infer<typeof SortSchema>
