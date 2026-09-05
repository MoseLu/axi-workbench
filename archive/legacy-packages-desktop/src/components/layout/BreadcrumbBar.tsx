/**
 * Breadcrumb Bar Component
 */

import {
  Home,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  icon?: React.ReactNode
}

interface BreadcrumbBarProps {
  items: BreadcrumbItem[]
}

export function BreadcrumbBar({ items }: BreadcrumbBarProps) {
  return (
    <div className="flex items-center h-8 px-4 text-sm text-muted-foreground bg-muted/30 border-b flex-shrink-0">
      <nav className="flex items-center gap-1">
        {items.map((item, index) => (
          <div key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-3.5 h-3.5 mx-1" />
            )}
            <span
              className={cn(
                "flex items-center gap-1",
                index === items.length - 1 && "text-foreground font-medium"
              )}
            >
              {index === 0 && <Home className="w-3.5 h-3.5" />}
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </span>
          </div>
        ))}
      </nav>
    </div>
  )
}
