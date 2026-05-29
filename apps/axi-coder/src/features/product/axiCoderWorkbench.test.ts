import { describe, expect, it } from "vitest";
import { AXI_CODER_PRODUCT_SURFACE } from "./axiCoderProductSurface";
import { buildAxiCoderWorkbenchModel } from "./axiCoderWorkbench";

describe("Axi Coder workbench model", () => {
  it("turns the full development product surface into visible workbench sections", () => {
    const model = buildAxiCoderWorkbenchModel();

    expect(model.title).toBe("Axi Coder");
    expect(model.primaryStatus).toContain("E2E");
    expect(model.cards.map((card) => card.id)).toEqual(
      expect.arrayContaining([
        "project-context",
        "cli-orchestration",
        "agent-task",
        "model-routing",
        "artifact-review",
        "mobile-companion",
      ]),
    );
    expect(model.actions.map((action) => action.target)).toEqual(["routes", "providers", "logs"]);
    expect(model.flow.map((step) => step.id)).toEqual(["desktop", "workstation", "agent", "notify", "mobile"]);
  });

  it("keeps every visible product capability backed by the product surface", () => {
    const model = buildAxiCoderWorkbenchModel();
    const visibleCapabilities = model.cards
      .map((card) => card.capability)
      .filter((capability) => capability !== "mobile_companion");

    expect(visibleCapabilities.every((capability) => AXI_CODER_PRODUCT_SURFACE.capabilities.includes(capability))).toBe(true);
    expect(AXI_CODER_PRODUCT_SURFACE.platforms).toEqual(expect.arrayContaining(["mac_desktop", "mobile_companion"]));
  });
});
