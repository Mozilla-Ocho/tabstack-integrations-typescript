# AGENTS.md: @tabstack/openai-agents

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The OpenAI Agents SDK (`@openai/agents`) adapter. A thin shell that wraps the framework-agnostic tool
specs from `@tabstack/integrations-core` in `tool()` from `@openai/agents`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into an OpenAI Agents
SDK `Agent` as native tools, backed by the official SDK. Schema-enforced, no bespoke fetch glue.

## How to use it (consumer)

`tabstackTools` is an array of ready-to-use tools; hand it straight to `new Agent({ tools })`:

```ts
import { Agent, run } from "@openai/agents";
import { tabstackTools } from "@tabstack/openai-agents";

const agent = new Agent({ name: "Research", instructions: "...", tools: tabstackTools });
const result = await run(agent, "What are Vercel's pricing plans, with sources?");
// or, for a custom client:
// import { createTabstackOpenAIAgentsTools } from "@tabstack/openai-agents";
// const tools = createTabstackOpenAIAgentsTools({ apiKey });
```

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `tool({ name, description, parameters, strict, execute })`:
  - **Strict mode is the key constraint.** The SDK forces strict JSON Schema mode whenever
    `parameters` is a Zod schema, and passing `strict: false` with a Zod schema throws
    (`UserError: Strict mode is required for Zod parameters`). Strict mode cannot represent the core
    schemas: `.optional()` fields (strict requires every property in `required`) and
    `automate_browser_task`'s open `z.record(...)` `data` field (strict forbids a schema-valued
    `additionalProperties`). So the adapter converts each core Zod schema to a JSON Schema with
    `toJsonParameters` (Zod 4's native `z.toJSONSchema`, reshaped into the SDK's non-strict envelope
    with `additionalProperties: true`) and registers each tool with `strict: false`. **Do not** pass
    the core Zod schemas directly, and **do not** modify the core schemas to fit strict mode.
  - Because the tool advertises JSON Schema (not Zod), the SDK's non-strict parser only `JSON.parse`s
    the model input and hands `execute` the unvalidated object. The wrapper re-parses through the core
    Zod schema (`spec.schema.parse`) to recover typed input before delegating, and normalizes a parse
    failure to `TabstackToolError` (via core's `normalizeError`) so the error contract matches the
    core bodies and the other adapters.
  - `execute` may return non-string values; the SDK serializes them for the model.

## Rules specific to this package

- `@openai/agents` (>=0.13.0) and `zod` (^4.0.0) are **peer dependencies** (+ dev dependencies).
  Never direct. Zod 4 is required: the SDK depends on it and the adapter uses `z.toJSONSchema`.
- `@tabstack/sdk` is a direct dependency.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- Zod 4 is required end to end: the SDK cannot load under Zod 3, and core is Zod 4 only, so
  `z.toJSONSchema` runs against a Zod 4 schema with no version detection or fallback.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add an entry in `buildTools`, a matching `*Tool` const export, add it to the
  `tabstackTools` array, and add a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and assert
tool names, descriptions, the non-strict JSON-Schema parameters, and that execution routes through
the injected client via `tool.invoke(...)`.
