import { theme as AntTheme } from "antd";
import { createAxiAntdTheme } from "@axi/core";

import { antdModeTokens, type ThemeMode, type ThemePreset } from "../../theme/tokens";

/** Ant Design theme config handed to `ConfigProvider` by the shell entry. */
export function makeAntdShellThemeConfig(mode: ThemeMode, theme: ThemePreset, radius: number) {
  const modeTokens = antdModeTokens[mode];

  return {
    algorithm: mode === "dark" ? AntTheme.darkAlgorithm : AntTheme.defaultAlgorithm,
    ...createAxiAntdTheme(mode, theme, {
      borderRadius: Math.round(radius * 16),
      token: modeTokens
    })
  };
}
