import type { ResourceCandidate } from "@axi/gateway-contracts";

/**
 * Minimum proportion of meaningful query terms that must occur in a
 * provider candidate before it can be presented as an image match.
 * Generic request words such as “图片” and “场景” are deliberately removed
 * from the query side so a bedroom result cannot pass a “浴室场景” query by
 * matching only the generic word “场景”.
 */
export const IMAGE_RELEVANCE_THRESHOLD = 0.5;

/**
 * Maximum share of web-result bigrams that can leak into a composed prompt.
 * Anything beyond this means the web corpus drifted away from the query
 * subject (e.g. "小猫" search returns pages about Samoyeds, Shibas, etc.)
 * and the generated image is more likely to swap subjects.
 */
export const MAX_WEB_KEYWORD_DRIFT_RATIO = 0.6;

const QUERY_FILLER_PATTERN = /帮我|请|麻烦|给我|我想要|我想看|我希望|我需要|需要|想要|一张|几张|找一张|找一些|查一下|看一下|有哪些|可以用作|用作|当前的|当前|里面的|里的|相关的|图片|图像|照片|壁纸|素材|资源|场景|画面|风格/giu;
const COLOR_MODIFIER_PATTERN = /[蓝红绿黄白黑粉紫灰橘青棕金银]色?/gu;
const BLUE_SCENE_NOISE = /蓝天|蓝发|蓝色上衣|蓝色系(?!猫)|克莱因蓝|碧蓝档案|蓝色背景/u;
const IGNORED_FACT_KEY_PATTERN = /query|provider|requested|presentation|resolution|mediaType|fingerprint|version|rank|size/giu;

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

/** Strip conversational wrappers before sending an image query to a provider. */
export const imageSearchQueryFor = (query: string): string => query
  .toLocaleLowerCase()
  .replace(QUERY_FILLER_PATTERN, " ")
  .replace(/\s+/gu, " ")
  .trim();

/**
 * Local catalog search query. Color adjectives stay on the spoken query for
 * subject-color matching; the provider lookup uses the animal/object so
 * "蓝色小猫" can still retrieve 小猫 rows, then `subjectColorFollowsQuery`
 * drops rows where the color is only the sky or a dress.
 */
export const imageProviderQueryFor = (query: string): string => {
  const base = imageSearchQueryFor(query);
  COLOR_MODIFIER_PATTERN.lastIndex = 0;
  const withoutColor = base.replace(COLOR_MODIFIER_PATTERN, " ").replace(/\s+/gu, " ").trim();
  return withoutColor.length > 0 ? withoutColor : base;
};

const queryTermsFor = (query: string): string[] => {
  const normalized = imageProviderQueryFor(query);
  const terms: string[] = [];
  for (const token of normalized.match(/[a-z0-9][a-z0-9_-]*/giu) || []) {
    if (token.length >= 2) terms.push(token);
  }
  for (const run of normalized.match(/[㐀-鿿]+/gu) || []) {
    const characters = Array.from(run);
    if (characters.length >= 1) terms.push(run);
    for (let index = 0; index + 1 < characters.length; index += 1) {
      terms.push(characters.slice(index, index + 2).join(""));
    }
  }
  return unique(terms);
};

const modifierScoreFor = (query: string, haystack: string): number => {
  const original = imageSearchQueryFor(query);
  const provider = imageProviderQueryFor(query);
  if (original === provider) return 0;
  COLOR_MODIFIER_PATTERN.lastIndex = 0;
  const modifiers = unique((original.match(COLOR_MODIFIER_PATTERN) || []).filter(Boolean));
  if (!modifiers.length) return 0;
  return modifiers.filter((term) => haystack.includes(term)).length;
};

const valueTextFor = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(valueTextFor);
  return [];
};

/** Extract only provider facts that describe the candidate itself. */
export const candidateSearchTextFor = (item: ResourceCandidate): string => {
  const facts = Object.entries(item.facts || {})
    .filter(([key]) => !IGNORED_FACT_KEY_PATTERN.test(key))
    .flatMap(([, value]) => valueTextFor(value));
  return [item.title, ...facts].join(" ").toLocaleLowerCase();
};

const termHitsHaystack = (term: string, haystack: string): boolean => {
  if (haystack.includes(term)) return true;
  if (term === "小猫" && haystack.includes("猫")) return true;
  if (term === "猫" && /猫/u.test(haystack)) return true;
  return false;
};

export const imageRelevanceFor = (query: string, item: ResourceCandidate): number => {
  const terms = queryTermsFor(query);
  if (!terms.length) return 0;
  const haystack = candidateSearchTextFor(item);
  return terms.filter((term) => termHitsHaystack(term, haystack)).length / terms.length;
};

/** Filter provider candidates by deterministic query relevance. */
const PERSON_SUBJECT = /女孩|女生|少女|美女|美人|女人|女子|女主|小姐姐|御姐|萝莉|女仆|公主|新娘|婚纱|双马尾|猫耳娘|男孩|男生|少年|男人|男子|帅哥|新郎|人像|人物|情侣|宫崎骏/u;
const CAT_ACCESSORY = /小猫耳朵|猫耳朵|猫耳/u;
const CAT_BODY = /小猫(?!耳朵)|猫咪|小猫咪|橘猫|白猫|黑猫|三花猫|奶牛猫|狸花|小奶猫|三只小猫|双猫|慵懒小猫|宠物小猫|卡通小猫|可爱小猫/u;
const DOG_SUBJECT = /狗|犬|萨摩耶|柯基|柴犬|金毛|哈士奇/u;
const GENERIC_WALLPAPER = /头像|卡通|可爱|ins风|壁纸|背景|制作|照片|图片|动漫/gu;

/**
 * Heuristic Chinese bigram extraction for the *subject noun phrase* of a query.
 * Drops filler / location / generic-object bigrams and returns the leftover
 * 2-grams that describe what the picture is actually *of*. Used by the
 * cascade to anchor a composed prompt so the generator does not swap the
 * subject ("小猫" -> "萨摩耶") when the web corpus drifts.
 *
 * Note: unlike `imageSearchQueryFor` (which strips "图片"/"场景" so they do
 * not pollute the provider search), the subject extraction keeps media
 * vocabulary — "甜妹图片" must still yield ["甜妹","妹图","图片"] so the
 * anchor prefix can carry the full subject.
 */
const SUBJECT_DROP = /帮我|请|麻烦|给我|我想要|我想看|我希望|我需要|需要|想要|一张|几张|找一张|找一些|查一下|看一下|有哪些|可以用作|用作|当前的|当前|里面的|里的|相关的|网上的|网页|搜索一下|搜索/giu;

export const querySubjectTermsFor = (query: string): string[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const han = trimmed.match(/[㐀-鿿]+/gu) || [];
  const bigrams: string[] = [];
  for (const run of han) {
    const cleaned = run.replace(SUBJECT_DROP, "");
    const characters = Array.from(cleaned);
    if (characters.length < 2) continue;
    for (let index = 0; index + 1 < characters.length; index += 1) {
      bigrams.push(characters.slice(index, index + 2).join(""));
    }
  }
  return unique(bigrams);
};

const charactersOf = (text: string): string[] => Array.from(text.match(/[㐀-鿿]/gu) || []);

const subjectCharacterSetFor = (subjectTerms: ReadonlyArray<string>): Set<string> => {
  const set = new Set<string>();
  for (const term of subjectTerms) {
    for (const character of charactersOf(term)) set.add(character);
  }
  return set;
};

/**
 * True when the web-search candidate pool has drifted far enough from the
 * query subject that feeding it into prompt composition would dilute the
 * user's request. "小猫" + a web pool whose dominant bigrams are
 * "萨摩耶/柯基/柴犬" is the canonical failure mode this guards against.
 *
 * Purely deterministic: counts the share of web bigrams that share no
 * Chinese characters with any query subject bigram. A high drift share
 * means the web page snippets are not about the subject the user asked for.
 */
export const webPoolDriftsFromQuery = (
  query: string,
  webItems: ReadonlyArray<Pick<ResourceCandidate, "title" | "facts">>,
  stopPhrases: RegExp = /的|了|是|在|和|与|或|以及|图片|图像|照片|壁纸|素材/giu,
): { driftRatio: number; subjectTerms: string[]; drifted: boolean } => {
  const subjectTerms = querySubjectTermsFor(query);
  if (!subjectTerms.length || !webItems.length) {
    return { driftRatio: 0, subjectTerms, drifted: false };
  }
  const subjectChars = subjectCharacterSetFor(subjectTerms);
  const haystacks = webItems.flatMap((item) => {
    const parts = [item.title || ""];
    const snippet = item.facts && typeof (item.facts as Record<string, unknown>).snippet === "string"
      ? String((item.facts as Record<string, unknown>).snippet)
      : "";
    if (snippet) parts.push(snippet);
    return [parts.join(" ").toLocaleLowerCase().replace(stopPhrases, " ")];
  });
  const combined = haystacks.join(" ");
  const han = combined.match(/[㐀-鿿]+/gu) || [];
  const totalBigrams: string[] = [];
  for (const run of han) {
    const characters = Array.from(run);
    for (let index = 0; index + 1 < characters.length; index += 1) {
      totalBigrams.push(characters.slice(index, index + 2).join(""));
    }
  }
  if (!totalBigrams.length) return { driftRatio: 0, subjectTerms, drifted: false };
  let foreign = 0;
  for (const bigram of totalBigrams) {
    const characters = charactersOf(bigram);
    if (characters.some((character) => subjectChars.has(character))) continue;
    foreign += 1;
  }
  const driftRatio = foreign / totalBigrams.length;
  return {
    driftRatio,
    subjectTerms,
    drifted: driftRatio > MAX_WEB_KEYWORD_DRIFT_RATIO,
  };
};

/** Drop portraits where the query subject is only a prop (girl + stray cat). */
export const subjectFollowsQuery = (query: string, item: ResourceCandidate): boolean => {
  const wantsCat = /猫/u.test(query);
  const wantsPerson = PERSON_SUBJECT.test(query);
  if (!wantsCat || wantsPerson) return true;
  const title = item.title || "";
  if (PERSON_SUBJECT.test(title)) return false;
  if (DOG_SUBJECT.test(title) && !/狗/u.test(query)) return false;
  const withoutAccessory = title.replace(CAT_ACCESSORY, " ");
  if (CAT_ACCESSORY.test(title) && !CAT_BODY.test(withoutAccessory)) return false;
  const rest = title.replace(GENERIC_WALLPAPER, " ").replace(/\s+/gu, " ").trim();
  return rest.length > 0 && rest !== "小猫" && rest !== "猫";
};

/**
 * 蓝色小猫 means the cat is blue, not a cat on a blue sky.
 * Color must attach to 猫; 蓝天 / 蓝发 / 碧蓝档案 do not count.
 */
export const subjectColorFollowsQuery = (query: string, item: ResourceCandidate): boolean => {
  if (!/猫/u.test(query)) return true;
  COLOR_MODIFIER_PATTERN.lastIndex = 0;
  const color = query.match(COLOR_MODIFIER_PATTERN)?.[0];
  if (!color) return true;
  const hue = color[0] || "";
  if (!hue) return true;
  const hay = candidateSearchTextFor(item);
  const onCat = new RegExp(`${hue}(?:色)?\\s*(?:的)?\\s*(?:小)?猫`, "u");
  if (hue === "蓝" && BLUE_SCENE_NOISE.test(hay) && !onCat.test(hay)) return false;
  return onCat.test(hay);
};

export const relevantCandidatesFor = (
  query: string,
  items: readonly ResourceCandidate[],
  threshold = IMAGE_RELEVANCE_THRESHOLD,
): ResourceCandidate[] => items
  .filter((item) => (
    imageRelevanceFor(query, item) >= threshold
    && subjectFollowsQuery(query, item)
    && subjectColorFollowsQuery(query, item)
  ))
  .slice()
  .sort((left, right) => {
    const hayLeft = candidateSearchTextFor(left);
    const hayRight = candidateSearchTextFor(right);
    const modifierDelta = modifierScoreFor(query, hayRight) - modifierScoreFor(query, hayLeft);
    if (modifierDelta !== 0) return modifierDelta;
    return imageRelevanceFor(query, right) - imageRelevanceFor(query, left);
  });

/** True only for a relevant image candidate that the workbench can preview. */
export const hasStrongPreviewImageMatchFor = (
  query: string,
  items: readonly ResourceCandidate[],
  threshold = IMAGE_RELEVANCE_THRESHOLD,
): boolean => relevantCandidatesFor(query, items, threshold).some((item) => item.kind === "image" && Boolean(item.preview));

/**
 * Image-text relevance embedder. A backend implementation produces a score
 * in [0, 1] for how well an image matches a text query. The default
 * implementation (`placeholderImageEmbedder`) returns 1 for every item, so
 * the cascade behaves exactly as before. Wiring a real backend
 * (`@xenova/transformers` CLIP ViT-B/32, `@huggingface/transformers`, or a
 * local Ollama `llava:7b` rerank endpoint) is opt-in and lives outside
 * `packages/orchestrator` to keep the deterministic contract intact.
 *
 * The embedder receives the raw `preview` value (data URL, https URL, or
 * undefined) — the caller decides whether the backend can handle the
 * format. Failed scoring must be reported as `null` so the cascade can fall
 * back to the text-relevance signal rather than blind-passing the item.
 */
export interface ImageEmbedder {
  /** Stable backend id used for tracing and config selection. */
  readonly id: string;
  /** Score an image against a query. `null` signals "could not score";
   *  the cascade must NOT pass the item in that case (better to surface a
   *  clarifying hint than to silently let a possibly-off-subject image
   *  through). */
  score(query: string, preview: string | undefined, signal?: AbortSignal): Promise<number | null>;
}

export const VISUAL_RELEVANCE_THRESHOLD = 0.28;

/** Pass-through embedder: every score is 1.0 so the cascade never rejects
 *  on visual grounds. This is the default; it preserves the existing
 *  text-only contract. */
export const placeholderImageEmbedder: ImageEmbedder = {
  id: "placeholder",
  async score() { return 1; },
};

/**
 * Visually re-rank an image candidate pool. Items without a preview, or
 * whose embedder returned `null`, are reported as `kept: false` with a
 * `reason` so the cascade can log a structured warning. Items whose score
 * falls below `threshold` are dropped unless `minKeep` is set, in which
 * case the top-`minKeep` items by score are still kept — the cascade uses
 * this to never return an empty image set when the embedder simply scored
 * everything low (likely a backend problem, not a relevance problem).
 */
export interface VisualRelevanceDecision {
  readonly item: ResourceCandidate;
  readonly score: number | null;
  readonly kept: boolean;
  readonly reason: "below-threshold" | "no-preview" | "scoring-failed" | "kept-by-floor";
}

export const filterByVisualRelevance = async (
  query: string,
  items: readonly ResourceCandidate[],
  embedder: ImageEmbedder = placeholderImageEmbedder,
  threshold: number = VISUAL_RELEVANCE_THRESHOLD,
  options: { minKeep?: number; signal?: AbortSignal } = {},
): Promise<{ kept: ResourceCandidate[]; decisions: VisualRelevanceDecision[] }> => {
  const minKeep = Math.max(0, options.minKeep ?? 0);
  const decisions: VisualRelevanceDecision[] = [];
  const candidates: ResourceCandidate[] = [];
  for (const item of items) {
    if (item.kind !== "image") continue;
    if (!item.preview) {
      decisions.push({ item, score: null, kept: false, reason: "no-preview" });
      continue;
    }
    const score = await embedder.score(query, item.preview, options.signal);
    if (score === null) {
      decisions.push({ item, score: null, kept: false, reason: "scoring-failed" });
      continue;
    }
    decisions.push({ item, score, kept: score >= threshold, reason: score >= threshold ? "kept-by-floor" : "below-threshold" });
    if (score >= threshold) candidates.push(item);
  }
  // Floor: if filtering would empty the result, keep the top-`minKeep`
  // scoring items regardless of threshold so the cascade can still
  // surface something rather than silently dropping the request.
  if (minKeep > 0 && candidates.length < minKeep) {
    const ranked = decisions
      .filter((decision) => decision.score !== null && decision.item.kind === "image")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const accepted = new Set(candidates.map((item) => item.id));
    for (const decision of ranked) {
      if (candidates.length >= minKeep) break;
      if (accepted.has(decision.item.id)) continue;
      candidates.push(decision.item);
      accepted.add(decision.item.id);
      const index = decisions.indexOf(decision);
      if (index >= 0) {
        const next: VisualRelevanceDecision = { item: decision.item, score: decision.score, kept: true, reason: "kept-by-floor" };
        decisions[index] = next;
      }
    }
  }
  return { kept: candidates, decisions };
};
