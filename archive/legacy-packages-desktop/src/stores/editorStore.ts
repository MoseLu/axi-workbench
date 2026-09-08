/**
 * Zustand store for editor tab management
 */

import { create } from 'zustand'

export interface EditorTab {
  id: string
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  
  // Actions
  openTab: (path: string, content: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string) => void
  updateTabContent: (tabId: string, content: string) => void
  markTabClean: (tabId: string) => void
  getActiveTab: () => EditorTab | null
  getTabByPath: (path: string) => EditorTab | null
}

const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'md': 'markdown',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sql': 'sql',
    'sh': 'shell',
    'ps1': 'powershell',
    'xml': 'xml',
  }
  return langMap[ext || ''] || 'plaintext'
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openTab: (path: string, content: string) => {
    const { tabs } = get()
    
    // Check if tab already exists
    const existingTab = tabs.find(t => t.path === path)
    if (existingTab) {
      set({ activeTabId: existingTab.id })
      return
    }

    // Create new tab
    const name = path.split(/[/\\]/).pop() || path
    const newTab: EditorTab = {
      id: `tab-${Date.now()}`,
      path,
      name,
      content,
      language: getLanguageFromPath(path),
      isDirty: false,
    }

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    })
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get()
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    
    if (tabIndex === -1) return

    const newTabs = tabs.filter(t => t.id !== tabId)
    
    // Update active tab
    let newActiveId = activeTabId
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // Activate the previous tab, or the first tab
        const newIndex = Math.min(tabIndex, newTabs.length - 1)
        newActiveId = newTabs[newIndex].id
      } else {
        newActiveId = null
      }
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
    })
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId })
  },

  updateTabContent: (tabId: string, content: string) => {
    set((state) => ({
      tabs: state.tabs.map(tab =>
        tab.id === tabId
          ? { ...tab, content, isDirty: true }
          : tab
      ),
    }))
  },

  markTabClean: (tabId: string) => {
    set((state) => ({
      tabs: state.tabs.map(tab =>
        tab.id === tabId
          ? { ...tab, isDirty: false }
          : tab
      ),
    }))
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get()
    return tabs.find(t => t.id === activeTabId) || null
  },

  getTabByPath: (path: string) => {
    const { tabs } = get()
    return tabs.find(t => t.path === path) || null
  },
}))
