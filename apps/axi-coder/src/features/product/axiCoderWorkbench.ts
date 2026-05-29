import {
  AXI_CODER_PRODUCT_SURFACE,
  assertAxiCoderProductSurface,
  type AxiCoderCapability,
  type AxiCoderProductSurface,
} from "./axiCoderProductSurface";

export type WorkbenchTarget = "providers" | "routes" | "logs";
export type WorkbenchTone = "live" | "ready" | "next";

export type AxiCoderWorkbenchCard = {
  id: string;
  title: string;
  description: string;
  status: string;
  tone: WorkbenchTone;
  capability: AxiCoderCapability | "mobile_companion";
};

export type AxiCoderWorkbenchStep = {
  id: string;
  label: string;
  target: string;
};

export type AxiCoderWorkbenchModel = {
  title: string;
  summary: string;
  primaryStatus: string;
  stats: Array<{ label: string; value: string }>;
  cards: AxiCoderWorkbenchCard[];
  flow: AxiCoderWorkbenchStep[];
  actions: Array<{ label: string; target: WorkbenchTarget }>;
};

export function buildAxiCoderWorkbenchModel(
  surface: AxiCoderProductSurface = AXI_CODER_PRODUCT_SURFACE,
): AxiCoderWorkbenchModel {
  assertAxiCoderProductSurface(surface);

  const requiredCards: AxiCoderWorkbenchCard[] = [
    {
      id: "project-context",
      title: "项目上下文",
      description: "从工作站关系图读取项目、负责人、合同和证据关系。",
      status: "合同就绪",
      tone: "ready",
      capability: "workspace_context",
    },
    {
      id: "cli-orchestration",
      title: "CLI 编排",
      description: "管理 Claude、Codex、Gemini 的终端会话和本地路由。",
      status: "可运行",
      tone: "live",
      capability: "cli_orchestration",
    },
    {
      id: "agent-task",
      title: "任务执行",
      description: "接入 Workstation 与 Axi Agent 的安全任务链。",
      status: "P0 通过",
      tone: "live",
      capability: "agent_task_execution",
    },
    {
      id: "model-routing",
      title: "模型路由",
      description: "消费 Axi Model Gateway 的 ProviderProfile 与 CredentialRef。",
      status: "ref-only",
      tone: "ready",
      capability: "model_provider_routing",
    },
    {
      id: "artifact-review",
      title: "证据评审",
      description: "把构建、测试、任务结果和移动端回流作为开发证据检查。",
      status: "E2E 通过",
      tone: "live",
      capability: "artifact_review",
    },
    {
      id: "mobile-companion",
      title: "移动伴随",
      description: "通过 Axi Notify / Axi Mobile 接收任务、通知和深链回流。",
      status: "真机通过",
      tone: "live",
      capability: "mobile_companion",
    },
  ];

  const cards = requiredCards.filter(
    (card) => card.capability === "mobile_companion" || surface.capabilities.includes(card.capability),
  );

  return {
    title: surface.productName,
    summary: "完整开发工作台：Mac 桌面负责开发执行，移动端负责任务伴随、通知和回流。",
    primaryStatus: "Goal70 E2E 基线通过",
    stats: [
      { label: "桌面端", value: surface.platforms.includes("mac_desktop") ? "Mac 就绪" : "缺失" },
      { label: "移动端", value: surface.platforms.includes("mobile_companion") ? "ADB 通过" : "缺失" },
      { label: "能力面", value: `${surface.capabilities.length}` },
      { label: "合同", value: `${surface.consumesContracts.length}` },
    ],
    cards,
    flow: [
      { id: "desktop", label: "Mac 桌面端", target: "CLI / 终端" },
      { id: "workstation", label: "工作站", target: "任务 / 证据" },
      { id: "agent", label: "Axi Agent", target: "安全任务" },
      { id: "notify", label: "Axi Notify", target: "事件回流" },
      { id: "mobile", label: "移动端", target: "聊天 / 待办 / 工作台" },
    ],
    actions: [
      { label: "打开终端", target: "routes" },
      { label: "配置模型", target: "providers" },
      { label: "查看日志", target: "logs" },
    ],
  };
}
