import { createAxiAntdTheme } from "@axi/core";

import { antdModeTokens, type ThemeMode, type ThemePreset } from "../../theme/tokens";

/** Ant Design theme config handed to `ConfigProvider` by the shell entry.
 *
 * `createAxiAntdTheme` is now responsible for selecting the dark/light
 * algorithm, so callers should not patch the field manually — doing so
 * would override the token-aware algorithm and reintroduce the
 * dark-mode regression. */
export function makeAntdShellThemeConfig(mode: ThemeMode, theme: ThemePreset, radius: number) {
  const modeTokens = antdModeTokens[mode];

  return createAxiAntdTheme(mode, theme, {
    borderRadius: Math.round(radius * 16),
    token: modeTokens
  });
}
