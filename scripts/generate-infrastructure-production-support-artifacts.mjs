#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256File, writeYaml } from "./lib/proof-common.mjs";

const configs = {
  "secrets-store-csi-driver": {
    chart: "secrets-store-csi-driver/secrets-store-csi-driver",
    chartSlug: "secrets-store-csi-driver-secrets-store-csi-driver",
    displayName: "Secrets Store CSI Driver",
    version: "1.6.0",
    supportedBase: "default",
    variants: ["default", "sync-secret-rotation"],
    namespace: "kube-system",
    evidenceDate: "2026-06-05",
    clusterClass: "cub-lk-kind-vanilla",
    securityDecision: "privileged-node-driver-accepted-for-target-scope",
    securityClaim:
      "The default base installs a node CSI driver with privileged and privilege-escalation containers. That is accepted only for this public proof scope because it is the normal operating shape of this infrastructure component. Customer production scopes should review provider integration, node policy, sync/rotation behavior, and whether a hardened base is possible.",
    lifecycleDecision: "node-daemonset-and-crds-observed-for-proof-scope",
    lifecycleClaim:
      "The default base has no Helm hooks. CRDs, cluster RBAC, and the CSI node DaemonSet are applied as reviewed desired objects and observed healthy through regular Helm, cub installer apply, and ConfigHub OCI/Argo.",
    selectedTopology: "default-node-csi-driver",
    included:
      "rendered CRDs, CSI DaemonSet, cluster RBAC, labels, gates, receipts, and support objects produced by the default base",
    excluded: [
      "sync-secret-rotation unless separately reviewed with provider-specific SecretProviderClass and synced-Secret runtime evidence",
      "provider-specific SecretProviderClass, external provider, cloud IAM, or secret-store integration unless separately reviewed",
      "private values overlays, wrapper charts, and populated extension slots unless separately reviewed",
      "non-vanilla Kubernetes distributions unless separately reviewed",
      "other delivery controllers or target scopes unless separately reviewed",
    ],
    acceptedFindings: [
      ["privileged-node-access", "Accepted for this public proof scope because the chart installs a CSI node driver. Customer production scopes need explicit node security review."],
      ["container-hardening", "Accepted for this public proof scope. Hardened variants should review read-only root filesystems, non-root execution, and privilege escalation settings where the upstream chart supports them."],
    ],
    limits: [
      "This is not a blanket security approval for customer clusters, private overlays, regulated environments, or future chart versions.",
      "This does not support SecretProviderClass provider configuration, secret sync, or rotation workflows.",
      "Provider credentials, IAM, external secret-store connectivity, and sync/rotation behavior remain separate target decisions.",
    ],
    nextAction:
      "Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider, sync-secret-rotation, IAM, node-policy, resource-hardened, or digest-pinned bases for real customer secret-store workloads.",
  },
  longhorn: {
    chart: "longhorn/longhorn",
    chartSlug: "longhorn-longhorn",
    displayName: "Longhorn",
    version: "1.11.2",
    supportedBase: "default",
    variants: ["default", "ui-ingress"],
    namespace: "longhorn-system",
    evidenceDate: "2026-06-08",
    clusterClass: "cub-lk-kind-vanilla",
    securityDecision: "privileged-storage-infrastructure-accepted-for-target-scope",
    securityClaim:
      "The default base installs privileged storage infrastructure, CRDs, webhooks, CSI components, and cluster RBAC. That is accepted only for this public proof scope because the chart's normal function is node-level storage management. Customer production scopes need storage, node, backup, restore, upgrade, and hardening review.",
    lifecycleDecision: "storage-controller-crds-webhooks-observed-for-proof-scope",
    lifecycleClaim:
      "The default base has no Helm hooks. CRDs, webhooks, CSI components, storage controllers, and UI workloads are applied as reviewed desired objects and observed healthy through regular Helm, cub installer apply, and ConfigHub OCI/Argo.",
    selectedTopology: "default-local-kind-storage-control-plane",
    included:
      "rendered Longhorn CRDs, storage controllers, CSI components, webhooks, UI, cluster RBAC, labels, gates, receipts, and support objects produced by the default base",
    excluded: [
      "ui-ingress unless separately reviewed with ingress, DNS, and TLS evidence",
      "backup, restore, recurring jobs, snapshot policy, replica policy, default storage class changes, and upgrade/failover operations unless separately reviewed",
      "private values overlays, wrapper charts, and populated extension slots unless separately reviewed",
      "non-vanilla Kubernetes distributions unless separately reviewed",
      "other delivery controllers or target scopes unless separately reviewed",
    ],
    acceptedFindings: [
      ["privileged-storage-access", "Accepted for this public proof scope because Longhorn manages node-level storage. Customer production scopes need explicit node and storage security review."],
      ["resource-policy", "Accepted for this public proof scope. Production scopes should choose CPU and memory requests/limits for target capacity and SLO requirements."],
      ["dangling-service", "Accepted for this public proof scope. Service exposure should be reviewed with the selected UI, ingress, and network policy path."],
    ],
    limits: [
      "This is not a blanket security approval for customer clusters, private overlays, regulated environments, or future chart versions.",
      "This does not support backup, restore, recurring jobs, production replica policy, failover, upgrades, UI ingress, or disaster recovery behavior.",
      "Storage classes, node disks, backup targets, replica counts, webhooks, and upgrade sequencing remain separate target decisions.",
    ],
    nextAction:
      "Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate backup/restore, upgrade, replica-policy, storage-class, UI-ingress, resource-hardened, or digest-pinned bases for real customer Longhorn workloads.",
  },
};

const args = parseArgs(process.argv.slice(2));
const selected = args.chart ? [requiredConfig(args.chart)] : Object.values(configs);
const mode = args.generate ? "--generate" : args.verify ? "--verify" : "";
const imageReviewPath = join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv");
const imageWorkdownPath = join(repoRoot, "data", "image-digest-workdown", "chart-summary.csv");
const externalScanPath = join(repoRoot, "data", "external-scan-lane", "review.csv");
const scanWorkdownPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const resolvedImages = new Map();

if (mode === "--generate") {
  for (const config of selected) generate(config);
} else if (mode === "--verify") {
  for (const config of selected) verify(config);
} else {
  console.log(`Usage:
  node scripts/generate-infrastructure-production-support-artifacts.mjs --chart secrets-store-csi-driver --generate
  node scripts/generate-infrastructure-production-support-artifacts.mjs --chart secrets-store-csi-driver --verify
  node scripts/generate-infrastructure-production-support-artifacts.mjs --chart longhorn --generate
  node scripts/generate-infrastructure-production-support-artifacts.mjs --chart longhorn --verify
  node scripts/generate-infrastructure-production-support-artifacts.mjs --generate
  node scripts/generate-infrastructure-production-support-artifacts.mjs --verify`);
}

function generate(config) {
  for (const variant of config.variants) writeYaml(imageReceiptPath(config, variant), buildImageReceipt(config, variant));
  writeYaml(join(outputRoot(config), "image-policy-decision.yaml"), buildImagePolicyDecision(config));
  writeYaml(join(outputRoot(config), "security-decision.yaml"), buildSecurityDecision(config));
  writeYaml(join(outputRoot(config), "lifecycle-decision.yaml"), buildLifecycleDecision(config));
  writeYaml(join(outputRoot(config), `fresh-target-evidence-${config.evidenceDate}.yaml`), buildFreshEvidenceReceipt(config));
  writeYaml(join(outputRoot(config), "support-decision.yaml"), buildSupportDecision(config));
  console.log(`wrote ${config.displayName} support artifacts -> ${relativeRepo(outputRoot(config))}/`);
}

function verify(config) {
  for (const variant of config.variants) verifyImageReceipt(config, variant);
  verifyDecision(config, "image-policy-decision.yaml", "ProductionImagePolicyDecision");
  verifyDecision(config, "security-decision.yaml", "ProductionSecurityDecision");
  verifyDecision(config, "lifecycle-decision.yaml", "ProductionLifecycleDecision");
  verifyDecision(config, `fresh-target-evidence-${config.evidenceDate}.yaml`, "ProductionSupportEvidenceReceipt");
  const decision = verifyDecision(config, "support-decision.yaml", "ProductionSupportDecision");
  check(decision.spec.decision === "supported", `${config.chartSlug} support decision must be supported`);
  check(decision.spec.targetScope.namespace === config.namespace, `${config.chartSlug} namespace mismatch`);
  check((decision.spec.requiredBeforeFinal ?? []).length === 0, `${config.chartSlug} supported decision cannot have final blockers`);
  check(decision.spec.decisions.liveEvidenceDecision.state === "fresh-target-evidence-passed", `${config.chartSlug} live evidence decision mismatch`);
  console.log(`verified ${config.displayName} support artifacts`);
}

function buildImageReceipt(config, variant) {
  const subject = imageSubjectRows(config, variant);
  const uniqueImages = [...new Set(subject.rows.map((row) => row.image))].sort();
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ImageDigestResolutionReceipt",
    metadata: { name: `${config.chartSlug}-${variant}-image-digest-resolution` },
    spec: {
      chart: config.chart,
      version: config.version,
      variant,
      resolvedAt: new Date().toISOString(),
      renderedObjectSet: { path: subject.renderedPath, sha256: subject.renderedSHA256 },
      sourceImageReview: { path: relativeRepo(imageReviewPath), rows: subject.rows.length, uniqueImages: uniqueImages.length },
      resolver: { name: "docker-buildx-imagetools", commandTemplate: "docker buildx imagetools inspect <image>" },
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
        claim: `The mutable rendered image references for this ${config.displayName} base were resolved to registry manifest digests at the recorded time.`,
        limits: "This receipt does not mean the rendered manifests are digest-pinned and does not by itself make the chart production-supported.",
        nextRequired: "Choose a digest-pinned base, image override policy, or explicit mutable-image exception before broader production support.",
      },
    },
  };
}

function buildImagePolicyDecision(config) {
  const chartSummary = imageWorkdownRow(config);
  const receipts = config.variants.map((variant) => imageReceipt(config, variant));
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionImagePolicyDecision",
    metadata: { name: `${config.chartSlug}-public-oci-image-policy-decision` },
    spec: {
      chart: config.chart,
      version: config.version,
      targetScope: supportScope(config),
      supportedBaseCandidate: config.supportedBase,
      variantsCovered: config.variants,
      decision: "mutable-image-exception-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        `The rendered ${config.displayName} bases still contain mutable image tags, but each rendered image reference has digest-resolution evidence. For the default public proof scope, the mutable tags are accepted as a target-scoped exception while stricter environments remain free to require digest-pinned bases or image overrides.`,
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
          `The public proof target uses upstream ${config.displayName} image tags. The receipt set records the registry digest each tag resolved to at decision time.`,
        operatorAction: "For stricter production environments, create a digest-pinned base or image override policy before support expansion.",
      },
      limits: [
        "This does not mean the rendered manifests are digest-pinned.",
        "This is not a blanket approval for all clusters, private overlays, regulated environments, or future chart versions.",
        `This does not make the ${config.variants.filter((variant) => variant !== config.supportedBase).join(", ")} topology production-supported.`,
        "If an upstream image tag is retargeted, rerun digest resolution and re-review this decision before promotion.",
      ],
      evidence: [
        { path: relativeRepo(imageWorkdownPath), claim: `Summarizes ${config.displayName} rendered image references.` },
        { path: relativeRepo(imageReviewPath), claim: `Lists every rendered ${config.displayName} image reference found in the object sets.` },
        ...receipts.map((receipt) => ({
          path: receipt.path,
          claim: `Records registry digest resolution for the ${receipt.spec.variant} rendered object set.`,
        })),
      ],
      remainingSupportBlockers: ["Record security acceptance and fresh target-scoped ConfigHub OCI/GitOps evidence for the selected base."],
    },
  };
}

function buildSecurityDecision(config) {
  const workdown = scanWorkdownRow(config);
  const externalRows = externalScanRows(config);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSecurityDecision",
    metadata: { name: `${config.chartSlug}-public-oci-security-decision` },
    spec: {
      chart: config.chart,
      version: config.version,
      targetScope: supportScope(config),
      supportedBaseCandidate: config.supportedBase,
      variantsCovered: config.variants,
      decision: config.securityDecision,
      decidedAt: "2026-06-09",
      claim: config.securityClaim,
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
      acceptedFindings: config.acceptedFindings.map(([group, disposition]) => ({ group, disposition })),
      limits: config.limits,
      evidence: [
        { path: relativeRepo(scanWorkdownPath), claim: `Routes ${config.displayName} scan findings to ${workdown.dispositionRoute}.` },
        { path: relativeRepo(externalScanPath), claim: `Records kube-linter warning counts for ${config.displayName} rendered object sets.` },
        ...config.variants.map((variant) => ({
          path: `recipes/${config.chart}/${config.version}/revisions/${variant}/r001/receipts/scan-receipt.yaml`,
          claim: `Local rendered-object scan receipt for ${variant}.`,
        })),
        ...dispositionEvidence(config, ["scan-gate-warning-disposition.yaml", "cluster-rbac-review.yaml", "crd-lifecycle-and-upgrade-policy.yaml"]),
      ],
      remainingSupportBlockers: ["Record image policy and fresh target-scoped ConfigHub OCI/GitOps evidence."],
    },
  };
}

function buildLifecycleDecision(config) {
  const live = liveReceipt(config);
  const kindParity = kindParityReceipt(config);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionLifecycleDecision",
    metadata: { name: `${config.chartSlug}-public-oci-lifecycle-decision` },
    spec: {
      chart: config.chart,
      version: config.version,
      targetScope: supportScope(config),
      supportedBaseCandidate: config.supportedBase,
      variantsCovered: config.variants,
      decision: config.lifecycleDecision,
      decidedAt: "2026-06-09",
      claim: config.lifecycleClaim,
      lifecycleModel: {
        hookPolicy: "no-chart-hooks",
        selectedTopology: config.selectedTopology,
        excludedTopologies: config.variants.filter((variant) => variant !== config.supportedBase),
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
          allowedExtraConfigHubObjects: live.spec.semanticComparison.allowedExtraConfigHubObjects,
        },
      },
      limits: config.limits,
      evidence: [
        { path: relativeRepo(kindParityPath(config)), claim: `Two-cluster Helm-vs-installer parity passes for ${config.supportedBase}.` },
        { path: relativeRepo(liveReceiptPath(config)), claim: `ConfigHub OCI/Argo live parity passes for ${config.supportedBase}.` },
        ...dispositionEvidence(config, [
          "hook-lifecycle-phase-policy.yaml",
          "crd-lifecycle-and-upgrade-policy.yaml",
          "webhook-readiness-and-failure-policy.yaml",
          "scan-gate-warning-disposition.yaml",
        ]),
      ],
      remainingSupportBlockers: ["Record image policy, security acceptance, and fresh target-scoped ConfigHub OCI/GitOps evidence."],
    },
  };
}

function buildFreshEvidenceReceipt(config) {
  const live = liveReceipt(config);
  const kindParity = kindParityReceipt(config);
  const oci = live.spec.legs.configHubOciArgo;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSupportEvidenceReceipt",
    metadata: { name: `${config.chartSlug}-${config.supportedBase}-argo-oci-support-evidence-${config.evidenceDate.replaceAll("-", "")}` },
    spec: {
      chart: config.chart,
      version: config.version,
      base: config.supportedBase,
      observedAt: live.spec.observedAt,
      result: "pass",
      targetScope: {
        ...supportScope(config),
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
        separatedSecrets: oci.separatedSecrets,
      },
      comparison: {
        regularHelmRuntime: live.spec.legs.regularHelm.runtime.result,
        configHubApplyRuntime: live.spec.legs.configHubKubectlApply.runtime.result,
        configHubOciRuntime: oci.runtime.result,
        helmVsConfigHubOciArgo: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        allowedExtraConfigHubObjects: live.spec.semanticComparison.allowedExtraConfigHubObjects,
      },
      twoClusterCrossCheck: {
        path: relativeRepo(kindParityPath(config)),
        result: kindParity.spec.result,
        semanticParity: kindParity.spec.semanticComparison.helmVsCubInstallerApply.result,
        regularHelmRuntime: kindParity.spec.legs.regularHelm.runtime.result,
        installerRuntime: kindParity.spec.legs.cubInstallerApply.runtime.result,
      },
      checks: [
        { name: "regular-helm-runtime", result: live.spec.legs.regularHelm.runtime.result, detail: `regular Helm ${config.displayName} runtime passed` },
        { name: "confighub-apply-runtime", result: live.spec.legs.configHubKubectlApply.runtime.result, detail: "ConfigHub rendered objects applied by kubectl reached runtime readiness" },
        { name: "confighub-oci-argo-runtime", result: oci.runtime.result, detail: `Argo app ${oci.app}: sync=${oci.sync} health=${oci.health} revision=${oci.ociRevision}` },
        { name: "semantic-object-parity", result: live.spec.semanticComparison.helmVsConfigHubOciArgo.result, detail: "regular Helm and ConfigHub OCI/Argo object sets match semantically, except the recorded Namespace support object" },
      ],
      supportClaim: {
        state: "fresh-target-evidence-passed",
        detail: `Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared ${config.displayName} ${config.supportedBase} support scope.`,
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "This assumes an existing Argo CD OCI controller is available to reconcile the ConfigHub artifact.",
        `This supports the ${config.supportedBase} base only.`,
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
      ],
    },
  };
}

function buildSupportDecision(config) {
  const live = liveReceipt(config);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSupportDecision",
    metadata: { name: `${config.chartSlug}-${config.supportedBase}-public-oci-supported` },
    spec: {
      chart: config.chart,
      version: config.version,
      decision: "supported",
      decisionDate: "2026-06-09",
      supportedSince: live.spec.observedAt,
      supportedBase: config.supportedBase,
      targetScope: {
        ...supportScope(config),
        lastEvidenceAt: live.spec.observedAt,
        lastEvidenceTarget: `${live.spec.run.rig}-cluster/oci`,
        lastEvidenceKubeContext: live.spec.run.kubeContext,
        liveEvidenceTTL: "30d",
        storageAssumptions: [
          `Use the ${config.displayName} ${config.supportedBase} storage behavior recorded by the supported scope unless a narrower scope is separately reviewed.`,
        ],
        networkAssumptions: [
          `Use the ${config.displayName} service, webhook, CRD, and node behavior recorded by the supported scope unless a narrower scope is separately reviewed.`,
        ],
        requiredTargetFacts: [],
      },
      supportBoundary: {
        includes: [
          `${config.chart}@${config.version} ${config.supportedBase} base`,
          "ConfigHub OCI delivery through Argo for the declared cub-lk vanilla kind target scope",
          config.included,
          "mutable-image exception backed by registry digest-resolution evidence for the rendered image references",
          "recorded security acceptance, lifecycle observation, live Helm-vs-ConfigHub parity, and two-cluster Helm-vs-installer parity for the declared public proof scope",
        ],
        excludes: config.excluded,
      },
      decisions: {
        imageDecision: {
          state: "mutable-image-exception-accepted-for-target-scope",
          detail: `rendered ${config.displayName} image tags are mutable, with registry digest-resolution evidence recorded for this public proof scope; stricter environments should use digest-pinned bases or image overrides`,
        },
        scanDecision: { state: config.securityDecision, detail: config.securityClaim },
        lifecycleDecision: { state: config.lifecycleDecision, detail: config.lifecycleClaim },
        targetFactDecision: {
          state: "no-unresolved-target-prerequisite-in-candidate-base",
          detail: "no unresolved target prerequisite in candidate base",
        },
        liveEvidenceDecision: {
          state: "fresh-target-evidence-passed",
          detail: `fresh target-scoped ConfigHub OCI and Argo evidence passed on ${config.evidenceDate} for the declared cub-lk vanilla kind ${config.displayName} ${config.supportedBase} scope`,
        },
      },
      evidence: [
        { path: `recipes/${config.chart}/${config.version}/revisions/${config.supportedBase}/r001/receipts/helm-equivalence-receipt.yaml`, claim: "The candidate base is Helm-equivalent under recorded inputs." },
        { path: `recipes/${config.chart}/${config.version}/revisions/${config.supportedBase}/r001/receipts/scan-receipt.yaml`, claim: "The rendered-object scan receipt exists for the candidate base." },
        { path: relativeRepo(kindParityPath(config)), claim: "The two-cluster Helm-vs-installer parity receipt exists for the candidate base." },
        { path: relativeRepo(liveReceiptPath(config)), claim: "The selected live Helm-vs-ConfigHub comparison receipt exists for the candidate base." },
        { path: `data/production-support-decisions/${config.chartSlug}/fresh-target-evidence-${config.evidenceDate}.yaml`, claim: "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared cub-lk vanilla kind support scope." },
        { path: `data/image-digest-workdown/receipts/${config.chartSlug}/${config.supportedBase}/image-digest-resolution.yaml`, claim: `Registry digest resolution exists for the rendered ${config.supportedBase} image references.` },
        { path: `data/production-support-decisions/${config.chartSlug}/image-policy-decision.yaml`, claim: "The target-scoped image policy decision records the mutable-image exception and digest-resolution evidence." },
        { path: `data/production-support-decisions/${config.chartSlug}/security-decision.yaml`, claim: "The target-scoped security decision records the accepted infrastructure security boundary." },
        { path: `data/production-support-decisions/${config.chartSlug}/lifecycle-decision.yaml`, claim: "The target-scoped lifecycle decision binds CRD, webhook, node, runtime, and OCI/Argo health to proof-scope evidence." },
        ...dispositionEvidence(config, ["cluster-rbac-review.yaml", "crd-lifecycle-and-upgrade-policy.yaml", "extension-slot-provenance-and-scan-policy.yaml", "hook-lifecycle-phase-policy.yaml", "scan-gate-warning-disposition.yaml", "webhook-readiness-and-failure-policy.yaml"]),
      ],
      requiredBeforeFinal: [],
      nextAction: config.nextAction,
    },
  };
}

function verifyImageReceipt(config, variant) {
  const receipt = imageReceipt(config, variant);
  const subject = imageSubjectRows(config, variant);
  check(receipt.spec.renderedObjectSet.sha256 === subject.renderedSHA256, `${receipt.path} rendered sha mismatch`);
  check(receipt.spec.sourceImageReview.rows === subject.rows.length, `${receipt.path} image row count mismatch`);
  check((receipt.spec.images ?? []).length > 0, `${receipt.path} expected image resolutions`);
  for (const image of receipt.spec.images ?? []) check(/^sha256:[a-f0-9]{64}$/.test(image.digest ?? ""), `${receipt.path} invalid digest`);
}

function verifyDecision(config, name, expectedKind) {
  const path = join(outputRoot(config), name);
  check(existsSync(path), `missing ${relativeRepo(path)}; run production-support generation for ${config.displayName}`);
  const doc = readYaml(path);
  check(doc.kind === expectedKind, `${relativeRepo(path)} kind mismatch`);
  check(doc.spec?.chart === config.chart, `${relativeRepo(path)} chart mismatch`);
  check(doc.spec?.version === config.version, `${relativeRepo(path)} version mismatch`);
  for (const evidence of doc.spec?.evidence ?? []) {
    check(evidence.path, `${relativeRepo(path)} evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(path)} references missing evidence ${evidence.path}`);
  }
  return doc;
}

function imageSubjectRows(config, variant) {
  const rows = parseCsv(readFileSync(imageReviewPath, "utf8")).filter(
    (row) => row.chart === config.chart && row.version === config.version && row.variant === variant,
  );
  check(rows.length > 0, `no image rows for ${config.chart}/${variant}`);
  check(rows.every((row) => row.image_status === "mutable-tag"), `expected mutable-tag rows for ${config.chart}/${variant}`);
  const renderedPaths = new Set(rows.map((row) => row.rendered_path));
  const renderedSHAs = new Set(rows.map((row) => row.rendered_sha256));
  check(renderedPaths.size === 1, `expected one rendered path for ${config.chart}/${variant}`);
  check(renderedSHAs.size === 1, `expected one rendered sha for ${config.chart}/${variant}`);
  const renderedPath = [...renderedPaths][0];
  const renderedSHA256 = [...renderedSHAs][0];
  check(sha256File(join(repoRoot, renderedPath)) === renderedSHA256, `${renderedPath} sha mismatch`);
  return { rows, renderedPath, renderedSHA256 };
}

function imageReceipt(config, variant) {
  const path = imageReceiptPath(config, variant);
  check(existsSync(path), `missing ${relativeRepo(path)}; run production-support generation for ${config.displayName}`);
  const receipt = readYaml(path);
  check(receipt.kind === "ImageDigestResolutionReceipt", `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === config.chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === config.version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.variant === variant, `${relativeRepo(path)} variant mismatch`);
  return { path: relativeRepo(path), ...receipt };
}

function imageReceiptPath(config, variant) {
  return join(repoRoot, "data", "image-digest-workdown", "receipts", config.chartSlug, variant, "image-digest-resolution.yaml");
}

function outputRoot(config) {
  return join(repoRoot, "data", "production-support-decisions", config.chartSlug);
}

function liveReceiptPath(config) {
  return join(repoRoot, "runs", "live-helm-confighub-compare", `${config.chartSlug}-${config.supportedBase}`, "receipt.yaml");
}

function kindParityPath(config) {
  return join(repoRoot, "runs", "live-kind-parity", `${config.chartSlug}-${config.supportedBase}`, "receipt.yaml");
}

function liveReceipt(config) {
  const path = liveReceiptPath(config);
  check(existsSync(path), `missing ${relativeRepo(path)}`);
  const receipt = readYaml(path);
  check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === config.chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === config.version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.base === config.supportedBase, `${relativeRepo(path)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(path)} result must pass`);
  check(receipt.spec?.legs?.configHubOciArgo?.sync === "Synced", `${relativeRepo(path)} Argo sync must be Synced`);
  check(receipt.spec?.legs?.configHubOciArgo?.health === "Healthy", `${relativeRepo(path)} Argo health must be Healthy`);
  check(receipt.spec?.semanticComparison?.helmVsConfigHubOciArgo?.result === "pass", `${relativeRepo(path)} semantic parity must pass`);
  return receipt;
}

function kindParityReceipt(config) {
  const path = kindParityPath(config);
  check(existsSync(path), `missing ${relativeRepo(path)}`);
  const receipt = readYaml(path);
  check(receipt.kind === "LiveHelmInstallerKindParityReceipt", `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === config.chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === config.version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.base === config.supportedBase, `${relativeRepo(path)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(path)} result must pass`);
  check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply?.result === "pass", `${relativeRepo(path)} semantic parity must pass`);
  return receipt;
}

function supportScope(config) {
  return {
    clusterClass: config.clusterClass,
    namespace: config.namespace,
    deliveryPath: "confighub-oci",
    gitopsController: "argo",
  };
}

function dispositionEvidence(config, names) {
  return names
    .map((name) => ({
      path: `data/production-disposition/receipts/${config.chartSlug}/${name}`,
      claim: `The ${name.replace(/\.yaml$/, "").replaceAll("-", " ")} receipt exists for this chart.`,
    }))
    .filter((entry) => existsSync(join(repoRoot, entry.path)));
}

function imageWorkdownRow(config) {
  const rows = parseCsv(readFileSync(imageWorkdownPath, "utf8")).filter((row) => row.chart === config.chart && row.version === config.version);
  check(rows.length === 1, `expected one image workdown row for ${config.chart}`);
  return rows[0];
}

function externalScanRows(config) {
  const rows = parseCsv(readFileSync(externalScanPath, "utf8")).filter((row) => row.chart === config.chart && row.version === config.version);
  check(rows.length === config.variants.length, `expected external scan rows for ${config.chart}`);
  return rows;
}

function scanWorkdownRow(config) {
  const rows = parseCsv(readFileSync(scanWorkdownPath, "utf8")).filter((row) => row.chart === config.chart && row.version === config.version);
  check(rows.length === 1, `expected one scan workdown row for ${config.chart}`);
  return rows[0];
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

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item === "--chart") parsed.chart = items[++index];
    else if (item === "--generate") parsed.generate = true;
    else if (item === "--verify") parsed.verify = true;
  }
  return parsed;
}

function requiredConfig(key) {
  const config = configs[key];
  check(config, `unknown infrastructure support chart ${key}`);
  return config;
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
