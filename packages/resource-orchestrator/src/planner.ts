import {
  plannerResultSchema,
  type ClarificationOption,
  type ConversationContext,
  type ImageOrientation,
  type PlannerMemoryContext,
  type PlannerResult,
  type ToolDefinition,
} from "@axi/gateway-contracts";

export interface Planner {
  id: string;
  plan(
    input: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
    context?: PlannerMemoryContext,
    conversation?: ConversationContext,
  ): Promise<PlannerResult>;
}

/**
 * Browser-safe planning contract.
 *
 * Keep this module free of gateway, adapter, database, filesystem, and
 * process imports. The workbench may load it directly; the server-only
 * orchestrator entry point retains compatible planner symbols separately.
 */

const orientationFromText = (value: string): ImageOrientation | undefined => {
  if (/横屏|横向|横版|宽屏|landscape|horizontal/iu.test(value)) return "landscape";
  if (/竖屏|竖向|竖版|纵屏|portrait|vertical/iu.test(value)) return "portrait";
  return undefined;
};

const clarificationDefaults: ClarificationOption[] = [
  { id: "image", label: "图片或视觉资源", value: "图片资源" },
  { id: "skill", label: "技能或工作流", value: "技能资源" },
  { id: "document", label: "文档或工作区知识", value: "文档资源" },
];

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

const memoryFact = (context: PlannerMemoryContext | undefined, key: string): string | number | boolean | undefined => {
  for (const memory of context?.memories ?? []) {
    const value = memory.facts[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  }
  return undefined;
};

const resourceKindFromMemory = (context: PlannerMemoryContext | undefined): string | undefined => {
  const value = memoryFact(context, "preferredResourceKind");
  if (typeof value !== "string") return undefined;
  if (/图片|图像|image/iu.test(value)) return "image";
  if (/技能|工作流|skill/iu.test(value)) return "skill";
  if (/文档|document|docs/iu.test(value)) return "document";
  if (/项目|project/iu.test(value)) return "project";
  return undefined;
};

export class RuleBasedPlanner implements Planner {
  id = "demo-rule-planner";

  async plan(input: string, _tools: ToolDefinition[], _signal?: AbortSignal, context?: PlannerMemoryContext, _conversation?: ConversationContext): Promise<PlannerResult> {
    const normalized = input.trim().toLocaleLowerCase();
    const resourceKinds: string[] = [];
    const requestedQuantity = requestedQuantityFromText(input);
    const requestedOrientation = orientationFromText(input);
    const memoryOrientation = memoryFact(context, "preferredOrientation");
    const effectiveOrientation = requestedOrientation ?? (memoryOrientation === "landscape" || memoryOrientation === "portrait" ? memoryOrientation : undefined);
    const quantityConfirmed = /确认|确定|同意|展示全部|显示全部|全部候选/iu.test(input);
    const showAllCandidates = /(确认|确定|同意).*(展示|显示).*(全部|所有)|展示全部|显示全部|全部候选/iu.test(input);
    const constraints = {
      query: input,
      ...(requestedQuantity ? { requestedQuantity } : {}),
      ...(effectiveOrientation ? { orientation: effectiveOrientation } : {}),
      ...(quantityConfirmed ? { quantityConfirmed: true } : {}),
      ...(showAllCandidates ? { showAllCandidates: true } : {}),
    };

    if (/图片|图像|头像|壁纸|照片|风景|景色|风光|自然|山水|天空|海边|人像|人物|美女|甜妹|妹子|女孩|女生|少女|封面|场景|环境|室内|室外|浴室|卧室|厨房|客厅|餐厅|汽车|车辆|轿车|小猫|猫|小狗|狗|动物|宠物|建筑|城市|街景|海报|插画|动漫|卡通|游戏|截图|横屏|竖屏|横向|竖向|横版|竖版|image|avatar|wallpaper|photo|scenery|landscape|portrait|vertical|horizontal/iu.test(normalized)) resourceKinds.push("image");
    if (/技能|skill|ppt|演示文稿|工作流|工具链/iu.test(normalized)) resourceKinds.push("skill");
    if (/文档|知识|规则|工作区|说明|document|docs/iu.test(normalized)) resourceKinds.push("document");
    if (/项目状态|项目有哪些|workspace status|工作区状态/iu.test(normalized)) resourceKinds.push("workspace");
    if (/网络|网页|网上|搜索网页|web search|search the web/iu.test(normalized)) resourceKinds.push("web");
    if (!resourceKinds.length) {
      const rememberedKind = resourceKindFromMemory(context);
      if (rememberedKind) resourceKinds.push(rememberedKind);
    }

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
    const toolId = primaryKind === "workspace" ? "resource.search.workspace" : "resource.search." + primaryKind;

    return {
      intent: {
        operation: "search",
        resourceKinds,
        constraints,
        needsClarification: isVague,
        clarificationReason: isVague ? "需求范围还比较宽，需要一个可检索的约束。" : undefined,
      },
      calls: isVague ? [] : [{ toolId, input: { query: input } }],
      explanation: "根据资源类型选择受控工具 " + toolId + "，候选事实由 provider 返回。" +
        (effectiveOrientation && !requestedOrientation ? "已应用本地记忆中的默认方向。" : ""),
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

  async plan(
    input: string,
    tools: ToolDefinition[],
    signal?: AbortSignal,
    context?: PlannerMemoryContext,
    conversation?: ConversationContext,
  ): Promise<PlannerResult> {
    const memoryHint = context?.memories?.length
      ? [
          "以下是已批准的本地记忆，仅作为低优先级默认偏好参考；当前用户输入、项目规则和工具事实优先：",
          JSON.stringify(context.memories.map((memory) => ({
            kind: memory.kind,
            summary: memory.summary,
            facts: memory.facts,
            scope: memory.scope,
          }))),
          "如果当前用户输入与已记录的偏好或项目决定冲突，优先遵循当前输入。",
        ].join("\n")
      : "没有可用的本地记忆。";
    const conversationHint = conversation?.turns?.length
      ? [
          "以下是同一会话中最近的脱敏对话，仅作为接续语境；当前用户输入优先，不要把历史路径、结果快照或 session id 当作工具事实：",
          JSON.stringify(conversation.turns.map((turn) => ({ role: turn.role, text: turn.text }))),
          "如果历史与当前输入冲突，优先当前输入。",
        ].join("\n")
      : "";
    const response = await fetch(this.options.baseUrl.replace(/\/$/u, "") + "/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        ...(this.options.apiKey ? { authorization: "Bearer " + this.options.apiKey } : {}),
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
              memoryHint,
              conversationHint,
              "JSON 形状：{intent:{operation,resourceKinds,constraints,needsClarification,clarificationReason?},calls:[{toolId,input}],explanation?,clarification?}",
              "工具目录：" + JSON.stringify(tools.map(({ id, description, resourceKinds }) => ({ id, description, resourceKinds }))),
            ].filter(Boolean).join("\n"),
          },
          { role: "user", content: input },
        ],
      }),
    });

    if (!response.ok) throw new Error("LLM provider returned " + response.status);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM provider returned no structured content");
    const fence = String.fromCharCode(96).repeat(3);
    const parsed = JSON.parse(content.replace(new RegExp("^" + fence + "json\\s*", "iu"), "").replace(new RegExp("\\s*" + fence + "$", "u"), ""));
    return plannerResultSchema.parse(parsed);
  }
}
