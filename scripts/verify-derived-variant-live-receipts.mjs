import { existsSync } from "node:fs";
import { join } from "node:path";
import { check, readYaml, repoRoot } from "./lib/proof-common.mjs";

const receiptRoot = join(repoRoot, "runs", "derived-variant-execution");

const expectedReceipts = [
  {
    id: "nginx-prod-us-east",
    component: "NGINX",
    chart: "bitnami/nginx",
    chartVersion: "24.0.2",
    base: "http-clusterip",
    sourceSpace: "helm-nginx-confighub-proof",
    sourceSpaceID: "25a49519-f0c1-42ee-b697-73b1f687c866",
    proofReceipt: "runs/nginx-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#nginx-prod-us-east",
    variant: "prod-us-east",
    downstreamSpace: "NGINX-prod-us-east",
    downstreamSpaceID: "da5ffe01-c2d8-4007-a4f9-438084172a69",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "web-targets/prod-us-east",
    unitCount: 7,
    deleteGateUnitCount: 7,
    destroyGateUnitCount: 7,
  },
  {
    id: "nginx-customer-acme-prod",
    component: "NGINX",
    chart: "bitnami/nginx",
    chartVersion: "24.0.2",
    base: "http-clusterip",
    sourceSpace: "helm-nginx-confighub-proof",
    sourceSpaceID: "25a49519-f0c1-42ee-b697-73b1f687c866",
    proofReceipt: "runs/nginx-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#nginx-customer-acme-prod",
    variant: "customer-acme-prod",
    downstreamSpace: "NGINX-customer-acme-prod",
    downstreamSpaceID: "0992a342-311e-4aa2-85a0-1189dd3aa3bd",
    environment: "Prod",
    region: "us-west",
    desiredTarget: "web-targets/customer-acme-prod",
    unitCount: 7,
    deleteGateUnitCount: 7,
    destroyGateUnitCount: 7,
  },
  {
    id: "redis-prod-us-east",
    component: "Redis",
    chart: "bitnami/redis",
    chartVersion: "25.5.3",
    base: "default",
    sourceSpace: "helm-redis-confighub-proof",
    sourceSpaceID: "6d4b51b7-dfb4-4a29-9f59-310adf3d38d8",
    proofReceipt: "runs/redis-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#redis-prod-us-east",
    variant: "prod-us-east",
    downstreamSpace: "Redis-prod-us-east",
    downstreamSpaceID: "18b9f9fb-7c4f-41b1-b7a2-0e1a7267bc12",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "redis-targets/prod-us-east",
    unitCount: 15,
    deleteGateUnitCount: 15,
    destroyGateUnitCount: 15,
  },
  {
    id: "redis-staging-eu-west",
    component: "Redis",
    chart: "bitnami/redis",
    chartVersion: "25.5.3",
    base: "default",
    sourceSpace: "helm-redis-confighub-proof",
    sourceSpaceID: "6d4b51b7-dfb4-4a29-9f59-310adf3d38d8",
    proofReceipt: "runs/redis-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#redis-staging-eu-west",
    variant: "staging-eu-west",
    downstreamSpace: "Redis-staging-eu-west",
    downstreamSpaceID: "2a4d57bf-24f4-4f4f-8542-6c2d4bc28c2e",
    environment: "Staging",
    region: "eu-west",
    desiredTarget: "redis-targets/staging-eu-west",
    unitCount: 15,
    deleteGateUnitCount: 0,
    destroyGateUnitCount: 0,
  },
  {
    id: "prometheus-prod-us-east",
    component: "Prometheus",
    chart: "prometheus-community/prometheus",
    chartVersion: "29.8.0",
    base: "default",
    sourceSpace: "helm-prometheus-confighub-proof",
    sourceSpaceID: "7ac1d202-53f2-4a75-b6cf-0ebc3656ee5f",
    proofReceipt: "runs/prometheus-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#prometheus-prod-us-east",
    variant: "prod-us-east",
    downstreamSpace: "Prometheus-prod-us-east",
    downstreamSpaceID: "0cb02152-b459-400d-8f73-c1cf60e06bc7",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "monitoring-targets/prod-us-east",
    unitCount: 25,
    deleteGateUnitCount: 25,
    destroyGateUnitCount: 25,
  },
  {
    id: "prometheus-staging-eu-west",
    component: "Prometheus",
    chart: "prometheus-community/prometheus",
    chartVersion: "29.8.0",
    base: "default",
    sourceSpace: "helm-prometheus-confighub-proof",
    sourceSpaceID: "7ac1d202-53f2-4a75-b6cf-0ebc3656ee5f",
    proofReceipt: "runs/prometheus-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#prometheus-staging-eu-west",
    variant: "staging-eu-west",
    downstreamSpace: "Prometheus-staging-eu-west",
    downstreamSpaceID: "3a0a77bf-213c-4032-8bc6-471e3df21066",
    environment: "Staging",
    region: "eu-west",
    desiredTarget: "monitoring-targets/staging-eu-west",
    unitCount: 25,
    deleteGateUnitCount: 0,
    destroyGateUnitCount: 0,
  },
  {
    id: "grafana-prod-us-east",
    component: "Grafana",
    chart: "grafana/grafana",
    chartVersion: "10.5.15",
    base: "generated-passwords",
    sourceSpace: "helm-grafana-confighub-proof",
    sourceSpaceID: "4b752caf-5366-4fce-82b0-2f5a425c4ebc",
    proofReceipt: "runs/grafana-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#grafana-prod-us-east",
    variant: "prod-us-east",
    downstreamSpace: "Grafana-prod-us-east",
    downstreamSpaceID: "966cd13a-9f78-491c-b301-00a8fa733550",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "observability-targets/prod-us-east",
    unitCount: 10,
    deleteGateUnitCount: 10,
    destroyGateUnitCount: 10,
    correctiveUpdate: {
      unit: "deployment-grafana-grafana",
      fromDataHash: "7a8e898ea1e2b28337b19761557dc871b77fccbe678ba6e4b16034fe19f85b66",
      toDataHash: "5dfbc8d19c228c529c2f1b0fb32be35b3851d1bb120da6a55e2ead4006d82ea7",
    },
  },
  {
    id: "grafana-customer-acme-prod",
    component: "Grafana",
    chart: "grafana/grafana",
    chartVersion: "10.5.15",
    base: "generated-passwords",
    sourceSpace: "helm-grafana-confighub-proof",
    sourceSpaceID: "4b752caf-5366-4fce-82b0-2f5a425c4ebc",
    proofReceipt: "runs/grafana-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#grafana-customer-acme-prod",
    variant: "customer-acme-prod",
    downstreamSpace: "Grafana-customer-acme-prod",
    downstreamSpaceID: "5fa4e016-6405-484f-86bc-ec7b596295df",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "observability-targets/customer-acme-prod",
    unitCount: 10,
    deleteGateUnitCount: 10,
    destroyGateUnitCount: 10,
    correctiveUpdate: {
      unit: "deployment-grafana-grafana",
      fromDataHash: "7a8e898ea1e2b28337b19761557dc871b77fccbe678ba6e4b16034fe19f85b66",
      toDataHash: "5dfbc8d19c228c529c2f1b0fb32be35b3851d1bb120da6a55e2ead4006d82ea7",
    },
  },
  {
    id: "vault-regulated-prod-us-east",
    component: "Vault",
    chart: "hashicorp/vault",
    chartVersion: "0.32.0",
    base: "default",
    sourceSpace: "helm-vault-confighub-proof",
    sourceSpaceID: "b831ae1e-c976-4e14-9d8b-250924938972",
    proofReceipt: "runs/vault-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#vault-regulated-prod-us-east",
    variant: "regulated-prod-us-east",
    downstreamSpace: "Vault-regulated-prod-us-east",
    downstreamSpaceID: "2e2a997d-f9df-4c3e-b536-bec9d6bc88c0",
    environment: "Prod",
    region: "us-east",
    desiredTarget: "security-targets/regulated-prod-us-east",
    unitCount: 14,
    deleteGateUnitCount: 14,
    destroyGateUnitCount: 14,
  },
  {
    id: "vault-staging-us-east",
    component: "Vault",
    chart: "hashicorp/vault",
    chartVersion: "0.32.0",
    base: "default",
    sourceSpace: "helm-vault-confighub-proof",
    sourceSpaceID: "b831ae1e-c976-4e14-9d8b-250924938972",
    proofReceipt: "runs/vault-confighub-proof/latest/confighub-proof-receipt.yaml",
    workOrder: "data/variant-goldens/derived-expansion-wave/work-orders.yaml#vault-staging-us-east",
    variant: "staging-us-east",
    downstreamSpace: "Vault-staging-us-east",
    downstreamSpaceID: "bae37e27-06e4-48f9-b8a8-0a51a5ab064a",
    environment: "Staging",
    region: "us-east",
    desiredTarget: "security-targets/staging-us-east",
    unitCount: 14,
    deleteGateUnitCount: 0,
    destroyGateUnitCount: 0,
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
  check(receipt.spec?.source?.component === expected.component, `${expected.id} component mismatch`);
  check(receipt.spec?.source?.chart === expected.chart, `${expected.id} chart mismatch`);
  check(receipt.spec?.source?.chartVersion === expected.chartVersion, `${expected.id} chart version mismatch`);
  check(receipt.spec?.source?.base === expected.base, `${expected.id} base mismatch`);
  check(receipt.spec?.source?.sourceSpace === expected.sourceSpace, `${expected.id} source space mismatch`);
  check(receipt.spec?.source?.sourceSpaceID === expected.sourceSpaceID, `${expected.id} source space ID mismatch`);
  check(receipt.spec?.source?.proofReceipt === expected.proofReceipt, `${expected.id} proof receipt mismatch`);
  check(receipt.spec?.source?.workOrder === expected.workOrder, `${expected.id} work order mismatch`);
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
  check(receipt.spec?.clone?.unitCount === expected.unitCount, `${expected.id} unit count mismatch`);
  check(receipt.spec?.clone?.upstreamLinkedUnitCount === expected.unitCount, `${expected.id} upstream link count mismatch`);
  check(receipt.spec?.clone?.sourceDataHashCount === expected.unitCount, `${expected.id} source hash count mismatch`);
  check(receipt.spec?.clone?.downstreamDataHashCount === expected.unitCount, `${expected.id} downstream hash count mismatch`);
  check(receipt.spec?.clone?.sameDataHashSetAsSource === true, `${expected.id} data hash set must match source`);
  check(receipt.spec?.gates?.deleteGateUnitCount === expected.deleteGateUnitCount, `${expected.id} delete gate count mismatch`);
  check(receipt.spec?.gates?.destroyGateUnitCount === expected.destroyGateUnitCount, `${expected.id} destroy gate count mismatch`);
  if (expected.correctiveUpdate) {
    check(receipt.spec?.correctiveUpdate?.result === "pass", `${expected.id} corrective update must pass`);
    check(receipt.spec?.correctiveUpdate?.unit === expected.correctiveUpdate.unit, `${expected.id} corrective update unit mismatch`);
    check(receipt.spec?.correctiveUpdate?.fromDataHash === expected.correctiveUpdate.fromDataHash, `${expected.id} corrective update source hash mismatch`);
    check(receipt.spec?.correctiveUpdate?.toDataHash === expected.correctiveUpdate.toDataHash, `${expected.id} corrective update target hash mismatch`);
    check(receipt.spec?.correctiveUpdate?.affectedUnitCount === 1, `${expected.id} corrective update count mismatch`);
  } else {
    check(receipt.spec?.correctiveUpdate === undefined, `${expected.id} must not claim a corrective update`);
  }
  check(receipt.spec?.liveApply?.result === "not-attempted", `${expected.id} live apply result mismatch`);
  check(receipt.spec?.result === "pass", `${expected.id} receipt result must pass`);
}
