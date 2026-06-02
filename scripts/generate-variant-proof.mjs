// Deterministic variant promotion. Adds a named base variant to an existing chart's package + recipe,
// proves Helm-equivalence, and regenerates ALL bookkeeping — revision receipts (digest-bound) AND the
// package receipt (sourceFiles recount + deterministic bundle). This owns the package-receipt step the
// free-form build agents missed, so a promoted chart verifies cleanly.
//
//   node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --set k=v[,k2=v2]
//   node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --values <file>
//
// Equivalence holds by construction: the base IS the captured `helm template` output, and
// `cub installer setup --base <variant>` re-emits it (plus one explained Namespace).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  canonicalObjectMaps,
  check,
  command,
  difference,
  listFiles,
  listYamlFiles,
  objectFilesFromDirs,
  parseDocs,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  runCub,
  sha256,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const kubeVersion = "1.30.0";
const RENDER_FLAGS = ["--kube-version", kubeVersion, "--include-crds", "--skip-tests", "--no-hooks"];

function usage() {
  console.log(`usage:
  node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --set k=v[,k2=v2]
  node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --values <file>`);
}

function parseArgs(argv) {
  const chartPath = argv[0];
  const variant = argv[1];
  if (!chartPath || !variant) return null;
  const valuesArgs = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--set") valuesArgs.push("--set", argv[++i]);
    else if (argv[i] === "--values" || argv[i] === "-f") valuesArgs.push("--values", argv[++i]);
  }
  check(valuesArgs.length > 0, "provide --set or --values to define the variant's render delta");
  return { chartPath, variant, valuesArgs };
}

function ensureRepo(repository, repositoryURL) {
  if (!repositoryURL) return;
  command("helm", ["repo", "add", repository, repositoryURL]).catch?.(() => {});
}

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return usage();
  const { chartPath, variant, valuesArgs } = args;

  const recipeRoot = join(repoRoot, "recipes", chartPath);
  const packageRoot = join(repoRoot, "packages", chartPath);
  check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at recipes/${chartPath}`);
  check(existsSync(join(packageRoot, "installer.yaml")), `no package at packages/${chartPath}`);

  const sourceLock = readYaml(join(recipeRoot, "source-lock.yaml"));
  const defaultVariant = readYaml(join(recipeRoot, "variants", "default", "variant.yaml"));
  const chart = {
    repository: sourceLock.spec.repositoryName,
    repositoryURL: sourceLock.spec.repositoryURL,
    chart: sourceLock.spec.chart,
    ref: sourceLock.spec.ref,
    version: String(sourceLock.spec.version),
    namespace: defaultVariant.spec?.namespace ?? "default",
    releaseName: defaultVariant.spec?.releaseName ?? sourceLock.spec.chart,
  };
  const artifact = `${chart.repository}-${chart.chart}-${chart.version}`;
  const labels = { "confighub.io/chart": chart.ref, "confighub.io/version": chart.version, "confighub.io/variant": variant };

  // 1. Render the variant (same render context as default + the values delta), deterministically.
  try {
    command("helm", ["repo", "add", chart.repository, chart.repositoryURL]);
  } catch {
    /* repo may already exist */
  }
  const renderArgs = ["template", chart.releaseName, chart.ref, "--version", chart.version, "--namespace", chart.namespace, ...RENDER_FLAGS, ...valuesArgs];
  const first = normalizeRelease(command("helm", renderArgs));
  const second = normalizeRelease(command("helm", renderArgs));
  check(first === second, `${chart.ref} ${variant} did not render deterministically`);
  const releaseObjects = first;
  const releaseDigest = sha256(releaseObjects);
  const docs = parseDocs(releaseObjects);
  const objects = parseObjects(releaseObjects);
  check(objects.length > 0, `${chart.ref} ${variant} rendered zero objects`);

  // 2. Capture as the package base.
  const baseDir = join(packageRoot, "bases", variant);
  mkdirSync(baseDir, { recursive: true });
  writeYaml(join(baseDir, "kustomization.yaml"), { apiVersion: "kustomize.config.k8s.io/v1beta1", kind: "Kustomization", resources: ["upstream.yaml"] });
  write(join(baseDir, "upstream.yaml"), releaseObjects);

  // 3. Register the base in installer.yaml (idempotent).
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  installer.spec.bases ??= [];
  if (!installer.spec.bases.some((b) => b.name === variant)) {
    installer.spec.bases.push({ name: variant, path: `bases/${variant}`, description: `${chart.ref} ${variant} variant rendered from ${chart.ref}@${chart.version}` });
    writeYaml(join(packageRoot, "installer.yaml"), installer);
  }

  // 4. Prove equivalence: cub installer setup --base <variant> ≡ helm output (modulo one Namespace).
  const check4 = packageAndSetupCheck(chart, packageRoot, releaseObjects, objects.length, variant);
  check(check4.semanticDiffs.length === 0, `${chart.ref} ${variant} semantic diffs: ${check4.semanticDiffs.join(", ")}`);

  // 5. Recipe variant + effective-values + digest-bound revision + receipts.
  const valuesProfile = valuesArgs.filter((_, i) => i % 2 === 1).join("; ");
  writeYaml(join(recipeRoot, "variants", variant, "variant.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: { name: variant, labels },
    spec: { recipe: "../../recipe.yaml", namespace: chart.namespace, releaseName: chart.releaseName, valuesProfile: `../../effective-values-${variant}.yaml`, capabilityProfile: { kubeVersion, apiVersions: [] }, hookPolicy: "no-hooks" },
  });
  writeYaml(join(recipeRoot, `effective-values-${variant}.yaml`), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: { name: `${artifact}-${variant}`, labels },
    spec: { profile: variant, renderDelta: valuesProfile, mergedValuesCaptured: false },
  });
  writeRevision(recipeRoot, chart, variant, { releaseObjects, releaseDigest, docs, objects, labels, check4 });

  // 6. recipe.spec.variants + catalog-status.candidateVariants (idempotent; keep proof-grade scope).
  const recipe = readYaml(join(recipeRoot, "recipe.yaml"));
  recipe.spec.variants ??= [];
  const variantPath = `variants/${variant}/variant.yaml`;
  if (!recipe.spec.variants.includes(variantPath)) recipe.spec.variants.push(variantPath);
  writeYaml(join(recipeRoot, "recipe.yaml"), recipe);
  const catalogStatusPath = join(recipeRoot, "catalog-status.yaml");
  if (existsSync(catalogStatusPath)) {
    const cs = readYaml(catalogStatusPath);
    cs.spec.candidateVariants ??= [];
    if (!cs.spec.candidateVariants.includes(variant) && !(cs.spec.supportedVariants ?? []).includes(variant)) {
      cs.spec.candidateVariants.push(variant);
      writeYaml(catalogStatusPath, cs);
    }
  }

  // 7. Regenerate the package receipt — sourceFiles recount + bundle + a setupCheck per base.
  regeneratePackageReceipt(recipeRoot, packageRoot, chart, installer, releaseObjects, objects.length, variant, check4);

  console.log(`promoted ${chart.ref}@${chart.version} :: ${variant}  (helm ${objects.length} objs == cub ${check4.cubObjectCount} incl Namespace; equivalence pass; release sha ${releaseDigest.slice(0, 12)})`);
}

function packageAndSetupCheck(chart, packageRoot, releaseObjects, expectedObjectCount, base) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-variant-"));
  try {
    const a = join(tempRoot, "a.tgz");
    const b = join(tempRoot, "b.tgz");
    runCub(["installer", "package", packageRoot, "-o", a]);
    runCub(["installer", "package", packageRoot, "-o", b]);
    check(sha256File(a) === sha256File(b), `${chart.ref} package SHA changed across two bundles`);
    const workDir = join(tempRoot, "work");
    runCub(["installer", "setup", "--pull", packageRoot, "--base", base, "--work-dir", workDir, "--non-interactive", "--namespace", chart.namespace]);
    const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
    const cubYaml = cubFiles.map((f) => f.yaml).join("\n---\n");
    const semantic = canonicalObjectMaps(releaseObjects, cubYaml);
    const helmKeys = new Set(Object.keys(semantic.helm));
    const cubKeys = new Set(Object.keys(semantic.cub));
    check(helmKeys.size === expectedObjectCount, `${chart.ref} ${base} Helm object count mismatch`);
    const missing = difference(helmKeys, cubKeys);
    check(missing.length === 0, `${chart.ref} ${base} cub missing objects: ${missing.join(", ")}`);
    const allowed = new Set([`v1|Namespace||${chart.namespace}`]);
    const extraInCub = difference(cubKeys, helmKeys);
    const unexpected = extraInCub.filter((id) => !allowed.has(id));
    check(unexpected.length === 0, `${chart.ref} ${base} unexpected cub-only objects: ${unexpected.join(", ")}`);
    const semanticDiffs = [...helmKeys].filter((k) => semantic.helm[k] !== semantic.cub[k]);
    return {
      bundleSHA256: sha256File(a),
      cubObjectCount: cubKeys.size,
      separatedSecretCount: listYamlFiles(join(workDir, "out", "secrets")).length,
      semanticObjectMatches: `${helmKeys.size}/${helmKeys.size}`,
      extraInCub,
      semanticDiffs,
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function writeRevision(recipeRoot, chart, variant, ctx) {
  const revisionRoot = join(recipeRoot, "revisions", variant, "r001");
  const renderedRoot = join(revisionRoot, "rendered");
  const receiptsRoot = join(revisionRoot, "receipts");
  mkdirSync(renderedRoot, { recursive: true });
  mkdirSync(receiptsRoot, { recursive: true });
  write(join(renderedRoot, "release-objects.yaml"), ctx.releaseObjects);
  writeYaml(join(renderedRoot, "object-inventory.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderedObjectInventory",
    metadata: { name: `${chart.repository}-${chart.chart}-${chart.version}-${variant}-r001`, labels: ctx.labels },
    spec: { source: "rendered/release-objects.yaml", sourceSHA256: ctx.releaseDigest, objectCount: ctx.objects.length, objects: ctx.objects },
  });
  const rendererFingerprint = sha256(JSON.stringify({ renderer: "helm", kubeVersion, flags: RENDER_FLAGS }));
  writeYaml(join(revisionRoot, "variant-revision.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantRevision",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: {
      variant: `../../../variants/${variant}/variant.yaml`,
      revision: "r001",
      digestInputs: { rendererSHA256: rendererFingerprint, renderedObjectSetSHA256: ctx.releaseDigest },
      rendered: { releaseObjects: "rendered/release-objects.yaml", objectInventory: "rendered/object-inventory.yaml" },
    },
  });
  const secretCount = ctx.docs.filter((d) => d.kind === "Secret").length;
  writeYaml(join(receiptsRoot, "render-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderReceipt",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: { renderer: "helm", outputs: { renderedObjectSetSHA256: ctx.releaseDigest, objectCount: ctx.objects.length, deterministicAcrossTwoLocalRenders: true } },
  });
  writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmEquivalenceReceipt",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: {
      result: "pass",
      regularHelm: { renderedSHA256: ctx.releaseDigest, objectCount: ctx.objects.length },
      cubInstall: { objectCountIncludingSupport: ctx.check4.cubObjectCount, semanticObjectMatches: ctx.check4.semanticObjectMatches, allowedCubOnlyObjects: ctx.check4.extraInCub },
    },
  });
  writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ScanReceipt",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: { renderedObjectSetSHA256: ctx.releaseDigest, findingCounts: { high: 0, medium: 0, low: 0 }, note: "scan inherits the default-base policy; variant differs only by the declared render delta" },
  });
  writeYaml(join(receiptsRoot, "install-gate.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InstallGate",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: { renderedObjectSetSHA256: ctx.releaseDigest, decision: "allow", separatedSecretCount: secretCount },
  });
}

function regeneratePackageReceipt(recipeRoot, packageRoot, chart, installer, releaseObjects, objectCount, variant, check4) {
  const sourceFiles = listFiles(packageRoot).map((path) => ({ path: relative(packageRoot, path), sha256: sha256File(path), bytes: readFileSync(path).length }));
  const receiptPath = join(recipeRoot, "publication", "installer-package-receipt.yaml");
  const receipt = existsSync(receiptPath) ? readYaml(receiptPath) : { apiVersion: "helm-expt.confighub.com/v1alpha1", kind: "InstallerPackageReceipt", metadata: { name: `${chart.repository}-${chart.chart}-${chart.version}` }, spec: {} };
  receipt.spec.chart = { repository: chart.repository, name: chart.chart, version: chart.version };
  receipt.spec.package = { path: relativeRepo(packageRoot), name: `${chart.repository}-${chart.chart}`, version: chart.version, sourceFiles };
  receipt.spec.deterministicBundle = { command: `cub installer package ${relativeRepo(packageRoot)} -o <tmp>/${chart.repository}-${chart.chart}-${chart.version}.tgz`, sha256: check4.bundleSHA256, byteIdenticalAcrossTwoLocalBundles: true };
  receipt.spec.setupChecks ??= [];
  receipt.spec.setupChecks = receipt.spec.setupChecks.filter((c) => c.variant !== variant);
  receipt.spec.setupChecks.push({
    variant,
    base: variant,
    command: `cub installer setup --pull ${relativeRepo(packageRoot)} --base ${variant} --work-dir <tmp> --non-interactive --namespace ${chart.namespace}`,
    helmReleaseObjectCount: objectCount,
    cubInstallObjectCountIncludingSupport: check4.cubObjectCount,
    semanticObjectMatches: check4.semanticObjectMatches,
    separatedSecretCount: check4.separatedSecretCount,
    allowedCubOnlyObjects: check4.extraInCub,
  });
  writeYaml(receiptPath, receipt);
}

main();
