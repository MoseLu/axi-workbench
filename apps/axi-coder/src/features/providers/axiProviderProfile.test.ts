import { describe, expect, it } from "vitest";
import { assertNoPlaintextProviderSecret, providerToAxiProviderProfile } from "./axiProviderProfile";
import type { Provider } from "./types";

function provider(overrides: Partial<Provider>): Provider {
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

describe("Axi ProviderProfile bridge", () => {
  it("maps Axi Coder provider records to the shared model gateway contract", () => {
    const profile = providerToAxiProviderProfile(provider({}));

    expect(profile).toMatchObject({
      owner: "axi-model-gateway",
      providerId: "deepseek",
      providerKind: "open_ai_chat",
      displayName: "DeepSeek",
      baseUrl: "https://api.deepseek.example",
      defaultModel: "deepseek-chat",
      credentialRef: {
        refId: "provider:deepseek",
        owner: "axi-accounts",
        kind: "api_key",
      },
    });
    expect(() => assertNoPlaintextProviderSecret(profile)).not.toThrow();
  });

  it("keeps Ollama provider profiles ref-only even when no API key is needed", () => {
    const profile = providerToAxiProviderProfile(provider({
      id: "ollama-local",
      name: "Ollama Local",
      baseUrl: "http://127.0.0.1:11434",
      providerType: "ollama",
      defaultModel: "qwen3",
      secretRef: "provider:ollama-local",
    }));

    expect(profile.providerKind).toBe("ollama");
    expect(profile.credentialRef.refId).toBe("provider:ollama-local");
    expect(() => assertNoPlaintextProviderSecret(profile)).not.toThrow();
  });

  it("rejects accidental plaintext secret markers in provider profiles", () => {
    const profile = providerToAxiProviderProfile(provider({
      secretRef: "sk-plaintext-should-not-be-here",
    }));

    expect(() => assertNoPlaintextProviderSecret(profile)).toThrow(/forbidden plaintext secret marker/);
  });
});
