#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  repoRoot,
  writeYaml,
} from "./lib/proof-common.mjs";
import { resolveSourceCatalogImports } from "./lib/source-catalog-import.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set([
  "--verify",
  "--publish",
  "--public-verify",
  "--hub-sync",
  "--hub-record",
  "--hub-verify",
  "--hub-policy-check",
  "--hub-promotion-sync",
  "--hub-promotion-verify",
]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-aicr-argocd-example.mjs --verify
  node scripts/sync-aicr-argocd-example.mjs --publish
  node scripts/sync-aicr-argocd-example.mjs --public-verify
  node scripts/sync-aicr-argocd-example.mjs --hub-sync
  node scripts/sync-aicr-argocd-example.mjs --hub-record
  node scripts/sync-aicr-argocd-example.mjs --hub-verify
  node scripts/sync-aicr-argocd-example.mjs --hub-policy-check
  node scripts/sync-aicr-argocd-example.mjs --hub-promotion-sync
  node scripts/sync-aicr-argocd-example.mjs --hub-promotion-verify`);
  process.exit(1);
}

const version = process.env.AICR_ARGOCD_VERSION?.trim() || "0.14.0";
check(
  ["0.14.0", "0.19.0", "0.20.0"].includes(version),
  `unsupported AICR Argo CD example version ${version}`,
);
const modernEntry = version !== "0.14.0";
const v020Entry = version === "0.20.0";
const versionSlug = `v${version.replaceAll(".", "-")}`;
const exampleName = modernEntry
  ? `eks-h100-training-kubeflow-${versionSlug}`
  : "eks-h100-training-kubeflow";
const componentSlug = "aicr-eks-h100-training-kubeflow";
const baseVariantSlug = `${versionSlug}-argocd`;
const root = join(repoRoot, "examples", "aicr", exampleName);
const sourceReceiptPath = join(
  root,
  modernEntry ? "generation-receipt.yaml" : "argocd-oci-receipt.yaml",
);
const ociReceiptPath = join(root, "argocd-oci-receipt.yaml");
const publicReceiptPath = join(root, "public-oci-receipt.yaml");
const publicationSummaryPath = join(root, "public-oci-summary.md");
const uploadReceiptPath = join(root, "confighub-upload-receipt.yaml");
const policyReceiptPath = join(root, "apply-policy-receipt.yaml");
const promotionReceiptPath = join(root, "promotion-readiness-receipt.yaml");
const releaseReceiptPath = join(root, "confighub-release-oci-receipt.yaml");
const renderedRoot = join(root, "argocd-rendered");
const sourceLayoutRoot = join(root, "oci-layouts", "argocd-source");
const configLayoutRoot = join(root, "oci-layouts", "argocd-config");
const readmeUnitPath = join(
  repoRoot,
  "data",
  "helm-catalog-readmes",
  "units",
  `${componentSlug}-${versionSlug}-argocd`,
  "readme.yaml",
);
const policyPath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const sourceCatalogImport = v020Entry
  ? resolveSourceCatalogImports().find(
      (item) => item.baseVariantRecord === `${componentSlug}-${versionSlug}-argocd`,
    )
  : null;
if (v020Entry) {
  check(sourceCatalogImport, "AICR v0.20.0 source-catalog import is missing");
}

const sourceReceipt = readYaml(sourceReceiptPath);
const registryBase =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt";
const recordedTransport = sourceReceipt.spec?.processing?.transport ?? {};
const publicSourceRef = v020Entry
  ? recordedTransport.sourcePackage?.publicTarget
  : `${registryBase}/${componentSlug}-argocd:${version}`;
const publicConfigRef = v020Entry
  ? recordedTransport.literalConfiguration?.publicTarget
  : `${registryBase}/${componentSlug}-argocd-config:${version}`;
check(publicSourceRef?.startsWith(`${registryBase}/`), "AICR source public reference is missing or outside the retained registry");
check(publicConfigRef?.startsWith(`${registryBase}/`), "AICR configuration public reference is missing or outside the retained registry");
const sourceArtifact = modernEntry
  ? {
      role: "source-package",
      format: "helm-chart-oci",
      ociLayout: relative(repoRoot, sourceLayoutRoot).replaceAll("\\", "/"),
      portableDigest: sourceReceipt.spec.processing.transport.sourcePackage.digest,
      publicTarget: publicSourceRef,
    }
  : sourceReceipt.spec.artifacts.sourcePackage;
const configArtifact = modernEntry
  ? {
      role: "literal-configuration",
      format: "individual-yaml-layers",
      ociLayout: relative(repoRoot, configLayoutRoot).replaceAll("\\", "/"),
      digest: sourceReceipt.spec.processing.transport.literalConfiguration.digest,
      objectCount: sourceReceipt.spec.processing.transport.literalConfiguration.objectCount,
      publicTarget: publicConfigRef,
    }
  : sourceReceipt.spec.artifacts.literalConfiguration;
if (!modernEntry) {
  check(sourceArtifact.publicTarget === publicSourceRef, "AICR source public reference changed");
  check(configArtifact.publicTarget === publicConfigRef, "AICR configuration public reference changed");
}
const configRef = process.env.AICR_CONFIG_OCI_REF || publicConfigRef;
const expectedOrg = "helm-catalog";
const spaceSlug = `${componentSlug}-${versionSlug}-argocd`;
const developmentSpaceSlug = `${spaceSlug}-development`;
const stagingSpaceSlug = `${spaceSlug}-staging`;
const productionSpaceSlug = `${spaceSlug}-production`;
const unitSlug = componentSlug;
const readmeSlug = "readme";
const approvalRequiredFilterRef = "platform/helm-catalog-prod-gates";
const approvalGate = "platform/require-approval/vet-approvedby";
const releaseTargetRef = "platform/catalog-release-oci";
const cubContext = process.env.CUB_CONTEXT ?? "";
const oldGrafanaValue = "  adminPassword: admin";
const newGrafanaValue = [
  "  admin:",
  "    existingSecret: aicr-grafana-admin",
  "    userKey: admin-user",
  "    passwordKey: admin-password",
].join("\n");
const promotionDescription =
  "Promote the reviewed AICR Grafana Secret change to staging";
const productionPromotionDescription =
  "Promote the reviewed AICR Grafana Secret change to production";
const changeOrderSlug = "grafana-existing-secret";
const variantReadmeUnitPath = (space) => join(
  repoRoot,
  "data",
  "helm-catalog-readmes",
  "units",
  space,
  "readme.yaml",
);

runLocalVerification();

if (mode === "--publish") {
  publishArtifacts();
  process.exit(0);
}
if (mode === "--public-verify") {
  verifyPublicReceipt({ fetch: true });
  console.log("verified public AICR source and configuration OCI artifacts by anonymous pull");
  process.exit(0);
}
if (mode === "--verify" && v020Entry) {
  if (existsSync(publicReceiptPath)) verifyPublicReceipt({ fetch: false });
  if (existsSync(uploadReceiptPath)) {
    const uploadReceipt = verifyCommittedUploadReceipt();
    if (existsSync(policyReceiptPath)) {
      verifyApplyPolicyReceipt(readYaml(policyReceiptPath), uploadReceipt);
    }
    if (existsSync(promotionReceiptPath)) {
      verifyPersistentPromotionReceipt(readYaml(promotionReceiptPath), uploadReceipt);
    }
  }
  console.log("verified the retained AICR v0.20.0 source, configuration, provenance, publication, and ConfigHub records");
  process.exit(0);
}
if (mode === "--hub-sync") {
  assertOrg();
  if (configRef === publicConfigRef) verifyPublicReceipt({ fetch: true });
  syncBaseVariant();
  syncPolicy();
  upsertReadme();
  const receipt = collectLiveReceipt(configRef);
  writeYaml(uploadReceiptPath, receipt);
  verifyUploadReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  updateGenerationStatus({ configHubUpload: "pass" });
  console.log(
    `synchronized live AICR base variant (${spaceSlug}/${unitSlug}, ${receipt.spec.unit.uploadedObjectCount} Argo CD Applications)`,
  );
  process.exit(0);
}
if (mode === "--hub-record") {
  assertOrg();
  const liveSpace = cubJson(["space", "get", spaceSlug, "-o", "json"]).Space;
  const receipt = collectLiveReceipt(externalSourceRecords(liveSpace)[0].ref);
  writeYaml(uploadReceiptPath, receipt);
  verifyUploadReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  updateGenerationStatus({ configHubUpload: "pass" });
  console.log(`recorded live AICR base variant receipt for ${spaceSlug}`);
  process.exit(0);
}
if (mode === "--hub-verify") {
  assertOrg();
  const receipt = verifyCommittedUploadReceipt();
  verifyLiveAgainstReceipt(receipt);
  verifyApplyPolicyReceipt(readYaml(policyReceiptPath), receipt);
  console.log(
    `verified live AICR base variant (${spaceSlug}/${unitSlug}, ${receipt.spec.unit.uploadedObjectCount} Argo CD Applications)`,
  );
  process.exit(0);
}
if (mode === "--hub-policy-check") {
  assertOrg();
  const uploadReceipt = verifyCommittedUploadReceipt();
  verifyLiveAgainstReceipt(uploadReceipt);
  const receipt = runLiveApplyPolicyCheck(uploadReceipt);
  writeYaml(policyReceiptPath, receipt);
  verifyApplyPolicyReceipt(receipt, uploadReceipt);
  console.log(`recorded the live required-approval check for ${spaceSlug}/${unitSlug}`);
  process.exit(0);
}
if (mode === "--hub-promotion-sync") {
  check(
    process.env.HELM_EXPT_ALLOW_AICR_PROMOTION === "1",
    "set HELM_EXPT_ALLOW_AICR_PROMOTION=1 to update the persistent AICR environment variants",
  );
  assertOrg();
  verifyPublicReceipt({ fetch: true });
  const uploadReceipt = verifyCommittedUploadReceipt();
  verifyLiveAgainstReceipt(uploadReceipt);
  const receipt = syncPersistentPromotion(uploadReceipt);
  writeYaml(promotionReceiptPath, receipt);
  verifyPersistentPromotionReceipt(receipt, uploadReceipt);
  verifyPersistentPromotionLive(receipt);
  updateGenerationStatus({ promotion: "pass" });
  console.log(
    `synchronized ${spaceSlug} -> ${developmentSpaceSlug} -> ${stagingSpaceSlug}${v020Entry ? ` -> ${productionSpaceSlug}` : ""}`,
  );
  process.exit(0);
}
if (mode === "--hub-promotion-verify") {
  assertOrg();
  const uploadReceipt = verifyCommittedUploadReceipt();
  const receipt = readYaml(promotionReceiptPath);
  verifyPersistentPromotionReceipt(receipt, uploadReceipt);
  verifyPersistentPromotionLive(receipt);
  console.log(
    v020Entry
      ? "verified the persistent AICR development, staging, and production chain"
      : "verified the persistent AICR development and staging chain",
  );
  process.exit(0);
}

const committedUploadReceipt = verifyCommittedUploadReceipt();
check(
  existsSync(policyReceiptPath),
  "AICR apply-policy receipt is missing; run the Hub policy check",
);
verifyApplyPolicyReceipt(readYaml(policyReceiptPath), committedUploadReceipt);
console.log("verified AICR ConfigHub upload and apply-policy receipts");

function runLocalVerification() {
  const verifier = v020Entry
    ? "verify-aicr-v020-artifacts.mjs"
    : modernEntry
      ? "verify-aicr-v019-artifacts.mjs"
      : "verify-aicr-argocd-example.mjs";
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", verifier)],
    {
      cwd: repoRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        AICR_SKIP_UPLOAD_RECEIPT: mode === "--hub-record" ? "1" : "0",
        AICR_SKIP_POLICY_RECEIPT: [
          "--hub-sync",
          "--hub-record",
          "--hub-policy-check",
        ].includes(mode) ? "1" : "0",
        AICR_SKIP_PROMOTION_RECEIPT:
          [
            "--hub-sync",
            "--hub-record",
            "--hub-policy-check",
            "--hub-promotion-sync",
          ].includes(mode) ? "1" : "0",
      },
    },
  );
  if (modernEntry) {
    execFileSync(
      process.execPath,
      [
        join(
          repoRoot,
          "scripts",
          v020Entry ? "run-aicr-v020-provenance.mjs" : "run-aicr-v019-provenance.mjs",
        ),
        "--verify",
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
  }
  check(existsSync(readmeUnitPath), "generated AICR README Unit is missing; run npm run helm-catalog-readmes");
}

function publishArtifacts() {
  copyLayout(sourceLayoutRoot, publicSourceRef);
  copyLayout(configLayoutRoot, publicConfigRef);
  const source = verifyPublicArtifact({
    reference: publicSourceRef,
    expectedDigest: sourceArtifact.portableDigest,
    expectedLayout: sourceLayoutRoot,
  });
  const configuration = verifyPublicArtifact({
    reference: publicConfigRef,
    expectedDigest: configArtifact.digest,
    expectedLayout: configLayoutRoot,
  });
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "PublicOciReceipt",
    metadata: {
      name: `${componentSlug}-${versionSlug}`,
    },
    spec: {
      verifiedAt: new Date().toISOString(),
      registry: "Google Artifact Registry",
      project: "nth-fort-499605-q5",
      location: "europe-west1",
      repository: "helm-expt",
      artifacts: {
        sourcePackage: source,
        literalConfiguration: configuration,
      },
    },
    status: {
      result: "pass",
      authenticatedPush: "pass",
      anonymousPull: "pass",
      claim: "The exact AICR source package and 17-file literal configuration artifact are publicly pullable at their recorded digests.",
      limits: [
        "Public pullability does not prove ConfigHub upload, Argo CD reconciliation, or GPU workload health.",
      ],
    },
  };
  writeYaml(publicReceiptPath, receipt);
  writePublicationSummary(receipt);
  if (modernEntry) {
    materializeLayoutManifest(
      sourceLayoutRoot,
      join(root, "local-argocd-source-oci-manifest.json"),
    );
    materializeLayoutManifest(
      configLayoutRoot,
      join(root, "local-argocd-config-oci-manifest.json"),
    );
    writeYaml(ociReceiptPath, modernOciReceipt());
    const updatedGenerationReceipt = structuredClone(sourceReceipt);
    updatedGenerationReceipt.spec.processing.transport.publicStatus = "pass";
    updatedGenerationReceipt.status.published = true;
    updatedGenerationReceipt.status.publicOciPublication = "pass";
    writeYaml(sourceReceiptPath, updatedGenerationReceipt);
    rmSync(join(root, "index-config.yaml"), { force: true });
    execFileSync(
      process.execPath,
      [
        join(repoRoot, "scripts", "generate-aicr-digest-index.mjs"),
        "--generate",
        "--example",
        exampleName,
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
  } else {
    const updatedSourceReceipt = structuredClone(sourceReceipt);
    updatedSourceReceipt.status.publicSourcePush = "pass";
    updatedSourceReceipt.status.publicSourcePull = "pass";
    updatedSourceReceipt.status.publicRenderedPush = "pass";
    updatedSourceReceipt.status.publicRenderedPull = "pass";
    updatedSourceReceipt.status.claim = `AICR v${version} generated a portable Argo CD Helm chart and 17 exact Argo CD Application objects. Both OCI artifacts are publicly pullable at their recorded digests. ConfigHub imported the 17 Applications as one base variant. Argo CD reconciliation and GPU-cluster health have not run.`;
    writeYaml(sourceReceiptPath, updatedSourceReceipt);
  }
  runLocalVerification();
  console.log("published and anonymously verified both AICR OCI artifacts");
}

function updateGenerationStatus(changes) {
  if (!modernEntry) return;
  const receipt = readYaml(sourceReceiptPath);
  receipt.status = { ...receipt.status, ...changes };
  writeYaml(sourceReceiptPath, receipt);
}

function modernOciReceipt() {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "OciArtifactReceipt",
    metadata: { name: `${componentSlug}-${versionSlug}-argocd` },
    spec: {
      source: {
        name: sourceReceipt.spec.source.name,
        version: sourceReceipt.spec.source.version,
        commit: sourceReceipt.spec.source.commit,
        generationReceipt: relative(repoRoot, sourceReceiptPath).replaceAll("\\", "/"),
        recipe: relative(repoRoot, join(root, "recipe.yaml")).replaceAll("\\", "/"),
      },
      deployer: "argocd-helm",
      artifacts: {
        sourcePackage: {
          ...sourceArtifact,
          localReference: `oci-layout://${relative(repoRoot, sourceLayoutRoot).replaceAll("\\", "/")}@${sourceArtifact.portableDigest}`,
        },
        literalConfiguration: {
          ...configArtifact,
          localReference: `oci-layout://${relative(repoRoot, configLayoutRoot).replaceAll("\\", "/")}@${configArtifact.digest}`,
        },
      },
      outputs: {
        sourceBundle: relative(repoRoot, join(root, "argocd-helm-bundle")).replaceAll("\\", "/"),
        renderedApplications: relative(repoRoot, renderedRoot).replaceAll("\\", "/"),
        sourceManifest: relative(repoRoot, join(root, "local-argocd-source-oci-manifest.json")).replaceAll("\\", "/"),
        renderedManifest: relative(repoRoot, join(root, "local-argocd-config-oci-manifest.json")).replaceAll("\\", "/"),
      },
    },
    status: {
      result: "pass",
      publicSourcePush: "pass",
      publicSourcePull: "pass",
      publicRenderedPush: "pass",
      publicRenderedPull: "pass",
      liveArgoReconciliation: "not-run",
      liveGpuReconciliation: "not-run",
      claim: `The AICR v${version} source chart and its 17 exact Argo CD Applications are publicly pullable at their recorded digests.`,
    },
  };
}

function materializeLayoutManifest(layoutRoot, outputPath) {
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${layoutRoot} must contain one manifest`);
  const digest = index.manifests[0].digest;
  check(/^sha256:[0-9a-f]{64}$/.test(digest), `${layoutRoot} manifest digest changed`);
  const bytes = readFileSync(join(layoutRoot, "blobs", "sha256", digest.slice(7)));
  check(`sha256:${hash(bytes)}` === digest, `${layoutRoot} manifest blob digest changed`);
  writeFileSync(outputPath, bytes);
}

function copyLayout(layoutRoot, target) {
  run("oras", [
    "cp",
    "--from-oci-layout",
    `${layoutRoot}:${version}`,
    stripOci(target),
  ], { inherit: true });
}

function verifyPublicReceipt({ fetch }) {
  check(existsSync(publicReceiptPath), "public AICR OCI receipt is missing; run the publish command after Google authentication");
  const receipt = readYaml(publicReceiptPath);
  check(receipt.kind === "PublicOciReceipt", "AICR public OCI receipt kind changed");
  check(receipt.status?.result === "pass", "AICR public OCI receipt is not pass");
  check(receipt.status?.anonymousPull === "pass", "AICR public OCI receipt must record anonymous pull");
  check(existsSync(publicationSummaryPath), "public AICR OCI summary is missing; run the publish command");
  const expected = [
    ["sourcePackage", publicSourceRef, sourceArtifact.portableDigest, sourceLayoutRoot],
    ["literalConfiguration", publicConfigRef, configArtifact.digest, configLayoutRoot],
  ];
  for (const [name, reference, digest, layout] of expected) {
    const artifact = receipt.spec?.artifacts?.[name];
    check(artifact?.reference === reference, `${name} public reference changed`);
    check(artifact?.digest === digest, `${name} public digest changed`);
    check(artifact?.anonymousPull === "pass", `${name} anonymous pull is not pass`);
    if (fetch) {
      verifyPublicArtifact({
        reference,
        expectedDigest: digest,
        expectedLayout: layout,
      });
    }
  }
  return receipt;
}

function writePublicationSummary(receipt) {
  const source = receipt.spec.artifacts.sourcePackage;
  const configuration = receipt.spec.artifacts.literalConfiguration;
  writeFileSync(
    publicationSummaryPath,
    `# AICR v${version} public OCI publication\n\n`
      + `The provider-curated source variant and its 17 exact Argo CD Application objects are public OCI artifacts. Both were pulled without registry credentials and matched the retained local bytes.\n\n`
      + `| Artifact | Reference | Digest | Anonymous pull |\n`
      + `|---|---|---|---|\n`
      + `| Source package | \`${source.reference}\` | \`${source.digest}\` | pass |\n`
      + `| Literal configuration | \`${configuration.reference}\` | \`${configuration.digest}\` | pass |\n\n`
      + `Publication proves availability and byte identity. It does not prove ConfigHub upload, Argo CD delivery, EKS execution, or H100 runtime behavior.\n`,
  );
}

function verifyPublicArtifact({ reference, expectedDigest, expectedLayout }) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-aicr-public-"));
  try {
    const registryConfig = join(tempRoot, "config.json");
    const pulledLayout = join(tempRoot, "layout");
    writeFileSync(registryConfig, '{"auths":{}}\n');
    run("oras", [
      "cp",
      "--from-registry-config",
      registryConfig,
      "--to-oci-layout",
      stripOci(reference),
      `${pulledLayout}:${version}`,
    ]);
    const pulledDigest = layoutDigest(pulledLayout);
    check(pulledDigest === expectedDigest, `anonymous pull digest differs for ${reference}`);
    compareLayoutBlobs(expectedLayout, pulledLayout);
    return {
      reference,
      digest: expectedDigest,
      authenticatedPush: "pass",
      anonymousPull: "pass",
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function compareLayoutBlobs(expectedRoot, actualRoot) {
  const expected = blobInventory(expectedRoot);
  const actual = blobInventory(actualRoot);
  check(
    JSON.stringify(actual) === JSON.stringify(expected),
    `public OCI blob inventory differs for ${relative(repoRoot, expectedRoot)}`,
  );
}

function blobInventory(layoutRoot) {
  const blobRoot = join(layoutRoot, "blobs", "sha256");
  return readdirSync(blobRoot)
    .sort()
    .map((name) => {
      const bytes = readFileSync(join(blobRoot, name));
      return {
        name,
        size: bytes.length,
        sha256: hash(bytes),
      };
    });
}

function layoutDigest(layoutRoot) {
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${layoutRoot} must contain one tagged manifest`);
  return index.manifests[0].digest;
}

function syncBaseVariant() {
  const args = [
    "variant",
    "upload",
    "--allow-exists",
    "--component",
    componentSlug,
    "--variant",
    baseVariantSlug,
    "--space",
    spaceSlug,
    "--granularity",
    "minimal",
    ...(modernEntry ? ["--target", releaseTargetRef] : []),
    "--label",
    "SourceType=aicr",
    "--label",
    "ResourceClass=system-configuration",
    "--layer",
    "Platform",
    "--owner",
    "Platform",
    "--change-desc",
    `Upload AICR v${version} Argo application bundle`,
    configRef,
  ];
  cub(args, { inherit: true });
  if (modernEntry) {
    cub([
      "unit",
      "set-target",
      "--space",
      spaceSlug,
      unitSlug,
      releaseTargetRef,
      "--wait",
      "--quiet",
    ]);
  }
}

function syncPolicy() {
  cub([
    "space",
    "update",
    spaceSlug,
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "SourceType=aicr",
    "--label",
    "ResourceClass=system-configuration",
    "--trigger-filter",
    approvalRequiredFilterRef,
    ...(modernEntry ? ["--release-target", releaseTargetRef] : []),
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub(["space", "update", "--patch", spaceSlug, "--refresh-triggers", "--quiet"]);
}

function upsertReadme() {
  const existing = cubResult(["unit", "get", "--space", spaceSlug, readmeSlug, "-o", "json"], {
    allowFailure: true,
  });
  const args = existing.status === 0
    ? ["unit", "update", "--space", spaceSlug, readmeSlug, readmeUnitPath]
    : ["unit", "create", "--space", spaceSlug, readmeSlug, readmeUnitPath];
  cub([
    ...args,
    "--change-desc",
    "Explain the AICR package-to-base-variant example",
    "--label",
    "helm-expt.confighub.com/readme=true",
    "--label",
    `helm-expt.confighub.com/source-space=${spaceSlug}`,
  ]);
}

function collectLiveReceipt(sourceReference) {
  const live = inspectLive();
  const policy = readYaml(policyPath);
  const publicReceipt = existsSync(publicReceiptPath) ? verifyPublicReceipt({ fetch: false }) : null;
  const publicPassed = publicReceipt?.status?.result === "pass";
  const externalSource = live.externalSources.find(
    (item) => item.ref === sourceReference && item.digest === configArtifact.digest,
  );
  check(externalSource, "live AICR Space does not record the uploaded OCI source and digest");
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigHubUploadReceipt",
    metadata: {
      name: spaceSlug,
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      command: [
        "cub",
        "variant",
        "upload",
        "--component",
        componentSlug,
        "--variant",
        baseVariantSlug,
        "--space",
        spaceSlug,
        "--granularity",
        "minimal",
        "--target",
        releaseTargetRef,
        sourceReference,
      ],
      source: {
        reference: sourceReference,
        digest: configArtifact.digest,
        renderedObjectCount: live.applicationCount,
        ...(sourceCatalogImport ? { sourceCatalog: sourceCatalogImport.handoff } : {}),
        sourcePackage: {
          reference: publicSourceRef,
          digest: sourceArtifact.portableDigest,
          publicStatus: publicPassed ? "pass" : "not-run",
        },
        literalConfiguration: {
          publicReference: publicConfigRef,
          digest: configArtifact.digest,
          publicStatus: publicPassed ? "pass" : "not-run",
        },
      },
      space: {
        slug: spaceSlug,
        id: live.space.SpaceID,
        labels: live.space.Labels,
        externalSource: {
          annotation: "confighub.com/external-source",
          reference: externalSource.ref,
          manifestDigest: externalSource.digest,
          granularity: externalSource.granularity,
        },
      },
      unit: {
        slug: unitSlug,
        id: live.unit.UnitID,
        dataHash: live.unit.DataHash,
        headRevision: live.unit.HeadRevisionNum,
        labels: live.unit.Labels,
        uploadedObjectCount: live.applicationCount,
        sourceObjectsMatched: true,
        syncWaves: live.syncWaves,
      },
      provenanceBinding: {
        method: "external-source-annotation-plus-exact-object-comparison",
        ociManifestDigest: externalSource.digest,
        configHubDataHash: live.unit.DataHash,
        objectIdentitiesMatched: true,
        note: "The OCI manifest digest and ConfigHub data hash identify different records; the exact-object comparison binds them.",
      },
      readme: {
        slug: readmeSlug,
        id: live.readme.UnitID,
        dataHash: live.readme.DataHash,
        headRevision: live.readme.HeadRevisionNum,
        source: relative(repoRoot, readmeUnitPath).replaceAll("\\", "/"),
      },
      targetRequirements: [
        "Argo CD installed",
        "argocd Namespace",
        "default Argo CD AppProject",
        "EKS cluster",
        "H100-capable nodes for the recorded training platform",
      ],
      policy: {
        profile: policy.metadata.name,
        filter: approvalRequiredFilterRef,
        filterId: live.space.TriggerFilterID,
        reason: "system-configuration",
        checks: policy.spec.approvalRequired.checks.map((item) => item.trigger),
      },
    },
    status: {
      result: "partial",
      ociPull: "pass",
      configHubBaseVariantUpload: "pass",
      objectIdentitiesMatched: "pass",
      approvalRequiredPolicyAssigned: "pass",
      publicSourcePushAndAnonymousPull: publicPassed ? "pass" : "not-run",
      publicConfigurationPushAndAnonymousPull: publicPassed ? "pass" : "not-run",
      apply: "not-run",
      liveArgoReconciliation: "not-run",
      liveGpuReconciliation: "not-run",
      claim: "ConfigHub imported the 17 exact Argo CD Applications generated from the AICR recipe as one base variant and attached the catalog policy.",
      limits: [
        sourceReference === publicConfigRef
          ? "The ConfigHub Space records the public Google Artifact Registry reference and resolved digest."
          : "The ConfigHub upload used a temporary local registry because Google Cloud reauthentication was not available during this run.",
        "The target requirements are recorded but were not applied in this run.",
        "No Argo CD reconciliation or GPU workload health result is claimed.",
      ],
    },
  };
}

function inspectLive() {
  const space = cubJson(["space", "get", spaceSlug, "-o", "json"]).Space;
  const unit = cubJson(["unit", "get", "--space", spaceSlug, unitSlug, "-o", "json"]).Unit;
  const readme = cubJson(["unit", "get", "--space", spaceSlug, readmeSlug, "-o", "json"]).Unit;
  const sourceDocs = sourceApplicationDocs();
  const liveDocs = parseDocs(storedUnitData(unit));
  check(canonicalDocs(liveDocs) === canonicalDocs(sourceDocs), "live AICR Unit differs from the rendered Application files");
  const readmeSource = parseDocs(readFileSync(readmeUnitPath, "utf8"));
  const liveReadme = parseDocs(storedUnitData(readme));
  check(canonicalDocs(liveReadme) === canonicalDocs(readmeSource), "live AICR README differs from its generated source");
  const waves = sourceDocs
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) => Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
    .sort((left, right) => left - right);
  check(
    JSON.stringify(waves) === JSON.stringify(expectedSyncWaves()),
    "AICR sync waves differ from the retained Applications",
  );
  check(sourceDocs.every((doc) => doc.kind === "Application"), "AICR upload contains a non-Application object");
  return {
    space,
    externalSources: externalSourceRecords(space),
    unit,
    readme,
    applicationCount: sourceDocs.length,
    syncWaves: waves,
  };
}

function externalSourceRecords(space) {
  const raw = space.Annotations?.["confighub.com/external-source"];
  check(raw, `${space.Slug} has no confighub.com/external-source annotation`);
  const records = JSON.parse(raw);
  check(
    Array.isArray(records)
      && records.length > 0
      && records.every((item) =>
        typeof item.ref === "string"
        && /^sha256:[0-9a-f]{64}$/.test(item.digest)
        && typeof item.granularity === "string"
      ),
    `${space.Slug} has an invalid confighub.com/external-source annotation`,
  );
  return records;
}

function sourceApplicationDocs() {
  return listFiles(renderedRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
}

function expectedSyncWaves() {
  return sourceApplicationDocs()
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) => Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
    .sort((left, right) => left - right);
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({
        identity: [
          doc.apiVersion ?? "",
          doc.kind ?? "",
          doc.metadata?.namespace ?? "",
          doc.metadata?.name ?? "",
        ].join("|"),
        doc,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(
      (key) => `${JSON.stringify(key)}:${stableJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function verifyCommittedUploadReceipt() {
  check(existsSync(uploadReceiptPath), "AICR ConfigHub upload receipt is missing; run the Hub sync command");
  const receipt = readYaml(uploadReceiptPath);
  verifyUploadReceipt(receipt);
  return receipt;
}

function verifyUploadReceipt(receipt) {
  check(receipt.kind === "ConfigHubUploadReceipt", "AICR ConfigHub upload receipt kind changed");
  check(receipt.spec?.organization === expectedOrg, "AICR upload receipt organization changed");
  check(receipt.spec?.source?.digest === configArtifact.digest, "AICR upload source digest changed");
  check(receipt.spec?.source?.renderedObjectCount === 17, "AICR upload object count changed");
  if (sourceCatalogImport) {
    check(
      stableJson(receipt.spec?.source?.sourceCatalog)
        === stableJson(sourceCatalogImport.handoff),
      "AICR ConfigHub upload lost or changed its provider source-catalog binding",
    );
  }
  check(receipt.spec?.space?.slug === spaceSlug, "AICR upload Space changed");
  if (modernEntry) {
    check(
      receipt.spec?.space?.externalSource?.annotation === "confighub.com/external-source",
      "AICR Space source annotation changed",
    );
    check(receipt.spec?.space?.externalSource?.reference === receipt.spec.source.reference, "AICR Space source reference changed");
    check(receipt.spec?.space?.externalSource?.manifestDigest === configArtifact.digest, "AICR Space source digest changed");
    check(receipt.spec?.space?.externalSource?.granularity === "minimal", "AICR Space source granularity changed");
  } else {
    check(receipt.spec?.space?.externalSource === receipt.spec.source.reference, "AICR Space source reference changed");
    check(receipt.spec?.space?.externalSourceDigest === configArtifact.digest, "AICR Space source digest changed");
  }
  check(receipt.spec?.unit?.slug === unitSlug, "AICR upload Unit changed");
  check(/^[0-9a-f]{64}$/.test(receipt.spec?.unit?.dataHash), "AICR ConfigHub data hash changed shape");
  check(receipt.spec?.unit?.uploadedObjectCount === 17, "AICR uploaded Application count changed");
  check(receipt.spec?.unit?.sourceObjectsMatched === true, "AICR source-object comparison must pass");
  check(
    JSON.stringify(receipt.spec?.unit?.syncWaves) === JSON.stringify(expectedSyncWaves()),
    "AICR upload receipt sync waves changed",
  );
  check(receipt.spec?.policy?.profile === "catalog-standard", "AICR upload policy profile changed");
  check(receipt.spec?.space?.labels?.ResourceClass === "system-configuration", "AICR Space resource class changed");
  check(receipt.spec?.policy?.filter === approvalRequiredFilterRef, "AICR approval-required filter changed");
  check(receipt.spec?.policy?.reason === "system-configuration", "AICR approval reason changed");
  const expectedPolicyCount = modernEntry
    ? readYaml(policyPath).spec.approvalRequired.checks.length
    : 6;
  check(
    receipt.spec?.policy?.checks?.length === expectedPolicyCount,
    `AICR upload must record ${expectedPolicyCount - 1} common checks plus approval`,
  );
  check(
    receipt.spec.policy.checks.includes("platform/require-approval"),
    "AICR upload policy must require approval",
  );
  check(receipt.status?.configHubBaseVariantUpload === "pass", "AICR base variant upload is not pass");
  check(receipt.status?.objectIdentitiesMatched === "pass", "AICR object comparison is not pass");
  if (modernEntry) {
    check(
      receipt.spec?.provenanceBinding?.method === "external-source-annotation-plus-exact-object-comparison",
      "AICR provenance binding method changed",
    );
    check(
      receipt.spec?.provenanceBinding?.ociManifestDigest === configArtifact.digest,
      "AICR provenance binding OCI digest changed",
    );
    check(
      receipt.spec?.provenanceBinding?.configHubDataHash === receipt.spec.unit.dataHash,
      "AICR provenance binding ConfigHub data hash changed",
    );
    check(
      receipt.spec?.provenanceBinding?.objectIdentitiesMatched === true,
      "AICR provenance binding object comparison must pass",
    );
  }
  check(
    receipt.status?.approvalRequiredPolicyAssigned === "pass",
    "AICR approval-required policy assignment is not pass",
  );
  check(receipt.status?.apply === "not-run", "AICR upload must not claim apply");
  check(receipt.status?.liveArgoReconciliation === "not-run", "AICR upload must not claim live Argo CD");
  check(receipt.status?.liveGpuReconciliation === "not-run", "AICR upload must not claim GPU health");
}

function verifyLiveAgainstReceipt(receipt) {
  const live = inspectLive();
  check(live.space.SpaceID === receipt.spec.space.id, "live AICR Space ID changed");
  const receiptSource = modernEntry
    ? receipt.spec.space.externalSource
    : {
        reference: receipt.spec.space.externalSource,
        manifestDigest: receipt.spec.space.externalSourceDigest,
        granularity: "minimal",
      };
  const externalSource = live.externalSources.find(
    (item) =>
      item.ref === receiptSource.reference
      && item.digest === receiptSource.manifestDigest
      && item.granularity === receiptSource.granularity,
  );
  check(externalSource, "live AICR external source annotation changed");
  check(live.space.TriggerFilterID === receipt.spec.policy.filterId, "live AICR policy filter changed");
  check(live.unit.UnitID === receipt.spec.unit.id, "live AICR Unit ID changed");
  check(live.unit.DataHash === receipt.spec.unit.dataHash, "live AICR Unit data hash changed");
  check(live.readme.UnitID === receipt.spec.readme.id, "live AICR README ID changed");
  check(live.readme.DataHash === receipt.spec.readme.dataHash, "live AICR README data hash changed");
}

function runLiveApplyPolicyCheck(uploadReceipt) {
  const before = cubJson(["unit", "get", "--space", spaceSlug, unitSlug, "-o", "json"]).Unit;
  check(
    before.ApplyGates?.[approvalGate] === true,
    `live AICR Unit is not blocked by ${approvalGate}`,
  );

  const command = modernEntry
    ? ["release", "publish", spaceSlug, "-o", "json"]
    : [
        "unit",
        "apply",
        "--space",
        spaceSlug,
        "--unit",
        unitSlug,
        "--dry-run",
        "-o",
        "mutations",
      ];
  const attemptedAction = modernEntry ? "release publish" : "dry-run apply";
  const result = cubResult(command, { allowFailure: true });
  const response = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  check(result.status !== 0, `unapproved AICR ${attemptedAction} unexpectedly succeeded`);
  check(
    response.includes("outstanding ApplyGates"),
    `unapproved AICR ${attemptedAction} did not report outstanding ApplyGates`,
  );

  const after = cubJson(["unit", "get", "--space", spaceSlug, unitSlug, "-o", "json"]).Unit;
  const beforeState = unitPolicyState(before);
  const afterState = unitPolicyState(after);
  check(
    JSON.stringify(afterState) === JSON.stringify(beforeState),
    `AICR Unit state changed during the rejected ${attemptedAction}`,
  );

  const attempt = {
    exitCode: result.status,
    response: "outstanding ApplyGates",
    before: beforeState,
    after: afterState,
  };

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigHubApplyPolicyReceipt",
    metadata: {
      name: `${componentSlug}-${versionSlug}-required-approval`,
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      source: {
        reference: uploadReceipt.spec.source.reference,
        digest: uploadReceipt.spec.source.digest,
      },
      space: {
        slug: spaceSlug,
        id: uploadReceipt.spec.space.id,
        resourceClass: uploadReceipt.spec.space.labels.ResourceClass,
      },
      unit: {
        slug: unitSlug,
        id: before.UnitID,
      },
      policy: {
        profile: uploadReceipt.spec.policy.profile,
        filter: uploadReceipt.spec.policy.filter,
        gate: approvalGate,
        reason: uploadReceipt.spec.policy.reason,
      },
      command: ["cub", ...command],
      ...(modernEntry ? { releasePublish: attempt } : { dryRun: attempt }),
    },
    status: {
      result: "pass",
      ...(modernEntry
        ? { requiredApprovalBlockedReleasePublish: "pass" }
        : { requiredApprovalBlockedDryRun: "pass" }),
      configurationApplied: "not-run",
      claim: modernEntry
        ? "ConfigHub refused to publish a release of the exact AICR base variant because the required approval was missing."
        : "ConfigHub refused a dry-run apply of the exact AICR base variant because the required approval was missing.",
      limits: [
        modernEntry
          ? "No release was published and no configuration was sent to Kubernetes."
          : "The Unit had no target attached, and no configuration was sent to Kubernetes.",
        "This proves the required-approval behavior for this recorded AICR Unit and revision. It does not prove Argo CD reconciliation or GPU workload health.",
      ],
    },
  };
}

function unitPolicyState(unit) {
  return {
    dataHash: unit.DataHash,
    headRevision: unit.HeadRevisionNum,
    liveRevision: null, // LiveRevisionNum removed in cub 0.4; live state now comes from verify-apply, not a Unit field
    lastAppliedRevision: unit.LastReleasedRevisionNum ?? null,
    targetId: unit.TargetID ?? null,
    applyGates: Object.keys(unit.ApplyGates ?? {}).sort(),
  };
}

function verifyApplyPolicyReceipt(receipt, uploadReceipt) {
  check(
    receipt.kind === "ConfigHubApplyPolicyReceipt",
    "AICR apply-policy receipt kind changed",
  );
  check(receipt.spec?.organization === expectedOrg, "AICR policy receipt organization changed");
  check(
    receipt.spec?.source?.reference === uploadReceipt.spec.source.reference,
    "AICR policy receipt source reference changed",
  );
  check(
    receipt.spec?.source?.digest === uploadReceipt.spec.source.digest,
    "AICR policy receipt source digest changed",
  );
  check(receipt.spec?.space?.slug === spaceSlug, "AICR policy receipt Space changed");
  check(
    receipt.spec?.space?.id === uploadReceipt.spec.space.id,
    "AICR policy receipt Space ID changed",
  );
  check(
    receipt.spec?.space?.resourceClass === "system-configuration",
    "AICR policy receipt resource class changed",
  );
  check(receipt.spec?.unit?.slug === unitSlug, "AICR policy receipt Unit changed");
  check(
    receipt.spec?.unit?.id === uploadReceipt.spec.unit.id,
    "AICR policy receipt Unit ID changed",
  );
  check(
    receipt.spec?.policy?.profile === "catalog-standard",
    "AICR policy receipt profile changed",
  );
  check(
    receipt.spec?.policy?.filter === approvalRequiredFilterRef,
    "AICR policy receipt filter changed",
  );
  check(receipt.spec?.policy?.gate === approvalGate, "AICR policy receipt gate changed");
  check(
    receipt.spec?.policy?.reason === "system-configuration",
    "AICR policy receipt reason changed",
  );
  const attempt = modernEntry ? receipt.spec?.releasePublish : receipt.spec?.dryRun;
  const attemptedAction = modernEntry ? "release publish" : "dry-run apply";
  check(
    Number.isInteger(attempt?.exitCode) && attempt.exitCode > 0,
    `AICR policy ${attemptedAction} must remain rejected`,
  );
  check(
    attempt?.response === "outstanding ApplyGates",
    `AICR policy ${attemptedAction} response changed`,
  );
  check(
    JSON.stringify(attempt?.before) === JSON.stringify(attempt?.after),
    `AICR policy ${attemptedAction} changed Unit state`,
  );
  check(
    attempt?.before?.applyGates?.includes(approvalGate),
    "AICR policy receipt does not record the approval gate",
  );
  if (modernEntry) {
    check(
      typeof attempt?.before?.targetId === "string",
      "AICR policy proof must record the OCI release target",
    );
  } else {
    check(attempt?.before?.targetId === null, "AICR policy proof must not attach a target");
  }
  check(receipt.status?.result === "pass", "AICR policy receipt is not pass");
  check(
    (modernEntry
      ? receipt.status?.requiredApprovalBlockedReleasePublish
      : receipt.status?.requiredApprovalBlockedDryRun) === "pass",
    "AICR required-approval behavior is not pass",
  );
  check(
    receipt.status?.configurationApplied === "not-run",
    "AICR policy receipt must not claim apply",
  );
}

function syncPersistentPromotion(uploadReceipt) {
  return v020Entry
    ? syncV020PersistentPromotion(uploadReceipt)
    : syncLegacyPersistentPromotion(uploadReceipt);
}

function syncV020PersistentPromotion(uploadReceipt) {
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  let base = inspectPersistentVariant(spaceSlug);
  verifyPersistentVariant(base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  check(
    externalSourceRecords(base.space).some(
      (item) => item.ref === publicConfigRef && item.digest === configArtifact.digest,
    ),
    "persistent AICR v0.20.0 base does not record the public literal configuration OCI",
  );

  if (!spacePresent(developmentSpaceSlug)) {
    createEnvironmentVariant({
      source: spaceSlug,
      slug: developmentSpaceSlug,
      variant: "development",
      environment: "Development",
    });
  }

  let development = inspectPersistentVariant(developmentSpaceSlug);
  if (!spacePresent(stagingSpaceSlug)) {
    verifyPersistentVariant(development, {
      variant: "development",
      environment: "Development",
      upstreamSpaceId: base.space.SpaceID,
      fromLinks: 1,
      readmeFromLinks: 1,
      expectedDocs: baseDocs,
    });
    createEnvironmentVariant({
      source: developmentSpaceSlug,
      slug: stagingSpaceSlug,
      variant: "staging",
      environment: "Staging",
    });
  }

  let staging = inspectPersistentVariant(stagingSpaceSlug);
  if (!spacePresent(productionSpaceSlug)) {
    check(
      canonicalDocs(staging.docs) === canonicalDocs(baseDocs),
      "create the v0.20.0 production variant before promoting the staging change",
    );
    createEnvironmentVariant({
      source: stagingSpaceSlug,
      slug: productionSpaceSlug,
      variant: "production",
      environment: "Prod",
    });
  }
  let production = inspectPersistentVariant(productionSpaceSlug);

  let changePreview = previousPromotionEvidence()?.spec?.change?.preview ?? null;
  if (canonicalDocs(development.docs) === canonicalDocs(baseDocs)) {
    const before = persistentUnitState(development);
    const args = [
      "run",
      "search-replace",
      "--space",
      developmentSpaceSlug,
      "--unit",
      unitSlug,
      "--search-value",
      oldGrafanaValue,
      "--replace-value",
      newGrafanaValue,
    ];
    const output = cub([...args, "--dry-run", "-o", "mutations"]);
    check(
      output.includes("kube-prometheus-stack"),
      "AICR v0.20.0 development preview did not name kube-prometheus-stack",
    );
    development = inspectPersistentVariant(developmentSpaceSlug);
    check(
      JSON.stringify(persistentUnitState(development)) === JSON.stringify(before),
      "AICR v0.20.0 development preview changed stored configuration",
    );
    changePreview = {
      command: ["cub", ...args, "--dry-run", "-o", "mutations"],
      result: "pass",
      changedApplicationCount: 1,
      namedApplication: "argocd/kube-prometheus-stack",
      storedDataUnchanged: true,
    };
    writeV020PromotionCheckpoint(changePreview);
    cub([
      ...args,
      "--change-desc",
      "Use an existing Secret for the AICR Grafana administrator",
      "--wait",
    ], { inherit: true });
    development = inspectPersistentVariant(developmentSpaceSlug);
  }

  verifyPersistentVariant(development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: base.space.SpaceID,
    fromLinks: 1,
    allowedReadmeFromLinks: [0, 1],
    expectedDocs: changedDocs,
  });
  check(changePreview, "AICR v0.20.0 development preview evidence is missing");

  const changeOrder = ensureV020ChangeOrder();
  const previous = previousPromotionEvidence();
  const stagingPromotion = promoteV020Destination({
    destination: stagingSpaceSlug,
    expectedBefore: baseDocs,
    expectedAfter: changedDocs,
    description: promotionDescription,
    previous: previous?.spec?.promotion?.destinations?.staging ?? null,
  });
  staging = inspectPersistentVariant(stagingSpaceSlug);
  const productionPromotion = promoteV020Destination({
    destination: productionSpaceSlug,
    expectedBefore: baseDocs,
    expectedAfter: changedDocs,
    description: productionPromotionDescription,
    previous: previous?.spec?.promotion?.destinations?.production ?? null,
  });

  ensureIndependentVariantReadme(developmentSpaceSlug);
  ensureIndependentVariantReadme(stagingSpaceSlug);
  ensureIndependentVariantReadme(productionSpaceSlug);
  base = inspectPersistentVariant(spaceSlug);
  development = inspectPersistentVariant(developmentSpaceSlug);
  staging = inspectPersistentVariant(stagingSpaceSlug);
  production = inspectPersistentVariant(productionSpaceSlug);

  verifyPersistentVariant(base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  verifyPersistentVariant(development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: base.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(staging, {
    variant: "staging",
    environment: "Staging",
    upstreamSpaceId: development.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(production, {
    variant: "production",
    environment: "Prod",
    upstreamSpaceId: staging.space.SpaceID,
    fromLinks: 1,
    allowApprovedRelease: true,
    expectedDocs: changedDocs,
  });
  check(
    staging.configuration.upstreamRevision === development.configuration.headRevision
      && staging.upgradableUnitCount === 0
      && production.configuration.upstreamRevision === staging.configuration.headRevision
      && production.upgradableUnitCount === 0,
    "AICR v0.20.0 environment chain has pending upstream configuration",
  );

  const developmentRevision = findPersistentRevision(
    development.revisions,
    (revision) =>
      revision.Source === "Invoke"
      && revision.Description?.includes("existing Secret"),
    "AICR v0.20.0 development Secret revision",
  );
  const resolvedChangeOrder = inspectV020ChangeOrder();
  const policy = readYaml(policyPath);

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "VariantReadinessReceipt",
    metadata: {
      name: `${componentSlug}-${versionSlug}-production`,
    },
    spec: {
      checkedAt: new Date().toISOString(),
      organization: expectedOrg,
      source: {
        sourcePackage: {
          reference: publicSourceRef,
          digest: sourceArtifact.portableDigest,
          anonymousPull: "pass",
        },
        literalConfiguration: {
          reference: publicConfigRef,
          digest: configArtifact.digest,
          anonymousPull: "pass",
        },
        configHubUploadReceipt: relative(repoRoot, uploadReceiptPath)
          .replaceAll("\\", "/"),
      },
      chain: {
        base: persistentVariantRecord(base),
        development: persistentVariantRecord(development),
        staging: persistentVariantRecord(staging),
        production: persistentVariantRecord(production),
      },
      change: {
        resource:
          "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack",
        path: "spec.source.helm.values.grafana",
        from: "grafana.adminPassword",
        to: "grafana.admin.existingSecret",
        requiredSecret: "monitoring/aicr-grafana-admin",
        changedApplicationCount: 1,
        preview: changePreview,
        revision: persistentRevisionRecord(developmentRevision),
      },
      changeOrder: changeOrderRecord(resolvedChangeOrder),
      promotion: {
        path: "base -> development -> staging -> production",
        scope: `configuration Unit ${unitSlug}`,
        changeOrder: `${developmentSpaceSlug}/${changeOrderSlug}`,
        destinations: {
          staging: stagingPromotion,
          production: productionPromotion,
        },
        result: "pass",
        pendingAfter: 0,
        destinationsMatchDevelopment: true,
      },
      policy: {
        profile: policy.metadata.name,
        filter: approvalRequiredFilterRef,
        checks: expectedPersistentCheckSlugs(),
        approvalGate,
        approvalReason:
          "AICR is system configuration, so every environment requires approval before release or apply.",
        approvalRequiredOnEverySpace: true,
      },
      documentation: {
        oneReadmePerSpace: true,
        readmesIndependentOfConfigurationLinks: true,
        promotionScope:
          "Only the configuration Unit is promoted. Each Space keeps its own README.",
      },
      limits: [
        "The target must provide monitoring/aicr-grafana-admin with the expected user and password keys.",
        "This receipt proves stored configuration, one reviewed change, a named ChangeOrder, and promotion through staging and production. It does not prove controller reconciliation or GPU workload health.",
        "Publishing the production release OCI is a separate action and has its own receipt.",
      ],
    },
    status: {
      result: "pass",
      publicOci: "pass",
      baseVariant: "pass",
      developmentChange: "pass",
      changeOrder: "pass",
      stagingPromotion: "pass",
      productionPromotion: "pass",
      approvalRequired: "pass",
      claim: "ConfigHub retained the exact AICR v0.20.0 configuration, recorded one named development change, and promoted that change through staging and production.",
    },
  };
}

function syncLegacyPersistentPromotion(uploadReceipt) {
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  let base = inspectPersistentVariant(spaceSlug);
  verifyPersistentVariant(base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  check(
    externalSourceRecords(base.space).some(
      (item) => item.ref === publicConfigRef && item.digest === configArtifact.digest,
    ),
    "persistent AICR base does not record the public literal configuration OCI",
  );

  if (!spacePresent(developmentSpaceSlug)) {
    cub([
      "variant",
      "create",
      "development",
      spaceSlug,
      "--space-pattern",
      `template:${developmentSpaceSlug}`,
      "--environment",
      "Development",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { inherit: true });
  }

  ensureIndependentVariantReadme(developmentSpaceSlug);
  let development = inspectPersistentVariant(developmentSpaceSlug);
  if (!spacePresent(stagingSpaceSlug)) {
    verifyPersistentVariant(development, {
      variant: "development",
      environment: "Development",
      upstreamSpaceId: base.space.SpaceID,
      fromLinks: 1,
      expectedDocs: baseDocs,
    });
    cub([
      "variant",
      "create",
      "staging",
      developmentSpaceSlug,
      "--space-pattern",
      `template:${stagingSpaceSlug}`,
      "--environment",
      "Staging",
      "--region",
      "demo",
      "--wait",
      "--timeout",
      "10m",
    ], { inherit: true });
  }

  ensureIndependentVariantReadme(developmentSpaceSlug);
  ensureIndependentVariantReadme(stagingSpaceSlug);
  development = inspectPersistentVariant(developmentSpaceSlug);
  let staging = inspectPersistentVariant(stagingSpaceSlug);

  let changePreview = previousPromotionEvidence()?.spec?.change?.preview ?? null;
  if (canonicalDocs(development.docs) === canonicalDocs(baseDocs)) {
    const before = persistentUnitState(development);
    const args = [
      "run",
      "search-replace",
      "--space",
      developmentSpaceSlug,
      "--unit",
      unitSlug,
      "--search-value",
      oldGrafanaValue,
      "--replace-value",
      newGrafanaValue,
    ];
    const output = cub([...args, "--dry-run", "-o", "mutations"]);
    check(
      output.includes("kube-prometheus-stack"),
      "AICR development dry-run did not name kube-prometheus-stack",
    );
    development = inspectPersistentVariant(developmentSpaceSlug);
    check(
      JSON.stringify(persistentUnitState(development)) === JSON.stringify(before),
      "AICR development dry-run changed stored configuration",
    );
    changePreview = {
      command: ["cub", ...args, "--dry-run", "-o", "mutations"],
      result: "pass",
      changedApplicationCount: 1,
      namedApplication: "argocd/kube-prometheus-stack",
      storedDataUnchanged: true,
    };
    cub([
      ...args,
      "--change-desc",
      "Use an existing Secret for the AICR Grafana administrator",
      "--wait",
    ], { inherit: true });
    development = inspectPersistentVariant(developmentSpaceSlug);
  }

  verifyPersistentVariant(development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: base.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });

  const needsPromotion =
    staging.configuration.upstreamRevision !== development.configuration.headRevision;
  let promotionPreview =
    previousPromotionEvidence()?.spec?.promotion?.preview ?? null;
  if (needsPromotion) {
    verifyPersistentVariant(staging, {
      variant: "staging",
      environment: "Staging",
      upstreamSpaceId: development.space.SpaceID,
      fromLinks: 1,
      expectedDocs: baseDocs,
    });
    const before = persistentUnitState(staging);
    const command = [
      "unit",
      "update",
      "--space",
      stagingSpaceSlug,
      unitSlug,
      "--upgrade",
      "--dry-run",
      "-o",
      "mutations",
    ];
    const output = cub(command);
    check(
      output.includes("kube-prometheus-stack"),
      `AICR promotion dry-run did not name kube-prometheus-stack: ${output.trim()}`,
    );
    staging = inspectPersistentVariant(stagingSpaceSlug);
    check(
      JSON.stringify(persistentUnitState(staging)) === JSON.stringify(before),
      "AICR promotion dry-run changed staging",
    );
    promotionPreview = {
      command: ["cub", ...command],
      result: "pass",
      reportedUnitCount: 1,
      namedApplication: "argocd/kube-prometheus-stack",
      storedDataUnchanged: true,
    };
    cub([
      "unit",
      "update",
      "--space",
      stagingSpaceSlug,
      unitSlug,
      "--upgrade",
      "--change-desc",
      promotionDescription,
    ], { inherit: true });
    staging = inspectPersistentVariant(stagingSpaceSlug);
  }

  ensureIndependentVariantReadme(developmentSpaceSlug);
  ensureIndependentVariantReadme(stagingSpaceSlug);
  base = inspectPersistentVariant(spaceSlug);
  development = inspectPersistentVariant(developmentSpaceSlug);
  staging = inspectPersistentVariant(stagingSpaceSlug);
  verifyPersistentVariant(base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  verifyPersistentVariant(development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: base.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(staging, {
    variant: "staging",
    environment: "Staging",
    upstreamSpaceId: development.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  check(
    staging.configuration.upstreamRevision
      === development.configuration.headRevision
      && staging.upgradableUnitCount === 0,
    "persistent AICR staging has not caught up with development",
  );
  check(changePreview, "AICR development preview evidence is missing");
  check(promotionPreview, "AICR promotion preview evidence is missing");

  const developmentRevision = findPersistentRevision(
    development.revisions,
    (revision) =>
      revision.Source === "Invoke"
      && revision.Description?.includes("existing Secret"),
    "AICR development Secret revision",
  );
  const stagingRevision = findPersistentRevision(
    staging.revisions,
    (revision) =>
      revision.Source === "UpgradeUnit"
      && revision.Description === promotionDescription,
    "AICR staging promotion revision",
  );
  const policy = readYaml(policyPath);

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "VariantReadinessReceipt",
    metadata: {
      name: `${componentSlug}-${versionSlug}-staging`,
    },
    spec: {
      checkedAt: new Date().toISOString(),
      organization: expectedOrg,
      source: {
        sourcePackage: {
          reference: publicSourceRef,
          digest: sourceArtifact.portableDigest,
          anonymousPull: "pass",
        },
        literalConfiguration: {
          reference: publicConfigRef,
          digest: configArtifact.digest,
          anonymousPull: "pass",
        },
        configHubUploadReceipt: relative(repoRoot, uploadReceiptPath)
          .replaceAll("\\", "/"),
      },
      chain: {
        base: persistentVariantRecord(base),
        development: persistentVariantRecord(development),
        staging: persistentVariantRecord(staging),
      },
      change: {
        resource:
          "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack",
        path: "spec.source.helm.values.grafana",
        from: "grafana.adminPassword",
        to: "grafana.admin.existingSecret",
        requiredSecret: "monitoring/aicr-grafana-admin",
        changedApplicationCount: 1,
        preview: changePreview,
        revision: persistentRevisionRecord(developmentRevision),
      },
      promotion: {
        path: "base -> development -> staging",
        scope: `configuration Unit ${unitSlug}`,
        preview: promotionPreview,
        result: "pass",
        stagingRevision: persistentRevisionRecord(stagingRevision),
        upstreamRevisionMatched: true,
        pendingAfter: 0,
        stagingMatchesDevelopment: true,
      },
      policy: {
        profile: policy.metadata.name,
        filter: approvalRequiredFilterRef,
        checks: expectedPersistentCheckSlugs(),
        approvalGate,
        approvalRequiredOnEverySpace: true,
      },
      documentation: {
        oneReadmePerSpace: true,
        readmesIndependentOfConfigurationLinks: true,
        promotionScope:
          "The configuration Unit is promoted by itself so each Space keeps its own README.",
      },
      limits: [
        "The target must provide monitoring/aicr-grafana-admin with the expected user and password keys.",
        "This receipt proves stored configuration, policy assignment, one development change, and one promotion. It does not prove Argo CD reconciliation or GPU workload health.",
        `This changes one AICR v${version} bundle. It does not prove an AICR package-version upgrade.`,
      ],
    },
    status: {
      result: "pass",
      publicOci: "pass",
      baseVariant: "pass",
      developmentChange: "pass",
      promotionPreview: "pass",
      promotion: "pass",
      approvalRequired: "pass",
      claim: "ConfigHub kept the public AICR configuration as an unchanged base, changed one Application in development to use an existing Secret, and promoted that exact reviewed result to staging.",
    },
  };
}

function createEnvironmentVariant({ source, slug, variant, environment }) {
  cub([
    "variant",
    "create",
    variant,
    source,
    "--space-pattern",
    `template:${slug}`,
    "--environment",
    environment,
    "--region",
    "demo",
    "--wait",
    "--timeout",
    "10m",
  ], { inherit: true });
}

function ensureV020ChangeOrder() {
  if (!changeOrderPresent()) {
    cub([
      "changeorder",
      "create",
      "--space",
      developmentSpaceSlug,
      changeOrderSlug,
      "--description",
      "Use an existing Secret for the AICR Grafana administrator",
      "--in-scope-space",
      `${stagingSpaceSlug},${productionSpaceSlug}`,
      "--update-type",
      "UpgradeUnit",
      "--label",
      "SourceType=aicr",
      "--label",
      `SourceVersion=${version}`,
    ], { inherit: true });
  }
  const record = inspectV020ChangeOrder();
  const development = inspectPersistentVariant(developmentSpaceSlug);
  const staging = inspectPersistentVariant(stagingSpaceSlug);
  const production = inspectPersistentVariant(productionSpaceSlug);
  check(record.SpaceID === development.space.SpaceID, "AICR ChangeOrder belongs to a different Space");
  check(record.UpdateType === "UpgradeUnit", "AICR ChangeOrder update type changed");
  check(
    sameStringSet(record.InScopeSpaceIDs ?? [], [
      staging.space.SpaceID,
      production.space.SpaceID,
    ]),
    "AICR ChangeOrder scope changed",
  );
  check(
    typeof record.StartTagID === "string" && typeof record.EndTagID === "string",
    "AICR ChangeOrder does not have immutable start and end Tags",
  );
  return record;
}

function changeOrderPresent() {
  return inspectV020ChangeOrder({ allowMissing: true }) !== null;
}

function inspectV020ChangeOrder({ allowMissing = false } = {}) {
  // cub v0.2.34 asks ConfigHub v0.3.0 for a retired include field on
  // ChangeOrder reads. Query the same read-only endpoint without includes until
  // that client/server mismatch is removed.
  const configPath = process.env.CUB_CONFIG
    ?? join(homedir(), ".confighub", "config.yaml");
  const config = JSON.parse(execFileSync(
    "yq",
    ["-o=json", ".", configPath],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ));
  const contextName = cubContext || config.currentContext;
  const context = config.contexts?.find((item) => item.name === contextName);
  check(context, `ConfigHub context ${contextName} is missing`);
  const tokenPath = String(context.metadata?.tokenFile ?? "")
    .replace(/^~(?=\/)/, homedir());
  check(tokenPath && existsSync(tokenPath), `ConfigHub token file is missing for ${contextName}`);
  const token = JSON.parse(readFileSync(tokenPath, "utf8")).accessToken;
  check(token, `ConfigHub access token is missing for ${contextName}`);
  const server = String(context.coordinate?.serverURL ?? "").replace(/\/$/, "");
  check(server.startsWith("https://"), `ConfigHub server URL is invalid for ${contextName}`);
  const development = cubJson([
    "space",
    "get",
    developmentSpaceSlug,
    "-o",
    "json",
  ]).Space;
  const response = execFileSync(
    "curl",
    [
      "-fsS",
      "-G",
      "-H",
      `Authorization: Bearer ${token}`,
      "--data-urlencode",
      `where=Slug = '${changeOrderSlug}' AND SpaceID = '${development.SpaceID}'`,
      `${server}/api/change_order`,
    ],
    { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const record = JSON.parse(response)
    .map((item) => item.ChangeOrder ?? item)
    .find((item) => item.Slug === changeOrderSlug);
  if (!record && allowMissing) return null;
  check(record, `ConfigHub ChangeOrder ${developmentSpaceSlug}/${changeOrderSlug} is missing`);
  return record;
}

function changeOrderRecord(record) {
  return {
    slug: record.Slug,
    id: record.ChangeOrderID,
    space: developmentSpaceSlug,
    startTagId: record.StartTagID,
    endTagId: record.EndTagID,
    updateType: record.UpdateType,
    whereSpace: record.WhereSpace ?? null,
    inScopeSpaceIds: [...(record.InScopeSpaceIDs ?? [])].sort(),
    resolvedSpaceIds: [...(record.ResolvedSpaceIDs ?? [])].sort(),
    releasedSpaceIds: [...(record.ReleasedSpaceIDs ?? [])].sort(),
    state: record.State,
  };
}

function promoteV020Destination({
  destination,
  expectedBefore,
  expectedAfter,
  description,
  previous,
}) {
  let record = inspectPersistentVariant(destination);
  let preview = previous?.preview ?? null;
  if (canonicalDocs(record.docs) === canonicalDocs(expectedBefore)) {
    const before = persistentUnitState(record);
    const args = [
      "variant",
      "promote",
      destination,
      "--change-order",
      `${developmentSpaceSlug}/${changeOrderSlug}`,
    ];
    const output = cub([...args, "--dry-run", "-o", "mutations"]);
    check(
      output.includes("kube-prometheus-stack") || output.includes(unitSlug),
      `${destination}: ChangeOrder preview did not name the changed configuration`,
    );
    record = inspectPersistentVariant(destination);
    check(
      JSON.stringify(persistentUnitState(record)) === JSON.stringify(before),
      `${destination}: ChangeOrder preview changed stored configuration`,
    );
    preview = {
      command: ["cub", ...args, "--dry-run", "-o", "mutations"],
      result: "pass",
      reportedUnitCount: 1,
      storedDataUnchanged: true,
    };
    cub([...args, "--change-desc", description], { inherit: true });
    record = inspectPersistentVariant(destination);
  }
  check(preview, `${destination}: ChangeOrder preview evidence is missing`);
  check(
    canonicalDocs(record.docs) === canonicalDocs(expectedAfter),
    `${destination}: promoted configuration does not match development`,
  );
  const revision = findPersistentRevision(
    record.revisions,
    (candidate) => candidate.Source === "UpgradeUnit",
    `${destination} ChangeOrder revision`,
  );
  return {
    space: destination,
    preview,
    result: "pass",
    revision: persistentRevisionRecord(revision),
    upstreamRevisionMatched: true,
    pendingAfter: 0,
  };
}

function inspectPersistentVariant(slug) {
  const response = cubJson(["space", "get", slug, "-o", "json"]);
  const space = response.Space;
  const listed = cubJson(["unit", "list", "--space", slug, "-o", "json"])
    .map((item) => item.Unit ?? item);
  const units = listed.map((item) =>
    cubJson(["unit", "get", "--space", slug, item.Slug, "-o", "json"]).Unit
  );
  const configuration = units.find((item) => item.Slug === unitSlug);
  const readme = units.find((item) => item.Slug === readmeSlug);
  check(configuration, `${slug} has no ${unitSlug} Unit`);
  check(readme, `${slug} has no README Unit`);
  const docs = parseDocs(storedUnitData(configuration));
  const revisions = cubJson([
    "revision",
    "list",
    "--space",
    slug,
    unitSlug,
    "-o",
    "json",
  ]).map((item) => item.Revision ?? item);
  return {
    slug,
    space,
    docs,
    upgradableUnitCount: Number(response.UpgradableUnitCount ?? 0),
    configuration: {
      id: configuration.UnitID,
      dataHash: configuration.DataHash,
      headRevision: Number(configuration.HeadRevisionNum ?? 0),
      upstreamRevision: Number(configuration.UpstreamRevisionNum ?? 0),
      fromLinkIds: configuration.FromLinkID ?? [],
      applyGates: Object.keys(configuration.ApplyGates ?? {}).sort(),
    },
    readme: {
      id: readme.UnitID,
      dataHash: readme.DataHash,
      headRevision: Number(readme.HeadRevisionNum ?? 0),
      fromLinkIds: readme.FromLinkID ?? [],
      applyGates: Object.keys(readme.ApplyGates ?? {}).sort(),
    },
    checkSlugs: selectedPersistentTriggerSlugs(space),
    revisions,
  };
}

function verifyPersistentVariant(record, expected) {
  check(
    record.space.Labels?.Variant === expected.variant,
    `${record.slug} Variant label changed`,
  );
  check(
    String(record.space.Labels?.Environment ?? "") === expected.environment,
    `${record.slug} Environment label changed`,
  );
  check(
    String(record.space.Annotations?.UpstreamSpaceID ?? "")
      === expected.upstreamSpaceId,
    `${record.slug} upstream Space changed`,
  );
  check(
    record.configuration.fromLinkIds.length === expected.fromLinks,
    `${record.slug} configuration link count changed`,
  );
  const allowedReadmeFromLinks = expected.allowedReadmeFromLinks
    ?? [expected.readmeFromLinks ?? 0];
  check(
    allowedReadmeFromLinks.includes(record.readme.fromLinkIds.length),
    `${record.slug} README link count changed`,
  );
  check(record.docs.length === 17, `${record.slug} must contain 17 Applications`);
  check(
    canonicalDocs(record.docs) === canonicalDocs(expected.expectedDocs),
    `${record.slug} contains an unexpected Application change`,
  );
  check(
    sameStringSet(record.checkSlugs, expectedPersistentCheckSlugs()),
    `${record.slug} does not select the expected system-configuration checks`,
  );
  check(
    requiredApprovalCovered(record, expected.allowApprovedRelease),
    `${record.slug} has neither a required approval gate nor a matching approved release`,
  );
}

function requiredApprovalCovered(record, allowApprovedRelease = false) {
  const release = allowApprovedRelease ? approvedReleaseCoverage(record) : null;
  return (
    record.configuration.applyGates.includes(approvalGate)
      || release?.configuration === true
  ) && (
    record.readme.applyGates.includes(approvalGate)
      || release?.readme === true
  );
}

function approvedReleaseCoverage(record) {
  if (!existsSync(releaseReceiptPath)) return false;
  const receipt = readYaml(releaseReceiptPath);
  const usable = receipt.status?.approval === "pass"
    && receipt.status?.releasePublish === "pass"
    && receipt.spec?.space?.slug === record.slug;
  if (!usable) return null;
  return {
    configuration:
      receipt.spec?.approval?.configuration?.id === record.configuration.id
      && receipt.spec.approval.configuration.revision
        === record.configuration.headRevision,
    readme:
      receipt.spec?.approval?.readme?.id === record.readme.id
      && receipt.spec.approval.readme.revision === record.readme.headRevision,
  };
}

function verifyPersistentPromotionReceipt(receipt, uploadReceipt) {
  if (v020Entry) {
    verifyV020PersistentPromotionReceipt(receipt, uploadReceipt);
    return;
  }
  verifyLegacyPersistentPromotionReceipt(receipt, uploadReceipt);
}

function verifyV020PersistentPromotionReceipt(receipt, uploadReceipt) {
  check(
    receipt.kind === "VariantReadinessReceipt"
      && receipt.status?.result === "pass",
    "persistent AICR v0.20.0 promotion receipt is not pass",
  );
  check(
    receipt.spec?.source?.literalConfiguration?.reference === publicConfigRef
      && receipt.spec.source.literalConfiguration.digest === configArtifact.digest
      && receipt.spec.source.literalConfiguration.anonymousPull === "pass"
      && receipt.spec.source.sourcePackage.reference === publicSourceRef
      && receipt.spec.source.sourcePackage.digest === sourceArtifact.portableDigest,
    "persistent AICR v0.20.0 promotion source changed",
  );
  const chain = receipt.spec?.chain;
  check(
    chain?.base?.space === spaceSlug
      && chain.base.id === uploadReceipt.spec.space.id
      && chain.development?.space === developmentSpaceSlug
      && chain.development.upstreamSpaceId === chain.base.id
      && chain.staging?.space === stagingSpaceSlug
      && chain.staging.upstreamSpaceId === chain.development.id
      && chain.production?.space === productionSpaceSlug
      && chain.production.upstreamSpaceId === chain.staging.id
      && chain.staging.configurationUnit.upstreamRevision
        === chain.development.configurationUnit.headRevision
      && chain.production.configurationUnit.upstreamRevision
        === chain.staging.configurationUnit.headRevision,
    "persistent AICR v0.20.0 environment chain changed",
  );
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  check(
    chain.base.canonicalDataSha256 === hash(canonicalDocs(baseDocs))
      && chain.development.canonicalDataSha256 === hash(canonicalDocs(changedDocs))
      && chain.staging.canonicalDataSha256 === hash(canonicalDocs(changedDocs))
      && chain.production.canonicalDataSha256 === hash(canonicalDocs(changedDocs)),
    "persistent AICR v0.20.0 receipt contains an unexpected Application set",
  );
  for (const record of [
    chain.base,
    chain.development,
    chain.staging,
    chain.production,
  ]) {
    check(
      record.applicationCount === 17
        && record.readmeUnit.fromLinkIds.length === 0
        && sameStringSet(record.policyChecks, expectedPersistentCheckSlugs())
        && record.applyGates.includes(approvalGate),
      `${record.space} receipt evidence changed`,
    );
  }
  check(
    receipt.spec?.change?.resource
      === "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack"
      && receipt.spec.change.changedApplicationCount === 1
      && receipt.spec.change.preview?.result === "pass"
      && receipt.spec.change.preview.storedDataUnchanged === true,
    "persistent AICR v0.20.0 development change evidence changed",
  );
  const order = receipt.spec?.changeOrder;
  check(
    order?.slug === changeOrderSlug
      && typeof order.id === "string"
      && typeof order.startTagId === "string"
      && typeof order.endTagId === "string"
      && order.updateType === "UpgradeUnit"
      && sameStringSet(order.inScopeSpaceIds ?? [], [
        chain.staging.id,
        chain.production.id,
      ]),
    "persistent AICR v0.20.0 ChangeOrder evidence changed",
  );
  const destinations = receipt.spec?.promotion?.destinations;
  for (const [name, slug] of [
    ["staging", stagingSpaceSlug],
    ["production", productionSpaceSlug],
  ]) {
    const destination = destinations?.[name];
    check(
      destination?.space === slug
        && destination.preview?.result === "pass"
        && destination.preview.reportedUnitCount === 1
        && destination.preview.storedDataUnchanged === true
        && destination.result === "pass"
        && destination.revision?.source === "UpgradeUnit"
        && destination.upstreamRevisionMatched === true
        && destination.pendingAfter === 0,
      `${slug}: persistent AICR v0.20.0 promotion evidence changed`,
    );
  }
  check(
    receipt.spec?.promotion?.changeOrder
      === `${developmentSpaceSlug}/${changeOrderSlug}`
      && receipt.spec.promotion.result === "pass"
      && receipt.spec.promotion.pendingAfter === 0
      && receipt.spec.promotion.destinationsMatchDevelopment === true,
    "persistent AICR v0.20.0 promotion result changed",
  );
  check(
    receipt.spec?.policy?.profile === "catalog-standard"
      && receipt.spec.policy.filter === approvalRequiredFilterRef
      && receipt.spec.policy.approvalGate === approvalGate
      && receipt.spec.policy.approvalRequiredOnEverySpace === true,
    "persistent AICR v0.20.0 policy evidence changed",
  );
}

function verifyLegacyPersistentPromotionReceipt(receipt, uploadReceipt) {
  check(
    receipt.kind === "VariantReadinessReceipt"
      && receipt.status?.result === "pass",
    "persistent AICR promotion receipt is not pass",
  );
  check(
    receipt.spec?.source?.literalConfiguration?.reference === publicConfigRef
      && receipt.spec.source.literalConfiguration.digest === configArtifact.digest
      && receipt.spec.source.literalConfiguration.anonymousPull === "pass"
      && receipt.spec.source.sourcePackage.reference === publicSourceRef
      && receipt.spec.source.sourcePackage.digest === sourceArtifact.portableDigest,
    "persistent AICR promotion source changed",
  );
  const chain = receipt.spec?.chain;
  check(
    chain?.base?.space === spaceSlug
      && chain.base.id === uploadReceipt.spec.space.id
      && chain.development?.space === developmentSpaceSlug
      && chain.development.upstreamSpaceId === chain.base.id
      && chain.staging?.space === stagingSpaceSlug
      && chain.staging.upstreamSpaceId === chain.development.id
      && chain.staging.configurationUnit.upstreamRevision
        === chain.development.configurationUnit.headRevision,
    "persistent AICR promotion chain changed",
  );
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  check(
    chain.base.canonicalDataSha256 === hash(canonicalDocs(baseDocs))
      && chain.development.canonicalDataSha256
        === hash(canonicalDocs(changedDocs))
      && chain.staging.canonicalDataSha256
        === hash(canonicalDocs(changedDocs)),
    "persistent AICR receipt contains an unexpected Application set",
  );
  for (const record of [chain.base, chain.development, chain.staging]) {
    check(
      record.applicationCount === 17
        && record.readmeUnit.fromLinkIds.length === 0
        && sameStringSet(record.policyChecks, expectedPersistentCheckSlugs())
        && record.applyGates.includes(approvalGate),
      `${record.space} receipt evidence changed`,
    );
  }
  check(
    receipt.spec?.change?.resource
      === "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack"
      && receipt.spec.change.changedApplicationCount === 1
      && receipt.spec.change.preview?.result === "pass"
      && receipt.spec.change.preview.storedDataUnchanged === true,
    "persistent AICR development change evidence changed",
  );
  check(
    receipt.spec?.promotion?.preview?.result === "pass"
      && receipt.spec.promotion.preview.reportedUnitCount === 1
      && receipt.spec.promotion.preview.storedDataUnchanged === true
      && receipt.spec.promotion.result === "pass"
      && receipt.spec.promotion.stagingRevision?.source === "UpgradeUnit"
      && receipt.spec.promotion.stagingRevision?.description
        === promotionDescription
      && receipt.spec.promotion.upstreamRevisionMatched === true
      && receipt.spec.promotion.pendingAfter === 0
      && receipt.spec.promotion.stagingMatchesDevelopment === true,
    "persistent AICR promotion evidence changed",
  );
  check(
    receipt.spec?.policy?.profile === "catalog-standard"
      && receipt.spec.policy.filter === approvalRequiredFilterRef
      && receipt.spec.policy.approvalGate === approvalGate
      && receipt.spec.policy.approvalRequiredOnEverySpace === true,
    "persistent AICR policy evidence changed",
  );
}

function verifyPersistentPromotionLive(receipt) {
  if (v020Entry) {
    verifyV020PersistentPromotionLive(receipt);
    return;
  }
  verifyLegacyPersistentPromotionLive(receipt);
}

function verifyV020PersistentPromotionLive(receipt) {
  const records = {
    base: inspectPersistentVariant(spaceSlug),
    development: inspectPersistentVariant(developmentSpaceSlug),
    staging: inspectPersistentVariant(stagingSpaceSlug),
    production: inspectPersistentVariant(productionSpaceSlug),
  };
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  verifyPersistentVariant(records.base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  verifyPersistentVariant(records.development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: records.base.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(records.staging, {
    variant: "staging",
    environment: "Staging",
    upstreamSpaceId: records.development.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(records.production, {
    variant: "production",
    environment: "Prod",
    upstreamSpaceId: records.staging.space.SpaceID,
    fromLinks: 1,
    allowApprovedRelease: true,
    expectedDocs: changedDocs,
  });
  for (const key of Object.keys(records)) {
    const live = persistentVariantRecord(records[key]);
    const saved = receipt.spec.chain[key];
    check(
      live.id === saved.id
        && live.configurationUnit.id === saved.configurationUnit.id
        && live.configurationUnit.dataHash === saved.configurationUnit.dataHash
        && live.configurationUnit.headRevision
          === saved.configurationUnit.headRevision
        && live.readmeUnit.id === saved.readmeUnit.id
        && live.readmeUnit.dataHash === saved.readmeUnit.dataHash,
      `${saved.space} drifted from the persistent AICR v0.20.0 receipt`,
    );
  }
  const liveOrder = changeOrderRecord(inspectV020ChangeOrder());
  check(
    liveOrder.id === receipt.spec.changeOrder.id
      && liveOrder.startTagId === receipt.spec.changeOrder.startTagId
      && liveOrder.endTagId === receipt.spec.changeOrder.endTagId,
    "live AICR v0.20.0 ChangeOrder drifted from its receipt",
  );
}

function verifyLegacyPersistentPromotionLive(receipt) {
  const records = {
    base: inspectPersistentVariant(spaceSlug),
    development: inspectPersistentVariant(developmentSpaceSlug),
    staging: inspectPersistentVariant(stagingSpaceSlug),
  };
  const baseDocs = sourceApplicationDocs();
  const changedDocs = withGrafanaSecret(baseDocs);
  verifyPersistentVariant(records.base, {
    variant: baseVariantSlug,
    environment: "",
    upstreamSpaceId: "",
    fromLinks: 0,
    expectedDocs: baseDocs,
  });
  verifyPersistentVariant(records.development, {
    variant: "development",
    environment: "Development",
    upstreamSpaceId: records.base.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  verifyPersistentVariant(records.staging, {
    variant: "staging",
    environment: "Staging",
    upstreamSpaceId: records.development.space.SpaceID,
    fromLinks: 1,
    expectedDocs: changedDocs,
  });
  for (const key of Object.keys(records)) {
    const live = persistentVariantRecord(records[key]);
    const saved = receipt.spec.chain[key];
    check(
      live.id === saved.id
        && live.configurationUnit.id === saved.configurationUnit.id
        && live.configurationUnit.dataHash === saved.configurationUnit.dataHash
        && live.configurationUnit.headRevision
          === saved.configurationUnit.headRevision
        && live.readmeUnit.id === saved.readmeUnit.id
        && live.readmeUnit.dataHash === saved.readmeUnit.dataHash,
      `${saved.space} drifted from the persistent AICR receipt`,
    );
  }
}

function ensureIndependentVariantReadme(space) {
  const path = variantReadmeUnitPath(space);
  check(
    existsSync(path),
    `${relative(repoRoot, path)} is missing; run npm run helm-catalog-readmes`,
  );
  const existingResult = cubResult(
    ["unit", "get", "--space", space, readmeSlug, "-o", "json"],
    { allowFailure: true },
  );
  let existing = existingResult.status === 0
    ? JSON.parse(existingResult.stdout).Unit
    : null;
  if (existing && (existing.FromLinkID ?? []).length) {
    cub(["unit", "delete", readmeSlug, "--space", space, "--quiet"]);
    existing = null;
  }
  const source = readFileSync(path, "utf8");
  if (existing && storedUnitData(existing) === source) return;
  cub([
    "unit",
    existing ? "update" : "create",
    "--space",
    space,
    readmeSlug,
    path,
    "--change-desc",
    `Explain ${space}`,
    "--label",
    "helm-expt.confighub.com/readme=true",
    "--label",
    `helm-expt.confighub.com/source-space=${space}`,
    "--quiet",
  ]);
}

function persistentVariantRecord(record) {
  return {
    space: record.slug,
    id: record.space.SpaceID,
    variant: record.space.Labels?.Variant ?? "",
    environment: record.space.Labels?.Environment ?? "",
    upstreamSpaceId: String(record.space.Annotations?.UpstreamSpaceID ?? ""),
    applicationCount: record.docs.length,
    canonicalDataSha256: hash(canonicalDocs(record.docs)),
    configurationUnit: {
      slug: unitSlug,
      id: record.configuration.id,
      dataHash: record.configuration.dataHash,
      headRevision: record.configuration.headRevision,
      upstreamRevision: record.configuration.upstreamRevision,
      fromLinkIds: record.configuration.fromLinkIds,
      applyGates: record.configuration.applyGates,
    },
    readmeUnit: {
      slug: readmeSlug,
      id: record.readme.id,
      dataHash: record.readme.dataHash,
      headRevision: record.readme.headRevision,
      fromLinkIds: record.readme.fromLinkIds,
      applyGates: record.readme.applyGates,
    },
    policyChecks: record.checkSlugs,
    applyGates: [...new Set([
      ...record.configuration.applyGates,
      ...record.readme.applyGates,
    ])].sort(),
    pendingUpstreamChanges: record.upgradableUnitCount,
  };
}

function persistentUnitState(record) {
  return {
    dataHash: record.configuration.dataHash,
    headRevision: record.configuration.headRevision,
    upstreamRevision: record.configuration.upstreamRevision,
  };
}

function withGrafanaSecret(docs) {
  const changed = structuredClone(docs);
  const application = changed.find(
    (doc) =>
      doc.kind === "Application"
      && doc.metadata?.namespace === "argocd"
      && doc.metadata?.name === "kube-prometheus-stack",
  );
  check(application, "AICR kube-prometheus-stack Application is missing");
  const values = String(application.spec?.source?.helm?.values ?? "");
  check(values.includes(oldGrafanaValue), "AICR Grafana password fixture changed");
  application.spec.source.helm.values = values.replace(
    oldGrafanaValue,
    newGrafanaValue,
  );
  return changed;
}

function selectedPersistentTriggerSlugs(space) {
  const selected = new Set(space.TriggerIDs ?? []);
  return cubJson(["trigger", "list", "--space", "platform", "-o", "json"])
    .map((item) => item.Trigger ?? item)
    .filter((item) => selected.has(item.TriggerID))
    .map((item) => item.Slug)
    .sort();
}

function expectedPersistentCheckSlugs() {
  return readYaml(policyPath).spec.approvalRequired.checks
    .map((item) => item.trigger.split("/").at(-1))
    .sort();
}

function previousPromotionEvidence() {
  if (!existsSync(promotionReceiptPath)) return null;
  const receipt = readYaml(promotionReceiptPath);
  return receipt.status?.result === "pass" || receipt.spec?.change?.preview?.result === "pass"
    ? receipt
    : null;
}

function writeV020PromotionCheckpoint(preview) {
  if (!v020Entry) return;
  writeYaml(promotionReceiptPath, {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "VariantReadinessReceipt",
    metadata: {
      name: `${componentSlug}-${versionSlug}-production`,
    },
    spec: {
      checkedAt: new Date().toISOString(),
      organization: expectedOrg,
      change: {
        resource:
          "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack",
        path: "spec.source.helm.values.grafana",
        from: "grafana.adminPassword",
        to: "grafana.admin.existingSecret",
        requiredSecret: "monitoring/aicr-grafana-admin",
        changedApplicationCount: 1,
        preview,
      },
    },
    status: {
      result: "in-progress",
      claim: "The development preview is retained. Environment promotion has not completed.",
    },
  });
}

function persistentRevisionRecord(revision) {
  return {
    id: revision.RevisionID,
    number: Number(revision.RevisionNum),
    source: revision.Source,
    description: revision.Description,
    createdAt: revision.CreatedAt,
  };
}

function findPersistentRevision(revisions, predicate, label) {
  const revision = revisions.find(predicate);
  check(revision, `missing ${label}`);
  return revision;
}

function storedUnitData(unit) {
  check(unit.SpaceSlug && unit.Slug, "stored Unit identity is missing");
  return cub([
    "unit",
    "data",
    "--space",
    unit.SpaceSlug,
    unit.Slug,
  ]);
}

function spacePresent(space) {
  return cubResult(["space", "get", space, "-o", "json"], {
    allowFailure: true,
  }).status === 0;
}

function sameStringSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assertOrg() {
  const context = cub(["context", "get"]);
  check(
    context.includes(expectedOrg),
    `refusing to run: cub context does not show organization '${expectedOrg}'`,
  );
}

function stripOci(reference) {
  return reference.replace(/^oci:\/\//, "");
}

function cub(args, { inherit = false } = {}) {
  return run("cub", [...contextArgs(), ...args], { inherit });
}

function cubJson(args) {
  return JSON.parse(cub(args));
}

function cubResult(args, { allowFailure = false } = {}) {
  const result = spawnSync("cub", [...contextArgs(), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 200,
  });
  if (!allowFailure) check(result.status === 0, result.stderr || result.stdout);
  return result;
}

function contextArgs() {
  return cubContext ? ["--context", cubContext] : [];
}

function run(command, args, { inherit = false } = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: inherit ? ["ignore", "inherit", "inherit"] : ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 200,
  });
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}
