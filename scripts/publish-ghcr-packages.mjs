#!/usr/bin/env node
// Publishes every catalog package version as
// oci://<REGISTRY>/<name>:v<chart version>, signed keylessly with cosign, so
// that `cub package install <name>` finds it. REGISTRY defaults to
// ghcr.io/confighub/packages, the registry cub looks names up in.
//
// A version is published once. A tag the registry already has is skipped and
// never overwritten, so running this again publishes only what is new: a
// merged package update publishes exactly the version it added.
//
// Each version is staged before it is built: the staged installer.yaml carries
// the published name as metadata.name and the tag as installerMetadata.version,
// the two fields cub reads (scripts/lib/ghcr-packages.mjs). Nothing else in
// the package changes.
//
// The registry login is the caller's (`installer login`, or docker's). Signing
// needs cosign on PATH and, in GitHub Actions, `id-token: write`; the signing
// identity is then the workflow that ran this.
//
// Environment:
//   REGISTRY    where to publish (default ghcr.io/confighub/packages)
//   SIGN        "false" publishes unsigned, for a trial against a registry of
//               your own
//   INSTALLER   the installer binary (default "installer"), the release the
//               packages repository pins
//
// Usage:
//   node scripts/publish-ghcr-packages.mjs --plan [<name>...]
//   node scripts/publish-ghcr-packages.mjs --publish [<name>...]

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GHCR_PACKAGES_REGISTRY, catalogCharts, ghcrTag, nameProblems, shortNames, stagePackage } from "./lib/ghcr-packages.mjs";

const [mode = "--plan", ...only] = process.argv.slice(2);
if (!["--plan", "--publish"].includes(mode)) {
  console.error("Usage: node scripts/publish-ghcr-packages.mjs --plan|--publish [<name>...]");
  process.exit(2);
}
const registry = (process.env.REGISTRY ?? GHCR_PACKAGES_REGISTRY).replace(/^oci:\/\//, "").replace(/\/+$/, "");
const sign = process.env.SIGN !== "false";
const installer = process.env.INSTALLER ?? "installer";

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${command} ${args.join(" ")} exited ${result.status}\n${result.stderr || result.stdout}`);
  }
  return result;
}

// anonymousTags reads a GHCR repository's tags with no credentials, the way
// cub reads ConfigHub's packages. A repository that does not exist yet has no
// tags; any other failure stops the run rather than republishing blind.
async function anonymousTags(repository) {
  const path = repository.replace(/^ghcr\.io\//, "");
  const tokenResponse = await fetch(`https://ghcr.io/token?scope=repository:${path}:pull`);
  if (!tokenResponse.ok) throw new Error(`ghcr.io token for ${path}: HTTP ${tokenResponse.status}`);
  const { token } = await tokenResponse.json();
  const response = await fetch(`https://ghcr.io/v2/${path}/tags/list?n=1000`, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404) return { exists: false, tags: new Set() };
  if (!response.ok) throw new Error(`ghcr.io tags for ${path}: HTTP ${response.status}`);
  const body = await response.json();
  return { exists: true, tags: new Set(body.tags ?? []) };
}

// publishedTags lists what the registry has. GHCR is read anonymously, so a
// package that exists but is private reads as missing and fails the check
// after its push instead of being skipped.
async function publishedTags(repository) {
  if (repository.startsWith("ghcr.io/")) {
    try {
      return (await anonymousTags(repository)).tags;
    } catch (error) {
      if (/HTTP (401|403)/.test(error.message)) return new Set();
      throw error;
    }
  }
  const result = run(installer, ["list", `oci://${repository}`], { allowFailure: true });
  if (result.status !== 0) {
    if (/not found|NAME_UNKNOWN|404/i.test(`${result.stderr}${result.stdout}`)) return new Set();
    throw new Error(`${installer} list oci://${repository}: ${result.stderr || result.stdout}`);
  }
  return new Set(result.stdout.split("\n").map((line) => line.trim()).filter(Boolean));
}

const charts = catalogCharts();
const names = shortNames(charts);
const problems = nameProblems(names);
if (problems.length > 0) {
  console.error(`package names:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const selected = charts.filter((chart) => only.length === 0 || only.includes(names.get(chart.ref)));
if (only.length > 0 && selected.length !== only.length) {
  const known = new Set(selected.map((chart) => names.get(chart.ref)));
  console.error(`no catalog package named: ${only.filter((name) => !known.has(name)).join(", ")}`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "ghcr-packages-"));
const summary = { published: [], skipped: 0, failed: [] };
try {
  for (const chart of selected) {
    const name = names.get(chart.ref);
    const repository = `${registry}/${name}`;
    const existing = await publishedTags(repository);
    for (const version of chart.versions) {
      const tag = ghcrTag(version);
      const ref = `oci://${repository}:${tag}`;
      if (existing.has(tag)) {
        summary.skipped += 1;
        continue;
      }
      if (mode === "--plan") {
        console.log(`would publish ${chart.ref} ${version} as ${ref}`);
        summary.published.push(ref);
        continue;
      }
      try {
        const stage = join(work, name, tag);
        stagePackage(join(chart.dir, version), stage, { name, tag });
        const archive = join(work, `${name}-${tag}.tgz`);
        run(installer, ["build", stage, "-o", archive]);
        run(installer, ["push", archive, ref]);
        if (sign) run(installer, ["sign", ref, "--yes"]);
        if (repository.startsWith("ghcr.io/")) {
          const { tags } = await anonymousTags(repository).catch(() => ({ tags: new Set() }));
          if (!tags.has(tag)) {
            throw new Error(`${ref} is published but cannot be read anonymously; make ${name} public in its GitHub package settings`);
          }
        }
        console.log(`published ${chart.ref} ${version} as ${ref}${sign ? ", signed" : ""}`);
        summary.published.push(ref);
      } catch (error) {
        console.error(`FAIL ${chart.ref} ${version}: ${error.message}`);
        summary.failed.push(`${ref}: ${error.message.split("\n")[0]}`);
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const verb = mode === "--plan" ? "to publish" : "published";
const lines = [
  `${summary.published.length} package versions ${verb}, ${summary.skipped} already in ${registry}, ${summary.failed.length} failed.`,
  ...summary.failed.map((line) => `- FAIL ${line}`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `${lines.join("\n")}\n\n${summary.published.map((ref) => `- ${ref}`).join("\n")}\n`,
  );
}
// exitCode, not exit(): exit() drops stdout still queued for a pipe.
process.exitCode = summary.failed.length > 0 ? 1 : 0;
