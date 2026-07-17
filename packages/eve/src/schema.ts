import type { TabstackToolSpec } from "@tabstack/integrations-core";
import * as zod from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Structural mirror of eve's internal `JsonObject` (`#shared/json`). eve's
// `defineTool` accepts a raw JSON Schema typed as this recursive readonly JSON
// shape; the converters below return a wider type, so we cast to satisfy the
// `defineTool` overload without importing eve's internal path.
export type JsonValue = boolean | number | string | null | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** Native Zod to JSON Schema converter. Present on Zod 4+, absent on Zod 3. */
export type NativeZodToJsonSchema = (schema: unknown, options?: unknown) => Record<string, unknown>;

// Zod 4 ships a first-party `z.toJSONSchema`; Zod 3 has no such export. The
// consumer's Zod (a peer dependency) is resolved here, and the core schemas are
// built with that same instance, so this presence check tracks the schemas'
// actual version.
export const nativeZodToJsonSchema = (zod as unknown as { toJSONSchema?: NativeZodToJsonSchema })
  .toJSONSchema;

/**
 * Convert a core Zod schema to a JSON Schema object, spanning Zod 3 and Zod 4.
 *
 * Zod 4's native `z.toJSONSchema` is used when available; on Zod 3 (no native
 * converter) it falls back to the `zod-to-json-schema` package. This matters:
 * `zod-to-json-schema` silently emits an empty schema for Zod 4 inputs, so a
 * plain `zodToJsonSchema(schema)` would strip every property under Zod 4.
 *
 * `native` is injectable so both branches can be tested deterministically.
 */
export function schemaToJsonSchema(
  schema: TabstackToolSpec<unknown, unknown>["schema"],
  native: NativeZodToJsonSchema | undefined = nativeZodToJsonSchema,
): JsonObject {
  const jsonSchema =
    typeof native === "function"
      ? native(schema, { target: "draft-7" })
      : zodToJsonSchema(schema, { target: "jsonSchema7" });
  return jsonSchema as unknown as JsonObject;
}
