/**
 * MEM-MVP-007 — Memory policy.
 *
 * Plain-data decisions used by both the workbench (pre-flight gate
 * before planner.search) and the gateway (post-run gate before the
 * idle extractor queues a contribution). The policy never touches
 * the filesystem or network; it only answers "should I read?" /
 * "should I write?" given a snapshot of the user's settings and the
 * outcome of the current run.
 *
 * Defaults match TODO-MEMORY-MVP.md §3:
 *   - useMemory: false
 *   - generateMemory: false
 *   - externalContextProtection: true
 *
 * canGenerate rejects:
 *   - generateMemory off
 *   - blocked safety / cancelled / failed / safety-confirmed outcomes
 *   - any run that touched MCP / Axi Docs / Axi Skills / web search /
 *     MiniMax / external provider provenance
 *   - externalContextProtection on + usedExternalContext true
 */

import type { MemorySettings } from "@axi/gateway-contracts";

export type RunOutcome =
  | "presenting"
  | "clarifying"
  | "cancelled"
  | "failed"
  | "safety-confirmed"
  | "fallback";

export interface GenerateContext {
  readonly outcome: RunOutcome;
  readonly usedExternalContext: boolean;
  /** Tool ids invoked this run; the policy fails closed on MCP / web / MiniMax. */
  readonly toolIds?: ReadonlyArray<string>;
}

export const defaultMemorySettings = (): MemorySettings => ({
  useMemory: false,
  generateMemory: false,
  externalContextProtection: true,
  defaultScope: "global",
});

export const canRead = (settings: MemorySettings): boolean => settings.useMemory;

const EXTERNAL_CONTEXT_PATTERNS: ReadonlyArray<RegExp> = [
  /^mcp\./iu,
  /axi-docs/iu,
  /axi-skills/iu,
  /resource\.search\.web/iu,
  /resource\.generate\.image/iu,
  /^minimax-tokenplan\./iu,
];

export const canGenerate = (settings: MemorySettings, context: GenerateContext): boolean => {
  if (!settings.generateMemory) return false;
  if (context.outcome === "cancelled" || context.outcome === "failed" || context.outcome === "safety-confirmed" || context.outcome === "fallback") return false;
  if (settings.externalContextProtection && context.usedExternalContext) return false;
  for (const toolId of context.toolIds ?? []) {
    if (EXTERNAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(toolId))) return false;
  }
  return true;
};

export const describePolicyDecision = (decision: boolean): "allow" | "deny" => decision ? "allow" : "deny";
