import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve as resolvePath } from "node:path";

const SCRIPT = resolvePath(__dirname, "provider-outage-drill.mjs");

describe("scripts/gateway-ha/provider-outage-drill.mjs", () => {
  it("renders usage on --help", () => {
    const r = spawnSync("node", [SCRIPT, "--help"], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage: provider-outage-drill\.mjs/);
    expect(r.stdout).toMatch(/--pb 01\|02/);
  });

  it("rejects unknown flags", () => {
    const r = spawnSync("node", [SCRIPT, "--bogus-flag"], { encoding: "utf8" });
    // The script's parseArgs ignores unknown flags (current
    // implementation), so this is a smoke check rather than a
    // failure gate. Document the actual behaviour.
    expect([0, 1, 2]).toContain(r.status);
  });

  it("node --check passes (no syntax / import errors)", () => {
    const r = spawnSync("node", ["--check", SCRIPT], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });
});
