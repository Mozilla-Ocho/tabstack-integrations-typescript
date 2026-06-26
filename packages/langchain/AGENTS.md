# AGENTS.md: @tabstack/langchain

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The LangChain.js adapter. A thin shell that wraps the framework-agnostic tool specs from
`@tabstack/integrations-core` in `tool()` from `@langchain/core/tools`.

Note: this is `@tabstack/langchain`, **not** `@langchain/tabstack`. The latter scope belongs to
LangChain and is a separate contribution into `langchainjs`, out of scope for this repo.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into a LangChain agent
as native tools, backed by the official SDK. Schema-enforced, no Playwright, no LangChain-version
coupling.

## How to use it (consumer)

```ts
import { tabstackTools, createTabstackLangchainTools } from "@tabstack/langchain";
// tabstackTools: array using the default client (reads TABSTACK_API_KEY lazily)
// createTabstackLangchainTools({ apiKey } | { client }): custom client
```

Individual tools and the core `toolNames` / `toolDescriptions` / schemas are also re-exported.

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- `toLangchainTool(spec)` calls `tool(spec.execute, { name, description, schema })` and returns it as
  `StructuredToolInterface` (homogeneous array type, so consumers get a clean `Tool[]`).
- The default-client tools are built at module load; the client is resolved lazily on first call, so
  importing never needs a key.

## Rules specific to this package

- `@langchain/core` and `zod` are **peer dependencies** (and dev dependencies for building/testing).
  Never make them direct dependencies; the consumer's single instance must be shared.
- `@tabstack/integrations-core` is a dev dependency, bundled into the build via tsup `noExternal`.
- Keep names/descriptions/schemas sourced from core. Do not redefine them here.
- When core adds a tool, wire it in `src/index.ts` (array + individual export) and add a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or run the
binaries directly from this folder (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK
client and assert names, descriptions, schema references, and execution routing match core, so drift
between core and this adapter fails CI.
