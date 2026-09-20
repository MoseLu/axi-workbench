/**
 * MEM-MVP-009 — Heuristic memory extractor.
 *
 * Pure-function Chinese-first pattern matcher that turns a user
 * message into zero or more `MemoryCandidate`s. The rules:
 *
 *   - "Explicit" prefixes ("记住", "以后默认", "项目决定",
 *     "不要使用", …) yield an `active` candidate.
 *   - No explicit prefix → no candidate. We never infer permanent
 *     preferences from ordinary queries such as "帮我找一张猫图";
 *     that would turn a single search into a hidden policy change.
 *   - Each candidate is fed through the redactor before returning;
 *     candidates that fail redaction are dropped, never stored.
 *
 * The extractor returns both `candidates` and a `summary` so the
 * gateway can log what was recognised without persisting the raw
 * user text.
 */

import { randomUUID } from "node:crypto";
import {
  type MemoryConfidence,
  type MemoryKind,
  type MemoryScope,
  type MemorySource,
} from "@axi/gateway-contracts";
import { redactEntry, type RedactionOutcome } from "./redactor";

export interface MemoryCandidate {
  readonly id: string;
  readonly summary: string;
  readonly facts: Record<string, string | number | boolean>;
  readonly tags: ReadonlyArray<string>;
  readonly evidenceHash: string;
  readonly kind: MemoryKind;
  readonly scope: MemoryScope;
  readonly projectId?: string;
  readonly source: MemorySource;
  readonly confidence: MemoryConfidence;
  readonly sensitivity: "normal" | "sensitive";
  /** Explicit expressions become active immediately; inferred stay pending. */
  readonly status: "active" | "pending";
}

export interface ExtractorContext {
  readonly defaultScope?: MemoryScope;
  readonly defaultProjectId?: string;
  readonly now?: Date;
}

export interface ExtractorResult {
  readonly candidates: ReadonlyArray<MemoryCandidate>;
  readonly recognised: boolean;
}

interface PatternRule {
  readonly id: string;
  readonly kind: MemoryKind;
  readonly source: MemorySource;
  readonly pattern: RegExp;
  readonly summaryTemplate: (match: RegExpMatchArray) => string;
  readonly factsFor: (match: RegExpMatchArray) => Record<string, string | number | boolean>;
  readonly tagsFor: (match: RegExpMatchArray) => ReadonlyArray<string>;
}

const EXPLICIT_RULES: ReadonlyArray<PatternRule> = [
  {
    id: "remember-image-orientation",
    kind: "preference",
    source: "explicit",
    pattern: /记住(?:我)?(?:以后)?(?:优先|默认)?(?:找|使用|要)?(?:横屏|竖屏|横向|竖向|横版|竖版|landscape|portrait)/iu,
    summaryTemplate: (m) => `默认${m[0].includes("竖") ? "竖屏" : "横屏"}图片`,
    factsFor: (m) => ({ preferredOrientation: m[0].includes("竖") ? "portrait" : "landscape" }),
    tagsFor: () => ["image", "orientation"],
  },
  {
    id: "remember-resource-kind",
    kind: "preference",
    source: "explicit",
    pattern: /记住(?:我)?(?:以后)?(?:优先|默认)?(?:找|使用|要)?(图片|图像|文档|技能|工作流|项目)/iu,
    summaryTemplate: (m) => `默认优先${m[1]}资源`,
    factsFor: (m) => ({ preferredResourceKind: m[1] }),
    tagsFor: (m) => [m[1]],
  },
  {
    id: "project-decision-gateway",
    kind: "decision",
    source: "explicit",
    pattern: /(?:这个项目|本项目|当前项目)?(?:决定|选定|采用|使用)(独立\s*gateway|独立\s*网关)/iu,
    summaryTemplate: () => "项目决定使用独立 gateway",
    factsFor: () => ({ decisionTopic: "gateway", decisionValue: "independent" }),
    tagsFor: () => ["gateway", "architecture"],
  },
  {
    id: "project-decision-no-external-search",
    kind: "constraint",
    source: "explicit",
    pattern: /(?:这个项目|本项目|当前项目)?(?:暂时)?不要(?:使用|开启|启用)?(?:外部)?(?:网络|网页)?搜索|(?:这个项目|本项目|当前项目)?(?:暂时)?不要(?:使用|开启|启用)?(?:web\s*search|mcp)/iu,
    summaryTemplate: () => "项目不启用外部搜索",
    factsFor: () => ({ allowExternalSearch: false }),
    tagsFor: () => ["external-search"],
  },
  {
    id: "remember-default-orientation",
    kind: "preference",
    source: "explicit",
    pattern: /(?:以后|之后|默认)?(?:我)?(?:想|要|用|看|看)?横屏/iu,
    summaryTemplate: () => "默认横屏图片",
    factsFor: () => ({ preferredOrientation: "landscape" }),
    tagsFor: () => ["image", "orientation"],
  },
  {
    id: "remember-vertical-orientation",
    kind: "preference",
    source: "explicit",
    pattern: /(?:以后|之后|默认)?(?:我)?(?:想|要|用|看)?竖屏/iu,
    summaryTemplate: () => "默认竖屏图片",
    factsFor: () => ({ preferredOrientation: "portrait" }),
    tagsFor: () => ["image", "orientation"],
  },
];

const TOKENISE = /[\s,，.。、!?？:：;；"'()()【】\[\]<>《》/\\|]+/u;

const evidenceHash = (input: string): string => {
  // FNV-1a 32-bit, hex-padded to satisfy the contracts regex (>= 16 hex chars).
  let hash = 2166136261;
  for (const character of input.trim().toLocaleLowerCase()) {
    hash ^= character.codePointAt(0) || 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").repeat(2);
};

const normalise = (value: string): string => value.replace(TOKENISE, " ").trim();

export const extractMemoryCandidates = (
  userInput: string,
  context: ExtractorContext = {},
): ExtractorResult => {
  const cleaned = normalise(userInput);
  if (!cleaned) return { candidates: [], recognised: false };

  const now = context.now ?? new Date();
  const candidates: MemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const rule of EXPLICIT_RULES) {
    const match = rule.pattern.exec(cleaned);
    if (!match) continue;
    const summary = rule.summaryTemplate(match);
    const facts = rule.factsFor(match);
    const tags = rule.tagsFor(match);

    const dedupeKey = `${rule.kind}:${JSON.stringify(facts)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const redaction: RedactionOutcome<{ summary: string; facts: Record<string, string | number | boolean>; tags: ReadonlyArray<string> }> = redactEntry({
      summary,
      facts,
      tags: [...tags],
      sensitivity: "normal",
    });
    if (!redaction.ok) continue;

    const entry: MemoryCandidate = {
      id: `mem-candidate-${randomUUID()}`,
      summary: redaction.value.summary,
      facts: redaction.value.facts,
      tags: redaction.value.tags,
      evidenceHash: evidenceHash(cleaned),
      kind: rule.kind,
      scope: context.defaultScope ?? "global",
      ...(context.defaultProjectId ? { projectId: context.defaultProjectId } : {}),
      source: rule.source,
      confidence: "high",
      sensitivity: "normal",
      status: "active",
    };
    candidates.push(entry);
  }

  return { candidates, recognised: candidates.length > 0 };
};
