import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  createTabstackClient,
  createTabstackTools,
  normalizeError,
} from "@tabstack/integrations-core";
import { defineTool } from "eve/tools";
import { schemaToJsonSchema } from "./schema.js";

export {
  TabstackToolError,
  automateBrowserTaskSchema,
  extractPageContentSchema,
  extractStructuredDataSchema,
  generateStructuredDataSchema,
  researchQuestionSchema,
  toolDescriptions,
  toolNames,
} from "@tabstack/integrations-core";
export type { TabstackClient, TabstackClientConfig } from "@tabstack/integrations-core";

/**
 * Wrap one core tool spec in an eve `defineTool`.
 *
 * eve advertises a JSON Schema (or a Standard-JSON-Schema value) to the model,
 * not a raw Zod schema, so the core Zod schema is converted with
 * `schemaToJsonSchema` (Zod 4's native `z.toJSONSchema`). eve then hands
 * `execute` the unvalidated input, so we re-parse through the core Zod schema to
 * recover the typed input before delegating to the core body. A parse failure is
 * normalized to `TabstackToolError`, matching the error contract of the core
 * bodies and the other adapters.
 *
 * `defineTool` stamps a brand that eve's lifecycle code validates, so tools must
 * be created through it: raw object literals are rejected.
 */
function toEveTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>) {
  const inputSchema = schemaToJsonSchema(spec.schema);
  return defineTool({
    description: spec.description,
    inputSchema,
    async execute(input) {
      let parsed: TInput;
      try {
        parsed = spec.schema.parse(input);
      } catch (err) {
        throw normalizeError(err);
      }
      return spec.execute(parsed);
    },
  });
}

/**
 * Build the named Tabstack eve tools from a set of core specs. Keyed by the
 * shared core tool name so the object mirrors `@tabstack/langchain` /
 * `@tabstack/ai`.
 */
function buildTools(specs: ReturnType<typeof createTabstackTools>) {
  return {
    [specs.extractStructuredData.name]: toEveTool(specs.extractStructuredData),
    [specs.extractPageContent.name]: toEveTool(specs.extractPageContent),
    [specs.researchQuestion.name]: toEveTool(specs.researchQuestion),
    [specs.generateStructuredData.name]: toEveTool(specs.generateStructuredData),
    [specs.automateBrowserTask.name]: toEveTool(specs.automateBrowserTask),
  };
}

/**
 * Build Tabstack eve tools bound to a specific client (or config). Use this when
 * you need a non-default API key or base URL, then re-export the tool you want
 * as the default export of a file under `agent/tools/` (the filename becomes the
 * tool name).
 *
 * @returns a named tool object keyed by tool name.
 */
export function createTabstackEveTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  return buildTools(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

// Default-client tools. The client is resolved lazily on first tool call, so
// importing this module never requires TABSTACK_API_KEY to be set. eve derives
// each tool's name from its file, so re-export the one you want as the default
// export of `agent/tools/<tool_name>.ts`.
const defaultSpecs = createTabstackTools();

/** Extract structured JSON data from a URL. */
export const extractStructuredDataTool = toEveTool(defaultSpecs.extractStructuredData);
/** Fetch a URL and return clean markdown. */
export const extractPageContentTool = toEveTool(defaultSpecs.extractPageContent);
/** Research a question across multiple web sources. */
export const researchQuestionTool = toEveTool(defaultSpecs.researchQuestion);
/** Fetch a URL and transform its content with AI into structured JSON. */
export const generateStructuredDataTool = toEveTool(defaultSpecs.generateStructuredData);
/** Run a natural-language browser automation task. */
export const automateBrowserTaskTool = toEveTool(defaultSpecs.automateBrowserTask);
