import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mode = process.argv[2] ?? "--generate";

const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const scripts = packageJson.scripts ?? {};
const rows = Object.entries(scripts).map(([name, command], index) => describeScript(name, command, index + 1));
const summary = summarize(rows);
const csv = renderCsv(rows);
const markdown = renderMarkdown(summary);

if (mode === "--generate") {
  writeFileSync(join(repoRoot, "tests", "npm-script-catalog.csv"), csv);
  writeFileSync(join(repoRoot, "tests", "npm-script-catalog.md"), markdown);
  console.log(`wrote npm script catalog for ${rows.length} script(s)`);
} else if (mode === "--verify") {
  const currentCsv = readFileSync(join(repoRoot, "tests", "npm-script-catalog.csv"), "utf8");
  const currentMarkdown = readFileSync(join(repoRoot, "tests", "npm-script-catalog.md"), "utf8");
  check(currentCsv === csv, "tests/npm-script-catalog.csv is stale; run npm run npm-scripts:catalog");
  check(currentMarkdown === markdown, "tests/npm-script-catalog.md is stale; run npm run npm-scripts:catalog");
  console.log(`verified npm script catalog for ${rows.length} script(s)`);
} else {
  throw new Error(`unknown mode ${mode}`);
}

function describeScript(name, command, index) {
  const category = categorize(name);
  const mode = classifyMode(name, command);
  const externalState = classifyExternalState(name, command, mode);
  const writesFiles = classifyWritesFiles(name, command, mode);
  return {
    order: index,
    script: name,
    category,
    mode,
    writes_files: writesFiles,
    needs_external_state: externalState,
    why: why(category),
    how: how(name, category, mode, externalState),
  };
}

function categorize(name) {
  if (/^(redis|metrics-server|ingress-nginx|cert-manager|external-secrets|argo-cd|postgresql|rabbitmq|kube-prometheus-stack|loki|longhorn|mysql|grafana|vault|secrets-store-csi-driver|prometheus|mongodb|nginx|tempo|consul):/.test(name)) {
    if (name.includes("production-support")) return "production-support";
    if (name.includes("verify-install")) return "user-install-verification";
    if (name.includes("local-e2e")) return "local-live-evidence";
    if (name.includes("confighub-proof")) return "confighub-proof";
    return "top20-chart-proof";
  }
  if (name.startsWith("verify-install:") || name.startsWith("verify-bulk-ops:")) return "user-install-verification";
  if (name.startsWith("npm-scripts:")) return "repo-integrity";
  if (name.startsWith("top20:latest")) return "latest-version-refresh";
  if (name.startsWith("top20:local-e2e") || name.startsWith("top20:verify-local-e2e")) return "local-live-evidence";
  if (name.startsWith("top20:confighub-proof") || name.startsWith("top20:verify-confighub-proof")) return "confighub-proof";
  if (name.startsWith("top20:base-readiness")) return "catalog-readiness";
  if (name.startsWith("top100:") || name.startsWith("top500:") || name.startsWith("catalog:") || name.startsWith("chart-facts") || name.startsWith("completeness") || name.startsWith("variant-backlog") || name.startsWith("extension-slots") || name.startsWith("quirk") || name.startsWith("data:index") || name.startsWith("status:dashboard") || name.startsWith("site:")) return "catalog-data";
  if (name.startsWith("production:") || name.startsWith("scan-disposition") || name.startsWith("external-scan") || name.startsWith("image-digests") || name.startsWith("kps:") || name.startsWith("eso:production-support")) return "production-support";
  if (name.startsWith("runtime-gitops") || name.startsWith("live-parity") || name.startsWith("kind-parity")) return "live-parity-gitops";
  if (name.startsWith("helm-org:")) return "confighub-catalog-org";
  if (name.startsWith("ai-change-review:live:")) return "confighub-proof";
  if (name.startsWith("aicr-oci-roundtrip:")) return "confighub-proof";
  if (name.startsWith("aicr-variant-promotion:")) return "derived-variants";
  if (name.startsWith("hooks:") || name.startsWith("lifecycle:")) return "hook-lifecycle";
  if (name.startsWith("derived-variants") || name.startsWith("variant-goldens") || name.startsWith("variant-paths")) return "derived-variants";
  if (name.startsWith("next80:") || name.startsWith("adversarial10:")) return "scale-proof";
  if (name.startsWith("pain-points") || name.startsWith("claims") || name.startsWith("blast-radius") || name.startsWith("reverse-reconcile") || name.startsWith("helm-render-intents") || name.startsWith("edges") || name.startsWith("high-fanout") || name.startsWith("outcomes") || name.startsWith("attack-plan") || name.startsWith("next-ten")) return "evidence-workdown";
  if (name.startsWith("lane-tests:")) return "live-parity-gitops";
  if (name.startsWith("refresh:") || name.startsWith("legacy-patch:")) return "latest-version-refresh";
  if (name.startsWith("installer:") || name.startsWith("receipts:") || name.startsWith("p0:") || name.startsWith("docs:") || name.startsWith("knowledge:") || name.startsWith("verify") || name.startsWith("variant:command-surface")) return "repo-integrity";
  if (name === "pilot:switch-map" || name === "pilot:generate-variant") return "pilot-variant-model";
  if (name.startsWith("pilot:")) return "adversarial-live";
  if (name === "generate") return "catalog-data";
  return "other";
}

function classifyMode(name, command) {
  if (name === "verify") return "full-corpus-verify";
  if (name.endsWith(":verify") || name.includes(":verify-") || name.startsWith("verify") || command.includes("--verify")) return "verify";
  if (name.endsWith(":self-test") || command.includes("self-test")) return "self-test";
  if (command.includes("--summary") || name.endsWith(":summary")) return "summary";
  if (command.includes("--generate") || command.includes("--run") || command.includes("--promote") || name.includes("generate") || name === "generate") return "generate-or-run";
  return "run";
}

function classifyExternalState(name, command, mode) {
  if (name.includes("verify-install:cluster") || name.includes("verify-install:confighub") || name.startsWith("verify-bulk-ops:")) return "user-supplied-cluster-or-confighub";
  if (name.startsWith("helm-org:") && !name.endsWith(":plan") && !name.includes(":receipt:verify")) return "confighub-or-live-cluster";
  if (mode === "verify" || mode === "self-test" || mode === "full-corpus-verify") return "none-for-verify";
  if (name.includes("crd-upgrade-live") || name.includes("workload-upgrade-live")) return "local-kubernetes";
  if (name.includes("local-e2e") || name.startsWith("kind-parity") || command.includes("kubectl") || command.includes("kind")) return "local-kubernetes";
  if (name === "pilot:switch-map" || name === "pilot:generate-variant") return "network-or-helm-repo";
  if (name.includes("confighub-proof") || name.startsWith("runtime-gitops") || name.startsWith("live-parity") || name.startsWith("derived-variants:target-bound") || name.startsWith("external-scan") || name.startsWith("pilot:")) return "confighub-or-live-cluster";
  if (name.startsWith("top20:latest") || command.includes("helm pull") || command.includes("helm template")) return "network-or-helm-repo";
  return "none-for-verify";
}

function classifyWritesFiles(name, command, mode) {
  if (mode === "verify" || mode === "self-test" || mode === "full-corpus-verify") return "no";
  if (name.includes("verify-install") || name.startsWith("verify-bulk-ops:")) return ".tmp-receipts";
  if (mode === "summary") return "generated-summary";
  if (name.includes("crd-upgrade-live") || name.includes("workload-upgrade-live")) return "receipts-or-runs";
  if (name.includes("local-e2e") || name.startsWith("runtime-gitops") || name.startsWith("live-parity") || name.startsWith("kind-parity") || name.startsWith("lifecycle:") || name.startsWith("external-scan") || name.includes("confighub-proof")) return "receipts-or-runs";
  if (mode === "generate-or-run") return "generated-artifacts";
  return "maybe";
}

function why(category) {
  return {
    "top20-chart-proof": "Builds or checks one curated chart's recipe, package, render, and proof receipts.",
    "user-install-verification": "Lets a user check their own tutorial install or ConfigHub state against the catalog expectation.",
    "local-live-evidence": "Creates or verifies local Kubernetes observation receipts.",
    "confighub-proof": "Creates or verifies ConfigHub upload, scan, variant, and safe-operation receipts.",
    "confighub-catalog-org": "Plans, checks, or updates the live helm-catalog demonstration organization and its apply policy.",
    "latest-version-refresh": "Keeps newer upstream chart candidates separate from supported catalog versions until promotion evidence exists.",
    "catalog-readiness": "Explains which catalog bases are clean first paths and which need prerequisites or review.",
    "catalog-data": "Maintains generated catalog, top100/top500, site, and CSV front-door data.",
    "production-support": "Routes scan, image, lifecycle, and support decisions into target-scoped production evidence.",
    "live-parity-gitops": "Produces or verifies live Helm-vs-ConfigHub, two-cluster parity, or GitOps/OCI evidence.",
    "hook-lifecycle": "Tracks Helm hooks and hook-like controller behavior as lifecycle routes and receipts.",
    "derived-variants": "Checks post-render ConfigHub variant clone, link, target, and operation evidence.",
    "scale-proof": "Maintains adversarial and next80 proof corpus evidence.",
    "evidence-workdown": "Maintains claims, pain points, blast radius, graph, and workdown surfaces.",
    "repo-integrity": "Checks command surfaces, docs, artifacts, receipts, schemas, and broad corpus consistency.",
    "adversarial-live": "Runs adversarial live testing through the configured external harness.",
    "pilot-variant-model": "Builds or gates the agent-driven variant model: switch-effect maps classified by rendering, and generate-on-demand variants that must pass the parity gate to exist. Local helm renders only; no cluster or ConfigHub org.",
    other: "Unclassified helper; inspect package.json and the owning script before using it.",
  }[category];
}

function how(name, category, mode, externalState) {
  if (name === "verify") return "Run after scoped checks pass, before broad public review or a broad merge.";
  if (mode === "verify") return "Run when the files owned by this script changed, or before trusting the matching generated surface.";
  if (mode === "self-test") return "Run with the matching verifier to prove tamper detection still fails closed.";
  if (externalState !== "none-for-verify") return "Run only when the required cluster, ConfigHub org, Helm repo, or user tutorial state is available.";
  if (category === "catalog-data" || category === "evidence-workdown") return "Run the generate form to refresh files, then the verify form before committing.";
  return "Use the scoped command that matches the chart, lane, or generated surface you changed.";
}

function summarize(rows) {
  return {
    total: rows.length,
    byCategory: countBy(rows, "category"),
    byMode: countBy(rows, "mode"),
    byExternalState: countBy(rows, "needs_external_state"),
  };
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renderCsv(rows) {
  const headers = ["order", "script", "category", "mode", "writes_files", "needs_external_state", "why", "how"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function renderMarkdown(summary) {
  return `# NPM Script Catalog

This generated page summarizes the current \`package.json\` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

\`\`\`text
scripts: ${summary.total}
\`\`\`

## By Category

${renderCountTable(summary.byCategory, "Category")}

## By Mode

${renderCountTable(summary.byMode, "Mode")}

## By External State

${renderCountTable(summary.byExternalState, "External state")}

## Regenerate

\`\`\`sh
npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
\`\`\`
`;
}

function renderCountTable(rows, label) {
  return `| ${label} | Scripts |\n| --- | ---: |\n${rows.map(([key, count]) => `| \`${key}\` | ${count} |`).join("\n")}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}
