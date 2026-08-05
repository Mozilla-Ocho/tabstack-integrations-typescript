# @tabstack/eve

Give your [eve](https://vercel.com/eve) agents reliable web access. Schema-enforced extraction,
multi-source research, AI transformation, and browser automation, all as native eve tools backed by
the official [Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

Wiring web access into an agent usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Schema-enforced output.** Define the shape, get that shape back.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in tools.** Pre-built `defineTool` definitions you re-export into `agent/tools/`.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/eve eve zod
```

`eve` (v0.24 or later) and `zod` are peer dependencies. Set your API key (get one at
[console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

eve derives each tool's name from its filename: add a file under `agent/tools/` and the model can
call it. Re-export a Tabstack tool as the file's **default export**, naming the file after the tool:

```ts
// agent/tools/research_question.ts
export { researchQuestionTool as default } from "@tabstack/eve";
```

```ts
// agent/tools/extract_page_content.ts
export { extractPageContentTool as default } from "@tabstack/eve";
```

That's it. The tools resolve `TABSTACK_API_KEY` lazily on first call and are now available to your
agent.

## The tools

| File name | Export | What it does |
| --- | --- | --- |
| `extract_structured_data.ts` | `extractStructuredDataTool` | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content.ts` | `extractPageContentTool` | Fetch a page as clean markdown. |
| `research_question.ts` | `researchQuestionTool` | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data.ts` | `generateStructuredDataTool` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task.ts` | `automateBrowserTaskTool` | Run a multi-step, natural-language browser task. |

The filename **must** match the tool name in the table (eve's identity is path-derived), so the tool
name stays in lockstep with the `@tabstack/langchain`, `@tabstack/ai`, and Python
`langchain-tabstack` packages.

## Configuration

For a custom API key or base URL, or to reuse one client, build the tools explicitly and re-export
the one you want:

```ts
// agent/tools/research_question.ts
import { createTabstackEveTools } from "@tabstack/eve";

const tools = createTabstackEveTools({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackEveTools({ client })
export default tools.research_question;
```

## Error handling

When a tool call fails it throws `TabstackToolError` (a normalised message plus an HTTP `status` for
API errors). eve surfaces this in the tool result.

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so importing the package never requires an API key to be set.
- Inputs are validated against the core Zod schema before the SDK call, so malformed model output
  fails fast with a clear error.
- **Requires Zod 4.** The adapter converts the core schema to JSON Schema with Zod 4's built-in
  `z.toJSONSchema`. `zod` is a peer dependency, so your app's own Zod 4 instance is used.

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Get an API key](https://console.tabstack.ai)
