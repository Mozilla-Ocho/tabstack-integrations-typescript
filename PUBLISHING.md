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

One thing gets in the way locally: the npm account has 2FA set to
`auth-and-writes`, so each publish needs a fresh `--otp`.

Provenance is no longer a problem here. It used to live in each manifest as
`publishConfig.provenance: true`, which made npm refuse to publish outside a
supported CI provider — and because `publishConfig` is merged *over* CLI flags,
`--provenance=false` could not override it, so the key had to be deleted for
that one publish. Provenance is now requested by `release.yml` via
`--provenance` instead, so a local publish simply omits it.

```bash
# from the repo root, on a clean tree, authenticated as a maintainer
pnpm install --frozen-lockfile --filter "./packages/*..."
pnpm build

pnpm --filter @tabstack/<name> publish --no-git-checks --otp=<code>
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
| `pi-vX.Y.Z`        | `@tabstack/pi-agent` at `X.Y.Z`      |
| `vX.Y.Z`           | all adapters at `X.Y.Z`              |

### The release helper

`scripts/release.mjs` wraps this flow with the checks that catch a bad artifact
before and after it ships. Node builtins only; needs `git`, `gh`, `pnpm`, `npm`.

```bash
pnpm release list                    # every package: checked-in vs published
pnpm release preflight pi            # is this safe to release?
pnpm release release pi 0.1.1        # preflight, tag, watch the run, verify npm
pnpm release verify pi 0.1.0         # is a published version installable?
pnpm release check-artifact pi       # does the built tarball ship what it declares?
pnpm release publish-local claude 0.1.0   # brand-new names only, prompts for OTP
```

`preflight` and `verify` both pack the package, read the manifest back out of the
tarball, and assert every path it advertises through `main`, `module`, `types`
and `exports` is present — then install the tarball into a scratch project and
import it. `pnpm release verify pi 0.1.0` fails today, which is the bug this
exists to prevent.

`check-artifact` is just the tarball assertion — no git, `gh`, network or build,
so it runs anywhere. `release.yml` runs it for each target package between
building and publishing, which is what makes a distless publish impossible
rather than merely detectable: `prepublishOnly` rebuilds but asserts nothing.

`verify` with no version resolves the `latest` dist-tag rather than the
last-published version, since a patch on an older line publishes last without
being the newest.

Useful flags: `--dry-run`, `--yes`, `--skip-tests`, `--any-branch`.

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

- Provenance is requested by `release.yml`'s publish step via `--provenance`,
  gated on the repository being public. npm dropped support for attestations
  from private source repositories in July 2023, and an explicitly requested
  provenance is a hard publish failure there rather than a graceful skip, so
  while this repo is private the workflow publishes without it and logs a
  warning. Making the repo public turns attestations on with no further edit.
  Each published `package.json` still carries a `repository` field, which is
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
  it writes an `.npmrc` with `_authToken=${NODE_AUTH_TOKEN}`, and an unset token
  there can shadow the OIDC exchange. Note that pnpm/pnpm#11513, often cited for
  this, was actually resolved by updating `pnpm/action-setup` — so if OIDC starts
  returning 404, bump that action before suspecting `registry-url`.
- Every published tarball must contain `dist/`. `@tabstack/pi-agent@0.1.0` went
  out with only `package.json` and `README.md`, so it installed cleanly and then
  failed at first import with `ERR_MODULE_NOT_FOUND`. All eight publishable
  packages now run `prepublishOnly: pnpm -w run build`, which makes a distless
  publish impossible from CI or a laptop. `release.yml` also asserts the packed
  tarball against its own manifest before publishing, so a build that succeeds
  while emitting nothing fails the run instead of reaching npm.
- `publish-local` restores `package.json` on the way out, including on Ctrl-C.
  A bare `try`/`finally` would not: Node's default `SIGINT` handler terminates
  without unwinding, so the restore is also wired to `SIGINT`/`SIGTERM`, which
  re-raise afterwards to keep the 130 exit status.
