import { describe, expect, it } from "vitest";
import type { ResourceCandidate } from "@axi/gateway-contracts";
import {
  hasStrongPreviewImageMatchFor,
  imageProviderQueryFor,
  imageSearchQueryFor,
  imageRelevanceFor,
  querySubjectTermsFor,
  relevantCandidatesFor,
  webPoolDriftsFromQuery,
} from "./image-relevance";

const image = (id: string, title: string, tags: string[], preview = `https://example.test/${id}.webp`): ResourceCandidate => ({
  id,
  kind: "image",
  title,
  preview,
  facts: { tags },
  provenance: { provider: "test", ref: `https://example.test/${id}` },
  safety: "safe",
});

const web = (id: string, title: string, snippet: string): ResourceCandidate => ({
  id,
  kind: "web",
  title,
  facts: { snippet },
  provenance: { provider: "test-web", ref: `https://example.test/${id}` },
  safety: "safe",
});

describe("image relevance", () => {
  it("removes conversational wrappers before provider search", () => {
    expect(imageSearchQueryFor("我想要一张浴室场景")).toBe("浴室");
  });

  it("rejects a generic bedroom result for a bathroom request", () => {
    const candidate = image("bedroom", "卧室写真 卧室场景", ["卧室场景", "室内"]);
    expect(imageRelevanceFor("我想要一张浴室场景", candidate)).toBe(0);
    expect(relevantCandidatesFor("我想要一张浴室场景", [candidate])).toEqual([]);
  });

  it("accepts a candidate matching the meaningful query term", () => {
    const candidate = image("bathroom", "现代浴室空间", ["浴室", "室内设计"]);
    expect(imageRelevanceFor("我想要一张浴室场景", candidate)).toBeGreaterThanOrEqual(0.5);
    expect(relevantCandidatesFor("我想要一张浴室场景", [candidate])).toEqual([candidate]);
  });

  it("strips color adjectives from the local catalog query but not the spoken query", () => {
    expect(imageSearchQueryFor("蓝色小猫")).toBe("蓝色小猫");
    expect(imageProviderQueryFor("蓝色小猫")).toBe("小猫");
    expect(imageProviderQueryFor("蓝色")).toBe("蓝色");
  });

  it("requires the cat itself to be blue, not a blue sky or dress", () => {
    const orange = image("orange", "头像 三只小猫 偷看 可爱", ["三只小猫", "偷看", "可爱"]);
    const blueCat = image("blue-cat", "头像 蓝猫 窗台", ["蓝猫", "窗台"]);
    const blueKitten = image("blue-kitten", "头像 蓝色小猫 毛色", ["蓝色小猫"]);
    const girl = image("girl", "头像 克莱因蓝 手绘 抱猫女孩", ["克莱因蓝", "抱猫女孩"]);
    const archive = image("archive", "头像 猫娘 玉足 碧蓝档案", ["猫娘", "碧蓝档案"]);
    expect(relevantCandidatesFor("蓝色小猫", [girl, orange, archive, blueCat, blueKitten]).map((item) => item.id)).toEqual([
      "blue-kitten",
      "blue-cat",
    ]);
  });

  it("rejects a girl portrait that only mentions a kitten", () => {
    const girlWithCat = image("girl-cat", "头像 动漫 女孩 小猫", ["动漫", "女孩", "小猫"]);
    const wedding = image("wedding", "头像 卡通 婚纱 小猫", ["卡通", "婚纱", "小猫"]);
    const ghibli = image("ghibli", "头像 动漫场景 宫崎骏 小猫宠物", ["动漫场景", "宫崎骏", "小猫宠物"]);
    const catSubject = image("cats", "头像 三只小猫 偷看 可爱", ["三只小猫", "偷看", "可爱"]);
    const catEars = image("ears", "头像 剪影 小猫耳朵 暖光", ["剪影", "小猫耳朵", "暖光"]);
    const blank = image("blank", "头像 卡通 可爱 小猫", ["卡通", "可爱", "小猫"]);
    expect(
      relevantCandidatesFor("小猫", [girlWithCat, wedding, ghibli, catSubject, catEars, blank]).map((item) => item.id),
    ).toEqual(["cats"]);
  });

  it("requires a relevant previewable image for a direct web match", () => {
    const webPage = { ...image("web-page", "浴室设计参考", ["浴室"]), kind: "web" } as ResourceCandidate;
    const preview = image("web-image", "浴室设计参考", ["浴室"]);
    expect(hasStrongPreviewImageMatchFor("浴室场景", [webPage])).toBe(false);
    expect(hasStrongPreviewImageMatchFor("浴室场景", [preview])).toBe(true);
  });

  it("extracts the subject bigram from a Chinese image query", () => {
    expect(querySubjectTermsFor("小猫")).toEqual(["小猫"]);
    // "我想要一张浴室场景" — "浴室" + "场景" are both subject bigrams the
    // prompt prefix should anchor so the generator does not drift to a
    // generic room scene.
    expect(querySubjectTermsFor("我想要一张浴室场景")).toEqual(["浴室", "室场", "场景"]);
    expect(querySubjectTermsFor("甜妹插画")).toEqual(["甜妹", "妹插", "插画"]);
  });

  it("flags a web pool that drifted away from the query subject", () => {
    const samoyedPages = [
      web("s1", "萨摩耶幼犬白色毛绒绒", "萨摩耶幼犬 柯基 柴犬 雪橇犬"),
      web("s2", "萨摩耶和柯基对比", "萨摩耶 柯基 柴犬 雪橇犬"),
    ];
    const drift = webPoolDriftsFromQuery("小猫", samoyedPages);
    expect(drift.subjectTerms).toEqual(["小猫"]);
    expect(drift.drifted).toBe(true);
    expect(drift.driftRatio).toBeGreaterThan(0.6);
  });

  it("does not flag a web pool whose bigrams still mention the subject", () => {
    const onTopic = [
      web("c1", "小猫品种大全", "小猫 橘猫 英短 蓝猫 萌宠"),
      web("c2", "小猫饲养指南", "小猫 喂养 猫粮 幼猫"),
    ];
    const drift = webPoolDriftsFromQuery("小猫", onTopic);
    expect(drift.drifted).toBe(false);
  });

  it("treats an empty web pool as not drifted", () => {
    expect(webPoolDriftsFromQuery("小猫", []).drifted).toBe(false);
  });
});
