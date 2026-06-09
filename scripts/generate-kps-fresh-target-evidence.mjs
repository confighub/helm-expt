#!/usr/bin/env node

import { existsSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const base = "default";
const evidencePath = join(repoRoot, "data", "production-support-decisions", chartSlug, "fresh-target-evidence-2026-06-09.yaml");
const liveReceiptPath = join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${base}`, "receipt.yaml");
const kindParityPath = join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${base}`, "receipt.yaml");

if (mode === "--generate") {
  writeYaml(evidencePath, buildReceipt());
  console.log(`wrote ${relativeRepo(evidencePath)}`);
} else if (mode === "--verify") {
  verifyReceipt();
  console.log(`verified ${relativeRepo(evidencePath)}`);
} else {
  console.log(`Usage:
  node scripts/generate-kps-fresh-target-evidence.mjs --generate
  node scripts/generate-kps-fresh-target-evidence.mjs --verify`);
}

function buildReceipt() {
  const live = liveReceipt();
  const kindParity = kindParityReceipt();
  const oci = live.spec.legs.configHubOciArgo;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionSupportEvidenceReceipt",
    metadata: {
      name: `${chartSlug}-${base}-argo-oci-support-evidence-20260609`,
    },
    spec: {
      chart,
      version,
      base,
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
      source:
        {
          liveReceiptPath: relativeRepo(liveReceiptPath),
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
        detail:
          "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared kube-prometheus-stack default support scope.",
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "Future chart versions, private overlays, and stricter image or security policies need separate decisions.",
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
      ],
    },
  };
}

function verifyReceipt() {
  check(existsSync(evidencePath), `${relativeRepo(evidencePath)} is missing; run npm run kps:fresh-target-evidence`);
  const receipt = readYaml(evidencePath);
  check(receipt.kind === "ProductionSupportEvidenceReceipt", `${relativeRepo(evidencePath)} must be kind ProductionSupportEvidenceReceipt`);
  const spec = receipt.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(evidencePath)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(evidencePath)} version mismatch`);
  check(spec.base === base, `${relativeRepo(evidencePath)} base mismatch`);
  check(spec.result === "pass", `${relativeRepo(evidencePath)} result mismatch`);
  check(spec.supportClaim?.state === "fresh-target-evidence-passed", `${relativeRepo(evidencePath)} support claim mismatch`);
  check(spec.targetScope?.clusterClass === "cub-lk-kind-vanilla", `${relativeRepo(evidencePath)} cluster class mismatch`);
  check(spec.targetScope?.gitopsController === "argo", `${relativeRepo(evidencePath)} GitOps controller mismatch`);
  check(spec.oci?.sync === "Synced", `${relativeRepo(evidencePath)} Argo sync mismatch`);
  check(spec.oci?.health === "Healthy", `${relativeRepo(evidencePath)} Argo health mismatch`);
  check(/^sha256:[a-f0-9]{64}$/.test(spec.oci?.revision ?? ""), `${relativeRepo(evidencePath)} invalid OCI revision`);
  check((spec.limits ?? []).some((item) => item.includes("not every Kubernetes cluster")), `${relativeRepo(evidencePath)} must state scope limit`);

  const live = liveReceipt();
  check(spec.observedAt === live.spec.observedAt, `${relativeRepo(evidencePath)} observedAt mismatch`);
  check(spec.oci?.revision === live.spec.legs.configHubOciArgo.ociRevision, `${relativeRepo(evidencePath)} OCI revision mismatch`);
  check(spec.comparison?.helmVsConfigHubOciArgo === live.spec.semanticComparison.helmVsConfigHubOciArgo.result, `${relativeRepo(evidencePath)} semantic comparison mismatch`);
}

function liveReceipt() {
  check(existsSync(liveReceiptPath), `missing ${relativeRepo(liveReceiptPath)}`);
  const receipt = readYaml(liveReceiptPath);
  check(receipt.kind === "LiveHelmConfigHubParityReceipt", `${relativeRepo(liveReceiptPath)} kind mismatch`);
  check(receipt.spec?.chart === chart, `${relativeRepo(liveReceiptPath)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(liveReceiptPath)} version mismatch`);
  check(receipt.spec?.base === base, `${relativeRepo(liveReceiptPath)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(liveReceiptPath)} result must pass`);
  check(receipt.spec?.legs?.configHubOciArgo?.result === "pass", `${relativeRepo(liveReceiptPath)} ConfigHub OCI leg must pass`);
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
  check(receipt.spec?.base === base, `${relativeRepo(kindParityPath)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(kindParityPath)} result must pass`);
  check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply?.result === "pass", `${relativeRepo(kindParityPath)} semantic parity must pass`);
  return receipt;
}
