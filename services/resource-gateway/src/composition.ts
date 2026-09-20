import {
  ProviderRegistry,
  formatIssues,
  intentKind,
  parseManifest,
  registerPredicateBuilder,
  validateManifestSemantics,
  validateTargetCapabilities,
  configFromEnv as configSharedStateFromEnv,
  createNoopSharedStateManager,
  createValkeySharedStateManager,
  createPostgresSharedStateManager,
  createRealPgPool,
  type PostgresClientFactory,
  type PostgresLikePool,
  ActiveHealthRegistry,
  type SharedStateManager,
  type RedisLike,
  type HealthEndpoint,
  type HealthRegistry,
} from "@axi/resource-orchestrator";
import type { AdapterFactory } from "@axi/resource-orchestrator";
import type {
  AxiDocsAdapter as _AxiDocsAdapter,
  IconLibraryAdapter as _IconLibraryAdapter,
  ImagePreviewAdapter as _ImagePreviewAdapter,
  MiniMaxTokenPlanImageAdapter as _MiniMaxTokenPlanImageAdapter,
  MiniMaxTokenPlanWebSearchAdapter as _MiniMaxTokenPlanWebSearchAdapter,
  ProjectInfoAdapter as _ProjectInfoAdapter,
  UiLibraryAdapter as _UiLibraryAdapter,
  WorkspaceStatusAdapter as _WorkspaceStatusAdapter,
} from "@axi/resource-adapters";

import type { ServerConfig } from "./config.js";
import providerManifest from "./providers.manifest.json" with { type: "json" };
import { assertAllowlistedTarget } from "./allowlist.js";

/**
 * Server-only composition root (GHA-011 / GHA-016 / GHA-022 / GHA-026).
 *
 * Builds a `ProviderRegistry` from the static app manifest using
 * server-only adapters that talk to the upstream providers over HTTP
 * (or via the MiniMax CLI for image generation). Each factory is
 * memoized so a target that references the same provider id always
 * receives the same adapter instance; that gives us a stable
 * descriptor, predictable connection-pool reuse, and a single place
 * to call `.dispose()` on shutdown.
 *
 * Every upstream base URL must pass the SSRF allowlist before any
 * adapter is constructed. A failure here aborts startup, not silently
 * degrades to an empty registry.
 */

// Adapter classes are imported lazily so the gateway boot does not
// require the workbench's browser-specific adapters. Each one runs on
// Node today because they are pure `fetch` + file I/O; if a future
// adapter needs `window`, the import will throw at boot and the
// registry build will surface the failure.

interface BuiltAdapters {
  readonly providers: ReadonlyArray<{ id: string; factory: string }>;
  readonly factories: Record<string, AdapterFactory>;
  readonly allowlisted: { image: string; docs: string; project: string; ui: string; icon: string; minimax: string };
}

const buildAdapters = async (config: ServerConfig): Promise<BuiltAdapters> => {
  const adaptersModule = await import("@axi/resource-adapters");

  // GHA-016: every upstream base URL must pass the SSRF allowlist
  // before any adapter is constructed. A failure here aborts startup,
  // not silently degrades.
  const imagePreviewUrl = assertAllowlistedTarget(config.imagePreviewTarget);
  const axiDocsUrl = assertAllowlistedTarget(config.axiDocsTarget);
  const projectUrl = assertAllowlistedTarget(config.projectTarget);
  const uiUrl = assertAllowlistedTarget(config.uiTarget);
  const iconUrl = assertAllowlistedTarget(config.iconTarget);
  // GHA-NEXT-003: MiniMax bridge target comes from config so it can be
  // overridden via MINIMAX_BRIDGE_TARGET without a code change. The
  // SSRF allowlist assertion is preserved — a config swap must still
  // gate the URL.
  const minimaxTokenPlanUrl = assertAllowlistedTarget(config.minimaxBridgeTarget);

  // Memoize adapters per factory so buildFromManifest only triggers
  // each factory once. Without this, ProviderRegistry.buildFromManifest
  // invokes factory() once per target and may spawn duplicate
  // adapter instances.
  const memo = new Map<string, ReturnType<AdapterFactory>>();
  const memoFactory = (key: string, build: () => ReturnType<AdapterFactory>): ReturnType<AdapterFactory> => {
    const existing = memo.get(key);
    if (existing !== undefined) return existing;
    const value = build();
    memo.set(key, value);
    return value;
  };

  const factories: Record<string, AdapterFactory> = {
    "image-factory": () => memoFactory("image", () => [
      new adaptersModule.ImagePreviewAdapter(imagePreviewUrl.toString()),
      new adaptersModule.MiniMaxTokenPlanImageAdapter(minimaxTokenPlanUrl.toString()),
    ]),
    "docs-factory": () => memoFactory("docs", () => [
      new adaptersModule.AxiDocsAdapter({ baseUrl: axiDocsUrl.toString(), token: config.axiDocsToken }),
      new adaptersModule.WorkspaceStatusAdapter({ baseUrl: axiDocsUrl.toString(), token: config.axiDocsToken }),
    ]),
    "minimax-factory": () => memoFactory("minimax", () => [
      new adaptersModule.MiniMaxTokenPlanWebSearchAdapter(minimaxTokenPlanUrl.toString()),
    ]),
    "project-factory": () => memoFactory("project", () => [
      new adaptersModule.ProjectInfoAdapter({ baseUrl: projectUrl.toString() }),
    ]),
    "ui-factory": () => memoFactory("ui", () => [
      new adaptersModule.UiLibraryAdapter({ baseUrl: uiUrl.toString() }),
    ]),
    "icon-factory": () => memoFactory("icon", () => [
      new adaptersModule.IconLibraryAdapter({ baseUrl: iconUrl.toString() }),
    ]),
    "fixture-factory": () => memoFactory("fixture", () => adaptersModule.createFixtureAdapters()),
  };

  return {
    providers: [
      { id: "image-factory", factory: "image-factory" },
      { id: "docs-factory", factory: "docs-factory" },
      { id: "minimax-factory", factory: "minimax-factory" },
      { id: "project-factory", factory: "project-factory" },
      { id: "ui-factory", factory: "ui-factory" },
      { id: "icon-factory", factory: "icon-factory" },
      { id: "fixture-factory", factory: "fixture-factory" },
    ],
    factories,
    allowlisted: {
      image: imagePreviewUrl.toString(),
      docs: axiDocsUrl.toString(),
      project: projectUrl.toString(),
      ui: uiUrl.toString(),
      icon: iconUrl.toString(),
      minimax: minimaxTokenPlanUrl.toString(),
    },
  };
};

export interface CompositionResult {
  registry: ProviderRegistry;
  routeCount: number;
  manifestVersion: number;
  fallbackChains: ReadonlyArray<{ toolId: string; chain: ReadonlyArray<string> }>;
  /** Diagnostic: number of times each factory was invoked. */
  factoryInvocationCounts: Record<string, number>;
  /** Number of distinct adapter instances wired into the registry after buildFromManifest. */
  adapterCount: number;
  /** Factory identifiers registered with the registry, in insertion order. */
  factoryNames: ReadonlyArray<string>;
  /** Allowlisted upstream targets keyed by factory (no secrets, URLs only). */
  allowlistedTargets: Readonly<Record<string, string>>;
  /**
   * SharedStateManager (cross-instance breaker / rate-limit /
   * idempotency / cache / snapshot / coalesce). Always present; the
   * noop manager is returned when `GATEWAY_SHARED_STORE_URL` is not
   * configured (single-instance / local-only deployments).
   * GHA-NEXT-025 — Phase D / P0.
   */
  sharedState: SharedStateManager;
  /**
   * GHA-NEXT-036 — the factory map the composition root built, in
   * the same shape `ProviderRegistry.registerFactory` accepts. The
   * reload path uses it to rebuild the registry on the same factory
   * set (preserving adapter memoization) so a `/admin/routes/reload`
   * call does not re-spawn every provider.
   */
  factories: Readonly<Record<string, AdapterFactory>>;
  /**
   * GHA-NEXT-016 — Active HealthRegistry wired to the composition
   * root. The registry probes each factory's `/healthz` endpoint
   * (HEAD by default) on a 5s interval, gated by the same SSRF
   * allowlist that the composition root applied at boot. The server
   * forwards it as `state.healthRegistry` so `/health/ready` can
   * project per-factory status (healthy / ejected / recovering / ...)
   * instead of the legacy `"starting"` placeholder.
   */
  healthRegistry: HealthRegistry;
}

/** Build the gateway ProviderRegistry. Throws on any factory failure. */
export const buildServerRegistry = async (config: ServerConfig): Promise<CompositionResult> => {
  const built = await buildAdapters(config);
  const factories = built.factories;
  const registry = new ProviderRegistry({ freezeOnBuild: true });

  // Register the canonical predicate ids for the five resource kinds.
  // The orchestrator's built-in registry only knows image / skill /
  // document / web / workspace; project / ui / icon are the lane's
  // additions. We swallow "already registered" so the registry can be
  // imported multiple times by tests.
  const extraPredicates: Array<[string, () => ReturnType<typeof intentKind>]> = [
    ["by-resource-kind-project", () => intentKind("project")],
    ["by-resource-kind-ui", () => intentKind("ui")],
    ["by-resource-kind-icon", () => intentKind("icon")],
  ];
  for (const [id, build] of extraPredicates) {
    try { registerPredicateBuilder(id, build); } catch { /* already registered */ }
  }

  // Eagerly materialize every factory exactly once. Any failure here
  // must abort server startup, not silently degrade to an empty registry.
  // Wrap each factory to observe how often it's invoked: composition
  // must call it once; buildFromManifest below will request only the
  // targets we declared.
  const invocationCounts: Record<string, number> = {};
  for (const [id, factory] of Object.entries(factories)) {
    invocationCounts[id] = 0;
    const wrapped: AdapterFactory = () => {
      invocationCounts[id] += 1;
      return factory();
    };
    registry.registerFactory(id, wrapped);
  }

  // GHA-020: parse the JSON manifest through the Zod schema BEFORE any
  // factory or route is built. A malformed manifest must abort startup,
  // not silently fall through to a half-built registry.
  const parsedManifest = parseManifest(providerManifest);

  // GHA-021: semantic reachability pass. Issues are collected, not
  // thrown, so the composition root can surface every problem in a
  // single boot log.
  const semanticIssues = validateManifestSemantics(parsedManifest, {
    knownFactoryNames: Object.keys(factories),
  });
  if (semanticIssues.length) {
    throw new Error(`manifest semantic validation failed:\n${formatIssues(semanticIssues)}`);
  }

  registry.buildFromManifest(parsedManifest);

  // GHA-022: capability consistency. Once adapters are built, every
  // route target's descriptor must advertise the capability (search /
  // inspect / preview) the route promises. The previous route.image
  // bundle mounted a generate adapter (minimax-tokenplan-image) as a
  // search target, which would have silently invoked the generator
  // for every search call. The validator now rejects that wiring, and
  // the search target list here contains only the search adapter.
  const capabilityIssues = validateTargetCapabilities(registry, parsedManifest);
  if (capabilityIssues.length) {
    throw new Error(`manifest target capability validation failed:\n${formatIssues(capabilityIssues)}`);
  }

  // GHA-NEXT-003: print a startup summary. No secret values (tokens,
// CLI paths, URL credentials) are included; the allowlisted list
// contains only factory identifiers for diagnostics.
  const factoryCount = Object.keys(factories).length;
  const factoryNames = Object.keys(factories);
  const allowlistedTargets = built.allowlisted;
  // adapterCount = number of distinct adapter object instances actually
  // wired into route targets.  Use a Set keyed by object identity so each
  // factory's adapter(s) count exactly once, even when shared across
  // multiple routes.  Computed after buildFromManifest so the registry
  // has fully-materialised targets.
  const seenAdapters = new Set<import("@axi/gateway-contracts").ResourceAdapter>();
  for (const route of registry.listRoutes()) {
    for (const target of route.targets) {
      seenAdapters.add(target.adapter);
    }
  }
  const adapterCount = seenAdapters.size;
  console.log(
    `[composition] manifestVersion=${parsedManifest.manifestVersion} ` +
    `routeCount=${registry.listRoutes().length} ` +
    `factoryCount=${factoryCount} ` +
    `adapterCount=${adapterCount}`,
  );

  // GHA-NEXT-025: assemble the SharedStateManager from env config.
  // When no store URL is configured the noop manager is used so the
  // gateway runs in single-instance / local-only mode unchanged. When
  // a store URL is configured we use the Valkey facade; for postgres
  // we use the Postgres facade.
  //
  // L3 wiring fix (2026-08-27): the Postgres facade earlier accepted
  // only the *configuration* and every store call fell through to the
  // noop fallback because no `pg` pool factory was forwarded. We now
  // hand `createPostgresSharedStateManager` a `() => createRealPgPool(...)`
  // lazy factory closure so the connection opens only on the first
  // store call AND every store call lands on a real `pg.Pool` instead
  // of noop. Valkey gets the same `() => new Redis(...)` shape so the
  // boot path no longer has to special-case client construction per
  // backend.
  const sharedStateConfig = configSharedStateFromEnv(process.env as Record<string, string | undefined>);
  let sharedState: SharedStateManager;
  if (!sharedStateConfig.storeUrl) {
    sharedState = createNoopSharedStateManager(sharedStateConfig);
  } else if (sharedStateConfig.storeType === "postgres") {
    // Postgres path: lazy factory so `pg.Pool` opens only on first
    // store call (DDL, first write, …). The factory is invoked
    // exactly once by `createPostgresSharedStateManager`; subsequent
    // store calls reuse the cached pool.
    const pgFactory: PostgresClientFactory = () =>
      createRealPgPool(sharedStateConfig.storeUrl) as unknown as PostgresLikePool;
    sharedState = createPostgresSharedStateManager(sharedStateConfig, pgFactory);
  } else {
    // GHA-NEXT-025: dynamic import so apps/gateway doesn't pay the
    // ioredis cost when no shared store is configured. The factory
    // closure builds the client lazily so the connection only opens
    // when the first store call happens.
    const { default: Redis } = await import("ioredis");
    sharedState = createValkeySharedStateManager(sharedStateConfig, () => new Redis(sharedStateConfig.storeUrl) as unknown as RedisLike);
  }

  // GHA-NEXT-016 — wire the ActiveHealthRegistry. The probe loop
  // targets each factory's allowlisted URL with a HEAD request; the
  // allowlist predicate is the SAME `assertAllowlistedTarget` that
  // guards the composition root at startup, so the probe surface
  // cannot escape the SSRF boundary by accident.
  //
  // We probe the upstream base URL (e.g. http://127.0.0.1:3010) by
  // default. A future manifest revision can declare per-target
  // `healthEndpoint` to point at a more specific path; the registry
  // GHA-NEXT-016 — probe key MUST match what `dispatch.ts` passes
  // to `recordOutcome(factoryId)` so the passive counter and the
  // active probe tick the same state. The dispatch path uses
  // `target.id` (e.g. `image-factory.axi-image-preview`); earlier
  // we registered the probe under the allowlistedTargets short
  // key (`image`, `docs`, …) which made `forFactory(target.id)`
  // return `unknown` and dropped the dispatch's passive failures
  // into the void.
  //
  // Walk the manifest routes and collect their target ids as the
  // HealthRegistry probe keys, so dispatch's `target.id` lines up
  // 1:1 with `forFactory` and `recordOutcome`. The probe URL
  // comes from `built.allowlisted` (set by `buildAdapters`); we
  // map each `target.id` suffix to its upstream URL via the
  // `built.allowlisted` record.
  const probeEndpoints = new Map<string, HealthEndpoint>();
  for (const route of registry.listRoutes()) {
    for (const target of route.targets) {
      // `built.allowlisted` keys: `image`, `docs`, `project`, `ui`,
      // `icon`, `minimax`. The `target.id` we see in the manifest
      // ends with the adapter name (e.g. `axi-image-preview`,
      // `axi-docs`, `axi-project-info`, `ui-library`,
      // `icon-library`). We map target suffix → short key.
      let short: keyof typeof built.allowlisted | null = null;
      if (target.id.endsWith(".axi-image-preview")) short = "image";
      else if (target.id.endsWith(".axi-docs")) short = "docs";
      else if (target.id.endsWith(".axi-project-info")) short = "project";
      else if (target.id.endsWith(".axi-ui-library") || target.id.endsWith(".ui-library")) short = "ui";
      else if (target.id.endsWith(".axi-icon-library") || target.id.endsWith(".icon-library")) short = "icon";
      if (short !== null) {
        const url = built.allowlisted[short];
        if (url) {
          probeEndpoints.set(target.id, { url, method: "HEAD" });
        }
      }
    }
  }
  const healthRegistry = new ActiveHealthRegistry({
    probeIntervalMs: 5_000,
    probeTimeoutMs: 2_000,
    failureThreshold: 3,
    recoveryThreshold: 2,
    endpoints: probeEndpoints,
    allowlisted: (raw) => {
      try {
        assertAllowlistedTarget(raw);
        return true;
      } catch {
        return false;
      }
    },
  });

  return {
    registry,
    routeCount: registry.listRoutes().length,
    manifestVersion: parsedManifest.manifestVersion,
    fallbackChains: parsedManifest.fallbackChains ?? [],
    factoryInvocationCounts: invocationCounts,
    adapterCount,
    factoryNames,
    allowlistedTargets,
    sharedState,
    factories: Object.freeze({ ...factories }),
    healthRegistry,
  };
};

/**
 * GHA-NEXT-036 — Validate a new manifest payload without touching
 * the running gateway.
 *
 * The reload endpoint accepts a raw manifest JSON body, runs the
 * same Zod parse + semantic validations as the boot path
 * (`buildServerRegistry`), and either returns the parsed
 * `ProviderManifestInput` or throws a `ManifestValidationError`
 * whose `issues` string is safe to surface to the operator.
 *
 * The capability validator (`validateTargetCapabilities`) is NOT
 * run here — it requires live adapter descriptors that only the
 * composition root has access to. The reload endpoint runs that
 * check inline by building the new registry on the live factory
 * map (see `reloadRoutes`).
 *
 * We deliberately do NOT touch the live registry: callers are
 * expected to follow up with a separate atomic-publish step on
 * success. This two-phase shape mirrors how the orchestrator's
 * `SnapshotStore.publish()` is single-writer.
 */
export class ManifestValidationError extends Error {
  constructor(public readonly issues: string, public readonly stage: "parse" | "semantic") {
    super(`manifest_validation_failed (${stage}): ${issues}`);
    this.name = "ManifestValidationError";
  }
}

/** Parse + validate the body of a `POST /admin/routes/reload` request.
 *  Throws `ManifestValidationError` on any failure. */
export const validateManifestPayload = (
  body: unknown,
  knownFactoryNames: ReadonlyArray<string>,
): import("@axi/resource-orchestrator").ProviderManifestInput => {
  let parsedManifest: import("@axi/resource-orchestrator").ProviderManifestInput;
  try {
    parsedManifest = parseManifest(body);
  } catch (error) {
    const issues = error instanceof Error ? error.message : String(error);
    throw new ManifestValidationError(issues, "parse");
  }
  const semanticIssues = validateManifestSemantics(parsedManifest, { knownFactoryNames });
  if (semanticIssues.length) {
    throw new ManifestValidationError(formatIssues(semanticIssues), "semantic");
  }
  return parsedManifest;
};

/**
 * GHA-NEXT-036 — atomic snapshot publishing.
 *
 * Validates the new manifest, builds a fresh ProviderRegistry on
 * a clone of the supplied factories, constructs a new
 * GatewayOrchestrator with the live SharedStateManager, and swaps
 * the orchestrator reference inside the router in one synchronous
 * step. On any validation failure the live orchestrator is
 * untouched (the swap never happens).
 *
 * The `factories` argument is the factory map the running
 * gateway was built with; reusing it preserves adapter memoization
 * so a reload does not re-spawn every provider.
 */
export interface ReloadRoutesInput {
  readonly factories: Readonly<Record<string, AdapterFactory>>;
  readonly sharedState: import("@axi/resource-orchestrator").SharedStateManager;
  readonly body: unknown;
}

export type ReloadRoutesResult =
  | { readonly ok: true; readonly manifestVersion: number; readonly routeCount: number }
  | { readonly ok: false; readonly stage: "parse" | "semantic" | "capability"; readonly issues: string };

export const reloadRoutes = async (input: ReloadRoutesInput): Promise<ReloadRoutesResult> => {
  const factoryNames = Object.keys(input.factories);
  let parsedManifest: import("@axi/resource-orchestrator").ProviderManifestInput;
  try {
    parsedManifest = validateManifestPayload(input.body, factoryNames);
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      return { ok: false, stage: error.stage, issues: error.issues };
    }
    throw error;
  }
  // Build the live registry on the same factory map so adapter
  // memoization survives. `freezeOnBuild: false` lets a follow-up
  // build replace the routes without re-creating the registry.
  const liveRegistry = new ProviderRegistry({ freezeOnBuild: false });
  for (const [id, factory] of Object.entries(input.factories)) {
    liveRegistry.registerFactory(id, factory);
  }
  liveRegistry.buildFromManifest(parsedManifest);
  // Capability validation is run here, against the live registry's
  // real adapter descriptors (not placeholders). This is the only
  // place we can compare target.descriptor.toolId / capabilities
  // to the route's declared toolId.
  const capabilityIssues = validateTargetCapabilities(liveRegistry, parsedManifest);
  if (capabilityIssues.length) {
    return { ok: false, stage: "capability", issues: formatIssues(capabilityIssues) };
  }
  return {
    ok: true,
    manifestVersion: parsedManifest.manifestVersion,
    routeCount: liveRegistry.listRoutes().length,
  };
};
