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
}

function verifyMiniIdpPlan() {
  const script = "scripts/reconcile-kubara-mini-idp.mjs";
  check(existsSync(join(repoRoot, script)), `${script} is missing`);
  const output = execFileSync(process.execPath, [script, "--plan"], {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  const plan = JSON.parse(output);
  check(plan.kind === "KubaraMiniIDPReconcilePlan", "mini-IDP plan kind changed");
  check(plan.spec?.organization === "Kubara", "mini-IDP plan organization changed");
  check(plan.spec?.execution?.deterministic === true, "mini-IDP plan is not deterministic");
  check(plan.spec?.execution?.aiRequired === false, "mini-IDP plan requires AI");
  check(plan.spec?.execution?.mutationGuardConsulted === false, "mini-IDP plan consults the ignored mutation guard");
  check(plan.spec?.execution?.partialClusterStatePolicy === "fail", "mini-IDP plan does not fail on partial persistent-cluster state");
  check(plan.spec?.execution?.serialLiveParityLock === true, "mini-IDP plan does not require the shared serial live-parity lock");
  check(plan.spec?.execution?.unexpectedSpacePolicy === "fail-outside-exact-53-space-allowlist", "mini-IDP plan does not enforce the exact Space allowlist");
  check(plan.spec?.execution?.unexpectedManagedUnitOrLinkPolicy === "fail", "mini-IDP plan does not reject unexpected managed Units or Links");
  check(plan.spec?.execution?.receiptRequiresZeroActionRerun === true, "mini-IDP plan does not require a zero-action rerun receipt");
  check(plan.spec?.execution?.minimumCubVersion === "v0.2.11", "mini-IDP plan cub minimum-version contract drifted");
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
  for (const key of ["hx-platform/catalog-adapter-receipt", "hx-platform/catalog-root-promotion"]) {
    check(plan.spec.payloads.some((payload) => payload.key === key), `mini-IDP plan is missing governed evidence payload ${key}`);
  }
  check(
    plan.spec.payloads.some((payload) => payload.key === "hx-platform/faithful-hub-spoke-receipt") === hasFaithfulEvidence,
    "mini-IDP faithful-lane evidence payload does not match receipt availability",
  );
  check(plan.spec.deployments.filter((deployment) => deployment.type === "platform").length === 15, "mini-IDP plan must retain 15 platform deployments");
  check(plan.spec.deployments.filter((deployment) => deployment.type === "application").length === 12, "mini-IDP plan must retain all 12 application deployments");
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
      && secretPayload?.transform === "select-kind=Namespace/kube-prometheus-stack,ExternalSecret",
    "mini-IDP Grafana wiring payload must own exactly the Namespace and ExternalSecret",
  );
  const kpsMainPayload = plan.spec.payloads.find((payload) => payload.key === "hx-kps-main/dev");
  check(
    kpsMainPayload?.transform === "exclude-kinds=CustomResourceDefinition,ExternalSecret,Namespace/kube-prometheus-stack",
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

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, sortDeep(nested)]));
  }
  return value;
}
