/**
 * MCP Server Management Panel
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/lib/useTranslation'
import {
  Server,
  Plus,
  Trash2,
  Play,
  Square,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MCPServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  status: 'stopped' | 'starting' | 'running' | 'error'
  error?: string
}

interface MCPPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function MCPPanel({ isOpen, onClose }: MCPPanelProps) {
  const { t } = useTranslation()
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState({
    name: '',
    command: '',
    args: '',
  })

  // Load MCP servers from config
  useEffect(() => {
    if (isOpen) {
      loadServers()
    }
  }, [isOpen])

  const loadServers = async () => {
    setLoading(true)
    // Simulate loading from config
    // In production, this would call the API
    await new Promise(resolve => setTimeout(resolve, 300))
    setServers([
      {
        id: '1',
        name: 'Filesystem',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
        status: 'stopped',
      },
      {
        id: '2',
        name: 'Brave Search',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        status: 'stopped',
      },
    ])
    setLoading(false)
  }

  const handleAddServer = () => {
    if (!newServer.name || !newServer.command) return

    const server: MCPServer = {
      id: `mcp-${Date.now()}`,
      name: newServer.name,
      command: newServer.command,
      args: newServer.args.split(' ').filter(Boolean),
      status: 'stopped',
    }

    setServers(prev => [...prev, server])
    setNewServer({ name: '', command: '', args: '' })
    setShowAddForm(false)
  }

  const handleDeleteServer = (id: string) => {
    setServers(prev => prev.filter(s => s.id !== id))
  }

  const handleToggleServer = async (id: string) => {
    setServers(prev => prev.map(s => {
      if (s.id !== id) return s
      
      if (s.status === 'running') {
        return { ...s, status: 'stopped' }
      } else {
        return { ...s, status: 'starting' }
      }
    }))

    // Simulate starting/stopping
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    setServers(prev => prev.map(s => {
      if (s.id !== id) return s
      
      if (s.status === 'starting') {
        // Randomly succeed or fail for demo
        const success = Math.random() > 0.3
        return { 
          ...s, 
          status: success ? 'running' : 'error',
          error: success ? undefined : 'Failed to start server',
        }
      }
      return s
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] bg-background rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('mcp.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadServers}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-accent rounded">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Server List */}
          {servers.length === 0 && !showAddForm ? (
            <div className="text-center py-8 text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('mcp.noServersConfigured')}</p>
              <Button
                variant="link"
                onClick={() => setShowAddForm(true)}
                className="mt-2"
              >
                {t('mcp.addFirstServer')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center gap-4 p-4 border rounded-lg"
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {server.status === 'running' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {server.status === 'starting' && (
                      <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
                    )}
                    {server.status === 'error' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    {server.status === 'stopped' && (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                  </div>

                  {/* Server Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{server.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {server.command} {server.args.join(' ')}
                    </div>
                    {server.error && (
                      <div className="text-xs text-destructive mt-1">
                        {server.error}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleServer(server.id)}
                      disabled={server.status === 'starting'}
                    >
                      {server.status === 'running' ? (
                        <>
                          <Square className="h-3 w-3 mr-1" />
                          {t('mcp.stop')}
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 mr-1" />
                          {t('mcp.start')}
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteServer(server.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Form */}
          {showAddForm && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50 space-y-4">
              <h3 className="font-semibold">{t('mcp.addServer')}</h3>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('mcp.serverName')}</label>
                <Input
                  value={newServer.name}
                  onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t('mcp.serverNamePlaceholder')}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('mcp.command')}</label>
                <Input
                  value={newServer.command}
                  onChange={(e) => setNewServer(prev => ({ ...prev, command: e.target.value }))}
                  placeholder={t('mcp.commandPlaceholder')}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium">{t('mcp.arguments')}</label>
                <Input
                  value={newServer.args}
                  onChange={(e) => setNewServer(prev => ({ ...prev, args: e.target.value }))}
                  placeholder={t('mcp.argumentsPlaceholder')}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  {t('general.cancel')}
                </Button>
                <Button onClick={handleAddServer}>
                  {t('mcp.addServer')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-card">
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('mcp.addServer')}
          </Button>

          <Button onClick={onClose}>
            {t('mcp.done')}
          </Button>
        </div>
      </div>
    </div>
  )
}
