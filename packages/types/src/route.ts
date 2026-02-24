// ============================================
// Route Types
// ============================================

export interface RouteMeta {
  title?: string
  icon?: string
  requiresAuth?: boolean
  roles?: string[]
  breadcrumbs?: Breadcrumb[]
  hidden?: boolean
}

export interface Breadcrumb {
  label: string
  path?: string
}

export interface RouteConfig {
  path: string
  name: string
  component?: string
  children?: RouteConfig[]
  meta?: RouteMeta
}
