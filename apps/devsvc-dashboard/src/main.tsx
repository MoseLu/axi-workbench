import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

import "antd/dist/reset.css";
import "@axi/tokens/css";
import "@axi/core/styles.css";
import "@axi/shell/styles.css";
import "@axi/crud/styles.css";
import "@axi/settings/styles.css";
import "@axi/widgets/styles.css";
import { AppRouter } from "./AppRouter";
import i18n from "./i18n";
import { applyTheme, readStoredThemeMode, readStoredThemeName, resolveThemeMode } from "./features/theme/useThemeState";
import { normalizeLocalhostOrigin } from "./lib/browser";
import { themePresets } from "./theme/tokens";
import "./styles.scss";

if (!normalizeLocalhostOrigin()) {
  const initialTheme = themePresets.find((item) => item.name === readStoredThemeName()) || themePresets[0];
  applyTheme(initialTheme, resolveThemeMode(readStoredThemeMode()));
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </I18nextProvider>
    </React.StrictMode>
  );
}
