import {
  Activity,
  ArrowRight,
  FileCheck2,
  FolderGit2,
  Laptop,
  Network,
  Smartphone,
  Terminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { AxiCoderWorkbenchCard, AxiCoderWorkbenchModel, WorkbenchTarget } from "./axiCoderWorkbench";

type WorkbenchPanelProps = {
  model: AxiCoderWorkbenchModel;
  onAction: (target: WorkbenchTarget) => void;
};

const cardIcons: Record<AxiCoderWorkbenchCard["id"], LucideIcon> = {
  "project-context": FolderGit2,
  "cli-orchestration": Terminal,
  "agent-task": Workflow,
  "model-routing": Network,
  "artifact-review": FileCheck2,
  "mobile-companion": Smartphone,
};

export function WorkbenchPanel({ model, onAction }: WorkbenchPanelProps) {
  return (
    <section className="workbench-home" aria-label={model.title}>
      <div className="workbench-hero">
        <div className="workbench-actions" aria-label={model.summary}>
          {model.actions.map((action) => (
            <button
              className={action.target === "routes" ? "primary" : ""}
              key={action.target}
              onClick={() => onAction(action.target)}
              type="button"
            >
              {action.target === "routes" ? <Terminal size={17} /> : null}
              {action.target === "providers" ? <Network size={17} /> : null}
              {action.target === "logs" ? <FileCheck2 size={17} /> : null}
              {action.label}
            </button>
          ))}
        </div>
        <div className="workbench-status-panel" aria-label="端到端状态">
          <div className="workbench-status-badge">
            <Activity size={18} />
            <span>{model.primaryStatus}</span>
          </div>
          <div className="workbench-stats">
            {model.stats.map((stat) => (
              <div className="workbench-stat" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="workbench-flow" aria-label="端到端链路">
        {model.flow.map((step, index) => (
          <div className="workbench-flow-item" key={step.id}>
            <div className="workbench-flow-node">
              {step.id === "desktop" ? <Laptop size={18} /> : null}
              {step.id === "mobile" ? <Smartphone size={18} /> : null}
              {step.id !== "desktop" && step.id !== "mobile" ? <Workflow size={18} /> : null}
            </div>
            <div>
              <strong>{step.label}</strong>
              <span>{step.target}</span>
            </div>
            {index < model.flow.length - 1 ? <ArrowRight className="workbench-flow-arrow" size={18} /> : null}
          </div>
        ))}
      </div>

      <div className="workbench-card-grid">
        {model.cards.map((card) => {
          const Icon = cardIcons[card.id];
          return (
            <article className={`workbench-card ${card.tone}`} key={card.id}>
              <div className="workbench-card-icon">
                <Icon size={20} />
              </div>
              <div>
                <div className="workbench-card-heading">
                  <h2>{card.title}</h2>
                  <span>{card.status}</span>
                </div>
                <p>{card.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
