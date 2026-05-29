import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("hosted iframes receive the shell theme contract", async () => {
  const hostedPageSource = await readFile(path.join(projectRoot, "src", "features", "hosted", "HostedAppPage.tsx"), "utf8");
  const themeStateSource = await readFile(path.join(projectRoot, "src", "features", "theme", "useThemeState.ts"), "utf8");
  const shellSource = await readFile(path.join(projectRoot, "src", "app-shell", "Shell.tsx"), "utf8");

  assert.match(themeStateSource, /export function applyThemeToElement/u);
  assert.match(themeStateSource, /root\.dataset\.axiTheme\s*=\s*theme\.name/u);
  assert.match(themeStateSource, /root\.style\.colorScheme\s*=\s*mode/u);
  assert.match(hostedPageSource, /const hostThemeEventName\s*=\s*"axi:host-theme-change"/u);
  assert.match(hostedPageSource, /writeHostedThemeStorage\(window\.localStorage,\s*appId,\s*themePayload\)/u);
  assert.match(hostedPageSource, /applyThemeToElement\(frameWindow\.document\.documentElement,\s*theme,\s*mode\)/u);
  assert.match(hostedPageSource, /CustomEventConstructor\(hostThemeEventName/u);
  assert.match(hostedPageSource, /onLoad=\{syncIframeTheme\}/u);
  assert.match(shellSource, /<HostedAppPage mode=\{themeState\.mode\} preference=\{themeState\.preference\} theme=\{themeState\.theme\}/u);
});
