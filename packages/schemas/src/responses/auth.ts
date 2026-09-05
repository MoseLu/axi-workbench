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

/** 二维码会话状态 */
export const QrCodeStatus = z.enum(["pending", "confirmed", "consumed", "expired"])
export type QrCodeStatus = z.infer<typeof QrCodeStatus>

/** init 响应：Web 端拿到后渲染二维码 */
export const QrCodeInitResponse = z.object({
  qrCodeId: z.string(),
  /** 待编码到二维码的内容（base64 签名 payload，App 端验签） */
  qrCodePayload: z.string(),
  /** 二维码过期时间戳（毫秒） */
  expiresAt: z.number(),
  /** 轮询建议间隔（毫秒） */
  pollIntervalMs: z.number().int().min(500).max(10000),
})
export type QrCodeInitResponse = z.infer<typeof QrCodeInitResponse>

/** poll 响应：Web 端轮询拿到状态 */
export const QrCodePollResponse = z.object({
  qrCodeId: z.string(),
  status: QrCodeStatus,
  /** 当 status === "confirmed" 时返回 token；否则 null */
  tokens: TokenResponse.nullable(),
})
export type QrCodePollResponse = z.infer<typeof QrCodePollResponse>

/** confirm 响应：App 端拿到 token 即可登录 */
export const QrCodeConfirmResponse = z.object({
  user: UserResponse,
  tokens: TokenResponse,
})
export type QrCodeConfirmResponse = z.infer<typeof QrCodeConfirmResponse>
