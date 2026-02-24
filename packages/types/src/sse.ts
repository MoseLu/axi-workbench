// ============================================
// SSE Types
// ============================================

export type SSEMessageType = 
  | "thinking" 
  | "tool_call" 
  | "tool_result" 
  | "text" 
  | "done" 
  | "error"

export interface SSEMessage {
  type: SSEMessageType
  content?: string
  tool?: string
  toolInput?: Record<string, unknown>
  toolResult?: unknown
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  error?: string
}

export type StreamStatus = "idle" | "connecting" | "streaming" | "error" | "done"

export interface AgentStreamEvent {
  id: string
  type: SSEMessageType
  data: SSEMessage
  timestamp: number
}
