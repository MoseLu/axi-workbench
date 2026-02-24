import { z } from "zod"

export const ErrorResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
})

export const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
  errors: z.array(ValidationErrorSchema),
})
