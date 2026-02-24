// ============================================
// Upload Types
// ============================================

export interface FileUploadState {
  file: File
  progress: number
  status: "pending" | "uploading" | "success" | "error"
  error?: string
  response?: UploadResponse
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

export interface UploadResponse {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
}

export interface UploadError {
  code: string
  message: string
}
