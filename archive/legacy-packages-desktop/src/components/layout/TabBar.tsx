/**
 * Tab Bar Component - Multi-tab Navigation
 */

import { useState, useRef, useEffect } from 'react'
import {
  X,
  Pin,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Home,
  MoreHorizontal,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'

export interface TabItem {
  key: string
  label: string
  path: string
  closable?: boolean
}

interface TabBarProps {
  tabs: TabItem[]
  activeTab: string
  isFullscreen: boolean
  onTabChange: (key: string) => void
  onTabClose: (key: string) => void
  onNavigate: (direction: 'back' | 'reload' | 'home') => void
  onToggleFullscreen: () => void
  onCloseLeft?: () => void
  onCloseRight?: () => void
  onCloseOther?: () => void
  onCloseAll?: () => void
  onTogglePin?: (key: string) => void
}

export function TabBar({
  tabs,
  activeTab,
  isFullscreen,
  onTabChange,
  onTabClose,
  onNavigate,
  onToggleFullscreen,
  onCloseLeft,
  onCloseRight,
  onCloseOther,
  onCloseAll,
  onTogglePin,
}: TabBarProps) {
  const { t } = useTranslation()
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto scroll to active tab
  useEffect(() => {
    if (containerRef.current) {
      const activeEl = containerRef.current.querySelector('.is-active')
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeTab])

  const handleClose = (e: React.MouseEvent, key: string, closable?: boolean) => {
    e.stopPropagation()
    if (closable !== false) {
      onTabClose(key)
    }
  }

  return (
    <div className="h-9 flex items-center px-2 border-b bg-card gap-1.5 flex-shrink-0">
      {/* Navigation Buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onNavigate('back')}
          className="p-1.5 rounded hover:bg-accent"
          title="返回"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onNavigate('reload')}
          className="p-1.5 rounded hover:bg-accent"
          title="刷新"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onNavigate('home')}
          className="p-1.5 rounded hover:bg-accent"
          title="首页"
        >
          <Home className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Container */}
      <div className="flex-1 overflow-hidden" ref={containerRef}>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            const canClose = tab.closable !== false

            return (
              <div
                key={tab.key}
                className={cn(
                  "inline-flex items-center h-6.5 px-2 rounded text-sm cursor-pointer transition-all whitespace-nowrap flex-shrink-0 border",
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-transparent hover:text-foreground hover:border-border hover:bg-accent"
                )}
                onClick={() => onTabChange(tab.key)}
              >
                <span className="max-w-[100px] overflow-hidden text-ellipsis">{tab.label}</span>
                {canClose && (
                  <button
                    onClick={(e) => handleClose(e, tab.key, tab.closable)}
                    className={cn(
                      "ml-1 p-0.5 rounded-full flex items-center justify-center w-3.5 h-3.5",
                      isActive
                        ? "hover:bg-primary-foreground/20"
                        : "opacity-0 hover:opacity-100 hover:bg-accent"
                    )}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Fullscreen */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 rounded hover:bg-accent"
          title={isFullscreen ? "退出全屏" : "全屏"}
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="p-1.5 rounded hover:bg-accent"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 z-50 min-w-[140px] py-1 border rounded-md bg-background shadow-lg">
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => {
                    onCloseLeft?.()
                    setShowDropdown(false)
                  }}
                >
                  关闭左侧
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => {
                    onCloseRight?.()
                    setShowDropdown(false)
                  }}
                >
                  关闭右侧
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => {
                    onCloseOther?.()
                    setShowDropdown(false)
                  }}
                >
                  关闭其他
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => {
                    onCloseAll?.()
                    setShowDropdown(false)
                  }}
                >
                  关闭全部
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
