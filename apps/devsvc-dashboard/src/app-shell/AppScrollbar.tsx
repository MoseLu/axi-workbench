import type { ReactNode } from "react";

export function AppScrollbar({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`app-scrollbar ${className}`}>
      <div className="app-scrollbar__wrap">
        <div className="app-scrollbar__view">{children}</div>
      </div>
    </div>
  );
}
