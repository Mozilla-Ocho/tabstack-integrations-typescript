# AGENTS.md: @tabstack/llamaindex

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The LlamaIndex.TS adapter. A thin shell that wraps the framework-agnostic tool specs from
`@tabstack/integrations-core` in `tool()` from `llamaindex`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into a LlamaIndex.TS
agent as native tools, backed by the official SDK. Schema-enforced, no bespoke fetch glue.

## How to use it (consumer)

The tools are plain values. Pass the `tabstackTools` array (or individual `*Tool` exports) straight
to an agent:

```ts
import { tabstackTools } from "@tabstack/llamaindex";
import { agent } from "@llamaindex/workflow";

const researcher = agent({ tools: tabstackTools });
```

For a custom client, build them explicitly with `createTabstackLlamaindexTools({ apiKey })` or
`createTabstackLlamaindexTools({ client })`.

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `tool({ name, description, parameters, execute })` (an alias for
  `FunctionTool.from`):
  - LlamaIndex's `tool()` is **Zod-native**: the core Zod schema is passed straight through as
    `parameters`. No JSON-Schema conversion is needed (this is why there is no `src/schema.ts` and no
    `zod-to-json-schema` dependency, unlike `@tabstack/eve`). LlamaIndex derives the advertised JSON
    Schema itself and stores it on `tool.metadata.parameters`.
  - LlamaIndex validates input against that same Zod schema before invoking `execute` (via its
    internal `safeParseSchema` on `tool.call`), so the core body receives typed input.
  - `execute` returns the core result, which is JSON-serializable. The wrapper casts the core
    `Promise<TOutput>` to LlamaIndex's `JSONValue` return contract.
  - The tool's identity lives on `tool.metadata` (`name`, `description`, `parameters`); this is what
    the tests assert against, and `tool.call(input)` is the execution path.

## Rules specific to this package

- `llamaindex` (>=0.12.0) and `zod` are **peer dependencies** (+ dev dependencies). Never direct.
- `@tabstack/sdk` is a direct dependency.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add it to `createTabstackLlamaindexTools`, add a matching `*Tool` const
  export, extend the `tabstackTools` array, and add a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and assert
names, descriptions, the JSON-Schema input, and execution routing match core.
