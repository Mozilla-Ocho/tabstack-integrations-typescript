# AGENTS.md: @tabstack/eve

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The eve (Vercel agent framework) adapter. A thin shell that wraps the framework-agnostic tool specs
from `@tabstack/integrations-core` in `defineTool` from `eve/tools`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into an eve agent as
native tools, backed by the official SDK. Schema-enforced, no bespoke fetch glue.

## How to use it (consumer)

eve derives a tool's name from its filename under `agent/tools/`. Re-export a Tabstack tool as the
default export of a file named after the tool:

```ts
// agent/tools/research_question.ts
export { researchQuestionTool as default } from "@tabstack/eve";
// or, for a custom client:
// import { createTabstackEveTools } from "@tabstack/eve";
// export default createTabstackEveTools({ apiKey }).research_question;
```

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- Each is wrapped with `defineTool({ description, inputSchema, execute })`:
  - `defineTool` **brands** its result; eve rejects raw object literals, so tools must go through it.
  - eve's `inputSchema` takes a Standard-JSON-Schema value or a raw JSON Schema object, **not** a Zod
    schema. The core Zod schema is converted by `schemaToJsonSchema` (in `src/schema.ts`, an internal
    module deliberately **not** re-exported from `src/index.ts`) using Zod 4's native `z.toJSONSchema`.
    The repo is Zod 4 only, so there is no version detection and no `zod-to-json-schema` fallback; tests
    import `schemaToJsonSchema` from `src/schema.ts`, not the package entry.
  - Because eve advertises JSON Schema (not Zod), it hands `execute` unvalidated input. The wrapper
    re-parses through the core Zod schema (`spec.schema.parse`) to recover typed input before
    delegating, and normalizes a parse failure to `TabstackToolError` (via core's `normalizeError`)
    so the error contract matches the core bodies and the other adapters.
  - eve derives the tool **name from the filename**; there is no `name` field. The consumer must
    name the file to match the core tool name; the exported consts document the intended names.

## Rules specific to this package

- `eve` (>=0.24.0) and `zod` (^4.0.0) are **peer dependencies** (+ dev dependencies). Never direct.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- Names/descriptions/schemas come from core. Do not redefine them here.
- When core adds a tool, add an entry in `buildTools`, a matching `*Tool` const export, and a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and assert
names, descriptions, the JSON-Schema input, and execution routing match core.
