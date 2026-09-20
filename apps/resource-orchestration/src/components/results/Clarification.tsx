import type { ClarificationOption } from "@axi/gateway-contracts";

export interface ClarificationProps {
  options: ClarificationOption[];
  onChoose: (option: ClarificationOption) => void;
  showOptions?: boolean;
  showMessage?: boolean;
}

export function Clarification({ options, onChoose, showOptions = true, showMessage = true }: ClarificationProps) {
  const isQuantityConfirmation = options.some((option) => option.id === "confirm-requested-quantity" || option.id === "show-all-results");
  const isSafetyConfirmation = options.some((option) => option.id === "allow-flagged");
  const eyebrow = isQuantityConfirmation ? "数量确认" : isSafetyConfirmation ? "安全确认" : "需要补充";
  const message = isQuantityConfirmation
    ? "我先不替你展开全部结果，请确认展示范围。"
    : isSafetyConfirmation
    ? "候选被标记为敏感内容，确认后才会展示。"
    : "补充资源类型或关键词后继续。";
  const label = isQuantityConfirmation
    ? "找到的结果多于你要的数量"
    : isSafetyConfirmation
    ? "找到的图片需要确认后查看"
    : "再补充一点描述";
  return (
    <div className="assistant-followup" aria-label={label}>
      {showMessage && (
        <div className="assistant-followup-copy">
          <div className="eyebrow">{eyebrow}</div>
          <p>{message}</p>
        </div>
      )}
      {showOptions && (
        <div className="choice-row">
          {options.map((option) => (
            <button key={option.id} type="button" onClick={() => onChoose(option)}>
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
