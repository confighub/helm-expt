#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  parseDocs,
  readYaml,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import {
  buildTimoniInventory,
  buildTimoniReceipt,
} from "./lib/timoni-materialization.mjs";
const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify"].includes(mode), "use --generate or --verify");
const root = join(repoRoot, "examples/timoni/flux-aio-2-9-4-0");
const lockPath = join(root, "source-lock.yaml");
const valuesPath = join(root, "selected-values.cue");
const schemaPath = join(root, "config-schema.cue");
const objectsPath = join(root, "rendered/release-objects.yaml");
const inventoryPath = join(root, "rendered/object-inventory.json");
const receiptPath = join(root, "generation-receipt.yaml");
const workflowPath = join(
  repoRoot,
  "examples/timoni/flux-aio-2-9-4-0/module/timoni.cue",
);
const moduleConfigPath = join(
  repoRoot,
  "examples/timoni/flux-aio-2-9-4-0/module/templates/config.cue",
);
const lock = readYaml(lockPath);
check(
  sha256File(workflowPath) === lock.spec.source.workflowSha256,
  "Timoni workflow digest is not bound to the source lock",
);
check(
  sha256File(moduleConfigPath) === lock.spec.source.moduleConfigSha256,
  "Timoni module config digest is not bound to the source lock",
);
const lifecycle = readYaml(join(root, "lifecycle-route-intent.yaml"));
const flattening = readYaml(join(root, "flattening-safety-verdict.yaml"));
if (mode === "--generate") {
  const timoni = process.env.TIMONI_BIN ?? "timoni";
  const source = lock.spec.source;
  const selection = lock.spec.selection;
  const schema = execFileSync(
    timoni,
    ["mod", "show", "config", source.module, "-v", source.version],
    { encoding: "utf8" },
  );
  const objects = execFileSync(
    timoni,
    [
      "-n",
      selection.namespace,
      "build",
      selection.instance,
      source.module,
      "-v",
      source.version,
      "-d",
      source.manifestDigest,
      "-f",
      valuesPath,
      "--mask-secrets",
    ],
    { encoding: "utf8" },
  );
  write(schemaPath, schema.endsWith("\n") ? schema : `${schema}\n`);
  write(objectsPath, objects.endsWith("\n") ? objects : `${objects}\n`);
}
check(
  existsSync(schemaPath) && existsSync(objectsPath),
  "Flux source outputs are missing",
);
const text = readFileSync(objectsPath, "utf8");
const objects = parseDocs(text);
const inventory = buildTimoniInventory(
  objects,
  text,
  "examples/timoni/flux-aio-2-9-4-0/source-lock.yaml",
);
const receipt = buildTimoniReceipt({
  lock,
  lifecycleRecord: lifecycle,
  flatteningRecord: flattening,
  inventoryRecord: inventory,
  schemaText: readFileSync(schemaPath, "utf8"),
  schemaPath: "examples/timoni/flux-aio-2-9-4-0/config-schema.cue",
  objects,
  observations: [
    "The default build renders 15 Flux CustomResourceDefinitions and no Secret or PersistentVolumeClaim.",
    "The module workflow declares an all-object apply set; CRD establishment and controller readiness remain destination lifecycle work.",
  ],
});
if (mode === "--generate") {
  writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2) + "\n");
  writeYaml(receiptPath, receipt);
  console.log(
    `generated Flux AIO Timoni evidence (${objects.length} objects, ${inventory.kindCounts.CustomResourceDefinition ?? 0} CRDs)`,
  );
} else {
  check(
    readFileSync(inventoryPath, "utf8") ===
      JSON.stringify(inventory, null, 2) + "\n",
    "Flux object inventory is stale",
  );
  check(
    readFileSync(receiptPath, "utf8") === toYaml(receipt) + "\n",
    "Flux generation receipt is stale",
  );
  console.log(
    `verified Flux AIO Timoni evidence (${objects.length} objects, ${inventory.kindCounts.CustomResourceDefinition ?? 0} CRDs)`,
  );
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
