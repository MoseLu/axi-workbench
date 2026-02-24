import { z } from "zod"

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
})

export type Pagination = z.infer<typeof PaginationSchema>

export const PaginationQuerySchema = PaginationSchema.extend({
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
})

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>
