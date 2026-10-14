import type { PageCopyLocale } from '../../config/pageCopy'

/**
 * Companion for /guide/knowledge-graph — renders an SVG of the catalog's
 * top-level relationships so the page's body text becomes visible evidence
 * rather than a written description of an absent visualization.
 */
export function GuideKnowledgeGraphCompanion({ locale }: { locale: PageCopyLocale }) {
  const isEnLocal = locale === 'en'
  // 关系图用一组示例节点呈现"图谱的样子"，避免在文档页面再异步加载整个 catalog。
  // 节点命名来自 HubPage 已经渲染过的目录语义（guide / skill / tag / reference）。
  const sampleNodes = isEnLocal
    ? [
        'Getting started', 'What is Axi Docs', 'Routing', 'Document sources',
        'Plans', 'Markdown guide', 'Frontmatter', 'Search',
        'Skills', 'Workspace', 'Knowledge graph', 'Frontend BFF',
        'Localization', 'Configuration', 'ADR catalogue', 'Tag taxonomy',
      ]
    : [
        '快速开始', '什么是 Axi Docs', '路由约定', '文档来源',
        'Plans', 'Markdown 指南', 'Frontmatter', '搜索',
        '技能库', '工作区', '知识图谱', '前端 BFF',
        '本地化', '配置总览', 'ADR 目录', '标签体系',
      ]
  const items = sampleNodes.map((title, index) => ({
    id: `sample-${index}`,
    title,
    tags: [],
  }))

  // 简单的环形布局：节点均匀分布在外圈
  const radius = 130
  const cx = 160
  const cy = 160
  const nodes = items.map((item, index) => {
    const angle = (index / items.length) * Math.PI * 2
    return {
      ...item,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    }
  })
  const center = { x: cx, y: cy }

  return (
    <section className="doc-companion doc-companion--graph" aria-label={isEnLocal ? 'Knowledge graph preview' : '知识图谱预览'}>
      <h2 className="doc-companion__title">{isEnLocal ? 'Knowledge graph preview' : '知识图谱预览'}</h2>
      <p className="doc-companion__hint">
        {isEnLocal
          ? 'A radial view of the top-level catalog — use the top search to dive into a specific node.'
          : '当前目录的环形预览——可使用顶部搜索进入任意节点。'}
      </p>
      <svg
        className="doc-companion__graph"
        viewBox="0 0 320 320"
        role="img"
        aria-label={isEnLocal ? 'Radial knowledge graph' : '环形知识图谱'}
      >
        {nodes.map((node) => (
          <line
            key={`${node.id}-line`}
            x1={Number(center.x.toFixed(2))}
            y1={Number(center.y.toFixed(2))}
            x2={Number(node.x.toFixed(2))}
            y2={Number(node.y.toFixed(2))}
            stroke="var(--axi-docs-color-text-muted, rgba(255,255,255,0.18))"
            strokeWidth={1}
          />
        ))}
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={4} fill="var(--color-brand)" />
            <text
              x={node.x + 8}
              y={node.y + 4}
              fontSize={10}
              fill="var(--axi-docs-color-text)"
              className="doc-companion__graph-label"
            >
              {node.title.length > 14 ? `${node.title.slice(0, 12)}…` : node.title}
            </text>
          </g>
        ))}
        <circle cx={center.x} cy={center.y} r={8} fill="var(--axi-docs-color-text)" />
        <text x={center.x} y={center.y + 22} textAnchor="middle" fontSize={10} fill="var(--axi-docs-color-text-muted)">
          {isEnLocal ? 'workspace' : '工作区'}
        </text>
      </svg>
    </section>
  )
}