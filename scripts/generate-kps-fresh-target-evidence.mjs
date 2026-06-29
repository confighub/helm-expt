#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const outputRoot = join(repoRoot, "data", "production-support-decisions", chartSlug);
const evidenceConfigs = [
  {
    base: "default",
    date: "2026-06-09",
    path: join(outputRoot, "fresh-target-evidence-2026-06-09.yaml"),
    supportDetail:
      "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared kube-prometheus-stack default support scope.",
    extraLimits: [],
  },
  {
    base: "no-crds",
    date: "2026-06-11",
    path: join(outputRoot, "fresh-target-evidence-no-crds-2026-06-11.yaml"),
    supportDetail:
      "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the kube-prometheus-stack no-crds base when compatible Prometheus Operator CRDs and the admission Secret were staged as target facts.",
    extraLimits: [
      "This is support evidence for the no-crds base, not a final production support decision.",
      "The target must provide compatible Prometheus Operator CRDs and the monitoring/kube-prometheus-stack-admission Secret before apply.",
    ],
  },
];

if (mode === "--generate") {
  for (const config of evidenceConfigs) writeYaml(config.path, buildReceipt(config));
  console.log(`wrote ${evidenceConfigs.length} KPS fresh target evidence receipt(s)`);
} else if (mode === "--verify") {
  for (const config of evidenceConfigs) verifyReceipt(config);
  console.log(`verified ${evidenceConfigs.length} KPS fresh target evidence receipt(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-kps-fresh-target-evidence.mjs --generate
  node scripts/generate-kps-fresh-target-evidence.mjs --verify`);
}

function buildReceipt(config) {
  const live = liveReceipt(config);
  const twoClusterCrossCheck = kindParityCrossCheck(config);
  const oci = live.spec.legs.configHubOciArgo;
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSupportEvidenceReceipt",
    metadata: {
      name: `${chartSlug}-${config.base}-argo-oci-support-evidence-${config.date.replaceAll("-", "")}`,
    },
    spec: {
      chart,
      version,
      base: config.base,
      observedAt: live.spec.observedAt,
      result: "pass",
      targetScope: {
        clusterClass: "cub-lk-kind-vanilla",
        namespace: live.spec.run.namespace,
        deliveryPath: "confighub-oci",
        gitopsController: "argo",
        rig: live.spec.run.rig,
        kubeContext: live.spec.run.kubeContext,
        target: `${live.spec.run.rig}-cluster/oci`,
        workloadSpace: oci.workloadSpace,
        app: oci.app,
      },
      package: {
        path: live.spec.package.path,
      },
      recipe: {
        path: live.spec.recipe.path,
      },
      oci: {
        revision: oci.ociRevision,
        controller: oci.controller,
        sync: oci.sync,
        health: oci.health,
        manifestSHA256: oci.manifestSHA256,
        objectCount: oci.objectCount,
      },
      targetFacts: targetFactSummary(live),
      comparison: {
        regularHelmRuntime: live.spec.legs.regularHelm.runtime.result,
        configHubApplyRuntime: live.spec.legs.configHubKubectlApply.runtime.result,
        configHubOciRuntime: oci.runtime.result,
        helmVsConfigHubOciArgo: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        allowedExtraConfigHubObjects: live.spec.semanticComparison.allowedExtraConfigHubObjects,
      },
      twoClusterCrossCheck,
      source:
        {
          liveReceiptPath: relativeRepo(liveReceiptPath(config)),
          cleanupPolicy: live.spec.run.clusterLifecycle === "cleaned-up"
            ? "cub-lk rig and ConfigHub cluster space removed after evidence capture"
            : "see live receipt cleanup details",
        },
      checks: [
        {
          name: "regular-helm-runtime",
          result: live.spec.legs.regularHelm.runtime.result,
          detail: "regular Helm workload runtime passed in the comparison rig",
        },
        {
          name: "confighub-apply-runtime",
          result: live.spec.legs.configHubKubectlApply.runtime.result,
          detail: "ConfigHub rendered objects applied by kubectl reached runtime pass",
        },
        {
          name: "confighub-oci-argo-runtime",
          result: oci.runtime.result,
          detail: `Argo app ${oci.app}: sync=${oci.sync} health=${oci.health} revision=${oci.ociRevision}`,
        },
        {
          name: "semantic-object-parity",
          result: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
          detail: "regular Helm and ConfigHub OCI/Argo object sets match semantically, except the recorded Namespace support object",
        },
      ],
      supportClaim: {
        state: "fresh-target-evidence-passed",
        detail: config.supportDetail,
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "Future chart versions, private overlays, and stricter image or security policies need separate decisions.",
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
        ...config.extraLimits,
      ],
    },
  };
  return receipt;
}

function verifyReceipt(config) {
  check(existsSync(config.path), `${relativeRepo(config.path)} is missing; run npm run kps:fresh-target-evidence`);
  const receipt = readYaml(config.path);
  check(receipt.kind === "ProductionSupportEvidenceReceipt", `${relativeRepo(config.path)} must be kind ProductionSupportEvidenceReceipt`);
  const spec = receipt.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(config.path)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(config.path)} version mismatch`);
  check(spec.base === config.base, `${relativeRepo(config.path)} base mismatch`);
  check(spec.result === "pass", `${relativeRepo(config.path)} result mismatch`);
  check(spec.supportClaim?.state === "fresh-target-evidence-passed", `${relativeRepo(config.path)} support claim mismatch`);
  check(spec.targetScope?.clusterClass === "cub-lk-kind-vanilla", `${relativeRepo(config.path)} cluster class mismatch`);
  check(spec.targetScope?.gitopsController === "argo", `${relativeRepo(config.path)} GitOps controller mismatch`);
  check(spec.oci?.sync === "Synced", `${relativeRepo(config.path)} Argo sync mismatch`);
  check(spec.oci?.health === "Healthy", `${relativeRepo(config.path)} Argo health mismatch`);
  check(/^sha256:[a-f0-9]{64}$/.test(spec.oci?.revision ?? ""), `${relativeRepo(config.path)} invalid OCI revision`);
  check((spec.limits ?? []).some((item) => item.includes("not every Kubernetes cluster")), `${relativeRepo(config.path)} must state scope limit`);

  const live = liveReceipt(config);
  check(spec.observedAt === live.spec.observedAt, `${relativeRepo(config.path)} observedAt mismatch`);
  check(spec.oci?.revision === live.spec.legs.configHubOciArgo.ociRevision, `${relativeRepo(config.path)} OCI revision mismatch`);
  check(spec.comparison?.helmVsConfigHubOciArgo === live.spec.semanticComparison.helmVsConfigHubOciArgo.result, `${relativeRepo(config.path)} semantic comparison mismatch`);
  verifyKindParityCrossCheck(config, spec.twoClusterCrossCheck ?? {});
  if (config.base === "no-crds") {
    check((spec.limits ?? []).some((item) => item.includes("compatible Prometheus Operator CRDs")), `${relativeRepo(config.path)} must state CRD prerequisite limit`);
    check((spec.targetFacts?.configHubOciArgo?.stagedCRDs ?? []).length === 10, `${relativeRepo(config.path)} must record 10 staged CRDs`);
    const stagedSecret = (spec.targetFacts?.configHubOciArgo?.stagedSecrets ?? []).find((item) => item.name === "kube-prometheus-stack-admission");
    check(Boolean(stagedSecret), `${relativeRepo(config.path)} must record staged admission Secret`);
    check((stagedSecret.keys ?? []).includes("cert") && (stagedSecret.keys ?? []).includes("key"), `${relativeRepo(config.path)} must record admission Secret cert/key`);
  }
}

function liveReceipt(config) {
  const path = liveReceiptPath(config);
  check(existsSync(path), `missing ${relativeRepo(path)}`);
  const receipt = readYaml(path);
  check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${relativeRepo(path)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.base === config.base, `${relativeRepo(path)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(path)} result must pass`);
  check(receipt.spec?.legs?.configHubOciArgo?.result === "pass", `${relativeRepo(path)} ConfigHub OCI leg must pass`);
  check(receipt.spec?.legs?.configHubOciArgo?.sync === "Synced", `${relativeRepo(path)} Argo sync must be Synced`);
  check(receipt.spec?.legs?.configHubOciArgo?.health === "Healthy", `${relativeRepo(path)} Argo health must be Healthy`);
  check(receipt.spec?.semanticComparison?.helmVsConfigHubOciArgo?.result === "pass", `${relativeRepo(path)} semantic parity must pass`);
  return receipt;
}

function kindParityCrossCheck(config) {
  const path = kindParityPath(config);
  const checkedPath = relativeRepo(path);
  if (!existsSync(path)) return missingKindParityCrossCheck(checkedPath);

  const receipt = readYaml(path);
  check(receipt.kind === "LiveHelmInstallerKindParityReceipt", `${checkedPath} kind mismatch`);
  check(receipt.spec?.chart === chart, `${checkedPath} chart mismatch`);

  if (receipt.spec?.version !== version || receipt.spec?.base !== config.base) {
    return missingKindParityCrossCheck(checkedPath, receipt);
  }

  check(receipt.spec?.result === "pass", `${checkedPath} result must pass`);
  check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply?.result === "pass", `${checkedPath} semantic parity must pass`);
  return {
    path: checkedPath,
    result: receipt.spec.result,
    semanticParity: receipt.spec.semanticComparison.helmVsCubInstallerApply.result,
    regularHelmRuntime: receipt.spec.legs.regularHelm.runtime.result,
    installerRuntime: receipt.spec.legs.cubInstallerApply.runtime.result,
  };
}

function missingKindParityCrossCheck(checkedPath, receipt = null) {
  const crossCheck = {
    status: "not-used",
    checkedPath,
    reason:
      `No matching-version two-cluster kind parity receipt is retained for ${chart}@${version}; later-version kind parity rows are deliberately excluded from this production-support evidence.`,
  };
  if (receipt?.spec) {
    crossCheck.retainedReceipt = {
      chart: receipt.spec.chart,
      version: String(receipt.spec.version),
      base: receipt.spec.base,
      result: receipt.spec.result,
    };
  }
  return crossCheck;
}

function verifyKindParityCrossCheck(config, crossCheck) {
  const expected = kindParityCrossCheck(config);
  if (expected.status === "not-used") {
    check(crossCheck.status === "not-used", `${relativeRepo(config.path)} two-cluster cross-check status mismatch`);
    check(crossCheck.checkedPath === expected.checkedPath, `${relativeRepo(config.path)} two-cluster cross-check path mismatch`);
    check(crossCheck.reason === expected.reason, `${relativeRepo(config.path)} two-cluster cross-check reason mismatch`);
    verifyRetainedReceiptSummary(config, crossCheck.retainedReceipt, expected.retainedReceipt);
    return;
  }

  check(crossCheck.path === expected.path, `${relativeRepo(config.path)} two-cluster cross-check path mismatch`);
  check(crossCheck.result === expected.result, `${relativeRepo(config.path)} two-cluster result mismatch`);
  check(crossCheck.semanticParity === expected.semanticParity, `${relativeRepo(config.path)} two-cluster semantic parity mismatch`);
  check(crossCheck.regularHelmRuntime === expected.regularHelmRuntime, `${relativeRepo(config.path)} two-cluster regular Helm runtime mismatch`);
  check(crossCheck.installerRuntime === expected.installerRuntime, `${relativeRepo(config.path)} two-cluster installer runtime mismatch`);
}

function verifyRetainedReceiptSummary(config, actual, expected) {
  if (!expected) {
    check(!actual, `${relativeRepo(config.path)} retained kind-parity receipt summary should be absent`);
    return;
  }

  check(actual?.chart === expected.chart, `${relativeRepo(config.path)} retained kind-parity chart mismatch`);
  check(actual?.version === expected.version, `${relativeRepo(config.path)} retained kind-parity version mismatch`);
  check(actual?.base === expected.base, `${relativeRepo(config.path)} retained kind-parity base mismatch`);
  check(actual?.result === expected.result, `${relativeRepo(config.path)} retained kind-parity result mismatch`);
}

function targetFactSummary(live) {
  const targetFacts = live.spec?.targetFacts ?? {};
  const summary = {};
  for (const [leg, facts] of Object.entries(targetFacts)) {
    summary[leg] = {
      stagedSecrets: (facts.stagedSecrets ?? []).map((secret) => ({
        namespace: secret.namespace,
        name: secret.name,
        keys: secret.keys ?? [],
      })),
      stagedCRDs: (facts.stagedCRDs ?? []).map((crd) => ({
        name: crd.name,
        source: crd.source,
      })),
    };
  }
  return summary;
}

function liveReceiptPath(config) {
  return join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${config.base}`, "receipt.yaml");
}

function kindParityPath(config) {
  return join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${config.base}`, "receipt.yaml");
}
