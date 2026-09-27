import { describe, expect, it } from "vitest";
import { STYLE_RULES, findStyleRule, styleModifierFor } from "./style-modifiers";

describe("style-modifiers", () => {
  it("matches the sweet-girl rule on the documented query tokens", () => {
    expect(findStyleRule("我需要一张甜妹图片")?.id).toBe("sweet-girl");
    expect(findStyleRule("来一张少女照片")?.id).toBe("sweet-girl");
    expect(findStyleRule("治愈系")?.id).toBe("sweet-girl");
  });

  it("matches the portrait and scenery rules on their documented tokens", () => {
    expect(findStyleRule("正面美女头像")?.id).toBe("portrait");
    expect(findStyleRule("自然风景照")?.id).toBe("scenery");
    expect(findStyleRule("桌面壁纸")?.id).toBe("wallpaper");
  });

  it("returns undefined for unmatched queries", () => {
    expect(findStyleRule("随便画一个图标")).toBeUndefined();
    expect(styleModifierFor("xyz")).toBeUndefined();
  });

  it("exports at least one rule per documented category", () => {
    expect(STYLE_RULES.map((rule) => rule.id)).toEqual(
      expect.arrayContaining(["sweet-girl", "portrait", "scenery", "wallpaper"]),
    );
  });
});
