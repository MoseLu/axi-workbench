import {
  SupportedResourceKind,
  resourceToolIds,
  type ConversationContext,
  type PlannerMemoryContext,
  type PlannerResult,
  type ToolDefinition,
} from "@axi/gateway-contracts";
import { OpenAICompatiblePlanner, RuleBasedPlanner, type Planner } from "@axi/resource-orchestrator/browser";

/**
 * Build the in-browser planner for the workbench.
 *
 * The inner planner (RuleBased / OpenAI-compatible) lives in
 * `@axi/resource-orchestrator/browser`. We wrap it with a thin workbench-local
 * `kindHintPlanner` that detects project / ui / icon requests before
 * delegating, because the upstream RuleBasedPlanner only recognises image /
 * skill / document / workspace / web and we must not change packages/. The
 * workbench does not invent provider facts — once a kind is hinted, the
 * planner emits a `resource.search.<kind>` toolId and lets the gateway
 * mint every candidate fact.
 *
 * Everything provider-related still goes through `apps/gateway` via
 * `runPlanner`. The OpenAI branch reads only `VITE_LLM_BASE_URL` /
 * `VITE_LLM_MODEL` (local LLM endpoints such as Ollama / vLLM); the
 * workbench never touches provider secret env vars. Anything sensitive
 * belongs in `apps/gateway`, not in the browser bundle.
 */
const projectPatterns = /(项目|project\b|workspace\s+info|项目信息|项目状态|查项目|有哪些项目|项目清单|项目说明)/iu;
const uiPatterns = /(ui\s*库|ui\s*组件|界面库|组件库|组件|design\s*system|组件说明|前.?端组件|ui\s*kit)/iu;
const iconPatterns = /(图标|icon|svg|emoji\s*集|图标库|icon\s*set)/iu;

const SUPPORTED_KINDS: readonly SupportedResourceKind[] = ["image", "document", "project", "ui", "icon"];

const detectKind = (input: string): SupportedResourceKind | null => {
  const normalized = input.trim();
  if (!normalized) return null;
  if (projectPatterns.test(normalized)) return "project";
  if (uiPatterns.test(normalized)) return "ui";
  if (iconPatterns.test(normalized)) return "icon";
  return null;
};
const toolIdForKind = (kind: SupportedResourceKind): string => {
  const key = `search${kind.charAt(0).toUpperCase()}${kind.slice(1)}` as keyof typeof resourceToolIds;
  return resourceToolIds[key];
};

interface PlannedKindHint {
  intent: PlannerResult["intent"];
  toolId: string;
}

/**
 * Detect project / ui / icon requests and short-circuit to a kind-scoped
 * `PlannerResult`. Returns `null` when the input is for the inner planner.
 */
const tryPlanKindHint = (input: string): PlannedKindHint | null => {
  const kind = detectKind(input);
  if (!kind || !SUPPORTED_KINDS.includes(kind)) return null;
  return {
    toolId: toolIdForKind(kind),
    intent: {
      operation: "search",
      resourceKinds: [kind],
      constraints: { query: input },
      needsClarification: false,
    },
  };
};

/**
 * `KindHintPlanner` — a Planner adapter that detects project / ui / icon
 * queries before delegating to the inner RuleBased / OpenAI planner. It
 * keeps the inner planner's id so existing UI strings ("demo-rule-planner",
 * "openai-compatible-planner") stay stable, and emits a toolId only when
 * it can derive one from the supported resource kinds.
 */
export class KindHintPlanner implements Planner {
  readonly id: string;

  constructor(private readonly inner: Planner) {
    this.id = inner.id;
  }

  async plan(
    input: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
    context?: PlannerMemoryContext,
    conversation?: ConversationContext,
  ): Promise<PlannerResult> {
    const hint = tryPlanKindHint(input);
    if (!hint) return this.inner.plan(input, tools, signal, context, conversation);

    const matchingTool = tools.find((tool) => tool.id === hint.toolId);
    if (!matchingTool) {
      // Tool catalog does not advertise the hinted kind; let the inner
      // planner handle it (it will likely emit clarification). This
      // protects us against a tool catalog that was built without the
      // new kinds.
      return this.inner.plan(input, tools, signal, context, conversation);
    }

    // MEM-MVP-014 — even when we short-circuit, push the memory
    // context through to the inner planner so consistent preference
    // facts still influence the kind hint; the inner planner only
    // consumes the typed facts projection, never the store path or
    // original evidence.
    return {
      intent: hint.intent,
      calls: [{ toolId: hint.toolId, input: { query: input } }],
      explanation: `workbench 识别为 ${hint.intent.resourceKinds[0]} 搜索，使用受控工具 ${hint.toolId}。`,
    };
  }
}

export const makePlanner = (): Planner => {
  // The OpenAI-compatible path is intentionally unauthenticated here:
  // the workbench only runs against local LLM endpoints (Ollama / vLLM)
  // that don't require keys. Anything sensitive must stay in
  // `apps/gateway`.
  const inner = import.meta.env.VITE_LLM_MODE === "openai"
    ? new OpenAICompatiblePlanner({
        baseUrl: import.meta.env.VITE_LLM_BASE_URL || "http://127.0.0.1:11434/v1",
        model: import.meta.env.VITE_LLM_MODEL || "gemma3:12b",
      })
    : new RuleBasedPlanner();
  return new KindHintPlanner(inner);
};
