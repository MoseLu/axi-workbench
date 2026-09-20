interface WorkspaceArchitecturePageProps {
  onNavigate?: (path: string) => void
}

export function ArchitectureDataFlow({ onNavigate: _onNavigate }: WorkspaceArchitecturePageProps) {
  return (
    <div className="architecture-data-flow">
      {/* Root Block */}
      <div className="arch-root">
        <h2>🔄 数据流转视角</h2>
        <small>从真源到消费方的 5 步链条</small>
      </div>

      {/* 5-Step Flow */}
      <div className="flow-steps">
        {/* Step 1: Source of Truth */}
        <div className="flow-step flow-step-1">
          <div className="step-card step-card-source">
            <span className="step-number">①</span>
            <h3>真相源</h3>
            <p>人写的、手维护的</p>
          </div>
          <div className="step-details">
            <div className="detail-card"><b>AGENTS.md</b></div>
            <div className="detail-card"><b>12 规则模块</b></div>
            <div className="detail-card"><b>5 个 ADR</b></div>
            <div className="detail-card"><b>workspace.json</b></div>
            <div className="detail-card"><b>workspace.graph.json</b></div>
            <div className="detail-card"><b>62 条 AR-*</b></div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flow-arrow">→</div>

        {/* Step 2: Generators */}
        <div className="flow-step flow-step-2">
          <div className="step-card step-card-generator">
            <span className="step-number">②</span>
            <h3>生成器</h3>
            <p>从源派生文档/JSON</p>
          </div>
          <div className="step-details">
            <div className="detail-card"><b>文档同步器</b></div>
            <div className="detail-card"><b>完成度快照</b></div>
            <div className="detail-card"><b>交接快照</b></div>
            <div className="detail-card"><b>校验快照</b></div>
            <div className="detail-card"><b>适配器扇出</b></div>
            <div className="detail-card"><b>前端镜像</b></div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flow-arrow">→</div>

        {/* Step 3: Validation */}
        <div className="flow-step flow-step-3">
          <div className="step-card step-card-validation">
            <span className="step-number">③</span>
            <h3>三件套校验</h3>
            <p>commit 前必须全绿</p>
          </div>
          <div className="step-details">
            <div className="detail-card"><b>validate</b></div>
            <div className="detail-card"><b>audit</b></div>
            <div className="detail-card"><b>docs-sync</b></div>
            <div className="detail-card detail-muted"><b>任一失败阻塞 commit</b></div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flow-arrow">→</div>

        {/* Step 4: Consumers */}
        <div className="flow-step flow-step-4">
          <div className="step-card step-card-consumer">
            <span className="step-number">④</span>
            <h3>消费方</h3>
            <p>真正使用的工作流</p>
          </div>
          <div className="step-details">
            <div className="detail-card"><b>4 个 CLI</b></div>
            <div className="detail-card"><b>前端应用</b></div>
            <div className="detail-card"><b>explorer agent</b></div>
          </div>
        </div>
      </div>

      {/* Drift Trigger Banner */}
      <div className="arch-loop">
        <b>↩ 漂移触发器</b>
        <small>第①步任何文件被修改 → 立刻触发第②步重跑 → 否则第③步校验失败 → commit 被拒 → 强制环路闭合</small>
      </div>
    </div>
  )
}
