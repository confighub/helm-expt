#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import { assertActiveApproval, assertApprovalCreateResult, assertNotRevoked } from "./lib/changeorder-attestation.mjs";

const mode = process.argv[2] ?? "--help";
const expectedOrg = "helm-catalog";
const targetRef = process.env.HELM_EXPT_POLICY_PROOF_TARGET?.trim() ?? "";
const baselineFilterRef = "platform/helm-catalog-checks";
const approvalFilterRef = "platform/helm-catalog-prod-gates";
const receiptPath = join(
  repoRoot,
  "runs",
  "config-catalog-policy-functional-proof",
  "receipt.yaml",
);
const currentReceiptPath = process.env.HELM_EXPT_POLICY_CURRENT_RECEIPT?.trim() || join(repoRoot, "runs", "config-catalog-policy-functional-current-proof", "receipt.yaml");
const CURRENT_WORKFLOW_SPACE = "platform";
const CURRENT_WORKFLOW = "helm-catalog-changeorder-approval-v1";
const CURRENT_COMPONENT = "helm-catalog-approval-v1";
const CURRENT_SCOPE_LABEL = "ChangeOrderApprovalScope";
const CURRENT_SCOPE_VALUE = "catalog-standard-v1";
const CURRENT_PREREQUISITE = "helm-catalog-approval";
const summaryPath = join(
  repoRoot,
  "data",
  "apply-policy-functional-proof",
  "summary.md",
);
const lifecycleReceiptPath = join(
  repoRoot,
  "data",
  "hooks-crds-app",
  "live-receipt.yaml",
);
const proposedRenderPath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "proposed-render.yaml",
);
const reviewedRenderPath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "reviewed-render.yaml",
);
const proposedScanPath = join(
  repoRoot,
  "runs",
  "config-catalog-policy-functional-proof",
  "proposed-cub-check.json",
);
const reviewedScanPath = join(
  repoRoot,
  "runs",
  "config-catalog-policy-functional-proof",
  "reviewed-cub-check.json",
);
const byoHubReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "confighub-upload-receipt.yaml",
);
const byoPromotionReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-promotion-proof",
  "receipt.yaml",
);
const retainedSpace = "byo-nginx-ai-values-24-0-2-reviewed";
const retainedUnit = "byo-nginx-ai-values";
const scannerVersion = "v0.7.3";

const gates = {
  placeholder: "platform/vet-placeholders/vet-placeholders",
  schema: "platform/vet-schemas/vet-schemas",
  lifecycle: "platform/lifecycle-route-evidence/vet-cel",
  sensitiveEnv: "platform/workload-sensitive-env-secret-refs/vet-cel",
  // Historical receipt-only fact. Current --run never creates or reads it.
  approval: "platform/require-approval/vet-approvedby",
};
const warnings = [
  "platform/digest-pinned-images/vet-cel",
  "platform/probes-declared/vet-cel",
];
let currentExecutor;

if (mode === "--run") {
  console.error("blocked: --run retains the historical full functional-proof contract; use --current-run for the separate native approval-release proof");
  process.exitCode = 1;
} else if (mode === "--current-run") {
  runCurrent();
} else if (mode === "--current-verify") {
  check(existsSync(currentReceiptPath), `${relativeRepo(currentReceiptPath)} is missing; run the current proof`);
  verifyCurrentReceipt(readYaml(currentReceiptPath));
  console.log("verified current ChangeOrder approval receipt; it does not claim bare-release enforcement");
} else if (mode === "--current-self-test") {
  selfTestCurrentApproval();
  console.log("current catalog policy approval self-test passed");
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run the generator`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run config-catalog:policy:generate`,
  );
  console.log("verified historical Trigger-model evidence only; current workflow approval is not proven");
} else {
  console.error(
    `Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify|--current-run|--current-verify|--current-self-test`,
  );
  process.exitCode = 2;
}

function runCurrent(options = {}) {
  const previousExecutor = currentExecutor;
  currentExecutor = options.executor;
  try { return runCurrentBody(options); }
  finally { currentExecutor = previousExecutor; }
}

function runCurrentBody(options = {}) {
  const env = options.env ?? process.env;
  const executor = options.executor;
  const outputPath = options.outputPath ?? currentReceiptPath;
  const proofTargetRef = options.targetRef ?? targetRef;
  const context = env.CUB_CONTEXT?.trim() ?? "";
  check(env.HELM_EXPT_ALLOW_LIVE_POLICY_PROOF === "1", "set HELM_EXPT_ALLOW_LIVE_POLICY_PROOF=1 to confirm this live-org proof");
  check(context && proofTargetRef, "set CUB_CONTEXT and HELM_EXPT_POLICY_PROOF_TARGET for the current proof");
  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"], { env: cubEnv(context), executor });
  check(contextInfo.metadata?.organizationName === expectedOrg, "current proof context is not the expected helm-catalog organization");
  const version = command("cub", ["version"], { env: cubEnv(context), executor });
  const exact062 = /(?:^|\n)\s*Version:\s*v0\.6\.2\s*$/gm;
  check([...version.matchAll(exact062)].length >= 2, "current proof requires exact cub and server v0.6.2");
  const runId = safeRunId(env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const space = `hx-policy-current-${runId}`;
  const unitSlug = "approval-fixture";
  const cleanup = { space: "not-created" };
  const root = mkdtempSync(join(tmpdir(), "helm-expt-current-policy-proof-"));
  let receipt;
  try {
    const target = entity(cubJson(context, ["target", "get", "--space", ...proofTargetRef.split("/"), "-o", "json"]), "Target");
    check(target.ProviderType === "OCI", `${proofTargetRef} is not an OCI target`);
    const workflow = entity(cubJson(context, ["changeworkflow", "get", "--space", CURRENT_WORKFLOW_SPACE, CURRENT_WORKFLOW, "-o", "json"]), "ChangeWorkflow");
    assertWorkflow(workflow);
    const component = entity(cubJson(context, ["component", "get", CURRENT_COMPONENT, "-o", "json"]), "Component");
    check(uuid(component.ComponentID) && component.ChangeWorkflowRequired === true && sameSet(component.AllowedChangeWorkflowIDs ?? [], [workflow.ChangeWorkflowID]), "native Component contract drifted");
    cub(context, ["space", "create", space, "--component", component.ComponentID, "--release-target", proofTargetRef,
      "--label", "ApplyPolicyProfile=catalog-standard", "--label", "ResourceClass=system-configuration",
      "--label", `${CURRENT_SCOPE_LABEL}=${CURRENT_SCOPE_VALUE}`, "--trigger-filter", approvalFilterRef, "--where-trigger", "-", "--quiet"]);
    cleanup.space = "pending";
    const stored = entity(cubJson(context, ["space", "get", space, "-o", "json"]), "Space");
    check(stored.ComponentID === component.ComponentID && stored.Labels?.[CURRENT_SCOPE_LABEL] === CURRENT_SCOPE_VALUE, "current proof Space binding drifted");
    const fixture = writeFixtures(root).approval;
    cub(context, ["unit", "create", "--space", space, unitSlug, fixture, "--quiet"]);
    const unit = entity(cubJson(context, ["unit", "get", unitSlug, "--space", space, "-o", "json"]), "Unit");
    check(uuid(unit.UnitID) && uuid(unit.HeadRevisionID) && Number.isInteger(unit.HeadRevisionNum) && typeof unit.DataHash === "string", "current proof Unit has no exact head");
    const revision = entity(cubJson(context, ["revision", "get", "--space", stored.SpaceID, unitSlug, String(unit.HeadRevisionNum), "-o", "json"]), "Revision");
    check(revision.UnitID === unit.UnitID && revision.RevisionID === unit.HeadRevisionID && Number(revision.RevisionNum) === Number(unit.HeadRevisionNum) && revision.DataHash === unit.DataHash, "current proof exact revision drifted");
    const orderSlug = `policy-current-${runId}`;
    cub(context, ["changeorder", "create", "--space", stored.SpaceID, orderSlug, "--component", component.ComponentID, "--change-workflow", workflow.ChangeWorkflowID, "--in-scope-space", stored.SpaceID, "-o", "json"]);
    const order = entity(cubJson(context, ["changeorder", "get", "--space", stored.SpaceID, orderSlug, "-o", "json"]), "ChangeOrder");
    check(uuid(order.ChangeOrderID) && order.ChangeWorkflowID === workflow.ChangeWorkflowID && uuid(order.EndTagID) && sameSet(order.InScopeSpaceIDs ?? [], [stored.SpaceID]), "current proof ChangeOrder contract drifted");
    const coverage = rows(cubJson(context, ["revision", "list", "--space", stored.SpaceID, "--by-unit-id", unit.UnitID, "--change-order", order.ChangeOrderID, "-o", "json"]));
    const covered = entity(coverage[0], "Revision");
    check(coverage.length === 1 && covered.UnitID === unit.UnitID && covered.RevisionID === revision.RevisionID && Number(covered.RevisionNum) === Number(revision.RevisionNum) && covered.DataHash === revision.DataHash, "ChangeOrder does not cover the exact proof revision");
    const refusal = cubTry(context, ["release", "publish", stored.SpaceID, "--revision", `ChangeOrder:${order.ChangeOrderID}`, "-o", "json"]);
    assertPrerequisiteRefusal(refusal, CURRENT_PREREQUISITE);
    const approvalResult = cubJson(context, ["variant", "approve", stored.SpaceID, "--change-order", order.ChangeOrderID, "--stage", "approval", "--where", `UnitID = '${unit.UnitID}'`, "--revision", `ChangeOrder:${order.ChangeOrderID}`, "-o", "json"]);
    const approval = assertApprovalCreateResult(approvalResult, { space, unitID: unit.UnitID, revisionID: revision.RevisionID, revisionNum: revision.RevisionNum, changeOrderID: order.ChangeOrderID }, check);
    const attestationID = approval.attestationID;
    const attestation = entity(cubJson(context, ["attestation", "get", attestationID, "-o", "json"]), "Attestation");
    check(attestation.SpaceID === stored.SpaceID, "current proof approval belongs to a different Space");
    assertActiveApproval(attestation, { attestationID: approval.attestationID, changeOrderID: order.ChangeOrderID }, check);
    const revocations = cubJson(context, ["attestation", "list", "--where", `RevokedAttestationID = '${attestationID}'`, "-o", "json"]);
    assertNotRevoked(revocations, check);
    const linked = entity(cubJson(context, ["revision", "get", "--space", stored.SpaceID, unitSlug, String(unit.HeadRevisionNum), "-o", "json"]), "Revision");
    check(linked.Attestations && typeof linked.Attestations === "object" && !Array.isArray(linked.Attestations) && Object.hasOwn(linked.Attestations, attestationID), "approval is not linked to exact revision");
    const release = entity(cubJson(context, ["release", "publish", stored.SpaceID, "--revision", `ChangeOrder:${order.ChangeOrderID}`, "-o", "json"]), "Release");
    check(uuid(release.ReleaseID) && release.SpaceID === stored.SpaceID, "current proof release identity is malformed");
    receipt = { apiVersion: "catalog.confighub.com/v1alpha1", kind: "ConfigCatalogCurrentApprovalProofReceipt", metadata: { name: "catalog-standard-current-approval" }, spec: { context: { organization: expectedOrg, name: context }, space: { id: stored.SpaceID, slug: space, componentID: component.ComponentID }, workflow: { id: workflow.ChangeWorkflowID, stage: "approval", prerequisite: CURRENT_PREREQUISITE }, changeOrder: { id: order.ChangeOrderID, endTagID: order.EndTagID }, subject: { unitID: unit.UnitID, revisionID: revision.RevisionID, revisionNum: revision.RevisionNum, dataHash: revision.DataHash }, attestationID, release: { id: release.ReleaseID, spaceID: release.SpaceID }, limits: ["This proves the configured release prerequisite for this exact ChangeOrder release.", "It does not prove global bare-release prevention or future ChangeOrder coverage."] }, status: { result: "pass", prerequisiteRefusal: `requires ${CURRENT_PREREQUISITE}: 1 Approval attestation(s)` } };
    verifyCurrentReceipt(receipt);
  } finally { if (cleanup.space === "pending") { const deleted = cubTry(context, ["space", "delete", space, "--recursive-force", "--quiet"]); cleanup.space = deleted.ok ? "pass" : "fail"; } rmSync(root, { recursive: true, force: true }); }
  check(cleanup.space === "pass" && receipt, "current proof cleanup failed");
  writeYaml(outputPath, receipt);
  if (!options.silent) console.log(`wrote ${relativeRepo(outputPath)}`);
}

function entity(value, key) { const result = value?.[key] ?? value; check(result && typeof result === "object" && !Array.isArray(result), `${key} payload is malformed`); return result; }
function rows(value) { check(Array.isArray(value), "list payload is malformed"); return value; }
function uuid(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function assertWorkflow(workflow) { const stage = workflow.Stages?.find((item) => item?.Name === "approval"); const prereq = workflow.AttestationPrerequisites?.find((item) => item?.Name === CURRENT_PREREQUISITE); check(uuid(workflow.ChangeWorkflowID) && stage?.WhereSpace === `Labels.${CURRENT_SCOPE_LABEL} = '${CURRENT_SCOPE_VALUE}'` && sameSet(stage.ReleasePrerequisites ?? [], [CURRENT_PREREQUISITE]) && prereq?.AllowAuthors === true && (prereq.Type === undefined || prereq.Type === "Approval") && (prereq.Count === undefined || prereq.Count === 1) && (prereq.IgnoreFail === undefined || prereq.IgnoreFail === false), "native workflow prerequisite contract drifted"); }
function assertPrerequisiteRefusal(result, prerequisite) { check(result && result.ok === false && new RegExp(`requires ${prerequisite}: 1 Approval attestation\\(s\\)`).test(result.out ?? ""), "server did not return the exact native prerequisite refusal"); }
function assertApprovalResult(result, { space, unit, revision, order }) { const rows = result?.Spaces ?? result?.spaces; check(Array.isArray(rows) && rows.length === 1, "variant approve did not return exactly one Space"); const row = rows[0]; const approval = row?.Attestation ?? row?.attestation; const subjects = row?.Subjects ?? row?.subjects; check((row.SpaceSlug ?? row.spaceSlug) === space && !row.Error && Array.isArray(subjects) && subjects.length === 1 && (subjects[0].UnitID ?? subjects[0].unitID) === unit.UnitID && (subjects[0].RevisionID ?? subjects[0].revisionID) === revision.RevisionID && (approval?.Type ?? approval?.type) === "Approval" && (approval?.Result ?? approval?.result) === "Pass" && (approval?.ChangeOrderID ?? approval?.changeOrderID) === order.ChangeOrderID && uuid(approval?.AttestationID ?? approval?.attestationID) && (!Object.hasOwn(row, "SkippedUnits") || Array.isArray(row.SkippedUnits) && row.SkippedUnits.length === 0), "variant approve result is not exact approval evidence"); return { id: approval.AttestationID ?? approval.attestationID }; }
function verifyCurrentReceipt(receipt) { check(receipt?.kind === "ConfigCatalogCurrentApprovalProofReceipt" && receipt.status?.result === "pass" && receipt.spec?.context?.organization === expectedOrg && typeof receipt.spec?.context?.name === "string" && uuid(receipt.spec?.space?.id) && uuid(receipt.spec?.space?.componentID) && uuid(receipt.spec?.workflow?.id) && receipt.spec?.workflow?.prerequisite === CURRENT_PREREQUISITE && uuid(receipt.spec?.changeOrder?.id) && uuid(receipt.spec?.changeOrder?.endTagID) && uuid(receipt.spec?.subject?.unitID) && uuid(receipt.spec?.subject?.revisionID) && Number.isInteger(receipt.spec?.subject?.revisionNum) && typeof receipt.spec?.subject?.dataHash === "string" && uuid(receipt.spec?.attestationID) && uuid(receipt.spec?.release?.id) && receipt.spec?.release?.spaceID === receipt.spec?.space?.id && receipt.status?.prerequisiteRefusal === `requires ${CURRENT_PREREQUISITE}: 1 Approval attestation(s)`, "current approval receipt contract drifted"); }
function selfTestCurrentApproval() {
  const base = { ok: false, out: `requires ${CURRENT_PREREQUISITE}: 1 Approval attestation(s)` };
  assertPrerequisiteRefusal(base, CURRENT_PREREQUISITE);
  for (const output of ["network error", "requires other: 1 Approval attestation(s)"]) {
    let failed = false;
    try { assertPrerequisiteRefusal({ ok: false, out: output }, CURRENT_PREREQUISITE); } catch { failed = true; }
    check(failed, "self-test accepted unrelated CLI failure as prerequisite proof");
  }
  const unit = { UnitID: "00000000-0000-4000-8000-000000000010" };
  const revision = { RevisionID: "00000000-0000-4000-8000-000000000011" };
  const order = { ChangeOrderID: "00000000-0000-4000-8000-000000000012" };
  assertApprovalResult({ Spaces: [{ SpaceSlug: "space", Attestation: { AttestationID: "00000000-0000-4000-8000-000000000013", Type: "Approval", Result: "Pass", ChangeOrderID: order.ChangeOrderID }, Subjects: [{ UnitID: unit.UnitID, RevisionID: revision.RevisionID }], SkippedUnits: [] }] }, { space: "space", unit, revision, order });
  selfTestCurrentRunPath();
}

function selfTestCurrentRunPath() {
  const root = mkdtempSync(join(tmpdir(), "helm-expt-current-policy-self-test-"));
  const historicalBefore = existsSync(receiptPath) ? readFileSync(receiptPath) : null;
  try {
    const successPath = join(root, "current-receipt.yaml");
    const success = fakeCurrentCli();
    runCurrent({ env: fakeCurrentEnv(), targetRef: "platform/catalog-oci", outputPath: successPath, executor: success.execute, silent: true });
    check(existsSync(successPath), "fake current run did not write its receipt to the injected temporary path");
    verifyCurrentReceipt(readYaml(successPath));
    check(success.successfulPublishes === 1 && success.cleanupCount === 1, "fake current run did not publish once and clean up its Space");

    for (const scenario of ["wrong-revision", "expired-approval", "unrelated-refusal", "missing-membership"]) {
      const outputPath = join(root, `${scenario}.yaml`);
      const fake = fakeCurrentCli(scenario);
      let failed = false;
      try { runCurrent({ env: fakeCurrentEnv(), targetRef: "platform/catalog-oci", outputPath, executor: fake.execute, silent: true }); }
      catch { failed = true; }
      check(failed, `fake current run accepted ${scenario}`);
      check(fake.successfulPublishes === 0, `${scenario} reached successful publish`);
      check(!existsSync(outputPath), `${scenario} wrote a current receipt despite failing`);
      check(fake.cleanupCount === 1, `${scenario} did not clean up its created Space`);
    }
    const historicalAfter = existsSync(receiptPath) ? readFileSync(receiptPath) : null;
    check((historicalBefore === null && historicalAfter === null) || historicalBefore?.equals(historicalAfter), "current self-test changed the historical receipt");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

function fakeCurrentEnv() {
  return { ...process.env, CUB_CONTEXT: "synthetic-helm-catalog", HELM_EXPT_ALLOW_LIVE_POLICY_PROOF: "1", HELM_EXPT_PROOF_RUN_ID: "20260926010101" };
}

function fakeCurrentCli(scenario = "success") {
  const ids = {
    component: "00000000-0000-4000-8000-000000000001", workflow: "00000000-0000-4000-8000-000000000002",
    space: "00000000-0000-4000-8000-000000000003", unit: "00000000-0000-4000-8000-000000000004",
    revision: "00000000-0000-4000-8000-000000000005", order: "00000000-0000-4000-8000-000000000006",
    endTag: "00000000-0000-4000-8000-000000000007", approval: "00000000-0000-4000-8000-000000000008",
    release: "00000000-0000-4000-8000-000000000009",
  };
  const spaceSlug = `hx-policy-current-${"20260926010101"}`;
  const unitSlug = "approval-fixture";
  let successfulPublishes = 0;
  let cleanupCount = 0;
  let preflightPublishCount = 0;
  const execute = (_file, args) => {
    const [group, verb, ...rest] = args;
    if (args[0] === "version") return "Client\nVersion: v0.6.2\nServer\nVersion: v0.6.2\n";
    if (group === "context" && verb === "get") return JSON.stringify({ metadata: { organizationName: expectedOrg } });
    if (group === "target" && verb === "get") return JSON.stringify({ Target: { ProviderType: "OCI" } });
    if (group === "changeworkflow" && verb === "get") return JSON.stringify({ ChangeWorkflow: {
      ChangeWorkflowID: ids.workflow,
      Stages: [{ Name: "approval", WhereSpace: `Labels.${CURRENT_SCOPE_LABEL} = '${CURRENT_SCOPE_VALUE}'`, ReleasePrerequisites: [CURRENT_PREREQUISITE] }],
      AttestationPrerequisites: [{ Name: CURRENT_PREREQUISITE, AllowAuthors: true, Type: "Approval", Count: 1, IgnoreFail: false }],
    } });
    if (group === "component" && verb === "get") return JSON.stringify({ Component: { ComponentID: ids.component, ChangeWorkflowRequired: true, AllowedChangeWorkflowIDs: [ids.workflow] } });
    if (group === "space" && verb === "create") return "";
    if (group === "space" && verb === "get") return JSON.stringify({ Space: { SpaceID: ids.space, ComponentID: ids.component, Labels: { [CURRENT_SCOPE_LABEL]: CURRENT_SCOPE_VALUE } } });
    if (group === "space" && verb === "delete") { cleanupCount++; return ""; }
    if (group === "unit" && verb === "create") return "";
    if (group === "unit" && verb === "get") return JSON.stringify({ Unit: { UnitID: ids.unit, HeadRevisionID: ids.revision, HeadRevisionNum: 1, DataHash: "sha256:synthetic" } });
    if (group === "revision" && verb === "get") {
      const linked = preflightPublishCount > 0;
      return JSON.stringify({ Revision: { UnitID: ids.unit, RevisionID: ids.revision, RevisionNum: 1, DataHash: "sha256:synthetic", ...(linked ? { Attestations: { [ids.approval]: {} } } : {}) } });
    }
    if (group === "changeorder" && verb === "create") return "";
    if (group === "changeorder" && verb === "get") return JSON.stringify({ ChangeOrder: { ChangeOrderID: ids.order, ChangeWorkflowID: ids.workflow, EndTagID: ids.endTag, InScopeSpaceIDs: [ids.space] } });
    if (group === "revision" && verb === "list") {
      if (scenario === "missing-membership") return "[]";
      return JSON.stringify([{ Revision: { UnitID: ids.unit, RevisionID: scenario === "wrong-revision" ? "00000000-0000-4000-8000-000000000099" : ids.revision, RevisionNum: 1, DataHash: "sha256:synthetic" } }]);
    }
    if (group === "release" && verb === "publish") {
      if (preflightPublishCount++ === 0) {
        const refusal = scenario === "unrelated-refusal" ? "permission denied" : `requires ${CURRENT_PREREQUISITE}: 1 Approval attestation(s)`;
        const error = new Error(refusal); error.stderr = `${refusal}\n`; throw error;
      }
      successfulPublishes++;
      return JSON.stringify({ Release: { ReleaseID: ids.release, SpaceID: ids.space } });
    }
    if (group === "variant" && verb === "approve") return JSON.stringify({ Spaces: [{ SpaceSlug: spaceSlug, Attestation: { AttestationID: ids.approval, Type: "Approval", Result: "Pass", ChangeOrderID: ids.order }, Subjects: [{ UnitID: ids.unit, RevisionID: ids.revision, RevisionNum: 1 }], SkippedUnits: [] }] });
    if (group === "attestation" && verb === "get") return JSON.stringify({ Attestation: { AttestationID: ids.approval, SpaceID: ids.space, Type: "Approval", Result: "Pass", ChangeOrderID: ids.order, ...(scenario === "expired-approval" ? { ExpiresAt: "2000-01-01T00:00:00.000Z" } : {}) } });
    if (group === "attestation" && verb === "list") return "[]";
    throw new Error(`fake cub has no response for: ${args.join(" ")}`);
  };
  return { execute, get successfulPublishes() { return successfulPublishes; }, get cleanupCount() { return cleanupCount; } };
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_POLICY_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_POLICY_PROOF=1 to confirm this live-org proof",
  );
  check(context, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(
    targetRef,
    "set HELM_EXPT_POLICY_PROOF_TARGET to a current Space/OCI-target reference",
  );
  check(tryCommand("cub", ["version"]).ok, "cub is required for the policy proof");

  const contextInfo = jsonCommand("cub", ["context", "get", context, "-o", "json"], {
    env: cubEnv(context),
  });
  check(
    contextInfo.metadata?.organizationName === expectedOrg,
    `refusing to run in organization ${contextInfo.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );

  const target = cubJson(
    context,
    ["target", "get", "--space", ...targetRef.split("/"), "-o", "json"],
  ).Target;
  check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);

  const topology = readTopology(context);
  const lifecycleReceipt = readYaml(lifecycleReceiptPath);
  verifyLifecycleReceipt(lifecycleReceipt);
  const retained = readRetainedReviewedResult(context, topology);
  const promotion = readYaml(byoPromotionReceiptPath);
  verifyPromotionReceipt(promotion, retained);

  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString());
  const spaces = {
    baseline: `hx-policy-baseline-${runId}`,
    approval: `hx-policy-approval-${runId}`,
  };
  const cleanup = {
    baselineSpace: "not-created",
    approvalSpace: "not-created",
  };
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-policy-proof-"));
  const localScans = runLocalScans(tempRoot);
  let receipt;

  try {
    for (const slug of Object.values(spaces)) {
      check(
        !cubTry(context, ["space", "get", slug, "-o", "json"]).ok,
        `refusing to reuse existing proof Space ${slug}`,
      );
    }

    createSpace(context, {
      slug: spaces.baseline,
      filter: baselineFilterRef,
      labels: {
        ApplyPolicyProfile: "catalog-standard",
        Proof: "config-catalog-policy-functional",
        ResourceClass: "user-workload",
      },
    });
    cleanup.baselineSpace = "pending";

    createSpace(context, {
      slug: spaces.approval,
      filter: approvalFilterRef,
      labels: {
        ApplyPolicyProfile: "catalog-standard",
        Proof: "config-catalog-policy-functional",
        ResourceClass: "system-configuration",
      },
    });
    cleanup.approvalSpace = "pending";

    assertSpaceTriggers(context, spaces.baseline, topology.baseline.triggerIds);
    assertSpaceTriggers(context, spaces.approval, topology.approvalRequired.triggerIds);

    const fixtures = {
      ...writeFixtures(tempRoot),
      sensitiveEnv: proposedRenderPath,
      secretBackedEnv: reviewedRenderPath,
    };
    const placeholder = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "placeholder-fixture",
      path: fixtures.placeholder,
      expectedGate: gates.placeholder,
    });
    const schema = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "schema-fixture",
      path: fixtures.schema,
      expectedGate: gates.schema,
    });
    const warning = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "warning-fixture",
      path: fixtures.warning,
      expectedWarnings: warnings,
    });
    const sensitiveEnv = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "sensitive-env-fixture",
      path: fixtures.sensitiveEnv,
      expectedGate: gates.sensitiveEnv,
    });
    const secretBackedEnv = createAndReadFixture(context, {
      space: spaces.baseline,
      slug: "secret-backed-env-fixture",
      path: fixtures.secretBackedEnv,
    });
    const approval = createAndReadFixture(context, {
      space: spaces.approval,
      slug: "approval-fixture",
      path: fixtures.approval,
      expectedGate: gates.approval,
    });

    const placeholderGate = blockedGateObservation(placeholder, gates.placeholder);
    const schemaGate = blockedGateObservation(schema, gates.schema);
    const warningGate = allowedGateObservation(warning);
    const sensitiveEnvGate = blockedGateObservation(
      sensitiveEnv,
      gates.sensitiveEnv,
    );
    const secretBackedEnvGate = allowedGateObservation(
      secretBackedEnv,
      gates.sensitiveEnv,
    );
    const approvalGate = blockedGateObservation(
      approval,
      gates.approval,
    );
    const approvalAfterReview = approveAndObserveGateClear(
      context,
      spaces.approval,
      "approval-fixture",
    );
    const approvalRecord = checkRecord(approval, approvalGate, {
      effect: "block",
      gate: gates.approval,
      finding: "system configuration has no recorded approval",
    });
    approvalRecord.afterApproval = approvalAfterReview;

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "ConfigCatalogApplyPolicyFunctionalProofReceipt",
      metadata: {
        name: "catalog-standard-live-functional",
      },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: expectedOrg,
          purpose: "temporary live policy fixtures",
        },
        target: {
          ref: targetRef,
          id: warning.unit.TargetID,
          provider: target.ProviderType,
          applicationAttempted: false,
          validationMode: "authoritative Unit gate state",
        },
        filters: {
          baseline: topology.baseline,
          approvalRequired: topology.approvalRequired,
        },
        checks: {
          placeholder: checkRecord(placeholder, placeholderGate, {
            effect: "block",
            gate: gates.placeholder,
            finding: "unresolved ConfigHub placeholder",
          }),
          schema: checkRecord(schema, schemaGate, {
            effect: "block",
            gate: gates.schema,
            finding: "invalid Kubernetes field type",
          }),
          sensitiveEnvironmentValue: {
            ...checkRecord(sensitiveEnv, sensitiveEnvGate, {
              effect: "block",
              gate: gates.sensitiveEnv,
              finding: "literal AI_API_KEY in a Deployment",
            }),
            localFindingId: "CCVE-2025-5019",
            localReceipt: relativeRepo(proposedScanPath),
            objectCount: localScans.proposed.input.object_count,
            objectSetSha256: localScans.proposed.input.object_set_sha256,
          },
          secretBackedEnvironmentValue: {
            effect: "allow",
            finding: "AI_API_KEY uses valueFrom.secretKeyRef",
            gate: gates.sensitiveEnv,
            space: secretBackedEnv.space,
            unit: secretBackedEnv.slug,
            unitId: secretBackedEnv.unit.UnitID,
            gatePresent: secretBackedEnv.unit.ApplyGates?.[gates.sensitiveEnv] === true,
            gateObservation: secretBackedEnvGate,
            localReceipt: relativeRepo(reviewedScanPath),
            localFindingAbsent: !localScans.reviewed.findings.some(
              (finding) => finding.id === "CCVE-2025-5019",
            ),
            objectCount: localScans.reviewed.input.object_count,
            objectSetSha256: localScans.reviewed.input.object_set_sha256,
          },
          warnings: {
            effect: "warn",
            findings: [
              "workload image is not pinned by digest",
              "workload container has no liveness or readiness probe",
            ],
            triggers: warnings,
            space: spaces.baseline,
            unit: "warning-fixture",
            unitId: warning.unit.UnitID,
            validationKeys: Object.keys(warning.unit.ValidationResults ?? {}).sort(),
            applyGates: Object.keys(warning.unit.ApplyGates ?? {}).sort(),
            gateObservation: warningGate,
          },
          approval: approvalRecord,
          lifecycleRoute: {
            effect: "block",
            finding: "automatic lifecycle route has no observed evidence",
            gate: gates.lifecycle,
            result: "blocked",
            receipt: relativeRepo(lifecycleReceiptPath),
            testedAt: lifecycleReceipt.spec.negativeGateTest.testedAt,
          },
        },
        localScanner: {
          tool: "cub check",
          surface: "cub-scan",
          version: scannerVersion,
          patternBundle: localScans.proposed.pattern_bundle,
          proposedReceipt: relativeRepo(proposedScanPath),
          reviewedReceipt: relativeRepo(reviewedScanPath),
          proposedFindingIds: localScans.proposed.findings.map((finding) => finding.id),
          reviewedFindingIds: localScans.reviewed.findings.map((finding) => finding.id),
          advisoryOnly: true,
        },
        retainedResult: retained,
        promotion: {
          receipt: relativeRepo(byoPromotionReceiptPath),
          result: promotion.status.result,
          baseSpace: promotion.spec.chain.base.space,
          developmentSpace: promotion.spec.chain.development.space,
          stagingSpace: promotion.spec.chain.staging.space,
          field: promotion.spec.change.field,
          from: promotion.spec.change.baseValue,
          to: promotion.spec.change.stagingAfterPromotion,
        },
        cleanup,
        limits: [
          "No apply command was run. Current cub exposes managed ApplyGate state on each Unit but does not expose the former unit apply --dry-run command.",
          "The target assignment caused ConfigHub to evaluate the managed checks; this run does not test workload health or controller convergence.",
          "The fixtures prove the recorded checks for these exact inputs. They do not prove that every possible invalid configuration is detected.",
          "The sensitive-environment control maps to local finding CCVE-2025-5019, but the local scan and ConfigHub validation remain separate executions.",
          "The lifecycle-route result comes from the separately recorded Hooks and CRDs App fixture.",
          "The AICR image and Secret checks are exercised by the separate live AI change review proof.",
        ],
      },
      status: {
        result: "pass",
        claim: "The live catalog policy recorded blocking ApplyGates for a placeholder, invalid Kubernetes data, a literal credential environment value, and unapproved system configuration; left a Secret-backed environment value eligible, cleared the approval gate after the exact revision was approved, reported two advisory workload findings without adding an ApplyGate, and separately blocked an unsupported automatic lifecycle route.",
      },
    };
  } finally {
    for (const [key, slug] of [
      ["approvalSpace", spaces.approval],
      ["baselineSpace", spaces.baseline],
    ]) {
      const exists = cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      if (!exists) {
        cleanup[key] = cleanup[key] === "pending" ? "fail" : "not-created";
        continue;
      }
      const deleted = cubTry(context, [
        "space",
        "delete",
        slug,
        "--recursive-force",
        "--quiet",
      ]);
      const absent = !cubTry(context, ["space", "get", slug, "-o", "json"]).ok;
      cleanup[key] = deleted.ok && absent ? "pass" : "fail";
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }

  check(receipt, "the policy proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `policy proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(proposedScanPath, `${JSON.stringify(localScans.proposed, null, 2)}\n`);
  write(reviewedScanPath, `${JSON.stringify(localScans.reviewed, null, 2)}\n`);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function createSpace(context, { slug, filter, labels }) {
  cub(context, [
    "space",
    "create",
    slug,
    ...Object.entries(labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]),
    "--trigger-filter",
    filter,
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub(context, ["space", "update", "--patch", slug, "--refresh-triggers", "--quiet"]);
}

function assertSpaceTriggers(context, slug, expectedTriggerIds) {
  const space = cubJson(context, ["space", "get", slug, "-o", "json"]).Space;
  check(
    sameSet(space.TriggerIDs ?? [], expectedTriggerIds),
    `${slug} received the wrong Trigger set`,
  );
}

function writeFixtures(root) {
  const fixtures = {
    placeholder: {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "policy-placeholder-fixture",
        namespace: "default",
      },
      data: {
        "required-value": "confighubplaceholder",
      },
    },
    schema: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "policy-schema-fixture",
        namespace: "default",
      },
      spec: {
        replicas: "many",
        selector: {
          matchLabels: {
            app: "policy-schema-fixture",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "policy-schema-fixture",
            },
          },
          spec: {
            containers: [
              {
                name: "fixture",
                image: `example.invalid/fixture@sha256:${"0".repeat(64)}`,
                livenessProbe: {
                  httpGet: {
                    path: "/",
                    port: 8080,
                  },
                },
                readinessProbe: {
                  httpGet: {
                    path: "/",
                    port: 8080,
                  },
                },
              },
            ],
          },
        },
      },
    },
    warning: {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: "policy-warning-fixture",
        namespace: "default",
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: "policy-warning-fixture",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "policy-warning-fixture",
            },
          },
          spec: {
            containers: [
              {
                name: "fixture",
                image: "nginx:1.27",
              },
            ],
          },
        },
      },
    },
    approval: {
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: "policy-approval-fixture",
        namespace: "default",
      },
      data: {
        purpose: "prove that system configuration requires approval",
      },
    },
  };

  return Object.fromEntries(
    Object.entries(fixtures).map(([name, value]) => {
      const path = join(root, `${name}.yaml`);
      writeFileSync(path, `${toYaml(value)}\n`);
      return [name, path];
    }),
  );
}

function runLocalScans(root) {
  const result = {};
  for (const [name, inputPath] of [
    ["proposed", proposedRenderPath],
    ["reviewed", reviewedRenderPath],
  ]) {
    const outputPath = join(root, `${name}-cub-check.json`);
    command("cub", [
      "check",
      "--format",
      "json",
      "--output",
      outputPath,
      inputPath,
    ]);
    result[name] = JSON.parse(readFileSync(outputPath, "utf8"));
  }
  verifyLocalScans(result);
  return result;
}

function readCommittedLocalScans() {
  check(existsSync(proposedScanPath), `${relativeRepo(proposedScanPath)} is missing; run the live proof`);
  check(existsSync(reviewedScanPath), `${relativeRepo(reviewedScanPath)} is missing; run the live proof`);
  const scans = {
    proposed: JSON.parse(readFileSync(proposedScanPath, "utf8")),
    reviewed: JSON.parse(readFileSync(reviewedScanPath, "utf8")),
  };
  verifyLocalScans(scans);
  return scans;
}

function verifyLocalScans(scans) {
  verifyLocalScan(scans.proposed, proposedRenderPath);
  verifyLocalScan(scans.reviewed, reviewedRenderPath);
  check(
    scans.proposed.findings.some((finding) => finding.id === "CCVE-2025-5019"),
    "proposed NGINX scan no longer reports CCVE-2025-5019",
  );
  check(
    !scans.reviewed.findings.some((finding) => finding.id === "CCVE-2025-5019"),
    "reviewed NGINX scan still reports CCVE-2025-5019",
  );
  const serialized = JSON.stringify(scans);
  check(!serialized.includes("sk-prod-old-key-rotate-me"), "cub check receipt contains the literal API key");
}

function verifyLocalScan(scan, inputPath) {
  const docs = parseDocs(readFileSync(inputPath, "utf8"));
  const identity = scannerInputIdentity(docs);
  check(scan.schema_version === "risk-scan-findings-v1", "cub check schema changed");
  check(scan.surface === "cub-scan", "cub check surface changed");
  check(scan.finding_count === scan.findings?.length, "cub check finding count changed");
  check(
    scan.provenance?.source === "cub-scan"
      && scan.provenance?.source_version === scannerVersion
      && scan.pattern_bundle?.version === scannerVersion
      && scan.pattern_bundle?.source_repo === "confighubai/confighub-scan",
    "cub check scanner or bundle identity changed",
  );
  for (const field of ["manifest_sha256", "catalog_sha256"]) {
    check(/^[a-f0-9]{64}$/.test(scan.pattern_bundle?.[field] ?? ""), `cub check ${field} is invalid`);
  }
  check(
    scan.input?.object_count === identity.objectCount
      && scan.input?.object_set_sha256 === identity.objectSetSha256,
    `cub check input identity does not match ${relativeRepo(inputPath)}`,
  );
}

function scannerInputIdentity(docs) {
  const objects = docs
    .map((doc) => JSON.stringify(canonicalJson(doc)))
    .sort();
  return {
    objectCount: objects.length,
    objectSetSha256: `sha256:${sha256(`${objects.join("\n")}\n`)}`,
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function readRetainedReviewedResult(context, topology) {
  const space = cubJson(context, ["space", "get", retainedSpace, "-o", "json"]).Space;
  const unit = cubJson(
    context,
    ["unit", "get", retainedUnit, "--space", retainedSpace, "-o", "json"],
  ).Unit;
  check(unit?.Data, `${retainedSpace}/${retainedUnit} has no stored data`);
  const docs = parseDocs(Buffer.from(unit.Data, "base64").toString("utf8"));
  const identity = scannerInputIdentity(docs);
  const expected = scannerInputIdentity(parseDocs(readFileSync(reviewedRenderPath, "utf8")));
  check(
    identity.objectCount === expected.objectCount
      && identity.objectSetSha256 === expected.objectSetSha256,
    "retained ConfigHub base differs from the reviewed NGINX objects",
  );
  const trigger = getByRef(context, "trigger", "platform/workload-sensitive-env-secret-refs").Trigger;
  check(
    (space.TriggerIDs ?? []).includes(trigger.TriggerID)
      && topology.baseline.triggerIds.includes(trigger.TriggerID),
    "retained ConfigHub base does not have the sensitive-environment control",
  );
  check(
    unit.ApplyGates?.[gates.sensitiveEnv] !== true
      && unit.ApplyGates?.["awaiting/triggers"] !== true,
    "retained reviewed NGINX revision is blocked or still awaiting validation",
  );
  const upload = readYaml(byoHubReceiptPath);
  check(
    upload.status?.result === "pass"
      && upload.spec?.space?.slug === retainedSpace
      && upload.spec?.units?.some((item) => item.id === unit.UnitID),
    "retained NGINX upload receipt changed",
  );
  return {
    space: retainedSpace,
    spaceId: space.SpaceID,
    unit: retainedUnit,
    unitId: unit.UnitID,
    headRevision: unit.HeadRevisionNum,
    objectCount: identity.objectCount,
    objectSetSha256: identity.objectSetSha256,
    sourceOci: space.Annotations?.ExternalSource ?? "",
    sourceDigest: space.Annotations?.ExternalSourceDigest ?? "",
    policy: {
      filter: baselineFilterRef,
      control: "workload-sensitive-env-secret-refs",
      trigger: "platform/workload-sensitive-env-secret-refs",
      triggerAttached: true,
      gatePresent: false,
    },
    receipt: relativeRepo(byoHubReceiptPath),
  };
}

function verifyPromotionReceipt(receipt, retained) {
  check(
    receipt.kind === "BringYourOwnHelmValuesPromotionReceipt"
      && receipt.status?.result === "pass"
      && receipt.spec?.chain?.base?.space === retainedSpace
      && receipt.spec?.chain?.base?.configurationUnit?.id === retained.unitId
      && receipt.spec?.change?.field === "spec.replicas"
      && receipt.spec?.change?.baseValue === 3
      && receipt.spec?.change?.stagingAfterPromotion === 4
      && receipt.spec?.promotion?.result === "pass",
    "reviewed NGINX promotion receipt changed",
  );
}

function createAndReadFixture(
  context,
  {
    space,
    slug,
    path,
    expectedGate = "",
    expectedWarnings = [],
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
    "Proof=config-catalog-policy-functional",
    "--change-desc",
    "Create a temporary apply-policy proof fixture",
    "--quiet",
  ]);
  cub(context, ["unit", "set-target", "--space", space, slug, targetRef, "--quiet"]);
  const unit = waitForResult(context, {
    space,
    slug,
    expectedGate,
    expectedWarnings,
  });
  check(unit.TargetID, `${space}/${slug} has no target`);
  return { space, slug, unit };
}

function waitForResult(
  context,
  {
    space,
    slug,
    expectedGate,
    expectedWarnings,
  },
) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const unit = cubJson(context, ["unit", "get", slug, "--space", space, "-o", "json"]).Unit;
    const gateFound = !expectedGate || unit.ApplyGates?.[expectedGate] === true;
    const validationKeys = Object.keys(unit.ValidationResults ?? {});
    const warningsFound = expectedWarnings.every((key) => validationKeys.includes(key));
    const waiting = unit.ApplyGates?.["awaiting/triggers"] === true;
    if (gateFound && warningsFound && !waiting) return unit;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`${space}/${slug} did not receive its expected policy result within 60 seconds`);
}

function blockedGateObservation(fixture, expectedGate) {
  check(
    fixture.unit.ApplyGates?.[expectedGate] === true,
    `${fixture.space}/${fixture.slug} did not record ${expectedGate}`,
  );
  return {
    result: "blocked",
    gate: expectedGate,
    source: "Unit.ApplyGates",
    gatePresent: true,
    applicationAttempted: false,
  };
}

function allowedGateObservation(fixture, expectedGate = undefined) {
  const gateKeys = Object.keys(fixture.unit.ApplyGates ?? {});
  check(
    !expectedGate || !gateKeys.includes(expectedGate),
    `${fixture.space}/${fixture.slug} unexpectedly recorded ${expectedGate}`,
  );
  return {
    result: "eligible",
    source: "Unit.ApplyGates",
    gatePresent: false,
    applyGates: gateKeys.sort(),
    applicationAttempted: false,
  };
}

function approveAndObserveGateClear(context, space, slug) {
  const before = cubJson(
    context,
    ["unit", "get", slug, "--space", space, "-o", "json"],
  ).Unit;
  const revision = before.HeadRevisionNum;
  check(
    Number.isInteger(revision) && revision > 0,
    `${space}/${slug} has no revision to approve`,
  );
  cub(context, [
    "unit",
    "approve",
    "--space",
    space,
    slug,
    "--revision",
    "HeadRevisionNum",
    "--wait",
    "--quiet",
  ]);
  const approved = waitForGateToClear(context, {
    space,
    slug,
    gate: gates.approval,
  });
  return {
    result: "eligible",
    revisionSelector: "HeadRevisionNum",
    headRevisionBefore: revision,
    headRevisionAfter: approved.HeadRevisionNum,
    recordedApprovals: approvalCount(approved.ApprovedBy),
    gateCleared: approved.ApplyGates?.[gates.approval] !== true,
    gateObservation: {
      result: "eligible",
      source: "Unit.ApplyGates",
      gatePresent: approved.ApplyGates?.[gates.approval] === true,
      applicationAttempted: false,
    },
  };
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function waitForGateToClear(context, { space, slug, gate }) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const unit = cubJson(context, ["unit", "get", slug, "--space", space, "-o", "json"]).Unit;
    const waiting = unit.ApplyGates?.["awaiting/triggers"] === true;
    if (unit.ApplyGates?.[gate] !== true && !waiting) return unit;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(`${space}/${slug} still had ${gate} after approval`);
}

function checkRecord(fixture, gateObservation, { effect, gate, finding }) {
  return {
    effect,
    finding,
    gate,
    space: fixture.space,
    unit: fixture.slug,
    unitId: fixture.unit.UnitID,
    validationKeys: Object.keys(fixture.unit.ValidationResults ?? {}).sort(),
    applyGates: Object.keys(fixture.unit.ApplyGates ?? {}).sort(),
    gateObservation,
  };
}

function readTopology(context) {
  const refs = {
    baseline: {
      filter: baselineFilterRef,
      triggers: [
        "platform/aicr-training-images-pinned",
        "platform/aicr-training-secret-refs",
        "platform/digest-pinned-images",
        "platform/lifecycle-route-evidence",
        "platform/probes-declared",
        "platform/vet-placeholders",
        "platform/vet-schemas",
        "platform/workload-sensitive-env-secret-refs",
      ],
    },
    approvalRequired: {
      filter: approvalFilterRef,
      triggers: [
        "platform/aicr-training-images-pinned",
        "platform/aicr-training-secret-refs",
        "platform/digest-pinned-images",
        "platform/lifecycle-route-evidence",
        "platform/probes-declared",
        "platform/require-approval",
        "platform/vet-placeholders",
        "platform/vet-schemas",
        "platform/workload-sensitive-env-secret-refs",
      ],
    },
  };

  return Object.fromEntries(
    Object.entries(refs).map(([name, definition]) => {
      const filter = getByRef(context, "filter", definition.filter).Filter;
      const triggers = definition.triggers.map(
        (ref) => getByRef(context, "trigger", ref).Trigger,
      );
      return [name, {
        ref: definition.filter,
        id: filter.FilterID,
        hash: String(filter.Hash ?? "").trim(),
        triggerRefs: definition.triggers,
        triggerIds: triggers.map((trigger) => trigger.TriggerID).sort(),
      }];
    }),
  );
}

function getByRef(context, entity, ref) {
  const [space, slug] = ref.split("/");
  return cubJson(context, [entity, "get", "--space", space, slug, "-o", "json"]);
}

function verifyLifecycleReceipt(receipt) {
  check(receipt.kind === "HooksCrdsAppLiveReceipt", "Hooks and CRDs receipt kind changed");
  check(
    receipt.spec?.negativeGateTest?.result === "blocked"
      && receipt.spec?.negativeGateTest?.gate === gates.lifecycle,
    "Hooks and CRDs receipt no longer proves the lifecycle-route gate",
  );
}

function verifyReceipt(receipt) {
  const localScans = readCommittedLocalScans();
  check(
    receipt.kind === "ConfigCatalogApplyPolicyFunctionalProofReceipt",
    "policy functional receipt kind changed",
  );
  check(receipt.status?.result === "pass", "policy functional proof is not pass");
  check(receipt.spec?.context?.organization === expectedOrg, "policy proof organization changed");
  check(
    receipt.spec?.target?.applicationAttempted === false
      && receipt.spec.target.validationMode === "authoritative Unit gate state",
    "policy proof must observe gate state without attempting an apply",
  );
  check(
    typeof receipt.spec?.target?.ref === "string"
      && receipt.spec.target.ref.includes("/")
      && receipt.spec.target.provider === "OCI",
    "policy proof target is not a recorded OCI target",
  );

  for (const [name, gate] of [
    ["placeholder", gates.placeholder],
    ["schema", gates.schema],
    ["sensitiveEnvironmentValue", gates.sensitiveEnv],
    ["approval", gates.approval],
  ]) {
    const result = receipt.spec?.checks?.[name];
    check(result?.effect === "block", `${name} is no longer blocking`);
    check(result?.gate === gate, `${name} gate changed`);
    check(result?.applyGates?.includes(gate), `${name} gate was not recorded on the Unit`);
    check(
      result?.gateObservation?.result === "blocked"
        && result.gateObservation.source === "Unit.ApplyGates"
        && result.gateObservation.gatePresent === true
        && result.gateObservation.applicationAttempted === false
        && result.gateObservation.gate === gate,
      `${name} ApplyGate observation is incomplete`,
    );
  }

  const secretBacked = receipt.spec?.checks?.secretBackedEnvironmentValue;
  check(
    secretBacked?.effect === "allow"
      && secretBacked.gate === gates.sensitiveEnv
      && secretBacked.gatePresent === false
      && secretBacked.gateObservation?.result === "eligible"
      && secretBacked.gateObservation?.source === "Unit.ApplyGates"
      && secretBacked.gateObservation?.gatePresent === false
      && secretBacked.gateObservation?.applicationAttempted === false,
    "Secret-backed environment fixture did not clear the credential gate",
  );
  check(
    receipt.spec?.checks?.sensitiveEnvironmentValue?.localFindingId === "CCVE-2025-5019",
    "local scanner mapping for the credential gate changed",
  );
  check(
    receipt.spec.checks.sensitiveEnvironmentValue.localReceipt === relativeRepo(proposedScanPath)
      && receipt.spec.checks.sensitiveEnvironmentValue.objectCount
        === localScans.proposed.input.object_count
      && receipt.spec.checks.sensitiveEnvironmentValue.objectSetSha256
        === localScans.proposed.input.object_set_sha256
      && receipt.spec.checks.secretBackedEnvironmentValue.localReceipt
        === relativeRepo(reviewedScanPath)
      && receipt.spec.checks.secretBackedEnvironmentValue.localFindingAbsent === true
      && receipt.spec.checks.secretBackedEnvironmentValue.objectCount
        === localScans.reviewed.input.object_count
      && receipt.spec.checks.secretBackedEnvironmentValue.objectSetSha256
        === localScans.reviewed.input.object_set_sha256,
    "exact local scan evidence changed",
  );
  check(
    receipt.spec?.localScanner?.tool === "cub check"
      && receipt.spec.localScanner.surface === "cub-scan"
      && receipt.spec.localScanner.version === scannerVersion
      && receipt.spec.localScanner.advisoryOnly === true
      && receipt.spec.localScanner.proposedReceipt === relativeRepo(proposedScanPath)
      && receipt.spec.localScanner.reviewedReceipt === relativeRepo(reviewedScanPath)
      && sameSet(
        receipt.spec.localScanner.proposedFindingIds,
        localScans.proposed.findings.map((finding) => finding.id),
      )
      && sameSet(
        receipt.spec.localScanner.reviewedFindingIds,
        localScans.reviewed.findings.map((finding) => finding.id),
      )
      && JSON.stringify(canonicalJson(receipt.spec.localScanner.patternBundle))
        === JSON.stringify(canonicalJson(localScans.proposed.pattern_bundle)),
    "local scanner provenance changed",
  );

  const retained = receipt.spec?.retainedResult;
  check(
    retained?.space === retainedSpace
      && retained.unit === retainedUnit
      && Number.isInteger(retained.headRevision)
      && retained.headRevision > 0
      && retained.objectCount === localScans.reviewed.input.object_count
      && retained.objectSetSha256 === localScans.reviewed.input.object_set_sha256
      && retained.policy?.control === "workload-sensitive-env-secret-refs"
      && retained.policy?.trigger === "platform/workload-sensitive-env-secret-refs"
      && retained.policy?.triggerAttached === true
      && retained.policy?.gatePresent === false
      && retained.receipt === relativeRepo(byoHubReceiptPath),
    "retained reviewed result evidence changed",
  );
  check(
    receipt.spec?.promotion?.receipt === relativeRepo(byoPromotionReceiptPath)
      && receipt.spec.promotion.result === "pass"
      && receipt.spec.promotion.baseSpace === retainedSpace
      && receipt.spec.promotion.field === "spec.replicas"
      && receipt.spec.promotion.from === 3
      && receipt.spec.promotion.to === 4,
    "promotion evidence link changed",
  );

  const approvalAfterReview = receipt.spec?.checks?.approval?.afterApproval;
  check(
    approvalAfterReview?.result === "eligible"
      && approvalAfterReview.revisionSelector === "HeadRevisionNum"
      && Number.isInteger(approvalAfterReview.headRevisionBefore)
      && approvalAfterReview.headRevisionBefore > 0
      && Number.isInteger(approvalAfterReview.headRevisionAfter)
      && approvalAfterReview.headRevisionAfter >= approvalAfterReview.headRevisionBefore
      && approvalAfterReview.recordedApprovals >= 1
      && approvalAfterReview.gateCleared === true
      && approvalAfterReview.gateObservation?.result === "eligible"
      && approvalAfterReview.gateObservation?.source === "Unit.ApplyGates"
      && approvalAfterReview.gateObservation?.gatePresent === false
      && approvalAfterReview.gateObservation?.applicationAttempted === false,
    "approved system configuration did not clear its ApplyGate",
  );

  const warning = receipt.spec?.checks?.warnings;
  check(warning?.effect === "warn", "workload findings are no longer advisory");
  check(sameSet(warning?.triggers ?? [], warnings), "warning Trigger set changed");
  check(sameSet(warning?.validationKeys ?? [], warnings), "warning results changed");
  check((warning?.applyGates ?? []).length === 0, "warning-only Unit gained an ApplyGate");
  check(
    warning?.gateObservation?.result === "eligible"
      && warning.gateObservation.source === "Unit.ApplyGates"
      && warning.gateObservation.applicationAttempted === false,
    "warning-only Unit gained a blocking observation",
  );

  const lifecycle = receipt.spec?.checks?.lifecycleRoute;
  check(
    lifecycle?.result === "blocked"
      && lifecycle?.gate === gates.lifecycle
      && lifecycle?.receipt === relativeRepo(lifecycleReceiptPath),
    "lifecycle-route proof reference changed",
  );
  verifyLifecycleReceipt(readYaml(lifecycleReceiptPath));
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "policy proof cleanup did not pass",
  );
  check(
    !JSON.stringify(receipt).includes(["cub", "lk"].join("-"))
      && !JSON.stringify(receipt).includes(["cub", "lk"].join(" ")),
    "policy proof contains an obsolete cluster command",
  );
  check(
    !JSON.stringify(receipt).includes("sk-prod-old-key-rotate-me"),
    "policy proof contains the literal API key",
  );
}

// Legacy receipt projection: keep byte compatibility with the retained summary.
// The repository legacy index supplies its version boundary. This renderer is
// not current workflow setup guidance and --run cannot recapture live state.
function renderSummary(receipt) {
  const checks = receipt.spec.checks;
  return `# How the live catalog checks behave

This page comes from a committed live receipt. Rerun the isolated fixtures with
\`npm run config-catalog:policy:run\`, or check the committed result without contacting
ConfigHub with \`npm run config-catalog:policy:verify\`.

The test created temporary configuration records in the live \`helm-catalog\`
organization and assigned an OCI target so ConfigHub would evaluate its managed
checks. It read the resulting ApplyGates from each Unit. No apply command ran and
no fixture configuration was sent to Kubernetes.

## One configuration from review to promotion

The NGINX example starts with values proposed by a coding agent. The rendered
Deployment contains a literal \`AI_API_KEY\`. Local \`cub check\` reports
\`CCVE-2025-5019\` against ${checks.sensitiveEnvironmentValue.objectCount} objects
with object-set hash \`${checks.sensitiveEnvironmentValue.objectSetSha256}\`.
ConfigHub then checks those same objects independently and records a blocking
ApplyGate on the stored revision.

The reviewed version removes the literal and refers to an existing Secret.
Local \`cub check\` no longer reports \`CCVE-2025-5019\`, and ConfigHub leaves the
reviewed revision eligible for delivery. The reviewed ${receipt.spec.retainedResult.objectCount}-object result
is stored in \`${receipt.spec.retainedResult.space}\` at revision
\`${receipt.spec.retainedResult.headRevision}\`. Its scanner object-set hash is
\`${receipt.spec.retainedResult.objectSetSha256}\`.

That saved result is the base of the existing development-to-staging example.
ConfigHub promoted \`${receipt.spec.promotion.field}\` from
\`${receipt.spec.promotion.from}\` to \`${receipt.spec.promotion.to}\` without
removing the Secret reference or the other reviewed settings. The remaining
local \`${receipt.spec.localScanner.reviewedFindingIds.join(", ")}\` result is an
advisory about \`emptyDir\`; it was not relabeled as a credential failure.

This is the boundary: \`cub check\` gives local advice for exact files. ConfigHub
runs a managed gate against the stored revision and can keep that revision in a
promotion chain.

| Configuration tested | What ConfigHub did |
| --- | --- |
| A ConfigMap containing an unresolved placeholder | Blocked it |
| A Deployment whose replica count was text instead of a number | Blocked it |
| A Deployment containing a literal AI API key | Blocked it |
| The same environment variable using a Secret reference | Left it eligible for delivery |
| A Deployment with an unpinned image and no health probes | Reported both warnings without adding an ApplyGate |
| System configuration with no approval | Blocked it |
| The same system configuration after its exact revision was approved | Cleared the approval gate |
| A lifecycle route claiming automatic work without evidence | Blocked it in the separately recorded Hooks and CRDs test |

The first five fixtures used the eight common checks. The two AICR checks did
nothing to these ordinary Kubernetes objects, as intended. The
system-configuration fixture used the same checks plus required approval. Its first
revision carried the approval gate. After the test approved that exact revision, the
gate cleared. This confirms that approval is added where it is needed without turning
ordinary warnings into blockers or leaving an approved revision permanently blocked.

The literal credential test maps the local scanner finding \`CCVE-2025-5019\` to
the managed ConfigHub gate \`platform/workload-sensitive-env-secret-refs\`. The
local result remains advice; ConfigHub evaluates its own gate against the stored
revision before delivery.

The [AI change review proof](../ai-change-review-live-proof/summary.md) tests the
other side of the same rule: an AICR training runtime receives checks for its actual
nested image and API-key fields, while the ordinary Deployment checks leave it alone.

All temporary Spaces were deleted. The target was used only to cause managed check
evaluation; this did not test a Kubernetes rollout or application health.

- [Committed functional receipt](../../runs/config-catalog-policy-functional-proof/receipt.yaml)
- [Proposed local scan](../../${relativeRepo(proposedScanPath)})
- [Reviewed local scan](../../${relativeRepo(reviewedScanPath)})
- [Reviewed values and rendered objects](../byo-helm-values-review/summary.md)
- [Development-to-staging promotion](../byo-helm-values-promotion-proof/summary.md)
- [Live filter and Space assignments](../apply-policy-profiles/live-helm-catalog.yaml)
- [Hooks and CRDs policy receipt](../hooks-crds-app/live-receipt.yaml)
- [Maintained policy definition](../../config-catalog/policies/catalog-standard.yaml)
`;
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnv(context),
  });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(context),
  });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
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
  const { executor = currentExecutor ?? execFileSync, ...commandOptions } = options;
  return executor(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...commandOptions,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}
