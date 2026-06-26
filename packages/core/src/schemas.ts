import { z } from "zod";

// Shared optional fields, reused across tools so the surface stays consistent.
const effortField = z
  .enum(["min", "standard", "max"])
  .optional()
  .describe(
    'Optional fetch effort: "min" (fastest), "standard" (default, balanced), ' +
      '"max" (full browser rendering for JS-heavy pages).',
  );
const nocacheField = z
  .boolean()
  .optional()
  .describe("Optional: bypass cache and force fresh retrieval");
const countryField = z
  .string()
  .optional()
  .describe('Optional ISO 3166-1 alpha-2 country code for geotargeting (e.g. "US")');

/**
 * Input schema for the `extract_structured_data` tool. A URL plus a JSON-encoded
 * JSON Schema string, parsed and passed to `client.extract.json`.
 */
export const extractStructuredDataSchema = z.object({
  url: z.string().url().describe("URL to fetch and extract structured data from"),
  json_schema_json: z
    .string()
    .describe(
      "A JSON-encoded JSON Schema object with concrete properties and descriptions " +
        "for each field to extract.",
    ),
  effort: effortField,
  nocache: nocacheField,
  country: countryField,
});

/**
 * Input schema for the `extract_page_content` tool. A single URL whose content
 * is returned as clean markdown via `client.extract.markdown`.
 */
export const extractPageContentSchema = z.object({
  url: z.string().url().describe("URL to fetch and convert to clean markdown"),
  effort: effortField,
  nocache: nocacheField,
  country: countryField,
});

/**
 * Input schema for the `research_question` tool. A natural-language query
 * answered via `client.agent.research`.
 */
export const researchQuestionSchema = z.object({
  query: z.string().describe("The research question to answer using multiple web sources"),
  mode: z
    .enum(["fast", "balanced"])
    .optional()
    .describe('Optional research mode: "fast" (quick) or "balanced" (default, more thorough)'),
  nocache: nocacheField,
});

/**
 * Input schema for the `generate_structured_data` tool. Fetches a URL, then
 * transforms its content with AI into a JSON shape, via `client.generate.json`.
 */
export const generateStructuredDataSchema = z.object({
  url: z.string().url().describe("URL whose content should be fetched and transformed"),
  instructions: z
    .string()
    .describe("Natural-language instructions describing how to transform the page content"),
  json_schema_json: z
    .string()
    .describe(
      "A JSON-encoded JSON Schema object describing the shape of the generated output, " +
        "with concrete properties and descriptions for each field.",
    ),
  effort: effortField,
  nocache: nocacheField,
  country: countryField,
});

/**
 * Input schema for the `automate_browser_task` tool. Runs a natural-language
 * browser automation task via `client.agent.automate`. Covers the full automate
 * input surface except interactive human-in-the-loop mode, which a one-shot tool
 * cannot service.
 */
export const automateBrowserTaskSchema = z.object({
  task: z.string().describe("The browser automation task to perform, in natural language"),
  url: z.string().url().optional().describe("Optional starting URL for the task"),
  guardrails: z
    .string()
    .optional()
    .describe("Optional safety constraints on what the agent is allowed to do"),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Optional JSON context data for form filling or complex tasks"),
  country: countryField,
  max_iterations: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional cap on the number of agent iterations"),
  max_validation_attempts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional cap on the number of result validation attempts"),
});
