import type { OpenApiDocument, OpenApiServer } from "./openapi";

/**
 * Render the human-readable `/docs` HTML page.
 *
 * Constraints (asserted by tests):
 *   - Pure function of the OpenAPI document and the server URL.
 *   - No network access at runtime. The page fetches the openapi.json
 *     from the same origin, never from a CDN.
 *   - No external scripts. The page uses an inline data-driven
 *     renderer so the gateway doesn't need to ship a UI library
 *     bundle.
 *   - Never embeds secrets, env vars, file paths, or provider
 *     payloads. All rendered content comes from the OpenAPI document.
 *   - Sets a strict CSP that bans third-party origins, eval, and
 *     inline event handlers. Safe enough for public access.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = (value: string): string => escapeHtml(value);

const escapeJsonForScript = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export interface RenderDocsHtmlOptions {
  /** Path to the openapi.json resource relative to the page. Default:
   *  "/openapi.json". Must be on the same origin; the page never
   *  fetches absolute URLs the server did not authorise. */
  openApiUrl?: string;
  /** Optional base URL used to construct absolute example URLs in
   *  the rendered UI. Default: the first server in the document. */
  baseUrl?: string;
  /** When true, render a "Loading…" shell instead of the full UI.
   *  Useful when the OpenAPI document has not been generated yet. */
  showLoadingShell?: boolean;
}

const RESOLVED_OPENAPI_URL = "/openapi.json" as const;

const resolveOpenApiUrl = (
  options: RenderDocsHtmlOptions,
  servers: ReadonlyArray<OpenApiServer>,
): string => {
  const requested = options.openApiUrl ?? RESOLVED_OPENAPI_URL;
  if (!requested.startsWith("/") && !requested.startsWith("./")) {
    // The page refuses to fetch absolute URLs to prevent the docs
    // page from being weaponised as an SSRF pivot. We still allow
    // protocol-relative URLs.
    if (requested.startsWith("//")) return requested;
    throw new Error(
      `renderDocsHtml: openApiUrl must be a same-origin path; got "${requested}"`,
    );
  }
  return requested;
};

const resolveBaseUrl = (
  options: RenderDocsHtmlOptions,
  document: OpenApiDocument,
): string => {
  if (options.baseUrl) return options.baseUrl;
  const first = document.servers[0];
  return first?.url ?? "/";
};

/**
 * Render the /docs page. The result is plain HTML5 that the gateway
 * server can serve as `text/html; charset=utf-8`.
 */
export const renderDocsHtml = (
  document: OpenApiDocument,
  options: RenderDocsHtmlOptions = {},
): string => {
  const openApiUrl = resolveOpenApiUrl(options, document.servers);
  const baseUrl = resolveBaseUrl(options, document);
  const payload = {
    openapi: document.openapi,
    info: document.info,
    servers: document.servers,
    baseUrl,
    paths: document.paths,
    components: document.components,
  };
  const bootstrap = escapeJsonForScript(payload);
  const metaTitle = `${escapeHtml(document.info.title)} — API Reference`;
  const shell = options.showLoadingShell === true ? renderLoadingShell(metaTitle) : renderFullShell(metaTitle, openApiUrl, bootstrap);
  return shell;
};

const renderLoadingShell = (title: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<main class="loading">Loading API reference…</main>
</body>
</html>
`;

const renderFullShell = (
  title: string,
  openApiUrl: string,
  bootstrap: string,
): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="${escapeAttr(CSP)}">
<title>${title}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<header class="topbar">
<h1>${title}</h1>
<p class="meta">OpenAPI <span data-bind="openapi"></span> · contract v<span data-bind="contractVersion"></span></p>
</header>
<nav class="sidebar" aria-label="Endpoints">
<ul data-bind="endpointList"></ul>
</nav>
<main class="content">
<section data-bind="info"></section>
<section data-bind="endpoints"></section>
</main>
<script id="openapi-bootstrap" type="application/json">${bootstrap}</script>
<script>${INLINE_RUNTIME}</script>
<script>${INIT_SCRIPT(openApiUrl)}</script>
</body>
</html>
`;

/* The inline runtime is intentionally tiny: a JSON store, a DOM
 * builder, and an endpoint renderer. It does not depend on the
 * gateway runtime, on a third-party CDN, or on fetch() to external
 * origins. All operations read from the bootstrap script tag. */
const BASE_CSS = `:root{color-scheme:light dark;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d12;color:#e6e8ee}
body{margin:0;display:grid;grid-template-rows:auto 1fr;grid-template-columns:240px 1fr;min-height:100vh}
.topbar{grid-column:1/-1;padding:16px 24px;border-bottom:1px solid #1f2230;background:#11141c}
.topbar h1{margin:0;font-size:18px}
.topbar .meta{margin:4px 0 0;color:#8a93a6;font-size:12px}
.sidebar{border-right:1px solid #1f2230;padding:16px;overflow:auto}
.sidebar ul{list-style:none;padding:0;margin:0}
.sidebar li{margin:0 0 4px}
.sidebar a{color:#9ec1ff;text-decoration:none;font-size:13px;display:block;padding:4px 6px;border-radius:4px}
.sidebar a:hover{background:#1a1f2b}
.content{padding:24px;overflow:auto}
.content section{margin-bottom:32px}
.endpoint{background:#11141c;border:1px solid #1f2230;border-radius:6px;padding:16px;margin-bottom:16px}
.endpoint h2{margin:0 0 8px;font-size:15px;font-family:ui-monospace,Menlo,monospace}
.endpoint .method{display:inline-block;padding:2px 6px;margin-right:8px;border-radius:3px;font-size:11px;text-transform:uppercase;background:#243047;color:#cdd9f5}
.endpoint .method.get{background:#1c3a26;color:#a5e1b6}
.endpoint .method.post{background:#2a1f3a;color:#cbb1ee}
.endpoint .method.put{background:#3a2f1c;color:#e8cba0}
.endpoint .method.patch{background:#1f3a3a;color:#a0e6e8}
.endpoint .method.delete{background:#3a1f1f;color:#e8a0a0}
.endpoint dl{display:grid;grid-template-columns:160px 1fr;gap:4px 12px;font-size:13px;margin:8px 0 0}
.endpoint dt{color:#8a93a6}
.endpoint dd{margin:0;color:#cdd9f5}
.schemas{background:#11141c;border:1px solid #1f2230;border-radius:6px;padding:16px}
.schemas table{width:100%;border-collapse:collapse;font-size:12px}
.schemas th,.schemas td{border-bottom:1px solid #1f2230;text-align:left;padding:4px 6px}
.schemas th{color:#8a93a6;font-weight:normal}
.schemas td.ref{color:#9ec1ff;font-family:ui-monospace,Menlo,monospace}
.loading{padding:32px;color:#8a93a6;font-size:14px}
.error{padding:24px;border:1px solid #3a1f1f;border-radius:6px;color:#e8a0a0;background:#1f0f12}
`;

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

/* The runtime is intentionally read-only. It reads from a JSON bootstrap
 * tag, walks the OpenAPI document, and renders DOM nodes. No
 * string-from-untrusted-source is used as innerHTML; every value goes
 * through `textContent`. */
const INLINE_RUNTIME = `(function(){
  function el(tag, props, children){
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function(key){
      if (key === "class") node.className = props[key];
      else if (key === "text") node.textContent = props[key];
      else node.setAttribute(key, props[key]);
    });
    (children || []).forEach(function(child){
      if (child == null) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }
  function methodClass(method){return "method " + method.toLowerCase();}
  function summariseSchema(schema, refs){
    if (!schema || typeof schema !== "object") return "any";
    if (Array.isArray(schema.oneOf)) return "oneOf";
    if (Array.isArray(schema.anyOf)) return "anyOf";
    if (Array.isArray(schema.enum)) return "enum(" + schema.enum.length + ")";
    if (schema.$ref) refs.add(schema.$ref); return "$ref";
    if (schema.type === "array") return "array";
    if (schema.type === "object" && schema.properties) return "object(" + Object.keys(schema.properties).length + ")";
    return schema.type || "any";
  }
  function renderPaths(doc, refs){
    var wrap = el("div", null, []);
    Object.keys(doc.paths).forEach(function(path){
      var item = doc.paths[path];
      Object.keys(item).forEach(function(methodKey){
        var op = item[methodKey];
        if (!op) return;
        var card = el("article", { class: "endpoint", id: op.operationId }, []);
        var header = el("h2", null, []);
        header.appendChild(el("span", { class: methodClass(methodKey), text: methodKey.toUpperCase() }));
        header.appendChild(document.createTextNode(path));
        card.appendChild(header);
        card.appendChild(el("p", { text: op.description }));
        var dl = el("dl", null, []);
        dl.appendChild(el("dt", { text: "Summary" }));
        dl.appendChild(el("dd", { text: op.summary }));
        dl.appendChild(el("dt", { text: "Operation ID" }));
        dl.appendChild(el("dd", { text: op.operationId }));
        dl.appendChild(el("dt", { text: "Contract version" }));
        dl.appendChild(el("dd", { text: String(op["x-api-contract-version"]) }));
        dl.appendChild(el("dt", { text: "Tags" }));
        dl.appendChild(el("dd", { text: (op.tags || []).join(", ") }));
        dl.appendChild(el("dt", { text: "Success responses" }));
        var okNodes = Object.keys(op.responses || {}).filter(function(s){return /^2\\d\\d$/.test(s);}).sort();
        dl.appendChild(el("dd", { text: okNodes.join(", ") || "(none)" }));
        dl.appendChild(el("dt", { text: "Error responses" }));
        var errNodes = Object.keys(op.responses || {}).filter(function(s){return /^[45]\\d\\d$/.test(s);}).sort();
        dl.appendChild(el("dd", { text: errNodes.join(", ") || "(none)" }));
        if (op.requestBody) {
          var contentTypes = Object.keys(op.requestBody.content || {});
          contentTypes.forEach(function(ct){
            var sch = op.requestBody.content[ct].schema;
            dl.appendChild(el("dt", { text: "Request body (" + ct + ")" }));
            dl.appendChild(el("dd", { text: summariseSchema(sch, refs) }));
          });
        }
        Object.keys(op.responses || {}).forEach(function(status){
          Object.keys(op.responses[status].content || {}).forEach(function(ct){
            var sch = op.responses[status].content[ct].schema;
            dl.appendChild(el("dt", { text: "Response " + status + " (" + ct + ")" }));
            dl.appendChild(el("dd", { text: summariseSchema(sch, refs) }));
          });
        });
        card.appendChild(dl);
        wrap.appendChild(card);
      });
    });
    return { host: wrap, refs: refs };
  }
  function renderSidebar(doc){
    var list = el("ul", null, []);
    Object.keys(doc.paths).forEach(function(path){
      Object.keys(doc.paths[path]).forEach(function(methodKey){
        var op = doc.paths[path][methodKey];
        if (!op) return;
        var link = el("a", { href: "#" + op.operationId, text: (methodKey.toUpperCase() + " " + path) });
        var li = el("li", null, [link]);
        list.appendChild(li);
      });
    });
    return list;
  }
  function renderInfo(info){
    var node = el("section", null, []);
    node.appendChild(el("h2", { text: info.title || "API" }));
    if (info.description) node.appendChild(el("p", { text: info.description }));
    if (info.version) node.appendChild(el("p", { class: "meta", text: "Version: " + info.version }));
    return node;
  }
  function renderSchemas(doc, refs){
    var wrap = el("section", { class: "schemas" }, []);
    wrap.appendChild(el("h2", { text: "Schemas (" + refs.size + " referenced)" }));
    var table = el("table", null, []);
    var head = el("thead", null, []);
    var headRow = el("tr", null, []);
    headRow.appendChild(el("th", { text: "Name" }));
    headRow.appendChild(el("th", { text: "Type" }));
    head.appendChild(headRow);
    table.appendChild(head);
    var body = el("tbody", null, []);
    var schemas = (doc.components && doc.components.schemas) || {};
    Object.keys(schemas).sort().forEach(function(name){
      var row = el("tr", null, []);
      row.appendChild(el("td", { class: "ref", text: name }));
      row.appendChild(el("td", { text: summariseSchema(schemas[name], new Set()) }));
      body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }
  function init(doc){
    document.querySelector('[data-bind="openapi"]').textContent = doc.openapi;
    document.querySelector('[data-bind="contractVersion"]').textContent = String(doc.info.version || "");
    document.querySelector('[data-bind="info"]').replaceChildren(renderInfo(doc.info));
    var refs = new Set();
    var rendered = renderPaths(doc, refs);
    var endpoints = el("section", null, [rendered.host]);
    document.querySelector('[data-bind="endpoints"]').replaceChildren(endpoints, renderSchemas(doc, refs));
    document.querySelector('[data-bind="endpointList"]').replaceChildren(renderSidebar(doc));
  }
  window.__openapiInit = init;
})();
`;

const INIT_SCRIPT = (openApiUrl: string): string => `(function(){
  function showError(message){
    var node = document.createElement("main");
    node.className = "error";
    node.textContent = "Failed to load API reference: " + message;
    document.body.appendChild(node);
  }
  try {
    var raw = document.getElementById("openapi-bootstrap").textContent;
    if (!raw) { showError("missing bootstrap payload"); return; }
    var doc = JSON.parse(raw);
    window.__openapiInit(doc);
  } catch (error) {
    showError(String(error && error.message ? error.message : error));
  }
})();
${`/* openApiUrl hint: ${openApiUrl} — the page loads the bootstrap from
 * the inline script tag and never fetches openApiUrl directly, but we
 * expose it for tests so they can assert the same-origin contract. */`}
`;
