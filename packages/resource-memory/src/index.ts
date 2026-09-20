/**
 * MEM-MVP — public surface of the memory package.
 *
 * Aggregates the store / redactor / policy / ranker / extractor so
 * `apps/gateway` can import everything from a single module path.
 * No React / Vite / provider / gateway-server imports live here.
 */

export {
  type MemoryStore,
  type UpsertError,
  type UpsertResult,
  type JsonMemoryStoreOptions,
  JsonMemoryStore,
  MemoryLimitExceededError,
  MemorySchemaMismatchError,
} from "./store";

export {
  type RedactionReason,
  type RedactionResult,
  type RedactionOutcome,
  type RedactionOk,
  type RedactionRejection,
  type RedactInput,
  type RedactedEntryFields,
  redactEntry,
  redactString,
} from "./redactor";

export {
  type RunOutcome,
  type GenerateContext,
  defaultMemorySettings,
  canRead,
  canGenerate,
  describePolicyDecision,
} from "./policy";

export {
  type RankerInput,
  rankMemories,
} from "./ranker";

export {
  type MemoryCandidate,
  type ExtractorContext,
  type ExtractorResult,
  extractMemoryCandidates,
} from "./extractor";
