import type { TabstackToolSpec } from "@tabstack/integrations-core";
import { z } from "zod";

/** A plain JSON Schema object (draft-7). */
export type JsonSchema = Record<string, unknown>;

/**
 * Convert a core Zod object schema to a plain JSON Schema (draft-7) object.
 *
 * This adapter is Zod 4 only (Pi's schema story needs Zod 4's native converter),
 * so `z.toJSONSchema` is always present. The whole repo is Zod 4 only, so core's
 * schemas resolve the same single Zod 4 instance this converter runs against —
 * both in the built, core-inlined bundle and at test time. See AGENTS.md.
 */
export function schemaToJsonSchema(
  schema: TabstackToolSpec<unknown, unknown>["schema"],
): JsonSchema {
  return z.toJSONSchema(schema, { target: "draft-7" }) as JsonSchema;
}
