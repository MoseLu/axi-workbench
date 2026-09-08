/**
 * Left Sidebar Component - Navigation Menu
 */

import { useState } from 'react'
import { useTranslation } from '@/lib/useTranslation'
import {
  MessageSquare,
  Code,
  Terminal,
  Server,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Bot,
  X,
  LayoutDashboard,
  FolderKanban,
  Users,
  List
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MenuItemType {
  key: string
  path?: string
  icon: React.ReactNode
  label: string
  children?: MenuItemType[]
}

interface SidebarProps {
  collapsed: boolean
  onCollapse: (collapsed: boolean) => void
  activeKey: string
  onMenuClick: (key: string, path?: string) => void
}

export function LeftSidebar({ collapsed, onCollapse, activeKey, onMenuClick }: SidebarProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['system']))

  const menuData: MenuItemType[] = [
    {
      key: 'chat',
      path: '/chat',
      icon: <MessageSquare className="w-4 h-4" />,
      label: t('sidebar.chat'),
    },
    {
      key: 'editor',
      path: '/editor',
      icon: <Code className="w-4 h-4" />,
      label: t('sidebar.editor'),
    },
    {
      key: 'terminal',
      path: '/terminal',
      icon: <Terminal className="w-4 h-4" />,
      label: t('sidebar.terminal'),
    },
    {
      key: 'mcp',
      path: '/mcp',
      icon: <Server className="w-4 h-4" />,
      label: t('sidebar.mcpServers'),
    },
    {
      key: 'dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      label: t('sidebar.dashboard'),
    },
    {
      key: 'project',
      path: '/project',
      icon: <FolderKanban className="w-4 h-4" />,
      label: t('sidebar.project'),
    },
    {
      key: 'task',
      path: '/task',
      icon: <List className="w-4 h-4" />,
      label: t('sidebar.task'),
    },
    {
      key: 'team',
      path: '/team',
      icon: <Users className="w-4 h-4" />,
      label: t('sidebar.team'),
    },
    {
      key: 'system',
      icon: <Settings className="w-4 h-4" />,
      label: t('sidebar.settings'),
      children: [
        { key: 'settings-menu', path: '/settings/menu', icon: <List className="w-3 h-3" />, label: t('sidebar.menuList') },
        { key: 'settings-user', path: '/settings/user', icon: <Users className="w-3 h-3" />, label: t('sidebar.userList') },
        { key: 'settings-role', path: '/settings/role', icon: <Settings className="w-3 h-3" />, label: t('sidebar.roleList') },
      ],
    },
  ]

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedKeys)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedKeys(newExpanded)
  }

  const filteredMenu = searchQuery
    ? menuData.filter(item =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.children?.some(child => child.label.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : menuData

  const renderMenuItem = (item: MenuItemType, depth: number = 0) => {
    const isActive = activeKey === item.key
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedKeys.has(item.key)

    return (
      <div key={item.key}>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 cursor-pointer rounded-md transition-colors",
            isActive ? "bg-primary/10 text-primary" : "hover:bg-accent",
            depth > 0 && "ml-4"
          )}
          style={{ paddingLeft: `${12 + depth * 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.key)
            } else {
              onMenuClick(item.key, item.path)
            }
          }}
        >
          {hasChildren && (
            <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
              {isExpanded ? <ChevronRight className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          <span className={cn("flex-shrink-0", !collapsed && "mr-2")}>{item.icon}</span>
          {!collapsed && <span className="truncate text-sm">{item.label}</span>}
        </div>

        {hasChildren && isExpanded && !collapsed && (
          <div>
            {item.children!.map(child => renderMenuItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "h-full flex flex-col border-r bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-14 border-b px-3",
        collapsed ? "justify-center" : "gap-2"
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm">Mini-Agent</span>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sidebar.searchPlaceholder')}
              className="w-full h-8 pl-7 pr-3 text-sm bg-muted rounded-md border-0 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Menu */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredMenu.map(item => renderMenuItem(item))}
      </div>

      {/* Collapse Button */}
      <div className="p-2 border-t">
        <button
          onClick={() => onCollapse(!collapsed)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors",
            collapsed && "justify-center"
          )}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">{t('sidebar.collapse')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
