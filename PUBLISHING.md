# Publishing

Packages publish to npm via **OIDC trusted publishing**, with no `NPM_TOKEN`. The
`release.yml` workflow authenticates with npm using a short-lived GitHub OIDC
token, so each published package must be registered as a trusted publisher on
npm first.

## Published packages

| Package | npm name | Release tag prefix |
|---------|----------|--------------------|
| `packages/langchain` | `@tabstack/langchain` | `langchain` |
| `packages/vercel-ai` | `@tabstack/ai` | `ai` |
| `packages/eve` | `@tabstack/eve` | `eve` |
| `packages/mastra` | `@tabstack/mastra` | `mastra` |
| `packages/claude-agent` | `@tabstack/claude-agent` | `claude` |
| `packages/openai-agents` | `@tabstack/openai-agents` | `openai` |
| `packages/llamaindex` | `@tabstack/llamaindex` | `llama` |
| `packages/pi-agent` | `@tabstack/pi-agent` | `pi` |
| `packages/core` | `@tabstack/integrations-core` | **not published** (`private: true`; bundled into the adapters) |

## One-time: register the trusted publisher (per published package)

npm configures trusted publishers in the web UI only (no CLI/API). For **each**
published package:

1. Go to `https://www.npmjs.com/package/<name>/access` (Settings → Trusted Publisher).
2. Choose **GitHub Actions**.
3. Fill in:
   - **Organization or user:** `Mozilla-Ocho`
   - **Repository:** `tabstack-integrations-typescript`
   - **Workflow filename:** `release.yml`
   - **Environment:** *(leave blank, the release job defines no environment)*
4. Save.

### First publish (chicken-and-egg)

npm only exposes Trusted Publisher settings on a package that **already exists**,
with no pre-registration for brand-new names. So the first version of a new
package must be published once by hand, from a maintainer's machine.

Two things get in the way locally:

- `publishConfig.provenance: true` makes npm refuse to publish outside a
  supported CI provider, and `publishConfig` is merged *over* CLI flags, so
  `--provenance=false` does not override it. The key has to come out of the
  manifest for that one publish.
- The npm account has 2FA set to `auth-and-writes`, so each publish needs a
  fresh `--otp`.

```bash
# from the repo root, on a clean tree, authenticated as a maintainer
pnpm install --frozen-lockfile --filter "./packages/*..."
pnpm build

npm pkg delete publishConfig.provenance --prefix packages/<dir>
pnpm --filter @tabstack/<name> publish --no-git-checks --otp=<code>
git checkout packages/<dir>/package.json
```

Use `pnpm publish` rather than `npm publish`: it rewrites the
`@tabstack/integrations-core: workspace:*` devDependency to a real version,
which `npm publish` would ship literally.

That first version is unattested on npm, permanently. Register the trusted
publisher afterwards and every subsequent release gets provenance through CI
with zero tokens. Because the hand-published version already occupies its
version number, the first CI release must bump it (e.g. `0.1.0` by hand, then
tag `claude-v0.1.1`).

## Ongoing releases (GitHub Releases)

Releases are driven by GitHub Release tags. The tag names which package(s) to
publish and at what version:

| Tag                | Publishes                            |
|--------------------|--------------------------------------|
| `langchain-vX.Y.Z` | `@tabstack/langchain` at `X.Y.Z`     |
| `ai-vX.Y.Z`        | `@tabstack/ai` at `X.Y.Z`            |
| `eve-vX.Y.Z`       | `@tabstack/eve` at `X.Y.Z`           |
| `mastra-vX.Y.Z`    | `@tabstack/mastra` at `X.Y.Z`        |
| `claude-vX.Y.Z`    | `@tabstack/claude-agent` at `X.Y.Z`  |
| `openai-vX.Y.Z`    | `@tabstack/openai-agents` at `X.Y.Z` |
| `llama-vX.Y.Z`     | `@tabstack/llamaindex` at `X.Y.Z`    |
| `vX.Y.Z`           | all adapters at `X.Y.Z`              |

To cut a release:

1. Create a **GitHub Release** with a tag in one of the forms above (e.g.
   `langchain-v0.2.0`). Write the changelog in the release notes.
2. On publish, `release.yml` parses the tag, writes the version into the target
   `package.json`(s), builds, and runs `pnpm publish` (which rewrites
   `workspace:*` deps to real versions) over OIDC trusted publishing with
   provenance.

Version numbers live in the release tags, not committed back to `package.json`
(the checked-in versions may lag the published ones). Prerelease versions
(e.g. `v1.2.0-beta.1`) publish under the `next` dist-tag; stable versions under
`latest`.

## Notes

- Provenance is attached automatically: each published `package.json` sets
  `publishConfig.provenance: true` and carries a `repository` field. It is
  verified against `Mozilla-Ocho/tabstack-integrations-typescript`, so the repo
  owner/name must match.
- `pnpm publish` performs the OIDC token exchange itself (pnpm ≥ 10.16), then
  hands off to the npm CLI for the upload and provenance generation. The pnpm
  version comes from `packageManager` in the root `package.json`, so keep it at
  or above that floor. If OIDC auth ever fails in CI, adding an explicit
  `npm install -g npm@latest` step is the first thing to try, since npm's own
  OIDC path needs ≥ 11.5.1.
- **This workflow has not been exercised end to end yet.** Every version on npm
  so far was hand-published, so none carry provenance. The first real GitHub
  Release is also the first live test of `release.yml`.
- The release job deliberately omits `registry-url` from `setup-node`. Setting
  it writes an `.npmrc` with `_authToken=${NODE_AUTH_TOKEN}`, which breaks OIDC
  trusted publishing (pnpm/pnpm#11513).
