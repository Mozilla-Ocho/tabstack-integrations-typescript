# @tabstack/ai

Give your [Vercel AI SDK](https://sdk.vercel.dev) apps reliable web access. Schema-enforced
extraction, multi-source research, AI transformation, and browser automation, all as native AI SDK
tools backed by the official [Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

Wiring web access into an AI SDK app usually means hand-rolled fetches, HTML parsing, and prompt
gymnastics to coax structured data out of messy text. Tabstack replaces that with a hosted API:

- **Schema-enforced output.** Define the shape with Zod or JSON Schema, get that shape back.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries.
- **Drop-in tools.** Typed `tool()` definitions that pass straight to `generateText` / `streamText`.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/ai ai zod
```

`ai` (v5 or later, v6 ready) and `zod` are peer dependencies, so your app's single instance of each
is shared. Set your API key (get one at [console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

```ts
import { openai } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import { tabstackTools } from "@tabstack/ai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools: tabstackTools,
  stopWhen: stepCountIs(5), // let the model call a tool, then use the result
  prompt: "What are Vercel's pricing plans and how do they compare?",
});

console.log(text);
```

`tabstackTools` reads `TABSTACK_API_KEY` from the environment. It is a named object keyed by tool
name, ready to pass straight to `tools`.

## The tools

| Tool | What it does |
| --- | --- |
| `extract_structured_data` | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content` | Fetch a page as clean markdown. |
| `research_question` | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task` | Run a multi-step, natural-language browser task. |

Pass all of them, or pick a subset:

```ts
import { streamText, stepCountIs } from "ai";
import { tabstackTools } from "@tabstack/ai";

const result = streamText({
  model: openai("gpt-4o"),
  tools: {
    research_question: tabstackTools.research_question,
    extract_page_content: tabstackTools.extract_page_content,
  },
  stopWhen: stepCountIs(5),
  prompt: "Summarize the latest on quantum error correction, with sources.",
});

for await (const chunk of result.textStream) process.stdout.write(chunk);
```

### Tool inputs

The model fills these in, but it helps to know the shapes:

- `extract_structured_data`: `url`, `json_schema_json` (a JSON-encoded JSON Schema string).
- `extract_page_content`: `url`.
- `research_question`: `query`.
- `generate_structured_data`: `url`, `instructions`, `json_schema_json`.
- `automate_browser_task`: `task`, plus optional `url`, `guardrails`, `data`, `country`,
  `max_iterations`, `max_validation_attempts`.

## Optional inputs

The model can pass these for finer control; they are sent to Tabstack only when present:

- `extract_structured_data`, `extract_page_content`, `generate_structured_data`:
  - `effort`: `"min"` | `"standard"` | `"max"`. Use `"max"` for JS-heavy pages (full server-side
    browser rendering).
  - `nocache`: bypass the cache.
  - `country`: ISO 3166-1 alpha-2 code (for example `"US"`) for geotargeted fetches.
- `research_question`: `mode` (`"fast"` | `"balanced"`), `nocache`.

## Configuration

For a custom API key or base URL, or to reuse one client, build the tools explicitly:

```ts
import { createTabstackAiTools } from "@tabstack/ai";

const tools = createTabstackAiTools({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackAiTools({ client })
```

## Error handling

When a tool call fails it throws `TabstackToolError` (a normalised message plus an HTTP `status` for
API errors). The AI SDK surfaces this in the tool result; to inspect it yourself when invoking a
tool's `execute` directly, catch it:

```ts
import { TabstackToolError } from "@tabstack/ai";

try {
  await tabstackTools.extract_page_content.execute(
    { url: "https://example.com" },
    { toolCallId: "1", messages: [] },
  );
} catch (err) {
  if (err instanceof TabstackToolError) {
    console.error(`Tabstack failed (${err.status ?? "no status"}): ${err.message}`);
  }
}
```

## Good to know

- **`automate_browser_task` runs non-interactively.** It does not pause for human-in-the-loop form
  input, so it never blocks. It returns the final answer plus the data it extracted and the pages it
  visited.
- The client is created lazily, so importing the package never requires an API key to be set.
- The tool names, descriptions, and inputs match the [`@tabstack/langchain`](https://www.npmjs.com/package/@tabstack/langchain)
  (LangChain.js) and [`langchain-tabstack`](https://pypi.org/project/langchain-tabstack/) (Python)
  packages, so behaviour is consistent across frameworks and languages.

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Get an API key](https://console.tabstack.ai)
