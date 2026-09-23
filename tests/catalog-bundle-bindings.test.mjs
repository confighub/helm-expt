import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { findCatalogBundleBinding, loadCatalogBundleBindings } from "../scripts/lib/catalog-bundle-bindings.mjs";

const records = JSON.parse(readFileSync("data/base-variant-records/records.json", "utf8")).records;
const candidates = loadCatalogBundleBindings();
const record = (name) => structuredClone(records.find((entry) => entry.metadata.name === name));

test("binds only the exact retained Traefik and cert-manager configurations", () => {
  const traefik = findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), candidates);
  assert.equal(traefik.ociRef, "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-traefik-traefik-41-0-2-default:latest@sha256:1414198b6b71d7b187904ec88c3c3093b21b849016f6922fbcff41a19e8e5c3b");
  assert.equal(traefik.sourcePaths.receipt, "data/certified-bundles/receipts/catalog/traefik-traefik-41.0.2-default/receipt.yaml");
  assert.equal(traefik.sourcePaths.publicationReceipt, "runs/certified-bundles/catalog-traefik-traefik-41-0-2-default/publication-receipt.yaml");
  assert.equal(traefik.hashes.configuration, "sha256:460d20fb9271461c0ccf38da58c7aa940fd691aca94b48cf76aed24465a982ac");
  assert.match(traefik.hashes.certifiedReceipt, /^sha256:[a-f0-9]{64}$/);
  assert.match(traefik.hashes.publicationReceipt, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(traefik.routeFiles.map((file) => file.path), ["data/certified-bundles/routes/catalog/traefik-traefik-41.0.2-default/crd-ordering.yaml"]);
  assert.deepEqual(traefik.verdict, { lane: "flatten-with-routes", status: "certified" });
  assert.match(traefik.boundaries.routesNotExecuted, /does not prove a remote pullback or route execution/);

  const certManager = findCatalogBundleBinding(record("jetstack-cert-manager-v1-21-0-crds-enabled"), candidates);
  assert.deepEqual(certManager.routeFiles.map((file) => file.path), [
    "data/certified-bundles/routes/catalog/jetstack-cert-manager-v1.21.0-crds-enabled/crd-ordering.yaml",
    "data/certified-bundles/routes/catalog/jetstack-cert-manager-v1.21.0-crds-enabled/prune-protection.yaml",
  ]);
  assert.equal(certManager.sourcePaths.configuration, "recipes/jetstack/cert-manager/v1.21.0/revisions/crds-enabled/r001/rendered/release-objects.yaml");

  const gatekeeper = findCatalogBundleBinding(record("gatekeeper-gatekeeper-3-22-2-default"), candidates);
  assert.equal(gatekeeper.sourcePaths.publicationReceipt, "runs/certified-bundles/catalog-gatekeeper-gatekeeper-3-22-2-default/publication-receipt.yaml");
});

test("never inherits a bundle across versions, bases, or configuration digests", () => {
  for (const [field, value] of [
    ["version", "41.0.3"],
    ["base", "non-default"],
    ["digest", "0".repeat(64)],
  ]) {
    const changed = record("traefik-traefik-41-0-2-default");
    if (field === "version") changed.spec.source.version = value;
    else if (field === "base") changed.spec.baseVariant.name = value;
    else changed.spec.configuration.digest = value;
    assert.equal(findCatalogBundleBinding(changed, candidates), null, field);
  }
  assert.equal(findCatalogBundleBinding(record("prometheus-community-kube-prometheus-stack-87-19-2-default"), candidates), null);
});

test("refuses an exact candidate whose publication evidence disagrees", () => {
  const altered = structuredClone(candidates);
  const candidate = altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default");
  candidate.publication.spec.manifestDigest = `sha256:${"0".repeat(64)}`;
  assert.throws(() => findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered), /publication receipt disagrees/);
});

test("leaves an ordinary unpublished exact candidate unbound", () => {
  const unpublished = structuredClone(candidates);
  unpublished.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default").row.oci_published = "not-published";
  assert.equal(findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), unpublished), null);
});

test("refuses ambiguous exact certified bundle evidence", () => {
  const ambiguous = [...candidates, structuredClone(candidates.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default"))];
  assert.throws(() => findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), ambiguous), /multiple exact certified bundle receipts/);
});


test("never binds a route whose retained bytes disagree with the receipt", () => {
  const altered = structuredClone(candidates);
  const candidate = altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default");
  candidate.receipt.spec.bundle.files.find((file) => file.role.startsWith("route: ")).sha256 = "0".repeat(64);
  assert.equal(findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered), null);
});

test("a claimed publication requires its matching publication receipt", () => {
  const altered = structuredClone(candidates);
  altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default").publication = null;
  assert.throws(() => findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered), /publication receipt is missing/);
});


test("publication binding preserves a watch verdict rather than certifying it", () => {
  const altered = structuredClone(candidates);
  const candidate = altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default");
  candidate.row.verdict_status = "watch";
  candidate.receipt.spec.verdict.status = "watch";
  const binding = findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered);
  assert.equal(binding.verdict.status, "watch");
});


test("a larger bundle cannot masquerade as one exact configuration", () => {
  const altered = structuredClone(candidates);
  const candidate = altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default");
  candidate.receipt.spec.bundle.files.push({ path: "extra.yaml", sha256: "0".repeat(64), role: "rendered object set" });
  assert.equal(findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered), null);
});

test("the bound bundle object count must match the selected configuration", () => {
  const altered = structuredClone(candidates);
  const candidate = altered.find((entry) => entry.receipt?.metadata?.name === "catalog-traefik-traefik-41.0.2-default");
  candidate.receipt.spec.bundle.objectCount += 1;
  assert.equal(findCatalogBundleBinding(record("traefik-traefik-41-0-2-default"), altered), null);
});
