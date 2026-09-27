interface WorkspaceArchitecturePageProps {
  onNavigate?: (path: string) => void
}

export function ArchitectureChangeTriggers({ onNavigate: _onNavigate }: WorkspaceArchitecturePageProps) {
  return (
    <div className="architecture-change-triggers">
      {/* Root Block */}
      <div className="arch-root">
        <h2>⚡ 修改触发的链路</h2>
        <small>改一处 → 触发整个工作区的连锁反应</small>
      </div>

      {/* 3-Column Layout */}
      <div className="trigger-grid">
        {/* Column 1: What to Modify */}
        <div className="trigger-column">
          <div className="step-card step-card-source">
            <h3>修改源文件</h3>
          </div>
          <div className="trigger-items">
            <div className="detail-card"><b>改根规则</b></div>
            <div className="detail-card"><b>改规则条目</b></div>
            <div className="detail-card"><b>改 ADR</b></div>
            <div className="detail-card"><b>改共享包</b></div>
            <div className="detail-card"><b>改前端代码</b></div>
            <div className="detail-card"><b>改注册表</b></div>
          </div>
        </div>

        {/* Arrow */}
        <div className="trigger-arrow">→</div>

        {/* Column 2: What Happens */}
        <div className="trigger-column">
          <div className="step-card step-card-generator">
            <h3>触发什么</h3>
          </div>
          <div className="trigger-items">
            <div className="detail-card detail-hi"><b>→ 重跑文档同步器</b></div>
            <div className="detail-card detail-hi"><b>→ 重跑适配器扇出</b></div>
            <div className="detail-card"><b>→ 重算完成度</b></div>
            <div className="detail-card"><b>→ 重算交接</b></div>
            <div className="detail-card"><b>→ 校验失败则 commit 阻塞</b></div>
          </div>
        </div>

        {/* Arrow */}
        <div className="trigger-arrow">→</div>

        {/* Column 3: Where to See Effects */}
        <div className="trigger-column">
          <div className="step-card step-card-consumer">
            <h3>看到效果的地方</h3>
          </div>
          <div className="trigger-items">
            <div className="detail-card detail-hi"><b>9 份渲染文档</b></div>
            <div className="detail-card detail-hi"><b>3 个 JSON 快照</b></div>
            <div className="detail-card detail-hi"><b>4 CLI 指令镜像</b></div>
            <div className="detail-card detail-hi"><b>前端镜像</b></div>
            <div className="detail-card"><b>CodeGraph 索引</b></div>
          </div>
        </div>
      </div>

      {/* Staleness Warning */}
      <div className="arch-loop arch-loop-warn">
        <b>⚠ 时效性陷阱</b>
        <small>任何"再跑一次"的延迟都会导致客户端看到陈旧数据 — 当前已知 65 天陈旧 verification + 7-8 天陈旧 dist/</small>
      </div>

      {/* Quick Fix Commands */}
      <div className="fix-commands">
        <h4>快速修复</h4>
        <pre><code>cd /Volumes/code/workspace/infra/axi-workspace-governance
pnpm workspace:docs:sync
node scripts/workspace-project-cli.mjs validate
node scripts/workspace-audit.mjs</code></pre>
      </div>
    </div>
  )
}
