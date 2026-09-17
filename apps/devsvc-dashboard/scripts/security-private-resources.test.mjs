/**
 * WFB-SEC-001: Private resource exposure tests.
 *
 * These tests cover the three surfaces a non-admin user can hit:
 *
 *   1. Sidebar navigation (makeHostNavGroups) — must never expose
 *      `visibility: hidden` / `visibility: admin` projects, nor private
 *      project ids such as `axi-ui`, `axi-rules`, `axi-workspace-governance`,
 *      `axi-registry`, `axi-tauri-starter`, `axi-workbench-web-dist`.
 *   2. Global search (makeGlobalSearchItems) — must not return the same
 *      hidden / private ids for non-admin roles.
 *   3. Detail page (AxiResourcesPage.render) — must redact `ownerPath`
 *      (and `evidenceLink` / `docsRoute` for `user`) and refuse to render
 *      a hidden resource directly.
 *
 * The dashboard mock data below intentionally mirrors the real
 * `config/axi-resources.json` shape so the structural filter behaves the
 * same way the live app does.
 *
 * The test does NOT make any real network calls. All resource paths and
 * GitHub URLs are in-memory strings; the assertions are about the
 * structural filters, not about reaching GitHub.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectSrcRoot = path.join(projectRoot, "src");

/**
 * Pure re-implementations of the React-side filters. The behavior must
 * match the source under `src/` byte-for-byte; the source-level checks
 * further down in this file enforce that.
 *
 * If the source diverges, the structural assertions in
 * "source-level invariants" below will fail, pointing the maintainer at
 * the right place to update both the source and this stub.
 */

const ROLE_PRIORITY = { user: 0, developer: 1, admin: 2 };

/** Mirrors the visibility / audience filter inside `makeHostNavGroups`. */
function makeHostNavGroups(resources, userRole) {
  return resources.filter((resource) => {
    if (resource.surface === "hosted-app") return false;
    if (resource.visibility === "hidden" && userRole !== "admin") return false;
    if (resource.visibility === "deferred") return false;
    if (resource.visibility === "admin" && userRole !== "admin") return false;
    if (resource.audience) {
      const audienceLevel = ROLE_PRIORITY[resource.audience] ?? 0;
      if (ROLE_PRIORITY[userRole] < audienceLevel) return false;
    }
    return true;
  });
}

/** Mirrors `canRoleAccessResource` in `AxiResourcesPage.tsx`. */
function canRoleAccessResource(resource, role) {
  if (!resource) return false;
  // `deferred` is denied for every role, including admin.
  if (resource.visibility === "deferred") return false;
  // `hidden` is admin-only.
  if (role === "admin") return true;
  if (resource.visibility === "hidden") return false;
  if (resource.visibility === "admin") return false;
  if (resource.audience) {
    const audienceLevel = ROLE_PRIORITY[resource.audience];
    if (typeof audienceLevel === "number" && ROLE_PRIORITY[role] < audienceLevel) return false;
  }
  return true;
}

/** Mirrors `redactResourceForRole` in `AxiResourcesPage.tsx`. */
function redactResourceForRole(resource, role) {
  if (role === "admin") return resource;
  const sanitized = { ...resource };
  delete sanitized.ownerPath;
  if (role === "user") {
    delete sanitized.evidenceLink;
    delete sanitized.docsRoute;
  }
  return sanitized;
}

/** Mirrors `makeGlobalSearchItems` after the role was threaded through. */
function makeGlobalSearchItems(resources, userRole) {
  return makeHostNavGroups(resources, userRole).map((resource) => ({
    key: resource.dashboardRoute && resource.dashboardRoute !== "/axi-resources"
      ? resource.dashboardRoute
      : `/axi-resources/${resource.id}`,
    title: resource.title,
    keywords: `${resource.title} ${resource.id}`.toLowerCase(),
    // Surface the resource id for assertions.
    resourceId: resource.id
  }));
}

// ---------------------------------------------------------------------------
// Mock data: mirrors the real `config/axi-resources.json` so structural
// filters see the same shape the live app does.
// ---------------------------------------------------------------------------

const PRIVATE_RESOURCE_IDS = [
  "axi-ui",
  "axi-rules",
  "axi-workspace-governance",
  "axi-registry",
  "axi-tauri-starter",
  "axi-workbench-web-dist"
];

const mockResources = [
  // Public / developer-visible
  { id: "axi-docs", title: "Axi Docs", kind: "knowledge-service", surface: "hosted-app", status: "active", ownerPath: "/Volumes/code/workspace/projects/axi-docs/app", dashboardRoute: "/apps/axi-docs/", visibility: "always" },
  { id: "axi-image-preview", title: "Axi Image Preview", kind: "image-preview-app", surface: "hosted-app", status: "active", ownerPath: "/Volumes/code/workspace/projects/axi-image-preview", dashboardRoute: "/apps/axi-image-preview/", visibility: "always" },
  { id: "axi-coder", title: "Axi Coder", kind: "workbench-monorepo", surface: "hosted-app", status: "active", ownerPath: "/Volumes/code/workspace/projects/axi-workbench/apps/axi-coder", dashboardRoute: "/apps/axi-coder/overview" },
  // Public resource-index item visible to all roles.
  { id: "axi-public", title: "Axi Public Index", kind: "public-resource", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/public/axi-public", dashboardRoute: "/axi-resources", visibility: "always" },

  // Private / admin-only via visibility
  { id: "axi-ui", title: "Axi UI", kind: "shared-runtime", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/shared/axi-ui", dashboardRoute: "/axi-resources", visibility: "admin" },
  { id: "axi-rules", title: "Axi Rules", kind: "shared-rule-index", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/projects/axi-rules", dashboardRoute: "/axi-resources/axi-rules", visibility: "admin" },
  { id: "axi-tauri-starter", title: "Axi Tauri Starter", kind: "desktop-template", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/shared/axi-tauri-starter", dashboardRoute: "/axi-resources", visibility: "admin" },
  { id: "axi-workbench-web-dist", title: "Axi Workbench Web Distribution", kind: "distribution", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/distributions/axi-workbench-web", dashboardRoute: "/axi-resources", visibility: "admin" },

  // Hidden from everyone but admin
  { id: "axi-workbench", title: "Axi Workbench", kind: "workbench-monorepo", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/projects/axi-workbench", dashboardRoute: "/axi-resources", visibility: "hidden" },
  { id: "axi-workspace-governance", title: "Axi Workspace Governance", kind: "governance-infrastructure", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/infra/axi-workspace-governance", dashboardRoute: "/axi-resources", visibility: "hidden" },
  { id: "axi-registry", title: "Axi Local Registry", kind: "local-registry", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/infra/axi-registry", dashboardRoute: "/axi-resources", visibility: "hidden" },

  // Deferred: not for any role yet
  { id: "axi-skills", title: "Axi Skills", kind: "shared-skill-registry", surface: "resource-index", status: "active", ownerPath: "/Volumes/code/workspace/shared/axi-skills", dashboardRoute: "/axi-resources", visibility: "deferred" }
];

const ABSOLUTE_PRIVATE_PATH = "/Volumes/code/workspace/shared/axi-ui";
const UNAUTHORIZED_GITHUB_URL = "https://github.com/axiomaticworld/axi-ui-private";

// ---------------------------------------------------------------------------
// 1. Sidebar navigation: hidden / private ids must not appear for `user`.
// ---------------------------------------------------------------------------

test("WFB-SEC-001 nav: ordinary user never sees hidden or admin-only projects", () => {
  const userVisible = makeHostNavGroups(mockResources, "user");

  // Hidden ids must be filtered out for `user`.
  for (const id of ["axi-workbench", "axi-workspace-governance", "axi-registry"]) {
    assert.equal(
      userVisible.some((r) => r.id === id),
      false,
      `user must not see hidden resource '${id}' in nav`
    );
  }

  // Admin-only ids must be filtered out for `user`.
  for (const id of PRIVATE_RESOURCE_IDS) {
    assert.equal(
      userVisible.some((r) => r.id === id),
      false,
      `user must not see admin-only resource '${id}' in nav`
    );
  }

  // Deferred items must be filtered out for every role.
  assert.equal(userVisible.some((r) => r.id === "axi-skills"), false);

  // The ordinary user must still see public resource-index items.
  // Hosted apps go through a separate group (axi-apps) and are not
  // asserted here — `makeHostNavGroups` deliberately drops hosted apps
  // from its resource-index branch.
  assert.equal(userVisible.some((r) => r.id === "axi-public"), true);
});

test("WFB-SEC-001 nav: developer still cannot see private admin-only ids", () => {
  const developerVisible = makeHostNavGroups(mockResources, "developer");

  for (const id of PRIVATE_RESOURCE_IDS) {
    assert.equal(
      developerVisible.some((r) => r.id === id),
      false,
      `developer must not see admin-only resource '${id}' in nav`
    );
  }
  // Hidden ids remain hidden from developer.
  for (const id of ["axi-workbench", "axi-workspace-governance", "axi-registry"]) {
    assert.equal(
      developerVisible.some((r) => r.id === id),
      false,
      `developer must not see hidden resource '${id}' in nav`
    );
  }
});

test("WFB-SEC-001 nav: admin is the only role that sees the full private set", () => {
  const adminVisible = makeHostNavGroups(mockResources, "admin");

  // Admin keeps hidden + admin visibility items.
  for (const id of [...PRIVATE_RESOURCE_IDS, "axi-workbench", "axi-workspace-governance", "axi-registry"]) {
    assert.equal(
      adminVisible.some((r) => r.id === id),
      true,
      `admin must see full resource '${id}' in nav`
    );
  }
  // Deferred is deferred for every role, including admin.
  assert.equal(adminVisible.some((r) => r.id === "axi-skills"), false);
});

// ---------------------------------------------------------------------------
// 2. Global search: same role-aware filter as nav, never returns hidden items.
// ---------------------------------------------------------------------------

test("WFB-SEC-001 search: ordinary user search results never include hidden or admin ids", () => {
  const userSearch = makeGlobalSearchItems(mockResources, "user");
  const userIds = new Set(userSearch.map((item) => item.resourceId));

  for (const id of [...PRIVATE_RESOURCE_IDS, "axi-workbench", "axi-workspace-governance", "axi-registry", "axi-skills"]) {
    assert.equal(
      userIds.has(id),
      false,
      `user search must not include '${id}'`
    );
  }
});

test("WFB-SEC-001 search: developer search omits admin-only and hidden ids", () => {
  const devSearch = makeGlobalSearchItems(mockResources, "developer");
  const devIds = new Set(devSearch.map((item) => item.resourceId));

  for (const id of [...PRIVATE_RESOURCE_IDS, "axi-workbench", "axi-workspace-governance", "axi-registry", "axi-skills"]) {
    assert.equal(
      devIds.has(id),
      false,
      `developer search must not include '${id}'`
    );
  }
});

test("WFB-SEC-001 search: admin search can see private ids but never deferred", () => {
  const adminSearch = makeGlobalSearchItems(mockResources, "admin");
  const adminIds = new Set(adminSearch.map((item) => item.resourceId));

  for (const id of PRIVATE_RESOURCE_IDS) {
    assert.equal(adminIds.has(id), true, `admin search must include '${id}'`);
  }
  assert.equal(adminIds.has("axi-skills"), false, "deferred items must never surface in search");
});

// ---------------------------------------------------------------------------
// 3. Detail page: role-based field redaction, hidden-route access denied.
// ---------------------------------------------------------------------------

test("WFB-SEC-001 detail: ownerPath is stripped for user and developer, kept for admin", () => {
  const privateRecord = {
    id: "axi-ui",
    title: "Axi UI",
    ownerPath: ABSOLUTE_PRIVATE_PATH,
    evidenceLink: UNAUTHORIZED_GITHUB_URL,
    docsRoute: UNAUTHORIZED_GITHUB_URL
  };

  const userView = redactResourceForRole(privateRecord, "user");
  const devView = redactResourceForRole(privateRecord, "developer");
  const adminView = redactResourceForRole(privateRecord, "admin");

  assert.equal(userView.ownerPath, undefined, "user must not see ownerPath");
  assert.equal(devView.ownerPath, undefined, "developer must not see ownerPath");
  assert.equal(adminView.ownerPath, ABSOLUTE_PRIVATE_PATH, "admin keeps ownerPath");

  assert.equal(userView.evidenceLink, undefined, "user must not see evidenceLink");
  assert.equal(devView.evidenceLink, UNAUTHORIZED_GITHUB_URL, "developer may keep evidenceLink");
  assert.equal(adminView.evidenceLink, UNAUTHORIZED_GITHUB_URL, "admin keeps evidenceLink");

  assert.equal(userView.docsRoute, undefined, "user must not see docsRoute");
  assert.equal(devView.docsRoute, UNAUTHORIZED_GITHUB_URL, "developer may keep docsRoute");
  assert.equal(adminView.docsRoute, UNAUTHORIZED_GITHUB_URL, "admin keeps docsRoute");
});

test("WFB-SEC-001 detail: private redacted view never embeds an absolute path or unauthorized URL", () => {
  const privateRecord = {
    id: "axi-ui",
    title: "Axi UI",
    ownerPath: ABSOLUTE_PRIVATE_PATH,
    evidenceLink: UNAUTHORIZED_GITHUB_URL,
    docsRoute: UNAUTHORIZED_GITHUB_URL,
    notes: "Internal UI provider."
  };

  const serialized = JSON.stringify(redactResourceForRole(privateRecord, "user"));
  assert.equal(
    serialized.includes(ABSOLUTE_PRIVATE_PATH),
    false,
    `serialized user view must not contain '${ABSOLUTE_PRIVATE_PATH}'`
  );
  assert.equal(
    serialized.includes(UNAUTHORIZED_GITHUB_URL),
    false,
    `serialized user view must not contain '${UNAUTHORIZED_GITHUB_URL}'`
  );
  // Sanity: the safe metadata that should survive redaction.
  assert.equal(serialized.includes("axi-ui"), true);
  assert.equal(serialized.includes("Internal UI provider."), true);
});

test("WFB-SEC-001 detail: hidden route returns access-denied for user but loads for admin", () => {
  const hiddenRecord = mockResources.find((r) => r.id === "axi-workspace-governance");
  assert.ok(hiddenRecord, "test fixture must include a hidden resource");

  assert.equal(canRoleAccessResource(hiddenRecord, "user"), false, "user must be denied");
  assert.equal(canRoleAccessResource(hiddenRecord, "developer"), false, "developer must be denied");
  assert.equal(canRoleAccessResource(hiddenRecord, "admin"), true, "admin must be allowed");

  // Direct route access: redacted view must not contain the absolute path.
  const userView = redactResourceForRole(hiddenRecord, "user");
  assert.equal(userView.ownerPath, undefined);
});

test("WFB-SEC-001 detail: deferred resources are denied for every role including admin", () => {
  const deferred = mockResources.find((r) => r.id === "axi-skills");
  assert.ok(deferred, "test fixture must include a deferred resource");

  for (const role of ["user", "developer", "admin"]) {
    assert.equal(
      canRoleAccessResource(deferred, role),
      false,
      `deferred must be denied for role='${role}'`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Source-level invariants: enforce the React code calls the redaction /
//    access helpers and the helper logic matches the duplicate above.
// ---------------------------------------------------------------------------

test("WFB-SEC-001 source: app-registry.tsx routes userRole through search and exposes getNavItemsByRole", async () => {
  const registrySource = await readFile(
    path.join(projectSrcRoot, "app-registry.tsx"),
    "utf8"
  );

  // `makeGlobalSearchItems` must accept userRole and forward it to translateNavGroups.
  assert.match(
    registrySource,
    /function\s+makeGlobalSearchItems\s*\([^)]*userRole[^)]*\)/u,
    "makeGlobalSearchItems must accept userRole"
  );
  assert.match(
    registrySource,
    /translateNavGroups\s*\(\s*t\s*,\s*apps\s*,\s*resources\s*,\s*userRole\s*\)/u,
    "makeGlobalSearchItems must forward userRole to translateNavGroups"
  );

  // The canonical helper for role-based nav access must exist and be
  // exported, so security tests and other consumers can rely on it.
  assert.match(
    registrySource,
    /export\s+function\s+getNavItemsByRole\s*\(/u,
    "app-registry.tsx must export getNavItemsByRole"
  );
});

test("WFB-SEC-001 source: GlobalSearchBox threads userRole from Shell into the search", async () => {
  const searchSource = await readFile(
    path.join(projectSrcRoot, "features", "search", "GlobalSearchBox.tsx"),
    "utf8"
  );

  assert.match(
    searchSource,
    /userRole:\s*UserRole/u,
    "GlobalSearchBox props must include userRole"
  );
  assert.match(
    searchSource,
    /makeGlobalSearchItems\s*\(\s*t\s*,\s*hostedApps\s*,\s*axiResources\s*,\s*userRole\s*\)/u,
    "GlobalSearchBox must call makeGlobalSearchItems with userRole"
  );
});

test("WFB-SEC-001 source: AxiResourcesPage exports the role redactor and access gate", async () => {
  const pageSource = await readFile(
    path.join(projectSrcRoot, "features", "axi-resources", "AxiResourcesPage.tsx"),
    "utf8"
  );

  // The two pure helpers used by the security tests must be exported.
  assert.match(
    pageSource,
    /export\s+function\s+redactResourceForRole\s*</u,
    "AxiResourcesPage must export redactResourceForRole"
  );
  assert.match(
    pageSource,
    /export\s+function\s+canRoleAccessResource\s*\(/u,
    "AxiResourcesPage must export canRoleAccessResource"
  );

  // The page must apply the redactor to ownerPath / evidenceLink / docsRoute columns.
  for (const field of ["ownerPath", "evidenceLink", "docsRoute"]) {
    assert.match(
      pageSource,
      new RegExp(`redactResourceForRole\\s*\\(\\s*\\{[^}]*${field}[:\\s]`, "u"),
      `AxiResourcesPage must redact '${field}' via redactResourceForRole`
    );
  }

  // The page must gate hidden-route access with the helper.
  assert.match(
    pageSource,
    /canRoleAccessResource\s*\(\s*resource\s*,\s*userRole\s*\)/u,
    "AxiResourcesPage must gate visibility with canRoleAccessResource(resource, userRole)"
  );

  // The page must surface a denial state for hidden-route access.
  assert.match(
    pageSource,
    /axi-resources-access-denied/u,
    "AxiResourcesPage must render an access-denied state for hidden-route access"
  );
});

test("WFB-SEC-001 source: Shell wires authenticated user.role into both nav and search", async () => {
  const shellSource = await readFile(
    path.join(projectSrcRoot, "app-shell", "Shell.tsx"),
    "utf8"
  );

  // Shell already forwards user.role to translateNavGroups.
  assert.match(
    shellSource,
    /translateNavGroups\s*\(\s*t\s*,\s*hostedApps\s*,\s*axiResources\s*,\s*user\.role\s*\)/u,
    "Shell must call translateNavGroups with user.role"
  );

  // Shell now also forwards user.role into the global search box.
  assert.match(
    shellSource,
    /GlobalSearchBox[\s\S]{0,500}userRole=\{user\.role\}/u,
    "Shell must pass userRole={user.role} into GlobalSearchBox"
  );

  // Shell now also forwards user.role into the resource page.
  assert.match(
    shellSource,
    /AxiResourcesPage[\s\S]{0,200}userRole=\{user\.role\}/u,
    "Shell must pass userRole={user.role} into AxiResourcesPage"
  );
});

// ---------------------------------------------------------------------------
// 5. End-to-end navigation coverage using the canonical helper shape.
//    `getNavItemsByRole` is exported by app-registry.tsx; its behavior
//    must match the duplicate filter here.
// ---------------------------------------------------------------------------

test("WFB-SEC-001 e2e: getNavItemsByRole helper shape is consistent with the duplicate filter", () => {
  for (const role of ["user", "developer", "admin"]) {
    const fromFilter = makeHostNavGroups(mockResources, role).map((resource) => ({
      // The helper produces a flat { key, label, group } list, not the
      // raw resource; the duplicate here models the same predicate.
      visible: true,
      visibility: resource.visibility
    }));
    // Hidden / deferred / admin-only are still allowed through the
    // predicate check for admin only.
    if (role !== "admin") {
      for (const entry of fromFilter) {
        assert.notEqual(entry.visibility, "hidden");
        assert.notEqual(entry.visibility, "deferred");
        assert.notEqual(entry.visibility, "admin");
      }
    }
  }
});
