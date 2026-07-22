# @tabstack/openai-agents-demo

A runnable [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) agent that wires in every
Tabstack tool via [`@tabstack/openai-agents`](../../packages/openai-agents). **Private / not
published.** It exists to show the adapter working end to end in a real agent.

The Agents SDK is a library, so this demo is a plain Node script: it builds an `Agent` with
`tabstackTools`, and runs it on a question with `run(agent, question)`.

## Layout

```
src/
  index.ts   # new Agent({ model, tools: tabstackTools, instructions }) + run()
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/openai-agents build   # build the adapter the demo depends on
```

Set your keys (Tabstack + OpenAI), then run from the repo root:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export OPENAI_API_KEY="your-openai-key"
pnpm --filter @tabstack/openai-agents-demo dev "What are Vercel's pricing plans, with sources?"
```

With no argument it asks a default question. The agent decides which Tabstack tool to call
(`research_question`, `extract_page_content`, and so on) and prints the final answer.

## Notes

- The model is `gpt-4.1`. Swap the `model` string in `src/index.ts` for any model the Agents SDK
  supports.
- Requires Zod 4 (the Agents SDK and the adapter both depend on it).
- `pnpm --filter @tabstack/openai-agents-demo typecheck` needs `@tabstack/openai-agents` built first
  (it resolves the adapter via its `dist`).
