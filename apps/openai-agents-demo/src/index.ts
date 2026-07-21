import { Agent, run } from "@openai/agents";
import { tabstackTools } from "@tabstack/openai-agents";

// A minimal, runnable OpenAI Agents SDK agent that can browse and extract the
// web through Tabstack. The tools come pre-built from @tabstack/openai-agents;
// they read TABSTACK_API_KEY from the environment on first call. The Agents SDK
// talks to OpenAI, so OPENAI_API_KEY must be set too.
//
// Run it:
//   export TABSTACK_API_KEY=...
//   export OPENAI_API_KEY=...
//   pnpm --filter @tabstack/openai-agents-demo dev "your question here"

function requireEnv(name: string): void {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Set it before running the demo.`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  requireEnv("TABSTACK_API_KEY");
  requireEnv("OPENAI_API_KEY");

  const question =
    process.argv.slice(2).join(" ").trim() ||
    "What are Vercel's current pricing plans, and how do they compare? Cite your sources.";

  const agent = new Agent({
    name: "Research assistant",
    model: "gpt-4.1",
    instructions:
      "You are a research assistant with web intelligence tools. " +
      "Use research_question for open questions that need multiple sources, " +
      "extract_page_content to read a specific URL as markdown, and the extract " +
      "tools to pull structured fields from a page. Always cite the sources the " +
      "tools return.",
    tools: tabstackTools,
  });

  console.log(`\nQuestion: ${question}\n`);

  const result = await run(agent, question);
  console.log(result.finalOutput);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
