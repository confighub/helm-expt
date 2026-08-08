import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

// These packages still carry the placeholder instead of a packaged CRD bundle,
// and the reason is not neglect. Each is frozen evidence of the Kubara catalog
// release: its bytes are pinned by the release scope manifest, compared against
// an exact promoted candidate, and bound by a publication receipt. Adding a
// bundle in place would make the retained package disagree with the candidate
// it was promoted from, so correcting them means re-promoting through the
// Kubara pipeline rather than editing the tree.
//
// The user-facing gap is real while this list is non-empty: anyone taking these
// bases is told to apply a CRD manifest the package does not contain. Issue
// #1359 tracks it. karpenter 1.14.0 had the same defect, sits outside the
// release scope, and is fixed rather than listed.
const FROZEN_RELEASE_PACKAGES = Object.freeze({
  "packages/argo-cd/argo-cd/10.1.3": "Kubara release evidence; re-promote to add the no-crds CRD bundle.",
  "packages/argo-cd/argo-cd/10.2.1": "Kubara release evidence; re-promote to add the no-crds CRD bundle.",
  "packages/external-secrets/external-secrets/2.7.0": "Kubara release evidence; re-promote to add the no-crds CRD bundle.",
  "packages/external-secrets/external-secrets/2.8.0": "Kubara release evidence; re-promote to add the no-crds CRD bundle.",
  "packages/jetstack/cert-manager/v1.21.0": "Kubara release evidence; re-promote to add the default CRD bundle.",
});

const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";
const recipeSelectors = parseRecipeSelectors(args.slice(1));
const targetCharts = selectTargetCharts(targetFactCharts(), recipeSelectors);
const crdSourceDocCache = new Map();
verifySuggestedSourceMerge();

if (mode === "--generate") {
  for (const chart of targetCharts) syncChart(chart);
  console.log(`synced installer target facts for ${targetCharts.length} chart(s)`);
} else if (mode === "--verify") {
  for (const chart of targetCharts) verifyChart(chart);
  console.log(`verified installer target facts for ${targetCharts.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/sync-installer-target-facts.mjs --generate [--recipe recipes/<repo>/<chart>/<version>]...
  node scripts/sync-installer-target-facts.mjs --verify [--recipe recipes/<repo>/<chart>/<version>]...`);
  process.exit(1);
}

function parseRecipeSelectors(selectorArgs) {
  const selectors = [];
  for (let index = 0; index < selectorArgs.length; index += 1) {
    check(selectorArgs[index] === "--recipe", `unknown argument ${selectorArgs[index]}`);
    const value = selectorArgs[index + 1];
    check(value && !value.startsWith("--"), "--recipe requires a recipe path");
    selectors.push(value.replace(/\/+$/, ""));
    index += 1;
  }
  return [...new Set(selectors)].sort();
}

function selectTargetCharts(charts, selectors) {
  if (selectors.length === 0) return charts;
  const chartByRecipe = new Map(charts.map((chart) => [relativeRepo(chart.recipeRoot), chart]));
  return selectors.map((selector) => {
    const chart = chartByRecipe.get(selector);
    check(Boolean(chart), `${selector} has no variants with target facts`);
    return chart;
  });
}

function targetFactCharts() {
  const variantFiles = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/variant.yaml"))
    .filter((file) => readYaml(file).spec?.targetFacts)
    .sort();
  const charts = new Map();
  for (const variantFile of variantFiles) {
    const recipeRoot = dirname(dirname(dirname(variantFile)));
    const variant = readYaml(variantFile);
    const entry = charts.get(recipeRoot) ?? {
      recipeRoot,
      variants: [],
      recipe: readYaml(join(recipeRoot, "recipe.yaml")),
      receiptPath: join(recipeRoot, "publication", "installer-package-receipt.yaml"),
    };
    entry.variants.push({ name: variant.metadata?.name, path: variantFile, targetFacts: variant.spec.targetFacts });
    charts.set(recipeRoot, entry);
  }
  return [...charts.values()].sort((left, right) => left.recipeRoot.localeCompare(right.recipeRoot));
}

function syncChart(chart) {
  const packageRoot = packageRootFor(chart);
  const installerPath = join(packageRoot, "installer.yaml");
  check(existsSync(installerPath), `${relativeRepo(chart.recipeRoot)} missing package installer`);
  check(existsSync(chart.receiptPath), `${relativeRepo(chart.recipeRoot)} missing installer package receipt`);
  const installer = readYaml(installerPath);
  const installerBefore = semanticJson(installer);
  const factsByVariant = new Map(chart.variants.map((variant) => [variant.name, variant.targetFacts]));
  writeCrdBundles(chart, packageRoot);

  installer.spec.collector = {
    command: "/bin/sh",
    args: ["collector/target-facts.sh"],
    description: "Records target-fact bindings and can live-check cluster-visible requirements.",
  };
  installer.spec.bases = (installer.spec.bases ?? []).map((base) => {
    const targetFacts = factsByVariant.get(base.name);
    const currentGenerated = (base.externalRequires ?? []).filter((item) => isGeneratedTargetFactRequire(item));
    const generated = targetFacts
      ? externalRequiresFor(targetFacts, base.name).map((requirement) =>
          preserveConcreteSuggestedSource(requirement, currentGenerated),
        )
      : [];
    const existing = (base.externalRequires ?? []).filter((item) => !isGeneratedTargetFactRequire(item));
    const next = { ...base };
    if (existing.length || generated.length) next.externalRequires = [...existing, ...generated];
    else delete next.externalRequires;
    return next;
  });
  if (semanticJson(installer) !== installerBefore) writeYaml(installerPath, installer);
  write(join(packageRoot, "collector", "target-facts.sh"), collectorScript(installer.spec.bases ?? [], factsByVariant));

  const receipt = readYaml(chart.receiptPath);
  const receiptBefore = semanticJson(receipt);
  receipt.spec.package.sourceFiles = packageSourceFiles(packageRoot);
  const bundle = deterministicBundle(packageRoot, receipt.spec.package.path);
  receipt.spec.deterministicBundle.sha256 = bundle.sha256;
  receipt.spec.deterministicBundle.byteIdenticalAcrossTwoLocalBundles = true;
  receipt.spec.setupChecks = (receipt.spec.setupChecks ?? []).map((item) => ({
    ...item,
    targetFactMode: factsByVariant.has(item.variant) ? "collector-facts" : "not-required",
    targetFactsBound: factsByVariant.has(item.variant),
  }));
  if (semanticJson(receipt) !== receiptBefore) writeYaml(chart.receiptPath, receipt);
}

function semanticJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => semanticJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${semanticJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function verifyChart(chart) {
  const packageRoot = packageRootFor(chart);
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const receipt = readYaml(chart.receiptPath);
  const factsByVariant = new Map(chart.variants.map((variant) => [variant.name, variant.targetFacts]));

  check(installer.spec?.collector?.command === "/bin/sh", `${relativeRepo(packageRoot)} must declare target-facts collector`);
  check(
    JSON.stringify(installer.spec?.collector?.args ?? []) === JSON.stringify(["collector/target-facts.sh"]),
    `${relativeRepo(packageRoot)} collector must run collector/target-facts.sh`,
  );
  check(existsSync(join(packageRoot, "collector", "target-facts.sh")), `${relativeRepo(packageRoot)} missing collector script`);

  const bases = installer.spec?.bases ?? [];
  for (const [variantName, targetFacts] of factsByVariant.entries()) {
    const base = bases.find((item) => item.name === variantName);
    check(Boolean(base), `${relativeRepo(packageRoot)} missing target-fact base ${variantName}`);
    const expected = externalRequiresFor(targetFacts, variantName);
    for (const requirement of expected) {
      const actualRequirement = (base.externalRequires ?? []).find((item) => sameRequire(item, requirement));
      check(
        Boolean(actualRequirement),
        `${relativeRepo(packageRoot)} base ${variantName} missing requirement ${requirement.name}`,
      );
      if (requirement.suggestedSource?.startsWith("package://")) {
        const frozen = FROZEN_RELEASE_PACKAGES[relativeRepo(packageRoot)];
        check(
          actualRequirement.suggestedSource === requirement.suggestedSource || Boolean(frozen),
          `${relativeRepo(packageRoot)} base ${variantName} must point ${requirement.name} at its packaged CRD bundle`,
        );
      }
      if (requirement.applyMode) {
        check(
          actualRequirement.applyMode === requirement.applyMode,
          `${relativeRepo(packageRoot)} base ${variantName} apply mode mismatch for ${requirement.name}`,
        );
      }
    }
    verifyCrdBundle(chart, packageRoot, variantName, targetFacts);
    const setupCheck = (receipt.spec?.setupChecks ?? []).find((item) => item.variant === variantName);
    check(Boolean(setupCheck), `${relativeRepo(chart.receiptPath)} missing setup check for ${variantName}`);
    check(setupCheck.targetFactMode === "collector-facts", `${variantName} receipt targetFactMode mismatch`);
    check(setupCheck.targetFactsBound === true, `${variantName} receipt targetFactsBound mismatch`);
    verifySetupFacts(packageRoot, variantName, targetFacts);
  }

  const receiptFiles = receipt.spec?.package?.sourceFiles ?? [];
  const actualFiles = packageSourceFiles(packageRoot);
  check(receiptFiles.length === actualFiles.length, `${relativeRepo(packageRoot)} source file count mismatch`);
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  for (const file of receiptFiles) {
    const actual = actualByPath.get(file.path);
    check(Boolean(actual), `${relativeRepo(chart.receiptPath)} references missing ${file.path}`);
    check(actual.sha256 === file.sha256, `${relativeRepo(packageRoot)} SHA mismatch for ${file.path}`);
    check(actual.bytes === file.bytes, `${relativeRepo(packageRoot)} byte count mismatch for ${file.path}`);
  }
}

function verifySetupFacts(packageRoot, variantName, targetFacts) {
  const tempRoot = mkdtempSync(join("/tmp", "helm-expt-target-facts-"));
  let ok = false;
  try {
    const namespace = firstNamespace(targetFacts) ?? "default";
    runCub([
      "installer",
      "setup",
      "--pull",
      packageRoot,
      "--base",
      variantName,
      "--work-dir",
      tempRoot,
      "--non-interactive",
      "--namespace",
      namespace,
    ]);
    const facts = readYaml(join(tempRoot, "out", "spec", "facts.yaml"));
    check(facts.kind === "Facts", `${variantName} setup must write Facts`);
    const values = facts.spec?.values ?? {};
    check(values.targetFactChecks?.base === variantName, `${variantName} facts base mismatch`);
    check(values.targetFactChecks?.mode === "record", `${variantName} facts mode mismatch`);
    check(values.targetFactChecks?.result === "recorded", `${variantName} facts result mismatch`);
    check(
      JSON.stringify(values.targetFacts?.requiredSecrets ?? []) === JSON.stringify(targetFacts.requiredSecrets ?? []),
      `${variantName} facts requiredSecrets mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredCRDs ?? []) === JSON.stringify(targetFacts.requiredCRDs ?? []),
      `${variantName} facts requiredCRDs mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredValues ?? []) === JSON.stringify(targetFacts.requiredValues ?? []),
      `${variantName} facts requiredValues mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredObjectStores ?? []) === JSON.stringify(targetFacts.requiredObjectStores ?? []),
      `${variantName} facts requiredObjectStores mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredNamespaces ?? []) === JSON.stringify(targetFacts.requiredNamespaces ?? []),
      `${variantName} facts requiredNamespaces mismatch`,
    );
    check(
      JSON.stringify(values.targetFacts?.requiredTopology ?? null) === JSON.stringify(targetFacts.requiredTopology ?? null),
      `${variantName} facts requiredTopology mismatch`,
    );
    ok = true;
  } finally {
    if (ok) rmSync(tempRoot, { recursive: true, force: true });
    else console.error(`Left target-facts verification workspace for inspection: ${tempRoot}`);
  }
}

function packageRootFor(chart) {
  const receipt = readYaml(chart.receiptPath);
  const packagePath = receipt.spec?.package?.path ?? chart.recipe.spec?.currentExecutableFixture?.installerPackage;
  check(packagePath, `${relativeRepo(chart.recipeRoot)} missing installer package path`);
  return join(repoRoot, packagePath);
}

function externalRequiresFor(targetFacts, variantName) {
  const requirements = (targetFacts.requiredSecrets ?? []).map((secret) => ({
    kind: "ClusterFeature",
    name: secretRequirementName(secret),
    namespace: secret.namespace ?? "",
    suggestedSource:
      secret.suggestedSource ??
      ((secret.keys ?? []).length
        ? `kubectl -n ${secret.namespace ?? "default"} create secret generic ${secret.name} ${(secret.keys ?? [])
            .map((key) => `--from-literal=${key}=<value>`)
            .join(" ")}`
        : `kubectl -n ${secret.namespace ?? "default"} apply -f <secret-manifest.yaml>`),
  }));
  requirements.push(
    ...(targetFacts.requiredCRDs ?? []).map((crd) => ({
      kind: "ClusterFeature",
      name: crdRequirementName(crd),
      suggestedSource: usesExplicitPackagedCrdSource(crd)
        ? crd.suggestedSource
        : `package://${crdBundleRelativePath(variantName)}`,
      ...(crd.applyMode ? { applyMode: crd.applyMode } : {}),
    })),
  );
  requirements.push(
    ...(targetFacts.requiredNamespaces ?? []).map((namespace) => ({
      kind: "ClusterFeature",
      name: namespaceRequirementName(namespace),
      namespace: namespace.name ?? "",
      suggestedSource: namespace.suggestedSource ?? `kubectl create namespace ${namespace.name}`,
    })),
  );
  requirements.push(
    ...(targetFacts.requiredObjectStores ?? []).map((store) => ({
      kind: "ClusterFeature",
      name: objectStoreRequirementName(store),
      namespace: store.namespace ?? "",
      suggestedSource: store.suggestedSource ?? "create or bind an S3-compatible endpoint, bucket, and credentials before apply",
    })),
  );
  if (targetFacts.requiredTopology?.minimumSchedulableNodes) {
    requirements.push({
      kind: "ClusterFeature",
      name: topologyRequirementName(targetFacts.requiredTopology),
      suggestedSource:
        targetFacts.requiredTopology.suggestedSource ??
        `use a target with at least ${targetFacts.requiredTopology.minimumSchedulableNodes} schedulable nodes before applying this base`,
    });
  }
  return requirements;
}

function writeCrdBundles(chart, packageRoot) {
  const generatedRoot = join(packageRoot, "prerequisites", "target-facts");
  rmSync(generatedRoot, { recursive: true, force: true });
  for (const variant of chart.variants) {
    const requiredCRDs = (variant.targetFacts.requiredCRDs ?? [])
      .filter((crd) => !usesExplicitPackagedCrdSource(crd));
    if (requiredCRDs.length === 0) continue;
    const docs = requiredCrdDocs(chart, variant.name, requiredCRDs);
    write(
      join(packageRoot, crdBundleRelativePath(variant.name)),
      crdBundleYaml(chart, variant, docs),
    );
  }
}

function verifyCrdBundle(chart, packageRoot, variantName, targetFacts) {
  const allRequiredCRDs = targetFacts.requiredCRDs ?? [];
  const staticCRDs = allRequiredCRDs.filter((crd) => !usesExplicitPackagedCrdSource(crd));
  const packagedCRDs = allRequiredCRDs.filter(usesExplicitPackagedCrdSource);

  if (staticCRDs.length) {
    const bundlePath = join(packageRoot, crdBundleRelativePath(variantName));
    // A frozen release package cannot gain the bundle without re-promotion, so
    // the gap is declared above rather than failing here. Everything else about
    // the base is still checked.
    if (FROZEN_RELEASE_PACKAGES[relativeRepo(packageRoot)] && !existsSync(bundlePath)) return;
    check(existsSync(bundlePath), `${relativeRepo(packageRoot)} base ${variantName} missing packaged CRD bundle`);
    const docs = parseDocs(readFileSync(bundlePath, "utf8"));
    const actualNames = docs
      .filter((doc) => doc.kind === "CustomResourceDefinition")
      .map((doc) => doc.metadata?.name)
      .filter(Boolean)
      .sort();
    const expectedNames = staticCRDs.map((crd) => crd.name).sort();
    check(
      JSON.stringify(actualNames) === JSON.stringify(expectedNames),
      `${relativeRepo(bundlePath)} must contain exactly the static CRDs declared by ${variantName}`,
    );
    requiredCrdDocs(chart, variantName, staticCRDs);
  }

  for (const crd of packagedCRDs) {
    const suggestedSource = String(crd.suggestedSource ?? "");
    check(
      suggestedSource.startsWith("package://"),
      `${relativeRepo(chart.recipeRoot)} base ${variantName} packaged CRD ${crd.name} must name a package:// source`,
    );
    const relativePath = suggestedSource.slice("package://".length);
    check(
      relativePath && !relativePath.split("/").includes(".."),
      `${relativeRepo(chart.recipeRoot)} base ${variantName} packaged CRD ${crd.name} has an unsafe package path`,
    );
    check(
      existsSync(join(packageRoot, relativePath)),
      `${relativeRepo(chart.recipeRoot)} base ${variantName} packaged CRD ${crd.name} source is missing: ${relativePath}`,
    );
    if (isOperatorBootstrapCrd(crd)) {
      check(
        Array.isArray(crd.evidence) && crd.evidence.length > 0,
        `${relativeRepo(chart.recipeRoot)} base ${variantName} operator-bootstrap CRD ${crd.name} needs observed evidence`,
      );
    }
  }
}

function isOperatorBootstrapCrd(crd) {
  return crd?.provisioningMode === "operator-bootstrap";
}

function usesExplicitPackagedCrdSource(crd) {
  return isOperatorBootstrapCrd(crd)
    || String(crd?.suggestedSource ?? "").startsWith("package://");
}

function requiredCrdDocs(chart, variantName, requiredCRDs) {
  const seen = new Set();
  return requiredCRDs.map((crd) => {
    check(crd.name, `${relativeRepo(chart.recipeRoot)} base ${variantName} has a CRD without a name`);
    check(!seen.has(crd.name), `${relativeRepo(chart.recipeRoot)} base ${variantName} repeats CRD ${crd.name}`);
    seen.add(crd.name);
    const sourcePath = crd.sourcePath
      ? resolve(chart.recipeRoot, crd.sourcePath)
      : join(
          chart.recipeRoot,
          "revisions",
          crd.sourceVariant ?? "default",
          "r001",
          "rendered",
          "release-objects.yaml",
        );
    check(
      existsSync(sourcePath),
      `${relativeRepo(chart.recipeRoot)} base ${variantName} CRD ${crd.name} source does not exist: ${relativeRepo(sourcePath)}`,
    );
    if (crd.sourceSHA256) {
      check(
        sha256File(sourcePath) === crd.sourceSHA256,
        `${relativeRepo(chart.recipeRoot)} base ${variantName} CRD ${crd.name} source SHA mismatch: ${relativeRepo(sourcePath)}`,
      );
    }
    if (!crdSourceDocCache.has(sourcePath)) {
      crdSourceDocCache.set(sourcePath, parseDocs(readFileSync(sourcePath, "utf8")));
    }
    const matches = crdSourceDocCache
      .get(sourcePath)
      .filter(
        (doc) =>
          doc.kind === "CustomResourceDefinition" &&
          doc.metadata?.name === crd.name,
      );
    check(
      matches.length === 1,
      `${relativeRepo(chart.recipeRoot)} base ${variantName} must resolve CRD ${crd.name} exactly once in ${relativeRepo(sourcePath)}`,
    );
    return matches[0];
  });
}

function crdBundleRelativePath(variantName) {
  const slug = String(variantName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  check(Boolean(slug), `cannot create a CRD bundle path for base ${variantName}`);
  return `prerequisites/target-facts/${slug}-crds.yaml`;
}

function crdBundleYaml(chart, variant, docs) {
  const body = execFileSync(
    "python3",
    [
      "-c",
      `import json,sys,yaml
docs=json.loads(sys.stdin.read())
print(yaml.safe_dump_all(docs, explicit_start=True, sort_keys=False, width=100000).rstrip())
`,
    ],
    {
      input: JSON.stringify(docs),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 200,
    },
  );
  return `# Generated from ${relativeRepo(variant.path)}.
# These are the exact CRDs named by this base variant's recorded target facts.
# Apply them before the rendered workload objects; do not edit this generated copy.
${body.trimEnd()}
`;
}

function preserveConcreteSuggestedSource(requirement, currentRequirements) {
  const current = currentRequirements.find((item) => sameRequire(item, requirement));
  if (
    current?.suggestedSource &&
    hasPlaceholder(requirement.suggestedSource) &&
    !hasPlaceholder(current.suggestedSource) &&
    isExecutableSuggestedSource(current.suggestedSource)
  ) {
    return { ...requirement, suggestedSource: current.suggestedSource };
  }
  return requirement;
}

function hasPlaceholder(value) {
  return typeof value === "string" && /<[^>]+>/.test(value);
}

function isExecutableSuggestedSource(value) {
  return /^(kubectl|helm|bash|sh|cub|flux|argocd|curl)\b/.test(String(value ?? "").trim());
}

function verifySuggestedSourceMerge() {
  const identity = {
    kind: "ClusterFeature",
    name: "Secret default/example key password",
    namespace: "default",
  };
  const generic = { ...identity, suggestedSource: "kubectl create secret generic example --from-literal=password=<value>" };
  const concrete = {
    ...identity,
    suggestedSource: 'kubectl create secret generic example --from-literal=password="$(openssl rand -base64 32)"',
  };
  check(
    preserveConcreteSuggestedSource(generic, [concrete]).suggestedSource === concrete.suggestedSource,
    "target-fact sync must preserve an existing concrete setup command",
  );
  check(
    preserveConcreteSuggestedSource(concrete, [generic]).suggestedSource === concrete.suggestedSource,
    "target-fact sync must prefer a new concrete setup command",
  );
  check(
    preserveConcreteSuggestedSource(generic, [{ ...identity, suggestedSource: "Create this Secret before apply." }])
      .suggestedSource === generic.suggestedSource,
    "target-fact sync must not preserve prose as an executable setup command",
  );
}

function secretRequirementName(secret) {
  const keys = secret.keys ?? [];
  if (keys.length === 0) return `Secret ${secret.namespace ?? "default"}/${secret.name}`;
  const keyLabel = keys.length === 1 ? "key" : "keys";
  return `Secret ${secret.namespace ?? "default"}/${secret.name} ${keyLabel} ${keys.join(",")}`;
}

function crdRequirementName(crd) {
  return `CRD ${crd.name}`;
}

function objectStoreRequirementName(store) {
  return `S3-compatible object store ${store.namespace ?? "default"}/${store.name}`;
}

function namespaceRequirementName(namespace) {
  return `Namespace ${namespace.name}`;
}

function topologyRequirementName(topology) {
  return `minimum schedulable nodes ${topology.minimumSchedulableNodes}`;
}

function isGeneratedTargetFactRequire(item) {
  return item?.kind === "ClusterFeature" && typeof item.name === "string" && (
    item.name.startsWith("Secret ") ||
    item.name.startsWith("CRD ") ||
    item.name.startsWith("Namespace ") ||
    item.name.startsWith("S3-compatible object store ") ||
    item.name.startsWith("minimum schedulable nodes ")
  );
}

function sameRequire(left, right) {
  return left.kind === right.kind && left.name === right.name && (left.namespace ?? "") === (right.namespace ?? "");
}

function collectorScript(bases, factsByVariant) {
  const hasRequiredNamespaces = [...factsByVariant.values()].some((targetFacts) => (targetFacts.requiredNamespaces ?? []).length);
  const cases = bases
    .filter((base) => factsByVariant.has(base.name))
    .map((base) => collectorCase(base.name, factsByVariant.get(base.name), hasRequiredNamespaces))
    .join("\n");
  return `#!/bin/sh
set -eu

base="\${INSTALLER_BASE:-default}"
check_mode="\${TARGET_FACT_CHECK_MODE:-record}"

emit_empty() {
  cat <<YAML
targetFacts:
  requiredSecrets: []
  requiredCRDs: []
  requiredValues: []
  requiredObjectStores: []
${hasRequiredNamespaces ? "  requiredNamespaces: []\n" : ""}\
  requiredTopology: null
targetFactChecks:
  base: "$base"
  mode: not-required
  result: pass
YAML
}

live_check_secret() {
  namespace="$1"
  name="$2"
  key="$3"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl -n "$namespace" get secret "$name" >/dev/null 2>&1; then
    echo "required Secret $namespace/$name was not found" >&2
    exit 1
  fi
  if [ -z "$key" ]; then
    return 0
  fi
  if ! kubectl -n "$namespace" get secret "$name" -o yaml | awk -v key="$key" '$1 == key ":" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "required Secret $namespace/$name is missing key $key" >&2
    exit 1
  fi
}

live_check_crd() {
  name="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl get crd "$name" >/dev/null 2>&1; then
    echo "required CRD $name was not found" >&2
    exit 1
  fi
}
${hasRequiredNamespaces ? `
live_check_namespace() {
  name="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl get namespace "$name" >/dev/null 2>&1; then
    echo "required Namespace $name was not found" >&2
    exit 1
  fi
}
` : ""}
live_check_min_schedulable_nodes() {
  required="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  count="$(kubectl get nodes -o jsonpath='{range .items[*]}{.spec.unschedulable}{"\\n"}{end}' | awk '$1 != "true" { c++ } END { print c + 0 }')"
  if [ "$count" -lt "$required" ]; then
    echo "required at least $required schedulable node(s); found $count" >&2
    exit 1
  fi
}

case "$base" in
${cases}
  *)
    emit_empty
    ;;
esac
`;
}

function collectorCase(variantName, targetFacts, includeNamespaces) {
  const checks = (targetFacts.requiredSecrets ?? [])
    .flatMap((secret) =>
      (secret.keys ?? []).length
        ? (secret.keys ?? []).map((key) => `      live_check_secret ${shellQuote(secret.namespace ?? "default")} ${shellQuote(secret.name)} ${shellQuote(key)}`)
        : [`      live_check_secret ${shellQuote(secret.namespace ?? "default")} ${shellQuote(secret.name)} ''`],
    )
    .concat((targetFacts.requiredCRDs ?? []).map((crd) => `      live_check_crd ${shellQuote(crd.name)}`))
    .concat(
      includeNamespaces
        ? (targetFacts.requiredNamespaces ?? []).map((namespace) => `      live_check_namespace ${shellQuote(namespace.name)}`)
        : [],
    )
    .concat(
      targetFacts.requiredTopology?.minimumSchedulableNodes
        ? [`      live_check_min_schedulable_nodes ${shellQuote(targetFacts.requiredTopology.minimumSchedulableNodes)}`]
        : [],
    )
    .join("\n");
  return `  ${shellQuote(variantName)})
    if [ "$check_mode" = "live" ]; then
${checks || "    true"}
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
${indentYaml({ requiredSecrets: targetFacts.requiredSecrets ?? [] }, 2)}
${indentYaml({ requiredCRDs: targetFacts.requiredCRDs ?? [] }, 2)}
${indentYaml({ requiredValues: targetFacts.requiredValues ?? [] }, 2)}
${indentYaml({ requiredObjectStores: targetFacts.requiredObjectStores ?? [] }, 2)}
${includeNamespaces ? `${indentYaml({ requiredNamespaces: targetFacts.requiredNamespaces ?? [] }, 2)}\n` : ""}\
${indentYaml({ requiredTopology: targetFacts.requiredTopology ?? null }, 2)}
targetFactChecks:
  base: "${variantName}"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;`;
}

function indentYaml(value, spaces) {
  const json = JSON.stringify(value);
  const text = execFileSync(
    "python3",
    [
      "-c",
      `import json,sys,yaml
data=json.loads(sys.stdin.read())
print(yaml.safe_dump(data, sort_keys=False).rstrip())
`,
    ],
    { input: json, encoding: "utf8" },
  );
  return text
    .split("\n")
    .map((line) => (line.length ? `${" ".repeat(spaces)}${line}` : ""))
    .join("\n");
}

function firstNamespace(targetFacts) {
  return targetFacts.requiredSecrets?.find((secret) => secret.namespace)?.namespace;
}

function packageSourceFiles(packageRoot) {
  return listFiles(packageRoot).map((path) => ({
    path: relative(packageRoot, path).replaceAll("\\", "/"),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
}

function deterministicBundle(packageRoot, packageRelative) {
  const tempRoot = mkdtempSync(join("/tmp", "helm-expt-package-"));
  try {
    const first = join(tempRoot, "a.tgz");
    const second = join(tempRoot, "b.tgz");
    runCub(["installer", "package", packageRoot, "-o", first]);
    runCub(["installer", "package", packageRoot, "-o", second]);
    check(sha256File(first) === sha256File(second), `${packageRelative} package SHA changed between runs`);
    check(readFileSync(first).equals(readFileSync(second)), `${packageRelative} package bytes changed between runs`);
    return { sha256: sha256File(first) };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runCub(cubArgs) {
  return execFileSync("cub", cubArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function cubEnv() {
  const env = { ...process.env, CONFIGHUB_AGENT: "1" };
  try {
    const goPath = execFileSync("go", ["env", "GOPATH"], { encoding: "utf8" }).trim();
    const goBin = join(goPath, "bin");
    if (!env.PATH?.split(":").includes(goBin)) env.PATH = `${env.PATH ?? ""}:${goBin}`;
  } catch {
    // Let cub/kustomize fail clearly if the local toolchain is incomplete.
  }
  return env;
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\"'\"'")}'`;
}
