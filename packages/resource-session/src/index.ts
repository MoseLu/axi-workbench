/**
 * SES-MVP — public surface of the session package.
 *
 * Aggregates the store / redactor / projection / helpers so
 * `apps/gateway` can import everything from a single module path.
 * No React / Vite / provider / gateway-server imports live here.
 */

export {
  type SessionStore,
  type SessionFile,
  type JsonSessionStoreOptions,
  JsonSessionStore,
  SessionConflictError,
  SessionLimitExceededError,
  SessionNotFoundError,
  SessionSchemaMismatchError,
  SessionStoreUnavailableError,
} from "./store";

export {
  type SessionRedactionReason,
  type SessionRedactionResult,
  SESSION_REDACTED_PLACEHOLDER,
  redactSessionText,
  redactUnknown,
  looksLikeProviderPayloadKey,
} from "./redactor";

export {
  type ProjectableResult,
  projectResultSnapshot,
} from "./projection";

export {
  SESSION_ID_PREFIX,
  ENTRY_ID_PREFIX,
  SESSION_TITLE_MAX,
  SESSION_PREVIEW_MAX,
  localDateKey,
  generateSessionId,
  generateEntryId,
  titleFromUserText,
  previewFromText,
  countMessages,
  toSummary,
  sortSessionSummaries,
  projectConversationContext,
} from "./helpers";
