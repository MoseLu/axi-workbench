import { describe, expect, it } from "vitest";
import { canGenerate, canRead, defaultMemorySettings } from "./policy";

describe("memory policy", () => {
  it("defaults to off everywhere", () => {
    const settings = defaultMemorySettings();
    expect(settings.useMemory).toBe(false);
    expect(settings.generateMemory).toBe(false);
    expect(settings.externalContextProtection).toBe(true);
  });

  it("canRead respects useMemory", () => {
    expect(canRead({ ...defaultMemorySettings(), useMemory: false })).toBe(false);
    expect(canRead({ ...defaultMemorySettings(), useMemory: true })).toBe(true);
  });

  it("canGenerate denies when generateMemory is off", () => {
    expect(canGenerate({ ...defaultMemorySettings(), generateMemory: false }, { outcome: "presenting", usedExternalContext: false })).toBe(false);
  });

  it("canGenerate denies cancelled / failed / safety-confirmed / fallback outcomes", () => {
    const settings = { ...defaultMemorySettings(), generateMemory: true };
    for (const outcome of ["cancelled", "failed", "safety-confirmed", "fallback"] as const) {
      expect(canGenerate(settings, { outcome, usedExternalContext: false })).toBe(false);
    }
  });

  it("canGenerate denies external-context runs when protection is on", () => {
    const settings = { ...defaultMemorySettings(), generateMemory: true, externalContextProtection: true };
    expect(canGenerate(settings, { outcome: "presenting", usedExternalContext: true })).toBe(false);
  });

  it("canGenerate denies when any external tool id is used", () => {
    const settings = { ...defaultMemorySettings(), generateMemory: true };
    expect(canGenerate(settings, {
      outcome: "presenting",
      usedExternalContext: false,
      toolIds: ["resource.search.image", "resource.search.web"],
    })).toBe(false);
    expect(canGenerate(settings, {
      outcome: "presenting",
      usedExternalContext: false,
      toolIds: ["resource.search.image", "resource.generate.image"],
    })).toBe(false);
  });

  it("canGenerate allows plain local presenting runs when generate is on", () => {
    const settings = { ...defaultMemorySettings(), generateMemory: true };
    expect(canGenerate(settings, { outcome: "presenting", usedExternalContext: false, toolIds: ["resource.search.image"] })).toBe(true);
  });
});
