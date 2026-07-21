import { createTool } from "@mastra/core/tools";
import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  createTabstackClient,
  createTabstackTools,
} from "@tabstack/integrations-core";

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
 * Wrap one core tool spec in a Mastra `createTool`.
 *
 * Mastra is Zod-native, so the core Zod schema is passed straight through as
 * `inputSchema` (no JSON-Schema conversion, unlike the eve adapter). The current
 * `@mastra/core` (v1) API requires both `id` and `description`, and hands
 * `execute` the validated input as its first positional argument. That is a
 * change from the older v0 `execute({ context })` shape, so we take the first arg
 * and forward it to the core body. `outputSchema` is intentionally omitted; add
 * it only where a return shape is stable and worth enforcing.
 */
function toMastraTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>) {
  return createTool({
    id: spec.name,
    description: spec.description,
    inputSchema: spec.schema,
    execute: (input) => spec.execute(input),
  });
}

/**
 * Build the named Tabstack Mastra tools from a set of core specs. Keyed by the
 * shared core tool name so the object mirrors `@tabstack/langchain`,
 * `@tabstack/ai`, and `@tabstack/eve`, and can be spread straight into an
 * `Agent`'s `tools`.
 */
function buildTools(specs: ReturnType<typeof createTabstackTools>) {
  return {
    [specs.extractStructuredData.name]: toMastraTool(specs.extractStructuredData),
    [specs.extractPageContent.name]: toMastraTool(specs.extractPageContent),
    [specs.researchQuestion.name]: toMastraTool(specs.researchQuestion),
    [specs.generateStructuredData.name]: toMastraTool(specs.generateStructuredData),
    [specs.automateBrowserTask.name]: toMastraTool(specs.automateBrowserTask),
  };
}

/**
 * Build Tabstack Mastra tools bound to a specific client (or config). Use this
 * when you need a non-default API key or base URL.
 *
 * @returns a named tool object keyed by tool name, ready to spread into an
 * `Agent`'s `tools`.
 */
export function createTabstackMastraTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  return buildTools(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

// Default-client tools. The client is resolved lazily on first tool call, so
// importing this module never requires TABSTACK_API_KEY to be set.
const defaultSpecs = createTabstackTools();

/** Extract structured JSON data from a URL. */
export const extractStructuredDataTool = toMastraTool(defaultSpecs.extractStructuredData);
/** Fetch a URL and return clean markdown. */
export const extractPageContentTool = toMastraTool(defaultSpecs.extractPageContent);
/** Research a question across multiple web sources. */
export const researchQuestionTool = toMastraTool(defaultSpecs.researchQuestion);
/** Fetch a URL and transform its content with AI into structured JSON. */
export const generateStructuredDataTool = toMastraTool(defaultSpecs.generateStructuredData);
/** Run a natural-language browser automation task. */
export const automateBrowserTaskTool = toMastraTool(defaultSpecs.automateBrowserTask);

/**
 * Tabstack tools keyed by tool name, ready to spread straight into an `Agent`'s
 * `tools`. The client is resolved lazily on first tool call, so importing this
 * module never requires TABSTACK_API_KEY to be set.
 */
export const tabstackTools = {
  [defaultSpecs.extractStructuredData.name]: extractStructuredDataTool,
  [defaultSpecs.extractPageContent.name]: extractPageContentTool,
  [defaultSpecs.researchQuestion.name]: researchQuestionTool,
  [defaultSpecs.generateStructuredData.name]: generateStructuredDataTool,
  [defaultSpecs.automateBrowserTask.name]: automateBrowserTaskTool,
};
