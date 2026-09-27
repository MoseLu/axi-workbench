import React, { type ReactNode, useContext } from "react";

export type ToolbarSlotContextValue = {
  tableToolbarContainer: HTMLElement | null;
};

export const ToolbarSlotContext = React.createContext<ToolbarSlotContextValue | null>(null);

export function useTableToolbarSlot(): HTMLElement | null {
  const context = useContext(ToolbarSlotContext);
  return context?.tableToolbarContainer ?? null;
}

export type ToolbarSlotProviderProps = {
  children: ReactNode;
  tableToolbarContainer: HTMLElement | null;
};
