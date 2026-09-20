import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { DocumentView } from './DocumentView'
import { SegmentedTabs } from './CockpitPrimitives'
import {
  formatKnowledgeBranchPath,
  formatKnowledgeItemTitle,
  formatKnowledgeTagLabel,
} from '../lib/knowledgeFormatter'
import { DocSource, SelectedFile } from '../types'
import { LinkIcon, SearchIcon } from './Icons'
import { QuickKnowledgeItemLike } from './HomeCommandCenter'

const GlobalGraph = lazy(async () => {
  const module = await import('./GlobalGraph')
  return { default: module.GlobalGraph }
})

type ExplorerView = 'tree' | 'path' | 'islands'

interface KnowledgeExplorerProps {
  source: DocSource
  selectedFile: SelectedFile | null
  fileContent: string | null
  fileName: string
  fileLoading: boolean
  searchQuery: string
  activeTag: string | null
  quickOpenItems: QuickKnowledgeItemLike[]
  graphFocusPath?: string | null
  filterPaths?: string[]
  view: ExplorerView
  selectedBranch: string | null
  selectedNodeId: string | null
  eyebrow?: string
  title?: string
  description?: string
  backLabel?: string
  onViewChange: (view: ExplorerView) => void
  onBranchChange: (branch: string | null) => void
  onNodeChange: (node: string | null) => void
  onOpenItem: (sourceId: string, path: string) => void
  onTagSelect: (tag: string | null) => void
  onWikiLink: (noteName: string) => void
  onNavigateHome: () => void
  onClearSelectedFile: () => void
}

function resolveGraphMode(view: ExplorerView, hasFocus: boolean) {
  if (view === 'islands') return 'orphan'
  if (view === 'path') return hasFocus ? 'focus' : 'global'
  return 'tree'
}

function documentTitle(item: Pick<QuickKnowledgeItemLike, 'title' | 'name' | 'path' | 'graphTitle'>) {
  return formatKnowledgeItemTitle(item)
}

export function KnowledgeExplorer({
  source,
  selectedFile,
  fileContent,
  fileName,
  fileLoading,
  searchQuery,
  activeTag,
  quickOpenItems,
  graphFocusPath,
  filterPaths,
  view,
  selectedBranch,
  selectedNodeId,
  eyebrow,
  title,
  description,
  backLabel,
  onViewChange,
  onBranchChange,
  onNodeChange,
  onOpenItem,
  onTagSelect,
  onWikiLink,
  onNavigateHome,
  onClearSelectedFile,
}: KnowledgeExplorerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 900 })

  useEffect(() => {
    if (!stageRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setViewport({
        width: Math.max(Math.round(entry.contentRect.width), 320),
        height: Math.max(Math.round(entry.contentRect.height), 480),
      })
    })
    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [])

  const isWideExplorer = viewport.width >= 1440

  return (
    <section className="knowledge-explorer">
      <div className="knowledge-explorer__header">
        <div className="knowledge-explorer__intro">
          <button className="knowledge-explorer__back" onClick={onNavigateHome} type="button">
            {backLabel || '返回指挥中心'}
          </button>
          <div>
            <div className="knowledge-explorer__eyebrow">{eyebrow || source.name}</div>
            <h1>{title || '知识探索台'}</h1>
            <p>{description || '把树构、路径和孤岛切换到一张全屏探索舞台里，用证据抽屉承接阅读。'}</p>
          </div>
        </div>

        <div className="knowledge-explorer__toolbar">
          <SegmentedTabs
            ariaLabel="图谱视图模式"
            className="knowledge-explorer__modes"
            idBase="knowledge-explorer-view-tabs"
            items={[
              { value: 'tree', label: '树构' },
              { value: 'path', label: '路径' },
              { value: 'islands', label: '孤岛' },
            ]}
            onChange={onViewChange}
            panelId="knowledge-explorer-stage"
            value={view}
          />

          <div className="knowledge-explorer__pills">
            {searchQuery.trim() && (
              <span className="knowledge-explorer__pill">
                <SearchIcon />
                <span>{searchQuery}</span>
              </span>
            )}
            {activeTag && (
              <button className="knowledge-explorer__pill" onClick={() => onTagSelect(null)} type="button">
                <span>#{formatKnowledgeTagLabel(activeTag)}</span>
              </button>
            )}
            {selectedBranch && <span className="knowledge-explorer__pill">分支 {formatKnowledgeBranchPath(selectedBranch)}</span>}
          </div>
        </div>
      </div>

      <div className="knowledge-explorer__body">
        <div
          className="knowledge-explorer__stage"
          id="knowledge-explorer-stage"
          ref={stageRef}
          role="tabpanel"
          aria-labelledby={`knowledge-explorer-view-tabs-tab-${view}`}
        >
          <Suspense
            fallback={(
              <div className="hero-knowledge-scene__fallback">
                <div className="spinner" />
                <span>正在载入图谱探索舞台...</span>
              </div>
            )}
          >
            <GlobalGraph
              focusPath={graphFocusPath}
              height={viewport.height}
              layout={isWideExplorer ? 'workspace' : 'dock'}
              mode={resolveGraphMode(view, Boolean(selectedFile))}
              onBranchChange={onBranchChange}
              onNavigate={(path) => onOpenItem(source.id, path)}
              onNodeSelect={onNodeChange}
              onTagSelect={(tag) => onTagSelect(tag)}
              selectedBranch={selectedBranch}
              selectedNodeId={selectedNodeId}
              sourceId={source.id}
              filterPaths={filterPaths}
              width={viewport.width}
            />
          </Suspense>
        </div>

        <aside className={`knowledge-explorer__drawer${selectedFile ? ' is-open' : ''}`}>
          <div className="knowledge-explorer__drawer-header">
            <div>
              <span className="knowledge-explorer__drawer-eyebrow">Evidence Drawer</span>
              <strong>{selectedFile ? '当前证据' : '待选证据'}</strong>
            </div>
            {selectedFile && (
              <button className="knowledge-explorer__drawer-close" onClick={onClearSelectedFile} type="button">
                关闭
              </button>
            )}
          </div>

          <div className="knowledge-explorer__drawer-body">
            {selectedFile ? (
              <DocumentView
                content={fileContent}
                fileName={fileName}
                loading={fileLoading}
                onTagSelect={(tag) => onTagSelect(tag)}
                onWikiLink={onWikiLink}
                selectedFile={selectedFile}
                showKnowledgePanel={false}
                source={source}
                variant="panel"
              />
            ) : (
              <div className="knowledge-explorer__empty">
                <div className="knowledge-explorer__empty-card">
                  <LinkIcon />
                  <div>
                    <strong>双击节点即可打开证据抽屉</strong>
                    <p>单击用于聚焦路径，双击文档节点会把原文拉到右侧阅读区。</p>
                  </div>
                </div>

                <div className="knowledge-explorer__suggestions">
                  <div className="knowledge-explorer__suggestions-header">
                    <span>最近入口</span>
                    <small>{quickOpenItems.length} 条</small>
                  </div>

                  <div className="knowledge-explorer__suggestions-list">
                    {quickOpenItems.map((item) => (
                      <button
                        key={`${item.sourceId}:${item.path}`}
                        className="knowledge-explorer__suggestion"
                        onClick={() => onOpenItem(item.sourceId, item.path)}
                        type="button"
                      >
                        <strong>{documentTitle(item)}</strong>
                        <span>{item.path}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
