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

/** Register all five Tabstack tools on a Pi extension API from a set of core specs. */
function registerAll(pi: ExtensionAPI, specs: TabstackTools): void {
  pi.registerTool(toPiTool(specs.extractStructuredData));
  pi.registerTool(toPiTool(specs.extractPageContent));
  pi.registerTool(toPiTool(specs.researchQuestion));
  pi.registerTool(toPiTool(specs.generateStructuredData));
  pi.registerTool(toPiTool(specs.automateBrowserTask));
}

/**
 * Build a Pi extension bound to a specific client (or config). Use this when you
 * need a non-default API key or base URL. The returned factory registers all five
 * Tabstack tools when Pi loads the extension.
 *
 * @returns a Pi extension factory `(pi) => void`.
 */
export function createTabstackPiExtension(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
): (pi: ExtensionAPI) => void {
  const { client, ...clientConfig } = config;
  const specs = createTabstackTools(client ?? createTabstackClient(clientConfig));
  return (pi) => registerAll(pi, specs);
}

/**
 * Default Pi extension. Registers all five Tabstack tools using the default
 * client, which resolves `TABSTACK_API_KEY` lazily on first tool call, so loading
 * the extension never requires the key to be set.
 */
const tabstackExtension = (pi: ExtensionAPI): void => {
  registerAll(pi, createTabstackTools());
};

export default tabstackExtension;
