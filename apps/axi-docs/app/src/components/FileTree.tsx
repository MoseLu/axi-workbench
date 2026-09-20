import { useState, useEffect, useRef } from 'react'
import { FolderIcon, FolderOpenIcon, FileIcon, ChevronIcon } from './Icons'
import { scanKnowledgeSource as loadKnowledgeDirectory } from '../lib/knowledgeClient'
import {
  formatKnowledgeBranchLabel,
  formatKnowledgeDocumentTitle,
  formatKnowledgeTagLabel,
} from '../lib/knowledgeFormatter'
import { FileItem, SelectedFile } from '../types'

interface FileTreeProps {
  sourceId: string
  onFileSelect: (sourceId: string, path: string) => void
  selectedFile: SelectedFile | null
  filterTag?: string | null
}

export function FileTree({ sourceId, onFileSelect, selectedFile, filterTag }: FileTreeProps) {
  const [items, setItems] = useState<FileItem[]>([])
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  // childrenMap: key = item.id (e.g. "obsidian:_moc"), value = child FileItem[]
  const [childrenMap, setChildrenMap] = useState<Map<string, FileItem[]>>(new Map())
  const [loading, setLoading] = useState(true)
  // Track in-flight loads to avoid duplicate fetches
  const loadingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadRootItems()
    setExpandedDirs(new Set())
    setChildrenMap(new Map())
  }, [sourceId, filterTag])

  const loadRootItems = async () => {
    setLoading(true)
    try {
      const data = await loadKnowledgeDirectory(sourceId, undefined, filterTag)
      setItems(data)
    } catch (error) {
      console.error('Failed to load root items:', error)
    }
    setLoading(false)
  }

  const loadChildren = async (itemId: string, dirPath: string) => {
    if (loadingRef.current.has(itemId)) return
    loadingRef.current.add(itemId)
    try {
      const data = await loadKnowledgeDirectory(sourceId, dirPath, filterTag)
      setChildrenMap(prev => {
        const next = new Map(prev)
        next.set(itemId, data)
        return next
      })
    } catch (error) {
      console.error('Failed to load children:', error)
    } finally {
      loadingRef.current.delete(itemId)
    }
  }

  const toggleDir = (item: FileItem) => {
    const newExpanded = new Set(expandedDirs)
    if (expandedDirs.has(item.id)) {
      newExpanded.delete(item.id)
    } else {
      newExpanded.add(item.id)
      loadChildren(item.id, item.relativePath)
    }
    setExpandedDirs(newExpanded)
  }

  const handleItemClick = (item: FileItem) => {
    if (item.type === 'directory') {
      toggleDir(item)
    } else {
      onFileSelect(sourceId, item.relativePath)
    }
  }

  const renderItem = (item: FileItem, depth: number): JSX.Element | null => {
    if (depth > 20) return null // safety guard
    const isExpanded = expandedDirs.has(item.id)
    const isSelected = selectedFile?.path === item.relativePath && selectedFile?.sourceId === sourceId
    const children = childrenMap.get(item.id) ?? []

    // Normalize tags: Blinko source returns {id, noteId, tagId, tag: {...}} objects;
    // Obsidian source returns plain strings. Normalize to string array.
    const rawTags: unknown[] = item.tags ?? []
    const tagLabels: string[] = rawTags.map(t => {
      if (typeof t === 'string') return t
      if (t && typeof t === 'object' && 'tag' in (t as object)) {
        const tagObj = (t as { tag: { name: string } }).tag
        return tagObj?.name ?? ''
      }
      return String(t)
    }).filter(Boolean)

    const displayName = item.type === 'directory'
      ? formatKnowledgeBranchLabel(item.name)
      : formatKnowledgeDocumentTitle(item.name, item.relativePath, item.graphTitle)

    return (
      <div key={item.id}>
        <div
          className={`tree-item ${isSelected ? 'active' : ''} ${item.type === 'directory' ? 'tree-item--dir' : ''}`}
          style={{ paddingLeft: `calc(var(--tree-indent-base) + ${depth} * var(--tree-indent-step))` }}
          onClick={() => handleItemClick(item)}
          title={item.relativePath}
        >
          {item.type === 'directory' ? (
            <ChevronIcon expanded={isExpanded} />
          ) : (
            <span style={{ width: 'var(--icon-size-sm)', flexShrink: 0 }} />
          )}
          <span className="tree-item-icon">
            {item.type === 'directory'
              ? (isExpanded ? <FolderOpenIcon /> : <FolderIcon />)
              : <FileIcon />}
          </span>
          <span className="tree-item-name">{displayName}</span>
          {tagLabels.length > 0 && (
            <span className="tree-item-tags">
              {tagLabels.slice(0, 2).map(tag => (
                <span key={tag} className="tag tag--tiny">#{formatKnowledgeTagLabel(tag)}</span>
              ))}
            </span>
          )}
        </div>
        {item.type === 'directory' && isExpanded && children.length > 0 && (
          <div>
            {children.map(child => renderItem(child, depth + 1))}
          </div>
        )}
        {item.type === 'directory' && isExpanded && children.length === 0 && (
          <div
            className="tree-item-empty"
            style={{ paddingLeft: `calc(var(--tree-indent-base) + ${depth + 1} * var(--tree-indent-step) + 2 * var(--icon-size-sm))` }}
          >
            空目录
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>
  }

  if (items.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 'var(--spacing-7) var(--spacing-5)' }}>
        <span className="empty-state-text">
          {filterTag ? `没有带 #${filterTag} 标签的文档` : '暂无文档'}
        </span>
      </div>
    )
  }

  return <div className="file-tree">{items.map(item => renderItem(item, 0))}</div>
}
