const isServer = typeof window === "undefined"

export function getItem<T>(key: string, defaultValue?: T): T | null {
  if (isServer) return defaultValue ?? null
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue ?? null
  } catch {
    return defaultValue ?? null
  }
}

export function setItem<T>(key: string, value: T): void {
  if (isServer) return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error("Failed to save to localStorage:", error)
  }
}

export function removeItem(key: string): void {
  if (isServer) return
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error("Failed to remove from localStorage:", error)
  }
}

export function clear(): void {
  if (isServer) return
  try {
    localStorage.clear()
  } catch (error) {
    console.error("Failed to clear localStorage:", error)
  }
}

export function getSessionItem<T>(key: string, defaultValue?: T): T | null {
  if (isServer) return defaultValue ?? null
  try {
    const item = sessionStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue ?? null
  } catch {
    return defaultValue ?? null
  }
}

export function setSessionItem<T>(key: string, value: T): void {
  if (isServer) return
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error("Failed to save to sessionStorage:", error)
  }
}

export function removeSessionItem(key: string): void {
  if (isServer) return
  try {
    sessionStorage.removeItem(key)
  } catch (error) {
    console.error("Failed to remove from sessionStorage:", error)
  }
}
