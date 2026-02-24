import { z } from "zod"
import { UUIDSchema } from "../common"

export const NotificationTypeEnum = z.enum(["info", "success", "warning", "error"])
export const NotificationChannelEnum = z.enum(["in_app", "email", "webhook"])

export const NotificationSchema = z.object({
  id: UUIDSchema,
  userId: UUIDSchema,
  type: NotificationTypeEnum,
  title: z.string().min(1).max(200),
  content: z.string(),
  channel: NotificationChannelEnum,
  read: z.boolean().default(false),
  createdAt: z.coerce.date(),
})

export type Notification = z.infer<typeof NotificationSchema>
export type NotificationType = z.infer<typeof NotificationTypeEnum>
