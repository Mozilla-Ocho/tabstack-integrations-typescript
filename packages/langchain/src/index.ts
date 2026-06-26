import { type StructuredToolInterface, tool } from "@langchain/core/tools";
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

/** Wrap one core tool spec in a LangChain `tool()`. */
function toLangchainTool<TInput, TOutput>(
  spec: TabstackToolSpec<TInput, TOutput>,
): StructuredToolInterface {
  return tool(spec.execute, {
    name: spec.name,
    description: spec.description,
    schema: spec.schema,
  }) as StructuredToolInterface;
}

/**
 * Build Tabstack LangChain tools bound to a specific client (or config). Use
 * this when you need a non-default API key or base URL.
 *
 * @returns an array of tools ready to pass to `create_agent` / `AgentExecutor`.
 */
export function createTabstackLangchainTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  const specs = createTabstackTools(client ?? createTabstackClient(clientConfig));
  return [
    toLangchainTool(specs.extractStructuredData),
    toLangchainTool(specs.extractPageContent),
    toLangchainTool(specs.researchQuestion),
    toLangchainTool(specs.generateStructuredData),
    toLangchainTool(specs.automateBrowserTask),
  ];
}

// Default-client tools. The client is resolved lazily on first tool call, so
// importing this module never requires TABSTACK_API_KEY to be set.
const defaultSpecs = createTabstackTools();

/** Extract structured JSON data from a URL. */
export const extractStructuredDataTool = toLangchainTool(defaultSpecs.extractStructuredData);
/** Fetch a URL and return clean markdown. */
export const extractPageContentTool = toLangchainTool(defaultSpecs.extractPageContent);
/** Research a question across multiple web sources. */
export const researchQuestionTool = toLangchainTool(defaultSpecs.researchQuestion);
/** Fetch a URL and transform its content with AI into structured JSON. */
export const generateStructuredDataTool = toLangchainTool(defaultSpecs.generateStructuredData);
/** Run a natural-language browser automation task. */
export const automateBrowserTaskTool = toLangchainTool(defaultSpecs.automateBrowserTask);

/** All Tabstack tools as an array, ready to drop into a LangChain agent. */
export const tabstackTools = [
  extractStructuredDataTool,
  extractPageContentTool,
  researchQuestionTool,
  generateStructuredDataTool,
  automateBrowserTaskTool,
];
