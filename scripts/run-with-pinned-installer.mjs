#!/usr/bin/env node

// Runs a command with the installer plugin that CI uses.
//
// CI builds the installer plugin from one pinned commit (INSTALLER_COMMIT in
// .github/workflows/full-verify.yml). A workstation usually has an installer
// release instead. The two can package the same directory into different
// bytes, so a package digest generated with the local release fails in CI with
// "deterministic bundle SHA mismatch", and a digest generated in CI fails
// locally. This wrapper removes the difference: it builds the pinned commit
// once, puts a `cub` shim first on PATH that sends `cub installer ...` to that
// build and everything else to the real cub, and runs the command.
//
//   node scripts/run-with-pinned-installer.mjs -- <command> [args...]
//   node scripts/run-with-pinned-installer.mjs --print
//   node scripts/run-with-pinned-installer.mjs --self-test
//
// The build lives outside the repository, in the user's cache directory, in a
// directory named after the commit. An existing build is reused. A first build
// needs git, go and network access to github.com and the Go module proxy. The
// installer plugin directory under the home directory is never read or changed.
//
// HELM_EXPT_PINNED_INSTALLER_CACHE overrides the cache directory.

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform, tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALLER_REPOSITORY = "https://github.com/confighub/installer.git";
const PIN_WORKFLOWS = [".github/workflows/full-verify.yml", ".github/workflows/anonymous-oci-ci-proof.yml"];

function fail(message) {
  console.error(`run-with-pinned-installer: ${message}`);
  process.exit(1);
}

// The pinned commit, read from workflow text. Every workflow that pins the
// installer must pin the same commit, or CI itself would disagree about digests.
export function pinnedCommit(workflowTexts) {
  const found = new Map();
  for (const [name, text] of Object.entries(workflowTexts)) {
    const matches = [...text.matchAll(/^\s*INSTALLER_COMMIT:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/gm)].map((match) => match[1]);
    if (matches.length === 0) throw new Error(`${name} does not set INSTALLER_COMMIT`);
    for (const commit of matches) {
      if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`${name} pins INSTALLER_COMMIT to ${commit}, which is not a full commit SHA`);
      found.set(commit, [...(found.get(commit) ?? []), name]);
    }
  }
  if (found.size !== 1) {
    throw new Error(
      `the workflows pin different installer commits: ${[...found].map(([commit, names]) => `${commit} (${names.join(", ")})`).join("; ")}`,
    );
  }
  return [...found.keys()][0];
}

export function cacheRoot(env = process.env) {
  if (env.HELM_EXPT_PINNED_INSTALLER_CACHE) return resolve(env.HELM_EXPT_PINNED_INSTALLER_CACHE);
  if (env.XDG_CACHE_HOME) return join(env.XDG_CACHE_HOME, "helm-expt", "pinned-installer");
  if (platform() === "darwin") return join(homedir(), "Library", "Caches", "helm-expt", "pinned-installer");
  return join(homedir(), ".cache", "helm-expt", "pinned-installer");
}

function insideRepository(path) {
  const full = resolve(path);
  return full === repoRoot || full.startsWith(`${repoRoot}/`);
}

// Fetches exactly the pinned commit and builds it the way the workflow does.
function buildFromSource({ commit, root }) {
  const source = join(root, "src");
  rmSync(source, { recursive: true, force: true });
  mkdirSync(source, { recursive: true });
  const git = (args) => execFileSync("git", ["-C", source, ...args], { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });
  git(["init", "--quiet"]);
  git(["remote", "add", "origin", INSTALLER_REPOSITORY]);
  git(["fetch", "--quiet", "--depth", "1", "origin", commit]);
  git(["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  const head = git(["rev-parse", "HEAD"]).trim();
  if (head !== commit) throw new Error(`fetched installer commit ${head}, expected ${commit}`);
  execFileSync("go", ["build", "-o", join(root, "bin", "installer"), "./cmd/installer"], { cwd: source, stdio: ["ignore", "inherit", "inherit"] });
}

// Returns the installer binary for one commit, building it when the cache
// directory does not already hold a finished build of that commit.
export function ensureInstaller({ commit, cache, build = buildFromSource }) {
  const root = join(cache, commit);
  const binary = join(root, "bin", "installer");
  const marker = join(root, "built-commit");
  const reused = existsSync(binary) && existsSync(marker) && readFileSync(marker, "utf8").trim() === commit;
  if (!reused) {
    rmSync(marker, { force: true });
    mkdirSync(join(root, "bin"), { recursive: true });
    build({ commit, root });
    if (!existsSync(binary)) throw new Error(`the installer build produced no ${binary}`);
    // Written last, so an interrupted build is never mistaken for a finished one.
    writeFileSync(marker, `${commit}\n`);
  }
  return { root, binary, reused };
}

// The first `cub` on PATH that is not one of this wrapper's own shims.
export function findRealCub(pathValue, cache) {
  for (const directory of String(pathValue ?? "").split(delimiter)) {
    if (!directory) continue;
    const full = resolve(directory);
    if (full === resolve(cache) || full.startsWith(`${resolve(cache)}/`)) continue;
    const candidate = join(full, "cub");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

export function writeShim({ root, binary, realCub }) {
  const directory = join(root, "shim");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "cub");
  const other = realCub
    ? `exec ${shellQuote(realCub)} "$@"`
    : `echo "run-with-pinned-installer: no cub was found on PATH, so only 'cub installer' is available" >&2\nexit 127`;
  const text = `#!/bin/sh
# Written by scripts/run-with-pinned-installer.mjs. Sends "cub installer ..." to
# the installer built from the commit CI pins, and everything else to the real cub.
if [ "\${1:-}" = "installer" ]; then
  shift
  CUB_PLUGIN=1 exec ${shellQuote(binary)} "$@"
fi
${other}
`;
  if (!existsSync(path) || readFileSync(path, "utf8") !== text) writeFileSync(path, text);
  chmodSync(path, 0o755);
  return { directory, path };
}

function prepare() {
  const commit = pinnedCommit(Object.fromEntries(PIN_WORKFLOWS.map((path) => [path, readFileSync(join(repoRoot, path), "utf8")])));
  const cache = cacheRoot();
  if (insideRepository(cache)) fail(`the cache directory ${cache} is inside the repository; choose one outside it`);
  let installer;
  try {
    installer = ensureInstaller({ commit, cache });
  } catch (error) {
    fail(`could not build installer ${commit}: ${error.message}\nA first build needs git, go and network access to github.com and the Go module proxy.`);
  }
  const realCub = findRealCub(process.env.PATH, cache);
  const shim = writeShim({ root: installer.root, binary: installer.binary, realCub });
  console.error(
    `run-with-pinned-installer: cub installer -> ${installer.binary} (confighub/installer ${commit}, ${installer.reused ? "reused build" : "built now"}); other cub commands -> ${realCub ?? "none found"}`,
  );
  return { commit, installer, shim };
}

function selfTest() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(`self-test failed: ${message}`);
  };
  const throws = (fn, pattern, message) => {
    try {
      fn();
    } catch (error) {
      assert(pattern.test(error.message), `${message}: unexpected error ${error.message}`);
      return;
    }
    throw new Error(`self-test failed: ${message}: nothing was refused`);
  };
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  assert(pinnedCommit({ one: `env:\n  INSTALLER_COMMIT: ${a}\n`, two: `  INSTALLER_COMMIT: "${a}" # pinned\n` }) === a, "an agreed pin is read");
  throws(() => pinnedCommit({ one: `  INSTALLER_COMMIT: ${a}\n`, two: `  INSTALLER_COMMIT: ${b}\n` }), /different installer commits/, "disagreeing workflows");
  throws(() => pinnedCommit({ one: "env:\n  CUB_VERSION: v1\n" }), /does not set INSTALLER_COMMIT/, "a workflow with no pin");
  throws(() => pinnedCommit({ one: "  INSTALLER_COMMIT: main\n" }), /not a full commit SHA/, "a branch name as the pin");

  const temp = mkdtempSync(join(tmpdir(), "pinned-installer-self-test-"));
  try {
    const cache = join(temp, "cache");
    let builds = 0;
    const build = ({ root }) => {
      builds += 1;
      writeFileSync(join(root, "bin", "installer"), '#!/bin/sh\necho "pinned-installer plugin=${CUB_PLUGIN:-0} $*"\n');
      chmodSync(join(root, "bin", "installer"), 0o755);
    };
    const first = ensureInstaller({ commit: a, cache, build });
    assert(builds === 1 && first.reused === false, "the first use builds");
    const second = ensureInstaller({ commit: a, cache, build });
    assert(builds === 1 && second.reused === true && second.binary === first.binary, "a finished build is reused");
    const other = ensureInstaller({ commit: b, cache, build });
    assert(builds === 2 && other.binary !== first.binary, "a different commit gets its own build");
    rmSync(join(first.root, "built-commit"));
    ensureInstaller({ commit: a, cache, build });
    assert(builds === 3, "a build with no completion marker is rebuilt");
    throws(() => ensureInstaller({ commit: "c".repeat(40), cache, build: () => {} }), /produced no/, "a build that leaves no binary");

    const realDirectory = join(temp, "real");
    mkdirSync(realDirectory);
    writeFileSync(join(realDirectory, "cub"), '#!/bin/sh\necho "real-cub $*"\n');
    chmodSync(join(realDirectory, "cub"), 0o755);
    const shim = writeShim({ root: first.root, binary: first.binary, realCub: join(realDirectory, "cub") });
    const pathValue = [shim.directory, realDirectory, process.env.PATH].join(delimiter);
    assert(findRealCub(pathValue, cache) === join(realDirectory, "cub"), "the shim is never chosen as the real cub");
    const run = (args) => execFileSync("cub", args, { env: { ...process.env, PATH: pathValue }, encoding: "utf8" }).trim();
    assert(run(["installer", "package", "x y"]) === "pinned-installer plugin=1 package x y", "cub installer reaches the pinned build with its arguments intact");
    assert(run(["unit", "list"]) === "real-cub unit list", "other cub commands reach the real cub");
    const alone = writeShim({ root: other.root, binary: other.binary, realCub: null });
    const missing = spawnSync(alone.path, ["unit", "list"], { encoding: "utf8" });
    assert(missing.status === 127 && /no cub was found/.test(missing.stderr), "without a real cub, other commands are refused");
    assert(insideRepository(join(repoRoot, "tmp")) && !insideRepository(cache), "a cache directory inside the repository is recognised");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  // The committed workflows must agree, with no network and no build.
  const commit = pinnedCommit(Object.fromEntries(PIN_WORKFLOWS.map((path) => [path, readFileSync(join(repoRoot, path), "utf8")])));
  console.log(`run-with-pinned-installer self-test passed; the workflows pin confighub/installer ${commit}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test" && args.length === 1) {
    selfTest();
  } else if (args[0] === "--print" && args.length === 1) {
    const { commit, installer, shim } = prepare();
    console.log(`commit: ${commit}\ninstaller: ${installer.binary}\nshim: ${shim.directory}`);
  } else if (args[0] === "--" && args.length > 1) {
    const { commit, shim } = prepare();
    const result = spawnSync(args[1], args.slice(2), {
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: [shim.directory, process.env.PATH].join(delimiter),
        HELM_EXPT_PINNED_INSTALLER_COMMIT: commit,
      },
    });
    if (result.error) fail(`could not run ${args[1]}: ${result.error.message}`);
    process.exit(result.status ?? 1);
  } else {
    console.error(`Usage:
  node scripts/run-with-pinned-installer.mjs -- <command> [args...]
  node scripts/run-with-pinned-installer.mjs --print
  node scripts/run-with-pinned-installer.mjs --self-test`);
    process.exit(2);
  }
}
