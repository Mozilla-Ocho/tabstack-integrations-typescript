import {
  type TabstackClient,
  type TabstackClientConfig,
  createTabstackClient,
  createTabstackTools,
} from "@tabstack/integrations-core";
import { tool } from "ai";

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
 * Build the named tool object from a set of core specs. Each tool is wrapped in
 * the Vercel AI SDK `tool()`; the v5+ API names the input schema `inputSchema`
 * and infers types from the concrete Zod schema and execute body.
 *
 * The AI SDK passes an `abortSignal` in the execute options; it is forwarded to
 * the core body as `signal` so a cancelled generation aborts the underlying
 * Tabstack request, not just the model call.
 */
function buildTools(specs: ReturnType<typeof createTabstackTools>) {
  return {
    [specs.extractStructuredData.name]: tool({
      description: specs.extractStructuredData.description,
      inputSchema: specs.extractStructuredData.schema,
      execute: (input, { abortSignal }) =>
        specs.extractStructuredData.execute(input, { signal: abortSignal }),
    }),
    [specs.extractPageContent.name]: tool({
      description: specs.extractPageContent.description,
      inputSchema: specs.extractPageContent.schema,
      execute: (input, { abortSignal }) =>
        specs.extractPageContent.execute(input, { signal: abortSignal }),
    }),
    [specs.researchQuestion.name]: tool({
      description: specs.researchQuestion.description,
      inputSchema: specs.researchQuestion.schema,
      execute: (input, { abortSignal }) =>
        specs.researchQuestion.execute(input, { signal: abortSignal }),
    }),
    [specs.generateStructuredData.name]: tool({
      description: specs.generateStructuredData.description,
      inputSchema: specs.generateStructuredData.schema,
      execute: (input, { abortSignal }) =>
        specs.generateStructuredData.execute(input, { signal: abortSignal }),
    }),
    [specs.automateBrowserTask.name]: tool({
      description: specs.automateBrowserTask.description,
      inputSchema: specs.automateBrowserTask.schema,
      execute: (input, { abortSignal }) =>
        specs.automateBrowserTask.execute(input, { signal: abortSignal }),
    }),
  };
}

/**
 * Build Tabstack AI SDK tools bound to a specific client (or config). Use this
 * when you need a non-default API key or base URL.
 *
 * @returns a named tool object suitable for `generateText` / `streamText`.
 */
export function createTabstackAiTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  return buildTools(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

/**
 * Tabstack tools keyed by tool name, ready to pass straight to `generateText` /
 * `streamText` `tools`. The client is resolved lazily on first tool call, so
 * importing this module never requires TABSTACK_API_KEY to be set.
 */
export const tabstackTools = buildTools(createTabstackTools());
