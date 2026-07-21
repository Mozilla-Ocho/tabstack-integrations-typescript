import { query } from "@anthropic-ai/claude-agent-sdk";
import {
  tabstackAllowedTools,
  tabstackMcpServerName,
  tabstackServer,
} from "@tabstack/claude-agent";

// A minimal, runnable Claude Agent SDK script that can browse and extract the web
// through Tabstack. The tools are exposed as an in-process MCP server built by
// @tabstack/claude-agent; they read TABSTACK_API_KEY from the environment on
// first call. The agent loop runs on Anthropic's Claude, so ANTHROPIC_API_KEY
// must be set too.
//
// Run it:
//   export TABSTACK_API_KEY=...
//   export ANTHROPIC_API_KEY=...
//   pnpm --filter @tabstack/claude-agent-demo dev "your question here"

function requireEnv(name: string): void {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Set it before running the demo.`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  requireEnv("TABSTACK_API_KEY");
  requireEnv("ANTHROPIC_API_KEY");

  const question =
    process.argv.slice(2).join(" ").trim() ||
    "What are Vercel's current pricing plans, and how do they compare? Cite your sources.";

  console.log(`\nQuestion: ${question}\n`);

  for await (const message of query({
    prompt: question,
    options: {
      // Register the Tabstack tools as an in-process MCP server, then pre-approve
      // them so the agent runs without a permission prompt.
      mcpServers: { [tabstackMcpServerName]: tabstackServer },
      allowedTools: tabstackAllowedTools,
      // Disable the built-in Claude Code tools (WebFetch, Bash, etc.) so the
      // agent reaches for Tabstack's web tools instead of shadowing them.
      tools: [],
    },
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          console.log(`[tool call] ${block.name}`);
        }
      }
    } else if (message.type === "result" && message.subtype === "success") {
      console.log(`\n${message.result}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
