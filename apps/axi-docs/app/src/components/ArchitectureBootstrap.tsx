interface WorkspaceArchitecturePageProps {
  onNavigate?: (path: string) => void
}

export function ArchitectureBootstrap({ onNavigate: _onNavigate }: WorkspaceArchitecturePageProps) {
  return (
    <div className="architecture-bootstrap">
      {/* Root Block */}
      <div className="arch-root">
        <h2>🚦 项目准入视角</h2>
        <small>新建/修改前必经的 5 步门槛</small>
      </div>

      {/* Step 0: route-intent */}
      <div className="bootstrap-step">
        <div className="step-card step-card-source">
          <span className="step-number">🚧</span>
          <h3>第 0 步 · route-intent</h3>
          <p>route-intent 根据意图/domain/领域/capability 决定 5 种动作之一</p>
        </div>
        <div className="step-grid">
          <div className="detail-card"><b>reuse-existing</b><small>命中已有项目 owner</small></div>
          <div className="detail-card"><b>shared-provider</b><small>命中已有能力 provider</small></div>
          <div className="detail-card"><b>new-project-candidate</b><small>需要独立边界才允许</small></div>
          <div className="detail-card detail-muted"><b>incubate</b><small>非项目验证区</small></div>
        </div>
      </div>

      <div className="flow-arrow">↓</div>

      {/* Step 1: 5 Required Files */}
      <div className="bootstrap-step">
        <div className="step-card step-card-generator">
          <span className="step-number">📝</span>
          <h3>第 1 步 · 5 件齐</h3>
          <p>每个新项目必须具备 5 个 agent-readable 文件</p>
        </div>
        <div className="step-grid step-grid-5">
          <div className="detail-card"><b>AGENTS.md</b></div>
          <div className="detail-card"><b>README.md</b></div>
          <div className="detail-card"><b>INDEX.md</b></div>
          <div className="detail-card"><b>CHANGE.md</b></div>
          <div className="detail-card"><b>docs/HANDOFF.md</b></div>
        </div>
      </div>

      <div className="flow-arrow">↓</div>

      {/* Step 2-5: Three-Piece Validation */}
      <div className="bootstrap-step">
        <div className="step-card step-card-validation">
          <span className="step-number">✅</span>
          <h3>第 2-5 步 · 三件套校验</h3>
          <p>workspace-project validate + workspace-audit + workspace:docs:sync 必须全部 0 错误</p>
        </div>
        <div className="step-grid step-grid-3">
          <div className="detail-card"><b>validate</b></div>
          <div className="detail-card"><b>audit</b></div>
          <div className="detail-card"><b>docs-sync</b></div>
        </div>
      </div>

      {/* Enforcement Rules */}
      <div className="enforcement-rules">
        <div className="rule-deny">
          <span>❌</span>
          <span>不在 /Volumes/code/workspace 执行 git init</span>
        </div>
        <div className="rule-deny">
          <span>❌</span>
          <span>不从根目录 commit / push / clean / reset</span>
        </div>
        <div className="rule-allow">
          <span>✅</span>
          <span>代码修改进入拥有该代码的项目仓库</span>
        </div>
        <div className="rule-allow">
          <span>✅</span>
          <span>治理修改进入 infra/axi-workspace-governance</span>
        </div>
      </div>
    </div>
  )
}
