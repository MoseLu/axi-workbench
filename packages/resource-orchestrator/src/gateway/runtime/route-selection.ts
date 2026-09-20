import type { Intent } from "@axi/gateway-contracts";
import type { RouteDefinition } from "../route";
import { scoreFor } from "../predicates";

/**
 * GHA-037 — deterministic route selection with explicit fallback chains.
 *
 * The previous `selectRoute` returned the first route whose predicates
 * matched; that conflates "specificity" with "registration order". This
 * module:
 *
 *   1. Scores every route whose `toolId` matches AND whose predicates
 *      all match the intent. Score = `scoreFor(predicates)` (sum of
 *      per-predicate scores, defaulting to 1 each).
 *   2. Ranks by (-score, -predicateCount, route.id) so the most
 *      specific route wins, ties break on fewer predicates (which is
 *      the *less* specific one — wait, no: more predicates = more
 *      specific. Read again). Tie-break order is intentionally
 *      lexicographic so two manifests with the same specificity always
 *      produce the same dispatch order.
 *   3. Walks the fallback chain only AFTER the primary route has fully
 *      exhausted its target pool. Cancellation of the primary never
 *      triggers the fallback.
 */

export interface RouteScore {
  readonly route: RouteDefinition;
  readonly score: number;
  readonly predicateCount: number;
}

const routeScore = (intent: Intent, route: RouteDefinition): RouteScore | null => {
  if (route.predicates.length === 0) return null;
  let allMatch = true;
  for (const predicate of route.predicates) {
    if (!predicate.matches(intent)) {
      allMatch = false;
      break;
    }
  }
  if (!allMatch) return null;
  const score = scoreFor(intent, route.predicates);
  if (score < 0) return null;
  return { route, score, predicateCount: route.predicates.length };
};

const compareScores = (a: RouteScore, b: RouteScore): number => {
  if (a.score !== b.score) return b.score - a.score; // higher score wins
  if (a.predicateCount !== b.predicateCount) return b.predicateCount - a.predicateCount; // more predicates = more specific
  return a.route.id.localeCompare(b.route.id); // stable tie-break
};

/** Pick the highest-scoring route that matches the intent. Routes with
 *  identical scores tie-break on predicate count, then on id. Returns
 *  `undefined` when no route matches. */
export const selectBestRoute = (
  routes: ReadonlyArray<RouteDefinition>,
  toolId: string,
  intent: Intent,
): RouteDefinition | undefined => {
  let best: RouteScore | null = null;
  for (const route of routes) {
    if (route.toolId !== toolId) continue;
    const scored = routeScore(intent, route);
    if (!scored) continue;
    if (!best || compareScores(scored, best) < 0) best = scored;
  }
  return best?.route;
};

/** The explicit fallback chain for a toolId, in declared order. The
 *  caller passes the registry's chain (or any sequence of route ids);
 *  this function filters out routes whose toolId does not match so a
 *  typo in the manifest cannot route a fallback to a different
 *  toolId. Duplicate ids collapse to a single entry. */
export const selectFallbackChain = (
  routes: ReadonlyArray<RouteDefinition>,
  toolId: string,
  chain: ReadonlyArray<string>,
): RouteDefinition[] => {
  const byId = new Map<string, RouteDefinition>();
  for (const route of routes) byId.set(route.id, route);
  const resolved: RouteDefinition[] = [];
  const seen = new Set<string>();
  for (const id of chain) {
    if (seen.has(id)) continue;
    seen.add(id);
    const route = byId.get(id);
    if (!route) continue;
    if (route.toolId !== toolId) continue;
    resolved.push(route);
  }
  return resolved;
};

/** Diagnostic: return all matching routes ranked by score. Useful for
 *  tests that want to assert "the more specific route beat the generic
 *  one" rather than just "the first declared route won". */
export const rankRoutes = (
  routes: ReadonlyArray<RouteDefinition>,
  toolId: string,
  intent: Intent,
): ReadonlyArray<RouteScore> => {
  const matches: RouteScore[] = [];
  for (const route of routes) {
    if (route.toolId !== toolId) continue;
    const scored = routeScore(intent, route);
    if (scored) matches.push(scored);
  }
  return matches.sort(compareScores);
};