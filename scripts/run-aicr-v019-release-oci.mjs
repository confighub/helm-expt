#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

import {
  check,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  writeYaml,
} from "./lib/proof-common.mjs";
import { observeApprovalAttestations } from "./lib/revision-approval-observation.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--publish", "--run", "--verify", "--verify-current", "--self-test"].includes(mode), "use --publish, --run, --verify, --verify-current, or --self-test");

const context = process.env.CUB_CONTEXT ?? "river-bear";
const version = process.env.AICR_ARGOCD_VERSION?.trim() || "0.19.0";
check(["0.19.0", "0.20.0"].includes(version), `unsupported AICR version ${version}`);
const v020Entry = version === "0.20.0";
const versionSlug = `v${version.replaceAll(".", "-")}`;
const releaseChainKey = v020Entry ? "production" : "staging";
const space = `aicr-eks-h100-training-kubeflow-${versionSlug}-argocd-${v020Entry ? "production" : "staging"}`;
const configurationUnit = "aicr-eks-h100-training-kubeflow";
const readmeUnit = "readme";
const componentName = "aicr-eks-h100-training-kubeflow";
const registryHost = "oci.hub.confighub.com:443";
const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  `eks-h100-training-kubeflow-${versionSlug}`,
);
const contentRoot = join(exampleRoot, "confighub-release");
const configurationPath = join(contentRoot, `${configurationUnit}.yaml`);
const readmePath = join(contentRoot, "readme.yaml");
const currentContentRoot = join(exampleRoot, "confighub-release-attestation-v1");
const currentConfigurationPath = join(currentContentRoot, `${configurationUnit}.yaml`);
const currentReadmePath = join(currentContentRoot, "readme.yaml");
const receiptPath = join(exampleRoot, "confighub-release-oci-receipt.yaml");
const currentReceiptPath = join(exampleRoot, "confighub-release-oci-attestation-v1-receipt.yaml");
const promotionReceiptPath = join(exampleRoot, "promotion-readiness-receipt.yaml");
const promotionReceipt = readYaml(promotionReceiptPath);
const releaseChain = promotionReceipt.spec?.chain?.[releaseChainKey];
check(releaseChain, `promotion receipt has no ${releaseChainKey} record`);
const expectedConfigurationRevision = releaseChain.configurationUnit.headRevision;
const historicalReceipt = existsSync(receiptPath) ? readYaml(receiptPath) : null;
const expectedReadmeRevision = releaseChain.readmeUnit.headRevision
  ?? (historicalReceipt
    ? retainedReadmeRevision(historicalReceipt, releaseChain.readmeUnit, !v020Entry)
    : undefined);
check(Number.isInteger(expectedConfigurationRevision) && expectedConfigurationRevision > 0
  && Number.isInteger(expectedReadmeRevision) && expectedReadmeRevision > 0,
"promotion evidence does not provide the exact configuration and README revision witnesses");
let cubExecutor = runCub;

if (mode === "--publish") publish();
else if (mode === "--run") run();
else if (mode === "--self-test") selfTestRevisionWitness();
else if (mode === "--verify-current") verifyCurrent();
else verify();

function publish() {
  check(
    process.env.HELM_EXPT_ALLOW_AICR_RELEASE === "1",
    "set HELM_EXPT_ALLOW_AICR_RELEASE=1 to approve and publish the persistent AICR release",
  );
  const units = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const selected = expectedUnits(units);
  const source = bindDeclaredComponent({ setup: true });
  const unitIDs = selected.map(({ Unit }) => Unit.UnitID).sort();
  const runKey = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const currentWorkflowSlug = `aicr-release-${releaseChainKey}-${runKey}`;
  const changeOrderSlug = `aicr-release-${releaseChainKey}-${runKey}`;
  const approval = createAndApproveReleaseBoundary({
    source,
    selected,
    workflowSlug: currentWorkflowSlug,
    changeOrderSlug,
  });
  const published = publishChangeOrderBoundary(approval.changeOrder.ChangeOrderID);
  const release = published.release;
  const currentProof = {
    model: "server-attested-changeworkflow-changeorder-v1",
    organization: "helm-catalog",
    space: { slug: space, id: source.SpaceID, componentID: source.ComponentID },
    workflow: {
      id: approval.workflow.ChangeWorkflowID,
      slug: currentWorkflowSlug,
      stage: "publication",
      command: approval.workflowCommand,
    },
    changeOrder: {
      id: approval.changeOrder.ChangeOrderID,
      slug: changeOrderSlug,
      endTagID: approval.changeOrder.EndTagID,
      revision: `ChangeOrder:${approval.changeOrder.ChangeOrderID}`,
      scopeSpaceIDs: [source.SpaceID],
      unitIDs,
      command: approval.changeOrderCommand,
    },
    beforeApproval: {
      result: "blocked",
      authority: "ChangeWorkflow.ReleasePrerequisite",
      command: approval.refusalCommand,
      message: approval.refusal,
    },
    approval: {
      attestationID: approval.attestation.AttestationID,
      type: approval.attestation.Type,
      result: approval.attestation.Result,
      changeOrderID: approval.attestation.ChangeOrderID,
      subjects: approval.subjects,
      command: approval.command,
      dryRunCommand: approval.dryRunCommand,
    },
    releaseCommand: published.command,
    release: {
      id: release.ReleaseID,
      number: release.ReleaseNum,
      manifestDigest: release.ManifestDigest,
      bundleDigest: release.Digest,
      unitCount: release.UnitCount,
      published: release.Published,
    },
  };
  run(currentProof);
}

function publishChangeOrderBoundary(changeOrderID) {
  const args = [
    "release", "publish", "--revision", `ChangeOrder:${changeOrderID}`,
    "--label", "SourceType=aicr",
    "--label", `SourceVersion=${version}`,
    space, "-o", "json",
  ];
  const published = cubJson(args);
  const release = published.Release ?? published;
  check(/^sha256:[0-9a-f]{64}$/.test(release.ManifestDigest ?? "")
    && release.UnitCount === 2,
  "ConfigHub did not publish the two-Unit ChangeOrder boundary");
  return { release, command: ["cub", ...args] };
}

function bindDeclaredComponent({ setup = false } = {}) {
  const component = cubJson(["component", "get", componentName, "-o", "json"]).Component;
  check(component?.Slug === componentName && typeof component.ComponentID === "string"
    && component.ComponentID.length > 0,
  `ConfigHub component ${componentName} did not resolve to its declared identity`);
  let source = cubJson(["space", "get", space, "-o", "json"]).Space;
  check(source?.SpaceID === releaseChain.id && source.Slug === space,
    `${space} no longer resolves to the Space recorded by the promotion receipt`);
  if (source.ComponentID !== component.ComponentID) {
    check(setup && !source.ComponentID,
      `${space} is already bound to a different component identity`);
    cubText(["space", "update", "--component", component.ComponentID, space, "--quiet"]);
    source = cubJson(["space", "get", space, "-o", "json"]).Space;
  }
  check(source.ComponentID === component.ComponentID,
    `${space} component binding did not read back as ${componentName}`);
  return source;
}

function expectedUnits(records) {
  const units = (Array.isArray(records) ? records : []).map((row) => row.Unit ?? row);
  check(units.length === 2, `${space} must contain exactly the reviewed configuration and README Units`);
  const expected = [
    { slug: configurationUnit, id: releaseChain.configurationUnit.id, revision: expectedConfigurationRevision },
    { slug: readmeUnit, id: releaseChain.readmeUnit.id, revision: expectedReadmeRevision },
  ];
  return expected.map((item) => {
    const Unit = units.find((row) => row.Slug === item.slug);
    check(Unit?.UnitID === item.id && Unit.HeadRevisionNum === item.revision,
      `${releaseChainKey} ${item.slug} identity or reviewed head revision changed`);
    return { Unit };
  });
}

function expectedRevisionByUnit() {
  return new Map([
    [releaseChain.configurationUnit.id, expectedConfigurationRevision],
    [releaseChain.readmeUnit.id, expectedReadmeRevision],
  ]);
}

function createAndApproveReleaseBoundary({ source, selected, workflowSlug: currentWorkflowSlug, changeOrderSlug }) {
  const workflowDocument = {
    Stages: [{
      Name: "publication",
      WhereSpace: `SpaceID = '${source.SpaceID}'`,
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
    currentWorkflowSlug, "--from-stdin", "--quiet"];
  cubText(workflowCommand.slice(1), `${JSON.stringify(workflowDocument)}\n`);
  const workflow = cubJson(["changeworkflow", "get", "--space", space, currentWorkflowSlug, "-o", "json"]).ChangeWorkflow;
  assertWorkflow(workflow, workflowDocument, source.SpaceID);

  const changeOrderCommand = ["cub", "changeorder", "create", "--space", space,
    changeOrderSlug, "--component", source.ComponentID, "--in-scope-space", source.SpaceID,
    "--change-workflow", `${space}/${currentWorkflowSlug}`, "--quiet"];
  cubText(changeOrderCommand.slice(1));
  const changeOrder = cubJson(["changeorder", "get", "--space", space, changeOrderSlug, "-o", "json"]).ChangeOrder;
  check(changeOrder?.ChangeOrderID && changeOrder.EndTagID
    && changeOrder.ChangeWorkflowID === workflow.ChangeWorkflowID
    && changeOrder.ComponentID === source.ComponentID
    && Array.isArray(changeOrder.InScopeSpaceIDs)
    && changeOrder.InScopeSpaceIDs.length === 1
    && changeOrder.InScopeSpaceIDs[0] === source.SpaceID,
  "ChangeOrder is not bound to the declared component, workflow, and exact Space");

  const revision = `ChangeOrder:${changeOrder.ChangeOrderID}`;
  const releaseArgs = ["release", "publish", "--revision", revision, space, "-o", "json"];
  const refused = cubTry(releaseArgs);
  check(!refused.ok && /requires review: 1 Approval attestation\(s\)/.test(refused.error),
    `the ChangeWorkflow did not block the unapproved ChangeOrder release: ${refused.error}`);

  const dryRunArgs = ["variant", "approve", space, "--change-order", changeOrder.ChangeOrderID,
    "--stage", "publication", "--all", "--dry-run", "-o", "json"];
  const dryRun = cubJson(dryRunArgs);
  const dryRunSubjects = approvalSubjects(dryRun, source);
  assertSubjectsMatch(selected, dryRunSubjects, expectedRevisionByUnit());

  const approveArgs = ["variant", "approve", space, "--change-order", changeOrder.ChangeOrderID,
    "--stage", "publication", "--all", "-o", "json"];
  const approved = cubJson(approveArgs);
  const approvedSubjects = approvalSubjects(approved, source);
  assertSubjectsMatch(selected, approvedSubjects, expectedRevisionByUnit());
  check(sameSubjects(dryRunSubjects, approvedSubjects),
    "the ChangeOrder-selected subjects changed between approval preview and attestation");
  const resultRow = approved.Spaces[0];
  const attestation = resultRow.Attestation;
  check(attestation?.AttestationID && attestation.Type === "Approval"
    && attestation.Result === "Pass" && attestation.ChangeOrderID === changeOrder.ChangeOrderID,
  "variant approval did not return a passing Approval attestation for this ChangeOrder");
  const readback = cubJson(["attestation", "get", attestation.AttestationID, "-o", "json"]).Attestation;
  check(readback?.AttestationID === attestation.AttestationID
    && readback.Type === "Approval" && readback.Result === "Pass"
    && readback.ChangeOrderID === changeOrder.ChangeOrderID,
  "the recorded Approval attestation did not read back for this ChangeOrder");
  const confirmedOrder = cubJson(["changeorder", "get", "--space", space, changeOrderSlug, "-o", "json"]).ChangeOrder;
  check(confirmedOrder.ChangeOrderID === changeOrder.ChangeOrderID
    && confirmedOrder.EndTagID === changeOrder.EndTagID
    && confirmedOrder.ChangeWorkflowID === workflow.ChangeWorkflowID
    && confirmedOrder.ComponentID === source.ComponentID
    && Array.isArray(confirmedOrder.InScopeSpaceIDs)
    && confirmedOrder.InScopeSpaceIDs.length === 1
    && confirmedOrder.InScopeSpaceIDs[0] === source.SpaceID,
  "the ChangeOrder boundary changed while recording its Approval attestation");

  return {
    workflow,
    changeOrder: confirmedOrder,
    attestation: readback,
    subjects: approvedSubjects,
    refusal: refused.error,
    command: ["cub", ...approveArgs],
    dryRunCommand: ["cub", ...dryRunArgs],
    refusalCommand: ["cub", ...releaseArgs],
    changeOrderCommand,
    workflowCommand,
    selected,
  };
}

function assertWorkflow(workflow, expected, spaceID) {
  const stage = (workflow?.Stages ?? []).find((row) => row.Name === "publication");
  const requirement = (workflow?.AttestationPrerequisites ?? []).find((row) => row.Name === "review");
  check(workflow?.ChangeWorkflowID
    && workflow.Stages?.length === 1
    && workflow.AttestationPrerequisites?.length === 1
    && stage?.WhereSpace === `SpaceID = '${spaceID}'`
    && (stage.ReleasePrerequisites ?? []).length === 1
    && stage.ReleasePrerequisites[0] === "review"
    && requirement?.Type === "Approval"
    && requirement.Count === 1 && requirement.AllowAuthors === true
    && (requirement.IgnoreFail ?? false) === false,
  "the stored ChangeWorkflow differs from the reviewed one-approval release prerequisite");
  check(expected.AttestationPrerequisites.length === 1,
    "internal workflow fixture must declare one Approval prerequisite");
}

function assertLiveApprovalProof(proof, source, selectedUnits) {
  check(proof.space.componentID === source.ComponentID,
    "live Space component identity differs from the attested publication receipt");
  const workflow = cubJson([
    "changeworkflow", "get", "--space", space, proof.workflow.slug, "-o", "json",
  ]).ChangeWorkflow;
  assertWorkflow(workflow, { AttestationPrerequisites: [{}] }, source.SpaceID);
  check(workflow.ChangeWorkflowID === proof.workflow.id,
    "live ChangeWorkflow ID differs from the recorded approval proof");

  const changeOrder = cubJson([
    "changeorder", "get", "--space", space, proof.changeOrder.slug, "-o", "json",
  ]).ChangeOrder;
  check(changeOrder.ChangeOrderID === proof.changeOrder.id
    && changeOrder.EndTagID === proof.changeOrder.endTagID
    && changeOrder.ChangeWorkflowID === workflow.ChangeWorkflowID
    && changeOrder.ComponentID === source.ComponentID
    && Array.isArray(changeOrder.InScopeSpaceIDs)
    && changeOrder.InScopeSpaceIDs.length === 1
    && changeOrder.InScopeSpaceIDs[0] === source.SpaceID,
  "live ChangeOrder no longer matches the recorded Space, component, workflow, or end tag");

  const dryRun = cubJson([
    "variant", "approve", space,
    "--change-order", proof.changeOrder.id,
    "--stage", "publication", "--all", "--dry-run", "-o", "json",
  ]);
  const selectedSubjects = approvalSubjects(dryRun, source);
  const expectedIDs = [releaseChain.configurationUnit.id, releaseChain.readmeUnit.id].sort();
  assertSubjectsMatch(expectedIDs.map((UnitID) => ({ UnitID })),
    selectedSubjects, expectedRevisionByUnit());
  check(sameSubjects(selectedSubjects, proof.approval.subjects),
    "live ChangeOrder-selected revisions differ from the recorded Approval subjects");

  const attestations = cubJson(["attestation", "list", "--space", space, "-o", "json"]);
  check(Array.isArray(selectedUnits) && selectedUnits.length === 2,
    "live approval readback lacks the two reviewed Units");
  for (const { Unit } of selectedUnits) {
    const expectedSubject = proof.approval.subjects.find((subject) => subject.UnitID === Unit.UnitID);
    check(expectedSubject, `live Approval has no subject for Unit ${Unit.UnitID}`);
    const revision = cubJson([
      "revision", "get", Unit.Slug, String(expectedSubject.RevisionNum),
      "--space", space, "-o", "json",
    ]);
    assertActiveApprovalSubject({
      unit: Unit,
      revision,
      attestations,
      expectedSubject,
      attestationID: proof.approval.attestationID,
    });
  }

  const attestation = cubJson([
    "attestation", "get", proof.approval.attestationID, "-o", "json",
  ]).Attestation;
  check(attestation?.AttestationID === proof.approval.attestationID
    && attestation.Type === "Approval" && attestation.Result === "Pass"
    && attestation.ChangeOrderID === changeOrder.ChangeOrderID,
  "live Approval attestation no longer satisfies this ChangeOrder prerequisite");
}

function assertActiveApprovalSubject({ unit, revision, attestations, expectedSubject, attestationID, now }) {
  check(unit?.UnitID === expectedSubject.UnitID
    && unit.HeadRevisionNum === expectedSubject.RevisionNum,
  "live Unit head differs from the ChangeOrder-selected Approval subject");
  const observed = observeApprovalAttestations(unit, revision, attestations, now);
  check(observed.revisionID === expectedSubject.RevisionID
    && observed.revisionNum === expectedSubject.RevisionNum
    && observed.attestationIDs.includes(attestationID),
  "recorded Approval is not active on the exact ChangeOrder-selected revision");
  return observed;
}

function approvalSubjects(result, source) {
  check(Array.isArray(result?.Spaces) && result.Spaces.length === 1,
    "variant approve did not select exactly one ChangeOrder Space");
  const row = result.Spaces[0];
  check(row.SpaceSlug === space && row.SpaceID === source.SpaceID && !row.Error
    && Array.isArray(row.Subjects)
    && (!Object.hasOwn(row, "SkippedUnits")
      || (Array.isArray(row.SkippedUnits) && row.SkippedUnits.length === 0)),
  "variant approve returned a different Space, an error, or skipped Units");
  return row.Subjects.map((subject) => ({
    UnitID: subject.UnitID,
    RevisionID: subject.RevisionID,
    RevisionNum: subject.RevisionNum,
  }));
}

function assertSubjectsMatch(units, subjects, revisionByUnit) {
  check(Array.isArray(subjects) && subjects.length === 2,
    "the ChangeOrder must select exactly the two reviewed Units");
  const unitIDs = units.map((entry) => entry.Unit?.UnitID ?? entry.UnitID).sort();
  const actualIDs = subjects.map((subject) => subject.UnitID).sort();
  check(new Set(actualIDs).size === 2 && JSON.stringify(actualIDs) === JSON.stringify(unitIDs),
    "the ChangeOrder Approval subjects do not match both reviewed Unit IDs exactly");
  for (const subject of subjects) {
    check(typeof subject.RevisionID === "string" && subject.RevisionID.length > 0
      && subject.RevisionNum === revisionByUnit.get(subject.UnitID),
    `the ChangeOrder did not select the reviewed numeric revision for Unit ${subject.UnitID}`);
  }
}

function sameSubjects(left, right) {
  const normalize = (subjects) => subjects.map(({ UnitID, RevisionID, RevisionNum }) =>
    `${UnitID}:${RevisionID}:${RevisionNum}`).sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function assertCurrentApprovalProof(proof) {
  check(proof?.model === "server-attested-changeworkflow-changeorder-v1"
    && proof.organization === "helm-catalog"
    && proof.space?.slug === space && proof.space.id === releaseChain.id
    && typeof proof.space.componentID === "string" && proof.space.componentID.length > 0
    && proof.changeOrder?.revision === `ChangeOrder:${proof.changeOrder.id}`
    && proof.changeOrder.scopeSpaceIDs?.length === 1
    && proof.changeOrder.scopeSpaceIDs[0] === releaseChain.id,
  "current approval proof identity or ChangeOrder scope changed");
  check(proof.workflow?.slug && proof.workflow.stage === "publication"
    && proof.approval?.attestationID && proof.approval.type === "Approval"
    && proof.approval.result === "Pass"
    && proof.approval.changeOrderID === proof.changeOrder.id,
  "current Approval attestation evidence is incomplete");
  check(proof.changeOrder.unitIDs?.length === 2
    && new Set(proof.changeOrder.unitIDs).size === 2,
  "current ChangeOrder receipt must name exactly two distinct Unit IDs");
}

function verifyCurrent() {
  check(existsSync(currentReceiptPath),
    `${relativeRepo(currentReceiptPath)} is missing; run --publish to record attestation-era evidence`);
  const receipt = readYaml(currentReceiptPath);
  verifyCurrentReceipt(receipt);
  console.log(`verified the attestation-era AICR v${version} ConfigHub release OCI`);
}

function verifyCurrentReceipt(receipt) {
  check(receipt?.kind === "ConfigHubReleaseOciAttestationV1Receipt"
    && receipt.spec?.organization === "helm-catalog"
    && receipt.spec?.space?.slug === space
    && receipt.spec.space.id === releaseChain.id
    && receipt.status?.result === "pass",
  "current AICR release receipt identity or result changed");
  const proof = receipt.spec.approvalProof;
  assertCurrentApprovalProof(proof);
  const expectedIDs = [releaseChain.configurationUnit.id, releaseChain.readmeUnit.id].sort();
  check(JSON.stringify(proof.changeOrder.unitIDs.slice().sort()) === JSON.stringify(expectedIDs),
    "current ChangeOrder Unit IDs differ from the reviewed promotion receipt");
  assertSubjectsMatch(expectedIDs.map((UnitID) => ({ UnitID })),
    proof.approval.subjects, expectedRevisionByUnit());
  check(receipt.spec.release?.id === proof.release.id
    && receipt.spec.release.manifestDigest === proof.release.manifestDigest
    && receipt.spec.release.revision === proof.changeOrder.revision
    && receipt.spec.release.unitCount === 2
    && receipt.spec.release.resolvedManifestDigest === proof.release.manifestDigest,
  "current release does not match the approved ChangeOrder boundary");
  const expectedReleaseCommand = ["cub", "release", "publish", "--revision",
    proof.changeOrder.revision, "--label", "SourceType=aicr", "--label",
    `SourceVersion=${version}`, space, "-o", "json"];
  check(JSON.stringify(proof.releaseCommand) === JSON.stringify(expectedReleaseCommand),
  "current receipt command does not describe the emitted ChangeOrder release command");
  const expectedWorkflowCommand = ["cub", "changeworkflow", "create", "--space", space,
    proof.workflow.slug, "--from-stdin", "--quiet"];
  const expectedChangeOrderCommand = ["cub", "changeorder", "create", "--space", space,
    proof.changeOrder.slug, "--component", proof.space.componentID, "--in-scope-space",
    releaseChain.id, "--change-workflow", `${space}/${proof.workflow.slug}`, "--quiet"];
  check(JSON.stringify(proof.workflow.command) === JSON.stringify(expectedWorkflowCommand)
    && JSON.stringify(proof.changeOrder.command) === JSON.stringify(expectedChangeOrderCommand),
  "current receipt does not retain the emitted workflow and ChangeOrder commands");
  const expectedApprovalArgs = ["cub", "variant", "approve", space,
    "--change-order", proof.changeOrder.id, "--stage", "publication", "--all"];
  check(JSON.stringify(proof.approval.command) === JSON.stringify([...expectedApprovalArgs, "-o", "json"])
    && JSON.stringify(proof.approval.dryRunCommand)
      === JSON.stringify([...expectedApprovalArgs, "--dry-run", "-o", "json"]),
  "current receipt does not retain the emitted scoped approval command");
  check(proof.beforeApproval?.result === "blocked"
    && proof.beforeApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
    && JSON.stringify(proof.beforeApproval.command) === JSON.stringify([
      "cub", "release", "publish", "--revision", `ChangeOrder:${proof.changeOrder.id}`,
      space, "-o", "json",
    ])
    && typeof proof.beforeApproval.message === "string"
    && /requires review: 1 Approval attestation\(s\)/.test(proof.beforeApproval.message),
  "current proof is missing the specific ChangeWorkflow refusal before Approval");
  check(!/ApplyGates|ApprovedBy|requiredGate/.test(JSON.stringify(proof)),
    "current approval proof still contains retired per-Unit approval evidence");
  check(existsSync(currentConfigurationPath) && existsSync(currentReadmePath),
    "current release content files are missing");
  const byPath = new Map((receipt.spec.content?.files ?? []).map((item) => [item.path, item]));
  for (const path of [currentConfigurationPath, currentReadmePath]) {
    const item = byPath.get(relativeRepo(path));
    check(item && item.sha256 === sha256(readFileSync(path)),
      `${relativeRepo(path)} no longer matches the current receipt`);
  }
  check(Array.isArray(receipt.spec.subjects) && receipt.spec.subjects.length === 2
    && sameSubjects(receipt.spec.subjects.map((row) => ({
      UnitID: row.unitID,
      RevisionID: proof.approval.subjects.find((subject) => subject.UnitID === row.unitID)?.RevisionID,
      RevisionNum: row.revisionNum,
    })), proof.approval.subjects),
  "current receipt subject table differs from the server Approval subjects");
  const comparison = inspectConfiguration(currentConfigurationPath);
  check(comparison.objectCount === 17
    && comparison.canonicalDataSha256 === releaseChain.canonicalDataSha256
    && comparison.originAnnotationCount === 17,
  "current release configuration differs from the promoted revision");
  const readme = inspectReadme(currentReadmePath, expectedReadmeRevision);
  check(readme.kind === "HelmCatalogDemoReadme"
    && receipt.status?.approval === "pass"
    && receipt.status?.releasePublish === "pass"
    && receipt.status?.registryPull === "pass"
    && receipt.status?.argoCdReconciliation === "not-run"
    && receipt.status?.eksH100Runtime === "not-run",
  "current release receipt has an invalid content or runtime claim");
  check(receipt.spec.content.readme?.originRevision === expectedReadmeRevision,
    "current README origin revision differs from the reviewed witness");
}

function run(currentProof) {
  if (!currentProof) {
    check(existsSync(currentReceiptPath),
      `${relativeRepo(currentReceiptPath)} is missing; run --publish to record current approval evidence`);
    currentProof = readYaml(currentReceiptPath).spec?.approvalProof;
  }
  assertCurrentApprovalProof(currentProof);
  const units = cubJson(["unit", "list", "--space", space, "-o", "json"]);
  const selected = expectedUnits(units);
  const source = bindDeclaredComponent();
  assertLiveApprovalProof(currentProof, source, selected);
  assertSubjectsMatch(selected,
    currentProof.approval.subjects, expectedRevisionByUnit());

  const releaseRecord = cubJson([
    "release", "get", "--space", space,
    "--oci-reference", currentProof.release.manifestDigest, "-o", "json",
  ]);
  check(releaseRecord.Release.Published === true, "the attested AICR release is not published");
  const release = releaseRecord.Release;
  check(release.ManifestDigest === currentProof.release.manifestDigest
    && release.ReleaseID === currentProof.release.id
    && release.UnitCount === 2,
  "the attested ChangeOrder release changed");

  const work = mkdtempSync(join(tmpdir(), `helm-expt-aicr-${versionSlug}-release-`));
  try {
    const registryConfig = join(work, "registry.json");
    const pullRoot = join(work, "pull");
    const extractRoot = join(work, "extract");
    const configRecord = unitRecord(units, configurationUnit);
    const worker = configRecord.BridgeWorker;
    const workerSpace = spaceSlugForId(worker.SpaceID);
    const password = cubText(["worker", "get-secret", "--space", workerSpace, worker.Slug]).trim();
    check(password.length > 20, "release worker returned no OCI credential");
    const auth = Buffer.from(`${worker.BridgeWorkerID}:${password}`).toString("base64");
    writeFileSync(
      registryConfig,
      JSON.stringify({
        auths: {
          [registryHost]: {
            username: worker.BridgeWorkerID,
            password,
            auth,
          },
        },
      }),
      { mode: 0o600 },
    );

    const reference = `${registryHost}/space/${space}@${release.ManifestDigest}`;
    const resolved = command("oras", ["resolve", reference, "--registry-config", registryConfig]).trim();
    check(resolved === release.ManifestDigest, "OCI registry resolved a different release digest");
    command("mkdir", [pullRoot]);
    command("oras", ["pull", reference, "--registry-config", registryConfig, "--output", pullRoot]);
    const archives = listFiles(pullRoot).filter((path) => path.endsWith(".tar.gz"));
    check(archives.length === 1, `expected one release archive, found ${archives.length}`);
    command("mkdir", [extractRoot]);
    command("tar", ["-xzf", archives[0], "-C", extractRoot]);
    const files = listFiles(extractRoot);
    const pulledConfig = files.find((path) => basename(path) === `${configurationUnit}.yaml`);
    const pulledReadme = files.find((path) => basename(path) === "readme.yaml");
    check(pulledConfig && pulledReadme && files.length === 2, "release OCI file set changed");
    mkdirSync(currentContentRoot, { recursive: true });
    copyFileSync(pulledConfig, currentConfigurationPath);
    copyFileSync(pulledReadme, currentReadmePath);

    const comparison = inspectConfiguration(currentConfigurationPath);
    const readme = inspectReadme(currentReadmePath, expectedReadmeRevision);
    const receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "ConfigHubReleaseOciAttestationV1Receipt",
      metadata: {
        name: `aicr-eks-h100-training-kubeflow-${versionSlug}-${releaseChainKey}`,
      },
      spec: {
        checkedAt: new Date().toISOString(),
        organization: "helm-catalog",
        space: {
          slug: space,
          id: source.SpaceID,
        },
        approvalProof: currentProof,
        subjects: selected.map(({ Unit }) => ({
          unit: Unit.Slug,
          unitID: Unit.UnitID,
          revisionNum: currentProof.approval.subjects.find((row) => row.UnitID === Unit.UnitID).RevisionNum,
        })),
        release: {
          id: release.ReleaseID,
          number: release.ReleaseNum,
          tag: releaseRecord.Tag.Slug,
          reference: `oci://${registryHost}/space/${space}@${release.ManifestDigest}`,
          manifestDigest: release.ManifestDigest,
          bundleDigest: release.Digest,
          unitCount: release.UnitCount,
          published: release.Published,
          revision: currentProof.changeOrder.revision,
          resolvedManifestDigest: resolved,
        },
        content: {
          files: [
            fileRecord(currentConfigurationPath),
            fileRecord(currentReadmePath),
          ],
          configuration: comparison,
          readme,
        },
        evidence: {
          promotionReceipt: relativeRepo(promotionReceiptPath),
          configuration: relativeRepo(currentConfigurationPath),
          readme: relativeRepo(currentReadmePath),
        },
        limits: [
          "This proves a ChangeWorkflow-gated Approval attestation, ConfigHub release publication, an authenticated pull by exact manifest digest, and the contents of that release.",
          "The workflow permits the same operator identity to record the Approval attestation; it does not prove independent reviewer separation.",
          "Promotion moved the reviewed configuration between ConfigHub environments. This separate publication created the deployable OCI release.",
          "It does not prove Argo CD reconciliation, EKS or H100 readiness, a training or NIM request, Flux delivery, fleet rollout, observation, or rollback.",
        ],
      },
      status: {
        result: "pass",
        approval: "pass",
        releasePublish: "pass",
        registryPull: "pass",
        manifestDigestMatched: "pass",
        promotedConfigurationMatched: "pass",
        argoCdReconciliation: "not-run",
        eksH100Runtime: "not-run",
        fluxDelivery: "not-run",
        fleetRollout: "not-run",
        rollback: "not-run",
      },
    };
    writeYaml(currentReceiptPath, receipt);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  verifyCurrentReceipt(receipt);
  console.log(`wrote ${relativeRepo(currentReceiptPath)}`);
}

function verify() {
  check(existsSync(receiptPath), `AICR v${version} release OCI receipt is missing; run --run`);
  check(existsSync(configurationPath) && existsSync(readmePath), "retained release files are missing");
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "ConfigHubReleaseOciReceipt", "release receipt kind changed");
  check(receipt.spec?.space?.slug === space, "release receipt Space changed");
  check(receipt.spec?.release?.published === true, "release receipt is not published");
  check(
    /^sha256:[0-9a-f]{64}$/.test(receipt.spec?.release?.manifestDigest ?? "")
      && receipt.spec.release.resolvedManifestDigest === receipt.spec.release.manifestDigest,
    "release OCI digest resolution did not pass",
  );
  check(receipt.spec?.release?.unitCount === 2, "release must contain the configuration and README Units");
  const byPath = new Map(receipt.spec.content.files.map((item) => [item.path, item]));
  for (const path of [configurationPath, readmePath]) {
    const item = byPath.get(relativeRepo(path));
    check(item, `release receipt omits ${relativeRepo(path)}`);
    check(item.sha256 === sha256(readFileSync(path)), `${relativeRepo(path)} digest changed`);
  }
  const comparison = inspectConfiguration(configurationPath);
  check(comparison.objectCount === 17, "release configuration no longer contains 17 Applications");
  check(
    comparison.canonicalDataSha256
      === releaseChain.canonicalDataSha256,
    `release configuration differs from the promoted ${releaseChainKey} object set`,
  );
  check(comparison.originAnnotationCount === 17, "release provenance annotations changed");
  const revision = retainedReadmeRevision(receipt, releaseChain.readmeUnit, !v020Entry);
  const readme = inspectReadme(readmePath, revision);
  check(readme.kind === "HelmCatalogDemoReadme", "release README shape changed");
  check(receipt.status?.promotedConfigurationMatched === "pass", "release comparison is not pass");
  check(receipt.status?.argoCdReconciliation === "not-run", "receipt must not claim Argo CD reconciliation");
  check(receipt.status?.eksH100Runtime === "not-run", "receipt must not claim H100 runtime evidence");
  console.log(`verified the approved AICR v${version} ConfigHub release OCI`);
}

function unitRecord(records, slug) {
  const record = records.find((candidate) => candidate.Unit?.Slug === slug);
  check(record, `${space} has no ${slug} Unit`);
  return record;
}

function spaceSlugForId(id) {
  const record = cubJson(["space", "list", "-o", "json"])
    .find((candidate) => candidate.Space?.SpaceID === id);
  check(record, `cannot resolve worker Space ${id}`);
  return record.Space.Slug;
}

function inspectConfiguration(path) {
  const docs = parseDocs(readFileSync(path, "utf8"));
  let originAnnotationCount = 0;
  for (const doc of docs) {
    check(doc.kind === "Application", "release configuration contains a non-Application object");
    const origin = doc.metadata?.annotations?.["confighub.com/origin"];
    check(origin, `${doc.metadata?.name}: release object has no ConfigHub origin`);
    const parsed = JSON.parse(origin);
    check(parsed.spaceSlug === space, `${doc.metadata?.name}: origin Space changed`);
    check(parsed.unitSlug === configurationUnit, `${doc.metadata?.name}: origin Unit changed`);
    check(
      parsed.revisionNum === expectedConfigurationRevision,
      `${doc.metadata?.name}: origin revision changed`,
    );
    originAnnotationCount += 1;
    delete doc.metadata.annotations["confighub.com/origin"];
    if (Object.keys(doc.metadata.annotations).length === 0) delete doc.metadata.annotations;
  }
  return {
    objectCount: docs.length,
    canonicalDataSha256: hash(canonicalDocs(docs)),
    expectedStagingDataSha256: promotionReceipt.spec.chain.staging.canonicalDataSha256,
    originAnnotationCount,
  };
}

// v0.19 predates headRevision in promotion receipts. Its separately captured
// release approval supplies the numeric revision witness when no head is present.
// Live publish/run paths still require the promotion receipt's explicit head.
function retainedReadmeRevision(receipt, promotedUnit, allowLegacy) {
  const approval = receipt.spec?.approval?.readme;
  check(approval?.unit === readmeUnit && approval?.id === promotedUnit.id,
    "README approval Unit does not match the promotion receipt");
  check(Number.isInteger(approval.revision) && approval.revision > 0
    && approval.outstandingApplyGates === 0,
    "README approval lacks an approved positive revision");
  if (promotedUnit.headRevision === undefined) {
    check(allowLegacy, "README promotion receipt lacks headRevision");
    return approval.revision;
  }
  check(approval.revision === promotedUnit.headRevision,
    "README approval revision differs from the promotion receipt");
  return promotedUnit.headRevision;
}

function selfTestRevisionWitness() {
  const unit = { id: "readme-unit" };
  const receipt = { spec: { approval: { readme: {
    unit: readmeUnit, id: unit.id, revision: 9, outstandingApplyGates: 0,
  } } } };
  check(retainedReadmeRevision(receipt, unit, true) === 9, "legacy approval witness rejected");
  check(retainedReadmeRevision(receipt, { ...unit, headRevision: 9 }, false) === 9,
    "current promotion witness rejected");
  const reject = (candidate, promoted, legacy) => {
    let rejected = false;
    try { retainedReadmeRevision(candidate, promoted, legacy); } catch { rejected = true; }
    check(rejected, "invalid README revision witness accepted");
  };
  reject(receipt, unit, false);
  reject(receipt, { ...unit, headRevision: 8 }, false);
  reject(receipt, { id: "another-unit" }, true);
  for (const delta of [{ revision: 0 }, { revision: "9" }, { outstandingApplyGates: 1 }, { unit: "another-unit" }]) {
    const changed = structuredClone(receipt);
    Object.assign(changed.spec.approval.readme, delta);
    reject(changed, unit, true);
  }
  reject({ spec: {} }, unit, true);
  const temp = mkdtempSync(join(tmpdir(), "helm-expt-readme-origin-"));
  try {
    const path = join(temp, "readme.yaml");
    const original = parseDocs(readFileSync(readmePath, "utf8"))[0];
    const originalOrigin = JSON.parse(original.metadata.annotations["confighub.com/origin"]);
    inspectReadme(readmePath, originalOrigin.revisionNum);
    for (const delta of [{ revisionNum: originalOrigin.revisionNum + 1 }, { unitId: "another-unit" }]) {
      const doc = structuredClone(original);
      const origin = { ...originalOrigin };
      Object.assign(origin, delta);
      doc.metadata.annotations["confighub.com/origin"] = JSON.stringify(origin);
      writeYaml(path, doc);
      let rejected = false;
      try { inspectReadme(path, originalOrigin.revisionNum); } catch (error) { rejected = error.message === "README origin changed"; }
      check(rejected, "tampered README origin accepted");
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  selfTestApprovalMigration();
  console.log("self-test passed: legacy/current README witnesses, exact ChangeOrder approval and release bindings, refusal matching, ComponentID setup, and tamper checks");
}

function selfTestApprovalMigration() {
  selfTestActiveApprovalObservation();
  const originalExecutor = cubExecutor;
  const state = {
    approved: false,
    denialMessage: "requires review: 1 Approval attestation(s)",
    workflow: null,
    changeOrder: null,
    attestation: null,
    source: { SpaceID: releaseChain.id, Slug: space, ComponentID: "" },
  };
  const expectedRows = [
    { Unit: { UnitID: releaseChain.configurationUnit.id } },
    { Unit: { UnitID: releaseChain.readmeUnit.id } },
  ];
  const subjects = [
    { UnitID: releaseChain.configurationUnit.id, RevisionID: "fake-config-revision", RevisionNum: expectedConfigurationRevision },
    { UnitID: releaseChain.readmeUnit.id, RevisionID: "fake-readme-revision", RevisionNum: expectedReadmeRevision },
  ];
  const ok = (value = "") => ({ ok: true, output: typeof value === "string" ? value : JSON.stringify(value), error: "" });
  cubExecutor = (args, input) => {
    if (args[0] === "changeworkflow" && args[1] === "create") {
      check(args.includes("--from-stdin") && input, "fake workflow create lost its stdin payload");
      state.workflow = { ...JSON.parse(input), ChangeWorkflowID: "fake-workflow-id" };
      return ok();
    }
    if (args[0] === "changeworkflow" && args[1] === "get") return ok({ ChangeWorkflow: state.workflow });
    if (args[0] === "changeorder" && args[1] === "create") {
      state.changeOrder = {
        ChangeOrderID: "fake-changeorder-id",
        EndTagID: "fake-end-tag-id",
        ChangeWorkflowID: state.workflow.ChangeWorkflowID,
        ComponentID: "component-id",
        InScopeSpaceIDs: [releaseChain.id],
      };
      return ok();
    }
    if (args[0] === "changeorder" && args[1] === "get") return ok({ ChangeOrder: state.changeOrder });
    if (args[0] === "release" && args[1] === "publish") {
      if (!state.approved) return { ok: false, output: "", error: state.denialMessage };
      const index = args.indexOf("--revision");
      check(args[index + 1] === `ChangeOrder:${state.changeOrder.ChangeOrderID}`,
        "fake release publish did not use the immutable ChangeOrder ID");
      return ok({ Release: {
        ReleaseID: "fake-release-id",
        ReleaseNum: 1,
        ManifestDigest: `sha256:${"a".repeat(64)}`,
        Digest: `sha256:${"b".repeat(64)}`,
        UnitCount: 2,
        Published: true,
      } });
    }
    if (args[0] === "variant" && args[1] === "approve") {
      check(args.includes(state.changeOrder.ChangeOrderID),
        "fake approval did not select the immutable ChangeOrder ID");
      const base = { SpaceSlug: space, SpaceID: releaseChain.id, Subjects: subjects };
      if (args.includes("--dry-run")) return ok({ Spaces: [base] });
      state.approved = true;
      state.attestation = {
        AttestationID: "fake-attestation-id",
        Type: "Approval",
        Result: "Pass",
        ChangeOrderID: state.changeOrder.ChangeOrderID,
      };
      return ok({ Spaces: [{ ...base, Attestation: state.attestation }] });
    }
    if (args[0] === "attestation" && args[1] === "get") return ok({ Attestation: state.attestation });
    if (args[0] === "component" && args[1] === "get") return ok({ Component: { Slug: componentName, ComponentID: "component-id" } });
    if (args[0] === "space" && args[1] === "get") return ok({ Space: state.source });
    if (args[0] === "space" && args[1] === "update") {
      check(args.includes("--component") && args[args.indexOf("--component") + 1] === "component-id",
        "fake Space setup did not bind by ComponentID");
      state.source = { ...state.source, ComponentID: "component-id" };
      return ok();
    }
    throw new Error(`unexpected fake cub command: ${args.join(" ")}`);
  };
  try {
    const source = { SpaceID: releaseChain.id, ComponentID: "component-id" };
    const result = createAndApproveReleaseBoundary({
      source,
      selected: expectedRows,
      workflowSlug: "fake-workflow",
      changeOrderSlug: "fake-changeorder",
    });
    check(result.command.includes("--change-order")
      && result.command.includes(result.changeOrder.ChangeOrderID)
      && result.workflowCommand.includes("--from-stdin")
      && !result.workflowCommand.some((value) => value.includes("tmp")),
    "fake receipt command fields lost the actual stable workflow or approval command");
    assertCurrentApprovalProof({
      model: "server-attested-changeworkflow-changeorder-v1",
      organization: "helm-catalog",
      space: { slug: space, id: releaseChain.id, componentID: "component-id" },
      workflow: { id: result.workflow.ChangeWorkflowID, slug: "fake-workflow", stage: "publication" },
      changeOrder: {
        id: result.changeOrder.ChangeOrderID,
        slug: "fake-changeorder",
        revision: `ChangeOrder:${result.changeOrder.ChangeOrderID}`,
        scopeSpaceIDs: [releaseChain.id],
        unitIDs: expectedRows.map(({ Unit }) => Unit.UnitID),
      },
      approval: {
        attestationID: result.attestation.AttestationID,
        type: result.attestation.Type,
        result: result.attestation.Result,
        changeOrderID: result.attestation.ChangeOrderID,
      },
      beforeApproval: {
        result: "blocked",
        authority: "ChangeWorkflow.ReleasePrerequisite",
        command: result.refusalCommand,
        message: result.refusal,
      },
    });
    const published = publishChangeOrderBoundary(result.changeOrder.ChangeOrderID);
    check(published.command.includes(`ChangeOrder:${result.changeOrder.ChangeOrderID}`),
      "fake publish receipt did not bind to the immutable ChangeOrder ID");
    const bound = bindDeclaredComponent({ setup: true });
    check(bound.ComponentID === "component-id", "fake declared-component binding did not read back");
    state.source = { ...state.source, ComponentID: "conflicting-component-id" };
    let refusedConflict = false;
    try { bindDeclaredComponent({ setup: true }); } catch { refusedConflict = true; }
    check(refusedConflict && state.source.ComponentID === "conflicting-component-id",
      "fake setup replaced a conflicting existing ComponentID");
    state.approved = false;
    state.denialMessage = "permission denied while creating a release";
    let refusedUnrelatedError = false;
    try {
      createAndApproveReleaseBoundary({
        source,
        selected: expectedRows,
        workflowSlug: "fake-workflow-unrelated-error",
        changeOrderSlug: "fake-changeorder-unrelated-error",
      });
    } catch { refusedUnrelatedError = true; }
    check(refusedUnrelatedError && !state.approved,
      "an unrelated release error was mistaken for the ChangeWorkflow refusal");
  } finally {
    cubExecutor = originalExecutor;
  }
}

function selfTestActiveApprovalObservation() {
  const now = Date.parse("2026-09-25T00:00:00.000Z");
  const unit = {
    UnitID: "observed-unit-id",
    SpaceID: "observed-space-id",
    Slug: "observed-unit",
    HeadRevisionNum: 9,
    DataHash: "observed-data-hash",
  };
  const expectedSubject = {
    UnitID: unit.UnitID,
    RevisionID: "observed-revision-id",
    RevisionNum: unit.HeadRevisionNum,
  };
  const revision = { Revision: {
    UnitID: unit.UnitID,
    RevisionID: expectedSubject.RevisionID,
    RevisionNum: expectedSubject.RevisionNum,
    DataHash: unit.DataHash,
    Attestations: { "active-approval-id": "native-map-value-is-not-semantic" },
  } };
  const activeApproval = {
    AttestationID: "active-approval-id",
    SpaceID: unit.SpaceID,
    Type: "Approval",
    Result: "Pass",
    ExpiresAt: "2026-09-26T00:00:00.000Z",
  };
  const observe = (revisionValue = revision, rows = [activeApproval]) =>
    assertActiveApprovalSubject({
      unit,
      revision: revisionValue,
      attestations: rows,
      expectedSubject,
      attestationID: activeApproval.AttestationID,
      now,
    });
  check(observe().attestationIDs.includes(activeApproval.AttestationID),
    "active exact-revision Approval was not observed");
  const reject = (revisionValue, rows, message) => {
    let refused = false;
    try { observe(revisionValue, rows); } catch { refused = true; }
    check(refused, message);
  };
  reject(revision, [{ ...activeApproval, ExpiresAt: "2026-09-24T23:59:59.000Z" }],
    "expired Approval remained active in live proof readback");
  reject(revision, [activeApproval, {
    AttestationID: "revocation-id",
    SpaceID: unit.SpaceID,
    Type: "Revocation",
    RevokedAttestationID: activeApproval.AttestationID,
  }], "revoked Approval remained active in live proof readback");
  const rejectedRevision = structuredClone(revision);
  rejectedRevision.Revision.Attestations["active-rejection-id"] = "also-semantically-empty";
  reject(rejectedRevision, [activeApproval, {
    AttestationID: "active-rejection-id",
    SpaceID: unit.SpaceID,
    Type: "Approval",
    Result: "Fail",
  }], "active rejection was ignored in live proof readback");
  reject({ Revision: { ...revision.Revision, RevisionID: "different-revision-id" } },
    [activeApproval], "approval readback accepted a different RevisionID");
}

function inspectReadme(path, expectedRevision = expectedReadmeRevision) {
  const docs = parseDocs(readFileSync(path, "utf8"));
  check(docs.length === 1, "release README must contain one record");
  const doc = docs[0];
  const origin = JSON.parse(doc.metadata?.annotations?.["confighub.com/origin"] ?? "null");
  check(
    origin?.spaceSlug === space
      && origin?.unitSlug === readmeUnit
      && origin?.unitId === releaseChain.readmeUnit.id
      && origin?.revisionNum === expectedRevision,
    "README origin changed",
  );
  return {
    kind: doc.kind,
    title: doc.spec?.title,
    originRevision: origin.revisionNum,
  };
}

function canonicalDocs(docs) {
  return JSON.stringify(
    docs
      .map((doc) => ({
        identity: [
          doc.apiVersion ?? "",
          doc.kind ?? "",
          doc.metadata?.namespace ?? "",
          doc.metadata?.name ?? "",
        ].join("|"),
        doc,
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function fileRecord(path) {
  return {
    path: relativeRepo(path),
    sha256: sha256(readFileSync(path)),
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function cubJson(args) {
  return JSON.parse(cubText([...args]));
}

function cubText(args, input) {
  const result = cubExecutor(args, input);
  check(result.ok, `cub ${args.slice(0, 6).join(" ")} failed: ${result.error}`);
  return result.output;
}

function cubTry(args, input) {
  const result = cubExecutor(args, input);
  return {
    ok: result.ok,
    output: result.output,
    error: result.error || result.output.trim() || "cub command failed",
  };
}

function runCub(args, input) {
  const result = spawnSync("cub", ["--context", context, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
    timeout: 300_000,
    stdio: ["pipe", "pipe", "pipe"],
    input: input ?? undefined,
  });
  const output = result.stdout ?? "";
  const error = `${output}${result.stderr ?? ""}`.trim() || result.error?.message || "";
  return {
    ok: result.status === 0,
    output,
    error,
  };
}

function command(binary, args) {
  return execFileSync(binary, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
    timeout: 300_000,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
