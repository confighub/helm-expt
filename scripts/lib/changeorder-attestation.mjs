// Narrow evidence binding for the v0.5.7 ChangeWorkflow/ChangeOrder approval
// path.  This deliberately does not reimplement the server's prerequisite
// evaluator: promotion and ChangeOrder release remain the only gate decision.

export const SERVER_ATTESTED_CHANGEORDER_AUTHORITY = "server-attested-changeworkflow-changeorder-v1";

export function requireServerAttestedApproval(approval, fail) {
  fail(approval && typeof approval === "object", "approval contract is missing");
  fail(approval.authority === SERVER_ATTESTED_CHANGEORDER_AUTHORITY,
    "required approval uses the legacy Unit.ApprovedBy/Trigger authority; server-attested ChangeWorkflow/ChangeOrder evidence is required before any write");
  const changeOrder = approval.changeOrder;
  const workflow = approval.workflow;
  fail(changeOrder && workflow, "server-attested approval needs both ChangeOrder and ChangeWorkflow bindings");
  for (const [label, value] of Object.entries({
    "ChangeOrder space": changeOrder.space,
    "ChangeOrder slug": changeOrder.slug,
    "ChangeOrder ID": changeOrder.id,
    "ChangeOrder end-tag ID": changeOrder.endTagID,
    "reviewed revision ID": approval.revisionID,
    "ChangeWorkflow space": workflow.space,
    "ChangeWorkflow slug": workflow.slug,
    "ChangeWorkflow ID": workflow.id,
    "ChangeWorkflow approval stage": workflow.stage,
    "ChangeWorkflow approval stage selector": workflow.stageWhereSpace,
    "ChangeWorkflow release prerequisite": workflow.releasePrerequisite,
  })) fail(typeof value === "string" && value.length > 0, `${label} is missing from the server-attested approval contract`);
  const requirement = workflow.requirement;
  fail(requirement && typeof requirement === "object", "ChangeWorkflow approval requirement is missing from the server-attested approval contract");
  fail(Number.isSafeInteger(requirement.count) && requirement.count > 0, "ChangeWorkflow approval requirement count is invalid");
  fail(typeof requirement.allowAuthors === "boolean" && typeof requirement.ignoreFail === "boolean", "ChangeWorkflow approval author/fail semantics are invalid");
  fail(typeof requirement.maxAge === "string" && Array.isArray(requirement.fromUserIDs) && requirement.fromUserIDs.every((value) => typeof value === "string"), "ChangeWorkflow approval expiry/eligible-reviewer semantics are invalid");
  return { changeOrder, workflow };
}

export function assertWorkflowReleasePrerequisite(workflowEntity, contract, fail) {
  const entity = workflowEntity?.ChangeWorkflow ?? workflowEntity;
  fail(entity && typeof entity === "object", "ChangeWorkflow read returned no entity");
  fail(entity.ChangeWorkflowID === contract.workflow.id, "ChangeWorkflow ID differs from the exact approval contract");
  const stage = (entity.Stages ?? []).find((row) => row?.Name === contract.workflow.stage);
  fail(stage, "ChangeWorkflow no longer contains the approval release stage");
  fail(stage.WhereSpace === contract.workflow.stageWhereSpace, "ChangeWorkflow approval stage selector differs from the exact approval contract");
  fail((stage.ReleasePrerequisites ?? []).includes(contract.workflow.releasePrerequisite),
    "ChangeWorkflow release prerequisite no longer enforces the required Approval attestation");
  const prerequisite = (entity.AttestationPrerequisites ?? []).find((row) => row?.Name === contract.workflow.releasePrerequisite);
  fail(prerequisite, "ChangeWorkflow release prerequisite is not an AttestationPrerequisite");
  fail(!Object.hasOwn(prerequisite, "Type") || typeof prerequisite.Type === "string", "ChangeWorkflow Approval type is malformed");
  fail(!Object.hasOwn(prerequisite, "Count") || Number.isSafeInteger(prerequisite.Count) && prerequisite.Count >= 0, "ChangeWorkflow Approval count is malformed");
  fail(!Object.hasOwn(prerequisite, "AllowAuthors") || typeof prerequisite.AllowAuthors === "boolean", "ChangeWorkflow Approval author rule is malformed");
  fail(!Object.hasOwn(prerequisite, "IgnoreFail") || typeof prerequisite.IgnoreFail === "boolean", "ChangeWorkflow Approval rejection rule is malformed");
  fail(!Object.hasOwn(prerequisite, "MaxAge") || typeof prerequisite.MaxAge === "string", "ChangeWorkflow Approval expiry rule is malformed");
  fail(!Object.hasOwn(prerequisite, "FromUserIDs") || Array.isArray(prerequisite.FromUserIDs) && prerequisite.FromUserIDs.every((value) => typeof value === "string"), "ChangeWorkflow Approval eligible-user rule is malformed");
  fail((prerequisite.Type ?? "Approval") === "Approval", "ChangeWorkflow release prerequisite is not an Approval attestation requirement");
  const expected = contract.workflow.requirement;
  fail((prerequisite.Count || 1) === expected.count, "ChangeWorkflow approval count differs from the exact approval contract");
  fail(Boolean(prerequisite.AllowAuthors) === expected.allowAuthors, "ChangeWorkflow approval author eligibility differs from the exact approval contract");
  fail(Boolean(prerequisite.IgnoreFail) === expected.ignoreFail, "ChangeWorkflow approval rejection handling differs from the exact approval contract");
  fail((prerequisite.MaxAge ?? "") === expected.maxAge, "ChangeWorkflow approval expiry policy differs from the exact approval contract");
  // The server counts distinct authenticated UserIDs. Those can belong to
  // people or service accounts, so this does not claim distinct people.
  fail(sameStrings(prerequisite.FromUserIDs ?? [], expected.fromUserIDs), "ChangeWorkflow eligible authenticated UserIDs differ from the exact approval contract");
  return { id: entity.ChangeWorkflowID, stage: stage.Name, prerequisite: prerequisite.Name };
}

export function assertChangeOrderBinding(changeOrderEntity, contract, fail, participatingSpaceID) {
  const entity = changeOrderEntity?.ChangeOrder ?? changeOrderEntity;
  fail(entity && typeof entity === "object", "ChangeOrder read returned no entity");
  fail(entity.ChangeOrderID === contract.changeOrder.id, "ChangeOrder ID differs from the exact approval contract");
  fail(entity.ChangeWorkflowID === contract.workflow.id, "ChangeOrder is not bound to the exact ChangeWorkflow");
  fail(entity.EndTagID === contract.changeOrder.endTagID, "ChangeOrder end tag differs from the exact approval contract");
  fail(typeof participatingSpaceID === "string" && participatingSpaceID.length > 0, "exact source Space ID is unavailable for ChangeOrder coverage");
  fail(Array.isArray(entity.InScopeSpaceIDs) && entity.InScopeSpaceIDs.includes(participatingSpaceID), "ChangeOrder does not name the exact source Space as a participating Space");
  return { id: entity.ChangeOrderID, endTagID: entity.EndTagID, workflowID: entity.ChangeWorkflowID };
}

export function assertChangeOrderRevisionCoverage(revisions, { unitID, revisionID, revisionNum, dataHash }, fail) {
  fail(Array.isArray(revisions) && revisions.length === 1, "ChangeOrder does not select exactly one revision for the exact source Unit");
  const revision = revisions[0]?.Revision ?? revisions[0];
  fail(revision?.UnitID === unitID && revision?.RevisionID === revisionID && Number(revision?.RevisionNum) === revisionNum && revision?.DataHash === dataHash,
    "ChangeOrder end-tag revision coverage differs from the exact source Unit revision");
  return { unitID: revision.UnitID, revisionID: revision.RevisionID, revisionNum: Number(revision.RevisionNum), dataHash: revision.DataHash };
}

export function assertApprovalCreateResult(result, { space, revisionID, revisionNum, unitID, changeOrderID }, fail, now = new Date()) {
  const spaces = result?.Spaces ?? result?.spaces;
  fail(Array.isArray(spaces), "variant approve did not return an attestation result by Space");
  fail(spaces.length === 1, "variant approve selected more than the one exact source Space");
  const row = spaces[0];
  fail((row?.SpaceSlug ?? row?.spaceSlug) === space && !row.Error && !row.error, "variant approve did not create an Approval attestation for the exact source Space");
  const attestation = row.Attestation ?? row.attestation;
  fail(attestation?.AttestationID || attestation?.attestationID, "variant approve returned no immutable attestation ID");
  fail((attestation.Type ?? attestation.type) === "Approval" && (attestation.Result ?? attestation.result) === "Pass",
    "variant approve did not return a passing Approval attestation");
  fail((attestation.ChangeOrderID ?? attestation.changeOrderID) === changeOrderID,
    "variant approve attestation is not bound to the exact ChangeOrder");
  const subjects = row.Subjects ?? row.subjects;
  fail(Array.isArray(subjects) && subjects.length === 1, "variant approve did not return exactly one reviewed subject");
  const subject = subjects[0];
  fail((subject.UnitID ?? subject.unitID) === unitID && (subject.RevisionID ?? subject.revisionID) === revisionID && Number(subject.RevisionNum ?? subject.revisionNum) === revisionNum,
    "variant approve attestation subject differs from the exact reviewed Unit revision");
  const hasSkippedUnits = Object.hasOwn(row, "SkippedUnits") || Object.hasOwn(row, "skippedUnits");
  const skippedUnits = row.SkippedUnits ?? row.skippedUnits;
  fail(!hasSkippedUnits || Array.isArray(skippedUnits) && skippedUnits.length === 0,
    "variant approve skipped a selected Unit or returned a malformed skipped-unit result");
  const expiresAt = attestation.ExpiresAt ?? attestation.expiresAt ?? null;
  fail(!expiresAt || new Date(expiresAt).getTime() > now.getTime(), "variant approve returned an expired Approval attestation");
  return {
    attestationID: attestation.AttestationID ?? attestation.attestationID,
    subject: { unitID: subject.UnitID ?? subject.unitID, revisionID: subject.RevisionID ?? subject.revisionID, revisionNum: Number(subject.RevisionNum ?? subject.revisionNum) },
    expiresAt,
  };
}

export function assertActiveApproval(attestationEntity, expected, fail, now = new Date()) {
  const entity = attestationEntity?.Attestation ?? attestationEntity;
  fail(entity && typeof entity === "object", "Approval attestation read returned no entity");
  fail((entity.AttestationID ?? entity.attestationID) === expected.attestationID, "Approval attestation ID changed");
  fail((entity.Type ?? entity.type) === "Approval" && (entity.Result ?? entity.result) === "Pass", "Approval attestation is not a passing Approval record");
  fail((entity.ChangeOrderID ?? entity.changeOrderID) === expected.changeOrderID, "Approval attestation is not bound to the exact ChangeOrder");
  const expiresAt = entity.ExpiresAt ?? entity.expiresAt ?? null;
  fail(!expiresAt || new Date(expiresAt).getTime() > now.getTime(), "Approval attestation has expired");
  return { attestationID: expected.attestationID, expiresAt };
}

export function assertNotRevoked(revocations, fail) {
  fail(Array.isArray(revocations) && revocations.length === 0, "the recorded Approval attestation has been revoked");
}

function sameStrings(left, right) {
  return [...left].map(String).sort().join("\u0000") === [...right].map(String).sort().join("\u0000");
}
