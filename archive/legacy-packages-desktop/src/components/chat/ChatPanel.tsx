/**
 * Chat Panel Component
 */

import { useState, useRef, useEffect } from 'react'
import { useSessionStore } from '@/stores/sessionStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'
import { Send, StopCircle, Plus, Trash2 } from 'lucide-react'

export function ChatPanel() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    messages,
    isStreaming,
    error,
    currentSessionId,
    sessions,
    createSession,
    sendMessage,
    cancelExecution,
    deleteSession,
    clearError,
  } = useSessionStore()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    
    const message = input.trim()
    setInput('')
    await sendMessage(message)
  }

  const handleNewSession = async () => {
    await createSession()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">{t('chat.title')}</h2>
        <Button variant="ghost" size="sm" onClick={handleNewSession}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Session List */}
      {sessions.length > 0 && (
        <div className="border-b p-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                "flex items-center justify-between p-2 rounded text-sm cursor-pointer hover:bg-accent",
                currentSessionId === session.id && "bg-accent"
              )}
              onClick={() => useSessionStore.getState().selectSession(session.id)}
            >
              <span className="truncate flex-1">
                {t('chat.session')} {session.id.slice(-8)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSession(session.id)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!currentSessionId && sessions.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>{t('chat.noSessionActive')}</p>
            <Button variant="link" onClick={handleNewSession} className="mt-2">
              {t('chat.createNewSession')}
            </Button>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "flex flex-col",
              message.role === 'user' ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-lg p-3",
                message.role === 'user'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {message.thinking && (
                <div className="text-xs text-muted-foreground mb-2 italic">
                  💭 {message.thinking}
                </div>
              )}
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
            <Button variant="link" size="sm" onClick={clearError} className="ml-2">
              {t('chat.dismiss')}
            </Button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentSessionId ? t('chat.typeMessage') : t('chat.createSessionFirst')}
            disabled={!currentSessionId || isStreaming}
            className="flex-1"
          />
          {isStreaming ? (
            <Button type="button" variant="destructive" size="icon" onClick={cancelExecution}>
              <StopCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!currentSessionId || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
