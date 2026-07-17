import { tabstackTools } from "@tabstack/langchain";
import { createAgent } from "langchain";

// A minimal, runnable LangChain.js agent that can browse and extract the web
// through Tabstack. The tools come pre-built from @tabstack/langchain; they read
// TABSTACK_API_KEY from the environment on first call. The model is Anthropic's
// Claude, so ANTHROPIC_API_KEY must be set too.
//
// Run it:
//   export TABSTACK_API_KEY=...
//   export ANTHROPIC_API_KEY=...
//   pnpm --filter @tabstack/langchain-demo dev "your question here"

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

  const agent = createAgent({
    model: "anthropic:claude-sonnet-4-6",
    tools: tabstackTools,
    systemPrompt:
      "You are a research assistant with web intelligence tools. " +
      "Use research_question for open questions that need multiple sources, " +
      "extract_page_content to read a specific URL as markdown, and the extract " +
      "tools to pull structured fields from a page. Always cite the sources the " +
      "tools return.",
  });

  console.log(`\nQuestion: ${question}\n`);

  const result = await agent.invoke({
    messages: [{ role: "user", content: question }],
  });

  const answer = result.messages.at(-1)?.content;
  console.log(typeof answer === "string" ? answer : JSON.stringify(answer, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
