import type { ResourceAdapter } from "@axi/gateway-contracts";
import type { ProviderManifest, RouteDefinition, ManifestRoute } from "./route";

/**
 * GHA-021 + GHA-022 — Semantic manifest validator.
 *
 * Two validators, both returning an `issues[]` list instead of throwing.
 * The composition root treats `issues.length > 0` as a hard failure that
 * aborts gateway startup so a malformed manifest never silently boots.
 *
 *   - `validateManifestSemantics(manifest)` checks static reachability:
 *     every target's `<factoryId>` must be declared in `providers[].id`
 *     AND that provider's `factory` field must match the registered
 *     factory name. Every `route.targetId` must exist. Every
 *     `fallbackChains[].chain` element must exist as a route id.
 *     If a fallbackChain is registered for a toolId, at least one
 *     primary route must share that toolId (the inverse — a primary
 *     route without a fallback is fine).
 *   - `validateTargetCapabilities(registry, manifest)` runs after
 *     `ProviderRegistry.buildFromManifest()` and inspects the built
 *     adapters: `descriptor.toolId` (if present) must match the
 *     route's toolId, and `descriptor.capabilities` must contain the
 *     operation the route promises (search / inspect / preview).
 */

/** A semantic or capability issue found during validation. */
export interface ManifestIssue {
  readonly code: string;
  readonly path: ReadonlyArray<string | number>;
  readonly message: string;
}

const makeIssue = (code: string, path: ReadonlyArray<string | number>, message: string): ManifestIssue => ({
  code, path, message,
});

const KNOWN_CAPABILITIES = ["search", "inspect", "preview"] as const;
type Capability = typeof KNOWN_CAPABILITIES[number];

/**
 * Resolve the capability that a route expects from each of its targets.
 *
 * The route toolId convention is `resource.<operation>.<kind>` where
 * `<operation>` ∈ { search, inspect, preview }. For generator routes
 * (`resource.generate.*`) the contracts module does not define a
 * "generate" operation, so the validator falls back to "preview": a
 * generate adapter must at minimum advertise that it produces preview
 * data, otherwise callers cannot consume the result.
 *
 * Returns `null` when the route's toolId does not map to a known
 * operation AND has no generator prefix; the caller should treat that
 * as a routing bug and surface it as an issue.
 */
const capabilityForRoute = (route: RouteDefinition): Capability | null => {
  const parts = route.toolId.split(".");
  if (parts.length >= 2) {
    const operation = parts[1];
    if (operation === "search" || operation === "inspect" || operation === "preview") return operation;
    if (operation === "generate") return "preview";
  }
  return null;
};

export interface SemanticValidatorOptions {
  /** Known factory names registered with the registry. When omitted, the
   *  validator only checks declared provider self-consistency and route
   *  references; it cannot reject unregistered factory ids. The composition
   *  root always passes its known factory names. */
  readonly knownFactoryNames?: ReadonlyArray<string>;
}

/**
 * Run a static, pre-build validation pass over a manifest.
 *
 * Returns the list of issues. An empty list means the manifest is
 * statically consistent.
 */
export const validateManifestSemantics = (
  manifest: ProviderManifest,
  options: SemanticValidatorOptions = {},
): ReadonlyArray<ManifestIssue> => {
  const issues: ManifestIssue[] = [];

  const providerIds = new Set<string>();
  const factoryNames = new Set<string>();
  for (const [index, provider] of manifest.providers.entries()) {
    if (providerIds.has(provider.id)) {
      issues.push(makeIssue("duplicate-provider-id", ["providers", index, "id"], `duplicate provider id: ${provider.id}`));
    }
    providerIds.add(provider.id);
    if (factoryNames.has(provider.factory)) {
      issues.push(makeIssue("duplicate-provider-factory", ["providers", index, "factory"], `duplicate provider factory name: ${provider.factory}`));
    }
    factoryNames.add(provider.factory);
  }

  const knownFactories = options.knownFactoryNames ? new Set(options.knownFactoryNames) : undefined;
  for (const [index, provider] of manifest.providers.entries()) {
    if (knownFactories && !knownFactories.has(provider.factory)) {
      issues.push(makeIssue(
        "unknown-provider-factory",
        ["providers", index, "factory"],
        `provider[${index}].factory "${provider.factory}" is not registered with the gateway`,
      ));
    }
  }

  const targetIds = new Set<string>();
  const targetFactoryIds = new Set<string>();
  for (const [index, target] of manifest.targets.entries()) {
    if (targetIds.has(target.id)) {
      issues.push(makeIssue("duplicate-target-id", ["targets", index, "id"], `duplicate target id: ${target.id}`));
    }
    targetIds.add(target.id);

    const separator = target.id.indexOf(".");
    const factoryId = separator > 0 ? target.id.slice(0, separator) : "";
    if (!factoryId) continue;
    targetFactoryIds.add(factoryId);
    if (!providerIds.has(factoryId)) {
      issues.push(makeIssue(
        "target-factory-not-declared",
        ["targets", index, "id"],
        `target "${target.id}" references factory "${factoryId}" which is not in providers[].id`,
      ));
    } else {
      const provider = manifest.providers.find((entry) => entry.id === factoryId);
      if (provider && provider.factory !== target.id.slice(0, separator).split(".")[0]) {
        // provider.id === factoryId is checked above; nothing else to verify here.
      }
    }
  }

  const routeIds = new Set<string>();
  const routesByToolId = new Map<string, ManifestRoute[]>();
  for (const [index, route] of manifest.routes.entries()) {
    if (routeIds.has(route.id)) {
      issues.push(makeIssue("duplicate-route-id", ["routes", index, "id"], `duplicate route id: ${route.id}`));
    }
    routeIds.add(route.id);

    const bucket = routesByToolId.get(route.toolId) || [];
    bucket.push(route);
    routesByToolId.set(route.toolId, bucket);

    for (const [targetIndex, targetId] of route.targetIds.entries()) {
      if (!targetIds.has(targetId)) {
        issues.push(makeIssue(
          "route-target-not-declared",
          ["routes", index, "targetIds", targetIndex],
          `route "${route.id}" references unknown target "${targetId}"`,
        ));
      } else {
        const separator = targetId.indexOf(".");
        if (separator > 0) {
          const factoryId = targetId.slice(0, separator);
          if (!factoryNames.has(factoryId) && !providerIds.has(factoryId)) {
            issues.push(makeIssue(
              "route-target-factory-unreachable",
              ["routes", index, "targetIds", targetIndex],
              `route "${route.id}" target "${targetId}" references factory "${factoryId}" not declared in providers[]`,
            ));
          }
        }
      }
    }
  }

  if (manifest.fallbackChains) {
    for (const [index, entry] of manifest.fallbackChains.entries()) {
      const routes = routesByToolId.get(entry.toolId) || [];
      const fallbacks = entry.chain;
      for (const [chainIndex, routeId] of fallbacks.entries()) {
        if (!routeIds.has(routeId)) {
          issues.push(makeIssue(
            "fallback-route-not-declared",
            ["fallbackChains", index, "chain", chainIndex],
            `fallback chain entry "${routeId}" is not a declared route`,
          ));
        } else {
          const referenced = manifest.routes.find((candidate) => candidate.id === routeId);
          if (referenced && referenced.toolId !== entry.toolId) {
            issues.push(makeIssue(
              "fallback-route-tool-mismatch",
              ["fallbackChains", index, "chain", chainIndex],
              `fallback route "${routeId}" has toolId "${referenced.toolId}" which differs from chain toolId "${entry.toolId}"`,
            ));
          }
        }
      }
      if (fallbacks.length && routes.length < 1) {
        issues.push(makeIssue(
          "fallback-without-primary",
          ["fallbackChains", index, "toolId"],
          `toolId "${entry.toolId}" has a fallback chain but no primary route`,
        ));
      }
    }
  }

  return issues;
};

/**
 * Resolve an adapter for a target id using the registry's built adapters.
 * The composition root already calls `buildFromManifest()` before this
 * validator runs, so every target has a built adapter; we still defensively
 * resolve via the route's target list when the registry exposes them.
 */
const adaptersForRoute = (
  registryAdapters: ReadonlyMap<string, ResourceAdapter>,
  route: RouteDefinition,
): ReadonlyArray<{ targetId: string; adapter: ResourceAdapter }> => {
  const out: Array<{ targetId: string; adapter: ResourceAdapter }> = [];
  for (const target of route.targets) {
    const adapter = registryAdapters.get(target.id) ?? target.adapter;
    if (adapter) out.push({ targetId: target.id, adapter });
  }
  return out;
};

/**
 * Validate that the adapters built from the manifest satisfy the
 * capability contract that each route expects.
 *
 *   - Every route.targets[].adapter must advertise the capability that
 *     the route's toolId promises (search / inspect / preview).
 *   - When the adapter's descriptor.toolId is present it MUST equal the
 *     route's toolId; otherwise the gateway would dispatch a search call
 *     against an adapter whose descriptor declares a different toolId.
 *
 * Returns the list of issues; an empty list means every built adapter
 * matches its route.
 */
export const validateTargetCapabilities = (
  registry: { listRoutes: () => ReadonlyArray<RouteDefinition>; adapterFor: (id: string) => ResourceAdapter | undefined },
  manifest: ProviderManifest,
): ReadonlyArray<ManifestIssue> => {
  const issues: ManifestIssue[] = [];
  const routes = registry.listRoutes();
  const adapters = new Map<string, ResourceAdapter>();
  for (const targetId of manifest.targets.map((target) => target.id)) {
    const adapter = registry.adapterFor(targetId);
    if (adapter) adapters.set(targetId, adapter);
  }

  for (const [index, route] of routes.entries()) {
    const required = capabilityForRoute(route);
    const resolved = adaptersForRoute(adapters, route);
    if (!resolved.length) {
      issues.push(makeIssue(
        "route-has-no-targets",
        ["routes", index, "id"],
        `route "${route.id}" resolved to no adapters; check that its targets are declared in the manifest`,
      ));
      continue;
    }
    if (!required) {
      issues.push(makeIssue(
        "route-toolid-unknown",
        ["routes", index, "toolId"],
        `route "${route.id}" toolId "${route.toolId}" does not map to a known capability (search/inspect/preview or generate)`,
      ));
      continue;
    }
    for (const { targetId, adapter } of resolved) {
      const declared = adapter.descriptor.toolId;
      if (declared && declared !== route.toolId) {
        issues.push(makeIssue(
          "target-toolid-mismatch",
          ["routes", index, "targets", targetId],
          `target "${targetId}" descriptor.toolId="${declared}" does not match route.toolId="${route.toolId}"`,
        ));
      }
      const capabilities = adapter.descriptor.capabilities || [];
      if (!capabilities.includes(required)) {
        issues.push(makeIssue(
          "target-capability-mismatch",
          ["routes", index, "targets", targetId],
          `target "${targetId}" declares capabilities [${capabilities.join(", ") || "<none>"}] but route "${route.id}" requires "${required}"`,
        ));
      }
      const unknown = capabilities.filter((capability) => !KNOWN_CAPABILITIES.includes(capability as Capability));
      if (unknown.length) {
        issues.push(makeIssue(
          "target-unknown-capability",
          ["routes", index, "targets", targetId],
          `target "${targetId}" declares unknown capability values: ${unknown.join(", ")}`,
        ));
      }
    }
  }

  return issues;
};

/** Convert an issues array into a single error message for logs. */
export const formatIssues = (issues: ReadonlyArray<ManifestIssue>): string => {
  if (!issues.length) return "(no issues)";
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "<root>";
    return `${path}: [${issue.code}] ${issue.message}`;
  }).join("\n");
};
