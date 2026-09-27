/**
 * @axi/resource-api-docs
 *
 * Pure, framework-free OpenAPI 3.1 generator and human-readable
 * documentation renderer for the standalone gateway.
 *
 * Apps/gateway imports:
 *
 *   - `generateOpenApiDocument()` for the /openapi.json endpoint
 *   - `validateOpenApiDocument()` for a quick smoke check before
 *     serializing
 *   - `renderDocsHtml()` for the /docs page
 *
 * The package depends only on @axi/gateway-contracts (the
 * versioned endpoint registry) and zod (for the schema converter).
 * It does not touch the network, the filesystem, environment
 * variables, or HTTP frameworks.
 */

export {
  OPENAPI_VERSION,
  generateOpenApiDocument,
  validateOpenApiDocument,
  type GenerateOpenApiOptions,
  type MediaTypeObject,
  type OpenApiDocument,
  type OpenApiInfo,
  type OpenApiServer,
  type OpenApiValidationIssue,
  type ParameterObject,
  type PathItem,
  type PathOperation,
  type RequestBodyObject,
  type ResponseObject,
} from "./openapi";

export {
  listRegisteredSchemas,
  findRegisteredSchema,
  REGISTERED_SCHEMA_NAMES,
  type RegisteredSchema,
} from "./registry";

export {
  renderDocsHtml,
  type RenderDocsHtmlOptions,
} from "./docs-html";

export {
  convertSchema,
  type ConvertOptions,
} from "./zod-to-openapi";
