import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function extractCssBlock(source, selector) {
  const selectorIndex = source.indexOf(selector);
  assert.notEqual(selectorIndex, -1, `${selector} block should exist`);

  const openBraceIndex = source.indexOf("{", selectorIndex);
  assert.notEqual(openBraceIndex, -1, `${selector} block should open`);

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex + 1, index);
    }
  }

  assert.fail(`${selector} block should close`);
}

test("settings drawer opens without recoloring the page backdrop", async () => {
  const source = await readFile(path.join(projectRoot, "src", "styles", "breadcrumb-feed.scss"), "utf8");
  const layerBlock = extractCssBlock(source, ".theme-drawer-layer");

  assert.match(layerBlock, /background:\s*transparent;/u);
  assert.doesNotMatch(layerBlock, /var\(--modal-backdrop\)/u);
});

test("theme mode changes preclip root view-transition overlays", async () => {
  const themeStateSource = await readFile(path.join(projectRoot, "src", "features", "theme", "useThemeState.ts"), "utf8");
  const baseStylesSource = await readFile(path.join(projectRoot, "src", "styles", "tokens-base.scss"), "utf8");

  assert.match(themeStateSource, /startViewTransition/u);
  assert.match(themeStateSource, /dataset\.themeTransition/u);
  assert.match(themeStateSource, /--theme-transition-clip-start/u);
  assert.doesNotMatch(themeStateSource, /document\.documentElement\.animate|pseudoElement/u);
  assert.match(baseStylesSource, /:root\[data-theme-transition="to-light"\]::view-transition-new\(root\)/u);
  assert.match(baseStylesSource, /clip-path:\s*var\(--theme-transition-clip-start\);/u);
  assert.match(baseStylesSource, /animation-name:\s*theme-transition-reveal;/u);
  assert.match(baseStylesSource, /:root\[data-theme-transition="to-dark"\]::view-transition-old\(root\)/u);
  assert.match(baseStylesSource, /clip-path:\s*var\(--theme-transition-clip-end\);/u);
  assert.match(baseStylesSource, /animation-name:\s*theme-transition-conceal;/u);
});
