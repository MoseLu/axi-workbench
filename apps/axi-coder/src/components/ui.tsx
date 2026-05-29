import type { ReactNode } from "react";

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function IconAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="icon-action" onClick={onClick} title={label} aria-label={label} type="button">
      {icon}
    </button>
  );
}
