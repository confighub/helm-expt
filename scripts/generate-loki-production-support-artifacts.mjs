#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256File, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "grafana/loki";
const chartSlug = "grafana-loki";
const version = "7.0.0";
const supportedBase = "single-binary-filesystem";
const variants = ["single-binary-filesystem", "simple-scalable-minio"];
const imageReviewPath = join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv");
const imageWorkdownPath = join(repoRoot, "data", "image-digest-workdown", "chart-summary.csv");
const externalScanPath = join(repoRoot, "data", "external-scan-lane", "review.csv");
const scanWorkdownPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const liveReceiptPath = join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const kindParityPath = join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const outputRoot = join(repoRoot, "data", "production-support-decisions", chartSlug);
const resolvedImages = new Map();

if (mode === "--generate") {
  for (const variant of variants) writeYaml(imageReceiptPath(variant), buildImageReceipt(variant));
  writeYaml(join(outputRoot, "image-policy-decision.yaml"), buildImagePolicyDecision());
  writeYaml(join(outputRoot, "security-decision.yaml"), buildSecurityDecision());
  writeYaml(join(outputRoot, "lifecycle-decision.yaml"), buildLifecycleDecision());
  writeYaml(join(outputRoot, "fresh-target-evidence-2026-06-08.yaml"), buildFreshEvidenceReceipt());
  console.log(`wrote Loki support artifacts -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  for (const variant of variants) verifyImageReceipt(variant);
  verifyImagePolicyDecision();
  verifySecurityDecision();
  verifyLifecycleDecision();
  verifyFreshEvidenceReceipt();
  console.log("verified Loki support artifacts");
} else {
  console.log(`Usage:
  node scripts/generate-loki-production-support-artifacts.mjs --generate
  node scripts/generate-loki-production-support-artifacts.mjs --verify`);
}

function buildImageReceipt(variant) {
  const subject = imageSubjectRows(variant);
  const uniqueImages = [...new Set(subject.rows.map((row) => row.image))].sort();
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ImageDigestResolutionReceipt",
    metadata: { name: `${chartSlug}-${variant}-image-digest-resolution` },
    spec: {
      chart,
      version,
      variant,
      resolvedAt: new Date().toISOString(),
      renderedObjectSet: {
        path: subject.renderedPath,
        sha256: subject.renderedSHA256,
      },
      sourceImageReview: {
        path: relativeRepo(imageReviewPath),
        rows: subject.rows.length,
        uniqueImages: uniqueImages.length,
      },
      resolver: {
        name: "docker-buildx-imagetools",
        commandTemplate: "docker buildx imagetools inspect <image>",
      },
      images: uniqueImages.map((image) => {
        const resolution = resolveImage(image);
        return {
          image,
          digest: resolution.digest,
          digestReference: `${image}@${resolution.digest}`,
          mediaType: resolution.mediaType,
          resolverOutput: { name: resolution.name },
          occurrences: subject.rows
            .filter((row) => row.image === image)
            .map((row) => ({ object: row.object, fieldPath: row.field_path })),
        };
      }),
      productionSupportUse: {
        status: "digest-resolution-recorded",
        claim: "The mutable rendered image references for this Loki base were resolved to registry manifest digests at the recorded time.",
        limits: "This receipt does not mean the rendered manifests are digest-pinned and does not by itself make the chart production-supported.",
        nextRequired: "Choose a digest-pinned base, image override policy, or explicit mutable-image exception before broader production support.",
      },
    },
  };
}

function buildImagePolicyDecision() {
  const chartSummary = imageWorkdownRow();
  const receipts = variants.map((variant) => imageReceipt(variant));
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionImagePolicyDecision",
    metadata: { name: `${chartSlug}-public-oci-image-policy-decision` },
    spec: {
      chart,
      version,
      targetScope: supportScope(),
      supportedBaseCandidate: supportedBase,
      variantsCovered: variants,
      decision: "mutable-image-exception-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The rendered Loki bases still contain mutable image tags, but each rendered image reference has digest-resolution evidence. For the narrower single-binary filesystem public proof scope, the mutable tags are accepted as a target-scoped exception while stricter environments remain free to require digest-pinned bases or image overrides.",
      renderedImageSummary: {
        renderedSubjects: Number(chartSummary.rendered_subjects),
        subjectsNeedingResolution: Number(chartSummary.subjects_needing_resolution),
        imageRefs: Number(chartSummary.image_refs),
        mutableTagRefs: Number(chartSummary.mutable_tag_refs),
        floatingLatestOrUntaggedRefs: Number(chartSummary.floating_latest_or_untagged_refs),
        resolutionReceipts: receipts.length,
      },
      variantReceipts: Object.fromEntries(
        receipts.map((receipt) => [
          receipt.spec.variant,
          {
            renderedObjectSetSHA256: receipt.spec.renderedObjectSet.sha256,
            sourceImageReviewRows: receipt.spec.sourceImageReview.rows,
            uniqueImages: receipt.spec.sourceImageReview.uniqueImages,
            receiptPath: receipt.path,
          },
        ]),
      ),
      acceptedException: {
        reason:
          "The public proof target uses upstream Loki image tags. The receipt set records the registry digest each tag resolved to at decision time, so reviewers can rerun the decision when upstream tags move.",
        operatorAction:
          "For stricter production environments, create a digest-pinned base or image override policy before support expansion.",
      },
      limits: [
        "This does not mean the rendered manifests are digest-pinned.",
        "This is not a blanket approval for all clusters, private overlays, regulated environments, or future chart versions.",
        "This does not make every Loki topology production-supported.",
        "If an upstream image tag is retargeted, rerun digest resolution and re-review this decision before promotion.",
      ],
      evidence: [
        { path: relativeRepo(imageWorkdownPath), claim: "Summarizes Loki rendered image references." },
        { path: relativeRepo(imageReviewPath), claim: "Lists every rendered image reference found in the Loki object sets." },
        ...receipts.map((receipt) => ({
          path: receipt.path,
          claim: `Records registry digest resolution for the ${receipt.spec.variant} rendered object set.`,
        })),
      ],
      remainingSupportBlockers: [
        "Record security acceptance and fresh target-scoped ConfigHub OCI/GitOps evidence for the selected single-binary filesystem base.",
      ],
    },
  };
}

function buildSecurityDecision() {
  const workdown = scanWorkdownRow();
  const externalRows = externalScanRows();
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSecurityDecision",
    metadata: { name: `${chartSlug}-public-oci-security-decision` },
    spec: {
      chart,
      version,
      targetScope: supportScope(),
      supportedBaseCandidate: supportedBase,
      variantsCovered: variants,
      decision: "single-binary-resource-security-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The selected support scope is Loki's single-binary-filesystem base. The remaining external scan findings are resource-request and workload-hardening warnings. They are accepted for this public proof scope; stricter environments should create a resource/security hardened base before support expansion.",
      route: workdown.dispositionRoute,
      routeReason: workdown.routeReason,
      findingSummary: {
        scanner: "kube-linter",
        result: "warn",
        totalFindings: Number(workdown.findingCount),
        topChecks: parseCountMap(workdown.topChecks),
        variants: Object.fromEntries(
          externalRows.map((row) => [
            row.variant,
            {
              findingCount: Number(row.findingCount),
              topChecks: parseCountMap(row.topChecks),
              renderedObjectSetSHA256: row.renderedSHA256,
            },
          ]),
        ),
      },
      acceptedFindings: [
        {
          group: "resource-requests-and-limits",
          disposition:
            "Accepted for the public proof scope. Add CPU and memory requests/limits in a hardened base for target SLO scopes.",
        },
        {
          group: "workload-security-context",
          disposition:
            "Accepted for the public proof scope. Add stricter read-only-root-filesystem and related security posture in a hardened base when required.",
        },
      ],
      topologyDisposition:
        "single-binary-filesystem is the supported proof topology. simple-scalable-minio remains useful evidence for the object-store path, but it needs separate target capacity, object-store, credential, and retention review before support.",
      limits: [
        "This is not a blanket security approval for customer clusters, private overlays, regulated environments, or future chart versions.",
        "This does not support the simple-scalable-minio topology for production use.",
        "Loki tenant policy, gateway exposure, object-store credentials, retention, backup, restore, and rollback remain separate review surfaces.",
      ],
      evidence: [
        { path: relativeRepo(scanWorkdownPath), claim: "Routes Loki scan findings to harden-security-context." },
        { path: relativeRepo(externalScanPath), claim: "Records kube-linter warning counts for Loki rendered object sets." },
        ...variants.map((variant) => ({
          path: `recipes/${chart}/${version}/revisions/${variant}/r001/receipts/scan-receipt.yaml`,
          claim: `Local rendered-object scan receipt for ${variant}.`,
        })),
        {
          path: `data/production-disposition/receipts/${chartSlug}/scan-gate-warning-disposition.yaml`,
          claim: "Earlier production disposition accepts Loki scan warnings as production-review inputs and identifies single-binary-filesystem as the stronger first support base.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/cluster-rbac-review.yaml`,
          claim: "Records Loki cluster RBAC review for the candidate bases.",
        },
      ],
      remainingSupportBlockers: [
        "Record image policy and fresh target-scoped ConfigHub OCI/GitOps evidence.",
      ],
    },
  };
}

function buildLifecycleDecision() {
  const live = liveReceipt();
  const kindParity = kindParityReceipt();
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionLifecycleDecision",
    metadata: { name: `${chartSlug}-public-oci-lifecycle-decision` },
    spec: {
      chart,
      version,
      targetScope: supportScope(),
      supportedBaseCandidate: supportedBase,
      variantsCovered: variants,
      decision: "lifecycle-observed-for-proof-scope",
      decidedAt: "2026-06-09",
      claim:
        "The Loki single-binary-filesystem base is managed as reviewed desired Kubernetes objects with Helm hooks and tests excluded. Regular Helm, cub installer apply, and ConfigHub OCI/Argo all reach runtime readiness for the supported proof scope.",
      lifecycleModel: {
        hookPolicy: "no-hooks-or-tests-in-promoted-render",
        selectedTopology: "single-binary-filesystem",
        observedWorkloads: ["loki", "loki-gateway", "loki-chunks-cache", "loki-results-cache", "loki-canary"],
        extensionSlots:
          "loki.config, loki.structuredConfig, extraEnv, extraContainers, and raw extraObjects must become reviewed bases or managed ConfigHub units when populated",
        storagePolicy:
          "filesystem storage is accepted for the public proof scope; production retention, backup, restore, and rollback need a target-specific operating decision",
      },
      observedLifecycleSignals: {
        twoClusterParity: {
          result: kindParity.spec.result,
          observedAt: kindParity.spec.observedAt,
          regularHelmRuntime: kindParity.spec.legs.regularHelm.runtime.result,
          installerRuntime: kindParity.spec.legs.cubInstallerApply.runtime.result,
          semanticParity: kindParity.spec.semanticComparison.helmVsCubInstallerApply.result,
        },
        confighubOciArgo: {
          result: live.spec.result,
          observedAt: live.spec.observedAt,
          regularHelmRuntime: live.spec.legs.regularHelm.runtime.result,
          confighubApplyRuntime: live.spec.legs.configHubKubectlApply.runtime.result,
          confighubOciRuntime: live.spec.legs.configHubOciArgo.runtime.result,
          argoSync: live.spec.legs.configHubOciArgo.sync,
          argoHealth: live.spec.legs.configHubOciArgo.health,
          semanticParity: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        },
      },
      limits: [
        "This supports the single-binary-filesystem public proof base, not every Loki deployment topology.",
        "The proof does not preserve arbitrary future Helm hook or test behavior.",
        "Object-store, MinIO, tenant, retention, backup, restore, and rollback policies require separate reviewed bases or operating receipts.",
        "Populated raw object, template, and structured config extension slots require their own scan and provenance decision.",
      ],
      evidence: [
        { path: relativeRepo(kindParityPath), claim: "Two-cluster Helm-vs-installer parity passes for single-binary-filesystem." },
        { path: relativeRepo(liveReceiptPath), claim: "ConfigHub OCI/Argo live parity passes for single-binary-filesystem." },
        {
          path: `data/production-disposition/receipts/${chartSlug}/hook-and-lifecycle-phase-policy.yaml`,
          claim: "Records the no-hook desired-object lifecycle boundary for Loki.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/storage-backup-restore-and-rollback-policy.yaml`,
          claim: "Records filesystem and object-store storage boundaries for Loki.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/extension-slot-provenance-and-scan-policy.yaml`,
          claim: "Records the Loki extension-slot and config provenance policy.",
        },
      ],
      remainingSupportBlockers: [
        "Record image policy, security acceptance, and fresh target-scoped ConfigHub OCI/GitOps evidence.",
      ],
    },
  };
}

function buildFreshEvidenceReceipt() {
  const live = liveReceipt();
  const kindParity = kindParityReceipt();
  const oci = live.spec.legs.configHubOciArgo;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSupportEvidenceReceipt",
    metadata: { name: `${chartSlug}-${supportedBase}-argo-oci-support-evidence-20260608` },
    spec: {
      chart,
      version,
      base: supportedBase,
      observedAt: live.spec.observedAt,
      result: "pass",
      targetScope: {
        ...supportScope(),
        rig: live.spec.run.rig,
        kubeContext: live.spec.run.kubeContext,
        target: `${live.spec.run.rig}-cluster/oci`,
        workloadSpace: oci.workloadSpace,
        app: oci.app,
      },
      package: { path: live.spec.package.path },
      recipe: { path: live.spec.recipe.path },
      oci: {
        revision: oci.ociRevision,
        controller: oci.controller,
        sync: oci.sync,
        health: oci.health,
        manifestSHA256: oci.manifestSHA256,
        objectCount: oci.objectCount,
      },
      comparison: {
        regularHelmRuntime: live.spec.legs.regularHelm.runtime.result,
        configHubApplyRuntime: live.spec.legs.configHubKubectlApply.runtime.result,
        configHubOciRuntime: oci.runtime.result,
        helmVsConfigHubOciArgo: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        allowedExtraConfigHubObjects: live.spec.semanticComparison.allowedExtraConfigHubObjects,
      },
      twoClusterCrossCheck: {
        path: relativeRepo(kindParityPath),
        result: kindParity.spec.result,
        semanticParity: kindParity.spec.semanticComparison.helmVsCubInstallerApply.result,
        regularHelmRuntime: kindParity.spec.legs.regularHelm.runtime.result,
        installerRuntime: kindParity.spec.legs.cubInstallerApply.runtime.result,
      },
      source: {
        liveReceiptPath: relativeRepo(liveReceiptPath),
        cleanupPolicy: "cub-lk rig and ConfigHub cluster space removed after evidence capture",
      },
      checks: [
        { name: "regular-helm-runtime", result: live.spec.legs.regularHelm.runtime.result, detail: "regular Helm Loki runtime passed" },
        { name: "confighub-apply-runtime", result: live.spec.legs.configHubKubectlApply.runtime.result, detail: "ConfigHub rendered objects applied by kubectl reached Loki readiness" },
        { name: "confighub-oci-argo-runtime", result: oci.runtime.result, detail: `Argo app ${oci.app}: sync=${oci.sync} health=${oci.health} revision=${oci.ociRevision}` },
        { name: "semantic-object-parity", result: live.spec.semanticComparison.helmVsConfigHubOciArgo.result, detail: "regular Helm and ConfigHub OCI/Argo object sets match semantically, except the recorded Namespace support object" },
      ],
      supportClaim: {
        state: "fresh-target-evidence-passed",
        detail: "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared Loki single-binary-filesystem support scope.",
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "This assumes an existing Argo CD OCI controller is available to reconcile the ConfigHub artifact.",
        "This supports the single-binary-filesystem base, not every Loki topology.",
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
      ],
    },
  };
}

function verifyImageReceipt(variant) {
  const receipt = imageReceipt(variant);
  const subject = imageSubjectRows(variant);
  check(receipt.spec.renderedObjectSet.sha256 === subject.renderedSHA256, `${receipt.path} rendered sha mismatch`);
  check(receipt.spec.sourceImageReview.rows === subject.rows.length, `${receipt.path} image row count mismatch`);
  check((receipt.spec.images ?? []).length > 0, `${receipt.path} expected image resolutions`);
  for (const image of receipt.spec.images ?? []) check(/^sha256:[a-f0-9]{64}$/.test(image.digest ?? ""), `${receipt.path} invalid digest`);
}

function verifyImagePolicyDecision() {
  const decision = decisionFile("image-policy-decision.yaml", "ProductionImagePolicyDecision");
  check(decision.spec.decision === "mutable-image-exception-accepted-for-target-scope", "Loki image policy decision mismatch");
  check((decision.spec.variantsCovered ?? []).length === variants.length, "Loki image policy variants mismatch");
  check(decision.spec.supportedBaseCandidate === supportedBase, "Loki image policy supported base mismatch");
}

function verifySecurityDecision() {
  const decision = decisionFile("security-decision.yaml", "ProductionSecurityDecision");
  check(decision.spec.decision === "single-binary-resource-security-accepted-for-target-scope", "Loki security decision mismatch");
  check(decision.spec.supportedBaseCandidate === supportedBase, "Loki security supported base mismatch");
  check(decision.spec.findingSummary.totalFindings === Number(scanWorkdownRow().findingCount), "Loki security finding count mismatch");
  for (const row of externalScanRows()) {
    check(decision.spec.findingSummary.variants[row.variant].renderedObjectSetSHA256 === row.renderedSHA256, `Loki security rendered sha mismatch for ${row.variant}`);
  }
}

function verifyLifecycleDecision() {
  const decision = decisionFile("lifecycle-decision.yaml", "ProductionLifecycleDecision");
  check(decision.spec.decision === "lifecycle-observed-for-proof-scope", "Loki lifecycle decision mismatch");
  check(decision.spec.supportedBaseCandidate === supportedBase, "Loki lifecycle supported base mismatch");
  check(decision.spec.lifecycleModel.hookPolicy === "no-hooks-or-tests-in-promoted-render", "Loki lifecycle hook policy mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoSync === "Synced", "Loki lifecycle Argo sync mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoHealth === "Healthy", "Loki lifecycle Argo health mismatch");
}

function verifyFreshEvidenceReceipt() {
  const receipt = decisionFile("fresh-target-evidence-2026-06-08.yaml", "ProductionSupportEvidenceReceipt");
  const live = liveReceipt();
  check(receipt.spec.supportClaim.state === "fresh-target-evidence-passed", "Loki fresh evidence claim mismatch");
  check(receipt.spec.observedAt === live.spec.observedAt, "Loki fresh evidence observedAt mismatch");
  check(receipt.spec.oci.revision === live.spec.legs.configHubOciArgo.ociRevision, "Loki fresh evidence OCI revision mismatch");
  check(receipt.spec.oci.sync === "Synced", "Loki Argo sync mismatch");
  check(receipt.spec.oci.health === "Healthy", "Loki Argo health mismatch");
}

function imageSubjectRows(variant) {
  const rows = parseCsv(readFileSync(imageReviewPath, "utf8")).filter(
    (row) => row.chart === chart && row.version === version && row.variant === variant,
  );
  check(rows.length > 0, `no image rows for ${chart}/${variant}`);
  check(rows.every((row) => row.image_status === "mutable-tag"), `expected mutable-tag rows for ${chart}/${variant}`);
  const renderedPaths = new Set(rows.map((row) => row.rendered_path));
  const renderedSHAs = new Set(rows.map((row) => row.rendered_sha256));
  check(renderedPaths.size === 1, `expected one rendered path for ${variant}`);
  check(renderedSHAs.size === 1, `expected one rendered sha for ${variant}`);
  const renderedPath = [...renderedPaths][0];
  const renderedSHA256 = [...renderedSHAs][0];
  check(sha256File(join(repoRoot, renderedPath)) === renderedSHA256, `${renderedPath} sha mismatch`);
  return { rows, renderedPath, renderedSHA256 };
}

function imageReceipt(variant) {
  const path = imageReceiptPath(variant);
  check(existsSync(path), `missing ${relativeRepo(path)}; run npm run loki:production-support`);
  const receipt = readYaml(path);
  check(receipt.kind === "ImageDigestResolutionReceipt", `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.variant === variant, `${relativeRepo(path)} variant mismatch`);
  return { path: relativeRepo(path), ...receipt };
}

function imageReceiptPath(variant) {
  return join(repoRoot, "data", "image-digest-workdown", "receipts", chartSlug, variant, "image-digest-resolution.yaml");
}

function imageWorkdownRow() {
  const rows = parseCsv(readFileSync(imageWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, "expected one Loki image workdown row");
  return rows[0];
}

function externalScanRows() {
  const rows = parseCsv(readFileSync(externalScanPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === variants.length, "expected Loki external scan rows");
  return rows;
}

function scanWorkdownRow() {
  const rows = parseCsv(readFileSync(scanWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, "expected one Loki scan workdown row");
  return rows[0];
}

function liveReceipt() {
  check(existsSync(liveReceiptPath), `missing ${relativeRepo(liveReceiptPath)}`);
  const receipt = readYaml(liveReceiptPath);
  check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${relativeRepo(liveReceiptPath)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(liveReceiptPath)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(liveReceiptPath)} version mismatch`);
  check(receipt.spec?.base === supportedBase, `${relativeRepo(liveReceiptPath)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(liveReceiptPath)} result must pass`);
  check(receipt.spec?.legs?.configHubOciArgo?.sync === "Synced", `${relativeRepo(liveReceiptPath)} Argo sync must be Synced`);
  check(receipt.spec?.legs?.configHubOciArgo?.health === "Healthy", `${relativeRepo(liveReceiptPath)} Argo health must be Healthy`);
  check(receipt.spec?.semanticComparison?.helmVsConfigHubOciArgo?.result === "pass", `${relativeRepo(liveReceiptPath)} semantic parity must pass`);
  return receipt;
}

function kindParityReceipt() {
  check(existsSync(kindParityPath), `missing ${relativeRepo(kindParityPath)}`);
  const receipt = readYaml(kindParityPath);
  check(receipt.kind === "LiveHelmInstallerKindParityReceipt", `${relativeRepo(kindParityPath)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(kindParityPath)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(kindParityPath)} version mismatch`);
  check(receipt.spec?.base === supportedBase, `${relativeRepo(kindParityPath)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(kindParityPath)} result must pass`);
  check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply?.result === "pass", `${relativeRepo(kindParityPath)} semantic parity must pass`);
  return receipt;
}

function decisionFile(name, expectedKind) {
  const path = join(outputRoot, name);
  check(existsSync(path), `missing ${relativeRepo(path)}; run npm run loki:production-support`);
  const receipt = readYaml(path);
  check(receipt.kind === expectedKind, `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(path)} version mismatch`);
  for (const evidence of receipt.spec?.evidence ?? []) {
    check(evidence.path, `${relativeRepo(path)} evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(path)} references missing evidence ${evidence.path}`);
  }
  return receipt;
}

function supportScope() {
  return {
    clusterClass: "cub-lk-kind-vanilla",
    namespace: "loki",
    deliveryPath: "confighub-oci",
    gitopsController: "argo",
  };
}

function resolveImage(image) {
  if (resolvedImages.has(image)) return resolvedImages.get(image);
  const output = execFileSync("docker", ["buildx", "imagetools", "inspect", image], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 20,
  });
  const resolution = {
    name: matchLine(output, /^Name:\s+(.+)$/m, `missing Name for ${image}`),
    mediaType: matchLine(output, /^MediaType:\s+(.+)$/m, `missing MediaType for ${image}`),
    digest: matchLine(output, /^Digest:\s+(sha256:[a-f0-9]{64})$/m, `missing Digest for ${image}`),
  };
  resolvedImages.set(image, resolution);
  return resolution;
}

function matchLine(output, pattern, message) {
  const match = output.match(pattern);
  check(match, message);
  return match[1].trim();
}

function parseCountMap(text) {
  return Object.fromEntries(
    String(text ?? "")
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const [key, count] = item.split(":");
        return [key, Number(count ?? 0)];
      }),
  );
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
