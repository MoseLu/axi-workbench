/**
 * Main Layout Component - Full UI with TabBar and Routing
 */

import { useState, useEffect, useCallback } from 'react'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { CodeEditor } from '@/components/editor/CodeEditor'
import { TerminalPanel } from '@/components/terminal/TerminalPanel'
import { SettingsPanel } from '@/components/settings/SettingsPanel'
import { MCPPanel } from '@/components/mcp/MCPPanel'
import { SystemMonitor } from '@/components/monitor/SystemMonitor'
import { WelcomeScreen } from '@/components/layout/WelcomeScreen'
import { CommandPalette, useCommandPalette } from '@/components/layout/CommandPalette'
import { LeftSidebar } from '@/components/layout/LeftSidebar'
import { HeaderBar } from '@/components/layout/HeaderBar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { TabBar, TabItem } from '@/components/layout/TabBar'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { useThemeStore } from '@/stores/themeStore'
import { registerBuiltInCommands } from '@/stores/pluginStore'
import { useSessionStore } from '@/stores/sessionStore'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'
// Page components from multi-project-management-system
import { DashboardPage } from '@/components/pages/Dashboard'
import { TaskPage } from '@/components/pages/TaskPage'
import { MenuListPage } from '@/components/pages/MenuListPage'
import { UserListPage } from '@/components/pages/UserListPage'
import { RoleListPage } from '@/components/pages/RoleListPage'
import { ProjectPage } from '@/components/pages/ProjectPage'
import { TeamPage } from '@/components/pages/TeamPage'
import {
  MessageSquare,
  Code,
  Terminal,
  Settings,
  Server,
  Activity,
  LayoutDashboard,
  Home
} from 'lucide-react'

// Menu route mapping
const menuRouteMap: Record<string, { label: string; icon?: React.ReactNode; parent?: string; parentIcon?: React.ReactNode }> = {
  '/dashboard': { label: '仪表盘', icon: <LayoutDashboard /> },
  '/chat': { label: 'AI 聊天', icon: <MessageSquare /> },
  '/editor': { label: '代码编辑器', icon: <Code /> },
  '/terminal': { label: '终端', icon: <Terminal /> },
  '/project': { label: '项目管理', icon: <LayoutDashboard /> },
  '/task': { label: '任务列表', icon: <Terminal /> },
  '/team': { label: '团队管理', icon: <Server /> },
  '/settings/menu': { label: '菜单列表', icon: <Settings />, parent: '系统设置', parentIcon: <Settings /> },
  '/settings/user': { label: '用户列表', icon: <Server />, parent: '系统设置', parentIcon: <Settings /> },
  '/settings/role': { label: '角色列表', icon: <Settings />, parent: '系统设置', parentIcon: <Settings /> },
  '/mcp': { label: 'MCP 服务器', icon: <Server /> },
  '/monitor': { label: '系统监控', icon: <Activity /> },
}

type ViewMode = 'split' | 'chat' | 'editor' | 'terminal'

export function MainLayout() {
  const { t } = useTranslation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false)
  const [activeMenuKey, setActiveMenuKey] = useState('chat')
  const [activePath, setActivePath] = useState('/chat')
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [showSettings, setShowSettings] = useState(false)
  const [showMCP, setShowMCP] = useState(false)
  const [showMonitor, setShowMonitor] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [contentFullscreen, setContentFullscreen] = useState(false)

  // Tab state
  const [tabs, setTabs] = useState<TabItem[]>([
    { key: '/chat', label: 'AI 聊天', path: '/chat', closable: false },
  ])
  const [activeTab, setActiveTab] = useState('/chat')

  const { wsConnected } = useSessionStore()
  const { setTheme } = useThemeStore()

  // Command palette
  const { isOpen: isCommandPaletteOpen, close: closeCommandPalette } = useCommandPalette()

  // Get route info
  const getRouteInfo = (path: string) => menuRouteMap[path]

  // Build breadcrumb
  const getBreadcrumb = () => {
    const routeInfo = getRouteInfo(activePath)
    if (!routeInfo) return [{ label: '首页', icon: <Home className="w-3.5 h-3.5" /> }]

    const crumbs: { label: string; icon?: React.ReactNode }[] = [
      { label: '首页', icon: <Home className="w-3.5 h-3.5" /> }
    ]
    if (routeInfo.parent) {
      crumbs.push({ label: routeInfo.parent, icon: routeInfo.parentIcon })
    }
    crumbs.push({ label: routeInfo.label, icon: routeInfo.icon })
    return crumbs
  }

  // Handle menu click
  const handleMenuClick = useCallback((key: string, path?: string) => {
    const menuPath = path || key
    setActiveMenuKey(key)
    setActivePath(menuPath)

    // Map to view mode
    if (['chat', 'editor', 'terminal'].includes(key)) {
      setViewMode(key as ViewMode)
    } else {
      // For other pages, show split view
      setViewMode('split')
    }

    // Update tabs
    setTabs(prev => {
      if (prev.find(t => t.key === menuPath)) return prev
      return [...prev, { key: menuPath, label: getRouteInfo(menuPath)?.label || key, path: menuPath, closable: true }]
    })
    setActiveTab(menuPath)
  }, [])

  // Handle tab change
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key)
    setActivePath(key)

    // Map to view mode
    if (['chat', 'editor', 'terminal'].includes(key)) {
      setViewMode(key as ViewMode)
    } else {
      setViewMode('split')
    }
  }, [])

  // Handle tab close
  const handleTabClose = useCallback((key: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.key !== key)
      if (activeTab === key && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1]
        setActiveTab(lastTab.key)
        setActivePath(lastTab.key)
      }
      return newTabs
    })
  }, [activeTab])

  // Handle navigation
  const handleNavigate = useCallback((direction: 'back' | 'reload' | 'home') => {
    if (direction === 'home') {
      handleTabChange('/dashboard')
    } else if (direction === 'back') {
      window.history.back()
    } else {
      window.location.reload()
    }
  }, [handleTabChange])

  // Close left tabs
  const handleCloseLeft = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab)
      return prev.filter((t, i) => i >= idx || t.closable === false)
    })
  }, [activeTab])

  // Close right tabs
  const handleCloseRight = useCallback(() => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.key === activeTab)
      return prev.filter((t, i) => i <= idx || t.closable === false)
    })
  }, [activeTab])

  // Close other tabs
  const handleCloseOther = useCallback(() => {
    setTabs(prev => prev.filter(t => t.key === activeTab || t.closable === false))
  }, [activeTab])

  // Close all tabs
  const handleCloseAll = useCallback(() => {
    const pinned = tabs.filter(t => t.closable === false)
    if (pinned.length > 0) {
      const last = pinned[pinned.length - 1]
      setActiveTab(last.key)
      setActivePath(last.key)
    }
    setTabs(pinned)
  }, [tabs])

  // Initialize plugins
  useEffect(() => {
    registerBuiltInCommands()
  }, [])

  // Apply theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('mini-agent-theme')?.theme
    if (savedTheme) {
      setTheme(savedTheme)
    }
  }, [setTheme])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault()
        setViewMode(prev => prev === 'terminal' ? 'split' : 'terminal')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault()
        setViewMode('split')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault()
        setViewMode('editor')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault()
        setViewMode('terminal')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '4') {
        e.preventDefault()
        setViewMode('chat')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Render content based on path
  const renderContent = () => {
    const path = activePath

    switch (path) {
      case '/chat':
        return <ChatPanel />
      case '/editor':
        return <CodeEditor />
      case '/terminal':
        return <TerminalPanel />
      case '/dashboard':
        return <DashboardPage />
      case '/project':
        return <ProjectPage />
      case '/task':
        return <TaskPage />
      case '/team':
        return <TeamPage />
      case '/settings/menu':
        return <MenuListPage />
      case '/settings/user':
        return <UserListPage />
      case '/settings/role':
        return <RoleListPage />
      default:
        return <WelcomeScreen />
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          activeKey={activeMenuKey}
          onMenuClick={handleMenuClick}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header Bar */}
          <HeaderBar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onToggleRightSidebar={() => setRightSidebarVisible(!rightSidebarVisible)}
          />

          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTab={activeTab}
            isFullscreen={contentFullscreen}
            onTabChange={handleTabChange}
            onTabClose={handleTabClose}
            onNavigate={handleNavigate}
            onToggleFullscreen={() => {
              setContentFullscreen(!contentFullscreen)
            }}
            onCloseLeft={handleCloseLeft}
            onCloseRight={handleCloseRight}
            onCloseOther={handleCloseOther}
            onCloseAll={handleCloseAll}
          />

          {/* Breadcrumb */}
          <BreadcrumbBar items={getBreadcrumb()} />

          {/* Content */}
          <div className={cn("flex-1 flex overflow-hidden", contentFullscreen && "fixed inset-0 z-50 bg-background")}>
            {viewMode === 'split' && (
              <>
                <div className="flex-1 border-r">
                  <CodeEditor />
                </div>
                <div className="w-96 border-r">
                  <TerminalPanel />
                </div>
                <aside className="w-96">
                  <ChatPanel />
                </aside>
              </>
            )}

            {viewMode === 'chat' && (
              <main className="flex-1">
                {renderContent()}
              </main>
            )}

            {viewMode === 'editor' && (
              <main className="flex-1">
                <CodeEditor />
              </main>
            )}

            {viewMode === 'terminal' && (
              <main className="flex-1">
                <TerminalPanel />
              </main>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <RightSidebar
        visible={rightSidebarVisible}
        onClose={() => setRightSidebarVisible(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={closeCommandPalette}
        commands={[
          { id: 'chat', label: t('sidebar.chat'), icon: MessageSquare, category: 'View', action: () => { handleMenuClick('chat', '/chat'); closeCommandPalette() } },
          { id: 'editor', label: t('sidebar.editor'), icon: Code, category: 'View', action: () => { handleMenuClick('editor', '/editor'); closeCommandPalette() } },
          { id: 'terminal', label: t('sidebar.terminal'), icon: Terminal, category: 'View', action: () => { handleMenuClick('terminal', '/terminal'); closeCommandPalette() } },
          { id: 'settings', label: t('sidebar.settings'), icon: Settings, category: 'App', action: () => { setShowSettings(true); closeCommandPalette() } },
          { id: 'mcp', label: t('sidebar.mcpServers'), icon: Server, category: 'App', action: () => { setShowMCP(true); closeCommandPalette() } },
          { id: 'monitor', label: t('sidebar.systemMonitor'), icon: Activity, category: 'App', action: () => { setShowMonitor(true); closeCommandPalette() } },
        ]}
      />

      {/* Panels */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <MCPPanel
        isOpen={showMCP}
        onClose={() => setShowMCP(false)}
      />

      {showMonitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[600px] h-[500px] bg-gray-900 rounded-lg shadow-xl border border-gray-700">
            <SystemMonitor onClose={() => setShowMonitor(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
