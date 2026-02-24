import { z } from "zod"
import { UUIDSchema } from "../common"

export const UserStatusEnum = z.enum(["active", "inactive", "suspended"])
export const UserRoleEnum = z.enum(["admin", "user", "guest"])

export const UserSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: UserRoleEnum,
  status: UserStatusEnum,
  avatar: z.string().url().optional(),
  phone: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type User = z.infer<typeof UserSchema>
export type UserStatus = z.infer<typeof UserStatusEnum>
export type UserRole = z.infer<typeof UserRoleEnum>
