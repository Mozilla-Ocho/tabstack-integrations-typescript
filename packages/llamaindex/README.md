# @tabstack/llamaindex

Give your [LlamaIndex.TS](https://developers.llamaindex.ai/typescript) agents reliable web access.
Schema-enforced extraction, multi-source research, AI transformation, and browser automation, all as
native LlamaIndex tools backed by the official
[Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

Wiring web access into an agent usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Schema-enforced output.** Define the shape, get that shape back.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in tools.** Pre-built `tool()` definitions you pass straight to an agent.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/llamaindex llamaindex zod
```

`llamaindex` (v0.12 or later) and `zod` are peer dependencies. Set your API key (get one at
[console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

The tools come pre-built as an array. Pass them straight to an agent:

```ts
import { tabstackTools } from "@tabstack/llamaindex";
import { agent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";
import { Settings } from "llamaindex";

Settings.llm = openai({ model: "gpt-4o" });

const researcher = agent({ tools: tabstackTools });

const result = await researcher.run(
  "What are Vercel's current pricing plans? Cite your sources.",
);
console.log(result.data);
```

The tools resolve `TABSTACK_API_KEY` lazily on first call, so importing the package never requires a
key to be set.

## The tools

| Export | Tool name | What it does |
| --- | --- | --- |
| `extractStructuredDataTool` | `extract_structured_data` | Pull specific fields from a URL into a JSON shape you define. |
| `extractPageContentTool` | `extract_page_content` | Fetch a page as clean markdown. |
| `researchQuestionTool` | `research_question` | Synthesised answer with cited sources across multiple pages. |
| `generateStructuredDataTool` | `generate_structured_data` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automateBrowserTaskTool` | `automate_browser_task` | Run a multi-step, natural-language browser task. |

The tool names stay in lockstep with the `@tabstack/langchain`, `@tabstack/ai`, `@tabstack/eve`, and
Python `langchain-tabstack` packages. Import individual tools if you want a subset, or use the
`tabstackTools` array for all of them.

## Configuration

For a custom API key or base URL, or to reuse one client, build the tools explicitly:

```ts
import { createTabstackLlamaindexTools } from "@tabstack/llamaindex";

const tools = createTabstackLlamaindexTools({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackLlamaindexTools({ client })
```

## Error handling

When a tool call fails it throws `TabstackToolError` (a normalised message plus an HTTP `status` for
API errors). LlamaIndex surfaces this in the tool result.

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so importing the package never requires an API key to be set.
- Inputs are validated against the core Zod schema (LlamaIndex passes the schema straight through as
  the tool's `parameters`), so malformed model output is caught before the SDK call.
- **Zod 3 and Zod 4 both work.** LlamaIndex's `tool()` is Zod-native and accepts either; your app's
  own Zod version is used (it's a peer dependency).

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Get an API key](https://console.tabstack.ai)
