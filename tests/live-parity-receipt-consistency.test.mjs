import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { readYaml, repoRoot } from "../scripts/lib/proof-common.mjs";
import {
  LEGACY_MISSING_NAMESPACE_WITNESSES,
  isLegacyNamespaceWitness,
  verifyPassingRunBinding,
} from "../scripts/lib/live-parity-receipt-consistency.mjs";

const legs = ["regularHelm", "configHubKubectlApply", "configHubOciArgo"];
const base = {
  run: {
    rig: "parity-rig",
    kubeContext: "kind-parity-rig",
    legNamespaces: {
      regularHelm: "redis-helm",
      configHubKubectlApply: "redis-kubectl",
      configHubOciArgo: "redis-argo",
    },
  },
  legs: {
    regularHelm: { namespace: "redis-helm" },
    configHubKubectlApply: { namespace: "redis-kubectl" },
    configHubOciArgo: { namespace: "redis-argo" },
  },
};

export function testPassingRunBinding() {
  assert.doesNotThrow(() => verifyPassingRunBinding(base));
  for (const [label, mutate] of [
    ["missing rig", (spec) => { delete spec.run.rig; }],
    ["empty rig", (spec) => { spec.run.rig = ""; }],
    ["mismatched rig", (spec) => { spec.run.rig = "other-rig"; }],
    ["missing context", (spec) => { delete spec.run.kubeContext; }],
    ["empty context", (spec) => { spec.run.kubeContext = ""; }],
    ["mismatched context", (spec) => { spec.run.kubeContext = "kind-other"; }],
  ]) {
    const changed = structuredClone(base);
    mutate(changed);
    assert.throws(() => verifyPassingRunBinding(changed), /run|kube context/i, label);
  }
  for (const leg of legs) {
    for (const [label, mutate] of [
      ["missing run namespace", (spec) => { delete spec.run.legNamespaces[leg]; }],
      ["empty run namespace", (spec) => { spec.run.legNamespaces[leg] = ""; }],
      ["mismatched run namespace", (spec) => { spec.run.legNamespaces[leg] = "other"; }],
      ["missing leg namespace", (spec) => { delete spec.legs[leg].namespace; }],
      ["empty leg namespace", (spec) => { spec.legs[leg].namespace = ""; }],
      ["mismatched leg namespace", (spec) => { spec.legs[leg].namespace = "other"; }],
    ]) {
      const changed = structuredClone(base);
      mutate(changed);
      assert.throws(() => verifyPassingRunBinding(changed), /namespace/i, `${leg}: ${label}`);
    }
  }

  for (const [path, expected] of LEGACY_MISSING_NAMESPACE_WITNESSES) {
    const bytes = readFileSync(`${repoRoot}/${path}`);
    const actual = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actual, expected, `legacy witness changed: ${path}`);
    assert.equal(isLegacyNamespaceWitness(path, bytes), true);
    assert.equal(isLegacyNamespaceWitness(`${path}.copy`, bytes), false, "copied witness path refuses");
    assert.equal(isLegacyNamespaceWitness(path, Buffer.concat([bytes, Buffer.from("\n")])), false, "changed witness bytes refuse");
    const receipt = readYaml(`${repoRoot}/${path}`);
    assert.doesNotThrow(() => verifyPassingRunBinding(receipt.spec, path, { allowLegacyMissingNamespaces: true }));
    assert.throws(() => verifyPassingRunBinding(receipt.spec, path), /leg namespaces/i);
    const nearMiss = structuredClone(receipt.spec);
    nearMiss.run.legNamespaces = { regularHelm: "default" };
    assert.throws(() => verifyPassingRunBinding(nearMiss, path, { allowLegacyMissingNamespaces: true }), /namespace/i);
  }
}

if (pathToFileURL(process.argv[1] ?? "").href === import.meta.url) {
  testPassingRunBinding();
  console.log("live parity run-binding consistency tests passed");
}
