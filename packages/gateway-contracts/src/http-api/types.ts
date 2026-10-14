/**
 * Public TypeScript types for the versioned HTTP API contract layer.
 *
 * Lives in its own module so the zod schema definitions in ./schemas
 * can reference a single source of truth for the contract version
 * constant without dragging the whole zod schema graph into other
 * importers.
 */

/** Contract version spoken by every endpoint descriptor in the registry. */
export const apiContractVersion = 1 as const;
