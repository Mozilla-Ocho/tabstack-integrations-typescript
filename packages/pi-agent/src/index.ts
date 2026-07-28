import {
  type ExtensionAPI,
  type ToolDefinition,
  defineTool,
} from "@earendil-works/pi-coding-agent";
import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  type TabstackTools,
  createTabstackClient,
  createTabstackTools,
  normalizeError,
} from "@tabstack/integrations-core";
import { type TSchema, Type } from "typebox";
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
export { schemaToJsonSchema } from "./schema.js";

/** Human-readable labels for the Pi tool UI, keyed by the core (snake_case) tool name. */
const LABELS: Record<string, string> = {
  extract_structured_data: "Extract Structured Data",
  extract_page_content: "Extract Page Content",
  research_question: "Research Question",
  generate_structured_data: "Generate Structured Data",
  automate_browser_task: "Automate Browser Task",
};

/**
 * Wrap one core tool spec in a Pi `ToolDefinition` for `pi.registerTool`.
 *
 * Pi types `parameters` as a Typebox schema. Core is the single source of truth
 * for the input schema (a Zod schema), so instead of hand-authoring a duplicate
 * Typebox schema we convert the core Zod schema to JSON Schema and wrap it with
 * `Type.Unsafe`, which tags a raw JSON Schema object as a Typebox schema (Typebox
 * schemas are themselves JSON Schema, so Pi sends it straight to the provider).
 *
 * Because the advertised schema is `Type.Unsafe<unknown>`, Pi hands `execute` the
 * raw params, so we re-parse through the core Zod schema to recover typed input,
 * normalizing a parse failure to `TabstackToolError`. Pi reports a failed tool by
 * a thrown error (it never encodes an error into the result content), so throwing
 * is the right contract. String results (`extract_page_content`) pass through;
 * object results are serialized to JSON text for the model.
 */
function toPiTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>): ToolDefinition {
  return defineTool({
    name: spec.name,
    label: LABELS[spec.name] ?? spec.name,
    description: spec.description,
    parameters: Type.Unsafe(schemaToJsonSchema(spec.schema) as unknown as TSchema),
    async execute(_toolCallId, params) {
      let parsed: TInput;
      try {
        parsed = spec.schema.parse(params) as TInput;
      } catch (err) {
        throw normalizeError(err);
      }
      const result = await spec.execute(parsed);
      const text = typeof result === "string" ? result : JSON.stringify(result);
      return { content: [{ type: "text" as const, text }], details: result };
    },
  });
}

/** The core (snake_case) name of every Tabstack tool this adapter exposes to Pi. */
export type TabstackPiToolName =
  | "extract_structured_data"
  | "extract_page_content"
  | "research_question"
  | "generate_structured_data"
  | "automate_browser_task";

/** Build every Tabstack Pi `ToolDefinition` from a set of core specs, keyed by tool name. */
function buildToolDefs(specs: TabstackTools): Record<TabstackPiToolName, ToolDefinition> {
  return {
    extract_structured_data: toPiTool(specs.extractStructuredData),
    extract_page_content: toPiTool(specs.extractPageContent),
    research_question: toPiTool(specs.researchQuestion),
    generate_structured_data: toPiTool(specs.generateStructuredData),
    automate_browser_task: toPiTool(specs.automateBrowserTask),
  };
}

/**
 * Build the Tabstack Pi `ToolDefinition`s bound to a specific client (or config),
 * keyed by tool name. Use this when you want full control over which tools to
 * register, or to register them alongside your own tools in a hand-written
 * extension.
 *
 * @returns a record of `ToolDefinition` keyed by the core tool name.
 */
export function createTabstackPiTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
): Record<TabstackPiToolName, ToolDefinition> {
  const { client, ...clientConfig } = config;
  return buildToolDefs(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

/**
 * Build a Pi extension bound to a specific client (or config). Use this when you
 * need a non-default API key or base URL, or when you want only a subset of the
 * tools available to the agent.
 *
 * By default all five tools are registered. Pass `tools` to register only some,
 * for example `{ tools: ["extract_page_content", "research_question"] }` for a
 * read-and-research agent with no browser automation. The tools are registered in
 * the order given.
 *
 * @returns a Pi extension factory `(pi) => void`.
 */
export function createTabstackPiExtension(
  config: TabstackClientConfig & { client?: TabstackClient; tools?: TabstackPiToolName[] } = {},
): (pi: ExtensionAPI) => void {
  const { client, tools, ...clientConfig } = config;
  const defs = buildToolDefs(createTabstackTools(client ?? createTabstackClient(clientConfig)));
  const names = tools ?? (Object.keys(defs) as TabstackPiToolName[]);
  return (pi) => {
    for (const name of names) {
      const def = defs[name];
      if (!def) throw new Error(`Unknown Tabstack Pi tool: ${name}`);
      pi.registerTool(def);
    }
  };
}

// Default-client tool definitions. Built at import, but the client is resolved
// lazily on first tool call, so importing this module never requires the key.
const defaultDefs = buildToolDefs(createTabstackTools());

// Explicit `ToolDefinition` annotations: the inferred type otherwise references
// typebox internals and is not portable in the emitted declarations (TS2742).
/** Extract structured JSON data from a URL. Pi `ToolDefinition`, default client. */
export const extractStructuredDataTool: ToolDefinition = defaultDefs.extract_structured_data;
/** Fetch a URL and return clean markdown. Pi `ToolDefinition`, default client. */
export const extractPageContentTool: ToolDefinition = defaultDefs.extract_page_content;
/** Research a question across multiple web sources. Pi `ToolDefinition`, default client. */
export const researchQuestionTool: ToolDefinition = defaultDefs.research_question;
/** Fetch a URL and transform its content with AI into JSON. Pi `ToolDefinition`, default client. */
export const generateStructuredDataTool: ToolDefinition = defaultDefs.generate_structured_data;
/** Run a natural-language browser automation task. Pi `ToolDefinition`, default client. */
export const automateBrowserTaskTool: ToolDefinition = defaultDefs.automate_browser_task;

/**
 * Default Pi extension. Registers all five Tabstack tools using the default
 * client, which resolves `TABSTACK_API_KEY` lazily on first tool call, so loading
 * the extension never requires the key to be set. For a subset, use
 * `createTabstackPiExtension({ tools: [...] })`.
 */
const tabstackExtension = (pi: ExtensionAPI): void => {
  for (const def of Object.values(defaultDefs)) pi.registerTool(def);
};

export default tabstackExtension;
