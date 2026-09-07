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
import { variantScanEvidence, selfTestVariantScan } from "./lib/local-rendered-object-scan.mjs";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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

import { requiredSecretKeyFacts } from "./lib/required-secret-key-facts.mjs";
import {
  leadingBlankLinePruneMatches,
  loadLeadingBlankLineNormalization,
} from "./lib/variant-semantic-normalization.mjs";

const kubeVersion = "1.30.0";
const RENDER_FLAGS = ["--kube-version", kubeVersion, "--include-crds", "--skip-tests", "--no-hooks"];

function usage() {
  console.log(`usage:
  node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --set k=v[,k2=v2]
  node scripts/generate-variant-proof.mjs <repo>/<chart>/<version> <variant> --values <file>
    [--base <variant>]    derive render context (namespace/releaseName) from this base variant (default: default)
    [--no-include-crds]   render without --include-crds (for charts that ship CRDs in crds/)`);
}

function parseArgs(argv) {
  const chartPath = argv[0];
  const variant = argv[1];
  if (!chartPath || !variant) return null;
  const noIncludeCrds = argv.includes("--no-include-crds");
  let baseVariant = "default";
  let valuesFile = null;
  const valuesArgs = [];
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--set") valuesArgs.push("--set", argv[++i]);
    else if (argv[i] === "--values" || argv[i] === "-f") {
      valuesFile = argv[++i];
      valuesArgs.push("--values", valuesFile);
    }
    else if (argv[i] === "--base") baseVariant = argv[++i];
  }
  check(valuesArgs.length > 0 || noIncludeCrds, "provide --set/--values, or --no-include-crds (for charts that ship CRDs in crds/)");
  return { chartPath, variant, valuesArgs, valuesFile, noIncludeCrds, baseVariant };
}

function ensureRepo(repository, repositoryURL) {
  if (!repositoryURL) return;
  command("helm", ["repo", "add", repository, repositoryURL]).catch?.(() => {});
}

function helmChartSource(spec) {
  if (spec.exactArtifact?.url?.startsWith("oci://")) return spec.exactArtifact.url;
  if (!spec.repositoryURL?.startsWith("oci://")) return spec.ref ?? `${spec.repositoryName}/${spec.chart}`;
  const repository = spec.repositoryURL.replace(/\/+$/, "");
  return repository.endsWith(`/${spec.chart}`) ? repository : `${repository}/${spec.chart}`;
}

function selfTestHelmSources() {
  const cases = [
    [{ repositoryURL: "oci://example.test/charts", chart: "app" }, "oci://example.test/charts/app"],
    [{ repositoryURL: "oci://example.test/charts/app/", chart: "app" }, "oci://example.test/charts/app"],
    [{ repositoryURL: "oci://example.test/old", chart: "app", exactArtifact: { url: "oci://example.test/pinned/app" } }, "oci://example.test/pinned/app"],
    [{ repositoryURL: "https://example.test/charts", repositoryName: "charts", chart: "app" }, "charts/app"],
  ];
  for (const [spec, expected] of cases) check(helmChartSource(spec) === expected, `incorrect Helm source: ${expected}`);
  for (const [recipe, expected] of [
    ["aws-controllers-k8s/ec2-chart/1.18.4", "oci://public.ecr.aws/aws-controllers-k8s/ec2-chart"],
    ["cloudpirates/redis/0.34.11", "oci://registry-1.docker.io/cloudpirates/redis"],
  ]) check(helmChartSource(readYaml(join(repoRoot, "recipes", recipe, "source-lock.yaml")).spec) === expected, `${recipe}: incomplete OCI artifact reference`);
  console.log("Helm source tests passed for repository namespaces, full chart URLs and exact artifact locks");
}

function selfTestSemanticNormalization() {
  const chart = { ref: "cloudpirates/redis", version: "0.34.11" };
  const recipeRoot = join(repoRoot, "recipes", chart.ref, chart.version);
  const normalization = loadLeadingBlankLineNormalization({ chart, recipeRoot });
  check(Boolean(normalization), "declared Redis normalization was not loaded");
  check(normalization.paths.length === 2, "declared Redis normalization path count changed");

  const helm = JSON.stringify({ spec: { template: { spec: { containers: [{ livenessProbe: { exec: { command: ["sh", "-c", "\nprobe"] } } }] } } } });
  const cub = JSON.stringify({ spec: { template: { spec: { containers: [{ livenessProbe: { exec: { command: ["sh", "-c", "probe"] } } }] } } } });
  check(leadingBlankLinePruneMatches(helm, cub, ["spec.template.spec.containers[0].livenessProbe.exec.command[2]"]).allowed, "declared leading-newline normalization did not match");
  check(!leadingBlankLinePruneMatches(helm, cub, ["spec.template.spec.containers[0].readinessProbe.exec.command[2]"]).allowed, "wrong normalization object path was accepted");
  check(!leadingBlankLinePruneMatches(helm.replace("probe", "changed"), cub, ["spec.template.spec.containers[0].livenessProbe.exec.command[2]"]).allowed, "changed command content was accepted");
  const extraStructure = JSON.parse(cub);
  extraStructure.extra = true;
  check(!leadingBlankLinePruneMatches(helm, JSON.stringify(extraStructure), ["spec.template.spec.containers[0].livenessProbe.exec.command[2]"]).allowed, "extra structure was accepted");
  check(loadLeadingBlankLineNormalization({ chart: { ...chart, version: "0.34.10" }, recipeRoot }) === null, "wrong chart version received a normalization");
  let unboundRejected = false;
  try {
    loadLeadingBlankLineNormalization({ chart, recipeRoot: join(repoRoot, "recipes", "bitnami", "redis", "25.5.3") });
  } catch (error) {
    unboundRejected = String(error.message).includes("not bound");
  }
  check(unboundRejected, "unbound normalization receipt was accepted");
  const fixtureRoot = mkdtempSync(join(tmpdir(), "variant-normalization-binding-"));
  try {
    const fixtureRecipeRoot = join(fixtureRoot, "recipes", chart.ref, chart.version);
    const fixtureCorpusPath = join(fixtureRoot, "data", "successor-track", "corpus.yaml");
    cpSync(recipeRoot, fixtureRecipeRoot, { recursive: true });
    mkdirSync(join(fixtureRoot, "data", "successor-track"), { recursive: true });
    cpSync(join(repoRoot, "data", "successor-track", "corpus.yaml"), fixtureCorpusPath);
    const fixtureReceiptPath = join(fixtureRecipeRoot, "revisions", "default", "r001", "receipts", "helm-equivalence-receipt.yaml");
    const originalReceipt = readFileSync(fixtureReceiptPath, "utf8");
    const rejectMutation = (label, mutate) => {
      writeYaml(fixtureReceiptPath, mutate(readYaml(fixtureReceiptPath)));
      let rejected = false;
      try {
        loadLeadingBlankLineNormalization({ chart, recipeRoot: fixtureRecipeRoot, root: fixtureRoot });
      } catch {
        rejected = true;
      } finally {
        writeFileSync(fixtureReceiptPath, originalReceipt);
      }
      check(rejected, `${label} receipt mutation was accepted`);
    };
    rejectMutation("chart label", (receipt) => {
      receipt.metadata.labels["confighub.io/chart-ref"] = "bitnami/redis";
      return receipt;
    });
    rejectMutation("version label", (receipt) => {
      receipt.metadata.labels["confighub.io/chart-version"] = "25.5.3";
      return receipt;
    });
    rejectMutation("result", (receipt) => {
      receipt.spec.result = "watch";
      return receipt;
    });
    rejectMutation("receipt kind", (receipt) => {
      receipt.kind = "RenderReceipt";
      return receipt;
    });
    rejectMutation("default variant label", (receipt) => {
      receipt.metadata.labels["confighub.io/variant"] = "reuse-existing-secret";
      return receipt;
    });
    rejectMutation("render digest", (receipt) => {
      receipt.spec.regularHelm.renderedSHA256 = "0".repeat(64);
      return receipt;
    });
    rejectMutation("classification", (receipt) => {
      receipt.spec.classifications = receipt.spec.classifications.filter((item) => item.classification !== normalization.rule.rule);
      return receipt;
    });
    rejectMutation("probe path", (receipt) => {
      receipt.spec.classifications.find((item) => item.classification === normalization.rule.rule).paths = ["spec.template.spec.containers[0].env[0]"];
      return receipt;
    });
    const originalCorpus = readFileSync(fixtureCorpusPath, "utf8");
    const corpus = readYaml(fixtureCorpusPath);
    corpus.kind = "WrongCorpus";
    writeYaml(fixtureCorpusPath, corpus);
    let corpusRejected = false;
    try {
      loadLeadingBlankLineNormalization({ chart, recipeRoot: fixtureRecipeRoot, root: fixtureRoot });
    } catch {
      corpusRejected = true;
    } finally {
      writeFileSync(fixtureCorpusPath, originalCorpus);
    }
    check(corpusRejected, "corpus kind mutation was accepted");
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
  console.log("semantic normalization self-test passed: exact probe paths, content, structure, version and receipt binding are enforced");
}

function normalizeRelease(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return usage();
  const { chartPath, variant, valuesArgs, valuesFile, noIncludeCrds, baseVariant } = args;

  const recipeRoot = join(repoRoot, "recipes", chartPath);
  const packageRoot = join(repoRoot, "packages", chartPath);
  check(existsSync(join(recipeRoot, "recipe.yaml")), `no recipe at recipes/${chartPath}`);
  check(existsSync(join(packageRoot, "installer.yaml")), `no package at packages/${chartPath}`);

  const sourceLock = readYaml(join(recipeRoot, "source-lock.yaml"));
  const baseVariantPath = join(recipeRoot, "variants", baseVariant, "variant.yaml");
  check(
    existsSync(baseVariantPath),
    `no base variant at recipes/${chartPath}/variants/${baseVariant} (available: ${
      existsSync(join(recipeRoot, "variants")) ? readdirSync(join(recipeRoot, "variants")).join(", ") : "none"
    }) — pass --base <name>`,
  );
  const defaultVariant = readYaml(baseVariantPath);
  const chart = {
    repository: sourceLock.spec.repositoryName,
    repositoryURL: sourceLock.spec.repositoryURL,
    chart: sourceLock.spec.chart,
    ref: sourceLock.spec.ref ?? `${sourceLock.spec.repositoryName}/${sourceLock.spec.chart}`,
    version: String(sourceLock.spec.version),
    namespace: defaultVariant.spec?.namespace ?? "default",
    releaseName: defaultVariant.spec?.releaseName ?? sourceLock.spec.chart,
  };
  const artifact = `${chart.repository}-${chart.chart}-${chart.version}`;
  const labels = { "confighub.io/chart": chart.ref, "confighub.io/version": chart.version, "confighub.io/variant": variant };

  // 1. Render the variant (same render context as default + the values delta), deterministically.
  const helmSource = helmChartSource(sourceLock.spec);
  if (!helmSource.startsWith("oci://")) {
    try { ensureRepo(chart.repository, chart.repositoryURL); } catch { /* repo may already exist */ }
  }
  const renderFlags = noIncludeCrds ? RENDER_FLAGS.filter((f) => f !== "--include-crds") : RENDER_FLAGS;
  const renderArgs = ["template", chart.releaseName, helmSource, "--version", chart.version, "--namespace", chart.namespace, ...renderFlags, ...valuesArgs];
  const first = normalizeRelease(command("helm", renderArgs));
  const second = normalizeRelease(command("helm", renderArgs));
  check(first === second, `${chart.ref} ${variant} did not render deterministically`);
  const releaseObjects = first;
  const releaseDigest = sha256(releaseObjects);
  const docs = parseDocs(releaseObjects);
  const objects = parseObjects(releaseObjects);
  const requiredSecrets = requiredSecretKeyFacts(docs, chart.namespace);
  check(objects.length > 0, `${chart.ref} ${variant} rendered zero objects`);
  // A variant named "no-crds" must render zero CRDs, however it was built (--no-include-crds OR a chart
  // --set toggle). This catches template-baked CRDs that --no-include-crds can't strip AND partial/wrong
  // --set toggles that leave some CRDs behind — so the variant name never overstates what it delivers.
  if (noIncludeCrds || variant.includes("no-crds")) {
    const crdCount = docs.filter((d) => d.kind === "CustomResourceDefinition").length;
    check(crdCount === 0, `${chart.ref} ${variant}: still rendered ${crdCount} CRD(s) — a no-crds variant must render zero (template-baked CRDs, or a --set CRD toggle that did not strip them)`);
  }

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
  const check4 = packageAndSetupCheck(chart, recipeRoot, packageRoot, releaseObjects, objects.length, variant);
  check(check4.semanticDiffs.length === 0, `${chart.ref} ${variant} semantic diffs: ${check4.semanticDiffs.join(", ")}`);

  // 5. Recipe variant + effective-values + digest-bound revision + receipts.
  const valuesProfile = valuesArgs.filter((_, i) => i % 2 === 1).join("; ");
  const effectiveValuesSpec = { profile: variant, renderDelta: valuesProfile, mergedValuesCaptured: false, values: {} };
  if (valuesFile) {
    const valuesPath = join(repoRoot, valuesFile);
    check(existsSync(valuesPath), `values file not found: ${valuesFile}`);
    effectiveValuesSpec.valuesFile = valuesFile;
    effectiveValuesSpec.values = readYaml(valuesPath);
    effectiveValuesSpec.mergedValuesCaptured = true;
  }
  writeYaml(join(recipeRoot, "variants", variant, "variant.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: { name: variant, labels },
    spec: { recipe: "../../recipe.yaml", namespace: chart.namespace, releaseName: chart.releaseName, valuesProfile: `../../effective-values-${variant}.yaml`, capabilityProfile: { kubeVersion, apiVersions: [] }, hookPolicy: "no-hooks", ...(requiredSecrets.length ? { targetFacts: { requiredSecrets } } : {}) },
  });
  writeYaml(join(recipeRoot, `effective-values-${variant}.yaml`), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: { name: `${artifact}-${variant}`, labels },
    spec: effectiveValuesSpec,
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

  // Package bookkeeping must include the newly inferred prerequisites as well
  // as target facts on older bases. Verify the actual collector/setup output.
  const hasTargetFacts = listFiles(join(recipeRoot, "variants"))
    .filter((path) => path.endsWith("/variant.yaml"))
    .some((path) => readYaml(path).spec?.targetFacts);
  if (hasTargetFacts) {
    const syncArgs = ["scripts/sync-installer-target-facts.mjs", "--generate", "--recipe", relativeRepo(recipeRoot)];
    command(process.execPath, syncArgs);
    command(process.execPath, [syncArgs[0], "--verify", ...syncArgs.slice(2)]);
  }


  console.log(`promoted ${chart.ref}@${chart.version} :: ${variant}  (helm ${objects.length} objs == cub ${check4.cubObjectCount} incl Namespace; equivalence pass; release sha ${releaseDigest.slice(0, 12)})`);
}

function packageAndSetupCheck(chart, recipeRoot, packageRoot, releaseObjects, expectedObjectCount, base) {
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
    let normalization;
    let normalizationLoaded = false;
    const semanticDiffs = [];
    const allowedDiffClassifications = [];
    for (const key of helmKeys) {
      if (semantic.helm[key] === semantic.cub[key]) continue;
      if (!normalizationLoaded) {
        normalization = loadLeadingBlankLineNormalization({ chart, recipeRoot });
        normalizationLoaded = true;
      }
      if (normalization?.rule.identity === key && normalization.rule.rule === "leading-blank-line-pruned-by-kustomize") {
        const pruned = leadingBlankLinePruneMatches(semantic.helm[key], semantic.cub[key], normalization.paths);
        if (pruned.allowed) {
          allowedDiffClassifications.push({
            identity: key,
            classification: normalization.rule.rule,
            disposition: "allowed",
            paths: pruned.paths,
            reason: normalization.rule.reason,
            evidence: normalization.evidence,
          });
          continue;
        }
      }
      semanticDiffs.push(key);
    }
    return {
      bundleSHA256: sha256File(a),
      cubObjectCount: cubKeys.size,
      separatedSecretCount: listYamlFiles(join(workDir, "out", "secrets")).length,
      semanticObjectMatches: `${helmKeys.size}/${helmKeys.size}`,
      extraInCub,
      semanticDiffs,
      allowedDiffClassifications,
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
      digestInputs: { rendererSHA256: rendererFingerprint, renderedObjectSetSHA256: ctx.releaseDigest, variantSHA256: sha256File(join(recipeRoot, "variants", variant, "variant.yaml")) },
      rendered: { releaseObjects: "rendered/release-objects.yaml", objectInventory: "rendered/object-inventory.yaml" },
    },
  });
  const secretCount = ctx.docs.filter((d) => d.kind === "Secret").length;
  const scan = variantScanEvidence(ctx.docs, ctx.releaseDigest);
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
      ...(ctx.check4.allowedDiffClassifications?.length ? {
        semanticNormalizations: ctx.check4.allowedDiffClassifications.map((item) => item.classification),
        classifications: ctx.check4.allowedDiffClassifications,
      } : {}),
    },
  });
  writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ScanReceipt",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: scan,
  });
  writeYaml(join(receiptsRoot, "install-gate.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InstallGate",
    metadata: { name: `${variant}-r001`, labels: ctx.labels },
    spec: { renderedObjectSetSHA256: ctx.releaseDigest, decision: scan.result === "pass" ? "allow" : "warn", separatedSecretCount: secretCount },
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
    ...(check4.allowedDiffClassifications?.length ? {
      semanticNormalizations: check4.allowedDiffClassifications.map((item) => item.classification),
      normalizationClassifications: check4.allowedDiffClassifications,
    } : {}),
  });
  writeYaml(receiptPath, receipt);
}

if (process.argv[2] === "--self-test") { selfTestVariantScan(); selfTestHelmSources(); selfTestSemanticNormalization(); }
else main();
