import { z } from "zod";
import {
  imageOrientationSchema,
  intentSchema,
  plannerResultSchema,
  resourceCandidateSchema,
  runStateSchema,
  type AdapterSearchResult,
  type ClarificationOption,
  type ImageOrientation,
  type Intent,
  type PlannerMemoryContext,
  type PlannerResult,
  type ResourceAdapter,
  type ResourceCandidate,
  type RunEvent,
  type RunResult,
  type RunState,
  type ToolCall,
  type ToolDefinition,
} from "@axi/gateway-contracts";
import { composeImagePrompt, extractKeywords } from "./prompt-composer";
import { GatewayOrchestrator } from "./gateway";

export interface Planner {
  id: string;
  plan(
    input: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
    context?: PlannerMemoryContext,
  ): Promise<PlannerResult>;
}

export interface RunOptions {
  signal?: AbortSignal;
  allowFlagged?: boolean;
  onEvent?: (event: RunEvent) => void;
  /** MEM-MVP-014 — pre-planner memory context. The planner only
   *  ever sees an allowlisted projection (id / kind / summary /
   *  facts / scope); the workbench or upstream caller is expected
   *  to have already redacted / deduped the list. */
  memoryContext?: PlannerMemoryContext;
}

type ToolHandler = (input: Record<string, unknown>, intent: Intent, signal?: AbortSignal) => Promise<AdapterSearchResult>;

interface RegisteredTool extends ToolDefinition {
  execute: ToolHandler;
}

const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(500),
  source: z.string().trim().min(1).max(120).optional(),
});

const generateImageInputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  aspectRatio: z.enum(["1:1", "16:9", "3:4", "4:3", "9:16"]).optional(),
  n: z.number().int().min(1).max(4).optional(),
});

const imagePresentationInputSchema = z.object({ orientation: imageOrientationSchema });

const orientationFromText = (value: string): ImageOrientation | undefined => {
  if (/横屏|横向|横版|宽屏|landscape|horizontal/iu.test(value)) return "landscape";
  if (/竖屏|竖向|竖版|纵屏|portrait|vertical/iu.test(value)) return "portrait";
  return undefined;
};

const orientationFromIntent = (intent: Intent): ImageOrientation => {
  const parsed = imageOrientationSchema.safeParse(intent.constraints.orientation);
  if (parsed.success) return parsed.data;
  const query = typeof intent.constraints.query === "string" ? intent.constraints.query : "";
  return orientationFromText(query) || "original";
};

/**
 * System-owned presentation tool. It never invents a resource or touches a file;
 * it only adds a deterministic crop/presentation policy to provider candidates.
 */
export const imagePresentationTool = {
  id: "resource.present.image",
  description: "按用户指定的横屏、竖屏或原图比例呈现图片候选。",
  inputSchema: imagePresentationInputSchema,
  access: "read_only" as const,
  resourceKinds: ["image"],
  apply(items: ResourceCandidate[], input: unknown): ResourceCandidate[] {
    const { orientation } = imagePresentationInputSchema.parse(input);
    return items.map((item) => item.kind !== "image" ? item : {
      ...item,
      facts: {
        ...item.facts,
        presentationOrientation: orientation,
        presentationTool: "resource.present.image",
      },
    });
  },
};

const clarificationDefaults: ClarificationOption[] = [
  { id: "image", label: "图片或视觉资源", value: "图片资源" },
  { id: "skill", label: "技能或工作流", value: "技能资源" },
  { id: "document", label: "文档或工作区知识", value: "文档资源" },
];

const now = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const requestKeyFor = (input: string) => {
  let hash = 2166136261;
  for (const character of input.trim().toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return `request-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const hasUnsafePath = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.includes("..") || value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value) || value.startsWith("file:");
  }
  if (Array.isArray(value)) return value.some(hasUnsafePath);
  if (value && typeof value === "object") return Object.values(value).some(hasUnsafePath);
  return false;
};

const uniqueItems = (items: ResourceCandidate[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

const chineseQuantity: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const parseQuantityToken = (token: string) => {
  if (/^\d+$/u.test(token)) return Number(token);
  if (token === "十") return 10;
  if (token.length === 2 && token.startsWith("十")) return 10 + (chineseQuantity[token[1]] || 0);
  if (token.length === 2 && token.endsWith("十")) return (chineseQuantity[token[0]] || 0) * 10;
  if (token.length === 2) return (chineseQuantity[token[0]] || 0) * 10 + (chineseQuantity[token[1]] || 0);
  return chineseQuantity[token];
};

const requestedQuantityFromText = (value: string) => {
  const match = value.match(/(\d+|[一二两三四五六七八九十]+)\s*(?:张|幅|个|份|条|枚)/u);
  if (!match) return undefined;
  const quantity = parseQuantityToken(match[1]);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : undefined;
};

const quantityFromIntent = (intent: Intent) => {
  const explicit = intent.constraints.requestedQuantity ?? intent.constraints.quantity ?? intent.constraints.count;
  if (typeof explicit === "number" && Number.isInteger(explicit) && explicit > 0) return explicit;
  if (typeof explicit === "string" && /^\d+$/u.test(explicit)) {
    const quantity = Number(explicit);
    if (quantity > 0) return quantity;
  }
  return typeof intent.constraints.query === "string" ? requestedQuantityFromText(intent.constraints.query) : undefined;
};

const quantityWasConfirmed = (intent: Intent) => {
  if (intent.constraints.quantityConfirmed === true || intent.constraints.showAllCandidates === true) return true;
  const query = typeof intent.constraints.query === "string" ? intent.constraints.query : "";
  return /确认|确定|同意|展示全部|显示全部|全部候选/iu.test(query);
};

const showAllCandidatesWasConfirmed = (intent: Intent) => {
  if (intent.constraints.showAllCandidates === true) return true;
  const query = typeof intent.constraints.query === "string" ? intent.constraints.query : "";
  return /(确认|确定|同意).*(展示|显示).*(全部|所有)|展示全部|显示全部|全部候选/iu.test(query);
};

const quantityUnitFor = (intent: Intent) => intent.resourceKinds.includes("image") ? "张" : intent.resourceKinds.includes("document") ? "份" : intent.resourceKinds.includes("web") ? "条" : "个";

export class RuleBasedPlanner implements Planner {
  id = "demo-rule-planner";

  async plan(input: string): Promise<PlannerResult> {
    const normalized = input.trim().toLocaleLowerCase();
    const resourceKinds: string[] = [];
    const requestedQuantity = requestedQuantityFromText(input);
    const requestedOrientation = orientationFromText(input);
    const quantityConfirmed = /确认|确定|同意|展示全部|显示全部|全部候选/iu.test(input);
    const showAllCandidates = /(确认|确定|同意).*(展示|显示).*(全部|所有)|展示全部|显示全部|全部候选/iu.test(input);
    const constraints = {
      query: input,
      ...(requestedQuantity ? { requestedQuantity } : {}),
      ...(requestedOrientation ? { orientation: requestedOrientation } : {}),
      ...(quantityConfirmed ? { quantityConfirmed: true } : {}),
      ...(showAllCandidates ? { showAllCandidates: true } : {}),
    };

    if (/图片|图像|头像|壁纸|照片|风景|景色|风光|自然|山水|天空|海边|人像|人物|美女|甜妹|妹子|女孩|女生|少女|封面|场景|环境|室内|室外|浴室|卧室|厨房|客厅|餐厅|汽车|车辆|轿车|小猫|猫|小狗|狗|动物|宠物|建筑|城市|街景|海报|插画|动漫|卡通|游戏|截图|横屏|竖屏|横向|竖向|横版|竖版|image|avatar|wallpaper|photo|scenery|landscape|portrait|vertical|horizontal/iu.test(normalized)) resourceKinds.push("image");
    if (/技能|skill|ppt|演示文稿|工作流|工具链/iu.test(normalized)) resourceKinds.push("skill");
    if (/文档|知识|规则|工作区|说明|document|docs/iu.test(normalized)) resourceKinds.push("document");
    if (/项目状态|项目有哪些|workspace status|工作区状态/iu.test(normalized)) resourceKinds.push("workspace");
    if (/网络|网页|网上|搜索网页|web search|search the web/iu.test(normalized)) resourceKinds.push("web");

    if (!resourceKinds.length) {
      return {
        intent: {
          operation: "search",
          resourceKinds: [],
          constraints,
          needsClarification: true,
          clarificationReason: "还不能确定要查询哪一类资源。",
        },
        calls: [],
        explanation: "先确认资源类型，再选择对应的只读 provider 工具。",
        clarification: clarificationDefaults,
      };
    }

    const primaryKind = resourceKinds.includes("web") ? "web" : resourceKinds[0];
    const compact = normalized.replace(/[？?！!。．\s]/gu, "");
    const isVague = compact.length < 8 || /^(帮我找|有哪些|查一下|看一下|找一些)$/u.test(compact);
    const toolId = primaryKind === "workspace" ? "resource.search.workspace" : `resource.search.${primaryKind}`;

    return {
      intent: {
        operation: "search",
        resourceKinds,
        constraints,
        needsClarification: isVague,
        clarificationReason: isVague ? "需求范围还比较宽，需要一个可检索的约束。" : undefined,
      },
      calls: isVague ? [] : [{ toolId, input: { query: input } }],
      explanation: `根据资源类型选择受控工具 ${toolId}，候选事实由 provider 返回。`,
      clarification: isVague
        ? [{ id: "narrow-query", label: "补充关键词或用途", value: "请补充用途、风格或关键词" }]
        : undefined,
    };
  }
}

export class OpenAICompatiblePlanner implements Planner {
  id = "openai-compatible-planner";

  constructor(
    private readonly options: {
      baseUrl: string;
      model: string;
      apiKey?: string;
    },
  ) {}

  async plan(input: string, tools: ToolDefinition[], signal?: AbortSignal): Promise<PlannerResult> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/u, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "你是本地资源中介的理解层。只输出 JSON。",
              "你只能从给定工具 id 中选择工具；不得输出绝对路径、文件内容、候选资源事实或任意 shell。",
              "候选事实必须由工具返回。没有足够信息时返回 needsClarification=true 且 calls=[]。",
              "如果用户表达了数量（例如一张、2个），请在 constraints.requestedQuantity 中填写数字；如果这是对上一轮候选数量的确认，请填写 quantityConfirmed=true 或 showAllCandidates=true。",
              "如果用户指定横屏、横向、横版或 landscape，请在 constraints.orientation 中填写 landscape；如果指定竖屏、竖向、竖版或 portrait，请填写 portrait；没有指定时不要臆测方向。",
              "JSON 形状：{intent:{operation,resourceKinds,constraints,needsClarification,clarificationReason?},calls:[{toolId,input}],explanation?,clarification?}",
              `工具目录：${JSON.stringify(tools.map(({ id, description, resourceKinds }) => ({ id, description, resourceKinds })))}`,
            ].join("\n"),
          },
          { role: "user", content: input },
        ],
      }),
    });

    if (!response.ok) throw new Error(`LLM provider returned ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM provider returned no structured content");
    const parsed = JSON.parse(content.replace(/^```json\s*/iu, "").replace(/\s*```$/u, ""));
    return plannerResultSchema.parse(parsed);
  }
}

export class ResourceOrchestrator {
  private readonly tools: RegisteredTool[];
  private readonly cache = new Map<string, RunResult>();

  constructor(
    private readonly options: {
      adapters: ResourceAdapter[];
      planner: Planner;
      /** Optional gateway; when set, every tool call routes through it so
       *  cache short-circuit, circuit breaker, and concurrent dispatch apply
       *  to production requests. When omitted, the orchestrator falls back
       *  to direct adapter invocation (legacy behaviour). */
      gateway?: GatewayOrchestrator;
    },
  ) {
    this.tools = options.adapters.flatMap((adapter) => {
      const kind = adapter.descriptor.resourceKinds[0];
      if (!kind) return [];
      const isGenerator = adapter.descriptor.toolId === "resource.generate.image";
      const id = adapter.descriptor.toolId || `resource.search.${kind}`;
      return [
        {
          id,
          description: isGenerator
            ? `使用 ${adapter.descriptor.label} 生成 ${kind} 资源。`
            : `在 ${adapter.descriptor.label} 中检索 ${kind} 资源。`,
          inputSchema: isGenerator ? generateImageInputSchema : searchInputSchema,
          access: "read_only" as const,
          resourceKinds: adapter.descriptor.resourceKinds,
          execute: (input, intent, signal) => adapter.search({
            ...intent,
            resourceKinds: adapter.descriptor.resourceKinds,
            constraints: { ...intent.constraints, ...input },
          }, signal),
        },
      ];
    });
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.tools.map(({ execute: _execute, ...definition }) => definition);
  }

  async run(input: string, options: RunOptions = {}): Promise<RunResult> {
    const requestKey = requestKeyFor(input);
    const cached = this.cache.get(requestKey);
    if (cached) return { ...cached, fromCache: true };

    const trace: RunEvent[] = [];
    const emit = (state: RunState, label: string, detail?: string) => {
      const event = { state, label, detail, at: now() } satisfies RunEvent;
      trace.push(event);
      options.onEvent?.(event);
    };
    const base = (state: RunState, partial: Partial<RunResult> = {}): RunResult => ({
      runId: makeId("run"),
      requestKey,
      state,
      planner: this.options.planner.id,
      items: [],
      warnings: [],
      trace,
      ...partial,
    });
    const halt = (state: RunState, partial: Partial<RunResult> = {}): RunResult => base(state, partial);

    try {
      if (options.signal?.aborted) return halt("cancelled", { error: "请求已取消。" });
      emit("interpreting", "理解自然语言需求");
      const rawPlan = await this.options.planner.plan(input, this.getToolDefinitions(), options.signal, options.memoryContext);
      const planResult = plannerResultSchema.safeParse(rawPlan);
      if (!planResult.success) return halt("failed", { error: "规划器输出未通过结构化校验。" });
      const plan = planResult.data;

      emit("planning", "校验工具选择", plan.explanation);
      const intentResult = intentSchema.safeParse(plan.intent);
      if (!intentResult.success) return halt("failed", { error: "意图未通过结构化校验。" });
      const intent = intentResult.data;

      if (intent.needsClarification || (!plan.calls.length && !plan.pipeline?.length)) {
        emit("clarifying", "需要补充约束", intent.clarificationReason);
        return halt("clarifying", {
          intent,
          explanation: plan.explanation,
          clarification: plan.clarification?.length ? plan.clarification : clarificationDefaults,
        });
      }

      const initialSteps: ToolCall[] = plan.pipeline?.length ? plan.pipeline : plan.calls;
      const collected: Array<{ call: ToolCall; result: AdapterSearchResult }> = [];

      for (let index = 0; index < initialSteps.length; index += 1) {
        if (options.signal?.aborted) return halt("cancelled", { intent, error: "请求已取消。" });
        const call = initialSteps[index];
        const tool = this.tools.find((candidate) => candidate.id === call.toolId);
        if (!tool) return halt("failed", { intent, error: `工具不在 allowlist 中：${call.toolId}` });
        if (hasUnsafePath(call.input)) return halt("failed", { intent, error: "工具参数包含不允许的路径或文件引用。" });
        const mergedInput = this.resolveReadFrom(call, collected);
        const inputResult = tool.inputSchema.safeParse(mergedInput);
        if (!inputResult.success) return halt("failed", { intent, error: `工具参数校验失败：${call.toolId}` });
        emit(labelForTool(call.toolId), `执行 ${call.toolId}`);
        const enrichedIntent = this.intentWithReadFrom(call, intent, collected);
        const result = await this.invokeTool(call.toolId, inputResult.data, enrichedIntent, options.signal);
        collected.push({ call, result });
      }

      // Pipeline auto-extension: when the planner returns a single image search
      // that came back empty, the orchestrator extends the pipeline with web
      // search and (when web returns organic results) composed-prompt image
      // generation. The planner never participates in this decision.
      if (initialSteps.length === 1) {
        const extension = await this.extendEmptyImagePipeline(intent, collected, emit, options);
        if (extension.kind === "halt") return halt(extension.state, extension.partial);
        if (extension.collected.length) {
          // Cascade replaces the empty image-search step with the extended
          // pipeline so confidence reflects the cascade outcome, not the empty
          // local-catalog signal that triggered it.
          collected.splice(0, collected.length, ...extension.collected);
        }
      }

      const isImageSearch = intent.resourceKinds.includes("image");
      emit(
        "validating",
        isImageSearch ? "验证候选来源与图片呈现" : "验证候选来源与安全分类",
        isImageSearch ? `${imagePresentationTool.id} 将按用户方向呈现，事实仍来自 provider。` : undefined,
      );
      const warnings = collected.flatMap((entry) => entry.result.warnings || []);
      const allItems = uniqueItems(collected.flatMap((entry) => entry.result.items));
      const invalidItem = allItems.find((item) => !resourceCandidateSchema.safeParse(item).success);
      if (invalidItem) return halt("failed", { intent, error: "provider 返回了不符合候选契约的资源。" });

      const visibleItems = allItems.filter((item) => item.safety !== "blocked" && (options.allowFlagged || item.safety !== "flagged"));
      const flaggedCount = allItems.filter((item) => item.safety === "flagged").length;
      if (!visibleItems.length) {
        emit("clarifying", "候选需要更明确的安全确认");
        return halt("clarifying", {
          intent,
          explanation: plan.explanation,
          warnings: [...warnings, ...(flaggedCount ? [`${flaggedCount} 个候选被标记为敏感，默认不展示。`] : [])],
          clarification: flaggedCount
            ? [{ id: "allow-flagged", label: "查看标记候选", value: "我确认查看标记为敏感的候选" }]
            : [{ id: "broaden", label: "放宽关键词", value: "请换一个更具体的关键词" }],
        });
      }

      const presentationOrientation = orientationFromIntent(intent);
      const presentedItems = intent.resourceKinds.includes("image")
        ? imagePresentationTool.apply(visibleItems, { orientation: presentationOrientation })
        : visibleItems;

      const requestedQuantity = quantityFromIntent(intent);
      const quantityConfirmed = quantityWasConfirmed(intent);
      const showAllCandidates = showAllCandidatesWasConfirmed(intent);
      const quantityUnit = quantityUnitFor(intent);
      if (requestedQuantity && presentedItems.length > requestedQuantity && !quantityConfirmed) {
        const explanation = `我找到 ${presentedItems.length} 个候选，超过你要求的 ${requestedQuantity}${quantityUnit}。先确认展示范围。`;
        emit("clarifying", "等待用户确认结果数量", explanation);
        return halt("clarifying", {
          intent,
          explanation,
          warnings,
          clarification: [
            { id: "confirm-requested-quantity", label: `只展示最匹配的 ${requestedQuantity}${quantityUnit}`, value: `确认只展示${requestedQuantity}${quantityUnit}` },
            { id: "show-all-results", label: `展示全部 ${presentedItems.length} 个候选`, value: "确认展示全部候选" },
          ],
        });
      }

      const confidence = collected.some((entry) => entry.result.confidence === "low") ? "low" : collected.some((entry) => entry.result.confidence === "medium") ? "medium" : "high";
      if (confidence === "low") {
        emit("clarifying", "候选范围过宽，需要进一步区分");
        return halt("clarifying", {
          intent,
          explanation: plan.explanation,
          items: presentedItems.slice(0, 6),
          warnings,
          clarification: collected.flatMap((entry) => entry.result.clarification || []).slice(0, 6),
        });
      }

      const finalItems = showAllCandidates || !requestedQuantity ? presentedItems : presentedItems.slice(0, requestedQuantity);
      emit("presenting", "候选已通过验证", `${finalItems.length} 个候选通过验证`);
      const result = base("presenting", {
        intent,
        explanation: plan.explanation,
        items: finalItems.slice(0, 12),
        warnings,
      });
      this.cache.set(requestKey, result);
      return result;
    } catch (error) {
      if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        return halt("cancelled", { error: "请求已取消。" });
      }
      return halt("failed", { error: error instanceof Error ? error.message : "provider 执行失败。" });
    }
  }

  private resolveReadFrom(call: ToolCall, collected: Array<{ call: ToolCall; result: AdapterSearchResult }>): Record<string, unknown> {
    if (!call.readFrom?.length) return call.input;
    const merged: Record<string, unknown> = { ...call.input };
    for (const ref of call.readFrom) {
      const source = collected[ref.step];
      if (!source) continue;
      const value = source.result.items.flatMap((item) => {
        const v = (item.facts as Record<string, unknown> | undefined)?.[ref.factKey];
        return v === undefined ? [] : [v];
      });
      if (value.length) merged[ref.factKey] = value[0];
    }
    return merged;
  }

  /**
   * Mirror the readFrom-resolved values into intent.constraints so adapter
   * implementations that observe the orchestrator intent (rather than the
   * tool input map) can see upstream step facts.
   */
  private intentWithReadFrom(
    call: ToolCall,
    intent: Intent,
    collected: Array<{ call: ToolCall; result: AdapterSearchResult }>,
  ): Intent {
    if (!call.readFrom?.length) return intent;
    const extra: Record<string, unknown> = {};
    for (const ref of call.readFrom) {
      const source = collected[ref.step];
      if (!source) continue;
      const value = source.result.items.flatMap((item) => {
        const v = (item.facts as Record<string, unknown> | undefined)?.[ref.factKey];
        return v === undefined ? [] : [v];
      });
      if (value.length) extra[ref.factKey] = value[0];
    }
    if (!Object.keys(extra).length) return intent;
    return { ...intent, constraints: { ...intent.constraints, ...extra } };
  }

  /**
   * Invoke a tool through the gateway when configured; otherwise fall back
   * to direct adapter invocation. Both paths produce an AdapterSearchResult
   * whose shape is identical, so callers (collect, validate, present) can
   * stay agnostic to the routing strategy.
   */
  private async invokeTool(
    toolId: string,
    input: Record<string, unknown>,
    intent: Intent,
    signal?: AbortSignal,
  ): Promise<AdapterSearchResult> {
    if (this.options.gateway) {
      const gatewayIntent: Intent = {
        ...intent,
        constraints: { ...intent.constraints, ...input },
      };
      // eslint-disable-next-line no-console
      const result = await this.options.gateway.dispatch({
        intent: gatewayIntent,
        toolId,
        signal,
        requestKey: `${requestKeyFor(String(gatewayIntent.constraints.query || ""))}|${toolId}`,
      });
      // eslint-disable-next-line no-console
      return result;
    }
    const tool = this.tools.find((candidate) => candidate.id === toolId);
    if (!tool) {
      return {
        items: [],
        sourceVersion: `orchestrator:no-tool:${toolId}`,
        confidence: "low",
        warnings: [`工具不在 allowlist 中：${toolId}`],
        mode: "fixture",
      };
    }
    return tool.execute(input, intent, signal);
  }

  /**
   * Auto-extend a single-step image-search pipeline when the local catalog
   * came back empty. Adds a web search step, and when that returns organic
   * results, a third step that generates an image with a composed prompt.
   */
  private async extendEmptyImagePipeline(
    intent: Intent,
    collected: Array<{ call: ToolCall; result: AdapterSearchResult }>,
    emit: (state: RunState, label: string, detail?: string) => void,
    options: RunOptions,
  ): Promise<
    | { kind: "halt"; state: RunState; partial: Partial<RunResult> }
    | { kind: "continue"; collected: Array<{ call: ToolCall; result: AdapterSearchResult }> }
  > {
    const first = collected[0];
    if (!first || first.call.toolId !== "resource.search.image") return { kind: "continue", collected: [] };
    if (first.result.items.length > 0) return { kind: "continue", collected: [] };
    if (first.result.confidence === "high") return { kind: "continue", collected: [] };

    const query = String(intent.constraints.query || "").trim();
    if (!query) return { kind: "continue", collected: [] };

    if (options.signal?.aborted) {
      return { kind: "halt", state: "cancelled" as const, partial: { intent, error: "请求已取消。" } };
    }
    const webTool = this.tools.find((tool) => tool.id === "resource.search.web");
    if (!webTool) return { kind: "continue", collected: [] };
    const webInput = webTool.inputSchema.safeParse({ query });
    if (!webInput.success) return { kind: "continue", collected: [] };
    emit("image-empty-fallback-searching", `执行 resource.search.web`);
    const webResult = await this.invokeTool("resource.search.web", webInput.data, intent, options.signal);
    const webEntry = { call: { toolId: "resource.search.web", input: { query } } satisfies ToolCall, result: webResult };

    if (!webResult.items.length) {
      emit("clarifying", "本地图库与全网都没有结果");
      const warnings = [first.result, webResult].flatMap((entry) => entry.warnings || []);
      return {
        kind: "halt",
        state: "clarifying",
        partial: {
          intent,
          explanation: "本地图库为空，全网搜索也没有可用结果。请换个关键词或换一个角度描述。",
          warnings,
          clarification: [{ id: "broaden", label: "换个角度描述", value: "请换个角度或换一组关键词" }],
          items: [],
        },
      };
    }

    emit("composing-prompt", "从网络结果合成生成 prompt");
    const composedPrompt = composeImagePrompt(query, webResult.items);
    const generateTool = this.tools.find((tool) => tool.id === "resource.generate.image");
    if (!generateTool) return { kind: "continue", collected: [webEntry] };
    const aspectRatio = aspectRatioForIntent(intent);
    const n = quantityFromIntent(intent) || 1;
    const generateInput = generateTool.inputSchema.safeParse({ prompt: composedPrompt, aspectRatio, n });
    if (!generateInput.success) return { kind: "continue", collected: [webEntry] };
    emit("image-generating", `执行 resource.generate.image`);
    const generated = await this.invokeTool("resource.generate.image", generateInput.data, intent, options.signal);
    const generateEntry = { call: { toolId: "resource.generate.image", input: { prompt: composedPrompt } } satisfies ToolCall, result: generated };
    return { kind: "continue", collected: [webEntry, generateEntry] };
  }
}

const labelForTool = (toolId: string): RunState => {
  if (toolId === "resource.search.image") return "image-searching";
  if (toolId === "resource.search.web") return "image-empty-fallback-searching";
  if (toolId === "resource.generate.image") return "image-generating";
  return "executing";
};

const aspectRatioForIntent = (intent: Intent) => intent.constraints.orientation === "landscape"
  ? "16:9"
  : intent.constraints.orientation === "portrait" ? "3:4" : "1:1";

export const stateLabel = (state: RunState) => ({
  idle: "待命",
  interpreting: "理解中",
  planning: "规划工具",
  executing: "查询资源",
  validating: "确定性验证",
  presenting: "结果就绪",
  clarifying: "需要澄清",
  failed: "执行失败",
  cancelled: "已取消",
  "image-searching": "本地图库搜索中",
  "image-empty-fallback-searching": "图库为空，正在全网搜索",
  "composing-prompt": "合成生成 prompt",
  "image-generating": "图片生成中",
}[runStateSchema.parse(state)]);

// Resource Gateway — Spring-Boot-Gateway-style routing layer for resource adapters.
// Drop-in surface kept stable: ResourceOrchestrator.run() still owns state, safety,
// presentation, and pipeline extension; it now calls GatewayOrchestrator for routing.
export {
  GatewayOrchestrator,
  type GatewayOrchestratorOptions,
  type AdapterFactory,
} from "./gateway";
export {
  providerManifestSchema,
  parseManifest,
  validateManifest,
  loadBalancerStrategySchema,
  circuitBreakerConfigSchema,
  targetSchema,
  routeSchema,
  fallbackChainSchema,
  type ProviderManifestInput,
} from "./gateway/manifest-schema";
export {
  validateManifestSemantics,
  validateTargetCapabilities,
  formatIssues,
  type ManifestIssue,
  type SemanticValidatorOptions,
} from "./gateway/manifest-validator";
// Shared-state facade exports (GHA-NEXT-025 — Phase D / P0).
// Callers (apps/gateway, integration tests) wire a SharedStateManager
// via these factories without reaching into sibling files.
export {
  type SharedStateManager,
  type SharedStateConfig,
  type BreakerStore,
  type RateLimitStore,
  type IdempotencyStore,
  type CacheStore,
  type SnapshotStore,
  type CoalesceStore,
  type RedisClientFactory,
  type RedisLike,
  configFromEnv,
  createNoopSharedStateManager,
  createUnreachableSharedStateManager,
  createValkeySharedStateManager,
  createValkeyBreakerStore,
  createValkeyRateLimitStore,
  createValkeyIdempotencyStore,
  createValkeySnapshotStore,
  createValkeyCoalesceStore,
  snapshotAllAsync,
  getSnapshotAsync,
  createPostgresSharedStateManager,
  createRealPgPool,
  type PostgresLikePool,
  type PostgresLikeClient,
  type PostgresClientFactory,
} from "./gateway/shared-state";
// GHA-NEXT-018 — re-export the backpressure registry so the
// reload path in apps/gateway can forward it across reloads.
export { BackpressureRegistry, BackpressureTimeoutError } from "./gateway/runtime/backpressure";
export type {
  CacheEntry,
  CircuitBreakerConfig,
  Filter,
  LoadBalancerStrategy,
  ManifestRoute,
  ManifestTarget,
  Predicate,
  ProviderManifest,
  RouteContext,
  RouteDefinition,
  Target,
} from "./gateway/route";
export type {
  AdapterDescriptor,
  AdapterSearchResult,
  ResourceAdapter,
} from "@axi/gateway-contracts";
export { ProviderRegistry, ProviderAlreadyRegisteredError, UnknownTargetError } from "./gateway/provider-registry";
export {
  intentKind,
  queryRegex,
  hasOrientation,
  byTag,
  byLanguage,
  byDomain,
  toolId,
  expression,
  alwaysTrue,
  and,
  not,
  registerPredicateBuilder,
  builderForPredicateId,
  scoreFor,
} from "./gateway/predicates";
export {
  traceFilter,
  safetyFilter,
  cacheLookupFilter,
  cacheStoreFilter,
  normalizeFilter,
  dedupFilter,
  enrichmentFilter,
  composeFilters,
} from "./gateway/filters";
export { CircuitBreaker, type BreakerState, type BreakerSnapshot } from "./gateway/circuit-breaker";
export { pickTarget } from "./gateway/load-balancer";
export { dispatchRoute, dispatchParallel } from "./gateway/dispatch";
// GHA-NEXT-007 / GHA-NEXT-008 — expose the runtime registries so the
// HTTP-edge router can wire them as primary owners of cache and
// coalescing. The router keeps its local Maps as dual-track fallbacks
// until the Stage 1.5 Gate confirms parity.
export { VersionedCache } from "./gateway/runtime/cache";
export { CoalescingRegistry } from "./gateway/runtime/coalesce";

// GHA-NEXT-016 — expose the active HealthRegistry implementation so
// the gateway composition root can construct it with the SSRF
// allowlist predicate wired in. The full surface (NoopHealthRegistry
// + ActiveHealthRegistry + helpers) is re-exported.
export {
  NoopHealthRegistry,
  ActiveHealthRegistry,
  deriveOverall,
  HEALTH_STATUS_TO_COMPONENT,
  type HealthRegistry,
  type HealthRegistrySnapshot,
  type HealthCheck,
  type HealthStatus,
  type FactoryHealth,
  type HealthEndpoint,
  type ActiveHealthRegistryOptions,
} from "./gateway/registries";

export type { RunEvent, RunResult, RunState } from "@axi/gateway-contracts";
export { composeImagePrompt, extractKeywords } from "./prompt-composer";
export {
  IMAGE_RELEVANCE_THRESHOLD,
  MAX_WEB_KEYWORD_DRIFT_RATIO,
  VISUAL_RELEVANCE_THRESHOLD,
  imageSearchQueryFor,
  imageProviderQueryFor,
  candidateSearchTextFor,
  imageRelevanceFor,
  querySubjectTermsFor,
  subjectColorFollowsQuery,
  webPoolDriftsFromQuery,
  relevantCandidatesFor,
  hasStrongPreviewImageMatchFor,
  placeholderImageEmbedder,
  filterByVisualRelevance,
  type ImageEmbedder,
  type VisualRelevanceDecision,
} from "./image-relevance";
export { STYLE_RULES, findStyleRule, styleModifierFor } from "./style-modifiers";
