import { Agent } from "@mastra/core/agent";
import { tabstackTools } from "@tabstack/mastra";

// A minimal Mastra agent wired up with every Tabstack tool. The tools resolve
// TABSTACK_API_KEY lazily on first call, so no client is constructed until the
// model actually calls one. Set TABSTACK_API_KEY (and your model provider key,
// ANTHROPIC_API_KEY for the model below) before running.
const agent = new Agent({
  id: "tabstack-web-researcher",
  name: "Tabstack Web Researcher",
  instructions: [
    "You are a web research assistant powered by Tabstack tools.",
    "Use research_question for open questions that need current information,",
    "and the extract tools when the user names a specific URL.",
    "Always cite the sources the tools return.",
  ].join(" "),
  model: "anthropic/claude-sonnet-4-6",
  tools: tabstackTools,
});

async function main() {
  const prompt =
    process.argv.slice(2).join(" ") || "What are Vercel's current pricing plans, with sources?";

  console.log(`> ${prompt}\n`);
  const result = await agent.generate(prompt);
  console.log(result.text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
