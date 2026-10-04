/**
 * Dev-only capability check against the `@axi/*` public API snapshot.
 *
 * Why this file exists:
 *   - `apps/workbench/src/lib/breadcrumbs.ts` and `apps/workbench/src/App.tsx`
 *     hard-code the list of `@axi/*` symbols and routes they care about.
 *   - There is no automated cross-check that the symbols we consume still
 *     exist in `foundation/axi-ui/docs/axi-ui/public-api.snapshot.json`.
 *   - When `axi-ui` renames or retires a symbol, workbench fails silently at
 *     runtime.
 *
 * Strategy:
 *   - Only active when `import.meta.env.DEV` is true; Vite tree-shakes the
 *     entire import out of production bundles.
 *   - At startup, gather every named import from `@axi/*` packages across
 *     `src/**` (ts/tsx files) via `import.meta.glob('?raw', { eager: true })`.
 *   - Load the JSON snapshot from `foundation/axi-ui` (the relative path is
 *     resolved against this file in `apps/workbench/src/lib/`) and compare
 *     declared vs. imported symbols.
 *   - Emit a `console.warn` listing any missing symbols, or a `console.info`
 *     success line on a clean run.
 *
 * Notes:
 *   - We only collect PascalCase names because that is the convention for
 *     component / hook / type / constant exports in `@axi/*`.
 *   - Imports outside `src/**` (e.g. test fixtures, scripts) are not scanned.
 *   - The relative path depends on the workbench monorepo layout; do not move
 *     this file without updating `SNAPSHOT_PATH` and `tsconfig.json#include`.
 */

import type AxiUiPublicApiSnapshot from '../../../../../../foundation/axi-ui/docs/axi-ui/public-api.snapshot.json';

/**
 * Resolved at compile time against this file's location.
 * From `apps/workbench/src/lib/` we climb six levels to reach
 * `/Volumes/code/workspace/` and then descend into `foundation/axi-ui/`.
 */
const SNAPSHOT_PATH =
  '../../../../../../foundation/axi-ui/docs/axi-ui/public-api.snapshot.json' as const;

type PublicApiSnapshot = typeof AxiUiPublicApiSnapshot;

interface PublicApiSymbol {
  name?: unknown;
}

interface PublicApiPackage {
  symbols?: PublicApiSymbol[];
}

interface PublicApiSnapshotShape {
  packages?: PublicApiPackage[];
}

/**
 * Match a named-import clause such as `{ AxiFoo, AxiBar as Bar }`.
 * Captures the inner symbol list. Aliased imports keep the local name.
 */
const NAMED_IMPORT_RE = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s*from\s*['"]@axi\/[^'"]+['"]/g;

/** Match a default import such as `import AxiFoo from '@axi/core'`. */
const DEFAULT_IMPORT_RE = /import\s+(?:type\s+)?([A-Z][A-Za-z0-9]*)\s*(?:,\s*\{[\s\S]*?\})?\s*from\s*['"]@axi\/[^'"]+['"]/g;

/** Match a namespace import such as `import * as Foo from '@axi/core'`. */
const NAMESPACE_IMPORT_RE = /import\s+\*\s+as\s+([A-Z][A-Za-z0-9]*)\s+from\s*['"]@axi\/[^'"]+['"]/g;

/** Pull a single PascalCase identifier out of a named-import clause. */
const IDENT_RE = /\b([A-Z][A-Za-z0-9]*)\b/g;

/**
 * Vite glob — eagerly resolves every `.ts`/`.tsx` file under `src/` to its
 * raw source text. Compiles away in production because the entire module is
 * only imported behind `import.meta.env.DEV` (see `main.tsx`).
 */
const SOURCE_FILES_GLOB = import.meta.glob('/src/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

function collectImportedAxiNames(): string[] {
  const names = new Set<string>();
  for (const source of Object.values(SOURCE_FILES_GLOB)) {
    if (typeof source !== 'string') continue;

    NAMED_IMPORT_RE.lastIndex = 0;
    let namedMatch: RegExpExecArray | null;
    while ((namedMatch = NAMED_IMPORT_RE.exec(source))) {
      const clause = namedMatch[1];
      IDENT_RE.lastIndex = 0;
      let identMatch: RegExpExecArray | null;
      while ((identMatch = IDENT_RE.exec(clause))) {
        names.add(identMatch[1]);
      }
    }

    DEFAULT_IMPORT_RE.lastIndex = 0;
    let defaultMatch: RegExpExecArray | null;
    while ((defaultMatch = DEFAULT_IMPORT_RE.exec(source))) {
      names.add(defaultMatch[1]);
    }

    NAMESPACE_IMPORT_RE.lastIndex = 0;
    let nsMatch: RegExpExecArray | null;
    while ((nsMatch = NAMESPACE_IMPORT_RE.exec(source))) {
      names.add(nsMatch[1]);
    }
  }
  return Array.from(names).sort();
}

function collectDeclaredSnapshotNames(snapshot: PublicApiSnapshotShape): Set<string> {
  const declared = new Set<string>();
  for (const pkg of snapshot.packages ?? []) {
    for (const sym of pkg.symbols ?? []) {
      if (typeof sym.name === 'string') {
        declared.add(sym.name);
      }
    }
  }
  return declared;
}

/**
 * Public entry point — invoke once at app startup in dev mode.
 * Never throws; logs problems via `console.warn`.
 */
export async function runAxiUiCapabilityCheck(): Promise<void> {
  if (!import.meta.env.DEV) return;

  try {
    const mod = await import(/* @vite-ignore */ `${SNAPSHOT_PATH}`);
    const rawSnapshot = (mod.default ?? mod) as PublicApiSnapshot;
    const snapshot: PublicApiSnapshotShape = rawSnapshot as unknown as PublicApiSnapshotShape;
    const declared = collectDeclaredSnapshotNames(snapshot);

    const imported = collectImportedAxiNames();
    const missing = imported.filter((name) => !declared.has(name));

    if (missing.length > 0) {
      console.warn(
        `[axi-ui] capability check: ${missing.length} imported @axi/* symbol(s) not declared in public-api.snapshot.json.`,
        missing,
      );
    } else if (imported.length > 0) {
      console.info(
        `[axi-ui] capability check passed (${imported.length} symbol(s) verified across ${snapshot.packages?.length ?? 0} package(s))`,
      );
    } else {
      console.info('[axi-ui] capability check: no @axi/* imports found in src/.');
    }
  } catch (err) {
    console.warn('[axi-ui] capability check failed to load public-api.snapshot.json:', err);
  }
}