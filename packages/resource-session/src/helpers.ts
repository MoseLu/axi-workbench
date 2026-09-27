/**
 * SES-MVP-008 / SES-MVP-015 — dateKey, title, sort, ids, bounded context.
 *
 * Pure functions. No filesystem, no HTTP, no React.
 */

import {
  SESSION_LIMITS,
  conversationContextSchema,
  sessionIdSchema,
  type ConversationContext,
  type SessionEntry,
  type SessionRecord,
  type SessionSummary,
} from "@axi/gateway-contracts";

export const SESSION_ID_PREFIX = "ses_" as const;
export const ENTRY_ID_PREFIX = "ent_" as const;
export const SESSION_TITLE_MAX = 48;
export const SESSION_PREVIEW_MAX = 80;

const SESSION_ID_BODY = /^[A-Za-z0-9_-]{6,72}$/u;

const pad2 = (value: number): string => String(value).padStart(2, "0");

/**
 * Browser-local `YYYY-MM-DD`. Uses the Date's local calendar components,
 * never UTC getters, so DST and midnight follow what the user sees.
 */
export const localDateKey = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

export const generateSessionId = (
  random: () => string = () => `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
): string => {
  const raw = random().replace(/[^A-Za-z0-9_-]/gu, "");
  if (raw.length < 8 || !SESSION_ID_BODY.test(raw.slice(0, 72))) {
    throw new Error("session id generator produced an invalid body");
  }
  const id = `${SESSION_ID_PREFIX}${raw.slice(0, 64)}`;
  return sessionIdSchema.parse(id);
};

export const generateEntryId = (
  random: () => string = () => `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
): string => {
  const raw = random().replace(/[^A-Za-z0-9_-]/gu, "");
  const body = (raw.length >= 8 ? raw : `${raw}fallback1`).slice(0, 64);
  return `${ENTRY_ID_PREFIX}${body}`;
};

export const titleFromUserText = (text: string): string => {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (!compact) return "";
  return compact.length <= SESSION_TITLE_MAX ? compact : compact.slice(0, SESSION_TITLE_MAX);
};

export const previewFromText = (text: string): string => {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (!compact) return "";
  return compact.length <= SESSION_PREVIEW_MAX ? compact : compact.slice(0, SESSION_PREVIEW_MAX);
};

export const countMessages = (entries: readonly SessionEntry[]): number =>
  entries.reduce((count, entry) => count + (entry.role === "system" ? 0 : 1), 0);

export const toSummary = (record: SessionRecord): SessionSummary => ({
  id: record.id,
  projectId: record.projectId,
  dateKey: record.dateKey,
  kind: record.kind,
  status: record.status,
  title: record.title,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  revision: record.revision,
  messageCount: record.messageCount,
  ...(record.lastMessagePreview ? { lastMessagePreview: record.lastMessagePreview } : {}),
});

/**
 * List ordering: dateKey desc, updatedAt desc, sessionId asc.
 * Sessions with no user/assistant messages are omitted.
 */
export const sortSessionSummaries = (records: readonly SessionRecord[]): SessionSummary[] =>
  records
    .filter((record) => record.messageCount > 0)
    .slice()
    .sort((left, right) => {
      if (left.dateKey !== right.dateKey) return right.dateKey.localeCompare(left.dateKey);
      if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
      return left.id.localeCompare(right.id);
    })
    .map(toSummary);

/**
 * Last 12 turns or 6,000 characters, whichever is hit first. Older turns
 * are dropped from the front. The current user input is NOT in `entries`
 * yet — the planner receives it separately and it always wins.
 */
export const projectConversationContext = (record: SessionRecord): ConversationContext => {
  const turns = record.entries
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .map((entry) => ({
      role: entry.role as "user" | "assistant",
      text: entry.text,
    }));

  const windowed = turns.slice(-SESSION_LIMITS.contextTurns);
  let total = windowed.reduce((sum, turn) => sum + turn.text.length, 0);
  while (windowed.length > 0 && total > SESSION_LIMITS.contextChars) {
    const removed = windowed.shift();
    total -= removed?.text.length ?? 0;
  }

  return conversationContextSchema.parse({
    sessionId: record.id,
    dateKey: record.dateKey,
    turns: windowed,
  });
};
