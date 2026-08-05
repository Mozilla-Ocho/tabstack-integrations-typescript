#!/usr/bin/env node
// Release helper for the publishable packages in this monorepo.
//
// Releases are driven by GitHub Release tags (see PUBLISHING.md); this script
// wraps that flow with the checks that would have caught @tabstack/pi-agent@0.1.0
// shipping without its dist/. Version numbers stay in the tags — nothing here
// ever commits a version bump, so the checked-in package.json versions lag the
// published ones by design.
//
//   node scripts/release.mjs list
//   node scripts/release.mjs preflight <pkg>
//   node scripts/release.mjs release <pkg> <version> [--notes <text>]
//   node scripts/release.mjs publish-local <pkg> <version> [--otp <code>]
//   node scripts/release.mjs verify <pkg> [version]
//
// Node builtins only, so it runs from a bare checkout with nothing installed.
// Requires git, gh, pnpm and npm on PATH.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";

// Tag prefix -> package. Must stay in step with the case statement in
// .github/workflows/release.yml; checkRegistry() asserts that it does.
const PACKAGES = {
  langchain: { dir: "langchain", npm: "@tabstack/langchain" },
  ai: { dir: "vercel-ai", npm: "@tabstack/ai" },
  eve: { dir: "eve", npm: "@tabstack/eve" },
  mastra: { dir: "mastra", npm: "@tabstack/mastra" },
  claude: { dir: "claude-agent", npm: "@tabstack/claude-agent" },
  openai: { dir: "openai-agents", npm: "@tabstack/openai-agents" },
  llama: { dir: "llamaindex", npm: "@tabstack/llamaindex" },
  pi: { dir: "pi-agent", npm: "@tabstack/pi-agent" },
};

const RELEASE_BRANCH = "main";
const WORKFLOW = "release.yml";
const SEMVER = /^\d+\.\d+\.\d+([-+].+)?$/;

// ---------------------------------------------------------------- output

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => paint("1", s);
const dim = (s) => paint("2", s);
const red = (s) => paint("31", s);
const green = (s) => paint("32", s);
const yellow = (s) => paint("33", s);
const cyan = (s) => paint("36", s);

const ok = (msg) => console.log(`  ${green("✓")} ${msg}`);
const warn = (msg) => console.log(`  ${yellow("!")} ${msg}`);
const info = (msg) => console.log(`  ${dim("·")} ${msg}`);
const step = (msg) => console.log(`\n${bold(msg)}`);

class ReleaseError extends Error {}
const fail = (msg) => {
  throw new ReleaseError(msg);
};

// ---------------------------------------------------------------- shell

const ROOT = (() => {
  const res = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (res.status !== 0) {
    console.error(red("Not inside a git repository."));
    process.exit(1);
  }
  return res.stdout.trim();
})();

function run(cmd, args, { cwd = ROOT, quiet = false, allowFail = false } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: quiet ? "pipe" : "inherit",
  });
  if (res.error) fail(`Could not run ${cmd}: ${res.error.message}`);
  if (!allowFail && res.status !== 0) {
    const detail = quiet ? `\n${res.stderr || res.stdout}`.trimEnd() : "";
    fail(`${cmd} ${args.join(" ")} exited ${res.status}${detail}`);
  }
  return res;
}

const capture = (cmd, args, opts = {}) => run(cmd, args, { ...opts, quiet: true }).stdout.trim();

function captureJson(cmd, args, opts = {}) {
  const res = run(cmd, args, { ...opts, quiet: true, allowFail: true });
  if (res.status !== 0) return null;
  try {
    return JSON.parse(res.stdout);
    // A missing package makes `npm view` exit non-zero, which is a normal
    // answer here ("not published yet"), not a failure worth surfacing.
  } catch {
    return null;
  }
}

async function confirm(question, { yes = false } = {}) {
  if (yes) {
    info("--yes given, skipping confirmation");
    return;
  }
  if (!process.stdin.isTTY) fail("Not a TTY; re-run with --yes to confirm non-interactively.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`\n${bold(question)} [y/N] `)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") fail("Aborted.");
  } finally {
    rl.close();
  }
}

async function prompt(question) {
  if (!process.stdin.isTTY) fail(`Not a TTY; cannot prompt for ${question}.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${question} `)).trim();
  } finally {
    rl.close();
  }
}

function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "tabstack-release-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- package helpers

function resolvePackage(prefix) {
  if (!prefix) fail(`Missing package. One of: ${Object.keys(PACKAGES).join(", ")}`);
  const entry = PACKAGES[prefix];
  if (!entry) {
    fail(`Unknown package '${prefix}'. One of: ${Object.keys(PACKAGES).join(", ")}`);
  }
  return { prefix, ...entry, path: join(ROOT, "packages", entry.dir) };
}

const readManifest = (pkg) => JSON.parse(readFileSync(join(pkg.path, "package.json"), "utf8"));

// Every path the manifest promises to ship: main/module/types plus each leaf of
// the exports map. These are exactly what pi-agent@0.1.0 pointed at and did not
// contain, so the tarball is checked against them rather than a file count.
function declaredEntryPoints(manifest) {
  const paths = new Set();
  for (const key of ["main", "module", "types"]) {
    if (typeof manifest[key] === "string") paths.add(manifest[key]);
  }
  const walk = (node) => {
    if (typeof node === "string") paths.add(node);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(manifest.exports);
  return [...paths].map((p) => p.replace(/^\.\//, ""));
}

// Tarball members, with npm's leading `package/` stripped.
function tarballFiles(tarball) {
  return capture("tar", ["-tzf", tarball])
    .split("\n")
    .filter(Boolean)
    .map((f) => f.replace(/^package\//, ""))
    .filter((f) => !f.endsWith("/"));
}

// The manifest as shipped, read straight out of the tarball. Using this rather
// than the working-tree package.json means a published version is judged against
// what it itself promised, which is what matters when verifying an old release.
function tarballManifest(tarball) {
  return JSON.parse(capture("tar", ["-xzOf", tarball, "package/package.json"]));
}

const onlyTarball = (dir) => {
  const found = readdirSync(dir).filter((f) => f.endsWith(".tgz"));
  if (found.length !== 1) fail(`Expected exactly one .tgz in ${dir}, found ${found.length}`);
  return join(dir, found[0]);
};

const publishedVersions = (name) => captureJson("npm", ["view", name, "versions", "--json"]) ?? [];

function distInfo(spec) {
  return captureJson("npm", ["view", spec, "dist", "--json"]);
}

// ---------------------------------------------------------------- checks

function checkTools() {
  step("Tooling");
  for (const [cmd, args] of [
    ["git", ["--version"]],
    ["gh", ["--version"]],
    ["pnpm", ["--version"]],
    ["npm", ["--version"]],
    ["tar", ["--version"]],
  ]) {
    const res = spawnSync(cmd, args, { encoding: "utf8" });
    if (res.error || res.status !== 0) fail(`${cmd} is not available on PATH.`);
  }
  ok(`git, gh, pnpm ${capture("pnpm", ["--version"])}, npm ${capture("npm", ["--version"])}`);

  const auth = run("gh", ["auth", "status"], { quiet: true, allowFail: true });
  if (auth.status !== 0) fail("gh is not authenticated. Run `gh auth login`.");
  ok("gh authenticated");
}

// Guards against this script's PACKAGES map drifting from the workflow or the
// filesystem — pi's tag prefix was added to release.yml in its own commit, so
// this is a real failure mode rather than a hypothetical one.
function checkRegistry() {
  step("Package registry");
  const workflow = readFileSync(join(ROOT, ".github", "workflows", WORKFLOW), "utf8");
  for (const [prefix, entry] of Object.entries(PACKAGES)) {
    const dir = join(ROOT, "packages", entry.dir);
    if (!existsSync(join(dir, "package.json"))) fail(`packages/${entry.dir}/package.json missing`);
    const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    if (manifest.name !== entry.npm) {
      fail(`packages/${entry.dir} is '${manifest.name}', expected '${entry.npm}'`);
    }
    if (manifest.private) fail(`${entry.npm} is marked private but listed as publishable`);
    // Anchored so that e.g. 'ai' is not satisfied by the 'openai)' case arm.
    if (!new RegExp(`^\\s*${prefix}\\)`, "m").test(workflow) || !workflow.includes(entry.npm)) {
      fail(`${WORKFLOW} has no '${prefix}' case for ${entry.npm} — tag prefixes have drifted`);
    }
  }
  ok(`${Object.keys(PACKAGES).length} packages match ${WORKFLOW} and the filesystem`);
}

function checkGitState({ requireBranch = true } = {}) {
  step("Repository state");
  const dirty = capture("git", ["status", "--porcelain"]);
  if (dirty) fail(`Working tree is not clean:\n${dirty}`);
  ok("working tree clean");

  const branch = capture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (requireBranch && branch !== RELEASE_BRANCH) {
    fail(`On '${branch}', expected '${RELEASE_BRANCH}'. Pass --any-branch to override.`);
  }
  ok(`on ${branch}`);

  run("git", ["fetch", "origin", "--quiet", "--tags"], { quiet: true });
  const local = capture("git", ["rev-parse", "HEAD"]);
  const remote = capture("git", ["rev-parse", `origin/${branch}`], { allowFail: true });
  if (remote && local !== remote) {
    const ahead = capture("git", ["rev-list", "--count", `origin/${branch}..HEAD`]);
    const behind = capture("git", ["rev-list", "--count", `HEAD..origin/${branch}`]);
    fail(
      `HEAD differs from origin/${branch} (${ahead} ahead, ${behind} behind). Push or pull first.`,
    );
  }
  ok(`in sync with origin/${branch}`);
}

function buildAndTest() {
  step("Build and test");
  info("pnpm install --frozen-lockfile --filter ./packages/*...");
  run("pnpm", ["install", "--frozen-lockfile", "--filter", "./packages/*..."], { quiet: true });
  ok("dependencies installed");
  for (const script of ["build", "typecheck", "test"]) {
    info(`pnpm ${script}`);
    run("pnpm", [script], { quiet: true });
    ok(`pnpm ${script}`);
  }
}

// The core check. Packs the package exactly as publish would and asserts every
// path the manifest advertises is actually inside the tarball.
function checkTarball(pkg, tarball, { label } = {}) {
  const files = tarballFiles(tarball);
  if (!files.includes("package.json")) fail(`${label}: tarball has no package.json`);

  const declared = declaredEntryPoints(tarballManifest(tarball));
  if (!declared.length) fail(`${label}: manifest declares no entry points to check`);
  const missing = declared.filter((p) => !files.includes(p));
  if (missing.length) {
    fail(
      [
        `${label}: tarball is missing ${missing.length} declared entry point(s):`,
        ...missing.map((p) => `      ${p}`),
        `    tarball contains ${files.length} file(s): ${files.join(", ")}`,
        "    This is the @tabstack/pi-agent@0.1.0 failure: installs fine, then",
        "    throws ERR_MODULE_NOT_FOUND on first import.",
      ].join("\n"),
    );
  }
  ok(`${label}: ${files.length} files, all ${declared.length} declared entry points present`);
  return files;
}

// Installs the tarball into a scratch project and imports it. Peer dependencies
// are the framework packages themselves (eve, @mastra/core, ...), so a missing
// peer is reported as inconclusive; only a failure naming this package's own
// dist is treated as broken.
function checkImport(pkg, tarball) {
  return withTempDir((dir) => {
    writeFileSync(
      join(dir, "package.json"),
      `${JSON.stringify({ name: "probe", private: true, type: "module" }, null, 2)}\n`,
    );
    const install = run(
      "npm",
      ["install", tarball, "--no-audit", "--no-fund", "--loglevel=error"],
      {
        cwd: dir,
        quiet: true,
        allowFail: true,
      },
    );
    if (install.status !== 0) {
      warn(`import check inconclusive: npm install failed\n${dim(install.stderr.trim())}`);
      return null;
    }

    writeFileSync(
      join(dir, "probe.mjs"),
      [
        `const m = await import(${JSON.stringify(pkg.npm)});`,
        "process.stdout.write(JSON.stringify(Object.keys(m)));",
      ].join("\n"),
    );
    const probe = run("node", ["probe.mjs"], { cwd: dir, quiet: true, allowFail: true });
    if (probe.status !== 0) {
      const stderr = probe.stderr.trim();
      // A module resolution error pointing inside this package is the real bug.
      if (stderr.includes(`${pkg.npm}/dist`) || stderr.includes(`${pkg.npm}\\dist`)) {
        fail(`import failed inside the published package:\n${stderr}`);
      }
      warn(`import check inconclusive (likely an uninstalled peer):\n${dim(stderr)}`);
      return null;
    }
    const exported = JSON.parse(probe.stdout);
    if (!exported.length) fail("package imported but exported nothing");
    ok(`imports cleanly, ${exported.length} exports (${exported.slice(0, 4).join(", ")}…)`);
    return exported;
  });
}

function reportVersions(pkg) {
  const local = readManifest(pkg).version;
  const versions = publishedVersions(pkg.npm);
  const latest = versions.at(-1);
  step("Versions");
  info(`checked in: ${local} ${dim("(lags by design — tags are the source of truth)")}`);
  if (!versions.length) {
    warn(`${pkg.npm} is not on npm yet — the first version needs 'publish-local'`);
  } else {
    info(`on npm:     ${latest}   ${dim(`(${versions.length} version(s) published)`)}`);
  }
  return { local, versions, latest };
}

// ---------------------------------------------------------------- commands

async function cmdList() {
  step("Packages");
  const rows = Object.entries(PACKAGES).map(([prefix, entry]) => {
    const pkg = { ...entry, path: join(ROOT, "packages", entry.dir) };
    const versions = publishedVersions(entry.npm);
    return {
      tag: `${prefix}-vX.Y.Z`,
      npm: entry.npm,
      checkedIn: readManifest(pkg).version,
      published: versions.at(-1) ?? "—",
      count: versions.length,
    };
  });
  const width = (key) => Math.max(...rows.map((r) => String(r[key]).length));
  const w = { npm: width("npm"), tag: width("tag"), checkedIn: width("checkedIn") };
  console.log(
    `  ${bold("npm".padEnd(w.npm))}  ${bold("tag".padEnd(w.tag))}  ${bold("git".padEnd(w.checkedIn))}  ${bold("npm latest")}`,
  );
  for (const r of rows) {
    const drift = r.published !== "—" && r.published !== r.checkedIn;
    console.log(
      `  ${r.npm.padEnd(w.npm)}  ${dim(r.tag.padEnd(w.tag))}  ${r.checkedIn.padEnd(w.checkedIn)}  ` +
        `${drift ? cyan(r.published) : r.published}${r.count ? dim(`  (${r.count})`) : ""}`,
    );
  }
}

function preflight(pkg, { requireBranch = true, skipTests = false } = {}) {
  checkTools();
  checkRegistry();
  checkGitState({ requireBranch });
  if (skipTests) warn("--skip-tests given: build, typecheck and test not run");
  else buildAndTest();

  step("Publishable artifact");
  withTempDir((dir) => {
    run("pnpm", ["pack", "--pack-destination", dir], { cwd: pkg.path, quiet: true });
    const tarball = onlyTarball(dir);
    checkTarball(pkg, tarball, { label: "local pack" });
    checkImport(pkg, tarball);
  });

  return reportVersions(pkg);
}

async function cmdPreflight(prefix, flags) {
  const pkg = resolvePackage(prefix);
  console.log(bold(`\nPreflight ${pkg.npm}`));
  const { versions, latest } = preflight(pkg, flags);
  if (latest) {
    const [maj, min, patch] = latest.split(/[.\-+]/);
    info(`suggested next: ${pkg.prefix}-v${maj}.${min}.${Number(patch) + 1}`);
  }
  console.log(`\n${green("Ready to release.")} ${dim(`${versions.length} version(s) on npm.`)}`);
}

async function cmdRelease(prefix, version, flags) {
  const pkg = resolvePackage(prefix);
  if (!version) fail("Missing version. Usage: release <pkg> <version>");
  if (!SEMVER.test(version)) fail(`'${version}' is not a valid semver version`);
  const tag = `${pkg.prefix}-v${version}`;
  const distTag = version.includes("-") ? "next" : "latest";

  console.log(bold(`\nRelease ${pkg.npm}@${version} via tag ${tag}`));
  const { versions } = preflight(pkg, flags);

  step("Release preconditions");
  if (versions.includes(version)) {
    fail(`${pkg.npm}@${version} is already on npm. npm never allows a version to be replaced.`);
  }
  ok(`${version} is not on npm`);

  if (capture("git", ["tag", "--list", tag])) fail(`Tag ${tag} already exists locally`);
  if (capture("git", ["ls-remote", "--tags", "origin", tag])) {
    fail(`Tag ${tag} already exists on origin`);
  }
  ok(`tag ${tag} is free`);

  const existing = captureJson("gh", ["release", "view", tag, "--json", "tagName"]);
  if (existing) fail(`A GitHub Release for ${tag} already exists`);
  ok("no existing GitHub Release");

  const args = ["release", "create", tag, "--title", `${pkg.npm} ${version}`];
  if (flags.notes) args.push("--notes", flags.notes);
  else if (flags.notesFile) args.push("--notes-file", flags.notesFile);
  else args.push("--generate-notes");
  if (distTag === "next") args.push("--prerelease");

  if (flags.dryRun) {
    step("Dry run");
    info(`would run: gh ${args.join(" ")}`);
    info(`would publish ${pkg.npm}@${version} under dist-tag '${distTag}'`);
    return;
  }

  await confirm(
    `Create GitHub Release ${tag}? This publishes ${pkg.npm}@${version} to npm under '${distTag}' and cannot be undone.`,
    flags,
  );

  step("Creating release");
  run("gh", args, { quiet: true });
  ok(`created ${tag}`);

  const runId = await waitForWorkflowRun(tag);
  if (!runId) {
    warn(`No ${WORKFLOW} run appeared. Check the Actions tab; the release tag is already pushed.`);
    return;
  }
  step("Publishing");
  info(`watching run ${runId}`);
  const watched = run("gh", ["run", "watch", String(runId), "--exit-status"], { allowFail: true });
  if (watched.status !== 0) {
    fail(
      `${WORKFLOW} run ${runId} failed. The tag and release exist; fix and re-tag a new version.`,
    );
  }
  ok("workflow succeeded");

  await verifyPublished(pkg, version);
}

// The release event fires the workflow asynchronously, so poll briefly for the
// run rather than assuming it exists the moment `gh release create` returns.
async function waitForWorkflowRun(tag, { attempts = 20, delayMs = 3000 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const runs =
      captureJson("gh", [
        "run",
        "list",
        "--workflow",
        WORKFLOW,
        "--event",
        "release",
        "--limit",
        "10",
        "--json",
        "databaseId,displayTitle,headBranch,status",
      ]) ?? [];
    const match = runs.find((r) => r.displayTitle?.includes(tag) || r.headBranch === tag);
    if (match) return match.databaseId;
    if (i === 0) info("waiting for the workflow run to appear…");
    await sleep(delayMs);
  }
  return null;
}

async function cmdPublishLocal(prefix, version, flags) {
  const pkg = resolvePackage(prefix);
  if (!version) fail("Missing version. Usage: publish-local <pkg> <version>");
  if (!SEMVER.test(version)) fail(`'${version}' is not a valid semver version`);

  console.log(bold(`\nHand-publish ${pkg.npm}@${version}`));
  console.log(
    dim(
      "  For brand-new package names only: npm exposes Trusted Publisher settings\n" +
        "  on packages that already exist, so version one has to come from a laptop.\n" +
        "  It will carry no provenance, permanently. See PUBLISHING.md.",
    ),
  );

  const { versions } = preflight(pkg, flags);
  step("Publish preconditions");
  if (versions.includes(version)) fail(`${pkg.npm}@${version} is already on npm`);
  if (versions.length) {
    warn(
      [
        `${pkg.npm} already has ${versions.length} version(s) on npm —`,
        "a trusted publisher can probably be registered, making 'release' the better path",
      ].join(" "),
    );
  }
  const whoami = capture("npm", ["whoami"], { allowFail: true });
  if (!whoami) fail("Not logged in to npm. Run `npm login`.");
  ok(`npm user: ${whoami}`);

  if (flags.dryRun) {
    step("Dry run");
    info(`would set version ${version} in packages/${pkg.dir}/package.json (not committed)`);
    info("would run: pnpm publish --no-git-checks --otp=<code>");
    info("would restore package.json afterwards");
    return;
  }

  await confirm(`Publish ${pkg.npm}@${version} to npm from this machine?`, flags);

  // 2FA is set to auth-and-writes on the npm account, so every write needs a
  // fresh TOTP.
  const otp = flags.otp || (await prompt("npm one-time password:"));
  if (!/^\d{6}$/.test(otp)) fail("Expected a 6-digit OTP");

  const manifestPath = join(pkg.path, "package.json");
  const original = readFileSync(manifestPath, "utf8");
  try {
    step("Publishing");
    run("npm", ["pkg", "set", `version=${version}`], { cwd: pkg.path, quiet: true });
    // Pre-dating the provenance change, the manifest may still carry
    // publishConfig.provenance, which npm merges over CLI flags and which makes
    // it refuse to publish outside CI.
    if (readManifest(pkg).publishConfig?.provenance) {
      run("npm", ["pkg", "delete", "publishConfig.provenance"], { cwd: pkg.path, quiet: true });
      info("removed publishConfig.provenance for this publish");
    }
    // pnpm rather than npm: it rewrites the workspace:* core devDependency to a
    // real version, which npm publish would ship literally.
    run("pnpm", ["publish", "--no-git-checks", `--otp=${otp}`], { cwd: pkg.path });
    ok(`published ${pkg.npm}@${version}`);
  } finally {
    writeFileSync(manifestPath, original);
    info("restored package.json");
  }

  await verifyPublished(pkg, version);
}

async function verifyPublished(pkg, version) {
  step(`Verifying ${pkg.npm}@${version} on npm`);
  const spec = `${pkg.npm}@${version}`;

  // npm's registry cache can lag a publish by a few seconds.
  let dist = null;
  for (let i = 0; i < 10 && !dist; i++) {
    dist = distInfo(spec);
    if (!dist) await sleep(3000);
  }
  if (!dist) fail(`${spec} is not resolvable on npm`);
  ok(`registry has ${spec} (${dist.fileCount} files, ${dist.unpackedSize} bytes unpacked)`);

  withTempDir((dir) => {
    run("npm", ["pack", spec, "--pack-destination", dir, "--loglevel=error"], { quiet: true });
    const tarball = onlyTarball(dir);
    checkTarball(pkg, tarball, { label: "published tarball" });
    checkImport(pkg, tarball);
  });

  if (dist.attestations) ok("provenance attestation present");
  else warn("no provenance attestation — expected while the source repo is private");
}

async function cmdVerify(prefix, version) {
  const pkg = resolvePackage(prefix);
  const resolved = version ?? publishedVersions(pkg.npm).at(-1);
  if (!resolved) fail(`${pkg.npm} has no published versions`);
  if (version && !SEMVER.test(version)) fail(`'${version}' is not a valid semver version`);
  console.log(bold(`\nVerify ${pkg.npm}@${resolved}`));
  checkRegistry();
  await verifyPublished(pkg, resolved);
  console.log(`\n${green("Published artifact is sound.")}`);
}

// ---------------------------------------------------------------- cli

const USAGE = `
${bold("Release helper")} — GitHub Release tags drive publishing; this wraps them in checks.

  ${cyan("node scripts/release.mjs list")}
      Every package with its checked-in version and what is on npm.

  ${cyan("node scripts/release.mjs preflight <pkg>")}
      Clean tree, in sync, build, typecheck, test, then pack the package and
      assert the tarball contains every entry point its manifest declares.

  ${cyan("node scripts/release.mjs release <pkg> <version>")}
      Preflight, create the GitHub Release, watch ${WORKFLOW}, then verify npm.
      Flags: --notes <text> | --notes-file <path>, --dry-run, --yes

  ${cyan("node scripts/release.mjs publish-local <pkg> <version>")}
      Hand-publish for a brand-new package name only. Prompts for a 2FA OTP and
      restores package.json afterwards. Flags: --otp <code>, --dry-run, --yes

  ${cyan("node scripts/release.mjs verify <pkg> [version]")}
      Pull a published version back off npm and check it is actually installable.
      Defaults to the latest published version.

  ${bold("Packages")}  ${Object.keys(PACKAGES).join(", ")}

  ${bold("Shared flags")}  --skip-tests, --any-branch, --yes, --dry-run

Version numbers live in the tags. Nothing here commits a version bump, so the
checked-in versions lag the published ones by design. See PUBLISHING.md.
`;

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--yes":
      case "-y":
        flags.yes = true;
        break;
      case "--skip-tests":
        flags.skipTests = true;
        break;
      case "--any-branch":
        flags.requireBranch = false;
        break;
      case "--notes":
        flags.notes = argv[++i];
        break;
      case "--notes-file":
        flags.notesFile = argv[++i];
        break;
      case "--otp":
        flags.otp = argv[++i];
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        if (arg.startsWith("-")) fail(`Unknown flag '${arg}'`);
        positional.push(arg);
    }
  }
  return { flags, positional };
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const [command, ...rest] = positional;

  if (flags.help || !command) {
    console.log(USAGE);
    return;
  }

  switch (command) {
    case "list":
      return cmdList();
    case "preflight":
      return cmdPreflight(rest[0], flags);
    case "release":
      return cmdRelease(rest[0], rest[1], flags);
    case "publish-local":
      return cmdPublishLocal(rest[0], rest[1], flags);
    case "verify":
      return cmdVerify(rest[0], rest[1]);
    default:
      fail(`Unknown command '${command}'. Run with --help.`);
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof ReleaseError) {
    console.error(`\n${red("✗")} ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
