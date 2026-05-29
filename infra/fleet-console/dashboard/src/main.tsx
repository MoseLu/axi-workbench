import React from "react";
import ReactDOM from "react-dom/client";
import "@axi/tokens/css";
import "@axi/core/styles.css";
import "@axi/shell/styles.css";
import "@axi/crud/styles.css";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
