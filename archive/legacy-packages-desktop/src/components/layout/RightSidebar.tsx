/**
 * Right Sidebar Component - Settings Panel
 */

import { useState } from 'react'
import { useTranslation } from '@/lib/useTranslation'
import { useThemeStore } from '@/stores/themeStore'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RightSidebarProps {
  visible: boolean
  onClose: () => void
}

const themes = [
  { key: 'dark', label: '暗黑', color: '#141414' },
  { key: 'light', label: '亮色', color: '#ffffff' },
  { key: 'blue', label: '深蓝', color: '#001529' },
  { key: 'ocean', label: '海洋', color: '#0a1929' },
  { key: 'forest', label: '森林', color: '#1a2e1a' },
]

const primaryColors = [
  '#4165d7',
  '#1890ff',
  '#722ed1',
  '#13c2c2',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#eb2f96',
]

export function RightSidebar({ visible, onClose }: RightSidebarProps) {
  const { t } = useTranslation()
  const { theme, setTheme } = useThemeStore()
  const [currentColor, setCurrentColor] = useState('#4165d7')

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as 'light' | 'dark' | 'ocean' | 'forest')
  }

  return (
    <>
      {/* Overlay */}
      {visible && (
        <div
          className="fixed inset-0 z-40 bg-black/35"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 w-72 z-50 bg-background border-l transition-transform duration-300 flex flex-col",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b flex-shrink-0">
          <span className="text-sm font-semibold">{t('rightSidebar.title')}</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Theme Mode */}
          <div className="mb-6">
            <div className="text-xs font-semibold mb-3">{t('rightSidebar.themeMode')}</div>
            <div className="flex gap-3">
              {themes.map(theme => (
                <div
                  key={theme.key}
                  className={cn(
                    "flex flex-col items-center gap-1.5 cursor-pointer",
                    theme === theme.key && "opacity-100"
                  )}
                  onClick={() => handleThemeChange(theme.key)}
                >
                  <div
                    className={cn(
                      "w-14 h-9 rounded-md flex items-center justify-center transition-all",
                      theme === theme.key ? "ring-2 ring-primary" : "hover:scale-105"
                    )}
                    style={{
                      background: theme.color,
                      border: theme.key === 'light' ? '1px solid rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {theme === theme.key && (
                      <Check className="w-3 h-3" style={{ color: theme.key === 'light' ? '#333' : '#fff' }} />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{theme.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Primary Color */}
          <div className="mb-6">
            <div className="text-xs font-semibold mb-3">{t('rightSidebar.themeColor')}</div>
            <div className="flex flex-wrap gap-2">
              {primaryColors.map(color => (
                <div
                  key={color}
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-transform hover:scale-110",
                    currentColor === color && "ring-2 ring-offset-2 ring-primary"
                  )}
                  style={{ background: color }}
                  onClick={() => setCurrentColor(color)}
                >
                  {currentColor === color && (
                    <Check className="w-2.5 h-2.5" style={{ color: '#fff' }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Layout Settings */}
          <div className="mb-6">
            <div className="text-xs font-semibold mb-3">{t('rightSidebar.layoutSettings')}</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border text-xs">
                <span className="text-muted-foreground">{t('rightSidebar.sidebarWidth')}</span>
                <span className="">220px</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border text-xs">
                <span className="text-muted-foreground">{t('rightSidebar.tabBar')}</span>
                <span className="">{t('rightSidebar.show')}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border text-xs">
                <span className="text-muted-foreground">{t('rightSidebar.breadcrumb')}</span>
                <span className="">{t('rightSidebar.show')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
