#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify"].includes(mode), "use --generate or --verify");

const directReceiptPath = "runs/kps-lifecycle-route-proof/no-crds-receipt.yaml";
const gitopsReceiptPath = "runs/kps-gitops-lifecycle-proof/receipt.yaml";
const revisionPath =
  "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/variant-revision.yaml";
const baseRecordPath =
  "data/base-variant-records/records/prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml";
const aicrBaseRecordPath =
  "data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-19-0-argocd.yaml";
const aicrPromotionReceiptPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-19-0/promotion-readiness-receipt.yaml";
const aicrRouteIntentPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-19-0/route-intent.yaml";
const aicrNestedSummaryPath = "data/aicr-v0-19-0-nested-sources/summary.md";
const aicrFieldPolicyPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-19-0/field-policy-assessment.yaml";
const aicrApplyPolicyReceiptPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-19-0/apply-policy-receipt.yaml";
const outputRoot = join(repoRoot, "data", "lifecycle-route-resolutions");

const directReceipt = readYaml(join(repoRoot, directReceiptPath));
const gitopsReceipt = readYaml(join(repoRoot, gitopsReceiptPath));
const revision = readYaml(join(repoRoot, revisionPath));
const aicrBaseRecord = readYaml(join(repoRoot, aicrBaseRecordPath));
const aicrPromotionReceipt = readYaml(join(repoRoot, aicrPromotionReceiptPath));

validateInputs();
const records = [
  buildDirectRecord(),
  buildGitOpsRecord("argo", "Argo CD"),
  buildGitOpsRecord("flux", "Flux"),
  buildAicrStagingRecord(),
];
for (const record of records) validateRecord(record);
const summary = renderSummary(records);

if (mode === "--generate") {
  for (const record of records) {
    writeYaml(join(outputRoot, `${record.metadata.name}.yaml`), record);
  }
  write(join(outputRoot, "summary.md"), summary);
  console.log(`wrote ${records.length} lifecycle route resolutions`);
} else {
  for (const record of records) {
    verifyFile(join(outputRoot, `${record.metadata.name}.yaml`), `${toYaml(record)}\n`);
  }
  verifyFile(join(outputRoot, "summary.md"), summary);
  console.log(`verified ${records.length} lifecycle route resolutions`);
}

function validateInputs() {
  check(directReceipt.spec?.result === "pass", "direct lifecycle receipt is not pass");
  check(gitopsReceipt.spec?.result === "pass", "GitOps lifecycle receipt is not pass");
  check(
    directReceipt.spec?.chart === "prometheus-community/kube-prometheus-stack"
      && directReceipt.spec?.version === "85.3.3"
      && directReceipt.spec?.base === "no-crds",
    "direct lifecycle receipt is for a different base",
  );
  check(
    gitopsReceipt.spec?.chart === "prometheus-community/kube-prometheus-stack"
      && gitopsReceipt.spec?.version === "85.3.3"
      && gitopsReceipt.spec?.base === "no-crds",
    "GitOps lifecycle receipt is for a different base",
  );
  check(
    /^r[0-9]+$/.test(revision.spec?.revision ?? "")
      && /^[0-9a-f]{64}$/.test(revision.spec?.digest ?? ""),
    "variant revision is incomplete",
  );
  for (const controller of ["argo", "flux"]) {
    check(
      gitopsReceipt.spec?.controllers?.[controller]?.result === "pass",
      `${controller} lifecycle evidence is not pass`,
    );
  }
  check(
    aicrPromotionReceipt.status?.result === "pass"
      && aicrPromotionReceipt.spec?.promotion?.result === "pass",
    "AICR v0.19.0 staging promotion receipt is not pass",
  );
  check(
    aicrBaseRecord.spec?.source?.version === "v0.19.0"
      && /^[0-9a-f]{64}$/.test(aicrBaseRecord.spec?.baseVariant?.digest ?? ""),
    "AICR v0.19.0 base record is incomplete",
  );
}

function configuration() {
  return {
    baseVariantRecord: baseRecordPath,
    variant: "no-crds",
    revision: revision.spec.revision,
    baseRevisionDigest: revision.spec.digest,
    digest: revision.spec.digestInputs.renderedObjectSetSHA256,
    digestRole: "canonical-object-set",
    digestRecord: revisionPath,
  };
}

function commonRequirements({ targetOwnedSecrets }) {
  const requirements = [
    requirement("crds", "base", "Ten monitoring CRDs must be established before dependent objects are applied."),
    requirement("admission-certificate", "base", "The admission-create Job must create the webhook certificate Secret."),
    requirement("workloads", "base", "The ordinary workload objects run after the CRDs and certificate setup."),
    requirement("admission-webhook-patch", "base", "The admission-patch Job updates the webhook CA bundles after webhook objects exist."),
    requirement("temporary-hook-resources", "base", "Completed hook Jobs and their temporary RBAC objects must be removed before replacement."),
  ];
  if (targetOwnedSecrets) {
    requirements.unshift(
      requirement(
        "target-owned-secrets",
        "destination",
        "The destination must supply the two separated Secrets before the staged configuration runs.",
      ),
    );
  }
  return requirements;
}

function requirement(id, origin, detail) {
  return {
    id,
    origin,
    disposition: "inherited",
    state: "satisfied",
    detail,
  };
}

function buildDirectRecord() {
  const receipt = directReceipt.spec;
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "LifecycleRouteResolution",
    metadata: {
      name: "kube-prometheus-stack-85-3-3-no-crds-direct",
    },
    spec: {
      configuration: configuration(),
      destination: {
        name: receipt.execution.clusterName,
        type: receipt.execution.clusterType,
        deliveryRuntime: "cub installer direct runner",
      },
      requirements: commonRequirements({ targetOwnedSecrets: false }),
      routes: [
        route("crds-first", ["crds"], "cub installer lifecycle runner", "pre-apply", 10, "Apply CRDs and wait for Established."),
        route("certificate-setup", ["admission-certificate"], "cub installer lifecycle runner", "pre-apply", 20, "Run the admission-create Job and wait for its Secret."),
        route("ordinary-objects", ["workloads"], "cub installer lifecycle runner", "apply", 30, "Apply the retained workload objects."),
        route("webhook-patch", ["admission-webhook-patch"], "cub installer lifecycle runner", "post-apply", 40, "Run the admission-patch Job after webhook objects exist."),
        route("webhook-readiness", ["admission-webhook-patch", "workloads"], "cub installer lifecycle runner", "observe", 50, "Check CA bundles, the operator endpoint, workloads, and a server-side dry run."),
        route("hook-cleanup", ["temporary-hook-resources"], "cub installer lifecycle runner", "cleanup", 60, "Remove completed hook Jobs and temporary support objects."),
      ],
      protection: {
        records: [
          "packages/prometheus-community/kube-prometheus-stack/85.3.3/prerequisites/kube-prometheus-stack-lifecycle/generation-receipt.yaml",
        ],
      },
    },
    status: {
      decision: "ready",
      evidence: "observed",
      unresolved: ["This receipt covers a fresh installation, not the upgrade route."],
      receipts: [directReceiptPath],
    },
  };
}

function buildGitOpsRecord(controllerKey, displayName) {
  const controller = gitopsReceipt.spec.controllers[controllerKey];
  const mechanisms = controllerKey === "argo"
    ? {
        target: "Argo CD Application staged OCI source",
        crds: "Argo CD syncs the CRD stage first and waits for health.",
        prepare: "Argo CD syncs the prepare stage after CRDs.",
        workload: "Argo CD syncs the workload stage after prepare.",
        finish: "Argo CD syncs the finish stage after workloads.",
      }
    : {
        target: "Flux OCIRepository and dependent Kustomizations",
        crds: "Flux reconciles the CRD Kustomization first.",
        prepare: "Flux dependsOn advances from CRDs to the prepare Kustomization.",
        workload: "Flux dependsOn advances from prepare to the workload Kustomization.",
        finish: "Flux dependsOn advances from workloads to the finish Kustomization.",
      };
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "LifecycleRouteResolution",
    metadata: {
      name: `kube-prometheus-stack-85-3-3-no-crds-${controllerKey === "argo" ? "argo-cd" : "flux"}`,
    },
    spec: {
      configuration: configuration(),
      destination: {
        name: controller.cluster,
        type: controller.clusterType,
        deliveryRuntime: displayName,
      },
      requirements: commonRequirements({ targetOwnedSecrets: true }),
      routes: [
        route("target-secrets", ["target-owned-secrets"], "destination owner", "preflight", 5, "Create the separated Secrets before controller reconciliation."),
        route("crds-first", ["crds"], displayName, "pre-apply", 10, mechanisms.crds),
        route("certificate-setup", ["admission-certificate"], displayName, "pre-apply", 20, mechanisms.prepare),
        route("ordinary-objects", ["workloads"], displayName, "apply", 30, mechanisms.workload),
        route("webhook-patch", ["admission-webhook-patch"], displayName, "post-apply", 40, mechanisms.finish),
        route("runtime-checks", ["admission-webhook-patch", "workloads"], displayName, "observe", 50, "Check the requested OCI digest, CA bundles, operator endpoint, workloads, and server-side dry run."),
        route("hook-replacement", ["temporary-hook-resources"], displayName, "cleanup", 60, "Remove completed hook Jobs before the upgrade stages run them again."),
      ],
      protection: {
        records: [
          "runs/kps-gitops-lifecycle-proof/receipt.yaml",
          "data/kps-image-policy/decision.yaml",
        ].filter((path) => existsSync(join(repoRoot, path))),
      },
    },
    status: {
      decision: "ready",
      evidence: "observed",
      unresolved: [],
      receipts: [gitopsReceiptPath],
    },
  };
}

function buildAicrStagingRecord() {
  const staging = aicrPromotionReceipt.spec.chain.staging;
  const nestedEvidence = [
    aicrPromotionReceiptPath,
    aicrRouteIntentPath,
    aicrNestedSummaryPath,
  ];
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "LifecycleRouteResolution",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd",
    },
    spec: {
      configuration: {
        baseVariantRecord: aicrBaseRecordPath,
        variant: "staging",
        revision: String(staging.configurationUnit.headRevision),
        baseRevisionDigest: aicrBaseRecord.spec.baseVariant.digest,
        digest: staging.canonicalDataSha256,
        digestRole: "canonical-object-set",
        digestRecord: aicrPromotionReceiptPath,
      },
      destination: {
        name: "eks-h100-staging",
        type: "Amazon EKS with H100 nodes",
        deliveryRuntime: "Argo CD",
      },
      requirements: [
        aicrRequirement("argocd-prerequisite", "base", "inherited", "required", "Argo CD and the Application CRD must be ready before the 17 retained Application objects are delivered."),
        aicrRequirement("component-order", "base", "inherited", "required", "Argo CD must preserve the five AICR sync-wave stages across the 16 component Applications."),
        aicrRequirement("nested-crds", "base", "inherited", "required", "Eight nested component renders contain CRDs. Their CRDs must exist before dependent custom resources."),
        aicrRequirement("nested-lifecycle", "base", "inherited", "blocked", "Each of the 16 nested sources needs a chart-specific decision for CRDs, setup work, certificates, hooks, and health checks."),
        aicrRequirement("grafana-admin-secret", "variant", "added", "required", "The staging variant expects monitoring/aicr-grafana-admin with admin-user and admin-password keys."),
        aicrRequirement("eks-h100-target", "destination", "added", "blocked", "The destination must be an EKS cluster with H100 nodes running Ubuntu."),
        aicrRequirement("storage-and-placement", "destination", "added", "blocked", "The destination must provide the gp3 StorageClass and GPU nodes labelled nvidia.com/gpu.present=true."),
        aicrRequirement("aicr-health-checks", "base", "inherited", "required", "Run the deployment and conformance checks carried by the AICR recipe after the relevant components are available."),
      ],
      routes: [
        aicrRoute("target-facts", ["eks-h100-target", "storage-and-placement"], "destination owner", "preflight", 5, "Record and verify the EKS version, H100 node facts, Ubuntu image, gp3 StorageClass, and GPU node labels.", false, nestedEvidence),
        aicrRoute("argocd-prerequisite", ["argocd-prerequisite"], "destination owner", "preflight", 10, "Install or identify Argo CD, then check Application CRD discovery and controller readiness.", false, nestedEvidence),
        aicrRoute("variant-secret", ["grafana-admin-secret"], "destination owner", "preflight", 20, "Create monitoring/aicr-grafana-admin with the two keys named by the promoted variant.", false, [aicrPromotionReceiptPath]),
        aicrRoute("nested-crds-first", ["nested-crds", "nested-lifecycle"], "Argo CD with chart-specific routes", "pre-apply", 30, "For each nested source, establish CRDs before the custom resources that depend on them. Keep each chart's other setup work in its own ordered route.", false, nestedEvidence),
        aicrRoute("component-order", ["component-order"], "Argo CD", "apply", 40, "Reconcile the 16 component Applications in their recorded sync-wave order and stop when a wave is unhealthy.", false, nestedEvidence),
        aicrRoute("runtime-checks", ["aicr-health-checks", "nested-lifecycle"], "AICR validator and workload test runner", "observe", 50, "Run the retained AICR checks, component health checks, and one real training or NIM request on the selected GPU target.", false, nestedEvidence),
      ],
      protection: {
        records: [
          aicrFieldPolicyPath,
          aicrApplyPolicyReceiptPath,
          aicrPromotionReceiptPath,
          aicrNestedSummaryPath,
        ],
      },
    },
    status: {
      decision: "blocked",
      evidence: "partly-observed",
      unresolved: [
        "No EKS/H100 destination facts have been recorded for eks-h100-staging.",
        "The 16 nested sources render locally, but their chart-specific lifecycle routes have not all been resolved and run on the destination.",
        "Argo CD reconciliation, AICR health checks, and a real H100 workload request have not run for v0.19.0.",
      ],
      receipts: [aicrPromotionReceiptPath, aicrNestedSummaryPath],
    },
  };
}

function aicrRequirement(id, origin, disposition, state, detail) {
  return { id, origin, disposition, state, detail };
}

function aicrRoute(id, requirementRefs, actor, phase, order, mechanism, automatic, evidence) {
  return {
    id,
    requirementRefs,
    actor,
    phase,
    order,
    mechanism,
    automatic,
    retry: "Resolve the failed requirement, then retry this stage without advancing later stages.",
    onFailure: "Stop before later stages and retain the failed check with the exact configuration digest.",
    checks: ["Every requirement named by this stage must pass before the next ordered stage starts."],
    evidence,
  };
}

function route(id, requirementRefs, actor, phase, order, mechanism) {
  return {
    id,
    requirementRefs,
    actor,
    phase,
    order,
    mechanism,
    automatic: actor !== "destination owner",
    retry: actor === "destination owner" ? "Fix the missing input, then rerun preflight." : "Retry the stage only after the failed check is resolved.",
    onFailure: "Stop before later stages and report the failed requirement.",
    checks: ["The stage reports pass before the next ordered stage starts."],
    evidence: [actor.includes("cub installer") ? directReceiptPath : gitopsReceiptPath],
  };
}

function validateRecord(record) {
  check(record.kind === "LifecycleRouteResolution", `${record.metadata.name}: wrong kind`);
  if (record.metadata.name.startsWith("aicr-")) {
    check(
      record.spec.configuration.baseRevisionDigest === aicrBaseRecord.spec.baseVariant.digest,
      `${record.metadata.name}: AICR base revision digest changed`,
    );
    check(
      record.spec.configuration.digest === aicrPromotionReceipt.spec.chain.staging.canonicalDataSha256
        && record.spec.configuration.digestRole === "canonical-object-set",
      `${record.metadata.name}: AICR staging identity changed`,
    );
  } else {
    check(
      record.spec.configuration.baseRevisionDigest === revision.spec.digest,
      `${record.metadata.name}: base revision digest changed`,
    );
    check(
      record.spec.configuration.digest === revision.spec.digestInputs.renderedObjectSetSHA256
        && record.spec.configuration.digestRole === "canonical-object-set",
      `${record.metadata.name}: exact-object identity changed`,
    );
  }
  const requirementIds = new Set(record.spec.requirements.map((item) => item.id));
  check(requirementIds.size === record.spec.requirements.length, `${record.metadata.name}: duplicate requirement`);
  for (const routeRecord of record.spec.routes) {
    check(routeRecord.requirementRefs.length > 0, `${record.metadata.name}: empty route`);
    for (const id of routeRecord.requirementRefs) {
      check(requirementIds.has(id), `${record.metadata.name}: route refers to missing ${id}`);
    }
    for (const evidence of routeRecord.evidence) {
      check(existsSync(join(repoRoot, evidence)), `${record.metadata.name}: missing ${evidence}`);
    }
  }
  for (const receipt of record.status.receipts) {
    check(existsSync(join(repoRoot, receipt)), `${record.metadata.name}: missing ${receipt}`);
  }
}

function renderSummary(records) {
  const rows = records.map((record) => {
    const target = record.spec.destination;
    return `| [${record.metadata.name}](./${record.metadata.name}.yaml) | ${target.deliveryRuntime} | \`${target.name}\` | ${record.spec.routes.length} | ${record.status.decision} | ${record.status.evidence} |`;
  }).join("\n");
  return `# Lifecycle route resolutions

These records answer a destination-specific question: who will perform the work
around normal apply, in what order, for this exact configuration? Each record binds
one base revision and one exact object set to a destination and delivery runtime.
Its status separates a plan from work that has actually run.

| Resolution | Delivery runtime | Destination | Ordered routes | Decision | Evidence |
| --- | --- | --- | ---: | --- | --- |
${rows}

The three kube-prometheus-stack records have runtime receipts. The AICR v0.19.0
staging record binds a real promoted variant to its intended EKS/H100/Argo CD
destination, but stays blocked until the target facts, nested chart routes, and
runtime checks have been recorded. A new source version, lifecycle-sensitive
variant, destination, or delivery runtime requires another resolution.

Schema: [lifecycle-route-resolution.schema.json](../../schemas/lifecycle-route-resolution.schema.json).
`;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run the generate command`);
  check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale`);
}
