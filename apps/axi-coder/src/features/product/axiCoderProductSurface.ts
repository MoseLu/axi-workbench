export type AxiCoderPlatform = "mac_desktop" | "mobile_companion";

export type AxiCoderCapability =
  | "project_development"
  | "cli_orchestration"
  | "agent_task_execution"
  | "workspace_context"
  | "model_provider_routing"
  | "terminal_sessions"
  | "artifact_review";

export type AxiCoderExcludedOwner = "account_ledger" | "ops_dashboard" | "credential_vault";

export type AxiCoderProductSurface = {
  owner: "axi-coder";
  productName: "Axi Coder";
  role: "full_development_workbench";
  platforms: AxiCoderPlatform[];
  capabilities: AxiCoderCapability[];
  consumesContracts: string[];
  excludedOwners: AxiCoderExcludedOwner[];
};

export const AXI_CODER_PRODUCT_SURFACE: AxiCoderProductSurface = {
  owner: "axi-coder",
  productName: "Axi Coder",
  role: "full_development_workbench",
  platforms: ["mac_desktop", "mobile_companion"],
  capabilities: [
    "project_development",
    "cli_orchestration",
    "agent_task_execution",
    "workspace_context",
    "model_provider_routing",
    "terminal_sessions",
    "artifact_review",
  ],
  consumesContracts: [
    "axi-workbench",
    "axi-agent",
    "axi-model-gateway",
    "axi-accounts",
    "axi-notify",
  ],
  excludedOwners: ["account_ledger", "ops_dashboard", "credential_vault"],
};

export function assertAxiCoderProductSurface(surface: AxiCoderProductSurface): void {
  if (surface.role !== "full_development_workbench") {
    throw new Error("Axi Coder must remain a full development workbench.");
  }
  for (const platform of ["mac_desktop", "mobile_companion"] as const) {
    if (!surface.platforms.includes(platform)) {
      throw new Error(`Axi Coder product surface is missing platform: ${platform}`);
    }
  }
  for (const capability of ["project_development", "cli_orchestration", "agent_task_execution"] as const) {
    if (!surface.capabilities.includes(capability)) {
      throw new Error(`Axi Coder product surface is missing capability: ${capability}`);
    }
  }
  for (const excludedOwner of ["account_ledger", "ops_dashboard", "credential_vault"] as const) {
    if (!surface.excludedOwners.includes(excludedOwner)) {
      throw new Error(`Axi Coder product surface is missing excluded owner: ${excludedOwner}`);
    }
  }
}
