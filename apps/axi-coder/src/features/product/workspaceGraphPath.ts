import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
// axi-coder lives 7 levels below the workspace root in this layout:
//   <workspace-root>/workspace.graph.json
//   <workspace-root>/workbench/axi-workbench/apps/axi-coder/src/features/product/...
// The depth is annotated here so future maintainers can see exactly how many
// `..` segments to expect. Override via WORKSPACE_GRAPH_JSON for environments
// where the graph is mounted elsewhere (CI matrix, containerised runs).
const DEPTH_FROM_WORKSPACE_ROOT = "../../../../../../../workspace.graph.json";
const FALLBACK_GRAPH_URL = pathToFileURL(
  process.env.WORKSPACE_GRAPH_JSON ?? path.resolve(path.dirname(__filename), DEPTH_FROM_WORKSPACE_ROOT),
).href;

export const workspaceGraphUrl = FALLBACK_GRAPH_URL;