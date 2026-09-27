import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/app.css";

// Adopt the workspace observability SDK for the webview side — see
// foundation/axi-observability/web for the installWeb contract.
const __axiIngestUrl =
  (import.meta.env.VITE_AXI_OBSERVABILITY_INGEST_URL as string | undefined) ??
  '/api/observability/ingest';
if (__axiIngestUrl) {
  void import('@axi/observability-web').then(({ installWeb }) => {
    installWeb({
      service: 'axi-verification-inbox-web',
      env: (import.meta.env.MODE as string) || 'dev',
      ingestUrl: __axiIngestUrl,
    });
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
