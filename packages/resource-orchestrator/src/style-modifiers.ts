/**
 * Deterministic keyword → style modifier mapping.
 *
 * The orchestrator uses this to enrich a composed image-generation prompt
 * without calling the LLM. Each rule is a plain regex over the user's query;
 * the first matching rule wins. Unmatched queries receive no modifiers so the
 * prompt remains a deterministic, provider-facts-only composition.
 */

export interface StyleRule {
  /** Display name, also used as the modifier key. */
  id: string;
  /** Regex matched against the lower-cased user query. */
  matches: RegExp;
  /** Modifiers appended after the query + web keywords. */
  modifiers: string;
}

export const STYLE_RULES: readonly StyleRule[] = [
  {
    id: "sweet-girl",
    matches: /甜妹|少女|妹子|女生|女孩|治愈/iu,
    modifiers: "柔光、浅景深、治愈系",
  },
  {
    id: "portrait",
    matches: /人像|人物|美女|头像|肖像|正面/iu,
    modifiers: "肖像镜头、背景虚化、自然光",
  },
  {
    id: "scenery",
    matches: /风景|景色|风光|自然|山水|天空|海边|山景/iu,
    modifiers: "自然光、广角镜头、远景构图",
  },
  {
    id: "wallpaper",
    matches: /壁纸|桌面|背景图|wallpaper/iu,
    modifiers: "高分辨率、电影感构图",
  },
];

export const findStyleRule = (query: string): StyleRule | undefined => {
  const normalized = query.trim();
  if (!normalized) return undefined;
  return STYLE_RULES.find((rule) => rule.matches.test(normalized));
};

export const styleModifierFor = (query: string): string | undefined => findStyleRule(query)?.modifiers;
