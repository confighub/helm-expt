import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "derived-variant-execution");

const expectedReceipts = [
  {
    id: "nginx-prod-us-east",
    variant: "prod-us-east",
    downstreamSpace: "NGINX-prod-us-east",
    downstreamSpaceID: "da5ffe01-c2d8-4007-a4f9-438084172a69",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "web-targets/prod-us-east",
  },
  {
    id: "nginx-customer-acme-prod",
    variant: "customer-acme-prod",
    downstreamSpace: "NGINX-customer-acme-prod",
    downstreamSpaceID: "0992a342-311e-4aa2-85a0-1189dd3aa3bd",
    environment: "Prod",
    region: "us-west",
    desiredTarget: "web-targets/customer-acme-prod",
  },
];

for (const expected of expectedReceipts) {
  verifyReceipt(expected);
}

console.log(`verified ${expectedReceipts.length} derived variant live receipt(s)`);

function verifyReceipt(expected) {
  const receiptPath = join(receiptRoot, expected.id, "variant-create-receipt.yaml");
  check(existsSync(receiptPath), `${expected.id} live receipt is missing`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "DerivedVariantExecutionReceipt", `${expected.id} receipt kind mismatch`);
  check(receipt.spec?.run?.date === "2026-06-05", `${expected.id} run date mismatch`);
  check(receipt.spec?.source?.component === "NGINX", `${expected.id} component mismatch`);
  check(receipt.spec?.source?.chart === "bitnami/nginx", `${expected.id} chart mismatch`);
  check(receipt.spec?.source?.base === "http-clusterip", `${expected.id} base mismatch`);
  check(receipt.spec?.source?.sourceSpace === "helm-nginx-confighub-proof", `${expected.id} source space mismatch`);
  check(receipt.spec?.source?.sourceSpaceID === "25a49519-f0c1-42ee-b697-73b1f687c866", `${expected.id} source space ID mismatch`);
  check(receipt.spec?.create?.result === "pass", `${expected.id} create result must pass`);
  check(receipt.spec?.create?.variant === expected.variant, `${expected.id} variant mismatch`);
  check(receipt.spec?.create?.downstreamSpace === expected.downstreamSpace, `${expected.id} downstream space mismatch`);
  check(receipt.spec?.create?.downstreamSpaceID === expected.downstreamSpaceID, `${expected.id} downstream space ID mismatch`);
  check(receipt.spec?.create?.environment === expected.environment, `${expected.id} environment mismatch`);
  check(receipt.spec?.create?.region === expected.region, `${expected.id} region mismatch`);
  check(!receipt.spec?.create?.command?.includes(" --target "), `${expected.id} live command must not claim a target binding`);
  check(receipt.spec?.target?.desired === expected.desiredTarget, `${expected.id} desired target mismatch`);
  check(receipt.spec?.target?.bound === false, `${expected.id} target must be unbound`);
  check(receipt.spec?.target?.targetBoundUnitCount === 0, `${expected.id} must have zero target-bound Units`);
  check(receipt.spec?.target?.status === "target-omitted-in-current-context", `${expected.id} target status mismatch`);
  check(receipt.spec?.clone?.unitCount === 7, `${expected.id} must clone 7 Units`);
  check(receipt.spec?.clone?.upstreamLinkedUnitCount === 7, `${expected.id} must preserve 7 upstream Unit links`);
  check(receipt.spec?.clone?.sourceDataHashCount === 7, `${expected.id} source hash count mismatch`);
  check(receipt.spec?.clone?.downstreamDataHashCount === 7, `${expected.id} downstream hash count mismatch`);
  check(receipt.spec?.clone?.sameDataHashSetAsSource === true, `${expected.id} data hash set must match source`);
  check(receipt.spec?.gates?.deleteGateUnitCount === 7, `${expected.id} delete gates must be present on 7 Units`);
  check(receipt.spec?.gates?.destroyGateUnitCount === 7, `${expected.id} destroy gates must be present on 7 Units`);
  check(receipt.spec?.liveApply?.result === "not-attempted", `${expected.id} live apply result mismatch`);
  check(receipt.spec?.result === "pass", `${expected.id} receipt result must pass`);
}
