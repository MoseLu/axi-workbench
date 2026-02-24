import { z } from "zod"

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})

export const RefreshTokenInput = z.object({
  refreshToken: z.string(),
})

export const ChangePasswordInput = z.object({
  oldPassword: z.string(),
  newPassword: z.string().min(8),
})

export type LoginInput = z.infer<typeof LoginInput>
export type RegisterInput = z.infer<typeof RegisterInput>
export type RefreshTokenInput = z.infer<typeof RefreshTokenInput>
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>
