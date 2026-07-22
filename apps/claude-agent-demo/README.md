# @tabstack/claude-agent-demo

A runnable [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) script that wires
in every Tabstack tool via [`@tabstack/claude-agent`](../../packages/claude-agent). **Private / not
published.** It exists to show the adapter working end to end.

Like the LangChain demo, the Claude Agent SDK is a library, so this demo is a plain Node script: it
registers the Tabstack tools as an in-process MCP server, hands the server to `query()`, and streams
the agent's messages.

## Layout

```
src/
  index.ts   # query({ prompt, options: { mcpServers, allowedTools } }) + stream messages
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/claude-agent build   # build the adapter the demo depends on
```

Set your keys (Tabstack + Anthropic), then run from the repo root:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
pnpm --filter @tabstack/claude-agent-demo dev "What are Vercel's pricing plans, with sources?"
```

With no argument it asks a default question. The agent decides which Tabstack tool to call
(`research_question`, `extract_page_content`, and so on), logs each tool call, and prints the final
answer.

## Notes

- Both `TABSTACK_API_KEY` (for the tools) and `ANTHROPIC_API_KEY` (for the agent loop) are required.
- The Claude Agent SDK requires **Zod 4**; the demo pins `zod@^4`.
- `pnpm --filter @tabstack/claude-agent-demo typecheck` needs `@tabstack/claude-agent` built first (it
  resolves the adapter via its `dist`).
