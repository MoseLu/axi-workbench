// ============================================
// Events Types
// ============================================

export type EventCallback<T = unknown> = (data: T) => void

export interface EventBus {
  on<T>(event: string, callback: EventCallback<T>): () => void
  off<T>(event: string, callback: EventCallback<T>): void
  emit<T>(event: string, data?: T): void
}

export interface AppEvents {
  "user:login": { userId: string }
  "user:logout": { userId: string }
  "theme:change": { mode: "light" | "dark" }
  "notification:new": { id: string; type: string }
  "project:created": { projectId: string }
  "project:updated": { projectId: string }
  "task:assigned": { taskId: string; assigneeId: string }
  "task:completed": { taskId: string }
}
