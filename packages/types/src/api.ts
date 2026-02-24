// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  code: number
  message: string
  details?: Record<string, unknown>
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
}

export type RequestStatus = "idle" | "pending" | "success" | "error"
