import { DocFile, DocFolder, DocSource } from '../types'
import { excludePatterns, supportedExtensions } from '../config/sources'

// 浏览器环境下使用 fetch API 获取文件
// 由于是本地文件，需要通过 Vite 的开发服务器或文件 API 来访问

// 相对路径，由 nginx 或 Vite proxy 转发
const API_BASE = '/api'

export class FileService {
  private sources: DocSource[]

  constructor(sources: DocSource[]) {
    this.sources = sources.filter(s => s.enabled)
  }

  async scanDirectory(sourceId: string, dirPath?: string): Promise<(DocFolder | DocFile)[]> {
    try {
      const source = this.sources.find(s => s.id === sourceId)
      if (!source) return []

      const endpoint = dirPath
        ? `${API_BASE}/api/scan?source=${sourceId}&path=${encodeURIComponent(dirPath)}`
        : `${API_BASE}/api/scan?source=${sourceId}`

      const response = await fetch(endpoint)
      if (!response.ok) {
        console.error('Failed to scan directory:', response.statusText)
        return []
      }
      return await response.json()
    } catch (error) {
      console.error('Error scanning directory:', error)
      return []
    }
  }

  async readFile(sourceId: string, filePath: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${API_BASE}/api/file?source=${sourceId}&path=${encodeURIComponent(filePath)}`
      )
      if (!response.ok) return null
      return await response.text()
    } catch (error) {
      console.error('Error reading file:', error)
      return null
    }
  }

  isExcluded(name: string): boolean {
    return excludePatterns.some(pattern =>
      name === pattern || name.startsWith('.')
    )
  }

  isSupported(filename: string): boolean {
    const ext = filename.toLowerCase()
    return supportedExtensions.some(e => ext.endsWith(e))
  }
}

export const fileService = new FileService([])
