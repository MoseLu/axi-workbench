/**
 * Zustand store for session state management
 */

import { create } from 'zustand'
import { api, SessionInfo, ChatMessage, StreamChunk } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  thinking?: string
}

interface SessionState {
  // Session info
  currentSessionId: string | null
  sessions: SessionInfo[]
  
  // Chat state
  messages: Message[]
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  
  // WebSocket connection
  ws: WebSocket | null
  wsConnected: boolean
  
  // Config
  config: {
    llm_model: string
    workspace_dir: string
  } | null

  // Actions
  createSession: (workspaceDir?: string) => Promise<void>
  loadSessions: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (message: string) => Promise<void>
  cancelExecution: () => Promise<void>
  loadConfig: () => Promise<void>
  clearError: () => void
  
  // Terminal actions
  sendTerminalCommand: (sessionId: string, command: string) => Promise<{ output: string; error?: string }>
  
  // WebSocket actions
  connectWebSocket: () => void
  disconnectWebSocket: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSessionId: null,
  sessions: [],
  messages: [],
  isLoading: false,
  isStreaming: false,
  error: null,
  ws: null,
  wsConnected: false,
  config: null,

  // WebSocket connection management
  connectWebSocket: () => {
    const { ws, wsConnected } = get()
    if (ws || wsConnected) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const websocket = new WebSocket(wsUrl)

    websocket.onopen = () => {
      console.log('WebSocket connected')
      set({ wsConnected: true })
    }

    websocket.onmessage = (event) => {
      try {
        const chunk: StreamChunk = JSON.parse(event.data)
        const { currentSessionId, messages } = get()

        if (chunk.type === 'chunk') {
          // Update the last assistant message or create a new one
          set((state) => {
            const lastMessage = state.messages[state.messages.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              return {
                messages: [
                  ...state.messages.slice(0, -1),
                  {
                    ...lastMessage,
                    content: (lastMessage.content || '') + (chunk.content || ''),
                    thinking: chunk.thinking || lastMessage.thinking,
                  },
                ],
              }
            } else {
              return {
                messages: [
                  ...state.messages,
                  {
                    role: 'assistant' as const,
                    content: chunk.content || '',
                    thinking: chunk.thinking,
                  },
                ],
              }
            }
          })
        } else if (chunk.type === 'tool_call') {
          // Add tool call message
          set((state) => ({
            messages: [
              ...state.messages,
              {
                role: 'tool' as const,
                content: `🔧 ${chunk.tool_name}: ${JSON.stringify(chunk.tool_args, null, 2)}`,
              },
            ],
          }))
        } else if (chunk.type === 'tool_result') {
          // Add tool result message
          set((state) => ({
            messages: [
              ...state.messages,
              {
                role: 'tool' as const,
                content: chunk.tool_success
                  ? `✅ ${chunk.tool_name} completed`
                  : `❌ ${chunk.tool_name} failed: ${chunk.error}`,
              },
            ],
          }))
        } else if (chunk.type === 'done') {
          set({ isStreaming: false })
        } else if (chunk.type === 'error') {
          set({ error: chunk.error || 'Unknown error', isStreaming: false })
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
      set({ error: 'WebSocket connection error' })
    }

    websocket.onclose = () => {
      console.log('WebSocket disconnected')
      set({ ws: null, wsConnected: false })
    }

    set({ ws: websocket })
  },

  disconnectWebSocket: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null, wsConnected: false })
    }
  },

  createSession: async (workspaceDir: string = '.') => {
    try {
      set({ isLoading: true, error: null })
      const { session_id } = await api.createSession({
        workspace_dir: workspaceDir,
      })
      
      await get().loadSessions()
      await get().selectSession(session_id)
      
      // Ensure WebSocket is connected for streaming
      get().connectWebSocket()
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  loadSessions: async () => {
    try {
      const { sessions } = await api.listSessions()
      set({ sessions })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  selectSession: async (sessionId: string) => {
    try {
      set({ isLoading: true, error: null, messages: [] })
      
      // Get session info
      const sessionInfo = await api.getSession(sessionId)
      
      // Load chat history
      const { messages } = await api.getHistory(sessionId)
      
      set({
        currentSessionId: sessionId,
        messages: messages.map(m => ({
          role: m.role as Message['role'],
          content: m.content,
          thinking: m.thinking,
        })),
      })
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isLoading: false })
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId)
      
      const { currentSessionId } = get()
      if (currentSessionId === sessionId) {
        set({ currentSessionId: null, messages: [] })
      }
      
      await get().loadSessions()
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  sendMessage: async (message: string) => {
    const { currentSessionId, messages, ws, wsConnected } = get()
    if (!currentSessionId) return

    // Add user message immediately
    set({
      messages: [...messages, { role: 'user', content: message }],
      isStreaming: true,
      error: null,
    })

    // If WebSocket is connected, use streaming
    if (ws && wsConnected) {
      ws.send(JSON.stringify({
        type: 'chat',
        session_id: currentSessionId,
        message,
      }))
      return
    }

    // Fallback to HTTP
    try {
      const response = await api.chat(currentSessionId, {
        message,
        stream: false,
      })

      // Add assistant response
      set((state) => ({
        messages: [
          ...state.messages,
          {
            role: 'assistant',
            content: response.content,
            thinking: response.thinking,
          },
        ],
      }))
    } catch (error) {
      set({ error: (error as Error).message })
    } finally {
      set({ isStreaming: false })
    }
  },

  cancelExecution: async () => {
    const { currentSessionId, ws, wsConnected } = get()
    if (!currentSessionId) return

    // Cancel via WebSocket if connected
    if (ws && wsConnected) {
      ws.send(JSON.stringify({
        type: 'cancel',
        session_id: currentSessionId,
      }))
      set({ isStreaming: false })
      return
    }

    // Fallback to HTTP
    try {
      await api.cancelSession(currentSessionId)
      set({ isStreaming: false })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  // Terminal command execution
  sendTerminalCommand: async (sessionId: string, command: string) => {
    try {
      const response = await api.executeCommand(sessionId, { command })
      return { output: response.output || '', error: response.error }
    } catch (error) {
      return { output: '', error: (error as Error).message }
    }
  },

  loadConfig: async () => {
    try {
      const config = await api.getConfig()
      set({
        config: {
          llm_model: config.llm_model,
          workspace_dir: config.workspace_dir,
        },
      })
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  },

  clearError: () => set({ error: null }),
}))
