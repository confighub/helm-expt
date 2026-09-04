#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const modes = new Set(["--sync", "--capture", "--hub-verify", "--generate", "--verify"]);
if (!modes.has(mode)) {
  console.error(`Usage:
  node scripts/sync-config-review-decision-example.mjs --sync
  node scripts/sync-config-review-decision-example.mjs --capture
  node scripts/sync-config-review-decision-example.mjs --hub-verify
  node scripts/sync-config-review-decision-example.mjs --generate
  node scripts/sync-config-review-decision-example.mjs --verify`);
  process.exit(2);
}

const decisionPath = join(repoRoot, "config-catalog", "review-decisions", "byo-nginx-ai-values-24-0-2-reviewed.yaml");
const schemaPath = join(repoRoot, "schemas", "configuration-decision.schema.json");
const localProofPath = join(repoRoot, "runs", "byo-helm-values-proof", "receipt.yaml");
const publicReceiptPath = join(repoRoot, "runs", "byo-helm-values-proof", "public-oci-receipt.yaml");
const uploadReceiptPath = join(repoRoot, "runs", "byo-helm-values-proof", "confighub-upload-receipt.yaml");
const managedReceiptPath = join(repoRoot, "runs", "config-catalog-policy-functional-proof", "receipt.yaml");
const proposalScanPath = join(repoRoot, "runs", "config-catalog-policy-functional-proof", "proposed-cub-check.json");
const acceptedScanPath = join(repoRoot, "runs", "config-catalog-policy-functional-proof", "reviewed-cub-check.json");
const promotionReceiptPath = join(repoRoot, "runs", "byo-helm-values-promotion-proof", "receipt.yaml");
const deliveryReceiptPath = join(repoRoot, "runs", "byo-helm-values-deploy-proof", "receipt.yaml");
const stagingDeliveryReceiptPath = join(repoRoot, "runs", "byo-helm-values-staging-deploy-proof", "receipt.yaml");
const liveReceiptPath = join(repoRoot, "runs", "config-review-decision-chain", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "config-review-decision-chain", "summary.md");

const expectedContext = "river-bear";
const expectedOrg = "helm-catalog";
const space = "byo-nginx-ai-values-24-0-2-reviewed";
const decisionUnit = "review-decision";
const configurationUnit = "byo-nginx-ai-values";

const decision = readYaml(decisionPath);
const localProof = readYaml(localProofPath);
const publicReceipt = readYaml(publicReceiptPath);
const uploadReceipt = readYaml(uploadReceiptPath);
const managedReceipt = readYaml(managedReceiptPath);
const proposalScan = JSON.parse(readFileSync(proposalScanPath, "utf8"));
const acceptedScan = JSON.parse(readFileSync(acceptedScanPath, "utf8"));
const promotionReceipt = readYaml(promotionReceiptPath);
const deliveryReceipt = readYaml(deliveryReceiptPath);
const stagingDeliveryReceipt = readYaml(stagingDeliveryReceiptPath);

verifyStaticRecord();

if (mode === "--sync") {
  check(
    process.env.HELM_EXPT_ALLOW_CONFIG_DECISION_SYNC === "1",
    "set HELM_EXPT_ALLOW_CONFIG_DECISION_SYNC=1 before changing the live helm-catalog organization",
  );
  verifyContext();
  upsertAndApproveDecision();
  const receipt = collectLiveReceipt();
  writeYaml(liveReceiptPath, receipt);
  write(summaryPath, buildSummary(receipt));
  verifyLiveReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`stored and approved ${space}/${decisionUnit}`);
} else if (mode === "--capture") {
  check(
    process.env.HELM_EXPT_ALLOW_CONFIG_DECISION_CAPTURE === "1",
    "set HELM_EXPT_ALLOW_CONFIG_DECISION_CAPTURE=1 before refreshing live evidence",
  );
  verifyContext();
  const receipt = collectLiveReceipt();
  writeYaml(liveReceiptPath, receipt);
  write(summaryPath, buildSummary(receipt));
  verifyLiveReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`captured ${space}/${decisionUnit}`);
} else if (mode === "--hub-verify") {
  verifyContext();
  const receipt = readYaml(liveReceiptPath);
  verifyLiveReceipt(receipt);
  verifyLiveAgainstReceipt(receipt);
  console.log(`verified live ${space}/${decisionUnit}`);
} else if (mode === "--generate") {
  const receipt = readYaml(liveReceiptPath);
  verifyLiveReceipt(receipt);
  write(summaryPath, buildSummary(receipt));
  console.log("generated the configuration decision chain summary");
} else {
  check(existsSync(liveReceiptPath), `${relativeRepo(liveReceiptPath)} is missing`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing`);
  const receipt = readYaml(liveReceiptPath);
  verifyLiveReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === buildSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run config-review-decision:generate`,
  );
  console.log("verified the configuration decision record and evidence chain");
}

function verifyStaticRecord() {
  check(existsSync(schemaPath), "configuration decision schema is missing");
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  check(schema.properties?.kind?.const === "ConfigurationDecision", "configuration decision schema kind changed");
  check(decision.apiVersion === "workshop.confighub.com/v1alpha1", "configuration decision apiVersion changed");
  check(decision.kind === "ConfigurationDecision", "configuration decision kind changed");
  check(decision.metadata?.name === "byo-nginx-ai-values-24-0-2-reviewed", "configuration decision name changed");
  check(Number.isFinite(Date.parse(decision.metadata?.decidedAt ?? "")), "configuration decision has no valid decision time");
  check(Number.isFinite(Date.parse(decision.metadata?.reviewBy ?? "")), "configuration decision has no valid review date");
  check(Date.parse(decision.metadata.reviewBy) > Date.parse(decision.metadata.decidedAt), "configuration decision review date is not after its decision date");

  const proposal = decision.spec?.proposal;
  const accepted = decision.spec?.acceptedCandidate;
  check(proposal?.objectCount === proposalScan.input?.object_count, "proposal object count changed");
  check(
    proposal?.canonicalObjectSetSha256 === `sha256:${localProof.spec?.proposal?.objectSetSha256}`,
    "proposal canonical object-set hash changed",
  );
  check(
    proposal?.scannerObjectSetSha256 === proposalScan.input?.object_set_sha256,
    "proposal scanner object-set hash changed",
  );
  check(accepted?.objectCount === acceptedScan.input?.object_count, "accepted object count changed");
  check(
    accepted?.canonicalObjectSetSha256 === `sha256:${localProof.spec?.reviewed?.objectSetSha256}`,
    "accepted canonical object-set hash changed",
  );
  check(
    accepted?.scannerObjectSetSha256 === acceptedScan.input?.object_set_sha256,
    "accepted scanner object-set hash changed",
  );
  check(accepted?.ociReference === publicReceipt.spec?.artifact?.reference, "accepted OCI reference changed");
  check(accepted?.ociDigest === publicReceipt.spec?.artifact?.digest, "accepted OCI digest changed");
  check(
    uploadReceipt.spec?.objectSetSha256 === localProof.spec?.reviewed?.objectSetSha256
      && uploadReceipt.spec?.source?.digest === accepted.ociDigest,
    "ConfigHub upload no longer matches the accepted candidate",
  );

  const local = decision.spec?.checks?.local;
  check(local?.authority === "local-advisory", "local check authority changed");
  check(local?.version === proposalScan.provenance?.source_version, "local scanner version changed");
  check(local?.version === acceptedScan.provenance?.source_version, "accepted scanner version changed");
  check(sameSet(local?.proposalFindingIds, proposalScan.findings.map((finding) => finding.id)), "proposal finding IDs changed");
  check(sameSet(local?.acceptedFindingIds, acceptedScan.findings.map((finding) => finding.id)), "accepted finding IDs changed");

  const outcomes = decision.spec?.outcomes ?? [];
  const outcomesByFinding = new Map(outcomes.map((outcome) => [outcome.findingId, outcome]));
  check(outcomesByFinding.size === outcomes.length, "configuration decision repeats a finding outcome");
  for (const finding of proposalScan.findings) {
    check(outcomesByFinding.has(finding.id), `configuration decision has no outcome for ${finding.id}`);
  }
  for (const outcome of outcomes.filter((item) => item.decision === "accepted-fix" && item.findingId.startsWith("CCVE-"))) {
    check(!local.acceptedFindingIds.includes(outcome.findingId), `${outcome.findingId} is marked fixed but remains in the accepted scan`);
    check((outcome.changedPaths ?? []).length > 0, `${outcome.findingId} fix names no changed path`);
  }
  const exception = outcomesByFinding.get("CCVE-2025-3745");
  check(exception?.decision === "approved-exception", "emptyDir finding is not a scoped approved exception");
  check(local.acceptedFindingIds.includes(exception.findingId), "approved exception does not remain visible in the accepted scan");
  check(exception.exception?.reviewBy === decision.metadata.reviewBy, "exception and decision review dates differ");
  check(exception.exception?.excludes?.includes("production"), "approved exception does not exclude production");
  check(decision.spec?.scope?.excludedEnvironments?.includes("production"), "decision scope does not exclude production");

  const managed = decision.spec?.checks?.managed;
  const retained = managedReceipt.spec?.retainedResult;
  check(managed?.authority === "revision-bound" && managed.system === "ConfigHub", "managed authority changed");
  check(managed?.candidateResult === "eligible", "accepted candidate is not eligible in the managed record");
  check(
    managed.controls?.some((control) => control.findingId === "CCVE-2025-5019"
      && control.control === "platform/workload-sensitive-env-secret-refs"
      && control.result === "clear"),
    "credential finding is not mapped to the managed ConfigHub control",
  );
  check(
    managed.controls?.some((control) => control.findingId === "CCVE-2025-3745"
      && control.control === "no-managed-equivalent"
      && control.result === "not-covered"),
    "local emptyDir exception is being confused with a managed ConfigHub control",
  );
  check(
    retained?.space === space
      && retained.unit === configurationUnit
      && retained.objectSetSha256 === accepted.scannerObjectSetSha256
      && retained.policy?.gatePresent === false,
    "managed retained-result evidence changed",
  );
  check(
    promotionReceipt.status?.result === "pass"
      && promotionReceipt.spec?.chain?.base?.space === space
      && promotionReceipt.spec?.change?.field === "spec.replicas",
    "promotion evidence changed",
  );
  check(deliveryReceipt.status?.result === "pass", "base delivery evidence is not pass");
  check(stagingDeliveryReceipt.status?.result === "pass", "staging delivery evidence is not pass");

  const referencedPaths = collectEvidencePaths(decision);
  for (const path of referencedPaths) {
    if (path === relativeRepo(liveReceiptPath) && !existsSync(liveReceiptPath)) continue;
    check(existsSync(join(repoRoot, path)), `configuration decision evidence is missing: ${path}`);
  }
}

function collectEvidencePaths(value, result = new Set()) {
  if (typeof value === "string" && /^(config-catalog|data|runs|recipes|examples|docs|schemas)\//u.test(value)) result.add(value);
  else if (Array.isArray(value)) for (const item of value) collectEvidencePaths(item, result);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectEvidencePaths(item, result);
  return result;
}

function upsertAndApproveDecision() {
  const existing = getUnit(false);
  const source = readFileSync(decisionPath, "utf8");
  const sourceValue = readYamlText(source);
  const currentValue = existing ? readYamlText(storedData(existing)) : null;
  if (!existing || JSON.stringify(currentValue) !== JSON.stringify(sourceValue)) {
    const action = existing ? "update" : "create";
    cub([
      "unit",
      action,
      "--space",
      space,
      decisionUnit,
      decisionPath,
      "--provider",
      "None",
      "--change-desc",
      "Record the reviewed findings, fixes, and scoped exception",
      "--label",
      "config-workshop.confighub.com/review-decision=true",
      "--label",
      `config-workshop.confighub.com/source-space=${space}`,
      "--quiet",
    ]);
  }
  cub([
    "unit",
    "approve",
    "--space",
    space,
    decisionUnit,
    "--revision",
    "HeadRevisionNum",
    "--wait",
    "--quiet",
  ]);
}

function collectLiveReceipt() {
  const unit = getUnit(true);
  const config = getUnit(true, configurationUnit);
  const stored = readYamlText(storedData(unit));
  check(JSON.stringify(stored) === JSON.stringify(decision), "ConfigHub changed the stored configuration decision");
  const approvals = approvalCount(unit.ApprovedBy);
  check(approvals >= 1, "configuration decision Unit has no recorded approval");
  check(!unit.TargetID, "configuration decision Unit unexpectedly has a deployment target");
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ConfigurationDecisionLiveReceipt",
    metadata: { name: "byo-nginx-ai-values-24-0-2-reviewed" },
    spec: {
      capturedAt: new Date().toISOString(),
      context: { name: expectedContext, organization: expectedOrg },
      source: {
        path: relativeRepo(decisionPath),
        sha256: `sha256:${sha256(readFileSync(decisionPath))}`,
        schema: relativeRepo(schemaPath),
      },
      space: { slug: space, id: unit.SpaceID },
      decisionUnit: {
        slug: decisionUnit,
        id: unit.UnitID,
        headRevision: unit.HeadRevisionNum,
        dataHash: unit.DataHash,
        contentHash: unit.DataHash,
        provider: unit.ProviderType ?? "None",
        targetAssigned: false,
        includedInDeploymentRelease: false,
        sourceMatched: true,
        recordedApprovals: approvals,
      },
      configurationUnit: {
        slug: configurationUnit,
        id: config.UnitID,
        headRevision: config.HeadRevisionNum,
        dataHash: config.DataHash,
        objectCount: uploadReceipt.spec.objectCount,
        canonicalObjectSetSha256: `sha256:${uploadReceipt.spec.objectSetSha256}`,
      },
      evidence: {
        localProposal: relativeRepo(proposalScanPath),
        localAccepted: relativeRepo(acceptedScanPath),
        managedValidation: relativeRepo(managedReceiptPath),
        retainedBase: relativeRepo(uploadReceiptPath),
        promotion: relativeRepo(promotionReceiptPath),
        baseDelivery: relativeRepo(deliveryReceiptPath),
        stagingDelivery: relativeRepo(stagingDeliveryReceiptPath),
      },
    },
    status: {
      result: "pass",
      claim: "ConfigHub stores the exact configuration decision beside the retained NGINX base, keeps it out of deployment releases, and records approval of its exact revision.",
      limits: [
        "The approval applies to the decision record, not to a production workload revision.",
        "The emptyDir finding remains visible in cub check and the exception is limited to the named development and staging demonstrations.",
        "ConfigHub does not currently consume this exception record to suppress or replace a managed control result.",
      ],
    },
  };
}

function verifyLiveReceipt(receipt) {
  check(receipt.kind === "ConfigurationDecisionLiveReceipt", "configuration decision live receipt kind changed");
  check(receipt.status?.result === "pass", "configuration decision live receipt is not pass");
  check(receipt.spec?.context?.organization === expectedOrg, "configuration decision organization changed");
  check(receipt.spec?.space?.slug === space, "configuration decision Space changed");
  check(receipt.spec?.source?.path === relativeRepo(decisionPath), "configuration decision source path changed");
  check(receipt.spec?.source?.sha256 === `sha256:${sha256(readFileSync(decisionPath))}`, "configuration decision source hash changed");
  check(receipt.spec?.source?.schema === relativeRepo(schemaPath), "configuration decision schema path changed");
  const record = receipt.spec?.decisionUnit;
  check(record?.slug === decisionUnit && record.id, "configuration decision Unit identity is missing");
  check(Number.isInteger(record.headRevision) && record.headRevision > 0, "configuration decision Unit revision is invalid");
  check(record.sourceMatched === true, "configuration decision Unit did not match its source");
  check(record.recordedApprovals >= 1, "configuration decision Unit approval is missing");
  check(record.targetAssigned === false && record.includedInDeploymentRelease === false, "configuration decision became deployable");
  check(receipt.spec?.configurationUnit?.slug === configurationUnit, "configuration Unit identity changed");
  check(
    receipt.spec.configurationUnit.canonicalObjectSetSha256 === decision.spec.acceptedCandidate.canonicalObjectSetSha256,
    "configuration Unit object set changed",
  );
  check(receipt.status?.limits?.some((item) => item.includes("not to a production")), "receipt does not state the approval boundary");
}

function verifyLiveAgainstReceipt(receipt) {
  const unit = getUnit(true);
  const config = getUnit(true, configurationUnit);
  check(unit.UnitID === receipt.spec.decisionUnit.id, "live decision Unit ID changed");
  check(unit.HeadRevisionNum === receipt.spec.decisionUnit.headRevision, "live decision Unit revision changed");
  check(unit.DataHash === receipt.spec.decisionUnit.dataHash, "live decision Unit data hash changed");
  check(approvalCount(unit.ApprovedBy) >= receipt.spec.decisionUnit.recordedApprovals, "live decision approval disappeared");
  check(JSON.stringify(readYamlText(storedData(unit))) === JSON.stringify(decision), "live decision data changed");
  check(config.UnitID === receipt.spec.configurationUnit.id, "live configuration Unit ID changed");
  check(config.HeadRevisionNum === receipt.spec.configurationUnit.headRevision, "live configuration Unit revision changed");
  check(config.DataHash === receipt.spec.configurationUnit.dataHash, "live configuration Unit data hash changed");
}

function buildSummary(receipt) {
  const outcomes = decision.spec.outcomes;
  const fixes = outcomes.filter((outcome) => outcome.decision === "accepted-fix");
  const exception = outcomes.find((outcome) => outcome.decision === "approved-exception");
  return `# From an AI-written values file to an approved staging result

This example answers one practical question: **what happened to every problem we
found?** It starts with a supplied NGINX values file, keeps the requested scale,
fixes unsafe settings, records one narrow exception, and follows the same result
through ConfigHub and Argo CD.

## The result in one table

| Step | What happened | Record |
| --- | --- | --- |
| Check the proposal | \`cub check\` reported ${proposalScan.finding_count} findings against ${proposalScan.input.object_count} objects. The separate chart review also rejected the public LoadBalancer. | [Local result](../../${relativeRepo(proposalScanPath)}) and [chart review](../byo-helm-values-review/review.yaml) |
| Correct the configuration | ${fixes.length} findings have an accepted fix. The image is pinned, container security is restored, the API key uses an existing Secret, and the Service is ClusterIP. | [Reviewed objects](../byo-helm-values-review/reviewed-render.yaml) |
| Decide the remaining finding | \`${exception.findingId}\` remains visible. Its exception applies only to the exact development and staging demonstration on throwaway kind clusters. Production is excluded. Review it by ${decision.metadata.reviewBy.slice(0, 10)}. | [ConfigurationDecision](../../${relativeRepo(decisionPath)}) |
| Validate the stored revision | ConfigHub independently checks the retained revision. The literal API-key control is clear. The local emptyDir finding has no managed equivalent and is not presented as a ConfigHub pass. | [Managed validation](../apply-policy-functional-proof/summary.md) |
| Keep the decision | ConfigHub stores the decision as the non-deployable \`${decisionUnit}\` Unit beside the configuration. Revision ${receipt.spec.decisionUnit.headRevision} has ${receipt.spec.decisionUnit.recordedApprovals} recorded approval. | [Live receipt](../../${relativeRepo(liveReceiptPath)}) |
| Promote the accepted change | ConfigHub promotes \`spec.replicas\` from three in the reviewed base to four in staging while keeping the other reviewed settings. | [Promotion receipt](../../${relativeRepo(promotionReceiptPath)}) |
| Deliver it | Argo CD delivered the reviewed base and the promoted staging result on separate throwaway kind clusters. | [Base delivery](../byo-helm-values-deploy-proof/summary.md) and [staging delivery](../byo-helm-values-staging-deploy-proof/summary.md) |

## Why the records stay separate

- **Local check:** useful before signup; advisory only.
- **Configuration decision:** says which findings were fixed, rejected, or
  accepted for a narrow scope.
- **ConfigHub validation:** evaluates managed controls against a stored revision.
- **Approval:** binds the exception decision to one exact decision revision.
- **Promotion and delivery:** show what moved and what actually ran.

Approving the decision does not hide the scanner finding, approve a production
workload, or turn the local check into a ConfigHub control. A later object digest,
target, or production environment needs a new decision.

## Exact identities

| Item | Identity |
| --- | --- |
| Accepted Kubernetes object set | \`${decision.spec.acceptedCandidate.canonicalObjectSetSha256}\` |
| Scanner's normalized object set | \`${decision.spec.acceptedCandidate.scannerObjectSetSha256}\` |
| Public OCI | \`${decision.spec.acceptedCandidate.ociDigest}\` |
| ConfigHub configuration Unit | \`${receipt.spec.configurationUnit.id}\`, revision \`${receipt.spec.configurationUnit.headRevision}\` |
| ConfigHub decision Unit | \`${receipt.spec.decisionUnit.id}\`, revision \`${receipt.spec.decisionUnit.headRevision}\` |

The two object-set hashes use different canonicalization rules and are named
separately. Neither is an OCI manifest digest or a ConfigHub data hash.
`;
}

function verifyContext() {
  const context = JSON.parse(cub(["context", "get", "-o", "json"]));
  check(context?.name === expectedContext || context?.Name === expectedContext, `expected cub context ${expectedContext}`);
  const organization = context?.metadata?.organizationName
    ?? context?.organizationName
    ?? context?.OrganizationName
    ?? context?.coordinate?.organizationName;
  check(organization === expectedOrg, `expected organization ${expectedOrg}, found ${organization ?? "unknown"}`);
}

function getUnit(required, slug = decisionUnit) {
  const result = cubTry(["unit", "get", slug, "--space", space, "-o", "json"]);
  if (!result.ok) {
    check(!required, `${space}/${slug} is missing from ConfigHub`);
    return null;
  }
  return JSON.parse(result.output).Unit;
}

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls. The bytes go to a file rather than
// stdout because stdout normalizes the trailing newline while DataHash covers the
// stored bytes exactly, and the body is validated against that DataHash before use.
function storedData(unit) {
  const directory = mkdtempSync(join(tmpdir(), "config-review-decision-unit-data-"));
  const path = join(directory, "data");
  try {
    cub(["unit", "data", unit.UnitID ?? unit.Slug, "--space", space, "--output-file", path, "--quiet"]);
    const bytes = readFileSync(path);
    check(/^[a-f0-9]{64}$/.test(unit.DataHash ?? ""), `${space}/${unit.Slug ?? decisionUnit} has an invalid DataHash`);
    check(sha256(bytes) === unit.DataHash, `${space}/${unit.Slug ?? decisionUnit} DataHash does not match its stored data`);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function sameSet(left = [], right = []) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function cub(args) {
  return execFileSync("cub", ["--context", expectedContext, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 50,
  });
}

function cubTry(args) {
  const result = spawnSync("cub", ["--context", expectedContext, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
    maxBuffer: 1024 * 1024 * 50,
  });
  return { ok: result.status === 0, output: result.stdout ?? "", error: result.stderr ?? "" };
}
