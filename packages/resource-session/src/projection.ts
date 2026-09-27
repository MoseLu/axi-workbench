/**
 * SES-MVP-007 — Map a RunResult (or similar presentation object) into the
 * only snapshot shape allowed in session JSON.
 *
 * Never serialise ResourceCandidate as-is: preview data URLs, absolute
 * paths, provenance payloads and extra facts stay out of the store.
 */

import {
  sessionResultSnapshotSchema,
  type SessionResultSnapshot,
  type SessionResultItemKind,
} from "@axi/gateway-contracts";
import { redactSessionText } from "./redactor";

const ALLOWED_KINDS = new Set<SessionResultItemKind>([
  "image",
  "document",
  "skill",
  "project",
  "ui",
  "icon",
]);

export interface ProjectableResult {
  readonly state?: string;
  readonly explanation?: string;
  readonly error?: string;
  readonly warnings?: readonly string[];
  readonly items?: ReadonlyArray<{
    readonly id: string;
    readonly kind: string;
    readonly title: string;
    readonly preview?: string;
    readonly facts?: Record<string, unknown>;
    readonly provenance?: unknown;
    readonly safety?: string;
  }>;
}

const snapshotStateFor = (state: string | undefined): SessionResultSnapshot["state"] => {
  if (state === "clarifying") return "clarifying";
  if (state === "failed" || state === "cancelled") return "failed";
  return "presenting";
};

const itemKindFor = (kind: string): SessionResultItemKind | null =>
  ALLOWED_KINDS.has(kind as SessionResultItemKind) ? kind as SessionResultItemKind : null;

/**
 * Convert a live run result into a redacted SessionResultSnapshot.
 * Extra keys (preview, path, provenance, raw facts) are dropped.
 */
export const projectResultSnapshot = (result: ProjectableResult): SessionResultSnapshot => {
  const explanationSource = result.explanation ?? result.error ?? "";
  const explanation = explanationSource
    ? redactSessionText(explanationSource).value.slice(0, 800)
    : undefined;
  const warnings = (result.warnings ?? [])
    .map((warning) => redactSessionText(warning).value.slice(0, 400))
    .filter((warning) => warning.length > 0)
    .slice(0, 8);
  const items = (result.items ?? [])
    .map((item) => {
      const kind = itemKindFor(item.kind);
      if (!kind) return null;
      const title = redactSessionText(item.title).value.slice(0, 200);
      if (!title) return null;
      const descriptionRaw = typeof item.facts?.description === "string"
        ? item.facts.description
        : typeof item.facts?.snippet === "string"
          ? item.facts.snippet
          : undefined;
      const description = descriptionRaw
        ? redactSessionText(descriptionRaw).value.slice(0, 400)
        : undefined;
      return {
        id: item.id.slice(0, 120),
        kind,
        title,
        ...(description ? { description } : {}),
        previewAvailable: Boolean(item.preview),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, 20);

  return sessionResultSnapshotSchema.parse({
    state: snapshotStateFor(result.state),
    ...(explanation ? { explanation } : {}),
    warnings,
    items,
  });
};
