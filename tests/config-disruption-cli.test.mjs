import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const cli = join(process.cwd(), "scripts", "review-config-disruption.mjs");
const work = mkdtempSync(join(tmpdir(), "disruption-cli-test-"));

function run(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function files(before, after, extensions = [".yaml", ".yaml"]) {
  const paths = [join(work, `before${extensions[0]}`), join(work, `after${extensions[1]}`)];
  writeFileSync(paths[0], before);
  writeFileSync(paths[1], after);
  return paths;
}

test.after(() => rmSync(work, { recursive: true, force: true }));

test("accepts YAML multidoc and emits bound static review JSON", () => {
  const [before, after] = files(
    "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: web\n",
    "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\n---\napiVersion: v1\nkind: Service\nmetadata:\n  name: web\n  labels:\n    version: v2\n",
  );
  const result = run(["--before", before, "--after", after]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.kind, "ConfigDisruptionReview");
  assert.equal(output.before.objectCount, 2);
  assert.equal(output.after.objectCount, 2);
  assert.match(output.before.sha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(output.review.verdict, "review-required");
  assert.match(output.notice, /not an approval/);
  assert.equal(result.stderr, "");
});

test("accepts JSON arrays and reports actual immutable selector risk", () => {
  const deployment = (selector) => JSON.stringify([{ apiVersion: "apps/v1", kind: "Deployment", metadata: { name: "web", namespace: "default" }, spec: { selector: { matchLabels: { app: selector } }, template: { metadata: { labels: { app: selector } }, spec: { containers: [{ name: "web", image: "web:v1" }] } } } }]);
  const [before, after] = files(deployment("web"), deployment("other"), [".json", ".json"]);
  const result = run(["--before", before, "--after", after]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.review.objects[0].rules[0].category, "replace-immutable-field");
  assert.deepEqual(output.review.objects[0].changedPaths, ["/spec/selector/matchLabels/app", "/spec/template/metadata/labels/app"]);
});

test("format detection accepts a renamed JSON array and deliberate empty deletion", () => {
  const [before, after] = files("[{\"apiVersion\":\"v1\",\"kind\":\"ConfigMap\",\"metadata\":{\"name\":\"gone\"}}]", "[]", [".txt", ".manifest"]);
  const result = run(["--before", before, "--after", after]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.before.objectCount, 1);
  assert.equal(output.after.objectCount, 0);
  assert.equal(output.review.objects[0].changeType, "deleted");
  assert.deepEqual(output.review.objects[0].changedPaths, [""]);
});

test("rejects omissions, unknown or duplicate arguments with sanitized JSON errors", () => {
  for (const args of [[], ["--before", "x"], ["--before", "x", "--after", "y", "--unknown"], ["--before", "x", "--before", "y", "--after", "z"]]) {
    const result = run(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^\{"error":"[^\n]+"\}\n$/);
    assert.doesNotMatch(result.stderr, /x|y|z/);
  }
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--before FILE --after FILE/);
});

test("rejects duplicate keys, aliases, non-object documents, and secret errors without echoing content", () => {
  const cases = [
    ["apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\nmetadata:\n  name: secret-value\n", "duplicate"],
    ["defaults: &secret\n  token: secret-value\napiVersion: v1\nkind: ConfigMap\nmetadata: *secret\n", "alias"],
    ["- apiVersion: v1\n  kind: ConfigMap\n", "object"],
  ];
  for (const [content, label] of cases) {
    const [before, after] = files(content, "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n");
    const result = run(["--before", before, "--after", after]);
    assert.equal(result.status, 2, label);
    assert.doesNotMatch(result.stderr, /secret-value|metadata/);
  }
  const duplicateIdentity = "[{\"apiVersion\":\"v1\",\"kind\":\"Secret\",\"metadata\":{\"name\":\"secret-value\"}},{\"apiVersion\":\"v1\",\"kind\":\"Secret\",\"metadata\":{\"name\":\"secret-value\"}}]";
  const [duplicateBefore, duplicateAfter] = files(duplicateIdentity, "[]", [".json", ".json"]);
  const duplicateResult = run(["--before", duplicateBefore, "--after", duplicateAfter]);
  assert.equal(duplicateResult.status, 2);
  assert.doesNotMatch(duplicateResult.stderr, /secret-value/);
});

test("rejects excessive YAML depth and document count", () => {
  const deep = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: deep\nvalue: ${"\n  child:".repeat(70)} true\n`;
  const [deepBefore, deepAfter] = files(deep, "[]", [".yaml", ".json"]);
  assert.equal(run(["--before", deepBefore, "--after", deepAfter]).status, 2);
  const many = Array.from({ length: 1001 }, (_, index) => `---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: item-${index}\n`).join("");
  const [manyBefore, manyAfter] = files(many, "[]", [".yaml", ".json"]);
  assert.equal(run(["--before", manyBefore, "--after", manyAfter]).status, 2);
});

test("rejects oversized input", () => {
  const [before, after] = files("x".repeat(10 * 1024 * 1024 + 1), "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: x\n");
  const result = run(["--before", before, "--after", after]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /size limit/);
});

test("rejects JSON depth/count bounds, malformed YAML snippets and unsafe integers", () => {
  const base = { apiVersion: "v1", kind: "ConfigMap", metadata: { name: "settings" } };
  let deep = {};
  for (let i = 0; i < 70; i++) deep = { nested: deep };
  for (const text of [
    JSON.stringify(Array.from({ length: 1001 }, (_, i) => ({ ...base, metadata: { name: `item-${i}` } }))),
    JSON.stringify([{ ...base, spec: deep }]),
    '[{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"settings"},"n":9007199254740993}]',
    'apiVersion: v1\nkind: ConfigMap\nmetadata: [secret-marker: invalid\n',
  ]) {
    const [before, after] = files(text, JSON.stringify([base]));
    const result = run(["--before", before, "--after", after]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.equal(typeof JSON.parse(result.stderr).error, "string");
    assert.doesNotMatch(result.stderr, /secret-marker|Traceback|9007199254740993/);
  }
});

test("rejects a FIFO without blocking", () => {
  const fifo = join(work, "pipe");
  const made = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
  assert.equal(made.status, 0);
  const result = spawnSync(process.execPath, [cli, "--before", fifo, "--after", fifo], { encoding: "utf8", timeout: 2000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2);
  assert.equal(typeof JSON.parse(result.stderr).error, "string");
});

test("handles Helm comment documents while rejecting explicit null", () => {
  const object = "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: settings\ndata:\n  expression: '='\n";
  const [before, after] = files(`---\n# chart source\n---\n${object}`, object);
  const ok = run(["--before", before, "--after", after]);
  assert.equal(ok.status, 0);
  assert.equal(JSON.parse(ok.stdout).review.verdict, "no-config-change");
  writeFileSync(before, `null\n---\n${object}`);
  const invalid = run(["--before", before, "--after", after]);
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, "");
});

test("reviews the complete retained Prometheus default and no-crds bases", () => {
  const base = "recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/";
  const result = run(["--before", `${base}default/r001/rendered/release-objects.yaml`, "--after", `${base}no-crds/r001/rendered/release-objects.yaml`]);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.before.objectCount, 124);
  assert.equal(output.after.objectCount, 114);
  const omitted = output.review.objects.filter((o) => o.changeType === "deleted" && o.identity.kind === "CustomResourceDefinition");
  assert.equal(omitted.length, 10);
  assert.ok(omitted.every((o) => o.rules.some((r) => r.category === "crd-or-apiversion-change")));
});
