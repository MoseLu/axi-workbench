/**
 * File Tree Component with lazy loading
 */

import { useState, useEffect } from 'react'
import {
  FileCode,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileJson,
  FileText,
  Image,
  File,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useSessionStore } from '@/stores/sessionStore'
import { useTranslation } from '@/lib/useTranslation'

interface FileNode {
  name: string
  path: string
  is_directory: boolean
  children?: FileNode[]
}

export function FileTree() {
  const { t } = useTranslation()
  const [files, setFiles] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentSessionId, config } = useSessionStore()

  // Load root files
  useEffect(() => {
    if (currentSessionId) {
      loadFiles('.')
    }
  }, [currentSessionId])

  const loadFiles = async (path: string) => {
    if (!currentSessionId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const result = await api.listFiles(currentSessionId, path)
      
      if (path === '.') {
        setFiles(result)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFolder = async (node: FileNode) => {
    const newExpanded = new Set(expandedFolders)
    
    if (newExpanded.has(node.path)) {
      newExpanded.delete(node.path)
    } else {
      newExpanded.add(node.path)
      // Load children if not already loaded
      if (!node.children) {
        try {
          const children = await api.listFiles(currentSessionId!, node.path)
          // Update the node with children
          updateNodeWithChildren(files, node.path, children)
        } catch (err) {
          console.error('Failed to load folder:', err)
        }
      }
    }
    
    setExpandedFolders(newExpanded)
  }

  const updateNodeWithChildren = (nodes: FileNode[], path: string, children: FileNode[]) => {
    const update = (items: FileNode[]): FileNode[] => {
      return items.map(item => {
        if (item.path === path) {
          return { ...item, children }
        }
        if (item.children) {
          return { ...item, children: update(item.children) }
        }
        return item
      })
    }
    setFiles(prev => update(prev))
  }

  const getFileIcon = (name: string, isDirectory: boolean) => {
    if (isDirectory) {
      return expandedFolders.has(name) ? 
        <FolderOpen className="h-4 w-4 text-yellow-500" /> : 
        <Folder className="h-4 w-4 text-yellow-500" />
    }
    
    const ext = name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'py':
      case 'rs':
      case 'go':
        return <FileCode className="h-4 w-4 text-blue-400" />
      case 'json':
      case 'yaml':
      case 'yml':
      case 'toml':
        return <FileJson className="h-4 w-4 text-orange-400" />
      case 'md':
      case 'txt':
        return <FileText className="h-4 w-4 text-gray-400" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image className="h-4 w-4 text-purple-400" />
      default:
        return <File className="h-4 w-4 text-gray-400" />
    }
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const hasChildren = node.is_directory && node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-accent text-sm",
            "select-none"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            if (node.is_directory) {
              toggleFolder(node)
            } else {
              // Emit event to open file
              window.dispatchEvent(new CustomEvent('openFile', { detail: node }))
            }
          }}
        >
          {node.is_directory ? (
            <>
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              {getFileIcon(node.name, true)}
            </>
          ) : (
            <>
              <span className="w-3 flex-shrink-0" />
              {getFileIcon(node.name, false)}
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        
        {node.is_directory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
        
        {node.is_directory && isExpanded && (!node.children || node.children.length === 0) && hasChildren === false && (
          <div
            className="text-xs text-muted-foreground italic"
            style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
          >
            {t('general.loading')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="font-semibold text-sm">{t('fileTree.explorer')}</h3>
        <button
          onClick={() => loadFiles('.')}
          className="p-1 hover:bg-accent rounded"
          title={t('general.refresh')}
        >
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
        </button>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {error && (
          <div className="px-2 py-1 text-xs text-destructive">
            {error}
          </div>
        )}

        {!currentSessionId && (
          <div className="px-2 py-4 text-center text-muted-foreground text-sm">
            <p>{t('chat.noSessionActive')}</p>
            <p className="text-xs mt-1">{t('chat.createNewSession')}</p>
          </div>
        )}

        {currentSessionId && !error && files.length === 0 && !loading && (
          <div className="px-2 py-4 text-center text-muted-foreground text-sm">
            <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{t('editor.noFileOpen')}</p>
          </div>
        )}
        
        {files.map(node => renderNode(node))}
        
        {loading && files.length === 0 && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Workspace Info */}
      {config && (
        <div className="p-2 border-t text-xs text-muted-foreground">
          <span className="truncate block" title={config.workspace_dir}>
            📁 {config.workspace_dir}
          </span>
        </div>
      )}
    </div>
  )
}
