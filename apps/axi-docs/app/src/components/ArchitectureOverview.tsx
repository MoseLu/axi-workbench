import type { ReactNode } from 'react'

interface WorkspaceArchitecturePageProps {
  onNavigate?: (path: string) => void
}

interface ModuleCardProps {
  icon: string
  title: string
  description: string
  variant?: 'default' | 'highlight' | 'warn' | 'muted'
  children?: ReactNode
  onNavigate?: (path: string) => void
}

function ModuleCard({ icon, title, description, variant = 'default', children }: ModuleCardProps) {
  const variantClass = variant !== 'default' ? `module-${variant}` : ''
  return (
    <div className={`module-card ${variantClass}`}>
      <span className="module-icon">{icon}</span>
      <h3 className="module-title">{title}</h3>
      <p className="module-desc">{description}</p>
      {children && <div className="module-subs">{children}</div>}
    </div>
  )
}

interface SubCardProps {
  title: string
  description?: string
  variant?: 'default' | 'warn' | 'hi' | 'muted'
  onClick?: () => void
}

function SubCard({ title, description, variant = 'default', onClick }: SubCardProps) {
  return (
    <div
      className={`sub-card sub-${variant}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <b>{title}</b>
      {description && <small>{description}</small>}
    </div>
  )
}

export function ArchitectureOverview({ onNavigate: _onNavigate }: WorkspaceArchitecturePageProps) {
  return (
    <div className="architecture-overview">
      {/* Root Block */}
      <div className="arch-root">
        <h2>Axi 工作区</h2>
        <small>非 git 容器（ADR-003）· 承载 6 大架构层 + 1 条闭环</small>
      </div>

      {/* Layer 1: Policy & Rules */}
      <div className="arch-layer">
        <div className="layer-title">第一层 · 政策与规则（约束源头）</div>
        <div className="arch-grid arch-grid-4">
          <ModuleCard icon="📜" title="根入口" description="声明分区、命名规则、项目选择、跨仓协调">
            <SubCard title="工作区根" description="AGENTS.md / workspace.json" />
          </ModuleCard>
          <ModuleCard icon="📚" title="权威索引 + 真源" description="人类索引 + 机器关系图 + 企业注册表">
            <SubCard title="命名表" description="人类/机器/企业三层真源" variant="warn" />
          </ModuleCard>
          <ModuleCard icon="🏛️" title="ADR 决策" description="链式演进的架构决策记录">
            <SubCard title="5 个决策" description="治理仓/命名/容器/包层/工作流" />
          </ModuleCard>
          <ModuleCard icon="⚖️" title="规则工程" description="62 条 AR-* 规则 · 12 维度">
            <SubCard title="12 个规则域" description="路由/记忆/验证/安全/交接/..." />
            <SubCard title="执行器" description="规则的代码化与门控" />
          </ModuleCard>
        </div>
      </div>

      {/* Layer 2: Projects */}
      <div className="arch-layer">
        <div className="layer-title">第二层 · 项目（业务承载）</div>
        <div className="arch-grid arch-grid-7">
          <ModuleCard icon="📦" title="独立产品" description="面向用户的应用" variant="highlight">
            <SubCard title="3 个" variant="hi" />
          </ModuleCard>
          <ModuleCard icon="🧬" title="工程级 monorepo" description="大型跨域项目">
            <SubCard title="9 个 + 规则仓" />
            <SubCard title="最大消费汇聚点" variant="hi" />
          </ModuleCard>
          <ModuleCard icon="🧩" title="共享包" description="跨项目复用的资产">
            <SubCard title="3 个 · UI 主出口" variant="hi" />
          </ModuleCard>
          <ModuleCard icon="⚙️" title="基础设施" description="治理 / 注册中心">
            <SubCard title="2 个" />
          </ModuleCard>
          <ModuleCard icon="🔧" title="工具" description="小工具项目">
            <SubCard title="3 个" />
          </ModuleCard>
          <ModuleCard icon="📋" title="引用仓" description="外部参考" variant="muted">
            <SubCard title="审计排除" variant="muted" />
          </ModuleCard>
          <ModuleCard icon="🧬" title="孵化区" description="非项目验证" variant="muted">
            <SubCard title="不在主线" variant="muted" />
          </ModuleCard>
        </div>
      </div>

      {/* Layer 3: Toolchain */}
      <div className="arch-layer">
        <div className="layer-title">第三层 · 工具链（自动化底座）</div>
        <div className="arch-grid arch-grid-4">
          <ModuleCard icon="⌨️" title="主 CLI" description="18 子命令的统一入口">
            <SubCard title="5 大类" description="查询/校验/状态/准入/路径" />
          </ModuleCard>
          <ModuleCard icon="🏭" title="生成器" description="从真源生成快照/文档/镜像">
            <SubCard title="10 个" />
            <SubCard title="文档同步器" />
            <SubCard title="代码镜像器" />
            <SubCard title="规则/契约/审计" />
          </ModuleCard>
          <ModuleCard icon="🛠️" title="运行时" description="Node22 兼容 + 事件账本">
            <SubCard title="事件账本" />
            <SubCard title="进程管理" />
          </ModuleCard>
          <ModuleCard icon="🔗" title="wrapper" description="顶层薄壳，转发到真实现" variant="muted">
            <SubCard title="部分已 deprecated" variant="muted" />
          </ModuleCard>
        </div>
      </div>

      {/* Layer 4: Generated Artifacts */}
      <div className="arch-layer">
        <div className="layer-title">第四层 · 生成产物（自动派生）</div>
        <div className="arch-grid arch-grid-4">
          <ModuleCard icon="📑" title="人类可读文档" description="9 份 markdown 渲染">
            <SubCard title="项目目录/拓扑/所有权" />
            <SubCard title="完成度/交接矩阵" />
          </ModuleCard>
          <ModuleCard icon="📊" title="JSON 快照" description="机器消费的状态快照">
            <SubCard title="完成度" variant="hi" />
            <SubCard title="交接" variant="hi" />
            <SubCard title="校验" description="滞后 65 天" variant="warn" />
          </ModuleCard>
          <ModuleCard icon="🪞" title="前端镜像" description="前端运行时消费的副本">
            <SubCard title="public" variant="hi" />
            <SubCard title="dist 陈旧" description="落后 7-8 天" variant="warn" />
          </ModuleCard>
          <ModuleCard icon="🧠" title="CodeGraph 索引" description="代码知识图谱">
            <SubCard title="15 处索引" />
            <SubCard title="~1 GB 总大小" />
            <SubCard title="根索引占 85%" variant="muted" />
          </ModuleCard>
        </div>
      </div>

      {/* Layer 5: Adapters */}
      <div className="arch-layer">
        <div className="layer-title">第五层 · 适配器（多 CLI 镜像）</div>
        <div className="arch-grid arch-grid-3">
          <ModuleCard icon="🤖" title="用户级 CLI 指令" description="4 个 CLI 的 AGENTS 指令镜像">
            <SubCard title="Claude" />
            <SubCard title="Codex" />
            <SubCard title="Gemini" />
            <SubCard title="OpenCode" />
          </ModuleCard>
          <ModuleCard icon="📁" title="工作区级镜像" description="项目内的本地钩子/配置">
            <SubCard title="OpenCode 配置" />
            <SubCard title="Edit gate 钩子" />
            <SubCard title="Skill marketplace" />
          </ModuleCard>
          <ModuleCard icon="⚡" title="本地 AI 能力层" description="~/.cc-connect 守护进程生态">
            <SubCard title="能力路由表" description="asr/llm/image/audio/video" />
            <SubCard title="MCP server ×3" />
            <SubCard title="本地模型" description="ollama-local" />
          </ModuleCard>
        </div>
      </div>

      {/* Closed Loop Banner */}
      <div className="arch-loop">
        <b>🔁 闭合链路 · 任何修改都走这条环</b>
        <small>修改源文件 → 生成器重跑 → 镜像刷新 → 三件套校验（validate + audit + docs-sync）→ 失败阻塞 commit → 4 CLI + 前端消费</small>
      </div>
    </div>
  )
}
