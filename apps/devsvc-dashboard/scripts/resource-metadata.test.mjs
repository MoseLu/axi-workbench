// Tests for the four Resource Index metadata payloads
// (`rulesMetadata`, `skillsMetadata`, `registryMetadata`,
// `governanceMetadata`).
//
// Goals:
//   1. The static `axi-resources.json` config must declare non-empty
//      metadata for `axi-rules`, `axi-skills`, `axi-registry` and
//      `axi-workspace-governance`. The dashboard details view
//      (`AxiResourcesPage.tsx`) keys off these four metadata shapes to
//      render different sections — empty metadata means an empty section,
//      which defeats WFB-REG-002.
//   2. Each metadata payload must satisfy its documented contract:
//        - `AxiRulesMetadata`       → ruleFamilies, applicableScopes,
//                                     sourcePrecedence.
//        - `AxiSkillsMetadata`      → skillCategories, version,
//                                     i18nStatus, skillCount.
//        - `AxiRegistryMetadata`    → registryUrl, packageCount,
//                                     healthStatus, healthEndpoint.
//        - `AxiGovernanceMetadata`  → projectCount, graphValidation
//                                     {valid, errorCount, warningCount},
//                                     lastValidatedAt.
//   3. The values must be **derived from real sources**, not placeholders.
//      We re-derive each anchor from disk during the test so a future
//      drive-by edit cannot silently replace real data with hard-coded
//      test strings without the test catching it.
//   4. The kind/contract mapping used by the detail view must agree
//      with the static config (`shared-rule-index` ↔ rulesMetadata, etc.)
//      so the UI branch actually fires.
//
// This file is intentionally pure Node + `node:test` — it does not import
// the TypeScript surface, because the metadata contract lives in JSON
// config plus the TypeScript shape, both of which can be exercised from
// the JSON side. A separate end-to-end assertion (already covered by
// `axi-resources.test.mjs` for the lifecycle normalizer) gates the TS
// surface itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot = path.dirname(dashboardRoot);
const configPath = path.join(dashboardRoot, "config", "axi-resources.json");

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// ---------------------------------------------------------------------------
// Real-source anchors. Re-derived from disk during the test so a stale
// snapshot cannot pass.
// ---------------------------------------------------------------------------

const workspaceRoot = path.dirname(path.dirname(path.dirname(projectRoot)));

const rulesRoot = path.join(workspaceRoot, "projects", "axi-rules");
const skillsRoot = path.join(workspaceRoot, "shared", "axi-skills");
const registryRoot = path.join(workspaceRoot, "infra", "axi-registry");
const governanceRoot = path.join(workspaceRoot, "infra", "axi-workspace-governance");

const rulesIndex = JSON.parse(
  fs.readFileSync(path.join(rulesRoot, "index", "rules.json"), "utf8")
);
const expectedRuleFamilies = Array.from(
  new Set(rulesIndex.rules.map((rule) => rule.category))
).sort();

const sourcesIndex = JSON.parse(
  fs.readFileSync(path.join(rulesRoot, "index", "sources.json"), "utf8")
);
const expectedSourcePrecedence = sourcesIndex.precedence
  .slice()
  .sort((a, b) => a.rank - b.rank)
  .map((entry) => entry.source);

function walkSkillMd(root) {
  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      count += walkSkillMd(full);
    } else if (entry.name === "SKILL.md") {
      count += 1;
    }
  }
  return count;
}
const enSkillCount = walkSkillMd(path.join(skillsRoot, "skills"));
const zhSkillCount = walkSkillMd(path.join(skillsRoot, "skills.zh"));

const skillsManifest = JSON.parse(
  fs.readFileSync(path.join(skillsRoot, "skills", ".sync-manifest.json"), "utf8")
);
const expectedSkillManifestCount = Object.keys(skillsManifest.skills).length;

const registryPackages = fs
  .readdirSync(path.join(registryRoot, "storage", "@axi"))
  .filter((entry) =>
    fs
      .statSync(path.join(registryRoot, "storage", "@axi", entry))
      .isDirectory()
  );

const governanceRegistry = JSON.parse(
  fs.readFileSync(
    path.join(governanceRoot, ".workspace", "registry.json"),
    "utf8"
  )
);
const expectedProjectCount = governanceRegistry.items.length;

const healthScript = fs.readFileSync(
  path.join(registryRoot, "scripts", "health.mjs"),
  "utf8"
);
const healthUrl = (healthScript.match(/const url = "([^"]+)"/) || [])[1];

// ---------------------------------------------------------------------------
// 1. Static config metadata presence and shape
// ---------------------------------------------------------------------------

test("static config: all four Resource Index entries declare non-empty metadata", () => {
  for (const id of [
    "axi-rules",
    "axi-skills",
    "axi-registry",
    "axi-workspace-governance"
  ]) {
    const entry = config.find((resource) => resource.id === id);
    assert.ok(entry, `missing resource entry: ${id}`);
    const metaKey = {
      "axi-rules": "rulesMetadata",
      "axi-skills": "skillsMetadata",
      "axi-registry": "registryMetadata",
      "axi-workspace-governance": "governanceMetadata"
    }[id];
    const meta = entry[metaKey];
    assert.ok(meta, `${id} must declare ${metaKey}`);
    assert.notDeepEqual(meta, {}, `${id} ${metaKey} must be non-empty`);
  }
});

test("static config: kind ↔ metadata mapping matches the detail view branch keys", () => {
  const mapping = [
    ["axi-rules", "shared-rule-index", "rulesMetadata"],
    ["axi-skills", "shared-skill-registry", "skillsMetadata"],
    ["axi-registry", "local-registry", "registryMetadata"],
    ["axi-workspace-governance", "governance-infrastructure", "governanceMetadata"]
  ];
  for (const [id, expectedKind, metaKey] of mapping) {
    const entry = config.find((resource) => resource.id === id);
    assert.equal(entry.kind, expectedKind, `${id} kind contract`);
    assert.ok(entry[metaKey], `${id} must carry ${metaKey}`);
  }
});

// ---------------------------------------------------------------------------
// 2. AxiRulesMetadata — derived from index/rules.json and index/sources.json
// ---------------------------------------------------------------------------

test("axi-rules.rulesMetadata.ruleFamilies matches index/rules.json categories", () => {
  const entry = config.find((r) => r.id === "axi-rules");
  const actual = [...entry.rulesMetadata.ruleFamilies].sort();
  assert.deepEqual(actual, expectedRuleFamilies);
});

test("axi-rules.rulesMetadata.applicableScopes is non-empty and labelled with real scopes", () => {
  const entry = config.find((r) => r.id === "axi-rules");
  const scopes = entry.rulesMetadata.applicableScopes;
  assert.ok(Array.isArray(scopes));
  assert.ok(scopes.length >= 2, "scopes must list at least two real scopes");
  for (const scope of scopes) {
    assert.equal(typeof scope, "string");
    assert.ok(scope.length > 0);
  }
  for (const required of ["project", "workspace"]) {
    assert.ok(scopes.includes(required), `missing required scope: ${required}`);
  }
});

test("axi-rules.rulesMetadata.sourcePrecedence mirrors index/sources.json rank order", () => {
  const entry = config.find((r) => r.id === "axi-rules");
  assert.deepEqual(entry.rulesMetadata.sourcePrecedence, expectedSourcePrecedence);
});

// ---------------------------------------------------------------------------
// 3. AxiSkillsMetadata — derived from skills/ filesystem + apm.yml
// ---------------------------------------------------------------------------

test("axi-skills.skillsMetadata.skillCount matches SKILL.md filesystem count", () => {
  const entry = config.find((r) => r.id === "axi-skills");
  assert.equal(entry.skillsMetadata.skillCount, enSkillCount);
});

test("axi-skills.skillsMetadata.version matches apm.yml manifest version", () => {
  const apm = fs.readFileSync(path.join(skillsRoot, "apm.yml"), "utf8");
  const match = apm.match(/^version:\s*"?([0-9][^\s#]*?)"?\s*$/m);
  assert.ok(match, "apm.yml must declare a version line");
  const entry = config.find((r) => r.id === "axi-skills");
  assert.equal(entry.skillsMetadata.version, match[1]);
});

test("axi-skills.skillsMetadata.i18nStatus reflects the real EN/ZH parity", () => {
  const entry = config.find((r) => r.id === "axi-skills");
  if (zhSkillCount === enSkillCount && zhSkillCount > 0) {
    assert.equal(entry.skillsMetadata.i18nStatus, "full");
  } else if (zhSkillCount === 0) {
    assert.equal(entry.skillsMetadata.i18nStatus, "none");
  } else {
    assert.equal(entry.skillsMetadata.i18nStatus, "partial");
  }
  assert.ok(
    ["full", "partial", "none"].includes(entry.skillsMetadata.i18nStatus)
  );
});

test("axi-skills.skillsMetadata.skillCategories is a non-empty array of strings", () => {
  const entry = config.find((r) => r.id === "axi-skills");
  const cats = entry.skillsMetadata.skillCategories;
  assert.ok(Array.isArray(cats));
  assert.ok(cats.length >= 3, "skills categories must enumerate real skill groups");
  for (const cat of cats) {
    assert.equal(typeof cat, "string");
    assert.ok(cat.length > 0);
    assert.ok(cat !== "test" && cat !== "todo" && cat !== "placeholder");
  }
});

test("axi-skills.skillsMetadata.skillCount matches the sync-manifest entry count", () => {
  const entry = config.find((r) => r.id === "axi-skills");
  assert.ok(
    entry.skillsMetadata.skillCount >= expectedSkillManifestCount,
    `skillCount ${entry.skillsMetadata.skillCount} must be >= manifest ${expectedSkillManifestCount}`
  );
});

// ---------------------------------------------------------------------------
// 4. AxiRegistryMetadata — derived from storage/@axi + health.mjs
// ---------------------------------------------------------------------------

test("axi-registry.registryMetadata.registryUrl matches the Verdaccio listen host", () => {
  const verdaccioConfig = fs.readFileSync(
    path.join(registryRoot, "config", "config.yaml"),
    "utf8"
  );
  const listenMatch = verdaccioConfig.match(/-\s*([0-9.]+:\d+)/);
  assert.ok(listenMatch, "verdaccio config must declare a listen address");
  const expectedUrl = `http://${listenMatch[1]}`;
  const entry = config.find((r) => r.id === "axi-registry");
  assert.equal(entry.registryMetadata.registryUrl, expectedUrl);
});

test("axi-registry.registryMetadata.healthEndpoint matches scripts/health.mjs URL", () => {
  const entry = config.find((r) => r.id === "axi-registry");
  assert.equal(entry.registryMetadata.healthEndpoint, healthUrl);
});

test("axi-registry.registryMetadata.packageCount matches storage/@axi directories", () => {
  const entry = config.find((r) => r.id === "axi-registry");
  assert.equal(entry.registryMetadata.packageCount, registryPackages.length);
});

test("axi-registry.registryMetadata.healthStatus is one of the contract states", () => {
  const entry = config.find((r) => r.id === "axi-registry");
  assert.ok(
    ["healthy", "unhealthy", "unknown"].includes(entry.registryMetadata.healthStatus),
    `healthStatus ${entry.registryMetadata.healthStatus} not in contract`
  );
});

// ---------------------------------------------------------------------------
// 5. AxiGovernanceMetadata — derived from .workspace/registry.json
// ---------------------------------------------------------------------------

test("axi-workspace-governance.governanceMetadata.projectCount matches .workspace/registry.json items length", () => {
  const entry = config.find((r) => r.id === "axi-workspace-governance");
  assert.equal(entry.governanceMetadata.projectCount, expectedProjectCount);
});

test("axi-workspace-governance.governanceMetadata.graphValidation is well-formed", () => {
  const entry = config.find((r) => r.id === "axi-workspace-governance");
  const gv = entry.governanceMetadata.graphValidation;
  assert.equal(typeof gv.valid, "boolean");
  assert.equal(typeof gv.errorCount, "number");
  assert.equal(typeof gv.warningCount, "number");
  assert.ok(gv.errorCount >= 0);
  assert.ok(gv.warningCount >= 0);
});

test("axi-workspace-governance.governanceMetadata.lastValidatedAt is an ISO timestamp", () => {
  const entry = config.find((r) => r.id === "axi-workspace-governance");
  const ts = entry.governanceMetadata.lastValidatedAt;
  assert.match(ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  assert.ok(!Number.isNaN(new Date(ts).getTime()));
});

// ---------------------------------------------------------------------------
// 6. Contract field whitelist (rejects accidental fields)
// ---------------------------------------------------------------------------

test("metadata shapes stay within the documented contract fields", () => {
  const allowed = {
    rulesMetadata: ["ruleFamilies", "applicableScopes", "sourcePrecedence"],
    skillsMetadata: ["skillCategories", "version", "i18nStatus", "skillCount"],
    registryMetadata: [
      "registryUrl",
      "packageCount",
      "healthStatus",
      "healthEndpoint"
    ],
    governanceMetadata: ["projectCount", "graphValidation", "lastValidatedAt"]
  };

  for (const [metaKey, fields] of Object.entries(allowed)) {
    const entry = config.find((r) => r[metaKey]);
    if (!entry) continue;
    const declared = Object.keys(entry[metaKey]);
    for (const key of declared) {
      assert.ok(
        fields.includes(key),
        `${metaKey}.${key} is not part of the documented contract`
      );
    }
  }
});