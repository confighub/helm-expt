#!/usr/bin/env node

// Historical phase names are retained as blocked legacy commands. Current
// phases use ChangeWorkflow/ChangeOrder Approval attestations and write a new
// receipt family; they never rewrite the retained Trigger-era record.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalObjectMaps, check, parseDocs, readYaml, relativeRepo, repoRoot, serializeYaml, write, writeYaml } from "./lib/proof-common.mjs";
import {
  assertActiveApproval,
  assertChangeOrderBinding,
  assertChangeOrderRevisionCoverage,
  assertNotRevoked,
  assertWorkflowReleasePrerequisite,
} from "./lib/changeorder-attestation.mjs";

const mode = process.argv[2];
const RENDER = join(repoRoot, "packages", "bitnami", "redis", "25.5.3", "bases", "reuse-existing-secret", "upstream.yaml");
const historicalRoot = join(repoRoot, "data", "ai-operator-ladder");
let currentRoot = join(repoRoot, "runs", "ai-operator-ladder-attestation-v1");
let currentSummaryPath = join(repoRoot, "data", "ai-operator-ladder-attestation-v1", "summary.md");
const native = {
  component: "redis-ladder-native",
  base: "redis-ladder-native-base",
  cluster: "redis-ladder-native-cluster",
  dev: "redis-ladder-native-dev",
  staging: "redis-ladder-native-staging",
  owner: "AI Operator Ladder",
  proofLabel: "ai-operator-ladder-attestation-v1",
  workflow: "redis-ladder-native-review",
  changeOrder: "redis-ladder-native-change",
  stage: "staging",
  prerequisite: "release-approval",
};
const phaseModes = new Set([
  "--upload-current", "--release-current", "--change-current", "--promote-current",
  "--gate-current", "--capture-current", "--down-current", "--verify-current",
  "--self-test-current",
]);
let commandRunner = realCub;

// The old phase names remain blocked so no caller can overwrite the preserved
// approval-era receipt. The current suffix names opt into the native proof.
const legacyModes = ["--upload", "--release", "--change", "--promote", "--gate", "--capture", "--down"];
if (legacyModes.includes(mode)) {
  console.error("blocked: this phase belongs to the retained Trigger-era ladder; use the matching *-current phase to write attestation-v1 evidence");
  process.exit(1);
}

if (mode === "--check") {
  console.log(cub("check", RENDER));
} else if (mode === "--self-test-current") {
  selfTestCurrentGraph();
  console.log("AI operator ladder native self-test passed: complete phase graph, exact release prerequisite, whole-space subjects, refusal, approval, and separate receipt paths");
} else if (mode === "--verify-current") {
  const receiptPath = join(currentRoot, "receipt.yaml");
  check(existsSync(receiptPath), `${receiptPath} is missing; no native ladder receipt has been captured`);
  const receipt = readYaml(receiptPath);
  verifyCurrentReceipt(receipt);
  check(existsSync(currentSummaryPath) && readFileSync(currentSummaryPath, "utf8") === renderCurrentSummary(receipt),
    `${currentSummaryPath} is stale`);
  console.log("verified the current AI operator ladder receipt");
} else if (phaseModes.has(mode)) {
  ensureReviewedVersion();
  switch (mode) {
    case "--upload-current": currentUpload(); break;
    case "--release-current": currentRelease(); break;
    case "--change-current": currentChange(); break;
    case "--promote-current": currentPromote(); break;
    case "--gate-current": currentGate(); break;
    case "--capture-current": currentCapture(); break;
    case "--down-current": currentDown(); break;
    default: check(false, `unsupported current ladder mode ${mode}`);
  }
} else {
  check(false, "usage: run-ai-operator-ladder-proof.mjs --check | --upload-current | --release-current | --change-current | --promote-current | --gate-current | --capture-current | --verify-current | --down-current | --self-test-current");
}

function currentUpload() {
  ensureNoExistingSpace(native.base);
  const organization = currentOrganization();
  const source = canonicalHash(readFileSync(RENDER, "utf8"));
  check(source.objects === 13, `the checked Redis render has ${source.objects} objects, expected 13`);
  cub("variant", "upload", "--component", native.component, "--variant", "base",
    "--owner", native.owner, "--space-label", `Proof=${native.proofLabel}`,
    "--source-name", native.proofLabel, RENDER);
  const base = getSpace(native.base);
  check(base.ComponentID, "native Redis base has no server ComponentID");
  const units = listUnits(native.base);
  check(units.length === source.objects, `native base has ${units.length} Units, expected ${source.objects}`);
  check(canonicalHash(dumpSpace(native.base)).hash === source.hash,
    "uploaded ConfigHub base does not match the checked Redis render");
  saveState({
    organization,
    componentID: base.ComponentID,
    baseSpaceID: base.SpaceID,
    source,
    unitIDs: units.map((unit) => unit.UnitID).sort(),
    phases: { upload: "pass" },
  });
  console.log(`uploaded ${units.length} Redis resources into ${native.base}`);
}

function currentRelease() {
  const state = loadState();
  assertOrganization(state.organization);
  checkNoCurrentSpace(native.cluster);
  checkNoCurrentSpace(native.dev);
  checkNoCurrentSpace(native.staging);
  cub("space", "create", native.cluster, "--owner", native.owner, "--label", `Proof=${native.proofLabel}`);
  const cluster = getSpace(native.cluster);
  check(cluster.SpaceID && cluster.Labels?.Proof === native.proofLabel,
    "native cluster Space readback is missing its ID or ownership marker");
  saveState({ ...state, clusterSpaceID: cluster.SpaceID, phases: { ...state.phases, cluster: "pass" } });
  cub("worker", "create", "worker", "--space", native.cluster, "--is-server-worker");
  cub("target", "create", "target", "{}", "worker", "--space", native.cluster, "-p", "OCI", "-t", "Any");
  cub("variant", "create", "dev", native.base, "--target", `${native.cluster}/target`, "--wait");
  const dev = getSpace(native.dev);
  saveState({ ...state, clusterSpaceID: cluster.SpaceID, devSpaceID: dev.SpaceID,
    phases: { ...state.phases, cluster: "pass", devVariant: "pass" } });
  cub("variant", "create", "staging", native.base, "--target", `${native.cluster}/target`, "--wait");
  const staging = getSpace(native.staging);
  check(dev.ComponentID === state.componentID && staging.ComponentID === state.componentID,
    "native variants do not retain the uploaded Component identity");
  check(listUnits(native.dev).length === state.source.objects && listUnits(native.staging).length === state.source.objects,
    "native dev/staging variants do not contain the full uploaded Unit set");
  const release = publish(native.dev);
  saveState({ ...state, clusterSpaceID: getSpace(native.cluster).SpaceID,
    devSpaceID: dev.SpaceID, stagingSpaceID: staging.SpaceID,
    initialDevRelease: release, phases: { ...state.phases, release: "pass" } });
  console.log(`dev variant released: ${release.manifestDigest}`);
}

function currentChange() {
  const state = loadState();
  assertOrganization(state.organization);
  assertCurrentSpaceIdentities(state);
  const before = canonicalHash(dumpSpace(native.base));
  check(before.hash === state.source.hash, "Redis base changed before the two governed edits");
  for (const [unit, replicas, description] of [
    ["redis-statefulset-redis-master", "2", "AI operator ladder: master to two replicas"],
    ["redis-statefulset-redis-replicas", "4", "AI operator ladder: scale the replicas tier to four"],
  ]) {
    cub("function", "do", "--space", native.base, "--unit", unit,
      "set-replicas", replicas, "--change-desc", description);
  }
  const master = parseDocs(cub("unit", "data", "--space", native.base, "redis-statefulset-redis-master"))[0];
  const replicas = parseDocs(cub("unit", "data", "--space", native.base, "redis-statefulset-redis-replicas"))[0];
  check(master?.spec?.replicas === 2 && replicas?.spec?.replicas === 4,
    "ConfigHub readback does not show the two exact governed replica values");
  const baseHead = canonicalHash(dumpSpace(native.base));
  check(baseHead.hash !== before.hash, "the two governed edits did not change the base object set");
  saveState({ ...state, changedBase: baseHead, phases: { ...state.phases, change: "pass" } });
  console.log("recorded both governed Redis replica changes on the base");
}

function currentPromote() {
  const state = loadState();
  assertOrganization(state.organization);
  assertCurrentSpaceIdentities(state);
  check(state.phases.change === "pass", "run --change-current before promoting");
  const source = getSpace(native.base);
  const staging = getSpace(native.staging);
  check(source.ComponentID === state.componentID && staging.ComponentID === state.componentID,
    "source/staging Component identity changed before promotion");
  const exactWhereSpace = `SpaceID = '${staging.SpaceID}'`;
  const contract = workflowContract(source.SpaceID, exactWhereSpace);
  const temp = mkdtempSync(join(tmpdir(), "redis-ladder-workflow-"));
  const path = join(temp, "workflow.json");
  try {
    writeFileSync(path, `${JSON.stringify({
      Stages: [{ Name: native.stage, WhereSpace: exactWhereSpace, ReleasePrerequisites: [native.prerequisite] }],
      AttestationPrerequisites: [{ Name: native.prerequisite, Type: "Approval", Count: 1, AllowAuthors: true, IgnoreFail: false }],
    })}\n`);
    cub("changeworkflow", "create", "--space", native.base, native.workflow, "--filename", path, "--quiet");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  const workflow = cubJson("changeworkflow", "get", "--space", native.base, native.workflow, "-o", "json").ChangeWorkflow;
  contract.workflow.id = workflow?.ChangeWorkflowID;
  check(contract.workflow.id, "ChangeWorkflow readback omitted its ID");
  assertWorkflowReleasePrerequisite(workflow, contract, check);
  const baseUnits = listUnits(native.base).sort(byUnitID);
  check(baseUnits.length === state.source.objects, "base Unit membership changed before ChangeOrder creation");
  const reviewed = baseUnits.map((unit) => readReviewedHead(native.base, unit));
  cub("changeorder", "create", "--space", native.base, native.changeOrder,
    "--component", state.componentID, "--in-scope-space", native.staging,
    "--change-workflow", `${native.base}/${native.workflow}`,
    "--description", "AI operator ladder: promote the two governed Redis changes to staging", "--quiet");
  const changeOrder = cubJson("changeorder", "get", "--space", native.base, native.changeOrder, "-o", "json").ChangeOrder;
  contract.changeOrder = { space: native.base, slug: native.changeOrder, id: changeOrder?.ChangeOrderID, endTagID: changeOrder?.EndTagID };
  assertChangeOrderBinding(changeOrder, contract, check, staging.SpaceID);
  check(changeOrder.InScopeSpaceIDs.length === 1 && changeOrder.InScopeSpaceIDs[0] === staging.SpaceID,
    "ChangeOrder is not scoped exactly to the native staging Space");
  const exactBaseRevisions = reviewed.map((unit) => readChangeOrderRevision(native.base, changeOrder.ChangeOrderID, unit));
  const promotion = cub("variant", "promote", "--change-order", `${native.base}/${native.changeOrder}`,
    "--target-stage", native.stage, "--change-desc", "AI operator ladder: promote reviewed Redis changes to staging");
  const baseHash = canonicalHash(dumpSpace(native.base));
  const stagingHash = canonicalHash(dumpSpace(native.staging));
  check(baseHash.hash === state.changedBase.hash && stagingHash.hash === baseHash.hash,
    "staging does not canonically equal the changed base after ChangeOrder promotion");
  const stagingUnits = listUnits(native.staging).sort(byUnitID);
  check(stagingUnits.length === exactBaseRevisions.length, "staging membership differs from ChangeOrder revision coverage");
  const stageRevisions = stagingUnits.map((unit) => readChangeOrderRevision(native.staging, changeOrder.ChangeOrderID, unit));
  saveState({ ...state, workflowID: workflow.ChangeWorkflowID, orderID: changeOrder.ChangeOrderID,
    endTagID: changeOrder.EndTagID, promotion: { output: promotion.trim().slice(0, 1000) },
    baseRevisions: exactBaseRevisions, stagingRevisions: stageRevisions,
    baseHead: baseHash, stagingHead: stagingHash,
    phases: { ...state.phases, promote: "pass" } });
  console.log(`promoted ${stageRevisions.length} exact ChangeOrder Unit revisions into ${native.staging}`);
}

function currentGate() {
  const state = loadState();
  assertOrganization(state.organization);
  assertCurrentSpaceIdentities(state);
  check(state.phases.promote === "pass" && state.orderID && state.workflowID,
    "run --promote-current before gating/releasing");
  const contract = currentContract(state);
  const workflow = cubJson("changeworkflow", "get", "--space", native.base, native.workflow, "-o", "json").ChangeWorkflow;
  assertWorkflowReleasePrerequisite(workflow, contract, check);
  const changeOrder = cubJson("changeorder", "get", "--space", native.base, native.changeOrder, "-o", "json").ChangeOrder;
  assertChangeOrderBinding(changeOrder, contract, check, state.stagingSpaceID);
  check(changeOrder.InScopeSpaceIDs.length === 1 && changeOrder.InScopeSpaceIDs[0] === state.stagingSpaceID,
    "ChangeOrder staging scope changed before approval");
  const units = listUnits(native.staging).sort(byUnitID);
  const selected = units.map((unit) => readChangeOrderRevision(native.staging, state.orderID, unit));
  check(sameRevisionSet(selected, state.stagingRevisions), "current staging revisions differ from the reviewed promotion set");
  const revision = `ChangeOrder:${state.orderID}`;
  const beforeReleases = listReleases(native.staging);
  const refused = cubTry("release", "publish", "--revision", revision, native.staging, "-o", "json");
  check(!refused.ok && /requires review: 1 Approval attestation\(s\)/.test(refused.error),
    `staging release did not return the exact ChangeWorkflow Approval refusal: ${refused.error || refused.output}`);
  const afterRefusal = listReleases(native.staging);
  check(afterRefusal.length === beforeReleases.length, "refused release created a Release");
  const approvalResult = cubJson("variant", "approve", "--change-order", `${native.base}/${native.changeOrder}`,
    "--stage", native.stage, "--revision", revision, "--all", "-o", "json");
  const attestation = assertMultiUnitApproval(approvalResult, {
    space: native.staging,
    changeOrderID: state.orderID,
    subjects: selected,
  });
  const active = assertActiveApproval(cubJson("attestation", "get", attestation.id, "-o", "json"),
    { attestationID: attestation.id, changeOrderID: state.orderID }, check);
  const attestationRows = cubJson("attestation", "list", "--space", native.staging, "-o", "json");
  assertNotRevoked((attestationRows ?? []).map((row) => row.Attestation ?? row)
    .filter((row) => row.RevokedAttestationID === attestation.id), check);
  const published = publish(native.staging, revision);
  check(published.releaseID && published.manifestDigest, "post-approval release did not return its immutable IDs");
  const releaseReadback = cubJson("release", "get", "--space", native.staging, published.releaseID, "-o", "json");
  const releaseEntity = releaseReadback.Release ?? releaseReadback.release ?? releaseReadback;
  check(releaseEntity.ReleaseID === published.releaseID
    && normalizeDigest(releaseEntity.ManifestDigest) === published.manifestDigest,
  "published ChangeOrder Release readback differs from the command result");
  const afterRelease = listReleases(native.staging);
  check(afterRelease.length === beforeReleases.length + 1, "post-approval boundary did not add exactly one Release");
  const gateEvidence = {
    model: "server-attested-changeworkflow-changeorder-v1",
    refusal: { result: "blocked", message: refused.error.trim().slice(0, 500), releaseCountBefore: beforeReleases.length, releaseCountAfter: afterRefusal.length },
    approval: { attestationID: attestation.id, expiresAt: active.expiresAt, subjects: selected },
    release: published,
  };
  write(join(currentRoot, "gate-observation.json"), `${JSON.stringify(gateEvidence, null, 2)}\n`);
  saveState({ ...state, gateEvidence, phases: { ...state.phases, gate: "pass" } });
  console.log(`refusal observed; ${selected.length} exact Approval subjects recorded; ChangeOrder Release ${published.manifestDigest}`);
}

function currentCapture() {
  const state = loadState();
  assertOrganization(state.organization);
  assertCurrentSpaceIdentities(state);
  check(state.phases.gate === "pass" && state.gateEvidence,
    "run --gate-current before capture");
  const gateEvidence = JSON.parse(readFileSync(join(currentRoot, "gate-observation.json"), "utf8"));
  check(gateEvidence.model === "server-attested-changeworkflow-changeorder-v1"
    && gateEvidence.refusal.result === "blocked"
    && gateEvidence.refusal.releaseCountBefore === gateEvidence.refusal.releaseCountAfter
    && /requires review: 1 Approval attestation\(s\)/.test(gateEvidence.refusal.message),
  "current gate observation is missing the native release prerequisite refusal");
  const contract = currentContract(state);
  const workflow = cubJson("changeworkflow", "get", "--space", native.base, native.workflow, "-o", "json").ChangeWorkflow;
  assertWorkflowReleasePrerequisite(workflow, contract, check);
  const changeOrder = cubJson("changeorder", "get", "--space", native.base, native.changeOrder, "-o", "json").ChangeOrder;
  assertChangeOrderBinding(changeOrder, contract, check, state.stagingSpaceID);
  check(changeOrder.InScopeSpaceIDs.length === 1 && changeOrder.InScopeSpaceIDs[0] === state.stagingSpaceID,
    "captured ChangeOrder does not name exactly the reviewed staging Space");
  const attestation = cubJson("attestation", "get", gateEvidence.approval.attestationID, "-o", "json");
  const active = assertActiveApproval(attestation,
    { attestationID: gateEvidence.approval.attestationID, changeOrderID: state.orderID }, check);
  const attestationRows = cubJson("attestation", "list", "--space", native.staging, "-o", "json");
  assertNotRevoked((attestationRows ?? []).map((row) => row.Attestation ?? row)
    .filter((row) => row.RevokedAttestationID === gateEvidence.approval.attestationID), check);
  const currentSubjects = listUnits(native.staging).sort(byUnitID)
    .map((unit) => readChangeOrderRevision(native.staging, state.orderID, unit));
  check(sameRevisionSet(currentSubjects, gateEvidence.approval.subjects),
    "current staging Unit revision set differs from approved subjects");
  const releaseReadback = cubJson("release", "get", "--space", native.staging, gateEvidence.release.releaseID, "-o", "json");
  const release = releaseReadback.Release ?? releaseReadback.release ?? releaseReadback;
  check(release.ReleaseID === gateEvidence.release.releaseID
    && normalizeDigest(release.ManifestDigest) === gateEvidence.release.manifestDigest,
  "captured Release differs from the native ChangeOrder publication");
  const devReleaseReadback = cubJson("release", "get", "--space", native.dev, state.initialDevRelease.releaseID, "-o", "json");
  const devRelease = devReleaseReadback.Release ?? devReleaseReadback.release ?? devReleaseReadback;
  check(devRelease.ReleaseID === state.initialDevRelease.releaseID
    && normalizeDigest(devRelease.ManifestDigest) === state.initialDevRelease.manifestDigest,
  "captured dev Release differs from the initial release command result");
  const checked = canonicalHash(readFileSync(RENDER, "utf8"));
  const baseHead = canonicalHash(dumpSpace(native.base));
  const stagingHead = canonicalHash(dumpSpace(native.staging));
  const findings = cub("check", RENDER).split("\n").filter((line) => /^\[(WARNING|CRITICAL)\]/.test(line));
  check(baseHead.hash === stagingHead.hash, "acceptance: promoted staging set must equal the base head canonically");
  check(currentSubjects.length === checked.objects, "approval subject count differs from the checked resource count");
  const receipt = {
    apiVersion: "evidence.confighub.com/v1alpha2",
    kind: "AiOperatorLadderAttestationReceipt",
    metadata: { name: "ai-operator-ladder-attestation-v1" },
    spec: {
      schemaVersion: "attestation-v1",
      organization: state.organization,
      input: "packages/bitnami/redis/25.5.3/bases/reuse-existing-secret/upstream.yaml",
      rungs: {
        check: { result: "pass", findings: findings.length, identifiers: findings.map((line) => line.match(/\bCCVE-\d+-\d+\b/)?.[0]).filter(Boolean) },
        upload: { result: "pass", command: "cub variant upload --component redis-ladder-native --variant base --owner 'AI Operator Ladder' --source-name ai-operator-ladder-attestation-v1 <render>", units: checked.objects, spaceID: state.baseSpaceID },
        release: { result: "pass", spaceID: state.devSpaceID, releaseID: state.initialDevRelease.releaseID, manifestDigest: state.initialDevRelease.manifestDigest },
        change: { result: "pass", changes: ["redis-statefulset-redis-master replicas=2", "redis-statefulset-redis-replicas replicas=4"], baseHeadCanonicalSha256: baseHead.hash },
        promote: { result: "pass", changeOrderID: state.orderID, workflowID: state.workflowID, stageSpaceID: state.stagingSpaceID, units: state.stagingRevisions.length },
        gate: { result: "pass", authority: "ChangeWorkflow.ReleasePrerequisite", refusalObserved: true, approvalAttestationID: gateEvidence.approval.attestationID, approvedSubjects: currentSubjects.length, expiresAt: active.expiresAt },
        capture: { result: "pass", stagingReleaseID: release.ReleaseID, manifestDigest: normalizeDigest(release.ManifestDigest) },
      },
      identity: {
        checkedCanonicalSha256: checked.hash,
        baseHeadCanonicalSha256: baseHead.hash,
        stagingCanonicalSha256: stagingHead.hash,
        promotedEqualsBaseHead: baseHead.hash === stagingHead.hash,
      },
      workflow: {
        id: state.workflowID,
        slug: native.workflow,
        stage: native.stage,
        whereSpace: `SpaceID = '${state.stagingSpaceID}'`,
        releasePrerequisite: native.prerequisite,
        requirement: { type: "Approval", count: 1, allowAuthors: true, ignoreFail: false },
      },
      changeOrder: { id: state.orderID, slug: native.changeOrder, endTagID: state.endTagID, sourceSpaceID: state.baseSpaceID, inScopeSpaceIDs: [state.stagingSpaceID] },
      findings,
      boundaries: [
        "This proves the operator surface, not autonomy; this ladder used a same-operator Approval attestation because the workflow permits authors.",
        "Recording approval is not workflow enforcement; the current receipt records the configured prerequisite, exact pre-approval refusal, active attestation, and successful ChangeOrder release.",
        "This is ConfigHub Release evidence only; no Kubernetes runtime deployment was observed by this ladder.",
      ],
    },
    status: { result: "pass", claim: "The operator drove the check, upload, dev release, two governed edits, exact ChangeOrder promotion, refused staging release before Approval, and successful ChangeOrder-scoped release after Approval." },
  };
  verifyCurrentReceipt(receipt);
  writeYaml(join(currentRoot, "receipt.yaml"), receipt);
  write(currentSummaryPath, renderCurrentSummary(receipt));
  const receiptLabel = currentRoot.startsWith(join(repoRoot, "runs"))
    ? relativeRepo(join(currentRoot, "receipt.yaml")) : "fake attestation-v1 receipt";
  console.log(`current receipt written: ${receiptLabel}; promotedEqualsBaseHead=${baseHead.hash === stagingHead.hash}, ${findings.length} findings`);
}

function currentDown() {
  assertReviewedVersion();
  const state = loadState();
  assertOrganization(state.organization);
  for (const space of [native.staging, native.dev, native.cluster, native.base]) {
    const result = cubTry("space", "get", space, "-o", "json");
    if (!result.ok) {
      check(/not found/i.test(result.error), `could not verify ${space} before cleanup: ${result.error}`);
      continue;
    }
    const entity = JSON.parse(result.output).Space;
    check(entity?.Labels?.Proof === native.proofLabel,
      `refusing to delete ${space} without Proof=${native.proofLabel}`);
    const expectedID = space === native.base ? state.baseSpaceID
      : space === native.dev ? state.devSpaceID
        : space === native.staging ? state.stagingSpaceID : state.clusterSpaceID;
    check(entity.SpaceID === expectedID, `refusing to delete ${space} with unexpected SpaceID`);
    cub("space", "delete", space, "--recursive-force", "--detach", "--quiet");
  }
  console.log("deleted only the four attestation-v1 ladder Spaces");
}

function currentContract(state) {
  const source = getSpace(native.base);
  const staging = getSpace(native.staging);
  check(source.ComponentID === state.componentID && staging.ComponentID === state.componentID,
    "source/staging Component identity changed");
  const workflow = cubJson("changeworkflow", "get", "--space", native.base, native.workflow, "-o", "json").ChangeWorkflow;
  const order = cubJson("changeorder", "get", "--space", native.base, native.changeOrder, "-o", "json").ChangeOrder;
  return {
    workflow: {
      space: native.base,
      slug: native.workflow,
      id: workflow?.ChangeWorkflowID ?? state.workflowID,
      stage: native.stage,
      stageWhereSpace: `SpaceID = '${staging.SpaceID}'`,
      releasePrerequisite: native.prerequisite,
      requirement: { count: 1, allowAuthors: true, ignoreFail: false, maxAge: "", fromUserIDs: [] },
    },
    changeOrder: { space: native.base, slug: native.changeOrder, id: order?.ChangeOrderID ?? state.orderID, endTagID: order?.EndTagID ?? state.endTagID },
    sourceSpaceID: source.SpaceID,
  };
}

function workflowContract(sourceSpaceID, stageWhereSpace) {
  return {
    workflow: {
      space: native.base, slug: native.workflow, id: "pending", stage: native.stage,
      stageWhereSpace, releasePrerequisite: native.prerequisite,
      requirement: { count: 1, allowAuthors: true, ignoreFail: false, maxAge: "", fromUserIDs: [] },
    },
    changeOrder: { space: native.base, slug: native.changeOrder, id: "pending", endTagID: "pending" },
    sourceSpaceID,
  };
}

function assertMultiUnitApproval(result, { space, changeOrderID, subjects }) {
  const spaces = result?.Spaces ?? result?.spaces;
  check(Array.isArray(spaces) && spaces.length === 1, "variant approve did not return exactly one selected Space");
  const row = spaces[0];
  check((row.SpaceSlug ?? row.spaceSlug) === space && !row.Error && !row.error,
    "variant approve returned an error or a different Space");
  const attestation = row.Attestation ?? row.attestation;
  check(attestation?.AttestationID && attestation.Type === "Approval"
    && attestation.Result === "Pass" && attestation.ChangeOrderID === changeOrderID,
  "variant approve returned no passing attestation bound to the exact ChangeOrder");
  const actual = row.Subjects ?? row.subjects;
  check(Array.isArray(actual) && actual.length === subjects.length,
    "variant approve subject count differs from the whole-space reviewed set");
  const expectedSet = subjects.map((item) => `${item.unitID}:${item.revisionID}:${item.revisionNum}`).sort();
  const actualSet = actual.map((item) => `${item.UnitID ?? item.unitID}:${item.RevisionID ?? item.revisionID}:${Number(item.RevisionNum ?? item.revisionNum)}`).sort();
  check(actualSet.join("\n") === expectedSet.join("\n"),
    "variant approve subjects differ from the exact ChangeOrder revisions");
  const hasSkipped = Object.hasOwn(row, "SkippedUnits") || Object.hasOwn(row, "skippedUnits");
  const skipped = row.SkippedUnits ?? row.skippedUnits;
  check(!hasSkipped || Array.isArray(skipped) && skipped.length === 0,
    "variant approve skipped Units or returned malformed skipped-unit evidence");
  return { id: attestation.AttestationID, subjects };
}

function readReviewedHead(space, unit) {
  const current = cubJson("unit", "get", "--space", space, unit.Slug, "-o", "json").Unit;
  check(current.UnitID === unit.UnitID && current.HeadRevisionID && current.DataHash
    && Number.isSafeInteger(Number(current.HeadRevisionNum)), `${space}/${unit.Slug} has no immutable head identity`);
  return { unitID: current.UnitID, slug: current.Slug, revisionID: current.HeadRevisionID,
    revisionNum: Number(current.HeadRevisionNum), dataHash: current.DataHash };
}

function readChangeOrderRevision(space, changeOrderID, unit) {
  const rows = cubJson("revision", "list", "--space", space, "--by-unit-id", unit.UnitID ?? unit.unitID,
    "--change-order", changeOrderID, "-o", "json");
  const observed = assertChangeOrderRevisionCoverage(rows, {
    unitID: unit.UnitID ?? unit.unitID,
    revisionID: unit.HeadRevisionID ?? unit.revisionID,
    revisionNum: Number(unit.HeadRevisionNum ?? unit.revisionNum),
    dataHash: unit.DataHash ?? unit.dataHash,
  }, (condition, message) => { if (!condition) throw new Error(message); });
  return { unitID: observed.unitID, revisionID: observed.revisionID, revisionNum: observed.revisionNum, dataHash: observed.dataHash };
}

function listUnits(space) {
  return cubJson("unit", "list", "--space", space, "-o", "json")
    .map((row) => row.Unit ?? row).sort(byUnitID);
}

function dumpSpace(space) {
  return listUnits(space).map((unit) => cub("unit", "data", "--space", space, unit.Slug)).join("\n---\n");
}

function getSpace(space) {
  const value = cubJson("space", "get", space, "-o", "json");
  return value.Space ?? value;
}

function publish(space, revision = "") {
  const result = cubJson("release", "publish", ...(revision ? ["--revision", revision] : []), space, "-o", "json");
  const release = result.Release ?? result.release ?? result;
  return { releaseID: release.ReleaseID ?? release.releaseId ?? "", manifestDigest: normalizeDigest(release.ManifestDigest ?? release.manifestDigest) };
}

function listReleases(space) {
  const result = cubJson("release", "list", "--space", space, "-o", "json");
  return Array.isArray(result) ? result.map((row) => row.Release ?? row) : result.Releases ?? [];
}

function ensureReviewedVersion() {
  const output = cub("version");
  assertReviewedVersion(output);
}

function assertReviewedVersion(output) {
  const client = output.match(/Client Version:[\s\S]*?\bVersion:\s*v?(\d+\.\d+\.\d+)/)?.[1];
  const server = output.match(/Server Version:[\s\S]*?\bVersion:\s*v?(\d+\.\d+\.\d+)/)?.[1];
  check(client === "0.6.2" && server === "0.6.2",
    `native ladder requires the reviewed cub client/server v0.6.2 pair; found client=${client ?? "unknown"} server=${server ?? "unknown"}; no ladder phase was run`);
}

function currentOrganization() {
  const status = cub("auth", "status");
  const name = (status.match(/Organization Name\s+(.+?)\s*$/m) ?? [])[1];
  check(name, "cub auth status did not identify the current organization");
  return name;
}

function assertOrganization(expected) {
  check(currentOrganization() === expected, "the active ConfigHub organization differs from the organization recorded at upload");
}

function assertCurrentSpaceIdentities(state) {
  check(getSpace(native.base).SpaceID === state.baseSpaceID, "native base SpaceID changed");
  if (state.clusterSpaceID) check(getSpace(native.cluster).SpaceID === state.clusterSpaceID, "native cluster SpaceID changed");
  if (state.devSpaceID) check(getSpace(native.dev).SpaceID === state.devSpaceID, "native dev SpaceID changed");
  if (state.stagingSpaceID) check(getSpace(native.staging).SpaceID === state.stagingSpaceID, "native staging SpaceID changed");
}

function ensureNoExistingSpace(space) {
  const result = cubTry("space", "get", space, "-o", "json");
  check(!result.ok && /not found/i.test(result.error),
    `${space} already exists or its absence could not be confirmed; run --down-current only after verifying it is this proof's disposable Space`);
}

function checkNoCurrentSpace(space) {
  ensureNoExistingSpace(space);
}

function saveState(state) {
  write(join(currentRoot, "phase-state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

function loadState() {
  const path = join(currentRoot, "phase-state.json");
  check(existsSync(path), `${relativeRepo(path)} is missing; run the current phases in order`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function verifyCurrentReceipt(receipt) {
  check(receipt.kind === "AiOperatorLadderAttestationReceipt"
    && receipt.spec?.schemaVersion === "attestation-v1", "current ladder receipt schema is missing");
  check(receipt.status?.result === "pass" && receipt.spec?.workflow?.id
    && receipt.spec?.changeOrder?.id, "current ladder receipt has no passing native workflow/ChangeOrder proof");
  check(["check", "upload", "release", "change", "promote", "gate", "capture"]
    .every((rung) => receipt.spec.rungs?.[rung]?.result === "pass"),
  "current ladder receipt is missing a completed check/upload/release/change/promote/gate/capture rung");
  check(receipt.spec.rungs.upload.units === 13 && receipt.spec.rungs.promote.units === 13
    && receipt.spec.rungs.change.changes?.length === 2
    && receipt.spec.rungs.release.releaseID && receipt.spec.rungs.release.manifestDigest
    && receipt.spec.rungs.gate.approvedSubjects === 13,
  "current ladder rung evidence is incomplete or has an unexpected Unit/change count");
  check(receipt.spec.workflow.whereSpace === `SpaceID = '${receipt.spec.changeOrder.inScopeSpaceIDs?.[0]}'`
    && receipt.spec.changeOrder.inScopeSpaceIDs?.length === 1,
  "current ladder workflow/ChangeOrder scope is not exact");
  check(receipt.spec.workflow.requirement?.type === "Approval"
    && receipt.spec.workflow.requirement.count === 1
    && receipt.spec.workflow.requirement.allowAuthors === true
    && receipt.spec.workflow.requirement.ignoreFail === false,
  "current ladder workflow release prerequisite differs from the reviewed policy");
  check(receipt.spec.rungs?.gate?.refusalObserved === true
    && receipt.spec.rungs.gate.authority === "ChangeWorkflow.ReleasePrerequisite"
    && receipt.spec.rungs.gate.approvedSubjects === receipt.spec.rungs.promote.units
    && receipt.spec.rungs.capture?.manifestDigest,
  "current ladder receipt is missing its refusal, approval subject, or release evidence");
  check(receipt.spec.identity?.promotedEqualsBaseHead === true
    && receipt.spec.identity.baseHeadCanonicalSha256 === receipt.spec.identity.stagingCanonicalSha256,
  "current ladder did not preserve promoted-equals-base-head identity");
}

function renderCurrentSummary(receipt) {
  const { rungs, identity } = receipt.spec;
  return `# The AI operator drives the Redis ladder with native approval evidence\n\n` +
    `<!-- Generated by scripts/run-ai-operator-ladder-proof.mjs --capture-current. Do not edit by hand. -->\n\n` +
    `The current ladder ran the local check (${rungs.check.findings} advisory findings), uploaded ${rungs.upload.units} Redis resources, published the dev release, made two governed replica changes, and promoted the exact ${rungs.promote.units}-Unit ChangeOrder to staging. The first staging release was refused by the configured ChangeWorkflow ReleasePrerequisite. One active Approval attestation covered all ${rungs.gate.approvedSubjects} exact staging revisions; publishing the same ChangeOrder boundary then produced ${rungs.capture.manifestDigest}.\n\n` +
    `The canonical staging object set equals the changed base head (${identity.stagingCanonicalSha256.slice(0, 19)}). This proves the operator surface, not autonomy or Kubernetes runtime delivery. The recorded workflow permits author approval, so the receipt does not claim independent review.\n`;
}

function canonicalHash(yamlText) {
  const maps = canonicalObjectMaps(yamlText, "");
  const keys = Object.keys(maps.helm).sort();
  return { hash: createHash("sha256").update(keys.map((key) => maps.helm[key]).join("\n")).digest("hex"), objects: keys.length };
}

function sameRevisionSet(left, right) {
  const identity = (item) => `${item.unitID}:${item.revisionID}:${item.revisionNum}:${item.dataHash}`;
  return left.map(identity).sort().join("\n") === right.map(identity).sort().join("\n");
}

function expectFailure(fn, pattern, description) {
  let error;
  try { fn(); } catch (caught) { error = caught; }
  check(error && pattern.test(error.message), `${description} did not fail as expected: ${error?.message ?? "no error"}`);
}

function byUnitID(left, right) { return String(left.UnitID).localeCompare(String(right.UnitID)); }
function normalizeDigest(value) { return String(value ?? "").match(/sha256:[0-9a-f]{64}/)?.[0] ?? ""; }
function realCub(args) { return execFileSync("cub", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); }
function cub(...args) { return commandRunner(args); }
function cubJson(...args) { return JSON.parse(cub(...args)); }
function cubTry(...args) {
  try { return { ok: true, output: cub(...args), error: "" }; }
  catch (error) { return { ok: false, output: String(error.stdout ?? ""), error: String(error.stderr ?? error.message ?? error) }; }
}

function selfTestCurrentGraph() {
  const priorRunner = commandRunner;
  const priorRoot = currentRoot;
  const priorSummary = currentSummaryPath;
  const temp = mkdtempSync(join(tmpdir(), "ai-operator-ladder-self-test-"));
  currentRoot = join(temp, "runs");
  currentSummaryPath = join(temp, "data", "summary.md");
  const fake = fakeHub();
  commandRunner = fake.run;
  try {
    assertReviewedVersion("Client Version:\n Version: v0.6.2\nServer Version:\n Version: v0.6.2\n");
    for (const serverVersion of ["0.5.7", "0.5.1"]) {
      expectFailure(() => assertReviewedVersion(`Client Version:\n Version: v0.6.2\nServer Version:\n Version: v${serverVersion}\n`),
        /requires the reviewed cub client\/server v0.6.2 pair/, `server v${serverVersion} preflight`);
    }
    for (const phase of [currentUpload, currentRelease, currentChange, currentPromote, currentGate, currentCapture]) phase();
    const receipt = readYaml(join(currentRoot, "receipt.yaml"));
    verifyCurrentReceipt(receipt);
    const commands = fake.calls;
    check(commands.some((args) => args[0] === "variant" && args[1] === "upload"
      && !args.includes("--granularity") && args.includes("--source-name")), "upload did not use current CLI flags");
    check(commands.some((args) => args[0] === "changeworkflow" && args[1] === "create" && args.includes("--filename")),
      "workflow creation argv is missing its reviewed fixture");
    check(commands.some((args) => args[0] === "changeorder" && args[1] === "create"
      && args.includes("--component") && args.includes("--in-scope-space") && args.includes("--change-workflow")),
    "ChangeOrder create argv is missing its exact bindings");
    check(commands.some((args) => args[0] === "variant" && args[1] === "approve"
      && args.includes("--change-order") && args.includes("--stage") && args.includes("--all")),
    "approval argv is not bound to the ChangeOrder stage and full subject set");
    const stagingPublishes = commands.filter((args) => args[0] === "release" && args[1] === "publish" && args.includes(native.staging));
    check(stagingPublishes.length === 2 && stagingPublishes
      .every((args) => args.includes("--revision") && args.some((value) => value.startsWith("ChangeOrder:"))),
    "staging releases did not use the immutable ChangeOrder boundary");
    check(commands.every((args) => !(args[0] === "unit" && args[1] === "approve")
      && !args.includes("vet-approvedby")), "current graph emitted retired approval commands");
    check(existsSync(join(historicalRoot, "receipt.yaml")), "historical receipt disappeared");
  } finally {
    commandRunner = priorRunner;
    currentRoot = priorRoot;
    currentSummaryPath = priorSummary;
    rmSync(temp, { recursive: true, force: true });
  }
  for (const [fakeOptions, pattern, description] of [
    [{ approvalShape: "missing" }, /no passing attestation/, "missing Approval record"],
    [{ approvalShape: "mismatched" }, /subjects differ/, "mismatched Approval subjects"],
    [{ refusalMessage: "network unavailable" }, /exact ChangeWorkflow Approval refusal/, "unrelated refusal"],
  ]) {
    const isolatedRoot = mkdtempSync(join(tmpdir(), "ai-operator-ladder-negative-"));
    const negative = fakeHub(fakeOptions);
    commandRunner = negative.run;
    const oldRoot = currentRoot;
    currentRoot = join(isolatedRoot, "runs");
    try {
      for (const phase of [currentUpload, currentRelease, currentChange, currentPromote]) phase();
      expectFailure(() => currentGate(), pattern, description);
      const stagingAttempts = negative.calls.filter((args) => args[0] === "release" && args[1] === "publish" && args.includes(native.staging));
      check(stagingAttempts.length === 1, `${description} continued to the post-approval release`);
      if (fakeOptions.refusalMessage) {
        check(!negative.calls.some((args) => args[0] === "variant" && args[1] === "approve"),
          "unrelated release failure was mistaken for approval refusal");
      }
    } finally {
      commandRunner = priorRunner;
      currentRoot = oldRoot;
      rmSync(isolatedRoot, { recursive: true, force: true });
    }
  }
}

function fakeHub({ approvalShape = "good", refusalMessage = "" } = {}) {
  const calls = [];
  const state = { spaces: new Map(), units: new Map(), workflows: new Map(), orders: new Map(), attestations: new Map(), releases: new Map(), uploaded: false, approved: false, sequence: 0 };
  const refuse = (message) => { const error = new Error(message); error.stderr = message; throw error; };
  const makeUnit = (space, slug, text, num = 1) => ({ UnitID: `unit-${space}-${slug}`, SpaceID: state.spaces.get(space).SpaceID, Slug: slug, HeadRevisionID: `revision-${space}-${slug}-${num}`, HeadRevisionNum: num, DataHash: hash(text), Data: text });
  const unitDocs = parseDocs(readFileSync(RENDER, "utf8")).map((doc, index) => {
    const slug = doc.kind === "StatefulSet" && doc.metadata?.name === "redis-master"
      ? "redis-statefulset-redis-master"
      : doc.kind === "StatefulSet" && doc.metadata?.name === "redis-replicas"
        ? "redis-statefulset-redis-replicas"
        : `redis-object-${String(index + 1).padStart(2, "0")}`;
    return [slug, serializeYaml(doc)];
  });
  const run = (args) => {
    calls.push(args.slice());
    const [entity, verb, ...rest] = args;
    const value = (flag) => { const index = args.indexOf(`--${flag}`); return index < 0 ? "" : args[index + 1]; };
    const ok = (text = "") => text;
    if (entity === "version") return ok("Client Version:\n Version: v0.6.2\nServer Version:\n Version: v0.6.2\n");
    if (entity === "auth" && verb === "status") return ok("Organization Name Local\n");
    if (entity === "variant" && verb === "upload") {
      state.uploaded = true;
      state.spaces.set(native.base, { SpaceID: "space-base", ComponentID: "component-redis", Labels: { Proof: native.proofLabel } });
      state.units.set(native.base, unitDocs.map(([slug, data]) => makeUnit(native.base, slug, data)));
      return ok("uploaded");
    }
    if (entity === "space" && verb === "create") {
      const name = rest[0]; state.spaces.set(name, { SpaceID: `space-${name}`, ComponentID: "", Labels: { Proof: native.proofLabel } }); return ok();
    }
    if (entity === "worker" && verb === "create") return ok();
    if (entity === "target" && verb === "create") return ok();
    if (entity === "variant" && verb === "create") {
      const variantName = rest[0]; const sourceSpace = rest[1]; const space = variantName === "dev" ? native.dev : native.staging;
      state.spaces.set(space, { SpaceID: `space-${space}`, ComponentID: state.spaces.get(sourceSpace).ComponentID, Labels: { Proof: native.proofLabel } });
      state.units.set(space, state.units.get(sourceSpace).map((unit) => ({ ...unit, UnitID: `unit-${space}-${unit.Slug}`, SpaceID: `space-${space}` })));
      return ok();
    }
    if (entity === "space" && verb === "get") { const space = state.spaces.get(rest[0]); if (!space) refuse("space not found"); return ok(JSON.stringify({ Space: space })); }
    if (entity === "unit" && verb === "list") { const rows = state.units.get(value("space")) ?? []; return ok(JSON.stringify(rows.map((Unit) => ({ Unit })))); }
    if (entity === "unit" && verb === "get") { const unit = (state.units.get(value("space")) ?? []).find((item) => item.Slug === rest[2]); if (!unit) refuse("unit not found"); return ok(JSON.stringify({ Unit: unit })); }
    if (entity === "unit" && verb === "data") { const unit = (state.units.get(value("space")) ?? []).find((item) => item.Slug === rest[2]); if (!unit) refuse("unit not found"); return unit.Data; }
    if (entity === "release" && verb === "publish") {
      const space = rest[0] === "--revision" ? rest[2] : rest[0];
      const revision = value("revision");
      if (space === native.staging && !state.approved) refuse(refusalMessage || "requires review: 1 Approval attestation(s)");
      const id = `release-${++state.sequence}`; const digest = `sha256:${String(state.sequence).padStart(64, "a")}`;
      const release = { ReleaseID: id, ManifestDigest: digest };
      state.releases.set(space, [...(state.releases.get(space) ?? []), release]);
      return ok(JSON.stringify({ Release: release }));
    }
    if (entity === "function" && verb === "do") {
      const space = value("space"); const slug = value("unit"); const replicas = rest[rest.indexOf("set-replicas") + 1];
      const units = state.units.get(space); const current = units.find((item) => item.Slug === slug);
      const doc = parseDocs(current.Data)[0]; doc.spec.replicas = Number(replicas); current.Data = serializeYaml(doc); current.HeadRevisionNum += 1;
      current.HeadRevisionID = `revision-${space}-${slug}-${current.HeadRevisionNum}`; current.DataHash = hash(current.Data); return ok("changed");
    }
    if (entity === "changeworkflow" && verb === "create") {
      const file = value("filename"); const workflow = { ...JSON.parse(readFileSync(file, "utf8")), ChangeWorkflowID: "workflow-native" };
      state.workflows.set(rest[0], workflow); return ok();
    }
    if (entity === "changeworkflow" && verb === "get") return ok(JSON.stringify({ ChangeWorkflow: { ...state.workflows.get(rest[0]), ChangeWorkflowID: "workflow-native" } }));
    if (entity === "changeorder" && verb === "create") {
      const order = { ChangeOrderID: "order-native", ChangeWorkflowID: "workflow-native", EndTagID: "endtag-native", InScopeSpaceIDs: [state.spaces.get(native.staging).SpaceID] };
      state.orders.set(rest[0], order); return ok();
    }
    if (entity === "changeorder" && verb === "get") return ok(JSON.stringify({ ChangeOrder: state.orders.get(rest[0]) }));
    if (entity === "revision" && verb === "list") {
      const unit = (state.units.get(value("space")) ?? []).find((item) => item.UnitID === value("by-unit-id"));
      if (!unit) refuse("revision not found");
      return ok(JSON.stringify([{ Revision: { UnitID: unit.UnitID, RevisionID: unit.HeadRevisionID, RevisionNum: unit.HeadRevisionNum, DataHash: unit.DataHash } }]));
    }
    if (entity === "variant" && verb === "promote") {
      const source = state.units.get(native.base); const target = state.units.get(native.staging);
      for (const unit of target) { const parent = source.find((candidate) => candidate.Slug === unit.Slug); Object.assign(unit, { Data: parent.Data, HeadRevisionNum: parent.HeadRevisionNum, HeadRevisionID: `revision-${native.staging}-${unit.Slug}-${parent.HeadRevisionNum}`, DataHash: parent.DataHash }); }
      return ok("promoted");
    }
    if (entity === "variant" && verb === "approve") {
      state.approved = true;
      const subjects = state.units.get(native.staging).map((unit) => ({ UnitID: unit.UnitID, RevisionID: unit.HeadRevisionID, RevisionNum: unit.HeadRevisionNum }));
      if (approvalShape === "missing") return ok(JSON.stringify({ Spaces: [{ SpaceSlug: native.staging, Subjects: subjects }] }));
      if (approvalShape === "mismatched") subjects[0].RevisionID = "wrong-revision";
      state.attestations.set("attestation-native", { AttestationID: "attestation-native", Type: "Approval", Result: "Pass", ChangeOrderID: "order-native" });
      return ok(JSON.stringify({ Spaces: [{ SpaceSlug: native.staging, Attestation: state.attestations.get("attestation-native"), Subjects: subjects }] }));
    }
    if (entity === "attestation" && verb === "get") return ok(JSON.stringify({ Attestation: state.attestations.get(rest[0]) }));
    if (entity === "attestation" && verb === "list") return ok(JSON.stringify([...state.attestations.values()]));
    if (entity === "release" && verb === "get") {
      const found = [...state.releases.values()].flat().find((item) => item.ReleaseID === rest[2]);
      if (!found) refuse("release not found"); return ok(JSON.stringify({ Release: found }));
    }
    if (entity === "release" && verb === "list") return ok(JSON.stringify(state.releases.get(value("space")) ?? []));
    if (entity === "check") return ok("[WARNING] CCVE-2025-5013 StatefulSet/redis/redis-master\n[CRITICAL] CCVE-2025-5019 StatefulSet/redis/redis-master\n");
    return refuse(`unhandled fake argv cub ${args.join(" ")}`);
  };
  return { calls, run };
}

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
