# AGENTS.md: @tabstack/ai

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The Vercel AI SDK adapter. A thin shell that wraps the framework-agnostic tool specs from
`@tabstack/integrations-core` in `tool()` from `ai`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into `generateText` /
`streamText` as native AI SDK tools, backed by the official SDK. Schema-enforced, no bespoke fetch
glue.

## How to use it (consumer)

```ts
import { tabstackTools, createTabstackAiTools } from "@tabstack/ai";

const { text } = await generateText({ model, tools: tabstackTools, prompt });
// createTabstackAiTools({ apiKey } | { client }) for a custom client
```

`tabstackTools` is a named object keyed by tool name, ready to pass to `tools`. The core
`toolNames` / `toolDescriptions` / schemas are re-exported too.

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `tool({ description, inputSchema: spec.schema, execute })`, where `execute`
  destructures the AI SDK's `abortSignal` and forwards it to the core body as
  `spec.execute(input, { signal: abortSignal })`, so a cancelled generation aborts the underlying
  Tabstack request. The AI SDK v5+ API uses `inputSchema` (renamed from `parameters`); types are
  inferred from the schema.
- Tools are built inline per spec (not via a generic helper): the AI SDK's conditional `tool()`
  typing rejects a generic passthrough, so concrete specs are needed for inference. Keep it inline.
- `outputSchema` is intentionally omitted; add it only where a return shape is stable and worth
  enforcing.

## Rules specific to this package

- `ai` (>=5.0.0, v6 target) and `zod` are **peer dependencies** (+ dev dependencies). Never direct.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add an entry in `buildTools` in `src/index.ts` and a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and assert
names, descriptions, `inputSchema` references, and execution routing match core.
