import { type TabstackClient, getDefaultClient } from "./client.js";
import { TabstackToolError, normalizeError } from "./errors.js";
import {
  automateBrowserTaskSchema,
  extractPageContentSchema,
  extractStructuredDataSchema,
  generateStructuredDataSchema,
  researchQuestionSchema,
} from "./schemas.js";
import type {
  AutomateBrowserTaskInput,
  AutomateBrowserTaskResult,
  AutomateVisitedPage,
  ExtractPageContentInput,
  ExtractPageContentResult,
  ExtractStructuredDataInput,
  ExtractStructuredDataResult,
  GenerateStructuredDataInput,
  GenerateStructuredDataResult,
  ResearchQuestionInput,
  ResearchResult,
  TabstackToolExecuteOptions,
  TabstackToolSpec,
} from "./types.js";

// Tool names and descriptions are the single source of truth shared by every
// adapter. They mirror the shipped Python `langchain-tabstack` package so the
// cross-language story stays consistent.
const NAMES = {
  extractStructuredData: "extract_structured_data",
  extractPageContent: "extract_page_content",
  researchQuestion: "research_question",
  generateStructuredData: "generate_structured_data",
  automateBrowserTask: "automate_browser_task",
} as const;

const DESCRIPTIONS = {
  extractStructuredData:
    "Extract structured JSON data from a URL. Use when you need specific fields from a web " +
    "page. 'json_schema_json' must be a JSON-encoded JSON Schema object with concrete " +
    "properties and descriptions for each field to extract. See the schema-design guide for " +
    "patterns that produce reliable results. Returns the extracted data as JSON.",
  extractPageContent:
    "Fetch a URL and return its content as clean markdown. Use when you need to read a page's " +
    "full content for summarization or when you don't know what specific fields to extract. " +
    "Returns clean markdown text.",
  researchQuestion:
    "Research a question using multiple web sources. Use when you need a synthesized answer " +
    "from multiple sources, not just data from a single known page. Returns an answer with " +
    "cited sources.",
  generateStructuredData:
    "Fetch a URL, then transform and restructure its content with AI into structured JSON. Use " +
    "when you need derived or reshaped data (summaries, categorizations, computed fields), not " +
    "just verbatim extraction. 'instructions' tells the AI how to transform the content; " +
    "'json_schema_json' must be a JSON-encoded JSON Schema object describing the output shape. " +
    "Returns the generated data as JSON.",
  automateBrowserTask:
    "Run an AI browser automation task described in natural language. Use for multi-step web " +
    "workflows: navigating, filling forms, gathering, and extracting across pages. Provide a " +
    "clear 'task' and optionally a starting 'url', 'guardrails' to constrain the agent, 'data' " +
    "as context for form filling, a 'country' code for geotargeted browsing, and caps via " +
    "'max_iterations' and 'max_validation_attempts'. Runs non-interactively and returns the " +
    "final answer plus any extracted data and the pages visited.",
} as const;

/**
 * Shared fetch options (effort, cache bypass, geotargeting) passed through to
 * the extract and generate endpoints. Omitted keys fall back to SDK defaults.
 */
function fetchOptions(input: {
  effort?: "min" | "standard" | "max";
  nocache?: boolean;
  country?: string;
}) {
  return {
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    ...(input.nocache !== undefined ? { nocache: input.nocache } : {}),
    ...(input.country !== undefined ? { geo_target: { country: input.country } } : {}),
  };
}

/**
 * Build the SDK `RequestOptions` from the per-call tool options. Currently just
 * forwards the `AbortSignal` so a cancelled tool call aborts the network request.
 * Returns `undefined` when there is nothing to pass, so the SDK uses its defaults.
 */
function requestOptions(options?: TabstackToolExecuteOptions) {
  return options?.signal ? { signal: options.signal } : undefined;
}

/**
 * Extract structured data from a URL according to a JSON-encoded JSON Schema.
 * Calls `client.extract.json`.
 */
export async function extractStructuredData(
  input: ExtractStructuredDataInput,
  client: TabstackClient,
  options?: TabstackToolExecuteOptions,
): Promise<ExtractStructuredDataResult> {
  try {
    const jsonSchema: unknown = JSON.parse(input.json_schema_json);
    const result = await client.extract.json(
      {
        url: input.url,
        json_schema: jsonSchema,
        ...fetchOptions(input),
      },
      requestOptions(options),
    );
    return result as ExtractStructuredDataResult;
  } catch (err) {
    throw normalizeError(err);
  }
}

/** Fetch a URL and return its content as clean markdown via `client.extract.markdown`. */
export async function extractPageContent(
  input: ExtractPageContentInput,
  client: TabstackClient,
  options?: TabstackToolExecuteOptions,
): Promise<ExtractPageContentResult> {
  try {
    const result = await client.extract.markdown(
      { url: input.url, ...fetchOptions(input) },
      requestOptions(options),
    );
    return result.content;
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Research a question across multiple web sources via `client.agent.research`.
 * Consumes the SSE stream and returns the synthesised report plus cited sources.
 */
export async function researchQuestion(
  input: ResearchQuestionInput,
  client: TabstackClient,
  options?: TabstackToolExecuteOptions,
): Promise<ResearchResult> {
  try {
    const stream = await client.agent.research(
      {
        query: input.query,
        mode: input.mode ?? "balanced",
        ...(input.nocache !== undefined ? { nocache: input.nocache } : {}),
      },
      requestOptions(options),
    );
    for await (const event of stream) {
      if (event.event === "error") {
        const message = event.data.message || "unknown error";
        throw new Error(`Research failed: ${message}`);
      }
      if (event.event === "complete") {
        const cited = event.data.metadata.citedPages ?? [];
        return {
          answer: event.data.report,
          sources: cited.map((page) => ({ title: page.title ?? "", url: page.url })),
        };
      }
    }
    // The SDK swallows an aborted stream and returns silently, so the loop ends
    // normally on cancel. Surface it as a failure rather than the fallback below.
    if (options?.signal?.aborted) {
      throw new TabstackToolError("Tabstack tool call was aborted");
    }
    return { answer: "Research did not complete", sources: [] };
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Fetch a URL and transform its content with AI into structured data according
 * to a JSON-encoded JSON Schema. Calls `client.generate.json`.
 */
export async function generateStructuredData(
  input: GenerateStructuredDataInput,
  client: TabstackClient,
  options?: TabstackToolExecuteOptions,
): Promise<GenerateStructuredDataResult> {
  try {
    const jsonSchema: unknown = JSON.parse(input.json_schema_json);
    const result = await client.generate.json(
      {
        url: input.url,
        instructions: input.instructions,
        json_schema: jsonSchema,
        ...fetchOptions(input),
      },
      requestOptions(options),
    );
    return result as GenerateStructuredDataResult;
  } catch (err) {
    throw normalizeError(err);
  }
}

/**
 * Run a natural-language browser automation task via `client.agent.automate`.
 * Consumes the SSE stream non-interactively and returns the agent's final result.
 */
export async function automateBrowserTask(
  input: AutomateBrowserTaskInput,
  client: TabstackClient,
  options?: TabstackToolExecuteOptions,
): Promise<AutomateBrowserTaskResult> {
  try {
    const stream = await client.agent.automate(
      {
        task: input.task,
        // Interactive mode is intentionally left off: a one-shot tool cannot
        // service the human-in-the-loop form-data callback (`agent.automateInput`).
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.guardrails !== undefined ? { guardrails: input.guardrails } : {}),
        ...(input.data !== undefined ? { data: input.data } : {}),
        ...(input.country !== undefined ? { geo_target: { country: input.country } } : {}),
        ...(input.max_iterations !== undefined ? { maxIterations: input.max_iterations } : {}),
        ...(input.max_validation_attempts !== undefined
          ? { maxValidationAttempts: input.max_validation_attempts }
          : {}),
      },
      requestOptions(options),
    );

    const extracted: string[] = [];
    const pagesVisited: AutomateVisitedPage[] = [];

    for await (const event of stream) {
      switch (event.event) {
        case "agent:extracted":
          extracted.push(event.data.extractedData);
          break;
        case "browser:navigated":
          pagesVisited.push({ url: event.data.url, title: event.data.title });
          break;
        case "error":
          throw new Error(`Automation failed: ${event.data.error.message}`);
        case "complete": {
          const data = event.data;
          if (!data.success && data.error) {
            throw new Error(`Automation failed: ${data.error.message}`);
          }
          return {
            answer: data.finalAnswer,
            success: data.success,
            iterations: data.stats.iterations,
            actions: data.stats.actions,
            durationMs: data.stats.durationMs,
            extracted,
            pagesVisited,
          };
        }
        default:
          break;
      }
    }
    // The SDK swallows an aborted stream and returns silently, so the loop ends
    // normally on cancel. Surface it as a failure rather than the fallback below.
    if (options?.signal?.aborted) {
      throw new TabstackToolError("Tabstack tool call was aborted");
    }
    return {
      answer: null,
      success: false,
      iterations: 0,
      actions: 0,
      durationMs: 0,
      extracted,
      pagesVisited,
    };
  } catch (err) {
    throw normalizeError(err);
  }
}

/** The set of Tabstack tool specs, bound to a client. */
export interface TabstackTools {
  extractStructuredData: TabstackToolSpec<ExtractStructuredDataInput, ExtractStructuredDataResult>;
  extractPageContent: TabstackToolSpec<ExtractPageContentInput, ExtractPageContentResult>;
  researchQuestion: TabstackToolSpec<ResearchQuestionInput, ResearchResult>;
  generateStructuredData: TabstackToolSpec<
    GenerateStructuredDataInput,
    GenerateStructuredDataResult
  >;
  automateBrowserTask: TabstackToolSpec<AutomateBrowserTaskInput, AutomateBrowserTaskResult>;
}

/**
 * Build the framework-agnostic tool specs. When `client` is omitted, each tool
 * resolves the lazily-constructed default client at call time, so building the
 * specs never requires an API key.
 */
export function createTabstackTools(client?: TabstackClient): TabstackTools {
  const resolve = (): TabstackClient => client ?? getDefaultClient();
  return {
    extractStructuredData: {
      name: NAMES.extractStructuredData,
      description: DESCRIPTIONS.extractStructuredData,
      schema: extractStructuredDataSchema,
      execute: (input, options) => extractStructuredData(input, resolve(), options),
    },
    extractPageContent: {
      name: NAMES.extractPageContent,
      description: DESCRIPTIONS.extractPageContent,
      schema: extractPageContentSchema,
      execute: (input, options) => extractPageContent(input, resolve(), options),
    },
    researchQuestion: {
      name: NAMES.researchQuestion,
      description: DESCRIPTIONS.researchQuestion,
      schema: researchQuestionSchema,
      execute: (input, options) => researchQuestion(input, resolve(), options),
    },
    generateStructuredData: {
      name: NAMES.generateStructuredData,
      description: DESCRIPTIONS.generateStructuredData,
      schema: generateStructuredDataSchema,
      execute: (input, options) => generateStructuredData(input, resolve(), options),
    },
    automateBrowserTask: {
      name: NAMES.automateBrowserTask,
      description: DESCRIPTIONS.automateBrowserTask,
      schema: automateBrowserTaskSchema,
      execute: (input, options) => automateBrowserTask(input, resolve(), options),
    },
  };
}

export { NAMES as toolNames, DESCRIPTIONS as toolDescriptions };
