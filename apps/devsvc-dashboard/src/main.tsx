import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Adopt the workspace observability SDK for the webview side — see
// foundation/axi-observability/web for the installWeb contract.
const __axiIngestUrl =
  (import.meta.env.VITE_AXI_OBSERVABILITY_INGEST_URL as string | undefined) ??
  '/api/observability/ingest';
if (__axiIngestUrl) {
  void import('@axi/observability-web').then(({ installWeb }) => {
    installWeb({
      service: 'axi-devsvc-dashboard-web',
      env: (import.meta.env.MODE as string) || 'dev',
      ingestUrl: __axiIngestUrl,
    });
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

if (!normalizeLocalhostOrigin()) {
  const initialTheme = themePresets.find((item) => item.name === readStoredThemeName()) || themePresets[0];
  applyTheme(initialTheme, resolveThemeMode(readStoredThemeMode()));
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </React.StrictMode>
  );
}
