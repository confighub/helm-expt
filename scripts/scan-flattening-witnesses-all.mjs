#!/usr/bin/env node
// Records a flattening witness for every catalog entry, so the raw evidence a
// flattening-safety verdict reasons from exists for the whole catalog rather
// than only for the charts a verdict has already decided. A witness is a static
// scan of the packaged chart: hook annotations, keep policies, lookup calls,
// capability branches, credential generation, webhook configurations, CRDs, and
// subchart condition gates, each with file-and-line evidence. It states what is
// in the chart. It does not state a lane; that stays the audit's judgment.
//
// The scan needs the chart tarball, so this driver fetches, and it is therefore
// a run-once-per-chart-version tool rather than part of the verify chain. Its
// output is committed and the per-entry witnesses are then read offline.
//
// Honesty rules this driver enforces:
//   - A tarball whose hash does not match the recipe's source lock is NOT
//     scanned. Upstream republished under the same version, so a witness would
//     claim to describe bytes the catalog never locked. It is recorded as a
//     mismatch instead, which is a finding about upstream, not a gap in us.
//   - A chart that cannot be fetched is recorded with the reason. Silence would
//     read as "nothing found".
//   - An entry whose committed witness already matches its locked hash is left
//     alone, so re-running churns nothing.
//
// Usage:
//   node scripts/scan-flattening-witnesses-all.mjs [--limit N] [--only <substring>]

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

import { listFiles, repoRoot, sha256File, write } from "./lib/proof-common.mjs";

const run = promisify(execFile);

const args = process.argv.slice(2);
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

// One timestamp for the whole sweep: a witness records when the package was
// observed, and a per-chart clock would add churn without adding meaning.
const OBSERVED_AT = "2026-08-07T16:00:00Z";
const CONCURRENCY = 6;

const CACHE = join(tmpdir(), "helm-expt-witness-cache");
mkdirSync(CACHE, { recursive: true });

const WITNESS_DIR = join(repoRoot, "data", "flattening-safety", "witnesses");

function field(text, name) {
  return text.match(new RegExp(`^\\s*${name}:\\s*"?([^"\\n]+)"?`, "m"))?.[1]?.trim();
}

function readEntries() {
  const entries = [];
  for (const path of listFiles(join(repoRoot, "recipes"))) {
    if (!path.endsWith("/source-lock.yaml")) continue;
    const text = readFileSync(path, "utf8");
    const rel = path.slice(repoRoot.length + 1);
    const [, repoName, chartName, version] = rel.split("/");
    const sha = field(text, "packageSHA256") ?? field(text, "archiveSHA256");
    const exactUrl = text.includes("exactArtifact") ? field(text, "url") : null;
    const contentUrl = field(text, "contentURL");
    const repositoryUrl = field(text, "repositoryURL");
    entries.push({
      recipe: rel.replace("/source-lock.yaml", ""),
      repoName: field(text, "repositoryName") ?? repoName,
      chart: field(text, "chart") ?? chartName,
      version: field(text, "version") ?? version,
      sha,
      exactUrl,
      contentUrl,
      repositoryUrl,
    });
  }
  return entries.sort((a, b) => (a.recipe < b.recipe ? -1 : 1));
}

function witnessPath(entry) {
  return join(WITNESS_DIR, `${entry.repoName}-${entry.chart}-${entry.version}.yaml`);
}

// A committed witness that already describes the locked bytes needs no rescan.
function alreadyCurrent(entry) {
  const path = witnessPath(entry);
  if (!existsSync(path)) return false;
  return readFileSync(path, "utf8").includes(`sha256: "${entry.sha}"`);
}

async function fetchTarball(entry) {
  const cached = join(CACHE, `${entry.repoName}-${entry.chart}-${entry.version}.tgz`);
  if (existsSync(cached)) return cached;
  const dest = join(CACHE, `pull-${entry.repoName}-${entry.chart}-${entry.version}`);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });

  const ociRef = [entry.exactUrl, entry.contentUrl].find((url) => url?.startsWith("oci://"));
  const httpsArtifact = entry.exactUrl?.startsWith("http") ? entry.exactUrl : null;

  if (httpsArtifact) {
    const target = join(dest, basename(httpsArtifact));
    await run("curl", ["-fsSL", "--retry", "2", "-o", target, httpsArtifact], { timeout: 120000 });
  } else if (ociRef) {
    // helm pull wants the repository without the version tag.
    const ref = ociRef.replace(/:[^:/]+$/, "");
    await run("helm", ["pull", ref, "--version", entry.version, "--destination", dest], {
      timeout: 180000,
    });
  } else if (entry.repositoryUrl) {
    await run(
      "helm",
      ["pull", entry.chart, "--repo", entry.repositoryUrl, "--version", entry.version, "--destination", dest],
      { timeout: 180000 },
    );
  } else {
    throw new Error("no fetch route recorded in the source lock");
  }

  const pulled = readdirSync(dest).filter((name) => name.endsWith(".tgz"));
  if (pulled.length !== 1) throw new Error(`expected one tarball, fetched ${pulled.length}`);
  const from = join(dest, pulled[0]);
  await run("cp", [from, cached]);
  rmSync(dest, { recursive: true, force: true });
  return cached;
}

async function scanOne(entry) {
  if (!entry.sha) return { ...entry, status: "no-hash", detail: "source lock records no package hash" };
  if (alreadyCurrent(entry)) return { ...entry, status: "current", detail: "witness already matches the locked hash" };

  let tarball;
  try {
    tarball = await fetchTarball(entry);
  } catch (error) {
    const reason = String(error.stderr || error.message || error).split("\n")[0].slice(0, 180);
    return { ...entry, status: "unavailable", detail: reason };
  }

  const actual = sha256File(tarball);
  if (actual !== entry.sha) {
    return {
      ...entry,
      status: "hash-mismatch",
      detail: `upstream now publishes ${actual.slice(0, 12)} where the lock records ${entry.sha.slice(0, 12)}`,
    };
  }

  const extract = join(CACHE, `x-${entry.repoName}-${entry.chart}-${entry.version}`);
  rmSync(extract, { recursive: true, force: true });
  mkdirSync(extract, { recursive: true });
  try {
    await run("tar", ["-xzf", tarball, "-C", extract], { timeout: 120000 });
    const roots = readdirSync(extract);
    const chartRoot = join(extract, roots.length === 1 ? roots[0] : entry.chart);
    await run(
      "node",
      [
        join(repoRoot, "scripts", "scan-flattening-witness.mjs"),
        chartRoot,
        entry.repoName,
        entry.chart,
        entry.version,
        entry.sha,
        OBSERVED_AT,
      ],
      { timeout: 180000, cwd: repoRoot },
    );
    return { ...entry, status: "scanned", detail: "" };
  } catch (error) {
    const reason = String(error.stderr || error.message || error).split("\n")[0].slice(0, 180);
    return { ...entry, status: "scan-failed", detail: reason };
  } finally {
    rmSync(extract, { recursive: true, force: true });
  }
}

async function pool(items, worker, size) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function report(rows) {
  const header = "recipe,repository,chart,version,status,detail,witness";
  const lines = rows.map((row) =>
    [
      row.recipe,
      row.repoName,
      row.chart,
      row.version,
      row.status,
      row.detail,
      ["scanned", "current"].includes(row.status)
        ? `data/flattening-safety/witnesses/${row.repoName}-${row.chart}-${row.version}.yaml`
        : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

function summary(rows) {
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  const withWitness = (counts.scanned ?? 0) + (counts.current ?? 0);
  const lines = [];
  lines.push("# Flattening witness coverage");
  lines.push("");
  lines.push(
    "A witness is a static scan of a packaged chart: what hook annotations, keep policies, lookup calls, capability branches, credential generation, webhook configurations, CRDs, and subchart condition gates it actually contains, each with file-and-line evidence. It states what is in the chart and stops there. Deciding whether the chart may ship as flattened YAML is the flattening-safety verdict's job, and those are recorded separately.",
  );
  lines.push("");
  lines.push(`${withWitness} of ${rows.length} catalog entries have a witness.`);
  lines.push("");
  lines.push("| status | entries | meaning |");
  lines.push("| --- | --- | --- |");
  const meanings = {
    scanned: "scanned in this sweep against the hash its recipe locks",
    current: "a committed witness already described the locked bytes",
    "hash-mismatch": "upstream republished this version under different bytes, so scanning it would describe something the catalog never locked",
    unavailable: "the pinned artifact could not be fetched",
    "scan-failed": "the package was fetched and verified but the scan did not complete",
    "no-hash": "the recipe's source lock records no package hash to verify against",
  };
  for (const [status, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${status} | ${count} | ${meanings[status] ?? ""} |`);
  }
  lines.push("");
  lines.push(
    "A hash mismatch is a finding about upstream rather than a gap here: the version string stayed still while the bytes moved. Those entries keep no witness until the catalog decides whether to relock.",
  );
  lines.push("");
  lines.push("Rerun with `npm run flattening-witnesses`. Entries whose witness already matches their lock are skipped, so a rerun fetches only what changed.");
  lines.push("");
  return lines.join("\n");
}

const entries = readEntries()
  .filter((entry) => (only ? entry.recipe.includes(only) : true))
  .slice(0, limit);

console.log(`scanning ${entries.length} catalog entr(ies) with concurrency ${CONCURRENCY}`);
const rows = await pool(entries, async (entry) => {
  const result = await scanOne(entry);
  console.log(`${result.status.padEnd(14)} ${result.recipe}${result.detail ? ` — ${result.detail}` : ""}`);
  return result;
}, CONCURRENCY);

write(join(repoRoot, "data", "flattening-safety", "witness-coverage.csv"), report(rows));
write(join(repoRoot, "data", "flattening-safety", "witness-coverage.md"), summary(rows));

const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
console.log("");
console.log(JSON.stringify(counts));
