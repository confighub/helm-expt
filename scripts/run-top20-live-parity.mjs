import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const selectedSlug = optionValue("--chart");
const selectedFromRank = numberOption("--from-rank");
const selectedToRank = numberOption("--to-rank");
const continueOnFail = process.argv.includes("--continue-on-fail");
const keep = process.argv.includes("--keep");

const targets = [
  { rank: 1, slug: "redis", chart: "bitnami/redis", version: "25.5.3", namespace: "redis", variant: "default", recipe: "recipes/bitnami/redis/25.5.3" },
  { rank: 2, slug: "metrics-server", chart: "metrics-server/metrics-server", version: "3.13.0", namespace: "kube-system", variant: "default", recipe: "recipes/metrics-server/metrics-server/3.13.0" },
  { rank: 3, slug: "ingress-nginx", chart: "ingress-nginx/ingress-nginx", version: "4.15.1", namespace: "ingress-nginx", variant: "admission-disabled", recipe: "recipes/ingress-nginx/ingress-nginx/4.15.1" },
  { rank: 4, slug: "cert-manager", chart: "jetstack/cert-manager", version: "v1.20.2", namespace: "cert-manager", variant: "crds-enabled", recipe: "recipes/jetstack/cert-manager/v1.20.2" },
  { rank: 5, slug: "external-secrets", chart: "external-secrets/external-secrets", version: "2.5.0", namespace: "external-secrets", variant: "default", recipe: "recipes/external-secrets/external-secrets/2.5.0" },
  { rank: 6, slug: "argo-cd", chart: "argo-cd/argo-cd", version: "9.5.15", namespace: "argocd", variant: "default", recipe: "recipes/argo-cd/argo-cd/9.5.15" },
  { rank: 7, slug: "kube-prometheus-stack", chart: "prometheus-community/kube-prometheus-stack", version: "85.3.3", namespace: "monitoring", variant: "default", recipe: "recipes/prometheus-community/kube-prometheus-stack/85.3.3" },
  { rank: 8, slug: "postgresql", chart: "bitnami/postgresql", version: "18.6.7", namespace: "postgresql", variant: "generated-passwords", recipe: "recipes/bitnami/postgresql/18.6.7" },
  { rank: 9, slug: "rabbitmq", chart: "bitnami/rabbitmq", version: "16.0.14", namespace: "rabbitmq", variant: "generated-passwords", recipe: "recipes/bitnami/rabbitmq/16.0.14" },
  { rank: 10, slug: "loki", chart: "grafana/loki", version: "7.0.0", namespace: "loki", variant: "single-binary-filesystem", recipe: "recipes/grafana/loki/7.0.0" },
  { rank: 11, slug: "longhorn", chart: "longhorn/longhorn", version: "1.11.2", namespace: "longhorn-system", variant: "default", recipe: "recipes/longhorn/longhorn/1.11.2" },
  { rank: 12, slug: "vault", chart: "hashicorp/vault", version: "0.32.0", namespace: "vault", variant: "default", recipe: "recipes/hashicorp/vault/0.32.0" },
  { rank: 13, slug: "secrets-store-csi-driver", chart: "secrets-store-csi-driver/secrets-store-csi-driver", version: "1.6.0", namespace: "kube-system", variant: "default", recipe: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0" },
  { rank: 14, slug: "prometheus", chart: "prometheus-community/prometheus", version: "29.8.0", namespace: "monitoring", variant: "server-only-ephemeral", recipe: "recipes/prometheus-community/prometheus/29.8.0" },
  { rank: 15, slug: "grafana", chart: "grafana/grafana", version: "10.5.15", namespace: "grafana", variant: "generated-passwords", recipe: "recipes/grafana/grafana/10.5.15" },
  { rank: 16, slug: "mysql", chart: "bitnami/mysql", version: "14.0.3", namespace: "mysql", variant: "generated-passwords", recipe: "recipes/bitnami/mysql/14.0.3" },
  { rank: 17, slug: "mongodb", chart: "bitnami/mongodb", version: "19.0.7", namespace: "mongodb", variant: "generated-passwords", recipe: "recipes/bitnami/mongodb/19.0.7" },
  { rank: 18, slug: "nginx", chart: "bitnami/nginx", version: "24.0.2", namespace: "nginx", variant: "http-clusterip", recipe: "recipes/bitnami/nginx/24.0.2" },
  { rank: 19, slug: "tempo", chart: "grafana/tempo", version: "1.24.4", namespace: "tempo", variant: "local-persistent", recipe: "recipes/grafana/tempo/1.24.4" },
  { rank: 20, slug: "consul", chart: "hashicorp/consul", version: "2.0.0", namespace: "consul", variant: "default-control-plane", recipe: "recipes/hashicorp/consul/2.0.0" },
];

if (mode === "--run") {
  const selected = selectedTargets();
  for (const target of selected) runTarget(target);
  writeSummary();
} else if (mode === "--summary") {
  writeSummary();
} else if (mode === "--verify") {
  verifyExpectedReceipts();
} else {
  console.log(`Usage:
  node scripts/run-top20-live-parity.mjs --run --chart metrics-server
  node scripts/run-top20-live-parity.mjs --run --from-rank 2 --to-rank 5 --continue-on-fail
  node scripts/run-top20-live-parity.mjs --run --all --continue-on-fail
  node scripts/run-top20-live-parity.mjs --summary
  node scripts/run-top20-live-parity.mjs --verify`);
}

function runTarget(target) {
  const resolved = resolveTarget(target);
  const rig = `helm-expt-parity-${rigSlug(target.slug)}-${uniqueRunSuffix()}`;
  const out = receiptPath(target);
  mkdirSync(dirname(join(repoRoot, out)), { recursive: true });
  const command = [
    "python3", "tests/live-helm-confighub-parity-test",
    "--chart", target.chart,
    "--version", target.version,
    "--repo-url", resolved.repositoryURL,
    "--release", releaseName(target),
    "--namespace", target.namespace,
    "--package", resolved.packagePath,
    "--recipe", target.recipe,
    "--base", target.variant,
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

function uniqueRunSuffix() {
  return `${Date.now().toString(36)}-${process.pid.toString(36)}`;
}

function rigSlug(slug) {
  const compact = slug.replaceAll("-", "");
  if (compact.length <= 18) return compact;
  const hash = createHash("sha1").update(slug).digest("hex").slice(0, 5);
  return `${compact.slice(0, 13)}${hash}`;
}

function verifyExpectedReceipts() {
  const selected = selectedTargets({ requireAllByDefault: true });
  for (const target of selected) {
    const path = join(repoRoot, receiptPath(target));
    check(existsSync(path), `${relativeRepo(path)} is missing`);
    const receipt = readYaml(path);
    check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${relativeRepo(path)} kind mismatch`);
    check(receipt.spec?.chart === target.chart, `${relativeRepo(path)} chart mismatch`);
    check(receipt.spec?.version === target.version, `${relativeRepo(path)} version mismatch`);
    check(receipt.spec?.base === target.variant, `${relativeRepo(path)} base mismatch`);
    check(["pass", "watch", "blocked"].includes(receipt.spec?.result), `${relativeRepo(path)} invalid result`);
  }
  console.log(`verified ${selected.length} expected top-20 live parity receipt slot(s)`);
}

function writeSummary() {
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    const receipt = existsSync(path) ? readYaml(path) : null;
    return {
      rank: target.rank,
      chart: target.chart,
      version: target.version,
      variant: target.variant,
      result: receipt?.spec?.result ?? "not-started",
      receipt: existsSync(path) ? receiptPath(target) : "",
    };
  });
  const pass = rows.filter((row) => row.result === "pass").length;
  const watch = rows.filter((row) => row.result === "watch").length;
  const blocked = rows.filter((row) => row.result === "blocked").length;
  const notStarted = rows.filter((row) => row.result === "not-started").length;
  const root = join(repoRoot, "data", "live-helm-confighub-compare");
  const csv = toCsv(rows);
  const md = `# Live Helm-vs-ConfigHub Parity

This report tracks the strict live comparison lane for the selected top-20
chart/base rows. Each completed row has a receipt under
\`runs/live-helm-confighub-compare/\`.

\`\`\`text
pass: ${pass}
watch: ${watch}
blocked: ${blocked}
not-started: ${notStarted}
\`\`\`

| Rank | Chart | Base | Result | Receipt |
| ---: | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}@${row.version}\` | ${row.variant} | ${row.result} | ${row.receipt || "-"} |`).join("\n")}
`;
  write(join(root, "summary.csv"), csv);
  write(join(root, "summary.md"), md);
  console.log(`wrote ${relativeRepo(join(root, "summary.md"))}`);
}

function resolveTarget(target) {
  const recipeRoot = join(repoRoot, target.recipe);
  const source = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variant = readYaml(join(recipeRoot, "variants", target.variant, "variant.yaml"));
  const valuesProfile = variant.spec?.valuesProfile;
  check(valuesProfile, `${target.chart} ${target.variant} missing valuesProfile`);
  return {
    repositoryURL: source.spec?.repositoryURL,
    packagePath: `packages/${target.chart}/${target.version}`,
    valuesPath: normalizeRelative(target.recipe, "variants/" + target.variant, valuesProfile),
    variantRevision: `${target.recipe}/revisions/${target.variant}/r001/variant-revision.yaml`,
  };
}

function normalizeRelative(recipe, variantDir, reference) {
  if (reference.startsWith("/")) return reference;
  const base = join(repoRoot, recipe, variantDir, reference);
  return relativeRepo(base);
}

function releaseName(target) {
  const variant = readYaml(join(repoRoot, target.recipe, "variants", target.variant, "variant.yaml"));
  return variant.spec?.releaseName ?? target.slug;
}

function receiptPath(target) {
  return `runs/live-helm-confighub-compare/${target.chart.replaceAll("/", "-")}-${target.variant}/receipt.yaml`;
}

function selectedTargets({ requireAllByDefault = false } = {}) {
  if (process.argv.includes("--all")) return targets;
  if (selectedSlug) {
    const target = targets.find((item) => item.slug === selectedSlug);
    check(Boolean(target), `unknown live parity chart ${selectedSlug}`);
    return [target];
  }
  let selected = targets;
  if (selectedFromRank !== null) selected = selected.filter((target) => target.rank >= selectedFromRank);
  if (selectedToRank !== null) selected = selected.filter((target) => target.rank <= selectedToRank);
  if (selectedFromRank !== null || selectedToRank !== null) return selected;
  if (requireAllByDefault) return targets;
  return targets.filter((target) => existsSync(join(repoRoot, receiptPath(target))));
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}

function numberOption(name) {
  const value = optionValue(name);
  return value === null ? null : Number(value);
}

function toCsv(rows) {
  const headers = ["rank", "chart", "version", "variant", "result", "receipt"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
