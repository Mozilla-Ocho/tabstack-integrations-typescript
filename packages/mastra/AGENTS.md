# AGENTS.md: @tabstack/mastra

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The Mastra adapter. A thin shell that wraps the framework-agnostic tool specs from
`@tabstack/integrations-core` in `createTool` from `@mastra/core/tools`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into a Mastra `Agent`
as native tools, backed by the official SDK. Schema-enforced, no bespoke fetch glue.

## How to use it (consumer)

```ts
import { Agent } from "@mastra/core/agent";
import { tabstackTools, createTabstackMastraTools } from "@tabstack/mastra";

const agent = new Agent({ id, name, instructions, model, tools: tabstackTools });
// createTabstackMastraTools({ apiKey } | { client }) for a custom client
```

`tabstackTools` is a named object keyed by tool name, ready to spread into an `Agent`'s `tools`. Each
tool is also exported individually (`extractStructuredDataTool`, etc.). The core `toolNames` /
`toolDescriptions` / schemas are re-exported too.

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `createTool({ id, description, inputSchema, execute })` via the `toMastraTool`
  helper:
  - Mastra is **Zod-native**, so the core Zod schema is passed straight through as `inputSchema`. No
    JSON-Schema conversion (unlike the eve adapter), which is why this adapter is modelled on
    `@tabstack/ai`, not `@tabstack/eve`.
  - `@mastra/core` v1 requires both `id` and `description`. `id` is set to the core tool name so it
    stays in lockstep with the object key and the other adapters.
  - The v1 `execute` signature is `(inputData, executionContext) => result`: the **validated input is
    the first positional argument**. This changed from the older v0 `execute({ context })` shape, so
    the wrapper takes the first arg and forwards it to the core body: `execute: (input) =>
    spec.execute(input)`.
  - `outputSchema` is intentionally omitted; add it only where a return shape is stable and worth
    enforcing.
- The default-client tool constants and the `tabstackTools` aggregate are built from
  `createTabstackTools()` (no client), so the client resolves lazily on first call and importing the
  module never requires an API key.

## Rules specific to this package

- `@mastra/core` (>=1.0.0) and `zod` are **peer dependencies** (+ dev dependencies). Never direct.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- No `zod-to-json-schema`: Mastra takes Zod directly, so there is nothing to convert.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add an entry in `buildTools`, a matching `*Tool` const export, an entry in
  `tabstackTools`, and a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and assert
names, ids, descriptions, `inputSchema` references, and execution routing match core.
