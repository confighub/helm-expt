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
const latestCandidates = process.argv.includes("--latest-candidates");
const missingOnly = process.argv.includes("--missing");
const continueOnFail = process.argv.includes("--continue-on-fail");
const keep = process.argv.includes("--keep");
const allBases = process.argv.includes("--all-bases");

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
  npm run kind-parity:run -- --latest-candidates --chart nginx --continue-on-fail
  npm run kind-parity:summary -- --latest-candidates
  npm run kind-parity:verify -- --latest-candidates --chart nginx
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
  if (latestCandidates) {
    check(!top20, "--latest-candidates cannot be combined with --top20");
    let selected = latestCandidateTargets();
    if (chartOption) selected = selected.filter((target) => matchesChart(target, chartOption));
    if (baseOption) selected = selected.filter((target) => target.base === baseOption);
    if (missingOnly) selected = selected.filter((target) => !existsSync(join(repoRoot, receiptPath(target))));
    check(selected.length >= 1, "no latest-candidate parity targets selected");
    return selected;
  }
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

function latestCandidateTargets() {
  const csvPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
  check(existsSync(csvPath), "data/latest-top20-refresh/promotion-readiness.csv not found");
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  const result = [];
  for (const row of rows) {
    const variants = splitList(row.variants);
    const selectedBases = allBases ? variants : [primaryLatestCandidateBase(row)];
    for (const base of selectedBases) {
      check(variants.includes(base), `${row.chart}@${row.candidate_version}: base ${base} is not a candidate variant`);
      const pathKey = `${slug(row.chart)}-${row.candidate_version}`;
      result.push({
        chart: row.chart,
        version: row.candidate_version,
        base,
        recipe: row.candidate_recipe,
        packagePath: row.candidate_package,
        slug: slug(row.chart),
        receiptPath: `runs/latest-top20-refresh/${pathKey}/live-parity/${base}/receipt.yaml`,
      });
    }
  }
  return result;
}

function primaryLatestCandidateBase(row) {
  const primaryByChart = new Map([
    ["argo-cd/argo-cd", "default"],
    ["bitnami/mongodb", "generated-passwords"],
    ["bitnami/nginx", "http-clusterip"],
    ["bitnami/postgresql", "generated-passwords"],
    ["bitnami/redis", "default"],
    ["prometheus-community/kube-prometheus-stack", "default"],
    ["prometheus-community/prometheus", "server-only-ephemeral"],
  ]);
  const base = primaryByChart.get(row.chart);
  check(base, `no primary latest-candidate base configured for ${row.chart}`);
  return base;
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
  const sourceChart = source.spec?.chartRef ?? source.spec?.chart ?? source.spec?.name;
  const chartRef = chart ?? (sourceChart?.includes("/") ? sourceChart : [source.spec?.repositoryName, sourceChart].filter(Boolean).join("/"));
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
    packagePath: target.packagePath ?? `packages/${target.chart}/${target.version}`,
    valuesPath: normalizeRelative(target.recipe, "variants/" + target.base, valuesProfile),
    variantRevision: `${target.recipe}/revisions/${target.base}/r001/variant-revision.yaml`,
    namespace: variant.spec?.namespace ?? target.slug,
    releaseName: variant.spec?.releaseName ?? target.slug,
  };
}

function writeSummary() {
  if (latestCandidates) return writeLatestCandidateSummary();
  const root = join(repoRoot, "data", "live-kind-parity");
  const lifecycleEvidence = lifecycleEvidenceMap();
  const rows = findReceipts()
    .map((path) => summaryRowForReceipt(path, lifecycleEvidence))
    .sort((a, b) => `${a.chart}@${a.version}/${a.base}`.localeCompare(`${b.chart}@${b.version}/${b.base}`));
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  const nonPassRows = rows.filter((row) => row.result !== "pass");
  const semanticPassRows = rows.filter((row) => row.semantic_parity === "pass");
  const semanticDefectRows = rows.filter((row) => row.semantic_parity === "defect");
  const nonPassSemanticPassRows = nonPassRows.filter((row) => row.semantic_parity === "pass");
  const nonPassLifecycleRows = nonPassRows.filter((row) => row.related_lifecycle_evidence);
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
semantic parity pass: ${semanticPassRows.length}
semantic parity defects: ${semanticDefectRows.length}
non-pass rows where semantic parity passed: ${nonPassSemanticPassRows.length}
non-pass rows with related lifecycle evidence: ${nonPassLifecycleRows.length}
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

## How To Read Non-Pass Rows

The \`result\` column records the overall live command outcome. The
\`semantic_parity\` column records whether regular Helm and \`cub installer\`
produced the same Kubernetes object meaning. A non-pass row with
\`semantic_parity=pass\` is not an object parity defect. It means the row
exposed target, runtime, or lifecycle behavior that needs a route, observation,
or support decision.

The \`related_lifecycle_evidence\` column links a separate lifecycle receipt
when one exists. If a future row is non-pass while \`semantic_parity=pass\`,
read it as a target, runtime, or lifecycle route to investigate before making a
broader support claim.

## Rows

| Chart | Base | Result | Semantic parity | Reason | Lifecycle evidence | Meaning | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.semantic_parity} | ${row.reason} | ${row.related_lifecycle_evidence || ""} | ${row.meaning} | ${row.receipt} |`).join("\n")}
`;
  write(join(root, "summary.md"), md);
  write(join(root, "summary.csv"), toCsv(rows));
  console.log(`wrote ${relativeRepo(join(root, "summary.md"))}`);
}

function summaryRowForReceipt(path, lifecycleEvidence) {
  const receipt = readYaml(path);
  const reason = classifyReceipt(receipt);
  const semanticParity = semanticParityFor(receipt);
  const relatedLifecycleEvidence = relatedLifecycleEvidenceFor(receipt, lifecycleEvidence);
  const row = {
    chart: receipt.spec?.chart,
    version: receipt.spec?.version,
    base: receipt.spec?.base,
    result: receipt.spec?.result,
    semantic_parity: semanticParity,
    reason,
    related_lifecycle_evidence: relatedLifecycleEvidence,
    receipt: relativeRepo(path),
  };
  return { ...row, meaning: meaningFor(row) };
}

function semanticParityFor(receipt) {
  const semantic = receipt.spec?.semanticComparison?.helmVsCubInstallerApply;
  const semanticDiffs = semantic?.semanticDiffs ?? [];
  if (semantic?.result === "pass" && semanticDiffs.length === 0) return "pass";
  if (semantic?.result === "blocked" || semanticDiffs.length > 0) return "defect";
  return "unknown";
}

function lifecycleEvidenceMap() {
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return new Map();
  const rows = parseCsv(readFileSync(path, "utf8"));
  return new Map(rows.map((row) => [`${row.chart}|${row.version}|${row.base}`, row]));
}

function relatedLifecycleEvidenceFor(receipt, lifecycleEvidence) {
  const spec = receipt.spec ?? {};
  const row = lifecycleEvidence.get(`${spec.chart}|${spec.version}|${spec.base}`);
  if (!row) return "";
  return `${row.result}: ${row.receipt}`;
}

function meaningFor(row) {
  if (row.result === "pass") return "live parity passed";
  if (row.semantic_parity === "defect") return "semantic object parity defect";
  if (row.reason?.startsWith("render-input:")) {
    return "semantic parity passed; required render inputs need a modeled base";
  }
  if (row.semantic_parity === "pass" && row.related_lifecycle_evidence) {
    return "semantic parity passed; lifecycle route has evidence";
  }
  if (row.semantic_parity === "pass") return "semantic parity passed; target or lifecycle behavior needs review";
  return "inspect receipt";
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
  if (
    text.includes("you must specify values for either") &&
    (text.includes("autodiscovery") || text.includes("autoscalinggroups"))
  ) {
    return `render-input: required Helm values missing${paritySuffix}`;
  }
  if (text.includes("no matches for kind") || text.includes("ensure crds are installed first") || text.includes("resource mapping not found")) {
    return `target-prerequisite: CRDs missing${paritySuffix}`;
  }
  if (spec.base === "no-crds" && text.includes("crashloopbackoff")) {
    return `target-prerequisite: CRDs disabled or missing${paritySuffix}`;
  }
  if (text.includes("startupapicheck") || text.includes("failed post-install")) {
    return `helm-hook: post-install hook failed${paritySuffix}`;
  }
  if (
    (text.includes("missing-required-secret") || text.includes("mountvolume.setup failed")) &&
    text.includes("secret") &&
    text.includes("not found")
  ) {
    return `target-prerequisite: required Secret missing${paritySuffix}`;
  }
  if (text.includes("namespace") && text.includes("not found")) {
    return `target-prerequisite: required Namespace missing${paritySuffix}`;
  }
  if (
    spec.chart === "ingress-nginx/ingress-nginx"
    && text.includes("ingress-nginx-admission")
    && text.includes("not found")
  ) {
    return `helm-hook: admission webhook certificate secret not supplied by config-only apply${paritySuffix}`;
  }
  if (spec.chart === "grafana/tempo" && spec.base === "s3-query-observability" && text.includes("crashloopbackoff")) {
    return `target-prerequisite: object store endpoint not satisfied${paritySuffix}`;
  }
  if (
    spec.chart === "metrics-server/metrics-server"
    && spec.base === "external-tls-ca"
    && (text.includes("available: 0/1") || text.includes("ready: 0/1") || text.includes('"ready":"0/1"'))
  ) {
    return `target-prerequisite: serving certificate and APIService trust not satisfied${paritySuffix}`;
  }
  if (spec.chart === "hashicorp/consul" && spec.base === "secure-mesh-existing-secrets" && text.includes("pending")) {
    return `target-fit: secure mesh target topology not satisfied${paritySuffix}`;
  }
  if (spec.chart === "hashicorp/vault" && spec.base === "ha-raft-ui" && text.includes("pending")) {
    return `target-fit: HA raft target topology not satisfied${paritySuffix}`;
  }
  if (
    spec.chart === "hashicorp/vault"
    && text.includes("vault-0")
    && (text.includes("ready: 0/1") || text.includes('"ready":"0/1"'))
  ) {
    return `operate-policy: Vault init/unseal required${paritySuffix}`;
  }
  if (spec.legs?.regularHelm?.result === "pass" && spec.legs?.cubInstallerApply?.result === "watch") {
    return `target-runtime: installer-applied workload not ready at observation cutoff${paritySuffix}`;
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
  if (latestCandidates) return verifyLatestCandidateReceipts();
  const receipts = findReceipts();
  check(receipts.length >= 1, "expected at least one two-cluster kind parity receipt");
  for (const path of receipts) verifyReceipt(path);
  console.log(`verified ${receipts.length} two-cluster kind parity receipt(s)`);
}

function verifyLatestCandidateReceipts() {
  const selected = selectedTargets();
  for (const target of selected) {
    const path = join(repoRoot, receiptPath(target));
    check(existsSync(path), `${relativeRepo(path)} is missing`);
    verifyReceipt(path);
  }
  console.log(`verified ${selected.length} latest-candidate two-cluster kind parity receipt(s)`);
}

function verifyReceipt(path) {
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
    verifyAPIServiceObservation(receipt.spec.legs.regularHelm, `${context}: regularHelm`);
    verifyAPIServiceObservation(receipt.spec.legs.cubInstallerApply, `${context}: cubInstallerApply`);
  }
  if (receipt.spec?.run?.cleanup?.result !== "retained") {
    check(receipt.spec?.run?.cleanup?.result === "pass", `${context}: cleanup must pass for non-retained parity clusters`);
  }
}

function verifyAPIServiceObservation(leg, context) {
  const apiServices = leg?.runtime?.apiServices;
  if (!apiServices) return;
  check(["pass", "watch"].includes(apiServices.result), `${context}: APIService observation result must be pass or watch`);
  check(Array.isArray(apiServices.items), `${context}: APIService observation items must be an array`);
  for (const item of apiServices.items) {
    check(Boolean(item.name), `${context}: APIService observation missing name`);
    check(Boolean(item.group), `${context}: APIService observation missing group`);
    check(Boolean(item.version), `${context}: APIService observation missing version`);
    check(String(item.queryPath ?? "").startsWith(`/apis/${item.group}/${item.version}`), `${context}: APIService query path mismatch for ${item.name}`);
    check(["pass", "watch"].includes(item.result), `${context}: APIService ${item.name} result must be pass or watch`);
    check(["pass", "watch"].includes(item.queryResult), `${context}: APIService ${item.name} queryResult must be pass or watch`);
    if (item.result === "pass") {
      check(item.available === true, `${context}: APIService ${item.name} pass requires available=true`);
      check(item.conditionStatus === "True", `${context}: APIService ${item.name} pass requires conditionStatus=True`);
      check(item.queryResult === "pass", `${context}: APIService ${item.name} pass requires queryResult=pass`);
      check(/^[a-f0-9]{64}$/.test(item.querySHA256 ?? ""), `${context}: APIService ${item.name} pass requires querySHA256`);
    }
  }
}

function writeLatestCandidateSummary() {
  const root = join(repoRoot, "data", "latest-top20-refresh", "live-parity");
  const lifecycleEvidence = lifecycleEvidenceMap();
  const rows = latestCandidateTargets().map((target) => {
    const path = join(repoRoot, receiptPath(target));
    if (!existsSync(path)) {
      return {
        chart: target.chart,
        version: target.version,
        base: target.base,
        result: "not-started",
        semantic_parity: "unknown",
        reason: "candidate live parity not run",
        related_lifecycle_evidence: "",
        meaning: "candidate parity not run",
        receipt: receiptPath(target),
      };
    }
    return summaryRowForReceipt(path, lifecycleEvidence);
  }).sort((a, b) => `${a.chart}@${a.version}/${a.base}`.localeCompare(`${b.chart}@${b.version}/${b.base}`));
  const counts = new Map();
  for (const row of rows) counts.set(row.result, (counts.get(row.result) ?? 0) + 1);
  const nonPassRows = rows.filter((row) => row.result !== "pass");
  const semanticDefectRows = rows.filter((row) => row.semantic_parity === "defect");
  const reasonCounts = groupCount(nonPassRows, "reason");
  const md = `# Latest Candidate Two-Cluster Helm-vs-Installer Kind Parity

This report tracks the latest-version candidate parity lane. It uses two
vanilla kind clusters per candidate: regular Helm on one cluster and
\`cub installer\` render/apply on the other.

It does not promote candidate versions. It records whether a candidate has
started the same strict parity lane used by the supported catalog versions.

\`\`\`text
pass: ${counts.get("pass") ?? 0}
watch: ${counts.get("watch") ?? 0}
blocked: ${counts.get("blocked") ?? 0}
not-started: ${counts.get("not-started") ?? 0}
semantic parity defects: ${semanticDefectRows.length}
\`\`\`

## Non-Pass By Reason

| Reason | Rows |
| --- | ---: |
${reasonCounts.size ? mapRows(reasonCounts) : "| - | 0 |"}

## Rows

| Chart | Base | Result | Semantic parity | Reason | Lifecycle evidence | Meaning | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.base} | ${row.result} | ${row.semantic_parity} | ${row.reason} | ${row.related_lifecycle_evidence || ""} | ${row.meaning} | ${row.receipt} |`).join("\n")}
`;
  write(join(root, "summary.md"), md);
  write(join(root, "summary.csv"), toCsv(rows));
  console.log(`wrote ${relativeRepo(join(root, "summary.md"))}`);
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
  if (target.receiptPath) return target.receiptPath;
  return `runs/live-kind-parity/${target.chart.replaceAll("/", "-")}-${target.base}/receipt.yaml`;
}

function matchesChart(target, value) {
  return [target.chart, target.slug, target.chart.split("/").at(-1)].includes(value);
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
  const headers = ["chart", "version", "base", "result", "semantic_parity", "reason", "related_lifecycle_evidence", "meaning", "receipt"];
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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slug(chart) {
  return chart.split("/").at(-1).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}
