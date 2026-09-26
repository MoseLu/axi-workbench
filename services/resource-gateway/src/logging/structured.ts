/**
 * GHA-NEXT-031 — Structured JSON log lines + secret redaction.
 *
 * Every log line is a single-line JSON object written to stdout. The
 * shape is intentionally tiny so downstream shippers (Loki, CloudWatch,
 * Datadog) can index it without surprises:
 *
 *   {
 *     "ts": "2026-08-27T05:00:00.000Z",
 *     "level": "info",
 *     "msg": "request_completed",
 *     "requestId": "req-123",
 *     "route": "/gateway/run",
 *     "status": 200,
 *     "durationMs": 17
 *   }
 *
 * The `redactSecrets` helper walks any object graph and replaces the
 * VALUE at any key matching `/token|secret|key|password|authorization/i`
 * with the literal `[REDACTED]`. It never mutates the input (returns
 * a new structure), it walks arrays + nested objects, and it caps
 * recursion at 8 levels so a circular reference cannot lock up the
 * gateway.
 *
 * The redaction is intentionally narrow: we redact values at
 * well-known secret-bearing keys, never the keys themselves. We do
 * not redact substrings inside free-form strings (a future
 * improvement if we ever log full URLs); that would risk breaking
 * legitimate log lines and is out of scope here.
 *
 * Default-off: the existing `[gateway] ready ...` log lines in
 * server.ts continue to work because `logStructured` is a thin
 * wrapper around `console.log` that the existing call sites can
 * adopt without behavior change.
 */

/** Keys whose VALUES should be replaced with [REDACTED]. Case-insensitive. */
const SECRET_KEY_REGEX = /token|secret|^key$|password|authorization|auth|api[_-]?key|cookie/i;

/** Hard recursion cap; protects against accidental cycles. */
const MAX_DEPTH = 8;

/** A structured log line. The HTTP layer fills in requestId / route /
 *  status / durationMs; the rest is operator-provided context. */
export interface LogLine {
  readonly ts: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly msg: string;
  readonly [field: string]: unknown;
}

const REDACTED = "[REDACTED]";

/** Walk an arbitrary structure, return a new structure with secret
 *  values replaced. The original is never mutated. */
export const redactSecrets = (input: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return REDACTED;
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((entry) => redactSecrets(entry, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_REGEX.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactSecrets(value, depth + 1);
  }
  return out;
};

/** Build a structured log line. Stamps `ts` and `level` automatically. */
export const buildLogLine = (inputs: {
  level: LogLine["level"];
  msg: string;
  fields?: Record<string, unknown>;
}): LogLine => {
  const fields = inputs.fields ? redactSecrets(inputs.fields) as Record<string, unknown> : {};
  return {
    ts: new Date().toISOString(),
    level: inputs.level,
    msg: inputs.msg,
    ...fields,
  };
};

/** Serialize a structured log line to a single line of JSON.
 *  Falls back to a safe shape on JSON failure (never throws). */
export const serializeLogLine = (line: LogLine): string => {
  try {
    return JSON.stringify(redactSecrets(line));
  } catch {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level: "error",
      msg: "log_serialization_failed",
    });
  }
};

/** Convenience: emit a structured log line to stdout. */
export const logStructured = (inputs: {
  level: LogLine["level"];
  msg: string;
  fields?: Record<string, unknown>;
}): void => {
  const line = buildLogLine(inputs);
  // eslint-disable-next-line no-console
  console.log(serializeLogLine(line));
};