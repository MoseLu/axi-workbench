/**
 * Mini-Agent Desktop App
 */

import { useEffect } from 'react'
import { MainLayout } from '@/components/layout/MainLayout'
import { useSessionStore } from '@/stores/sessionStore'
import { useThemeStore, applyTheme } from '@/stores/themeStore'
import { registerBuiltInCommands } from '@/stores/pluginStore'

function App() {
  const { loadSessions, loadConfig, sessions, createSession } = useSessionStore()
  const { theme } = useThemeStore()

  // Apply theme on mount and when it changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Initialize plugins
  useEffect(() => {
    registerBuiltInCommands()
  }, [])

  // Initialize on mount
  useEffect(() => {
    loadConfig()
    loadSessions()
  }, [loadSessions, loadConfig])

  // Auto-create session if none exist
  useEffect(() => {
    if (sessions.length === 0) {
      createSession()
    }
  }, [sessions, createSession])

  return <MainLayout />
}

export default App
