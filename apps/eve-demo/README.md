# @tabstack/eve-demo

A runnable [eve](https://vercel.com/eve) agent that wires in every Tabstack tool via
[`@tabstack/eve`](../../packages/eve). **Private / not published.** It exists to show the adapter
working end to end inside a real eve app.

## Layout

eve derives each tool's name from its filename under `agent/tools/`. Every file here re-exports one
pre-built tool from `@tabstack/eve`:

```
agent/
  agent.ts                 # defineAgent({ model })
  instructions.md          # system prompt
  channels/eve.ts          # eve channel (localDev + placeholder auth)
  tools/
    research_question.ts        -> researchQuestionTool
    extract_page_content.ts     -> extractPageContentTool
    extract_structured_data.ts  -> extractStructuredDataTool
    generate_structured_data.ts -> generateStructuredDataTool
    automate_browser_task.ts    -> automateBrowserTaskTool
```

## Run it

From the repo root:

```bash
pnpm install
pnpm --filter @tabstack/eve build   # build the adapter the demo depends on
```

Set your keys (Tabstack + your model provider), then start eve from this directory:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
export ANTHROPIC_API_KEY="your-anthropic-key"   # matches the model in agent/agent.ts
pnpm --filter @tabstack/eve-demo dev
```

Ask it something that needs the web, e.g. *"What are Vercel's current pricing plans, with sources?"*
It will call `research_question` and cite what it finds.

## Notes

- eve requires a recent Node (its scaffold pins `node >=24`). If `eve dev` complains about the Node
  version, upgrade Node for this app.
- Requires Zod 4: `@tabstack/eve` uses Zod 4's native `z.toJSONSchema`, so the demo pins `zod@^4`.
- Swap the `model` in `agent/agent.ts` for any provider eve supports; set that provider's API key.
