#!/usr/bin/env node
// Sync the helm-catalog ConfigHub org from committed catalog data.
//
// Wave 1: the top-20 charts, one base Space per runnable base variant row, labeled
// with Component/Variant/ChartVersion plus route labels derived from the
// committed lifecycle-route data. Immutable bases: an existing Space is
// skipped, never reconciled; a new chart version becomes a new Space.
//
// Modes:
//   --plan    print the plan (default; no cub calls, no org needed)
//   --sync    execute serially with the quota-probe protocol: stop at the
//             first server error and report exact counts
//   --verify  compare live org state against the plan (read-only)
//
// Safety: --sync and --verify refuse to run unless `cub auth status` reports
// the expected organization (--org, default helm-catalog).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--plan";
const orgArg = process.argv.includes("--org") ? process.argv[process.argv.indexOf("--org") + 1] : "helm-catalog";

const top100 = JSON.parse(readFileSync(join(repoRoot, "data", "top100-catalog-analysis", "raw.json"), "utf8"));
const matrixCsv = readFileSync(join(repoRoot, "data", "master-catalog-matrix", "matrix.csv"), "utf8");

function slugify(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function labelSafe(value) {
  const safe = slugify(value);
  return safe || "none";
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.split("\n").filter(Boolean);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    // The matrix has no embedded commas in the columns we read; a plain split
    // keeps this dependency-free. Guarded by --verify against the org anyway.
    const cells = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

// Route labels mirror the committed matrix fields verbatim; sparse data stays
// visibly sparse (none-recorded) rather than being dressed up. CrdRoute is
// structural: a chart that ships a no-crds base variant has separable CRDs.
function routeLabelsFor(row, chartVariants) {
  return {
    HookRoute: labelSafe(row.hook_disposition || "none-recorded"),
    RouteContract: labelSafe(row.lifecycle_route_contract || "none-recorded"),
    CrdRoute: chartVariants.includes("no-crds") ? "no-crds-base-variant-available" : "bundled-or-none",
    // Proof-lane labels mirror the committed matrix receipts verbatim; the org
    // states what recorded evidence says, never more.
    RenderParity: labelSafe(row.lane_render_parity || "none-recorded"),
    ConfigHubProof: labelSafe(row.lane_confighub_scan_ops || "none-recorded"),
    GitopsOciLive: labelSafe(row.lane_gitops_oci_live || "none-recorded"),
    RouteCount: labelSafe(row.lifecycle_route_count || "0"),
  };
}

function secretRouteFor(entry, variant) {
  const installerPath = join(repoRoot, entry.package_path, "installer.yaml");
  if (!existsSync(installerPath)) return "none";
  const installer = readYaml(installerPath);
  const bases = installer.spec?.bases ?? [];
  const base = bases.find((b) => b.name === variant) ?? bases.find((b) => b.default) ?? bases[0];
  const requires = Array.isArray(base?.externalRequires) ? base.externalRequires : [];
  if (!requires.length) return "generated-or-none";
  return "stage-external";
}

// The curated showroom set: ten charts chosen for variant diversity and quirk
// richness within the org's ~1,000-Link budget (depth over breadth; see
// data/helm-org/summary.md). Value "all" keeps every base variant; an array
// keeps only the named ones.
const CURATED_CHARTS = {
  "bitnami/redis": "all",
  "argo-cd/argo-cd": "all",
  "hashicorp/vault": "all",
  "ingress-nginx/ingress-nginx": "all",
  "prometheus-community/prometheus": "all",
  "grafana/grafana": "all",
  "bitnami/mysql": "all",
  "bitnami/rabbitmq": "all",
  "bitnami/nginx": "all",
  "prometheus-community/kube-prometheus-stack": ["no-crds"],
};

function buildPlan() {
  const top20 = top100.entries.filter((entry) => entry.proof_surface === "top20-catalog-supported");
  const matrixRows = parseCsv(matrixCsv);
  const plan = [];
  for (const entry of top20) {
    const allowed = CURATED_CHARTS[entry.chart];
    if (!allowed) continue;
    const rows = matrixRows.filter(
      (row) => row.chart === entry.chart && row.version === entry.version && row.row_kind === "base" && row.package_base_path,
    ).filter((row) => allowed === "all" || allowed.includes(row.variant));
    const chartVariants = rows.map((row) => row.variant);
    for (const row of rows) {
      const stem = slugify(`${entry.chart}-${entry.version}`);
      const variant = row.variant;
      const labels = {
        Variant: labelSafe(variant),
        ChartVersion: labelSafe(entry.version),
        SecretRoute: secretRouteFor(entry, variant),
        ...routeLabelsFor(row, chartVariants),
      };
      plan.push({
        chart: entry.chart,
        version: entry.version,
        variant,
        namespace: entry.namespace || "",
        packagePath: entry.package_path,
        space: `${stem}-${labelSafe(variant)}`,
        labels,
      });
    }
  }
  return plan.sort((a, b) => a.space.localeCompare(b.space));
}

function cub(args, options = {}) {
  return execFileSync("cub", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function assertOrg() {
  const context = cub(["context", "get"]);
  if (!context.includes(orgArg)) {
    console.error(`refusing to run: cub context does not show organization '${orgArg}' (name or ID).`);
    console.error("switch with: cub auth switch " + orgArg);
    process.exit(2);
  }
}

function spaceExists(slug) {
  try {
    cub(["space", "get", slug]);
    return true;
  } catch {
    return false;
  }
}

function unitCount(slug) {
  try {
    const out = cub(["unit", "list", "--space", slug]);
    return Math.max(0, out.trim().split("\n").length - 1);
  } catch {
    return -1;
  }
}

const plan = buildPlan();

if (mode === "--plan") {
  console.log(`wave 1 plan: ${plan.length} base Space(s) across ${new Set(plan.map((p) => p.chart)).size} chart(s), org '${orgArg}'`);
  for (const item of plan) {
    console.log(`  ${item.space}  ns=${item.namespace || "-"}  labels=${Object.entries(item.labels).map(([k, v]) => `${k}=${v}`).join(",")}`);
  }
  process.exit(0);
}

if (mode === "--relabel") {
  assertOrg();
  let stamped = 0;
  for (const item of plan) {
    if (!spaceExists(item.space)) continue;
    const labelArgs = Object.entries(item.labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
    cub(["space", "update", item.space, ...labelArgs]);
    stamped += 1;
  }
  console.log(`re-stamped labels on ${stamped} space(s)`);
  process.exit(0);
}

if (mode === "--verify") {
  assertOrg();
  const failures = [];
  let present = 0;
  for (const item of plan) {
    if (!spaceExists(item.space)) {
      failures.push(`missing space ${item.space}`);
      continue;
    }
    present += 1;
    const units = unitCount(item.space);
    if (units <= 0) failures.push(`space ${item.space} has no units`);
    const intent = join(repoRoot, "data", "helm-render-intents", "intents", `${item.space}.yaml`);
    if (existsSync(intent)) {
      try {
        const unitData = cub(["unit", "get", "recipe", "--space", item.space, "--data-only"]);
        const file = readFileSync(intent, "utf8");
        for (const field of ["baseVariant", "name"]) {
          const fromUnit = (unitData.match(new RegExp(`${field}: "([^"]+)"`)) || [])[1];
          const fromFile = (file.match(new RegExp(`${field}: "([^"]+)"`)) || [])[1];
          if (fromUnit !== fromFile) failures.push(`space ${item.space} recipe unit drifted from the intent file (${field}: ${fromUnit} vs ${fromFile})`);
        }
      } catch {
        failures.push(`space ${item.space} is missing its recipe unit`);
      }
    }
  }
  console.log(`verified helm org: ${present}/${plan.length} space(s) present`);
  if (failures.length) {
    for (const failure of failures.slice(0, 20)) console.error(`- ${failure}`);
    process.exit(1);
  }
  process.exit(0);
}

// The showroom exhibits: curated trees layered on the wave-1 bases, each
// expressing one catalog feature so the Hub UI tells the story unassisted.
// Idempotent: an exhibit whose marker space already exists is skipped;
// label-only exhibits re-apply labels (safe).
if (mode === "--exhibits") {
  assertOrg();
  const results = [];
  const label = (space, pairs) =>
    cub(["space", "update", space, ...Object.entries(pairs).flatMap(([k, v]) => ["--label", `${k}=${v}`])]);
  const firstUnit = (space, needle) => {
    const rows = cub(["unit", "list", "--space", space]).trim().split("\n").slice(1);
    const hit = rows.map((line) => line.split(/\s+/)[0]).find((slug) => slug.includes(needle));
    if (!hit) throw new Error(`no unit matching '${needle}' in ${space}`);
    return hit;
  };

  // E1 version-ladder: living redis tree; history shows 25.5.3 -> 27.0.0
  // arriving through reconcile + promotion while staging keeps its departure.
  if (spaceExists("bitnami-redis-base")) {
    results.push(["version-ladder", "exists", "bitnami-redis-base present; skipped"]);
  } else {
    const workDir = mkdtempSync(join(tmpdir(), "exhibit-redis-"));
    try {
      cub(["installer", "setup", "--pull", join(repoRoot, "packages/bitnami/redis/25.5.3"), "--base", "default", "--work-dir", workDir, "--non-interactive", "--namespace", "redis"]);
      cub(["installer", "upload", "--work-dir", workDir, "--space", "bitnami-redis-base"]);
      label("bitnami-redis-base", { Exhibit: "version-ladder", LivingBase: "yes" });
      cub(["variant", "create", "staging", "bitnami-redis-base", "--space-pattern", "template:bitnami-redis-staging", "--environment", "Staging", "--namespace", "redis-staging"]);
      label("bitnami-redis-staging", { Exhibit: "version-ladder" });
      cub(["variant", "create", "production", "bitnami-redis-base", "--space-pattern", "template:bitnami-redis-prod", "--environment", "Prod", "--namespace", "redis-prod", "--unit-delete-gate", "showroom-keep", "--unit-destroy-gate", "showroom-keep"]);
      label("bitnami-redis-prod", { Exhibit: "version-ladder" });
      cub(["run", "set-replicas", "--replicas", "2", "--space", "bitnami-redis-staging", "--unit", firstUnit("bitnami-redis-staging", "statefulset-redis-redis-replicas"), "--change-desc", "Staging departure: 2 replicas, a local decision that must survive upstream refreshes"]);
      cub(["installer", "setup", "--pull", join(repoRoot, "packages/bitnami/redis/27.0.0"), "--base", "default", "--work-dir", workDir, "--non-interactive", "--namespace", "redis"]);
      cub(["installer", "upload", "--work-dir", workDir, "--space", "bitnami-redis-base", "--yes"]);
      cub(["variant", "promote", "bitnami-redis-staging", "--change-desc", "Pull the redis 27.0.0 refresh into staging"]);
      cub(["variant", "promote", "bitnami-redis-prod", "--change-desc", "Pull the redis 27.0.0 refresh into production"]);
      results.push(["version-ladder", "created", "base+staging+prod; 25.5.3->27.0.0 through promotion; staging departure kept"]);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  // E2 secrets-story and E3 crd-split: label the wave-1 sibling roots.
  for (const [exhibit, spaces] of [
    ["secrets-story", ["bitnami-mysql-14-0-3-existing-secret", "bitnami-mysql-14-0-3-static-passwords"]],
    ["crd-split", ["argo-cd-argo-cd-9-5-15-default", "argo-cd-argo-cd-9-5-15-no-crds"]],
  ]) {
    const missing = spaces.filter((space) => !spaceExists(space));
    if (missing.length) {
      results.push([exhibit, "FAILED", `missing wave-1 space(s): ${missing.join(", ")}`]);
    } else {
      for (const space of spaces) label(space, { Exhibit: exhibit });
      results.push([exhibit, "labeled", spaces.join(" + ")]);
    }
  }
  // The no-crds root wears the committed receipt that backs its contract.
  if (spaceExists("argo-cd-argo-cd-9-5-15-no-crds")) {
    label("argo-cd-argo-cd-9-5-15-no-crds", { ProofReceipt: "crd-ordering-gap" });
  }

  // E4 hooks-argo: the receipted hook fixture; the Job unit's data carries the
  // Argo hook annotations, so the routing choice is inspectable config.
  if (spaceExists("hook-probe-base")) {
    results.push(["hooks-argo", "exists", "hook-probe-base present; skipped"]);
  } else {
    const stage = mkdtempSync(join(tmpdir(), "exhibit-hooks-"));
    try {
      for (const file of ["hook-job.yaml", "workload.yaml"]) {
        write(join(stage, file), readFileSync(join(repoRoot, "tests/fixtures/hook-replacement-probe", file), "utf8"));
      }
      cub(["variant", "upload", "--component", "hook-probe", "--variant", "base", "--space", "hook-probe-base", "--granularity", "per-resource", stage]);
      label("hook-probe-base", { Exhibit: "hooks-argo", HookRoute: "argo-hook-annotations", ProofReceipt: "hook-execution-proof", DeliveryReceipt: "oci-hook-delivery-proof" });
      results.push(["hooks-argo", "created", "hook-probe-base from tests/fixtures/hook-replacement-probe"]);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  }

  // E5 fleet: four environments off the nginx http-clusterip root; one base
  // change promoted to three of them, prod-eu left needing the upgrade so the
  // needs-upgrade query on the card returns a real row.
  const fleetBase = "bitnami-nginx-24-0-2-http-clusterip";
  if (!spaceExists(fleetBase)) {
    results.push(["fleet", "FAILED", `missing wave-1 space ${fleetBase}`]);
  } else if (spaceExists("bitnami-nginx-fleet-dev")) {
    results.push(["fleet", "exists", "bitnami-nginx-fleet-dev present; skipped"]);
  } else {
    label(fleetBase, { Exhibit: "fleet" });
    const envs = [
      ["dev", "Dev", [], ""],
      ["staging", "Staging", [], ""],
      ["prod-us", "Prod", ["--unit-delete-gate", "showroom-keep"], "us-east"],
      ["prod-eu", "Prod", ["--unit-delete-gate", "showroom-keep"], "eu-west"],
    ];
    for (const [env, envLabel, gates, region] of envs) {
      const args = ["variant", "create", env, fleetBase, "--space-pattern", `template:bitnami-nginx-fleet-${env}`, "--environment", envLabel, "--namespace", `nginx-${env}`, ...gates];
      if (region) args.push("--region", region);
      cub(args);
      label(`bitnami-nginx-fleet-${env}`, { Exhibit: "fleet" });
    }
    cub(["run", "set-replicas", "--replicas", "3", "--space", fleetBase, "--unit", firstUnit(fleetBase, "deployment"), "--change-desc", "Fleet release: 3 replicas everywhere"]);
    for (const env of ["dev", "staging", "prod-us"]) {
      cub(["variant", "promote", `bitnami-nginx-fleet-${env}`, "--change-desc", "Fleet release: pull 3 replicas"]);
    }
    results.push(["fleet", "created", "4 envs; dev/staging/prod-us promoted; prod-eu deliberately needs-upgrade"]);
  }

  // E6 promotion-interplay: what happens when environment departures meet base
  // releases. A mutable demo base derives from the immutable vault root; three
  // environments star off it with distinct departures; the base then ships two
  // releases (annotations) and every environment promotes. Field-level
  // departures (replicas) merge with the releases; dev's departure edits the
  // same annotations map the releases write to, so promote keeps dev's map and
  // reports success without the releases arriving — dev adopts them with
  // explicit reconcile commits instead. Both behaviours are the exhibit.
  const vaultRoot = "hashicorp-vault-0-32-0-default";
  if (!spaceExists(vaultRoot)) {
    results.push(["promotion-interplay", "FAILED", `missing wave-1 space ${vaultRoot}`]);
  } else if (spaceExists("hashicorp-vault-demo-base")) {
    results.push(["promotion-interplay", "exists", "hashicorp-vault-demo-base present; skipped"]);
  } else {
    cub(["variant", "create", "demo", vaultRoot, "--space-pattern", "template:hashicorp-vault-demo-base", "--namespace", "vault-demo"]);
    label("hashicorp-vault-demo-base", { Exhibit: "promotion-interplay" });
    const envs = [
      ["dev", "Dev", []],
      ["staging", "Staging", []],
      ["prod", "Prod", ["--unit-delete-gate", "showroom-keep", "--unit-destroy-gate", "showroom-keep"]],
    ];
    for (const [env, envLabel, gates] of envs) {
      cub(["variant", "create", env === "prod" ? "production" : env, "hashicorp-vault-demo-base", "--space-pattern", `template:hashicorp-vault-env-${env}`, "--environment", envLabel, "--namespace", `vault-${env}`, ...gates]);
      label(`hashicorp-vault-env-${env}`, { Exhibit: "promotion-interplay" });
    }
    const sts = "statefulset-vault-vault";
    cub(["run", "set-annotation", "--annotation-key", "cost.confighub.com/center", "--annotation-value", "dev-sandbox", "--space", "hashicorp-vault-env-dev", "--unit", sts, "--change-desc", "Dev departure: tag the sandbox for cost attribution"]);
    cub(["run", "set-replicas", "--replicas", "2", "--space", "hashicorp-vault-env-staging", "--unit", sts, "--change-desc", "Staging departure: two replicas to catch clustering issues early"]);
    cub(["run", "set-replicas", "--replicas", "3", "--space", "hashicorp-vault-env-prod", "--unit", sts, "--change-desc", "Prod departure: three replicas for quorum"]);
    cub(["run", "set-annotation", "--annotation-key", "vault.confighub.com/telemetry", "--annotation-value", "enabled", "--space", "hashicorp-vault-demo-base", "--unit", sts, "--change-desc", "Base release: enable telemetry everywhere"]);
    cub(["run", "set-annotation", "--annotation-key", "vault.confighub.com/release-track", "--annotation-value", "stable", "--space", "hashicorp-vault-demo-base", "--unit", sts, "--change-desc", "Base release 2: stamp release track"]);
    for (const [env] of envs) {
      cub(["variant", "promote", `hashicorp-vault-env-${env}`, "--change-desc", `Pull the telemetry release into ${env}`]);
    }
    // Dev's same-map departure means the releases did not arrive there; adopt
    // them explicitly so the revision history teaches the reconcile move.
    cub(["run", "set-annotation", "--annotation-key", "vault.confighub.com/telemetry", "--annotation-value", "enabled", "--space", "hashicorp-vault-env-dev", "--unit", sts, "--change-desc", "Reconcile: adopt the base telemetry release alongside the dev departure (same-map departures do not auto-merge)"]);
    cub(["run", "set-annotation", "--annotation-key", "vault.confighub.com/release-track", "--annotation-value", "stable", "--space", "hashicorp-vault-env-dev", "--unit", sts, "--change-desc", "Reconcile: adopt the base release-track stamp"]);
    results.push(["promotion-interplay", "created", "demo base + 3 envs; replicas departures merged with releases; dev same-map departure reconciled explicitly"]);
  }

  const csv = [["exhibit", "result", "detail"], ...results].map((row) => row.join(",")).join("\n");
  write(join(repoRoot, "data", "helm-org", "exhibits.csv"), `${csv}\n`);
  for (const [exhibit, result, detail] of results) console.log(`${result.padEnd(8)} ${exhibit}: ${detail}`);
  process.exit(results.some(([, r]) => r === "FAILED") ? 1 : 0);
}

if (mode !== "--sync") {
  console.log("usage: node scripts/sync-helm-org.mjs [--plan|--sync|--verify|--exhibits] [--org <name>]");
  process.exit(2);
}

assertOrg();
const receiptRows = [["space", "chart", "version", "variant", "result", "units", "detail"]];
let created = 0;
let skipped = 0;
let unitsTotal = 0;
let stopped = "";

for (const item of plan) {
  if (spaceExists(item.space)) {
    const units = unitCount(item.space);
    unitsTotal += Math.max(0, units);
    skipped += 1;
    receiptRows.push([item.space, item.chart, item.version, item.variant, "exists", String(units), "skipped (immutable base)"]);
    console.log(`= ${item.space} exists (${units} units), skipped`);
    continue;
  }
  const workDir = mkdtempSync(join(tmpdir(), "helm-org-"));
  try {
    const setupArgs = [
      "installer", "setup",
      "--pull", join(repoRoot, item.packagePath),
      "--base", item.variant,
      "--work-dir", workDir,
      "--non-interactive",
    ];
    if (item.namespace) setupArgs.push("--namespace", item.namespace);
    cub(setupArgs);
    cub(["installer", "upload", "--work-dir", workDir, "--space", item.space]);
    const labelArgs = Object.entries(item.labels).flatMap(([key, value]) => ["--label", `${key}=${value}`]);
    cub(["space", "update", item.space, ...labelArgs]);
    cub(["space", "update", item.space, "--trigger-filter", "platform/helm-catalog-checks", "--where-trigger", "-"]);
    cub(["space", "update", "--patch", item.space, "--refresh-triggers"]);
    const intentPath = join(repoRoot, "data", "helm-render-intents", "intents", `${item.space}.yaml`);
    if (existsSync(intentPath)) {
      cub(["unit", "create", "--space", item.space, "recipe", intentPath, "--change-desc", "The recipe: the F1 source object this space was rendered from."]);
    }
    const units = unitCount(item.space);
    unitsTotal += Math.max(0, units);
    created += 1;
    receiptRows.push([item.space, item.chart, item.version, item.variant, "created", String(units), ""]);
    console.log(`+ ${item.space} created (${units} units) [total units so far: ${unitsTotal}]`);
  } catch (error) {
    const detail = String(error.stderr || error.message || error).slice(0, 300).replace(/\s+/g, " ");
    receiptRows.push([item.space, item.chart, item.version, item.variant, "FAILED", "0", detail]);
    stopped = `${item.space}: ${detail}`;
    console.error(`! ${item.space} FAILED: ${detail}`);
    console.error(`quota-probe stop: ${created} created, ${skipped} existing, ~${unitsTotal} units at time of failure.`);
    break;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

const csv = receiptRows.map((row) => row.map((cell) => (cell.includes(",") ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\n");
write(join(repoRoot, "data", "helm-org", "wave1.csv"), `${csv}\n`);
write(
  join(repoRoot, "data", "helm-org", "summary.md"),
  `# helm-catalog Org, Wave 1\n\nGenerated by scripts/sync-helm-org.mjs --sync against org '${orgArg}'.\n\n- planned: ${plan.length} base Space(s)\n- created: ${created}\n- already present: ${skipped}\n- units in org (planned spaces): ${unitsTotal}\n- stopped early: ${stopped || "no"}\n\nOne Space per (chart, version, base variant) base variant, immutable; labels carry Component, Variant, ChartVersion, HookRoute, CrdRoute, SecretRoute, RouteDisposition from committed catalog data. Rows in [wave1.csv](./wave1.csv).\n`,
);
console.log(`done: ${created} created, ${skipped} existing, ~${unitsTotal} units. Receipts: data/helm-org/wave1.csv`);
process.exit(stopped ? 1 : 0);
