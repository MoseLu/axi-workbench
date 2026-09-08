import { describe, expect, it } from "vitest";
import workspaceGraph from "../../../../../../../workspace.graph.json";
import { assertNoPlaintextProviderSecret, providerToAxiProviderProfile } from "../providers/axiProviderProfile";
import type { Provider } from "../providers/types";
import { AXI_CODER_PRODUCT_SURFACE, assertAxiCoderProductSurface } from "./axiCoderProductSurface";

type WorkspaceProject = {
  path: string;
  kind: string;
  provides: string[];
  consumes?: string[];
  contracts?: string[];
  completion?: {
    stage: string;
    confidence: string;
  };
};

type WorkspaceGraph = {
  projects: Record<string, WorkspaceProject>;
};

function provider(overrides: Partial<Provider> = {}): Provider {
  const now = "2026-05-25T00:00:00.000Z";
  return {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.example",
    providerType: "open_ai_chat",
    defaultModel: "deepseek-chat",
    secretRef: "provider:deepseek",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Axi Coder workspace E2E contract", () => {
  it("keeps the workspace graph, product surface, and model contract aligned", () => {
    const graph = workspaceGraph as WorkspaceGraph;
    const axiCoder = graph.projects["axi-coder"];
    const modelGateway = graph.projects["axi-model-gateway"];

    expect(axiCoder).toMatchObject({
      path: "/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder",
      kind: "full-development-workbench",
    });
    expect(axiCoder.provides).toEqual(
      expect.arrayContaining([
        "project-development-workbench",
        "mac-desktop-client",
        "mobile-companion-client",
        "cli-orchestration",
        "agent-task-console",
        "model-routing-adapter",
        "terminal-sessions",
        "artifact-review",
      ]),
    );
    expect(axiCoder.consumes).toEqual(
      expect.arrayContaining(["axi-workbench", "axi-agent-platform", "axi-model-gateway", "axi-accounts", "axi-notify"]),
    );
    expect(axiCoder.completion).toMatchObject({
      stage: "building",
      confidence: "medium",
    });
    expect(modelGateway).toMatchObject({
      path: "/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder",
      kind: "infrastructure-contract-consumed-by-axi-coder",
    });

    assertAxiCoderProductSurface(AXI_CODER_PRODUCT_SURFACE);
    expect(AXI_CODER_PRODUCT_SURFACE.platforms).toEqual(expect.arrayContaining(["mac_desktop", "mobile_companion"]));
    expect(AXI_CODER_PRODUCT_SURFACE.capabilities).toEqual(
      expect.arrayContaining(["project_development", "cli_orchestration", "agent_task_execution", "model_provider_routing"]),
    );

    const profile = providerToAxiProviderProfile(provider());
    expect(profile.owner).toBe("axi-model-gateway");
    expect(profile.credentialRef.refId).toBe("provider:deepseek");
    expect(() => assertNoPlaintextProviderSecret(profile)).not.toThrow();
  });
});
