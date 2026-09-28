// Native ConfigHub approval contract for current Mini-IDP production releases.
//
// This is deliberately narrower than a general policy engine.  A ChangeWorkflow
// is a reusable server object; a distinct ChangeOrder must still bind a specific
// source Space and its end-tagged revisions before a production release can use
// it.  The contract was reviewed against cub v0.6.2 help and the corresponding
// reviewed source tag.  It is not evidence that an older connected server can
// enforce these fields.

export const MINI_IDP_WORKFLOW_SLUG = "kubara-mini-idp-production-approval-v1";
export const MINI_IDP_WORKFLOW_STAGE = "prod";
export const MINI_IDP_WORKFLOW_WHERE_SPACE = "Labels.Environment = 'Prod'";
export const MINI_IDP_RELEASE_PREREQUISITE = "kubara-production-approval";
export const MINI_IDP_REQUIRED_SERVER_VERSION = "v0.6.2";
export const MINI_IDP_WORKFLOW_DESCRIPTION = "One authenticated-account approval of the exact ChangeOrder revision before a production release";

export function miniIdpWorkflowDocument() {
  return {
    Description: MINI_IDP_WORKFLOW_DESCRIPTION,
    Stages: [{
      Name: MINI_IDP_WORKFLOW_STAGE,
      WhereSpace: MINI_IDP_WORKFLOW_WHERE_SPACE,
      ReleasePrerequisites: [MINI_IDP_RELEASE_PREREQUISITE],
    }],
    AttestationPrerequisites: [{
      Name: MINI_IDP_RELEASE_PREREQUISITE,
      Count: 1,
      // The retired Mini-IDP policy did not establish distinct-person review.
      // Retain that same authenticated-account model explicitly; do not claim
      // this is independent review.
      AllowAuthors: true,
      IgnoreFail: false,
      Description: MINI_IDP_WORKFLOW_DESCRIPTION,
    }],
  };
}

export function assertMiniIdpAttestationServerVersion(version, fail) {
  const client = version?.client ?? "";
  const server = version?.server ?? "";
  fail(
    client === MINI_IDP_REQUIRED_SERVER_VERSION,
    `current Mini-IDP server-attested approval requires cub client ${MINI_IDP_REQUIRED_SERVER_VERSION}; found ${client || "unknown"}`,
  );
  fail(
    server === MINI_IDP_REQUIRED_SERVER_VERSION,
    `current Mini-IDP server-attested approval requires server ${MINI_IDP_REQUIRED_SERVER_VERSION}; found ${server || "unknown"}. No production approval workflow or release was written.`,
  );
}

export function assertMiniIdpWorkflow(workflow, { space, fail }) {
  fail(workflow && typeof workflow === "object" && !Array.isArray(workflow), "ChangeWorkflow get returned an unexpected payload");
  fail(uuid(workflow.ChangeWorkflowID), "ChangeWorkflow get did not return a UUID ChangeWorkflowID");
  fail(workflow.SpaceID === undefined || uuid(workflow.SpaceID), "ChangeWorkflow SpaceID is malformed");
  fail(Array.isArray(workflow.Stages) && workflow.Stages.length === 1, "Mini-IDP ChangeWorkflow must have exactly one production stage");
  const [stage] = workflow.Stages ?? [];
  fail(stage && typeof stage === "object" && !Array.isArray(stage), "Mini-IDP ChangeWorkflow production stage is malformed");
  fail(stage.Name === MINI_IDP_WORKFLOW_STAGE, `Mini-IDP ChangeWorkflow stage must be ${MINI_IDP_WORKFLOW_STAGE}`);
  fail(stage.WhereSpace === MINI_IDP_WORKFLOW_WHERE_SPACE, "Mini-IDP ChangeWorkflow production selector drifted");
  fail(
    sameStringSet(stage.ReleasePrerequisites, [MINI_IDP_RELEASE_PREREQUISITE]),
    "Mini-IDP ChangeWorkflow must gate production releases on its approval prerequisite",
  );
  fail(Array.isArray(workflow.AttestationPrerequisites) && workflow.AttestationPrerequisites.length === 1, "Mini-IDP ChangeWorkflow must have exactly one attestation prerequisite");
  const [requirement] = workflow.AttestationPrerequisites ?? [];
  fail(requirement && typeof requirement === "object" && !Array.isArray(requirement), "Mini-IDP approval prerequisite is malformed");
  fail(requirement.Name === MINI_IDP_RELEASE_PREREQUISITE, "Mini-IDP approval prerequisite name drifted");
  // Type, Count, IgnoreFail, MaxAge and FromUserIDs are optional JSON fields in
  // the native model.  Accept only their documented defaults when omitted.
  fail(requirement.Type === undefined || requirement.Type === "Approval", "Mini-IDP approval prerequisite Type must be Approval");
  fail(requirement.Count === undefined || requirement.Count === 1, "Mini-IDP approval prerequisite Count must be one");
  fail(requirement.AllowAuthors === true, "Mini-IDP approval prerequisite must explicitly preserve same-operator approval semantics");
  fail(requirement.IgnoreFail === undefined || requirement.IgnoreFail === false, "Mini-IDP approval prerequisite must not ignore rejection attestations");
  fail(requirement.MaxAge === undefined || requirement.MaxAge === "", "Mini-IDP approval prerequisite must not silently add an expiry");
  fail(requirement.FromUserIDs === undefined || (Array.isArray(requirement.FromUserIDs) && requirement.FromUserIDs.length === 0), "Mini-IDP approval prerequisite must not invent an account allowlist");
  fail(
    workflow.Description === undefined || workflow.Description === MINI_IDP_WORKFLOW_DESCRIPTION,
    "Mini-IDP ChangeWorkflow description drifted",
  );
  return {
    id: workflow.ChangeWorkflowID,
    space,
    slug: workflow.Slug ?? MINI_IDP_WORKFLOW_SLUG,
    stage: MINI_IDP_WORKFLOW_STAGE,
    stageWhereSpace: MINI_IDP_WORKFLOW_WHERE_SPACE,
    releasePrerequisite: MINI_IDP_RELEASE_PREREQUISITE,
    requirement: {
      count: 1,
      allowAuthors: true,
      ignoreFail: false,
      maxAge: "",
      fromUserIDs: [],
    },
  };
}

export function assertChangeOrderForProductionRelease(changeOrder, {
  workflowID,
  sourceSpaceID,
  fail,
}) {
  fail(changeOrder && typeof changeOrder === "object" && !Array.isArray(changeOrder), "ChangeOrder get returned an unexpected payload");
  fail(uuid(changeOrder.ChangeOrderID), "ChangeOrder get did not return a UUID ChangeOrderID");
  fail(changeOrder.ChangeWorkflowID === workflowID, "ChangeOrder is not bound to the reviewed Mini-IDP ChangeWorkflow");
  fail(uuid(changeOrder.EndTagID), "ChangeOrder has no exact end-tag revision boundary");
  fail(
    Array.isArray(changeOrder.InScopeSpaceIDs)
      && changeOrder.InScopeSpaceIDs.length === 1
      && changeOrder.InScopeSpaceIDs[0] === sourceSpaceID,
    "ChangeOrder must bind exactly its already-read production Space ID",
  );
  return {
    id: changeOrder.ChangeOrderID,
    endTagID: changeOrder.EndTagID,
  };
}

function uuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sameStringSet(value, expected) {
  return Array.isArray(value)
    && value.length === expected.length
    && [...value].sort().every((entry, index) => entry === [...expected].sort()[index]);
}
