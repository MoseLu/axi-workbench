import { Bot, FileCheck2, SlidersHorizontal, Workflow } from "lucide-react";
import { Metric } from "../../components/ui";
import { profileLabel, reasoningLabel } from "../../app/format";
import type { AutoParameterResult } from "../providers/types";
import type { AxiSuiteSnapshot } from "../mobile/axiSuiteSnapshot";

type AgentPageProps = {
  autoParams: AutoParameterResult | null;
  autoPrompt: string;
  busy: string | null;
  suiteSnapshot: AxiSuiteSnapshot | null;
  onDeriveParams: () => void;
  onPromptChange: (prompt: string) => void;
};

export function AgentPage({ autoParams, autoPrompt, busy, suiteSnapshot, onDeriveParams, onPromptChange }: AgentPageProps) {
  return (
    <section className="page-stack">
      <div className="ops-grid">
        <article className="ops-panel">
          <div className="panel-title">
            <Workflow size={18} />
            <h2>工作站任务</h2>
          </div>
          <div className="timeline">
            <TimelineItem title="接收任务" value="项目上下文 / 路由 / 负责人" />
            <TimelineItem title="执行任务" value="Axi Agent safe task" />
            <TimelineItem title="回收证据" value="证据评审 / 移动通知" />
          </div>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <FileCheck2 size={18} />
            <h2>证据评审</h2>
          </div>
          <div className="contract-list">
            <ContractRow label="桌面证据" value="tests / build / logs" />
            <ContractRow label="移动证据" value={suiteSnapshot?.mobile.latestGoal70Artifact ?? "goal70 artifact 未找到"} />
            <ContractRow label="Notify 回流" value={suiteSnapshot?.notify.endpoints.join(" / ") ?? "POST /v1/events / GET /v1/events"} />
          </div>
        </article>

        <article className="ops-panel">
          <div className="panel-title">
            <Bot size={18} />
            <h2>模型参数</h2>
            <button className="panel-action" onClick={onDeriveParams} disabled={busy === "params"} type="button">
              <SlidersHorizontal size={17} />
              推导参数
            </button>
          </div>
          <textarea value={autoPrompt} onChange={(event) => onPromptChange(event.target.value)} rows={4} />
          {autoParams ? (
            <div className="param-grid compact">
              <Metric label="策略" value={profileLabel(autoParams.profile)} />
              <Metric label="温度" value={autoParams.temperature.toString()} />
              <Metric label="上下文" value={autoParams.maxContextTokens.toLocaleString()} />
              <Metric label="推理强度" value={reasoningLabel(autoParams.reasoningEffort)} />
              <Metric label="思考" value={autoParams.thinking ? "开启" : "关闭"} />
            </div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function TimelineItem({ title, value }: { title: string; value: string }) {
  return (
    <div className="timeline-item is-info">
      <span>
        <Bot size={16} />
      </span>
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
