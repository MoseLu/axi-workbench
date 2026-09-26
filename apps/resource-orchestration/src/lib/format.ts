import type { ResourceCandidate } from "@axi/gateway-contracts";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
};

export const makeMessageId = (): string =>
  `message-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const formatMessageTime = (at: number): string =>
  new Date(at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

export const presentationOrientationFor = (item: ResourceCandidate): "landscape" | "portrait" | "original" => {
  const orientation = item.facts.presentationOrientation;
  return orientation === "landscape" || orientation === "portrait" ? orientation : "original";
};
