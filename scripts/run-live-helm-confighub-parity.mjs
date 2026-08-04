import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const wantsHelp = process.argv.includes("--help") || process.argv.includes("-h");
const wantsPreflight = process.argv.includes("--preflight");

const recipePath = optionValue("--recipe");
const base = optionValue("--base");
const targetProfile = optionValue("--target-profile");
const gitopsCanonicalizationProfile = optionValue("--gitops-canonicalization-profile");
const repoUrlOverride = optionValue("--repo-url");
const packageOverride = optionValue("--package");
const namespaceOverride = optionValue("--namespace");
const releaseOverride = optionValue("--release");
const slugOverride = optionValue("--slug");
const outOverride = optionValue("--out");
const rigOverride = optionValue("--rig");
const keep = process.argv.includes("--keep");
const MIN_AUTH_TTL_MINUTES = 90;

if (wantsHelp) {
  printUsage();
} else if (wantsPreflight) {
  preflight();
} else if (mode === "--run") {
  run();
} else {
  printUsage();
}

function printUsage() {
  console.log(`Usage:
  npm run live-parity:run -- --recipe recipes/external-dns/external-dns/1.21.1 --base no-crds
  npm run live-parity:run -- --recipe recipes/traefik/traefik/40.2.0 --base no-crds --target-profile kind-loadbalancer
  npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base no-crds --target-profile kind-cert-manager

This runs the strict live Helm-vs-ConfigHub parity rig for one committed recipe
and base variant:

  1. regular Helm install
  2. cub installer render + kubectl apply
  3. cub installer upload + ConfigHub OCI -> Argo CD

Run these jobs serially. The rig owns kind clusters and a live-parity lock.

Options:
  --recipe <path>                       recipes/<repo>/<chart>/<version>
  --base <name>                         base variant under variants/<name>
  --repo-url <url>                      override source-lock repositoryURL
  --package <path>                      override the package path derived from the recipe
  --namespace <namespace>               override variant namespace
  --release <name>                      override variant releaseName
  --slug <slug>                         override run slug
  --out <path>                          override receipt path
  --rig <name>                          override cub-managed cluster name
  --target-profile <profile>            pass target profile to the rig
  --gitops-canonicalization-profile <p> pass canonicalization profile to the rig
  --preflight                           check inputs and local tools only
  --keep                                keep the rig for debugging`);
}

function preflight() {
  check(recipePath, "missing required option --recipe");
  check(base, "missing required option --base");
  const target = resolveTarget();
  const checks = [
    { name: "recipe", result: "pass", detail: target.recipe },
    { name: "package", result: existsSync(join(repoRoot, target.packagePath)) ? "pass" : "blocked", detail: target.packagePath },
    { name: "values", result: existsSync(join(repoRoot, target.valuesPath)) ? "pass" : "blocked", detail: target.valuesPath },
    { name: "variant revision", result: existsSync(join(repoRoot, target.variantRevision)) ? "pass" : "blocked", detail: target.variantRevision },
    {
      name: "exact source artifact",
      result: target.exactArtifactURL && target.exactArtifactSHA256 ? "pass" : "pass",
      detail: target.exactArtifactURL
        ? `${target.exactArtifactURL} sha256:${target.exactArtifactSHA256}`
        : "source lock uses repository resolution",
    },
    toolCheck("python3"),
    toolCheck("cub"),
    cubAuthCheck(),
    toolCheck("kind"),
    toolCheck("docker"),
    targetProfileCheck(targetProfile),
  ];
  const failed = checks.filter((item) => item.result !== "pass");
  console.log(`${failed.length ? "FAIL" : "PASS"} live-parity preflight ${target.chart}@${target.version} ${target.base}`);
  console.log(`receipt: ${target.out}`);
  for (const item of checks) console.log(`- ${item.result}: ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
  if (failed.length) process.exitCode = 1;
}

function run() {
  check(recipePath, "missing required option --recipe");
  check(base, "missing required option --base");
  const target = resolveTarget();
  const auth = cubAuthCheck();
  if (auth.result !== "pass") {
    console.error(`FAIL live-parity auth preflight: ${auth.detail}`);
    process.exit(1);
  }
  mkdirSync(dirname(join(repoRoot, target.out)), { recursive: true });
  const command = [
    "python3", "tests/live-helm-confighub-parity-test",
    "--chart", target.chart,
    "--version", target.version,
    "--repo-url", target.repositoryURL,
    "--release", target.releaseName,
    "--namespace", target.namespace,
    "--package", target.packagePath,
    "--recipe", target.recipe,
    "--base", target.base,
    "--variant-revision", target.variantRevision,
    "--values", target.valuesPath,
    "--slug", target.slug,
    "--rig", target.rig,
    "--out", target.out,
  ];
  if (target.exactArtifactURL) {
    command.push("--chart-artifact-url", target.exactArtifactURL);
    command.push("--chart-artifact-sha256", target.exactArtifactSHA256);
  }
  if (targetProfile) command.push("--target-profile", targetProfile);
  if (gitopsCanonicalizationProfile) command.push("--gitops-canonicalization-profile", gitopsCanonicalizationProfile);
  if (keep) command.push("--keep");
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 100,
  });
  process.exit(result.status ?? 1);
}

function resolveTarget() {
  const recipe = normalizeRecipePath(recipePath);
  const sourcePath = join(repoRoot, recipe, "source-lock.yaml");
  const variantPath = join(repoRoot, recipe, "variants", base, "variant.yaml");
  check(existsSync(sourcePath), `${recipe}/source-lock.yaml is missing`);
  check(existsSync(variantPath), `${recipe}/variants/${base}/variant.yaml is missing`);
  const source = readYaml(sourcePath);
  const variant = readYaml(variantPath);
  const chart = source.spec?.ref ?? chartFromRecipe(recipe);
  const version = source.spec?.version ?? versionFromRecipe(recipe);
  const repositoryURL = repoUrlOverride ?? source.spec?.repositoryURL;
  const exactArtifactURL = source.spec?.exactArtifact?.url ?? "";
  const exactArtifactSHA256 = source.spec?.exactArtifact?.sha256 ?? "";
  check(chart, `${recipe}/source-lock.yaml missing spec.ref`);
  check(version, `${recipe}/source-lock.yaml missing spec.version`);
  check(repositoryURL, `${recipe}/source-lock.yaml missing spec.repositoryURL`);
  check(
    !exactArtifactURL || exactArtifactSHA256,
    `${recipe}/source-lock.yaml exact artifact is missing spec.exactArtifact.sha256`,
  );
  const valuesProfile = variant.spec?.valuesProfile;
  check(valuesProfile, `${recipe}/variants/${base}/variant.yaml missing spec.valuesProfile`);
  const namespace = namespaceOverride ?? variant.spec?.namespace ?? "default";
  const releaseName = releaseOverride ?? variant.spec?.releaseName ?? chart.split("/").at(-1);
  const slug = slugOverride ?? slugFromChart(chart);
  const target = {
    recipe,
    chart,
    version,
    repositoryURL,
    base,
    namespace,
    releaseName,
    slug,
    packagePath: packageOverride ?? packagePathFromRecipe(recipe, chart, version),
    exactArtifactURL,
    exactArtifactSHA256,
    valuesPath: normalizeRelative(recipe, `variants/${base}`, valuesProfile),
    variantRevision: `${recipe}/revisions/${base}/r001/variant-revision.yaml`,
    rig: rigOverride ?? `helm-expt-parity-${rigSlug(slug)}-${uniqueRunSuffix()}`,
    out: outOverride ?? defaultReceiptPath({ chart, version, base, recipe }),
  };
  check(existsSync(join(repoRoot, target.packagePath)), `${target.packagePath} is missing`);
  check(existsSync(join(repoRoot, target.valuesPath)), `${target.valuesPath} is missing`);
  check(existsSync(join(repoRoot, target.variantRevision)), `${target.variantRevision} is missing`);
  return target;
}

function defaultReceiptPath({ chart, version, base, recipe }) {
  const chartBase = `${chart.replaceAll("/", "-")}-${base}`;
  if (recipe.startsWith("recipes/") && !hasDuplicateChartBaseVersion({ chart, base, recipe })) {
    return `runs/live-helm-confighub-compare/${chartBase}/receipt.yaml`;
  }
  return `runs/live-helm-confighub-compare/${chartBase}-${slugPart(version)}/receipt.yaml`;
}

function packagePathFromRecipe(recipe, chart, version) {
  const parts = recipe.split("/");
  const recipesIndex = parts.lastIndexOf("recipes");
  if (recipesIndex >= 0) {
    parts[recipesIndex] = "packages";
    return parts.join("/");
  }
  return `packages/${chart}/${version}`;
}

function hasDuplicateChartBaseVersion({ chart, base, recipe }) {
  const chartRoot = join(repoRoot, "recipes", chart);
  if (!existsSync(chartRoot)) return false;
  const currentRecipe = relativeRepo(join(repoRoot, recipe));
  const matches = [];
  for (const entry of readdirSync(chartRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidateRecipe = relativeRepo(join(chartRoot, entry.name));
    if (existsSync(join(chartRoot, entry.name, "variants", base, "variant.yaml"))) {
      matches.push(candidateRecipe);
    }
  }
  return matches.includes(currentRecipe) && matches.length > 1;
}

function slugPart(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}

function normalizeRecipePath(value) {
  return relativeRepo(resolve(value.startsWith("/") ? value : join(repoRoot, value)));
}

function normalizeRelative(recipe, variantDir, reference) {
  if (reference.startsWith("/")) return reference;
  return relativeRepo(join(repoRoot, recipe, variantDir, reference));
}

function chartFromRecipe(recipe) {
  const parts = recipe.split("/");
  return parts.length >= 4 ? `${parts.at(-3)}/${parts.at(-2)}` : "";
}

function versionFromRecipe(recipe) {
  return recipe.split("/").at(-1) ?? "";
}

function slugFromChart(chart) {
  return chart.split("/").at(-1) ?? chart;
}

function uniqueRunSuffix() {
  return `${Date.now().toString(36)}-${process.pid.toString(36)}`;
}

function rigSlug(slug) {
  const compact = slug.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (compact.length <= 18) return compact;
  const hash = createHash("sha1").update(slug).digest("hex").slice(0, 5);
  return `${compact.slice(0, 13)}${hash}`;
}

function toolCheck(binary) {
  const path = spawnSync("sh", ["-lc", `command -v ${shellQuote(binary)}`], { encoding: "utf8", stdio: "pipe" });
  if (path.status !== 0) return { name: `${binary} on PATH`, result: "blocked", detail: path.stderr.trim() || "not found" };
  const version = spawnSync(binary, versionArgs(binary), { encoding: "utf8", stdio: "pipe" });
  return {
    name: `${binary} on PATH`,
    result: "pass",
    detail: firstLine(version.stdout || version.stderr) || path.stdout.trim(),
  };
}

function cubAuthCheck() {
  const result = spawnSync("cub", ["auth", "status"], { encoding: "utf8", stdio: "pipe" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) {
    return {
      name: "cub auth",
      result: "blocked",
      detail: firstLine(output) || "not authenticated; run cub auth login before live parity",
    };
  }
  const expiry = parseCubAuthExpiry(output);
  if (expiry) {
    const ttlMinutes = Math.floor((expiry.getTime() - Date.now()) / 60000);
    if (ttlMinutes < MIN_AUTH_TTL_MINUTES) {
      return {
        name: "cub auth",
        result: "blocked",
        detail: `access token expires in ${ttlMinutes}m; run cub auth login before starting a live rig`,
      };
    }
    return {
      name: "cub auth",
      result: "pass",
      detail: `authenticated; token expires in ${ttlMinutes}m`,
    };
  }
  return {
    name: "cub auth",
    result: "pass",
    detail: firstLine(output) || "authenticated",
  };
}

function parseCubAuthExpiry(output) {
  const match = output.match(/(?:access token )?expires?\\s+(?:at|:)\\s+([^\\n]+)/i);
  if (!match) return null;
  const parsed = new Date(match[1].trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function targetProfileCheck(profile) {
  if (!profile || profile === "none") return { name: "target profile", result: "pass", detail: "none" };
  if (profile === "kind-three-node") return kubernetesNodeProfileCheck();
  if (["kind-cert-manager", "kind-ingress-nginx", "kind-loadbalancer", "kind-tigera-crds"].includes(profile)) {
    return { name: `target profile ${profile}`, result: "pass", detail: "recognized" };
  }
  return { name: `target profile ${profile}`, result: "blocked", detail: "unknown target profile" };
}

function kubernetesNodeProfileCheck() {
  const cluster = spawnSync("cub", ["cluster", "up", "--help"], { encoding: "utf8", stdio: "pipe" });
  const clusterOutput = `${cluster.stdout ?? ""}\n${cluster.stderr ?? ""}`;
  if (cluster.status === 0 && clusterOutput.includes("--worker-nodes")) {
    return { name: "target profile kind-three-node", result: "pass", detail: "local proof-cluster helper can create a multi-node Kubernetes target with --worker-nodes" };
  }
  return {
    name: "target profile kind-three-node",
    result: "blocked",
    detail: "requires local proof-cluster helper support for a Kubernetes target with at least three schedulable nodes; ConfigHub remains workerless",
  };
}

function versionArgs(binary) {
  if (binary === "docker") return ["--version"];
  if (binary === "cub") return ["version"];
  return ["--version"];
}

function firstLine(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
}
