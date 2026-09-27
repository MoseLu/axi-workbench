import { useEffect, useState } from 'react'
import { getKnowledgeTags as loadKnowledgeTags } from '../lib/knowledgeClient'
import { formatKnowledgeTagLabel } from '../lib/knowledgeFormatter'
import { DocSource, SelectedFile } from '../types'
import { BlinkoIcon, FileIcon, FolderIcon, ObsidianIcon, TagIcon } from './Icons'
import { FileTree } from './FileTree'

interface SidebarProps {
  sources: DocSource[]
  activeSource: string
  onSourceChange: (id: string) => void
  onFileSelect: (sourceId: string, path: string) => void
  refreshKey: number
  selectedFile: SelectedFile | null
  activeTag: string | null
  onTagSelect: (tag: string | null) => void
}

type SidebarPanel = 'tags' | 'files' | null

function SourceIcon({ icon }: { icon?: string }) {
  if (icon === 'obsidian') return <span className="source-icon source-icon--obsidian"><ObsidianIcon /></span>
  if (icon === 'blinko') return <span className="source-icon source-icon--blinko"><BlinkoIcon /></span>
  return <span className="source-icon"><FolderIcon /></span>
}

export function Sidebar({
  sources,
  activeSource,
  onSourceChange,
  onFileSelect,
  refreshKey,
  selectedFile,
  activeTag,
  onTagSelect,
}: SidebarProps) {
  const [tags, setTags] = useState<{ name: string; count: number }[]>([])
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null)

  useEffect(() => {
    if (activeSource !== 'blinko') {
      void loadTags(activeSource)
    } else {
      setTags([])
      setActivePanel(null)
    }
  }, [activeSource, refreshKey])

  const loadTags = async (sourceId: string) => {
    try {
      setTags(await loadKnowledgeTags(sourceId))
    } catch {
      setTags([])
    }
  }

  const currentSource = sources.find((source) => source.id === activeSource)
  const isBlinko = activeSource === 'blinko'

  return (
    <aside className={`app-sidebar app-sidebar--command${activePanel ? ' app-sidebar--expanded' : ''}`}>
      <div className="sidebar-rail">
        <div className="sidebar-rail__group">
          {sources.filter((source) => source.enabled).map((source) => (
            <button
              key={source.id}
              className={`source-tab source-tab--rail ${activeSource === source.id ? 'active' : ''}`}
              onClick={() => onSourceChange(source.id)}
              title={source.name}
              aria-label={`切换到 ${source.name}`}
              type="button"
            >
              <SourceIcon icon={source.icon} />
              <span className="source-tab-name">{source.name}</span>
            </button>
          ))}
        </div>

        {!isBlinko && (
          <div className="sidebar-rail__group sidebar-rail__group--tools">
            <button
              className={`sidebar-rail__button${activePanel === 'tags' ? ' active' : ''}`}
              onClick={() => setActivePanel((current) => current === 'tags' ? null : 'tags')}
              aria-expanded={activePanel === 'tags'}
              aria-label="切换标签筛选面板"
              type="button"
            >
              <TagIcon />
              <span>标签</span>
            </button>
            <button
              className={`sidebar-rail__button${activePanel === 'files' ? ' active' : ''}`}
              onClick={() => setActivePanel((current) => current === 'files' ? null : 'files')}
              aria-expanded={activePanel === 'files'}
              aria-label="切换文件浏览面板"
              type="button"
            >
              <FileIcon />
              <span>文件</span>
            </button>
          </div>
        )}

        <div className="sidebar-rail__footer">
          <span className="sidebar-rail__eyebrow">数据源</span>
          <strong>{currentSource?.name || 'Axi Docs'}</strong>
          {activeTag && <span className="sidebar-rail__hint">#{formatKnowledgeTagLabel(activeTag)}</span>}
        </div>
      </div>

      {!isBlinko && activePanel && (
        <div className="sidebar-panel">
            <div className="sidebar-panel__header">
              <div>
                <span className="sidebar-panel__eyebrow">{currentSource?.name || '当前知识库'}</span>
                <strong>{activePanel === 'tags' ? '标签过滤' : '文件结构'}</strong>
              </div>
            <button
              className="sidebar-panel__close"
              onClick={() => setActivePanel(null)}
              aria-label="关闭侧边面板"
              type="button"
            >
              ×
            </button>
          </div>

          {activePanel === 'tags' ? (
            <div className="sidebar-panel__body sidebar-panel__body--tags">
              <button
                className={`tag ${activeTag === null ? 'tag--active' : ''}`}
                onClick={() => onTagSelect(null)}
                type="button"
              >
                全部标签
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  className={`tag ${activeTag === tag.name ? 'tag--active' : ''}`}
                  onClick={() => onTagSelect(activeTag === tag.name ? null : tag.name)}
                  title={`${tag.count} 篇文档`}
                  type="button"
                >
                  #{formatKnowledgeTagLabel(tag.name)}
                  <span className="tag-count">{tag.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="sidebar-panel__body sidebar-panel__body--files">
              <FileTree
                key={`${activeSource}-${refreshKey}-${activeTag}`}
                filterTag={activeTag}
                onFileSelect={onFileSelect}
                selectedFile={selectedFile}
                sourceId={activeSource}
              />
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
