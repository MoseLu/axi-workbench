import type { RouteDefinition } from "../route";

/**
 * GHA-NEXT-005 — RouteRegistry interface.
 *
 * Provides read-only access to the gateway's route table. This interface
 * lets future lanes (GHA-NEXT-007/008 cache/coalescing unification) read
 * the route table without importing GatewayOrchestrator internals, and
 * gives the health subsystem a stable target for route-level observability.
 *
 * The noop implementation is a pass-through that mirrors the routes
 * passed at construction time, preserving the existing behaviour when no
 * registry is injected.
 */

export interface RouteRegistry {
  /**
   * Return a read-only snapshot of every registered route.
   */
  list(): ReadonlyArray<RouteDefinition>;

  /**
   * Look up the primary (non-fallback) route for a tool id.
   * Returns `undefined` when no route matches.
   */
  lookup(toolId: string): RouteDefinition | undefined;

  /**
   * Return a serialisable snapshot for observability endpoints
   * (`/routes`, `/health/ready`). Subclasses can include timestamp,
   * route count, and other diagnostics without changing the interface.
   */
  snapshot(): RouteRegistrySnapshot;
}

export interface RouteRegistrySnapshot {
  readonly routes: ReadonlyArray<RouteDefinition>;
  readonly count: number;
}

/** Noop implementation that mirrors the routes supplied at construction. */
export class NoopRouteRegistry implements RouteRegistry {
  private readonly _routes: ReadonlyArray<RouteDefinition>;

  constructor(routes: ReadonlyArray<RouteDefinition>) {
    this._routes = routes;
  }

  list(): ReadonlyArray<RouteDefinition> {
    return this._routes;
  }

  lookup(toolId: string): RouteDefinition | undefined {
    return this._routes.find(
      (candidate) => candidate.toolId === toolId && !candidate.id.endsWith("-fallback"),
    );
  }

  snapshot(): RouteRegistrySnapshot {
    return {
      routes: this._routes,
      count: this._routes.length,
    };
  }
}
