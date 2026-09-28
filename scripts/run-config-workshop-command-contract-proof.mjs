#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  cubEnv,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import { observeApprovalAttestations } from "./lib/revision-approval-observation.mjs";
import { scannerObjectSetIdentity } from "./lib/config-workshop-result.mjs";

const mode = process.argv[2] ?? "--verify";
const modes = new Set(["--run", "--verify", "--legacy-verify", "--hub-verify", "--attestation-verify", "--attestation-hub-verify", "--self-test"]);
if (!modes.has(mode)) {
  console.error("Usage: node scripts/run-config-workshop-command-contract-proof.mjs --run|--verify|--legacy-verify|--hub-verify|--attestation-verify|--attestation-hub-verify|--self-test");
  process.exit(2);
}

const baseSpace = "workshop-contract-nginx-base";
const stagingSpace = "workshop-contract-nginx-staging";
const unitSlug = "workshop-contract-nginx";
const changeSetSlug = "reviewed-four-replica-promotion";
const annotationKey = "workshop.confighub.com/object-set-sha256";
const baseCandidatePath = join(repoRoot, "data", "byo-helm-values-review", "reviewed-render.yaml");
const candidatePath = join(repoRoot, "data", "config-workshop-command-contract", "helm", "promoted-candidate.yaml");
const baseResultPath = join(repoRoot, "data", "config-workshop-command-contract", "helm", "workshop-result.json");
const promotedResultPath = join(repoRoot, "data", "config-workshop-command-contract", "helm", "promoted-workshop-result.json");
const promotionReviewPath = join(repoRoot, "data", "config-workshop-command-contract", "helm", "promotion-review.json");
const receiptPath = join(repoRoot, "runs", "config-workshop-command-contract", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "config-workshop-command-contract", "live-promotion.md");
const attestationReceiptPath = join(repoRoot, "runs", "config-workshop-command-contract", "receipt-attestation-v1.yaml");
const attestationSummaryPath = join(repoRoot, "data", "config-workshop-command-contract", "live-promotion-attestation-v1.md");

if (mode === "--run") {
  check(
    process.env.HELM_EXPT_ALLOW_WORKSHOP_COMMAND_CONTRACT_RUN === "1",
    "set HELM_EXPT_ALLOW_WORKSHOP_COMMAND_CONTRACT_RUN=1 before changing the live helm-catalog organization",
  );
  verifyContext();
  const receipt = runProof();
  writeYaml(attestationReceiptPath, receipt);
  write(attestationSummaryPath, renderSummary(receipt));
  verifyReceipt(receipt, { requireCurrentApproval: true });
  verifyLive(receipt);
  console.log(`wrote ${relativeRepo(attestationReceiptPath)} and ${relativeRepo(attestationSummaryPath)}`);
} else if (mode === "--hub-verify") {
  verifyContext();
  const receipt = readYaml(receiptPath);
  verifyLegacyReceipt(receipt);
  verifyLive(receipt);
  console.log("verified the retained legacy Config Workshop command-contract receipt");
} else if (mode === "--attestation-hub-verify") {
  verifyContext();
  const receipt = readYaml(attestationReceiptPath);
  verifyReceipt(receipt, { requireCurrentApproval: true });
  verifyLive(receipt);
  console.log("verified the current Space-attestation Config Workshop command-contract receipt");
} else if (mode === "--attestation-verify") {
  check(existsSync(attestationReceiptPath), `${relativeRepo(attestationReceiptPath)} is missing; run the live proof`);
  check(existsSync(attestationSummaryPath), `${relativeRepo(attestationSummaryPath)} is missing; run the live proof`);
  const receipt = readYaml(attestationReceiptPath);
  verifyReceipt(receipt, { requireCurrentApproval: true });
  check(readFileSync(attestationSummaryPath, "utf8") === renderSummary(receipt), `${relativeRepo(attestationSummaryPath)} is stale`);
  console.log("verified the current Space-attestation Config Workshop receipt");
} else if (mode === "--self-test") {
  const receipt = readYaml(receiptPath);
  const fake = structuredClone(receipt);
  fake.spec.promotion.candidateObjectSetSha256 = `sha256:${"0".repeat(64)}`;
  let rejected = false;
  try {
    verifyReceipt(fake);
  } catch (error) {
    rejected = String(error.message).includes("candidate object-set hash");
  }
  check(rejected, "self-test: a promotion bound to the wrong object set must be rejected");
  const currentReceipt = structuredClone(receipt);
  currentReceipt.spec.approvalModel = "space-attestation-v1";
  const currentUnitID = currentReceipt.spec.promotion.destination.unitId;
  const currentRevision = currentReceipt.spec.promotion.approvedRevision;
  currentReceipt.spec.promotion.approvalAttestation = {
    command: `cub variant approve ${stagingSpace} --all --where "UnitID = '${currentUnitID}'" --revision ${currentRevision} -o json`,
    attestationID: "attestation-1",
    type: "Approval",
    result: "Pass",
    subject: { unitID: currentUnitID, revisionNum: currentRevision },
    workflowEnforcement: "not-configured",
  };
  verifyReceipt(currentReceipt, { requireCurrentApproval: true });
  const missingCurrentApproval = structuredClone(currentReceipt);
  delete missingCurrentApproval.spec.promotion.approvalAttestation;
  let missingCurrentRejected = false;
  try {
    verifyReceipt(missingCurrentApproval, { requireCurrentApproval: true });
  } catch (error) {
    missingCurrentRejected = String(error.message).includes("approval proof");
  }
  check(missingCurrentRejected, "self-test: a current receipt without its Approval attestation was accepted");
  const mismatchedCurrent = structuredClone(currentReceipt);
  mismatchedCurrent.spec.promotion.approvalAttestation.subject.revisionNum += 1;
  let approvalMismatchRejected = false;
  try {
    verifyReceipt(mismatchedCurrent);
  } catch (error) {
    approvalMismatchRejected = String(error.message).includes("approval command");
  }
  check(approvalMismatchRejected, "self-test: a command/subject revision mismatch was accepted");
  const validApproval = {
    Spaces: [{
      SpaceSlug: stagingSpace,
      Attestation: { AttestationID: "attestation-1", Type: "Approval", Result: "Pass" },
      Subjects: [{ UnitID: "unit-1", RevisionNum: 7 }],
      SkippedUnits: [],
    }],
  };
  check(
    assertApprovalAttestation(validApproval, { space: stagingSpace, unitID: "unit-1", revisionNum: 7 }).attestationID === "attestation-1",
    "self-test: exact Space Approval attestation was not accepted",
  );
  for (const [label, altered] of [
    ["missing attestation", { Spaces: [{ ...validApproval.Spaces[0], Attestation: null }] }],
    ["wrong UnitID", { Spaces: [{ ...validApproval.Spaces[0], Subjects: [{ UnitID: "other-unit", RevisionNum: 7 }] }] }],
    ["wrong revision", { Spaces: [{ ...validApproval.Spaces[0], Subjects: [{ UnitID: "unit-1", RevisionNum: 8 }] }] }],
  ]) {
    let refused = false;
    try {
      assertApprovalAttestation(altered, { space: stagingSpace, unitID: "unit-1", revisionNum: 7 });
    } catch {
      refused = true;
    }
    check(refused, `self-test: ${label} was accepted`);
  }
  console.log("verified command-contract live proof rejects a mismatched promotion identity");
} else if (mode === "--verify" || mode === "--legacy-verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the live proof`);
  const receipt = readYaml(receiptPath);
  verifyLegacyReceipt(receipt);
  check(readFileSync(summaryPath, "utf8") === renderSummary(receipt), `${relativeRepo(summaryPath)} is stale`);
  console.log("verified the retained legacy Config Workshop command-contract receipt");
}

function runProof() {
  const tempRoot = mkdtempSync(join(tmpdir(), "workshop-command-contract-"));
  const uploadPath = join(tempRoot, "candidate.yaml");
  try {
    deleteSpaceIfPresent(stagingSpace);
    deleteSpaceIfPresent(baseSpace);

    const baseResult = JSON.parse(readFileSync(baseResultPath, "utf8"));
    const promotedResult = JSON.parse(readFileSync(promotedResultPath, "utf8"));
    const promotionReview = JSON.parse(readFileSync(promotionReviewPath, "utf8"));
    const baseHash = baseResult.spec.candidate.objectSet.sha256;
    const candidateHash = promotedResult.spec.candidate.objectSet.sha256;
    check(promotionReview.spec.candidate.objectSetSha256 === candidateHash, "promotion review and candidate result differ");

    writeFileSync(uploadPath, readFileSync(baseCandidatePath));
    cub([
      "variant", "upload",
      "--component", "workshop-contract-nginx",
      "--variant", "base",
      "--space", baseSpace,
      "--granularity", "minimal",
      "--environment", "Development",
      "--stage", "Development",
      "--annotation", `${annotationKey}=${baseHash}`,
      "--change-desc", "Retain the reviewed three-replica NGINX result",
      uploadPath,
    ]);
    const baseBefore = getUnit(baseSpace);
    check(storedObjectIdentity(baseSpace).sha256 === baseHash, "ConfigHub base does not match the reviewed object set");
    check(baseBefore.Annotations?.[annotationKey] === baseHash, "ConfigHub base lacks its accepted object-set annotation");

    cub([
      "variant", "create", "staging", baseSpace,
      "--environment", "Staging",
      "--stage", "Staging",
      "--space-pattern", `template:${stagingSpace}`,
      "--unit-annotation", `${annotationKey}=${baseHash}`,
      "--wait",
      "-o", "json",
    ]);
    const stagingBefore = getUnit(stagingSpace);
    check(storedObjectIdentity(stagingSpace).sha256 === baseHash, "staging did not start from the reviewed base");

    writeFileSync(uploadPath, readFileSync(candidatePath));
    cub([
      "variant", "upload",
      "--component", "workshop-contract-nginx",
      "--variant", "base",
      "--space", baseSpace,
      "--granularity", "minimal",
      "--environment", "Development",
      "--stage", "Development",
      "--annotation", `${annotationKey}=${candidateHash}`,
      "--change-desc", "Accept four replicas and bound temporary storage",
      uploadPath,
    ]);
    cub([
      "unit", "update", unitSlug,
      "--space", baseSpace,
      "--annotation", `${annotationKey}=${candidateHash}`,
      "--change-desc", "Bind the accepted candidate to its canonical object-set hash",
      "-o", "json",
    ]);
    const baseAfter = getUnit(baseSpace);
    check(storedObjectIdentity(baseSpace).sha256 === candidateHash, "ConfigHub base update does not match the promotion candidate");
    check(baseAfter.Annotations?.[annotationKey] === candidateHash, "updated ConfigHub base lacks the candidate object-set annotation");

    cub([
      "changeset", "create", changeSetSlug,
      "--space", stagingSpace,
      "--description", "Promote the exact reviewed NGINX candidate",
      "--annotation", `${annotationKey}=${candidateHash}`,
      "-o", "json",
    ]);
    const previewOutput = cub([
      "variant", "promote", stagingSpace,
      "--dry-run", "-o", "mutations",
    ]).trim();
    const previewSummary = summarizePreview(previewOutput);
    const stagingAfterPreview = getUnit(stagingSpace);
    check(stagingAfterPreview.DataHash === stagingBefore.DataHash, "promotion preview changed stored data");
    check(stagingAfterPreview.HeadRevisionNum === stagingBefore.HeadRevisionNum, "promotion preview changed revision history");

    cub([
      "variant", "promote", stagingSpace,
      "--changeset", changeSetSlug,
      "--change-desc", "Promote the exact reviewed four-replica NGINX result",
      "-o", "json",
    ]);
    cub([
      "unit", "update", unitSlug,
      "--space", stagingSpace,
      "--annotation", `${annotationKey}=${candidateHash}`,
      "--change-desc", "Bind the promoted result to its canonical object-set hash",
      "-o", "json",
    ]);
    const reviewedUnit = getUnit(stagingSpace);
    const reviewedRevision = reviewedUnit.HeadRevisionNum;
    check(Number.isSafeInteger(reviewedRevision) && reviewedRevision > 0, "staging Unit has no numeric head revision to approve");
    check(typeof reviewedUnit.UnitID === "string" && reviewedUnit.UnitID.length > 0 && !/[\r\n']/u.test(reviewedUnit.UnitID), "staging Unit has no safe UnitID for exact approval selection");
    const approvalCommand = [
      "variant", "approve", stagingSpace,
      "--all",
      "--where", `UnitID = '${reviewedUnit.UnitID}'`,
      "--revision", String(reviewedRevision),
      "-o", "json",
    ];
    const approvalResult = JSON.parse(cub(approvalCommand));
    const approval = assertApprovalAttestation(approvalResult, {
      space: stagingSpace,
      unitID: reviewedUnit.UnitID,
      revisionNum: reviewedRevision,
    });

    const stagingAfter = getUnit(stagingSpace);
    check(stagingAfter.UnitID === reviewedUnit.UnitID, "staging Unit identity changed during approval");
    check(stagingAfter.HeadRevisionNum === reviewedRevision, "staging Unit revision changed during approval");
    const changeSet = getChangeSet(stagingSpace, changeSetSlug);
    const storedIdentity = storedObjectIdentity(stagingSpace);
    check(storedIdentity.sha256 === candidateHash, "promoted ConfigHub result does not match the accepted candidate");
    check(stagingAfter.Annotations?.[annotationKey] === candidateHash, "promoted ConfigHub result lacks its candidate annotation");
    check(changeSet.Annotations?.[annotationKey] === candidateHash, "promotion ChangeSet lacks its candidate annotation");

    return {
      apiVersion: "workshop.confighub.com/v1alpha1",
      kind: "WorkshopCommandContractLiveReceipt",
      metadata: { name: "nginx-reviewed-base-to-staging" },
      spec: {
        capturedAt: new Date().toISOString(),
        approvalModel: "space-attestation-v1",
        context: { name: "river-bear", organization: "helm-catalog" },
        source: {
          baseWorkshopResult: relativeRepo(baseResultPath),
          promotedWorkshopResult: relativeRepo(promotedResultPath),
          promotionReview: relativeRepo(promotionReviewPath),
          currentObjectSetSha256: baseHash,
          candidateObjectSetSha256: candidateHash,
        },
        retention: unitRecord(baseSpace, baseBefore, baseHash),
        candidate: unitRecord(baseSpace, baseAfter, candidateHash),
        preview: {
          command: `cub variant promote ${stagingSpace} --dry-run -o mutations`,
          summary: previewSummary.text,
          includesStorageOnlyCommentChange: previewSummary.includesStorageOnlyCommentChange,
          storedDataUnchanged: true,
          revisionUnchanged: true,
        },
        promotion: {
          command: `cub variant promote ${stagingSpace} --changeset ${changeSetSlug}`,
          destination: unitRecord(stagingSpace, stagingAfter, candidateHash),
          changeSet: {
            slug: changeSet.Slug,
            id: changeSet.ChangeSetID,
            candidateObjectSetSha256: changeSet.Annotations[annotationKey],
          },
          candidateObjectSetSha256: candidateHash,
          approvedRevision: stagingAfter.HeadRevisionNum,
          approvalAttestation: {
            command: `cub variant approve ${stagingSpace} --all --where "UnitID = '${reviewedUnit.UnitID}'" --revision ${reviewedRevision} -o json`,
            attestationID: approval.attestationID,
            type: approval.type,
            result: approval.result,
            subject: approval.subject,
            workflowEnforcement: "not-configured",
          },
        },
        identities: {
          algorithm: "cub-scan-canonical-json-v1",
          ConfigHubDataHashRole: "ConfigHub storage identity",
          objectSetHashRole: "accepted Kubernetes object identity",
          resourceView: `cub k8s get all --space ${stagingSpace} --show data -o json`,
          resourceViewRole: "ConfigHub's Kubernetes resource view omits storage-only comment-preservation data before the object-set hash is calculated.",
        },
        checks: {
          localCandidate: "pass",
          retainedObjectSet: "pass",
          previewNonMutating: "pass",
          promotedObjectSet: "pass",
          changeRecordBoundToCandidate: "pass",
          revisionApproval: "pass",
          destinationSecret: "not-run",
          releaseOci: "not-run",
          delivery: "not-run",
          liveObservation: "not-run",
        },
      },
      status: {
        result: "pass",
        claim: "The exact locally checked candidate was retained in ConfigHub, named on the promotion ChangeSet, promoted to staging, and covered by a Space-level Approval attestation without losing its canonical object-set identity.",
        limits: [
          "This receipt stops before release publication, delivery, and live observation.",
          "The required staging Secret was not checked in this run.",
          previewSummary.includesStorageOnlyCommentChange
            ? "The preview also reported a storage-only source-comment change; the canonical Kubernetes object comparison excludes that metadata."
            : "The promotion preview reported only Kubernetes object changes.",
          "Local cub check evidence and the ConfigHub Approval attestation remain separate records.",
          "No ChangeWorkflow or release prerequisite was configured here; recording the attestation does not enforce approval on promotion or publication.",
        ],
      },
    };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function verifyLegacyReceipt(receipt) {
  check(receipt.spec?.approvalModel === undefined && receipt.spec?.promotion?.approvalAttestation === undefined, "legacy verifier refuses a current Space-attestation receipt");
  verifyReceipt(receipt);
}

function verifyReceipt(receipt, { requireCurrentApproval = false } = {}) {
  check(receipt.kind === "WorkshopCommandContractLiveReceipt", "command-contract receipt kind changed");
  check(receipt.status?.result === "pass", "command-contract live receipt is not pass");
  const currentHash = receipt.spec?.source?.currentObjectSetSha256;
  const candidateHash = receipt.spec?.source?.candidateObjectSetSha256;
  check(/^sha256:[0-9a-f]{64}$/.test(currentHash ?? ""), "current object-set hash is invalid");
  check(/^sha256:[0-9a-f]{64}$/.test(candidateHash ?? ""), "candidate object-set hash is invalid");
  check(currentHash !== candidateHash, "promotion candidate does not differ from current configuration");
  check(receipt.spec?.retention?.objectSetSha256 === currentHash, "retained base object-set hash changed");
  check(receipt.spec?.candidate?.objectSetSha256 === candidateHash, "candidate ConfigHub object-set hash changed");
  check(receipt.spec?.promotion?.candidateObjectSetSha256 === candidateHash, "promotion candidate object-set hash changed");
  check(receipt.spec?.promotion?.destination?.objectSetSha256 === candidateHash, "promotion destination object-set hash changed");
  check(receipt.spec?.promotion?.changeSet?.candidateObjectSetSha256 === candidateHash, "promotion ChangeSet has the wrong candidate object-set hash");
  const approvalModel = receipt.spec?.approvalModel;
  const currentApproval = receipt.spec?.promotion?.approvalAttestation;
  check(
    approvalModel === undefined && currentApproval === undefined
      || approvalModel === "space-attestation-v1" && currentApproval && typeof currentApproval === "object",
    "approval proof model and attestation fields are incomplete or inconsistent",
  );
  if (requireCurrentApproval) {
    check(approvalModel === "space-attestation-v1" && currentApproval && typeof currentApproval === "object", "current approval proof gap: receipt lacks its versioned Space Approval attestation");
  }
  if (currentApproval) {
    const approval = currentApproval;
    const subject = approval.subject;
    const expectedCommand = `cub variant approve ${receipt.spec.promotion.destination.space} --all --where "UnitID = '${subject?.unitID}'" --revision ${subject?.revisionNum} -o json`;
    check(approval.command === expectedCommand, "approval command does not describe the emitted exact-revision command");
    check(typeof approval.attestationID === "string" && approval.attestationID.length > 0, "approval attestation ID is missing");
    check(approval.type === "Approval" && approval.result === "Pass", "approval attestation is not a passing Approval");
    check(subject?.unitID === receipt.spec.promotion.destination.unitId, "approval subject Unit differs from the promoted Unit");
    check(Number.isSafeInteger(subject?.revisionNum) && subject.revisionNum === receipt.spec.promotion.approvedRevision, "approval subject revision differs from the approved numeric revision");
    check(approval.workflowEnforcement === "not-configured", "approval workflow-enforcement claim changed");
  }
  check(receipt.spec?.preview?.storedDataUnchanged === true, "promotion preview changed stored data");
  check(receipt.spec?.preview?.revisionUnchanged === true, "promotion preview changed revision history");
  for (const lane of ["localCandidate", "retainedObjectSet", "previewNonMutating", "promotedObjectSet", "changeRecordBoundToCandidate", "revisionApproval"]) {
    check(receipt.spec?.checks?.[lane] === "pass", `command-contract lane ${lane} is not pass`);
  }
  for (const lane of ["destinationSecret", "releaseOci", "delivery", "liveObservation"]) {
    check(receipt.spec?.checks?.[lane] === "not-run", `command-contract receipt overstates ${lane}`);
  }
  const serialized = JSON.stringify(receipt);
  const forbiddenReceiptFragments = [
    { fragment: ["@", "confighub.com"].join(""), message: "command-contract receipt contains a user identity" },
    { fragment: `/${["Users"].join("/")}/`, message: "command-contract receipt contains a local path" },
    { fragment: `/${["var", "folders"].join("/")}/`, message: "command-contract receipt contains a temporary path" },
  ];
  for (const { fragment, message } of forbiddenReceiptFragments) {
    check(!serialized.includes(fragment), message);
  }
  check(!serialized.includes("\u001b"), "command-contract receipt contains terminal color escapes");
}

function verifyLive(receipt) {
  const base = getUnit(baseSpace);
  const staging = getUnit(stagingSpace);
  const changeSet = getChangeSet(stagingSpace, changeSetSlug);
  check(base.UnitID === receipt.spec.candidate.unitId, "live base Unit changed");
  check(base.DataHash === receipt.spec.candidate.dataHash, "live base data changed");
  check(staging.UnitID === receipt.spec.promotion.destination.unitId, "live staging Unit changed");
  check(staging.DataHash === receipt.spec.promotion.destination.dataHash, "live staging data changed");
  if (receipt.spec.approvalModel === "space-attestation-v1") {
    check(staging.HeadRevisionNum === receipt.spec.promotion.approvedRevision, "live staging revision changed since approval");
    const revision = JSON.parse(cub(["revision", "get", unitSlug, String(staging.HeadRevisionNum), "--space", stagingSpace, "-o", "json"]));
    const attestations = JSON.parse(cub(["attestation", "list", "--space", stagingSpace, "-o", "json"]));
    const observed = observeApprovalAttestations(staging, revision, attestations);
    check(observed.attestationIDs.includes(receipt.spec.promotion.approvalAttestation.attestationID), "recorded staging attestation is no longer active on the reviewed revision");
  }
  check(staging.Annotations?.[annotationKey] === receipt.spec.source.candidateObjectSetSha256, "live staging annotation changed");
  check(changeSet.Annotations?.[annotationKey] === receipt.spec.source.candidateObjectSetSha256, "live ChangeSet annotation changed");
}

function unitRecord(space, unit, objectSetSha256) {
  return {
    space,
    unit: unit.Slug,
    unitId: unit.UnitID,
    headRevision: unit.HeadRevisionNum,
    upstreamRevision: unit.UpstreamRevisionNum ?? 0,
    dataHash: unit.DataHash,
    objectSetSha256,
    annotation: `${annotationKey}=${unit.Annotations?.[annotationKey] ?? "missing"}`,
  };
}

function renderSummary(receipt) {
  const spec = receipt.spec;
  return `# One checked result retained and promoted without losing its identity

This run starts with the reviewed NGINX base, checks a candidate that changes
replicas from three to four and adds an \`emptyDir\` size limit, then carries the
candidate's canonical object-set hash through ConfigHub.

| Step | Result | Identity |
| --- | --- | --- |
| Keep the reviewed base | pass | \`${spec.source.currentObjectSetSha256}\` |
| Check the promotion candidate locally | pass | \`${spec.source.candidateObjectSetSha256}\` |
| Preview the staging promotion | pass; stored data and revision did not change | ${spec.preview.summary.replaceAll("|", "\\|")} |
| Record the candidate on the ChangeSet | pass | \`${spec.promotion.changeSet.candidateObjectSetSha256}\` |
| ${spec.promotion.approvalAttestation ? "Promote and record Space Approval attestation" : "Promote and approve staging"} | pass | \`${spec.promotion.destination.objectSetSha256}\` |

${spec.promotion.approvalAttestation ? "The Space-level Approval attestation records a claim about the reviewed Unit revision. No ChangeWorkflow or release prerequisite was configured, so this record does not enforce approval on promotion or publication.\n\n" : ""}The ConfigHub data hash remains a storage identity. The canonical object-set
hash identifies the accepted Kubernetes objects. The local \`cub check\` result,
the ConfigHub ChangeSet, and the destination Unit all name the latter.

## Not run

- The required staging Secret was not checked.
- Release OCI publication did not run.
- Argo CD or Flux delivery did not run.
- No live workload observation was recorded.

These later checks remain separate from the successful retention and promotion
proof.

- [WorkshopResult for the base](helm/workshop-result.json)
- [WorkshopResult for the candidate](helm/promoted-workshop-result.json)
- [PromotionReview](helm/promotion-review.json)
- [Live receipt](../../runs/config-workshop-command-contract/${spec.promotion.approvalAttestation ? "receipt-attestation-v1.yaml" : "receipt.yaml"})
`;
}

function storedObjectIdentity(space) {
  const output = cub(["k8s", "get", "all", "--space", space, "--show", "data", "-o", "json"]);
  const rows = JSON.parse(output);
  check(Array.isArray(rows) && rows.length > 0, `${space} has no Kubernetes resources`);
  const documents = rows.map((row) => row.Resource);
  check(documents.every((document) => document?.apiVersion && document?.kind), `${space} resource view is incomplete`);
  return scannerObjectSetIdentity(documents);
}

function summarizePreview(output) {
  if (!output) {
    return { text: "No mutation text was printed.", includesStorageOnlyCommentChange: false };
  }
  const plain = output.replace(/\u001b\[[0-9;]*m/g, "");
  const hasReplicas = plain.includes("spec.replicas") && plain.includes("3") && plain.includes("4");
  const hasSizeLimit = plain.includes("sizeLimit") && plain.includes("512Mi");
  const includesStorageOnlyCommentChange = plain.includes("$comment$");
  check(hasReplicas && hasSizeLimit, "promotion preview did not show the expected replicas and emptyDir changes");
  return {
    text: `Deployment/nginx: replicas 3 to 4; emptyDir sizeLimit set to 512Mi${includesStorageOnlyCommentChange ? "; ConfigHub also reported one storage-only source-comment change" : ""}.`,
    includesStorageOnlyCommentChange,
  };
}

function getUnit(space) {
  const output = cub(["unit", "get", unitSlug, "--space", space, "-o", "json"]);
  const result = JSON.parse(output).Unit;
  check(result?.UnitID, `${space}/${unitSlug} is missing`);
  return result;
}

function assertApprovalAttestation(result, expected) {
  const spaces = result?.Spaces ?? result?.spaces;
  check(Array.isArray(spaces) && spaces.length === 1, "approval proof gap: variant approve returned no unique Space result");
  const row = spaces[0];
  check(row && typeof row === "object", "approval proof gap: variant approve returned a malformed Space result");
  check((row.SpaceSlug ?? row.spaceSlug) === expected.space && !row.Error && !row.error, "approval proof gap: variant approve result does not identify the reviewed Space");
  const attestation = row.Attestation ?? row.attestation;
  const attestationID = attestation?.AttestationID ?? attestation?.attestationID;
  check(typeof attestationID === "string" && attestationID.length > 0, "approval proof gap: variant approve returned no attestation ID");
  const type = attestation.Type ?? attestation.type;
  const resultType = attestation.Result ?? attestation.result;
  check(type === "Approval" && resultType === "Pass", "approval proof gap: variant approve did not return a passing Approval attestation");
  const subjects = row.Subjects ?? row.subjects;
  check(Array.isArray(subjects) && subjects.length === 1, "approval proof gap: variant approve did not return exactly one reviewed subject");
  const subject = subjects[0];
  const unitID = subject?.UnitID ?? subject?.unitID;
  const revisionNum = subject?.RevisionNum ?? subject?.revisionNum;
  check(unitID === expected.unitID && Number.isSafeInteger(revisionNum) && revisionNum === expected.revisionNum, "approval proof gap: attestation subject differs from the reviewed Unit and numeric revision");
  const skippedUnits = row.SkippedUnits ?? row.skippedUnits;
  check(skippedUnits === undefined || Array.isArray(skippedUnits) && skippedUnits.length === 0, "approval proof gap: variant approve skipped a selected Unit or returned malformed skipped-unit data");
  return { attestationID, type, result: resultType, subject: { unitID, revisionNum } };
}

function getChangeSet(space, slug) {
  const output = cub(["changeset", "get", slug, "--space", space, "-o", "json"]);
  const parsed = JSON.parse(output);
  const result = parsed.ChangeSet ?? parsed;
  check(result?.ChangeSetID, `${space}/${slug} ChangeSet is missing`);
  return result;
}

function deleteSpaceIfPresent(space) {
  const result = spawnSync("cub", ["space", "get", space, "-o", "json"], {
    cwd: repoRoot,
    env: cubEnv(),
    encoding: "utf8",
  });
  if (result.status === 0) cub(["space", "delete", space, "--recursive-force", "--quiet"]);
}

function verifyContext() {
  const context = cub(["context", "get"]);
  check(context.includes("river-bear"), "select the river-bear cub context before running this proof");
  check(context.includes("helm-catalog"), "select the helm-catalog organization before running this proof");
  check(context.includes("valid until"), "cub authentication is not valid");
}

function cub(args) {
  return execFileSync("cub", args, {
    cwd: repoRoot,
    env: cubEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 100,
  });
}
