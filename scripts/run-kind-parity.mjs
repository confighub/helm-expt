import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const chartOption = optionValue("--chart");
const versionOption = optionValue("--version");
const baseOption = optionValue("--base");
const recipeOption = optionValue("--recipe");
const repoUrlOverride = optionValue("--repo-url");
const top20 = process.argv.includes("--top20");
const missingOnly = process.argv.includes("--missing");
const continueOnFail = process.argv.includes("--continue-on-fail");
const keep = process.argv.includes("--keep");

if (mode === "--run") {
  const selected = selectedTargets();
  for (const target of selected) runTarget(target);
  writeSummary();
} else if (mode === "--summary") {
  writeSummary();
} else if (mode === "--verify") {
  verifyReceipts();
} else {
  console.log(`Usage:
  npm run kind-parity:run -- --chart grafana/loki --version 7.0.0 --base single-binary-filesystem
  npm run kind-parity:run -- --chart bitnami/nginx --version 24.0.2 --base http-clusterip --repo-url oci://registry-1.docker.io/bitnamicharts
  npm run kind-parity:run -- --recipe recipes/grafana/loki/7.0.0 --base single-binary-filesystem
  npm run kind-parity:run -- --top20 --missing --continue-on-fail
  npm run kind-parity:summary
  npm run kind-parity:verify`);
}

function runTarget(target) {
  const resolved = resolveTarget(target);
  const rig = shortRigName(target);
  const out = receiptPath(target);
  mkdirSync(dirname(join(repoRoot, out)), { recursive: true });
  const command = [
    "python3", "tests/live-helm-installer-kind-parity-test",
    "--chart", target.chart,
    "--version", target.version,
    "--repo-url", resolved.repositoryURL,
    "--release", resolved.releaseName,
    "--namespace", resolved.namespace,
    "--package", resolved.packagePath,
    "--recipe", target.recipe,
    "--base", target.base,
    "--variant-revision", resolved.variantRevision,
    "--values", resolved.valuesPath,
    "--slug", target.slug,
    "--rig", rig,
    "--out", out,
  ];
  if (keep) command.push("--keep");
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 100,
  });
  if (result.status !== 0 && !continueOnFail) process.exit(result.status ?? 1);
}

function selectedTargets() {
  if (top20) {
    let selected = top20Targets();
    if (missingOnly) selected = selected.filter((target) => !existsSync(join(repoRoot, receiptPath(target))));
    check(selected.length >= 1, "no top20 variant parity targets selected");
    return selected;
  }
  if (recipeOption) {
    check(baseOption, "--base is required with --recipe");
    const target = targetFromRecipe(recipeOption, baseOption);
    return [target];
  }
  check(chartOption, "--chart is required");
  check(versionOption, "--version is required with --chart");
  check(baseOption, "--base is required with --chart");
  const target = targets().find((item) => item.chart === chartOption && item.version === versionOption && item.base === baseOption);
  check(Boolean(target), `no recipe variant found for ${chartOption}@${versionOption} base ${baseOption}`);
  return [target];
}

function top20Targets() {
  const csvPath = join(repoRoot, "data", "production-disposition", "top20.csv");
  check(existsSync(csvPath), "data/production-disposition/top20.csv not found");
  const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  const column = (row, name) => row[headers.indexOf(name)];
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = line.split(",");
    const chart = column(row, "chart");
    const version = column(row, "version");
    const recipe = column(row, "recipe_path");
    check(chart && version && recipe, `invalid top20 row: ${line}`);
    const variantsDir = join(repoRoot, recipe, "variants");
    check(existsSync(variantsDir), `${recipe}: variants directory not found`);
    for (const base of readdirSync(variantsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
      result.push(targetFromRecipe(recipe, base, chart, version));
    }
  }
  return result;
}

function targets() {
  const result = [];
  for (const artifactIndex of findArtifactIndexes(join(repoRoot, "recipes"))) {
    const recipeRoot = dirname(artifactIndex);
    const index = readYaml(artifactIndex);
    const chart = index.chart ?? index.spec?.chart?.ref ?? index.spec?.chart?.name;
    const version = index.version ?? index.spec?.chart?.version;
    if (!chart || !version) continue;
    const variantsDir = join(recipeRoot, "variants");
    if (!existsSync(variantsDir)) continue;
    for (const base of readdirSync(variantsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      result.push(targetFromRecipe(relativeRepo(recipeRoot), base, chart, version));
    }
  }
  return result;
}

function targetFromRecipe(recipe, base, chart = null, version = null) {
  const recipeRoot = join(repoRoot, recipe);
  const source = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variant = readYaml(join(recipeRoot, "variants", base, "variant.yaml"));
  const chartRef = chart ?? source.spec?.chartRef ?? source.spec?.chart ?? source.spec?.name;
  const versionRef = version ?? source.spec?.version;
  check(chartRef, `${recipe} missing chart ref`);
  check(versionRef, `${recipe} missing chart version`);
  const slug = chartRef.split("/").at(-1);
  return { chart: chartRef, version: versionRef, base, recipe, slug };
}

function resolveTarget(target) {
  const recipeRoot = join(repoRoot, target.recipe);
  const source = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variant = readYaml(join(recipeRoot, "variants", target.base, "variant.yaml"));
  const valuesProfile = variant.spec?.valuesProfile;
  check(valuesProfile, `${target.chart} ${target.base} missing valuesProfile`);
  return {
    repositoryURL: repoUrlOverride ?? source.spec?.repositoryURL,
    packagePath: `packages/${target.chart}/${target.version}`,
    valuesPath: normalizeRelative(target.recipe, "variants/" + target.base, valuesProfile),
    variantRevision: `${target.recipe}/revisions/${target.base}/r001/variant-revision.yaml`,
    namespace: variant.spec?.namespace ?? target.slug,
    releaseName: variant.spec?.releaseName ?? target.slug,
  };
}

function writeSummary() {
  const root = join(repoRoot, "data", "live-kind-parity");
  const rows = findReceipts().map((path) => {
    const receipt = readYaml(path);
    return {
      chart: receipt.spec?.chart,
      version: receipt.spec?.version,
      base: receipt.spec?.base,
      result: receipt.spec?.result,
      reason: classifyReceipt(receipt),
      receipt: relativeRepo(path),
    };
  }).sort((a, b) => `${a.chart}@${a.version}/${a.base}`.localeCompare(`${b.chart}@${b.version}/${b.base}`));
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  const nonPassRows = rows.filter((row) => row.result !== "pass");
  const semanticDefectRows = rows.filter((row) => row.reason.startsWith("parity:"));
  const reasonCounts = groupCount(nonPassRows, "reason");
  const md = `# Two-Cluster Helm-vs-Installer Kind Parity

This report tracks strict parity receipts that use two vanilla kind clusters:
regular Helm on one cluster and \`cub installer\` render/apply on the other.

It is the cleanest live check for the narrow parity question:

\`\`\`text
Under the same chart, version, values, and base variant, does regular Helm reach
the same live outcome as cub installer output?
\`\`\`

\`\`\`text
pass: ${counts.get("pass") ?? 0}
watch: ${counts.get("watch") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
semantic parity defects: ${semanticDefectRows.length}
\`\`\`

Non-pass rows are still useful when object parity passed. They usually point at
target prerequisites, controller readiness, storage, hooks, or operating policy.
Use the rerun plan for the next command and expected remediation:

\`\`\`text
data/live-parity-rerun-plan/summary.md
\`\`\`

## Non-Pass By Reason

| Reason | Rows |
| --- | ---: |
${reasonCounts.size ? mapRows(reasonCounts) : "| - | 0 |"}

## Rows

| Chart | Base | Result | Reason | Receipt |
| --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.reason} | ${row.receipt} |`).join("\n")}
`;
  write(join(root, "summary.md"), md);
  write(join(root, "summary.csv"), toCsv(rows));
  console.log(`wrote ${relativeRepo(join(root, "summary.md"))}`);
}

function classifyReceipt(receipt) {
  const spec = receipt.spec ?? {};
  if (spec.result === "pass") return "";

  const semantic = spec.semanticComparison?.helmVsCubInstallerApply;
  const semanticDiffs = semantic?.semanticDiffs ?? [];
  const semanticPassed = semantic?.result === "pass";
  const semanticFailed = semantic?.result === "blocked" || semanticDiffs.length > 0;
  if (semanticFailed) return "parity: semantic object diff";

  const text = JSON.stringify(spec).toLowerCase();
  const paritySuffix = semanticPassed ? " (parity passed)" : "";
  if (text.includes("no matches for kind") || text.includes("ensure crds are installed first") || text.includes("resource mapping not found")) {
    return `target-prerequisite: CRDs missing${paritySuffix}`;
  }
  if (spec.base === "no-crds" && text.includes("crashloopbackoff")) {
    return `target-prerequisite: CRDs disabled or missing${paritySuffix}`;
  }
  if (text.includes("startupapicheck") || text.includes("failed post-install")) {
    return `helm-hook: post-install hook failed${paritySuffix}`;
  }
  if (text.includes("crashloopbackoff")) return `target-runtime: pod crash loop${paritySuffix}`;
  if (text.includes("pending")) return `target-runtime: pods pending${paritySuffix}`;
  if (text.includes("available: 0/1") || text.includes("ready: 0/1") || text.includes('"ready":"0/1"') || text.includes("context deadline exceeded")) {
    return `helm-runtime: upstream not ready${paritySuffix}`;
  }
  if (spec.result === "watch") return semanticPassed ? "watch: object parity passed; readiness needs review" : "watch: inspect receipt";
  return "blocked: inspect receipt";
}

function verifyReceipts() {
  const receipts = findReceipts();
  check(receipts.length >= 1, "expected at least one two-cluster kind parity receipt");
  for (const path of receipts) {
    const receipt = readYaml(path);
    const context = relativeRepo(path);
    check(receipt.kind === "LiveHelmInstallerKindParityReceipt", `${context}: kind mismatch`);
    check(receipt.spec?.run?.mode === "two-vanilla-kind-clusters", `${context}: mode mismatch`);
    check(["pass", "watch", "blocked"].includes(receipt.spec?.result), `${context}: invalid result`);
    const preInstallBlocked = receipt.spec?.result === "blocked" && Boolean(receipt.spec?.failure);
    if (!preInstallBlocked) {
      check(receipt.spec?.legs?.regularHelm, `${context}: missing regularHelm leg`);
      check(receipt.spec?.legs?.cubInstallerApply, `${context}: missing cubInstallerApply leg`);
      check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply, `${context}: missing semantic comparison`);
    }
    if (receipt.spec?.run?.cleanup?.result !== "retained") {
      check(receipt.spec?.run?.cleanup?.result === "pass", `${context}: cleanup must pass for non-retained parity clusters`);
    }
  }
  console.log(`verified ${receipts.length} two-cluster kind parity receipt(s)`);
}

function findReceipts() {
  const root = join(repoRoot, "runs", "live-kind-parity");
  if (!existsSync(root)) return [];
  return findFiles(root, "receipt.yaml").sort();
}

function findArtifactIndexes(root) {
  return findFiles(root, "artifact-index.yaml");
}

function findFiles(root, filename) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...findFiles(path, filename));
    else if (entry.isFile() && entry.name === filename) result.push(path);
  }
  return result;
}

function normalizeRelative(recipe, variantDir, reference) {
  if (reference.startsWith("/")) return reference;
  return relativeRepo(join(repoRoot, recipe, variantDir, reference));
}

function receiptPath(target) {
  return `runs/live-kind-parity/${target.chart.replaceAll("/", "-")}-${target.base}/receipt.yaml`;
}

function uniqueRunSuffix() {
  return Date.now().toString(36).slice(-4);
}

function shortRigName(target) {
  const slug = target.slug.replaceAll(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6) || "chart";
  const hash = createHash("sha1").update(`${target.chart}@${target.version}/${target.base}`).digest("hex").slice(0, 5);
  return `hx-${slug}-${hash}-${uniqueRunSuffix()}`;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function toCsv(rows) {
  const headers = ["chart", "version", "base", "result", "reason", "receipt"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function groupCount(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = row[key] || "-";
    result.set(value, (result.get(value) ?? 0) + 1);
  }
  return result;
}

function mapRows(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `| ${key} | ${value} |`)
    .join("\n");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
