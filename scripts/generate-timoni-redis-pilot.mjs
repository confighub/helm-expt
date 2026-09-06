#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import { buildTimoniInventory, buildTimoniReceipt } from "./lib/timoni-materialization.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "examples", "timoni", "redis-8-10-1");
const sourceLockPath = join(root, "source-lock.yaml");
const selectedValuesPath = join(root, "selected-values.cue");
const lifecyclePath = join(root, "lifecycle-route-intent.yaml");
const flatteningPath = join(root, "flattening-safety-verdict.yaml");
const schemaPath = join(root, "config-schema.cue");
const objectsPath = join(root, "rendered", "release-objects.yaml");
const inventoryPath = join(root, "rendered", "object-inventory.json");
const receiptPath = join(root, "generation-receipt.yaml");
const readmePath = join(root, "README.md");

if (!["--generate", "--verify", "--refresh"].includes(mode)) {
  console.error("Usage: node scripts/generate-timoni-redis-pilot.mjs --generate|--verify|--refresh");
  process.exit(1);
}

const sourceLock = readYaml(sourceLockPath);
const lifecycle = readYaml(lifecyclePath);
const flattening = readYaml(flatteningPath);

if (mode === "--refresh") refreshSource(sourceLock);

check(existsSync(schemaPath), `${relativeRepo(schemaPath)} is missing; run with --refresh`);
check(existsSync(objectsPath), `${relativeRepo(objectsPath)} is missing; run with --refresh`);

const schemaText = readFileSync(schemaPath, "utf8");
const objectsText = readFileSync(objectsPath, "utf8");
const objects = parseDocs(objectsText);
const inventory = buildTimoniInventory(objects, objectsText, relativeRepo(sourceLockPath));
const receipt = buildTimoniReceipt({
  lock: sourceLock, lifecycleRecord: lifecycle, flatteningRecord: flattening,
  inventoryRecord: inventory, schemaText, schemaPath: relativeRepo(schemaPath), objects,
  observations: [
    "The default build contains no Kubernetes Secret and leaves the optional ping test disabled.",
    "The rendered labels report app.kubernetes.io/version=0.0.0-devel even though the immutable module source is version 8.10.1; consumers should use the recorded source version and digest as identity.",
  ],
});
const readme = buildReadme(sourceLock, inventory, receipt);

if (mode === "--verify") {
  verifyFile(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  verifyFile(receiptPath, `${toYaml(receipt)}\n`);
  verifyFile(readmePath, readme);
  await import("./test-timoni-materialization.mjs");
  console.log(`verified Timoni Redis pilot (${objects.length} exact object(s))`);
} else {
  write(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  writeYaml(receiptPath, receipt);
  write(readmePath, readme);
  console.log(`wrote Timoni Redis pilot -> ${relativeRepo(root)} (${objects.length} exact object(s))`);
}

function refreshSource(lock) {
  const timoni = process.env.TIMONI_BIN ?? "timoni";
  const source = lock.spec.source;
  const selection = lock.spec.selection;
  const common = [source.module, "-v", source.version];
  const schema = execFileSync(timoni, ["mod", "show", "config", ...common], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const rendered = execFileSync(
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
      selectedValuesPath,
      "--mask-secrets",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  write(schemaPath, schema.endsWith("\n") ? schema : `${schema}\n`);
  write(objectsPath, rendered.endsWith("\n") ? rendered : `${rendered}\n`);
}

function buildReadme(lock, inventoryRecord, receipt) {
  const source = lock.spec.source;
  const kinds = Object.entries(inventoryRecord.kindCounts)
    .map(([kind, count]) => `${kind} x${count}`)
    .join(", ");
  return `# Timoni Redis 8.10.1\n\nThis is the first Timoni source retained in the ConfigHub Workshop Catalog. It exists so a user can compare a typed Timoni module with the Helm Redis configurations already in the Catalog without pretending that the two sources have the same inputs or lifecycle.\n\n## What was selected\n\n- Module version: \`${source.version}\`\n- Immutable module digest: \`${source.manifestDigest}\`\n- Instance and namespace: \`redis\`\n- Values: the module defaults, recorded in [selected-values.cue](./selected-values.cue)\n- Typed options and defaults: [config-schema.cue](./config-schema.cue)\n\n## What it produced\n\nThe local, cluster-free build produced **${inventoryRecord.objectCount} Kubernetes objects**: ${kinds}. The Redis image is pinned by digest. The default includes an 8 Gi persistent volume claim using the \`standard\` StorageClass, one read-only replica, health probes, and hardened pod and container security settings.\n\nRead the [exact YAML](./rendered/release-objects.yaml), [object inventory](./rendered/object-inventory.json), and [generation receipt](./generation-receipt.yaml).\n\nThe same seven objects are also available in a [public configuration OCI](../../../runs/timoni-redis-catalog-proof/public-oci-receipt.yaml). An anonymous pull reproduced the exact object set. ConfigHub retains those objects in \`timoni-redis-8-10-1-base\` and links them into \`timoni-redis-8-10-1-dev\` without changing a Kubernetes field. The source and helper records remain on the base instead of being copied into every environment.\n\n## What plain YAML would miss\n\nThe source workflow applies the master objects first, waits for the master, and then applies the read-only replica. It can also run a Redis PING Job when tests are enabled. Those steps are not represented by the seven default Kubernetes objects alone. The [lifecycle route intent](./lifecycle-route-intent.yaml) keeps that work beside the objects, and the [flattening verdict](./flattening-safety-verdict.yaml) requires those routes if the objects are retained as literal configuration.\n\nThe selected destination must provide the \`redis\` namespace, Kubernetes 1.20 or newer, and a \`standard\` StorageClass. Route resolution and live execution have not been run for this entry.\n\n## Current status\n\nThis entry proves immutable source selection, local materialization, public OCI publication and anonymous pull, and exact ConfigHub retention as a base and linked development variant. It does not prove Kubernetes admission, lifecycle execution, workload health, upgrade, rollback, or GitOps delivery. The output labels say \`0.0.0-devel\`; use the recorded source version and digest above as the source identity.\n`;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale`);
}
