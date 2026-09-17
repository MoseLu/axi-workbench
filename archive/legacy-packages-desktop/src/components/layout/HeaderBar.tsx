/**
 * Header Bar Component - Top Navigation
 */

import { useTranslation } from '@/lib/useTranslation'
import { useSessionStore } from '@/stores/sessionStore'
import {
  PanelLeftClose,
  PanelLeft,
  Github,
  Bell,
  MessageCircle,
  Settings,
  Moon,
  Sun,
  User,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderBarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onToggleRightSidebar: () => void
}

export function HeaderBar({ collapsed, onToggleCollapse, onToggleRightSidebar }: HeaderBarProps) {
  const { t } = useTranslation()
  const { wsConnected } = useSessionStore()

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      {/* Left: collapse button + breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
          title={t('header.collapse')}
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Connection Status */}
        <div className="flex items-center gap-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            wsConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
          )} />
          <span className="text-xs text-muted-foreground">
            {wsConnected ? t('app.connected') : t('app.connecting')}
          </span>
        </div>
      </div>

      {/* Right: tool icons + user */}
      <div className="flex items-center gap-1">
        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors relative"
          title={t('header.github')}
        >
          <Github className="w-4 h-4" />
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors relative"
          title={t('header.international')}
        >
          <span className="text-xs font-bold">中</span>
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors relative"
          title={t('header.notifications')}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-1 text-[10px] leading-3 text-white bg-red-500 rounded-full flex items-center justify-center transform translate-x-[30%] translate-y-[-30%]">
            3
          </span>
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
          title={t('header.messages')}
        >
          <MessageCircle className="w-4 h-4" />
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
          title={t('header.preferences')}
          onClick={onToggleRightSidebar}
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors"
          title={t('header.themeSwitch')}
        >
          <Moon className="w-4 h-4" />
        </button>

        {/* User */}
        <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs max-w-16 truncate">{t('header.admin')}</span>
          <ChevronDown className="w-2 h-2 text-muted-foreground" />
        </div>
      </div>
    </header>
  )
}
