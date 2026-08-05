import { tool } from "@openai/agents";
import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  createTabstackClient,
  createTabstackTools,
  normalizeError,
} from "@tabstack/integrations-core";
import { z } from "zod";

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
 * The non-strict JSON Schema envelope the OpenAI Agents SDK accepts for a tool's
 * `parameters`. Mirrors the SDK's internal `JsonObjectSchemaNonStrict` (which is
 * not part of the public export surface), so we describe it locally.
 */
interface NonStrictJsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties: true;
}

/**
 * Convert a core Zod object schema to the SDK's non-strict JSON Schema envelope.
 *
 * The OpenAI Agents SDK forces strict mode whenever `parameters` is a Zod schema
 * (passing `strict: false` with a Zod schema throws), and strict mode rejects the
 * constructs the core schemas rely on: `.optional()` fields (strict requires every
 * property in `required`) and `automate_browser_task`'s open `z.record(...)` (strict
 * forbids a schema-valued `additionalProperties`). Advertising a JSON Schema with
 * `strict: false` sidesteps both without touching the shared core schemas. Zod
 * 4's native `z.toJSONSchema` does the conversion (the SDK requires Zod 4, so the
 * core schemas resolve as Zod 4 too), and the object envelope is reshaped to the
 * non-strict shape (`additionalProperties: true`) the SDK's type demands.
 */
function toJsonParameters(schema: z.ZodType): NonStrictJsonSchema {
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" }) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return {
    type: "object",
    properties: jsonSchema.properties ?? {},
    required: jsonSchema.required ?? [],
    additionalProperties: true,
  };
}

/**
 * Wrap one core tool spec in an OpenAI Agents `tool()`.
 *
 * Because the tool advertises a JSON Schema (not a Zod schema), the SDK hands
 * `execute` the unvalidated JSON input, so we re-parse through the core Zod
 * schema to recover the typed input before delegating to the core body. A parse
 * failure is normalized to `TabstackToolError`, matching the error contract of
 * the core bodies and the other adapters. Non-string results are serialized by
 * the SDK for the model.
 */
function toOpenAIAgentsTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>) {
  return tool({
    name: spec.name,
    description: spec.description,
    parameters: toJsonParameters(spec.schema),
    strict: false,
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

/** Build the array of Tabstack OpenAI Agents tools from a set of core specs. */
function buildTools(specs: ReturnType<typeof createTabstackTools>) {
  return [
    toOpenAIAgentsTool(specs.extractStructuredData),
    toOpenAIAgentsTool(specs.extractPageContent),
    toOpenAIAgentsTool(specs.researchQuestion),
    toOpenAIAgentsTool(specs.generateStructuredData),
    toOpenAIAgentsTool(specs.automateBrowserTask),
  ];
}

/**
 * Build Tabstack OpenAI Agents tools bound to a specific client (or config). Use
 * this when you need a non-default API key or base URL.
 *
 * @returns an array of tools ready to pass to `new Agent({ tools })`.
 */
export function createTabstackOpenAIAgentsTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  return buildTools(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

// Default-client tools. The client is resolved lazily on first tool call, so
// importing this module never requires TABSTACK_API_KEY to be set.
const defaultSpecs = createTabstackTools();

/** Extract structured JSON data from a URL. */
export const extractStructuredDataTool = toOpenAIAgentsTool(defaultSpecs.extractStructuredData);
/** Fetch a URL and return clean markdown. */
export const extractPageContentTool = toOpenAIAgentsTool(defaultSpecs.extractPageContent);
/** Research a question across multiple web sources. */
export const researchQuestionTool = toOpenAIAgentsTool(defaultSpecs.researchQuestion);
/** Fetch a URL and transform its content with AI into structured JSON. */
export const generateStructuredDataTool = toOpenAIAgentsTool(defaultSpecs.generateStructuredData);
/** Run a natural-language browser automation task. */
export const automateBrowserTaskTool = toOpenAIAgentsTool(defaultSpecs.automateBrowserTask);

/** All Tabstack tools as an array, ready to drop into `new Agent({ tools })`. */
export const tabstackTools = [
  extractStructuredDataTool,
  extractPageContentTool,
  researchQuestionTool,
  generateStructuredDataTool,
  automateBrowserTaskTool,
];
