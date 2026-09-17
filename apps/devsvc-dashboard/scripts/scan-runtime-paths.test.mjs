/**
 * Tests for the runtime path scanner (WFB-PACK-001).
 *
 * These tests build ephemeral fixture trees to confirm that:
 *   - files containing `/Volumes/code/workspace/...` references are detected
 *   - clean fixtures produce zero matches
 *   - allowlisted governance snapshot files are not flagged
 *   - unknown extensions are ignored (no false positives from binary blobs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { scan } from "./scan-runtime-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Build an isolated fixture directory containing the requested files. The
 * returned `cleanup` removes the directory tree on teardown.
 *
 * @param {Record<string, string>} files - filename (relative) -> contents
 * @returns {{ root: string, cleanup: () => void }}
 */
function makeFixture(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scan-runtime-paths-"));
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, "utf8");
  }
  return {
    root,
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

test("detects /Volumes/code/workspace strings in scanned files", () => {
  const fixture = makeFixture({
    "asset.js": "const base = '/Volumes/code/workspace/shared/axi-ui/packages/core';\n",
    "deep/nested/loader.ts": "import '/Volumes/code/workspace/projects/axi-workbench/apps/devsvc-dashboard';\n"
  });
  try {
    const matches = scan(fixture.root);
    assert.equal(matches.length, 2, `expected 2 matches, got ${matches.length}`);
    const byFile = Object.fromEntries(matches.map((m) => [path.relative(fixture.root, m.file), m.lines]));
    assert.deepEqual(byFile["asset.js"], [1]);
    assert.deepEqual(byFile["deep/nested/loader.ts"], [1]);
  } finally {
    fixture.cleanup();
  }
});

test("returns zero matches when no fixture references the workspace path", () => {
  const fixture = makeFixture({
    "asset.js": "export const greeting = 'hello';\n",
    "config.json": "{ \"endpoint\": \"https://example.invalid/api\" }\n",
    "styles.css": "body { color: red; }\n"
  });
  try {
    const matches = scan(fixture.root);
    assert.deepEqual(matches, []);
  } finally {
    fixture.cleanup();
  }
});

test("allowlisted governance snapshot files are not flagged", () => {
  const fixture = makeFixture({
    "workspace-project-completion.json": "{ \"root\": \"/Volumes/code/workspace\" }\n",
    "workspace-project-handoff.json": "{ \"root\": \"/Volumes/code/workspace\" }\n",
    "asset.js": "const ok = 'no workspace path here';\n"
  });
  try {
    const matches = scan(fixture.root);
    assert.deepEqual(matches, [], `allowlisted files leaked: ${JSON.stringify(matches)}`);
  } finally {
    fixture.cleanup();
  }
});

test("skips files with extensions outside the scan set", () => {
  const fixture = makeFixture({
    "binary.bin": "/Volumes/code/workspace/shared/axi-ui/packages/core\0\0\0",
    "image.svg": "<svg><!-- /Volumes/code/workspace --></svg>\n"
  });
  try {
    const matches = scan(fixture.root);
    // `.bin` is not in SCANNABLE_EXTENSIONS; `.svg` IS scanned and SHOULD flag.
    assert.equal(matches.length, 1, `expected exactly 1 match, got ${matches.length}`);
    assert.ok(matches[0].file.endsWith("image.svg"));
  } finally {
    fixture.cleanup();
  }
});

test("throws when the scan target does not exist", () => {
  const ghost = path.join(__dirname, "definitely-missing-" + Date.now());
  assert.throws(() => scan(ghost), /scan target does not exist/u);
});

test("scanner passes against the current devsvc-dashboard dist", () => {
  const dist = path.resolve(__dirname, "..", "dist");
  if (!fs.existsSync(dist)) {
    // dist may not exist in CI before a build runs; skip rather than fail.
    return;
  }
  const matches = scan(dist);
  assert.deepEqual(matches, [], `runtime wiring leaked into dist: ${JSON.stringify(matches)}`);
});
