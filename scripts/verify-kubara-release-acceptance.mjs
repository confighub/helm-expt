#!/usr/bin/env node

// One deterministic front door for the Kubara + ConfigHub release. The
// static lane is deliberately offline. The full lane additionally requires
// immutable promotions, serial live receipts, the faithful hub/spoke proof,
// the clean-room mini-IDP receipt, and a freshly generated public site.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  writeYaml,
} from "./lib/proof-common.mjs";
import {
  KUBARA_CATALOG_ADDITIONS,
  KUBARA_CATALOG_BASELINE,
  KUBARA_CURRENT_ADDITIONS,
  KUBARA_HISTORICAL_ADDITIONS,
  KUBARA_OCI_PACKAGES,
  KUBARA_PROMOTION_RECEIPTS,
} from "./lib/kubara-catalog-release.mjs";

const mode = process.argv[2] ?? "--verify-static";
if (!["--generate", "--verify-static", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-kubara-release-acceptance.mjs --generate
  node scripts/verify-kubara-release-acceptance.mjs --verify-static
  node scripts/verify-kubara-release-acceptance.mjs --verify`);
  process.exit(2);
}

const contractRelative = "data/kubara-release-acceptance/contract.yaml";
const contractPath = join(repoRoot, contractRelative);
const baseline = {
  count: KUBARA_CATALOG_BASELINE.versionCount,
  recipesTreeSHA256: KUBARA_CATALOG_BASELINE.recipesTreeSHA256,
  packagesTreeSHA256: KUBARA_CATALOG_BASELINE.packagesTreeSHA256,
};
const historicalAdditions = [...KUBARA_HISTORICAL_ADDITIONS];
const currentAdditions = [...KUBARA_CURRENT_ADDITIONS];
const additions = [...KUBARA_CATALOG_ADDITIONS];

const packageCommands = {
  "kubara-catalog-promotion:dry-run": "node scripts/promote-kubara-catalog-candidates.mjs --dry-run",
  "kubara-catalog-promotion:stage": "node scripts/promote-kubara-catalog-candidates.mjs --stage",
  "kubara-catalog-promotion:stage:verify": "node scripts/promote-kubara-catalog-candidates.mjs --verify-stage",
  "kubara-catalog-promotion:promote": "node scripts/promote-kubara-catalog-candidates.mjs --promote",
  "kubara-catalog-candidates:verify": "node scripts/run-kubara-catalog-candidates.mjs --verify",
  "kubara-current-catalog-promotion:dry-run": "node scripts/promote-kubara-catalog-candidates.mjs --dry-run --current",
  "kubara-current-catalog-promotion:stage": "node scripts/promote-kubara-catalog-candidates.mjs --stage --current",
  "kubara-current-catalog-promotion:stage:verify": "node scripts/promote-kubara-catalog-candidates.mjs --verify-stage --current",
  "kubara-current-catalog-promotion:promote": "node scripts/promote-kubara-catalog-candidates.mjs --promote --current",
  "kubara-current-catalog-candidates:verify": "node scripts/run-kubara-current-catalog-candidates.mjs --verify",
  "kubara-catalog-adapter:verify": "node scripts/generate-kubara-catalog-adapter.mjs --verify",
  "kubara-current-example:verify": "node scripts/generate-kubara-current-example.mjs --verify",
  "kubara-effective-renders:verify": "node scripts/generate-kubara-effective-renders.mjs --verify --all",
  "kubara-wiring:verify": "node scripts/generate-kubara-wiring.mjs --verify --all",
  "kubara-platform-matrix:verify": "node scripts/generate-kubara-platform-matrix.mjs --verify --all",
  "kubara-platform-matrix:generate": "node scripts/generate-kubara-platform-matrix.mjs --generate --all",
  "kubara-catalog-promotion:verify": "node scripts/promote-kubara-catalog-candidates.mjs --verify",
  "kubara-current-catalog-promotion:verify": "node scripts/promote-kubara-catalog-candidates.mjs --verify --current",
  "kubara-catalog-oci:verify": "node scripts/publish-kubara-catalog-additions.mjs --verify",
  "kubara-catalog-oci:dry-run": "node scripts/publish-kubara-catalog-additions.mjs --dry-run",
  "kubara-catalog-oci:self-test": "node scripts/publish-installer-oci-packages.mjs --self-test && node scripts/publish-kubara-catalog-additions.mjs --dry-run",
  "kubara-catalog-oci:publish": "node scripts/publish-kubara-catalog-additions.mjs --publish",
  "kubara-catalog-release:generate": "node scripts/generate-kubara-catalog-release.mjs --generate",
  "kubara-catalog-release:verify": "node scripts/generate-kubara-catalog-release.mjs --verify",
  "kubara-live-qualification:verify": "node scripts/run-kubara-live-qualification.mjs --verify",
  "kubara-live-qualification:preflight": "node scripts/run-kubara-live-qualification.mjs --preflight",
  "kubara-live-qualification:run": "node scripts/run-kubara-live-qualification.mjs --run",
  "kubara-current-live-qualification:verify": "node scripts/run-kubara-live-qualification.mjs --verify --current",
  "kubara-current-live-qualification:preflight": "node scripts/run-kubara-live-qualification.mjs --preflight --current",
  "kubara-current-live-qualification:run": "node scripts/run-kubara-live-qualification.mjs --run --current",
  "kubara-faithful-hub-spoke:rehearse": "node scripts/run-kubara-faithful-hub-spoke-proof.mjs --rehearse",
  "kubara-faithful-hub-spoke:run": "node scripts/run-kubara-faithful-hub-spoke-proof.mjs --run",
  "kubara-faithful-hub-spoke:generate": "node scripts/run-kubara-faithful-hub-spoke-proof.mjs --generate",
  "kubara-faithful-hub-spoke:verify": "node scripts/run-kubara-faithful-hub-spoke-proof.mjs --verify",
  "kubara-mini-idp:plan": "node scripts/reconcile-kubara-mini-idp.mjs --plan",
  "kubara-mini-idp:apply": "node scripts/reconcile-kubara-mini-idp.mjs --apply",
  "kubara-mini-idp:verify": "node scripts/reconcile-kubara-mini-idp.mjs --verify",
  "kubara-mini-idp:receipt-verify": "node scripts/reconcile-kubara-mini-idp.mjs --receipt-verify",
  "kubara-release:generate": "node scripts/verify-kubara-release-acceptance.mjs --generate",
  "kubara-release:verify-static": "node scripts/verify-kubara-release-acceptance.mjs --verify-static",
  "kubara-release:verify": "node scripts/verify-kubara-release-acceptance.mjs --verify",
};

const offlineCommands = [
  command("catalog-adapter", "scripts/generate-kubara-catalog-adapter.mjs", "--verify"),
  command("historical-candidates", "scripts/run-kubara-catalog-candidates.mjs", "--verify"),
  command("current-candidates", "scripts/run-kubara-current-catalog-candidates.mjs", "--verify"),
  command("catalog-oci-idempotency", "scripts/publish-installer-oci-packages.mjs", "--self-test"),
  command("catalog-oci-scope-dry-run", "scripts/publish-kubara-catalog-additions.mjs", "--dry-run"),
  command("current-example", "scripts/generate-kubara-current-example.mjs", "--verify"),
  command("effective-renders", "scripts/generate-kubara-effective-renders.mjs", "--verify", "--all"),
  command("wiring", "scripts/generate-kubara-wiring.mjs", "--verify", "--all"),
  command("wiring-self-test", "scripts/generate-kubara-wiring.mjs", "--self-test"),
  command("platform-matrix", "scripts/generate-kubara-platform-matrix.mjs", "--verify", "--all"),
  command("platform-matrix-self-test", "scripts/generate-kubara-platform-matrix.mjs", "--self-test"),
];

const finalCommands = [
  command("historical-live-qualification", "scripts/run-kubara-live-qualification.mjs", "--verify"),
  command("current-live-qualification", "scripts/run-kubara-live-qualification.mjs", "--verify", "--current"),
  command("historical-root-promotion", "scripts/promote-kubara-catalog-candidates.mjs", "--verify"),
  command("current-root-promotion", "scripts/promote-kubara-catalog-candidates.mjs", "--verify", "--current"),
  command("faithful-hub-spoke", "scripts/run-kubara-faithful-hub-spoke-proof.mjs", "--verify"),
  command("mini-idp", "scripts/reconcile-kubara-mini-idp.mjs", "--receipt-verify"),
  command("catalog-public-release", "scripts/generate-kubara-catalog-release.mjs", "--verify"),
];

if (mode === "--generate") {
  writeYaml(contractPath, expectedContract());
  verifyStatic();
  console.log(`generated and verified ${contractRelative}`);
} else if (mode === "--verify-static") {
  verifyStatic();
  console.log("verified offline Kubara + ConfigHub release acceptance inputs");
} else {
  verifyStatic();
  verifyFinalState();
  for (const item of finalCommands) run(item);
  console.log("verified final Kubara + ConfigHub release acceptance");
}

function command(id, script, ...args) {
  return { id, script, args, display: ["node", script, ...args].join(" ") };
}

function expectedContract() {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "KubaraConfigHubReleaseAcceptance",
    metadata: { name: "kubara-v0-13-0-confighub-mini-idp" },
    spec: {
      outcome: "ConfigHub simplifies Kubara without making it fundamentally different.",
      operatingModel: "Kubara composes; ConfigHub governs; Argo reconciles.",
      adoption: {
        requiredAIRewrite: false,
        kubaraConfigAndOverridesRetained: true,
        catalogGenerationParity: "byte-for-byte",
        kubaraVersion: "v0.13.0",
        kubaraCatalogVersion: "1.1.0",
        clusters: 4,
        selectedPlatformRoles: 7,
        applications: ["hx-web", "cubbychat"],
        reconcilerPlan: {
          spaces: 53,
          managedUnits: 60,
          deployments: 27,
          needsProvidesLinks: 25,
          payloadsBeforeFaithfulEvidence: 53,
          payloadsReadyForApply: 54,
        },
        desiredMatrixRows: 36,
      },
      catalog: {
        role: "component-first",
        retention: "additive-only-non-overwrite",
        exactVersionPolicy: "fail-if-missing",
        baselineRootVersions: baseline.count,
        historicalAdditions: historicalAdditions.length,
        currentAdditions: currentAdditions.length,
        expectedFinalRootVersions: baseline.count + additions.length,
        baselineRecipesTreeSHA256: baseline.recipesTreeSHA256,
        baselinePackagesTreeSHA256: baseline.packagesTreeSHA256,
        historicalAdditionPaths: historicalAdditions,
        currentAdditionPaths: currentAdditions,
        requiredOciPublicationPackages: [...KUBARA_OCI_PACKAGES],
        promotionSafety: {
          baselineLock: "110 recipe roots and 110 package roots are byte-locked",
          ordering: "historical-7-then-current-3",
          overwritePolicy: "never-overwrite-existing-bytes",
          retryPolicy: "fill-missing-files-and-accept-only-byte-identical-residue",
          requiredReceipts: [...KUBARA_PROMOTION_RECEIPTS],
        },
        publicationSafety: {
          scope: "exactly-ten-additive-packages",
          retryPolicy: "reuse-only-an-existing-identical-layer",
          conflictPolicy: "refuse-existing-different-layer",
          verification: "local-source-tree-and-archive-plus-remote-manifest-and-layer",
        },
      },
      orderedReleaseCommands: [
        "npm run kubara-release:verify-static",
        "npm run kubara-live-qualification:preflight",
        "npm run kubara-live-qualification:run",
        "npm run kubara-live-qualification:verify",
        "npm run kubara-current-live-qualification:preflight",
        "npm run kubara-current-live-qualification:run",
        "npm run kubara-current-live-qualification:verify",
        "npm run kubara-catalog-promotion:dry-run",
        "npm run kubara-catalog-promotion:stage",
        "npm run kubara-catalog-promotion:stage:verify",
        "npm run kubara-catalog-promotion:promote",
        "npm run kubara-catalog-promotion:verify",
        "npm run kubara-current-catalog-promotion:dry-run",
        "npm run kubara-current-catalog-promotion:stage",
        "npm run kubara-current-catalog-promotion:stage:verify",
        "npm run kubara-current-catalog-promotion:promote",
        "npm run kubara-current-catalog-promotion:verify",
        "npm run kubara-catalog-oci:dry-run",
        "npm run kubara-catalog-oci:publish",
        "npm run kubara-catalog-oci:verify",
        "npm run kubara-faithful-hub-spoke:rehearse",
        "npm run kubara-faithful-hub-spoke:run",
        "npm run kubara-faithful-hub-spoke:generate",
        "npm run kubara-faithful-hub-spoke:verify",
        "npm run kubara-mini-idp:plan",
        "npm run kubara-mini-idp:apply",
        "npm run kubara-mini-idp:apply",
        "npm run kubara-mini-idp:verify",
        "npm run kubara-mini-idp:receipt-verify",
        "npm run kubara-platform-matrix:generate",
        "npm run kubara-platform-matrix:verify",
        "npm run kubara-catalog-release:generate",
        "npm run kubara-catalog-release:verify",
        "npm run kubara-release:verify",
      ],
      gates: [
        gate("catalog-alignment", "Immutable upstream snapshots, byte-preserving aligned exports, seven historical candidates, and three current additions.", [
          "kubara-catalog-adapter:verify",
          "kubara-catalog-candidates:verify",
          "kubara-current-catalog-candidates:verify",
          "kubara-catalog-promotion:verify",
          "kubara-current-catalog-promotion:verify",
          "kubara-catalog-oci:self-test",
          "kubara-catalog-oci:verify",
        ]),
        gate("current-example", "Kubara v0.13.0 generates the same 131 files from upstream and ConfigHub-aligned catalogs and yields 13 exact effective renders.", [
          "kubara-current-example:verify",
          "kubara-effective-renders:verify",
        ]),
        gate("live-qualification", "Historical and current exact chart selections each retain a serial 13-lane live qualification receipt.", [
          "kubara-live-qualification:verify",
          "kubara-current-live-qualification:verify",
        ]),
        gate("matrix-and-wiring", "Current and retained historical component-by-cluster and dependency views are reproducible generated data.", [
          "kubara-wiring:verify",
          "kubara-platform-matrix:verify",
        ]),
        gate("mini-idp", "One idempotent reconciler owns the four-cluster platform, hx-web, cubbychat, governance controls, matrix, and visible wiring evidence; its receipt requires an initial reconciliation followed by a zero-action rerun.", [
          "kubara-mini-idp:receipt-verify",
        ]),
        gate("faithful-hub-spoke", "The unchanged Kubara hub Argo CD to registered spoke topology is retained as the faithful lane.", [
          "kubara-faithful-hub-spoke:verify",
        ]),
        gate("public-release", "The linear website path uses current v0.13 evidence while retaining v0.12 as historical compatibility evidence.", [
          "catalog:status:verify",
          "catalog:maps:verify",
          "catalog:index:verify",
          "catalog:review:verify",
          "installer-oci:catalog:verify",
          "npm-scripts:catalog:verify",
          "kubara-catalog-release:verify",
          "site:verify",
          "kubara-release:verify",
        ]),
      ],
      offlineVerification: [
        ...offlineCommands.map((item) => item.display),
        "node scripts/reconcile-kubara-mini-idp.mjs --plan",
      ],
      finalVerification: finalCommands.map((item) => item.display),
      requiredEvidence: {
        currentExample: "examples/kubara/current-platform/generation-receipt.yaml",
        catalogParity: "examples/kubara/current-platform/catalog-parity-receipt.yaml",
        currentMatrix: "data/kubara-platform-matrix/matrix.json",
        currentWiring: "data/kubara-wiring/graph.json",
        faithfulLane: "runs/kubara-faithful-hub-spoke/receipt.yaml",
        miniIdp: "runs/kubara-mini-idp-reconcile/receipt.yaml",
        historicalLiveQualification: "runs/kubara-live-qualification/receipt.yaml",
        currentLiveQualification: "runs/kubara-current-live-qualification/receipt.yaml",
        historicalPromotion: "data/kubara-catalog-refresh/root-promotion/receipt.yaml",
        currentPromotion: "data/kubara-catalog-refresh/current-root-promotion/receipt.yaml",
        rootCatalog: "CATALOG.md",
        installerCatalog: "data/installer-oci-packages/packages.json",
        publicPage: "site/d/docs/demo/kubara/single-platform.html",
      },
      claimBoundary: [
        "The static verifier proves deterministic committed inputs and generated outputs; it does not turn missing live receipts into passes.",
        "The full verifier fails until both live qualification sets, both additive promotions, the faithful lane, the mini-IDP reconciliation, and the public site verify.",
        "The first mini-IDP apply writes a pending-idempotence receipt; the immediately repeated apply must record zero actions before receipt and release verification can pass.",
        "AI may propose future wiring, but no required adoption, generation, reconciliation, or verification step depends on AI.",
      ],
    },
  };
}

function gate(id, outcome, scripts) {
  return { id, outcome, packageScripts: scripts };
}

function verifyStatic() {
  check(existsSync(contractPath), `${contractRelative} is missing; run npm run kubara-release:generate`);
  check(stableJson(readYaml(contractPath)) === stableJson(expectedContract()), `${contractRelative} is stale`);
  verifyPackageCommands();
  verifyBaselineRetention();
  verifyCandidateSets();
  verifyCurrentShape();
  verifyMiniIdpPlan();
  verifySiteConsumption();
  for (const item of offlineCommands) run(item);
}

function verifyPackageCommands() {
  const scripts = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts ?? {};
  for (const [name, expected] of Object.entries(packageCommands)) {
    check(scripts[name] === expected, `package script ${name} must be exactly: ${expected}`);
  }
}

function verifyBaselineRetention() {
  for (const rootName of ["recipes", "packages"]) {
    const roots = versionRoots(rootName);
    const legacy = roots.filter((path) => !additions.includes(path.slice(rootName.length + 1)));
    check(legacy.length === baseline.count, `${rootName}: expected ${baseline.count} retained baseline versions, found ${legacy.length}`);
    const expected = rootName === "recipes" ? baseline.recipesTreeSHA256 : baseline.packagesTreeSHA256;
    check(treeSetDigest(legacy) === expected, `${rootName}: a retained baseline version was removed or changed`);
    check(roots.length <= baseline.count + additions.length, `${rootName}: release scope exceeds the declared 120-version acceptance set`);
  }
}

function verifyCandidateSets() {
  const historical = readYaml(join(repoRoot, "data/kubara-catalog-refresh/candidates/candidate-set.yaml"));
  const current = readYaml(join(repoRoot, "data/kubara-catalog-refresh/current-candidates/candidate-set.yaml"));
  check(historical.kind === "KubaraCatalogCandidateSet", "historical candidate-set kind changed");
  check(historical.spec?.candidates?.length === historicalAdditions.length, "historical candidate set must retain seven additions");
  check(current.kind === "KubaraCatalogCandidateSet", "current candidate-set kind changed");
  check(current.spec?.exactPublicArtifactCount === 7, "current candidate set must map seven exact public artifacts");
  check(current.spec?.additiveVersionCount === currentAdditions.length, "current candidate set must contain three additions");
  for (const relativePath of historicalAdditions) verifyCandidatePath("data/kubara-catalog-refresh/candidates", relativePath);
  for (const relativePath of currentAdditions) verifyCandidatePath("data/kubara-catalog-refresh/current-candidates", relativePath);
}

function verifyCandidatePath(root, relativePath) {
  for (const kind of ["recipes", "packages"]) {
    const path = join(repoRoot, root, kind, relativePath);
    check(existsSync(path), `${relativeRepo(path)} is missing`);
  }
}

function verifyCurrentShape() {
  const exampleRoot = join(repoRoot, "examples/kubara/current-platform");
  const lock = readYaml(join(exampleRoot, "source-lock.yaml"));
  const config = readYaml(join(exampleRoot, "source/config.yaml"));
  const generation = readYaml(join(exampleRoot, "generation-receipt.yaml"));
  const parity = readYaml(join(exampleRoot, "catalog-parity-receipt.yaml"));
  const apps = readYaml(join(exampleRoot, "apps/source-lock.yaml"));
  check(lock.spec?.kubara?.version === "v0.13.0", "current example Kubara version changed");
  check(String(lock.spec?.catalogs?.version) === "1.1.0", "current example catalog version changed");
  check(config.clusters?.length === 4, "current example must retain one hub and three spokes");
  check(config.clusters.filter((cluster) => cluster.type === "hub").length === 1, "current example must retain exactly one hub");
  check(config.clusters.filter((cluster) => cluster.type === "spoke").length === 3, "current example must retain exactly three spokes");
  const selectedServices = new Set(config.clusters.flatMap((cluster) => Object.entries(cluster.services ?? {}).filter(([, service]) => service.status === "enabled").map(([name]) => name)));
  check(selectedServices.size === 6 && config.clusters.some((cluster) => cluster.argocd?.selfManaged === "enabled"), "current example must retain seven selected platform roles including hub Argo CD");
  check(generation.spec?.outputs?.generatedFileCount === 131, "current example generated file count changed");
  check(generation.spec?.platform?.renderCount === 13, "current example effective render count changed");
  check(parity.status?.generatedTrees === "byte-for-byte-equal", "current example catalog generation parity is not byte-for-byte");
  check(apps.kind === "KubaraMiniIDPApplicationSourceLock", "mini-IDP application source lock kind changed");
  check(Boolean(apps.spec?.hxWeb?.image?.pinned), "hx-web image digest pin is missing");
  check(Boolean(apps.spec?.cubbychat?.upstream?.commit), "cubbychat source commit pin is missing");
  check(Object.keys(apps.spec?.cubbychat?.images ?? {}).length === 3, "cubbychat must retain three image digest pins");
  const appYaml = listFiles(join(exampleRoot, "apps")).filter((path) => path.endsWith(".yaml") && !path.endsWith("source-lock.yaml"));
  check(appYaml.length === 15, `expected 15 one-object mini-IDP app manifests, found ${appYaml.length}`);
}

function verifySiteConsumption() {
  const source = readFileSync(join(repoRoot, "scripts/generate-public-site.mjs"), "utf8");
  for (const needle of [
    "${catalog.installerOciPackages.length}",
    "docs/demo/kubara/single-platform.md",
    "d/docs/demo/kubara/platform-evidence.html",
    "examples/kubara/current-platform",
  ]) check(source.includes(needle), `public-site generator does not consume ${needle}`);
  for (const path of [
    "docs/demo/kubara/single-platform.md",
    "docs/demo/kubara/platform-evidence.md",
    "data/kubara-platform-matrix/matrix.html",
    "data/kubara-platform-matrix/matrix.json",
    "data/kubara-wiring/graph.html",
    "data/kubara-wiring/graph.json",
  ]) check(existsSync(join(repoRoot, path)), `${path} is missing`);
  verifyKubaraPublicSourceContract();
}

function verifyKubaraPublicSourceContract() {
  const adoption = collapseWhitespace(readFileSync(join(repoRoot, "docs/demo/kubara/single-platform.md"), "utf8"));
  const evidence = collapseWhitespace(readFileSync(join(repoRoot, "docs/demo/kubara/platform-evidence.md"), "utf8"));
  const matrix = JSON.parse(readFileSync(join(repoRoot, "data/kubara-platform-matrix/matrix.json"), "utf8"));
  const graph = JSON.parse(readFileSync(join(repoRoot, "data/kubara-wiring/graph.json"), "utf8"));
  const expected = expectedContract().spec.adoption;

  check(expected.desiredMatrixRows === 36, "Kubara public source contract must retain 36 current matrix cells");
  check(matrix.spec?.scope?.cells === expected.desiredMatrixRows, `current Kubara matrix must contain ${expected.desiredMatrixRows} cells`);
  check(matrix.spec?.rows?.length === expected.desiredMatrixRows, `current Kubara matrix must expose ${expected.desiredMatrixRows} rows`);
  check(expected.reconcilerPlan.needsProvidesLinks === 25, "Kubara public source contract must retain 25 curated GUI Links");
  check(graph.spec?.summary?.needs > expected.reconcilerPlan.needsProvidesLinks, "the full extracted wiring graph must remain larger than the curated GUI Link inventory");

  for (const app of ["hx-web", "cubbychat"]) {
    check(adoption.includes(app), `Kubara adoption source must name ${app}`);
    check(evidence.includes(app), `Kubara evidence source must name ${app}`);
  }
  for (const url of [
    "https://confighub.github.io/helm-expt/site/d/docs/demo/kubara/single-platform.html",
    "https://confighub.github.io/helm-expt/data/kubara-platform-matrix/matrix.html",
    "https://confighub.github.io/helm-expt/data/kubara-wiring/graph.html",
  ]) {
    check(adoption.includes(url), `Kubara adoption source must retain public link ${url}`);
    check(evidence.includes(url), `Kubara evidence source must retain public link ${url}`);
  }
  for (const phrase of [
    "desired-only matrix",
    "public matrix is regenerated from that desired state plus receipt evidence",
    "ConfigHub GUI shows 25 curated operational `NeedsProvides` Links",
    "public graph is the complete evidence view",
    "one 90-minute overall convergence deadline",
    "durable write-ahead operation journal",
    "pins context/external organization ID `58b23b85-9699-4384-bd57-80ef695a1d58` and internal organization entity ID `12c33fa8-00b1-4011-ad3e-19d56458b29c`",
    "All delivery Application Units are materialized and identity-checked before the first fleet-root release",
    "checkpointed in the durable write-ahead operation journal",
    "exact UID/resourceVersion",
  ]) check(adoption.includes(phrase), `Kubara adoption source must preserve boundary: ${phrase}`);
  for (const phrase of [
    "desired-only platform matrix and exposes exactly 25 curated operational",
    "The receipt-aware public matrix and complete extracted",
    "contains 36 cells: seven deployable platform roles plus hx-web and cubbychat",
    "The full graph preserves every extracted",
  ]) check(evidence.includes(phrase), `Kubara evidence source must preserve boundary: ${phrase}`);
  check(!evidence.includes("contains 28 cells"), "Kubara evidence source must not retain the pre-application 28-cell matrix claim");
}

function verifyKubaraPublicVisibility() {
  const paths = {
    adoption: "site/d/docs/demo/kubara/single-platform.html",
    evidence: "site/d/docs/demo/kubara/platform-evidence.html",
    examples: "site/testing.html",
  };
  for (const path of Object.values(paths)) check(existsSync(join(repoRoot, path)), `${path} is missing from the generated public site`);

  const adoption = collapseWhitespace(readFileSync(join(repoRoot, paths.adoption), "utf8"));
  const evidence = collapseWhitespace(readFileSync(join(repoRoot, paths.evidence), "utf8"));
  const examples = collapseWhitespace(readFileSync(join(repoRoot, paths.examples), "utf8"));
  const matrix = JSON.parse(readFileSync(join(repoRoot, "data/kubara-platform-matrix/matrix.json"), "utf8"));
  const graph = JSON.parse(readFileSync(join(repoRoot, "data/kubara-wiring/graph.json"), "utf8"));
  const expected = expectedContract().spec.adoption;

  check(expected.desiredMatrixRows === 36, "Kubara public visibility contract must retain 36 current matrix cells");
  check(matrix.spec?.scope?.cells === expected.desiredMatrixRows, `current Kubara matrix must contain ${expected.desiredMatrixRows} cells`);
  check(matrix.spec?.rows?.length === expected.desiredMatrixRows, `current Kubara matrix must expose ${expected.desiredMatrixRows} rows`);
  check(
    evidence.includes(`contains ${expected.desiredMatrixRows} cells: seven deployable platform roles plus hx-web and cubbychat`),
    `${paths.evidence} must state that the current matrix contains ${expected.desiredMatrixRows} cells`,
  );
  check(!evidence.includes("contains 28 cells"), `${paths.evidence} must not retain the pre-application 28-cell matrix claim`);

  for (const app of ["hx-web", "cubbychat"]) {
    check(adoption.includes(app), `${paths.adoption} must name ${app}`);
    check(evidence.includes(app), `${paths.evidence} must name ${app}`);
    check(examples.includes(app), `${paths.examples} must name ${app}`);
  }

  check(
    examples.includes('href="./d/docs/demo/kubara/single-platform.html"'),
    `${paths.examples} must link the Kubara adoption example`,
  );
  check(
    examples.includes('href="./d/docs/demo/kubara/platform-evidence.html"'),
    `${paths.examples} must link the Kubara matrix and wiring evidence guide`,
  );
  check(
    adoption.includes('href="https://confighub.github.io/helm-expt/site/d/docs/demo/kubara/single-platform.html"')
      && adoption.includes('href="https://confighub.github.io/helm-expt/data/kubara-platform-matrix/matrix.html"')
      && adoption.includes('href="https://confighub.github.io/helm-expt/data/kubara-wiring/graph.html"'),
    `${paths.adoption} must link the public adoption example, matrix, and full wiring graph`,
  );
  check(
    evidence.includes('href="https://confighub.github.io/helm-expt/site/d/docs/demo/kubara/single-platform.html"')
      && evidence.includes('href="https://confighub.github.io/helm-expt/data/kubara-platform-matrix/matrix.html"')
      && evidence.includes('href="https://confighub.github.io/helm-expt/data/kubara-wiring/graph.html"'),
    `${paths.evidence} must link the public adoption example, matrix, and full wiring graph`,
  );

  const curatedLinkCount = expected.reconcilerPlan.needsProvidesLinks;
  check(curatedLinkCount === 25, "Kubara public visibility contract must retain 25 curated GUI Links");
  check(
    adoption.includes(`ConfigHub GUI shows ${curatedLinkCount} curated operational <code>NeedsProvides</code> Links`),
    `${paths.adoption} must identify the ${curatedLinkCount} GUI-visible curated NeedsProvides Links`,
  );
  for (const phrase of [
    "one 90-minute overall convergence deadline",
    "durable write-ahead operation journal",
    "58b23b85-9699-4384-bd57-80ef695a1d58",
    "12c33fa8-00b1-4011-ad3e-19d56458b29c",
    "All delivery Application Units are materialized and identity-checked before the first fleet-root release",
    "exact UID/resourceVersion",
  ]) check(adoption.includes(phrase), `${paths.adoption} must expose the restart-safe live contract: ${phrase}`);
  check(
    adoption.includes("ConfigHub governs the desired-only matrix")
      && adoption.includes("the public matrix is regenerated from that desired state plus receipt evidence"),
    `${paths.adoption} must distinguish the desired-only governed matrix from receipt-aware public evidence`,
  );
  check(
    adoption.includes("the public graph is the complete evidence view"),
    `${paths.adoption} must distinguish GUI-visible Links from their full extracted wiring source`,
  );
  check(
    graph.spec?.summary?.needs > curatedLinkCount,
    "the full extracted Kubara wiring graph must remain larger than the curated GUI Link inventory",
  );
  check(
    evidence.includes("desired-only platform matrix and exposes exactly 25 curated operational")
      && evidence.includes("The receipt-aware public matrix and complete extracted wiring graph are linked evidence views")
      && evidence.includes("they are not presented as native live ConfigHub observations"),
    `${paths.evidence} must preserve the GUI desired-state versus derived-evidence boundary`,
  );

  check(
    adoption.includes("The public 36-cell matrix is regenerated from that state and the exact live receipt")
      && adoption.includes("it leaves current live fields unknown unless the receipt supplies them"),
    `${paths.adoption} must describe the matrix as receipt-derived live evidence`,
  );
  check(
    evidence.includes("The desired 36-cell contract is governed in ConfigHub")
      && evidence.includes("public files above are regenerated after the mini-IDP receipt")
      && evidence.includes("A missing observation remains <code>unknown</code>"),
    `${paths.evidence} must preserve the desired-state versus receipt-derived live-matrix boundary`,
  );
}

function verifyMiniIdpPlan() {
  const script = "scripts/reconcile-kubara-mini-idp.mjs";
  check(existsSync(join(repoRoot, script)), `${script} is missing`);
  const selfTest = execFileSync(process.execPath, [script, "--self-test"], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  }).trim();
  check(
    selfTest === [
      "Kubara mini-IDP release recovery self-test passed",
      "Kubara mini-IDP Argo convergence self-test passed",
      "Kubara mini-IDP scenario evidence self-test passed",
    ].join("\n"),
    "mini-IDP release and Argo convergence self-tests did not pass exactly",
  );
  const output = execFileSync(process.execPath, [script, "--plan"], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  const plan = JSON.parse(output);
  check(plan.kind === "KubaraMiniIDPReconcilePlan", "mini-IDP plan kind changed");
  check(plan.spec?.organization === "Kubara", "mini-IDP plan organization changed");
  check(plan.spec?.execution?.organizationExternalID === "58b23b85-9699-4384-bd57-80ef695a1d58", "mini-IDP plan organization external ID is not pinned");
  check(plan.spec?.execution?.organizationEntityID === "12c33fa8-00b1-4011-ad3e-19d56458b29c", "mini-IDP plan organization entity ID is not pinned");
  check(plan.spec?.execution?.serverURL === "https://hub.confighub.com", "mini-IDP plan ConfigHub server is not pinned");
  check(plan.spec?.execution?.deterministic === true, "mini-IDP plan is not deterministic");
  check(plan.spec?.execution?.aiRequired === false, "mini-IDP plan requires AI");
  check(plan.spec?.execution?.mutationGuardConsulted === false, "mini-IDP plan consults the ignored mutation guard");
  check(
    plan.spec?.execution?.partialClusterStatePolicy === "fail-except-exact-journaled-prefix",
    "mini-IDP plan no longer limits partial fleet recovery to an exact journaled prefix",
  );
  check(plan.spec?.execution?.serialLiveParityLock === true, "mini-IDP plan does not require the shared serial live-parity lock");
  check(plan.spec?.execution?.unexpectedSpacePolicy === "fail-outside-exact-53-space-allowlist", "mini-IDP plan does not enforce the exact Space allowlist");
  check(plan.spec?.execution?.unexpectedManagedUnitOrLinkPolicy === "fail", "mini-IDP plan does not reject unexpected managed Units or Links");
  check(plan.spec?.execution?.receiptRequiresZeroActionRerun === true, "mini-IDP plan does not require a zero-action rerun receipt");
  check(
    plan.spec?.execution?.interruptedScenarioPolicy
      === "write ahead every ordered hx-web mutation as a nested transition with exact pre/post Unit, release, provenance, and UpgradeUnit checkpoints; bind approval to the exact refused heads and rollback to the exact initial-rollout revision; resume only an exact durable prefix and fail closed on every undeclared delta",
    "mini-IDP plan no longer binds scenario restart recovery to exact checkpoints",
  );
  check(
    plan.spec?.execution?.argoRetryPolicy
      === "persist one 90-minute convergence deadline and at most four sync-submission reservations per Application and OCI digest across restarts; observe an existing Argo operation without replacement for up to 60 minutes; wait for exact-revision health without resyncing for up to 30 minutes; reserve a new sync only after inactive terminal failure, OutOfSync, or wrong revision",
    "mini-IDP plan no longer separates active-operation observation, health settling, and actual retries",
  );
  check(
    plan.spec?.execution?.argoNamespaceMovePolicy
      === "one declared tracked DaemonSet may be deleted with UID/resourceVersion preconditions from its obsolete namespace only at the exact expected OCI revision and after Argo marks it requiresPruning, the same desired workload exists in the Kubara namespace, both tracking IDs match, both ConfigHub origins match, and the reviewed TCP/9100 host-network binding conflicts",
    "mini-IDP plan no longer bounds the namespace-move deadlock recovery",
  );
  check(plan.spec?.execution?.minimumCubVersion === "v0.2.11", "mini-IDP plan cub minimum-version contract drifted");
  check(
    plan.spec?.execution?.publishedReleaseSelectionPolicy
      === "filter Published = true server-side before selecting the highest ReleaseNum; withdrawn releases never satisfy currency or drive Argo",
    "mini-IDP plan no longer excludes withdrawn releases server-side",
  );
  check(
    plan.spec?.execution?.interruptedReleasePolicy
      === "publish whenever any Unit head differs from its last applied revision; reuse the exact published release for metadata-only changes or ConfigHub's unchanged-bundle response; pass only the published OCI ManifestDigest to Argo",
    "mini-IDP plan no longer treats metadata-only and unchanged-bundle release attempts as idempotent reuse",
  );
  const expected = expectedContract().spec.adoption.reconcilerPlan;
  for (const name of ["spaces", "managedUnits", "deployments", "needsProvidesLinks"]) {
    check(plan.spec?.counts?.[name] === expected[name], `mini-IDP plan ${name} changed from ${expected[name]}`);
  }
  const faithfulReceipt = expectedContract().spec.requiredEvidence.faithfulLane;
  const hasFaithfulEvidence = existsSync(join(repoRoot, faithfulReceipt));
  const expectedPayloads = hasFaithfulEvidence
    ? expected.payloadsReadyForApply
    : expected.payloadsBeforeFaithfulEvidence;
  check(plan.spec?.counts?.payloads === expectedPayloads, `mini-IDP plan payloads changed from ${expectedPayloads}`);
  check(plan.spec?.spaces?.length === expected.spaces, "mini-IDP plan Space inventory is incomplete");
  check(plan.spec?.units?.length === expected.managedUnits, "mini-IDP plan Unit inventory is incomplete");
  check(plan.spec?.deployments?.length === expected.deployments, "mini-IDP plan deployment inventory is incomplete");
  check(plan.spec?.links?.length === expected.needsProvidesLinks, "mini-IDP plan Link inventory is incomplete");
  check(plan.spec?.payloads?.length === expectedPayloads, "mini-IDP plan payload inventory is incomplete");
  const componentSpaces = plan.spec.spaces.filter((space) => space.labels?.Component);
  check(
    componentSpaces.every((space) => space.labels.Owner && space.labels.Variant && space.labels.ComponentVersion),
    "every GUI-visible Component Space must expose Owner, Variant, and exact ComponentVersion",
  );
  check(
    new Set(componentSpaces.map((space) => `${space.labels.Component}/${space.labels.Variant}`)).size
      === componentSpaces.length,
    "every GUI-visible Component/Variant card identity must be unique",
  );
  const ownersByComponent = new Map();
  for (const space of componentSpaces) {
    if (!ownersByComponent.has(space.labels.Component)) ownersByComponent.set(space.labels.Component, new Set());
    ownersByComponent.get(space.labels.Component).add(space.labels.Owner);
  }
  check(
    [...ownersByComponent.values()].every((owners) => owners.size === 1),
    "each GUI Component must remain in exactly one Owner catalog bucket",
  );
  const spacesBySlug = new Map(plan.spec.spaces.map((space) => [space.slug, space]));
  check(
    componentSpaces.filter((space) => space.upstreamSpace).every((space) =>
      spacesBySlug.get(space.upstreamSpace)?.labels?.Component === space.labels.Component),
    "every GUI Component deployment lineage must resolve to an upstream Space in the same Component",
  );
  check(
    !plan.spec.spaces.find((space) => space.slug === "hx-platform")?.labels?.Component
      && !plan.spec.spaces.some((space) => /^hx-app-(dev|staging|prod-a|prod-b)$/.test(space.slug)
        && space.labels?.Component),
    "pure control and ClusterTarget Spaces must not pollute the Components GUI",
  );
  const kubaraCatalogComponents = [...new Set(componentSpaces
    .filter((space) => space.labels.Owner === "KubaraGeneral")
    .map((space) => space.labels.Component))].sort();
  check(
    stableJson(kubaraCatalogComponents) === stableJson([
      "cert-manager",
      "external-secrets",
      "homer-dashboard",
      "kube-prometheus-stack",
      "metrics-server",
      "traefik",
    ]),
    "Components GUI must group the selected Kubara catalog components under KubaraGeneral",
  );
  check(
    componentSpaces.some((space) => space.labels.Component === "kube-prometheus-stack"
      && space.labels.BundledCatalogComponent === "prometheus-blackbox-exporter"
      && space.labels.BundledComponentVersion === "11.15.1"),
    "Components GUI metadata must expose the exact bundled blackbox exporter selection",
  );
  check(
    componentSpaces.some((space) => space.slug === "hx-web-platform-base"
      && space.labels.Component === "hx-web"
      && space.labels.ComponentSurface === "hx-web-platform")
      && componentSpaces.some((space) => space.labels.Component === "cubbychat"),
    "Components GUI must group hx-web's platform binding with hx-web and expose cubbychat",
  );
  for (const key of ["hx-platform/catalog-adapter-receipt", "hx-platform/catalog-root-promotion"]) {
    check(plan.spec.payloads.some((payload) => payload.key === key), `mini-IDP plan is missing governed evidence payload ${key}`);
  }
  check(
    plan.spec.payloads.some((payload) => payload.key === "hx-platform/faithful-hub-spoke-receipt") === hasFaithfulEvidence,
    "mini-IDP faithful-lane evidence payload does not match receipt availability",
  );
  check(plan.spec.deployments.filter((deployment) => deployment.type === "platform").length === 15, "mini-IDP plan must retain 15 platform deployments");
  check(plan.spec.deployments.filter((deployment) => deployment.type === "application").length === 12, "mini-IDP plan must retain all 12 application deployments");
  const namespaceMoveDeployments = plan.spec.deployments.filter(
    (deployment) => (deployment.namespaceMovePrunes ?? []).length > 0,
  );
  check(
    namespaceMoveDeployments.length === 1
      && namespaceMoveDeployments[0].space === "hx-kps-main-dev"
      && stableJson(namespaceMoveDeployments[0].namespaceMovePrunes) === stableJson([{
        migrationID: "hx-kps-main/node-exporter-default-to-kube-prometheus-stack/v1",
        apiVersion: "apps/v1",
        resource: "daemonset",
        kind: "DaemonSet",
        name: "kube-prometheus-stack-prometheus-node-exporter",
        fromNamespace: "default",
        conflictingBindings: ["TCP/9100"],
        reason: "hostNetwork TCP/9100 prevents the Kubara-namespace replacement from becoming healthy before PruneLast",
      }]),
    "mini-IDP plan namespace-move recovery must remain one exact KPS DaemonSet",
  );
  check(plan.spec.spaces.filter((space) => space.prodProtected).length === 10, "mini-IDP plan must protect all ten production app and system-service Spaces");
  check(plan.spec.units.filter((unit) => unit.prodProtected).length === 14, "mini-IDP plan must protect all fourteen production app and system-service Units");
  const deploymentBySpace = new Map(plan.spec.deployments.map((deployment) => [deployment.space, deployment]));
  check(
    deploymentBySpace.get("hx-kps-crds-dev")?.order < deploymentBySpace.get("hx-eso-grafana-es-dev")?.order
      && deploymentBySpace.get("hx-eso-grafana-es-dev")?.order < deploymentBySpace.get("hx-kps-main-dev")?.order,
    "mini-IDP plan must order KPS CRDs, Namespace/ExternalSecret wiring, then KPS workloads",
  );
  const secretPayload = plan.spec.payloads.find((payload) => payload.key === "hx-eso-grafana-es/dev");
  check(
    secretPayload?.objectCount === 2
      && secretPayload?.transform === "select-kind:Namespace/kube-prometheus-stack;ExternalSecret",
    "mini-IDP Grafana wiring payload must own exactly the Namespace and ExternalSecret",
  );
  const kpsMainPayload = plan.spec.payloads.find((payload) => payload.key === "hx-kps-main/dev");
  check(
    kpsMainPayload?.transform === "exclude-kinds:CustomResourceDefinition;ExternalSecret;Namespace/kube-prometheus-stack",
    "mini-IDP KPS main payload overlaps a lifecycle or secret-wiring prerequisite",
  );
  check(stableJson(plan.spec?.phases) === stableJson([
    "preflight exact sources and live qualification receipts",
    "create or validate four persistent ConfigHub-owned Argo targets",
    "reconcile current contract, catalog, matrix, wiring, and lane evidence",
    "deliver lifecycle CRDs and platform prerequisites in dependency order",
    "deliver the complete current Kubara component selection",
    "exercise hx-web promotion, prod approval, rollback, and staging departure",
    "deliver cubbychat and hx-web across all four clusters",
    "create visible NeedsProvides wiring Links",
    "verify ConfigHub state, Argo sync, workloads, and write the receipt",
    "rerun to prove zero-drift idempotence",
  ]), "mini-IDP plan phases are no longer the exact linear release sequence");
  const matrix = JSON.parse(readFileSync(join(repoRoot, "data/kubara-platform-matrix/desired-matrix.json"), "utf8"));
  check(matrix.kind === "KubaraPlatformMatrix", "desired mini-IDP matrix kind changed");
  check(matrix.spec?.rows?.length === expectedContract().spec.adoption.desiredMatrixRows, "desired mini-IDP matrix row count changed");
  const matrixUnit = plan.spec?.units?.find((unit) => unit.space === "hx-platform" && unit.slug === "platform-matrix");
  check(matrixUnit?.role === "PlatformMatrixDesired", "mini-IDP matrix Unit must remain desired-only");
  const matrixPayload = plan.spec?.payloads?.find((payload) => payload.key === "hx-platform/platform-matrix");
  check(stableJson(matrixPayload?.sourcePaths) === stableJson(["data/kubara-platform-matrix/desired-matrix.json"]), "mini-IDP matrix payload must not ingest its publication receipt");
}

function verifyFinalState() {
  verifyKubaraPublicVisibility();
  for (const rootName of ["recipes", "packages"]) {
    const roots = versionRoots(rootName);
    check(roots.length === baseline.count + additions.length, `${rootName}: final additive total must be 120, found ${roots.length}`);
    for (const addition of additions) check(roots.includes(`${rootName}/${addition}`), `${rootName}/${addition} was not promoted`);
  }
  for (const path of Object.values(expectedContract().spec.requiredEvidence)) {
    check(existsSync(join(repoRoot, path)), `${path} is missing; final Kubara acceptance remains blocked`);
  }
  const installerCatalog = JSON.parse(readFileSync(join(repoRoot, "data/installer-oci-packages/packages.json"), "utf8"));
  check(installerCatalog.packages?.length === baseline.count + additions.length, `installer OCI catalog must expose 120 retained chart versions, found ${installerCatalog.packages?.length ?? 0}`);
}

function versionRoots(rootName) {
  const roots = [];
  const root = join(repoRoot, rootName);
  for (const repository of directoryNames(root)) {
    for (const chart of directoryNames(join(root, repository))) {
      for (const version of directoryNames(join(root, repository, chart))) {
        roots.push(`${rootName}/${repository}/${chart}/${version}`);
      }
    }
  }
  return roots.sort();
}

function directoryNames(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function treeSetDigest(roots) {
  const hash = createHash("sha256");
  for (const root of roots.sort()) {
    hash.update(`${root}\0`);
    for (const path of listFiles(join(repoRoot, root))) {
      hash.update(`${relative(repoRoot, path).replaceAll("\\", "/")}\0`);
      hash.update(`${sha256File(path)}\n`);
    }
  }
  return hash.digest("hex");
}

function run(item) {
  check(existsSync(join(repoRoot, item.script)), `${item.script} is missing for ${item.id}`);
  console.log(`acceptance: ${item.display}`);
  execFileSync(process.execPath, [item.script, ...item.args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 300,
  });
}

function stableJson(value) {
  return JSON.stringify(sortDeep(value));
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, sortDeep(nested)]));
  }
  return value;
}
