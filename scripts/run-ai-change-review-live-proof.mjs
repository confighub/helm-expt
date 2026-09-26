#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
import { assertActiveApproval, assertApprovalCreateResult } from "./lib/changeorder-attestation.mjs";
import { observeApprovalAttestations } from "./lib/revision-approval-observation.mjs";

const mode = process.argv[2] ?? "--help";
const expectedOrg = "helm-catalog";
const approvalFilterRef = "platform/helm-catalog-prod-gates";
const approvalGate = "platform/require-approval/vet-approvedby";
const placeholderGate = "platform/vet-placeholders/vet-placeholders";
const aicrImageWarning = "platform/aicr-training-images-pinned/vet-cel";
const aicrSecretGate = "platform/aicr-training-secret-refs/vet-cel";
const targetRef = process.env.HELM_EXPT_AI_REVIEW_TARGET?.trim() ?? "";
const proposalPath = join(repoRoot, "data", "ai-change-review", "proposal.yaml");
const reviewedPath = join(repoRoot, "data", "ai-change-review", "reviewed.yaml");
const localReceiptPath = join(repoRoot, "data", "ai-change-review", "receipt.yaml");
const receiptPath = join(
  repoRoot,
  "runs",
  "ai-change-review-live-proof",
  "receipt.yaml",
);
const currentReceiptPath = join(
  repoRoot,
  "runs",
  "ai-change-review-live-proof-attestation-v1",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "ai-change-review-live-proof",
  "summary.md",
);
const currentSummaryPath = join(
  repoRoot,
  "data",
  "ai-change-review-live-proof-attestation-v1",
  "summary.md",
);
const legacyExpectedTriggers = [
  "platform/aicr-training-images-pinned",
  "platform/aicr-training-secret-refs",
  "platform/digest-pinned-images",
  "platform/lifecycle-route-evidence",
  "platform/probes-declared",
  "platform/require-approval",
  "platform/vet-placeholders",
  "platform/vet-schemas",
];
const expectedTriggers = legacyExpectedTriggers.filter((ref) => ref !== "platform/require-approval");
const nativeValidationWhere = `Space.Slug = 'platform' AND Slug IN (${expectedTriggers.map((ref) => `'${ref.split("/")[1]}'`).join(", ")})`;
const genericWorkloadWarnings = [
  "platform/digest-pinned-images/vet-cel",
  "platform/probes-declared/vet-cel",
];
const aicrValidationKeys = [aicrImageWarning, aicrSecretGate];
let cubExecutor = runCub;

if (mode === "--run") {
  runCurrent();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--generate-current") {
  const receipt = readYaml(currentReceiptPath);
  verifyCurrentReceipt(receipt);
  write(currentSummaryPath, renderCurrentSummary(receipt));
  console.log(`wrote ${relativeRepo(currentSummaryPath)}`);
} else if (mode === "--verify") {
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
    `${relativeRepo(summaryPath)} is stale; run npm run ai-change-review:live:generate`,
  );
  console.log("verified the live AI change review proof");
} else if (mode === "--verify-current") {
  check(existsSync(currentReceiptPath),
    `${relativeRepo(currentReceiptPath)} is missing; run the current live proof`);
  check(existsSync(currentSummaryPath),
    `${relativeRepo(currentSummaryPath)} is missing; run the current generator`);
  const receipt = readYaml(currentReceiptPath);
  verifyCurrentReceipt(receipt);
  check(readFileSync(currentSummaryPath, "utf8") === renderCurrentSummary(receipt),
    `${relativeRepo(currentSummaryPath)} is stale; run --generate-current`);
  console.log("verified the attestation-era live AI change review proof");
} else if (mode === "--self-test") {
  selfTestCurrentCallgraph();
} else {
  console.error(
    `Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify|--generate-current|--verify-current|--self-test`,
  );
  process.exitCode = 2;
}

function runCurrent() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_AI_REVIEW_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_AI_REVIEW_PROOF=1 to confirm this live-org proof",
  );
  check(context, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(
    targetRef,
    "set HELM_EXPT_AI_REVIEW_TARGET to a current Space/OCI-target reference",
  );
  const targetParts = targetRef.split("/");
  check(targetParts.length === 2 && targetParts.every(Boolean),
    "HELM_EXPT_AI_REVIEW_TARGET must be <Space>/<OCI-target>");
  const cubVersion = tryCommand("cub", ["version"], { env: cubEnv(context) });
  check(cubVersion.ok, "cub is required for this proof");
  check(isReviewedVersionPair(cubVersion.out),
    "the reviewed cub client and ConfigHub server must both be v0.6.2; no proof objects were created");

  const contextInfo = jsonCommand(
    "cub",
    ["context", "get", context, "-o", "json"],
    { env: cubEnv(context) },
  );
  check(
    contextInfo.metadata?.organizationName === expectedOrg,
    `refusing to run in organization ${contextInfo.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );

  const localReceipt = readYaml(localReceiptPath);
  verifyLocalReceipt(localReceipt);
  const proposalText = readFileSync(proposalPath, "utf8");
  const proposalDocs = parseDocs(proposalText);
  check(proposalDocs.length === 1, "the unsafe proposal must contain one object");
  const proposal = proposalDocs[0];
  const reviewedText = readFileSync(reviewedPath, "utf8");
  const reviewedDocs = parseDocs(reviewedText);
  check(reviewedDocs.length === 1, "the reviewed candidate must contain one object");
  const reviewed = reviewedDocs[0];
  for (const [name, object] of [
    ["unsafe proposal", proposal],
    ["reviewed candidate", reviewed],
  ]) {
    check(
      object.apiVersion === "trainer.kubeflow.org/v1alpha1"
        && object.kind === "ClusterTrainingRuntime"
        && object.metadata?.name === "torch-distributed",
      `the ${name} AICR object identity changed`,
    );
  }

  const topology = readApprovalTopology(context);
  const target = cubJson(context, ["target", "get", "--space", targetParts[0], targetParts[1], "-o", "json"]).Target;
  check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);

  const runId = safeRunId(
    process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString(),
  );
  const proposalSpace = `hx-ai-review-${runId}-unsafe`;
  const reviewedSpace = `hx-ai-review-${runId}-reviewed`;
  const componentSlug = `hx-ai-review-${runId}`;
  const proposalUnitSlug = "unsafe-training-runtime";
  const unitSlug = "reviewed-training-runtime";
  const cleanup = { proposalSpace: "not-created", reviewedSpace: "not-created", component: "not-created" };
  let receipt;

  try {
    for (const candidateSpace of [proposalSpace, reviewedSpace]) {
      check(!cubTry(context, ["space", "get", candidateSpace, "-o", "json"]).ok,
        `refusing to reuse existing proof Space ${candidateSpace}`);
    }
    check(!cubTry(context, ["component", "get", componentSlug, "-o", "json"]).ok,
      `refusing to reuse proof Component ${componentSlug}`);
    cub(context, ["component", "create", componentSlug, "--quiet"]);
    cleanup.component = "pending";
    const component = cubJson(context, ["component", "get", componentSlug, "-o", "json"]).Component;
    check(component?.Slug === componentSlug && component.ComponentID,
      "temporary proof Component identity did not read back");

    const proposalSpaceEntity = createSpace(context, proposalSpace, component.ComponentID, targetRef, target.TargetID, topology);
    cleanup.proposalSpace = "pending";
    const reviewedSpaceEntity = createSpace(context, reviewedSpace, component.ComponentID, targetRef, target.TargetID, topology);
    cleanup.reviewedSpace = "pending";
    assertSpaceTriggers(context, proposalSpace, topology.selectedTriggerIds);
    assertSpaceTriggers(context, reviewedSpace, topology.selectedTriggerIds);

    createCandidateUnit(context, {
      space: proposalSpace,
      slug: proposalUnitSlug,
      path: proposalPath,
      changeDescription: "Store the unsafe AICR proposal for policy review",
    });
    const proposalResult = waitForPolicy(context, proposalSpace, proposalUnitSlug, {
      expectedGates: [placeholderGate, aicrSecretGate],
      expectedValidationKeys: [
        placeholderGate,
        aicrImageWarning,
        aicrSecretGate,
      ],
    });
    const proposalValidationKeys = Object.keys(
      proposalResult.ValidationResults ?? {},
    ).sort();
    check(
      genericWorkloadWarnings.every(
        (key) => !proposalValidationKeys.includes(key),
      ),
      "ordinary workload checks reported findings for the AICR proposal",
    );
    check(proposalResult.ApplyGates?.[aicrSecretGate] === true,
      "the unsafe AICR proposal did not retain the source-aware API-key block");

    createCandidateUnit(context, {
      space: reviewedSpace,
      slug: unitSlug,
      path: reviewedPath,
      changeDescription: "Store the reviewed AICR training-runtime candidate",
    });
    const before = waitForPolicy(context, reviewedSpace, unitSlug, {
      absentGates: [approvalGate, placeholderGate, aicrSecretGate],
      absentValidationKeys: [
        ...genericWorkloadWarnings,
        ...aicrValidationKeys,
        placeholderGate,
      ],
    });
    const storedBefore = storedData(context, before);
    const sourceSha = sha256(reviewedText);
    const storedSha = sha256(storedBefore);
    const semanticMatch =
      JSON.stringify(parseDocs(storedBefore)) === JSON.stringify(reviewedDocs);
    check(semanticMatch, "ConfigHub stored a different Kubernetes object");
    check(before.ApplyGates?.[approvalGate] !== true,
      "the reviewed Space still uses the retired per-Unit approval Trigger");
    const validationKeysBeforeApproval = Object.keys(
      before.ValidationResults ?? {},
    ).sort();
    check(
      [...genericWorkloadWarnings, ...aicrValidationKeys].every(
        (key) => !validationKeysBeforeApproval.includes(key),
      ),
      "the reviewed AICR candidate received a false workload finding",
    );
    check(
      before.TargetID === target.TargetID,
      "the reviewed Unit did not retain the selected OCI target",
    );

    const headRevisionBefore = before.HeadRevisionNum;
    check(
      Number.isInteger(headRevisionBefore) && headRevisionBefore > 0,
      "the reviewed Unit has no head revision to approve",
    );

    const revisionRow = cubJson(context, ["revision", "get", unitSlug,
      String(headRevisionBefore), "--space", reviewedSpace, "-o", "json"]);
    const reviewedRevision = revisionRow.Revision ?? revisionRow;
    check(reviewedRevision.UnitID === before.UnitID
      && reviewedRevision.RevisionNum === headRevisionBefore
      && reviewedRevision.DataHash === before.DataHash
      && typeof reviewedRevision.RevisionID === "string" && reviewedRevision.RevisionID,
    "the reviewed Unit revision identity could not be read exactly");

    const boundary = createNativeReleaseBoundary({
      context,
      space: reviewedSpace,
      spaceID: reviewedSpaceEntity.SpaceID,
      componentID: component.ComponentID,
      unit: before,
      revision: reviewedRevision,
      workflowSlug: `aicr-review-${runId}`,
      changeOrderSlug: `aicr-review-${runId}`,
    });
    const after = cubJson(context, ["unit", "get", unitSlug, "--space", reviewedSpace, "-o", "json"]).Unit;
    const storedAfter = storedData(context, after);
    check(
      JSON.stringify(parseDocs(storedAfter)) === JSON.stringify(reviewedDocs),
      "approval changed the reviewed Kubernetes object",
    );
    check(
      after.DataHash === before.DataHash,
      "recording Approval changed the Unit content hash",
    );
    check(after.UnitID === before.UnitID && after.HeadRevisionNum === headRevisionBefore,
      "the reviewed Unit identity or revision changed during the release workflow");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AIChangeReviewAttestationV1LiveProofReceipt",
      metadata: {
        name: "aicr-training-runtime-reviewed-approval",
      },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: expectedOrg,
          purpose: "temporary live AI change review and release workflow proof",
        },
        component: { slug: componentSlug, id: component.ComponentID },
        source: {
          type: "aicr",
          unsafeProposal: relativeRepo(proposalPath),
          unsafeProposalSha256: sha256(proposalText),
          reviewedObject: relativeRepo(reviewedPath),
          localReviewReceipt: relativeRepo(localReceiptPath),
          sha256: sourceSha,
          identity: {
            apiVersion: reviewed.apiVersion,
            kind: reviewed.kind,
            name: reviewed.metadata.name,
          },
        },
        storedConfiguration: {
          space: reviewedSpace,
          spaceId: reviewedSpaceEntity.SpaceID,
          componentID: component.ComponentID,
          unit: unitSlug,
          unitId: before.UnitID,
          sourceSha256: sourceSha,
          storedSha256: storedSha,
          byteForByteMatch: storedBefore === reviewedText,
          semanticMatch,
          contentHashBeforeApproval: before.DataHash,
          contentHashAfterApproval: after.DataHash,
        },
        unsafeProposal: {
          space: proposalSpace,
          spaceId: proposalSpaceEntity.SpaceID,
          componentID: component.ComponentID,
          unit: proposalUnitSlug,
          unitId: proposalResult.UnitID,
          validationKeys: proposalValidationKeys,
          validationGates: Object.keys(proposalResult.ApplyGates ?? {}).sort(),
          published: false,
        },
        policy: {
          profile: "catalog-standard",
          resourceClass: "system-configuration",
          filter: topology,
          retiredApprovalTriggerNotSelected: true,
          validationKeysBeforeApproval,
          validationGatesBeforeApproval: Object.keys(before.ApplyGates ?? {}).sort(),
          aicrChecks: {
            image: {
              validationKey: aicrImageWarning,
              effect: "warn",
              unsafeProposalReported: proposalValidationKeys.includes(
                aicrImageWarning,
              ),
              reviewedCandidateReported: validationKeysBeforeApproval.includes(
                aicrImageWarning,
              ),
            },
            apiKeySecret: {
              validationKey: aicrSecretGate,
              effect: "block",
              unsafeProposalBlocked:
                proposalResult.ApplyGates?.[aicrSecretGate] === true,
              reviewedCandidateBlocked:
                before.ApplyGates?.[aicrSecretGate] === true,
            },
          },
          ordinaryWorkloadChecks: {
            validationKeys: genericWorkloadWarnings,
            reportedForUnsafeProposal: genericWorkloadWarnings.some((key) =>
              proposalValidationKeys.includes(key)),
            reportedForReviewedCandidate: genericWorkloadWarnings.some((key) =>
              validationKeysBeforeApproval.includes(key)),
            reason: "Deployment image and probe checks are scoped to ordinary Kubernetes workload kinds, so they leave this AICR custom resource alone.",
          },
        },
        target: {
          ref: targetRef,
          id: target.TargetID,
          provider: target.ProviderType,
          toolchain: target.ToolchainType,
          releaseTargetAssigned: reviewedSpaceEntity.ReleaseTargetID === target.TargetID,
          releasePublishOnly: true,
        },
        validation: {
          spaceId: reviewedSpaceEntity.SpaceID,
          unitId: before.UnitID,
          revisionId: reviewedRevision.RevisionID,
          revisionNum: headRevisionBefore,
          dataHash: before.DataHash,
          validationKeys: validationKeysBeforeApproval,
        },
        approvalProof: boundary.proof,
        release: boundary.release,
        cleanup,
        limits: [
          "The proposal is a deterministic fixture, not a transcript from a named AI model.",
          "The catalog-standard source-validation Triggers ran. Approval is a separate ChangeWorkflow AttestationPrerequisite over the reviewed ChangeOrder boundary; the old vet-approvedby Trigger is excluded from both temporary Spaces.",
          "The workflow permits the same authenticated operator identity to record the Approval attestation; independent reviewer separation is not proven.",
          "Only the reviewed Space was in scope for the ChangeOrder and release. The unsafe proposal remained in a separate Space and was not published.",
          "The four-node target-capacity check remains a repository check, not a ConfigHub Function.",
          "The AICR checks cover the nested image and AI_API_KEY fields in this trainer.kubeflow.org/v1alpha1 ClusterTrainingRuntime shape. They do not claim to cover every custom resource.",
          "No Kubernetes apply was attempted. The reviewed OCI Release was published; its content was not pulled or reconciled to a cluster.",
          "The referenced training-provider-credentials Secret was not read or tested.",
          "This run did not test promotion, rollback, GPU workload health, or live observation.",
          "Both temporary ConfigHub Spaces and their ChangeWorkflow/ChangeOrder were deleted, followed by the temporary Component, before the current receipt was written.",
        ],
      },
      status: {
        result: "pass",
        claim: "ConfigHub reported the unsafe AICR image and blocked its inline API key, stored the reviewed object unchanged, blocked publication at a native ChangeWorkflow Approval prerequisite, recorded Approval for the exact reviewed revision, and published only that reviewed ChangeOrder boundary as an OCI Release.",
      },
    };
  } finally {
    cleanup.proposalSpace = cleanupSpace(context, proposalSpace, cleanup.proposalSpace);
    cleanup.reviewedSpace = cleanupSpace(context, reviewedSpace, cleanup.reviewedSpace);
    cleanup.component = cleanupComponent(context, componentSlug, cleanup.component);
  }

  check(receipt, "the live AI change review proof did not complete");
  check(cleanup.proposalSpace === "pass" && cleanup.reviewedSpace === "pass" && cleanup.component === "pass",
    "the temporary proof Component and Spaces were not deleted");
  writeYaml(currentReceiptPath, receipt);
  write(currentSummaryPath, renderCurrentSummary(receipt));
  verifyCurrentReceipt(receipt);
  console.log(`wrote ${relativeRepo(currentReceiptPath)} and ${relativeRepo(currentSummaryPath)}`);
}

function createCandidateUnit(
  context,
  {
    space,
    slug,
    path,
    changeDescription,
  },
) {
  cub(context, [
    "unit",
    "create",
    "--space",
    space,
    slug,
    path,
    "--label",
    "Proof=ai-change-review-live",
    "--change-desc",
    changeDescription,
    "--quiet",
  ]);
  cub(context, [
    "unit",
    "set-target",
    "--space",
    space,
    slug,
    targetRef,
    "--quiet",
  ]);
}

function createSpace(context, space, componentID, releaseTargetRef, expectedTargetID, topology) {
  cub(context, [
    "space",
    "create",
    space,
    "--component",
    componentID,
    "--release-target",
    releaseTargetRef,
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "Proof=ai-change-review-live",
    "--label",
    "ResourceClass=system-configuration",
    "--label",
    "SourceType=aicr",
    "--where-trigger",
    topology.whereTrigger,
    "--quiet",
  ]);
  cub(context, [
    "space",
    "update",
    "--patch",
    space,
    "--refresh-triggers",
    "--quiet",
  ]);
  const entity = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(entity?.Slug === space && entity.SpaceID
    && entity.ComponentID === componentID
    && entity.ReleaseTargetID === expectedTargetID,
  `${space} Space identity, Component, or release Target did not read back`);
  check(sameSet(entity.TriggerIDs ?? [], topology.selectedTriggerIds),
    `${space} received an unexpected source-validation Trigger set`);
  return entity;
}

function readApprovalTopology(context) {
  const filter = getByRef(context, "filter", approvalFilterRef).Filter;
  const triggers = expectedTriggers.map((ref) => ({
    ref,
    entity: getByRef(context, "trigger", ref).Trigger,
  }));
  return {
    attachment: "direct nonapproval Trigger selector",
    sourceFilter: {
      ref: approvalFilterRef,
      id: filter.FilterID,
      hash: String(filter.Hash ?? "").trim(),
    },
    whereTrigger: nativeValidationWhere,
    triggerRefs: expectedTriggers,
    triggerIds: triggers.map(({ entity }) => entity.TriggerID).sort(),
    selectedTriggerRefs: expectedTriggers,
    selectedTriggerIds: triggers.map(({ entity }) => entity.TriggerID).sort(),
    excludedTriggerRefs: ["platform/require-approval"],
    excludedTriggerIds: [],
  };
}

function assertSpaceTriggers(context, space, expectedTriggerIds) {
  const actual = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(
    sameSet(actual.TriggerIDs ?? [], expectedTriggerIds),
    `${space} received the wrong Trigger set`,
  );
}

function createNativeReleaseBoundary({ context, space, spaceID, componentID, unit, revision, workflowSlug, changeOrderSlug }) {
  const workflowDocument = {
    Stages: [{
      Name: "publication",
      WhereSpace: `SpaceID = '${spaceID}'`,
      ReleasePrerequisites: ["review"],
    }],
    AttestationPrerequisites: [{
      Name: "review",
      Type: "Approval",
      Count: 1,
      AllowAuthors: true,
      IgnoreFail: false,
    }],
  };
  const workflowCommand = ["cub", "changeworkflow", "create", "--space", space,
    workflowSlug, "--from-stdin", "--quiet"];
  cub(context, workflowCommand.slice(1), { input: `${JSON.stringify(workflowDocument)}\n` });
  const workflow = cubJson(context, ["changeworkflow", "get", "--space", space,
    workflowSlug, "-o", "json"]).ChangeWorkflow;
  assertReleaseWorkflow(workflow, spaceID);

  const changeOrderCommand = ["cub", "changeorder", "create", "--space", space,
    changeOrderSlug, "--component", componentID, "--in-scope-space", spaceID, "--change-workflow",
    `${space}/${workflowSlug}`, "--quiet"];
  cub(context, changeOrderCommand.slice(1));
  const changeOrder = cubJson(context, ["changeorder", "get", "--space", space,
    changeOrderSlug, "-o", "json"]).ChangeOrder;
  check(changeOrder?.ChangeOrderID && changeOrder.EndTagID
    && changeOrder.ChangeWorkflowID === workflow.ChangeWorkflowID
    && changeOrder.ComponentID === componentID
    && Array.isArray(changeOrder.InScopeSpaceIDs)
    && changeOrder.InScopeSpaceIDs.length === 1
    && changeOrder.InScopeSpaceIDs[0] === spaceID,
  "ChangeOrder is not bound to the exact reviewed Space and ChangeWorkflow");

  const expectedSubject = {
    UnitID: unit.UnitID,
    RevisionID: revision.RevisionID,
    RevisionNum: revision.RevisionNum,
  };
  const dryRunCommand = ["cub", "variant", "approve", space,
    "--change-order", changeOrder.ChangeOrderID, "--stage", "publication", "--all",
    "--dry-run", "-o", "json"];
  const dryRun = cubJson(context, dryRunCommand.slice(1));
  const previewSubjects = nativeApprovalSubjects(dryRun, space, spaceID);
  assertExactSubject(previewSubjects, expectedSubject);

  const refusalCommand = ["cub", "release", "publish", "--revision",
    `ChangeOrder:${changeOrder.ChangeOrderID}`, space, "-o", "json"];
  const refusal = cubTry(context, refusalCommand.slice(1));
  check(!refusal.ok && /requires review: 1 Approval attestation\(s\)/.test(refusal.error),
    `the ChangeWorkflow did not block this unapproved ChangeOrder release: ${refusal.error}`);

  const approvalCommand = ["cub", "variant", "approve", space,
    "--change-order", changeOrder.ChangeOrderID, "--stage", "publication", "--all", "-o", "json"];
  const approvalResult = cubJson(context, approvalCommand.slice(1));
  const created = assertApprovalCreateResult(approvalResult, {
    space,
    unitID: expectedSubject.UnitID,
    revisionID: expectedSubject.RevisionID,
    revisionNum: expectedSubject.RevisionNum,
    changeOrderID: changeOrder.ChangeOrderID,
  }, check);
  const createdSubjects = nativeApprovalSubjects(approvalResult, space, spaceID);
  assertExactSubject(createdSubjects, expectedSubject);
  check(created.attestationID, "variant approve did not return an immutable Approval ID");

  const attestations = cubJson(context, ["attestation", "list", "--space", space, "-o", "json"]);
  const readbackRevisionRow = cubJson(context, ["revision", "get", unit.Slug,
    String(expectedSubject.RevisionNum), "--space", space, "-o", "json"]);
  const observed = observeApprovalAttestations(unit, readbackRevisionRow, attestations);
  check(observed.revisionID === expectedSubject.RevisionID
    && observed.attestationIDs.includes(created.attestationID),
  "recorded Approval is not active on the exact reviewed Revision");
  const attestation = cubJson(context, ["attestation", "get", created.attestationID, "-o", "json"]).Attestation;
  const active = assertActiveApproval(attestation, {
    attestationID: created.attestationID,
    changeOrderID: changeOrder.ChangeOrderID,
  }, check);

  const confirmedOrder = cubJson(context, ["changeorder", "get", "--space", space,
    changeOrderSlug, "-o", "json"]).ChangeOrder;
  check(confirmedOrder.ChangeOrderID === changeOrder.ChangeOrderID
    && confirmedOrder.EndTagID === changeOrder.EndTagID
    && confirmedOrder.ChangeWorkflowID === workflow.ChangeWorkflowID
    && confirmedOrder.InScopeSpaceIDs?.length === 1
    && confirmedOrder.InScopeSpaceIDs[0] === spaceID,
  "ChangeOrder scope or end boundary changed while recording Approval");

  const releaseCommand = ["cub", "release", "publish", "--revision",
    `ChangeOrder:${confirmedOrder.ChangeOrderID}`, space, "-o", "json"];
  const result = cubJson(context, releaseCommand.slice(1));
  const release = result.Release ?? result;
  check(release.Published === true && release.UnitCount === 1
    && typeof release.ManifestDigest === "string"
    && /^sha256:[0-9a-f]{64}$/.test(release.ManifestDigest),
  "ConfigHub did not publish exactly the reviewed one-Unit ChangeOrder Release");

  return {
    proof: {
      model: "server-attested-changeworkflow-changeorder-v1",
      space: { slug: space, id: spaceID, componentID },
      workflow: {
        id: workflow.ChangeWorkflowID,
        slug: workflowSlug,
        stage: "publication",
        command: workflowCommand,
      },
      changeOrder: {
        id: confirmedOrder.ChangeOrderID,
        slug: changeOrderSlug,
        endTagID: confirmedOrder.EndTagID,
        revision: `ChangeOrder:${confirmedOrder.ChangeOrderID}`,
        scopeSpaceIDs: [spaceID],
        subjects: [expectedSubject],
        command: changeOrderCommand,
      },
      beforeApproval: {
        result: "blocked",
        authority: "ChangeWorkflow.ReleasePrerequisite",
        command: refusalCommand,
        message: refusal.error,
      },
      approval: {
        attestationID: created.attestationID,
        type: "Approval",
        result: "Pass",
        changeOrderID: confirmedOrder.ChangeOrderID,
        subjects: [expectedSubject],
        expiresAt: active.expiresAt,
        command: approvalCommand,
        dryRunCommand,
      },
      releaseCommand,
    },
    release: {
      id: release.ReleaseID,
      number: release.ReleaseNum,
      unitCount: release.UnitCount,
      manifestDigest: release.ManifestDigest,
      bundleDigest: release.Digest,
      published: release.Published,
      revision: `ChangeOrder:${confirmedOrder.ChangeOrderID}`,
    },
  };
}

function assertReleaseWorkflow(workflow, spaceID) {
  const stage = workflow?.Stages?.find((entry) => entry.Name === "publication");
  const requirement = workflow?.AttestationPrerequisites?.find((entry) => entry.Name === "review");
  check(workflow?.ChangeWorkflowID && workflow.Stages?.length === 1
    && workflow.AttestationPrerequisites?.length === 1
    && stage?.WhereSpace === `SpaceID = '${spaceID}'`
    && stage.ReleasePrerequisites?.length === 1
    && stage.ReleasePrerequisites[0] === "review"
    && requirement?.Type === "Approval" && requirement.Count === 1
    && requirement.AllowAuthors === true && (requirement.IgnoreFail ?? false) === false,
  "stored ChangeWorkflow does not enforce the exact one-Approval release prerequisite");
}

function nativeApprovalSubjects(result, space, spaceID) {
  check(Array.isArray(result?.Spaces) && result.Spaces.length === 1,
    "variant approve did not select exactly one ChangeOrder Space");
  const row = result.Spaces[0];
  check(row.SpaceSlug === space && row.SpaceID === spaceID && !row.Error
    && Array.isArray(row.Subjects)
    && (!Object.hasOwn(row, "SkippedUnits") || row.SkippedUnits?.length === 0),
  "ChangeOrder approval selected another Space, reported an error, or skipped Units");
  return row.Subjects.map(({ UnitID, RevisionID, RevisionNum }) => ({ UnitID, RevisionID, RevisionNum }));
}

function assertExactSubject(subjects, expected) {
  check(Array.isArray(subjects) && subjects.length === 1
    && subjects[0].UnitID === expected.UnitID
    && subjects[0].RevisionID === expected.RevisionID
    && subjects[0].RevisionNum === expected.RevisionNum,
  "ChangeOrder Approval does not cover the exact reviewed Unit Revision");
}

function cleanupSpace(context, space, prior) {
  const exists = cubTry(context, ["space", "get", space, "-o", "json"]).ok;
  if (!exists) return prior === "pending" ? "fail" : "not-created";
  const deleted = cubTry(context, ["space", "delete", space, "--recursive-force", "--quiet"]);
  const absent = !cubTry(context, ["space", "get", space, "-o", "json"]).ok;
  return deleted.ok && absent ? "pass" : "fail";
}

function cleanupComponent(context, component, prior) {
  const exists = cubTry(context, ["component", "get", component, "-o", "json"]).ok;
  if (!exists) return prior === "pending" ? "fail" : "not-created";
  const deleted = cubTry(context, ["component", "delete", component, "--quiet"]);
  const absent = !cubTry(context, ["component", "get", component, "-o", "json"]).ok;
  return deleted.ok && absent ? "pass" : "fail";
}

function waitForPolicy(
  context,
  space,
  unit,
  {
    expectedGates = [],
    absentGates = [],
    expectedValidationKeys = [],
    absentValidationKeys = [],
  },
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = cubJson(
      context,
      ["unit", "get", unit, "--space", space, "-o", "json"],
    ).Unit;
    const waiting = current.ApplyGates?.["awaiting/triggers"] === true;
    const applyGates = current.ApplyGates ?? {};
    const validationKeys = Object.keys(current.ValidationResults ?? {});
    const expectedGatesPresent = expectedGates.every(
      (gate) => applyGates[gate] === true,
    );
    const absentGatesClear = absentGates.every(
      (gate) => applyGates[gate] !== true,
    );
    const expectedValidationPresent = expectedValidationKeys.every(
      (key) => validationKeys.includes(key),
    );
    const absentValidationClear = absentValidationKeys.every(
      (key) => !validationKeys.includes(key),
    );
    if (
      !waiting
      && expectedGatesPresent
      && absentGatesClear
      && expectedValidationPresent
      && absentValidationClear
    ) {
      return current;
    }
    execFileSync("sleep", ["1"]);
  }
  throw new Error(
    `${space}/${unit} did not reach the expected policy state within 60 seconds`,
  );
}

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls, and it comes back as text.
function storedData(context, unit) {
  const space = unit.SpaceSlug || unit.SpaceID;
  const text = cub(context, ["unit", "data", unit.UnitID ?? unit.Slug, "--space", space]);
  check(text, `${space}/${unit.Slug} has no stored data`);
  return text;
}

function verifyLocalReceipt(receipt) {
  check(receipt.kind === "AIChangeReviewReceipt", "local AI review receipt kind changed");
  check(
    receipt.spec?.proposal?.object === relativeRepo(proposalPath)
      && receipt.spec.proposal.sha256 === sha256(readFileSync(proposalPath, "utf8")),
    "local AI review no longer points at the unsafe proposal",
  );
  check(
    receipt.spec?.reviewed?.object === relativeRepo(reviewedPath),
    "local AI review no longer points at the reviewed candidate",
  );
  check(
    receipt.spec?.reviewed?.sha256 === sha256(readFileSync(reviewedPath, "utf8")),
    "local AI review candidate hash changed",
  );
  check(
    receipt.spec?.reviewed?.decision === "awaiting-human-approval",
    "local AI review decision changed",
  );
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "AIChangeReviewLiveProofReceipt",
    "live AI review receipt kind changed",
  );
  check(receipt.status?.result === "pass", "live AI review proof is not pass");
  check(
    receipt.spec?.context?.organization === expectedOrg,
    "live AI review organization changed",
  );
  check(
    receipt.spec?.source?.reviewedObject === relativeRepo(reviewedPath),
    "live AI review source path changed",
  );
  check(
    receipt.spec?.source?.unsafeProposal === relativeRepo(proposalPath)
      && receipt.spec.source.unsafeProposalSha256
        === sha256(readFileSync(proposalPath, "utf8")),
    "live AI review unsafe-proposal source changed",
  );
  check(
    receipt.spec?.source?.sha256 === sha256(readFileSync(reviewedPath, "utf8")),
    "live AI review source hash changed",
  );

  const stored = receipt.spec?.storedConfiguration;
  check(stored?.semanticMatch === true, "stored AICR object does not match the source");
  check(
    stored?.sourceSha256 === receipt.spec.source.sha256,
    "stored source hash changed",
  );
  check(
    stored?.contentHashBeforeApproval != null
      && stored.contentHashBeforeApproval === stored.contentHashAfterApproval,
    "approval changed the stored Unit content hash",
  );

  const policy = receipt.spec?.policy;
  check(policy?.profile === "catalog-standard", "policy profile changed");
  check(
    policy?.resourceClass === "system-configuration",
    "resource class changed",
  );
  check(policy?.approvalGate === approvalGate, "approval gate changed");
  check(
    sameSet(policy?.filter?.triggerRefs ?? [], legacyExpectedTriggers),
    "approval Trigger set changed",
  );
  check(
    policy?.applyGatesBeforeApproval?.includes(approvalGate),
    "approval gate was not recorded before approval",
  );
  check(
    !policy?.applyGatesAfterApproval?.includes(approvalGate),
    "approval gate remained after approval",
  );
  check(
    policy?.aicrChecks?.image?.validationKey === aicrImageWarning
      && policy.aicrChecks.image.effect === "warn"
      && policy.aicrChecks.image.unsafeProposalReported === true
      && policy.aicrChecks.image.reviewedCandidateReported === false,
    "AICR image check evidence changed",
  );
  check(
    policy?.aicrChecks?.apiKeySecret?.validationKey === aicrSecretGate
      && policy.aicrChecks.apiKeySecret.effect === "block"
      && policy.aicrChecks.apiKeySecret.unsafeProposalBlocked === true
      && policy.aicrChecks.apiKeySecret.reviewedCandidateBlocked === false,
    "AICR Secret check evidence changed",
  );
  check(
    sameSet(
      policy?.ordinaryWorkloadChecks?.validationKeys ?? [],
      genericWorkloadWarnings,
    )
      && policy.ordinaryWorkloadChecks.reportedForUnsafeProposal === false
      && policy.ordinaryWorkloadChecks.reportedForReviewedCandidate === false,
    "ordinary workload checks reported a false AICR finding",
  );

  const unsafeProposal = receipt.spec?.unsafeProposal;
  check(
    unsafeProposal?.unit === "unsafe-training-runtime"
      && unsafeProposal.validationKeys?.includes(aicrImageWarning)
      && unsafeProposal.applyGates?.includes(aicrSecretGate)
      && unsafeProposal.dryRun?.result === "blocked"
      && unsafeProposal.dryRun.gate === aicrSecretGate
      && unsafeProposal.dryRun.dryRun === true,
    "unsafe AICR proposal was not blocked by its source-aware check",
  );

  const before = receipt.spec?.beforeApproval;
  check(
    before?.result === "blocked"
      && before.gate === approvalGate
      && before.dryRun === true
      && before.exitCode !== 0,
    "pre-approval dry run did not prove the block",
  );

  const approval = receipt.spec?.approval;
  check(
    approval?.revisionSelector === "HeadRevisionNum"
      && Number.isInteger(approval.headRevisionBefore)
      && approval.headRevisionBefore > 0
      && Number.isInteger(approval.headRevisionAfter)
      && approval.headRevisionAfter >= approval.headRevisionBefore
      && approval.recordedApprovals >= 1
      && approval.approverIdentityRecordedInReceipt === false
      && approval.gateCleared === true,
    "approval record is incomplete",
  );

  const after = receipt.spec?.afterApproval;
  check(
    after?.result === "allowed"
      && after.dryRun === true
      && after.exitCode === 0,
    "post-approval dry run was not allowed",
  );
  check(
    typeof receipt.spec?.target?.ref === "string"
      && receipt.spec.target.ref.includes("/")
      && receipt.spec.target.provider === "OCI"
      && receipt.spec.target.dryRunOnly === true,
    "live AI review target changed",
  );
  check(receipt.spec?.cleanup?.space === "pass", "proof Space cleanup failed");

  const serialized = JSON.stringify(receipt);
  check(!serialized.includes("@confighub.com"), "receipt contains an approver identity");
  check(!serialized.includes("ch_"), "receipt contains a ConfigHub credential");
  check(
    !serialized.includes(["cub", "lk"].join("-"))
      && !serialized.includes(["cub", "lk"].join(" ")),
    "receipt contains an obsolete cluster command",
  );
}

function verifyCurrentReceipt(receipt) {
  check(receipt?.kind === "AIChangeReviewAttestationV1LiveProofReceipt"
    && receipt.status?.result === "pass"
    && receipt.spec?.context?.organization === expectedOrg,
  "current AI review receipt identity or result changed");
  check(receipt.spec?.source?.reviewedObject === relativeRepo(reviewedPath)
    && receipt.spec.source?.unsafeProposal === relativeRepo(proposalPath)
    && receipt.spec.source?.unsafeProposalSha256 === sha256(readFileSync(proposalPath, "utf8"))
    && receipt.spec.source?.sha256 === sha256(readFileSync(reviewedPath, "utf8")),
  "current AI review source paths or hashes changed");
  check(receipt.spec.source.localReviewReceipt === relativeRepo(localReceiptPath),
    "current AI review no longer names its local source-validation evidence");

  const policy = receipt.spec.policy;
const expectedSelectedRefs = expectedTriggers;
  check(policy?.profile === "catalog-standard"
    && policy.resourceClass === "system-configuration"
    && policy.retiredApprovalTriggerNotSelected === true
    && policy.filter?.attachment === "direct nonapproval Trigger selector"
    && policy.filter?.sourceFilter?.ref === approvalFilterRef
    && typeof policy.filter?.sourceFilter?.id === "string"
    && policy.filter.sourceFilter.id.length > 0
    && sameSet(policy.filter?.triggerRefs ?? [], expectedTriggers)
    && sameSet(policy.filter?.selectedTriggerRefs ?? [], expectedSelectedRefs)
    && policy.filter?.whereTrigger === nativeValidationWhere
    && sameSet(policy.filter?.excludedTriggerRefs ?? [], ["platform/require-approval"])
    && policy.filter?.selectedTriggerIds?.length === expectedTriggers.length
    && policy.filter?.excludedTriggerIds?.length === 0
    && !policy.validationGatesBeforeApproval?.includes(approvalGate),
  "current receipt confuses source validation with the retired approval Trigger");
  check(policy.aicrChecks?.image?.validationKey === aicrImageWarning
    && policy.aicrChecks.image.unsafeProposalReported === true
    && policy.aicrChecks.image.reviewedCandidateReported === false
    && policy.aicrChecks.apiKeySecret?.validationKey === aicrSecretGate
    && policy.aicrChecks.apiKeySecret.unsafeProposalBlocked === true
    && policy.aicrChecks.apiKeySecret.reviewedCandidateBlocked === false,
  "current receipt AICR source-validation observations changed");
  check(sameSet(policy.ordinaryWorkloadChecks?.validationKeys ?? [], genericWorkloadWarnings)
    && policy.ordinaryWorkloadChecks.reportedForUnsafeProposal === false
    && policy.ordinaryWorkloadChecks.reportedForReviewedCandidate === false,
  "current receipt reports an ordinary-workload finding for this AICR custom resource");

  const unsafe = receipt.spec.unsafeProposal;
  check(unsafe?.unit === "unsafe-training-runtime"
    && unsafe.space && unsafe.spaceId
    && unsafe.componentID === receipt.spec.component?.id
    && unsafe.space !== receipt.spec.storedConfiguration?.space
    && unsafe.spaceId !== receipt.spec.storedConfiguration?.spaceId
    && unsafe.validationKeys?.includes(aicrImageWarning)
    && unsafe.validationGates?.includes(aicrSecretGate)
    && unsafe.validationGates?.includes(placeholderGate)
    && unsafe.published === false,
  "unsafe AICR proposal validation or non-publication evidence changed");
  const stored = receipt.spec.storedConfiguration;
  check(stored?.space && stored.spaceId && stored.unit === "reviewed-training-runtime"
    && stored.componentID === receipt.spec.component?.id
    && stored.unitId && stored.semanticMatch === true
    && stored.contentHashBeforeApproval === stored.contentHashAfterApproval
    && stored.sourceSha256 === receipt.spec.source.sha256,
  "current reviewed configuration identity or content check changed");
  const validation = receipt.spec.validation;
  check(validation?.spaceId === stored.spaceId
    && validation.unitId === stored.unitId
    && Number.isInteger(validation.revisionNum) && validation.revisionNum > 0
    && typeof validation.revisionId === "string" && validation.revisionId.length > 0
    && validation.dataHash === stored.contentHashBeforeApproval,
  "source validation evidence is not bound to the reviewed revision");

  const proof = receipt.spec.approvalProof;
  check(proof?.model === "server-attested-changeworkflow-changeorder-v1"
    && proof.space?.slug === stored.space && proof.space.id === stored.spaceId
    && proof.space.componentID === receipt.spec.component?.id
    && receipt.spec.component?.slug === proof.space.slug.replace(/-(?:unsafe|reviewed)$/, ""),
  "current Approval proof Component identity changed");
  check(proof.workflow?.id && proof.workflow.stage === "publication"
    && proof.workflow.slug
    && proof.changeOrder?.id && proof.changeOrder.endTagID
    && proof.changeOrder.revision === `ChangeOrder:${proof.changeOrder.id}`
    && proof.changeOrder.scopeSpaceIDs?.length === 1
    && proof.changeOrder.scopeSpaceIDs[0] === stored.spaceId,
  "current Approval proof is missing its workflow or exact ChangeOrder binding");
  assertExactSubject(proof.changeOrder.subjects, {
    UnitID: stored.unitId,
    RevisionID: validation.revisionId,
    RevisionNum: validation.revisionNum,
  });
  assertExactSubject(proof.approval?.subjects, proof.changeOrder.subjects[0]);
  check(proof.approval?.attestationID && proof.approval.type === "Approval"
    && proof.approval.result === "Pass"
    && proof.approval.changeOrderID === proof.changeOrder.id
    && proof.beforeApproval?.result === "blocked"
    && proof.beforeApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
    && /requires review: 1 Approval attestation\(s\)/.test(proof.beforeApproval.message ?? ""),
  "native workflow refusal or exact Approval attestation evidence changed");
  check(JSON.stringify(proof.workflow.command) === JSON.stringify([
    "cub", "changeworkflow", "create", "--space", stored.space,
    proof.workflow.slug, "--from-stdin", "--quiet",
  ]) && JSON.stringify(proof.changeOrder.command) === JSON.stringify([
    "cub", "changeorder", "create", "--space", stored.space,
    proof.changeOrder.slug, "--component", proof.space.componentID,
    "--in-scope-space", stored.spaceId,
    "--change-workflow", `${stored.space}/${proof.workflow.slug}`, "--quiet",
  ]), "receipt does not retain the actual workflow and exact-scope ChangeOrder commands");
  const expectedApprove = ["cub", "variant", "approve", stored.space,
    "--change-order", proof.changeOrder.id, "--stage", "publication", "--all"];
  check(JSON.stringify(proof.approval.command) === JSON.stringify([...expectedApprove, "-o", "json"])
    && JSON.stringify(proof.approval.dryRunCommand)
      === JSON.stringify([...expectedApprove, "--dry-run", "-o", "json"])
    && JSON.stringify(proof.beforeApproval.command) === JSON.stringify([
      "cub", "release", "publish", "--revision", proof.changeOrder.revision,
      stored.space, "-o", "json",
    ]), "receipt does not retain actual dry-run, Approval, and pre-approval release commands");

  const release = receipt.spec.release;
  check(release?.unitCount === 1 && release.published === true
    && release.revision === proof.changeOrder.revision
    && /^sha256:[0-9a-f]{64}$/.test(release.manifestDigest ?? "")
    && release.id,
  "published Release is not bound to the reviewed ChangeOrder boundary");
  check(JSON.stringify(proof.releaseCommand) === JSON.stringify([
    "cub", "release", "publish", "--revision", proof.changeOrder.revision,
    stored.space, "-o", "json",
  ]), "receipt Release command does not use the immutable ChangeOrder boundary");
  check(receipt.spec.target?.provider === "OCI"
    && receipt.spec.target.releaseTargetAssigned === true
    && receipt.spec.target.releasePublishOnly === true
    && receipt.spec.release.manifestDigest,
  "current proof does not bind the OCI Release target");
  check(receipt.spec.cleanup?.proposalSpace === "pass"
    && receipt.spec.cleanup?.reviewedSpace === "pass"
    && receipt.spec.cleanup?.component === "pass",
  "current proof Component and Spaces were not all cleaned up");
  check(!/ApprovedBy|ApplyGates|unit approve|unit apply|vet-approvedby/.test(JSON.stringify(proof)),
    "current Approval proof contains retired Unit approval or Trigger evidence");
  check(!JSON.stringify(receipt).includes("@confighub.com")
    && !JSON.stringify(receipt).includes("ch_"),
  "current receipt contains an approver identity or ConfigHub credential");
}

function renderCurrentSummary(receipt) {
  const { unsafeProposal, storedConfiguration: stored, approvalProof, release } = receipt.spec;
  return `# Check an AICR training change before it is released

ConfigHub's source-validation Triggers reported the unsafe proposal's mutable
image and blocked its inline API key. The unsafe proposal stayed in its own
temporary Space. The reviewed four-node object, with a pinned image and Secret
reference, was stored unchanged in a separate Space.

The old \`vet-approvedby\` approval Trigger was excluded from both Spaces. A
ChangeWorkflow release prerequisite blocked publication of the reviewed
ChangeOrder until ConfigHub recorded a passing Approval attestation for its
exact Unit revision. The workflow permits the same authenticated operator to
record that attestation, so this receipt does not prove independent reviewer
separation.

| Check | Result |
| --- | --- |
| Unsafe proposal image and Secret checks | Reported and blocked |
| Reviewed object stored unchanged | ${stored.semanticMatch ? "Pass" : "Fail"} |
| Pre-approval ChangeOrder Release | Blocked by the Approval prerequisite |
| Approved subject | Unit \`${stored.unitId}\`, revision \`${approvalProof.approval.subjects[0].RevisionNum}\` |
| Published Release | \`${release.manifestDigest}\` |
| Unsafe proposal published | ${unsafeProposal.published ? "Yes" : "No"} |
| Kubernetes apply or cluster observation | Not run |
| Temporary Component and Spaces removed | ${receipt.spec.cleanup.proposalSpace === "pass" && receipt.spec.cleanup.reviewedSpace === "pass" && receipt.spec.cleanup.component === "pass" ? "Yes" : "No"} |

The Release is an OCI artifact, not proof of Kubernetes delivery or runtime
health. The referenced training Secret was not read, and the target-capacity
check remains repository evidence rather than a ConfigHub Function.

- [Unsafe AICR proposal](../ai-change-review/proposal.yaml)
- [Reviewed AICR object](../ai-change-review/reviewed.yaml)
- [Local target-capacity check](../ai-change-review/summary.md)
- [Current live receipt](../../runs/ai-change-review-live-proof-attestation-v1/receipt.yaml)
- [Catalog policy](../../config-catalog/policies/catalog-standard.yaml)
`;
}

function selfTestCurrentCallgraph() {
  const versionOutput = (client, server) => `Client Version:\n  Version: ${client}\nServer Version:\n  Version: ${server}`;
  check(isReviewedVersionPair(versionOutput("v0.6.2", "v0.6.2")), "reviewed version pair rejected");
  for (const version of ["v0.5.1", "v0.5.7", "v0.6.3"]) {
    check(!isReviewedVersionPair(versionOutput(version, "v0.6.2")), "unreviewed client admitted");
    check(!isReviewedVersionPair(versionOutput("v0.6.2", version)), "unreviewed server admitted");
  }
  check(!isReviewedVersionPair("Client Version: v0.6.2"), "missing server version admitted");
  check(!isReviewedVersionPair("Client Version:\nServer Version:\n  Version: v0.6.2"), "server version substituted for missing client");
  const original = cubExecutor;
  const reviewed = {
    UnitID: "reviewed-unit-id",
    Slug: "reviewed-training-runtime",
    SpaceID: "reviewed-space-id",
    HeadRevisionNum: 17,
    DataHash: "reviewed-data-hash",
  };
  const revision = {
    RevisionID: "reviewed-revision-id",
    UnitID: reviewed.UnitID,
    RevisionNum: reviewed.HeadRevisionNum,
    DataHash: reviewed.DataHash,
  };
  const scenario = (kind = "success") => {
    const state = { approved: false, published: false, workflow: null, order: null };
    const subject = {
      UnitID: reviewed.UnitID,
      RevisionID: revision.RevisionID,
      RevisionNum: revision.RevisionNum,
    };
    const attestation = {
      AttestationID: "fake-approval-id",
      SpaceID: reviewed.SpaceID,
      Type: "Approval",
      Result: "Pass",
      ChangeOrderID: "fake-changeorder-id",
    };
    const ok = (value = "") => ({
      ok: true,
      output: typeof value === "string" ? value : JSON.stringify(value),
      error: "",
    });
    cubExecutor = (args, input) => {
      if (args[0] === "changeworkflow" && args[1] === "create") {
        check(args.includes("--from-stdin") && input, "fake workflow create missed its input document");
        state.workflow = { ...JSON.parse(input), ChangeWorkflowID: "fake-workflow-id" };
        return ok();
      }
      if (args[0] === "changeworkflow" && args[1] === "get") return ok({ ChangeWorkflow: state.workflow });
      if (args[0] === "changeorder" && args[1] === "create") {
        check(args.includes("--in-scope-space") && args.includes("reviewed-space-id"),
          "fake ChangeOrder did not preserve exact reviewed Space scope");
        check(args.includes("--component") && args.includes("fake-component-id"),
          "fake ChangeOrder did not preserve the temporary Component identity");
        state.order = {
          ChangeOrderID: "fake-changeorder-id",
          EndTagID: "fake-end-tag-id",
          ChangeWorkflowID: state.workflow.ChangeWorkflowID,
          ComponentID: "fake-component-id",
          InScopeSpaceIDs: ["reviewed-space-id"],
        };
        return ok();
      }
      if (args[0] === "changeorder" && args[1] === "get") return ok({ ChangeOrder: state.order });
      if (args[0] === "variant" && args[1] === "approve") {
        check(args.includes(state.order.ChangeOrderID), "fake approval omitted immutable CO ID");
        const selectedSubject = kind === "wrongrevision"
          ? { ...subject, RevisionNum: subject.RevisionNum + 1 }
          : subject;
        const row = { SpaceSlug: "reviewed-space", SpaceID: "reviewed-space-id", Subjects: [selectedSubject] };
        if (args.includes("--dry-run")) return ok({ Spaces: [row] });
        state.approved = true;
        if (kind === "malformedpartial") return ok({ Spaces: [{ ...row, Subjects: [], Attestation: attestation }] });
        return ok({ Spaces: [{ ...row, Attestation: attestation }] });
      }
      if (args[0] === "release" && args[1] === "publish") {
        check(args.includes("ChangeOrder:fake-changeorder-id"),
          "fake release command was not bound to the immutable CO ID");
        if (!state.approved) {
          return { ok: false, output: "", error: kind === "unrelatedfailure"
            ? "permission denied for release" : "requires review: 1 Approval attestation(s)" };
        }
        state.published = true;
        return ok({ Release: {
          ReleaseID: "fake-release-id", ReleaseNum: 1, UnitCount: 1,
          ManifestDigest: `sha256:${"a".repeat(64)}`, Digest: `sha256:${"b".repeat(64)}`, Published: true,
        } });
      }
      if (args[0] === "attestation" && args[1] === "list") return ok([attestation]);
      if (args[0] === "attestation" && args[1] === "get") return ok({ Attestation: attestation });
      if (args[0] === "revision" && args[1] === "get") {
        return ok({ Revision: { ...revision, Attestations: { [attestation.AttestationID]: "native map value ignored" } } });
      }
      throw new Error(`unexpected fake current-path cub call: ${args.join(" ")}`);
    };
    return { state, subject };
  };
  try {
    const happy = scenario();
    const result = createNativeReleaseBoundary({
      context: "fake-context",
      space: "reviewed-space",
      spaceID: "reviewed-space-id",
      componentID: "fake-component-id",
      unit: reviewed,
      revision,
      workflowSlug: "fake-workflow",
      changeOrderSlug: "fake-changeorder",
    });
    check(result.release.unitCount === 1 && happy.state.published
      && result.proof.approval.attestationID === "fake-approval-id",
    "fake current ChangeWorkflow/ChangeOrder callgraph did not complete exact reviewed publication");

    const assertRefused = (kind, message) => {
      const { state } = scenario(kind);
      let refused = false;
      try {
        createNativeReleaseBoundary({
          context: "fake-context",
          space: "reviewed-space",
          spaceID: "reviewed-space-id",
          componentID: "fake-component-id",
          unit: reviewed,
          revision,
          workflowSlug: `fake-${kind}-workflow`,
          changeOrderSlug: `fake-${kind}-changeorder`,
        });
      } catch { refused = true; }
      check(refused && !state.published, message);
    };
    assertRefused("wrongrevision", "wrong ChangeOrder revision was accepted or published");
    assertRefused("unrelatedfailure", "an unrelated release error was treated as prerequisite refusal");
    assertRefused("malformedpartial", "a partial/malformed Approval result was accepted or published");
    console.log("current fake callgraph passed: exact one-Unit ChangeOrder Release and wrong-revision, unrelated-failure, malformed-approval refusals");
  } finally {
    cubExecutor = original;
  }
}

function renderSummary(receipt) {
  const stored = receipt.spec.storedConfiguration;
  const approval = receipt.spec.approval;
  return `# Check an AICR training change before it is released

This example sends two versions of the same AICR PyTorch
\`ClusterTrainingRuntime\` through ConfigHub. The first version asks for eight H100
nodes, changes a digest-pinned image to \`latest\`, and puts a placeholder API key
directly in the object. ConfigHub reports the mutable AICR image and blocks the
inline API key. It does not run Deployment image or probe checks against this custom
resource.

The reviewed version uses four nodes, restores the pinned image, and refers to an
existing Secret. Its AICR image and API-key checks are clear. The four-node capacity
limit is checked separately against the recorded target facts because the current
ConfigHub policy cannot read that target-specific value.

Both versions were uploaded to a temporary Space in the \`helm-catalog\` ConfigHub
organization. ConfigHub stored the reviewed Kubernetes fields without changing
them. Because this is cluster-wide system configuration, ConfigHub blocked the
reviewed version until its exact revision was approved. After approval, the same
dry run against the recorded OCI target was allowed.

| Check | Result |
| --- | --- |
| Mutable image in the unsafe AICR proposal | Reported |
| Inline API key in the unsafe AICR proposal | Blocked |
| Deployment image or probe warnings on either AICR object | None |
| AICR image and API-key findings on the reviewed object | None |
| Reviewed object stored without field changes | ${stored.semanticMatch ? "Pass" : "Fail"} |
| Content hash changed during approval | ${stored.contentHashBeforeApproval === stored.contentHashAfterApproval ? "No" : "Yes"} |
| Dry run before approval | Blocked |
| Revision selector | \`${approval.revisionSelector}\` |
| Recorded approvals | ${approval.recordedApprovals} |
| Dry run after approval | Allowed |
| Kubernetes apply | Not run |
| Temporary Space removed | ${receipt.spec.cleanup.space === "pass" ? "Yes" : "No"} |

All apply attempts used \`--dry-run\` against an OCI target. This run did not publish
a release, read the referenced Secret, start a GPU workload, promote the change,
roll it back, or observe a cluster.

- [Unsafe AICR proposal](../ai-change-review/proposal.yaml)
- [Reviewed AICR object](../ai-change-review/reviewed.yaml)
- [Local target-capacity check](../ai-change-review/summary.md)
- [Committed live receipt](../../runs/ai-change-review-live-proof/receipt.yaml)
- [Catalog policy](../../config-catalog/policies/catalog-standard.yaml)
`;
}

function getByRef(context, entity, ref) {
  const [space, slug] = ref.split("/");
  return cubJson(context, [entity, "get", "--space", space, slug, "-o", "json"]);
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function safeRunId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

function isReviewedVersionPair(output) {
  const client = output.split("Server Version:")[0].match(/Client Version:[\s\S]*?\bVersion:\s*v?(\d+)\.(\d+)\.(\d+)(?=\s|$)/);
  const server = output.match(/Server Version:[\s\S]*?\bVersion:\s*v?(\d+)\.(\d+)\.(\d+)(?=\s|$)/);
  return [client, server].every((match) => match && match.slice(1).join(".") === "0.6.2");
}

function cub(context, args, options = {}) {
  const result = cubExecutor(args, options.input, cubEnv(context));
  check(result.ok, `cub ${args.slice(0, 6).join(" ")} failed: ${result.error}`);
  return result.output;
}

function cubTry(context, args) {
  const result = cubExecutor(args, undefined, cubEnv(context));
  return {
    ok: result.ok,
    output: result.output,
    error: result.error || result.output.trim() || "cub command failed",
  };
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
}

function runCub(args, input, env = process.env) {
  const result = spawnSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
    maxBuffer: 1024 * 1024 * 100,
    timeout: 300_000,
    stdio: ["pipe", "pipe", "pipe"],
    input: input ?? undefined,
  });
  const output = result.stdout ?? "";
  return {
    ok: result.status === 0,
    output,
    error: `${output}${result.stderr ?? ""}`.trim() || result.error?.message || "",
  };
}

function spawnCub(context, args) {
  return spawnSync("cub", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(context),
    maxBuffer: 1024 * 1024 * 100,
  });
}

function cubEnv(context) {
  return {
    ...process.env,
    CONFIGHUB_AGENT: "1",
    CUB_CONTEXT: context,
  };
}

function jsonCommand(file, args, options = {}) {
  return JSON.parse(command(file, args, options));
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
      status: error.status ?? 1,
    };
  }
}
