import { describe, expect, it } from "vitest";
import { AXI_CODER_PRODUCT_SURFACE, assertAxiCoderProductSurface } from "./axiCoderProductSurface";

describe("Axi Coder product surface", () => {
  it("treats Axi Coder as a full development workbench across Mac desktop and mobile", () => {
    expect(AXI_CODER_PRODUCT_SURFACE).toMatchObject({
      owner: "axi-coder",
      productName: "Axi Coder",
      role: "full_development_workbench",
      platforms: expect.arrayContaining(["mac_desktop", "mobile_companion"]),
      capabilities: expect.arrayContaining([
        "project_development",
        "cli_orchestration",
        "agent_task_execution",
        "model_provider_routing",
      ]),
    });
    expect(() => assertAxiCoderProductSurface(AXI_CODER_PRODUCT_SURFACE)).not.toThrow();
  });

  it("keeps ledger, dashboard, and credential vault ownership outside Axi Coder", () => {
    expect(AXI_CODER_PRODUCT_SURFACE.excludedOwners).toEqual(
      expect.arrayContaining(["account_ledger", "ops_dashboard", "credential_vault"]),
    );
  });
});
