import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("tabbar fullscreen uses shared content expansion instead of app-level fullscreen overlay", async () => {
  const shellSource = await readFile(path.join(projectRoot, "src", "app-shell", "Shell.tsx"), "utf8");
  const sidebarStyles = await readFile(path.join(projectRoot, "src", "styles", "sidebar-layout.scss"), "utf8");

  assert.match(shellSource, /contentFullscreen=\{contentFullscreen\}/u);
  assert.match(shellSource, /onFullscreenToggle=\{toggleContentFullscreen\}/u);
  assert.doesNotMatch(shellSource, /contentFullscreen\s*\?\s*"content-fullscreen"/u);
  assert.doesNotMatch(sidebarStyles, /\.app-shell\.content-fullscreen/u);
});
