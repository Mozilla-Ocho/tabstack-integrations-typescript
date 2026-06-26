# Notes

## Tool surface (canonical)

The Python `langchain-tabstack` package mirrors this surface tool-for-tool. These TypeScript
packages, the docs guide (`langchain-integration.mdx`), and the Python package are kept in lockstep:
same tool names, descriptions, and input fields across all three.

All five SDK capabilities are exposed as tools, single-sourced in `core`:

| Tool | SDK call |
| --- | --- |
| `extract_structured_data` | `client.extract.json` |
| `extract_page_content` | `client.extract.markdown` |
| `research_question` | `client.agent.research` |
| `generate_structured_data` | `client.generate.json` |
| `automate_browser_task` | `client.agent.automate` |

`automate_browser_task` runs the streaming automate agent **non-interactively**: it does not enable
the human-in-the-loop form-data flow, so it never blocks waiting for input. It consumes the SSE
stream and returns the final answer, success flag, iteration and action counts, duration, extracted
data, and the pages visited. If interactive form filling is needed later, it warrants a richer
surface than a single one-shot tool.

## Shared optional inputs

Beyond the required inputs, the fetch-based tools expose optional controls, passed through to the
SDK only when provided (so omitting them keeps SDK defaults):

- `extract_structured_data`, `extract_page_content`, `generate_structured_data`: `effort`
  (`min`/`standard`/`max`), `nocache`, `country` (ISO alpha-2 geotargeting).
- `research_question`: `mode` (`fast`/`balanced`), `nocache`.

## Output shapes (cross-language)

Return types are intentionally idiomatic per language, not byte-identical:

- **TypeScript** tools return native objects (camelCase keys, e.g. `durationMs`, `pagesVisited`).
  The LangChain and AI SDK frameworks serialize these to JSON for the model.
- **Python** tools return JSON strings (snake_case keys, e.g. `duration_ms`, `pages_visited`),
  the conventional LangChain-Python tool output.

Both carry the same logical data and present JSON to the model. Code reading the return value
directly should expect objects in TS and a JSON string in Python. If a future consumer needs
byte-identical wire output across languages, unify the casing and serialization then.

## SDK pin

`@tabstack/sdk` is pinned `^2.6.1` (recon-confirmed installed 2.6.1). Confirm this matches the
intended release line before publish.

## Dev toolchain note

pnpm 11.4 requires Node 22 (`node:sqlite`). `.nvmrc` is set to `22` for that reason. The published
packages' `engines` floor stays `>=20`, which is what consumers need.
