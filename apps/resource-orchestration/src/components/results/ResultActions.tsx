import { formatMessageTime } from "../../lib/format";

export interface ResultActionsProps {
  at: number;
  copied: boolean;
  onCopy: () => void;
}

/**
 * Hover action bar for assistant output (plain replies and result blocks).
 * Mirrors `.message-actions` on user bubbles, but intentionally carries only
 * copy + timestamp — assistant output has no edit affordance.
 */
export function ResultActions({ at, copied, onCopy }: ResultActionsProps) {
  return (
    <div className="message-actions message-actions-assistant">
      <button
        type="button"
        aria-label={copied ? "已复制" : "复制回答"}
        title={copied ? "已复制" : "复制回答"}
        data-tooltip={copied ? "已复制" : "复制"}
        onClick={onCopy}
      >
        {copied ? "✓" : "⧉"}
      </button>
      <time dateTime={new Date(at).toISOString()}>{formatMessageTime(at)}</time>
    </div>
  );
}
