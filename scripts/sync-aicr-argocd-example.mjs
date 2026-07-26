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
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  repoRoot,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set([
  "--verify",
  "--publish",
  "--public-verify",
  "--hub-sync",
  "--hub-record",
  "--hub-verify",
]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-aicr-argocd-example.mjs --verify
  node scripts/sync-aicr-argocd-example.mjs --publish
  node scripts/sync-aicr-argocd-example.mjs --public-verify
  node scripts/sync-aicr-argocd-example.mjs --hub-sync
  node scripts/sync-aicr-argocd-example.mjs --hub-record
  node scripts/sync-aicr-argocd-example.mjs --hub-verify`);
  process.exit(1);
}

const root = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const sourceReceiptPath = join(root, "argocd-oci-receipt.yaml");
const publicReceiptPath = join(root, "public-oci-receipt.yaml");
const uploadReceiptPath = join(root, "confighub-upload-receipt.yaml");
const renderedRoot = join(root, "argocd-rendered");
const sourceLayoutRoot = join(root, "oci-layouts", "argocd-source");
const configLayoutRoot = join(root, "oci-layouts", "argocd-config");
const readmeUnitPath = join(
  repoRoot,
  "data",
  "helm-catalog-readmes",
  "units",
  "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
  "readme.yaml",
);
const policyPath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");

const sourceReceipt = readYaml(sourceReceiptPath);
const sourceArtifact = sourceReceipt.spec.artifacts.sourcePackage;
const configArtifact = sourceReceipt.spec.artifacts.literalConfiguration;
const publicSourceRef = sourceArtifact.publicTarget;
const publicConfigRef = configArtifact.publicTarget;
const configRef = process.env.AICR_CONFIG_OCI_REF || publicConfigRef;
const expectedOrg = "helm-catalog";
const spaceSlug = "aicr-eks-h100-training-kubeflow-v0-14-0-argocd";
const unitSlug = "aicr-eks-h100-training-kubeflow";
const readmeSlug = "readme";
const baselineFilterRef = "platform/helm-catalog-checks";
const cubContext = process.env.CUB_CONTEXT ?? "";

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
  console.log(
    `synchronized live AICR base variant (${spaceSlug}/${unitSlug}, ${receipt.spec.unit.uploadedObjectCount} Argo CD Applications)`,
  );
  process.exit(0);
}
if (mode === "--hub-record") {
  assertOrg();
  const liveSpace = cubJson(["space", "get", spaceSlug, "-o", "json"]).Space;
  const receipt = collectLiveReceipt(liveSpace.Annotations?.ExternalSource);
  writeYaml(uploadReceiptPath, receipt);
  verifyUploadReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`recorded live AICR base variant receipt for ${spaceSlug}`);
  process.exit(0);
}
if (mode === "--hub-verify") {
  assertOrg();
  const receipt = verifyCommittedUploadReceipt();
  verifyLiveAgainstReceipt(receipt);
  console.log(
    `verified live AICR base variant (${spaceSlug}/${unitSlug}, ${receipt.spec.unit.uploadedObjectCount} Argo CD Applications)`,
  );
  process.exit(0);
}

verifyCommittedUploadReceipt();
console.log("verified AICR ConfigHub upload receipt and public-receipt contract");

function runLocalVerification() {
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "verify-aicr-argocd-example.mjs")],
    { cwd: repoRoot, stdio: "inherit" },
  );
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
      name: "aicr-eks-h100-training-kubeflow-v0-14-0",
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
  const updatedSourceReceipt = structuredClone(sourceReceipt);
  updatedSourceReceipt.status.publicSourcePush = "pass";
  updatedSourceReceipt.status.publicSourcePull = "pass";
  updatedSourceReceipt.status.publicRenderedPush = "pass";
  updatedSourceReceipt.status.publicRenderedPull = "pass";
  updatedSourceReceipt.status.claim = "AICR v0.14.0 generated a portable Argo CD Helm chart and 17 exact Argo CD Application objects. Both OCI artifacts are publicly pullable at their recorded digests. ConfigHub imported the 17 Applications as one base variant. Argo CD reconciliation and GPU-cluster health have not run.";
  writeYaml(sourceReceiptPath, updatedSourceReceipt);
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "verify-aicr-argocd-example.mjs")],
    { cwd: repoRoot, stdio: "inherit" },
  );
  console.log("published and anonymously verified both AICR OCI artifacts");
}

function copyLayout(layoutRoot, target) {
  run("oras", [
    "cp",
    "--from-oci-layout",
    `${layoutRoot}:0.14.0`,
    stripOci(target),
  ], { inherit: true });
}

function verifyPublicReceipt({ fetch }) {
  check(existsSync(publicReceiptPath), "public AICR OCI receipt is missing; run the publish command after Google authentication");
  const receipt = readYaml(publicReceiptPath);
  check(receipt.kind === "PublicOciReceipt", "AICR public OCI receipt kind changed");
  check(receipt.status?.result === "pass", "AICR public OCI receipt is not pass");
  check(receipt.status?.anonymousPull === "pass", "AICR public OCI receipt must record anonymous pull");
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
      `${pulledLayout}:0.14.0`,
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
    "aicr-eks-h100-training-kubeflow",
    "--variant",
    "v0-14-0-argocd",
    "--space",
    spaceSlug,
    "--granularity",
    "minimal",
    "--label",
    "SourceType=aicr",
    "--layer",
    "Platform",
    "--owner",
    "Platform",
    "--change-desc",
    "Upload AICR v0.14.0 Argo application bundle",
    configRef,
  ];
  cub(args, { inherit: true });
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
    "--trigger-filter",
    baselineFilterRef,
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
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigHubUploadReceipt",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
    },
    spec: {
      organization: expectedOrg,
      verifiedAt: new Date().toISOString(),
      command: [
        "cub",
        "variant",
        "upload",
        "--component",
        "aicr-eks-h100-training-kubeflow",
        "--variant",
        "v0-14-0-argocd",
        "--space",
        spaceSlug,
        "--granularity",
        "minimal",
        sourceReference,
      ],
      source: {
        reference: sourceReference,
        digest: configArtifact.digest,
        renderedObjectCount: live.applicationCount,
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
        externalSource: live.space.Annotations?.ExternalSource,
        externalSourceDigest: live.space.Annotations?.ExternalSourceDigest,
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
        filter: baselineFilterRef,
        filterId: live.space.TriggerFilterID,
        checks: policy.spec.baseline.checks.map((item) => item.trigger),
      },
    },
    status: {
      result: "partial",
      ociPull: "pass",
      configHubBaseVariantUpload: "pass",
      objectIdentitiesMatched: "pass",
      baselinePolicyAssigned: "pass",
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
  const liveDocs = parseDocs(Buffer.from(unit.Data, "base64").toString("utf8"));
  check(canonicalDocs(liveDocs) === canonicalDocs(sourceDocs), "live AICR Unit differs from the rendered Application files");
  const readmeSource = parseDocs(readFileSync(readmeUnitPath, "utf8"));
  const liveReadme = parseDocs(Buffer.from(readme.Data, "base64").toString("utf8"));
  check(canonicalDocs(liveReadme) === canonicalDocs(readmeSource), "live AICR README differs from its generated source");
  const waves = sourceDocs
    .filter((doc) => doc.metadata?.name !== "aicr-stack")
    .map((doc) => Number(doc.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
    .sort((left, right) => left - right);
  check(
    JSON.stringify(waves) === JSON.stringify(Array.from({ length: 16 }, (_, index) => index)),
    "AICR sync waves must remain 0 through 15",
  );
  check(sourceDocs.every((doc) => doc.kind === "Application"), "AICR upload contains a non-Application object");
  return {
    space,
    unit,
    readme,
    applicationCount: sourceDocs.length,
    syncWaves: waves,
  };
}

function sourceApplicationDocs() {
  return listFiles(renderedRoot)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .flatMap((path) => parseDocs(readFileSync(path, "utf8")));
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
  check(receipt.spec?.space?.slug === spaceSlug, "AICR upload Space changed");
  check(receipt.spec?.space?.externalSourceDigest === configArtifact.digest, "AICR Space source digest changed");
  check(receipt.spec?.unit?.slug === unitSlug, "AICR upload Unit changed");
  check(receipt.spec?.unit?.uploadedObjectCount === 17, "AICR uploaded Application count changed");
  check(receipt.spec?.unit?.sourceObjectsMatched === true, "AICR source-object comparison must pass");
  check(
    JSON.stringify(receipt.spec?.unit?.syncWaves) === JSON.stringify(Array.from({ length: 16 }, (_, index) => index)),
    "AICR upload receipt sync waves changed",
  );
  check(receipt.spec?.policy?.profile === "catalog-standard", "AICR upload policy profile changed");
  check(receipt.spec?.policy?.checks?.length === 5, "AICR upload must record five baseline checks");
  check(receipt.status?.configHubBaseVariantUpload === "pass", "AICR base variant upload is not pass");
  check(receipt.status?.objectIdentitiesMatched === "pass", "AICR object comparison is not pass");
  check(receipt.status?.baselinePolicyAssigned === "pass", "AICR baseline policy assignment is not pass");
  check(receipt.status?.apply === "not-run", "AICR upload must not claim apply");
  check(receipt.status?.liveArgoReconciliation === "not-run", "AICR upload must not claim live Argo CD");
  check(receipt.status?.liveGpuReconciliation === "not-run", "AICR upload must not claim GPU health");
}

function verifyLiveAgainstReceipt(receipt) {
  const live = inspectLive();
  check(live.space.SpaceID === receipt.spec.space.id, "live AICR Space ID changed");
  check(live.space.Annotations?.ExternalSource === receipt.spec.space.externalSource, "live AICR external source changed");
  check(
    live.space.Annotations?.ExternalSourceDigest === receipt.spec.space.externalSourceDigest,
    "live AICR external source digest changed",
  );
  check(live.space.TriggerFilterID === receipt.spec.policy.filterId, "live AICR policy filter changed");
  check(live.unit.UnitID === receipt.spec.unit.id, "live AICR Unit ID changed");
  check(live.unit.DataHash === receipt.spec.unit.dataHash, "live AICR Unit data hash changed");
  check(live.readme.UnitID === receipt.spec.readme.id, "live AICR README ID changed");
  check(live.readme.DataHash === receipt.spec.readme.dataHash, "live AICR README data hash changed");
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
