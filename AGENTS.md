# AGENTS.md

Operational guide for AI agents working in this repository. Humans: see `README.md`.

## What this repo is

pnpm monorepo, the long-term home for every Tabstack TypeScript integration. Each published package
wraps the official Tabstack SDK (`@tabstack/sdk`) and exposes Tabstack's extract / research /
generate / automate capabilities as native tools for one agent framework.

```
packages/
  core/          @tabstack/integrations-core   private, unpublished. The single source of truth.
  langchain/     @tabstack/langchain           LangChain.js adapter.
  vercel-ai/     @tabstack/ai                  Vercel AI SDK adapter.
  eve/           @tabstack/eve                 eve (Vercel agent framework) adapter.
  mastra/        @tabstack/mastra              Mastra adapter.
  claude-agent/  @tabstack/claude-agent        Claude Agent SDK adapter (in-process MCP server).
  openai-agents/ @tabstack/openai-agents       OpenAI Agents SDK adapter.
  llamaindex/    @tabstack/llamaindex          LlamaIndex.TS adapter.
  pi-agent/      @tabstack/pi-agent            Pi coding agent extension.
```

## Why it is structured this way

- `core` holds the client, Zod schemas, tool bodies, error mapping, and types. It **never imports a
  framework** (no `@langchain/*`, no `ai`). It is the single source of truth for tool names,
  descriptions, and input schemas.
- Adapters are thin shells: they import `core` and hand its schemas + bodies to the framework's own
  `tool()` primitive. They bundle `core` at build time (it is never published).
- This keeps both adapters, and the separate Python `langchain-tabstack` package, in lockstep.

## Hard rules

- The SDK does all network work. Never reimplement HTTP, auth, retries, or any API surface. Every
  call goes through the SDK client in `core/src/client.ts`.
- `core` imports no framework. A framework dependency appears only inside its own adapter package.
- No em dashes anywhere (code, comments, docs). Use commas, colons, or separate sentences.
- A new integration is a new folder under `packages/` that imports `core`. Do not build a generic
  plugin abstraction speculatively.

## Commands

Run from the repo root:

```bash
pnpm install        # frozen in CI: pnpm install --frozen-lockfile
pnpm build          # tsup, dual ESM/CJS + .d.ts, topological (core first)
pnpm typecheck      # tsc --noEmit per package
pnpm test           # vitest per package
pnpm lint           # biome
```

Build before typecheck/test: the adapters consume `core` via its built `dist`, so `core` must build
first. `pnpm -r` already orders by workspace dependency.

## Environment gotcha (important)

pnpm 11.4 requires **Node 22** (`node:sqlite`). `.nvmrc` is `22`. If `pnpm` itself crashes with
`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`, the shell is on an older Node. Fixes:

- `nvm use` (reads `.nvmrc`), or invoke pnpm with a Node 22 binary.
- Fallback that works on any Node 20+: run a package's tooling directly, e.g.
  `cd packages/core && ../../node_modules/.bin/tsup` (same for `tsc --noEmit`, `vitest run`).

`verifyDepsBeforeRun: false` in `pnpm-workspace.yaml` is deliberate: pnpm's pre-run dep check
otherwise spawns an install that fails on this machine. The `[ERR_PNPM_IGNORED_BUILDS]` line during
install is a harmless warning; esbuild and biome get their binaries from optional platform packages.

## Conventions

- `zod` and the framework (`@langchain/core`, `ai`) are **peer dependencies** in the adapters, so the
  consumer's single instance is shared. Never make them direct dependencies. **Exception:**
  `@tabstack/pi-agent` declares `zod` as a direct dependency, because Pi installs packages with peer
  installation disabled and does not supply Zod (see `packages/pi-agent/AGENTS.md`).
- **The whole repo is Zod 4 only.** `core`, every adapter, and every app in `apps/` declare
  `zod: ^4.0.0`. Reasons: the Claude Agent and OpenAI Agents SDKs require Zod 4, the `eve` and
  `pi-agent` adapters use Zod 4's native `z.toJSONSchema`, and core's emitted `.d.ts` is Zod 4 shaped
  so a Zod 3 consumer cannot typecheck it. Never reintroduce a Zod 3 range anywhere, including the
  demo apps: pnpm resolves two Zod majors silently (no peer warning), which splits the framework
  instance and breaks schema interop.
- The client reads `TABSTACK_API_KEY` and is constructed lazily, so importing a package never
  requires a key.
- Adapter tools resolve the client at call time, not at module load.
- Return shapes are idiomatic per language: TS returns native objects (camelCase). Python returns
  JSON strings (snake_case). See `NOTES.md`.

## Adding a tool (touch points, in order)

1. `core/src/schemas.ts`: add the Zod input schema.
2. `core/src/types.ts`: add input/output types.
3. `core/src/tools.ts`: add the body, plus `NAMES`, `DESCRIPTIONS`, and a `createTabstackTools` entry.
4. `core/src/index.ts`: export the new schema, body, and types.
5. `packages/langchain/src/index.ts` and `packages/vercel-ai/src/index.ts`: wire the new spec.
6. Tests in both adapters; mirror the new tool into the Python `langchain-tabstack` package.

## Pre-publish

- Confirm the `@tabstack/sdk` version pin (`^2.6.1`) matches the intended release line.
- Releases are cut from GitHub Release tags (`langchain-vX.Y.Z`, `ai-vX.Y.Z`, or `vX.Y.Z`); `core` is excluded (private). See PUBLISHING.md.
