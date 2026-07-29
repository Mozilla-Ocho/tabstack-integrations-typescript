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

// `vitest.config.ts` aliases `zod` to this package's Zod 4, so core's schemas
// (imported from core's dist) are constructed with Zod 4 and `z.toJSONSchema`
// runs against them, exactly as it does in the published, core-inlined bundle.
describe("schemaToJsonSchema", () => {
  it("converts a core schema to a draft-7 JSON Schema object, keeping every property", () => {
    const json = schemaToJsonSchema(extractStructuredDataSchema);
    expect(json.type).toBe("object");
    const keys = propertyKeys(json);
    expect(keys).toContain("url");
    expect(keys).toContain("json_schema_json");
  });

  it("keeps optional fields and open record fields (automate_browser_task)", () => {
    const json = schemaToJsonSchema(automateBrowserTaskSchema);
    const keys = propertyKeys(json);
    for (const key of ["task", "url", "guardrails", "data", "max_iterations"]) {
      expect(keys).toContain(key);
    }
  });
});
