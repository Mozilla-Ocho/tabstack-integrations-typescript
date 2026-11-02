# @tabstack/claude-agent

Give your [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) agents the web
without giving up your privacy. Cited research, clean page content, matching JSON, and browser
tasks, all as Claude Agent SDK tools, backed by the official
[Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk). Never trained on. Private by default.
Built by Mozilla.

## Why Tabstack

Wiring web access into an agent usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Cited research.** One call searches live sources and returns a synthesised answer with its
  citations.
- **Schema-enforced output.** Define the shape, get that shape back.
- **Browser tasks.** Natural-language, multi-step web tasks that navigate, fill forms, and pull
  results across pages.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in tools.** One call builds a ready-to-use server for `query()`.
- **One key for everything:** research, extraction, generation, and automation.

## Install

```bash
npm install @tabstack/claude-agent @anthropic-ai/claude-agent-sdk zod
```

`@anthropic-ai/claude-agent-sdk` and `zod` are peer dependencies. The Claude Agent SDK requires
**Zod 4**, so this package's `zod` peer is `^4.0.0`. Set your API keys (get a Tabstack key at
[console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

## Quickstart

`tabstackServer` is a ready-built in-process MCP server, and `tabstackAllowedTools` pre-approves
every Tabstack tool. Wire both into a `query()` call:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { tabstackServer, tabstackAllowedTools, tabstackMcpServerName } from "@tabstack/claude-agent";

for await (const message of query({
  prompt: "What are Vercel's current pricing plans, with sources?",
  options: {
    mcpServers: { [tabstackMcpServerName]: tabstackServer },
    allowedTools: tabstackAllowedTools,
  },
})) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

The server resolves `TABSTACK_API_KEY` lazily on first tool call, so importing the package never
requires a key.

## The tools

| Tool name | What it does |
| --- | --- |
| `extract_structured_data` | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content` | Fetch a page as clean markdown. |
| `research_question` | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task` | Run a multi-step, natural-language browser task. |

Claude sees each tool under its fully qualified MCP name, `mcp__tabstack__<tool_name>`. The tool
names stay in lockstep with the `@tabstack/langchain`, `@tabstack/ai`, `@tabstack/eve`, and Python
`langchain-tabstack` packages.

## Configuration

For a custom API key or base URL, or to reuse one client, build the server explicitly:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  createTabstackClaudeAgentServer,
  tabstackAllowedTools,
  tabstackMcpServerName,
} from "@tabstack/claude-agent";

const server = createTabstackClaudeAgentServer({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackClaudeAgentServer({ client })

await query({
  prompt: "...",
  options: {
    mcpServers: { [tabstackMcpServerName]: server },
    allowedTools: tabstackAllowedTools,
  },
});
```

Prefer to assemble the server yourself? `createTabstackClaudeAgentTools(config)` returns the raw tool
array to pass to your own `createSdkMcpServer({ name, version, tools })`.

## Error handling

When a tool call fails, the handler normalizes the failure to a `TabstackToolError` (a clean message
plus an HTTP `status` for API errors) and returns it as an MCP error result (`isError: true`), so
Claude reads a useful message and can retry or explain rather than seeing a raw exception.

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so importing the package never requires an API key to be set.
- Each tool's input schema is the core Zod schema's raw shape, so the Claude Agent SDK validates the
  model's arguments before your handler runs.
- **Zod 4 is required** (the Claude Agent SDK depends on it). Your app's own Zod instance is used
  (it's a peer dependency).

## Links

- [Claude Agent SDK docs](https://code.claude.com/docs/en/agent-sdk/overview)
- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Get an API key](https://console.tabstack.ai)
