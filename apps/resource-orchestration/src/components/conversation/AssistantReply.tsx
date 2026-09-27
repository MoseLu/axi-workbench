export interface AssistantReplyProps {
  text: string;
}

/** Plain conversational line from the assistant. Carries no actions of its
 * own — the surrounding turn owns the single hover action bar. */
export function AssistantReply({ text }: AssistantReplyProps) {
  return (
    <div className="message message-assistant">
      <p>{text}</p>
    </div>
  );
}
