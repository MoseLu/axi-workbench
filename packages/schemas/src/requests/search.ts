import { z } from "zod"

export const KBSearchInput = z.object({
  query: z.string().min(1),
  collection: z.string().optional(),
  topK: z.number().int().positive().default(5),
  filters: z.record(z.string(), z.string()).optional(),
})

export const AgentChatInput = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
  agentType: z.enum(["code", "docs", "test", "review", "research", "data"]).optional(),
  context: z.record(z.unknown()).optional(),
})

export type KBSearchInput = z.infer<typeof KBSearchInput>
export type AgentChatInput = z.infer<typeof AgentChatInput>
