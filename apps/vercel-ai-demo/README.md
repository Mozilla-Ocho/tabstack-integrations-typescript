# @tabstack/vercel-ai-demo

A runnable [Vercel AI SDK](https://sdk.vercel.dev) agent that wires in every Tabstack tool via
[`@tabstack/ai`](../../packages/vercel-ai). **Private / not published.** It exists to show the
adapter working end to end in a real agent.

Like the LangChain demo, the AI SDK is a library, so this demo is a plain Node script: it calls
`generateText` with `tabstackTools` and a tool-calling loop, then prints the answer.

## Layout

```
src/
  index.ts   # generateText({ model, tools: tabstackTools, stopWhen, prompt })
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/ai build   # build the adapter the demo depends on
```

Set your keys (Tabstack + Anthropic), then run from the repo root:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
pnpm --filter @tabstack/vercel-ai-demo dev "What are Vercel's pricing plans, with sources?"
```

With no argument it asks a default question. `stopWhen: stepCountIs(5)` lets the model call a Tabstack
tool and then use the result to answer.

## Notes

- The model is `anthropic("claude-sonnet-4-6")`. Swap the provider in `src/index.ts` for any the AI
  SDK supports (for example `@ai-sdk/openai`), install that provider package, and set its API key.
- The demo pins `ai@^5` and `zod@^3`. `@tabstack/ai` supports the AI SDK v5+ and both Zod 3 and Zod
  4, so bump them if you prefer.
- `pnpm --filter @tabstack/vercel-ai-demo typecheck` needs `@tabstack/ai` built first (it resolves
  the adapter via its `dist`).
