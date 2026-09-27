import fs from 'fs'
import path from 'path'
import { docSources, excludePatterns, supportedExtensions } from '../config/sources'

interface FileItem {
  id: string
  name: string
  path: string
  relativePath: string
  type: 'file' | 'directory'
  extension: string
  lastModified: string
  sourceId: string
}

function isExcluded(name: string): boolean {
  return excludePatterns.some(pattern => name === pattern || name.startsWith('.'))
}

function isSupported(filename: string): boolean {
  const ext = filename.toLowerCase()
  return supportedExtensions.some(e => ext.endsWith(e))
}

export function scanDirectory(sourceId: string, dirPath?: string): FileItem[] {
  const source = docSources.find(s => s.id === sourceId)
  if (!source) return []

  const basePath = dirPath ? path.join(source.path, dirPath) : source.path

  if (!fs.existsSync(basePath)) {
    return []
  }

  const items: FileItem[] = []

  try {
    const entries = fs.readdirSync(basePath, { withFileTypes: true })

    for (const entry of entries) {
      if (isExcluded(entry.name)) continue

      const fullPath = path.join(basePath, entry.name)
      const relativePath = dirPath ? path.join(dirPath, entry.name) : entry.name

      if (entry.isDirectory()) {
        items.push({
          id: `${sourceId}:${relativePath}`,
          name: entry.name,
          path: fullPath,
          relativePath,
          type: 'directory',
          extension: '',
          lastModified: fs.statSync(fullPath).mtime.toISOString(),
          sourceId,
        })
      } else if (entry.isFile() && isSupported(entry.name)) {
        items.push({
          id: `${sourceId}:${relativePath}`,
          name: entry.name,
          path: fullPath,
          relativePath,
          type: 'file',
          extension: path.extname(entry.name),
          lastModified: fs.statSync(fullPath).mtime.toISOString(),
          sourceId,
        })
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error)
  }

  // 按名称排序，文件夹在前
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function readFileContent(sourceId: string, filePath: string): string | null {
  const source = docSources.find(s => s.id === sourceId)
  if (!source) return null

  const fullPath = path.join(source.path, filePath)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  try {
    return fs.readFileSync(fullPath, 'utf-8')
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
}

export function getFileInfo(sourceId: string, filePath: string): FileItem | null {
  const source = docSources.find(s => s.id === sourceId)
  if (!source) return null

  const fullPath = path.join(source.path, filePath)

  if (!fs.existsSync(fullPath)) {
    return null
  }

  try {
    const stats = fs.statSync(fullPath)
    return {
      id: `${sourceId}:${filePath}`,
      name: path.basename(filePath),
      path: fullPath,
      relativePath: filePath,
      type: 'file',
      extension: path.extname(filePath),
      lastModified: stats.mtime.toISOString(),
      sourceId,
    }
  } catch (error) {
    return null
  }
}

// 从 markdown 文件中提取所有标签（#tag-name 格式）
function extractTagsFromContent(content: string): string[] {
  const tagRegex: RegExp = /#([\p{L}\p{N}_-]+)/gu
  const tags = new Set<string>()
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase())
  }

  return Array.from(tags)
}

interface TagInfo {
  name: string
  count: number
}

// 获取某个源下所有文件的标签
export function getAllTags(sourceId: string): TagInfo[] {
  const source = docSources.find(s => s.id === sourceId)
  if (!source) return []

  const tagCounts = new Map<string, number>()

  try {
    const scanResults = scanDirectory(sourceId)
    const mdFiles = scanResults.filter(item => item.type === 'file' && item.extension === '.md')

    for (const file of mdFiles) {
      const content = readFileContent(sourceId, file.relativePath)
      if (content) {
        const tags = extractTagsFromContent(content)
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        }
      }
    }
  } catch (error) {
    console.error('Error extracting tags:', error)
  }

  // 按出现次数降序排序
  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
