import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const roles = ["user", "developer", "admin"];
const visibilities = ["hidden", "deferred", "admin"];

/**
 * Test runner for the role × visibility matrix.
 *
 * The dashboard's `app-registry.tsx` exports `makeHostNavGroups` /
 * `translateNavGroups`, but it transitively depends on React JSX elements
 * (`<AxiSvgIcon ... />`) which need a build step. Running that build in
 * `node --test` would couple the test runner to the full Vite config.
 *
 * Instead, this file encodes the visibility filter exactly as the source
 * declares it, and the source-level tests at the bottom of the file pin the
 * registry to that contract. If the source diverges from the contract below,
 * the source-level assertions fail and the matrix below is updated in the
 * same commit. This is the canonical pattern for `apps/devsvc-dashboard/scripts/*`.
 */
const rolePriority = { user: 0, developer: 1, admin: 2 };

/**
 * Mirror of the filter inside `makeHostNavGroups` (app-registry.tsx).
 * Keep this function byte-equivalent to the production filter.
 */
function filterByRoleAndVisibility(resources, userRole) {
  return resources.filter((resource) => {
    if (resource.surface === "hosted-app") return false;
    if (resource.visibility === "hidden" && userRole !== "admin") return false;
    if (resource.visibility === "deferred") return false;
    if (resource.visibility === "admin" && userRole !== "admin") return false;
    if (resource.audience) {
      const audienceLevel = rolePriority[resource.audience] ?? 0;
      const userLevel = rolePriority[userRole];
      if (userLevel < audienceLevel) return false;
    }
    return true;
  });
}

const fixtureResources = [
  { id: "open-rule", visibility: "always", audience: "user" },
  { id: "open-dev", visibility: "always", audience: "developer" },
  { id: "open-admin", visibility: "always", audience: "admin" },
  { id: "hidden-rule", visibility: "hidden", audience: "developer" },
  { id: "hidden-admin", visibility: "hidden", audience: "admin" },
  { id: "deferred-rule", visibility: "deferred", audience: "developer" },
  { id: "admin-rule", visibility: "admin", audience: "developer" },
  { id: "admin-only-rule", visibility: "admin", audience: "admin" }
];

function visibleIds(role) {
  return new Set(
    filterByRoleAndVisibility(fixtureResources, role).map((resource) => resource.id)
  );
}

test("user role sees only resources targeted at user; hidden/deferred/admin are filtered", () => {
  const visible = visibleIds("user");
  assert.deepEqual([...visible].sort(), ["open-rule"]);
  for (const id of visible) {
    assert.notEqual(id, "open-dev", "user must not see audience=developer");
    assert.notEqual(id, "open-admin", "user must not see audience=admin");
    assert.notEqual(id, "hidden-rule", "user must not see hidden");
    assert.notEqual(id, "hidden-admin", "user must not see hidden");
    assert.notEqual(id, "deferred-rule", "user must not see deferred");
    assert.notEqual(id, "admin-rule", "user must not see admin visibility");
    assert.notEqual(id, "admin-only-rule", "user must not see admin visibility");
  }
});

test("developer role sees user+developer targets; hidden/deferred/admin still filtered", () => {
  const visible = visibleIds("developer");
  assert.deepEqual([...visible].sort(), ["open-dev", "open-rule"]);
  for (const id of visible) {
    assert.notEqual(id, "open-admin", "developer must not see audience=admin");
    assert.notEqual(id, "hidden-rule", "developer must not see hidden");
    assert.notEqual(id, "hidden-admin", "developer must not see hidden");
    assert.notEqual(id, "deferred-rule", "developer must not see deferred");
    assert.notEqual(id, "admin-rule", "developer must not see admin visibility");
    assert.notEqual(id, "admin-only-rule", "developer must not see admin visibility");
  }
});

test("admin role sees everything except deferred (deferred is gated everywhere)", () => {
  const visible = visibleIds("admin");
  assert.deepEqual(
    [...visible].sort(),
    [
      "admin-only-rule",
      "admin-rule",
      "hidden-admin",
      "hidden-rule",
      "open-admin",
      "open-dev",
      "open-rule"
    ]
  );
  assert.equal(visible.has("deferred-rule"), false, "admin must not see deferred");
});

test("hidden visibility surfaces only for admin across every role", () => {
  for (const role of roles) {
    const visible = visibleIds(role);
    if (role === "admin") {
      assert.equal(visible.has("hidden-rule"), true, "admin must see hidden-rule");
      assert.equal(visible.has("hidden-admin"), true, "admin must see hidden-admin");
    } else {
      assert.equal(visible.has("hidden-rule"), false, `${role} must not see hidden-rule`);
      assert.equal(visible.has("hidden-admin"), false, `${role} must not see hidden-admin`);
    }
  }
});

test("deferred visibility is hidden from every role", () => {
  for (const role of roles) {
    const visible = visibleIds(role);
    assert.equal(
      visible.has("deferred-rule"),
      false,
      `deferred visibility must be filtered for role=${role}`
    );
  }
});

test("admin visibility surfaces only for admin across every role", () => {
  for (const role of roles) {
    const visible = visibleIds(role);
    if (role === "admin") {
      assert.equal(visible.has("admin-rule"), true, "admin must see admin-rule");
      assert.equal(visible.has("admin-only-rule"), true, "admin must see admin-only-rule");
    } else {
      assert.equal(visible.has("admin-rule"), false, `${role} must not see admin-rule`);
      assert.equal(
        visible.has("admin-only-rule"),
        false,
        `${role} must not see admin-only-rule`
      );
    }
  }
});

test("audience=admin alone (without visibility) is still gated to admin", () => {
  for (const role of roles) {
    const visible = visibleIds(role);
    if (role === "admin") {
      assert.equal(visible.has("open-admin"), true, "admin must see audience=admin resource");
    } else {
      assert.equal(
        visible.has("open-admin"),
        false,
        `${role} must not see audience=admin resource`
      );
    }
  }
});

/* Source-level guard rails: the in-line mirror above must match the
 * production filter in `apps/devsvc-dashboard/src/app-registry.tsx`. If
 * either side drifts, both must change in the same commit.
 */

test("app-registry.tsx declares every required role and visibility branch", async () => {
  const registrySource = await readFile(path.join(projectRoot, "src", "app-registry.tsx"), "utf8");

  for (const role of roles) {
    assert.match(
      registrySource,
      new RegExp(`rolePriority[^}]*\\b${role}\\s*:\\s*\\d`, "u"),
      `rolePriority must declare a numeric weight for role=${role}`
    );
  }

  for (const visibility of visibilities) {
    assert.match(
      registrySource,
      new RegExp(`visibility\\s*===\\s*['"]${visibility}['"]`, "u"),
      `visibility branch '${visibility}' must exist in the registry`
    );
  }

  assert.match(
    registrySource,
    /visibility\s*===\s*['"]hidden['"]\s*&&\s*userRole\s*!==\s*['"]admin['"]/u,
    "hidden visibility must be gated to non-admin users"
  );
  assert.match(
    registrySource,
    /visibility\s*===\s*['"]deferred['"][\s\S]{0,80}return\s*false/u,
    "deferred visibility must filter the resource out"
  );
  assert.match(
    registrySource,
    /visibility\s*===\s*['"]admin['"]\s*&&\s*userRole\s*!==\s*['"]admin['"]/u,
    "admin visibility must be gated to admin role"
  );
});

test("Shell passes authenticated user.role directly without fallback", async () => {
  const shellSource = await readFile(path.join(projectRoot, "src", "app-shell", "Shell.tsx"), "utf8");

  assert.doesNotMatch(
    shellSource,
    /user\.role\s*\|\|\s*getUserRole\s*\(\s*\)/u,
    "Shell must not fall back to getUserRole() when user.role is present"
  );
  assert.doesNotMatch(
    shellSource,
    /translateNavGroups\([^)]*\|\|/u,
    "translateNavGroups must be called with user.role as-is, no || fallback"
  );

  assert.match(
    shellSource,
    /translateNavGroups\(\s*t\s*,\s*hostedApps\s*,\s*axiResources\s*,\s*user\.role\s*\)/u,
    "Shell must call translateNavGroups with user.role directly"
  );

  assert.doesNotMatch(
    shellSource,
    /import\s+\{[^}]*getUserRole[^}]*\}\s+from/u,
    "Shell must not import getUserRole; the role is sourced from AuthUser only"
  );
});

test("AuthUser.role is a mandatory field on the authenticated session", async () => {
  const authSource = await readFile(
    path.join(projectRoot, "src", "features", "auth", "auth.ts"),
    "utf8"
  );

  assert.doesNotMatch(
    authSource,
    /role\?:\s*UserRole/u,
    "AuthUser.role must be required, not optional"
  );
  assert.match(
    authSource,
    /role:\s*UserRole/u,
    "AuthUser.role must be a required field of type UserRole"
  );

  assert.match(
    authSource,
    /function\s+resolveRoleForUsername\s*\(\s*username\s*:\s*string\s*\)/u,
    "auth.ts must expose resolveRoleForUsername so login flows can attach a role"
  );
});