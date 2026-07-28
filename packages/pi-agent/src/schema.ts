import type { TabstackToolSpec } from "@tabstack/integrations-core";
import { z } from "zod";

/** A plain JSON Schema object (draft-7). */
export type JsonSchema = Record<string, unknown>;

/**
 * Convert a core Zod object schema to a plain JSON Schema (draft-7) object.
 *
 * This adapter is Zod 4 only (Pi's schema story needs Zod 4's native converter),
 * so `z.toJSONSchema` is always present. The built package inlines core, so the
 * core schemas are constructed with this adapter's Zod 4 instance; `vitest.config.ts`
 * aliases `zod` so the same holds at test time. See AGENTS.md.
 */
export function schemaToJsonSchema(
  schema: TabstackToolSpec<unknown, unknown>["schema"],
): JsonSchema {
  // Core types `schema` against Zod 3's `ZodType`; `z.toJSONSchema` wants Zod 4's.
  // At runtime the schema is a Zod 4 object, so this cast is a type-only bridge.
  return z.toJSONSchema(schema as unknown as z.ZodType, { target: "draft-7" }) as JsonSchema;
}
