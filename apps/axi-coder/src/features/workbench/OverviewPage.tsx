import { Activity, Bot, FileCheck2, Network, Smartphone, Terminal } from "lucide-react";
import type { ReactNode } from "react";
import { Metric } from "../../components/ui";
import { WorkbenchPanel } from "../product/WorkbenchPanel";
import { buildAxiCoderWorkbenchModel, type WorkbenchTarget } from "../product/axiCoderWorkbench";
import type { AxiSuiteSnapshot } from "../mobile/axiSuiteSnapshot";
import type { CliRoute, Provider, RequestLog } from "../providers/types";
import { ProjectCompletionPanel } from "./ProjectCompletionPanel";
import type { ProjectCompletionSnapshot } from "./projectCompletion";

type OverviewPageProps = {
  completionSnapshot: ProjectCompletionSnapshot | null;
  providers: Provider[];
  routes: CliRoute[];
  logs: RequestLog[];
  suiteSnapshot: AxiSuiteSnapshot | null;
  onAction: (target: WorkbenchTarget | "mobile" | "agent") => void;
};

export function OverviewPage({ completionSnapshot, providers, routes, logs, suiteSnapshot, onAction }: OverviewPageProps) {
  const workbenchModel = buildAxiCoderWorkbenchModel();
  const enabledRoutes = routes.filter((route) => route.enabled).length;
  const successLogs = logs.filter((log) => log.status === "success").length;

  return (
    <section className="page-stack">
      <div className="overview-metrics">
        <Metric label="供应商配置" value={`${providers.length || 1}`} />
        <Metric label="CLI 路由" value={`${enabledRoutes}/${routes.length || 3}`} />
        <Metric label="请求日志" value={`${logs.length}`} />
        <Metric label="成功记录" value={`${successLogs}`} />
      </div>

      <WorkbenchPanel model={workbenchModel} onAction={onAction} />
      <ProjectCompletionPanel snapshot={completionSnapshot} />

      <div className="ops-grid">
        <article className="ops-panel">
          <div className="panel-title">
            <Terminal size={18} />
            <h2>桌面端链路</h2>
          </div>
          <div className="timeline">
            <TimelineItem icon={<Terminal size={16} />} title="CLI 会话" value="Claude / Codex / Gemini" tone="success" />
            <TimelineItem icon={<Network size={16} />} title="模型路由" value="ProviderProfile + CredentialRef" tone="success" />
            <TimelineItem icon={<FileCheck2 size={16} />} title="请求证据" value="健康检查 + request logs" tone="info" />
          </div>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <Smartphone size={18} />
            <h2>移动伴随端</h2>
          </div>
          <div className="contract-list">
            <ContractRow label="Android 包" value={suiteSnapshot?.mobile.packageName ?? "com.mosscoder.notify"} />
            <ContractRow label="最近 E2E" value={suiteSnapshot?.mobile.latestGoal70Artifact ?? "未找到 goal70 artifact"} />
            <ContractRow label="Notify API" value={suiteSnapshot?.notify.endpoints.join(" / ") ?? "POST /v1/events / GET /v1/events"} />
          </div>
          <button className="primary" onClick={() => onAction("mobile")} type="button">
            <Smartphone size={16} />
            查看伴随端
          </button>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <Bot size={18} />
            <h2>任务执行 / 证据评审</h2>
          </div>
          <div className="artifact-strip">
            <span>
              <Activity size={15} />
              工作站任务
            </span>
            <span>
              <Bot size={15} />
              Axi Agent
            </span>
            <span>
              <FileCheck2 size={15} />
              评审证据
            </span>
          </div>
          <button onClick={() => onAction("agent")} type="button">
            打开任务执行
          </button>
        </article>
      </div>
    </section>
  );
}

function TimelineItem({ icon, title, value, tone }: { icon: ReactNode; title: string; value: string; tone: string }) {
  return (
    <div className={`timeline-item is-${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{value}</small>
      </div>
    </div>
  );
}

function ContractRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contract-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
