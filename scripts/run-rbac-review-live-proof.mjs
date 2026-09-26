#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify", "--generate-current", "--verify-current", "--self-test"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-rbac-review-live-proof.mjs --run
  node scripts/run-rbac-review-live-proof.mjs --generate
  node scripts/run-rbac-review-live-proof.mjs --verify
  node scripts/run-rbac-review-live-proof.mjs --generate-current
  node scripts/run-rbac-review-live-proof.mjs --verify-current
  node scripts/run-rbac-review-live-proof.mjs --self-test`);
  process.exit(2);
}

const expectedPolicyOrg = "helm-catalog";
const approvalGate = "platform/require-approval/vet-approvedby";
const catalogOciTargetRef =
  "bitnami-redis-27-0-0-stage-pilot-live-20260705/oci-target";
const policyPath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const expectedTriggers = readYaml(policyPath).spec.approvalRequired.checks
  .map((item) => item.trigger)
  .sort();
const nativeCheckWhere = `Space.Slug = 'platform' AND Slug IN (${expectedTriggers.map((ref) => `'${ref.split("/")[1]}'`).join(", ")})`;
const historicalTriggers = [
  "platform/digest-pinned-images", "platform/lifecycle-route-evidence", "platform/probes-declared",
  "platform/require-approval", "platform/vet-placeholders", "platform/vet-schemas",
].sort();
const componentName = "rbac-review-live-proof";
const beforePath = join(
  repoRoot,
  "examples",
  "apps",
  "rbac-review",
  "before.yaml",
);
const afterPath = join(
  repoRoot,
  "examples",
  "apps",
  "rbac-review",
  "after.yaml",
);
const receiptPath = join(
  repoRoot,
  "runs",
  "rbac-review-live-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "rbac-review-live-proof",
  "summary.md",
);
const workflowReceiptPath = join(repoRoot, "runs", "rbac-review-workflow-proof", "receipt.yaml");
const workflowSummaryPath = join(repoRoot, "data", "rbac-review-workflow", "summary.md");
const namespace = "rbac-review";
const serviceAccount = "report-reader";
const unitSlug = "rbac-review-example";
const configHubOciHost = "oci.hub.confighub.com:443";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
let processRunner = spawnSync;

if (mode === "--run") {
  run();
} else if (mode === "--self-test") {
  selfTest();
} else if (mode === "--generate-current") {
  check(existsSync(workflowReceiptPath), `${relativeRepo(workflowReceiptPath)} is missing; no current native workflow run has been recorded`);
  const receipt = readYaml(workflowReceiptPath); verifyCurrentReceipt(receipt); write(workflowSummaryPath, renderSummary(receipt));
} else if (mode === "--verify-current") {
  check(existsSync(workflowReceiptPath), `${relativeRepo(workflowReceiptPath)} is missing; no current native workflow run has been recorded`);
  const receipt = readYaml(workflowReceiptPath); verifyCurrentReceipt(receipt); check(existsSync(workflowSummaryPath) && readFileSync(workflowSummaryPath, "utf8") === renderSummary(receipt), `${relativeRepo(workflowSummaryPath)} is missing or stale; run --generate-current`);
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run the live proof`,
  );
  check(
    existsSync(summaryPath),
    `${relativeRepo(summaryPath)} is missing; run the generator`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run rbac-review:live:generate`,
  );
  console.log("verified the live RBAC review proof");
}

function run() {
  const policyContext = process.env.CUB_CONTEXT?.trim() ?? "";
  const clusterContext =
    process.env.RBAC_REVIEW_CLUSTER_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_RBAC_REVIEW_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_RBAC_REVIEW_PROOF=1 to confirm this live proof",
  );
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm the temporary cluster org",
  );
  check(policyContext, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(
    clusterContext,
    "set RBAC_REVIEW_CLUSTER_CONTEXT to an authenticated scratch context",
  );
  check(
    policyContext !== clusterContext,
    "use separate maintained-policy and scratch-cluster contexts",
  );
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the RBAC proof`);
  }

  const policyContextInfo = cubJson(policyContext, [
    "context",
    "get",
    policyContext,
    "-o",
    "json",
  ]);
  const clusterContextInfo = cubJson(clusterContext, [
    "context",
    "get",
    clusterContext,
    "-o",
    "json",
  ]);
  check(
    policyContextInfo.metadata?.organizationName === expectedPolicyOrg,
    `refusing to create policy evidence in ${
      policyContextInfo.metadata?.organizationName ?? "unknown"
    }; expected ${expectedPolicyOrg}`,
  );
  check(
    clusterContextInfo.metadata?.organizationName
      && clusterContextInfo.metadata.organizationName !== expectedPolicyOrg,
    "the temporary cluster must use a scratch organization",
  );

  const beforeText = readFileSync(beforePath, "utf8");
  const afterText = readFileSync(afterPath, "utf8");
  const beforeDocs = parseDocs(beforeText);
  const afterDocs = parseDocs(afterText);
  const proposedChange = verifyFixtureChange(beforeDocs, afterDocs);
  const beforeFindings = rbacFindings(beforeDocs);
  const afterFindings = rbacFindings(afterDocs);
  check(
    beforeFindings.some((finding) => finding.id === "secret-read"),
    "the starting fixture no longer contains the intended Secret-read finding",
  );
  check(
    afterFindings.every((finding) => finding.id !== "secret-read"),
    "the corrected fixture still grants Secret read access",
  );

  const topology = readNativeCheckTopology(policyContext);
  const target = cubJson(policyContext, [
    "target",
    "get",
    "--space",
    ...catalogOciTargetRef.split("/"),
    "-o",
    "json",
  ]).Target;
  check(
    target?.ProviderType === "OCI",
    `${catalogOciTargetRef} is not an OCI target`,
  );

  const recordedAt = new Date().toISOString();
  const runId = safeRunId(
    process.env.HELM_EXPT_PROOF_RUN_ID || recordedAt,
  );
  const policySpace = `hx-rbac-review-${runId}`;
  const clusterName = `hx-rbac-review-${runId}`;
  const clusterSpace = `${clusterName}-cluster`;
  const applicationName = `rbac-review-${runId}`;
  const applicationUnit = "rbac-review-application";
  const registryName = `hx-rbac-review-registry-${runId}`;
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-rbac-review-"));
  const cleanup = {
    policySpace: "not-created",
    namespace: "not-created",
    cluster: "not-created",
    clusterSpace: "not-created",
    registry: "not-created",
    localFiles: "pending",
  };
  let clusterStarted = false;
  let policySpaceCreated = false;
  let registryStarted = false;
  let receipt;

  try {
    check(
      !spacePresent(policyContext, policySpace),
      `refusing to reuse existing proof Space ${policySpace}`,
    );
    check(
      !clusterPresent(clusterName),
      `refusing to reuse existing kind cluster ${clusterName}`,
    );
    check(
      !spacePresent(clusterContext, clusterSpace),
      `refusing to reuse existing cluster Space ${clusterSpace}`,
    );
    check(
      !dockerContainerPresent(registryName),
      `refusing to reuse existing registry ${registryName}`,
    );

    const registry = startRegistry(registryName);
    registryStarted = true;
    cleanup.registry = "pending";
    clusterUp(clusterContext, clusterName);
    clusterStarted = true;
    cleanup.cluster = "pending";
    cleanup.clusterSpace = "pending";

    kubeCommand(clusterName, ["apply", "-f", beforePath], {
      timeout: 180_000,
    });
    cleanup.namespace = "pending";
    const liveBefore = permissionSnapshot(clusterName);
    check(
      liveBefore.secrets.allowed === true
        && liveBefore.configmaps.allowed === true,
      "the starting cluster permissions do not match the fixture",
    );

    createPolicySpace(policyContext, policySpace);
    policySpaceCreated = true;
    cleanup.policySpace = "pending";
    assertPolicySpace(
      policyContext,
      policySpace,
      topology.triggerIds,
      target.TargetID,
    );

    cub(policyContext, [
      "unit",
      "create",
      "--space",
      policySpace,
      unitSlug,
      beforePath,
      "--label",
      "App=rbac-review",
      "--label",
      "Proof=rbac-review-live",
      "--change-desc",
      "Import the current RBAC configuration for review",
      "--quiet",
    ]);
    cub(policyContext, [
      "unit",
      "set-target",
      "--space",
      policySpace,
      unitSlug,
      catalogOciTargetRef,
      "--quiet",
    ]);
    const storedBefore = cubJson(policyContext, ["unit", "get", unitSlug, "--space", policySpace, "-o", "json"]).Unit;
    check(
      canonicalDocs(parseDocs(storedData(policyContext, storedBefore)))
        === canonicalDocs(beforeDocs),
      "ConfigHub stored a different starting configuration",
    );

    cub(policyContext, [
      "unit",
      "update",
      "--space",
      policySpace,
      unitSlug,
      afterPath,
      "--change-desc",
      "Remove Secret access from the report-reader Role",
      "--quiet",
    ]);
    const correctedBeforeApproval = cubJson(policyContext, ["unit", "get", unitSlug, "--space", policySpace, "-o", "json"]).Unit;
    check(Number(correctedBeforeApproval.HeadRevisionNum) > Number(storedBefore.HeadRevisionNum), "the RBAC correction did not create a revision");
    const correctedText = storedData(policyContext, correctedBeforeApproval);
    check(
      canonicalDocs(parseDocs(correctedText)) === canonicalDocs(afterDocs),
      "ConfigHub stored a different corrected configuration",
    );
    check(
      correctedBeforeApproval.DataHash !== storedBefore.DataHash,
      "the RBAC correction did not create a new content hash",
    );

    const nativeApproval = approveAndReleaseChangeOrder(policyContext, policySpace, unitSlug, correctedBeforeApproval, "RBAC correction");
    const approved = cubJson(policyContext, ["unit", "get", unitSlug, "--space", policySpace, "-o", "json"]).Unit;
    check(approved.DataHash === correctedBeforeApproval.DataHash, "approval changed the corrected Unit content");
    check(canonicalDocs(parseDocs(storedData(policyContext, approved))) === canonicalDocs(afterDocs), "the approved ConfigHub data differs from the reviewed correction");
    const workloadRelease = nativeApproval.release;
    const approvedText = storedData(policyContext, approved);
    const portableRelease = publishPortableOci({
      workRoot: tempRoot,
      approvedText,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
    });
    const application = addApplication({
      context: clusterContext,
      clusterName,
      clusterSpace,
      applicationName,
      applicationUnit,
      workloadSpace: policySpace,
      sourceReference: portableRelease.clusterReference,
      anonymousOciHost: registry.clusterHost,
      destinationNamespace: namespace,
      workRoot: tempRoot,
    });
    const delivery = waitForApplication({
      clusterName,
      applicationName,
      expectedRevision: portableRelease.manifestDigest,
    });
    check(
      delivery.result === "pass",
      `${applicationName} did not reconcile: ${delivery.reason ?? "unknown"}`,
    );
    const liveAfter = permissionSnapshot(clusterName);
    check(
      liveAfter.secrets.allowed === false
        && liveAfter.configmaps.allowed === true,
      "the live permissions do not match the approved correction",
    );
    const liveRole = JSON.parse(
      kubeCommand(clusterName, [
        "-n",
        namespace,
        "get",
        "role",
        serviceAccount,
        "-o",
        "json",
      ]).output,
    );
    const reviewedRole = roleFrom(afterDocs);
    check(
      JSON.stringify(canonicalValue(liveRole.rules))
        === JSON.stringify(canonicalValue(reviewedRole.rules)),
      "the live Role rules differ from the approved ConfigHub data",
    );

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "RbacReviewWorkflowApprovalProofReceipt",
      metadata: {
        name: "namespaced-secret-read-correction",
      },
      spec: {
        recordedAt,
        source: {
          before: {
            path: relativeRepo(beforePath),
            sha256: sha256(beforeText),
            objectCount: beforeDocs.length,
            findings: beforeFindings,
          },
          after: {
            path: relativeRepo(afterPath),
            sha256: sha256(afterText),
            objectCount: afterDocs.length,
            findings: afterFindings,
          },
          proposedChange,
        },
        configHubReview: {
          organization: expectedPolicyOrg,
          space: policySpace,
          unit: unitSlug,
          unitId: storedBefore.UnitID,
          target: {
            ref: catalogOciTargetRef,
            id: target.TargetID,
            provider: target.ProviderType,
            usedForDryRunAndReleasePublish: true,
          },
          policy: {
            profile: "catalog-standard",
            resourceClass: "system-configuration",
            checks: topology,
            workflowApproval: "server-attested-changeworkflow-changeorder-v1",
          },
          revisions: {
            imported: storedBefore.HeadRevisionNum,
            corrected: correctedBeforeApproval.HeadRevisionNum,
            importedContentHash: storedBefore.DataHash,
            correctedContentHash: correctedBeforeApproval.DataHash,
          },
          beforeApproval: nativeApproval.beforeApproval,
          approval: nativeApproval.approval,
          afterApproval: nativeApproval.afterApproval,
          approvedDataMatchesReviewedFile: true,
          release: workloadRelease,
          portableRelease,
        },
        liveCluster: {
          organization: clusterContextInfo.metadata.organizationName,
          creationCommand: "cub cluster up",
          name: clusterName,
          namespace,
          serviceAccount,
          startingPermissions: liveBefore,
          correctedPermissions: liveAfter,
          liveRoleMatchesApprovedData: true,
          handoff: {
            source: "approved ConfigHub Unit data",
            method: "Argo CD",
            applicationDelivery: "ConfigHub cluster Space release OCI",
            workloadDelivery: "temporary portable OCI",
            portablePackaging: "scripted from the approved Unit data",
            automatedArgoDelivery: true,
            application,
            delivery,
          },
        },
        cleanup,
        limits: [
          "The scanner uses conservative RBAC rules. A finding asks for review; it does not prove that a permission is unnecessary.",
          "This fixture is deliberately small and namespaced. It does not resolve RoleBinding graphs across a fleet or change a production chart.",
          "The existing catalog OCI target was used for the blocked and allowed dry-run checks and to publish the approved Space release.",
          "kubectl created the deliberately unsafe starting state. The reviewed correction was packaged from the approved ConfigHub Unit data and delivered as portable OCI through Argo CD.",
          "The disposable cluster's target-scoped OCI credential was not copied into another organization. Argo CD consumed a temporary anonymous OCI containing the same approved objects.",
          "This run proves one ConfigHub-to-Argo correction on one throwaway cluster. It does not prove Flux delivery, a fleet rollout, or every RBAC change.",
          "The temporary ConfigHub Space, namespace, kind cluster, cluster Space, OCI registry, and local files were removed.",
        ],
      },
      status: {
        result: "pass",
        claim: "ConfigHub stored an exact RBAC correction, blocked it until its head revision was approved, and published its private release OCI. The same approved objects were packaged as a portable OCI, and Argo CD reconciled that portable digest on an isolated cluster. Secret access was removed while ConfigMap access remained.",
      },
    };
  } finally {
    if (clusterStarted || clusterPresent(clusterName)) {
      kubeTry(clusterName, [
        "delete",
        "application",
        applicationName,
        "-n",
        "argocd",
        "--wait=false",
      ], { timeout: 60_000 });
      if (namespacePresent(clusterName)) {
        kubeTry(clusterName, [
          "delete",
          "namespace",
          namespace,
          "--wait=true",
          "--timeout=120s",
        ], { timeout: 180_000 });
      }
      cleanup.namespace = namespacePresent(clusterName) ? "fail" : "pass";
      clusterDown(clusterContext, clusterName);
    } else if (cleanup.namespace === "not-created") {
      cleanup.namespace = "pass";
    }
    cleanup.cluster = clusterPresent(clusterName) ? "fail" : "pass";
    if (cleanup.cluster === "pass") {
      cleanup.namespace = "pass";
    }
    cleanup.clusterSpace = spacePresent(clusterContext, clusterSpace)
      ? "fail"
      : "pass";

    if (
      policySpaceCreated
      || spacePresent(policyContext, policySpace)
    ) {
      cubTry(policyContext, [
        "space",
        "delete",
        policySpace,
        "--recursive-force",
        "--quiet",
      ], { timeout: 240_000 });
    }
    cleanup.policySpace = spacePresent(policyContext, policySpace)
      ? "fail"
      : "pass";

    if (registryStarted || dockerContainerPresent(registryName)) {
      tryCommand("docker", ["rm", "-f", registryName], { timeout: 120_000 });
    }
    cleanup.registry = dockerContainerPresent(registryName) ? "fail" : "pass";

    rmSync(tempRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(tempRoot) ? "fail" : "pass";
  }

  check(receipt, "the live RBAC review proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `RBAC proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(workflowReceiptPath, receipt);
  write(workflowSummaryPath, renderSummary(receipt));
  verifyCurrentReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`,
  );
}

function verifyFixtureChange(beforeDocs, afterDocs) {
  check(beforeDocs.length === 5, "the starting RBAC fixture must contain five objects");
  check(afterDocs.length === 5, "the corrected RBAC fixture must contain five objects");
  const beforeIdentities = beforeDocs.map(identity).sort();
  const afterIdentities = afterDocs.map(identity).sort();
  check(
    JSON.stringify(beforeIdentities) === JSON.stringify(afterIdentities),
    "the RBAC correction changed the object set",
  );
  const beforeRole = roleFrom(beforeDocs);
  const afterRole = roleFrom(afterDocs);
  const beforeResources = beforeRole.rules?.[0]?.resources ?? [];
  const afterResources = afterRole.rules?.[0]?.resources ?? [];
  check(
    JSON.stringify(beforeResources) === JSON.stringify(["configmaps", "secrets"]),
    "the starting Role resources changed",
  );
  check(
    JSON.stringify(afterResources) === JSON.stringify(["configmaps"]),
    "the corrected Role resources changed",
  );
  check(
    JSON.stringify(beforeRole.rules[0].verbs)
      === JSON.stringify(afterRole.rules[0].verbs),
    "the correction changed the Role verbs",
  );
  const normalizedBefore = structuredClone(beforeDocs);
  roleFrom(normalizedBefore).rules[0].resources = [...afterResources];
  check(
    canonicalDocs(normalizedBefore) === canonicalDocs(afterDocs),
    "the correction changed more than the Role resource list",
  );
  return {
    object: identity(afterRole),
    path: "/rules/0/resources",
    removed: ["secrets"],
    retained: ["configmaps"],
    otherFieldsChanged: false,
  };
}

function rbacFindings(docs) {
  const findings = [];
  for (const doc of docs) {
    if (!["Role", "ClusterRole"].includes(doc.kind)) continue;
    for (const [ruleIndex, rule] of (doc.rules ?? []).entries()) {
      const resources = rule.resources ?? [];
      const verbs = rule.verbs ?? [];
      if (
        (resources.includes("secrets") || resources.includes("*"))
        && verbs.some((verb) =>
          ["get", "list", "watch", "*"].includes(verb))
      ) {
        findings.push({
          id: "secret-read",
          object: identity(doc),
          ruleIndex,
          resources,
          verbs,
        });
      }
      if (resources.includes("*") && verbs.includes("*")) {
        findings.push({
          id: "full-wildcard",
          object: identity(doc),
          ruleIndex,
          resources,
          verbs,
        });
      }
    }
  }
  return findings.sort((left, right) =>
    `${left.id}|${left.object}|${left.ruleIndex}`.localeCompare(
      `${right.id}|${right.object}|${right.ruleIndex}`,
    ));
}

function roleFrom(docs) {
  const role = docs.find(
    (doc) =>
      doc.apiVersion === "rbac.authorization.k8s.io/v1"
      && doc.kind === "Role"
      && doc.metadata?.namespace === namespace
      && doc.metadata?.name === serviceAccount,
  );
  check(role, `Role ${namespace}/${serviceAccount} is missing`);
  return role;
}

function permissionSnapshot(clusterName) {
  return {
    secrets: authCanI(clusterName, "list", "secrets"),
    configmaps: authCanI(clusterName, "list", "configmaps"),
  };
}

function authCanI(clusterName, verb, resource) {
  const result = kubeTry(clusterName, [
    "auth",
    "can-i",
    verb,
    resource,
    `--as=system:serviceaccount:${namespace}:${serviceAccount}`,
    "-n",
    namespace,
  ]);
  const answer = result.output.trim().toLowerCase();
  check(
    answer === "yes" || answer === "no",
    `kubectl auth can-i returned ${answer || result.error}`,
  );
  return {
    verb,
    resource,
    allowed: answer === "yes",
  };
}

function createPolicySpace(context, space) {
  cub(context, ["component", "create", componentName, "--allow-exists", "--quiet"]);
  const component = cubJson(context, ["component", "get", componentName, "-o", "json"]).Component;
  check(component?.ComponentID, `${space} component creation returned no ComponentID`);
  cub(context, [
    "space", "create", space,
    "--component", component.ComponentID,
    "--label", "App=rbac-review",
    "--label", "ApplyPolicyProfile=catalog-standard",
    "--label", "Proof=rbac-review-live",
    "--label", "ResourceClass=system-configuration",
    "--label", "SourceType=rendered-config",
    "--where-trigger", nativeCheckWhere,
    "--quiet",
  ]);
  cub(context, ["space", "update", space, "--release-target", catalogOciTargetRef, "--quiet"]);
  const bound = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(bound.ComponentID === component.ComponentID, `${space} is not bound to its Component`);
}

function readNativeCheckTopology(context) {
  const triggers = expectedTriggers.map((ref) => getByRef(context, "trigger", ref).Trigger);
  return {
    attachment: "direct nonapproval Trigger selector",
    whereTrigger: nativeCheckWhere,
    triggerRefs: expectedTriggers,
    triggerIds: triggers.map((row) => row.TriggerID).sort(),
    observedAt: new Date().toISOString(),
  };
}

function assertPolicySpace(context, space, expectedTriggerIds, expectedReleaseTargetId) {
  const actual = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(sameSet(actual.TriggerIDs ?? [], expectedTriggerIds), `${space} received the wrong Trigger set`);
  check(actual.ReleaseTargetID === expectedReleaseTargetId, `${space} received the wrong release target`);
}

function approveAndReleaseChangeOrder(context, space, unit, stored, stageName) {
  const source = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(source.ComponentID, `${stageName} source Space has no ComponentID`);
  const members = cubJson(context, ["unit", "list", "--space", space, "-o", "json"]).map((row) => row.Unit ?? row);
  check(members.length === 1 && members[0]?.UnitID === stored.UnitID, `${stageName} release would include Units beyond the reviewed subject`);
  const slug = `review-${stored.HeadRevisionNum}`;
  const dir = mkdtempSync(join(tmpdir(), "rbac-workflow-"));
  const file = join(dir, "workflow.json");
  try {
    const requirement = { Name: "review", Type: "Approval", Count: 1, AllowAuthors: true, IgnoreFail: false };
    const stage = { Name: "reviewed", WhereSpace: `SpaceID = '${source.SpaceID}'`, ReleasePrerequisites: ["review"] };
    writeFileSync(file, `${JSON.stringify({ Stages: [stage], AttestationPrerequisites: [requirement] })}\n`);
    cub(context, ["changeworkflow", "create", "--space", space, slug, "--filename", file, "--quiet"]);
    const workflow = cubJson(context, ["changeworkflow", "get", "--space", space, slug, "-o", "json"]).ChangeWorkflow;
    const observedStage = (workflow.Stages ?? []).find((row) => row.Name === "reviewed");
    const observedRequirement = (workflow.AttestationPrerequisites ?? []).find((row) => row.Name === "review");
    check(
      observedStage?.WhereSpace === stage.WhereSpace
        && (observedStage.ReleasePrerequisites ?? []).includes("review")
        && (observedRequirement?.Type ?? "Approval") === "Approval"
        && observedRequirement?.Count === 1
        && observedRequirement.AllowAuthors === true
        && (observedRequirement.IgnoreFail ?? false) === false,
      `${stageName} workflow requirement changed`,
    );
    cub(context, ["changeorder", "create", "--space", space, slug, "--component", source.ComponentID, "--in-scope-space", space, "--change-workflow", `${space}/${slug}`, "--quiet"]);
    const order = cubJson(context, ["changeorder", "get", "--space", space, slug, "-o", "json"]).ChangeOrder;
    check(order.ChangeWorkflowID === workflow.ChangeWorkflowID && order.EndTagID && Array.isArray(order.InScopeSpaceIDs) && order.InScopeSpaceIDs.length === 1 && order.InScopeSpaceIDs[0] === source.SpaceID, `${stageName} ChangeOrder is not exactly bound`);
    const head = cubJson(context, ["revision", "list", "--space", space, "--by-unit-id", stored.UnitID, "--where", `RevisionNum = ${stored.HeadRevisionNum}`, "-o", "json"]).map((row) => row.Revision ?? row);
    const chosen = cubJson(context, ["revision", "list", "--space", space, "--by-unit-id", stored.UnitID, "--change-order", order.ChangeOrderID, "-o", "json"]).map((row) => row.Revision ?? row);
    check(
      head.length === 1 && head[0]?.RevisionID === stored.HeadRevisionID && head[0]?.UnitID === stored.UnitID && Number(head[0]?.RevisionNum) === Number(stored.HeadRevisionNum) && head[0]?.DataHash === stored.DataHash
        && chosen.length === 1 && chosen[0]?.UnitID === stored.UnitID && chosen[0]?.RevisionID === head[0].RevisionID && Number(chosen[0]?.RevisionNum) === Number(head[0].RevisionNum) && chosen[0]?.DataHash === head[0].DataHash,
      `${stageName} ChangeOrder end tag does not select exactly the reviewed Unit revision`,
    );
    const revision = `ChangeOrder:${order.ChangeOrderID}`;
    const refused = cubTry(context, ["release", "publish", "--revision", revision, space, "-o", "json"]);
    check(!refused.ok && /requires review: 1 Approval attestation\(s\)/.test(refused.error), `${stageName} release did not return the workflow prerequisite refusal`);
    const result = cubJson(context, ["variant", "approve", space, "--change-order", `${space}/${slug}`, "--stage", "reviewed", "--revision", revision, "--where", `Slug = '${unit}'`, "-o", "json"]);
    const attestation = assertApprovalCreateResult({ result, space, changeOrderID: order.ChangeOrderID, unitID: stored.UnitID, revisionID: chosen[0].RevisionID, revisionNum: chosen[0].RevisionNum, stageName });
    const release = publishRelease(context, space, revision);
    return {
      beforeApproval: { result: "blocked", authority: "ChangeWorkflow.ReleasePrerequisite", changeOrderID: order.ChangeOrderID },
      approval: { authority: "server-attested-changeworkflow-changeorder-v1", workflowID: workflow.ChangeWorkflowID, changeOrderID: order.ChangeOrderID, endTagID: order.EndTagID, attestationID: attestation.AttestationID, revision: chosen[0].RevisionNum, contentHashUnchanged: true },
      afterApproval: { result: "allowed", authority: "ChangeWorkflow.ReleasePrerequisite", changeOrderID: order.ChangeOrderID },
      release,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertApprovalCreateResult({ result, space, changeOrderID, unitID, revisionID, revisionNum, stageName }) {
  const row = result.Spaces?.[0];
  const attestation = row?.Attestation;
  const subject = row?.Subjects?.[0];
  const skippedUnitsAreEmpty = !Object.hasOwn(row ?? {}, "SkippedUnits") || (Array.isArray(row.SkippedUnits) && row.SkippedUnits.length === 0);
  check(
    Array.isArray(result.Spaces)
      && result.Spaces.length === 1
      && row.SpaceSlug === space
      && !row.Error
      && Array.isArray(row.Subjects)
      && row.Subjects.length === 1
      && skippedUnitsAreEmpty
      && typeof attestation?.AttestationID === "string"
      && attestation.AttestationID.length > 0
      && attestation.Type === "Approval"
      && attestation.Result === "Pass"
      && attestation.ChangeOrderID === changeOrderID
      && subject?.UnitID === unitID
      && subject?.RevisionID === revisionID
      && Number(subject?.RevisionNum) === Number(revisionNum),
    `${stageName} approval did not bind the ChangeOrder revision`,
  );
  return attestation;
}

function publishRelease(context, space, revision) {
  const args = ["release", "publish"];
  if (revision) args.push("--revision", revision);
  args.push(space, "-o", "json");
  const response = cubJson(context, args, { timeout: 300_000 });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(release.ManifestDigest ?? release.manifestDigest);
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return { space, reference: `oci://${configHubOciHost}/space/${space}:latest`, manifestDigest, bundleDigest: normalizeDigest(release.Digest ?? release.digest), releaseId: String(release.ReleaseID ?? release.releaseId ?? "") };
}

function startRegistry(name) {
  const started = tryCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "registry:2",
  ], { timeout: 120_000 });
  check(
    started.ok,
    `could not start the temporary OCI registry: ${started.error}`,
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = tryCommand("docker", ["port", name, "5000/tcp"]);
    const match = port.output.match(/127\.0\.0\.1:(\d+)/);
    if (match) {
      const host = `127.0.0.1:${match[1]}`;
      if (tryCommand("curl", ["-fsS", `http://${host}/v2/`]).ok) {
        return {
          host,
          clusterHost: `host.docker.internal:${match[1]}`,
        };
      }
    }
    sleep(1000);
  }
  tryCommand("docker", ["rm", "-f", name], { timeout: 120_000 });
  throw new Error("temporary OCI registry did not publish a host port");
}

function publishPortableOci({
  workRoot,
  approvedText,
  registryHost,
  clusterRegistryHost,
}) {
  const outputRoot = join(workRoot, "portable-output");
  const pullRoot = join(workRoot, "portable-output-pulled");
  const outputFile = join(outputRoot, "release-objects.yaml");
  const bundleFile = join(outputRoot, "bundle.tar.gz");
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(outputFile, approvedText);
  command("tar", [
    "-czf",
    bundleFile,
    "release-objects.yaml",
  ], { cwd: outputRoot });

  const repository = "rbac-review-correction";
  const localReference = `${registryHost}/${repository}:latest`;
  command("oras", [
    "push",
    "--plain-http",
    "--artifact-type",
    artifactType,
    "--format",
    "json",
    localReference,
    `bundle.tar.gz:${deployableLayerType}`,
  ], { cwd: outputRoot, timeout: 180_000 });
  const descriptor = JSON.parse(command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--descriptor",
    localReference,
  ]).output);
  const manifestDigest = normalizeDigest(descriptor.digest);
  check(manifestDigest, "portable RBAC OCI has no manifest digest");

  command("oras", [
    "pull",
    "--plain-http",
    "--output",
    pullRoot,
    `${registryHost}/${repository}@${manifestDigest}`,
  ], { timeout: 120_000 });
  const pulledBundle = join(pullRoot, "bundle.tar.gz");
  check(existsSync(pulledBundle), "pulled portable OCI is missing bundle.tar.gz");
  command("tar", ["-xzf", pulledBundle, "-C", pullRoot]);
  const pulledFile = join(pullRoot, "release-objects.yaml");
  check(
    existsSync(pulledFile),
    "pulled portable OCI is missing release-objects.yaml",
  );
  const pulledText = readFileSync(pulledFile, "utf8");
  check(
    canonicalDocs(parseDocs(pulledText))
      === canonicalDocs(parseDocs(approvedText)),
    "pulled portable OCI differs from the approved ConfigHub Unit data",
  );
  return {
    reference: `oci://${localReference}`,
    clusterReference: `oci://${clusterRegistryHost}/${repository}`,
    manifestDigest,
    objectCount: parseDocs(approvedText).length,
    approvedDataSha256: sha256(approvedText),
    pulledDataSha256: sha256(pulledText),
    objectsMatchApprovedData: true,
    anonymousPull: true,
    registryLifetime: "temporary",
  };
}

function addApplication({
  context,
  clusterName,
  clusterSpace,
  applicationName,
  applicationUnit,
  workloadSpace,
  sourceReference,
  anonymousOciHost,
  destinationNamespace,
  workRoot,
}) {
  const targetRef = `${clusterSpace}/oci`;
  const target = cubJson(context, [
    "target",
    "get",
    "--space",
    clusterSpace,
    "oci",
    "-o",
    "json",
  ]).Target;
  check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);

  const applicationPath = join(workRoot, `${applicationName}.yaml`);
  writeFileSync(
    applicationPath,
    applicationYaml({
      applicationName,
      sourceReference,
      destinationNamespace,
    }),
    { mode: 0o600 },
  );
  configureAnonymousOci(clusterName, anonymousOciHost, workRoot);
  cub(context, [
    "unit",
    "create",
    "--space",
    clusterSpace,
    applicationUnit,
    applicationPath,
    "--target",
    targetRef,
    "--change-desc",
    `Deploy the approved RBAC correction from ${workloadSpace}`,
    "--quiet",
  ], { timeout: 180_000 });
  const rootRelease = publishRelease(context, clusterSpace);
  kubeCommand(clusterName, [
    "annotate",
    "application",
    clusterSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: applicationName,
    unit: `${clusterSpace}/${applicationUnit}`,
    source: sourceReference,
    approvedConfigHubSpace: workloadSpace,
    destinationNamespace,
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function configureAnonymousOci(clusterName, registryHost, workRoot) {
  const secretPath = join(workRoot, `${clusterName}-anonymous-oci.yaml`);
  writeFileSync(secretPath, `apiVersion: v1
kind: Secret
metadata:
  name: helm-expt-anonymous-oci
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: oci://${registryHost}
  type: oci
  enableOCI: "true"
  insecureOCIForceHttp: "true"
`, { mode: 0o600 });
  kubeCommand(clusterName, ["apply", "-f", secretPath]);
}

function waitForApplication({
  clusterName,
  applicationName,
  expectedRevision,
}) {
  let last = {
    sync: "",
    health: "",
    revision: "",
    comparisonError: "",
  };
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const result = kubeTry(clusterName, [
      "get",
      "application",
      applicationName,
      "-n",
      "argocd",
      "-o",
      "json",
    ]);
    if (result.ok) {
      const application = JSON.parse(result.output);
      last = {
        sync: String(application.status?.sync?.status ?? ""),
        health: String(application.status?.health?.status ?? ""),
        revision: normalizeDigest(application.status?.sync?.revision),
        comparisonError: String(
          (application.status?.conditions ?? [])
            .find((condition) => condition.type === "ComparisonError")
            ?.message
          ?? "",
        ),
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.revision === expectedRevision
      ) {
        return {
          result: "pass",
          sync: last.sync,
          health: last.health,
          revision: last.revision,
          expectedRevision,
          digestMatchesPortableOci: true,
        };
      }
      if (attempt >= 3 && last.comparisonError) {
        return {
          result: "blocked",
          reason: sanitizeError(last.comparisonError),
        };
      }
    }
    sleep(5000);
  }
  return {
    result: "blocked",
    reason: `sync=${last.sync || "missing"}; health=${
      last.health || "missing"
    }; revision=${last.revision || "missing"}; expected=${expectedRevision}; error=${
      last.comparisonError || "none"
    }`,
  };
}

function applicationYaml({
  applicationName,
  sourceReference,
  destinationNamespace,
}) {
  return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${applicationName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${sourceReference}
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: ${destinationNamespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
`;
}

function clusterUp(context, name) {
  const result = cubTry(
    context,
    ["cluster", "up", "--name", name, "--no-ports"],
    { timeout: 900_000 },
  );
  check(
    result.ok || clusterPresent(name),
    `cub cluster up failed for ${name}: ${result.error}`,
  );
}

function clusterDown(context, name) {
  const result = cubTry(
    context,
    ["cluster", "down", "--name", name, "--force"],
    { timeout: 600_000 },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
    });
  }
  const space = `${name}-cluster`;
  for (
    let attempt = 0;
    attempt < 3 && spacePresent(context, space);
    attempt += 1
  ) {
    cubTry(context, [
      "space",
      "delete",
      space,
      "--recursive-force",
      "--quiet",
    ], { timeout: 240_000 });
    sleep(1000);
  }
}

function kubeCommand(clusterName, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig",
    clusterKubeconfig(clusterName),
    "--context",
    `kind-${clusterName}`,
    ...args,
  ], options);
}

function kubeTry(clusterName, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig",
    clusterKubeconfig(clusterName),
    "--context",
    `kind-${clusterName}`,
    ...args,
  ], options);
}

function namespacePresent(clusterName) {
  if (!clusterPresent(clusterName)) return false;
  return kubeTry(clusterName, [
    "get",
    "namespace",
    namespace,
    "-o",
    "name",
  ]).ok;
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function dockerContainerPresent(name) {
  const result = tryCommand("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function spacePresent(context, space) {
  return cubTry(context, ["space", "get", space, "-o", "json"]).ok;
}

function getByRef(context, entity, ref) {
  const [space, slug] = ref.split("/");
  return cubJson(context, [entity, "get", "--space", space, slug, "-o", "json"]);
}

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls, and it comes back as text.
function storedData(context, unit) {
  const space = unit.SpaceSlug || unit.SpaceID;
  const text = cub(context, ["unit", "data", unit.UnitID ?? unit.Slug, "--space", space]);
  check(text, `${space}/${unit.Slug} has no stored data`);
  return text;
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({
        identity: identity(doc),
        document: canonicalValue(doc),
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !key.startsWith("$comment$"))
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[a-f0-9]{64}/i);
  return match ? match[0].toLowerCase() : "";
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnvironment(context),
  }).output;
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnvironment(context),
  });
}

function cubJson(context, args, options = {}) {
  return JSON.parse(cub(context, args, options));
}

function cubEnvironment(context) {
  return {
    ...process.env,
    CONFIGHUB_AGENT: "1",
    CUB_CONTEXT: context,
  };
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  if (!result.ok) {
    throw new Error(
      `${file} ${args.slice(0, 5).join(" ")} failed: ${result.error}`,
    );
  }
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = processRunner(file, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: result.stdout ?? "",
    error: sanitizeError(
      result.error?.message
      ?? result.stderr
      ?? result.stdout
      ?? `exit ${result.status}`,
    ),
  };
}

function sanitizeError(value) {
  return String(value ?? "")
    // Inline flag groups are non-capturing, so the $1 this replacement uses was
    // always empty and the key name was dropped along with the value. They are
    // also newer than the Node this runs on in CI, where the expression throws
    // and takes the whole redaction with it. A capturing group with the i flag
    // does what the line always meant.
    .replace(/\b(password|token|secret)\s*[:=]\s*\S+/gi, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g, "<redacted-long-value>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function safeRunId(value) {
  const compact = String(value).replace(/\D/g, "").slice(0, 14);
  check(
    compact.length >= 8,
    "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits",
  );
  return compact;
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function verifyCurrentReceipt(receipt) {
  verifyReceipt(receipt);
  check(receipt.kind === "RbacReviewWorkflowApprovalProofReceipt" && receipt.spec?.configHubReview?.policy?.workflowApproval === "server-attested-changeworkflow-changeorder-v1", "current receipt does not use native workflow approval");
}

function verifyReceipt(receipt) {
  check(["RbacReviewLiveProofReceipt", "RbacReviewWorkflowApprovalProofReceipt"].includes(receipt.kind), "RBAC review receipt kind changed");
  const nativeWorkflowReceipt = receipt.kind === "RbacReviewWorkflowApprovalProofReceipt";
  check(receipt.status?.result === "pass", "RBAC review proof is not pass");
  const source = receipt.spec?.source;
  check(
    source?.before?.path === relativeRepo(beforePath)
      && source.before.sha256 === sha256(readFileSync(beforePath, "utf8"))
      && source.before.objectCount === 5,
    "RBAC starting source changed",
  );
  check(
    source?.after?.path === relativeRepo(afterPath)
      && source.after.sha256 === sha256(readFileSync(afterPath, "utf8"))
      && source.after.objectCount === 5,
    "RBAC corrected source changed",
  );
  check(
    source.before.findings.some((finding) => finding.id === "secret-read")
      && source.after.findings.every((finding) => finding.id !== "secret-read"),
    "RBAC Secret-read finding transition changed",
  );
  check(
    source.proposedChange?.path === "/rules/0/resources"
      && sameSet(source.proposedChange.removed ?? [], ["secrets"])
      && sameSet(source.proposedChange.retained ?? [], ["configmaps"])
      && source.proposedChange.otherFieldsChanged === false,
    "RBAC proposed change is no longer exact",
  );

  const review = receipt.spec?.configHubReview;
  check(
    review?.organization === expectedPolicyOrg
      && review.policy?.profile === "catalog-standard"
      && review.policy?.resourceClass === "system-configuration"
      && review.target?.ref === catalogOciTargetRef
      && review.target?.provider === "OCI"
      && review.target?.usedForDryRunAndReleasePublish === true
      && (nativeWorkflowReceipt
        ? review.policy?.workflowApproval === "server-attested-changeworkflow-changeorder-v1"
          && !Object.hasOwn(review.policy ?? {}, "approvalGate")
          && !Object.hasOwn(review.policy ?? {}, "filter")
          && sameSet(review.policy?.checks?.triggerRefs ?? [], expectedTriggers)
        : review.policy?.approvalGate === approvalGate
          && sameSet(review.policy.filter?.triggerRefs ?? [], historicalTriggers)),
    "RBAC ConfigHub policy record changed",
  );
  check(
    review?.revisions?.corrected > review.revisions.imported
      && review.revisions.correctedContentHash
      !== review.revisions.importedContentHash,
    "RBAC correction revision record is incomplete",
  );
  check(
    nativeWorkflowReceipt
      ? review?.beforeApproval?.result === "blocked"
        && review.beforeApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
        && review.afterApproval?.result === "allowed"
        && review.afterApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
        && review.approval?.authority === "server-attested-changeworkflow-changeorder-v1"
        && typeof review.approval.workflowID === "string"
        && typeof review.approval.changeOrderID === "string"
        && typeof review.approval.attestationID === "string"
        && review.approval.contentHashUnchanged === true
      : review?.beforeApproval?.result === "blocked"
        && review.beforeApproval.gate === approvalGate
        && review.beforeApproval.dryRun === true
        && review.approval?.revisionSelector === "HeadRevisionNum"
        && review.approval.recordedApprovals >= 1
        && review.approval.approverIdentityRecordedInReceipt === false
        && review.approval.contentHashUnchanged === true
        && review.approval.gateCleared === true
        && review.afterApproval?.result === "allowed"
        && review.afterApproval.dryRun === true,
    "RBAC approval record is incomplete",
  );
  check(review?.approvedDataMatchesReviewedFile === true, "RBAC correction did not pass after approval");
  check(
    review?.release?.reference
      === `oci://${configHubOciHost}/space/${review.space}:latest`
      && normalizeDigest(review.release.manifestDigest)
      === review.release.manifestDigest,
    "RBAC ConfigHub release record is incomplete",
  );
  check(
    review?.portableRelease?.objectsMatchApprovedData === true
      && review.portableRelease.objectCount === 5
      && review.portableRelease.anonymousPull === true
      && review.portableRelease.registryLifetime === "temporary"
      && review.portableRelease.approvedDataSha256
      === review.portableRelease.pulledDataSha256
      && normalizeDigest(review.portableRelease.manifestDigest)
      === review.portableRelease.manifestDigest,
    "RBAC portable release record is incomplete",
  );

  const live = receipt.spec?.liveCluster;
  check(
    live?.creationCommand === "cub cluster up"
      && live.startingPermissions?.secrets?.allowed === true
      && live.startingPermissions?.configmaps?.allowed === true
      && live.correctedPermissions?.secrets?.allowed === false
      && live.correctedPermissions?.configmaps?.allowed === true
      && live.liveRoleMatchesApprovedData === true,
    "RBAC live permission transition changed",
  );
  check(
    live?.handoff?.source === "approved ConfigHub Unit data"
      && live.handoff.method === "Argo CD"
      && live.handoff.applicationDelivery
      === "ConfigHub cluster Space release OCI"
      && live.handoff.workloadDelivery === "temporary portable OCI"
      && live.handoff.portablePackaging
      === "scripted from the approved Unit data"
      && live.handoff.automatedArgoDelivery === true
      && live.handoff.application?.source
      === review.portableRelease.clusterReference
      && live.handoff.application.approvedConfigHubSpace === review.space
      && live.handoff.delivery?.result === "pass"
      && live.handoff.delivery.sync === "Synced"
      && live.handoff.delivery.health === "Healthy"
      && live.handoff.delivery.digestMatchesPortableOci === true
      && live.handoff.delivery.revision
      === review.portableRelease.manifestDigest,
    "RBAC delivery boundary changed",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every(
      (result) => result === "pass",
    ),
    "RBAC proof cleanup did not pass",
  );

  const serialized = JSON.stringify(receipt);
  check(!serialized.includes("@confighub.com"), "RBAC receipt contains a user identity");
  check(!serialized.includes("ch_"), "RBAC receipt contains a ConfigHub credential");
  check(
    !serialized.includes(["cub", "lk"].join("-"))
      && !serialized.includes(["cub", "lk"].join(" ")),
    "RBAC receipt contains an obsolete cluster command",
  );
}

function renderSummary(receipt) {
  const source = receipt.spec.source;
  const review = receipt.spec.configHubReview;
  const live = receipt.spec.liveCluster;
  return `# Review and fix an RBAC permission

The starting configuration gives the \`${live.serviceAccount}\` service account read
access to ConfigMaps and Secrets in one namespace. It only needs the ConfigMaps.

The review found that extra Secret access and proposed one change: remove
\`secrets\` from the Role's resource list. No other Kubernetes field changed.
ConfigHub stored the corrected revision and blocked its dry-run apply until that
exact revision was approved.

After approval, ConfigHub published its release OCI. The same approved objects were
also packaged as a portable OCI that the throwaway cluster could read without
borrowing another cluster's credentials. Argo CD reconciled the portable digest on
an isolated cluster. The service account can still list ConfigMaps and can no longer
list Secrets.

| Check | Before | After |
| --- | --- | --- |
| Secret-read finding | ${source.before.findings.length > 0 ? "Found" : "Not found"} | ${source.after.findings.length === 0 ? "Cleared" : "Still present"} |
| List Secrets | ${live.startingPermissions.secrets.allowed ? "Allowed" : "Denied"} | ${live.correctedPermissions.secrets.allowed ? "Allowed" : "Denied"} |
| List ConfigMaps | ${live.startingPermissions.configmaps.allowed ? "Allowed" : "Denied"} | ${live.correctedPermissions.configmaps.allowed ? "Allowed" : "Denied"} |
| ConfigHub apply check | Not attempted for the imported state | Blocked before approval, allowed after approval |
| ConfigHub release OCI | - | \`${review.release.manifestDigest}\` |
| Portable OCI | - | \`${review.portableRelease.manifestDigest}\`; pulled back and matched |
| Argo CD | - | ${live.handoff.delivery.sync} and ${live.handoff.delivery.health}; portable digest matched |
| Live Role matches approved data | - | ${live.liveRoleMatchesApprovedData ? "Yes" : "No"} |

## What changed

- Object: \`${source.proposedChange.object}\`
- Field: \`${source.proposedChange.path}\`
- Removed: \`${source.proposedChange.removed.join(", ")}\`
- Retained: \`${source.proposedChange.retained.join(", ")}\`
- Imported revision: ${review.revisions.imported}
- Corrected revision: ${review.revisions.corrected}

## Limits

This is a small namespaced fixture. The catalog-wide report uses conservative rules,
so a finding asks for review rather than declaring that a chart is wrong. This run
does not resolve binding graphs across a fleet or modify a production chart.

The existing catalog OCI target was used for the policy checks and release
publication. \`kubectl\` created the deliberately unsafe starting state. It did not
deliver the correction. After approval, ConfigHub published its private release OCI.
The proof also built a temporary portable OCI from the same approved data, pulled it
back to compare the objects, and let Argo CD apply it without copying a
target-scoped credential between organizations. This proves one correction on one
throwaway cluster; it does not prove a permanent public registry, Flux delivery, or
a fleet rollout. The temporary registry, Spaces, and cluster were removed.

- [Starting configuration](../../examples/apps/rbac-review/before.yaml)
- [Reviewed correction](../../examples/apps/rbac-review/after.yaml)
- [Human walkthrough](../../docs/demo/apps/rbac-review.md)
- [Committed live receipt](../../runs/rbac-review-live-proof/receipt.yaml)
- [Catalog-wide RBAC report](../app-readiness/summary.md)
`;
}

function selfTest() {
  const realRunner = processRunner;
  const context = "self-test-context";
  try {
    const hub = createFakeConfigHub();
    processRunner = (file, args) => {
      if (file !== "cub") return { status: 1, stdout: "", stderr: `fake refuses ${file}` };
      const result = hub.handle(args);
      return { status: result.ok ? 0 : 1, stdout: result.output, stderr: result.error };
    };
    const topology = readNativeCheckTopology(context);
    const space = "self-test-rbac";
    createPolicySpace(context, space);
    assertPolicySpace(context, space, topology.triggerIds, hub.catalogTargetId);
    cub(context, ["unit", "create", "--space", space, unitSlug, afterPath, "--quiet"]);
    const stored = cubJson(context, ["unit", "get", unitSlug, "--space", space, "-o", "json"]).Unit;
    const native = approveAndReleaseChangeOrder(context, space, unitSlug, stored, "self-test");
    check(native.beforeApproval.result === "blocked" && native.afterApproval.result === "allowed", "native approval bracket did not complete");
    hub.state.mismatchedChangeOrderRevision = true;
    expectFailure(() => approveAndReleaseChangeOrder(context, space, unitSlug, stored, "mismatch"), /end tag does not select exactly the reviewed Unit revision/, "mismatched ChangeOrder revision");
    hub.state.mismatchedChangeOrderRevision = false;
    hub.state.releaseFailure = "network timeout";
    expectFailure(() => approveAndReleaseChangeOrder(context, space, unitSlug, stored, "generic failure"), /did not return the workflow prerequisite refusal/, "generic release failure");
    hub.state.releaseFailure = "";
    hub.state.malformedSkippedUnits = true;
    expectFailure(() => approveAndReleaseChangeOrder(context, space, unitSlug, stored, "malformed approval"), /approval did not bind the ChangeOrder revision/, "malformed approval result");
    console.log("RBAC workflow self-test passed: native setup, prerequisite refusal, scoped approval/publication, revision mismatch, generic failure, and malformed result refusal");
  } finally { processRunner = realRunner; }
}

function expectFailure(fn, pattern, label) {
  let error;
  try { fn(); } catch (caught) { error = caught; }
  check(error && pattern.test(String(error.message)), `${label} did not fail as expected`);
}

function createFakeConfigHub() {
  const spaces = new Map(); const components = new Map(); const units = new Map(); const workflows = new Map(); const orders = new Map(); const approvals = new Set();
  const state = { mismatchedChangeOrderRevision: false, malformedSkippedUnits: false, releaseFailure: "" };
  const catalogTargetId = "fake-target";
  const key = (space, slug) => `${space}/${slug}`;
  const result = (ok, output = "", error = "") => ({ ok, output, error });
  const parse = (args) => { const flags = {}, positionals = []; for (let i=0;i<args.length;i+=1) { const token=args[i]; if (!token.startsWith("-") || token === "-") { positionals.push(token); continue; } if (["--quiet","--allow-exists"].includes(token)) { flags[token.slice(2)]=true; continue; } flags[token.replace(/^--?/, "")]=args[++i]; } return {flags,positionals}; };
  const handle = (args) => {
    const { flags, positionals } = parse(args); const [entity, verb, ...rest] = positionals;
    if (entity === "filter") return result(false, "", "retired approval filter rejected");
    if (entity === "trigger" && verb === "get") { const slug=rest[0]; if (slug === "require-approval") return result(false,"","retired approval trigger rejected"); return result(true, JSON.stringify({ Trigger: { TriggerID: `fake-trigger-${slug}` } })); }
    if (entity === "component" && verb === "create") { components.set(rest[0], {ComponentID:`fake-component-${rest[0]}`}); return result(true); }
    if (entity === "component" && verb === "get") { const row=components.get(rest[0]); return row ? result(true,JSON.stringify({Component:row})) : result(false,"","component missing"); }
    if (entity === "space" && verb === "create") { if (flags["trigger-filter"] || flags["where-trigger"] !== nativeCheckWhere) return result(false,"","native Trigger selector required"); spaces.set(rest[0],{Slug:rest[0],SpaceID:`fake-space-${rest[0]}`,ComponentID:flags.component,TriggerIDs:expectedTriggers.map((v)=>`fake-trigger-${v.split("/")[1]}`).sort(),ReleaseTargetID:null}); return result(true); }
    if (entity === "space" && verb === "update") { const row=spaces.get(rest[0]); if (!row) return result(false,"","space missing"); if (flags["release-target"]) row.ReleaseTargetID=catalogTargetId; return result(true); }
    if (entity === "space" && verb === "get") { const row=spaces.get(rest[0]); return row ? result(true,JSON.stringify({Space:row})) : result(false,"","space missing"); }
    if (entity === "unit" && verb === "create") { const data=readFileSync(rest[1],"utf8"); const row={Slug:rest[0],SpaceSlug:flags.space,UnitID:`fake-unit-${rest[0]}`,HeadRevisionID:"fake-revision-1",HeadRevisionNum:1,Data:data,DataHash:sha256(data),ValidationErrors:{}}; units.set(key(flags.space,rest[0]),row); return result(true); }
    if (entity === "unit" && verb === "get") { const row=units.get(key(flags.space,rest[0])); return row ? result(true,JSON.stringify({Unit:{...row,Data:undefined}})) : result(false,"","unit missing"); }
    if (entity === "unit" && verb === "list") { if (/ApprovedBy|ApplyGates/.test(`${flags.where??""} ${flags.select??""}`)) return result(false,"","retired aliases rejected"); return result(true,JSON.stringify([...units.values()].filter((row)=>row.SpaceSlug===flags.space).map((row)=>({Unit:{...row,Data:undefined}})))); }
    if (entity === "unit" && verb === "data") { const row=[...units.values()].find((item)=>item.SpaceSlug===flags.space && (item.Slug===rest[0] || item.UnitID===rest[0])); return row ? result(true,row.Data) : result(false,"","unit missing"); }
    if (entity === "changeworkflow" && verb === "create") { workflows.set(`${flags.space}/${rest[0]}`,{...JSON.parse(readFileSync(flags.filename,"utf8")),ChangeWorkflowID:`fake-workflow-${rest[0]}`}); return result(true); }
    if (entity === "changeworkflow" && verb === "get") { const row=workflows.get(`${flags.space}/${rest[0]}`); return row ? result(true,JSON.stringify({ChangeWorkflow:row})) : result(false,"","workflow missing"); }
    if (entity === "changeorder" && verb === "create") { const wf=workflows.get(flags["change-workflow"]), space=spaces.get(flags.space); if (!wf || !space || flags.component!==space.ComponentID) return result(false,"","bad order binding"); const order={ChangeOrderID:`fake-order-${rest[0]}`,ChangeWorkflowID:wf.ChangeWorkflowID,EndTagID:`fake-tag-${rest[0]}`,InScopeSpaceIDs:[space.SpaceID]}; approvals.delete(order.ChangeOrderID); orders.set(`${flags.space}/${rest[0]}`,order); return result(true); }
    if (entity === "changeorder" && verb === "get") { const row=orders.get(`${flags.space}/${rest[0]}`); return row ? result(true,JSON.stringify({ChangeOrder:row})) : result(false,"","order missing"); }
    if (entity === "revision" && verb === "list") { const unit=[...units.values()].find((row)=>row.UnitID===flags["by-unit-id"]); if (!unit) return result(false,"","revision missing"); const bad=flags["change-order"] && state.mismatchedChangeOrderRevision; const row={UnitID:unit.UnitID,RevisionID:bad?"wrong-revision":unit.HeadRevisionID,RevisionNum:bad?2:unit.HeadRevisionNum,DataHash:bad?"wrong-hash":unit.DataHash}; return result(true,JSON.stringify([row])); }
    if (entity === "variant" && verb === "approve") { const order=orders.get(flags["change-order"]), unit=[...units.values()][0]; if (!order || flags.revision!==`ChangeOrder:${order.ChangeOrderID}`) return result(false,"","invalid scoped approval"); approvals.add(order.ChangeOrderID); const row={SpaceSlug:rest[0],Attestation:{AttestationID:"fake-attestation",Type:"Approval",Result:"Pass",ChangeOrderID:order.ChangeOrderID},Subjects:[{UnitID:unit.UnitID,RevisionID:unit.HeadRevisionID,RevisionNum:unit.HeadRevisionNum}]}; if(state.malformedSkippedUnits)row.SkippedUnits=""; return result(true,JSON.stringify({Spaces:[row]})); }
    if (entity === "release" && verb === "publish") { if(state.releaseFailure)return result(false,"",state.releaseFailure); const id=String(flags.revision??"").replace("ChangeOrder:",""); if(!approvals.has(id))return result(false,"","requires review: 1 Approval attestation(s)"); return result(true,JSON.stringify({Release:{ReleaseID:"fake-release",Digest:`sha256:${"a".repeat(64)}`,ManifestDigest:`sha256:${"b".repeat(64)}`}})); }
    return result(false,"",`fake rejects ${args.join(" ")}`);
  };
  return { handle, state, catalogTargetId };
}
