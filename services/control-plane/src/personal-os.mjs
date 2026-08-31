import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const PERSONAL_OS_CONTRACT_VERSION = 1;
export const PERSONAL_OS_STALLED_AFTER_DAYS = 14;
export const PERSONAL_OS_SNAPSHOT_STALE_AFTER_MS = 5 * 60 * 1000;
export const PERSONAL_OS_LIFECYCLES = ["exploration", "building", "stalled", "usable", "shipped", "archived"];
export const PERSONAL_OS_VIEWS = ["today", "in-progress", "stalled", "all"];

const DEFAULT_DEVSVC_OVERVIEW_URL = "http://127.0.0.1:17888/api/overview";
const PROJECT_PARTITIONS = new Map([
  ["projects", "projects"],
  ["products", "products"],
  ["shared", "shared"],
  ["infra", "infra"],
  ["tools", "tools"],
  ["references", "reference"],
]);

export class PersonalOsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PersonalOsValidationError";
    this.statusCode = 400;
    this.code = "invalid_request";
  }
}

export class PersonalOsNotFoundError extends Error {
  constructor(message = "personal OS project not found") {
    super(message);
    this.name = "PersonalOsNotFoundError";
    this.statusCode = 404;
    this.code = "not_found";
  }
}

export class PersonalOsConflictError extends Error {
  constructor(message, current) {
    super(message);
    this.name = "PersonalOsConflictError";
    this.statusCode = 409;
    this.code = "revision_conflict";
    this.current = current;
  }
}

export function createPersonalOsStore({ cacheDir, dbPath, now = () => new Date() } = {}) {
  if (!cacheDir && !dbPath) throw new PersonalOsValidationError("personal OS cache directory is required");
  const resolvedDbPath = dbPath || join(cacheDir, "personal-os.sqlite");
  mkdirSync(dirname(resolvedDbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolvedDbPath);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_overrides (
      project_id TEXT PRIMARY KEY,
      lifecycle_override TEXT CHECK (
        lifecycle_override IS NULL OR lifecycle_override IN ('exploration', 'building', 'stalled', 'usable', 'shipped', 'archived')
      ),
      finish_line TEXT NOT NULL DEFAULT '',
      uses_axi_ui INTEGER CHECK (uses_axi_ui IS NULL OR uses_axi_ui IN (0, 1)),
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS focus_state (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      project_id TEXT,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const migration = db.prepare("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1").get();
  if (!migration) {
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(1, now().toISOString());
  }

  function getProjectOverlay(projectId) {
    const row = db.prepare("SELECT project_id, lifecycle_override, finish_line, uses_axi_ui, revision, updated_at FROM project_overrides WHERE project_id = ?").get(projectId);
    return row ? overlayFromRow(row) : null;
  }

  function listProjectOverlays() {
    return db.prepare("SELECT project_id, lifecycle_override, finish_line, uses_axi_ui, revision, updated_at FROM project_overrides ORDER BY project_id").all().map(overlayFromRow);
  }

  function withWriteTransaction(callback) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Preserve the original validation or SQLite error.
      }
      throw error;
    }
  }

  function updateProjectOverlay({ projectId, lifecycleOverride, finishLine, usesAxiUi, revision }) {
    assertProjectId(projectId);
    assertRevision(revision);
    if (lifecycleOverride !== undefined && lifecycleOverride !== null && !PERSONAL_OS_LIFECYCLES.includes(lifecycleOverride)) {
      throw new PersonalOsValidationError(`unsupported lifecycle: ${lifecycleOverride}`);
    }
    if (finishLine !== undefined && typeof finishLine !== "string") {
      throw new PersonalOsValidationError("finishLine must be a string");
    }
    if (typeof finishLine === "string" && finishLine.trim().length > 500) {
      throw new PersonalOsValidationError("finishLine must be at most 500 characters");
    }
    if (usesAxiUi !== undefined && usesAxiUi !== null && typeof usesAxiUi !== "boolean") {
      throw new PersonalOsValidationError("usesAxiUi must be a boolean or null");
    }

    return withWriteTransaction(() => {
      const current = getProjectOverlay(projectId);
    const currentRevision = current?.revision || 0;
    if (revision !== currentRevision) {
      throw new PersonalOsConflictError("personal OS project overlay revision is stale", current || emptyOverlay(projectId));
    }
    const next = {
      projectId,
      lifecycleOverride: lifecycleOverride === undefined ? current?.lifecycleOverride || null : lifecycleOverride,
      finishLine: finishLine === undefined ? current?.finishLine || "" : finishLine.trim(),
      usesAxiUi: usesAxiUi === undefined ? current?.usesAxiUi ?? null : usesAxiUi,
      revision: currentRevision + 1,
      updatedAt: now().toISOString(),
    };
    if (next.lifecycleOverride === "building" && !next.finishLine) {
      throw new PersonalOsValidationError("building lifecycle requires a non-empty finishLine");
    }

    db.prepare(`
      INSERT INTO project_overrides (project_id, lifecycle_override, finish_line, uses_axi_ui, revision, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        lifecycle_override = excluded.lifecycle_override,
        finish_line = excluded.finish_line,
        uses_axi_ui = excluded.uses_axi_ui,
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).run(
      next.projectId,
      next.lifecycleOverride,
      next.finishLine,
      next.usesAxiUi === null ? null : next.usesAxiUi ? 1 : 0,
      next.revision,
      next.updatedAt,
    );
      return next;
    });
  }

  function getFocus() {
    const row = db.prepare("SELECT singleton, project_id, revision, updated_at FROM focus_state WHERE singleton = 1").get();
    if (!row) return { projectId: null, revision: 0, updatedAt: null };
    return {
      projectId: row.project_id || null,
      revision: Number(row.revision),
      updatedAt: row.updated_at,
    };
  }

  function updateFocus({ projectId = null, revision }) {
    if (projectId !== null) assertProjectId(projectId);
    assertRevision(revision);
    return withWriteTransaction(() => {
      const current = getFocus();
    if (revision !== current.revision) {
      throw new PersonalOsConflictError("personal OS focus revision is stale", current);
    }
    const next = {
      projectId,
      revision: current.revision + 1,
      updatedAt: now().toISOString(),
    };
    db.prepare(`
      INSERT INTO focus_state (singleton, project_id, revision, updated_at)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(singleton) DO UPDATE SET
        project_id = excluded.project_id,
        revision = excluded.revision,
        updated_at = excluded.updated_at
    `).run(next.projectId, next.revision, next.updatedAt);
      return next;
    });
  }

  return {
    dbPath: resolvedDbPath,
    getProjectOverlay,
    listProjectOverlays,
    updateProjectOverlay,
    getFocus,
    updateFocus,
    close: () => db.close(),
  };
}

export function createPersonalOsService({
  workspaceRoot,
  graphPath = workspaceRoot ? join(workspaceRoot, "workspace.graph.json") : undefined,
  cacheDir,
  dbPath,
  snapshotReader,
  runtimeReader,
  devsvcOverviewUrl = process.env.AXI_DEVSVC_OVERVIEW_URL || DEFAULT_DEVSVC_OVERVIEW_URL,
  fetchImpl = globalThis.fetch,
  stalledAfterDays = PERSONAL_OS_STALLED_AFTER_DAYS,
  now = () => new Date(),
  store = createPersonalOsStore({ cacheDir, dbPath, now }),
} = {}) {
  if (!workspaceRoot || !graphPath || typeof snapshotReader !== "function") {
    throw new PersonalOsValidationError("workspaceRoot, graphPath and snapshotReader are required");
  }

  async function getQueue({ view = "all", query = "", partition = "" } = {}) {
    assertView(view);
    const graph = readGraph(graphPath);
    const [snapshot, runtimeResult] = await Promise.all([
      snapshotReader(),
      runtimeReader ? runtimeReader() : readDevSvcOverview({ url: devsvcOverviewUrl, fetchImpl }),
    ]);
    const runtime = runtimeResult || { services: [], warnings: ["devsvc_unavailable"] };
    const overlays = new Map(store.listProjectOverlays().map((overlay) => [overlay.projectId, overlay]));
    const focus = store.getFocus();
    const items = Object.entries(graph.projects || {})
      .filter(([id, project]) => isPersonalOsProject({ id, project, workspaceRoot }))
      .map(([id, project]) => buildPersonalOsProjectItem({
        id,
        project,
        resource: findResource(snapshot, id),
        tasks: snapshot?.agentTasks || [],
        overlay: overlays.get(id) || emptyOverlay(id),
        focusProjectId: focus.projectId,
        runtimeServices: runtime.services || [],
        workspaceRoot,
        now,
        stalledAfterDays,
      }))
      .filter((item) => matchesQueue(item, { view, query, partition }))
      .sort(compareQueueItems({ view }));

    const warnings = projectionWarnings({ snapshot, runtimeResult: runtime, now: now() });
    return {
      contractVersion: PERSONAL_OS_CONTRACT_VERSION,
      generatedAt: now().toISOString(),
      source: {
        project: "workspace.graph",
        runtime: "devsvc",
        metadata: "personal-os.sqlite",
      },
      view,
      focusProjectId: focus.projectId,
      items,
      warnings,
    };
  }

  async function getProject(projectId) {
    assertProjectId(projectId);
    const queue = await getQueue({ view: "all" });
    const project = queue.items.find((item) => item.id === projectId);
    if (!project) throw new PersonalOsNotFoundError();
    return {
      contractVersion: PERSONAL_OS_CONTRACT_VERSION,
      generatedAt: queue.generatedAt,
      project,
      warnings: queue.warnings,
    };
  }

  async function updateProject(projectId, input = {}) {
    assertProjectId(projectId);
    assertPatchFields(input, ["lifecycleOverride", "finishLine", "usesAxiUi", "revision"]);
    await ensureVisibleProject(projectId);
    const overlay = store.updateProjectOverlay({ projectId, ...input });
    return {
      ...(await getProject(projectId)),
      overlay,
    };
  }

  async function getFocus() {
    const focus = store.getFocus();
    return {
      contractVersion: PERSONAL_OS_CONTRACT_VERSION,
      generatedAt: now().toISOString(),
      focus,
      warnings: [],
    };
  }

  async function updateFocus({ projectId = null, revision } = {}) {
    if (projectId !== null) await ensureVisibleProject(projectId);
    const focus = store.updateFocus({ projectId, revision });
    return {
      ...(await getFocus()),
      focus,
    };
  }

  async function ensureVisibleProject(projectId) {
    const graph = readGraph(graphPath);
    const project = graph.projects?.[projectId];
    if (!project || !isPersonalOsProject({ id: projectId, project, workspaceRoot })) {
      throw new PersonalOsNotFoundError();
    }
  }

  return {
    getQueue,
    getProject,
    updateProject,
    getFocus,
    updateFocus,
    close: store.close,
    store,
  };
}

export async function readDevSvcOverview({ url = DEFAULT_DEVSVC_OVERVIEW_URL, fetchImpl = globalThis.fetch, timeoutMs = 800 } = {}) {
  if (typeof fetchImpl !== "function") return { services: [], warnings: ["devsvc_unavailable"] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers: { accept: "application/json" }, signal: controller.signal });
    if (!response.ok) return { services: [], warnings: [`devsvc_http_${response.status}`] };
    const body = await response.json();
    return {
      services: Array.isArray(body?.services) ? body.services : [],
      warnings: [],
      checkedAt: body?.generatedAt || null,
    };
  } catch {
    return { services: [], warnings: ["devsvc_unavailable"] };
  } finally {
    clearTimeout(timer);
  }
}

export function buildPersonalOsProjectItem({
  id,
  project = {},
  resource,
  tasks = [],
  overlay = emptyOverlay(id),
  focusProjectId = null,
  runtimeServices = [],
  workspaceRoot,
  now = () => new Date(),
  stalledAfterDays = PERSONAL_OS_STALLED_AFTER_DAYS,
} = {}) {
  const path = typeof project.path === "string" && project.path ? project.path : resource?.path || "";
  const projectTasks = tasks
    .filter((task) => task?.targetId === id || task?.projectId === id)
    .map(agentRunSummary)
    .sort((left, right) => dateEpoch(right.updatedAt) - dateEpoch(left.updatedAt));
  const git = resource?.metadata?.git || null;
  const lastCommitAt = typeof git?.lastCommitAt === "string" ? git.lastCommitAt : null;
  const lastAgentRunAt = projectTasks.map((task) => task.updatedAt).find(Boolean) || null;
  const lastActivityAt = latestDate([lastCommitAt, lastAgentRunAt]);
  const lifecycle = deriveLifecycle({
    lifecycleOverride: overlay.lifecycleOverride,
    finishLine: overlay.finishLine,
    lastActivityAt,
    now: now(),
    stalledAfterDays,
  });
  const runtime = deriveRuntimeState({ projectPath: path, services: runtimeServices, workspaceRoot });
  const usesAxiUi = overlay.usesAxiUi ?? (Array.isArray(project.consumes) && project.consumes.includes("axi-ui"));
  return {
    id,
    name: project.name || resource?.name || id,
    path,
    partition: partitionForPath(path, workspaceRoot),
    role: project.role || project.kind || "project",
    summary: project.description || resource?.metadata?.focus || resource?.kind || "尚未提供项目摘要。",
    status: resource?.status || "unknown",
    lifecycle: lifecycle.value,
    lifecycleSource: lifecycle.source,
    overlay,
    finishLine: overlay.finishLine || "",
    usesAxiUi,
    focus: focusProjectId === id,
    runtime,
    activity: {
      lastCommitAt,
      lastAgentRunAt,
      lastActivityAt,
      changedEntries: Number.isFinite(git?.changedEntries) ? git.changedEntries : 0,
      clean: typeof git?.clean === "boolean" ? git.clean : null,
    },
    recentAgentRuns: projectTasks.slice(0, 5),
    relationships: {
      provides: strings(project.provides || resource?.provides),
      consumes: strings(project.consumes || resource?.consumes),
      consumers: strings(resource?.metadata?.consumers),
    },
    source: {
      project: "workspace.graph",
      runtime: "devsvc",
      metadata: "personal-os.sqlite",
    },
  };
}

export function deriveLifecycle({ lifecycleOverride, finishLine = "", lastActivityAt, now = new Date(), stalledAfterDays = PERSONAL_OS_STALLED_AFTER_DAYS } = {}) {
  if (lifecycleOverride) return { value: lifecycleOverride, source: "manual" };
  if (!finishLine || !lastActivityAt) return { value: "exploration", source: "derived" };
  const age = dateEpoch(now) - dateEpoch(lastActivityAt);
  if (age > stalledAfterDays * 24 * 60 * 60 * 1000) return { value: "stalled", source: "derived" };
  return { value: "building", source: "derived" };
}

export function deriveRuntimeState({ projectPath = "", services = [], workspaceRoot = "" } = {}) {
  const normalizedProjectPath = normalizePath(projectPath, workspaceRoot);
  const matched = services.filter((service) => {
    const cwd = normalizePath(service?.cwd, workspaceRoot);
    return normalizedProjectPath && cwd && (cwd === normalizedProjectPath || cwd.startsWith(`${normalizedProjectPath}/`));
  });
  if (!matched.length) {
    return { state: "unknown", registered: false, serviceIds: [], summary: "未登记 DevSvc 运行服务。" };
  }
  const online = matched.filter((service) => service?.pm2?.status === "online");
  const healthy = matched.filter((service) => service?.pm2?.status === "online" && service?.health?.ok === true);
  const state = online.length === 0 ? "stopped" : healthy.length === matched.length ? "running" : "unhealthy";
  return {
    state,
    registered: true,
    serviceIds: matched.map((service) => service.id).filter(Boolean),
    summary: matched.map((service) => service.id).filter(Boolean).join("、"),
    checkedAt: matched.map((service) => service.health?.checkedAt).find(Boolean) || null,
  };
}

function readGraph(graphPath) {
  try {
    const parsed = JSON.parse(readFileSync(graphPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : { projects: {} };
  } catch {
    return { projects: {} };
  }
}

function projectionWarnings({ snapshot, runtimeResult, now: currentTime }) {
  const warnings = Array.isArray(runtimeResult?.warnings) ? [...runtimeResult.warnings] : [];
  const generatedAt = dateEpoch(snapshot?.generatedAt);
  const currentEpoch = dateEpoch(currentTime);
  if (Number.isFinite(generatedAt) && Number.isFinite(currentEpoch)
    && currentEpoch - generatedAt > PERSONAL_OS_SNAPSHOT_STALE_AFTER_MS) {
    warnings.push("control_plane_snapshot_stale");
  }
  return [...new Set(warnings)];
}

function findResource(snapshot, id) {
  return (snapshot?.resources || []).find((resource) => resource.id === id)
    || (snapshot?.axiResources?.project || []).find((resource) => resource.ownerId === id || resource.resourceId === id)
    || null;
}

function isPersonalOsProject({ id, project = {}, workspaceRoot }) {
  const relativePath = project.path
    ? relative(workspaceRoot, resolve(workspaceRoot, project.path)).replaceAll("\\", "/")
    : "";
  const kind = String(project.kind || "").toLowerCase();
  const lifecycle = String(project.lifecycle || "").toLowerCase();
  if (relativePath === "" || relativePath === ".") return false;
  if (relativePath.split("/")[0] === "references") return false;
  if (project.external === true || lifecycle === "legacy-reference" || lifecycle === "external-infra") return false;
  if (kind.includes("reference") || kind.includes("workspace-anchor") || kind.includes("contract-placeholder")) return false;
  return Boolean(id);
}

function matchesQueue(item, { view, query, partition }) {
  if (partition && item.partition !== partition) return false;
  const activeRun = item.recentAgentRuns.some((run) => ["queued", "running", "awaiting_approval"].includes(run.status));
  if (view === "today" && !item.focus && !activeRun && item.lifecycle !== "stalled") return false;
  if (view === "in-progress" && item.lifecycle !== "building" && !activeRun) return false;
  if (view === "stalled" && item.lifecycle !== "stalled") return false;
  const normalized = String(query || "").trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return true;
  return [item.id, item.name, item.path, item.partition, item.role, item.summary, item.finishLine]
    .join(" ")
    .toLocaleLowerCase("zh-CN")
    .includes(normalized);
}

function compareQueueItems({ view }) {
  return (left, right) => {
    if (view === "today") {
      const leftRank = left.focus ? 0 : left.lifecycle === "stalled" ? 1 : 2;
      const rightRank = right.focus ? 0 : right.lifecycle === "stalled" ? 1 : 2;
      if (leftRank !== rightRank) return leftRank - rightRank;
    }
    return left.name.localeCompare(right.name, "zh-CN");
  };
}

function agentRunSummary(task) {
  return {
    id: task.id || task.jobId || "unknown-run",
    projectId: task.targetId || task.projectId || null,
    status: task.status || "queued",
    runtime: task.runtime || "unknown",
    summary: task.summary || "受管任务无摘要。",
    createdAt: task.createdAt || null,
    startedAt: task.startedAt || null,
    completedAt: task.completedAt || null,
    updatedAt: task.completedAt || task.startedAt || task.createdAt || null,
    source: "control-plane.agent-task",
  };
}

function emptyOverlay(projectId) {
  return {
    projectId,
    lifecycleOverride: null,
    finishLine: "",
    usesAxiUi: null,
    revision: 0,
    updatedAt: null,
  };
}

function overlayFromRow(row) {
  return {
    projectId: row.project_id,
    lifecycleOverride: row.lifecycle_override || null,
    finishLine: row.finish_line || "",
    usesAxiUi: row.uses_axi_ui === null || row.uses_axi_ui === undefined ? null : Boolean(row.uses_axi_ui),
    revision: Number(row.revision),
    updatedAt: row.updated_at,
  };
}

function partitionForPath(projectPath, workspaceRoot) {
  const relativePath = projectPath ? relative(workspaceRoot, resolve(projectPath)).replaceAll("\\", "/") : "";
  return PROJECT_PARTITIONS.get(relativePath.split("/")[0]) || "other";
}

function normalizePath(value, workspaceRoot) {
  if (typeof value !== "string" || !value.trim()) return "";
  return resolve(workspaceRoot, value).replaceAll("\\", "/").replace(/\/$/u, "");
}

function latestDate(values) {
  return values.filter((value) => Number.isFinite(dateEpoch(value))).sort((left, right) => dateEpoch(right) - dateEpoch(left))[0] || null;
}

function dateEpoch(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== "string" || !value) return Number.NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function strings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function assertProjectId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 200 || value.includes("/")) {
    throw new PersonalOsValidationError("projectId must be a non-empty project identifier");
  }
}

function assertRevision(value) {
  if (!Number.isInteger(value) || value < 0) throw new PersonalOsValidationError("revision must be a non-negative integer");
}

function assertView(value) {
  if (!PERSONAL_OS_VIEWS.includes(value)) throw new PersonalOsValidationError(`unsupported personal OS view: ${value}`);
}

function assertPatchFields(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PersonalOsValidationError("request body must be a JSON object");
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new PersonalOsValidationError(`unsupported personal OS field(s): ${unknown.join(", ")}`);
}
