#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const root = join(repoRoot, "examples", "aicr", "eks-h100-training-kubeflow");
const receiptPath = join(root, "argocd-oci-receipt.yaml");
const sourceRoot = join(root, "argocd-helm-bundle");
const renderedRoot = join(root, "argocd-rendered");
const sourceChecksumsPath = join(sourceRoot, "checksums.txt");
const renderedChecksumsPath = join(renderedRoot, "checksums.txt");
const sourceManifestPath = join(root, "local-argocd-source-oci-manifest.json");
const renderedManifestPath = join(root, "local-argocd-config-oci-manifest.json");
const uploadReceiptPath = join(root, "confighub-upload-receipt.yaml");
const policyReceiptPath = join(root, "apply-policy-receipt.yaml");
const promotionReceiptPath = join(root, "promotion-readiness-receipt.yaml");
const promotionProofPath = join(repoRoot, "runs", "aicr-variant-promotion-proof", "receipt.yaml");
const publicReceiptPath = join(root, "public-oci-receipt.yaml");
const sourceLayoutRoot = join(root, "oci-layouts", "argocd-source");
const renderedLayoutRoot = join(root, "oci-layouts", "argocd-config");
const skipUploadReceipt = process.env.AICR_SKIP_UPLOAD_RECEIPT === "1";
const skipPolicyReceipt = process.env.AICR_SKIP_POLICY_RECEIPT === "1";

const requiredPaths = [
  receiptPath,
  sourceChecksumsPath,
  renderedChecksumsPath,
  sourceManifestPath,
  renderedManifestPath,
  uploadReceiptPath,
  promotionReceiptPath,
  promotionProofPath,
  join(sourceLayoutRoot, "index.json"),
  join(renderedLayoutRoot, "index.json"),
];
if (!skipPolicyReceipt) requiredPaths.push(policyReceiptPath);
for (const path of requiredPaths) {
  check(existsSync(path), `missing AICR Argo CD evidence: ${relative(repoRoot, path)}`);
}

const receipt = readYaml(receiptPath);
const uploadReceipt = readYaml(uploadReceiptPath);
const policyReceipt = skipPolicyReceipt ? null : readYaml(policyReceiptPath);
const promotionReceipt = readYaml(promotionReceiptPath);
const promotionProof = readYaml(promotionProofPath);
check(receipt.spec?.deployer === "argocd-helm", "AICR Argo CD receipt must use argocd-helm");
check(receipt.spec?.source?.version === "v0.14.0", "AICR Argo CD receipt must pin v0.14.0");

const sourceFileCount = verifyChecksums(sourceRoot, sourceChecksumsPath, "Argo CD source bundle");
const renderedFileCount = verifyChecksums(renderedRoot, renderedChecksumsPath, "rendered Argo CD bundle");
check(sourceFileCount === 54, `expected 54 source bundle files, found ${sourceFileCount}`);
check(renderedFileCount === 17, `expected 17 rendered Application files, found ${renderedFileCount}`);

const allPortableText = [
  ...listFiles(sourceRoot).filter((path) => path !== sourceChecksumsPath),
  ...listFiles(renderedRoot).filter((path) => path !== renderedChecksumsPath),
].map((path) => readFileSync(path, "utf8")).join("\n");
check(!allPortableText.includes("/Users/"), "portable AICR Argo CD evidence contains a workstation path");
check(!allPortableText.includes("localhost:5001"), "portable AICR Argo CD evidence contains the local registry");
check(!allPortableText.includes("YOUR_ORG/YOUR_REPO"), "portable AICR Argo CD evidence contains a placeholder");

const sourceCommand = receipt.spec?.commands?.generateSourceBundle ?? [];
for (const required of [
  "--deployer",
  "argocd-helm",
  "--storage-class",
  "gp3",
  "--accelerated-node-selector",
  "nvidia.com/gpu.present=true",
  "--workload-selector",
  "app.kubernetes.io/part-of=training",
]) {
  check(sourceCommand.includes(required), `AICR Argo CD generation command is missing ${required}`);
}

const chart = readYaml(join(sourceRoot, "Chart.yaml"));
check(chart.name === "aicr-eks-h100-training-kubeflow-argocd", "AICR Argo CD chart name changed");
check(String(chart.version) === "0.14.0", "AICR Argo CD chart version changed");
const chartValues = readYaml(join(sourceRoot, "values.yaml"));
check(chartValues.repoURL === "", "AICR Argo CD source chart must keep repoURL dynamic");
check(chartValues.targetRevision === "", "AICR Argo CD source chart must keep targetRevision dynamic");

const renderedPaths = listFiles(renderedRoot)
  .filter((path) => path.endsWith(".yaml"))
  .sort();
const applications = renderedPaths.map((path) => ({ path, object: readYaml(path) }));
for (const { path, object } of applications) {
  check(object.apiVersion === "argoproj.io/v1alpha1", `${basename(path)} apiVersion changed`);
  check(object.kind === "Application", `${basename(path)} must contain an Argo CD Application`);
  check(object.metadata?.namespace === "argocd", `${basename(path)} must live in argocd`);
}

const expectedNames = [
  "aicr-stack",
  "aws-ebs-csi-driver",
  "aws-efa",
  "cert-manager",
  "gpu-operator",
  "k8s-ephemeral-storage-metrics",
  "kai-scheduler",
  "kube-prometheus-stack",
  "kubeflow-trainer-post",
  "kubeflow-trainer",
  "nfd",
  "nodewright-customizations",
  "nodewright-operator",
  "nvidia-dra-driver-gpu",
  "nvsentinel",
  "prometheus-adapter",
  "prometheus-operator-crds",
].sort();
const actualNames = applications.map(({ object }) => object.metadata.name).sort();
check(JSON.stringify(actualNames) === JSON.stringify(expectedNames), "rendered Argo CD Application set changed");

const publicParentRepo = receipt.spec.renderInputs.repoURL;
const publicSourceRepo = `${publicParentRepo}/aicr-eks-h100-training-kubeflow-argocd`;
const parent = applications.find(({ object }) => object.metadata.name === "aicr-stack")?.object;
check(parent?.spec?.source?.repoURL === publicSourceRepo, "parent Application source OCI changed");
check(String(parent?.spec?.source?.targetRevision) === "0.14.0", "parent Application revision changed");
check(parent?.spec?.source?.path === ".", "parent Application must reconcile the chart root");

const children = applications.filter(({ object }) => object.metadata.name !== "aicr-stack");
const waves = children
  .map(({ object }) => Number(object.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]))
  .sort((left, right) => left - right);
check(
  JSON.stringify(waves) === JSON.stringify(Array.from({ length: 16 }, (_, index) => index)),
  "AICR Argo CD sync waves must remain 0 through 15",
);

for (const [name, expectedPath] of [
  ["nodewright-customizations", "006-nodewright-customizations"],
  ["kubeflow-trainer-post", "013-kubeflow-trainer-post"],
]) {
  const application = children.find(({ object }) => object.metadata.name === name)?.object;
  check(application?.spec?.source?.repoURL === publicSourceRepo, `${name} source OCI changed`);
  check(application?.spec?.source?.path === expectedPath, `${name} local chart path changed`);
}

const sourceDigest = receipt.spec?.artifacts?.sourcePackage?.portableDigest;
const renderedDigest = receipt.spec?.artifacts?.literalConfiguration?.digest;
const sourceManifest = verifyLayout(sourceLayoutRoot, sourceManifestPath, sourceDigest, "source package");
const renderedManifest = verifyLayout(renderedLayoutRoot, renderedManifestPath, renderedDigest, "literal configuration");

check(
  sourceManifest.config?.mediaType === "application/vnd.cncf.helm.config.v1+json",
  "AICR Argo CD source OCI must use the Helm config media type",
);
check(
  sourceManifest.layers?.length === 1
    && sourceManifest.layers[0]?.mediaType === "application/vnd.cncf.helm.chart.content.v1.tar+gzip",
  "AICR Argo CD source OCI must contain one Helm chart layer",
);
check(
  sourceManifest.annotations?.["org.opencontainers.image.created"] === "1970-01-01T00:00:00Z",
  "AICR Argo CD source OCI must keep the fixed creation annotation",
);

check(
  renderedManifest.artifactType === "application/vnd.confighub.kubernetes.config.v1",
  "rendered AICR Argo CD OCI artifact type changed",
);
check(renderedManifest.layers?.length === 17, "rendered AICR Argo CD OCI must contain 17 YAML layers");
const renderedLayerTitles = [];
for (const layer of renderedManifest.layers) {
  check(layer.mediaType === "application/yaml", "rendered AICR Argo CD OCI contains a non-YAML layer");
  const title = layer.annotations?.["org.opencontainers.image.title"];
  check(typeof title === "string", "rendered AICR Argo CD OCI layer has no file title");
  const filePath = join(renderedRoot, title);
  check(existsSync(filePath), `rendered AICR Argo CD OCI names missing file ${title}`);
  check(`sha256:${hash(readFileSync(filePath))}` === layer.digest, `rendered OCI digest differs for ${title}`);
  renderedLayerTitles.push(title);
}
const expectedLayerTitles = renderedPaths.map((path) => relative(renderedRoot, path).replaceAll("\\", "/"));
check(
  JSON.stringify(renderedLayerTitles.sort()) === JSON.stringify(expectedLayerTitles.sort()),
  "rendered AICR Argo CD OCI layer inventory changed",
);

check(receipt.status?.sourceLocalPush === "pass", "AICR Argo CD source local push must stay recorded");
check(receipt.status?.sourceLocalPull === "pass", "AICR Argo CD source local pull must stay recorded");
check(receipt.status?.helmTemplate === "pass", "AICR Argo CD Helm render must stay recorded");
check(receipt.status?.renderedLocalPush === "pass", "AICR Argo CD config local push must stay recorded");
check(receipt.status?.renderedLocalPull === "pass", "AICR Argo CD config local pull must stay recorded");
for (const field of [
  "publicSourcePush",
  "publicSourcePull",
  "publicRenderedPush",
  "publicRenderedPull",
  "liveArgoReconciliation",
  "liveGpuReconciliation",
]) {
  check(["not-run", "pass"].includes(receipt.status?.[field]), `AICR Argo CD receipt has invalid ${field}`);
}
check(receipt.status?.configHubUpload === "pass", "AICR ConfigHub upload must stay recorded as pass");
check(receipt.spec?.artifacts?.configHubBaseVariant?.status === "pass", "AICR ConfigHub base variant status changed");
check(
  receipt.spec?.artifacts?.configHubBaseVariant?.receipt
    === "examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml",
  "AICR ConfigHub upload receipt link changed",
);
if (!skipUploadReceipt) {
  check(uploadReceipt.kind === "ConfigHubUploadReceipt", "AICR ConfigHub upload receipt kind changed");
  check(uploadReceipt.status?.configHubBaseVariantUpload === "pass", "AICR ConfigHub upload receipt is not pass");
  check(uploadReceipt.spec?.source?.digest === renderedDigest, "AICR ConfigHub source digest changed");
  check(uploadReceipt.spec?.source?.renderedObjectCount === 17, "AICR ConfigHub object count changed");
  check(uploadReceipt.spec?.unit?.uploadedObjectCount === 17, "AICR ConfigHub Unit object count changed");
  check(uploadReceipt.spec?.unit?.sourceObjectsMatched === true, "AICR ConfigHub source comparison changed");
  check(uploadReceipt.spec?.policy?.profile === "catalog-standard", "AICR ConfigHub policy profile changed");
  check(
    uploadReceipt.spec?.space?.labels?.ResourceClass === "system-configuration",
    "AICR ConfigHub Space resource class changed",
  );
  check(
    uploadReceipt.spec?.policy?.reason === "system-configuration",
    "AICR ConfigHub approval reason changed",
  );
  check(
    uploadReceipt.spec?.policy?.checks?.length === 6,
    "AICR ConfigHub upload must record five common checks plus approval",
  );
  check(
    uploadReceipt.spec.policy.checks.includes("platform/require-approval"),
    "AICR ConfigHub upload policy must require approval",
  );
  check(uploadReceipt.status?.apply === "not-run", "AICR ConfigHub upload must not claim apply");
  check(uploadReceipt.status?.liveArgoReconciliation === "not-run", "AICR ConfigHub upload must not claim live Argo CD");
  check(uploadReceipt.status?.liveGpuReconciliation === "not-run", "AICR ConfigHub upload must not claim GPU health");
}

if (!skipPolicyReceipt) {
  const approvalGate = "platform/require-approval/vet-approvedby";
  check(
    policyReceipt.kind === "ConfigHubApplyPolicyReceipt",
    "AICR apply-policy receipt kind changed",
  );
  check(
    policyReceipt.spec?.source?.digest === renderedDigest,
    "AICR apply-policy source digest changed",
  );
  check(
    policyReceipt.spec?.space?.slug === "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
    "AICR apply-policy Space changed",
  );
  check(
    policyReceipt.spec?.space?.resourceClass === "system-configuration",
    "AICR apply-policy resource class changed",
  );
  check(
    policyReceipt.spec?.unit?.slug === "aicr-eks-h100-training-kubeflow",
    "AICR apply-policy Unit changed",
  );
  check(
    policyReceipt.spec?.policy?.profile === "catalog-standard",
    "AICR apply-policy profile changed",
  );
  check(
    policyReceipt.spec?.policy?.filter === "platform/helm-catalog-prod-gates",
    "AICR apply-policy filter changed",
  );
  check(
    policyReceipt.spec?.policy?.gate === approvalGate,
    "AICR apply-policy gate changed",
  );
  check(
    Number.isInteger(policyReceipt.spec?.dryRun?.exitCode)
      && policyReceipt.spec.dryRun.exitCode > 0,
    "AICR apply-policy dry run must remain rejected",
  );
  check(
    policyReceipt.spec?.dryRun?.response === "outstanding ApplyGates",
    "AICR apply-policy response changed",
  );
  check(
    JSON.stringify(policyReceipt.spec?.dryRun?.before)
      === JSON.stringify(policyReceipt.spec?.dryRun?.after),
    "AICR apply-policy dry run changed the Unit",
  );
  check(
    policyReceipt.spec?.dryRun?.before?.applyGates?.includes(approvalGate),
    "AICR apply-policy receipt does not record the approval gate",
  );
  check(
    policyReceipt.spec?.dryRun?.before?.targetId === null,
    "AICR apply-policy proof must not attach a target",
  );
  check(policyReceipt.status?.result === "pass", "AICR apply-policy receipt is not pass");
  check(
    policyReceipt.status?.requiredApprovalBlockedDryRun === "pass",
    "AICR required-approval behavior is not pass",
  );
  check(
    policyReceipt.status?.configurationApplied === "not-run",
    "AICR apply-policy receipt must not claim apply",
  );
}

check(promotionReceipt.kind === "VariantReadinessReceipt", "AICR promotion readiness receipt kind changed");
check(
  promotionReceipt.spec?.upstream?.space === "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
  "AICR promotion readiness upstream changed",
);
check(promotionReceipt.spec?.upstream?.sourceDigest === renderedDigest, "AICR promotion readiness digest changed");
check(
  promotionReceipt.spec?.intendedVariant?.change?.resource
    === "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack",
  "AICR intended staging resource changed",
);
check(
  promotionReceipt.spec?.intendedVariant?.change?.to === "grafana.admin.existingSecret",
  "AICR intended Grafana Secret change changed",
);
check(
  promotionReceipt.spec?.intendedVariant?.change?.dryRunMutationCount === 1,
  "AICR staging change must remain one dry-run mutation",
);
check(
  promotionReceipt.spec?.intendedVariant?.change?.dryRunCommand?.includes(
    "  admin:\n    existingSecret: aicr-grafana-admin\n    userKey: admin-user\n    passwordKey: admin-password",
  ),
  "AICR staging dry-run command no longer records the existing-Secret values",
);
check(promotionReceipt.spec?.liveLimit?.entityType === "Link", "AICR promotion blocker must name the Link quota");
check(promotionReceipt.spec?.liveLimit?.current === 1000, "AICR promotion blocker live Link count changed");
check(promotionReceipt.spec?.liveLimit?.maximum === 1000, "AICR promotion blocker Link quota changed");
check(promotionReceipt.spec?.cleanup?.partialSpaceDeleted === true, "AICR failed variant Space was not cleaned up");
check(promotionReceipt.status?.result === "blocked", "AICR promotion readiness must remain blocked");
check(
  promotionReceipt.status?.derivedVariant === "blocked-by-link-quota",
  "AICR promotion blocker classification changed",
);
check(promotionReceipt.status?.promotionPreview === "not-run", "AICR promotion readiness must not claim a preview");
check(promotionReceipt.status?.promotion === "not-run", "AICR promotion readiness must not claim promotion");

check(
  promotionProof.kind === "AicrVariantPromotionProofReceipt",
  "AICR scratch promotion proof kind changed",
);
check(promotionProof.status?.result === "pass", "AICR scratch promotion proof is not pass");
check(
  promotionProof.spec?.source?.digest === renderedDigest,
  "AICR scratch promotion proof used a different literal configuration OCI",
);
check(
  promotionProof.spec?.source?.applicationCount === 17,
  "AICR scratch promotion proof Application count changed",
);
check(
  promotionProof.spec?.source?.exactSourceObjectsMatched === true,
  "AICR scratch promotion proof did not match the committed Application files",
);
check(
  promotionProof.spec?.change?.changedApplicationCount === 1
    && promotionProof.spec?.change?.changedApplications?.[0]
      === "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack",
  "AICR scratch promotion proof must change only kube-prometheus-stack",
);
check(
  promotionProof.spec?.change?.after?.admin?.existingSecret === "aicr-grafana-admin",
  "AICR scratch promotion proof no longer uses the reviewed Grafana Secret",
);
check(
  promotionProof.spec?.promotion?.dryRun === "pass"
    && promotionProof.spec?.promotion?.dryRunLeftStagingUnchanged === true
    && promotionProof.spec?.promotion?.result === "pass"
    && promotionProof.spec?.promotion?.stagingMatchesReviewedDev === true,
  "AICR scratch dev-to-staging promotion evidence is incomplete",
);
check(
  Object.values(promotionProof.spec?.cleanup ?? {}).every((value) => value === "pass"),
  "AICR scratch promotion proof cleanup did not pass",
);

const publicStatuses = [
  receipt.status?.publicSourcePush,
  receipt.status?.publicSourcePull,
  receipt.status?.publicRenderedPush,
  receipt.status?.publicRenderedPull,
];
if (publicStatuses.some((status) => status === "pass")) {
  check(publicStatuses.every((status) => status === "pass"), "AICR public OCI statuses must advance together");
  check(existsSync(publicReceiptPath), "AICR public OCI statuses are pass but the public receipt is missing");
  const publicReceipt = readYaml(publicReceiptPath);
  check(publicReceipt.status?.result === "pass", "AICR public OCI receipt is not pass");
  check(publicReceipt.status?.anonymousPull === "pass", "AICR public OCI receipt must record anonymous pull");
}

console.log(
  `verified AICR Argo CD OCI example (${sourceFileCount} source files, ${renderedFileCount} Applications, 2 local OCI layouts)`,
);

function verifyChecksums(bundleRoot, checksumsPath, label) {
  const expected = new Map(
    readFileSync(checksumsPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const match = line.match(/^([a-f0-9]{64})  ([^/].*)$/);
        check(match, `invalid ${label} checksum line: ${line}`);
        check(!match[2].includes(".."), `${label} checksum escapes its root: ${match[2]}`);
        return [match[2], match[1]];
      }),
  );
  const files = listFiles(bundleRoot)
    .map((path) => relative(bundleRoot, path).replaceAll("\\", "/"))
    .filter((path) => path !== "checksums.txt")
    .sort();
  check(files.length === expected.size, `${label} checksum inventory size changed`);
  for (const path of files) {
    check(expected.has(path), `${label} checksum omits ${path}`);
    check(hash(readFileSync(join(bundleRoot, path))) === expected.get(path), `${label} checksum differs for ${path}`);
  }
  return files.length;
}

function verifyLayout(layoutRoot, manifestPath, expectedDigest, label) {
  const manifestBytes = readFileSync(manifestPath);
  check(`sha256:${hash(manifestBytes)}` === expectedDigest, `${label} manifest digest changed`);
  const index = JSON.parse(readFileSync(join(layoutRoot, "index.json"), "utf8"));
  check(index.manifests?.length === 1, `${label} OCI layout must contain one tagged manifest`);
  check(index.manifests[0]?.digest === expectedDigest, `${label} OCI layout index digest changed`);
  const manifestBlobPath = join(layoutRoot, "blobs", "sha256", expectedDigest.replace("sha256:", ""));
  check(existsSync(manifestBlobPath), `${label} OCI layout manifest blob is missing`);
  check(readFileSync(manifestBlobPath).equals(manifestBytes), `${label} standalone manifest differs from its OCI layout`);
  const manifest = JSON.parse(manifestBytes);
  for (const descriptor of [manifest.config, ...(manifest.layers ?? [])]) {
    const blobPath = join(layoutRoot, "blobs", "sha256", descriptor.digest.replace("sha256:", ""));
    check(existsSync(blobPath), `${label} OCI layout is missing ${descriptor.digest}`);
    const blob = readFileSync(blobPath);
    check(`sha256:${hash(blob)}` === descriptor.digest, `${label} OCI blob digest differs for ${descriptor.digest}`);
    check(blob.length === descriptor.size, `${label} OCI blob size differs for ${descriptor.digest}`);
  }
  return manifest;
}

function hash(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}
