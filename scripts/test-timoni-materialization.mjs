import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocs, readYaml, repoRoot, toYaml } from "./lib/proof-common.mjs";
import { buildTimoniInventory, buildTimoniReceipt } from "./lib/timoni-materialization.mjs";

const root = "examples/timoni/redis-8-10-1";
const text = (path) => readFileSync(join(repoRoot, path), "utf8");
const yaml = (path) => readYaml(join(repoRoot, path));
const objectsText = text(`${root}/rendered/release-objects.yaml`);
const objects = parseDocs(objectsText);
const inventory = buildTimoniInventory(objects, objectsText, `${root}/source-lock.yaml`);
assert.equal(`${JSON.stringify(inventory, null, 2)}\n`, text(`${root}/rendered/object-inventory.json`));
const retained = yaml(`${root}/generation-receipt.yaml`);
const input = {
  lock: yaml(`${root}/source-lock.yaml`),
  lifecycleRecord: yaml(`${root}/lifecycle-route-intent.yaml`),
  flatteningRecord: yaml(`${root}/flattening-safety-verdict.yaml`),
  inventoryRecord: inventory,
  schemaText: text(`${root}/config-schema.cue`),
  schemaPath: `${root}/config-schema.cue`, objects,
  observations: retained.spec.observations,
};
assert.equal(`${toYaml(buildTimoniReceipt(input))}\n`, text(`${root}/generation-receipt.yaml`));

// A different selection must not inherit Redis identifiers or observations.
// This is a test fixture, not another admitted or executed Catalog module.
const other = structuredClone(input);
other.lock.metadata.name = "test-module-staging";
other.lock.spec.source.module = "oci://registry.example.test/modules/test-module";
other.lock.spec.source.version = "2.0.0";
other.lock.spec.selection.instance = "test-module";
other.lock.spec.selection.namespace = "staging";
other.lock.spec.selection.values = "examples/test-module/staging.cue";
other.lock.spec.selection.maskSecrets = false;
other.schemaPath = "examples/test-module/config-schema.cue";
other.lock.spec.output = { objects: "examples/test-module/rendered/objects.yaml", inventory: "examples/test-module/rendered/inventory.json" };
other.lock.spec.lifecycle = { routeIntent: "examples/test-module/lifecycle.yaml", flatteningVerdict: "examples/test-module/flattening.yaml" };
other.objects = parseDocs(toYaml({ apiVersion: "v1", kind: "ConfigMap", metadata: { name: "test-module", namespace: "staging" }, data: { mode: "test" } }));
other.inventoryRecord = buildTimoniInventory(other.objects, toYaml(other.objects[0]), "examples/test-module/source-lock.yaml");
other.lifecycleRecord.metadata.name = other.lock.metadata.name;
other.lifecycleRecord.spec.sourceRecord = other.inventoryRecord.source;
other.lifecycleRecord.spec.targetFacts = { declared: { namespace: "staging" }, requirements: [{ category: "namespace", name: "staging", requiredBefore: "apply" }] };
other.lifecycleRecord.spec.routes = [{ routeName: "apply-config", lifecyclePhase: "apply", automatic: false }];
other.flatteningRecord.spec.subject.source = other.lock.spec.source.module;
other.flatteningRecord.spec.subject.version = "2.0.0";
other.flatteningRecord.spec.retained.objects = other.lock.spec.output.objects;
other.flatteningRecord.spec.retained.routeIntent = other.lock.spec.lifecycle.routeIntent;
other.observations = [];
const result = buildTimoniReceipt(other);
assert.equal(result.metadata.name, "test-module-staging");
assert.equal(result.spec.command, "timoni -n staging build test-module <module> -v 2.0.0 -d <manifest-digest> -f staging.cue");
assert.deepEqual(result.spec.observations, []);
for (const field of ["kubernetesSchemaValidation", "lifecycleExecution", "kubernetesApply", "workloadHealth"]) assert.equal(result.status[field], "not-run");
assert.throws(() => buildTimoniInventory([...objects, objects[0]], objectsText, inventory.source), /duplicate/);
const deployment = objects.find((object) => object.kind === "Deployment");
assert.throws(() => buildTimoniInventory([deployment, { ...deployment, apiVersion: "apps/v1beta1" }], objectsText, inventory.source), /duplicate/);
assert.throws(() => buildTimoniInventory([{}], "{}", inventory.source), /requires/);
assert.throws(() => buildTimoniInventory(objects, "---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: other\n", inventory.source), /text differs/);
for (const [mutate, pattern] of [
  [(v) => { v.lock.spec.source.manifestDigest = "latest"; }, /immutable/],
  [(v) => { v.lifecycleRecord.spec.sourceRecord = "another-source.yaml"; }, /another source/],
  [(v) => { v.lock.metadata.name = "another-selection"; }, /lifecycle identity/],
  [(v) => { v.lock.spec.selection.namespace = "staging"; }, /declared namespace/],
  [(v) => { v.lifecycleRecord.spec.targetFacts.requirements.find((item) => item.category === "namespace").name = "staging"; }, /namespace requirement/],
  [(v) => { v.lifecycleRecord.spec.targetFacts.requirements = v.lifecycleRecord.spec.targetFacts.requirements.filter((item) => item.category !== "namespace"); }, /lacks a lifecycle requirement/],
  [(v) => { v.lifecycleRecord.spec.targetFacts.declared.storageClass = "other"; }, /declared storage class/],
  [(v) => { v.lifecycleRecord.spec.targetFacts.requirements.find((item) => item.category === "storage-class").name = "other"; }, /storage requirement/],
  [(v) => { v.flatteningRecord.spec.subject.version = "9.9.9"; }, /flattening subject/],
  [(v) => { v.flatteningRecord.spec.retained.objects = "other-objects.yaml"; }, /references differ/],
  [(v) => { v.inventoryRecord.objectCount++; }, /inventory differs/],
  [(v) => { v.lifecycleRecord.spec.routes = []; }, /requires retained lifecycle/],
  [(v) => { v.schemaText = ""; }, /schema/],
  [(v) => { delete v.lifecycleRecord.spec.targetFacts; }, /target facts/],
]) {
  const changed = structuredClone(input); mutate(changed);
  assert.throws(() => buildTimoniReceipt(changed), pattern);
}
console.log("Timoni adapter: retained bytes unchanged; alternate selection and inconsistent evidence checks pass");
