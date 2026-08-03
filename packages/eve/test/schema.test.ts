import {
  automateBrowserTaskSchema,
  extractStructuredDataSchema,
} from "@tabstack/integrations-core";
import { describe, expect, it } from "vitest";
import { schemaToJsonSchema } from "../src/schema.js";

/** Pull the property keys out of a JSON Schema object shape. */
function propertyKeys(schema: Record<string, unknown>): string[] {
  return Object.keys((schema.properties as Record<string, unknown>) ?? {});
}

describe("schemaToJsonSchema", () => {
  it("converts a core Zod schema to a JSON Schema object", () => {
    const json = schemaToJsonSchema(extractStructuredDataSchema) as Record<string, unknown>;
    expect(json.type).toBe("object");
    expect(propertyKeys(json)).toContain("url");
    expect(propertyKeys(json)).toContain("json_schema_json");
  });

  // Exercises the core-like constructs (optional fields, url, int/positive, an
  // enum, and a `record(string, unknown)`) so the converter is checked against
  // the shapes it must handle in production, not just a trivial object.
  it("keeps every property for a schema with optional, enum, and record fields", () => {
    const json = schemaToJsonSchema(automateBrowserTaskSchema) as Record<string, unknown>;
    const keys = propertyKeys(json);
    for (const key of ["task", "url", "country", "data", "max_iterations"]) {
      expect(keys).toContain(key);
    }
  });
});
