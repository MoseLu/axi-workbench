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

/**
 * App 扫码登录协议 — Web 端发起
 * 由已登录的 Web 端调用，生成一个待扫码的二维码会话。
 */
export const QrCodeInitInput = z.object({
  /** 二维码过期时间（秒），默认 60，上限 300 */
  expiresIn: z.number().int().min(10).max(300).optional(),
})

/**
 * App 扫码登录协议 — App 端确认
 * App 扫描到 qrCodePayload 后调用，附带设备元数据用于审计。
 */
export const QrCodeConfirmInput = z.object({
  /** Web 端 init 返回的 qrCodeId */
  qrCodeId: z.string().min(1),
  /** App 端公钥签名的 payload（防止伪造） */
  signature: z.string().min(1),
  /** App 设备唯一 ID，用于后续审计和刷新 token 绑定 */
  deviceId: z.string().min(1).max(128),
  /** App 平台标识：ios / android / harmonyos */
  platform: z.enum(["ios", "android", "harmonyos"]),
  /** App 版本号 */
  appVersion: z.string().max(32).optional(),
})

export type LoginInput = z.infer<typeof LoginInput>
export type RegisterInput = z.infer<typeof RegisterInput>
export type RefreshTokenInput = z.infer<typeof RefreshTokenInput>
export type ChangePasswordInput = z.infer<typeof ChangePasswordInput>
export type QrCodeInitInput = z.infer<typeof QrCodeInitInput>
export type QrCodeConfirmInput = z.infer<typeof QrCodeConfirmInput>
