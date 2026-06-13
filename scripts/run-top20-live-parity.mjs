import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const wantsHelp = process.argv.includes("--help") || process.argv.includes("-h");
const wantsPreflight = process.argv.includes("--preflight");
const selectedSlug = optionValue("--chart");
const selectedBase = optionValue("--base");
const selectedFromRank = numberOption("--from-rank");
const selectedToRank = numberOption("--to-rank");
const repoUrlOverride = optionValue("--repo-url");
const targetProfile = optionValue("--target-profile");
const gitopsCanonicalizationProfile = optionValue("--gitops-canonicalization-profile");
const continueOnFail = process.argv.includes("--continue-on-fail");
const keep = process.argv.includes("--keep");

const targets = [
  { rank: 1, slug: "redis", chart: "bitnami/redis", version: "25.5.3", namespace: "redis", variant: "default", recipe: "recipes/bitnami/redis/25.5.3" },
  { rank: 2, slug: "metrics-server", chart: "metrics-server/metrics-server", version: "3.13.0", namespace: "kube-system", variant: "default", recipe: "recipes/metrics-server/metrics-server/3.13.0" },
  { rank: 3, slug: "ingress-nginx", chart: "ingress-nginx/ingress-nginx", version: "4.15.1", namespace: "ingress-nginx", variant: "internal-clusterip", recipe: "recipes/ingress-nginx/ingress-nginx/4.15.1" },
  { rank: 4, slug: "cert-manager", chart: "jetstack/cert-manager", version: "v1.20.2", namespace: "cert-manager", variant: "crds-enabled", recipe: "recipes/jetstack/cert-manager/v1.20.2" },
  { rank: 5, slug: "external-secrets", chart: "external-secrets/external-secrets", version: "2.5.0", namespace: "external-secrets", variant: "default", recipe: "recipes/external-secrets/external-secrets/2.5.0" },
  { rank: 6, slug: "argo-cd", chart: "argo-cd/argo-cd", version: "9.5.15", namespace: "argocd", variant: "default", recipe: "recipes/argo-cd/argo-cd/9.5.15" },
  { rank: 7, slug: "kube-prometheus-stack", chart: "prometheus-community/kube-prometheus-stack", version: "85.3.3", namespace: "monitoring", variant: "default", recipe: "recipes/prometheus-community/kube-prometheus-stack/85.3.3" },
  { rank: 8, slug: "postgresql", chart: "bitnami/postgresql", version: "18.6.7", namespace: "postgresql", variant: "generated-passwords", recipe: "recipes/bitnami/postgresql/18.6.7" },
  { rank: 9, slug: "rabbitmq", chart: "bitnami/rabbitmq", version: "16.0.14", namespace: "rabbitmq", variant: "generated-passwords", recipe: "recipes/bitnami/rabbitmq/16.0.14" },
  { rank: 10, slug: "loki", chart: "grafana/loki", version: "7.0.0", namespace: "loki", variant: "single-binary-filesystem", recipe: "recipes/grafana/loki/7.0.0" },
  { rank: 11, slug: "longhorn", chart: "longhorn/longhorn", version: "1.11.2", namespace: "longhorn-system", variant: "default", recipe: "recipes/longhorn/longhorn/1.11.2" },
  { rank: 12, slug: "vault", chart: "hashicorp/vault", version: "0.32.0", namespace: "vault", variant: "dev-mode", recipe: "recipes/hashicorp/vault/0.32.0" },
  { rank: 13, slug: "secrets-store-csi-driver", chart: "secrets-store-csi-driver/secrets-store-csi-driver", version: "1.6.0", namespace: "kube-system", variant: "default", recipe: "recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0" },
  { rank: 14, slug: "prometheus", chart: "prometheus-community/prometheus", version: "29.8.0", namespace: "monitoring", variant: "server-only-ephemeral", recipe: "recipes/prometheus-community/prometheus/29.8.0" },
  { rank: 15, slug: "grafana", chart: "grafana/grafana", version: "10.5.15", namespace: "grafana", variant: "generated-passwords", recipe: "recipes/grafana/grafana/10.5.15" },
  { rank: 16, slug: "mysql", chart: "bitnami/mysql", version: "14.0.3", namespace: "mysql", variant: "generated-passwords", recipe: "recipes/bitnami/mysql/14.0.3" },
  { rank: 17, slug: "mongodb", chart: "bitnami/mongodb", version: "19.0.7", namespace: "mongodb", variant: "generated-passwords", recipe: "recipes/bitnami/mongodb/19.0.7" },
  { rank: 18, slug: "nginx", chart: "bitnami/nginx", version: "24.0.2", namespace: "nginx", variant: "http-clusterip", recipe: "recipes/bitnami/nginx/24.0.2" },
  { rank: 19, slug: "tempo", chart: "grafana/tempo", version: "1.24.4", namespace: "tempo", variant: "local-persistent", recipe: "recipes/grafana/tempo/1.24.4" },
  { rank: 20, slug: "consul", chart: "hashicorp/consul", version: "2.0.0", namespace: "consul", variant: "default-control-plane", recipe: "recipes/hashicorp/consul/2.0.0" },
];

if (wantsHelp) {
  printUsage();
} else if (wantsPreflight) {
  preflightSelectedTargets();
} else if (mode === "--run") {
  const selected = selectedTargets();
  for (const target of selected) runTarget(target);
  writeSummary();
} else if (mode === "--summary") {
  writeSummary();
} else if (mode === "--verify") {
  verifyExpectedReceipts();
  verifySummary();
} else {
  printUsage();
}

function printUsage() {
  console.log(`Usage:
  node scripts/run-top20-live-parity.mjs --run --chart metrics-server
  node scripts/run-top20-live-parity.mjs --run --chart metrics-server --base external-tls-ca --gitops-canonicalization-profile k8s-zero-defaults
  node scripts/run-top20-live-parity.mjs --run --chart nginx --base existing-tls-ingress
  node scripts/run-top20-live-parity.mjs --run --chart nginx --base existing-tls-ingress --target-profile kind-ingress-nginx
  node scripts/run-top20-live-parity.mjs --run --chart ingress-nginx --base default --target-profile kind-loadbalancer
  node scripts/run-top20-live-parity.mjs --preflight --chart ingress-nginx --base default --target-profile kind-loadbalancer
  node scripts/run-top20-live-parity.mjs --run --chart nginx --repo-url oci://registry-1.docker.io/bitnamicharts
  node scripts/run-top20-live-parity.mjs --run --from-rank 2 --to-rank 5 --continue-on-fail
  node scripts/run-top20-live-parity.mjs --run --all --continue-on-fail
  node scripts/run-top20-live-parity.mjs --summary
  node scripts/run-top20-live-parity.mjs --verify`);
}

function preflightSelectedTargets() {
  const selected = selectedTargets();
  for (const target of selected) {
    const resolved = resolveTarget(target);
    const checks = [
      toolCheck("python3"),
      toolCheck("cub"),
      toolCheck("kind"),
      toolCheck("docker"),
      targetProfileCheck(targetProfile),
    ];
    const failed = checks.filter((item) => item.result !== "pass");
    console.log(`${failed.length ? "FAIL" : "PASS"} live-parity preflight ${target.chart}@${target.version} ${target.variant}`);
    console.log(`package: ${resolved.packagePath}`);
    console.log(`recipe: ${target.recipe}`);
    console.log(`values: ${resolved.valuesPath}`);
    console.log(`target profile: ${targetProfile ?? "none"}`);
    for (const item of checks) console.log(`- ${item.result}: ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
    if (failed.length) process.exitCode = 1;
  }
}

function toolCheck(binary) {
  const path = spawnSync("sh", ["-lc", `command -v ${shellQuote(binary)}`], { encoding: "utf8", stdio: "pipe" });
  if (path.status !== 0) {
    return { name: `${binary} on PATH`, result: "blocked", detail: path.stderr.trim() || "not found" };
  }
  const version = spawnSync(binary, versionArgs(binary), { encoding: "utf8", stdio: "pipe" });
  return {
    name: `${binary} on PATH`,
    result: "pass",
    detail: firstLine(version.stdout || version.stderr) || path.stdout.trim(),
  };
}

function targetProfileCheck(profile) {
  if (!profile || profile === "none") return { name: "target profile", result: "pass", detail: "none" };
  if (profile === "kind-ingress-nginx") return { name: "target profile kind-ingress-nginx", result: "pass", detail: "installs target ingress controller inside the test rig" };
  if (profile === "kind-three-node") return kubernetesNodeProfileCheck();
  if (profile === "kind-loadbalancer") {
    const provider = toolCheck("cloud-provider-kind");
    if (provider.result !== "pass") return { ...provider, name: "target profile kind-loadbalancer" };
    const privilege = cloudProviderKindPrivilegeCheck();
    if (privilege.result !== "pass") return privilege;
    const clusters = currentKindClusters();
    if (clusters.length > 0) {
      return {
        name: "target profile kind-loadbalancer host isolation",
        result: "pass",
        detail: `cloud-provider-kind observes kind clusters host-wide; the parity harness falls back to MetalLB L2 (cluster-scoped) while these run: ${clusters.join(", ")}`,
      };
    }
    return { name: "target profile kind-loadbalancer host isolation", result: "pass", detail: "no existing kind clusters" };
  }
  return { name: `target profile ${profile}`, result: "blocked", detail: "unknown target profile" };
}

function kubernetesNodeProfileCheck() {
  const cluster = spawnSync("cub", ["cluster", "up", "--help"], { encoding: "utf8", stdio: "pipe" });
  const clusterOutput = `${cluster.stdout ?? ""}\n${cluster.stderr ?? ""}`;
  if (cluster.status === 0 && clusterOutput.includes("--worker-nodes")) {
    return { name: "target profile kind-three-node", result: "pass", detail: "local proof-cluster helper can create a multi-node Kubernetes target with --worker-nodes" };
  }
  const lk = spawnSync("cub", ["lk", "up", "--help"], { encoding: "utf8", stdio: "pipe" });
  const lkOutput = `${lk.stdout ?? ""}\n${lk.stderr ?? ""}`;
  if (lk.status === 0 && lkOutput.includes("--worker-nodes")) {
    return { name: "target profile kind-three-node", result: "pass", detail: "local proof-cluster helper can create a multi-node Kubernetes target with --worker-nodes" };
  }
  return {
    name: "target profile kind-three-node",
    result: "blocked",
    detail: "requires local proof-cluster helper support for a Kubernetes target with at least three schedulable nodes; ConfigHub remains workerless",
  };
}

function cloudProviderKindPrivilegeCheck() {
  const result = spawnSync("cloud-provider-kind", [
    "--enable-default-ingress=true",
    "--enable-lb-port-mapping=true",
  ], { encoding: "utf8", stdio: "pipe", timeout: 2500 });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.error?.code === "ETIMEDOUT") {
    return {
      name: "target profile kind-loadbalancer privilege",
      result: "pass",
      detail: "cloud-provider-kind did not reject the privilege check before timeout",
    };
  }
  if (output.toLowerCase().includes("please run this again with `sudo`") || output.toLowerCase().includes("please run this again with sudo")) {
    return {
      name: "target profile kind-loadbalancer privilege",
      result: "pass",
      detail: "cloud-provider-kind requires sudo on this host; the parity harness falls back to MetalLB L2 (no host privileges, in-network LB addresses)",
    };
  }
  if (result.status !== 0) {
    return {
      name: "target profile kind-loadbalancer privilege",
      result: "blocked",
      detail: firstLine(output) || `cloud-provider-kind exited ${result.status}`,
    };
  }
  return {
    name: "target profile kind-loadbalancer privilege",
    result: "pass",
    detail: firstLine(output) || "cloud-provider-kind privilege check passed",
  };
}

function currentKindClusters() {
  const result = spawnSync("kind", ["get", "clusters"], { encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function firstLine(text) {
  return String(text ?? "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function versionArgs(binary) {
  if (binary === "cub") return ["version"];
  if (binary === "cloud-provider-kind") return ["--help"];
  return ["--version"];
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
  if (targetProfile) command.push("--target-profile", targetProfile);
  if (gitopsCanonicalizationProfile) command.push("--gitops-canonicalization-profile", gitopsCanonicalizationProfile);
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
  const { root, csv, md } = buildSummary();
  write(join(root, "summary.csv"), csv);
  write(join(root, "summary.md"), md);
  console.log(`wrote ${relativeRepo(join(root, "summary.md"))}`);
}

function verifySummary() {
  const { root, csv, md } = buildSummary();
  const csvPath = join(root, "summary.csv");
  const mdPath = join(root, "summary.md");
  check(existsSync(csvPath), `${relativeRepo(csvPath)} is missing; run npm run live-parity:top20:summary`);
  check(existsSync(mdPath), `${relativeRepo(mdPath)} is missing; run npm run live-parity:top20:summary`);
  check(readFileSync(csvPath, "utf8") === csv, `${relativeRepo(csvPath)} is stale; run npm run live-parity:top20:summary`);
  check(readFileSync(mdPath, "utf8") === md, `${relativeRepo(mdPath)} is stale; run npm run live-parity:top20:summary`);
  console.log("verified top-20 live parity summary");
}

function buildSummary() {
  const expectedReceiptPaths = new Set(targets.map((target) => receiptPath(target)));
  const rows = targets.map((target) => {
    const path = join(repoRoot, receiptPath(target));
    const receipt = existsSync(path) ? readYaml(path) : null;
    return {
      rank: target.rank,
      chart: target.chart,
      version: target.version,
      variant: target.variant,
      result: receipt?.spec?.result ?? "not-started",
      reason: classifyReason(receipt, target),
      receipt: existsSync(path) ? receiptPath(target) : "",
    };
  }).concat(discoveredReceiptRows(expectedReceiptPaths));
  const pass = rows.filter((row) => row.result === "pass").length;
  const watch = rows.filter((row) => row.result === "watch").length;
  const blocked = rows.filter((row) => row.result === "blocked").length;
  const notStarted = rows.filter((row) => row.result === "not-started").length;
  const blockedReasons = {};
  for (const row of rows) {
    if (row.result === "blocked") blockedReasons[row.reason] = (blockedReasons[row.reason] ?? 0) + 1;
  }
  const blockedBreakdown =
    Object.entries(blockedReasons)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => `${reason}: ${count}`)
      .join("\n") || "(none)";
  const root = join(repoRoot, "data", "live-helm-confighub-compare");
  const csv = toCsv(rows);
  const md = `# Live Helm-vs-ConfigHub Parity

This report tracks the strict live comparison lane for the selected top-20
chart/base rows and any additional committed base-variant receipts. Each
completed row has a receipt under
\`runs/live-helm-confighub-compare/\`.

\`\`\`text
pass: ${pass}
watch: ${watch}
blocked: ${blocked}
not-started: ${notStarted}
\`\`\`

Blocked rows broken down by cause (see \`blocked-triage.md\`):

\`\`\`text
${blockedBreakdown}
\`\`\`

| Rank | Chart | Base | Result | Reason | Receipt |
| ---: | --- | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}@${row.version}\` | ${row.variant} | ${row.result} | ${row.reason || "-"} | ${row.receipt || "-"} |`).join("\n")}
`;
  return { root, rows, csv, md };
}

function discoveredReceiptRows(expectedReceiptPaths) {
  const root = join(repoRoot, "runs", "live-helm-confighub-compare");
  if (!existsSync(root)) return [];
  const rows = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relative = `runs/live-helm-confighub-compare/${entry.name}/receipt.yaml`;
    if (expectedReceiptPaths.has(relative)) continue;
    const path = join(repoRoot, relative);
    if (!existsSync(path)) continue;
    const receipt = readYaml(path);
    if (receipt.kind !== "LiveHelmConfigHubParityReceipt") continue;
    const spec = receipt.spec ?? {};
    if (!spec.chart || !spec.version || !spec.base) continue;
    const canonical = targets.find((target) => target.chart === spec.chart);
    const target = {
      ...(canonical ?? {}),
      rank: canonical?.rank ?? "",
      chart: spec.chart,
      version: spec.version,
      variant: spec.base,
    };
    rows.push({
      rank: target.rank,
      chart: spec.chart,
      version: spec.version,
      variant: spec.base,
      result: spec.result ?? "not-started",
      reason: classifyReason(receipt, target),
      receipt: relative,
    });
  }
  return rows.sort((left, right) => {
    const leftRank = Number(left.rank || 9999);
    const rightRank = Number(right.rank || 9999);
    return leftRank - rightRank || left.chart.localeCompare(right.chart) || left.variant.localeCompare(right.variant);
  });
}

function resolveTarget(target) {
  const recipeRoot = join(repoRoot, target.recipe);
  const source = readYaml(join(recipeRoot, "source-lock.yaml"));
  const variant = readYaml(join(recipeRoot, "variants", target.variant, "variant.yaml"));
  const valuesProfile = variant.spec?.valuesProfile;
  check(valuesProfile, `${target.chart} ${target.variant} missing valuesProfile`);
  return {
    repositoryURL: repoUrlOverride ?? source.spec?.repositoryURL,
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
  if (selectedBase && !selectedSlug) {
    throw new Error("--base requires --chart");
  }
  if (selectedSlug) {
    const target = targets.find((item) => item.slug === selectedSlug);
    check(Boolean(target), `unknown live parity chart ${selectedSlug}`);
    return [selectedBase ? targetForBase(target, selectedBase) : target];
  }
  let selected = targets;
  if (selectedFromRank !== null) selected = selected.filter((target) => target.rank >= selectedFromRank);
  if (selectedToRank !== null) selected = selected.filter((target) => target.rank <= selectedToRank);
  if (selectedFromRank !== null || selectedToRank !== null) return selected;
  if (requireAllByDefault) return targets;
  return targets.filter((target) => existsSync(join(repoRoot, receiptPath(target))));
}

function targetForBase(target, base) {
  const variantPath = join(repoRoot, target.recipe, "variants", base, "variant.yaml");
  check(existsSync(variantPath), `${target.chart} has no variant ${base}`);
  const variant = readYaml(variantPath);
  return {
    ...target,
    namespace: variant.spec?.namespace ?? target.namespace,
    variant: base,
  };
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
  const headers = ["rank", "chart", "version", "variant", "result", "reason", "receipt"];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

// Classify non-pass rows so target/runtime conditions are not conflated with a
// real ConfigHub-vs-Helm parity defect. Returns "" for passing rows.
// See data/live-helm-confighub-compare/blocked-triage.md for the analysis.
function classifyReason(receipt, target) {
  const spec = receipt?.spec ?? {};
  if (!["blocked", "watch"].includes(spec.result)) return "";
  const semantic = spec.semanticComparison ?? {};
  const semanticDiff = Object.values(semantic).some(
    (value) =>
      value &&
      typeof value === "object" &&
      (((value.semanticDiffs ?? []).length > 0) || ((value.missingFromConfigHub ?? []).length > 0)),
  );
  if (semanticDiff) return "parity: live semantic diff";

  if (spec.result === "watch") return classifyWatch(spec, target);

  const message = String(spec.failure?.message ?? "").toLowerCase();
  if (message.includes("kind create cluster")) return "infra: kind create failed";
  if (message.includes("argocd-server")) return "infra: rig bootstrap (argocd) not ready";
  if (message.includes("please run this again with `sudo`") || message.includes("please run this again with sudo")) {
    return "infra: target profile requires sudo";
  }
  if (message.includes("effectivevalues wrapper") && message.includes("spec.values")) {
    return "input-contract: raw Helm values missing";
  }
  if (message.includes("target topology requires at least") || message.includes("schedulable node")) {
    return "target-fit: minimum schedulable nodes not met";
  }
  if (message.includes("timeout after")) return "infra: provisioning timeout";
  if (message.includes("etcdserver") || message.includes("request timed out")) return "infra: etcd/apiserver overload";
  const semanticPassed = Object.values(semantic).some(
    (value) => value && typeof value === "object" && value.result === "pass",
  );
  const regularHelm = (spec.legs ?? {}).regularHelm ?? {};
  if (regularHelm.result === "blocked") {
    const regularMessage = String(`${regularHelm.stderr ?? ""}\n${regularHelm.getManifestError ?? ""}`).toLowerCase();
    if (regularMessage.includes("customresourcedefinition") && regularMessage.includes("cannot be imported")) {
      return "fixture: pre-existing CRDs owned by test controller";
    }
    return semanticPassed ? "helm-runtime: upstream not ready (parity passed)" : "helm-runtime: upstream leg blocked";
  }
  // Real parity finding: Helm installed but a ConfigHub delivery path diverged live.
  return "uncategorized";
}

function classifyWatch(spec, target) {
  const text = JSON.stringify(spec).toLowerCase();
  if (text.includes("you must specify values for either") && text.includes("autodiscovery")) {
    return "render-input: required Helm values missing (parity passed)";
  }
  if (target.chart === "hashicorp/vault") return "operate-policy: Vault init/unseal readiness (parity passed)";
  if (target.chart === "ingress-nginx/ingress-nginx" && target.variant === "admission-disabled") {
    return "target-fit: LoadBalancer Service has no external IP on kind (parity passed)";
  }
  if (target.chart === "grafana/tempo" && text.includes("pending")) return "target-runtime: PVC/storage pending (parity passed)";
  if (text.includes("createcontainerconfigerror") || text.includes("crashloopbackoff")) {
    return "target-runtime: pod config/runtime errors (parity passed)";
  }
  if (text.includes("containercreating")) return "target-runtime: pod ContainerCreating (parity passed)";
  const gitops = spec.legs?.configHubOciArgo ?? {};
  if (gitops.sync === "OutOfSync" && gitops.health === "Healthy") {
    const outOfSyncResources = (gitops.argoStatus?.resources ?? [])
      .filter((resource) => resource.status === "OutOfSync")
      .map((resource) => resource.kind || resource.name)
      .filter(Boolean);
    if (outOfSyncResources.length) {
      return `gitops-runtime: ${[...new Set(outOfSyncResources)].join("+")} OutOfSync health Healthy (parity passed)`;
    }
    return "gitops-runtime: Argo sync OutOfSync health Healthy (parity passed)";
  }
  if (gitops.sync === "Synced" && gitops.health && gitops.health !== "Healthy") {
    return `gitops-runtime: Argo health ${gitops.health} (parity passed)`;
  }
  return "watch: inspect receipt";
}
