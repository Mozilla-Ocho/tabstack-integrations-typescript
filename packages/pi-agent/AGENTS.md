# AGENTS.md: @tabstack/pi-agent

Guide for AI agents working on this package. See the repo root `AGENTS.md` for monorepo-wide rules
and commands, and `README.md` for human-facing usage.

## What this package is

The [Pi coding agent](https://pi.dev) adapter, shipped as a Pi **extension**. A thin shell that wraps
the framework-agnostic tool specs from `@tabstack/integrations-core` and registers them via
`pi.registerTool` from `@earendil-works/pi-coding-agent`.

## Why use it

Drops Tabstack's web extraction, research, generation, and browser automation into the Pi agent as
native tools, backed by the official SDK. Schema-enforced, no bespoke fetch glue.

## How to use it (consumer)

A Pi extension is a `.ts` file with a default export. Re-export this package's default extension, or
build one bound to a specific client:

```ts
// tabstack.ts
export { default } from "@tabstack/pi-agent";
// or, for a custom client:
// import { createTabstackPiExtension } from "@tabstack/pi-agent";
// export default createTabstackPiExtension({ apiKey });
```

Load it with `pi -e ./tabstack.ts`, or drop the file into `~/.pi/agent/extensions/*.ts` (global) or
`.pi/extensions/*.ts` (project-local) for auto-discovery.

## How it works internally

- `createTabstackTools()` from core gives `{ name, description, schema, execute }` specs.
- `toPiTool` turns one spec into the object passed to `pi.registerTool`:
  `{ name, label, description, parameters, execute }`.
  - **Parameters are a Typebox schema.** Pi types `parameters` as Typebox. Core is the single source
    of truth for the input schema (Zod), so instead of hand-authoring a duplicate Typebox schema, the
    core Zod schema is converted to JSON Schema (`schema.ts`, Zod 4's native `z.toJSONSchema`) and
    wrapped with `Type.Unsafe`, which tags a raw JSON Schema object as a Typebox schema (Typebox
    schemas are themselves JSON Schema, so Pi sends it straight to the provider). **Do not**
    hand-author Typebox schemas that duplicate core's.
  - Because the advertised schema is `Type.Unsafe<unknown>`, Pi hands `execute` the raw params. The
    wrapper re-parses through the core Zod schema (`spec.schema.parse`) to recover typed input before
    delegating, and normalizes a parse failure to `TabstackToolError` (via core's `normalizeError`).
  - **Errors are thrown, not encoded.** Pi reports a failed tool by a thrown error (`AgentToolResult`
    never carries an error flag from us), so `execute` throws on failure.
  - `execute` returns Pi's `AgentToolResult`: `{ content: [{ type: "text", text }], details }`. String
    results (`extract_page_content`) pass through; object results are `JSON.stringify`ed.
- Exports, from one `buildToolDefs(specs)` builder so every path shares the same wrapping:
  - **default export**: a Pi extension factory `(pi) => void` registering all five tools (default lazy client).
  - `createTabstackPiExtension(config)`: same, bound to a client, and accepts `tools?: TabstackPiToolName[]`
    to register a subset (in the given order) so a consumer can, for example, expose read + research
    without browser automation.
  - `createTabstackPiTools(config)`: the five `ToolDefinition`s keyed by core name, for hand-written extensions.
  - individual `*Tool` consts (default client), annotated `: ToolDefinition` (the inferred typebox type is
    not portable in the emitted `.d.ts`, TS2742), plus the `TabstackPiToolName` union.

## Rules specific to this package

- `@earendil-works/pi-coding-agent` (>=0.82.0), `typebox` (^1.3.0), and `zod` (^4.0.0) are **peer
  dependencies** (+ dev dependencies). Never direct. Zod 4 is required: the adapter uses
  `z.toJSONSchema`. `@earendil-works/pi-ai` is intentionally not a dependency (nothing is imported
  from it; the `ToolResult` content shape is a plain object literal).
- `@tabstack/sdk` is a direct dependency.
- `@tabstack/integrations-core` is a dev dependency, bundled via tsup `noExternal`.
- `vitest.config.ts` aliases `zod` to this package's single Zod 4 instance. Reason: the built package
  inlines core (so core's schemas are constructed with this adapter's Zod 4), but tests import core's
  dist, which otherwise resolves core's own in-repo Zod 3 (this branch is based on `main`). Two Zod
  majors do not interoperate (`z.toJSONSchema` throws on a Zod 3 schema), so the alias dedupes them to
  Zod 4, matching the bundle. **Removable once core is Zod 4 (PR #12):** at that point core's dist
  already resolves Zod 4 and the alias is a no-op.
- Names/descriptions/schemas come from core. Do not redefine them here (labels are the one bit of
  UI-only text that lives here, in the `LABELS` map).
- When core adds a tool, add a `LABELS` entry, an entry in `buildToolDefs`, the tool name to the
  `TabstackPiToolName` union, a matching individual `*Tool` export, and a test.

## Build / test

`pnpm build` / `pnpm typecheck` / `pnpm test` from the root (needs core built first), or the
binaries directly (`../../node_modules/.bin/{tsup,tsc,vitest}`). Tests mock the SDK client and a fake
`pi` object that captures `registerTool` calls, then assert tool names, descriptions, labels, the
Typebox-wrapped JSON-Schema parameters, and that execution routes through the injected client and
returns the Pi `AgentToolResult` content shape.
