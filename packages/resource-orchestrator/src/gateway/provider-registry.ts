import type { ResourceAdapter } from "@axi/gateway-contracts";
import type {
  AdapterFactory,
  ManifestRoute,
  ManifestTarget,
  ProviderManifest,
  RouteDefinition,
  Target,
} from "./route";
import type { Predicate } from "./route";
import { builderForPredicateId } from "./predicates";

/**
 * ProviderRegistry — the gateway's only writer for adapter instances.
 *
 * Manifest binding convention:
 *   - manifest.providers[].id        = factory key registered via registerFactory()
 *   - manifest.providers[].factory   = same factory key (kept for self-description)
 *   - manifest.targets[].id          = "<factoryId>.<providerId>"  (strict two-level)
 *   - manifest.targets[].providerId  = adapter descriptor id
 *
 * Routes are tried in registration order; the first route whose predicates
 * all match and whose toolId equals the requested one wins. Subsequent
 * matching routes are not tried.
 */

export class ProviderAlreadyRegisteredError extends Error {
  constructor(id: string) {
    super(`Provider already registered: ${id}`);
    this.name = "ProviderAlreadyRegisteredError";
  }
}

export class UnknownTargetError extends Error {
  constructor(targetId: string) {
    super(`Unknown target id in route: ${targetId}`);
    this.name = "UnknownTargetError";
  }
}

export interface RegistryOptions {
  /** When true, buildFromManifest() freezes the registry. */
  freezeOnBuild?: boolean;
}

export class ProviderRegistry {
  private readonly factories = new Map<string, AdapterFactory>();
  private readonly adapters = new Map<string, ResourceAdapter>();
  private readonly routes: RouteDefinition[] = [];
  private frozen = false;
  private readonly fallbackChains = new Map<string, ReadonlyArray<string>>();

  constructor(private readonly options: RegistryOptions = {}) {}

  /** Register an adapter factory by id. The factory runs lazily on build(). */
  registerFactory(id: string, factory: AdapterFactory): this {
    this.assertMutable();
    if (this.factories.has(id)) throw new ProviderAlreadyRegisteredError(id);
    this.factories.set(id, factory);
    return this;
  }

  /** Register a pre-built adapter directly. Useful for tests and decorators. */
  registerAdapter(id: string, adapter: ResourceAdapter): this {
    this.assertMutable();
    if (this.adapters.has(id)) throw new ProviderAlreadyRegisteredError(id);
    this.adapters.set(id, adapter);
    return this;
  }

  /** Append a route. Routes are tried in registration order. */
  addRoute(route: RouteDefinition): this {
    this.assertMutable();
    this.routes.push(route);
    return this;
  }

  /** Add a fallback chain for a toolId; consulted after normal targets fail. */
  setFallbackChain(toolId: string, chain: ReadonlyArray<string>): this {
    this.assertMutable();
    this.fallbackChains.set(toolId, chain);
    return this;
  }

  /**
   * Build concrete Target[] + RouteDefinition[] from a manifest.
   *
   * Each target id must be "<factoryId>.<providerId>" with both halves
   * non-empty. The factory must return an adapter whose descriptor.id
   * matches providerId.
   */
  buildFromManifest(manifest: ProviderManifest): this {
    this.assertMutable();

    const providerById = new Map<string, { factory: string }>(
      manifest.providers.map((provider) => [provider.id, { factory: provider.factory }] as const),
    );

    for (const target of manifest.targets) {
      const separator = target.id.indexOf(".");
      if (separator <= 0 || separator === target.id.length - 1) {
        throw new UnknownTargetError(`${target.id} (expected "<factoryId>.<providerId>")`);
      }
      const factoryId = target.id.slice(0, separator);
      const provider = providerById.get(factoryId);
      if (!provider) throw new UnknownTargetError(`${target.id} (factory ${factoryId} not declared in providers)`);
      const factory = this.factories.get(provider.factory);
      if (!factory) throw new UnknownTargetError(`${target.id} (factory ${provider.factory} not registered)`);
      const built = factory();
      const list = Array.isArray(built) ? built : [built];
      const adapter = list.find((candidate) => candidate.descriptor.id === target.providerId);
      if (!adapter) {
        throw new UnknownTargetError(`${target.id} (provider ${target.providerId} not in factory ${factoryId})`);
      }
      this.adapters.set(target.id, adapter);
    }

    const targetById = new Map<string, ManifestTarget>(
      manifest.targets.map((target) => [target.id, target] as const),
    );

    for (const route of manifest.routes) {
      const targets = route.targetIds.map((targetId) => {
        const spec = targetById.get(targetId);
        if (!spec) throw new UnknownTargetError(targetId);
        const adapter = this.adapters.get(targetId);
        if (!adapter) throw new UnknownTargetError(targetId);
        return this.toTarget(spec, adapter);
      });
      this.routes.push(this.toRoute(route, targets));
    }

    if (manifest.fallbackChains) {
      for (const entry of manifest.fallbackChains) this.fallbackChains.set(entry.toolId, entry.chain);
    }
    if (this.options.freezeOnBuild) this.frozen = true;
    return this;
  }

  /** Lock the registry. After this, any further register* call throws. */
  freeze(): this {
    this.frozen = true;
    return this;
  }

  /** Snapshot of all routes, in registration order. */
  listRoutes(): ReadonlyArray<RouteDefinition> {
    return this.routes.slice();
  }

  /** Lookup a route by toolId. Returns the first match (routes are tried in order). */
  routeFor(toolId: string): RouteDefinition | undefined {
    return this.routes.find((route) => route.toolId === toolId);
  }

  /** Fallback chain for a toolId; empty array when none is registered. */
  fallbackChainFor(toolId: string): ReadonlyArray<string> {
    return this.fallbackChains.get(toolId) || [];
  }

  /** Test-only: peek at the registered adapter for a target id. */
  adapterFor(targetId: string): ResourceAdapter | undefined {
    return this.adapters.get(targetId);
  }

  private toTarget(spec: ManifestTarget, adapter: ResourceAdapter): Target {
    return {
      id: spec.id,
      adapter,
      weight: spec.weight ?? 1,
      timeoutMs: spec.timeoutMs ?? 30_000,
      healthEndpoint: spec.healthEndpoint,
      fallback: spec.fallback ?? false,
    };
  }

  private toRoute(spec: ManifestRoute, targets: ReadonlyArray<Target>): RouteDefinition {
    const predicates = spec.predicates
      .map((id) => builderForPredicateId(id))
      .filter((predicate): predicate is Predicate => Boolean(predicate));
    if (predicates.length !== spec.predicates.length) {
      const missing = spec.predicates.filter((id) => !builderForPredicateId(id));
      throw new Error(`Unknown predicate id(s) in route ${spec.id}: ${missing.join(", ")}`);
    }
    return {
      id: spec.id,
      toolId: spec.toolId,
      description: spec.description,
      predicates,
      targets,
      filters: { pre: [], post: [] },
      loadBalancer: spec.loadBalancer ?? "weighted-round-robin",
      concurrency: spec.concurrency,
      cacheTtlMs: spec.cacheTtlMs,
      circuit: spec.circuit,
      // GHA-NEXT-001: wire every manifest policy field through to the runtime.
      // route.idempotent / route.retry / route.backpressure are consumed by
      // GatewayOrchestrator.policyForRoute() which prefers the explicit
      // manifest value and falls back to toolId-derived / hardcoded defaults.
      idempotent: spec.idempotent,
      retry: spec.retry,
      backpressure: spec.backpressure,
    };
  }

  private assertMutable(): void {
    if (this.frozen) throw new Error("ProviderRegistry is frozen");
  }
}
