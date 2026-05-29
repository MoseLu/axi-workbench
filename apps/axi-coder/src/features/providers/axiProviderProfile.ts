import type { Provider } from "./types";

export type AxiCredentialRef = {
  refId: string;
  owner: "axi-accounts" | "axi-model-gateway";
  kind: "api_key" | "oauth_token_set" | "provider_token";
};

export type AxiProviderProfile = {
  owner: "axi-model-gateway";
  providerId: string;
  providerKind: Provider["providerType"];
  displayName: string;
  baseUrl: string;
  defaultModel?: string | null;
  credentialRef: AxiCredentialRef;
};

export function providerToAxiProviderProfile(provider: Provider): AxiProviderProfile {
  return {
    owner: "axi-model-gateway",
    providerId: provider.id,
    providerKind: provider.providerType,
    displayName: provider.name,
    baseUrl: provider.baseUrl,
    defaultModel: provider.defaultModel ?? null,
    credentialRef: {
      refId: provider.secretRef,
      owner: "axi-accounts",
      kind: "api_key",
    },
  };
}

export function assertNoPlaintextProviderSecret(profile: AxiProviderProfile): void {
  const values = Object.entries(profile)
    .flatMap(([, value]) => (typeof value === "string" ? [value] : []))
    .concat(profile.credentialRef.refId);
  const forbidden = ["sk-", "access_token=", "refresh_token=", "Bearer "];
  const hit = forbidden.find((needle) => values.some((value) => value.includes(needle)));
  if (hit) {
    throw new Error(`AxiProviderProfile contains forbidden plaintext secret marker: ${hit}`);
  }

  if (!profile.credentialRef.refId.startsWith("provider:") && !profile.credentialRef.refId.startsWith("secret_ref:")) {
    throw new Error("AxiProviderProfile must reference a provider secret by ref only.");
  }
}
