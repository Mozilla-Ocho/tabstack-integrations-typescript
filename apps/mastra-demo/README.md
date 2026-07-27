# @tabstack/mastra-demo

A runnable [Mastra](https://mastra.ai) agent that wires in every Tabstack tool via
[`@tabstack/mastra`](../../packages/mastra). **Private / not published.** It exists to show the
adapter working end to end inside a real Mastra agent.

## Layout

```
src/
  index.ts   # new Agent({ ..., tools: tabstackTools }) + a generate() call
```

`tabstackTools` is a named object keyed by tool name, spread straight into the agent's `tools`. Every
tool resolves `TABSTACK_API_KEY` lazily on first call.

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/mastra build   # build the adapter the demo depends on
```

Set your keys (Tabstack + your model provider), then start the demo from this directory:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"   # matches the model in src/index.ts
pnpm --filter @tabstack/mastra-demo dev
```

Pass your own question as arguments, or take the default:

```bash
pnpm --filter @tabstack/mastra-demo dev "Summarize the latest on quantum error correction, with sources."
```

It will call `research_question` (or the extract tools when you name a URL) and cite what it finds.

## Notes

- Swap the `model` string in `src/index.ts` for any provider Mastra's model router supports; set that
  provider's API key.
- The demo pins `zod@^3`, but `@tabstack/mastra` supports both Zod 3 and Zod 4, so bump it if you
  prefer.
