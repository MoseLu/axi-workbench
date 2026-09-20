import type { Intent } from "@axi/gateway-contracts";
import type { Predicate } from "./route";

/**
 * Built-in predicates.
 *
 * Predicates are pure, side-effect-free, and synchronous. They encode the
 * rules that turn a planner intent into "which route wins?". New predicates
 * can be registered via registerPredicateBuilder().
 *
 * Manifest predicate id convention (kept stable across the resource-inventory
 * gateway.manifest.json schema):
 *   - by-resource-kind:<kind>     — matches when intent.resourceKinds contains <kind>
 *   - by-tag:<tag>                — matches when intent.constraints.tag === <tag>
 *   - by-language:<lang>          — matches when intent.constraints.language === <lang>
 *   - by-domain:<domain>          — matches when intent.constraints.domain === <domain>
 *   - has-orientation             — matches when constraints.orientation is valid
 *   - always-true                 — matches everything
 *   - intent-kind:<kind>          — alias of by-resource-kind:<kind>
 *
 * Legacy ids (intent-kind-image, image-or-web, knowledge-or-doc, etc.) remain
 * supported for backward compatibility with the app-side manifest.
 */

const hasKind = (intent: Intent, kind: string): boolean =>
  intent.resourceKinds.includes(kind);

const queryText = (intent: Intent): string =>
  typeof intent.constraints.query === "string" ? intent.constraints.query : "";

const constraintText = (intent: Intent, key: string): string | undefined => {
  const value = intent.constraints[key];
  return typeof value === "string" ? value : undefined;
};

class IntentKindPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly kinds: ReadonlyArray<string>) {
    this.id = `by-resource-kind(${kinds.join("|") || "*"})`;
  }
  matches(intent: Intent): boolean {
    if (!this.kinds.length) return true;
    return this.kinds.some((kind) => hasKind(intent, kind));
  }
}

class QueryRegexPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly pattern: RegExp) {
    this.id = `query-regex(${pattern.source})`;
  }
  matches(intent: Intent): boolean {
    const text = queryText(intent);
    if (!text) return false;
    if (this.pattern.flags.includes("i")) return this.pattern.test(text);
    return new RegExp(this.pattern.source, `${this.pattern.flags}i`).test(text);
  }
}

class HasOrientationPredicate implements Predicate {
  readonly id = "has-orientation";
  matches(intent: Intent): boolean {
    const value = intent.constraints.orientation;
    return value === "landscape" || value === "portrait" || value === "original";
  }
}

class ByTagPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly tag: string) {
    this.id = `by-tag(${tag})`;
  }
  matches(intent: Intent): boolean {
    return constraintText(intent, "tag") === this.tag;
  }
}

class ByLanguagePredicate implements Predicate {
  readonly id: string;
  constructor(private readonly language: string) {
    this.id = `by-language(${language})`;
  }
  matches(intent: Intent): boolean {
    return constraintText(intent, "language") === this.language;
  }
}

class ByDomainPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly domain: string) {
    this.id = `by-domain(${domain})`;
  }
  matches(intent: Intent): boolean {
    return constraintText(intent, "domain") === this.domain;
  }
}

class ToolIdPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly toolId: string) {
    this.id = `tool-id(${toolId})`;
  }
  matches(_intent: Intent): boolean {
    return true; // tool id is matched at the route level, this is always-true.
  }
  score(): number {
    return this.toolId ? 1 : 0;
  }
}

class ExpressionPredicate implements Predicate {
  readonly id: string;
  constructor(
    private readonly fn: (intent: Intent) => boolean,
    private readonly label = "expression",
  ) {
    this.id = `expression(${label})`;
  }
  matches(intent: Intent): boolean {
    return this.fn(intent);
  }
}

class AlwaysTruePredicate implements Predicate {
  readonly id = "always-true";
  matches(): boolean {
    return true;
  }
}

class AndPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly inner: ReadonlyArray<Predicate>) {
    this.id = `and(${inner.map((p) => p.id).join(",")})`;
  }
  matches(intent: Intent): boolean {
    return this.inner.every((predicate) => predicate.matches(intent));
  }
}

class NotPredicate implements Predicate {
  readonly id: string;
  constructor(private readonly inner: Predicate) {
    this.id = `not(${inner.id})`;
  }
  matches(intent: Intent): boolean {
    return !this.inner.matches(intent);
  }
}

export const intentKind = (...kinds: string[]): Predicate => new IntentKindPredicate(kinds);
export const queryRegex = (pattern: RegExp): Predicate => new QueryRegexPredicate(pattern);
export const hasOrientation = (): Predicate => new HasOrientationPredicate();
export const byTag = (tag: string): Predicate => new ByTagPredicate(tag);
export const byLanguage = (language: string): Predicate => new ByLanguagePredicate(language);
export const byDomain = (domain: string): Predicate => new ByDomainPredicate(domain);
export const toolId = (id: string): Predicate => new ToolIdPredicate(id);
export const expression = (fn: (intent: Intent) => boolean, label?: string): Predicate =>
  new ExpressionPredicate(fn, label);
export const alwaysTrue = (): Predicate => new AlwaysTruePredicate();
export const and = (...predicates: ReadonlyArray<Predicate>): Predicate => new AndPredicate(predicates);
export const not = (predicate: Predicate): Predicate => new NotPredicate(predicate);

/** Registry of predicate factories keyed by manifest id. Manifest entries
 *  use these strings to refer to predicates without importing TS classes.
 *
 *  Both new "by-*" ids (resource-inventory convention) and legacy
 *  "intent-kind-*" ids (app manifest) are registered.
 */
const predicateBuilders = new Map<string, () => Predicate>([
  ["intent-kind-image", () => intentKind("image")],
  ["intent-kind-skill", () => intentKind("skill")],
  ["intent-kind-document", () => intentKind("document")],
  ["intent-kind-web", () => intentKind("web")],
  ["intent-kind-workspace", () => intentKind("workspace")],
  ["by-resource-kind-image", () => intentKind("image")],
  ["by-resource-kind-skill", () => intentKind("skill")],
  ["by-resource-kind-document", () => intentKind("document")],
  ["by-resource-kind-web", () => intentKind("web")],
  ["by-resource-kind-workspace", () => intentKind("workspace")],
  ["by-resource-kind:axi-image-preview", () => intentKind("image")],
  ["by-resource-kind:axi-docs", () => intentKind("skill", "document")],
  ["by-resource-kind:axi-workspace-status", () => intentKind("workspace")],
  ["by-resource-kind:minimax-tokenplan", () => intentKind("image", "web")],
  ["has-orientation", () => hasOrientation()],
  ["always-true", () => alwaysTrue()],
  ["image-or-web", () => intentKind("image", "web")],
  ["knowledge-or-doc", () => intentKind("skill", "document")],
]);

export const registerPredicateBuilder = (id: string, build: () => Predicate): void => {
  if (predicateBuilders.has(id)) throw new Error(`Predicate already registered: ${id}`);
  predicateBuilders.set(id, build);
};

export const builderForPredicateId = (id: string): Predicate | undefined => {
  // Legacy alias: bare "<kind>" or "by-resource-kind:<kind>" both go through intentKind.
  if (predicateBuilders.has(id)) {
    return predicateBuilders.get(id)!();
  }
  if (id.startsWith("by-tag:")) return byTag(id.slice("by-tag:".length));
  if (id.startsWith("by-language:")) return byLanguage(id.slice("by-language:".length));
  if (id.startsWith("by-domain:")) return byDomain(id.slice("by-domain:".length));
  return undefined;
};

/** Sum predicate scores for ordered tie-breaks. Routes with no score
 *  function default to 1 so they always rank when they match. */
export const scoreFor = (intent: Intent, predicates: ReadonlyArray<Predicate>): number => {
  let score = 0;
  for (const predicate of predicates) {
    if (!predicate.matches(intent)) return -1;
    score += predicate.score?.(intent) ?? 1;
  }
  return score;
};
