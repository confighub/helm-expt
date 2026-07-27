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
//   --policy-sync     reconcile Trigger definitions, filters, and Space assignments
//   --policy-record   verify the live policy topology and write its receipt
//   --policy-verify   compare the live topology with the profile and receipt
//   --policy-receipt-verify  verify the committed receipt without a live login
//
// Safety: --sync and --verify refuse to run unless `cub auth status` reports
// the expected organization (--org, default helm-catalog).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readYaml, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--plan";
const orgArg = process.argv.includes("--org") ? process.argv[process.argv.indexOf("--org") + 1] : "helm-catalog";
const cubContext = process.env.CUB_CONTEXT ?? "";

const top100 = JSON.parse(readFileSync(join(repoRoot, "data", "top100-catalog-analysis", "raw.json"), "utf8"));
const matrixCsv = readFileSync(join(repoRoot, "data", "master-catalog-matrix", "matrix.csv"), "utf8");
const applyPolicy = readYaml(join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml"));
const baselineApplyFilter = applyPolicy.spec.baseline.filter;
const approvalRequiredApplyFilter = applyPolicy.spec.approvalRequired.filter;
const supportedSourceTypes = applyPolicy.spec.sourceTypes ?? [];
const policyReceiptPath = join(repoRoot, "data", "apply-policy-profiles", "live-helm-catalog.yaml");

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

// routes.csv quotes comma-laden fields (hook_phases), so it needs a real
// quote-aware split — the naive parseCsv above would shift its columns.
function splitCsvLine(line) {
  const cells = [];
  let cell = "", inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { cells.push(cell); cell = ""; }
    else cell += ch;
  }
  cells.push(cell);
  return cells;
}

function parseCsvQuoted(text) {
  const [headerLine, ...lines] = text.split("\n").filter(Boolean);
  const headers = splitCsvLine(headerLine);
  return lines.map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function renderRecordYaml() {
  return `apiVersion: "helm-expt.confighub.com/v1alpha1"
kind: "RenderRecord"
metadata:
  name: "hashicorp-vault-demo-base"
  labels:
    sketch: "unbuilt-entity"
spec:
  recipeUnit: "recipe"
  chart:
    name: "hashicorp/vault"
    version: "0.32.0"
  base: "default"
  renderedBy: "cub installer (client-side render; the server never saw the act)"
  renderedAt: "2026-07-03T08:07:00Z"
  outputUnits: 13
  renderLinks: "one exemplar rendered-from Link on statefulset-vault-vault (org link quota is nearly spent; the full set is this record)"
  status: "sketch"
  note: >-
    This unit sketches an entity the product does not have. Rendering happens
    client-side today; the server records no render operation, no inputs, no
    provenance. When render records become first-class product objects, this
    convention collapses into one.
`;
}

function lifecycleRouteYaml(r) {
  const list = (value) => value.split(";").map((v) => v.trim()).filter(Boolean).map((v) => `    - "${v}"`).join("\n");
  return `apiVersion: "helm-expt.confighub.com/v1alpha1"
kind: "LifecycleRoute"
metadata:
  name: "${r.route_name}"
  labels:
    sketch: "unbuilt-entity"
    quirkClass: "${r.quirk_class}"
spec:
  chart: "${r.chart}"
  version: "${r.version}"
  quirkClass: "${r.quirk_class}"
  hookPhases: "${r.hook_phases}"
  routeName: "${r.route_name}"
  executionMode: "${r.execution_mode}"
  automatic: false
  alternatives:
${list(r.alternatives)}
  disposition: "${r.disposition}"
  evidence:
${list(r.evidence_or_next_action)}
  note: >-
    Sketch of an entity the product does not have: a lifecycle route as an
    addressable object. Today this row lives in repo CSV, space labels, and
    unit annotations; automatic stays false until the product executes the
    route and committed evidence proves it.
`;
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
        ApplyPolicyProfile: applyPolicy.metadata.name,
        SourceType: "cub-installer",
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
  const contextArgs = cubContext ? ["--context", cubContext] : [];
  return execFileSync("cub", [...contextArgs, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function assertOrg() {
  const context = cub(["context", "get"]);
  if (!context.includes(orgArg)) {
    console.error(`refusing to run: cub context does not show organization '${orgArg}' (name or ID).`);
    console.error("switch with: cub auth switch " + orgArg);
    process.exit(2);
  }
}

function cubJson(args) {
  return JSON.parse(cub([...args, "-o", "json"]));
}

function splitEntityRef(ref) {
  const slash = ref.indexOf("/");
  if (slash <= 0 || slash === ref.length - 1) {
    throw new Error(`expected a space/entity reference, got '${ref}'`);
  }
  return [ref.slice(0, slash), ref.slice(slash + 1)];
}

function expectedPolicyTriggers(policySet) {
  return policySet.checks
    .map((policyCheck) => {
      const definition = policyTriggerDefinition(policyCheck.trigger);
      return {
        ref: policyCheck.trigger,
        functionName: definition.functionName,
        arguments: definition.arguments,
        description: definition.description,
        effect: policyCheck.effect,
        validating: true,
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

function receiptPolicyTriggers(policySet) {
  return policySet.triggers
    .map((trigger) => ({
      ref: trigger.ref,
      functionName: trigger.functionName,
      arguments: trigger.arguments ?? [],
      description: trigger.description,
      effect: trigger.effect,
      validating: trigger.validating,
    }))
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

function policyTriggerDefinition(ref) {
  const definition = (applyPolicy.spec.triggerDefinitions ?? [])
    .find((item) => item.ref === ref);
  if (!definition) throw new Error(`missing Trigger definition for ${ref}`);
  return definition;
}

function normalizedLiveArguments(args) {
  return (args ?? [])
    .map((item) => ({
      name: item.ParameterName,
      value: item.Value,
    }))
    .sort((a, b) => `${a.name}|${a.value}`.localeCompare(`${b.name}|${b.value}`));
}

const liveTriggerCache = new Map();

function readLiveTrigger(ref) {
  if (liveTriggerCache.has(ref)) return liveTriggerCache.get(ref);
  const [space, slug] = splitEntityRef(ref);
  const trigger = cubJson(["trigger", "get", "--space", space, slug]).Trigger;
  liveTriggerCache.set(ref, trigger);
  return trigger;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function readPolicyFilter(policySet, name, findings) {
  const [space, slug] = splitEntityRef(policySet.filter);
  const filterResult = cubJson(["filter", "get", "--space", space, slug]);
  const filter = filterResult.Filter;
  const rows = cubJson(["trigger", "list", "--space", "*", "--filter", policySet.filter]);
  const triggers = rows
    .map((row) => {
      const ref = `${row.Space.Slug}/${row.Trigger.Slug}`;
      const trigger = readLiveTrigger(ref);
      return {
        ref,
        functionName: trigger.FunctionName,
        arguments: normalizedLiveArguments(trigger.Arguments),
        description: trigger.Description ?? "",
        effect: trigger.Warn === true ? "warn" : "block",
        validating: trigger.Validating === true,
      };
    })
    .sort((a, b) => a.ref.localeCompare(b.ref));

  if (filter.From !== "Trigger") findings.push(`${policySet.filter} reads ${filter.From}, not Trigger`);
  if (filter.Where !== policySet.filterWhere) {
    findings.push(`${policySet.filter} selector drifted: '${filter.Where}'`);
  }
  const expected = expectedPolicyTriggers(policySet);
  if (!sameJson(triggers, expected)) {
    findings.push(`${policySet.filter} selected Trigger definitions that differ from the committed policy`);
  }
  for (const trigger of triggers) {
    if (!trigger.validating) findings.push(`${trigger.ref} is not a validating Trigger`);
  }

  return {
    name,
    ref: policySet.filter,
    id: filter.FilterID,
    where: filter.Where,
    triggers,
  };
}

function matchesLabels(space, labels) {
  return Object.entries(labels ?? {}).every(([key, value]) => space.Labels?.[key] === value);
}

function requiresApproval(space) {
  return space.Labels?.Environment === "Prod"
    || space.Labels?.ResourceClass === "system-configuration";
}

function sourceTypeForSpace(space) {
  const explicit = space.Labels?.SourceType;
  if (supportedSourceTypes.includes(explicit)) return explicit;
  if (plan.some((item) => item.space === space.Slug)) return "cub-installer";
  if (
    /^(bitnami-redis-(base|staging|prod)|bitnami-nginx-fleet-|hashicorp-vault-(demo-base|env-))/.test(
      space.Slug,
    )
  ) {
    return "cub-installer";
  }
  if (
    space.Slug === "hook-probe-base"
    || space.Slug === "route-sketch-kube-prometheus-stack"
  ) {
    return "rendered-config";
  }
  if (space.Slug.startsWith("aicr-")) return "aicr";
  if (space.Slug.startsWith("kubara-")) return "kubara";
  if (space.Slug.startsWith("sveltos-")) return "sveltos";
  return "";
}

function matchesSpaceSelector(space, selector) {
  if (selector?.labels) return matchesLabels(space, selector.labels);
  if (selector?.anyOf) {
    return selector.anyOf.some((candidate) => matchesLabels(space, candidate.labels));
  }
  return false;
}

function collectLivePolicyState() {
  const findings = [];
  const baseline = readPolicyFilter(applyPolicy.spec.baseline, "baseline", findings);
  const approvalRequired = readPolicyFilter(
    applyPolicy.spec.approvalRequired,
    "approvalRequired",
    findings,
  );
  const rows = cubJson(["space", "list", "--select", "Labels,TriggerFilterID"]);
  const spaces = rows.map((row) => row.Space);
  const baselineSpaces = spaces.filter((space) => space.TriggerFilterID === baseline.id);
  const approvalRequiredSpaces = spaces.filter(
    (space) => space.TriggerFilterID === approvalRequired.id,
  );
  const profileSpaces = spaces.filter((space) => space.Labels?.ApplyPolicyProfile === applyPolicy.metadata.name);

  if (!baselineSpaces.length) findings.push("the baseline filter is not assigned to any Space");
  if (!approvalRequiredSpaces.length) {
    findings.push("the approval-required filter is not assigned to any Space");
  }

  for (const space of baselineSpaces) {
    if (!matchesLabels(space, applyPolicy.spec.baseline.spaceSelector.labels)) {
      findings.push(`${space.Slug} uses the baseline filter without the profile label`);
    }
    if (requiresApproval(space)) {
      findings.push(`${space.Slug} requires approval but uses the baseline filter`);
    }
  }
  for (const space of approvalRequiredSpaces) {
    if (!matchesSpaceSelector(space, applyPolicy.spec.approvalRequired.spaceSelector)) {
      findings.push(
        `${space.Slug} uses the approval-required filter without production or system-configuration labels`,
      );
    }
  }
  for (const space of profileSpaces) {
    const expectedID = requiresApproval(space) ? approvalRequired.id : baseline.id;
    if (space.TriggerFilterID !== expectedID) {
      findings.push(`${space.Slug} claims ${applyPolicy.metadata.name} but uses the wrong filter`);
    }
    const expectedSourceType = sourceTypeForSpace(space);
    if (!expectedSourceType) {
      findings.push(`${space.Slug} has no supported SourceType`);
    } else if (space.Labels?.SourceType !== expectedSourceType) {
      findings.push(
        `${space.Slug} should record SourceType=${expectedSourceType}`,
      );
    }
  }

  const baselineSlugs = baselineSpaces.map((space) => space.Slug).sort();
  const approvalRequiredSlugs = approvalRequiredSpaces.map((space) => space.Slug).sort();
  const selected = new Set([...baselineSlugs, ...approvalRequiredSlugs]);
  const excludedSlugs = spaces.map((space) => space.Slug).filter((slug) => !selected.has(slug)).sort();
  const productionSlugs = approvalRequiredSpaces
    .filter((space) => space.Labels?.Environment === "Prod")
    .map((space) => space.Slug)
    .sort();
  const systemConfigurationSlugs = approvalRequiredSpaces
    .filter((space) => space.Labels?.ResourceClass === "system-configuration")
    .map((space) => space.Slug)
    .sort();
  const sourceTypes = Object.fromEntries(
    supportedSourceTypes.map((sourceType) => [
      sourceType,
      profileSpaces
        .filter((space) => space.Labels?.SourceType === sourceType)
        .map((space) => space.Slug)
        .sort(),
    ]),
  );
  for (const [sourceType, sourceSpaces] of Object.entries(sourceTypes)) {
    if (!sourceSpaces.length) {
      findings.push(`the live policy has no ${sourceType} Space`);
    }
  }
  const verifiedAt = new Date().toISOString();
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "ApplyPolicyLiveReceipt",
    metadata: {
      name: `${orgArg}-${applyPolicy.metadata.name}`,
    },
    spec: {
      organization: orgArg,
      profile: applyPolicy.metadata.name,
      verifiedAt,
      filters: {
        baseline: {
          ref: baseline.ref,
          id: baseline.id,
          where: baseline.where,
          triggers: baseline.triggers,
        },
        approvalRequired: {
          ref: approvalRequired.ref,
          id: approvalRequired.id,
          where: approvalRequired.where,
          triggers: approvalRequired.triggers,
        },
      },
      spaces: {
        baseline: baselineSlugs,
        approvalRequired: approvalRequiredSlugs,
        approvalReasons: {
          production: productionSlugs,
          systemConfiguration: systemConfigurationSlugs,
        },
        sourceTypes,
        excluded: excludedSlugs,
      },
    },
    status: {
      result: findings.length ? "fail" : "pass",
      findings,
      limits: [
        "This receipt checks live filter definitions, selected Triggers, and Space assignments.",
        "It does not claim that a deliberately invalid configuration was applied.",
      ],
    },
  };

  return { findings, receipt };
}

function receiptComparable(receipt) {
  return {
    apiVersion: receipt.apiVersion,
    kind: receipt.kind,
    metadata: receipt.metadata,
    organization: receipt.spec.organization,
    profile: receipt.spec.profile,
    filters: receipt.spec.filters,
    spaces: receipt.spec.spaces,
    result: receipt.status.result,
    findings: receipt.status.findings,
  };
}

function policyReceiptDrift(live, committed) {
  const current = receiptComparable(live);
  const expected = receiptComparable(committed);
  return Object.keys(current).filter((key) => !sameJson(current[key], expected[key]));
}

function verifyPolicyReceipt(receipt) {
  const failures = [];
  if (receipt?.kind !== "ApplyPolicyLiveReceipt") failures.push("receipt kind is not ApplyPolicyLiveReceipt");
  if (receipt?.spec?.organization !== orgArg) failures.push(`receipt organization is not ${orgArg}`);
  if (receipt?.spec?.profile !== applyPolicy.metadata.name) failures.push(`receipt profile is not ${applyPolicy.metadata.name}`);
  if (receipt?.status?.result !== "pass") failures.push("receipt result is not pass");
  if ((receipt?.status?.findings ?? []).length) failures.push("receipt contains findings");

  for (const [name, policySet] of Object.entries({
    baseline: applyPolicy.spec.baseline,
    approvalRequired: applyPolicy.spec.approvalRequired,
  })) {
    const recorded = receipt?.spec?.filters?.[name];
    if (!recorded) {
      failures.push(`receipt is missing ${name} filter`);
      continue;
    }
    if (recorded.ref !== policySet.filter) failures.push(`${name} filter reference drifted`);
    if (recorded.where !== policySet.filterWhere) failures.push(`${name} filter selector drifted`);
    if (!sameJson(receiptPolicyTriggers(recorded), expectedPolicyTriggers(policySet))) {
      failures.push(`${name} Trigger set drifted`);
    }
    for (const trigger of recorded.triggers ?? []) {
      if (trigger.validating !== true) failures.push(`${trigger.ref} was not recorded as validating`);
    }
  }

  const baselineSpaces = receipt?.spec?.spaces?.baseline ?? [];
  const approvalRequiredSpaces = receipt?.spec?.spaces?.approvalRequired ?? [];
  if (!baselineSpaces.length) failures.push("receipt has no baseline Spaces");
  if (!approvalRequiredSpaces.length) failures.push("receipt has no approval-required Spaces");
  const overlap = baselineSpaces.filter((space) => approvalRequiredSpaces.includes(space));
  if (overlap.length) failures.push(`Spaces appear in both policy sets: ${overlap.join(", ")}`);
  const approvalReasons = receipt?.spec?.spaces?.approvalReasons ?? {};
  if (!(approvalReasons.production ?? []).length) {
    failures.push("receipt has no production approval assignments");
  }
  if (!(approvalReasons.systemConfiguration ?? []).length) {
    failures.push("receipt has no system-configuration approval assignments");
  }
  const classifiedApprovalSpaces = new Set([
    ...(approvalReasons.production ?? []),
    ...(approvalReasons.systemConfiguration ?? []),
  ]);
  for (const space of approvalRequiredSpaces) {
    if (!classifiedApprovalSpaces.has(space)) {
      failures.push(`${space} has approval checks without a recorded reason`);
    }
  }
  for (const space of classifiedApprovalSpaces) {
    if (!approvalRequiredSpaces.includes(space)) {
      failures.push(`${space} has an approval reason but not the approval-required filter`);
    }
  }
  const sourceTypes = receipt?.spec?.spaces?.sourceTypes ?? {};
  const recordedSourceTypes = Object.keys(sourceTypes).sort();
  if (!sameJson(recordedSourceTypes, [...supportedSourceTypes].sort())) {
    failures.push("receipt source types do not match the maintained policy");
  }
  const selectedSpaces = new Set([...baselineSpaces, ...approvalRequiredSpaces]);
  const classifiedSourceSpaces = new Set();
  for (const sourceType of supportedSourceTypes) {
    const sourceSpaces = sourceTypes[sourceType] ?? [];
    if (!sourceSpaces.length) failures.push(`receipt has no ${sourceType} Spaces`);
    for (const space of sourceSpaces) {
      if (!selectedSpaces.has(space)) {
        failures.push(`${space} has a source type but no policy filter`);
      }
      if (classifiedSourceSpaces.has(space)) {
        failures.push(`${space} appears under more than one source type`);
      }
      classifiedSourceSpaces.add(space);
    }
  }
  for (const space of selectedSpaces) {
    if (!classifiedSourceSpaces.has(space)) {
      failures.push(`${space} has no recorded source type`);
    }
  }
  if (applyPolicy.status.liveReverified !== true) failures.push("policy status does not mark the live result as reverified");
  if (!String(receipt?.spec?.verifiedAt ?? "").startsWith(applyPolicy.status.lastRecorded)) {
    failures.push("policy lastRecorded date does not match the receipt");
  }
  if (!applyPolicy.status.evidence.includes("data/apply-policy-profiles/live-helm-catalog.yaml")) {
    failures.push("policy evidence does not link the live receipt");
  }

  return failures;
}

function printPolicyResult(receipt) {
  const baseline = receipt.spec.filters.baseline;
  const approvalRequired = receipt.spec.filters.approvalRequired;
  console.log(`baseline: ${baseline.triggers.length} Trigger(s), ${receipt.spec.spaces.baseline.length} Space(s)`);
  console.log(
    `approval required: ${approvalRequired.triggers.length} Trigger(s), ${receipt.spec.spaces.approvalRequired.length} Space(s)`,
  );
  console.log(
    `  reasons: ${(receipt.spec.spaces.approvalReasons.production ?? []).length} production, ${(receipt.spec.spaces.approvalReasons.systemConfiguration ?? []).length} system configuration`,
  );
  console.log(
    `  sources: ${Object.entries(receipt.spec.spaces.sourceTypes ?? {})
      .map(([sourceType, spaces]) => `${sourceType}=${spaces.length}`)
      .join(", ")}`,
  );
}

function syncPolicyTriggerDefinitions() {
  for (const definition of applyPolicy.spec.triggerDefinitions ?? []) {
    const [space, slug] = splitEntityRef(definition.ref);
    let exists = true;
    try {
      cubJson(["trigger", "get", "--space", space, slug]);
    } catch {
      exists = false;
    }
    const action = exists ? "update" : "create";
    const args = [
      "trigger",
      action,
      "--space",
      space,
      "--description",
      definition.description,
      "--quiet",
    ];
    if (definition.effect === "warn") args.push("--warn");
    else if (exists) args.push("--unwarn");
    args.push(
      slug,
      definition.event,
      definition.toolchain,
      definition.functionName,
      ...(definition.arguments ?? []).map((item) => String(item.value)),
    );
    cub(args);
    console.log(`${exists ? "updated" : "created"} ${definition.ref}`);
  }
  liveTriggerCache.clear();
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

if (mode === "--policy-receipt-verify") {
  if (!existsSync(policyReceiptPath)) {
    console.error(`missing ${policyReceiptPath}`);
    process.exit(1);
  }
  const receipt = readYaml(policyReceiptPath);
  const failures = verifyPolicyReceipt(receipt);
  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  printPolicyResult(receipt);
  console.log("verified committed helm-catalog apply-policy receipt");
  process.exit(0);
}

if (mode === "--policy-sync") {
  assertOrg();
  syncPolicyTriggerDefinitions();
  for (const policySet of [applyPolicy.spec.baseline, applyPolicy.spec.approvalRequired]) {
    const [space, slug] = splitEntityRef(policySet.filter);
    cub([
      "filter", "update", "--space", space, slug, "Trigger",
      "--where-field", policySet.filterWhere,
      "--quiet",
    ]);
    console.log(`updated ${policySet.filter} to its exact Trigger allow-list`);
  }

  const baselineFilter = cubJson(["filter", "get", "--space", ...splitEntityRef(baselineApplyFilter)]).Filter;
  const approvalRequiredFilter = cubJson([
    "filter",
    "get",
    "--space",
    ...splitEntityRef(approvalRequiredApplyFilter),
  ]).Filter;
  const rows = cubJson(["space", "list", "--select", "Labels,TriggerFilterID"]);
  const selectedSpaces = rows
    .map((row) => row.Space)
    .filter((space) => (
      space.TriggerFilterID === baselineFilter.FilterID
      || space.TriggerFilterID === approvalRequiredFilter.FilterID
      || space.Labels?.ApplyPolicyProfile === applyPolicy.metadata.name
    ))
    .sort((a, b) => a.Slug.localeCompare(b.Slug));

  for (const space of selectedSpaces) {
    const filterRef = requiresApproval(space)
      ? approvalRequiredApplyFilter
      : baselineApplyFilter;
    const sourceType = sourceTypeForSpace(space);
    if (!sourceType) {
      throw new Error(`cannot assign a source type to policy Space ${space.Slug}`);
    }
    cub([
      "space", "update", space.Slug,
      "--label", `ApplyPolicyProfile=${applyPolicy.metadata.name}`,
      "--label", `SourceType=${sourceType}`,
      "--trigger-filter", filterRef,
      "--where-trigger", "-",
      "--quiet",
    ]);
    cub(["space", "update", "--patch", space.Slug, "--refresh-triggers", "--quiet"]);
  }

  const { findings, receipt } = collectLivePolicyState();
  printPolicyResult(receipt);
  if (findings.length) {
    for (const finding of findings) console.error(`- ${finding}`);
    process.exit(1);
  }
  console.log(`synchronized and refreshed ${selectedSpaces.length} policy-bearing Space(s)`);
  process.exit(0);
}

if (mode === "--policy-record") {
  assertOrg();
  const { findings, receipt } = collectLivePolicyState();
  printPolicyResult(receipt);
  if (findings.length) {
    for (const finding of findings) console.error(`- ${finding}`);
    console.error("live policy topology failed; receipt was not written");
    process.exit(1);
  }
  writeYaml(policyReceiptPath, receipt);
  console.log("recorded live helm-catalog apply-policy topology");
  process.exit(0);
}

if (mode === "--policy-verify") {
  assertOrg();
  if (!existsSync(policyReceiptPath)) {
    console.error(`missing ${policyReceiptPath}; run --policy-record after a clean live check`);
    process.exit(1);
  }
  const committed = readYaml(policyReceiptPath);
  const receiptFailures = verifyPolicyReceipt(committed);
  const { findings, receipt: live } = collectLivePolicyState();
  const driftedFields = policyReceiptDrift(live, committed);
  printPolicyResult(live);
  for (const failure of [...receiptFailures, ...findings]) console.error(`- ${failure}`);
  if (driftedFields.length) {
    console.error(`- current live topology differs from the committed receipt (${driftedFields.join(", ")})`);
    if (process.env.HELM_EXPT_POLICY_DEBUG === "1") {
      const current = receiptComparable(live);
      const expected = receiptComparable(committed);
      for (const field of driftedFields) {
        console.error(`current ${field}: ${JSON.stringify(current[field])}`);
        console.error(`receipt ${field}: ${JSON.stringify(expected[field])}`);
      }
    }
  }
  if (receiptFailures.length || findings.length || driftedFields.length) process.exit(1);
  console.log("verified live helm-catalog apply-policy topology against the committed receipt");
  process.exit(0);
}

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
  const label = (space, pairs) => {
    const labels = { ApplyPolicyProfile: applyPolicy.metadata.name, ...pairs };
    return cub(["space", "update", space, ...Object.entries(labels).flatMap(([k, v]) => ["--label", `${k}=${v}`])]);
  };
  // Production and system-configuration Spaces get the approval-bearing
  // filter explicitly. variant create copies the template TriggerFilterID,
  // so a production clone otherwise inherits the baseline policy.
  const wireApprovalGates = (space) => {
    cub(["space", "update", space, "--trigger-filter", approvalRequiredApplyFilter, "--where-trigger", "-"]);
    cub(["space", "update", "--patch", space, "--refresh-triggers"]);
  };
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
      wireApprovalGates("bitnami-redis-prod");
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
      label("hook-probe-base", {
        Exhibit: "hooks-argo",
        SourceType: "rendered-config",
        HookRoute: "argo-hook-annotations",
        ProofReceipt: "hook-execution-proof",
        DeliveryReceipt: "oci-hook-delivery-proof",
      });
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
      if (envLabel === "Prod") wireApprovalGates(`bitnami-nginx-fleet-${env}`);
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
      if (envLabel === "Prod") wireApprovalGates(`hashicorp-vault-env-${env}`);
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

  // E7 sketches of the unbuilt: the things the catalog talks about that have
  // no product entity yet beyond the recipe unit — the act of rendering,
  // render provenance, and lifecycle routes. Same move as the recipe unit: a
  // convention in today's primitives that collapses into the product object
  // when it exists. Link quota is nearly spent (measured 977/1000), so
  // provenance gets ONE exemplar Link; the render-record unit describes the
  // full set.
  if (spaceExists("hashicorp-vault-demo-base")) {
    let rr = "exists";
    try { cub(["unit", "get", "render-record", "--space", "hashicorp-vault-demo-base"]); } catch { rr = "absent"; }
    if (rr === "absent") {
      const sketchDir = mkdtempSync(join(tmpdir(), "sketch-"));
      try {
        const recordPath = join(sketchDir, "render-record.yaml");
        write(recordPath, renderRecordYaml());
        cub(["unit", "create", "--space", "hashicorp-vault-demo-base", "render-record", recordPath, "--change-desc", "Sketch the render-record entity the product does not have yet: records the act of rendering that today happens client-side and unrecorded"]);
        cub(["link", "create", "--space", "hashicorp-vault-demo-base", "rendered-from-recipe", "statefulset-vault-vault", "recipe"]);
      } finally {
        rmSync(sketchDir, { recursive: true, force: true });
      }
    }
    results.push(["sketch-render-record", rr === "absent" ? "created" : "exists", "render-record unit + one exemplar rendered-from-recipe Link in hashicorp-vault-demo-base"]);
  } else {
    results.push(["sketch-render-record", "FAILED", "missing hashicorp-vault-demo-base"]);
  }
  if (spaceExists("route-sketch-kube-prometheus-stack")) {
    results.push(["route-sketch", "exists", "route-sketch-kube-prometheus-stack present; skipped"]);
  } else {
    cub(["space", "create", "route-sketch-kube-prometheus-stack",
      "--label", "Component=prometheus-community-kube-prometheus-stack",
      "--label", `ApplyPolicyProfile=${applyPolicy.metadata.name}`,
      "--label", "SourceType=rendered-config",
      "--label", "Exhibit=route-sketch", "--label", "Sketch=unbuilt-entity",
      "--label", "ProofReceipt=hook-lifecycle"]);
    const routeRows = parseCsvQuoted(readFileSync(join(repoRoot, "data", "lifecycle-routes", "routes.csv"), "utf8"))
      .filter((r) => r.chart === "prometheus-community/kube-prometheus-stack");
    const stage = mkdtempSync(join(tmpdir(), "routes-"));
    try {
      for (const r of routeRows) {
        const p = join(stage, `route-${r.route_name}.yaml`);
        write(p, lifecycleRouteYaml(r));
        cub(["unit", "create", "--space", "route-sketch-kube-prometheus-stack", `route-${r.route_name}`, p, "--change-desc", "Sketch lifecycle route as an addressable unit (unbuilt product entity); mirrors data/lifecycle-routes verbatim"]);
      }
      results.push(["route-sketch", "created", `${routeRows.length} LifecycleRoute unit(s), namespace-less so no Link cost`]);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  }

  const csv = [["exhibit", "result", "detail"], ...results].map((row) => row.join(",")).join("\n");
  write(join(repoRoot, "data", "helm-org", "exhibits.csv"), `${csv}\n`);
  for (const [exhibit, result, detail] of results) console.log(`${result.padEnd(8)} ${exhibit}: ${detail}`);
  process.exit(results.some(([, r]) => r === "FAILED") ? 1 : 0);
}

if (mode !== "--sync") {
  console.log("usage: node scripts/sync-helm-org.mjs [--plan|--sync|--verify|--relabel|--exhibits|--policy-sync|--policy-record|--policy-verify|--policy-receipt-verify] [--org <name>]");
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
    cub(["space", "update", item.space, "--trigger-filter", baselineApplyFilter, "--where-trigger", "-"]);
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
