/**
 * Plugin System for Mini-Agent Desktop
 * 
 * This is a basic plugin system that allows extending functionality.
 * Plugins can register new tools, views, or commands.
 */

import { create } from 'zustand'

export interface Plugin {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  
  // Lifecycle hooks
  onLoad?: () => Promise<void> | void
  onUnload?: () => Promise<void> | void
  
  // Registered features
  commands?: Command[]
  tools?: Tool[]
  views?: View[]
}

export interface Command {
  id: string
  name: string
  shortcut?: string
  handler: () => void | Promise<void>
}

export interface Tool {
  id: string
  name: string
  description?: string
  execute: (params: unknown) => Promise<unknown>
}

export interface View {
  id: string
  name: string
  component?: React.ComponentType
  render?: () => React.ReactNode
}

interface PluginState {
  plugins: Plugin[]
  commands: Command[]
  
  // Actions
  registerPlugin: (plugin: Plugin) => void
  unregisterPlugin: (pluginId: string) => void
  executeCommand: (commandId: string) => Promise<void>
  getCommands: () => Command[]
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  commands: [],

  registerPlugin: async (plugin) => {
    const { plugins, commands } = get()
    
    // Check if already registered
    if (plugins.find(p => p.id === plugin.id)) {
      console.warn(`Plugin ${plugin.id} is already registered`)
      return
    }

    // Call onLoad hook
    if (plugin.onLoad) {
      await plugin.onLoad()
    }

    // Collect commands from plugin
    const newCommands = plugin.commands || []

    set({
      plugins: [...plugins, plugin],
      commands: [...commands, ...newCommands],
    })

    console.log(`Plugin ${plugin.name} loaded`)
  },

  unregisterPlugin: async (pluginId) => {
    const { plugins, commands } = get()
    const plugin = plugins.find(p => p.id === pluginId)
    
    if (!plugin) return

    // Call onUnload hook
    if (plugin.onUnload) {
      await plugin.onUnload()
    }

    // Remove plugin commands
    const pluginCommandIds = new Set(plugin.commands?.map(c => c.id) || [])
    const remainingCommands = commands.filter(c => !pluginCommandIds.has(c.id))

    set({
      plugins: plugins.filter(p => p.id !== pluginId),
      commands: remainingCommands,
    })

    console.log(`Plugin ${plugin.name} unloaded`)
  },

  executeCommand: async (commandId) => {
    const { commands } = get()
    const command = commands.find(c => c.id === commandId)
    
    if (!command) {
      console.warn(`Command ${commandId} not found`)
      return
    }

    try {
      await command.handler()
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error)
    }
  },

  getCommands: () => get().commands,
}))

// Built-in commands registry for theme switching
export const registerBuiltInCommands = () => {
  const { registerPlugin } = usePluginStore.getState()
  
  registerPlugin({
    id: 'builtin-commands',
    name: 'Built-in Commands',
    version: '1.0.0',
    description: 'Core commands for the application',
    commands: [
      {
        id: 'command.toggleTheme',
        name: 'Toggle Theme',
        shortcut: 'Ctrl+Shift+T',
        handler: () => {
          const { toggleTheme } = require('@/stores/themeStore').useThemeStore.getState()
          toggleTheme()
        },
      },
      {
        id: 'command.toggleSidebar',
        name: 'Toggle Sidebar',
        shortcut: 'Ctrl+B',
        handler: () => {
          window.dispatchEvent(new CustomEvent('toggleSidebar'))
        },
      },
      {
        id: 'command.showSettings',
        name: 'Show Settings',
        shortcut: 'Ctrl+,',
        handler: () => {
          window.dispatchEvent(new CustomEvent('showSettings'))
        },
      },
    ],
  })
}
