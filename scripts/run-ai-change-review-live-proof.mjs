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

const mode = process.argv[2] ?? "--help";
const expectedOrg = "helm-catalog";
const approvalFilterRef = "platform/helm-catalog-prod-gates";
const approvalGate = "platform/require-approval/vet-approvedby";
const targetRef = "bitnami-redis-27-0-0-stage-pilot-live-20260705/oci-target";
const reviewedPath = join(repoRoot, "data", "ai-change-review", "reviewed.yaml");
const localReceiptPath = join(repoRoot, "data", "ai-change-review", "receipt.yaml");
const receiptPath = join(
  repoRoot,
  "runs",
  "ai-change-review-live-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "ai-change-review-live-proof",
  "summary.md",
);
const expectedTriggers = [
  "platform/digest-pinned-images",
  "platform/lifecycle-route-evidence",
  "platform/probes-declared",
  "platform/require-approval",
  "platform/vet-placeholders",
  "platform/vet-schemas",
];
const genericWorkloadWarnings = [
  "platform/digest-pinned-images/vet-cel",
  "platform/probes-declared/vet-cel",
];

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
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
} else {
  console.error(
    `Usage: node ${relativeRepo(import.meta.filename)} --run|--generate|--verify`,
  );
  process.exitCode = 2;
}

function run() {
  const context = process.env.CUB_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_AI_REVIEW_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_AI_REVIEW_PROOF=1 to confirm this live-org proof",
  );
  check(context, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(tryCommand("cub", ["version"]).ok, "cub is required for this proof");

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
  const reviewedText = readFileSync(reviewedPath, "utf8");
  const reviewedDocs = parseDocs(reviewedText);
  check(reviewedDocs.length === 1, "the reviewed candidate must contain one object");
  const reviewed = reviewedDocs[0];
  check(
    reviewed.apiVersion === "trainer.kubeflow.org/v1alpha1"
      && reviewed.kind === "ClusterTrainingRuntime"
      && reviewed.metadata?.name === "torch-distributed",
    "the reviewed AICR object identity changed",
  );

  const topology = readApprovalTopology(context);
  const target = cubJson(context, ["target", "get", "--space", ...targetRef.split("/"), "-o", "json"]).Target;
  check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);

  const runId = safeRunId(
    process.env.HELM_EXPT_PROOF_RUN_ID || new Date().toISOString(),
  );
  const space = `hx-ai-review-${runId}`;
  const unitSlug = "reviewed-training-runtime";
  const cleanup = { space: "not-created" };
  let receipt;

  try {
    check(
      !cubTry(context, ["space", "get", space, "-o", "json"]).ok,
      `refusing to reuse existing proof Space ${space}`,
    );

    createSpace(context, space);
    cleanup.space = "pending";
    assertSpaceTriggers(context, space, topology.triggerIds);

    cub(context, [
      "unit",
      "create",
      "--space",
      space,
      unitSlug,
      reviewedPath,
      "--label",
      "Proof=ai-change-review-live",
      "--change-desc",
      "Store the reviewed AICR training-runtime candidate",
      "--quiet",
    ]);
    cub(context, [
      "unit",
      "set-target",
      "--space",
      space,
      unitSlug,
      targetRef,
      "--quiet",
    ]);

    const before = waitForPolicy(context, space, unitSlug, true);
    const storedBefore = storedData(before);
    const sourceSha = sha256(reviewedText);
    const storedSha = sha256(storedBefore);
    const semanticMatch =
      JSON.stringify(parseDocs(storedBefore)) === JSON.stringify(reviewedDocs);
    check(semanticMatch, "ConfigHub stored a different Kubernetes object");
    check(
      before.ApplyGates?.[approvalGate] === true,
      "the reviewed system configuration did not receive the approval gate",
    );
    const validationKeysBeforeApproval = Object.keys(
      before.ValidationResults ?? {},
    ).sort();
    check(
      genericWorkloadWarnings.every((key) =>
        validationKeysBeforeApproval.includes(key)),
      "the current generic workload warnings changed",
    );
    check(
      before.TargetID === target.TargetID,
      "the reviewed Unit did not retain the selected OCI target",
    );

    const blocked = blockedDryRun(context, space, unitSlug);
    const headRevisionBefore = before.HeadRevisionNum;
    check(
      Number.isInteger(headRevisionBefore) && headRevisionBefore > 0,
      "the reviewed Unit has no head revision to approve",
    );

    cub(context, [
      "unit",
      "approve",
      "--space",
      space,
      unitSlug,
      "--revision",
      "HeadRevisionNum",
      "--wait",
      "--quiet",
    ]);

    const after = waitForPolicy(context, space, unitSlug, false);
    const storedAfter = storedData(after);
    check(
      JSON.stringify(parseDocs(storedAfter)) === JSON.stringify(reviewedDocs),
      "approval changed the reviewed Kubernetes object",
    );
    check(
      after.ContentHash === before.ContentHash,
      "approval changed the Unit content hash",
    );
    const recordedApprovals = approvalCount(after.ApprovedBy);
    check(recordedApprovals >= 1, "the reviewed Unit has no recorded approval");

    const allowed = allowedDryRun(context, space, unitSlug);
    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AIChangeReviewLiveProofReceipt",
      metadata: {
        name: "aicr-training-runtime-reviewed-approval",
      },
      spec: {
        recordedAt: new Date().toISOString(),
        context: {
          name: context,
          organization: expectedOrg,
          purpose: "temporary live AI change review proof",
        },
        source: {
          type: "aicr",
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
          space,
          unit: unitSlug,
          unitId: before.UnitID,
          sourceSha256: sourceSha,
          storedSha256: storedSha,
          byteForByteMatch: storedBefore === reviewedText,
          semanticMatch,
          contentHashBeforeApproval: before.ContentHash,
          contentHashAfterApproval: after.ContentHash,
        },
        policy: {
          profile: "catalog-standard",
          resourceClass: "system-configuration",
          filter: topology,
          approvalGate,
          validationKeysBeforeApproval,
          applyGatesBeforeApproval: Object.keys(before.ApplyGates ?? {}).sort(),
          applyGatesAfterApproval: Object.keys(after.ApplyGates ?? {}).sort(),
          genericWorkloadAdvisories: {
            validationKeys: genericWorkloadWarnings,
            blocking: false,
            authoritativeForThisObject: false,
            reason: "The current generic checks inspect ordinary workload-controller fields. This AICR custom resource stores its container deeper in the object.",
          },
        },
        target: {
          ref: targetRef,
          id: target.TargetID,
          provider: target.ProviderType,
          toolchain: target.ToolchainType,
          dryRunOnly: true,
        },
        beforeApproval: blocked,
        approval: {
          revisionSelector: "HeadRevisionNum",
          headRevisionBefore,
          headRevisionAfter: after.HeadRevisionNum,
          recordedApprovals,
          approverIdentityRecordedInReceipt: false,
          gateCleared: after.ApplyGates?.[approvalGate] !== true,
        },
        afterApproval: allowed,
        cleanup,
        limits: [
          "The proposal is a deterministic fixture, not a transcript from a named AI model.",
          "The catalog-standard ConfigHub checks and approval ran. The four-node target-capacity check remains a repository check, not a ConfigHub Function.",
          "The generic image and probe checks emitted warnings because this AICR custom resource does not use the ordinary workload-controller field shape. Those warnings do not tell us whether this candidate is safe.",
          "Both apply attempts used --dry-run against an OCI target. Nothing was applied to Kubernetes and no release artifact was published.",
          "The referenced training-provider-credentials Secret was not read or tested.",
          "This run did not test promotion, rollback, GPU workload health, or live observation.",
          "The temporary ConfigHub Space was deleted after the receipt was recorded.",
        ],
      },
      status: {
        result: "pass",
        claim: "ConfigHub stored the reviewed AICR object without changing its Kubernetes fields, blocked its dry run until the exact head revision was approved, and then allowed the same dry run against the recorded OCI target.",
      },
    };
  } finally {
    const exists = cubTry(context, ["space", "get", space, "-o", "json"]).ok;
    if (!exists) {
      cleanup.space = cleanup.space === "pending" ? "fail" : "not-created";
    } else {
      const deleted = cubTry(context, [
        "space",
        "delete",
        space,
        "--recursive-force",
        "--quiet",
      ]);
      const absent = !cubTry(context, ["space", "get", space, "-o", "json"]).ok;
      cleanup.space = deleted.ok && absent ? "pass" : "fail";
    }
  }

  check(receipt, "the live AI change review proof did not complete");
  check(cleanup.space === "pass", "the temporary proof Space was not deleted");
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function createSpace(context, space) {
  cub(context, [
    "space",
    "create",
    space,
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "Component=aicr-training-runtime-review",
    "--label",
    "Proof=ai-change-review-live",
    "--label",
    "ResourceClass=system-configuration",
    "--label",
    "SourceType=aicr",
    "--trigger-filter",
    approvalFilterRef,
    "--where-trigger",
    "-",
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
}

function readApprovalTopology(context) {
  const filter = getByRef(context, "filter", approvalFilterRef).Filter;
  const triggers = expectedTriggers.map(
    (ref) => getByRef(context, "trigger", ref).Trigger,
  );
  return {
    ref: approvalFilterRef,
    id: filter.FilterID,
    hash: String(filter.Hash ?? "").trim(),
    triggerRefs: expectedTriggers,
    triggerIds: triggers.map((trigger) => trigger.TriggerID).sort(),
  };
}

function assertSpaceTriggers(context, space, expectedTriggerIds) {
  const actual = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(
    sameSet(actual.TriggerIDs ?? [], expectedTriggerIds),
    `${space} received the wrong Trigger set`,
  );
}

function waitForPolicy(context, space, unit, approvalExpected) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const current = cubJson(
      context,
      ["unit", "get", unit, "--space", space, "-o", "json"],
    ).Unit;
    const waiting = current.ApplyGates?.["awaiting/triggers"] === true;
    const approvalPresent = current.ApplyGates?.[approvalGate] === true;
    if (!waiting && approvalPresent === approvalExpected) return current;
    execFileSync("sleep", ["1"]);
  }
  throw new Error(
    `${space}/${unit} did not reach the expected approval state within 60 seconds`,
  );
}

function blockedDryRun(context, space, unit) {
  const result = spawnCub(context, [
    "unit",
    "apply",
    "--space",
    space,
    unit,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
  check(result.status !== 0, `${space}/${unit} was not blocked before approval`);
  check(
    output.includes(approvalGate),
    `${space}/${unit} failed without naming ${approvalGate}: ${output.slice(0, 500)}`,
  );
  return {
    result: "blocked",
    exitCode: result.status,
    gate: approvalGate,
    dryRun: true,
  };
}

function allowedDryRun(context, space, unit) {
  const result = spawnCub(context, [
    "unit",
    "apply",
    "--space",
    space,
    unit,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  check(
    result.status === 0,
    `${space}/${unit} was not allowed after approval: ${result.stderr || result.stdout}`,
  );
  const operation = JSON.parse(result.stdout);
  check(operation.DryRun === true, `${space}/${unit} did not return a dry-run operation`);
  return {
    result: "allowed",
    exitCode: 0,
    dryRun: true,
    queuedOperationId: operation.QueuedOperationID,
  };
}

function storedData(unit) {
  check(unit.Data, `${unit.SpaceSlug}/${unit.Slug} has no stored data`);
  return Buffer.from(unit.Data, "base64").toString("utf8");
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function verifyLocalReceipt(receipt) {
  check(receipt.kind === "AIChangeReviewReceipt", "local AI review receipt kind changed");
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
    Number.isInteger(stored?.contentHashBeforeApproval)
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
    sameSet(policy?.filter?.triggerRefs ?? [], expectedTriggers),
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
    sameSet(
      policy?.genericWorkloadAdvisories?.validationKeys ?? [],
      genericWorkloadWarnings,
    )
      && policy.genericWorkloadAdvisories.blocking === false
      && policy.genericWorkloadAdvisories.authoritativeForThisObject === false,
    "generic workload advisory boundary changed",
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
    receipt.spec?.target?.ref === targetRef
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

function renderSummary(receipt) {
  const stored = receipt.spec.storedConfiguration;
  const approval = receipt.spec.approval;
  return `# Review an AI change before it is released

The example begins with a proposed change to an AICR PyTorch training runtime.
The unchecked proposal asks for eight H100 nodes when the recorded target limit is
four, replaces a digest-pinned image with \`latest\`, and leaves an API key as a
placeholder. The reviewed file uses four nodes, keeps the pinned image, and refers to
an existing Secret.

This live run uploaded that reviewed YAML to a temporary Space in the
\`helm-catalog\` ConfigHub organization. ConfigHub stored the same Kubernetes object
fields. Because the object is cluster-wide system configuration, ConfigHub blocked
the first dry-run apply until its exact head revision was approved. After approval,
the same dry run against the recorded OCI target was allowed.

| Check | Result |
| --- | --- |
| Reviewed object stored without field changes | ${stored.semanticMatch ? "Pass" : "Fail"} |
| Content hash changed during approval | ${stored.contentHashBeforeApproval === stored.contentHashAfterApproval ? "No" : "Yes"} |
| Dry run before approval | Blocked |
| Revision selector | \`${approval.revisionSelector}\` |
| Recorded approvals | ${approval.recordedApprovals} |
| Dry run after approval | Allowed |
| Generic image and probe warnings | Reported, but not useful for this custom resource |
| Kubernetes apply | Not run |
| Temporary Space removed | ${receipt.spec.cleanup.space === "pass" ? "Yes" : "No"} |

The standard ConfigHub checks and approval ran. The four-node capacity rule was
checked by the repository example; it is not yet a ConfigHub Function. The two
generic workload checks also reported image and probe warnings. They inspect the
ordinary workload-controller field shape and do not understand the deeper container
path in this AICR custom resource. Those warnings do not tell us whether this object
is safe. The policy needs AICR-aware checks or narrower generic checks.

Both apply attempts used \`--dry-run\` against an OCI target. This run did not publish
a release, read the referenced Secret, start a GPU workload, promote the change, roll
it back, or observe a cluster.

- [Reviewed AICR object](../ai-change-review/reviewed.yaml)
- [Unchecked proposal and local checks](../ai-change-review/summary.md)
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

function cub(context, args, options = {}) {
  return command("cub", args, { ...options, env: cubEnv(context) });
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, { ...options, env: cubEnv(context) });
}

function cubJson(context, args) {
  return JSON.parse(cub(context, args));
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
