import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  createTabstackClient,
  createTabstackTools,
} from "@tabstack/integrations-core";
import { type JSONValue, tool } from "llamaindex";

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
 * Wrap one core tool spec in a LlamaIndex `tool()`.
 *
 * LlamaIndex's `tool()` (an alias for `FunctionTool.from`) is Zod-native: the
 * core Zod schema is passed straight through as `parameters`, so no JSON-Schema
 * conversion is needed. LlamaIndex derives the advertised JSON Schema internally
 * and validates input against the same Zod schema before invoking `execute`.
 *
 * `execute` returns the core result, which is JSON-serializable; the cast lines
 * the core `Promise<TOutput>` up with LlamaIndex's `JSONValue` return contract.
 */
function toLlamaindexTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>) {
  return tool({
    name: spec.name,
    description: spec.description,
    parameters: spec.schema,
    execute: spec.execute as (input: TInput) => Promise<JSONValue>,
  });
}

/**
 * Build Tabstack LlamaIndex tools bound to a specific client (or config). Use
 * this when you need a non-default API key or base URL.
 *
 * @returns an array of tools ready to pass to an `agent({ tools })`.
 */
export function createTabstackLlamaindexTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  const specs = createTabstackTools(client ?? createTabstackClient(clientConfig));
  return [
    toLlamaindexTool(specs.extractStructuredData),
    toLlamaindexTool(specs.extractPageContent),
    toLlamaindexTool(specs.researchQuestion),
    toLlamaindexTool(specs.generateStructuredData),
    toLlamaindexTool(specs.automateBrowserTask),
  ];
}

// Default-client tools. The client is resolved lazily on first tool call, so
// importing this module never requires TABSTACK_API_KEY to be set.
const defaultSpecs = createTabstackTools();

/** Extract structured JSON data from a URL. */
export const extractStructuredDataTool = toLlamaindexTool(defaultSpecs.extractStructuredData);
/** Fetch a URL and return clean markdown. */
export const extractPageContentTool = toLlamaindexTool(defaultSpecs.extractPageContent);
/** Research a question across multiple web sources. */
export const researchQuestionTool = toLlamaindexTool(defaultSpecs.researchQuestion);
/** Fetch a URL and transform its content with AI into structured JSON. */
export const generateStructuredDataTool = toLlamaindexTool(defaultSpecs.generateStructuredData);
/** Run a natural-language browser automation task. */
export const automateBrowserTaskTool = toLlamaindexTool(defaultSpecs.automateBrowserTask);

/** All Tabstack tools as an array, ready to drop into a LlamaIndex agent. */
export const tabstackTools = [
  extractStructuredDataTool,
  extractPageContentTool,
  researchQuestionTool,
  generateStructuredDataTool,
  automateBrowserTaskTool,
];
