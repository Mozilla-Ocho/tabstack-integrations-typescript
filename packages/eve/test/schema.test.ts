import { extractStructuredDataSchema } from "@tabstack/integrations-core";
import { describe, expect, it, vi } from "vitest";
// Zod 4 installed under an alias so the native branch runs against real Zod 4
// (the repo's default `zod` is v3).
import * as zod4 from "zod4";
import { type NativeZodToJsonSchema, schemaToJsonSchema } from "../src/schema.js";

/** Pull the property keys out of a JSON Schema object shape. */
function propertyKeys(schema: Record<string, unknown>): string[] {
  return Object.keys((schema.properties as Record<string, unknown>) ?? {});
}

const zod4Native = (zod4 as unknown as { toJSONSchema: NativeZodToJsonSchema }).toJSONSchema;

describe("schemaToJsonSchema", () => {
  it("converts a Zod 3 schema via zod-to-json-schema when no native converter is given", () => {
    const json = schemaToJsonSchema(extractStructuredDataSchema, undefined) as Record<
      string,
      unknown
    >;
    expect(json.type).toBe("object");
    expect(propertyKeys(json)).toContain("url");
    expect(propertyKeys(json)).toContain("json_schema_json");
  });

  it("routes to the native converter when one is available", () => {
    const native = vi.fn().mockReturnValue({ type: "object", properties: { marker: {} } });
    const json = schemaToJsonSchema(extractStructuredDataSchema, native) as Record<string, unknown>;
    expect(native).toHaveBeenCalledOnce();
    expect(propertyKeys(json)).toEqual(["marker"]);
  });

  // Mirrors the constructs the real core schemas use (optional fields, url,
  // int/positive, an enum, and a `record(string, unknown)` like
  // automateBrowserTaskSchema.data) so the native path is exercised against the
  // shapes it must handle in production, not just a trivial object.
  it("converts Zod 4 schemas with core-like constructs, keeping every property", () => {
    const schema = zod4.object({
      url: zod4.string().url(),
      query: zod4.string().describe("a described field"),
      effort: zod4.enum(["min", "standard", "max"]).optional(),
      max_iterations: zod4.number().int().positive().optional(),
      data: zod4.record(zod4.string(), zod4.unknown()).optional(),
    });

    const json = schemaToJsonSchema(schema as never, zod4Native) as Record<string, unknown>;
    const keys = propertyKeys(json);
    for (const key of ["url", "query", "effort", "max_iterations", "data"]) {
      expect(keys).toContain(key);
    }
  });
});
