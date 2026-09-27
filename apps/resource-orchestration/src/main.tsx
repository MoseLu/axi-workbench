import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.scss";

// Adopt the workspace observability SDK for the webview side — see
// foundation/axi-observability/web for the installWeb contract.
const __axiIngestUrl =
  (import.meta.env.VITE_AXI_OBSERVABILITY_INGEST_URL as string | undefined) ??
  '/api/observability/ingest';
if (__axiIngestUrl) {
  void import('@axi/observability-web').then(({ installWeb }) => {
    installWeb({
      service: 'axi-resource-orchestration-web',
      env: (import.meta.env.MODE as string) || 'dev',
      ingestUrl: __axiIngestUrl,
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
