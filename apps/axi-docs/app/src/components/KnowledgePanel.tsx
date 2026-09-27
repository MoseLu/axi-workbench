import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { DocSource, SelectedFile, KnowledgePanelTab, AiAnalysis } from '../types'
import { TableOfContents } from './TableOfContents'

const GlobalGraph = lazy(async () => {
  const module = await import('./GlobalGraph')
  return { default: module.GlobalGraph }
})

const STATIC_AI_MESSAGE = '静态版当前未接入 AI 洞察服务。'

interface KnowledgePanelProps {
  content: string | null
  selectedFile: SelectedFile | null
  source?: DocSource
  onNavigate: (path: string) => void
  onTagSelect?: (tag: string) => void
}

type GraphMode = 'focus' | 'global' | 'tree' | 'orphan'

export function KnowledgePanel({
  content,
  selectedFile,
  source,
  onNavigate,
  onTagSelect,
}: KnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<KnowledgePanelTab>('toc')
  const [graphMode, setGraphMode] = useState<GraphMode>('tree')
  const [aiData, setAiData] = useState<AiAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [graphViewport, setGraphViewport] = useState({ width: 360, height: 300 })
  const isGraphWorkspace = activeTab === 'graph' && source?.type === 'local'

  // Reset on file change
  useEffect(() => {
    setAiData(null)
    setActiveTab('toc')
    setGraphMode('tree')
  }, [selectedFile?.path, selectedFile?.sourceId])

  // Measure graph container height
  useEffect(() => {
    if (!graphContainerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setGraphViewport({
          width: entry.contentRect.width || 360,
          height: entry.contentRect.height || 300,
        })
      }
    })
    ro.observe(graphContainerRef.current)
    return () => ro.disconnect()
  }, [])

  const fetchAiAnalysis = useCallback(async () => {
    if (!content || !selectedFile) return
    setAiLoading(true)
    try {
      setAiData({
        summary: '',
        keyPoints: [],
        concepts: [],
        error: STATIC_AI_MESSAGE,
      } satisfies AiAnalysis)
    } finally {
      setAiLoading(false)
    }
  }, [content, selectedFile])

  const handleTabClick = (tab: KnowledgePanelTab) => {
    setActiveTab(tab)
  }

  return (
    <aside className={`knowledge-panel${isGraphWorkspace ? ' knowledge-panel--graph-workspace' : ''}`}>
      <div className={`kp-tabs${isGraphWorkspace ? ' kp-tabs--graph-workspace' : ''}`}>
        <button
          className={`kp-tab${activeTab === 'graph' ? ' active' : ''}`}
          onClick={() => handleTabClick('graph')}
        >
          图谱
        </button>
        <button
          className={`kp-tab${activeTab === 'toc' ? ' active' : ''}`}
          onClick={() => handleTabClick('toc')}
        >
          目录
        </button>
        <button
          className={`kp-tab${activeTab === 'ai' ? ' active' : ''}`}
          onClick={() => handleTabClick('ai')}
        >
          AI洞察
        </button>
      </div>

      <div className={`kp-content${isGraphWorkspace ? ' kp-content--graph-workspace' : ''}`}>
        {activeTab === 'graph' && (
          <div
            ref={graphContainerRef}
            className={`kp-graph${isGraphWorkspace ? ' kp-graph--workspace' : ''}`}
            style={{ flex: 1 }}
          >
            {source?.type === 'local' && (
              <div className="graph-mode-toggle">
                <button
                  className={`graph-mode-btn${graphMode === 'focus' ? ' active' : ''}`}
                  onClick={() => setGraphMode('focus')}
                >
                  聚焦
                </button>
                <button
                  className={`graph-mode-btn${graphMode === 'global' ? ' active' : ''}`}
                  onClick={() => setGraphMode('global')}
                >
                  星图
                </button>
                <button
                  className={`graph-mode-btn${graphMode === 'tree' ? ' active' : ''}`}
                  onClick={() => setGraphMode('tree')}
                >
                  树构
                </button>
                <button
                  className={`graph-mode-btn${graphMode === 'orphan' ? ' active' : ''}`}
                  onClick={() => setGraphMode('orphan')}
                >
                  孤岛
                </button>
              </div>
            )}

            {source?.type === 'local' && (
              <Suspense
                fallback={(
                  <div className="kp-ai-loading" style={{ height: '100%' }}>
                    <div className="spinner" style={{ width: 'var(--icon-size-lg)', height: 'var(--icon-size-lg)' }} />
                    载入 3D 图谱...
                  </div>
                )}
              >
                <GlobalGraph
                  width={graphViewport.width}
                  height={graphViewport.height}
                  sourceId={selectedFile?.sourceId || source.id}
                  focusPath={selectedFile?.path}
                  mode={graphMode}
                  layout="dock"
                  onNavigate={onNavigate}
                  onTagSelect={onTagSelect}
                />
              </Suspense>
            )}
          </div>
        )}

        {activeTab === 'toc' && (
          <div className="kp-toc">
            {content ? <TableOfContents content={content} /> : null}
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="kp-ai">
            {!aiData && !aiLoading && (
              <div className="kp-ai-loading">
                <p>{STATIC_AI_MESSAGE}</p>
                <button
                  className="kp-analyze-btn"
                  onClick={fetchAiAnalysis}
                  disabled={!content}
                >
                  查看说明
                </button>
              </div>
            )}

            {aiLoading && (
              <div className="kp-ai-loading">
                <div className="spinner" style={{ width: 'var(--icon-size-lg)', height: 'var(--icon-size-lg)' }} />
                AI 分析中...
              </div>
            )}

            {aiData && !aiData.error && (
              <>
                {aiData.summary && (
                  <div>
                    <div className="kp-ai-section-title">摘要</div>
                    <div className="kp-ai-summary markdown-body kp-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {aiData.summary}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {aiData.keyPoints.length > 0 && (
                  <div>
                    <div className="kp-ai-section-title">要点</div>
                    <ul className="kp-ai-keypoints">
                      {aiData.keyPoints.map((pt: string, i: number) => (
                        <li key={i} className="kp-ai-keypoint">{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiData.concepts.length > 0 && (
                  <div>
                    <div className="kp-ai-section-title">概念</div>
                    <div className="kp-ai-concepts">
                      {aiData.concepts.map((c: { term: string; definition: string }, i: number) => (
                        <div key={i} className="kp-ai-concept-item">
                          <div className="kp-ai-concept-term">{c.term}</div>
                          <div className="kp-ai-concept-def">{c.definition}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className="kp-analyze-btn"
                  onClick={() => { setAiData(null); fetchAiAnalysis() }}
                  style={{ marginTop: 'auto' }}
                >
                  重新分析
                </button>
              </>
            )}

            {aiData?.error && (
              <div className="kp-ai-error">分析失败: {aiData.error}</div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
