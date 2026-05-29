import React, { type ReactNode, useContext, useEffect } from "react";

export type ToolbarSlotContextValue = {
  setToolbarContent: (content: ReactNode) => void;
  tableToolbarContainer: HTMLElement | null;
};

export const ToolbarSlotContext = React.createContext<ToolbarSlotContextValue | null>(null);

export function useToolbarSlot(content: ReactNode) {
  const context = useContext(ToolbarSlotContext);
  useEffect(() => {
    if (!context) return;
    context.setToolbarContent(content);
    return () => context.setToolbarContent(null);
  }, [context, content]);
}

export function useTableToolbarSlot() {
  const context = useContext(ToolbarSlotContext);
  return context?.tableToolbarContainer;
}
