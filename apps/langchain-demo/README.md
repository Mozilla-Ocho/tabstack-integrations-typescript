# @tabstack/langchain-demo

A runnable [LangChain.js](https://js.langchain.com) agent that wires in every Tabstack tool via
[`@tabstack/langchain`](../../packages/langchain). **Private / not published.** It exists to show the
adapter working end to end in a real agent.

Unlike the eve demo (an agent-framework app with its own runtime), LangChain is a library, so this
demo is a plain Node script: it builds an agent with `createAgent`, hands it `tabstackTools`, and
invokes it on a question.

## Layout

```
src/
  index.ts   # createAgent({ model, tools: tabstackTools, systemPrompt }) + invoke
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/langchain build   # build the adapter the demo depends on
```

Set your keys (Tabstack + Anthropic), then run from the repo root:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
pnpm --filter @tabstack/langchain-demo dev "What are Vercel's pricing plans, with sources?"
```

With no argument it asks a default question. The agent decides which Tabstack tool to call
(`research_question`, `extract_page_content`, and so on) and prints the final answer.

## Notes

- The model is `anthropic:claude-sonnet-4-6`. Swap the `model` string in `src/index.ts` for any
  provider LangChain supports, install that provider package, and set its API key.
- Requires Zod 4: `@tabstack/langchain` declares `zod@^4` as a peer dependency, so the demo pins
  `zod@^4`. Mixing Zod majors between the app and the adapter breaks schema interop.
- `pnpm --filter @tabstack/langchain-demo typecheck` needs `@tabstack/langchain` built first (it
  resolves the adapter via its `dist`).
