#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, toYaml, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "webhook-cert-lifecycle");
const summaryPath = join(outDir, "summary.md");
const evidencePath = join(outDir, "evidence.csv");

const cases = [
  {
    id: "ingress-nginx-ingress-nginx-4.15.1-default",
    chart: "ingress-nginx/ingress-nginx",
    version: "4.15.1",
    base: "default",
    route: "generated-fact-staged-secret",
    stagedSecret: {
      namespace: "ingress-nginx",
      name: "ingress-nginx-admission",
      keys: ["cert", "key"],
    },
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/ingress-nginx-ingress-nginx-4.15.1-default/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
  },
  {
    id: "fairwinds-stable-vpa-4.11.0-default",
    chart: "fairwinds-stable/vpa",
    version: "4.11.0",
    base: "default",
    route: "generated-fact-staged-secret",
    stagedSecret: {
      namespace: "default",
      name: "vpa-tls-secret",
      keys: ["ca", "cert", "key"],
    },
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/fairwinds-stable-vpa-4.11.0-default/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
  },
  {
    id: "fairwinds-stable-vpa-4.11.0-no-crds",
    chart: "fairwinds-stable/vpa",
    version: "4.11.0",
    base: "no-crds",
    route: "target-facts-staged-crds-and-secret",
    stagedSecret: {
      namespace: "default",
      name: "vpa-tls-secret",
      keys: ["ca", "cert", "key"],
    },
    stagedCrdsFrom: "recipes/fairwinds-stable/vpa/4.11.0/revisions/default/r001/rendered/release-objects.yaml",
    expectedCrdCount: 2,
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/fairwinds-stable-vpa-4.11.0-no-crds/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, long-term serving certificate management, or CRD upgrade safety.",
  },
  {
    id: "prometheus-community-kube-prometheus-stack-86.1.0-default",
    chart: "prometheus-community/kube-prometheus-stack",
    version: "86.1.0",
    base: "default",
    route: "generated-fact-staged-secret",
    stagedSecret: {
      namespace: "monitoring",
      name: "kube-prometheus-stack-admission",
      keys: ["cert", "key"],
    },
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/prometheus-community-kube-prometheus-stack-86.1.0-default/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
  },
  {
    id: "prometheus-community-kube-prometheus-stack-86.1.0-no-crds",
    chart: "prometheus-community/kube-prometheus-stack",
    version: "86.1.0",
    base: "no-crds",
    route: "target-facts-staged-crds-and-secret",
    stagedSecret: {
      namespace: "monitoring",
      name: "kube-prometheus-stack-admission",
      keys: ["cert", "key"],
    },
    stagedCrdsFrom: "recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/default/r001/rendered/release-objects.yaml",
    expectedCrdCount: 10,
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/prometheus-community-kube-prometheus-stack-86.1.0-no-crds/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, long-term serving certificate management, or CRD upgrade safety.",
  },
  {
    id: "prometheus-community-kube-prometheus-stack-85.3.3-no-crds",
    chart: "prometheus-community/kube-prometheus-stack",
    version: "85.3.3",
    base: "no-crds",
    route: "target-facts-staged-crds-and-secret",
    stagedSecret: {
      namespace: "monitoring",
      name: "kube-prometheus-stack-admission",
      keys: ["cert", "key"],
    },
    stagedCrdsFrom: "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml",
    expectedCrdCount: 10,
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/prometheus-community-kube-prometheus-stack-85.3.3-no-crds/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, long-term serving certificate management, or CRD upgrade safety.",
  },
  {
    id: "autoscaler-vertical-pod-autoscaler-0.9.0-default",
    chart: "autoscaler/vertical-pod-autoscaler",
    version: "0.9.0",
    base: "default",
    route: "generated-fact-staged-secret",
    stagedSecret: {
      namespace: "default",
      name: "vpa-tls-certs",
      keys: ["ca", "cert", "key"],
    },
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/autoscaler-vertical-pod-autoscaler-0.9.0-default/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
  },
  {
    id: "autoscaler-vertical-pod-autoscaler-0.9.0-no-crds",
    chart: "autoscaler/vertical-pod-autoscaler",
    version: "0.9.0",
    base: "no-crds",
    route: "generated-fact-staged-secret",
    stagedSecret: {
      namespace: "default",
      name: "vpa-tls-certs",
      keys: ["ca", "cert", "key"],
    },
    generationMethod: "local-self-signed-certificate",
    pairedObservation: "runs/next80-local-kind/autoscaler-vertical-pod-autoscaler-0.9.0-no-crds/observation-receipt.yaml",
    productionBoundary: "Does not claim production CA trust, admission policy safety, certificate rotation, or long-term serving certificate management.",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(evidencePath, report.csv);
  for (const item of report.items) writeYaml(join(outDir, "receipts", `${item.id}.yaml`), item.receipt);
  console.log(`wrote webhook cert lifecycle evidence -> ${relativeRepo(outDir)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/webhook-cert-lifecycle/summary.md is missing; run npm run webhook-cert:lifecycle");
  check(existsSync(evidencePath), "data/webhook-cert-lifecycle/evidence.csv is missing; run npm run webhook-cert:lifecycle");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/webhook-cert-lifecycle/summary.md is stale; run npm run webhook-cert:lifecycle");
  check(readFileSync(evidencePath, "utf8") === report.csv, "data/webhook-cert-lifecycle/evidence.csv is stale; run npm run webhook-cert:lifecycle");
  for (const item of report.items) {
    const path = join(outDir, "receipts", `${item.id}.yaml`);
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run webhook-cert:lifecycle`);
    check(readFileSync(path, "utf8") === `${toYaml(item.receipt)}\n`, `${relativeRepo(path)} is stale; run npm run webhook-cert:lifecycle`);
  }
  console.log(`verified webhook cert lifecycle evidence for ${report.items.length} staged route(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-webhook-cert-lifecycle-evidence.mjs --generate
  node scripts/generate-webhook-cert-lifecycle-evidence.mjs --verify`);
}

function buildReport() {
  const items = cases.map((item) => {
    const observationPath = join(repoRoot, item.pairedObservation);
    check(existsSync(observationPath), `${item.pairedObservation} is missing`);
    const observation = readYaml(observationPath);
    check(observation.kind === "ObservationReceipt", `${item.pairedObservation} must be an ObservationReceipt`);
    check(observation.spec?.result === "pass", `${item.pairedObservation} must be a passing observation receipt`);
    const stagedCrds = stagedCrdsFor(item);
    const receipt = stagingReceipt(item, observation);
    return {
      ...item,
      stagedCrds,
      observedAt: observation.spec.observedAt,
      observer: observation.spec.observer?.name ?? "",
      target: observation.spec.target?.name ?? "",
      result: observation.spec.result,
      receiptPath: `data/webhook-cert-lifecycle/receipts/${item.id}.yaml`,
      receipt,
    };
  });
  return {
    items,
    csv: toCsv(items.map(csvRow)),
    summary: summary(items),
  };
}

function stagingReceipt(item, observation) {
  const stagedCrds = stagedCrdsFor(item);
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "WebhookCertLifecycleStagingReceipt",
    metadata: {
      name: `${item.id}-webhook-cert-staging`,
    },
    spec: {
      chart: item.chart,
      version: item.version,
      base: item.base,
      result: "pass",
      observedAt: observation.spec.observedAt,
      route: item.route,
      stagedSecret: item.stagedSecret,
      generation: {
        method: item.generationMethod,
        secretMaterialCommitted: false,
      },
      ...(stagedCrds.length
        ? {
            stagedCrds: {
              source: item.stagedCrdsFrom,
              count: stagedCrds.length,
              names: stagedCrds,
            },
          }
        : {}),
      pairedObservation: {
        receipt: item.pairedObservation,
        result: observation.spec.result,
        target: observation.spec.target?.name ?? "",
        namespace: observation.spec.target?.namespace ?? "",
      },
      proofBoundary: [
        stagedCrds.length
          ? "Proves explicit CRD and serving certificate prerequisites can make this no-CRDs base converge on this local kind target."
          : "Proves an explicit staged serving certificate Secret can replace a hidden chart lifecycle side effect for this local kind target.",
        item.productionBoundary,
      ],
    },
  };
}

function csvRow(item) {
  const stagedCrds = item.stagedCrds ?? [];
  return {
    chart: `${item.chart}@${item.version}`,
    base: item.base,
    result: item.result,
    route: item.route,
    staged_secret: `${item.stagedSecret.namespace}/${item.stagedSecret.name}`,
    staged_secret_keys: item.stagedSecret.keys.join(";"),
    staged_crds: stagedCrds.join(";"),
    staged_crd_count: stagedCrds.length,
    staged_crd_source: item.stagedCrdsFrom ?? "",
    generation_method: item.generationMethod,
    paired_observation: item.pairedObservation,
    staging_receipt: item.receiptPath,
    observed_at: item.observedAt,
    proof_boundary: item.productionBoundary,
  };
}

function summary(items) {
  return `# Webhook Certificate Lifecycle Evidence

This generated report records local live rows that passed only after explicit
webhook serving certificate material was staged before apply. These rows prove a
route for replacing hidden chart lifecycle side effects with declared target or
generated facts. They do not claim production certificate management.

## Snapshot

~~~text
staged certificate routes: ${items.length}
passing observations:     ${items.filter((item) => item.result === "pass").length}
routes with staged CRDs:  ${items.filter((item) => item.stagedCrds?.length).length}
~~~

## Rows

| Chart | Base | Route | Staged Secret | Staged CRDs | Observation | Receipt |
| --- | --- | --- | --- | ---: | --- | --- |
${items.map((item) => `| \`${item.chart}@${item.version}\` | ${item.base} | \`${item.route}\` | \`${item.stagedSecret.namespace}/${item.stagedSecret.name}\` | ${item.stagedCrds?.length ?? 0} | [observation](../../${item.pairedObservation}) | [staging receipt](./receipts/${item.id}.yaml) |`).join("\n")}

## What This Proves

The live Kubernetes workload can converge when the webhook serving certificate
is represented as explicit prerequisite material instead of an implicit Helm
hook or controller side effect. For no-CRDs bases, the route also proves the
declared CRDs can be staged before applying the config-only rendered objects.

## What This Does Not Prove

These receipts do not prove production CA trust, admission policy safety,
certificate rotation, or long-term serving certificate management. Production
support still needs a target-scoped decision for how the Secret is created,
owned, rotated, and audited. No-CRDs rows also need a target-scoped CRD
ownership and upgrade policy.

Machine-readable files:

~~~text
data/webhook-cert-lifecycle/evidence.csv
data/webhook-cert-lifecycle/receipts/*.yaml
~~~

Regenerate and verify:

~~~sh
npm run webhook-cert:lifecycle
npm run webhook-cert:lifecycle:verify
~~~
`;
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function stagedCrdsFor(item) {
  if (!item.stagedCrdsFrom) return [];
  const sourcePath = join(repoRoot, item.stagedCrdsFrom);
  check(existsSync(sourcePath), `${item.stagedCrdsFrom} is missing`);
  const crds = parseDocs(readFileSync(sourcePath, "utf8"))
    .filter((doc) => doc.kind === "CustomResourceDefinition")
    .map((doc) => doc.metadata?.name)
    .filter(Boolean)
    .sort();
  check(crds.length === item.expectedCrdCount, `${item.id} expected ${item.expectedCrdCount} staged CRDs, found ${crds.length}`);
  return crds;
}
