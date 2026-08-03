# @tabstack/llamaindex-demo

A runnable [LlamaIndex.TS](https://developers.llamaindex.ai/typescript) agent that wires in every
Tabstack tool via [`@tabstack/llamaindex`](../../packages/llamaindex). **Private / not published.**
It exists to show the adapter working end to end in a real agent.

LlamaIndex.TS is a library, so this demo is a plain Node script: it builds an agent with `agent()`,
hands it `tabstackTools`, and runs it on a question.

## Layout

```
src/
  index.ts   # agent({ tools: tabstackTools, systemPrompt }) + run
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/llamaindex build   # build the adapter the demo depends on
```

Set your keys (Tabstack + OpenAI), then run from the repo root:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export OPENAI_API_KEY="your-openai-key"
pnpm --filter @tabstack/llamaindex-demo dev "What are Vercel's pricing plans, with sources?"
```

With no argument it asks a default question. The agent decides which Tabstack tool to call
(`research_question`, `extract_page_content`, and so on) and prints the final answer.

## Notes

- The model is OpenAI `gpt-4o`, set via `Settings.llm`. Swap `openai({ model })` in `src/index.ts`
  for any provider LlamaIndex supports, install that provider package, and set its API key.
- Requires Zod 4: `@tabstack/llamaindex` declares `zod@^4` as a peer dependency, so the demo pins
  `zod@^4`. Mixing Zod majors between the app and the adapter breaks schema interop.
- `pnpm --filter @tabstack/llamaindex-demo typecheck` needs `@tabstack/llamaindex` built first (it
  resolves the adapter via its `dist`).
