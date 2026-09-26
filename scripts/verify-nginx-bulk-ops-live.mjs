#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { observeApprovalAttestations } from "./lib/revision-approval-observation.mjs";

import { check, cubEnv, readYamlText, repoRoot, sha256, writeYaml } from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const space = optionValue("--space") ?? "helm-nginx-http-clusterip";
const changeset = optionValue("--changeset") ?? "nginx-bulk-hardening";
const component = optionValue("--component") ?? "NGINX";
const variant = optionValue("--variant") ?? "http-clusterip";
const expectedImage = optionValue("--expected-image") ?? "nginx:1.25.5";
const outputDir = resolve(repoRoot, optionValue("--output-dir") ?? ".tmp/verify-bulk-ops");
const receiptDir = join(outputDir, space);
const receiptPath = join(receiptDir, "bulk-ops-receipt.yaml");

if (args.includes("--self-test")) {
  selfTestAttestationObservation();
  process.exit(0);
}

if (args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(0);
}

try {
  const where = `Labels.Component = '${component}' AND Labels.Variant = '${variant}'`;
  const changeSetDoc = JSON.parse(cub(["changeset", "get", "--space", space, changeset, "-o", "json"]));
  check(changeSetDoc.ChangeSet?.Slug === changeset, `changeset ${changeset} not found in ${space}`);
  check(changeSetDoc.ChangeSet?.SpaceSlug === space, `changeset ${changeset} belongs to unexpected space`);

  const unitRows = JSON.parse(
    cub([
      "unit",
      "list",
      "--space",
      space,
      "--where",
      where,
      "--select",
      "UnitID,SpaceID,DataHash,DeleteGates,DestroyGates,Labels,LastChangeDescription,HeadRevisionNum,Slug",
      "-o",
      "json",
    ]),
  );
  check(unitRows.length === 6, `expected 6 selected NGINX Units, got ${unitRows.length}`);
  const units = unitRows.map((row) => row.Unit);
  const slugs = units.map((unit) => unit.Slug).sort();
  const attestations = JSON.parse(cub(["attestation", "list", "--space", space, "-o", "json"]));
  const approvalObservations = [];
  for (const unit of units) {
    check(unit.Labels?.Component === component, `${unit.Slug} Component label mismatch`);
    check(unit.Labels?.Variant === variant, `${unit.Slug} Variant label mismatch`);
    check(unit.Labels?.ScanDisposition === "reviewed", `${unit.Slug} missing ScanDisposition=reviewed`);
    check(unit.Labels?.Operation === "bulk-scan-patch", `${unit.Slug} missing Operation=bulk-scan-patch`);
    check(unit.DeleteGates?.["production-review"] === true, `${unit.Slug} missing production-review delete gate`);
    check(unit.DestroyGates?.["production-review"] === true, `${unit.Slug} missing production-review destroy gate`);
    const revision = JSON.parse(cub(["revision", "get", unit.Slug, String(unit.HeadRevisionNum), "--space", space, "-o", "json"]));
    approvalObservations.push(observeApprovalAttestations(unit, revision, attestations));
  }

  const deploymentYaml = cub(["unit", "data", "deployment-nginx-nginx", "--space", space]);
  const deployment = readYamlText(deploymentYaml);
  const nginxContainer = deployment.spec?.template?.spec?.containers?.find((container) => container.name === "nginx");
  check(Boolean(nginxContainer), "deployment-nginx-nginx has no nginx container");
  check(nginxContainer.image === expectedImage, `expected nginx container image ${expectedImage}, got ${nginxContainer.image}`);

  const scanOutput = cub(["function", "vet", "vet-format", "--space", space, "--where", where, "--output", "wide"]);
  const passCount = [...scanOutput.matchAll(/Passed:\s+true\s+Function:\s+vet-format/g)].length;
  check(passCount === 6, `expected vet-format to pass on 6 Units, got ${passCount}`);

  mkdirSync(receiptDir, { recursive: true });
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "UserBulkOpsReceipt",
    metadata: {
      name: `${space}-nginx-bulk-ops`,
    },
    spec: {
      verifier: {
        name: "verify-nginx-bulk-ops-live",
        version: "0.2.0",
      },
      space,
      changeset,
      selector: where,
      expected: {
        component,
        variant,
        unitCount: 6,
        deploymentImage: expectedImage,
        deleteGate: "production-review",
        destroyGate: "production-review",
        scanFunction: "vet-format",
      },
      observed: {
        changesetState: changeSetDoc.ChangeSet.State,
        units: slugs,
        unitCount: units.length,
        attestedRevisionCount: approvalObservations.length,
        approvalObservations,
        deploymentImage: nginxContainer.image,
        vetFormatPassCount: passCount,
        deploymentDataSHA256: sha256(deploymentYaml),
        scanOutputSHA256: sha256(scanOutput),
      },
      checks: [
        { name: "changeset-present", result: "pass" },
        { name: "selected-unit-count", result: "pass", count: units.length },
        { name: "labels-present", result: "pass" },
        { name: "production-gates-present", result: "pass" },
        { name: "selected-revisions-have-active-approval-records", result: "pass" },
        { name: "deployment-image-mutated", result: "pass", image: nginxContainer.image },
        { name: "vet-format-pass", result: "pass", count: passCount },
      ],
      limits: ["Read-only, point-in-time attestation observations. This does not evaluate ChangeWorkflow prerequisites, reviewer eligibility, or prove release authorization."],
      result: "pass",
    },
  };
  writeYaml(receiptPath, receipt);
  writeFileSync(join(receiptDir, "vet-format-output.txt"), scanOutput);

  console.log(`PASS verify-bulk-ops:nginx ${space}`);
  console.log(`changeset: ${changeset}`);
  console.log(`units: ${units.length}`);
  console.log(`revisions with observed approval attestations: ${receipt.spec.observed.attestedRevisionCount}`);
  console.log(`deployment image: ${nginxContainer.image}`);
  console.log(`vet-format passes: ${passCount}`);
  console.log(`receipt: ${relativeRepo(receiptPath)}`);
} catch (error) {
  mkdirSync(receiptDir, { recursive: true });
  writeYaml(receiptPath, {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "UserBulkOpsReceipt",
    metadata: {
      name: `${space}-nginx-bulk-ops`,
    },
    spec: {
      verifier: {
        name: "verify-nginx-bulk-ops-live",
        version: "0.2.0",
      },
      space,
      changeset,
      result: "fail",
      error: error.message,
    },
  });
  console.error(`FAIL verify-bulk-ops:nginx ${space}`);
  console.error(error.message);
  console.error(`receipt: ${relativeRepo(receiptPath)}`);
  process.exitCode = 1;
}

function optionValue(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1];
}

function cub(cubArgs) {
  return execFileSync("cub", cubArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: cubEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
  });
}

function relativeRepo(path) {
  return path.startsWith(`${repoRoot}/`) ? path.slice(repoRoot.length + 1) : path;
}

function printUsage() {
  console.log(`Verify the live ConfigHub NGINX bulk-ops tutorial state.

Usage:
  npm run verify-bulk-ops:nginx -- --space helm-nginx-http-clusterip --changeset nginx-bulk-hardening

Options:
  --space           ConfigHub Space to verify. Default: helm-nginx-http-clusterip
  --changeset       Changeset slug to verify. Default: nginx-bulk-hardening
  --component       Component label selector. Default: NGINX
  --variant         Variant label selector. Default: http-clusterip
  --expected-image  Expected Deployment container image. Default: nginx:1.25.5
  --output-dir      Receipt output directory. Default: .tmp/verify-bulk-ops
`);
}



function selfTestAttestationObservation() {
  const unit = { UnitID: "unit", SpaceID: "space", Slug: "web", HeadRevisionNum: 3, DataHash: "hash" };
  const revision = { UnitID: "unit", RevisionID: "revision", RevisionNum: 3, DataHash: "hash", Attestations: { approval: "" } };
  const pass = { AttestationID: "approval", SpaceID: "space", Type: "Approval", Result: "Pass" };
  check(observeApprovalAttestations(unit, { Revision: revision }, [pass]).attestationIDs[0] === "approval", "linked passing observation rejected");
  const refused = [
    [{ ...revision, RevisionNum: 2 }, [pass]],
    [{ ...revision, DataHash: "other" }, [pass]],
    [revision, {}],
    [{ ...revision, RevisionID: undefined }, [pass]],
    [revision, [{ ...pass, SpaceID: "other" }]],
    [revision, [{ ...pass, Result: "Fail" }]],
    [revision, [{ ...pass, ExpiresAt: "2000-01-01T00:00:00Z" }]],
    [revision, [{ ...pass, ExpiresAt: "invalid" }]],
    ...["", false, 0, null].map((ExpiresAt) => [revision, [{ ...pass, ExpiresAt }]]),
    [revision, [pass, { AttestationID: "revocation", RevokedAttestationID: "approval" }]],
    [{ ...revision, Attestations: {} }, [pass]],
  ];
  for (const [r, a] of refused) {
    let failed = false;
    try { observeApprovalAttestations(unit, r, a); } catch { failed = true; }
    check(failed, "invalid attestation observation was accepted");
  }
  console.log("verified current attestation observations and fourteen refusal cases");
}
