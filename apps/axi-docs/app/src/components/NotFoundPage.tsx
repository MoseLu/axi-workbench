interface NotFoundPageProps {
  title?: string
  description?: string
  primaryLabel?: string
  secondaryLabel?: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
}

export function NotFoundPage({
  title = '页面不存在',
  description = '当前链接没有对应的页面或内容。你可以返回首页重新浏览，或使用顶部搜索查找目标知识点。',
  primaryLabel = '返回首页',
  secondaryLabel = '打开搜索',
  onPrimaryAction,
  onSecondaryAction,
}: NotFoundPageProps) {
  return (
    <div className="workspace-empty-state workspace-empty-state--centered">
      <div className="workspace-empty-state__eyebrow">404 / Route Recovery</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="workspace-empty-state__support">
        <div className="workspace-empty-state__hint">
          <strong>优先恢复路径</strong>
          <span>返回首页重新进入当前上下文，确保数据源、分类和文档路由重新同步。</span>
        </div>
        <div className="workspace-empty-state__hint">
          <strong>如果链接来自分享</strong>
          <span>使用顶部搜索，用文档标题、节点名或路径关键词重新定位对应知识点。</span>
        </div>
      </div>
      <div className="workspace-empty-state__actions">
        <button className="workspace-empty-state__action" onClick={onPrimaryAction} type="button">
          {primaryLabel}
        </button>
        {onSecondaryAction && secondaryLabel && (
          <button className="workspace-empty-state__action workspace-empty-state__action--ghost" onClick={onSecondaryAction} type="button">
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
