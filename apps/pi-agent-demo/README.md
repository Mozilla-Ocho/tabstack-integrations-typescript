# @tabstack/pi-agent-demo

A runnable [Pi coding agent](https://pi.dev) extension that wires in every Tabstack tool via
[`@tabstack/pi-agent`](../../packages/pi-agent). **Private / not published.** It exists to show the
adapter working end to end inside a real Pi session.

A Pi extension is not a standalone Node script: it is a `.ts` file with a default export that the
`pi` CLI loads and calls with its extension API. So this demo is that extension file plus the
commands to load it. There is no `dev`/`start` script; you run it through `pi`.

## Layout

```
src/
  extension.ts   # default export: (pi) => registers all Tabstack tools via createTabstackPiExtension()
```

## Run it

From the repo root, build the adapter the demo depends on:

```bash
pnpm install
pnpm --filter @tabstack/pi-agent build
```

Set your Tabstack key plus whatever model provider key Pi is configured to use (for example
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, per your Pi model config), then start Pi with the extension:

```bash
export TABSTACK_API_KEY="your-tabstack-key"
# plus the model key your Pi config uses, e.g.:
export ANTHROPIC_API_KEY="your-model-key"

pi -e ./src/extension.ts
```

Inside the Pi session, ask something that needs the web, for example: "Read
https://tabstack.ai and summarise what it does." Pi decides which Tabstack tool to call
(`extract_page_content`, `research_question`, and so on).

For always-on use, drop the extension into an auto-discovered location instead of passing `-e`:

- `~/.pi/agent/extensions/tabstack.ts` (global, every project)
- `.pi/extensions/tabstack.ts` (project-local)

The one-line form works there too:

```ts
export { default } from "@tabstack/pi-agent";
```

## Notes

- Requires Zod 4 (the adapter uses `z.toJSONSchema`) and `typebox` v1 (Pi's schema type).
- `pnpm --filter @tabstack/pi-agent-demo typecheck` needs `@tabstack/pi-agent` built first (it
  resolves the adapter via its `dist`).
- A live run needs the `pi` CLI installed and a model provider key configured in Pi; that part is not
  automated here.
