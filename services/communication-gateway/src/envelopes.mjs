import { randomUUID } from "node:crypto";

export function fromFeishuMessage(input = {}) {
  const raw = input.raw && typeof input.raw === "object" ? input.raw : input;
  const message = raw.message || raw.event?.message || {};
  const sender = raw.sender || raw.event?.sender || {};
  const text = firstString(input.text, message.text, message.content, raw.text, raw.content);

  return toControlPlaneMessage({
    id: firstString(input.id, message.message_id, raw.message_id, raw.event_id),
    channel: "feishu",
    conversationId: firstString(input.conversationId, message.chat_id, raw.chat_id),
    senderId: firstString(input.senderId, sender.sender_id?.open_id, raw.open_id),
    text: normalizeTransportText(text),
    receivedAt: firstString(input.receivedAt, raw.timestamp, raw.receivedAt),
    raw,
  });
}

export function fromMossCoderMessage(input = {}) {
  const raw = input.raw && typeof input.raw === "object" ? input.raw : input;
  return toControlPlaneMessage({
    id: firstString(input.id, raw.id, raw.message_id, raw.messageId),
    channel: "mosscoder",
    conversationId: firstString(input.conversationId, raw.conversationId, raw.session_id, raw.sessionId) || "mosscoder",
    senderId: firstString(input.senderId, raw.senderId, raw.user_id, raw.userId) || "local-user",
    text: normalizeTransportText(firstString(input.text, raw.text, raw.prompt, raw.content)),
    receivedAt: firstString(input.receivedAt, raw.timestamp, raw.receivedAt),
    raw,
  });
}

export function fromWeChatMessage(input = {}) {
  const raw = input.raw && typeof input.raw === "object" ? input.raw : input;
  return toControlPlaneMessage({
    id: firstString(input.id, raw.id, raw.msg_id, raw.message_id, raw.messageId),
    channel: "wechat",
    conversationId: firstString(input.conversationId, raw.conversationId, raw.talker, raw.fromUserName, raw.from_user_name),
    senderId: firstString(input.senderId, raw.senderId, raw.sender, raw.fromUserName, raw.from_user_name),
    text: normalizeTransportText(firstString(input.text, raw.text, raw.content, raw.message)),
    receivedAt: firstString(input.receivedAt, raw.timestamp, raw.receivedAt),
    raw,
  });
}

export function fromCcConnectMessage(input = {}) {
  const raw = input.raw && typeof input.raw === "object" ? input.raw : input;
  const message = firstObject(raw.message, raw.payload?.message, raw.data?.message);
  const sender = firstObject(raw.sender, raw.user, raw.payload?.sender, raw.payload?.user);
  const sessionKey = firstString(raw.session_key, raw.sessionKey, raw.session, raw.payload?.session_key, raw.payload?.sessionKey);
  const platform = firstString(raw.platform, raw.channel, message.platform) || platformFromSessionKey(sessionKey);
  const text = firstString(
    input.text,
    raw.text,
    raw.prompt,
    raw.content,
    raw.body,
    message.text,
    message.content,
    message.plain_text,
    message.plainText
  );

  return toControlPlaneMessage({
    id: firstString(input.id, raw.id, raw.message_id, raw.messageId, message.id, message.message_id, raw.event_id, raw.eventId),
    channel: channelFromPlatform(platform),
    conversationId: firstString(input.conversationId, raw.conversationId, raw.chat_id, raw.chatId, message.chat_id, sessionKey),
    senderId: firstString(
      input.senderId,
      raw.sender_id,
      raw.senderId,
      raw.user_id,
      raw.userId,
      raw.open_id,
      sender.id,
      sender.user_id,
      sender.open_id,
      sender.sender_id?.open_id
    ),
    text: normalizeTransportText(text),
    receivedAt: firstString(input.receivedAt, raw.timestamp, raw.receivedAt),
    raw,
  });
}

export function toControlPlaneMessage(envelope) {
  return {
    envelope: {
      id: firstString(envelope.id) || randomUUID(),
      channel: firstString(envelope.channel) || "unknown",
      conversationId: firstString(envelope.conversationId) || "default",
      senderId: firstString(envelope.senderId) || "unknown",
      text: normalizeTransportText(envelope.text),
      receivedAt: firstString(envelope.receivedAt) || new Date().toISOString(),
      raw: envelope.raw || {},
      attachments: Array.isArray(envelope.attachments) ? envelope.attachments : [],
    },
  };
}

export function renderCommunicationResponse(result) {
  if (!result?.response) {
    return {
      deliverable: false,
      text: result?.summary || "没有可发送的回复。",
      format: "markdown",
      language: "zh-CN",
    };
  }

  return {
    deliverable: true,
    channel: result.response.channel,
    conversationId: result.response.conversationId,
    text: result.response.text,
    format: result.response.format,
    language: result.response.language || "zh-CN",
    auditId: result.response.auditId,
  };
}

function normalizeTransportText(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return String(parsed.text || parsed.content || parsed.prompt || trimmed).trim();
  } catch {
    return trimmed;
  }
}

function channelFromPlatform(platform) {
  const value = String(platform || "").toLowerCase();
  if (value.includes("feishu") || value.includes("lark")) return "feishu";
  if (value.includes("wechat") || value.includes("weixin")) return "wechat";
  if (value.includes("wecom") || value.includes("work")) return "wecom";
  if (value.includes("moss")) return "mosscoder";
  return "cc-connect";
}

function platformFromSessionKey(sessionKey) {
  return String(sessionKey || "").split(":")[0] || "";
}

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
}

function firstString(...values) {
  const found = values.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}
