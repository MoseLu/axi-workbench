import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveMobilePairingTokenSecret } from "../src/control-plane.mjs";

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
