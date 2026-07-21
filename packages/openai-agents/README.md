# @tabstack/openai-agents

Give your [OpenAI Agents SDK](https://openai.github.io/openai-agents-js/) agents reliable web
access. Schema-enforced extraction, multi-source research, AI transformation, and browser
automation, all as native Agents SDK tools backed by the official
[Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

Wiring web access into an agent usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Schema-enforced output.** Define the shape, get that shape back.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in tools.** Pre-built `tool()` definitions you hand straight to an `Agent`.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/openai-agents @openai/agents zod
```

`@openai/agents` (v0.13 or later) and `zod` (v4) are peer dependencies. Set your API key (get one at
[console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

`tabstackTools` is an array of ready-to-use tools. Hand it to an `Agent` and run it:

```ts
import { Agent, run } from "@openai/agents";
import { tabstackTools } from "@tabstack/openai-agents";

const agent = new Agent({
  name: "Research assistant",
  instructions:
    "You are a research assistant with web intelligence tools. Use research_question for open " +
    "questions that need multiple sources, extract_page_content to read a specific URL as " +
    "markdown, and the extract tools to pull structured fields from a page. Always cite sources.",
  tools: tabstackTools,
});

const result = await run(agent, "What are Vercel's pricing plans, with sources?");
console.log(result.finalOutput);
```

The tools resolve `TABSTACK_API_KEY` lazily on first call, so importing the package never requires a
key.

## The tools

| Tool name | Export | What it does |
| --- | --- | --- |
| `extract_structured_data` | `extractStructuredDataTool` | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content` | `extractPageContentTool` | Fetch a page as clean markdown. |
| `research_question` | `researchQuestionTool` | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data` | `generateStructuredDataTool` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task` | `automateBrowserTaskTool` | Run a multi-step, natural-language browser task. |

The tool names stay in lockstep with the `@tabstack/langchain`, `@tabstack/ai`, `@tabstack/eve`, and
Python `langchain-tabstack` packages.

## Configuration

For a custom API key or base URL, or to reuse one client, build the tools explicitly:

```ts
import { createTabstackOpenAIAgentsTools } from "@tabstack/openai-agents";

const tools = createTabstackOpenAIAgentsTools({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackOpenAIAgentsTools({ client })
```

## Strict mode and schemas

The OpenAI Agents SDK forces **strict** JSON Schema mode whenever a tool's `parameters` is a Zod
schema, and passing `strict: false` alongside a Zod schema throws. Strict mode cannot represent the
constructs the shared core schemas use:

- `.optional()` fields (strict mode requires every property to appear in `required`), and
- `automate_browser_task`'s open `data` object (`z.record(...)`, which needs a schema-valued
  `additionalProperties` that strict mode forbids).

So this adapter converts each core Zod schema to a JSON Schema and registers the tools with
`strict: false`. The model still sees full field descriptions, and every call is validated against
the core Zod schema inside `execute` before the SDK request runs, so malformed model output fails
fast with a clear error. The shared core schemas are never modified.

## Error handling

When a tool call fails it throws `TabstackToolError` (a normalised message plus an HTTP `status` for
API errors). The Agents SDK catches tool errors and surfaces them to the model as a tool result, so
a failing call does not abort the run by default.

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so importing the package never requires an API key to be set.
- **Requires Zod 4.** The SDK itself depends on Zod 4, and the adapter uses Zod 4's native
  `z.toJSONSchema` to advertise each tool's parameters.

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [OpenAI Agents SDK for TypeScript](https://openai.github.io/openai-agents-js/)
- [Get an API key](https://console.tabstack.ai)
