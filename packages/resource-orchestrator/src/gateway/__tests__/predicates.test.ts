import { describe, expect, it } from "vitest";
import {
  intentKind, queryRegex, hasOrientation, and, not, alwaysTrue,
  expression, byTag, byLanguage, byDomain, scoreFor, builderForPredicateId,
} from "../predicates";
import type { Intent } from "@axi/gateway-contracts";

const intent = (over: Partial<Intent> = {}): Intent => ({
  operation: "search",
  resourceKinds: [],
  constraints: {},
  needsClarification: false,
  ...over,
});

describe("gateway predicates", () => {
  it("intentKind matches the requested kind", () => {
    const p = intentKind("image");
    expect(p.matches(intent({ resourceKinds: ["image"] }))).toBe(true);
    expect(p.matches(intent({ resourceKinds: ["skill"] }))).toBe(false);
  });

  it("intentKind accepts multiple kinds as OR", () => {
    const p = intentKind("image", "web");
    expect(p.matches(intent({ resourceKinds: ["image"] }))).toBe(true);
    expect(p.matches(intent({ resourceKinds: ["web"] }))).toBe(true);
    expect(p.matches(intent({ resourceKinds: ["skill"] }))).toBe(false);
  });

  it("queryRegex matches when the query text contains the pattern", () => {
    const p = queryRegex(/ppt|演示文稿/u);
    expect(p.matches(intent({ constraints: { query: "帮我做一份PPT" } }))).toBe(true);
    expect(p.matches(intent({ constraints: { query: "随便画画" } }))).toBe(false);
  });

  it("hasOrientation matches only valid orientations", () => {
    const p = hasOrientation();
    expect(p.matches(intent({ constraints: { orientation: "landscape" } }))).toBe(true);
    expect(p.matches(intent({ constraints: { orientation: "original" } }))).toBe(true);
    expect(p.matches(intent({ constraints: { orientation: "diagonal" } }))).toBe(false);
    expect(p.matches(intent({ constraints: {} }))).toBe(false);
  });

  it("alwaysTrue matches any intent", () => {
    expect(alwaysTrue().matches(intent())).toBe(true);
  });

  it("and combines predicates (every-must-match)", () => {
    const p = and(intentKind("image"), hasOrientation());
    expect(p.matches(intent({ resourceKinds: ["image"], constraints: { orientation: "landscape" } }))).toBe(true);
    expect(p.matches(intent({ resourceKinds: ["image"], constraints: {} }))).toBe(false);
  });

  it("not inverts the inner predicate", () => {
    const p = not(intentKind("image"));
    expect(p.matches(intent({ resourceKinds: ["skill"] }))).toBe(true);
    expect(p.matches(intent({ resourceKinds: ["image"] }))).toBe(false);
  });

  it("expression evaluates a custom function", () => {
    const p = expression((i) => i.constraints.query === "hello");
    expect(p.matches(intent({ constraints: { query: "hello" } }))).toBe(true);
    expect(p.matches(intent({ constraints: { query: "world" } }))).toBe(false);
  });

  it("byTag / byLanguage / byDomain read constraint fields", () => {
    expect(byTag("wallpaper").matches(intent({ constraints: { tag: "wallpaper" } }))).toBe(true);
    expect(byTag("wallpaper").matches(intent({ constraints: { tag: "image" } }))).toBe(false);
    expect(byLanguage("zh").matches(intent({ constraints: { language: "zh" } }))).toBe(true);
    expect(byDomain("axi-docs").matches(intent({ constraints: { domain: "axi-docs" } }))).toBe(true);
    expect(byDomain("axi-docs").matches(intent({ constraints: { domain: "axi-ui" } }))).toBe(false);
  });

  it("scoreFor returns -1 when a predicate does not match", () => {
    expect(scoreFor(intent({ resourceKinds: ["skill"] }), [intentKind("image")])).toBe(-1);
  });

  it("scoreFor sums per-predicate scores for matched routes", () => {
    expect(scoreFor(intent({ resourceKinds: ["image"] }), [intentKind("image")])).toBeGreaterThan(0);
  });

  it("builderForPredicateId resolves legacy and by- ids", () => {
    expect(builderForPredicateId("intent-kind-image")?.id).toContain("by-resource-kind");
    expect(builderForPredicateId("by-resource-kind-image")?.id).toContain("by-resource-kind");
    expect(builderForPredicateId("by-tag:image")?.id).toBe("by-tag(image)");
    expect(builderForPredicateId("by-language:zh")?.id).toBe("by-language(zh)");
    expect(builderForPredicateId("by-domain:axi-docs")?.id).toBe("by-domain(axi-docs)");
    expect(builderForPredicateId("unknown-id")).toBeUndefined();
  });
});
