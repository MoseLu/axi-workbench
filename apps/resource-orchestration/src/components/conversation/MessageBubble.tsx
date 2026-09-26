import { formatMessageTime, type ConversationMessage } from "../../lib/format";
import { InlineMessageEditor } from "./InlineMessageEditor";

export interface MessageBubbleProps {
  message: ConversationMessage;
  copied: boolean;
  disabled: boolean;
  editable: boolean;
  editing: boolean;
  onCopy: (message: ConversationMessage) => void;
  onEdit: (message: ConversationMessage) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (value: string) => void;
}

/** The user's own bubble. Assistant output is rendered by the assistant turn,
 * which owns the single copy + timestamp bar for the whole reply. */
export function MessageBubble({
  message,
  copied,
  disabled,
  editable,
  editing,
  onCopy,
  onEdit,
  onCancelEdit,
  onSubmitEdit,
}: MessageBubbleProps) {
  if (editing) return <InlineMessageEditor message={message} onCancel={onCancelEdit} onSubmit={onSubmitEdit} />;
  return (
    <div className="message message-user">
      <p>{message.text}</p>
      <div className="message-actions">
        <time dateTime={new Date(message.at).toISOString()}>{formatMessageTime(message.at)}</time>
        <button
          type="button"
          aria-label={copied ? "已复制" : "复制消息"}
          title={copied ? "已复制" : "复制消息"}
          data-tooltip={copied ? "已复制" : "复制"}
          onClick={() => onCopy(message)}
          disabled={disabled}
        >
          {copied ? "✓" : "⧉"}
        </button>
        {editable && (
          <button
            type="button"
            aria-label="编辑消息"
            title="编辑消息"
            data-tooltip="编辑"
            onClick={() => onEdit(message)}
            disabled={disabled}
          >
            ✎
          </button>
        )}
      </div>
    </div>
  );
}
