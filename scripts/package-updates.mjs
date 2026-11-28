#!/usr/bin/env node

// Keeps every chart package in packages/<repo>/<chart>/<version>/ current with
// its upstream chart.
//
// For each chart the catalog packages, the newest packaged version is compared
// with the newest stable version upstream publishes. When upstream is ahead,
// the new version is generated with the generator that built the chart's
// newest package, verified with that generator's own checks, and committed on
// its own. A chart whose update or verification fails is put back exactly as
// it was and reported; the others carry on. Nothing is pushed or published
// here: the nightly workflow (.github/workflows/packages-nightly.yml) pushes
// the commits to a branch and opens a pull request that a person merges.
//
//   node scripts/package-updates.mjs --latest [<repo>/<chart>...] [--json]
//   node scripts/package-updates.mjs --update <repo>/<chart> [<version>]
//   node scripts/package-updates.mjs --verify-update <repo>/<chart> <version>
//   node scripts/package-updates.mjs --nightly [--report <dir>] [--open-issues] [<repo>/<chart>...]
//   node scripts/package-updates.mjs --record-publications
//   node scripts/package-updates.mjs --self-test
//
// --latest prints, per chart, the newest packaged version, the newest upstream
// version, the family that builds it and whether it moved. It writes nothing.
//
// --update generates one new version in the working tree: the recipe under
// recipes/, the package under packages/, and the generator's own records (a
// reviewed-expectations entry, a corpus row). Without <version> it takes the
// newest upstream version. Upstream is addressed by the exact archive: its URL
// and SHA-256 are read from the repository index (or the OCI registry) and
// the generator checks the downloaded bytes against them.
//
// --verify-update runs the family's checks for that version, plus two of its
// own: the new package keeps every base the previous version has, and its
// installer.yaml carries the version the package will be published under.
//
// --record-publications records what the publish workflows put on GHCR since
// the last run: for every package version and configuration artifact the
// registry serves and no committed receipt records, it reads the tag with no
// credentials, verifies its signature against the workflow that published it,
// and writes the receipt (scripts/publish-ghcr-packages.mjs and
// scripts/publish-catalog-oci.mjs, --observe --missing). A package version
// that now has a receipt comes off the pending-publication register. Nothing
// here needs a registry credential.
//
// --nightly first records publications as above and commits the receipts on
// their own, so a package version merged one night is published by the merge
// and named by the Catalog after the next night's pull request. It then does
// --update and --verify-update for every chart that moved and commits each one
// on its own. --report <dir> writes report.json and the pull
// request body there. --open-issues opens an issue for each failed chart, and
// keeps one issue listing the charts that moved but need a person, each found
// by its title so a second night does not open a second issue.
//
// The family of a chart is read from the data, not from a list kept here: the
// README of the newest package names the batch lane that built it, and a chart
// with a proof declaration (a scripts/*-proof.mjs on scripts/lib/proof-kit.mjs)
// is found by the chart identity the declaration names. FAMILIES below says,
// for each family, how to update and verify a version, or why it cannot be done
// unattended yet.
//
// Generators that build installer packages run through
// scripts/run-with-pinned-installer.mjs, so package digests match the ones CI
// checks. Helm must be the build the render receipts record.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";

import { compareVersions as compareCatalogVersions } from "./lib/ghcr-packages.mjs";
import { check, repoRoot, sha256File } from "./lib/proof-common.mjs";
import { ghcrPackageIdentity, ghcrPackageReceiptRel } from "./lib/ghcr-packages.mjs";
import { insertTableEntry } from "./lib/reviewed-expectations.mjs";
import { requiredInstallerPackageVersion } from "./lib/installer-package-version.mjs";

const require = createRequire(import.meta.url);
const yaml = require("./lib/js-yaml-vendored.cjs");

// The Helm build the committed render receipts record. A render made with
// another build rewrites receipts with no change in meaning, so updates refuse
// to run on it unless HELM_EXPT_ALLOW_HELM_DRIFT=1 says the caller knows.
export const EXPECTED_HELM_VERSION = "v4.1.4+g05fa379";

const PINNED_INSTALLER = ["scripts/run-with-pinned-installer.mjs", "--"];

// Paths a new package version may move outside its own recipe and package,
// for every family. Checked before each commit, so a generator that writes
// further than intended stops the update instead of riding along in it.
const DERIVED_PATHS = [];

// Where a new version is declared as built here and not yet in the catalog
// registry (see scripts/lib/installer-oci-publication.mjs).
const PENDING_REGISTER = "data/package-updates/pending-publication.yaml";

// Where the receipts of GHCR publications are committed.
const RECEIPT_ROOTS = ["runs/ghcr-packages", "runs/catalog-oci"];

// The batch lanes a newest package's README can name, in the order they are
// tried. A README that names none of them falls through to the proof
// declarations, then to "bespoke".
const README_FAMILIES = [
  [/npm run next80:generate/, "next80"],
  [/generate-successor-track\.mjs/, "successor-track"],
  [/kubara-catalog-3\.0-coverage/, "kubara-catalog-3.0"],
  [/kubara-catalog-1\.1-full-coverage/, "kubara-catalog-1.1"],
  [/nvidia-gpu-stack-coverage/, "nvidia-gpu-stack"],
  [/aicr-nested-charts-coverage/, "aicr-nested-charts"],
];

const CORPORA = {
  next80: {
    corpusPath: "data/next80-full-proofs/corpus.yaml",
    dataRoot: "data/next80-full-proofs",
    script: "scripts/generate-next80-full-proofs.mjs",
    keyField: "ref",
    generateArgs: (key) => ["--generate", "--only", key],
    verifyArgs: (key) => [["--verify", "--only", key], ["--verify-packages", "--only", key]],
  },
  "successor-track": {
    corpusPath: "data/successor-track/corpus.yaml",
    dataRoot: "data/successor-track",
    script: "scripts/generate-successor-track.mjs",
    keyField: "key",
    generateArgs: (key) => ["--generate", "--chart", key],
    verifyArgs: () => [["--verify"], ["--verify-packages"]],
  },
};

// One row per family: whether the nightly can update it unattended, and how,
// or exactly why not.
export const FAMILIES = {
  "proof-kit": {
    automatic: true,
    builtBy: "the chart's proof declaration, scripts/<chart>-proof.mjs",
    update: updateProofKit,
    verify: verifyProofKit,
    ownedPaths: (chart, version) => [...versionPaths(chart, version), chart.declaration, PENDING_REGISTER],
  },
  next80: {
    automatic: true,
    builtBy: "scripts/generate-next80-full-proofs.mjs, one corpus row",
    // The bases the generator builds. A package that also carries bases
    // another lane added cannot be moved by this generator alone.
    basesBuilt: ["default"],
    update: (chart, upstream) => updateCorpus("next80", chart, upstream),
    verify: (chart, version) => verifyCorpus("next80", chart, version),
    ownedPaths: (chart, version) => [...versionPaths(chart, version), CORPORA.next80.dataRoot, PENDING_REGISTER],
  },
  "successor-track": {
    automatic: true,
    builtBy: "scripts/generate-successor-track.mjs, one corpus row",
    basesBuilt: ["default"],
    update: (chart, upstream) => updateCorpus("successor-track", chart, upstream),
    verify: (chart, version) => verifyCorpus("successor-track", chart, version),
    ownedPaths: (chart, version) => [...versionPaths(chart, version), CORPORA["successor-track"].dataRoot, PENDING_REGISTER],
  },
  "kubara-catalog-3.0": {
    automatic: false,
    builtBy: "scripts/kubara-catalog-3-0-coverage.mjs",
    reason:
      "its candidate in scripts/kubara-catalog-3-0-proof.mjs pins one version with one reviewed object count, and the list in scripts/lib/kubara-catalog-3-0-coverage.mjs holds the versions Kubara catalog 3.0 pins; a newer version needs a version table in the candidate and a proof declaration outside that list",
  },
  "kubara-catalog-1.1": {
    automatic: false,
    builtBy: "scripts/complete-kubara-catalog-1-1-coverage.mjs",
    reason:
      "the list in scripts/lib/kubara-catalog-1-1-full-coverage.mjs holds the versions Kubara catalog 1.1 pins, and its candidates pin one reviewed object count each; a newer version needs a proof declaration outside that list",
  },
  "nvidia-gpu-stack": {
    automatic: false,
    builtBy: "scripts/nvidia-gpu-stack-coverage.mjs",
    reason:
      "each version is a reviewed entry in scripts/lib/nvidia-gpu-stack-coverage.mjs with chart-specific bases and lifecycle files; a newer version needs a person to add the entry",
  },
  "aicr-nested-charts": {
    automatic: false,
    builtBy: "scripts/nvidia-gpu-stack-coverage.mjs --set aicr-nested-charts",
    reason:
      "the list in scripts/lib/aicr-nested-charts-coverage.mjs holds the versions the retained AICR entries pin; a version no AICR entry pins does not belong in it",
  },
  bespoke: {
    automatic: false,
    builtBy: "a chart-specific script or a hand-made package",
    reason: "no generator in the repository rebuilds this chart at another version",
  },
};

const args = process.argv.slice(2);
const mode = args[0] ?? "--help";
const flagValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
};
const positional = () => {
  const values = [];
  for (let index = 1; index < args.length; index += 1) {
    if (["--report", "--max"].includes(args[index])) index += 1;
    else if (!args[index].startsWith("--")) values.push(args[index]);
  }
  return values;
};

function usage() {
  console.log(`Usage:
  node scripts/package-updates.mjs --latest [<repo>/<chart>...] [--json]
  node scripts/package-updates.mjs --update <repo>/<chart> [<version>]
  node scripts/package-updates.mjs --verify-update <repo>/<chart> <version>
  node scripts/package-updates.mjs --nightly [--report <dir>] [--open-issues] [<repo>/<chart>...]
  node scripts/package-updates.mjs --record-publications
  node scripts/package-updates.mjs --self-test`);
  process.exit(2);
}

// ---------------------------------------------------------------- catalog

// Versions compare by their numeric parts, without a leading v; a prerelease
// sorts before its release, and a package revision after the version it
// corrects. The order is the publisher's (scripts/lib/ghcr-packages.mjs).
export function compareVersions(left, right) {
  return Math.sign(compareCatalogVersions(left, right));
}

export function isStableVersion(version) {
  return !String(version).split("+")[0].includes("-");
}

const field = (text, name) => text.match(new RegExp(`^\\s*${name}:\\s*"?([^"\\n]+?)"?\\s*$`, "m"))?.[1] ?? "";

// Every chart the catalog packages, with its newest packaged version, where
// that version came from, and the family that built it.
export function catalogCharts(refs = []) {
  const declarations = proofDeclarations();
  const charts = [];
  const packagesRoot = join(repoRoot, "packages");
  for (const repository of readdirSync(packagesRoot).sort()) {
    if (!isDirectory(join(packagesRoot, repository))) continue;
    for (const name of readdirSync(join(packagesRoot, repository)).sort()) {
      const chartRoot = join(packagesRoot, repository, name);
      if (!isDirectory(chartRoot)) continue;
      const ref = `${repository}/${name}`;
      if (refs.length && !refs.includes(ref)) continue;
      const versions = readdirSync(chartRoot)
        .filter((version) => existsSync(join(chartRoot, version, "installer.yaml")))
        .sort(compareVersions);
      if (!versions.length) continue;
      const newest = versions[versions.length - 1];
      const lockPath = join(repoRoot, "recipes", repository, name, newest, "source-lock.yaml");
      const lock = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : "";
      const readmePath = join(chartRoot, newest, "README.md");
      const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
      const chart = {
        ref,
        repository,
        name,
        versions,
        newest,
        repositoryURL: field(lock, "repositoryURL"),
        // The OCI repository the newest version was pulled from, when its
        // lock names the exact artifact: a repository path that ends in the
        // chart's name is otherwise ambiguous.
        ociRepository: ociRepositoryOf(lock.match(/exactArtifact:\s*\n\s*url:\s*"?([^"\n]+)"?/)?.[1] ?? "", newest),
        upstreamChart: field(lock, "chart") || name,
        declaration: declarations.get(ref) ?? null,
      };
      chart.family = familyOf(chart, readme);
      charts.push(chart);
    }
  }
  for (const ref of refs) check(charts.some((chart) => chart.ref === ref), `${ref} is not a packaged chart`);
  return charts;
}

function ociRepositoryOf(url, version) {
  if (!url.startsWith("oci://")) return "";
  return url.endsWith(`:${version}`) ? url.slice(0, -(version.length + 1)) : url;
}

export function familyOf(chart, readme) {
  for (const [pattern, family] of README_FAMILIES) if (pattern.test(readme)) return family;
  if (chart.declaration) return "proof-kit";
  return "bespoke";
}

// Proof declarations by the chart they declare: scripts/*-proof.mjs files
// that hand a `const chart = { repository, name, ... }` to runProofCli.
function proofDeclarations() {
  const found = new Map();
  for (const file of readdirSync(join(repoRoot, "scripts")).sort()) {
    if (!file.endsWith("-proof.mjs")) continue;
    const text = readFileSync(join(repoRoot, "scripts", file), "utf8");
    if (!text.includes("runProofCli(")) continue;
    const block = text.match(/\nconst chart = \{([\s\S]*?)\n\};/)?.[1];
    const repository = block?.match(/\brepository:\s*"([^"]+)"/)?.[1];
    const name = block?.match(/\bname:\s*"([^"]+)"/)?.[1];
    if (repository && name) found.set(`${repository}/${name}`, `scripts/${file}`);
  }
  return found;
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// A new version also moves the chart's packages/<repo>/<chart>/upstream.yaml
// and the GHCR package list, which name every version and the tag each one is
// published under; they belong to the version's own commit.
function versionPaths(chart, version) {
  return [`recipes/${chart.ref}/${version}`, `packages/${chart.ref}/${version}`, `packages/${chart.ref}/upstream.yaml`, "data/ghcr-packages"];
}

function regenerateUpstreams() {
  execFileSync(process.execPath, [join(repoRoot, "scripts", "generate-package-upstreams.mjs"), "--generate"], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
}

// ---------------------------------------------------------------- upstream

const indexCache = new Map();

// The newest stable version upstream publishes, with the exact archive to
// fetch it from. Helm repositories are read through their index.yaml, which
// lists every version with its archive URL and digest. OCI repositories are
// asked through `helm show chart`, which resolves the newest stable tag.
export async function upstreamLatest(chart, wanted = null) {
  const url = chart.repositoryURL;
  check(url, `${chart.ref}: the newest recipe has no source-lock repositoryURL`);
  if (url.startsWith("oci://")) {
    const trimmed = url.replace(/\/$/, "");
    const base = chart.ociRepository || (trimmed.endsWith(`/${chart.upstreamChart}`) ? trimmed : `${trimmed}/${chart.upstreamChart}`);
    const tags = await ociTags(base);
    const candidates = wanted ? tags.filter((tag) => tag === wanted) : tags.filter((tag) => /^v?\d+\.\d+\.\d+/.test(tag) && isStableVersion(tag));
    check(candidates.length, wanted ? `${base} has no tag ${wanted}` : `${base} has no stable version tag`);
    const version = candidates.sort(compareVersions).at(-1);
    return { version, url: `${base}:${version}`, sha256: "", appVersion: "" };
  }
  const indexURL = `${url.replace(/\/$/, "")}/index.yaml`;
  if (!indexCache.has(indexURL)) {
    indexCache.set(indexURL, (async () => {
      const response = await fetch(indexURL, { redirect: "follow" });
      check(response.ok, `${indexURL} answered ${response.status}`);
      return yaml.load(await response.text(), { json: true });
    })());
  }
  const index = await indexCache.get(indexURL);
  const entries = (index?.entries?.[chart.upstreamChart] ?? []).filter((entry) => entry?.version);
  check(entries.length, `${indexURL} lists no versions of ${chart.upstreamChart}`);
  const candidates = wanted ? entries.filter((entry) => String(entry.version) === wanted) : entries.filter((entry) => isStableVersion(entry.version));
  check(candidates.length, wanted ? `${indexURL} does not list ${chart.upstreamChart} ${wanted}` : `${indexURL} lists no stable version of ${chart.upstreamChart}`);
  const entry = candidates.sort((left, right) => compareVersions(left.version, right.version)).at(-1);
  const archive = String(entry.urls?.[0] ?? "");
  check(archive, `${indexURL} gives no archive URL for ${chart.upstreamChart} ${entry.version}`);
  return {
    version: String(entry.version),
    url: new URL(archive, `${url.replace(/\/$/, "")}/`).href,
    sha256: String(entry.digest ?? "").replace(/^sha256:/, ""),
    appVersion: entry.appVersion === undefined ? "" : String(entry.appVersion),
  };
}

// The tags of an OCI repository, read anonymously through the registry API
// (the distribution spec's tags/list, with the bearer token the registry hands
// to anonymous pulls). `helm show chart` cannot list tags on some registries
// without credentials, and pulls the whole chart to answer.
// One registry at a time, retried: registries rate-limit anonymous callers
// (public.ecr.aws answers 429, ghcr.io refuses tokens) when many charts ask
// at once.
const registryQueues = new Map();

export function ociTags(reference) {
  const host = reference.replace(/^oci:\/\//, "").split("/")[0];
  const previous = registryQueues.get(host) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        return await ociTagsOnce(reference);
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    throw lastError;
  });
  registryQueues.set(host, next);
  return next;
}

async function ociTagsOnce(reference) {
  const [host, ...rest] = reference.replace(/^oci:\/\//, "").split("/");
  const repository = rest.join("/");
  let token = "";
  const tags = [];
  let next = `https://${host}/v2/${repository}/tags/list?n=1000`;
  while (next) {
    let response = await fetch(next, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    if (response.status === 401 && !token) {
      const challenge = response.headers.get("www-authenticate") ?? "";
      const params = Object.fromEntries([...challenge.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
      check(params.realm, `${host} asked for credentials without a bearer realm`);
      const tokenURL = new URL(params.realm);
      if (params.service) tokenURL.searchParams.set("service", params.service);
      tokenURL.searchParams.set("scope", params.scope ?? `repository:${repository}:pull`);
      const tokenResponse = await fetch(tokenURL);
      check(tokenResponse.ok, `${host} refused an anonymous token for ${repository}: ${tokenResponse.status}`);
      const body = await tokenResponse.json();
      token = body.token ?? body.access_token ?? "";
      check(token, `${host} returned no anonymous token for ${repository}`);
      response = await fetch(next, { headers: { authorization: `Bearer ${token}` } });
    }
    check(response.ok, `${reference}: listing tags answered ${response.status}`);
    tags.push(...((await response.json()).tags ?? []));
    const link = response.headers.get("link")?.match(/<([^>]+)>/)?.[1];
    next = link ? new URL(link, `https://${host}`).href : "";
  }
  return tags.map(String);
}

// Downloads the archive and returns its SHA-256, so the generator checks the
// bytes it renders against what was fetched here, and an index digest that
// disagrees with the bytes stops the update.
function archiveSHA256(artifact) {
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-package-update-"));
  try {
    let archive = join(temp, "chart.tgz");
    if (artifact.url.startsWith("oci://")) {
      const [ref, version] = splitOCI(artifact.url);
      execFileSync("helm", ["pull", ref, "--version", version, "--destination", temp], { stdio: ["ignore", "pipe", "inherit"] });
      archive = join(temp, readdirSync(temp).find((file) => file.endsWith(".tgz")) ?? "missing.tgz");
    } else {
      execFileSync("curl", ["--fail", "--location", "--retry", "3", "--silent", "--show-error", "--output", archive, artifact.url], {
        stdio: ["ignore", "pipe", "inherit"],
      });
    }
    check(existsSync(archive), `no archive was fetched from ${artifact.url}`);
    const digest = sha256File(archive);
    check(!artifact.sha256 || artifact.sha256 === digest, `${artifact.url}: the index digest ${artifact.sha256} is not the SHA-256 of the archive, ${digest}`);
    return digest;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function splitOCI(url) {
  const at = url.lastIndexOf(":");
  return [url.slice(0, at), url.slice(at + 1)];
}

// ---------------------------------------------------------------- families

function run(argv, { env = {}, pinned = false, log = null } = {}) {
  const command = pinned ? [process.execPath, ...PINNED_INSTALLER, ...argv] : argv;
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (log) log.push(`$ ${argv.join(" ")}\n${output}`);
  else process.stdout.write(output);
  check(result.status === 0, `${argv.join(" ")} exited ${result.status}${result.error ? `: ${result.error.message}` : ""}`);
  return output;
}

function updateCommands(chart, version) {
  return `node scripts/package-updates.mjs --update ${chart.ref} ${version}\nnode scripts/package-updates.mjs --verify-update ${chart.ref} ${version}`;
}

function proofKitEnv(chart, version, artifact) {
  return {
    HELM_EXPT_CHART_VERSION: version,
    HELM_EXPT_CHART_ARTIFACT_URL: artifact.url,
    HELM_EXPT_CHART_ARTIFACT_SHA256: artifact.sha256,
    // The README of the recipe and the package names the commands that rebuild
    // this version, which are these, not the declaration's default version.
    HELM_EXPT_PROOF_COMMANDS: updateCommands(chart, version),
  };
}

function updateProofKit(chart, upstream, log) {
  const env = proofKitEnv(chart, upstream.version, upstream);
  run(["node", chart.declaration, "--generate-proof"], { env: { ...env, HELM_EXPT_RECORD_EXPECTATIONS: "1" }, log });
  run(["node", chart.declaration, "--generate-package"], { env, pinned: true, log });
  if (declaresTargetFacts(chart, upstream.version)) {
    run(["node", "scripts/sync-installer-target-facts.mjs", "--generate", "--recipe", `recipes/${chart.ref}/${upstream.version}`], { pinned: true, log });
  }
}

function verifyProofKit(chart, version, log) {
  const lock = readFileSync(join(repoRoot, "recipes", chart.ref, version, "source-lock.yaml"), "utf8");
  const artifact = {
    url: lock.match(/exactArtifact:\s*\n\s*url:\s*"?([^"\n]+)"?/)?.[1] ?? "",
    sha256: lock.match(/exactArtifact:\s*\n\s*url:[^\n]*\n\s*sha256:\s*"?([0-9a-f]{64})"?/)?.[1] ?? "",
  };
  check(artifact.url && artifact.sha256, `recipes/${chart.ref}/${version}/source-lock.yaml has no exact artifact`);
  // A package revision is rendered from the chart version its lock records,
  // and its declaration builds it when asked for that revision.
  const revision = lock.match(/\n\s*packageRevision:\s*(\d+)/)?.[1];
  const chartVersion = revision ? lock.match(/\n\s*chartVersion:\s*"?([^"\n]+)"?/)?.[1] : version;
  const env = {
    ...proofKitEnv(chart, chartVersion, artifact),
    ...(revision ? { HELM_EXPT_PACKAGE_REVISION: revision } : {}),
  };
  for (const flag of ["--verify-proof", "--verify-proof-self-test", "--verify-package"]) {
    run(["node", chart.declaration, flag], { env, pinned: true, log });
  }
  if (declaresTargetFacts(chart, version)) {
    run(["node", "scripts/sync-installer-target-facts.mjs", "--verify", "--recipe", `recipes/${chart.ref}/${version}`], { pinned: true, log });
  }
}

function declaresTargetFacts(chart, version) {
  const variants = join(repoRoot, "recipes", chart.ref, version, "variants");
  if (!existsSync(variants)) return false;
  return readdirSync(variants).some((name) => {
    const path = join(variants, name, "variant.yaml");
    return existsSync(path) && /^\s*targetFacts:/m.test(readFileSync(path, "utf8"));
  });
}

// A corpus lane proves one version per chart. Moving a chart to a new version
// is a change to its corpus row, and the lane regenerates that one row.
function corpusRow(name, chart) {
  const corpus = CORPORA[name];
  const text = readFileSync(join(repoRoot, corpus.corpusPath), "utf8");
  const rows = text.split(/\n(?=    - rank: )/);
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => new RegExp(`\\n\\s+${corpus.keyField}: "${escapeRegExp(chart.ref)}"\\n`).test(`${row}\n`));
  check(matches.length === 1, `${corpus.corpusPath} has ${matches.length} rows for ${chart.ref}`);
  return { corpus, text, rows, ...matches[0] };
}

export function setCorpusVersion(rowText, version, appVersion) {
  let next = rowText.replace(/(\n\s+version: )"[^"\n]*"/, `$1${JSON.stringify(version)}`);
  if (/\n\s+appVersion: /.test(next)) {
    check(appVersion, "the corpus row pins appVersion and upstream gives none");
    next = next.replace(/(\n\s+appVersion: )"[^"\n]*"/, `$1${JSON.stringify(appVersion)}`);
  }
  return next;
}

function updateCorpus(name, chart, upstream, log) {
  const found = corpusRow(name, chart);
  const current = field(found.row, "version");
  check(current === chart.newest, `${found.corpus.corpusPath} holds ${chart.ref} at ${current}, and the newest package is ${chart.newest}`);
  found.rows[found.index] = setCorpusVersion(found.row, upstream.version, upstream.appVersion);
  writeFileSync(join(repoRoot, found.corpus.corpusPath), found.rows.join("\n"));
  // The lane pulls through the local Helm repository, so its index has to
  // know the new version.
  if (!chart.repositoryURL.startsWith("oci://")) {
    spawnSync("helm", ["repo", "add", chart.repository, chart.repositoryURL], { encoding: "utf8" });
    run(["helm", "repo", "update", chart.repository], { log });
  }
  run(["node", found.corpus.script, ...found.corpus.generateArgs(chart.ref)], { pinned: true, log });
}

function verifyCorpus(name, chart, version, log) {
  const found = corpusRow(name, chart);
  check(field(found.row, "version") === version, `${found.corpus.corpusPath} does not hold ${chart.ref} at ${version}`);
  for (const argv of found.corpus.verifyArgs(chart.ref)) run(["node", found.corpus.script, ...argv], { pinned: true, log });
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Adds the new version to the register of versions built here and not yet
// in the catalog registry, so the catalog maps leave it out until it is
// published instead of refusing it.
export function declarePending(chart, version, path = join(repoRoot, PENDING_REGISTER)) {
  const text = readFileSync(path, "utf8");
  const entry = `    - chart: ${JSON.stringify(chart.ref)}\n      version: ${JSON.stringify(version)}\n`;
  if (text.includes(entry)) return;
  const next = /\n  packages: \[\]\n?$/.test(text) ? text.replace(/\n  packages: \[\]\n?$/, `\n  packages:\n${entry}`) : `${text.replace(/\n?$/, "\n")}${entry}`;
  writeFileSync(path, next);
}

// Removes from the register every version that has a receipt now. A receipt
// is found on disk, because it is recorded in this run and committed after.
export function clearPublished(isPublished, path = join(repoRoot, PENDING_REGISTER)) {
  const text = readFileSync(path, "utf8");
  const cleared = [];
  let next = text.replace(/    - chart: ("[^"\n]+")\n      version: ("[^"\n]+")\n/g, (entry, chart, version) => {
    if (!isPublished(JSON.parse(chart), JSON.parse(version))) return entry;
    cleared.push(`${JSON.parse(chart)}@${JSON.parse(version)}`);
    return "";
  });
  next = next.replace(/\n  packages:\n?$/, "\n  packages: []\n");
  if (next !== text) writeFileSync(path, next);
  return cleared;
}

function hasPublicationReceipt(chartRef, version) {
  const identity = ghcrPackageIdentity(chartRef, version);
  return Boolean(identity) && existsSync(join(repoRoot, ghcrPackageReceiptRel(identity.name, identity.tag)));
}

// Records the GHCR publications no committed receipt records yet, and takes
// each newly published package version off the pending register. Returns
// the receipts written and the versions cleared.
function recordPublications() {
  const before = new Set(RECEIPT_ROOTS.flatMap((root) => git(["ls-files", "--", root]).split("\n").filter(Boolean)));
  for (const argv of [
    ["scripts/publish-ghcr-packages.mjs", "--observe", "--missing"],
    ["scripts/publish-catalog-oci.mjs", "--observe", "--missing"],
  ]) {
    const result = spawnSync(process.execPath, argv, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
    process.stdout.write(result.stdout.split("\n").filter((line) => !line.startsWith("- observed")).join("\n"));
    check(result.status === 0, `${argv.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  const receipts = RECEIPT_ROOTS
    .flatMap((root) => (existsSync(join(repoRoot, root)) ? git(["ls-files", "--others", "--ignored", "--exclude-standard", "--", root]).split("\n").filter(Boolean) : []))
    .filter((path) => !before.has(path))
    .sort();
  const cleared = clearPublished(hasPublicationReceipt);
  return { receipts, cleared };
}

function recordPublicationsMode() {
  const { receipts, cleared } = recordPublications();
  if (receipts.length) git(["add", "-f", "--", ...receipts]);
  console.log(`${receipts.length} new GHCR receipt(s) staged; ${cleared.length} version(s) taken off the pending register${cleared.length ? `: ${cleared.join(", ")}` : ""}. Run --refresh-views next.`);
}

// Why the nightly cannot update this chart unattended, or "" when it can.
export function blockedReason(chart) {
  const family = FAMILIES[chart.family];
  if (!family.automatic) return family.reason;
  const extra = family.basesBuilt ? packageBases(chart, chart.newest).filter((base) => !family.basesBuilt.includes(base)) : [];
  if (extra.length) {
    return `${chart.newest} also has the base(s) ${extra.join(", ")}, which another lane added and ${family.builtBy.split(",")[0]} does not build; the new version would drop them`;
  }
  return "";
}

export function packageBases(chart, version) {
  const installer = yaml.load(readFileSync(join(repoRoot, "packages", chart.ref, version, "installer.yaml"), "utf8"));
  return (installer?.spec?.bases ?? []).map((base) => String(base.name));
}

// Checks every family gets, whatever its generator checks.
function verifyCommon(chart, version) {
  const installer = yaml.load(readFileSync(join(repoRoot, "packages", chart.ref, version, "installer.yaml"), "utf8"));
  const required = requiredInstallerPackageVersion(chart.ref, version);
  check(
    String(installer?.metadata?.version ?? "") === required,
    `packages/${chart.ref}/${version}/installer.yaml metadata.version is ${installer?.metadata?.version}, and it will be published as ${required}`,
  );
  const previous = chart.versions.filter((candidate) => candidate !== version).sort(compareVersions).at(-1);
  if (!previous) return;
  const before = new Set(packageBases(chart, previous));
  const after = new Set(packageBases(chart, version));
  const dropped = [...before].filter((base) => !after.has(base));
  check(!dropped.length, `${chart.ref} ${version} has no base ${dropped.join(", ")}, which ${previous} has`);
}

// ---------------------------------------------------------------- views

// The catalog views a new package version moves are whatever the verify chain
// says is stale once the version exists: chart maps, catalog status, the
// package index summary, readiness reports, the site. Each gate names the
// command that regenerates its view ("... is stale; run npm run <script>"), or
// is a generator whose --verify has a --generate. So the views are refreshed
// the way a maintainer does it: run the derived-view gates, regenerate what
// they name in chain order, and repeat until they pass. Nothing here lists the
// views, so a view added to the chain is refreshed without a change here.
async function refreshViews({ jobs = defaultJobs(), maxPasses = 6 } = {}) {
  const gates = derivedViewGates();
  const env = { HELM_EXPT_SITE_GENERATED_AT: readFileSync(join(repoRoot, "site", "generated-at.txt"), "utf8").trim() };
  let previous = "";
  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const failing = await failingGates(gates, jobs, env);
    if (!failing.length) {
      console.log(`catalog views are current (${gates.length} derived-view gates pass)`);
      return;
    }
    const commands = [];
    for (const gate of failing) {
      const command = regenerationCommand(gate, gate.output);
      if (!commands.includes(command)) commands.push(command);
    }
    // Two passes failing the same way and leaving the tree as it was is no
    // progress, and a third would only repeat them.
    const signature = JSON.stringify([failing.map((row) => `${row.step}\n${firstErrorLine(row.output)}`), git(["status", "--porcelain"])]);
    check(
      signature !== previous,
      `regenerating did not clear these gates:\n  ${failing.map((row) => `${row.step}: ${firstErrorLine(row.output)}`).join("\n  ")}`,
    );
    previous = signature;
    console.log(`pass ${pass}: ${failing.length} stale view(s); regenerating with ${commands.length} command(s)`);
    // A generator can fail because a view it reads is regenerated later in
    // the same pass; the next pass runs it again.
    // The site reads most of these views and its gate is a compound npm
    // step, so it is regenerated after every pass rather than found stale.
    for (const command of [...commands, "npm run site:generate"]) {
      const result = spawnSync("sh", ["-c", command], { cwd: repoRoot, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1024 * 1024 * 200 });
      console.log(`  ${result.status === 0 ? "ok  " : "FAIL"} ${command}`);
    }
  }
  throw new Error(`catalog views were still stale after ${maxPasses} passes`);
}

function defaultJobs() {
  return Math.max(2, Math.min(12, Math.floor(availableParallelism() / 2)));
}

// The chain steps that check a derived view: `node scripts/<x>.mjs --verify`
// where <x> also has a --generate mode, directly or through an npm script.
export function derivedViewGates() {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const steps = execFileSync(process.execPath, ["scripts/run-verify-shard.mjs", "--shard", "1", "--of", "1", "--list"], { cwd: repoRoot, encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  const resolve = (step) => {
    const npm = step.match(/^npm run ([\w:.-]+)$/);
    return npm ? String(manifest.scripts[npm[1]] ?? "") : step;
  };
  const gates = [];
  for (const step of new Set(steps)) {
    const match = resolve(step).match(/^node (scripts\/[\w.-]+\.mjs) --verify$/);
    if (!match || !existsSync(join(repoRoot, match[1]))) continue;
    const source = readFileSync(join(repoRoot, match[1]), "utf8");
    // A generator that renders charts, runs the installer, or runs proof
    // declarations rebuilds evidence, not a view, and is never run to refresh
    // one; the guard after the refresh also refuses any change to packages/.
    if (/["'`](helm|cub)["'`]\s*,\s*\[|["'`]installer["'`]\s*,|join\("scripts", item\.script\)|HELM_EXPT_CHART_VERSION/.test(source)) continue;
    if (source.includes('"--generate"')) gates.push({ step, script: match[1] });
  }
  return gates;
}

async function failingGates(gates, jobs, env) {
  const results = await runParallel(gates.map((gate) => gate.step), jobs, env);
  // A gate can fail beside another gate's scratch files; a failure counts
  // only when the gate fails again on its own.
  const failing = [];
  for (const row of results.filter((result) => result.status !== 0)) {
    const again = spawnSync("sh", ["-c", row.step], { cwd: repoRoot, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1024 * 1024 * 200 });
    if (again.status !== 0) failing.push({ ...gates.find((gate) => gate.step === row.step), output: `${again.stdout}${again.stderr}` });
  }
  return failing;
}

function runParallel(steps, jobs, env) {
  return new Promise((resolveAll) => {
    const results = [];
    let next = 0;
    let running = 0;
    const launch = () => {
      if (next >= steps.length && running === 0) return resolveAll(results.sort((a, b) => a.index - b.index));
      while (running < jobs && next < steps.length) {
        const index = next;
        const step = steps[next];
        next += 1;
        running += 1;
        const child = spawn("sh", ["-c", step], { cwd: repoRoot, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
        let output = "";
        const keep = (chunk) => {
          output = `${output}${chunk}`.slice(-20000);
        };
        child.stdout.on("data", keep);
        child.stderr.on("data", keep);
        // A gate that stalls beside the others is retried on its own.
        const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60 * 1000);
        child.on("close", (status) => {
          clearTimeout(timer);
          results.push({ index, step, status: status ?? 1, output });
          running -= 1;
          launch();
        });
      }
    };
    launch();
  });
}

// The command a failing gate names for its own regeneration, else the
// gate's --generate.
export function regenerationCommand(gate, output) {
  const named = String(output).match(/\brun (npm run [\w:.-]+)/);
  if (named) return named[1];
  return `node ${gate.script} --generate`;
}

function firstErrorLine(output) {
  return String(output).split("\n").find((line) => /error|stale|missing|mismatch/i.test(line))?.trim().slice(0, 300) ?? "";
}

// ---------------------------------------------------------------- counts

// Object counts per base, read from the committed renders, for the table a
// reviewer reads: the previous version's next to the new one's.
export function objectCounts(chart, version) {
  const revisions = join(repoRoot, "recipes", chart.ref, version, "revisions");
  const counts = {};
  if (!existsSync(revisions)) return counts;
  for (const base of readdirSync(revisions).sort()) {
    const path = join(revisions, base, "r001", "rendered", "object-inventory.yaml");
    if (!existsSync(path)) continue;
    counts[base] = Number(field(readFileSync(path, "utf8"), "objectCount"));
  }
  return counts;
}

function recordedExpectationLine(chart, version) {
  if (!chart.declaration) return "";
  const diff = spawnSync("git", ["diff", "--unified=0", "--", chart.declaration], { cwd: repoRoot, encoding: "utf8" }).stdout ?? "";
  return diff.split("\n").find((line) => line.startsWith(`+  ${JSON.stringify(version)}:`))?.slice(1).trim() ?? "";
}

// ---------------------------------------------------------------- modes

async function latestRows(refs) {
  const charts = catalogCharts(refs);
  return Promise.all(
    charts.map(async (chart) => {
      try {
        const upstream = await upstreamLatest(chart);
        return { chart, upstream, moved: compareVersions(upstream.version, chart.newest) > 0 };
      } catch (error) {
        return { chart, error: error.message.split("\n")[0] };
      }
    }),
  );
}

async function latestMode(refs, asJSON) {
  const rows = await latestRows(refs);
  if (asJSON) {
    console.log(JSON.stringify(rows.map(({ chart, upstream, moved, error }) => ({
      chart: chart.ref,
      packaged: chart.newest,
      upstream: upstream?.version ?? null,
      moved: Boolean(moved),
      family: chart.family,
      automatic: !blockedReason(chart),
      ...(error ? { error } : {}),
    })), null, 2));
    return;
  }
  for (const { chart, upstream, moved, error } of rows) {
    const state = error ? `error: ${error}` : moved ? (blockedReason(chart) ? "moved, needs a person" : "moved") : "current";
    console.log([chart.ref, chart.newest, upstream?.version ?? "-", chart.family, state].join("\t"));
  }
  const moved = rows.filter((row) => row.moved);
  console.log(`\n${rows.length} charts, ${moved.length} moved (${moved.filter((row) => !blockedReason(row.chart)).length} the nightly can update unattended), ${rows.filter((row) => row.error).length} could not be asked`);
}

function requireHelmBuild() {
  const actual = execFileSync("helm", ["version", "--short"], { encoding: "utf8" }).trim();
  if (actual === EXPECTED_HELM_VERSION) return;
  check(
    process.env.HELM_EXPT_ALLOW_HELM_DRIFT === "1",
    `Helm is ${actual}, and the render receipts record ${EXPECTED_HELM_VERSION}; a render on another build rewrites receipts with no change in meaning (HELM_EXPT_ALLOW_HELM_DRIFT=1 to go on anyway)`,
  );
}

async function resolveUpdate(ref, version) {
  const [chart] = catalogCharts([ref]);
  const family = FAMILIES[chart.family];
  const reason = blockedReason(chart);
  check(!reason, `${ref} is built by ${family.builtBy}, which cannot update it unattended: ${reason}`);
  const upstream = await upstreamLatest(chart, version);
  check(compareVersions(upstream.version, chart.newest) > 0, `${ref} ${upstream.version} is not newer than the newest package, ${chart.newest}`);
  check(!chart.versions.includes(upstream.version), `packages/${ref}/${upstream.version} exists`);
  upstream.sha256 = archiveSHA256(upstream);
  return { chart, family, upstream };
}

async function updateMode([ref, version]) {
  check(ref, "--update needs <repo>/<chart>");
  requireHelmBuild();
  const { chart, family, upstream } = await resolveUpdate(ref, version ?? null);
  family.update(chart, upstream, null);
  declarePending(chart, upstream.version);
  regenerateUpstreams();
  console.log(`generated ${ref} ${upstream.version} with ${builtBy(chart)}; check it with --verify-update ${ref} ${upstream.version}`);
}

function verifyUpdateMode([ref, version]) {
  check(ref && version, "--verify-update needs <repo>/<chart> <version>");
  const [chart] = catalogCharts([ref]);
  check(chart.versions.includes(version), `packages/${ref}/${version} does not exist`);
  const family = FAMILIES[chart.family];
  check(family.automatic, `${ref} is built by ${family.builtBy}: ${family.reason}`);
  family.verify(chart, version, null);
  verifyCommon(chart, version);
  console.log(`verified ${ref} ${version}`);
}

function git(argv, options = {}) {
  return execFileSync("git", argv, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function changedPaths() {
  const tracked = git(["diff", "--name-only", "--no-renames", "HEAD"]).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]).split("\n").filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

// Puts the working tree back as committed, for the paths an update may touch.
function restore(paths) {
  const tracked = paths.filter((path) => git(["ls-files", "--", path]).trim());
  if (tracked.length) spawnSync("git", ["checkout", "--quiet", "HEAD", "--", ...tracked], { cwd: repoRoot });
  const present = paths.filter((path) => existsSync(join(repoRoot, path)));
  if (present.length) spawnSync("git", ["clean", "--quiet", "-fdx", "--", ...present], { cwd: repoRoot });
}

function within(path, roots) {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

async function nightlyMode(refs) {
  requireHelmBuild();
  const dirty = changedPaths().filter((path) => within(path, ["packages", "recipes", "scripts", "data"]));
  check(!dirty.length, `the working tree has changes the nightly could commit by mistake: ${dirty.slice(0, 5).join(", ")}`);
  const reportDir = flagValue("--report");
  // What the publish workflows published since the last run is recorded
  // first, so this pull request carries the receipts and the Catalog names
  // those versions once it is merged.
  const recorded = { receipts: [], cleared: [], error: "" };
  try {
    Object.assign(recorded, recordPublications());
    if (recorded.receipts.length || recorded.cleared.length) {
      git(["add", "-f", "--", ...recorded.receipts]);
      git(["add", "--", PENDING_REGISTER]);
      git(["commit", "--quiet", "-m", publicationsCommitMessage(recorded)]);
    }
  } catch (error) {
    restore(changedPaths().filter((path) => within(path, [...RECEIPT_ROOTS, PENDING_REGISTER])));
    for (const root of RECEIPT_ROOTS) spawnSync("git", ["clean", "--quiet", "-fdX", "--", root], { cwd: repoRoot });
    recorded.error = error.message;
  }
  const rows = await latestRows(refs);
  const max = flagValue("--max") === null ? Number.POSITIVE_INFINITY : Number(flagValue("--max"));
  check(max > 0, "--max needs a positive number");
  const updated = [];
  const failed = [];
  const waiting = [];
  const deferred = [];
  for (const row of rows) {
    const { chart } = row;
    if (row.error) {
      failed.push({ chart: chart.ref, version: "the newest version", family: chart.family, log: row.error });
      console.log(`${chart.ref}: FAIL could not ask upstream: ${row.error}`);
      continue;
    }
    if (!row.moved) {
      console.log(`${chart.ref}: at ${chart.newest}, the newest`);
      continue;
    }
    const family = FAMILIES[chart.family];
    const reason = blockedReason(chart);
    if (reason) {
      waiting.push({ chart: chart.ref, from: chart.newest, to: row.upstream.version, family: chart.family, builtBy: family.builtBy, reason });
      console.log(`${chart.ref}: ${chart.newest} -> ${row.upstream.version} needs a person (${chart.family})`);
      continue;
    }
    const version = row.upstream.version;
    if (updated.length >= max) {
      deferred.push({ chart: chart.ref, from: chart.newest, to: version, family: chart.family });
      console.log(`${chart.ref}: ${chart.newest} -> ${version} left for a later run (--max ${max})`);
      continue;
    }
    const owned = family.ownedPaths(chart, version);
    const log = [];
    try {
      row.upstream.sha256 = archiveSHA256(row.upstream);
      family.update(chart, row.upstream, log);
      declarePending(chart, version);
      regenerateUpstreams();
      chart.versions = [...chart.versions, version].sort(compareVersions);
      family.verify(chart, version, log);
      verifyCommon(chart, version);
      const outside = changedPaths().filter((path) => !within(path, [...owned, ...DERIVED_PATHS]));
      check(!outside.length, `the update wrote outside its own files: ${outside.slice(0, 10).join(", ")}`);
      const counts = { before: objectCounts(chart, chart.newest), after: objectCounts(chart, version) };
      const expectations = recordedExpectationLine(chart, version);
      git(["add", "-A", "--", ...owned.filter((path) => existsSync(join(repoRoot, path)))]);
      git(["commit", "--quiet", "-m", commitMessage(chart, version, family, counts, expectations)]);
      updated.push({ chart: chart.ref, from: chart.newest, to: version, family: chart.family, counts, expectations });
      console.log(`${chart.ref}: updated ${chart.newest} -> ${version}`);
    } catch (error) {
      restore(owned);
      chart.versions = chart.versions.filter((candidate) => candidate !== version);
      failed.push({ chart: chart.ref, from: chart.newest, version, family: chart.family, log: `${log.join("\n")}\n${error.message}` });
      console.log(`${chart.ref}: FAIL update to ${version}: ${error.message.split("\n")[0]}`);
    }
  }
  let views = "";
  if (updated.length || recorded.receipts.length || recorded.cleared.length) {
    try {
      await refreshViews();
      const evidence = changedPaths().filter((path) => path.startsWith("packages/") || /^recipes\/.*\/(revisions|publication|variants)\//.test(path) || /^recipes\/.*\/source-lock\.yaml$/.test(path));
      check(!evidence.length, `refreshing the catalog views changed package or proof evidence: ${evidence.slice(0, 10).join(", ")}`);
      if (changedPaths().length) {
        git(["add", "-A"]);
        git(["commit", "--quiet", "-m", `packages: refresh the catalog views the new package versions move\n\nRegenerated by scripts/package-updates.mjs --refresh-views: every derived-view gate\nin the verify chain that the new versions left stale, regenerated in chain order\nuntil it passed.\n`]);
        views = "refreshed";
      } else views = "unchanged";
    } catch (error) {
      restore(changedPaths());
      views = `failed: ${error.message}`;
      failed.push({ chart: "catalog views", version: "the new package versions", family: "views", log: error.message });
    }
  }
  if (recorded.error) failed.push({ chart: "GHCR publication receipts", version: "the publications since the last run", family: "receipts", log: recorded.error });
  const report = { helm: execFileSync("helm", ["version", "--short"], { encoding: "utf8" }).trim(), max: Number.isFinite(max) ? max : null, recorded, updated, failed, waiting, deferred, views };
  if (args.includes("--open-issues")) openIssues(report);
  if (reportDir) {
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(join(reportDir, "pr-body.md"), pullRequestBody(report));
  }
  console.log(`\n${recorded.receipts.length} GHCR receipt(s) recorded, ${updated.length} updated, ${failed.length} failed, ${deferred.length} left for a later run, ${waiting.length} moved and need a person; catalog views ${views || "not touched"}`);
  if (failed.length) process.exit(1);
}

function publicationsCommitMessage({ receipts, cleared }) {
  const packages = receipts.filter((path) => path.startsWith("runs/ghcr-packages/")).length;
  return `${[
    "packages: record the GHCR publications since the last run",
    "",
    `Observed with no credentials by scripts/package-updates.mjs: ${packages} package version(s) and ${receipts.length - packages} configuration artifact(s)`,
    "that the publish workflows put on GHCR and no committed receipt recorded. Each tag",
    "reads anonymously at its digest, and its signature verifies against the workflow",
    "that published it.",
    ...(cleared.length ? ["", `Published, so off the pending-publication register: ${cleared.join(", ")}.`] : []),
  ].join("\n")}\n`;
}

function builtBy(chart) {
  return chart.declaration ? FAMILIES[chart.family].builtBy.replace("scripts/<chart>-proof.mjs", chart.declaration) : FAMILIES[chart.family].builtBy;
}

function commitMessage(chart, version, family, counts, expectations) {
  const lines = [
    `packages: ${chart.ref} ${version}`,
    "",
    `Upstream published ${chart.ref} ${version}; the newest package was ${chart.newest}.`,
    `Generated and verified by ${builtBy(chart)}, through scripts/package-updates.mjs.`,
    "",
    "Objects per base, previous version and this one:",
    ...countRows(counts).map(([base, before, after]) => `  ${base}: ${before} -> ${after}`),
  ];
  if (expectations) lines.push("", "Unreviewed expectations recorded in the proof declaration:", `  ${expectations}`);
  return `${lines.join("\n")}\n`;
}

function countRows(counts) {
  const bases = [...new Set([...Object.keys(counts.before), ...Object.keys(counts.after)])].sort();
  return bases.map((base) => [base, counts.before[base] ?? "-", counts.after[base] ?? "-"]);
}

export function pullRequestBody(report) {
  const out = [];
  out.push(
    `The nightly package update found ${report.updated.length + report.failed.length + report.waiting.length} chart(s) that moved upstream. ` +
      `This pull request carries ${report.updated.length} new package version(s), one commit each.`,
    "",
    ...(report.recorded?.receipts?.length || report.recorded?.cleared?.length
      ? [
        `It also records ${report.recorded.receipts.length} GHCR publication receipt(s) for what the publish workflows published since the last run, in a commit of their own${report.recorded.cleared.length ? `, and takes ${report.recorded.cleared.map((entry) => `\`${entry}\``).join(", ")} off the pending-publication register` : ""}. Once merged, the Catalog names those versions and artifacts on GHCR.`,
        "",
      ]
      : []),
    "**Merging publishes.** On a push to main, the publish workflow publishes every package version the registry does not have yet, so each version below becomes a public, signed package when this is merged. Review it as a release.",
    "",
    "Each new version is also listed in `data/package-updates/pending-publication.yaml`, so the catalog maps and the site leave it out until its publication receipt exists. The next nightly run records the GHCR receipt and takes it off the list. The last commit regenerates the catalog views the new versions move.",
    "",
  );
  if (report.updated.length) {
    out.push("## New package versions", "", "Each row was generated by the generator that built the chart's previous version and passed that generator's own checks. Object counts come from the committed renders. Where a proof declaration keeps reviewed counts, the new entry was recorded from the render and is not yet reviewed: read it against the previous version's before merging.", "");
    out.push("| Chart | From | To | Built by | Objects per base (from -> to) | Recorded expectations to review |", "| --- | --- | --- | --- | --- | --- |");
    for (const row of report.updated) {
      const counts = countRows(row.counts).map(([base, before, after]) => `${base}: ${before} -> ${after}${before !== after ? " **changed**" : ""}`).join("<br>");
      out.push(`| \`${row.chart}\` | ${row.from} | ${row.to} | ${row.family} | ${counts} | ${row.expectations ? `\`${row.expectations}\`` : "none (counts checked by the generator)"} |`);
    }
    out.push("");
  }
  if (report.failed.length) {
    out.push("## Updates that failed", "", "These charts stay at their previous version. Each has an issue with the log.", "");
    for (const row of report.failed) out.push(`- \`${row.chart}\` to ${row.version} (${row.family})${row.issue ? `: ${row.issue}` : ""}`);
    out.push("");
  }
  if (report.views && report.views !== "refreshed" && report.views !== "unchanged") {
    out.push("## Catalog views", "", `The catalog views could not be refreshed, so the gates on this pull request will name the stale ones: ${report.views}`, "");
  }
  if (report.deferred?.length) {
    out.push("## Moved upstream, left for a later run", "", `This pull request holds at most ${report.max} new versions, so it stays reviewable. These follow once it is merged.`, "");
    for (const row of report.deferred) out.push(`- \`${row.chart}\` ${row.from} -> ${row.to} (${row.family})`);
    out.push("");
  }
  if (report.waiting.length) {
    out.push("## Moved upstream, need a person", "", "The nightly does not update these, because their generator cannot take a new version unattended.", "");
    out.push("| Chart | Packaged | Upstream | Built by | Why not automatic |", "| --- | --- | --- | --- | --- |");
    for (const row of report.waiting) out.push(`| \`${row.chart}\` | ${row.from} | ${row.to} | ${row.builtBy} | ${row.reason} |`);
    out.push("");
  }
  out.push(
    "## How this was made",
    "",
    `\`node scripts/package-updates.mjs --nightly\` with Helm \`${report.helm}\` (the render receipts record \`${EXPECTED_HELM_VERSION}\`) and the installer commit CI pins. To redo one row on a laptop: \`node scripts/package-updates.mjs --update <repo>/<chart> <version>\`, then \`--verify-update\`. See docs/reference/package-updates.md.`,
    "",
    "The weekly catalog refresh no longer runs on a schedule; this job runs its byte-drift recheck first every night, so one bot opens pull requests for upstream movement.",
  );
  return `${out.join("\n")}\n`;
}

// ---------------------------------------------------------------- issues

function openIssues(report) {
  for (const row of report.failed) {
    const title = `packages: ${row.chart} update to ${row.version} failed`;
    const body = [
      `The nightly package update of \`${row.chart}\` to ${row.version} failed, so the chart stays at ${row.from ?? "its previous version"}.`,
      "",
      row.from
        ? `Reproduce with \`node scripts/package-updates.mjs --update ${row.chart} ${row.version}\`, then \`node scripts/package-updates.mjs --verify-update ${row.chart} ${row.version}\`. See docs/reference/package-updates.md.`
        : "See docs/reference/package-updates.md.",
      "",
      "```",
      String(row.log).slice(-6000),
      "```",
    ].join("\n");
    row.issue = ensureIssue(title, body, { update: false });
  }
  if (report.waiting.length) {
    const body = [
      "Charts that moved upstream and that the nightly package update cannot update unattended. The nightly rewrites this list each run.",
      "",
      "| Chart | Packaged | Upstream | Built by | Why not automatic |",
      "| --- | --- | --- | --- | --- |",
      ...report.waiting.map((row) => `| \`${row.chart}\` | ${row.from} | ${row.to} | ${row.builtBy} | ${row.reason} |`),
    ].join("\n");
    ensureIssue("packages: upstream versions waiting for a person", body, { update: true });
  }
}

// Opens an issue unless one with this exact title is open. With update, an
// open one has its body replaced.
function ensureIssue(title, body, { update }) {
  const listed = JSON.parse(execFileSync("gh", ["issue", "list", "--state", "open", "--search", `"${title}" in:title`, "--json", "number,title,url"], { encoding: "utf8" }));
  const existing = listed.find((issue) => issue.title === title);
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-package-issue-"));
  try {
    const bodyFile = join(temp, "body.md");
    writeFileSync(bodyFile, `${body}\n`);
    if (existing) {
      if (update) execFileSync("gh", ["issue", "edit", String(existing.number), "--body-file", bodyFile], { stdio: "inherit" });
      return existing.url;
    }
    return execFileSync("gh", ["issue", "create", "--title", title, "--body-file", bodyFile], { encoding: "utf8" }).trim();
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- self-test

function selfTest() {
  const order = ["0.9.0", "v1.2.0", "1.10.0", "1.10.0-rc.1", "1.2.10"].sort(compareVersions);
  check(JSON.stringify(order) === JSON.stringify(["0.9.0", "v1.2.0", "1.2.10", "1.10.0-rc.1", "1.10.0"]), `version order is wrong: ${order.join(", ")}`);
  check(isStableVersion("2.0.0") && !isStableVersion("2.0.0-beta.1") && isStableVersion("2.0.0+build.1"), "stable-version test is wrong");

  // The family table has a row for every family the data can name.
  for (const [, family] of README_FAMILIES) check(FAMILIES[family], `README family ${family} has no row in FAMILIES`);
  for (const [name, family] of Object.entries(FAMILIES)) {
    check(family.automatic ? typeof family.update === "function" && typeof family.verify === "function" : Boolean(family.reason), `family ${name} is incomplete`);
  }

  // The catalog reads, and every chart lands in a family.
  const charts = catalogCharts();
  check(charts.length > 100, `only ${charts.length} packaged charts were found`);
  for (const chart of charts) check(FAMILIES[chart.family], `${chart.ref} has unknown family ${chart.family}`);
  const byRef = new Map(charts.map((chart) => [chart.ref, chart]));
  check(byRef.get("argo-cd/argo-cd")?.family === "proof-kit" && byRef.get("argo-cd/argo-cd").declaration === "scripts/argo-cd-proof.mjs", "argo-cd is not found as a proof declaration");
  check(byRef.get("kedacore/keda")?.family === "next80", "keda is not found in the next80 lane");

  // A corpus version bump touches the version, and appVersion when pinned, of one row only.
  const row = '    - rank: 1\n      key: "a/b"\n      version: "1.0.0"\n      appVersion: "2.0"\n      proofFocus: "x"';
  const bumped = setCorpusVersion(row, "1.1.0", "2.1");
  check(bumped === row.replace('"1.0.0"', '"1.1.0"').replace('"2.0"', '"2.1"'), "corpus bump changed more than version and appVersion");

  // A version declared pending publication is appended once, to an empty or a filled register.
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-package-updates-self-test-"));
  try {
    const register = join(temp, "pending.yaml");
    writeFileSync(register, 'kind: "PackagesPendingPublication"\nspec:\n  packages: []\n');
    declarePending({ ref: "a/b" }, "1.1.0", register);
    declarePending({ ref: "a/b" }, "1.1.0", register);
    declarePending({ ref: "c/d" }, "v2.0.0", register);
    check(
      readFileSync(register, "utf8") === 'kind: "PackagesPendingPublication"\nspec:\n  packages:\n    - chart: "a/b"\n      version: "1.1.0"\n    - chart: "c/d"\n      version: "v2.0.0"\n',
      "the pending-publication register was not appended as expected",
    );
    // A version with a receipt comes off the register, and an emptied register reads [].
    check(JSON.stringify(clearPublished((chart) => chart === "a/b", register)) === '["a/b@1.1.0"]', "a published version was not cleared");
    check(readFileSync(register, "utf8").endsWith('  packages:\n    - chart: "c/d"\n      version: "v2.0.0"\n'), "clearing a version removed another");
    clearPublished(() => true, register);
    check(readFileSync(register, "utf8") === 'kind: "PackagesPendingPublication"\nspec:\n  packages: []\n', "an emptied register is not packages: []");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  // A recorded expectation lands as the last entry of the table and never twice.
  const source = 'const versionExpectations = {\n  "1.0.0": { defaultObjects: 3 },\n};\nconst expected = 1;\n';
  const inserted = insertTableEntry(source, "1.1.0", '  "1.1.0": { defaultObjects: 4 },');
  check(inserted.includes('  "1.0.0": { defaultObjects: 3 },\n  "1.1.0": { defaultObjects: 4 },\n};'), "recorded entry is not the table's last entry");
  let refused = false;
  try {
    insertTableEntry(inserted, "1.1.0", '  "1.1.0": { defaultObjects: 4 },');
  } catch {
    refused = true;
  }
  check(refused, "a second entry for one version was accepted");

  // The pull request body names every row and says that merging publishes.
  const body = pullRequestBody({
    helm: EXPECTED_HELM_VERSION,
    updated: [{ chart: "a/b", from: "1.0.0", to: "1.1.0", family: "proof-kit", counts: { before: { default: 3 }, after: { default: 4 } }, expectations: '"1.1.0": { defaultObjects: 4 },' }],
    failed: [{ chart: "c/d", version: "2.0.0", family: "next80" }],
    waiting: [{ chart: "e/f", from: "1", to: "2", builtBy: "x", reason: "y" }],
  });
  for (const needle of ["Merging publishes", "`a/b` | 1.0.0 | 1.1.0", "default: 3 -> 4 **changed**", "`c/d` to 2.0.0", "`e/f` | 1 | 2"]) {
    check(body.includes(needle), `pull request body lacks ${needle}`);
  }
  console.log(`self-test passed: ${charts.length} charts in ${new Set(charts.map((chart) => chart.family)).size} families`);
}

// Last, so every constant above is initialized before a mode runs.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  try {
    if (mode === "--latest") await latestMode(positional(), args.includes("--json"));
    else if (mode === "--update") await updateMode(positional());
    else if (mode === "--verify-update") verifyUpdateMode(positional());
    else if (mode === "--nightly") await nightlyMode(positional());
    else if (mode === "--refresh-views") await refreshViews();
    else if (mode === "--record-publications") recordPublicationsMode();
    else if (mode === "--self-test") selfTest();
    else usage();
  } catch (error) {
    console.error(`package-updates: ${error.message}`);
    process.exit(1);
  }
}
