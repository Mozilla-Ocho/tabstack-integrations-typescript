# AGENTS.md: @tabstack/integrations-core

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands.

## What this package is

The private, framework-agnostic core of the Tabstack TypeScript integrations. It is the single
source of truth for the tool surface: names, descriptions, Zod input schemas, async call bodies,
error mapping, and types.

## Why use it

Anything shared across adapters lives here so the adapters stay thin and consistent. If you change a
tool's name, description, schema, or behaviour, you change it here once and every adapter (and, by
mirroring, the Python package) follows.

## How to use it (from an adapter)

```ts
import { createTabstackTools, toolNames, extractStructuredDataSchema } from "@tabstack/integrations-core";

const specs = createTabstackTools(client); // client optional; resolves the lazy default at call time
// specs.extractStructuredData = { name, description, schema, execute }
```

`createTabstackTools()` returns one `{ name, description, schema, execute }` spec per tool. Adapters
map these onto their framework's `tool()` primitive. `execute(input)` runs the SDK call and returns
a typed object (or string for markdown).

## Rules specific to this package

- **Never import a framework.** No `@langchain/*`, no `ai`. CI and review will reject it.
- **Never call `fetch` or reimplement the API.** Go through the SDK client only.
- `@tabstack/sdk` is a real dependency; `zod` is a peer dependency (the consumer provides it). Both
  stay external in the build; only this package's own source is bundled into adapters.
- The client must stay lazy: importing this package must not require `TABSTACK_API_KEY`.
- Tool bodies take `(input, client)` and wrap failures with `normalizeError`.

## Adding a tool

1. `schemas.ts`: Zod input schema (reuse the shared `effort`/`nocache`/`country` field helpers).
2. `types.ts`: input/output types.
3. `tools.ts`: the async body, plus entries in `NAMES`, `DESCRIPTIONS`, the `TabstackTools`
   interface, and `createTabstackTools`.
4. `index.ts`: export the schema, body, and types.
5. Update both adapters and the Python package to match.

## Build / test

Built with tsup to dual ESM/CJS + `.d.ts`. `pnpm build` / `pnpm typecheck` from the root, or
`../../node_modules/.bin/tsup` from this folder. This package has no tests of its own; its logic is
exercised through the adapter test suites (with the SDK mocked).
