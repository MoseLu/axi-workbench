import {
  apiContractVersion,
  type HttpEndpointDescriptor,
  type HttpEndpointRegistry,
  type HttpMethod,
  type HttpResponseDescriptor,
  buildHttpEndpointRegistry,
  httpEndpoints,
} from "@axi/gateway-contracts";
import { findRegisteredSchema, listRegisteredSchemas } from "./registry";

/**
 * GHA-082 — OpenAPI 3.1 document generator.
 *
 * The generator consumes the endpoint registry exported from
 * @axi/gateway-contracts and emits a stable OpenAPI 3.1 document.
 * The document is intentionally small:
 *
 *   - `openapi`            : pinned to "3.1.0"
 *   - `info`               : title, version (== apiContractVersion), description
 *   - `servers`            : caller-provided list (defaults to a single
 *                            relative URL when omitted)
 *   - `paths`              : one entry per registry endpoint, generated
 *                            from the descriptor
 *   - `components.schemas` : one entry per registered schema
 *
 * The generator never touches the network, never reads environment
 * variables, never imports HTTP frameworks, and never embeds provider
 * payloads, secrets, file paths, or query text. Tests assert each of
 * these constraints directly.
 */

export const OPENAPI_VERSION = "3.1.0" as const;

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiInfo {
  title: string;
  version: string;
  description: string;
  /** Contact / license blocks are intentionally omitted because they
   *  would require project-specific metadata we cannot hard-code. */
}

export interface OpenApiDocument {
  openapi: typeof OPENAPI_VERSION;
  info: OpenApiInfo;
  servers: ReadonlyArray<OpenApiServer>;
  paths: Record<string, PathItem>;
  components: {
    schemas: Record<string, Record<string, unknown>>;
  };
}

export interface PathItem {
  [method: string]: PathOperation | undefined;
}

export interface PathOperation {
  summary: string;
  description: string;
  tags: ReadonlyArray<string>;
  operationId: string;
  responses: Record<string, ResponseObject>;
  parameters?: ReadonlyArray<ParameterObject>;
  requestBody?: RequestBodyObject;
  /** Stable contract version pin; lets consumers pin a client to the
   *  specific contract generation that produced this document. */
  "x-api-contract-version": number;
}

export interface ParameterObject {
  name: string;
  in: "header" | "query" | "path";
  required: boolean;
  description: string;
  schema: Record<string, unknown>;
}

export interface RequestBodyObject {
  required: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface ResponseObject {
  description: string;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema: Record<string, unknown>;
}

export interface GenerateOpenApiOptions {
  /** Override the `info.title` field. Default: the project name. */
  title?: string;
  /** Override the `info.description` field. Default: stable text. */
  description?: string;
  /** Override the `servers` list. Default: a single relative `/` entry. */
  servers?: ReadonlyArray<OpenApiServer>;
  /** The endpoint registry to render. Default: the versioned
   *  `httpEndpoints` constant. */
  registry?: HttpEndpointRegistry;
}

const DEFAULT_INFO_TITLE = "Resource Broker Gateway";
const DEFAULT_INFO_DESCRIPTION =
  "Standalone HTTP gateway at apps/gateway. This document is generated " +
  "from packages/contracts/src/http-api.ts so the registry and the wire " +
  "shapes cannot drift.";

/**
 * Build the OpenAPI 3.1 document for the supplied registry.
 *
 * The output is JSON-serializable, deterministic for a given registry,
 * and contains no environment values. Callers may cache the result
 * and serve it from `/openapi.json` directly.
 */
export const generateOpenApiDocument = (
  options: GenerateOpenApiOptions = {},
): OpenApiDocument => {
  const registry = options.registry ?? buildHttpEndpointRegistry();
  const info = buildInfo(options);
  const servers = buildServers(options);
  const paths = buildPathsFromRegistry(registry.endpoints);
  const schemas = buildSchemas();
  return {
    openapi: OPENAPI_VERSION,
    info,
    servers,
    paths,
    components: { schemas },
  };
};

const buildInfo = (options: GenerateOpenApiOptions): OpenApiInfo => ({
  title: options.title ?? DEFAULT_INFO_TITLE,
  version: `v${apiContractVersion}`,
  description:
    options.description ?? DEFAULT_INFO_DESCRIPTION,
});

const buildServers = (
  options: GenerateOpenApiOptions,
): ReadonlyArray<OpenApiServer> => {
  if (options.servers && options.servers.length > 0) {
    return options.servers;
  }
  return [{ url: "/" }];
};

const buildSchemas = (): Record<string, Record<string, unknown>> => {
  const schemas: Record<string, Record<string, unknown>> = {};
  for (const entry of listRegisteredSchemas()) {
    schemas[entry.name] = entry.jsonSchema;
  }
  return schemas;
};

/** Map an HttpMethod to the lowercase OpenAPI key. */
const OPENAPI_METHOD_KEY: Readonly<Record<HttpMethod, string>> = {
  GET: "get",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
  DELETE: "delete",
};

const buildPathsFromRegistry = (
  endpoints: ReadonlyArray<HttpEndpointDescriptor>,
): Record<string, PathItem> => {
  const paths: Record<string, PathItem> = {};
  for (const endpoint of endpoints) {
    const methodKey = OPENAPI_METHOD_KEY[endpoint.method];
    const operation = buildOperation(endpoint);
    const existing = paths[endpoint.path] ?? {};
    paths[endpoint.path] = { ...existing, [methodKey]: operation };
  }
  return paths;
};

const buildOperation = (endpoint: HttpEndpointDescriptor): PathOperation => {
  const responses: Record<string, ResponseObject> = {};
  responses[String(endpoint.successStatus)] = buildSuccessResponse(endpoint.response);
  for (const errorStatus of endpoint.errorStatusCodes) {
    const key = String(errorStatus.status);
    const existing = responses[key];
    if (existing) {
      // Merge descriptions; content stays identical because every
      // error envelope is the same wire shape (ErrorEnvelope).
      responses[key] = {
        description: `${existing.description} | ${errorStatus.description}`,
        content: existing.content,
      };
    } else {
      responses[key] = buildErrorResponse(errorStatus.description);
    }
  }
  const operation: PathOperation = {
    summary: endpoint.summary,
    description: endpoint.description,
    tags: [...endpoint.tags],
    operationId: endpoint.id,
    responses,
    "x-api-contract-version": endpoint.contractVersion,
  };
  // Parameters come from header descriptors so the operation declares
  // any optional headers (e.g. X-Request-Id) consistently.
  const params = buildParameters(endpoint);
  if (params.length > 0) operation.parameters = params;
  if (endpoint.request) {
    operation.requestBody = buildRequestBody(endpoint.request);
  }
  return operation;
};

const buildSuccessResponse = (
  response: HttpResponseDescriptor,
): ResponseObject => {
  const schemaRef = schemaRefFor(response.schemaRef);
  const description = response.description;
  const content: Record<string, MediaTypeObject> = {};
  if (response.contentType === "text/html; charset=utf-8") {
    // The /docs endpoint serves HTML, not a JSON schema. Use a
    // minimal object placeholder so the document stays valid without
    // pretending the response body matches a business schema.
    content[response.contentType] = {
      schema: {
        type: "string",
        description: "Static HTML page; the schema is intentionally not modelled.",
      },
    };
  } else {
    content[response.contentType] = {
      schema: schemaRef === null
        ? { type: "object", description: "Untyped JSON payload." }
        : { $ref: `#/components/schemas/${schemaRef}` },
    };
  }
  return { description, content };
};

const buildErrorResponse = (description: string): ResponseObject => ({
  description,
  content: {
    "application/problem+json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorEnvelope" },
    },
  },
});

/** Resolve a `schemaRef` name into its registered schema name, if
 *  one exists. Some refs (notably "OpenApiDocument") deliberately do
 *  not have a JSON Schema entry; we fall back to null and let the
 *  caller decide whether to inline an opaque placeholder. */
const schemaRefFor = (ref: string): string | null => {
  const entry = findRegisteredSchema(ref);
  return entry === null ? null : ref;
};

const buildParameters = (
  endpoint: HttpEndpointDescriptor,
): ReadonlyArray<ParameterObject> => {
  const pathParameters = (endpoint.pathParameters ?? []).map((parameter) => ({
    name: parameter.name,
    in: "path" as const,
    required: true,
    description: parameter.description,
    schema: { type: "string" },
  }));
  const headerParameters = (endpoint.request?.headers ?? []).map((header) => ({
    name: header.name,
    in: "header" as const,
    required: header.required,
    description: header.description,
    schema: { type: "string" },
  }));
  return [...pathParameters, ...headerParameters];
};

const buildRequestBody = (
  request: NonNullable<HttpEndpointDescriptor["request"]>,
): RequestBodyObject => {
  const schemaRef = request.schemaRef ? schemaRefFor(request.schemaRef) : null;
  const schema = schemaRef === null
    ? { type: "object", description: "Request body schema not modelled." }
    : { $ref: `#/components/schemas/${schemaRef}` };
  return {
    required: request.required,
    content: {
      [request.contentType]: { schema },
    },
  };
};

/**
 * Cheap structural validator: confirms the document has the top-level
 * OpenAPI 3.1 keys we promise and that every `#/components/schemas/...`
 * reference points to a registered schema. Anything that would require
 * JSON Schema-aware validation should be delegated to a real OpenAPI
 * validator (Swagger Parser / Spectral); this function is intentionally
 * a quick smoke test that callers can run in tests.
 */
export interface OpenApiValidationIssue {
  path: string;
  message: string;
}

export const validateOpenApiDocument = (
  document: OpenApiDocument,
): { ok: true } | { ok: false; issues: ReadonlyArray<OpenApiValidationIssue> } => {
  const issues: OpenApiValidationIssue[] = [];
  if (document.openapi !== OPENAPI_VERSION) {
    issues.push({
      path: "/openapi",
      message: `expected "${OPENAPI_VERSION}", got "${document.openapi}"`,
    });
  }
  if (!document.info || typeof document.info.title !== "string" || document.info.title.length === 0) {
    issues.push({ path: "/info/title", message: "info.title is required" });
  }
  if (!document.info || typeof document.info.version !== "string" || !/^v\d+/.test(document.info.version)) {
    issues.push({ path: "/info/version", message: "info.version must match /^v\\d+/" });
  }
  if (!document.paths || typeof document.paths !== "object") {
    issues.push({ path: "/paths", message: "paths object is required" });
  } else {
    const registeredIds = new Set<string>(document.components?.schemas ? Object.keys(document.components.schemas) : []);
    const refs = collectRefs(document.paths);
    for (const ref of refs) {
        const match = ref.match(/^#\/components\/schemas\/([^/]+)$/);
        if (match && !registeredIds.has(match[1])) {
          issues.push({ path: ref, message: `dangling $ref to "${match[1]}" — not present in components.schemas` });
        }
      }
    }
  if (!document.servers || !Array.isArray(document.servers) || document.servers.length === 0) {
    issues.push({ path: "/servers", message: "at least one server entry is required" });
  }
  if (issues.length === 0) return { ok: true };
  return { ok: false, issues };
};

const collectRefs = (node: unknown): string[] => {
  const refs: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref" && typeof child === "string") refs.push(child);
        visit(child);
      }
    }
  };
  visit(node);
  return refs;
};
