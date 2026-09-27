import { useState } from "react";
import type { ResourceCandidate } from "@axi/gateway-contracts";
import { presentationOrientationFor } from "../../lib/format";

export interface CandidateCardProps {
  item: ResourceCandidate;
  onPreview?: (item: ResourceCandidate) => void;
}

const KIND_LABEL: Record<string, string> = {
  image: "图片",
  document: "文档",
  project: "项目",
  ui: "UI 组件",
  icon: "图标",
  skill: "技能",
  workspace: "工作区",
  web: "网页",
};

function PreviewImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(!src);
  if (failed || !src) return <span className="preview-placeholder">图片暂不可用</span>;
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

const descriptionFor = (item: ResourceCandidate): string | undefined => {
  const description = item.facts?.description;
  return typeof description === "string" && description.trim() ? description : undefined;
};

export function CandidateCard({ item, onPreview }: CandidateCardProps) {
  const canPreview = item.kind === "image" && Boolean(item.preview) && Boolean(onPreview);
  const orientation = presentationOrientationFor(item);
  const kindLabel = KIND_LABEL[item.kind] || item.kind;
  const className = item.kind === "image"
    ? `candidate-card candidate-card-image candidate-card-orientation-${orientation}`
    : `candidate-result candidate-result-${item.kind} candidate-result-orientation-${orientation}`;
  const description = descriptionFor(item);
  const preview = item.kind === "image"
    ? <PreviewImage src={item.preview} alt={item.title} />
    : (
      <div className="candidate-preview-text">
        <h3>{item.title}</h3>
        <span className="candidate-kind-pill" data-kind={item.kind}>{kindLabel}</span>
        {description && <p>{description}</p>}
      </div>
    );
  const content = (
    <>
      {item.kind === "image" ? <div className="candidate-preview">{preview}</div> : <div className="candidate-result-content">{preview}</div>}
    </>
  );
  if (canPreview) {
    return (
      <button
        type="button"
        className={className}
        data-orientation={orientation}
        aria-label={`预览${item.title}`}
        title={`预览${item.title}`}
        onClick={() => onPreview?.(item)}
      >
        {content}
      </button>
    );
  }
  return (
    <article className={className} data-orientation={orientation} aria-label={item.title} title={item.title}>
      {content}
    </article>
  );
}
