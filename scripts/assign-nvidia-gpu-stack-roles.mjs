#!/usr/bin/env node

// Writes the discovery roles of the NVIDIA GPU stack charts into
// data/catalog-roles/assignments.json, so `cub config list --role gpu` finds them.
//
//   node scripts/assign-nvidia-gpu-stack-roles.mjs --plan      (the default)
//   node scripts/assign-nvidia-gpu-stack-roles.mjs --write
//   node scripts/assign-nvidia-gpu-stack-roles.mjs --self-test
//
// A role assignment names one base-variant record and that record's
// configuration digest. Base-variant records are generated from publication
// receipts, so before publication there is nothing to assign to, and the catalog
// listing generator refuses an assignment with no record. The classification is
// therefore kept in scripts/lib/nvidia-gpu-stack-coverage.mjs (role,
// componentType and a one-sentence rationale per chart).
//
// --plan prints, for every base on the branch, the record it will be assigned
// to, the digest of its committed render, and whether the record exists yet.
// --write adds or refreshes the assignment of every base whose record exists,
// names the bases it left unassigned because they have no record, and refuses
// when no record exists at all. Run `npm run catalog:listings` afterwards.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readYaml, repoRoot } from "./lib/proof-common.mjs";
import { validateAssignments } from "./lib/catalog-roles.mjs";
import { NVIDIA_GPU_STACK_ADDITIONS, NVIDIA_GPU_STACK_ROLES } from "./lib/nvidia-gpu-stack-coverage.mjs";

const ASSIGNMENTS = "data/catalog-roles/assignments.json";
const RECORDS = "data/base-variant-records/records";

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// The name scripts/generate-helm-render-intents.mjs gives a base, which the
// base-variant record and the listing reuse.
export function recordId(canonicalIdentity, version, base) {
  return `${canonicalIdentity}-${version}-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// One row per base: where its assignment goes and the digest it must carry.
export function plannedAssignments(additions = NVIDIA_GPU_STACK_ADDITIONS, roles = NVIDIA_GPU_STACK_ROLES) {
  const rows = [];
  for (const item of additions) {
    const role = roles[item.chart];
    check(Boolean(role), `${item.canonicalIdentity} has no role in NVIDIA_GPU_STACK_ROLES`);
    const plan = readYaml(join(repoRoot, item.recipePath, "helm-plan.yaml"));
    for (const base of plan.spec.readiness.variants) {
      const revision = readYaml(join(repoRoot, item.recipePath, "revisions", base, "r001", "variant-revision.yaml"));
      const id = recordId(item.canonicalIdentity, item.version, base);
      rows.push({
        id,
        configurationDigest: revision.spec.digestInputs.renderedObjectSetSHA256,
        roles: [{ role: role.role, componentType: role.componentType }],
        rationale: role.rationale,
        recordPath: `${RECORDS}/${id}.yaml`,
      });
    }
  }
  check(new Set(rows.map((row) => row.id)).size === rows.length, "two NVIDIA GPU stack bases map to one record name");
  return rows;
}

// Adds or refreshes the planned rows and leaves every other assignment as it is.
// New rows go after the last existing row of the same source, else at the end.
export function mergeAssignments(document, planned) {
  const assignments = [...document.assignments];
  for (const row of planned) {
    const entry = { id: row.id, configurationDigest: row.configurationDigest, roles: row.roles, rationale: row.rationale };
    const index = assignments.findIndex((item) => item.id === row.id);
    if (index !== -1) {
      assignments[index] = entry;
      continue;
    }
    let after = -1;
    assignments.forEach((item, position) => {
      if (item.id.startsWith("nvidia-")) after = position;
    });
    assignments.splice(after === -1 ? assignments.length : after + 1, 0, entry);
  }
  return { ...document, assignments };
}

function selfTest() {
  check(recordId("nvidia/gpu-operator", "v26.3.3", "driver-580.105.08") === "nvidia-gpu-operator-v26-3-3-driver-580-105-08", "self-test failed: record name");
  check(recordId("nvidia/nvidia-device-plugin", "0.19.3", "default") === "nvidia-nvidia-device-plugin-0-19-3-default", "self-test failed: an existing record name is reproduced");
  const planned = plannedAssignments();
  const charts = new Set(NVIDIA_GPU_STACK_ADDITIONS.map((item) => item.chart));
  check([...charts].every((chart) => NVIDIA_GPU_STACK_ROLES[chart]), "self-test failed: a chart has no role");
  check(planned.every((row) => /^[0-9a-f]{64}$/.test(row.configurationDigest)), "self-test failed: a base has no render digest");
  // The planned rows must pass the same validation the listing generator applies.
  const records = planned.map((row) => ({ metadata: { name: row.id }, spec: { configuration: { digest: row.configurationDigest } } }));
  const existing = { apiVersion: "catalog.confighub.com/v1alpha1", kind: "CatalogRoleAssignments", assignments: [] };
  const merged = mergeAssignments(existing, planned);
  check(validateAssignments(merged, records).size === planned.length, "self-test failed: planned rows are not valid assignments");
  check(JSON.stringify(mergeAssignments(merged, planned)) === JSON.stringify(merged), "self-test failed: writing twice changes the file");
  const stale = { ...merged, assignments: merged.assignments.map((item, index) => (index === 0 ? { ...item, configurationDigest: "0".repeat(64) } : item)) };
  check(mergeAssignments(stale, planned).assignments[0].configurationDigest === planned[0].configurationDigest, "self-test failed: a stale digest is not refreshed");
  const mixed = { ...existing, assignments: [{ id: "aaa-first" }, { id: "nvidia-nvidia-device-plugin-0-19-3-default" }, { id: "zzz-last" }] };
  const placed = mergeAssignments(mixed, planned.slice(0, 1)).assignments.map((item) => item.id);
  check(placed.indexOf(planned[0].id) === 2 && placed.at(-1) === "zzz-last", "self-test failed: a new row is not placed after the existing NVIDIA rows");
  try {
    plannedAssignments(NVIDIA_GPU_STACK_ADDITIONS, {});
    throw new Error("self-test failed: a chart with no role was accepted");
  } catch (error) {
    check(/has no role/.test(error.message), error.message);
  }
  console.log(`assign-nvidia-gpu-stack-roles self-test passed for ${planned.length} base(s) of ${charts.size} chart(s)`);
}

const isMain = process.argv[1] && process.argv[1].endsWith("assign-nvidia-gpu-stack-roles.mjs");
if (isMain) {
  const mode = process.argv[2] ?? "--plan";
  try {
    if (mode === "--self-test") {
      selfTest();
    } else if (mode === "--plan" || mode === "--write") {
      const planned = plannedAssignments();
      const path = join(repoRoot, ASSIGNMENTS);
      const document = JSON.parse(readFileSync(path, "utf8"));
      const current = new Map(document.assignments.map((item) => [item.id, item]));
      const missing = planned.filter((row) => !existsSync(join(repoRoot, row.recordPath)));
      if (mode === "--plan") {
        for (const row of planned) {
          const assigned = current.get(row.id);
          const state = !assigned ? "not assigned" : assigned.configurationDigest === row.configurationDigest ? "assigned" : "assigned to an older digest";
          console.log(
            `${row.id}\t${row.roles[0].role}/${row.roles[0].componentType}\tsha256:${row.configurationDigest}\trecord ${missing.includes(row) ? "missing" : "present"}\t${state}`,
          );
        }
        console.log(
          `${planned.length} base(s); ${missing.length} record(s) missing. ${missing.length ? "Records appear after publication and the catalog regeneration; then run --write." : "Run --write, then npm run catalog:listings."}`,
        );
      } else {
        const ready = planned.filter((row) => !missing.includes(row));
        check(
          ready.length > 0,
          `none of the ${planned.length} base-variant records exists yet, for example ${missing[0]?.recordPath}. Publish the packages and regenerate the records first; nothing was written.`,
        );
        for (const row of ready) {
          const record = readYaml(join(repoRoot, row.recordPath));
          check(
            record.spec?.configuration?.digest === row.configurationDigest,
            `${row.id}: the record's configuration digest differs from the committed render; regenerate the record`,
          );
        }
        writeFileSync(path, `${JSON.stringify(mergeAssignments(document, ready), null, 2)}\n`);
        console.log(`wrote ${ready.length} role assignment(s) to ${ASSIGNMENTS}; run npm run catalog:listings next`);
        if (missing.length) {
          console.log(`${missing.length} base(s) have no record and stay unclassified: ${missing.map((row) => row.id).join(", ")}`);
        }
      }
    } else {
      console.error(`Usage:
  node scripts/assign-nvidia-gpu-stack-roles.mjs --plan
  node scripts/assign-nvidia-gpu-stack-roles.mjs --write
  node scripts/assign-nvidia-gpu-stack-roles.mjs --self-test`);
      process.exit(2);
    }
  } catch (error) {
    console.error(`assign-nvidia-gpu-stack-roles: ${error.message}`);
    process.exit(1);
  }
}
