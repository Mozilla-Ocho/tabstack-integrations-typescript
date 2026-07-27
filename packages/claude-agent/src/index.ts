import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import {
  type TabstackClient,
  type TabstackClientConfig,
  type TabstackToolSpec,
  createTabstackClient,
  createTabstackTools,
  normalizeError,
  toolNames,
} from "@tabstack/integrations-core";
import type { ZodRawShape } from "zod";

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

/** Name of the in-process MCP server the tools are registered under. */
export const tabstackMcpServerName = "tabstack";

/** Version advertised by the in-process MCP server. */
const SERVER_VERSION = "0.1.0";

/**
 * Fully qualified tool names as Claude sees them: `mcp__{server}__{tool}`. Pass
 * this straight to a `query()` call's `allowedTools` to pre-approve every
 * Tabstack tool (equivalent to the `mcp__tabstack__*` wildcard).
 */
export const tabstackAllowedTools: string[] = Object.values(toolNames).map(
  (name) => `mcp__${tabstackMcpServerName}__${name}`,
);

/**
 * Serialize a core tool result into MCP text content. `extract_page_content`
 * returns a markdown string; every other tool returns a native JS object, which
 * is JSON-encoded so the model reads it verbatim.
 */
function serialize(result: unknown): string {
  return typeof result === "string" ? result : JSON.stringify(result);
}

/**
 * Wrap one core tool spec in a Claude Agent SDK `tool()`.
 *
 * `tool()` takes a Zod **raw shape** (an object of field schemas), not a
 * `z.object(...)`, and infers the handler's `args` from it. The core spec
 * exposes a `z.object(...)` as `spec.schema`, so its `.shape` is unwrapped to the
 * raw shape the SDK expects. The SDK validates `args` against that shape before
 * the handler runs, so no re-parse is needed here.
 *
 * On failure the error is normalized to `TabstackToolError` and returned as an
 * MCP error result (`isError: true`), matching the SDK's guidance to compose the
 * message Claude reads rather than surfacing a raw exception.
 */
function toClaudeAgentTool<TInput, TOutput>(spec: TabstackToolSpec<TInput, TOutput>) {
  const rawShape = (spec.schema as unknown as { shape: ZodRawShape }).shape;
  return tool(spec.name, spec.description, rawShape, async (args) => {
    try {
      const result = await spec.execute(args as unknown as TInput);
      return { content: [{ type: "text" as const, text: serialize(result) }] };
    } catch (err) {
      const normalized = normalizeError(err);
      return {
        content: [{ type: "text" as const, text: normalized.message }],
        isError: true,
      };
    }
  });
}

/** Wrap every core spec as a Claude Agent SDK tool, in lockstep with core. */
function buildTools(specs: ReturnType<typeof createTabstackTools>) {
  return [
    toClaudeAgentTool(specs.extractStructuredData),
    toClaudeAgentTool(specs.extractPageContent),
    toClaudeAgentTool(specs.researchQuestion),
    toClaudeAgentTool(specs.generateStructuredData),
    toClaudeAgentTool(specs.automateBrowserTask),
  ];
}

/**
 * Build Tabstack Claude Agent SDK tools bound to a specific client (or config).
 * Use this when you need a non-default API key or base URL, then pass the tools
 * to `createTabstackClaudeAgentServer` or `createSdkMcpServer` yourself.
 *
 * @returns an array of tool definitions ready for `createSdkMcpServer`.
 */
export function createTabstackClaudeAgentTools(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  const { client, ...clientConfig } = config;
  return buildTools(createTabstackTools(client ?? createTabstackClient(clientConfig)));
}

/**
 * Build a ready-to-use in-process MCP server exposing every Tabstack tool. Pass
 * it to `query()` via `options.mcpServers` under the `tabstack` key, and
 * pre-approve the tools with `tabstackAllowedTools`.
 */
export function createTabstackClaudeAgentServer(
  config: TabstackClientConfig & { client?: TabstackClient } = {},
) {
  return createSdkMcpServer({
    name: tabstackMcpServerName,
    version: SERVER_VERSION,
    tools: createTabstackClaudeAgentTools(config),
  });
}

/**
 * Default-client Tabstack tools. The client is resolved lazily on first tool
 * call, so importing this module never requires TABSTACK_API_KEY to be set.
 */
export const tabstackTools = buildTools(createTabstackTools());

/**
 * Default-client in-process MCP server, ready to drop into `query()` via
 * `options.mcpServers: { [tabstackMcpServerName]: tabstackServer }`.
 */
export const tabstackServer = createSdkMcpServer({
  name: tabstackMcpServerName,
  version: SERVER_VERSION,
  tools: tabstackTools,
});
