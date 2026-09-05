/**
 * API client for Mini-Agent Desktop
 */

const API_BASE = '/api'

export interface CreateSessionRequest {
  workspace_dir?: string
  system_prompt?: string
  max_steps?: number
}

export interface ChatRequest {
  message: string
  stream?: boolean
}

export interface ChatMessage {
  role: string
  content: string
  thinking?: string
}

export interface SessionInfo {
  id: string
  workspace_dir: string
  created_at: string
  message_count: number
}

export interface StreamChunk {
  type: string
  step?: number
  thinking?: string
  content?: string
  tool_call_id?: string
  tool_name?: string
  tool_args?: Record<string, unknown>
  tool_result?: string
  tool_success?: boolean
  error?: string
  total_elapsed?: number
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || `Request failed: ${response.status}`)
    }

    return response.json()
  }

  // Session management
  async createSession(request: CreateSessionRequest): Promise<{ session_id: string }> {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async listSessions(): Promise<{ sessions: SessionInfo[] }> {
    return this.request('/sessions')
  }

  async getSession(sessionId: string): Promise<SessionInfo> {
    return this.request(`/sessions/${sessionId}`)
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}`, { method: 'DELETE' })
  }

  // Chat
  async chat(sessionId: string, request: ChatRequest): Promise<{
    content: string
    thinking: string
  }> {
    return this.request(`/sessions/${sessionId}/chat`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  async getHistory(sessionId: string): Promise<{ messages: ChatMessage[] }> {
    return this.request(`/sessions/${sessionId}/history`)
  }

  async cancelSession(sessionId: string): Promise<void> {
    await this.request(`/sessions/${sessionId}/cancel`, { method: 'POST' })
  }

  // Terminal
  async executeCommand(sessionId: string, request: { command: string }): Promise<{
    output: string
    error?: string
    exit_code: number
  }> {
    return this.request(`/sessions/${sessionId}/execute`, {
      method: 'POST',
      body: JSON.stringify(request),
    })
  }

  // Config
  async getConfig(): Promise<{
    llm_model: string
    llm_api_base?: string
    max_steps: number
    workspace_dir: string
    mcp_servers: string[]
  }> {
    return this.request('/config')
  }

  // File operations
  async listFiles(workspaceId: string, path: string = '.'): Promise<{
    name: string
    path: string
    is_directory: boolean
    children?: { name: string; path: string; is_directory: boolean }[]
  }[]> {
    return this.request(`/workspaces/${workspaceId}/files?path=${encodeURIComponent(path)}`)
  }

  async readFile(workspaceId: string, path: string): Promise<{
    content: string
    path: string
  }> {
    return this.request(`/workspaces/${workspaceId}/files/read?path=${encodeURIComponent(path)}`)
  }

  async writeFile(workspaceId: string, path: string, content: string): Promise<{
    status: string
    path: string
  }> {
    return this.request(`/workspaces/${workspaceId}/files/write`, {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    })
  }

  // Health
  async health(): Promise<{ status: string }> {
    return this.request('/health')
  }

  // Metrics & Performance
  async getMetrics(): Promise<{
    timestamp: string
    cpu_percent: number
    memory_mb: number
    memory_percent: number
    active_sessions: number
    total_requests: number
    avg_response_time_ms: number
  }> {
    return this.request('/metrics')
  }

  async getErrors(limit: number = 20): Promise<{
    errors: Array<{
      timestamp: string
      error_type: string
      message: string
      stack_trace?: string
      session_id?: string
    }>
  }> {
    return this.request(`/metrics/errors?limit=${limit}`)
  }

  async getUptime(): Promise<{ uptime_seconds: number }> {
    return this.request('/metrics/uptime')
  }

  async resetMetrics(): Promise<{ status: string }> {
    return this.request('/metrics/reset', { method: 'POST' })
  }
}

export const api = new ApiClient()
export default api
