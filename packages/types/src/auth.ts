// ============================================
// Auth Types
// ============================================

export type UserRole = "admin" | "user" | "guest"

export type Permission = 
  | "project:read" | "project:write" | "project:delete"
  | "task:read" | "task:write" | "task:delete"
  | "workflow:read" | "workflow:write" | "workflow:execute"
  | "admin:users" | "admin:settings"

export interface AuthContext {
  userId: string
  email: string
  name: string
  role: UserRole
  permissions: Permission[]
}

export interface JWTPayload {
  sub: string
  email: string
  role: UserRole
  permissions: Permission[]
  iat: number
  exp: number
}
