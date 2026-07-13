# Publishing

Packages publish to npm via **OIDC trusted publishing** — no `NPM_TOKEN`. The
`release.yml` workflow authenticates with npm using a short-lived GitHub OIDC
token, so each published package must be registered as a trusted publisher on
npm first.

## Published packages

| Package | npm name | Notes |
|---------|----------|-------|
| `packages/langchain` | `@tabstack/langchain` | published |
| `packages/vercel-ai` | `@tabstack/ai` | published |
| `packages/core` | `@tabstack/integrations-core` | **not published** — `private: true`, changeset-ignored; bundled into the adapters |

## One-time: register the trusted publisher (per published package)

npm configures trusted publishers in the web UI only (no CLI/API). For **each**
published package (`@tabstack/langchain`, `@tabstack/ai`):

1. Go to `https://www.npmjs.com/package/<name>/access` (Settings → Trusted Publisher).
2. Choose **GitHub Actions**.
3. Fill in:
   - **Organization or user:** `Mozilla-Ocho`
   - **Repository:** `tabstack-integrations-typescript`
   - **Workflow filename:** `release.yml`
   - **Environment:** *(leave blank — the release job defines no environment)*
4. Save.

### First publish (chicken-and-egg)

npm only exposes Trusted Publisher settings on a package that **already exists**,
with no pre-registration for brand-new names. So the first version of each
package must be published once with a token:

```bash
# from the package dir, authenticated as a maintainer
npm publish --access public
```

After that first publish, register the trusted publisher (above) and all
subsequent releases go through CI with zero tokens.

## Ongoing releases (Changesets)

1. Add a changeset: `pnpm changeset` (pick packages + bump).
2. Merge to `main`. `release.yml` opens a **"Version Packages"** PR.
3. Merge that PR. CI runs `pnpm release` (`pnpm build && changeset publish`),
   publishing every bumped package to npm over OIDC with provenance.

## Notes

- Provenance is attached automatically (`NPM_CONFIG_PROVENANCE=true` + the
  `repository` field on each published `package.json`). It is verified against
  `Mozilla-Ocho/tabstack-integrations-typescript`, so the repo owner/name must
  match.
- Publishing requires npm ≥ 11.5.1; the workflow runs `npm install -g npm@latest`
  before publishing.
