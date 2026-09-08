import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createControlPlane, resolveMobilePairingEnabled, resolveMobilePairingTokenSecret } from "../src/control-plane.mjs";

test("local mobile pairing persists a private development secret only when explicitly enabled", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-secret-"));
  const first = resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "development" });
  const second = resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "development" });

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(second, first);
  assert.equal(readFileSync(join(cacheDir, "mobile-pairing-token-secret"), "utf8").trim(), first);
});

test("pairing stays disabled without explicit development enablement or in production", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-disabled-"));

  assert.equal(resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: false, nodeEnv: "development" }), "");
  assert.equal(resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "production" }), "");
  assert.equal(existsSync(join(cacheDir, "mobile-pairing-token-secret")), false);
});

test("development restarts recover an existing local pairing state", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-recover-"));
  resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "development" });

  assert.equal(resolveMobilePairingEnabled({ cacheDir, nodeEnv: "development" }), true);
  assert.equal(resolveMobilePairingEnabled({ cacheDir, nodeEnv: "production" }), false);
});

test("an empty or malformed local pairing cache never enables pairing implicitly", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-empty-"));
  writeFileSync(join(cacheDir, "mobile-pairing-token-secret"), "\n", { mode: 0o600 });

  assert.equal(resolveMobilePairingEnabled({ cacheDir, nodeEnv: "development" }), false);
  assert.equal(resolveMobilePairingEnabled({ cacheDir, nodeEnv: "test" }), false);
});

test("an explicit pairing setting wins over a persisted local state", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-explicit-"));
  resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "development" });

  assert.equal(resolveMobilePairingEnabled({ cacheDir, configured: true, configuredValue: "false", nodeEnv: "development" }), false);
  assert.equal(resolveMobilePairingEnabled({ cacheDir, configured: true, configuredValue: "true", nodeEnv: "development" }), true);
  assert.equal(resolveMobilePairingEnabled({ cacheDir, configured: true, configuredValue: "", nodeEnv: "development" }), false);
});

test("the control plane restores an established local pairing when the env setting is omitted", () => {
  const cacheDir = mkdtempSync(join(tmpdir(), "axi-mobile-pairing-control-plane-"));
  resolveMobilePairingTokenSecret({ cacheDir, pairingEnabled: true, nodeEnv: "development" });
  const hadSetting = Object.hasOwn(process.env, "AXI_MOBILE_PAIRING_ENABLED");
  const priorSetting = process.env.AXI_MOBILE_PAIRING_ENABLED;

  try {
    delete process.env.AXI_MOBILE_PAIRING_ENABLED;
    const controlPlane = createControlPlane({ cacheDir, nodeEnv: "development" });
    assert.equal(controlPlane.pairingEnabled, true);
    assert.ok(controlPlane.pairing);
  } finally {
    if (hadSetting) process.env.AXI_MOBILE_PAIRING_ENABLED = priorSetting;
    else delete process.env.AXI_MOBILE_PAIRING_ENABLED;
  }
});
