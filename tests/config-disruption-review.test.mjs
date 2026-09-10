import assert from "node:assert/strict";
import test from "node:test";

import { reviewDisruption } from "../scripts/lib/config-disruption-review.mjs";

const deployment = (overrides = {}) => ({
  apiVersion: "apps/v1",
  kind: "Deployment",
  metadata: { name: "web", namespace: "default" },
  spec: {
    selector: { matchLabels: { app: "web" } },
    strategy: { type: "RollingUpdate" },
    template: { metadata: { labels: { app: "web" } }, spec: { containers: [{ name: "web", image: "web:v1" }] } },
    ...overrides,
  },
});

const daemonSet = (overrides = {}) => ({
  apiVersion: "apps/v1",
  kind: "DaemonSet",
  metadata: { name: "agent", namespace: "system" },
  spec: {
    updateStrategy: { type: "OnDelete" },
    template: { metadata: { labels: { app: "agent" } }, spec: { containers: [{ name: "agent", image: "agent:v1" }] } },
    ...overrides,
  },
});

test("unchanged objects report no configuration change without claiming runtime safety", () => {
  const result = reviewDisruption([deployment()], [deployment()]);
  assert.equal(result.verdict, "no-config-change");
  assert.equal(result.risk, "static-risk");
  assert.equal(result.objects[0].changeType, "unchanged");
  assert.deepEqual(result.objects[0].rules, []);
});

test("metadata-only changes do not trigger pod-template replacement", () => {
  const after = deployment();
  after.metadata.labels = { review: "2" };
  const result = reviewDisruption([deployment()], [after]);
  assert.equal(result.objects[0].changeType, "changed");
  assert.deepEqual(result.objects[0].rules.map((rule) => rule.category), ["unclassified"]);
  assert.deepEqual(result.objects[0].changedPaths, ["/metadata/labels"]);
});

test("pod-template change with strategy change uses only the whitelisted resulting strategy", () => {
  const before = daemonSet({ updateStrategy: { type: "RollingUpdate" } });
  const after = daemonSet({ updateStrategy: { type: "OnDelete" }, template: { metadata: { labels: { app: "agent" } }, spec: { containers: [{ name: "agent", image: "agent:v2" }] } } });
  const result = reviewDisruption([before], [after]);
  const rule = result.objects[0].rules.find((item) => item.category === "recreate-workload");
  assert(rule);
  assert.match(rule.guidance, /OnDelete/);
  assert.doesNotMatch(rule.guidance, /RollingUpdate/);
});

test("unknown strategy is unassessed without echoing its value", () => {
  const before = deployment({ strategy: { type: "RollingUpdate" } });
  const after = deployment({ strategy: { type: "secret-strategy-value" }, template: { metadata: { labels: { app: "web" } }, spec: { containers: [{ name: "web", image: "web:v2" }] } } });
  const result = reviewDisruption([before], [after]);
  const serialized = JSON.stringify(result);
  assert.match(serialized, /unrecognized|unassessed/);
  assert.doesNotMatch(serialized, /secret-strategy-value/);
});

test("custom resources named like workloads do not trigger workload rules", () => {
  const before = { apiVersion: "example.com/v1", kind: "Deployment", metadata: { name: "fake", namespace: "default" }, spec: { template: { image: "v1" } } };
  const after = structuredClone(before);
  after.spec.template.image = "v2";
  const result = reviewDisruption([before], [after]);
  assert.equal(result.objects[0].rules[0].category, "unclassified");
});

test("OnDelete DaemonSet image update requires manual replacement and no node rebuild inference", () => {
  const result = reviewDisruption([daemonSet()], [daemonSet({ template: { metadata: { labels: { app: "agent" } }, spec: { containers: [{ name: "agent", image: "agent:v2" }] } } })]);
  const rule = result.objects[0].rules.find((item) => item.category === "recreate-workload");
  assert(rule);
  assert.match(rule.guidance, /OnDelete/);
  assert.match(rule.guidance, /no node drain or rebuild is inferred/);
  assert.ok(result.unassessed.some((scope) => scope.includes("node drain") && scope.includes("driver-specific")));
});

test("arbitrary driver-named DaemonSet does not infer drain or rebuild", () => {
  const before = daemonSet({ template: { metadata: { labels: { app: "driver" } }, spec: { containers: [{ name: "driver", image: "driver:v1" }] } } });
  before.metadata.name = "storage-driver";
  const after = structuredClone(before);
  after.spec.template.spec.containers[0].image = "driver:v2";
  const result = reviewDisruption([before], [after]);
  assert.doesNotMatch(result.objects[0].rules[0].guidance, /rebuild-driver|drain-node/i);
});

test("Deployment selector changes are immutable and are not replacement plans", () => {
  const result = reviewDisruption([deployment()], [deployment({ selector: { matchLabels: { app: "other" } } })]);
  const item = result.objects[0];
  assert.deepEqual(item.changedPaths, ["/spec/selector/matchLabels/app"]);
  assert.equal(item.rules[0].category, "replace-immutable-field");
  assert.match(item.rules[0].guidance, /does not recreate the workload automatically/);
});

test("Deployment selector and pod-template changes retain both hazards", () => {
  const after = deployment({
    selector: { matchLabels: { app: "other" } },
    template: { metadata: { labels: { app: "other" } }, spec: { containers: [{ name: "web", image: "web:v2" }] } },
  });
  const result = reviewDisruption([deployment()], [after]);
  assert.deepEqual(result.objects[0].rules.map((rule) => rule.category), ["replace-immutable-field", "recreate-workload"]);
});

test("Deployment Recreate is a known strategy while OnDelete is unassessed", () => {
  const before = deployment();
  const recreate = deployment({ strategy: { type: "Recreate" }, template: { metadata: { labels: { app: "web" } }, spec: { containers: [{ name: "web", image: "web:v2" }] } } });
  const recreateRule = reviewDisruption([before], [recreate]).objects[0].rules[0];
  assert.match(recreateRule.guidance, /Recreate/);
  const onDelete = deployment({ strategy: { type: "OnDelete" }, template: recreate.spec.template });
  const onDeleteRule = reviewDisruption([before], [onDelete]).objects[0].rules[0];
  assert.match(onDeleteRule.guidance, /unrecognized|unassessed/);
  assert.doesNotMatch(onDeleteRule.guidance, /OnDelete/);
});

test("apiVersion changes match one identity and carry API review risk", () => {
  const before = deployment();
  const after = structuredClone(before);
  after.apiVersion = "apps/v1beta1";
  const result = reviewDisruption([before], [after]);
  assert.equal(result.objects.length, 1);
  assert.deepEqual(result.objects[0].changedPaths, ["/apiVersion"]);
  assert.equal(result.objects[0].rules[0].category, "crd-or-apiversion-change");
});

test("CRD changes carry review risk", () => {
  const before = { apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", metadata: { name: "widgets.example.com" }, spec: { group: "example.com", names: { plural: "widgets", singular: "widget", kind: "Widget" }, scope: "Namespaced" } };
  const after = structuredClone(before);
  after.spec.names.shortNames = ["wdg"];
  const result = reviewDisruption([before], [after]);
  assert.equal(result.objects[0].rules[0].category, "crd-or-apiversion-change");
});

test("CRD additions and deletions retain the CRD hazard alongside unknown change", () => {
  const crd = { apiVersion: "apiextensions.k8s.io/v1", kind: "CustomResourceDefinition", metadata: { name: "widgets.example.com" }, spec: { group: "example.com", names: { plural: "widgets", singular: "widget", kind: "Widget" }, scope: "Namespaced" } };
  const added = reviewDisruption([], [crd]).objects[0].rules.map((rule) => rule.category);
  const deleted = reviewDisruption([crd], []).objects[0].rules.map((rule) => rule.category);
  assert.deepEqual(added, ["crd-or-apiversion-change", "unclassified"]);
  assert.deepEqual(deleted, ["crd-or-apiversion-change", "unclassified"]);
});

test("duplicates and malformed identities are rejected", () => {
  assert.throws(() => reviewDisruption([deployment(), deployment()], []), /duplicate identity/);
  assert.throws(() => reviewDisruption([{ apiVersion: "apps/v1", kind: "Deployment", metadata: {} }], []), /malformed identity/);
  assert.throws(() => reviewDisruption([{ apiVersion: 7, kind: "Deployment", metadata: { name: "web" } }], []), /malformed identity/);
  assert.throws(() => reviewDisruption([new Date()], []), /plain JSON object/);
});

test("secret values never appear in the result", () => {
  const before = { apiVersion: "v1", kind: "Secret", metadata: { name: "credentials", namespace: "default" }, type: "Opaque", data: { password: "before-secret" } };
  const after = structuredClone(before);
  after.data.password = "after-secret";
  const result = reviewDisruption([before], [after]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /before-secret|after-secret/);
  assert.match(serialized, /\/data\/password/);
});


test('top-level categories are unique and preserve their distinct primary sources', () => {
  const review = reviewDisruption([], []);
  const categories = review.rules.map((rule) => rule.category);
  assert.equal(new Set(categories).size, categories.length);
  const workloads = review.rules.find((rule) => rule.category === 'recreate-workload');
  assert.equal(workloads.sources.length, 3);
  assert.equal(new Set(workloads.sources).size, 3);
  assert.ok(workloads.sources.every((source) => source.startsWith('https://kubernetes.io/')));
});
