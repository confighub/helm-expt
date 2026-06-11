#!/usr/bin/env node
// Environment-determinism matrix: does the same chart render byte-identically
// across timezone and locale variations, per flag profile? This answers the
// "environment skew" attack on the render claim with a recorded matrix
// instead of an assertion — and where a cell is NOT deterministic or NOT
// invariant, the matrix records that too.
//
//   node scripts/generate-environment-matrix.mjs --record    (online: helm + network)
//   node scripts/generate-environment-matrix.mjs --generate  (offline: summary from committed matrix.csv)
//   node scripts/generate-environment-matrix.mjs --verify    (offline: summary/csv consistency)
//
// Recording renders each corpus chart twice per cell (same env) to score
// per-cell determinism, then compares the cell digest against the
// baseline-env digest for the same chart + flag profile to score env
// invariance. Environment cells run on the standard flag profile; alternate
// flag profiles run on the baseline env only (the flag axis records expected
// output differences, not env skew).

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "environment-matrix");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  matrix: join(outputRoot, "matrix.csv"),
  html: join(outputRoot, "matrix.html"),
};

// Same render contract as generate-variant-proof.mjs and
// record-blast-radius-case.mjs, so the matrix speaks about the same renders
// the proofs use.
const kubeVersion = "1.30.0";
const STANDARD_FLAGS = ["--kube-version", kubeVersion, "--include-crds", "--skip-tests", "--no-hooks"];

// Charts with committed revisions and pinned effective values. Grown
// deliberately, not auto-discovered: every row here is re-rendered on each
// --record run. `variant` names the base variant whose render context
// (namespace, release name, values profile) the cells use.
const CORPUS = [
  { path: "bitnami/redis/25.5.3", variant: "default" },
  { path: "bitnami/redis/27.0.0", variant: "default" },
  { path: "bitnami/nginx/24.0.2", variant: "http-clusterip" },
  { path: "prometheus-community/kube-prometheus-stack/85.3.3", variant: "default" },
];

// TZ/locale cells. UTC+C is the baseline every other env cell is compared
// against. tr_TR is included deliberately: Turkish case folding is the
// classic locale-sensitivity breaker.
const ENVIRONMENTS = [
  { id: "baseline-utc-c", tz: "UTC", locale: "C" },
  { id: "tz-new-york", tz: "America/New_York", locale: "C" },
  { id: "tz-tokyo", tz: "Asia/Tokyo", locale: "C" },
  { id: "locale-en-us-utf8", tz: "UTC", locale: "en_US.UTF-8" },
  { id: "locale-turkish-utf8", tz: "UTC", locale: "tr_TR.UTF-8" },
];

// Flag profiles. The standard profile gets the full environment sweep;
// alternates render on the baseline env only. Their digests are RECORDED
// (differences across profiles are expected and legitimate — that is the
// point of recording which profile a receipt used).
const FLAG_PROFILES = [
  { id: "standard", flags: STANDARD_FLAGS, environments: ENVIRONMENTS },
  { id: "no-include-crds", flags: STANDARD_FLAGS.filter((flag) => flag !== "--include-crds"), environments: [ENVIRONMENTS[0]] },
  { id: "with-hooks", flags: STANDARD_FLAGS.filter((flag) => flag !== "--no-hooks"), environments: [ENVIRONMENTS[0]] },
];

if (mode === "--record") {
  const rows = recordMatrix();
  write(outputs.matrix, toCsv(rows));
  write(outputs.summary, summary(rows));
  write(outputs.html, htmlReport(rows));
  console.log(`recorded environment matrix -> ${relativeRepo(outputRoot)}/ (${rows.length} cells)`);
} else if (mode === "--generate") {
  const rows = readMatrix();
  write(outputs.summary, summary(rows));
  write(outputs.html, htmlReport(rows));
  console.log(`wrote environment matrix summary for ${rows.length} cell(s)`);
} else if (mode === "--verify") {
  for (const path of Object.values(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run environment-matrix:record`);
  }
  const rows = readMatrix();
  check(rows.length > 0, "environment matrix has no cells");
  for (const entry of CORPUS) {
    const baseline = rows.find((row) => row.chart_path === entry.path && row.flag_profile === "standard" && row.env_id === "baseline-utc-c");
    check(baseline, `environment matrix is missing the standard baseline cell for ${entry.path}; run npm run environment-matrix:record`);
  }
  for (const row of rows) {
    check(row.deterministic !== "true" || /^[0-9a-f]{64}$/.test(row.digest), `cell ${row.chart_path}/${row.flag_profile}/${row.env_id} is deterministic but has no well-formed digest`);
  }
  check(readFileSync(outputs.summary, "utf8") === summary(rows), `${relativeRepo(outputs.summary)} is stale; run npm run environment-matrix`);
  check(existsSync(outputs.html) && readFileSync(outputs.html, "utf8") === htmlReport(rows), `${relativeRepo(outputs.html)} is stale; run npm run environment-matrix`);
  const variantCells = rows.filter((row) => row.matches_baseline_env === "false");
  console.log(`verified environment matrix: ${rows.length} cell(s), ${variantCells.length} env-variant cell(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-environment-matrix.mjs --record
  node scripts/generate-environment-matrix.mjs --generate
  node scripts/generate-environment-matrix.mjs --verify`);
}

function recordMatrix() {
  const context = runContext();
  const rows = [];
  for (const entry of CORPUS) {
    const chart = loadChart(entry);
    for (const profile of FLAG_PROFILES) {
      let baselineDigest = null;
      for (const env of profile.environments) {
        const cell = renderCell(chart, profile, env);
        if (env.id === "baseline-utc-c") baselineDigest = cell.digest;
        rows.push({
          chart_path: entry.path,
          base_variant: entry.variant,
          chart: chart.ref,
          version: chart.version,
          flag_profile: profile.id,
          env_id: env.id,
          tz: env.tz,
          locale: env.locale,
          deterministic: String(cell.deterministic),
          digest: cell.digest ?? "",
          matches_baseline_env: env.id === "baseline-utc-c" ? "" : cell.deterministic && baselineDigest ? String(cell.digest === baselineDigest) : "",
          os: context.os,
          arch: context.arch,
          helm_version: context.helmVersion,
        });
        console.log(`${entry.path} ${profile.id} ${env.id}: ${cell.deterministic ? `deterministic ${cell.digest.slice(0, 12)}` : "NON-DETERMINISTIC"}`);
      }
    }
  }
  return rows;
}

function loadChart(entry) {
  const recipeRoot = join(repoRoot, "recipes", entry.path);
  check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at recipes/${entry.path}`);
  const sourceLock = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variantDir = join(recipeRoot, "variants", entry.variant);
  check(existsSync(join(variantDir, "variant.yaml")), `no base variant at recipes/${entry.path}/variants/${entry.variant}`);
  const variant = readYaml(join(variantDir, "variant.yaml"));
  const valuesProfile = join(variantDir, variant.spec?.valuesProfile ?? "../../effective-values.yaml");
  check(existsSync(valuesProfile), `no values profile at ${relativeRepo(valuesProfile)}`);
  const valuesDoc = readYaml(valuesProfile);
  let helmValuesFile = valuesProfile;
  if (valuesDoc?.kind === "EffectiveValues") {
    helmValuesFile = join(mkdtempSync(join(tmpdir(), "env-matrix-")), "values.yaml");
    writeYaml(helmValuesFile, valuesDoc.spec?.values ?? {});
  }
  const chart = {
    repository: sourceLock.spec.repositoryName,
    repositoryURL: sourceLock.spec.repositoryURL,
    ref: sourceLock.spec.ref ?? `${sourceLock.spec.repositoryName}/${sourceLock.spec.chart}`,
    version: String(sourceLock.spec.version),
    namespace: variant.spec?.namespace ?? "default",
    releaseName: variant.spec?.releaseName ?? sourceLock.spec.chart,
    helmValuesFile,
  };
  try {
    helmIn({ tz: "UTC", locale: "C" }, ["repo", "add", chart.repository, chart.repositoryURL]);
  } catch {
    /* repo may already exist */
  }
  return chart;
}

function renderCell(chart, profile, env) {
  const args = ["template", chart.releaseName, chart.ref, "--version", chart.version, "--namespace", chart.namespace, ...profile.flags, "--values", chart.helmValuesFile];
  const first = normalizeRelease(helmIn(env, args));
  const second = normalizeRelease(helmIn(env, args));
  if (first !== second) return { deterministic: false, digest: null };
  return { deterministic: true, digest: sha256(first) };
}

function helmIn(env, args) {
  return execFileSync("helm", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 200,
    env: { ...process.env, TZ: env.tz, LC_ALL: env.locale, LANG: env.locale },
  });
}

function runContext() {
  return {
    os: process.platform,
    arch: process.arch,
    helmVersion: helmIn({ tz: "UTC", locale: "C" }, ["version", "--template", "{{.Version}}"]).trim(),
  };
}

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function readMatrix() {
  check(existsSync(outputs.matrix), `${relativeRepo(outputs.matrix)} is missing; run npm run environment-matrix:record`);
  const [header, ...lines] = readFileSync(outputs.matrix, "utf8").trim().split("\n");
  const headers = header.split(",");
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function summary(rows) {
  const charts = [...new Set(rows.map((row) => row.chart_path))];
  const envCells = rows.filter((row) => row.flag_profile === "standard");
  const invariant = envCells.filter((row) => row.env_id !== "baseline-utc-c" && row.matches_baseline_env === "true").length;
  const variant = envCells.filter((row) => row.env_id !== "baseline-utc-c" && row.matches_baseline_env === "false").length;
  const nonDeterministic = rows.filter((row) => row.deterministic === "false");
  const context = rows[0] ?? {};

  const matrixTable = rows
    .map(
      (row) =>
        `| \`${row.chart_path}\` | \`${row.flag_profile}\` | \`${row.env_id}\` | ${row.tz} | ${row.locale} | ${row.deterministic === "true" ? "yes" : "**no**"} | ${row.digest ? `\`${row.digest.slice(0, 12)}\`` : "—"} | ${row.matches_baseline_env === "" ? "—" : row.matches_baseline_env === "true" ? "yes" : "**no**"} |`,
    )
    .join("\n");

  return `# Environment-Determinism Matrix

This generated report answers the environment-skew question with a recorded
matrix: the same chart, rendered under varied timezone and locale settings,
either produces byte-identical output or it does not — and either way the
matrix says so. Alternate flag profiles are rendered on the baseline
environment so their digests are recorded next to the standard profile's
(differences across flag profiles are expected; the recorded digest is what
ties a receipt to its exact profile).

## Current Status

| Metric | Value |
| --- | --- |
| Charts in corpus | ${charts.length} |
| Recorded cells | ${rows.length} |
| Env cells matching baseline (standard profile) | ${invariant} of ${invariant + variant} |
| Non-deterministic cells | ${nonDeterministic.length} |
| Platform recorded | ${context.os ?? "?"}/${context.arch ?? "?"}, helm ${context.helm_version ?? "?"} |

${
  variant === 0 && nonDeterministic.length === 0
    ? "Every recorded environment cell rendered byte-identically across the timezone and locale variations, and every cell rendered deterministically (twice, same bytes) within its environment."
    : "Some cells diverge; the rows below mark them. A divergent cell is a recorded fact about that chart and profile, not a hidden failure."
}

The corpus is the proof-grade chart set with pinned effective values. This
matrix does not claim environment invariance for charts outside it, for other
helm versions, or for other operating systems and architectures — those are
open columns, intended to ride on CI runners rather than bespoke local
infrastructure.

Colored rendering: [matrix.html](matrix.html) (open in a browser).

## Matrix

| Chart | Flag profile | Environment | TZ | Locale | Deterministic | Digest | Matches baseline env |
| --- | --- | --- | --- | --- | --- | --- | --- |
${matrixTable}

## Regenerate

~~~sh
npm run environment-matrix:record   # online: re-renders the corpus
npm run environment-matrix          # offline: summary from committed matrix
npm run environment-matrix:verify
~~~
`;
}


function htmlReport(rows) {
  const context = rows[0] ?? {};
  const variant = rows.filter((row) => row.matches_baseline_env === "false").length;
  const nonDeterministic = rows.filter((row) => row.deterministic === "false").length;
  const cell = (kind) =>
    kind === "yes" ? `<td class="s y">✓</td>` : kind === "no" ? `<td class="s n">✗</td>` : `<td class="s na">–</td>`;
  const body = rows
    .map((row) => {
      const det = cell(row.deterministic === "true" ? "yes" : row.deterministic === "false" ? "no" : "");
      const inv = cell(row.matches_baseline_env === "true" ? "yes" : row.matches_baseline_env === "false" ? "no" : "");
      return `<tr><td class="chart">${escapeHtml(row.chart_path)}</td><td>${escapeHtml(row.base_variant ?? "")}</td><td>${escapeHtml(row.flag_profile)}</td><td>${escapeHtml(row.env_id)}</td><td>${escapeHtml(row.tz)}</td><td>${escapeHtml(row.locale)}</td>${det}<td><code>${escapeHtml((row.digest ?? "").slice(0, 12))}</code></td>${inv}</tr>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Environment-Determinism Matrix</title>
<style>
body{font:13px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:24px;color:#202124}
h1{font-size:20px;margin:0 0 4px}
p.sub{color:#5f6368;margin:0 0 12px}
table{border-collapse:collapse;margin-top:16px;width:100%}
th,td{border:1px solid #dadce0;padding:3px 7px;text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:#f1f3f4;z-index:1}
td.chart{font-weight:600;white-space:nowrap}
td.s{text-align:center;font-weight:700;width:28px}
.y{background:#1e8e3e;color:#fff}
.n{background:#d93025;color:#fff}
.na{background:#fff;color:#9aa0a6}
</style>
</head>
<body>
<h1>Environment-Determinism Matrix</h1>
<p class="sub">${rows.length} recorded cells · ${nonDeterministic} non-deterministic · ${variant} env-variant vs baseline. Platform: ${escapeHtml(context.os ?? "?")}/${escapeHtml(context.arch ?? "?")}, helm ${escapeHtml(context.helm_version ?? "?")}. "Matches baseline" compares each cell digest to the UTC/C cell for the same chart and flag profile; baseline rows show –. Re-record with <code>npm run environment-matrix:record</code>.</p>
<table>
<thead><tr><th>Chart</th><th>Base</th><th>Flag profile</th><th>Environment</th><th>TZ</th><th>Locale</th><th>Deterministic</th><th>Digest</th><th>Matches baseline</th></tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
