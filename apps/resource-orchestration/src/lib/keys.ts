import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export const isSendKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>): boolean =>
  event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing;
