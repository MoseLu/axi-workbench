import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createPersonalOsService,
  createPersonalOsStore,
  deriveLifecycle,
  deriveRuntimeState,
} from "../src/personal-os.mjs";

const NOW = () => new Date("2026-09-01T00:00:00.000Z");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "axi-personal-os-"));
  const projects = {
    "sample-app": {
      name: "示例应用",
      kind: "product",
      path: join(root, "products", "sample-app"),
      consumes: ["axi-ui"],
      provides: ["sample-capability"],
    },
    "stale-app": {
      name: "停滞应用",
      kind: "product",
      path: join(root, "projects", "stale-app"),
    },
    "reference-app": {
      name: "参考项目",
      kind: "reference-project",
      lifecycle: "legacy-reference",
      path: join(root, "references", "reference-app"),
    },
  };
  for (const project of Object.values(projects)) mkdirSync(project.path, { recursive: true });
  const graphPath = join(root, "workspace.graph.json");
  writeFileSync(graphPath, JSON.stringify({ projects }));
  const snapshot = {
    resources: [
      {
        id: "sample-app",
        name: "示例应用",
        layer: "software",
        kind: "product",
        path: projects["sample-app"].path,
        status: "available",
        provides: ["sample-capability"],
        consumes: ["axi-ui"],
        metadata: {
          git: { branch: "dev", changedEntries: 1, clean: false, lastCommitAt: "2026-08-31T00:00:00.000Z" },
          consumers: ["sample-consumer"],
          focus: "示例应用摘要",
        },
      },
      {
        id: "stale-app",
        name: "停滞应用",
        layer: "software",
        kind: "product",
        path: projects["stale-app"].path,
        status: "available",
        metadata: {
          git: { branch: "dev", changedEntries: 0, clean: true, lastCommitAt: "2026-08-01T00:00:00.000Z" },
        },
      },
      {
        id: "reference-app",
        name: "参考项目",
        layer: "software",
        kind: "reference-project",
        path: projects["reference-app"].path,
        status: "available",
        metadata: { git: null },
      },
    ],
    agentTasks: [
      {
        id: "task-1",
        targetId: "sample-app",
        runtime: "codex_cli",
        status: "running",
        prompt: "private prompt must not be projected",
        cwd: projects["sample-app"].path,
        summary: "正在处理示例应用",
        createdAt: "2026-08-31T12:00:00.000Z",
        startedAt: "2026-08-31T12:01:00.000Z",
      },
    ],
  };
  const runtimeServices = [{
    id: "sample-app-web",
    cwd: projects["sample-app"].path,
    pm2: { status: "online" },
    health: { ok: true, checkedAt: "2026-09-01T00:00:00.000Z" },
  }];
  const service = createPersonalOsService({
    workspaceRoot: root,
    graphPath,
    cacheDir: join(root, ".cache"),
    snapshotReader: () => snapshot,
    runtimeReader: async () => ({ services: runtimeServices, warnings: [] }),
    now: NOW,
  });
  return { root, service };
}

test("Personal OS queue excludes references and projects runtime, activity and AgentRun summaries", async () => {
  const { service } = fixture();
  const queue = await service.getQueue({ view: "all" });

  assert.equal(queue.contractVersion, 1);
  assert.deepEqual(queue.items.map((item) => item.id), ["sample-app", "stale-app"]);
  const sample = queue.items.find((item) => item.id === "sample-app");
  assert.equal(sample.lifecycle, "exploration");
  assert.equal(sample.runtime.state, "running");
  assert.equal(sample.runtime.registered, true);
  assert.equal(sample.activity.changedEntries, 1);
  assert.equal(sample.recentAgentRuns[0].status, "running");
  assert.equal(sample.recentAgentRuns[0].summary, "正在处理示例应用");
  assert.equal(Object.hasOwn(sample.recentAgentRuns[0], "prompt"), false);
  assert.equal(Object.hasOwn(sample.recentAgentRuns[0], "cwd"), false);
  assert.equal(sample.usesAxiUi, true);
  service.close();
});

test("lifecycle derives building and stalled only after a finishLine, while manual values win", () => {
  assert.deepEqual(deriveLifecycle({ finishLine: "", lastActivityAt: "2026-08-31T00:00:00.000Z", now: NOW() }), { value: "exploration", source: "derived" });
  assert.deepEqual(deriveLifecycle({ finishLine: "完成主流程", lastActivityAt: "2026-08-31T00:00:00.000Z", now: NOW() }), { value: "building", source: "derived" });
  assert.deepEqual(deriveLifecycle({ finishLine: "完成主流程", lastActivityAt: "2026-08-01T00:00:00.000Z", now: NOW() }), { value: "stalled", source: "derived" });
  assert.deepEqual(deriveLifecycle({ lifecycleOverride: "usable", finishLine: "", now: NOW() }), { value: "usable", source: "manual" });
});

test("overlay rejects building without finishLine and persists with optimistic revisions", async () => {
  const { service } = fixture();
  await assert.rejects(
    service.updateProject("sample-app", { lifecycleOverride: "building", revision: 0 }),
    (error) => error.code === "invalid_request" && /finishLine/.test(error.message),
  );
  const updated = await service.updateProject("sample-app", {
    lifecycleOverride: "building",
    finishLine: "完成示例应用主流程",
    revision: 0,
  });
  assert.equal(updated.overlay.revision, 1);
  assert.equal(updated.project.lifecycle, "building");
  await assert.rejects(
    service.updateProject("sample-app", { finishLine: "过期写入", revision: 0 }),
    (error) => error.code === "revision_conflict" && error.statusCode === 409 && error.current.revision === 1,
  );
  service.close();
});

test("overlay finishLine survives a new control-plane store instance", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-personal-os-restart-"));
  const dbPath = join(root, ".cache", "personal-os.sqlite");
  const first = createPersonalOsStore({ dbPath, now: NOW });
  const updated = first.updateProjectOverlay({
    projectId: "sample-app",
    lifecycleOverride: "building",
    finishLine: "重启后仍保留",
    revision: 0,
  });
  assert.equal(updated.revision, 1);
  first.close();

  const restarted = createPersonalOsStore({ dbPath, now: NOW });
  assert.deepEqual(restarted.getProjectOverlay("sample-app"), {
    projectId: "sample-app",
    lifecycleOverride: "building",
    finishLine: "重启后仍保留",
    usesAxiUi: null,
    revision: 1,
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  restarted.close();
});

test("focus is a singleton and survives a new service instance", async () => {
  const { root, service } = fixture();
  const focused = await service.updateFocus({ projectId: "sample-app", revision: 0 });
  assert.equal(focused.focus.projectId, "sample-app");
  assert.equal(focused.focus.revision, 1);
  service.close();

  const second = fixture();
  // The second fixture has an independent database; use the first database to
  // prove that a process restart reads the same local owner metadata.
  second.service.close();
  const restarted = createPersonalOsService({
    workspaceRoot: second.root,
    graphPath: join(second.root, "workspace.graph.json"),
    dbPath: join(root, ".cache", "personal-os.sqlite"),
    snapshotReader: () => ({ resources: [], agentTasks: [] }),
    runtimeReader: async () => ({ services: [], warnings: ["devsvc_unavailable"] }),
    now: NOW,
  });
  const focus = await restarted.getFocus();
  assert.equal(focus.focus.projectId, "sample-app");
  assert.equal(focus.focus.revision, 1);
  restarted.close();
});

test("runtime projection distinguishes unregistered, stopped and unhealthy services", () => {
  assert.equal(deriveRuntimeState({ projectPath: "/workspace/app", workspaceRoot: "/workspace", services: [] }).state, "unknown");
  assert.equal(deriveRuntimeState({
    projectPath: "/workspace/app",
    workspaceRoot: "/workspace",
    services: [{ id: "app", cwd: "/workspace/app", pm2: { status: "stopped" }, health: { ok: false } }],
  }).state, "stopped");
  assert.equal(deriveRuntimeState({
    projectPath: "/workspace/app",
    workspaceRoot: "/workspace",
    services: [{ id: "app", cwd: "/workspace/app", pm2: { status: "online" }, health: { ok: false } }],
  }).state, "unhealthy");
});

test("queue marks an old control-plane snapshot as stale without hiding its projects", async () => {
  const { root, service } = fixture();
  const stale = createPersonalOsService({
    workspaceRoot: root,
    graphPath: join(root, "workspace.graph.json"),
    dbPath: join(root, ".cache", "stale.sqlite"),
    snapshotReader: () => ({ generatedAt: "2026-08-01T00:00:00.000Z", resources: [], agentTasks: [] }),
    runtimeReader: async () => ({ services: [], warnings: [] }),
    now: NOW,
  });
  const queue = await stale.getQueue({ view: "all" });
  assert.ok(queue.warnings.includes("control_plane_snapshot_stale"));
  assert.equal(queue.items.length, 2);
  stale.close();
  service.close();
});

test("SQLite schema contains migration and overlay tables", () => {
  const root = mkdtempSync(join(tmpdir(), "axi-personal-os-schema-"));
  const store = createPersonalOsStore({ cacheDir: root, now: NOW });
  const dbPath = store.dbPath;
  assert.match(dbPath, /personal-os\.sqlite$/);
  store.close();
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name);
  assert.deepEqual(tables, ["focus_state", "project_overrides", "schema_migrations"]);
  assert.deepEqual(db.prepare("SELECT version FROM schema_migrations").all().map((row) => row.version), [1]);
  db.close();
});
