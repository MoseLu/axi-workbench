import type { RunEvent } from "@axi/gateway-contracts";

/**
 * MEM-MVP-018 — Minimal memory run trace status hint.
 *
 * Surfaces redacted counts about memory in the existing "用时"
 * trace detail. The hint only ever reports aggregate numbers;
 * it never echoes summary text, facts, or paths.
 */

const MEMORY_TRACE_PATTERN = /本地记忆命中|memory/i;

const isMemoryTrace = (event: RunEvent): boolean =>
  MEMORY_TRACE_PATTERN.test(`${event.label} ${event.detail ?? ""}`);

export interface MemoryTraceHintProps {
  trace: ReadonlyArray<RunEvent>;
}

const extractCount = (event: RunEvent): number | null => {
  const detail = event.detail ?? "";
  const match = detail.match(/(\d+)\s*条/u);
  return match && match[1] ? Number(match[1]) : null;
};

export function MemoryTraceHint({ trace }: MemoryTraceHintProps) {
  const memoryEvents = trace.filter(isMemoryTrace);
  if (memoryEvents.length === 0) return null;
  const count = memoryEvents
    .map(extractCount)
    .filter((value): value is number => value !== null)
    .reduce((sum, value) => sum + value, 0);
  return (
    <p className="memory-trace-hint" aria-live="polite">
      {count > 0
        ? `命中 ${count} 条本地记忆偏好（脱敏后注入 planner）。`
        : "本地记忆已读取，但本轮无强相关命中。"}
    </p>
  );
}
