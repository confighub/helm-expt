#!/usr/bin/env node

// Runs a command with the installer plugin that CI uses.
//
// CI builds the installer plugin from one pinned commit (INSTALLER_COMMIT in
// .github/workflows/full-verify.yml) with one Go release line (go-version in
// the same workflow). Both matter. An installer package is a gzip-compressed
// tar archive. The tar bytes depend on the installer source; the compressed
// bytes also depend on the Go standard library that built the installer, and
// they differ between Go release lines. Observed on 2026-10-07: the pinned
// commit built with Go 1.27 and the installer release built with Go 1.25 write
// identical tar content and different archives.
//
// So a package digest is right for CI only when the installer that produced it
// was built with the Go line CI uses. Anything else fails with "deterministic
// bundle SHA mismatch", in CI or locally. This wrapper removes the difference:
// it builds the pinned commit once with that Go line, checks the build, puts a
// `cub` shim first on PATH that sends `cub installer ...` to it and everything
// else to the real cub, and runs the command.
//
//   node scripts/run-with-pinned-installer.mjs -- <command> [args...]
//   node scripts/run-with-pinned-installer.mjs --print
//   node scripts/run-with-pinned-installer.mjs --self-test
//
// The build lives outside the repository, in the user's cache directory, in a
// directory named after the commit and the Go line. An existing build is
// reused. A first build needs git, go and network access to github.com and the
// Go module proxy. When the local go is on another release line, the build asks
// go for a toolchain of CI's line: the newest one already in the module cache,
// else one go downloads. The installer plugin directory under the home
// directory is never read or changed.
//
// HELM_EXPT_PINNED_INSTALLER_CACHE overrides the cache directory.
// HELM_EXPT_PINNED_INSTALLER_GOTOOLCHAIN names the exact toolchain to build
// with, for example go1.25.11. It must be on the Go line CI uses.

import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// The Go release line CI builds the installer with, for example "1.25", read
// from every setup-go step of the workflows that pin the installer. A patch
// wildcard such as "1.25.x" names the same line.
export function pinnedGoLine(workflowTexts) {
  const found = new Map();
  for (const [name, text] of Object.entries(workflowTexts)) {
    const matches = [...text.matchAll(/^\s*go-version:\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/gm)].map((match) => match[1]);
    if (matches.length === 0) throw new Error(`${name} sets no go-version`);
    for (const version of matches) {
      const line = version.match(/^(\d+\.\d+)(?:\.(?:\d+|x))?$/)?.[1];
      if (!line) throw new Error(`${name} sets go-version ${version}, which names no Go release line`);
      found.set(line, [...(found.get(line) ?? []), name]);
    }
  }
  if (found.size !== 1) {
    throw new Error(`the workflows build with different Go lines: ${[...found].map(([line, names]) => `${line} (${names.join(", ")})`).join("; ")}`);
  }
  return [...found.keys()][0];
}

// Whether a Go version such as "go1.25.11" is on a release line such as "1.25".
export function onGoLine(goVersion, goLine) {
  const [major, minor, ...rest] = String(goVersion ?? "").replace(/^go/, "").split(".");
  return String(goVersion ?? "").startsWith("go") && `${major}.${minor}` === goLine && rest.length <= 1 && rest.every((part) => /^\d+$/.test(part));
}

const compareVersions = (left, right) => left.localeCompare(right, undefined, { numeric: true });

// The toolchain to build with: the local go when it is already on CI's line,
// else the newest toolchain of that line in the module cache, else the first
// release of the line, which go downloads.
export function chooseToolchain({ goLine, localVersion, cachedToolchains, override }) {
  if (override) {
    if (!onGoLine(override, goLine)) throw new Error(`HELM_EXPT_PINNED_INSTALLER_GOTOOLCHAIN is ${override}, which is not on the Go ${goLine} line CI uses`);
    return { toolchain: override, source: "named by HELM_EXPT_PINNED_INSTALLER_GOTOOLCHAIN" };
  }
  if (onGoLine(localVersion, goLine)) return { toolchain: "local", source: `the local go, ${localVersion}` };
  const cached = cachedToolchains.filter((version) => onGoLine(version, goLine)).sort(compareVersions);
  if (cached.length > 0) return { toolchain: cached.at(-1), source: "already in the Go module cache" };
  return { toolchain: `go${goLine}.0`, source: "downloaded by go" };
}

function goEnv(name) {
  return execFileSync("go", ["env", name], { encoding: "utf8", env: { ...process.env, GOTOOLCHAIN: "local" } }).trim();
}

function cachedToolchainVersions() {
  const root = join(goEnv("GOMODCACHE"), "golang.org");
  if (!existsSync(root)) return [];
  const suffix = `.${goEnv("GOOS")}-${goEnv("GOARCH")}`;
  return readdirSync(root)
    .filter((name) => name.startsWith("toolchain@v0.0.1-go") && name.endsWith(suffix))
    .map((name) => name.slice("toolchain@v0.0.1-".length, -suffix.length));
}

// The Go version a binary was built with, from its embedded build information.
function builtWithGo(binary) {
  const output = execFileSync("go", ["version", binary], { encoding: "utf8", env: { ...process.env, GOTOOLCHAIN: "local" } });
  return output.trim().split(/\s+/).at(-1);
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

// Fetches exactly the pinned commit and builds it with the Go line CI uses.
function buildFromSource({ commit, root, goLine }) {
  const choice = chooseToolchain({
    goLine,
    localVersion: goEnv("GOVERSION"),
    cachedToolchains: cachedToolchainVersions(),
    override: process.env.HELM_EXPT_PINNED_INSTALLER_GOTOOLCHAIN,
  });
  console.error(`run-with-pinned-installer: building confighub/installer ${commit} with Go ${goLine} (${choice.toolchain}, ${choice.source})`);
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
  execFileSync("go", ["build", "-o", join(root, "bin", "installer"), "./cmd/installer"], {
    cwd: source,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, GOTOOLCHAIN: choice.toolchain },
  });
}

// Returns the installer binary for one commit and Go line, building it when the
// cache directory does not already hold a finished build of both. A binary that
// was not built with the Go line CI uses is refused, new or reused, because it
// would write archives CI cannot reproduce.
export function ensureInstaller({ commit, goLine, cache, build = buildFromSource, goVersionOf = builtWithGo }) {
  const root = join(cache, `${commit}-go${goLine}`);
  const binary = join(root, "bin", "installer");
  const marker = join(root, "built-commit");
  const reused = existsSync(binary) && existsSync(marker) && readFileSync(marker, "utf8").trim() === `${commit} go${goLine}`;
  if (!reused) {
    rmSync(marker, { force: true });
    mkdirSync(join(root, "bin"), { recursive: true });
    build({ commit, root, goLine });
    if (!existsSync(binary)) throw new Error(`the installer build produced no ${binary}`);
  }
  const goVersion = goVersionOf(binary);
  if (!onGoLine(goVersion, goLine)) {
    rmSync(marker, { force: true });
    throw new Error(`${binary} was built with ${goVersion}, not the Go ${goLine} line CI uses; its archives would not match CI`);
  }
  // Written last, so an interrupted or refused build is never mistaken for a finished one.
  if (!reused) writeFileSync(marker, `${commit} go${goLine}\n`);
  return { root, binary, reused, goVersion };
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

function workflowTexts() {
  return Object.fromEntries(PIN_WORKFLOWS.map((path) => [path, readFileSync(join(repoRoot, path), "utf8")]));
}

function prepare() {
  const commit = pinnedCommit(workflowTexts());
  const goLine = pinnedGoLine(workflowTexts());
  const cache = cacheRoot();
  if (insideRepository(cache)) fail(`the cache directory ${cache} is inside the repository; choose one outside it`);
  let installer;
  try {
    installer = ensureInstaller({ commit, goLine, cache });
  } catch (error) {
    fail(`could not prepare installer ${commit} for Go ${goLine}: ${error.message}\nA first build needs git, go and network access to github.com and the Go module proxy.`);
  }
  const realCub = findRealCub(process.env.PATH, cache);
  const shim = writeShim({ root: installer.root, binary: installer.binary, realCub });
  console.error(
    `run-with-pinned-installer: cub installer -> ${installer.binary} (confighub/installer ${commit}, built with ${installer.goVersion}, ${installer.reused ? "reused build" : "built now"}); other cub commands -> ${realCub ?? "none found"}`,
  );
  return { commit, goLine, installer, shim };
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

  assert(pinnedGoLine({ one: '  go-version: "1.25"\n', two: '          go-version: "1.25.x"\n' }) === "1.25", "an agreed Go line is read, with or without a patch wildcard");
  assert(pinnedGoLine({ one: "  go-version: 1.25.3 # exact\n" }) === "1.25", "an exact patch version names its line");
  throws(() => pinnedGoLine({ one: '  go-version: "1.25"\n', two: '  go-version: "1.27"\n' }), /different Go lines/, "workflows on different Go lines");
  throws(() => pinnedGoLine({ one: "env:\n  CUB_VERSION: v1\n" }), /sets no go-version/, "a workflow with no Go version");
  throws(() => pinnedGoLine({ one: "  go-version: stable\n" }), /names no Go release line/, "a moving Go version");
  assert(onGoLine("go1.25.11", "1.25") && onGoLine("go1.25", "1.25"), "a patch release is on its line");
  assert(!onGoLine("go1.27.1", "1.25") && !onGoLine("go1.250.1", "1.25") && !onGoLine("go1.2", "1.25") && !onGoLine("1.25.1", "1.25"), "another line is not");
  const pick = (input) => chooseToolchain({ goLine: "1.25", localVersion: "go1.27.1", cachedToolchains: [], ...input }).toolchain;
  assert(pick({ localVersion: "go1.25.4" }) === "local", "a local go on CI's line is used as it is");
  assert(pick({ cachedToolchains: ["go1.24.0", "go1.25.9", "go1.25.11", "go1.27.0"] }) === "go1.25.11", "the newest cached toolchain of CI's line is chosen");
  assert(pick({}) === "go1.25.0", "with nothing local, the first release of CI's line is requested");
  assert(pick({ override: "go1.25.7" }) === "go1.25.7", "a named toolchain on CI's line is honoured");
  throws(() => pick({ override: "go1.27.1" }), /not on the Go 1\.25 line/, "a named toolchain on another line");

  const temp = mkdtempSync(join(tmpdir(), "pinned-installer-self-test-"));
  try {
    const cache = join(temp, "cache");
    let builds = 0;
    const build = ({ root }) => {
      builds += 1;
      writeFileSync(join(root, "bin", "installer"), '#!/bin/sh\necho "pinned-installer plugin=${CUB_PLUGIN:-0} $*"\n');
      chmodSync(join(root, "bin", "installer"), 0o755);
    };
    const onLine = { goLine: "1.25", cache, build, goVersionOf: () => "go1.25.11" };
    const first = ensureInstaller({ commit: a, ...onLine });
    assert(builds === 1 && first.reused === false && first.goVersion === "go1.25.11", "the first use builds");
    const second = ensureInstaller({ commit: a, ...onLine });
    assert(builds === 1 && second.reused === true && second.binary === first.binary, "a finished build is reused");
    const other = ensureInstaller({ commit: b, ...onLine });
    assert(builds === 2 && other.binary !== first.binary, "a different commit gets its own build");
    const otherLine = ensureInstaller({ commit: a, ...onLine, goLine: "1.26", goVersionOf: () => "go1.26.2" });
    assert(builds === 3 && otherLine.binary !== first.binary, "a different Go line gets its own build");
    rmSync(join(first.root, "built-commit"));
    ensureInstaller({ commit: a, ...onLine });
    assert(builds === 4, "a build with no completion marker is rebuilt");
    throws(() => ensureInstaller({ commit: "c".repeat(40), ...onLine, build: () => {} }), /produced no/, "a build that leaves no binary");
    throws(() => ensureInstaller({ commit: "d".repeat(40), ...onLine, goVersionOf: () => "go1.27.1" }), /not the Go 1\.25 line CI uses/, "a build made with another Go line");
    assert(!existsSync(join(cache, `${"d".repeat(40)}-go1.25`, "built-commit")), "a refused build is not marked finished");
    throws(() => ensureInstaller({ commit: a, ...onLine, goVersionOf: () => "go1.27.1" }), /not the Go 1\.25 line CI uses/, "a reused build that turns out to be on another Go line");
    ensureInstaller({ commit: a, ...onLine });

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
  const commit = pinnedCommit(workflowTexts());
  const goLine = pinnedGoLine(workflowTexts());
  console.log(`run-with-pinned-installer self-test passed; the workflows pin confighub/installer ${commit} built with Go ${goLine}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === "--self-test" && args.length === 1) {
    selfTest();
  } else if (args[0] === "--print" && args.length === 1) {
    const { commit, installer, shim } = prepare();
    console.log(`commit: ${commit}\ngo: ${installer.goVersion}\ninstaller: ${installer.binary}\nshim: ${shim.directory}`);
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
