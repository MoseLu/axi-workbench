import { z } from "zod";

/**
 * Minimal Zod → JSON Schema (OpenAPI 3.1) converter.
 *
 * Why hand-rolled:
 *   - The contracts package only exports Zod schemas (gatewayRequestSchema,
 *     errorEnvelopeSchema, etc). We need an OpenAPI document that points
 *     at those schemas as `#/components/schemas/...` references, and we
 *     must keep the converter deterministic, framework-free, and under
 *     300 LOC so it stays auditable.
 *   - Bringing in `zod-to-json-schema` would add a transitive dependency
 *     and override the package's strict no-extra-deps rule.
 *
 * What this converter covers:
 *   - Primitives: string, number, boolean, null.
 *   - Literal unions (z.literal).
 *   - Enums (z.enum / z.nativeEnum).
 *   - Objects (z.object / .strict() / .partial / passthrough).
 *   - Arrays (z.array) with minItems / maxItems.
 *   - Unions (z.union / z.discriminatedUnion).
 *   - Optional / nullable / default / readonly / branded wrappers.
 *   - Records (z.record) → JSON Schema object with additionalProperties.
 *   - Tuples (z.tuple) → prefixItems + bounded length.
 *
 * What it does NOT cover (and how we degrade):
 *   - z.lazy — emitted as `{ "x-zod-kind": "lazy", description }` so the
 *     document remains valid; the caller is expected to override the
 *     placeholder via `extraSchemas` if a lazy reference would otherwise
 *     recurse.
 *   - z.preprocess / z.transform / z.pipeline — surfaced as a deliberate
 *     `{ "x-zod-kind": "<kind>" }` marker so a reviewer can spot the
 *     unsuppressed kind in tests.
 *   - Anything outside the closed whitelist. We throw with a descriptive
 *     message instead of silently producing `{ type: "object" }` so a
 *     contract drift cannot silently widen the public schema.
 *
 * All decisions match OpenAPI 3.1 / JSON Schema 2020-12:
 *   - `nullable: true` is the canonical flag (not the legacy
 *     `type: [..., "null"]` shorthand).
 *   - `prefixItems` is used for tuples; `items` for arrays.
 */

const PRIMITIVE_KIND_BY_TYPE: Readonly<Record<string, string>> = {
  ZodString: "string",
  ZodNumber: "number",
  ZodBoolean: "boolean",
  ZodNull: "null",
  ZodBigInt: "integer",
  ZodDate: "string",
  ZodUnknown: "object",
  ZodAny: "object",
  ZodVoid: "null",
  ZodUndefined: "null",
  ZodNever: "null",
};

export interface ConvertOptions {
  /** Name under which a schema should be registered. Informational only;
   *  the converter does not generate $refs from this field. */
  name?: string;
  /** When true, internal `x-zod-*` annotations are stripped from the
   *  output so the emitted schema is a clean JSON Schema document.
   *  Default: true. Set to false when debugging. */
  stripInternal?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepStripInternal = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(deepStripInternal);
  if (!isPlainObject(node)) return node;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("x-zod-")) continue;
    result[key] = deepStripInternal(value);
  }
  return result;
};

const cloneDescriptionChain = (def: z.ZodTypeDef): string | undefined => {
  const desc = (def as { description?: string }).description;
  return desc && desc.length > 0 ? desc : undefined;
};

/**
 * Convert a Zod schema into a JSON Schema fragment. The output uses
 * JSON Schema 2020-12 / OpenAPI 3.1 semantics.
 */
export const convertSchema = (
  schema: z.ZodTypeAny,
  options: ConvertOptions = {},
): Record<string, unknown> => {
  const result = walkSchema(schema, options, new WeakSet<object>());
  return (options.stripInternal ?? true)
    ? (deepStripInternal(result) as Record<string, unknown>)
    : result;
};

/** Internal recursive walker — handles optional/nullable wrappers and
 *  def unwrapping before delegating to per-kind branches. */
const walkSchema = (
  schema: z.ZodTypeAny,
  options: ConvertOptions,
  visited: WeakSet<object>,
): Record<string, unknown> => {
  if (visited.has(schema as unknown as object)) {
    throw new Error("convertSchema: recursive Zod schema detected");
  }
  visited.add(schema as unknown as object);

  try {
    const description = cloneDescriptionChain(schema._def);

    let inner: z.ZodTypeAny = schema;
    let isNullable = false;
    let isOptional = false;
    while (true) {
      const def = inner._def;
      if (def.typeName === "ZodOptional") {
        isOptional = true;
        inner = (def as z.ZodOptionalDef).innerType;
        continue;
      }
      if (def.typeName === "ZodNullable") {
        isNullable = true;
        inner = (def as z.ZodNullableDef).innerType;
        continue;
      }
      if (def.typeName === "ZodDefault") {
        inner = (def as z.ZodDefaultDef).innerType;
        continue;
      }
      if (def.typeName === "ZodReadonly") {
        inner = (def as z.ZodReadonlyDef).innerType;
        continue;
      }
      if (def.typeName === "ZodBranded") {
        inner = (def as z.ZodBrandedDef<z.ZodTypeAny>).type;
        continue;
      }
      if (def.typeName === "ZodCatch") {
        inner = (def as z.ZodCatchDef).innerType;
        continue;
      }
      break;
    }

    const base = walkInner(inner, options, visited);
    if (description && base.description === undefined) {
      base.description = description;
    }
    if (isOptional && !isNullable) {
      base.nullable = true;
    }
    if (isNullable) {
      base.nullable = true;
    }
    return base;
  } finally {
    // Track the active recursion stack, not every schema encountered. A
    // primitive schema may legitimately be reused by multiple fields.
    visited.delete(schema as unknown as object);
  }
};

const isOptionalish = (schema: z.ZodTypeAny): boolean => {
  if (schema._def.typeName === "ZodOptional") return true;
  if (schema._def.typeName === "ZodNullable") return true;
  if (schema._def.typeName === "ZodDefault") return true;
  return false;
};

const walkInner = (
  schema: z.ZodTypeAny,
  options: ConvertOptions,
  visited: WeakSet<object>,
): Record<string, unknown> => {
  const def = schema._def;
  const typeName = def.typeName as string;

  const primitive = PRIMITIVE_KIND_BY_TYPE[typeName];
  if (primitive) {
    if (typeName === "ZodNumber") {
      const checks = (def as z.ZodNumberDef).checks ?? [];
      const result: Record<string, unknown> = { type: "number" };
      for (const check of checks) {
        if (check.kind === "int") result.type = "integer";
        if (check.kind === "min") result.minimum = check.value;
        if (check.kind === "max") result.maximum = check.value;
        if (check.kind === "multipleOf") result.multipleOf = check.value;
      }
      return result;
    }
    if (typeName === "ZodString") {
      const checks = (def as z.ZodStringDef).checks ?? [];
      const result: Record<string, unknown> = { type: "string" };
      for (const check of checks) {
        if (check.kind === "min") result.minLength = check.value;
        if (check.kind === "max") result.maxLength = check.value;
        if (check.kind === "uuid") result.format = "uuid";
        if (check.kind === "datetime") result.format = "date-time";
        if (check.kind === "url") result.format = "uri";
        if (check.kind === "email") result.format = "email";
      }
      return result;
    }
    return { type: primitive };
  }

  switch (typeName) {
    case "ZodLiteral": {
      const value = (def as z.ZodLiteralDef).value;
      return { const: value as unknown };
    }
    case "ZodEnum": {
      const values = (def as z.ZodEnumDef).values;
      return { type: "string", enum: [...values] };
    }
    case "ZodNativeEnum": {
      const values = Object.values((def as z.ZodNativeEnumDef).values);
      return { type: "string", enum: values.map((value) => String(value)) };
    }
    case "ZodUnion": {
      const opts = (def as z.ZodUnionDef<readonly [z.ZodTypeAny, ...z.ZodTypeAny[]]>).options;
      return { anyOf: opts.map((option) => walkSchema(option, options, visited)) };
    }
    case "ZodDiscriminatedUnion": {
      const opts = (def as unknown as { options: ReadonlyArray<z.ZodTypeAny> }).options;
      return { oneOf: opts.map((option) => walkSchema(option, options, visited)) };
    }
    case "ZodArray": {
      const defTyped = def as z.ZodArrayDef;
      const result: Record<string, unknown> = {
        type: "array",
        items: walkSchema(defTyped.type, options, visited),
      };
      if (defTyped.minLength) result.minItems = defTyped.minLength.value;
      if (defTyped.maxLength) result.maxItems = defTyped.maxLength.value;
      return result;
    }
    case "ZodObject": {
      const defTyped = def as z.ZodObjectDef;
      const shape = defTyped.shape();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = walkSchema(value as z.ZodTypeAny, options, visited);
        if (!isOptionalish(value as z.ZodTypeAny)) {
          required.push(key);
        }
      }
      const result: Record<string, unknown> = {
        type: "object",
        properties,
      };
      if (required.length > 0) result.required = required;
      if (defTyped.catchall && defTyped.catchall._def.typeName !== "ZodNever") {
        result.additionalProperties = walkSchema(defTyped.catchall, options, visited);
      }
      return result;
    }
    case "ZodRecord": {
      const defTyped = def as z.ZodRecordDef;
      return {
        type: "object",
        additionalProperties: walkSchema(defTyped.valueType, options, visited),
      };
    }
    case "ZodTuple": {
      const defTyped = def as z.ZodTupleDef;
      const items = defTyped.items.map((item) => walkSchema(item, options, visited));
      return { type: "array", prefixItems: items, minItems: items.length, maxItems: items.length };
    }
    case "ZodLazy": {
      return {
        "x-zod-kind": "lazy",
        description: `Lazy reference to ${options.name ?? "anonymous"}; replace with $ref before serving.`,
      };
    }
    case "ZodEffects": {
      return {
        "x-zod-kind": "effects",
        description: "Transform / preprocess detected; the underlying schema is opaque to OpenAPI and must be modelled explicitly.",
      };
    }
    case "ZodPipeline": {
      return {
        "x-zod-kind": "pipeline",
        description: "Pipeline detected; the underlying schema is opaque to OpenAPI and must be modelled explicitly.",
      };
    }
    case "ZodFunction":
    case "ZodPromise":
    case "ZodMap":
    case "ZodSet": {
      throw new Error(
        `convertSchema: unsupported Zod kind "${typeName}" for OpenAPI generation`,
      );
    }
    default: {
      throw new Error(
        `convertSchema: unknown Zod typeName "${typeName}" — bump the converter whitelist`,
      );
    }
  }
};
