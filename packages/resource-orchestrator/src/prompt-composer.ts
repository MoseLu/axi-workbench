import type { ResourceCandidate } from "@axi/gateway-contracts";
import { styleModifierFor } from "./style-modifiers";
import {
  MAX_WEB_KEYWORD_DRIFT_RATIO,
  querySubjectTermsFor,
  webPoolDriftsFromQuery,
} from "./image-relevance";

/**
 * Extract Chinese bigram keywords from a pool of web search candidates.
 *
 * Pure, deterministic: lower-cases, strips stop phrases, returns up to `limit`
 * unique bigrams in the order they appear. Used by the orchestrator to seed
 * a composed image-generation prompt from real provider facts only.
 *
 * When a query subject is detected, bigrams that overlap a subject token are
 * filtered *out* of the noise stream — they will already be anchored into
 * the prompt prefix, so duplicating them as "关键词" dilutes the subject the
 * user asked for.
 */

const STOP_PHRASES = /(帮我|请|麻烦|给我|我需要|需要|想要|一张|几张|找一张|找一些|查一下|看一下|有哪些|可以用作|用作|当前的|里面的|里的|相关的|图片|图像|照片|壁纸|素材|资源|网上|网页|搜索|搜索一下)/giu;

const extractBigrams = (text: string): string[] => {
  const han = text.match(/[㐀-鿿]/gu) || [];
  const bigrams: string[] = [];
  for (let index = 0; index + 1 < han.length; index += 1) {
    bigrams.push(han[index] + han[index + 1]);
  }
  return bigrams;
};

export interface ExtractKeywordsOptions {
  /** Subject bigrams extracted from the user query. Any web bigram that
   *  overlaps a subject token is dropped from the noise stream so the
   *  prompt prefix can re-anchor it without dilution. */
  readonly subjectTerms?: ReadonlyArray<string>;
}

export const extractKeywords = (
  candidates: readonly ResourceCandidate[],
  limit = 6,
  options: ExtractKeywordsOptions = {},
): string[] => {
  const subjectTerms = options.subjectTerms ?? [];
  const seen = new Set<string>();
  const collected: string[] = [];
  for (const candidate of candidates) {
    const haystack = `${candidate.title} ${String(candidate.facts.snippet || "")}`
      .replace(STOP_PHRASES, " ");
    const bigrams = extractBigrams(haystack);
    for (const bigram of bigrams) {
      if (subjectTerms.some((term) => bigram.includes(term) || term.includes(bigram))) continue;
      if (seen.has(bigram)) continue;
      seen.add(bigram);
      collected.push(bigram);
      if (collected.length >= limit) return collected;
    }
  }
  return collected;
};

/**
 * Compose an image-generation prompt from three deterministic sources:
 *   1. the user's original query,
 *   2. the query subject (anchored as a hard prefix so the generator cannot
 *      swap the subject for something it saw in the web corpus),
 *   3. web-search keywords (provider facts), and
 *   4. a fixed style modifier table (orchestrator-owned, never LLM-generated).
 *
 * The LLM is never part of prompt composition — that boundary is preserved.
 *
 * When the web pool has drifted away from the query subject (see
 * `webPoolDriftsFromQuery`), the composed prompt intentionally *narrows* the
 * keyword stream and adds an explicit "strictly about the subject" clause so
 * the generator does not get distracted by unrelated context.
 */
export const composeImagePrompt = (
  query: string,
  webCandidates: readonly ResourceCandidate[],
): string => {
  const trimmed = query.trim();
  const subjectTerms = querySubjectTermsFor(trimmed);
  const drift = webPoolDriftsFromQuery(trimmed, webCandidates);
  const keywordLimit = drift.drifted ? 2 : 6;
  const keywords = extractKeywords(webCandidates, keywordLimit, { subjectTerms });
  const style = styleModifierFor(trimmed);
  const segments: string[] = [];
  if (subjectTerms.length) {
    segments.push(`主题：${subjectTerms.slice(0, 4).join("、")}（必须严格保留，禁止替换主体物）`);
  }
  segments.push(trimmed);
  if (/猫/u.test(trimmed) && /[蓝红绿黄白黑粉紫灰橘青]色?/u.test(trimmed)) {
    segments.push("主体动物本身必须是该颜色，禁止仅用同色天空、水面或背景代替");
  }
  if (keywords.length) segments.push(`关键词：${keywords.join("、")}`);
  if (style) segments.push(style);
  if (drift.drifted && drift.driftRatio > MAX_WEB_KEYWORD_DRIFT_RATIO) {
    segments.push("参考文本与主题不一致，仅以主题和需求为准");
  }
  return segments.filter(Boolean).join("；").trim();
};
