const appBase = import.meta.env.BASE_URL || '/'
export const API_BASE = import.meta.env.VITE_API_BASE || `${appBase}${appBase.endsWith('/') ? '' : '/'}api`
