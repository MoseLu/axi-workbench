/**
 * MEM-MVP-008 — Deterministic memory ranker.
 *
 * Score formula:
 *
 *   score = tokenOverlap * 10
 *         + scopeBoost
 *         + kindBoost
 *         + recencyBoost
 *         - expiredPenalty
 *
 * Rules:
 *   - Only active entries participate; pending / archived / expired
 *     are filtered out before scoring.
 *   - Project scope beats global (20 vs 5) regardless of text overlap.
 *   - Tie-break: updatedAt desc, then id asc — guarantees a stable
 *     order across runs.
 *   - Conflict dedup: only the highest-scoring entry per
 *     `decisionTopic` / facts key survives.
 *   - Top-5 cap. Entries scoring below 20 are not injected.
 */

import type {
  MemoryEntry,
  MemoryScope,
  MemoryKind,
  PlannerMemoryContext,
  PlannerMemoryEntry,
} from "@axi/gateway-contracts";

const TOKEN_SPLIT = /[\s,，.。、!?？:：;；"'()()【】\[\]<>《》/\\|]+/u;
const KIND_BOOST: Record<MemoryKind, number> = {
  preference: 5,
  decision: 8,
  constraint: 7,
  task: 3,
};
const RECENCY_HALF_LIFE_DAYS = 30;

const tokenize = (value: string): string[] => {
  // Split on whitespace / ASCII punctuation first, then split each
  // remaining chunk into individual CJK characters so a Chinese
  // phrase like "默认横屏" becomes ["默认","横屏"] rather than
  // ["默认横屏"]. Non-CJK chunks stay as-is so latin words and
  // numbers remain intact.
  const splitAscii = (input: string): string[] => {
    const result: string[] = [];
    let buffer = "";
    for (const ch of input) {
      if (/[\s,，.。、!?？:：;；"'()()【】\[\]<>《》/\\|]/u.test(ch)) {
        if (buffer.length) {
          result.push(...expandCjk(buffer));
          buffer = "";
        }
      } else {
        buffer += ch;
      }
    }
    if (buffer.length) result.push(...expandCjk(buffer));
    return result;
  };
  return splitAscii(value.toLocaleLowerCase()).map((token) => token.trim()).filter((token) => token.length > 0);
};

const isCjk = (ch: string): boolean => /[㐀-鿿豈-﫿぀-ヿ가-힯]/u.test(ch);

const expandCjk = (chunk: string): string[] => {
  if (chunk.length === 1) return [chunk];
  // If the chunk contains any CJK character, split it into individual
  // characters so each is searchable. Pure latin / numeric chunks
  // stay as a single token.
  if (!/[㐀-鿿豈-﫿぀-ヿ가-힯]/u.test(chunk)) return [chunk];
  const out: string[] = [];
  let buffer = "";
  for (const ch of chunk) {
    if (isCjk(ch)) {
      if (buffer.length) {
        out.push(buffer);
        buffer = "";
      }
      out.push(ch);
    } else {
      buffer += ch;
    }
  }
  if (buffer.length) out.push(buffer);
  return out;
};

const isExpired = (entry: MemoryEntry, now: Date): boolean => {
  if (!entry.expiresAt) return false;
  return new Date(entry.expiresAt).getTime() <= now.getTime();
};

const dayDiff = (updatedAt: string, now: Date): number => {
  const diffMs = now.getTime() - new Date(updatedAt).getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};

const conflictKey = (entry: MemoryEntry): string | null => {
  if (entry.kind === "decision") {
    const topic = entry.facts.decisionTopic;
    if (typeof topic === "string" || typeof topic === "number" || typeof topic === "boolean") return `decision:${String(topic)}`;
  }
  if (entry.kind === "preference") {
    if ("preferredOrientation" in entry.facts) return "preference:preferredOrientation";
    if ("preferredResourceKind" in entry.facts) return "preference:preferredResourceKind";
    if ("preferredResultCount" in entry.facts) return "preference:preferredResultCount";
  }
  if (entry.kind === "constraint") {
    if ("avoidProvider" in entry.facts) return "constraint:avoidProvider";
    if ("allowExternalSearch" in entry.facts) return "constraint:allowExternalSearch";
    if ("safetyPreference" in entry.facts) return "constraint:safetyPreference";
  }
  return null;
};

const projectForPlanner = (entry: MemoryEntry): PlannerMemoryEntry => ({
  id: entry.id,
  kind: entry.kind,
  summary: entry.summary,
  facts: entry.facts,
  scope: entry.scope,
});

export interface RankerInput {
  readonly entries: ReadonlyArray<MemoryEntry>;
  readonly query: string;
  readonly scope?: MemoryScope;
  readonly projectId?: string;
  readonly now?: Date;
  readonly limit?: number;
}

export const rankMemories = (input: RankerInput): PlannerMemoryContext => {
  const now = input.now ?? new Date();
  const queryTokens = new Set(tokenize(input.query));
  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  const eligible = input.entries.filter((entry) => entry.status === "active" && !isExpired(entry, now));
  const requestedScope = input.scope;
  const requestedProjectId = input.projectId;

  type Scored = { entry: MemoryEntry; score: number };
  const scored: Scored[] = [];
  for (const entry of eligible) {
    const summaryTokens = new Set(tokenize(entry.summary));
    const factTokens = new Set<string>();
    for (const value of Object.values(entry.facts)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        for (const token of tokenize(String(value))) factTokens.add(token);
      }
    }
    let overlap = 0;
    for (const token of queryTokens) {
      if (summaryTokens.has(token) || factTokens.has(token)) overlap += 1;
    }
    const scopeBoost = entry.scope === "project"
      ? (requestedScope === "project" && requestedProjectId && entry.projectId === requestedProjectId ? 20 : 12)
      : requestedScope === "global" ? 5 : 1;
    const kindBoost = KIND_BOOST[entry.kind];
    const ageDays = Math.max(0, dayDiff(entry.updatedAt, now));
    const recencyBoost = Math.max(0, RECENCY_HALF_LIFE_DAYS - ageDays) / RECENCY_HALF_LIFE_DAYS * 4;
    const score = overlap * 10 + scopeBoost + kindBoost + recencyBoost;
    if (score < 20) continue;
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.entry.updatedAt !== b.entry.updatedAt) return a.entry.updatedAt < b.entry.updatedAt ? 1 : -1;
    if (a.entry.id !== b.entry.id) return a.entry.id < b.entry.id ? -1 : 1;
    return 0;
  });

  // Conflict dedup: keep only the top-scoring entry per conflict key.
  const taken = new Set<string>();
  const conflictsSeen = new Set<string>();
  const filtered: Scored[] = [];
  for (const item of scored) {
    const key = conflictKey(item.entry);
    if (key) {
      if (conflictsSeen.has(key)) continue;
      conflictsSeen.add(key);
    }
    filtered.push(item);
    taken.add(item.entry.id);
    if (filtered.length >= limit) break;
  }

  return {
    memories: filtered.map(({ entry }) => projectForPlanner(entry)),
  };
};
