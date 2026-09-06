import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocs, readYaml, repoRoot } from "./lib/proof-common.mjs";
import { requiredSecretKeyFacts } from "./lib/required-secret-key-facts.mjs";

const env = (name, key, optional) => ({ name: "CREDENTIAL", valueFrom: { secretKeyRef: { name, key, ...(optional === undefined ? {} : { optional }) } } });
const pod = (entries) => ({ containers: [{ name: "app", env: entries }] });
const workload = (entries, namespace = "redis") => ({ apiVersion: "apps/v1", kind: "StatefulSet", metadata: { namespace }, spec: { template: { spec: pod(entries) } } });
const fact = (namespace, name, keys) => ({ namespace, name, keys, purpose: "Required by an explicit pod Secret key reference" });
const primary = workload([env("external", "password"), env("external", "password"), env("optional", "key", true), env("local", "password")]);
primary.spec.template.spec.initContainers = [{ name: "init", env: [env("external", "cookie")] }];
const local = { apiVersion: "v1", kind: "Secret", metadata: { name: "local", namespace: "redis" }, stringData: { password: "fixture" } };
assert.deepEqual(requiredSecretKeyFacts([primary, local], "default"), [fact("redis", "external", ["cookie", "password"])]);
assert.deepEqual(requiredSecretKeyFacts([workload([env("local", "password")], "other"), local], "default"), [fact("other", "local", ["password"])]);
const job = { apiVersion: "batch/v1", kind: "CronJob", metadata: {}, spec: { jobTemplate: { spec: { template: { spec: pod([env("scheduled", "key", false)]) } } } } };
assert.deepEqual(requiredSecretKeyFacts([job], "jobs"), [fact("jobs", "scheduled", ["key"])]);
assert.deepEqual(requiredSecretKeyFacts([{ apiVersion: "v1", kind: "Pod", metadata: {}, spec: pod([env("direct", "key")]) }], "pods"), [fact("pods", "direct", ["key"])]);
assert.deepEqual(requiredSecretKeyFacts([{ ...primary, apiVersion: "example.test/v1" }], "default"), []);
assert.deepEqual(requiredSecretKeyFacts([local, primary].reverse(), "default"), requiredSecretKeyFacts([local, primary], "default"));
for (const bad of [env("", "key"), env("secret", ""), env("secret", "key", "false"), { ...env("secret", "key"), value: "inline" }]) {
  assert.throws(() => requiredSecretKeyFacts([workload([bad])], "default"));
}
assert.throws(() => requiredSecretKeyFacts([workload([env("local", "missing")]), local], "default"), /missing a required key/);
console.log("required environment Secret tests passed: deduplication, namespace, init containers, CronJobs, local and optional keys, malformed references");

// Existing reviewed profiles provide independent expected facts for real renders.
for (const [chart, base] of [["redis/25.5.3", "reuse-existing-secret"]]) {
  const root = join(repoRoot, "recipes/bitnami", chart);
  const variant = readYaml(join(root, "variants", base, "variant.yaml")).spec;
  const docs = parseDocs(readFileSync(join(root, "revisions", base, "r001/rendered/release-objects.yaml"), "utf8"));
  const canonical = (facts) => facts.map(({ namespace, name, keys }) => ({ namespace, name, keys: [...keys].sort() })).sort((a, b) => `${a.namespace}/${a.name}`.localeCompare(`${b.namespace}/${b.name}`));
  assert.deepEqual(canonical(requiredSecretKeyFacts(docs, variant.namespace)), canonical(variant.targetFacts.requiredSecrets));
}
console.log("retained Redis render matches its reviewed required-Secret facts");

const mounted = workload([]);
mounted.spec.template.spec.volumes = [{ name: "explicit", projected: { sources: [{ secret: { name: "mounted", items: [{ key: "password", path: "password" }] } }] } }, { name: "whole", secret: { secretName: "unknown-keys" } }];
assert.deepEqual(requiredSecretKeyFacts([mounted], "default"), [fact("redis", "mounted", ["password"])]);
console.log("explicit projected keys recorded; whole-Secret keys are not invented");
