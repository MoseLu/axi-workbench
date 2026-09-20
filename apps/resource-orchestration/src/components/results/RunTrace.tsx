import { stateLabel } from "@axi/resource-orchestrator/browser";
import type { RunEvent } from "@axi/gateway-contracts";

export interface RunTraceProps {
  trace: RunEvent[];
}

export function RunTrace({ trace }: RunTraceProps) {
  if (trace.length === 0) return null;
  return (
    <ol className="run-trace" aria-label="运行 trace">
      {trace.map((event, index) => (
        <li
          key={`${event.state}-${index}`}
          data-testid="run-trace-step"
          data-state={event.state}
          className={`run-trace-step run-trace-${event.state}`}
        >
          <span className="run-trace-state">{stateLabel(event.state)}</span>
          {event.detail && <span className="run-trace-detail">{event.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
