import { describe, expect, it } from "vitest";
import type { ResourceCandidate } from "@axi/gateway-contracts";
import { composeImagePrompt, extractKeywords } from "./prompt-composer";
import { webPoolDriftsFromQuery } from "./image-relevance";

const web = (title: string, snippet: string): ResourceCandidate => ({
  id: `web:${title}`,
  kind: "web",
  title,
  facts: { snippet },
  provenance: { provider: "stub", ref: `https://example/${title}` },
  safety: "safe",
});

describe("prompt-composer", () => {
  it("extracts Chinese bigram keywords from web candidates", () => {
    const keywords = extractKeywords([web("甜妹插画合集", "治愈系风格")], 6);
    expect(keywords).toContain("甜妹");
    expect(keywords).toContain("插画");
    expect(keywords.every((token) => token.length === 2)).toBe(true);
  });

  it("deduplicates keywords across candidates", () => {
    const keywords = extractKeywords([
      web("甜妹插画", "甜妹"),
      web("更多甜妹", "甜妹"),
    ], 6);
    expect(keywords.filter((k) => k === "甜妹")).toHaveLength(1);
  });

  it("strips stop phrases before extracting", () => {
    const keywords = extractKeywords([web("帮我找一张甜妹图片", "请给我甜妹")], 8);
    expect(keywords).not.toContain("帮我");
    expect(keywords).not.toContain("图片");
  });

  it("drops bigrams that overlap a detected subject", () => {
    // Subject terms for "甜妹" are ["甜妹"]; the web pool below is on-topic,
    // but the same subject term would otherwise be extracted twice (once in
    // the anchor prefix, once in 关键词). It must appear in 关键词 at most
    // zero times because the prompt prefix already carries it.
    const keywords = extractKeywords(
      [web("甜妹插画", "甜妹 治愈")],
      6,
      { subjectTerms: ["甜妹"] },
    );
    expect(keywords).not.toContain("甜妹");
  });

  it("composes prompt with style modifiers for sweet-girl queries", () => {
    const prompt = composeImagePrompt("我需要一张甜妹图片", [web("甜妹插画", "治愈系风格")]);
    expect(prompt).toContain("甜妹");
    expect(prompt).toContain("关键词");
    expect(prompt).toContain("柔光");
    // Subject anchor is the first segment so the generator sees it before any
    // web bigram noise.
    expect(prompt.startsWith("主题：")).toBe(true);
    expect(prompt).toContain("必须严格保留");
  });

  it("composes prompt without style modifiers for unmatched queries", () => {
    const prompt = composeImagePrompt("随便画一个图标", [web("图标", "icon")]);
    expect(prompt).toContain("随便画一个图标");
    expect(prompt).not.toContain("柔光");
    expect(prompt).not.toContain("广角");
  });

  it("still appends style modifiers when web candidates yield no keywords", () => {
    const prompt = composeImagePrompt("甜妹图片", []);
    // Subject anchor prefix is always emitted when a subject is detected.
    // "甜妹图片" -> subject terms ["甜妹","妹图","图片"], so the anchor
    // carries all three bigrams.
    expect(prompt).toBe("主题：甜妹、妹图、图片（必须严格保留，禁止替换主体物）；甜妹图片；柔光、浅景深、治愈系");
  });

  it("omits style modifiers when no rule matches the query", () => {
    const prompt = composeImagePrompt("随便画一个图标", [web("图标", "icon")]);
    expect(prompt).not.toContain("柔光");
    expect(prompt).not.toContain("广角");
  });

  it("anchors the subject and narrows keywords when the web pool drifts", () => {
    // Canonical failure case: user asks for "小猫", web returns pages about
    // 萨摩耶 / 柯基 / 柴犬. Before this fix the prompt's 关键词 segment
    // would carry those bigrams and the generator would swap the subject.
    const driftedPool = [
      web("萨摩耶幼犬白色毛绒绒", "萨摩耶幼犬 柯基 柴犬 雪橇犬"),
      web("萨摩耶和柯基对比", "萨摩耶 柯基 柴犬 雪橇犬"),
    ];
    const drift = webPoolDriftsFromQuery("小猫", driftedPool);
    expect(drift.drifted).toBe(true);

    const prompt = composeImagePrompt("小猫", driftedPool);
    // 主题 anchor is the first segment.
    expect(prompt.startsWith("主题：小猫（")).toBe(true);
    // Drift clause warns the generator not to follow the web corpus.
    expect(prompt).toContain("参考文本与主题不一致");
    // Foreign dog bigrams must NOT leak into 关键词.
    expect(prompt).not.toContain("萨摩耶");
    expect(prompt).not.toContain("柯基");
    expect(prompt).not.toContain("柴犬");
  });
});
