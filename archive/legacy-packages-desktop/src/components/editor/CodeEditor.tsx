/**
 * Enhanced Code Editor with Tabs and File Tree
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import Editor, { OnMount, OnChange } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { FileTree } from './FileTree'
import { useEditorStore, EditorTab } from '@/stores/editorStore'
import { useSessionStore } from '@/stores/sessionStore'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'
import {
  Save,
  FileCode,
  X,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react'

export function CodeEditor() {
  const { t } = useTranslation()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [showFileTree, setShowFileTree] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const { 
    tabs, 
    activeTabId, 
    openTab, 
    closeTab, 
    setActiveTab, 
    updateTabContent,
    markTabClean,
    getActiveTab 
  } = useEditorStore()
  
  const { currentSessionId } = useSessionStore()

  const activeTab = getActiveTab()

  // Handle editor mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: true },
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      bracketPairColorization: { enabled: true },
      padding: { top: 8 },
    })

    // Define custom theme
    monaco.editor.defineTheme('mini-agent-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#858585',
        'editorCursor.foreground': '#aeafad',
        'editor.selectionBackground': '#264f78',
        'editor.lineHighlightBackground': '#2a2d2e',
      },
    })
    monaco.editor.setTheme('mini-agent-dark')

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })
  }

  // Handle content change
  const handleEditorChange: OnChange = (value) => {
    if (activeTabId && value !== undefined) {
      updateTabContent(activeTabId, value)
    }
  }

  // Save current file
  const handleSave = useCallback(async () => {
    if (!activeTab || !activeTab.isDirty || !currentSessionId) return

    setSaving(true)
    try {
      await api.writeFile(currentSessionId, activeTab.path, activeTab.content)
      markTabClean(activeTab.id)
    } catch (error) {
      console.error('Failed to save file:', error)
    } finally {
      setSaving(false)
    }
  }, [activeTab, currentSessionId, markTabClean])

  // Load file when tab is opened
  useEffect(() => {
    const handleOpenFile = async (event: Event) => {
      const customEvent = event as CustomEvent<{ name: string; path: string }>
      const { path } = customEvent.detail
      
      if (!currentSessionId) return

      try {
        const { content } = await api.readFile(currentSessionId, path)
        openTab(path, content)
      } catch (error) {
        console.error('Failed to open file:', error)
      }
    }

    window.addEventListener('openFile', handleOpenFile)
    return () => window.removeEventListener('openFile', handleOpenFile)
  }, [currentSessionId, openTab])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+W to close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        if (activeTabId) {
          closeTab(activeTabId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, closeTab])

  return (
    <div className={cn("flex h-full", isFullscreen && "fixed inset-0 z-50 bg-background")}>
      {/* File Tree Sidebar */}
      <div 
        className={cn(
          "border-r bg-card transition-all duration-200",
          showFileTree ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <FileTree />
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-2 py-1 border-b bg-card">
          <button
            onClick={() => setShowFileTree(!showFileTree)}
            className="p-1 hover:bg-accent rounded"
            title={showFileTree ? t('editor.hideSidebar') : t('editor.showSidebar')}
          >
            {showFileTree ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeft className="h-4 w-4" />
            )}
          </button>

          {/* Tab Bar */}
          <div className="flex-1 flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-sm rounded cursor-pointer hover:bg-accent min-w-0",
                  activeTabId === tab.id && "bg-accent"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <FileCode className="h-3 w-3 flex-shrink-0" />
                <span className="truncate max-w-[100px]">{tab.name}</span>
                {tab.isDirty && (
                  <span className="text-xs text-muted-foreground">●</span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="p-0.5 hover:bg-destructive/20 rounded ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <button
            onClick={handleSave}
            disabled={!activeTab?.isDirty || saving}
            className="p-1 hover:bg-accent rounded disabled:opacity-50"
            title={t('editor.save') + ' (Ctrl+S)'}
          >
            <Save className={cn("h-4 w-4", saving && "animate-pulse")} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-accent rounded"
            title={isFullscreen ? t('editor.exitFullscreen') : t('editor.fullscreen')}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1">
          {activeTab ? (
            <Editor
              height="100%"
              language={activeTab.language}
              value={activeTab.content}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              theme="mini-agent-dark"
              options={{
                readOnly: false,
                minimap: { enabled: true },
                fontSize: 14,
              }}
              loading={
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('editor.loading')}
                </div>
              }
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-editor">
              <div className="text-center">
                <FileCode className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">{t('editor.noFileOpen')}</p>
                <p className="text-sm mt-2">
                  {t('editor.selectFileOrCreate')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
