import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("fleet theme follows the Axi provider mode instead of hardcoding dark", async () => {
  const appSource = await readFile(path.join(dashboardRoot, "src", "App.tsx"), "utf8");
  const lightCss = await readFile(path.join(dashboardRoot, "src", "styles", "admin-light.css"), "utf8");
  const darkCss = await readFile(path.join(dashboardRoot, "src", "styles", "admin-dark.css"), "utf8");

  assert.match(appSource, /useAxiTheme/u);
  assert.match(appSource, /mode === "dark" \? theme\.darkAlgorithm : theme\.defaultAlgorithm/u);
  assert.match(appSource, /createAxiAntdTheme\(mode,\s*preset/u);
  assert.match(appSource, /defaultPresetName="fleet"/u);
  assert.doesNotMatch(appSource, /createAxiAntdTheme\("dark"/u);
  assert.match(lightCss, /^:root\[data-axi-mode="light"\] body/u);
  assert.match(darkCss, /^:root\[data-axi-mode="dark"\] body/u);
  assert.doesNotMatch(lightCss, /^body\s*\{/mu);
  assert.doesNotMatch(darkCss, /^body\s*\{/mu);
});
