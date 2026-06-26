# @tabstack/langchain

Give your [LangChain.js](https://js.langchain.com) agents reliable web access. Schema-enforced
extraction, multi-source research, AI transformation, and browser automation, all as native
LangChain tools backed by the official [Tabstack SDK](https://www.npmjs.com/package/@tabstack/sdk).

## Why Tabstack

LangChain's built-in loaders (`WebBaseLoader`, `PlaywrightURLLoader`) are fine for prototypes and
brittle in production: unpredictable parsing, Playwright binaries to install and maintain, and
behaviour that drifts across LangChain releases.

Tabstack replaces them with a hosted API:

- **Schema-enforced output.** You define the shape, you get that shape back. No prompt-engineering
  the JSON out of raw text.
- **No browser to run.** JS-heavy pages render server-side. No Playwright, no binaries, no async
  headaches.
- **Version-independent.** It is an SDK call, not a loader coupled to your LangChain version.
- **One key for everything:** extraction, research, generation, and automation.

## Install

```bash
npm install @tabstack/langchain @langchain/core zod
```

`@langchain/core` (v1) and `zod` are peer dependencies, so your app's single instance of each is
shared. Set your API key (get one at [console.tabstack.ai](https://console.tabstack.ai)):

```bash
export TABSTACK_API_KEY="your-key-here"
```

## Quickstart

```ts
import { createAgent } from "langchain";
import { tabstackTools } from "@tabstack/langchain";

const agent = createAgent({
  model: "openai:gpt-4o",
  tools: tabstackTools,
  systemPrompt:
    "You are a research assistant with web intelligence tools. " +
    "Use extract_structured_data for specific fields from a URL, " +
    "extract_page_content for full page text, and research_question for multi-source research.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What are Vercel's pricing plans and how do they compare?" }],
});

console.log(result.messages.at(-1)?.content);
```

`tabstackTools` reads `TABSTACK_API_KEY` from the environment and is ready to drop into any agent.

## The tools

| Tool | What it does |
| --- | --- |
| `extract_structured_data` | Pull specific fields from a URL into a JSON shape you define. |
| `extract_page_content` | Fetch a page as clean markdown. |
| `research_question` | Synthesised answer with cited sources across multiple pages. |
| `generate_structured_data` | Fetch a page, then AI-transform it into derived or reshaped JSON. |
| `automate_browser_task` | Run a multi-step, natural-language browser task. |

Every tool is exported individually too, so you can use one directly without an agent. Each returns
a plain object (the framework serializes it for the model).

### extract_structured_data

```ts
import { extractStructuredDataTool } from "@tabstack/langchain";

const data = await extractStructuredDataTool.invoke({
  url: "https://news.ycombinator.com",
  // json_schema_json is a JSON-encoded JSON Schema describing the fields you want.
  json_schema_json: JSON.stringify({
    type: "object",
    properties: {
      stories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            points: { type: "number", description: "Story points" },
          },
        },
      },
    },
  }),
});

console.log(data.stories);
```

### extract_page_content

```ts
import { extractPageContentTool } from "@tabstack/langchain";

const markdown = await extractPageContentTool.invoke({ url: "https://example.com/blog/article" });
```

### research_question

```ts
import { researchQuestionTool } from "@tabstack/langchain";

const { answer, sources } = await researchQuestionTool.invoke({
  query: "What are the latest developments in quantum error correction?",
});
// sources: [{ title, url }, ...]
```

### generate_structured_data

```ts
import { generateStructuredDataTool } from "@tabstack/langchain";

const result = await generateStructuredDataTool.invoke({
  url: "https://news.ycombinator.com",
  instructions: "For each story, categorize it and write a one-sentence summary.",
  json_schema_json: JSON.stringify({
    type: "object",
    properties: {
      summaries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            category: { type: "string" },
            summary: { type: "string" },
          },
        },
      },
    },
  }),
});
```

### automate_browser_task

```ts
import { automateBrowserTaskTool } from "@tabstack/langchain";

const result = await automateBrowserTaskTool.invoke({
  task: "Find the top 3 trending repositories and their star counts",
  url: "https://github.com/trending",
  guardrails: "browse and extract only, do not submit forms",
});
// { answer, success, iterations, actions, durationMs, extracted, pagesVisited }
```

## Optional inputs

Pass these alongside the required inputs for finer control. They are sent only when provided, so
omitting them keeps Tabstack's defaults.

- `extract_structured_data`, `extract_page_content`, `generate_structured_data`:
  - `effort`: `"min"` | `"standard"` | `"max"`. Use `"max"` for JS-heavy pages (full server-side
    browser rendering, the `PlaywrightURLLoader` replacement).
  - `nocache`: `true` to bypass the cache.
  - `country`: ISO 3166-1 alpha-2 code (for example `"US"`) for geotargeted fetches.
- `research_question`: `mode` (`"fast"` | `"balanced"`), `nocache`.
- `automate_browser_task`: `data` (context for form filling), `country`, `max_iterations`,
  `max_validation_attempts`.

```ts
// Render a JS-heavy SPA, fresh, from the UK:
await extractPageContentTool.invoke({ url, effort: "max", nocache: true, country: "GB" });
```

## Configuration

For a custom API key or base URL, or to reuse one client, build the tools explicitly:

```ts
import { createTabstackLangchainTools } from "@tabstack/langchain";

const tools = createTabstackLangchainTools({ apiKey: process.env.MY_KEY });
// or pass an SDK client you already have: createTabstackLangchainTools({ client })
```

## Error handling

Tool calls throw `TabstackToolError` with a normalised message and, for API failures, an HTTP
`status`:

```ts
import { TabstackToolError } from "@tabstack/langchain";

try {
  await extractPageContentTool.invoke({ url: "https://example.com" });
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
- The tool names, descriptions, and inputs match the [`@tabstack/ai`](https://www.npmjs.com/package/@tabstack/ai)
  (Vercel AI SDK) and [`langchain-tabstack`](https://pypi.org/project/langchain-tabstack/) (Python)
  packages, so behaviour is consistent across frameworks and languages.

## Links

- [Tabstack docs](https://docs.tabstack.ai)
- [Tabstack SDK (`@tabstack/sdk`)](https://www.npmjs.com/package/@tabstack/sdk)
- [Get an API key](https://console.tabstack.ai)
