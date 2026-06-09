#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "bitnami/redis";
const chartSlug = "bitnami-redis";
const version = "25.5.3";
const supportedBase = "default";
const variants = ["default", "reuse-existing-secret"];
const externalScanPath = join(repoRoot, "data", "external-scan-lane", "review.csv");
const scanWorkdownPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const liveReceiptPath = join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const kindParityPath = join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const outputRoot = join(repoRoot, "data", "production-support-decisions", chartSlug);

if (mode === "--generate") {
  writeYaml(join(outputRoot, "security-decision.yaml"), buildSecurityDecision());
  writeYaml(join(outputRoot, "lifecycle-decision.yaml"), buildLifecycleDecision());
  writeYaml(join(outputRoot, "fresh-target-evidence-2026-06-05.yaml"), buildFreshEvidenceReceipt());
  console.log(`wrote Redis support artifacts -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  verifySecurityDecision();
  verifyLifecycleDecision();
  verifyFreshEvidenceReceipt();
  console.log("verified Redis support artifacts");
} else {
  console.log(`Usage:
  node scripts/generate-redis-production-support-artifacts.mjs --generate
  node scripts/generate-redis-production-support-artifacts.mjs --verify`);
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
      decision: "pdb-policy-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The Redis rendered-object scan warnings are PodDisruptionBudget unhealthy-pod-eviction policy warnings on the master and replica PDBs. They are accepted for this public cub-lk teaching and parity proof scope. Stricter availability scopes should create a reviewed PDB policy base or overlay.",
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
          group: "pdb-unhealthy-pod-eviction-policy",
          disposition:
            "Accepted for the public proof scope. For stricter production availability scopes, add a reviewed PDB policy base or operator-owned patch before support expansion.",
        },
      ],
      limits: [
        "This is not a blanket availability-policy approval for customer clusters, private overlays, or regulated environments.",
        "This does not make every Redis base production-supported.",
        "Backup, restore, failover, persistence class, sizing, and SLO policy are outside this decision.",
      ],
      evidence: [
        { path: relativeRepo(scanWorkdownPath), claim: "Routes Redis scan findings to accept-or-patch-pdb-policy." },
        { path: relativeRepo(externalScanPath), claim: "Records kube-linter warning counts for default and reuse-existing-secret rendered object sets." },
        ...variants.map((variant) => ({
          path: `recipes/${chart}/${version}/revisions/${variant}/r001/receipts/scan-receipt.yaml`,
          claim: `Local rendered-object scan receipt for ${variant}.`,
        })),
        {
          path: `data/production-disposition/receipts/${chartSlug}/scan-gate-warning-disposition.yaml`,
          claim: "Earlier production disposition accepts Redis PDB warnings as production-review inputs.",
        },
      ],
      remainingSupportBlockers: [
        "Record lifecycle/secret handling and fresh target-scoped ConfigHub OCI/GitOps evidence.",
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
        "The Redis default base has no Helm hook execution requirement in the supported proof scope. The generated Redis Secret is bound before render, separated from the workload OCI artifact, staged before apply or sync, and the StatefulSets, PVCs, and Redis PONG checks pass through regular Helm, cub installer apply, and ConfigHub OCI/Argo.",
      lifecycleModel: {
        hookPolicy: "no-chart-hooks",
        generatedFacts: ["auth.password"],
        separatedSecrets: ["redis/redis"],
        statefulWorkloads: ["redis-master", "redis-replicas"],
        targetFacts: ["reuse-existing-secret variant requires redis/redis-existing-secret key redis-password"],
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
          regularHelmRuntime: live.spec.legs.regularHelm.result,
          confighubApplyRuntime: live.spec.legs.configHubKubectlApply.result,
          confighubOciRuntime: live.spec.legs.configHubOciArgo.result,
          argoSync: live.spec.legs.configHubOciArgo.sync,
          argoHealth: live.spec.legs.configHubOciArgo.health,
          externalSecret: live.spec.legs.configHubOciArgo.externalSecret,
          redisPong: live.spec.legs.configHubOciArgo.runtime.redisPong,
          semanticParity: live.spec.semanticComparison.helmVsConfigHubOciArgo.result,
        },
      },
      limits: [
        "This supports the default generated-secret teaching base for the recorded public proof scope.",
        "The reuse-existing-secret base is a separate target-fact posture and needs its own target-scoped support decision before being claimed as supported.",
        "The Redis Secret is not silently stored in ConfigHub Units; it is generated or staged before config-only delivery.",
        "Backup, restore, failover, persistence class, sizing, and customer SLO tuning are outside this base support claim.",
      ],
      evidence: [
        { path: relativeRepo(kindParityPath), claim: "Two-cluster Helm-vs-installer parity passes for the default base." },
        { path: relativeRepo(liveReceiptPath), claim: "ConfigHub OCI/Argo live parity passes for the default base." },
        {
          path: `data/production-disposition/receipts/${chartSlug}/generated-fact-ownership.yaml`,
          claim: "Records generated Redis password ownership and separated Secret handling.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/hook-lifecycle-phase-policy.yaml`,
          claim: "Records the no-hooks lifecycle policy for Redis.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/target-fact-preflight.yaml`,
          claim: "Records the reuse-existing-secret target-fact posture as a separate variant.",
        },
      ],
      remainingSupportBlockers: [
        "Record scan/security acceptance and fresh target-scoped ConfigHub OCI/GitOps evidence.",
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
    metadata: { name: `${chartSlug}-${supportedBase}-argo-oci-support-evidence-20260605` },
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
      secretHandling: {
        separatedSecret: oci.externalSecret?.object,
        stagedBeforeSync: oci.externalSecret?.stagedBeforeSync,
        reason: oci.externalSecret?.reason,
      },
      comparison: {
        regularHelmRuntime: live.spec.legs.regularHelm.result,
        configHubApplyRuntime: live.spec.legs.configHubKubectlApply.result,
        configHubOciRuntime: oci.result,
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
        { name: "regular-helm-runtime", result: live.spec.legs.regularHelm.result, detail: "regular Helm Redis runtime passed" },
        { name: "confighub-apply-runtime", result: live.spec.legs.configHubKubectlApply.result, detail: "ConfigHub rendered objects applied by kubectl reached Redis PONG" },
        { name: "confighub-oci-argo-runtime", result: oci.result, detail: `Argo app ${oci.app}: sync=${oci.sync} health=${oci.health} revision=${oci.ociRevision}` },
        { name: "semantic-object-parity", result: live.spec.semanticComparison.helmVsConfigHubOciArgo.result, detail: "regular Helm and ConfigHub OCI/Argo object sets match semantically, except the recorded Namespace support object" },
        { name: "redis-pong", result: oci.runtime.redisPong.result, detail: "Redis PONG passed after Argo synced the ConfigHub OCI artifact" },
      ],
      supportClaim: {
        state: "fresh-target-evidence-passed",
        detail: "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared Redis default support scope.",
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "This assumes an existing Argo CD OCI controller is available to reconcile the ConfigHub artifact.",
        "The generated Redis Secret is separated from the workload OCI artifact and staged before sync.",
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
      ],
    },
  };
}

function verifySecurityDecision() {
  const decision = decisionFile("security-decision.yaml", "ProductionSecurityDecision");
  check(decision.spec.decision === "pdb-policy-accepted-for-target-scope", "Redis security decision mismatch");
  check(decision.spec.findingSummary.totalFindings === Number(scanWorkdownRow().findingCount), "Redis security finding count mismatch");
  check(decision.spec.findingSummary.topChecks["pdb-unhealthy-pod-eviction-policy"] === 4, "Redis PDB warning count mismatch");
  for (const row of externalScanRows()) {
    check(decision.spec.findingSummary.variants[row.variant].renderedObjectSetSHA256 === row.renderedSHA256, `Redis security rendered sha mismatch for ${row.variant}`);
  }
}

function verifyLifecycleDecision() {
  const decision = decisionFile("lifecycle-decision.yaml", "ProductionLifecycleDecision");
  check(decision.spec.decision === "lifecycle-observed-for-proof-scope", "Redis lifecycle decision mismatch");
  check(decision.spec.supportedBaseCandidate === supportedBase, "Redis lifecycle supported base mismatch");
  check(decision.spec.lifecycleModel.hookPolicy === "no-chart-hooks", "Redis lifecycle hook policy mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoSync === "Synced", "Redis lifecycle Argo sync mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoHealth === "Healthy", "Redis lifecycle Argo health mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.redisPong.result === "pass", "Redis PONG observation missing");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.externalSecret.stagedBeforeSync === true, "Redis separated Secret must be staged before sync");
}

function verifyFreshEvidenceReceipt() {
  const receipt = decisionFile("fresh-target-evidence-2026-06-05.yaml", "ProductionSupportEvidenceReceipt");
  const live = liveReceipt();
  check(receipt.spec.supportClaim.state === "fresh-target-evidence-passed", "Redis fresh evidence claim mismatch");
  check(receipt.spec.observedAt === live.spec.observedAt, "Redis fresh evidence observedAt mismatch");
  check(receipt.spec.oci.revision === live.spec.legs.configHubOciArgo.ociRevision, "Redis fresh evidence OCI revision mismatch");
  check(receipt.spec.oci.sync === "Synced", "Redis Argo sync mismatch");
  check(receipt.spec.oci.health === "Healthy", "Redis Argo health mismatch");
  check(receipt.spec.secretHandling.stagedBeforeSync === true, "Redis fresh evidence secret staging mismatch");
}

function externalScanRows() {
  const rows = parseCsv(readFileSync(externalScanPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === variants.length, "expected Redis external scan rows");
  return rows;
}

function scanWorkdownRow() {
  const rows = parseCsv(readFileSync(scanWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, "expected one Redis scan workdown row");
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
  check(receipt.spec?.legs?.configHubOciArgo?.runtime?.redisPong?.result === "pass", `${relativeRepo(liveReceiptPath)} Redis PONG must pass`);
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
  check(existsSync(path), `missing ${relativeRepo(path)}; run npm run redis:production-support`);
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
    namespace: "redis",
    deliveryPath: "confighub-oci",
    gitopsController: "argo",
  };
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
