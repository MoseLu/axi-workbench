/**
 * Theme System for Mini-Agent Desktop
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeColors {
  // Background
  background: string
  foreground: string
  
  // Card
  card: string
  cardForeground: string
  
  // Primary
  primary: string
  primaryForeground: string
  
  // Secondary
  secondary: string
  secondaryForeground: string
  
  // Muted
  muted: string
  mutedForeground: string
  
  // Accent
  accent: string
  accentForeground: string
  
  // Destructive
  destructive: string
  destructiveForeground: string
  
  // Border
  border: string
  
  // Editor colors
  editorBackground: string
  editorForeground: string
  terminalBackground: string
}

export const themes: Record<string, ThemeColors> = {
  dark: {
    background: '#09090b',
    foreground: '#fafafa',
    card: '#18181b',
    cardForeground: '#fafafa',
    primary: '#3b82f6',
    primaryForeground: '#ffffff',
    secondary: '#27272a',
    secondaryForeground: '#fafafa',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    accent: '#27272a',
    accentForeground: '#fafafa',
    destructive: '#ef4444',
    destructiveForeground: '#fafafa',
    border: '#27272a',
    editorBackground: '#1e1e1e',
    editorForeground: '#d4d4d4',
    terminalBackground: '#1e1e1e',
  },
  light: {
    background: '#ffffff',
    foreground: '#09090b',
    card: '#ffffff',
    cardForeground: '#09090b',
    primary: '#2563eb',
    primaryForeground: '#ffffff',
    secondary: '#f4f4f5',
    secondaryForeground: '#18181b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    accent: '#f4f4f5',
    accentForeground: '#18181b',
    destructive: '#dc2626',
    destructiveForeground: '#ffffff',
    border: '#e4e4e7',
    editorBackground: '#ffffff',
    editorForeground: '#1e1e1e',
    terminalBackground: '#1e1e1e',
  },
  ocean: {
    background: '#0a192f',
    foreground: '#e6f1ff',
    card: '#112240',
    cardForeground: '#e6f1ff',
    primary: '#64ffda',
    primaryForeground: '#0a192f',
    secondary: '#172a45',
    secondaryForeground: '#e6f1ff',
    muted: '#172a45',
    mutedForeground: '#8892b0',
    accent: '#172a45',
    accentForeground: '#e6f1ff',
    destructive: '#ff6b6b',
    destructiveForeground: '#0a192f',
    border: '#233554',
    editorBackground: '#0d1b2a',
    editorForeground: '#e6f1ff',
    terminalBackground: '#0d1b2a',
  },
  forest: {
    background: '#1a1f1a',
    foreground: '#e8f5e9',
    card: '#263238',
    cardForeground: '#e8f5e9',
    primary: '#81c784',
    primaryForeground: '#1a1f1a',
    secondary: '#37474f',
    secondaryForeground: '#e8f5e9',
    muted: '#37474f',
    mutedForeground: '#90a4ae',
    accent: '#37474f',
    accentForeground: '#e8f5e9',
    destructive: '#ef5350',
    destructiveForeground: '#1a1f1a',
    border: '#455a64',
    editorBackground: '#1e2721',
    editorForeground: '#e8f5e9',
    terminalBackground: '#1e2721',
  },
}

interface ThemeState {
  mode: ThemeMode
  theme: string
  
  // Actions
  setMode: (mode: ThemeMode) => void
  setTheme: (theme: string) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      theme: 'dark',

      setMode: (mode) => {
        set({ mode })
        
        // Apply to document
        if (mode === 'system') {
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
        } else {
          document.documentElement.setAttribute('data-theme', mode)
        }
      },

      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      },

      toggleTheme: () => {
        const { theme, mode } = get()
        if (mode === 'system') {
          set({ mode: 'dark', theme: 'dark' })
          document.documentElement.setAttribute('data-theme', 'dark')
        } else if (theme === 'dark') {
          set({ theme: 'light', mode: 'light' })
          document.documentElement.setAttribute('data-theme', 'light')
        } else {
          set({ theme: 'dark', mode: 'dark' })
          document.documentElement.setAttribute('data-theme', 'dark')
        }
      },
    }),
    {
      name: 'mini-agent-theme',
    }
  )
)

// Apply theme on load
export function applyTheme(theme: string) {
  document.documentElement.setAttribute('data-theme', theme)
}
