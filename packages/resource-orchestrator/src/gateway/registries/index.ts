/**
 * GHA-NEXT-005 — Gateway registries barrel.
 *
 * Exports the three optional dependency-injection registries that let
 * future lanes (cache unification, coalescing merge, active health probing,
 * shared state) hook into `GatewayOrchestrator` without modifying the
 * dispatch path.
 *
 * Usage:
 * ```ts
 * import { NoopRouteRegistry, NoopPolicyRegistry, NoopHealthRegistry } from "./registries";
 * // or, to inject a real implementation:
 * import { RouteRegistry, PolicyRegistry, HealthRegistry } from "./registries";
 * ```
 */

export {
  NoopRouteRegistry,
  type RouteRegistry,
  type RouteRegistrySnapshot,
} from "./route-registry";

export {
  NoopPolicyRegistry,
  type PolicyRegistry,
  type PolicyRegistryOptions,
} from "./policy-registry";

export {
  NoopHealthRegistry,
  ActiveHealthRegistry,
  deriveOverall,
  HEALTH_STATUS_TO_COMPONENT,
  type HealthRegistry,
  type HealthRegistrySnapshot,
  type HealthCheck,
  type HealthStatus,
  type FactoryHealth,
  type FactorySource,
  type HealthEndpoint,
  type ActiveHealthRegistryOptions,
} from "./health-registry";
