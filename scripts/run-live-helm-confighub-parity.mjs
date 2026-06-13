import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
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
const namespaceOverride = optionValue("--namespace");
const releaseOverride = optionValue("--release");
const slugOverride = optionValue("--slug");
const outOverride = optionValue("--out");
const rigOverride = optionValue("--rig");
const keep = process.argv.includes("--keep");

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
  --namespace <namespace>               override variant namespace
  --release <name>                      override variant releaseName
  --slug <slug>                         override run slug
  --out <path>                          override receipt path
  --rig <name>                          override cub-lk rig name
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
    toolCheck("python3"),
    toolCheck("cub"),
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
  check(chart, `${recipe}/source-lock.yaml missing spec.ref`);
  check(version, `${recipe}/source-lock.yaml missing spec.version`);
  check(repositoryURL, `${recipe}/source-lock.yaml missing spec.repositoryURL`);
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
    packagePath: `packages/${chart}/${version}`,
    valuesPath: normalizeRelative(recipe, `variants/${base}`, valuesProfile),
    variantRevision: `${recipe}/revisions/${base}/r001/variant-revision.yaml`,
    rig: rigOverride ?? `helm-expt-parity-${rigSlug(slug)}-${uniqueRunSuffix()}`,
    out: outOverride ?? `runs/live-helm-confighub-compare/${chart.replaceAll("/", "-")}-${base}/receipt.yaml`,
  };
  check(existsSync(join(repoRoot, target.packagePath)), `${target.packagePath} is missing`);
  check(existsSync(join(repoRoot, target.valuesPath)), `${target.valuesPath} is missing`);
  check(existsSync(join(repoRoot, target.variantRevision)), `${target.variantRevision} is missing`);
  return target;
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

function targetProfileCheck(profile) {
  if (!profile || profile === "none") return { name: "target profile", result: "pass", detail: "none" };
  if (["kind-ingress-nginx", "kind-loadbalancer"].includes(profile)) {
    return { name: `target profile ${profile}`, result: "pass", detail: "recognized" };
  }
  return { name: `target profile ${profile}`, result: "blocked", detail: "unknown target profile" };
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
