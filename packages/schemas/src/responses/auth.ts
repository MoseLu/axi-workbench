import { z } from "zod"
import { UserSchema } from "../entities/user"

export const TokenResponse = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
})

export const UserResponse = UserSchema

export const LoginResponse = z.object({
  user: UserResponse,
  tokens: TokenResponse,
})

export type TokenResponse = z.infer<typeof TokenResponse>
export type UserResponse = z.infer<typeof UserResponse>
export type LoginResponse = z.infer<typeof LoginResponse>
