#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256File, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const chart = "bitnami/postgresql";
const chartSlug = "bitnami-postgresql";
const version = "18.6.7";
const supportedBase = "generated-passwords";
const variants = ["existing-secret", "generated-passwords"];
const imageReviewPath = join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv");
const imageWorkdownPath = join(repoRoot, "data", "image-digest-workdown", "chart-summary.csv");
const externalScanPath = join(repoRoot, "data", "external-scan-lane", "review.csv");
const scanWorkdownPath = join(repoRoot, "data", "scan-disposition-workdown", "workdown.csv");
const liveReceiptPath = join(repoRoot, "runs", "live-helm-confighub-compare", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const kindParityPath = join(repoRoot, "runs", "live-kind-parity", `${chartSlug}-${supportedBase}`, "receipt.yaml");
const outputRoot = join(repoRoot, "data", "production-support-decisions", chartSlug);

if (mode === "--generate") {
  writeYaml(join(outputRoot, "image-policy-decision.yaml"), buildImagePolicyDecision());
  writeYaml(join(outputRoot, "security-decision.yaml"), buildSecurityDecision());
  writeYaml(join(outputRoot, "lifecycle-decision.yaml"), buildLifecycleDecision());
  writeYaml(join(outputRoot, "fresh-target-evidence-2026-06-05.yaml"), buildFreshEvidenceReceipt());
  console.log(`wrote PostgreSQL support artifacts -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  verifyImagePolicyDecision();
  verifySecurityDecision();
  verifyLifecycleDecision();
  verifyFreshEvidenceReceipt();
  console.log("verified PostgreSQL support artifacts");
} else {
  console.log(`Usage:
  node scripts/generate-postgresql-production-support-artifacts.mjs --generate
  node scripts/generate-postgresql-production-support-artifacts.mjs --verify`);
}

function buildImagePolicyDecision() {
  const chartSummary = imageWorkdownRow();
  const rows = imageReviewRows();
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
      decision: "no-open-image-digest-gap",
      decidedAt: "2026-06-09",
      claim:
        "The rendered PostgreSQL bases use digest-pinned Bitnami PostgreSQL image references in the current proof corpus. There is no open image-digest work item for the selected generated-passwords support scope.",
      renderedImageSummary: {
        renderedSubjects: Number(chartSummary.rendered_subjects),
        subjectsNeedingResolution: Number(chartSummary.subjects_needing_resolution),
        imageRefs: Number(chartSummary.image_refs),
        mutableTagRefs: Number(chartSummary.mutable_tag_refs),
        floatingLatestOrUntaggedRefs: Number(chartSummary.floating_latest_or_untagged_refs),
      },
      variantImageRows: Object.fromEntries(
        variants.map((variant) => [
          variant,
          {
            rows: rows.filter((row) => row.variant === variant).length,
            uniqueImages: [...new Set(rows.filter((row) => row.variant === variant).map((row) => row.image))].length,
            renderedObjectSetSHA256: [...new Set(rows.filter((row) => row.variant === variant).map((row) => row.rendered_sha256))][0],
          },
        ]),
      ),
      limits: [
        "This does not mean the rendered manifests are digest-pinned for future chart versions or private image overrides.",
        "This does not claim future chart versions will stay digest-pinned.",
        "This does not make the existing-secret runtime path production-supported.",
        "Private image registries, mirrored images, or replacement images need their own digest policy.",
      ],
      evidence: [
        { path: relativeRepo(imageWorkdownPath), claim: "Summarizes PostgreSQL rendered image references and shows no open digest gap." },
        { path: relativeRepo(imageReviewPath), claim: "Lists every rendered PostgreSQL image reference as digest-pinned." },
      ],
      remainingSupportBlockers: [
        "Record scan/PDB acceptance, lifecycle boundary, and fresh target-scoped ConfigHub OCI/GitOps evidence.",
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
      decision: "pdb-policy-accepted-for-target-scope",
      decidedAt: "2026-06-09",
      claim:
        "The selected generated-passwords support scope has one external scan warning: the chart's PodDisruptionBudget unhealthy-pod eviction policy. It is accepted for this public proof scope. Target production deployments should choose a stricter PDB policy or a high-availability base where appropriate.",
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
            "Accepted for the public proof scope. Customer production scopes should choose a target PDB/availability policy together with storage and backup posture.",
        },
      ],
      limits: [
        "This is not a blanket security approval for customer clusters, private overlays, regulated environments, or future chart versions.",
        "The existing-secret base remains outside this support claim because its runtime behavior still needs target review.",
        "Production storage, backup, restore, high-availability topology, and credential rotation remain separate decisions.",
      ],
      evidence: [
        { path: relativeRepo(scanWorkdownPath), claim: "Routes PostgreSQL scan findings to accept-or-patch-pdb-policy." },
        { path: relativeRepo(externalScanPath), claim: "Records kube-linter warning counts for PostgreSQL rendered object sets." },
        ...variants.map((variant) => ({
          path: `recipes/${chart}/${version}/revisions/${variant}/r001/receipts/scan-receipt.yaml`,
          claim: `Local rendered-object scan receipt for ${variant}.`,
        })),
        {
          path: `data/production-disposition/receipts/${chartSlug}/scan-gate-warning-disposition.yaml`,
          claim: "Earlier production disposition accepts PostgreSQL scan warnings as production-review inputs.",
        },
      ],
      remainingSupportBlockers: [
        "Record image policy, lifecycle boundary, generated fact ownership, and fresh target-scoped ConfigHub OCI/GitOps evidence.",
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
        "The PostgreSQL generated-passwords base has no Helm hook objects and reaches readiness through regular Helm, cub installer apply, and ConfigHub OCI/Argo. The generated postgres password is bound before render and the rendered Secret is separated by cub installer rather than hidden in workload units.",
      lifecycleModel: {
        hookPolicy: "no-chart-hooks",
        selectedTopology: "standalone-statefulset-generated-passwords",
        generatedFacts:
          "auth.postgresPassword is generated and bound before render; the rendered Secret is deterministic and separated during cub installer output.",
        storagePolicy:
          "The public proof uses the chart's standalone StatefulSet PVC posture. StorageClass, backup, restore, high availability, and rollback remain target decisions.",
        excludedTopology:
          "existing-secret is a useful target-fact path but remains outside this production-support claim until target credential custody and rotation are separately reviewed.",
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
          separatedSecrets: live.spec.legs.configHubOciArgo.separatedSecrets,
        },
      },
      limits: [
        "This supports the generated-passwords public proof base, not every PostgreSQL deployment topology.",
        "This proof does not test PostgreSQL backup, restore, point-in-time recovery, failover, replication, or high-availability operation.",
        "Credential rotation and secret custody are target operating procedures outside this public proof.",
        "Populated init scripts or extended configuration slots require a new reviewed base.",
      ],
      evidence: [
        { path: relativeRepo(kindParityPath), claim: "Two-cluster Helm-vs-installer parity passes for generated-passwords." },
        { path: relativeRepo(liveReceiptPath), claim: "ConfigHub OCI/Argo live parity passes for generated-passwords." },
        {
          path: `data/production-disposition/receipts/${chartSlug}/generated-fact-ownership.yaml`,
          claim: "Records generated credential ownership and the separated Secret policy.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/hook-and-lifecycle-phase-policy.yaml`,
          claim: "Records the no-hooks lifecycle boundary for PostgreSQL.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/storage-backup-restore-and-rollback-policy.yaml`,
          claim: "Records PostgreSQL storage, backup, restore, and rollback boundaries.",
        },
        {
          path: `data/production-disposition/receipts/${chartSlug}/target-fact-preflight.yaml`,
          claim: "Records the existing-secret target-fact path that remains outside this support claim.",
        },
      ],
      remainingSupportBlockers: [
        "Record image policy, scan/PDB acceptance, and fresh target-scoped ConfigHub OCI/GitOps evidence.",
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
        { name: "regular-helm-runtime", result: live.spec.legs.regularHelm.runtime.result, detail: "regular Helm PostgreSQL runtime passed" },
        { name: "confighub-apply-runtime", result: live.spec.legs.configHubKubectlApply.runtime.result, detail: "ConfigHub rendered objects applied by kubectl reached PostgreSQL readiness" },
        { name: "confighub-oci-argo-runtime", result: oci.runtime.result, detail: `Argo app ${oci.app}: sync=${oci.sync} health=${oci.health} revision=${oci.ociRevision}` },
        { name: "semantic-object-parity", result: live.spec.semanticComparison.helmVsConfigHubOciArgo.result, detail: "regular Helm and ConfigHub OCI/Argo object sets match semantically, except the recorded Namespace support object" },
      ],
      supportClaim: {
        state: "fresh-target-evidence-passed",
        detail: "Fresh target-scoped ConfigHub OCI and Argo evidence passed for the declared PostgreSQL generated-passwords support scope.",
      },
      limits: [
        "This supports the recorded cub-lk vanilla kind Argo OCI scope, not every Kubernetes cluster.",
        "This assumes an existing Argo CD OCI controller is available to reconcile the ConfigHub artifact.",
        "This supports the generated-passwords base, not the existing-secret topology.",
        "Evidence freshness is 30 days for public demo/support examples unless refreshed earlier.",
      ],
    },
  };
}

function verifyImagePolicyDecision() {
  const decision = decisionFile("image-policy-decision.yaml", "ProductionImagePolicyDecision");
  check(decision.spec.decision === "no-open-image-digest-gap", "PostgreSQL image policy decision mismatch");
  check(decision.spec.supportedBaseCandidate === supportedBase, "PostgreSQL image policy supported base mismatch");
  check(Number(decision.spec.renderedImageSummary.mutableTagRefs) === 0, "PostgreSQL image policy must have zero mutable tags");
}

function verifySecurityDecision() {
  const decision = decisionFile("security-decision.yaml", "ProductionSecurityDecision");
  check(decision.spec.decision === "pdb-policy-accepted-for-target-scope", "PostgreSQL security decision mismatch");
  check(decision.spec.findingSummary.totalFindings === Number(scanWorkdownRow().findingCount), "PostgreSQL security finding count mismatch");
  for (const row of externalScanRows()) {
    check(decision.spec.findingSummary.variants[row.variant].renderedObjectSetSHA256 === row.renderedSHA256, `PostgreSQL security rendered sha mismatch for ${row.variant}`);
  }
}

function verifyLifecycleDecision() {
  const decision = decisionFile("lifecycle-decision.yaml", "ProductionLifecycleDecision");
  check(decision.spec.decision === "lifecycle-observed-for-proof-scope", "PostgreSQL lifecycle decision mismatch");
  check(decision.spec.lifecycleModel.hookPolicy === "no-chart-hooks", "PostgreSQL lifecycle hook policy mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoSync === "Synced", "PostgreSQL lifecycle Argo sync mismatch");
  check(decision.spec.observedLifecycleSignals.confighubOciArgo.argoHealth === "Healthy", "PostgreSQL lifecycle Argo health mismatch");
}

function verifyFreshEvidenceReceipt() {
  const receipt = decisionFile("fresh-target-evidence-2026-06-05.yaml", "ProductionSupportEvidenceReceipt");
  const live = liveReceipt();
  check(receipt.spec.supportClaim.state === "fresh-target-evidence-passed", "PostgreSQL fresh evidence claim mismatch");
  check(receipt.spec.observedAt === live.spec.observedAt, "PostgreSQL fresh evidence observedAt mismatch");
  check(receipt.spec.oci.revision === live.spec.legs.configHubOciArgo.ociRevision, "PostgreSQL fresh evidence OCI revision mismatch");
  check(receipt.spec.oci.sync === "Synced", "PostgreSQL Argo sync mismatch");
  check(receipt.spec.oci.health === "Healthy", "PostgreSQL Argo health mismatch");
}

function imageReviewRows() {
  const rows = parseCsv(readFileSync(imageReviewPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length > 0, "expected PostgreSQL image review rows");
  check(rows.every((row) => row.image_status === "digest-pinned"), "expected PostgreSQL image rows to be digest-pinned");
  for (const row of rows) check(sha256File(join(repoRoot, row.rendered_path)) === row.rendered_sha256, `${row.rendered_path} sha mismatch`);
  return rows;
}

function imageWorkdownRow() {
  const rows = parseCsv(readFileSync(imageWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, "expected one PostgreSQL image workdown row");
  return rows[0];
}

function externalScanRows() {
  const rows = parseCsv(readFileSync(externalScanPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === variants.length, "expected PostgreSQL external scan rows");
  return rows;
}

function scanWorkdownRow() {
  const rows = parseCsv(readFileSync(scanWorkdownPath, "utf8")).filter((row) => row.chart === chart && row.version === version);
  check(rows.length === 1, "expected one PostgreSQL scan workdown row");
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
  check(existsSync(path), `missing ${relativeRepo(path)}; run npm run postgresql:production-support`);
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
    namespace: "postgresql",
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
