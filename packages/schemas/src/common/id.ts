import { z } from "zod"

export const UUIDSchema = z.string().uuid()
export const IdSchema = z.string().min(1)

export type UUID = z.infer<typeof UUIDSchema>
export type Id = z.infer<typeof IdSchema>
