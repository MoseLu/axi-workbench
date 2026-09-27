import { useLayoutEffect, useRef, useState } from "react";
import { isSendKey } from "../../lib/keys";
import type { ConversationMessage } from "../../lib/format";

export interface InlineMessageEditorProps {
  message: ConversationMessage;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

export function InlineMessageEditor({ message, onCancel, onSubmit }: InlineMessageEditorProps) {
  const [value, setValue] = useState(message.text);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };
  useLayoutEffect(resize, []);
  return (
    <div className="message message-user message-editing">
      <textarea
        ref={textareaRef}
        aria-label="编辑消息"
        value={value}
        onChange={(event) => { setValue(event.target.value); resize(); }}
        onKeyDown={(event) => { if (isSendKey(event)) { event.preventDefault(); onSubmit(value); } }}
      />
      <div className="message-edit-actions">
        <button type="button" className="edit-cancel" onClick={onCancel}>取消</button>
        <button type="button" className="edit-submit" onClick={() => onSubmit(value)} disabled={!value.trim()}>发送</button>
      </div>
    </div>
  );
}
