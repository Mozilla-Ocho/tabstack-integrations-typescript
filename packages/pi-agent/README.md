# @tabstack/pi-agent

Give the [Pi coding agent](https://pi.dev) reliable web access. Schema-enforced extraction,
multi-source research, AI transformation, and browser automation, all registered as native Pi tools
through a Pi extension, backed by the official
[Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

Wiring web access into an agent usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Schema-enforced output.** Define the shape, get that shape back.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in extension.** A single default export you point the `pi` CLI at.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/pi-agent @earendil-works/pi-coding-agent typebox zod
```

`@earendil-works/pi-coding-agent` (v0.82 or later), `typebox` (v1), and `zod` (v4) are peer
dependencies. Set your API key (get one at [console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

A Pi extension is a `.ts` file with a default export that Pi calls with its extension API. Re-export
this package's default extension and Pi registers all five Tabstack tools:

```ts
// tabstack.ts
export { default } from "@tabstack/pi-agent";
```

Then load it with the `pi` CLI:

```bash
pi -e ./tabstack.ts
```

Pi also auto-discovers extensions dropped into either of these locations, no `-e` flag needed:

- `~/.pi/agent/extensions/*.ts` (global, applies to every project)
- `.pi/extensions/*.ts` (project-local, checked into the repo)

The tools resolve `TABSTACK_API_KEY` lazily on first call, so loading the extension never requires a
key to be set.

## The tools

| Tool name | Label | What it does |
| --- | --- | --- |
| `extract_structured_data` | Extract Structured Data | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content` | Extract Page Content | Fetch a page as clean markdown. |
| `research_question` | Research Question | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data` | Generate Structured Data | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task` | Automate Browser Task | Run a multi-step, natural-language browser task. |

The tool names stay in lockstep with the `@tabstack/langchain`, `@tabstack/openai-agents`,
`@tabstack/eve`, and Python `langchain-tabstack` packages.

## Registering a subset

You often do not want every tool. A coding agent that should read and research but never drive a
browser can register just those two. Pass `tools` to pick the subset (registered in the order given):

```ts
// tabstack.ts
import { createTabstackPiExtension } from "@tabstack/pi-agent";

// Read-and-research only, no browser automation.
export default createTabstackPiExtension({
  tools: ["extract_page_content", "research_question"],
});
```

For full control, register individual tools yourself in a hand-written extension. Every tool is
exported as a Pi `ToolDefinition` (default client), and `createTabstackPiTools(config)` returns them
keyed by name for a custom client:

```ts
import { extractPageContentTool, researchQuestionTool } from "@tabstack/pi-agent";
// or, custom client: import { createTabstackPiTools } from "@tabstack/pi-agent";

export default function (pi) {
  pi.registerTool(extractPageContentTool);
  pi.registerTool(researchQuestionTool);
  // ...and your own tools alongside them.
}
```

## Configuration

For a custom API key or base URL, or to reuse one client, build the extension explicitly:

```ts
// tabstack.ts
import { createTabstackPiExtension } from "@tabstack/pi-agent";

export default createTabstackPiExtension({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackPiExtension({ client })
// combine with a subset: createTabstackPiExtension({ apiKey, tools: ["research_question"] })
```

## How the schemas work

Pi types a tool's `parameters` as a [Typebox](https://github.com/sinclairzx81/typebox) schema. The
shared core package is the single source of truth for each tool's input schema (a Zod schema), so
rather than hand-authoring duplicate Typebox schemas this adapter converts each core Zod schema to
JSON Schema (Zod 4's native `z.toJSONSchema`) and wraps it with `Type.Unsafe`, which tags a raw JSON
Schema object as a Typebox schema. Every call is then re-validated against the core Zod schema inside
`execute`, so malformed model output fails fast with a clear error before any request runs. The
shared core schemas are never modified.

## Error handling

When a tool call fails it throws `TabstackToolError` (a normalised message plus an HTTP `status` for
API errors). Pi reports a failed tool by the thrown error, so the failure is surfaced to the model as
a tool result rather than aborting the session.

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so loading the extension never requires an API key to be set.
- **Cancellation works.** Pi's abort signal is threaded into the Tabstack request, so cancelling a tool
  call (for example a long `research_question` or `automate_browser_task`) aborts the request and stops
  billing, not just the agent loop.
- **Requires Zod 4.** The adapter uses Zod 4's native `z.toJSONSchema` to derive each tool's Typebox
  parameters.

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Pi extensions](https://pi.dev/docs/latest/extensions)
- [Get an API key](https://console.tabstack.ai)
