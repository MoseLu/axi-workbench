import { CheckCircle2, FileCheck2, ListChecks, ShieldAlert } from "lucide-react";
import {
  buildProjectCompletionOverview,
  formatCompletionDate,
  type ProjectCompletionItem,
  type ProjectCompletionSnapshot,
} from "./projectCompletion";

type ProjectCompletionPanelProps = {
  snapshot: ProjectCompletionSnapshot | null;
};

const stageTone: Record<ProjectCompletionItem["stage"], string> = {
  unassessed: "neutral",
  building: "warning",
  usable: "info",
  "near-complete": "info",
  complete: "success",
  maintenance: "success",
  blocked: "danger",
  archived: "neutral",
};

export function ProjectCompletionPanel({ snapshot }: ProjectCompletionPanelProps) {
  const overview = buildProjectCompletionOverview(snapshot);
  const featured = overview.axiProjects.slice(0, 5);

  return (
    <article className="ops-panel project-completion-panel">
      <div className="panel-title">
        <ListChecks size={18} />
        <h2>项目完成情况</h2>
        <span className="panel-meta">生成于 {formatCompletionDate(overview.generatedAt)}</span>
      </div>

      <div className="completion-metrics">
        {overview.metrics.map((metric) => (
          <div className="completion-stat" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      <div className="completion-list" aria-label="Axi 项目完成状态">
        {featured.length === 0 ? (
          <div className="completion-empty">暂未生成项目完成快照</div>
        ) : (
          featured.map((project) => (
            <div className="completion-row" key={project.id}>
              <span className={`completion-stage is-${stageTone[project.stage]}`}>
                {project.stage === "complete" || project.stage === "maintenance" ? <CheckCircle2 size={14} /> : null}
                {project.stage === "blocked" ? <ShieldAlert size={14} /> : null}
                {project.stage !== "complete" && project.stage !== "maintenance" && project.stage !== "blocked" ? <FileCheck2 size={14} /> : null}
                {project.stageLabel}
              </span>
              <div>
                <strong>{project.name}</strong>
                <small>{project.summary}</small>
              </div>
              <span className="completion-docs">{project.docs.status}</span>
            </div>
          ))
        )}
      </div>
    </article>
  );
}
