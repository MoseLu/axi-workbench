import { useRef } from "react";
import { isSendKey } from "../../lib/keys";

export interface ComposerProps {
  value: string;
  isRunning: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function Composer({ value, isRunning, onChange, onSubmit, onCancel }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={textareaRef}
        id="resource-query"
        aria-label="输入消息"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (isSendKey(event)) {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="输入你想找的内容"
        disabled={isRunning}
      />
      <div className="composer-footer">
        {isRunning ? (
          <button
            type="button"
            className="send-button stop-button"
            onClick={onCancel}
            aria-label="停止请求"
            title="停止请求"
          >
            <svg className="stop-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            className="send-button"
            aria-label="开始查找"
            title="开始查找"
            disabled={!value.trim()}
          >
            <span aria-hidden="true">↑</span>
          </button>
        )}
      </div>
    </form>
  );
}
