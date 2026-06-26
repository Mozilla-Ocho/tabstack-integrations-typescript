# @tabstack/integrations-core

Private, unpublished core for the Tabstack TypeScript integrations. It holds the shared Tabstack
client setup, the Zod input schemas, the framework-agnostic tool bodies, error mapping, and shared
types. It knows nothing about any agent framework.

This package is **not published to npm**. The adapters (`@tabstack/langchain`, `@tabstack/ai`)
depend on it as a workspace dependency and bundle it into their build output.

## What lives here

| File | Responsibility |
| --- | --- |
| `client.ts` | Construct the Tabstack SDK client (reads `TABSTACK_API_KEY`), lazy default client. |
| `schemas.ts` | One Zod schema per tool input. The single source of truth. |
| `tools.ts` | One async body per tool, plus tool names/descriptions and the `createTabstackTools` factory. No framework imports. |
| `errors.ts` | `TabstackToolError` and `normalizeError`. |
| `types.ts` | Shared input and output types. |
| `index.ts` | Barrel export. |

## Why it exists

Tool names, descriptions, schemas, and call logic are defined once, here. Both adapters consume
them, so they stay in lockstep with each other and with the Python `langchain-tabstack` package.

For build and test instructions see the repo root `README.md`; for working conventions see
`AGENTS.md`.
