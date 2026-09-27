import type { ResourceCandidate } from "@axi/gateway-contracts";
import { presentationOrientationFor } from "../../lib/format";

export interface ImagePreviewModalProps {
  item: ResourceCandidate;
  index: number;
  total: number;
  zoom: number;
  onClose: () => void;
  onMove: (delta: number) => void;
  onZoom: (delta: number) => void;
}

export function ImagePreviewModal({ item, index, total, zoom, onClose, onMove, onZoom }: ImagePreviewModalProps) {
  return (
    <div
      className="image-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="image-preview-dialog">
        <div className="image-preview-toolbar">
          <span className="image-preview-count">{index + 1} / {total}</span>
          <div className="image-preview-actions">
            <a
              className="image-preview-action"
              href={item.preview}
              download={`resource-image-${index + 1}.webp`}
              aria-label="导出图片"
              title="导出"
            >
              ↓
            </a>
            <button
              type="button"
              className="image-preview-action"
              onClick={onClose}
              aria-label="关闭预览"
              title="关闭"
            >
              ×
            </button>
          </div>
        </div>
        {total > 1 && (
          <button
            type="button"
            className="image-preview-nav image-preview-nav-prev"
            onClick={() => onMove(-1)}
            aria-label="上一张图片"
            title="上一张"
          >
            ‹
          </button>
        )}
        <div className={`image-preview-stage image-preview-stage-${presentationOrientationFor(item)}`}>
          <img src={item.preview} alt={item.title} style={{ transform: `scale(${zoom})` }} />
        </div>
        {total > 1 && (
          <button
            type="button"
            className="image-preview-nav image-preview-nav-next"
            onClick={() => onMove(1)}
            aria-label="下一张图片"
            title="下一张"
          >
            ›
          </button>
        )}
        <div className="image-preview-zoom" aria-label="缩放控制">
          <button type="button" onClick={() => onZoom(-0.1)} aria-label="缩小">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => onZoom(0.1)} aria-label="放大">+</button>
        </div>
      </div>
    </div>
  );
}
