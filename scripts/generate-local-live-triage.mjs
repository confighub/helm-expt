#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "local-live-triage");
const summaryPath = join(outDir, "summary.md");
const triagePath = join(outDir, "triage.csv");
const classPath = join(outDir, "classes.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(triagePath, report.triageCsv);
  write(classPath, report.classCsv);
  console.log(`wrote local live triage -> ${relativeRepo(outDir)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "data/local-live-triage/summary.md is missing; run npm run local-live:triage");
  check(existsSync(triagePath), "data/local-live-triage/triage.csv is missing; run npm run local-live:triage");
  check(existsSync(classPath), "data/local-live-triage/classes.csv is missing; run npm run local-live:triage");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/local-live-triage/summary.md is stale; run npm run local-live:triage");
  check(readFileSync(triagePath, "utf8") === report.triageCsv, "data/local-live-triage/triage.csv is stale; run npm run local-live:triage");
  check(readFileSync(classPath, "utf8") === report.classCsv, "data/local-live-triage/classes.csv is stale; run npm run local-live:triage");
  console.log(`verified local live triage for ${report.triageRows.length} non-pass row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-local-live-triage.mjs --generate
  node scripts/generate-local-live-triage.mjs --verify`);
}

function buildReport() {
  const baseRows = parseCsv(readFileSync(join(repoRoot, "data", "outcome-coverage", "base-outcomes.csv"), "utf8"));
  const nonPassRows = baseRows.filter((row) => ["blocked", "fail", "watch"].includes(row.local_live));
  const triageRows = nonPassRows.map(triageRow).sort((a, b) => {
    const classCompare = a.route_class.localeCompare(b.route_class);
    if (classCompare !== 0) return classCompare;
    return `${a.chart}/${a.base}`.localeCompare(`${b.chart}/${b.base}`);
  });

  const classRows = [...groupCount(triageRows, "route_class")]
    .map(([routeClass, count]) => ({
      route_class: routeClass,
      rows: count,
      meaning: classMeaning(routeClass),
      next_action: classNextAction(routeClass),
    }))
    .sort((a, b) => Number(b.rows) - Number(a.rows) || a.route_class.localeCompare(b.route_class));

  const localLiveRows = baseRows.filter((row) => ["pass", "blocked", "fail", "watch"].includes(row.local_live));
  const passCount = localLiveRows.filter((row) => row.local_live === "pass").length;
  return {
    triageRows,
    classRows,
    summary: summary({ totalRows: baseRows.length, localLiveRows: localLiveRows.length, passCount, nonPassRows: triageRows, classRows }),
    triageCsv: toCsv(triageRows),
    classCsv: toCsv(classRows),
  };
}

function triageRow(row) {
  const receipt = receiptFor(row);
  const receiptText = receipt.path ? readFileSync(join(repoRoot, receipt.path), "utf8") : "";
  const spec = receipt.value?.spec ?? {};
  const checks = Array.isArray(spec.checks) ? spec.checks : [];
  const failedChecks = checks.filter((checkRow) => ["fail", "blocked", "watch"].includes(String(checkRow.result ?? "")));
  const passChecks = checks.filter((checkRow) => checkRow.result === "pass").length;
  const reasonText = reasonBundle({ receiptText, spec, failedChecks, row });
  const route = classify(reasonText, row);
  return {
    chart: row.chart,
    base: row.base,
    local_live: row.local_live,
    route_class: route.routeClass,
    confidence: route.confidence,
    user_meaning: route.meaning,
    next_action: route.nextAction,
    proof_boundary: route.boundary,
    failed_checks: failedChecks.map((checkRow) => checkRow.name).filter(Boolean).join(";"),
    pass_checks: passChecks,
    first_reason: firstReason(spec, failedChecks),
    target_namespace: spec.target?.namespace ?? "",
    target_kind: spec.target?.kind ?? "",
    receipt: receipt.path,
    variant_revision: row.variant_revision,
  };
}

function receiptFor(row) {
  const match = row.evidence_notes.match(/(runs\/[^ |]+\/observation-receipt\.(?:yaml|json))/);
  if (!match) return { path: "", value: {} };
  const path = match[1];
  return { path, value: readYaml(join(repoRoot, path)) };
}

function reasonBundle({ receiptText, spec, failedChecks, row }) {
  const parts = [
    row.chart,
    row.base,
    row.local_live,
    ...(Array.isArray(spec.blockedReasons) ? spec.blockedReasons : []),
    ...failedChecks.flatMap((checkRow) => [checkRow.name, checkRow.object, checkRow.reason]),
    receiptText,
  ];
  return parts.filter(Boolean).join("\n").toLowerCase();
}

function classify(text, row) {
  const base = row.base.toLowerCase();
  const chart = row.chart.toLowerCase();
  if (includesAny(text, ["being terminate", "is being terminate", "currently being deleted", "unable to create new content in namespace"])) {
    return route("test-environment-cleanup", "high");
  }
  if (includesAny(text, ["no matches for kind", "resource mapping not found", "could not find the requested resource", "ensure crds are installed", "post cluster"])) {
    return route("missing-crds", "high");
  }
  if (includesAny(text, ["imagepullbackoff", "errimagepull", "image-pull-blocked", "image pull", "pull access denied", "manifest unknown"])) {
    return route("image-dependency", "high");
  }
  const baseDeclaresTargetSecret = includesAny(base, ["existing-secret", "existing-tls", "external-tls", "secure-mesh-existing-secrets"]);
  const explicitSecretFailure = includesAny(text, ["secret not found", "couldn't find key", "references non-existent secret"]);
  const runtimeFailure = includesAny(text, ["crashloopbackoff", "not-ready", "did not converge", "error ready=false", "runtime"]);
  const missingSecretLikePrereq = includesAny(text, ["missing mount/secret/config", "createcontainerconfigerror", "containercreating", "podinitializing"]);
  if (explicitSecretFailure || (baseDeclaresTargetSecret && missingSecretLikePrereq && !runtimeFailure)) {
    return route("target-secret", baseDeclaresTargetSecret ? "high" : "medium");
  }
  if (includesAny(text, ["insufficient", "nodes are available", "persistentvolumeclaim", "unbound", "storageclass", "too many pods", "didn't have free ports"])) {
    return route("target-fit", "high");
  }
  if (includesAny(text, ["forbidden", " is invalid", "error from server (invalid)", "field is immutable", "denied the request", "admission webhook"])) {
    return route("admission-or-rbac", "medium");
  }
  if (chart.startsWith("aws-") || includesAny(chart, ["external-dns"]) || includesAny(text, ["access key", "credentials", "provider", "cloud api", "s3", "bucket"])) {
    return route("cloud-or-provider-prerequisite", "medium");
  }
  if (runtimeFailure) {
    return route("runtime-readiness", "medium");
  }
  if (missingSecretLikePrereq) {
    return route("target-prerequisite", "medium");
  }
  return route("inspect-receipt", "low");
}

function route(routeClass, confidence) {
  return {
    routeClass,
    confidence,
    meaning: classMeaning(routeClass),
    nextAction: classNextAction(routeClass),
    boundary: classBoundary(routeClass),
  };
}

function classMeaning(routeClass) {
  const meanings = {
    "missing-crds": "The rendered objects refer to custom resource types that were not present on the target.",
    "target-secret": "The base deliberately expects a Secret or TLS material that was not staged on the target.",
    "target-prerequisite": "The workload reached Kubernetes but one or more pods were waiting for target-provided config, mounts, certificates, or setup.",
    "image-dependency": "The target could not pull at least one rendered image, so the row is testing image availability rather than ConfigHub parity.",
    "target-fit": "The rendered objects need target capacity, storage, ports, node shape, or scheduling policy that the test cluster did not provide.",
    "admission-or-rbac": "Kubernetes rejected an object because of permissions, admission, immutability, or API validation.",
    "cloud-or-provider-prerequisite": "The chart expects provider credentials, cloud APIs, buckets, DNS, volumes, or another external system.",
    "runtime-readiness": "The objects applied, but a controller or workload did not become healthy in the observation budget.",
    "test-environment-cleanup": "The receipt shows stale namespace or cleanup interference, so the next useful step is a clean rerun.",
    "inspect-receipt": "The receipt has useful failure evidence, but the automatic classifier does not yet have a precise route.",
  };
  return meanings[routeClass] ?? "Unknown route class.";
}

function classNextAction(routeClass) {
  const actions = {
    "missing-crds": "Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun.",
    "target-secret": "Stage the declared Secret or TLS material as a target fact, then rerun the local live and parity lanes.",
    "target-prerequisite": "Turn the missing target condition into a target fact, preflight, lifecycle route, or better base variant.",
    "image-dependency": "Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it.",
    "target-fit": "Run on a target profile with the required capacity/storage/ports, or narrow the base variant.",
    "admission-or-rbac": "Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary.",
    "cloud-or-provider-prerequisite": "Model the provider dependency as target facts or an external managed prerequisite before rerun.",
    "runtime-readiness": "Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun.",
    "test-environment-cleanup": "Delete the stale namespace or rerun on a fresh cluster with an isolated namespace.",
    "inspect-receipt": "Read the receipt and add a classifier rule only after the product route is clear.",
  };
  return actions[routeClass] ?? "Inspect receipt.";
}

function classBoundary(routeClass) {
  const boundaries = {
    "missing-crds": "Render parity still stands; live success is scoped to targets with the required CRDs or a CRD-owning base.",
    "target-secret": "The model is working when it refuses to invent secret material; live success requires the target fact.",
    "target-prerequisite": "The row is not production-supported until the prerequisite is modeled and observed.",
    "image-dependency": "The row does not prove a ConfigHub semantic defect; it proves an image supply-chain dependency.",
    "target-fit": "The row is target-profile dependent, not a universal chart failure.",
    "admission-or-rbac": "The row needs a target policy decision before support claims.",
    "cloud-or-provider-prerequisite": "Local kind is not enough to prove cloud/provider behavior.",
    "runtime-readiness": "Rendered-object proof is intact; runtime support needs a separate observation or configuration fix.",
    "test-environment-cleanup": "Do not draw product conclusions from this row until a clean rerun exists.",
    "inspect-receipt": "No stronger claim should be made until the row is manually routed.",
  };
  return boundaries[routeClass] ?? "";
}

function firstReason(spec, failedChecks) {
  const blocked = Array.isArray(spec.blockedReasons) ? spec.blockedReasons.find(Boolean) : "";
  const checkReason = failedChecks.map((checkRow) => checkRow.reason).find(Boolean);
  return shortText(blocked || checkReason || "");
}

function summary({ totalRows, localLiveRows, passCount, nonPassRows, classRows }) {
  const preview = nonPassRows.slice(0, 30);
  return `# Local Live Non-Pass Triage

This generated report explains the local Kubernetes rows that did not pass.
It starts from [base-outcomes.csv](../outcome-coverage/base-outcomes.csv) and
the committed observation receipts. The purpose is to make the next action
clear without turning every non-pass row into a product defect.

## Snapshot

~~~text
chart/base rows:          ${totalRows}
local live observed rows: ${localLiveRows}
local live pass rows:     ${passCount}
local live non-pass rows: ${nonPassRows.length}
classified non-pass rows: ${nonPassRows.filter((row) => row.route_class !== "inspect-receipt").length}
needs manual inspection:  ${nonPassRows.filter((row) => row.route_class === "inspect-receipt").length}
~~~

## Route Classes

| Route class | Rows | Meaning | Next action |
| --- | ---: | --- | --- |
${classRows.map((row) => `| \`${row.route_class}\` | ${row.rows} | ${escapePipes(row.meaning)} | ${escapePipes(row.next_action)} |`).join("\n")}

## First Rows To Inspect

| Chart | Base | Result | Route class | Next action | Receipt |
| --- | --- | --- | --- | --- | --- |
${preview.map((row) => `| \`${row.chart}\` | ${row.base} | ${row.local_live} | \`${row.route_class}\` | ${escapePipes(row.next_action)} | [receipt](../../${row.receipt}) |`).join("\n")}

## How To Use This

These rows are live evidence, not shame stickers. A non-pass row can be a
useful result: it may prove that a base needs a target fact, a CRD policy, an
image mirror, a larger target profile, a provider prerequisite, or a clean
rerun. The route class tells the next useful action before making stronger
support claims.

Machine-readable files:

~~~text
data/local-live-triage/triage.csv
data/local-live-triage/classes.csv
~~~

Regenerate and verify:

~~~sh
npm run local-live:triage
npm run local-live:triage:verify
~~~
`;
}

function includesAny(text, needles) {
  return needles.some((needle) => text.includes(needle));
}

function groupCount(rows, field) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field], (counts.get(row[field]) ?? 0) + 1);
  return counts;
}

function shortText(text) {
  return ascii(String(text ?? "").replace(/\s+/g, " ").trim()).slice(0, 260);
}

function escapePipes(text) {
  return ascii(text).replaceAll("|", "\\|");
}

function ascii(text) {
  return String(text ?? "")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2013", "-")
    .replaceAll("\u2026", "...");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...records] = rows.filter((line) => line.some((item) => item !== ""));
  if (!headers) return [];
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""]))
  );
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = ascii(value === undefined || value === null ? "" : String(value));
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
