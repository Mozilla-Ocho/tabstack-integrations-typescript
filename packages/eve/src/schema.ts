import type { TabstackToolSpec } from "@tabstack/integrations-core";
import { z } from "zod";

// Structural mirror of eve's internal `JsonObject` (`#shared/json`). eve's
// `defineTool` accepts a raw JSON Schema typed as this recursive readonly JSON
// shape; the converter below returns a wider type, so we cast to satisfy the
// `defineTool` overload without importing eve's internal path.
export type JsonValue = boolean | number | string | null | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/**
 * Convert a core Zod schema to a JSON Schema object with Zod 4's native
 * `z.toJSONSchema`. The whole repo is Zod 4 only, so no version detection or
 * `zod-to-json-schema` fallback is needed.
 */
export function schemaToJsonSchema(
  schema: TabstackToolSpec<unknown, unknown>["schema"],
): JsonObject {
  return z.toJSONSchema(schema, { target: "draft-7" }) as unknown as JsonObject;
}
