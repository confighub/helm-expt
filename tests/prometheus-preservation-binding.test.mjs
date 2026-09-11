import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { readYaml, repoRoot } from "../scripts/lib/proof-common.mjs";
import { validateReceipt } from "../scripts/run-prometheus-upgrade-preservation-proof.mjs";

const receiptPath = `${repoRoot}/runs/prometheus-upgrade-preservation-proof/receipt.yaml`;

export function testPrometheusPreservationBinding() {
  const original = readYaml(receiptPath);
  assert.doesNotThrow(() => validateReceipt(original));
  const mutations = [
    ["source base", (r) => { r.spec.source.base = "other"; }],
    ["source namespace", (r) => { r.spec.source.namespace = "other"; }],
    ["current version", (r) => { r.spec.source.current.version = "29.8.1"; }],
    ["current ref", (r) => { r.spec.source.current.ref = "oci://example.invalid/current"; }],
    ["current layer", (r) => { r.spec.source.current.layerDigest = "sha256:" + "0".repeat(64); }],
    ["candidate app version", (r) => { r.spec.source.candidate.appVersion = "v0.0.0"; }],
    ["candidate ref", (r) => { r.spec.source.candidate.ref = "oci://example.invalid/candidate"; }],
    ["inspection digest", (r) => { r.spec.source.packageInspection.current.manifestDigest = "sha256:" + "0".repeat(64); }],
    ["inspection result", (r) => { r.spec.source.packageInspection.candidate.result = "watch"; }],
    ["user resource", (r) => { r.spec.userChange.resource = "apps/v1/Deployment monitoring/other"; }],
    ["user field", (r) => { r.spec.userChange.field = "spec.template"; }],
    ["chart value", (r) => { r.spec.userChange.chartValue = 2; }],
    ["user result", (r) => { r.spec.userChange.result = "watch"; }],
    ["base result", (r) => { r.spec.baseUpgrade.result = "watch"; }],
    ["base source flag", (r) => { r.spec.baseUpgrade.planShowedSourceChanges = false; }],
    ["preview result", (r) => { r.spec.stagingPromotion.result = "watch"; }],
    ["preview source flag", (r) => { r.spec.stagingPromotion.previewShowedSourceChanges = false; }],
    ["preview baseline hash", (r) => { delete r.spec.stagingPromotion.beforePreview.objectSha256; }],
    ["preview result hash", (r) => { delete r.spec.stagingPromotion.afterPreview.objectSha256; }],
    ["both preview hashes missing", (r) => { delete r.spec.stagingPromotion.beforePreview.objectSha256; delete r.spec.stagingPromotion.afterPreview.objectSha256; }],
    ["base resource", (r) => { r.spec.baseUpgrade.before.resource = "apps/v1/Deployment monitoring/other"; }],
    ["candidate image", (r) => { r.spec.baseUpgrade.renderedCandidate.image = "quay.io/prometheus/prometheus:v0.0.0"; }],
    ["promotion identity", (r) => { r.spec.stagingPromotion.afterPromotion.appVersion = "v0.0.0"; }],
  ];
  for (const [label, mutate] of mutations) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => validateReceipt(changed), undefined, label);
  }
}

if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  testPrometheusPreservationBinding();
  console.log("Prometheus preservation binding tests passed");
}
