import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("tauri dashboard capability grants ACL permissions to local service origins", async () => {
  const capability = JSON.parse(await readFile(
    path.join(projectRoot, "src-tauri", "capabilities", "default.json"),
    "utf8"
  ));

  assert.deepEqual(capability.remote?.urls, [
    "http://127.0.0.1:17888/*",
    "http://localhost:17888/*",
    "http://127.0.0.1:17889/*",
    "http://localhost:17889/*"
  ]);
  assert.ok(capability.permissions.includes("core:webview:allow-get-all-webviews"));
  assert.ok(capability.permissions.includes("core:webview:allow-webview-close"));
});
