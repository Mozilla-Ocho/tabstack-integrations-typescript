# AGENTS.md: @tabstack/claude-agent

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The Claude Agent SDK adapter. A thin shell that wraps the framework-agnostic tool specs from
`@tabstack/integrations-core` in `tool()` from `@anthropic-ai/claude-agent-sdk`, grouped into an
in-process MCP server via `createSdkMcpServer`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into a Claude Agent SDK
`query()` as native, in-process MCP tools, backed by the official SDK. Schema-enforced, no bespoke
fetch glue.

## How to use it (consumer)

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { tabstackServer, tabstackAllowedTools, tabstackMcpServerName } from "@tabstack/claude-agent";

await query({
  prompt: "...",
  options: {
    mcpServers: { [tabstackMcpServerName]: tabstackServer },
    allowedTools: tabstackAllowedTools,
  },
});
// custom client: createTabstackClaudeAgentServer({ apiKey }) or ({ client })
```

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `tool(name, description, inputSchema, handler)`:
  - `tool()`'s `inputSchema` is a Zod **raw shape** (an object of field schemas like
    `{ url: z.string() }`), **not** a `z.object(...)`. The core schema is a `z.object(...)`, so its
    `.shape` is unwrapped to the raw shape the SDK expects. Do **not** pass `spec.schema` directly.
  - The SDK validates `args` against that shape before the handler runs, so the handler does **not**
    re-parse. It calls `spec.execute(args)` and serializes the result into MCP text content
    (`{ content: [{ type: "text", text }] }`). `extract_page_content` returns a markdown string
    passed through as-is; every other tool returns an object, JSON-encoded into the text.
  - On failure the handler normalizes the error with core's `normalizeError` and returns an MCP error
    result (`isError: true`) carrying the message, per the SDK's guidance to compose the message
    Claude reads rather than surfacing a raw throw.
- `createSdkMcpServer({ name: "tabstack", version, tools })` groups the tools. Claude sees each tool
  as `mcp__tabstack__<tool_name>`; `tabstackAllowedTools` is the list of those fully qualified names.

## Exports

- `createTabstackClaudeAgentTools(config)`: array of tool definitions for a specific client/config.
- `createTabstackClaudeAgentServer(config)`: a ready-to-use `createSdkMcpServer` result.
- `tabstackTools` / `tabstackServer`: default-client, lazy versions built at import.
- `tabstackMcpServerName` (`"tabstack"`) and `tabstackAllowedTools` (the `mcp__tabstack__*` names).
- Re-exports the same core items as the other adapters (schemas, `toolNames`, `toolDescriptions`,
  `TabstackToolError`, `TabstackClient`, `TabstackClientConfig`).

## Rules specific to this package

- `@anthropic-ai/claude-agent-sdk` (>=0.3.0) and `zod` are **peer dependencies** (+ dev dependencies).
  Never direct.
- The `zod` peer is `^4.0.0`. The Claude Agent SDK requires Zod 4, and the whole repo is Zod 4 only.
  No JSON Schema conversion is needed, so there is no `zod-to-json-schema` dependency.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add an entry in `buildTools` and a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the binaries
directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock both the Tabstack SDK client and
`@anthropic-ai/claude-agent-sdk`, then assert names, descriptions, the unwrapped raw-shape schema,
the MCP content shape, error normalization, and execution routing all match core.
