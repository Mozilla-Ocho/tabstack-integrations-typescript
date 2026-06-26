# Tabstack TypeScript Integrations

Long-term home for every Tabstack TypeScript integration. Each adapter wraps the official Tabstack
TypeScript SDK ([`@tabstack/sdk`](https://www.npmjs.com/package/@tabstack/sdk)) and exposes Tabstack's
extract and research capabilities as native tools for a given agent framework.

## Packages

| Package | Published | Description |
| --- | --- | --- |
| `@tabstack/integrations-core` | No (private) | Shared client, Zod schemas, tool bodies, error mapping, and types. Framework-agnostic. |
| `@tabstack/langchain` | Yes | LangChain.js adapter. Wraps core schemas and bodies in `tool()` from `@langchain/core`. |
| `@tabstack/ai` | Yes | Vercel AI SDK adapter. Wraps core schemas and bodies in `tool()` from `ai`. |

## Design

- **The SDK does the work.** No HTTP, auth, or retry is reimplemented. Every network call goes
  through the SDK client.
- **`core` knows no framework.** It imports neither `@langchain/*` nor `ai`. Framework dependencies
  live only inside their own adapter package.
- **`core` is the single source of truth.** Tool names, descriptions, and Zod schemas are defined
  once and consumed by every adapter, keeping the cross-language and cross-framework story in lockstep
  with the shipped Python `langchain-tabstack` package.
- **Adapters are thin shells.** A new integration is a new folder under `packages/` that imports
  `core` and writes an adapter. No speculative generic plugin abstraction.

## Scope

`@langchain/tabstack` (the official LangChain-owned listing) is **not** built here. That is a separate
contribution into the `langchainjs` repository and is out of scope for this monorepo.

## Development

```bash
pnpm install
pnpm build      # build every package (tsup, dual ESM/CJS + .d.ts)
pnpm typecheck  # tsc --noEmit per package
pnpm test       # vitest per package
pnpm lint       # biome
```

Versioning and publishing use [changesets](https://github.com/changesets/changesets). `core` is
private and excluded from release.

## Tooling choices

- **tsup** for builds: zero-config dual ESM/CJS output with `.d.ts` generation via a tiny per-package
  config. Mature and the de facto standard for small TypeScript libraries.
- **biome** for lint + format: one fast binary, one root config, no ESLint/Prettier plugin sprawl.
- **vitest** for tests, **changesets** for release.
