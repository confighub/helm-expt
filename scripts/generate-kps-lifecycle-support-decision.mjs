#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "prometheus-community/kube-prometheus-stack";
const chartSlug = "prometheus-community-kube-prometheus-stack";
const version = "85.3.3";
const base = "default";
const decisionPath = join(repoRoot, "data", "production-support-decisions", chartSlug, "lifecycle-decision.yaml");
const hookRoutePath = join(repoRoot, "data", "hook-lifecycle", "receipts", chartSlug, base, "latest.yaml");
const localObservationPath = join(repoRoot, "runs", "top20-local-kind", "kube-prometheus-stack-default", "observation-receipt.json");
const kindParityPath = join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${base}`, "receipt.yaml");
const confighubParityPath = join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${base}`, "receipt.yaml");
const webhookDispositionPath = join(repoRoot, "data", "production-disposition", "receipts", chartSlug, "webhook-readiness-and-failure-policy.yaml");
const crdDispositionPath = join(repoRoot, "data", "production-disposition", "receipts", chartSlug, "crd-lifecycle-and-upgrade-policy.yaml");

if (mode === "--generate") {
  writeYaml(decisionPath, buildDecision());
  console.log(`wrote ${relativeRepo(decisionPath)}`);
} else if (mode === "--verify") {
  verifyDecision();
  console.log(`verified ${relativeRepo(decisionPath)}`);
} else {
  console.log(`Usage:
  node scripts/generate-kps-lifecycle-support-decision.mjs --generate
  node scripts/generate-kps-lifecycle-support-decision.mjs --verify`);
}

function buildDecision() {
  const route = hookRoute();
  const observation = localObservation();
  const kindParity = kindParitySignal();
  const confighubParity = liveReceipt(confighubParityPath, "LiveHelmConfigHubParityReceipt");

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionLifecycleDecision",
    metadata: {
      name: `${chartSlug}-public-oci-lifecycle-decision`,
    },
    spec: {
      chart,
      version,
      targetScope: {
        clusterClass: "vanilla-kubernetes",
        namespace: "monitoring",
        deliveryPath: "confighub-oci",
        gitopsController: "argo-or-flux",
      },
      supportedBaseCandidate: base,
      variantsCovered: [base],
      decision: "lifecycle-observed-for-proof-scope",
      decidedAt: "2026-06-09",
      claim:
        "The selected KPS hook/lifecycle route has observed evidence for the public monitoring proof scope: webhook TLS prerequisite staging, CRD bootstrap and Established checks, operator and workload rollout, and ConfigHub OCI/Argo runtime health. This closes the lifecycle decision for the current proof scope, but not for every production target or upgrade path.",
      route: {
        result: route.spec.result,
        summary: route.spec.route.summary,
        phases: route.spec.route.phases,
      },
      observedLifecycleSignals: {
        localKindObservation: {
          result: observation.spec.result,
          observedAt: observation.spec.observedAt,
          targetNamespace: observation.spec.target?.namespace,
          supportSecret: requiredCheck(observation, "support-secret-kube-prometheus-stack-admission"),
          crdBootstrap: requiredCheck(observation, "crd-bootstrap-apply"),
          crdsEstablished: observation.spec.checks.filter((check) => check.name === "crd-established").length,
          rolloutChecks: observation.spec.checks.filter((check) => check.name.endsWith("-rollout")).length,
          cubScoutPrerequisites: requiredCheck(observation, "cub-scout-prerequisites-met"),
          cubScoutWorkloads: requiredCheck(observation, "cub-scout-workloads-converged"),
          closedWorld: checkByName(observation, "cub-scout-closed-world-object-set"),
        },
        twoClusterParity: kindParity,
        confighubOciArgo: {
          result: confighubParity.spec.result,
          observedAt: confighubParity.spec.observedAt,
          regularHelmRuntime: confighubParity.spec.legs.regularHelm.runtime.result,
          confighubApplyRuntime: confighubParity.spec.legs.configHubKubectlApply.runtime.result,
          confighubOciRuntime: confighubParity.spec.legs.configHubOciArgo.runtime.result,
          argoSync: confighubParity.spec.legs.configHubOciArgo.sync,
          argoHealth: confighubParity.spec.legs.configHubOciArgo.health,
          semanticParity: confighubParity.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        },
      },
      limits: [
        "This decision does not execute Helm hooks directly; it records the ConfigHub lifecycle route and observed target outcome.",
        "The local observation is proof-scope evidence, not a reusable production target receipt.",
        "Closed-world object-set checking remains WATCH because extra runtime objects can appear after apply.",
        "Upgrade lifecycle, cleanup behavior, and future chart versions still need their own receipts before support expansion.",
        "Final support still needs the exact target scope, artifact digest, and fresh ConfigHub OCI/GitOps/live evidence for that scope.",
      ],
      evidence: [
        {
          path: relativeRepo(hookRoutePath),
          claim: "Records the selected KPS hook lifecycle route.",
        },
        {
          path: relativeRepo(localObservationPath),
          claim: "Records webhook TLS prerequisite staging, CRD bootstrap/Established checks, workload rollout, and cub-scout checks.",
        },
        {
          path: relativeRepo(kindParityPath),
          claim: kindParity.status === "not-used"
            ? "Records the retained later-version two-cluster kind parity row; it is not used as matching-version proof for this lifecycle decision."
            : "Records two-cluster Helm-vs-installer runtime and semantic parity for the default base.",
        },
        {
          path: relativeRepo(confighubParityPath),
          claim: "Records regular Helm, ConfigHub apply, and ConfigHub OCI/Argo runtime and semantic parity.",
        },
        {
          path: relativeRepo(webhookDispositionPath),
          claim: "Records webhook readiness and failure policy as production-review input.",
        },
        {
          path: relativeRepo(crdDispositionPath),
          claim: "Records CRD ownership and upgrade policy as production-review input.",
        },
      ],
      remainingSupportBlockers: [
        "Choose the final target scope, exact GitOps controller, namespace, and artifact digest.",
        "Refresh target-scoped ConfigHub OCI/GitOps and live/e2e evidence for the declared scope.",
      ],
    },
  };
}

function verifyDecision() {
  check(existsSync(decisionPath), `${relativeRepo(decisionPath)} is missing; run npm run kps:lifecycle-decision`);
  const decision = readYaml(decisionPath);
  check(decision.kind === "ProductionLifecycleDecision", `${relativeRepo(decisionPath)} must be kind ProductionLifecycleDecision`);
  const spec = decision.spec ?? {};
  check(spec.chart === chart, `${relativeRepo(decisionPath)} chart mismatch`);
  check(spec.version === version, `${relativeRepo(decisionPath)} version mismatch`);
  check(spec.decision === "lifecycle-observed-for-proof-scope", `${relativeRepo(decisionPath)} decision mismatch`);
  check(spec.supportedBaseCandidate === base, `${relativeRepo(decisionPath)} base mismatch`);
  check((spec.limits ?? []).some((item) => item.includes("does not execute Helm hooks directly")), `${relativeRepo(decisionPath)} must state hook execution limit`);
  check((spec.limits ?? []).some((item) => item.includes("not a reusable production target receipt")), `${relativeRepo(decisionPath)} must state target-scope limit`);

  const observation = localObservation();
  check(spec.observedLifecycleSignals?.localKindObservation?.result === observation.spec.result, `${relativeRepo(decisionPath)} local observation result mismatch`);
  check(spec.observedLifecycleSignals?.localKindObservation?.crdsEstablished === observation.spec.checks.filter((item) => item.name === "crd-established").length, `${relativeRepo(decisionPath)} CRD count mismatch`);
  check(spec.observedLifecycleSignals?.localKindObservation?.closedWorld?.result === "watch", `${relativeRepo(decisionPath)} must preserve closed-world WATCH state`);

  verifyKindParitySignal(spec.observedLifecycleSignals?.twoClusterParity ?? {});

  const confighubParity = liveReceipt(confighubParityPath, "LiveHelmConfigHubParityReceipt");
  check(spec.observedLifecycleSignals?.confighubOciArgo?.argoSync === "Synced", `${relativeRepo(decisionPath)} Argo sync mismatch`);
  check(spec.observedLifecycleSignals?.confighubOciArgo?.argoHealth === "Healthy", `${relativeRepo(decisionPath)} Argo health mismatch`);

  for (const evidence of spec.evidence ?? []) {
    check(evidence.path, `${relativeRepo(decisionPath)} evidence without path`);
    check(existsSync(join(repoRoot, evidence.path)), `${relativeRepo(decisionPath)} references missing evidence ${evidence.path}`);
  }
}

function kindParitySignal() {
  const checkedPath = relativeRepo(kindParityPath);
  if (!existsSync(kindParityPath)) return missingKindParitySignal(checkedPath);

  const receipt = readYaml(kindParityPath);
  check(receipt.kind === "LiveHelmInstallerKindParityReceipt", `${checkedPath} must be kind LiveHelmInstallerKindParityReceipt`);
  check(receipt.spec?.chart === chart, `${checkedPath} chart mismatch`);

  if (receipt.spec?.version !== version || receipt.spec?.base !== base) {
    return missingKindParitySignal(checkedPath, receipt);
  }

  check(receipt.spec?.result === "pass", `${checkedPath} result must pass`);
  check(receipt.spec?.semanticComparison?.helmVsCubInstallerApply?.result === "pass", `${checkedPath} semantic parity must pass`);
  return {
    result: receipt.spec.result,
    observedAt: receipt.spec.observedAt,
    regularHelmRuntime: receipt.spec.legs.regularHelm.runtime.result,
    installerRuntime: receipt.spec.legs.cubInstallerApply.runtime.result,
    semanticParity: receipt.spec.semanticComparison.helmVsCubInstallerApply.result,
  };
}

function missingKindParitySignal(checkedPath, receipt = null) {
  const signal = {
    status: "not-used",
    checkedPath,
    reason:
      `No matching-version two-cluster kind parity receipt is retained for ${chart}@${version}; later-version kind parity rows are deliberately excluded from this lifecycle decision.`,
  };
  if (receipt?.spec) {
    signal.retainedReceipt = {
      chart: receipt.spec.chart,
      version: String(receipt.spec.version),
      base: receipt.spec.base,
      result: receipt.spec.result,
    };
  }
  return signal;
}

function verifyKindParitySignal(actual) {
  const expected = kindParitySignal();
  if (expected.status === "not-used") {
    check(actual.status === "not-used", `${relativeRepo(decisionPath)} two-cluster signal status mismatch`);
    check(actual.checkedPath === expected.checkedPath, `${relativeRepo(decisionPath)} two-cluster signal path mismatch`);
    check(actual.reason === expected.reason, `${relativeRepo(decisionPath)} two-cluster signal reason mismatch`);
    verifyRetainedReceiptSummary(actual.retainedReceipt, expected.retainedReceipt);
    return;
  }

  check(actual.result === expected.result, `${relativeRepo(decisionPath)} two-cluster result mismatch`);
  check(actual.observedAt === expected.observedAt, `${relativeRepo(decisionPath)} two-cluster observedAt mismatch`);
  check(actual.regularHelmRuntime === expected.regularHelmRuntime, `${relativeRepo(decisionPath)} two-cluster regular Helm runtime mismatch`);
  check(actual.installerRuntime === expected.installerRuntime, `${relativeRepo(decisionPath)} two-cluster installer runtime mismatch`);
  check(actual.semanticParity === expected.semanticParity, `${relativeRepo(decisionPath)} two-cluster semantic parity mismatch`);
}

function verifyRetainedReceiptSummary(actual, expected) {
  if (!expected) {
    check(!actual, `${relativeRepo(decisionPath)} retained kind-parity receipt summary should be absent`);
    return;
  }

  check(actual?.chart === expected.chart, `${relativeRepo(decisionPath)} retained kind-parity chart mismatch`);
  check(actual?.version === expected.version, `${relativeRepo(decisionPath)} retained kind-parity version mismatch`);
  check(actual?.base === expected.base, `${relativeRepo(decisionPath)} retained kind-parity base mismatch`);
  check(actual?.result === expected.result, `${relativeRepo(decisionPath)} retained kind-parity result mismatch`);
}

function hookRoute() {
  check(existsSync(hookRoutePath), `missing ${relativeRepo(hookRoutePath)}`);
  const route = readYaml(hookRoutePath);
  check(route.kind === "HookLifecycleRouteReceipt", `${relativeRepo(hookRoutePath)} must be kind HookLifecycleRouteReceipt`);
  check(route.spec?.chart === chart, `${relativeRepo(hookRoutePath)} chart mismatch`);
  check(route.spec?.version === version, `${relativeRepo(hookRoutePath)} version mismatch`);
  check(route.spec?.base === base, `${relativeRepo(hookRoutePath)} base mismatch`);
  check(["route-selected", "observed"].includes(route.spec?.result), `${relativeRepo(hookRoutePath)} must be route-selected or observed`);
  return route;
}

function localObservation() {
  check(existsSync(localObservationPath), `missing ${relativeRepo(localObservationPath)}`);
  const receipt = JSON.parse(readFileSync(localObservationPath, "utf8"));
  check(receipt.kind === "ObservationReceipt", `${relativeRepo(localObservationPath)} must be kind ObservationReceipt`);
  check(receipt.spec?.chart === chart, `${relativeRepo(localObservationPath)} chart mismatch`);
  check(receipt.spec?.chartVersion === version, `${relativeRepo(localObservationPath)} version mismatch`);
  check(receipt.spec?.variant === base, `${relativeRepo(localObservationPath)} variant mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(localObservationPath)} result must pass`);
  requiredCheck(receipt, "support-secret-kube-prometheus-stack-admission");
  requiredCheck(receipt, "crd-bootstrap-apply");
  check(receipt.spec.checks.filter((item) => item.name === "crd-established" && item.result === "pass").length === 10, `${relativeRepo(localObservationPath)} must record 10 established CRDs`);
  check(receipt.spec.checks.filter((item) => item.name.endsWith("-rollout") && item.result === "pass").length >= 6, `${relativeRepo(localObservationPath)} must record workload rollouts`);
  requiredCheck(receipt, "cub-scout-prerequisites-met");
  requiredCheck(receipt, "cub-scout-workloads-converged");
  check(checkByName(receipt, "cub-scout-closed-world-object-set").result === "watch", `${relativeRepo(localObservationPath)} closed-world state should remain watch`);
  return receipt;
}

function liveReceipt(path, expectedKind) {
  check(existsSync(path), `missing ${relativeRepo(path)}`);
  const receipt = readYaml(path);
  check(receipt.kind === expectedKind, `${relativeRepo(path)} must be kind ${expectedKind}`);
  check(receipt.spec?.chart === chart, `${relativeRepo(path)} chart mismatch`);
  check(receipt.spec?.version === version, `${relativeRepo(path)} version mismatch`);
  check(receipt.spec?.base === base, `${relativeRepo(path)} base mismatch`);
  check(receipt.spec?.result === "pass", `${relativeRepo(path)} result must pass`);
  return receipt;
}

function requiredCheck(receipt, name) {
  const item = checkByName(receipt, name);
  check(item.result === "pass", `${name} must pass in ${receipt.metadata?.name ?? "receipt"}`);
  return item;
}

function checkByName(receipt, name) {
  const item = receipt.spec?.checks?.find((check) => check.name === name);
  check(item, `${receipt.metadata?.name ?? "receipt"} missing check ${name}`);
  return item;
}
