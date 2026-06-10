#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "pain-point-coverage");
const outputs = {
  csv: join(outputRoot, "pain-points.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote pain-point coverage -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run pain-points:generate`);
    check(readFileSync(path, "utf8") === report[name], `${relativeRepo(path)} is stale; run npm run pain-points:generate`);
  }
  console.log(`verified pain-point coverage for ${report.rows.length} Helm pain point(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-pain-point-coverage.mjs --generate
  node scripts/generate-pain-point-coverage.mjs --verify`);
}

function buildReport() {
  const rows = painPoints();
  return {
    rows,
    csv: toCsv(rows),
    summary: summary(rows),
  };
}

function painPoints() {
  return [
    row({
      id: "go-templated-yaml",
      pain_point: "Go-templated YAML",
      root_cause: "Helm templates are string-producing programs whose structure is discarded after render.",
      helm_expt_answer: "Render to explicit Kubernetes objects, keep object inventories, and record Helm-equivalence receipts.",
      confighub_server_answer: "Store rendered objects as typed Units with revisions, diffs, links, gates, and approvals.",
      installer_answer: "Package the reviewed render as a named cub installer base.",
      cub_scout_answer: "Observe whether the applied objects exist and remain fresh.",
      current_status: "strong-current-proof",
      evidence_path: "recipes/*/*/*/revisions/*/r001/receipts/helm-equivalence-receipt.yaml;data/outcome-coverage/base-outcomes.csv",
      remaining_gap: "Complex template behavior is still chart-specific; provenance is not field-complete for every chart.",
      next_action: "Use edge recovery and variant-path coverage to track where template behavior affects fields.",
    }),
    row({
      id: "values-sprawl",
      pain_point: "values.yaml sprawl",
      root_cause: "Chart defaults, values files, globals, subcharts, and overlays make effective inputs hard to see.",
      helm_expt_answer: "Record effective values, value models, value-source maps where present, and named base variants.",
      confighub_server_answer: "Turn chosen bases into managed variants with explicit parameters, labels, and links.",
      installer_answer: "Expose supported bases rather than unbounded ad hoc values combinations.",
      cub_scout_answer: "Confirm target facts and live outcomes for a selected variant.",
      current_status: "strong-for-supported-bases",
      evidence_path: "recipes/*/*/*/effective-values*.yaml;recipes/*/*/*/variants/*/variant.yaml;data/outcome-coverage/base-outcomes.csv",
      remaining_gap: "Arbitrary user values and wrapper overlays need managed import or a new base variant.",
      next_action: "Add variant-path coverage rows for custom values, overlays, and managed imports.",
    }),
    row({
      id: "release-state-in-cluster",
      pain_point: "State lives in cluster secrets",
      root_cause: "Helm release history is stored as cluster state rather than a durable desired-state graph.",
      helm_expt_answer: "Keep pinned rendered object sets, receipts, source locks, dependency locks, and package receipts outside Helm release state.",
      confighub_server_answer: "Store desired state, revisions, approvals, changesets, links, and operation receipts.",
      installer_answer: "Upload reviewed objects as ConfigHub Units and package records.",
      cub_scout_answer: "Compare intended object sets with observed live resources.",
      current_status: "partial-handoff",
      evidence_path: "data/outcome-coverage/chart-outcomes.csv;data/runtime-gitops/summary.md;data/live-kind-parity/summary.md",
      remaining_gap: "Queryable operation history and authority are ConfigHub Server concerns, not helm-expt alone.",
      next_action: "Keep chain-of-proof status per chart/base/variant-path so desired and live claims remain separate.",
    }),
    row({
      id: "failed-upgrades",
      pain_point: "Failed upgrades wedge releases",
      root_cause: "Helm upgrade state and three-way merge can leave release state wedged or ambiguous.",
      helm_expt_answer: "Compute upgrade and rollback diffs where represented; record simulation receipts and risk notes.",
      confighub_server_answer: "Operate on approved desired revisions with changesets and explicit rollback targets.",
      installer_answer: "Apply/upload selected package bases rather than mutating Helm release state.",
      cub_scout_answer: "Observe convergence, drift, and stale live objects after upgrade paths.",
      current_status: "partial",
      evidence_path: "recipes/*/*/*/operations/*/*receipt.yaml;data/variant-path-coverage/coverage-matrix.csv",
      remaining_gap: "Real upgrade/prune behavior and rollback semantics require live controller evidence.",
      next_action: "Track upgrade and rollback as variant paths with their own proof links.",
    }),
    row({
      id: "crd-handling",
      pain_point: "CRD handling",
      root_cause: "Helm installs CRDs specially and does not manage CRD upgrades cleanly.",
      helm_expt_answer: "Expose CRDs in object inventories, provide no-crds bases where useful, and flag CRD lifecycle risk.",
      confighub_server_answer: "Gate CRD ownership and upgrade decisions before promotion.",
      installer_answer: "Package CRD/no-CRD bases and preserve declared lifecycle policy.",
      cub_scout_answer: "Observe CRD presence, API availability, and webhook readiness.",
      current_status: "partial",
      evidence_path: "data/hook-lifecycle/summary.md;data/outcome-coverage/feature-outcomes.csv;recipes/*/*/*/helm-pain-report.yaml",
      remaining_gap: "CRD upgrade behavior remains an operator-reviewed lifecycle path.",
      next_action: "Keep CRD install, no-crds, and CRD-upgrade as separate variant-path outcomes.",
    }),
    row({
      id: "dependency-hell",
      pain_point: "Subchart and dependency hell",
      root_cause: "Umbrella charts, aliases, globals, and dependency closures hide where rendered objects come from.",
      helm_expt_answer: "Record dependency locks and chart dossiers; add scanner axes for alias, import-values, and library charts.",
      confighub_server_answer: "Represent component relationships and cross-object links in the desired-state graph.",
      installer_answer: "Package the reviewed dependency closure as the supported artifact.",
      cub_scout_answer: "Observe whether dependency-owned objects are healthy after apply.",
      current_status: "partial",
      evidence_path: "recipes/*/*/*/dependency-lock.yaml;data/chart-facts/chart-facts.csv;docs/reference/quirk-coverage.md",
      remaining_gap: "Dependency aliases and import-values need stronger scanner coverage.",
      next_action: "Add alias, import-values, and library-chart axes to chart facts and quirk coverage.",
    }),
    row({
      id: "field-level-governance",
      pain_point: "No field-level governance",
      root_cause: "Rendered YAML loses intent and field provenance unless captured at render time.",
      helm_expt_answer: "Record value-source maps where available and recover field reachability into graph fragments.",
      confighub_server_answer: "Use Units, links, TransformPaths, functions, gates, and mutation sources for field-level control.",
      installer_answer: "Keep package bases bounded and reviewed before upload.",
      cub_scout_answer: "Report live drift at object/field level where supported.",
      current_status: "partial-strong-on-redis",
      evidence_path: "recipes/bitnami/redis/25.5.3/value-source-map.yaml;data/edge-recovery/edges.csv",
      remaining_gap: "Field-complete provenance is not yet available for every chart.",
      next_action: "Expand value-source-map and edge recovery coverage chart by chart.",
    }),
    row({
      id: "secrets",
      pain_point: "No native secrets story",
      root_cause: "Helm can generate or reference secrets, but GitOps and config stores need explicit secret handling policy.",
      helm_expt_answer: "Classify generated facts and target facts; provide generated-secret and existing-secret bases.",
      confighub_server_answer: "Store secret references, requirements, gates, and receipts rather than silently hiding credentials.",
      installer_answer: "Separate rendered Secrets from uploaded manifests where required and enforce externalRequires/preflight where available.",
      cub_scout_answer: "Observe required Secret presence and workload start success.",
      current_status: "partial-known-gap",
      evidence_path: "recipes/bitnami/redis/25.5.3/install-checks.yaml;data/outcome-coverage/feature-outcomes.csv;data/live-helm-confighub-compare/summary.md",
      remaining_gap: "Secret delivery on GitOps paths needs hard gates and production policy.",
      next_action: "Track generated-fact and target-fact edges per variant path.",
    }),
    row({
      id: "hooks",
      pain_point: "Hooks are brittle",
      root_cause: "Helm hook resources depend on phase, ordering, cluster state, and delete policy outside plain desired YAML.",
      helm_expt_answer: "Detect hook-bearing charts and classify lifecycle routes; do not claim hook execution from render parity.",
      confighub_server_answer: "Represent lifecycle actions, approvals, and receipts as explicit desired operations.",
      installer_answer: "Execute or hand off lifecycle steps only where the route is supported.",
      cub_scout_answer: "Observe post-hook resources, readiness, and failure conditions.",
      current_status: "partial-doctrine",
      evidence_path: "data/hook-lifecycle/source-top100-hooks.csv;data/hook-lifecycle/maintained-hook-queue.csv;docs/user/hook-lifecycle-strategy.md",
      remaining_gap: "Hook execution receipts are not complete for the hook-bearing catalog.",
      next_action: "Separate pre-install, post-install, upgrade, and delete hooks in variant-path coverage.",
    }),
    row({
      id: "multi-env-promotion",
      pain_point: "Multi-environment promotion is DIY",
      root_cause: "Helm values files do not provide a durable variant model or promotion record.",
      helm_expt_answer: "Provide named bases, variant diffs, promotion examples, and target-bound derived variant receipts.",
      confighub_server_answer: "Use spaces, Units, labels, links, `cub variant create`, approvals, and changesets for derived variants.",
      installer_answer: "Supply the reviewed base that derived variants clone or refine.",
      cub_scout_answer: "Observe each target after promotion.",
      current_status: "partial",
      evidence_path: "docs/user/creating-variants.md;docs/user/prometheus-overlay-promotion-example.md;data/derived-variant-target-bound/summary.csv",
      remaining_gap: "High-fanout propagation and override-protection need a stronger demo.",
      next_action: "Use Prometheus/kube-prometheus-stack for the main high-fanout variant demo.",
    }),
    row({
      id: "gitops-mismatch",
      pain_point: "GitOps impedance mismatch",
      root_cause: "Helm may render in different places, while GitOps controllers apply or re-render under their own context.",
      helm_expt_answer: "Render once, publish signed/pinned object sets, and prove the render under a declared flag profile.",
      confighub_server_answer: "Track desired revision and handoff target as managed state.",
      installer_answer: "Publish/upload package bases into ConfigHub/OCI paths.",
      cub_scout_answer: "Observe Argo/Flux sync and live object state.",
      current_status: "partial-live-lane",
      evidence_path: "data/runtime-gitops/summary.md;data/live-helm-confighub-compare/summary.md",
      remaining_gap: "Controller-specific live proof is not complete for every base variant.",
      next_action: "Keep GitOps live status separate from local render parity in all matrices.",
    }),
    row({
      id: "history-without-diffs",
      pain_point: "History without diffs",
      root_cause: "Helm history records revisions but not durable object/field-level explanations.",
      helm_expt_answer: "Store variant revisions, object inventories, diffs, receipts, and operation simulations.",
      confighub_server_answer: "Provide queryable revision history, changesets, approvals, and diff views.",
      installer_answer: "Record package/action receipts.",
      cub_scout_answer: "Record observed live receipts against intended revisions.",
      current_status: "strong-static-partial-operational",
      evidence_path: "recipes/*/*/*/diffs/*.yaml;recipes/*/*/*/revisions/*/r001/variant-revision.yaml",
      remaining_gap: "Fleet-wide query and operation history belong in ConfigHub Server.",
      next_action: "Tie diffs and operations into variant-path coverage.",
    }),
    row({
      id: "template-language-limits",
      pain_point: "Templating language limits",
      root_cause: "Complex helper macros, tpl, raw manifests, and conditionals make behavior hard to audit.",
      helm_expt_answer: "Surface tpl/raw/extension slots and keep supported bases bounded.",
      confighub_server_answer: "Move post-render customization to typed Units, links, functions, and views where possible.",
      installer_answer: "Reject or gate unbounded extension slots for supported catalog entries.",
      cub_scout_answer: "Observe live effects of extension-derived objects.",
      current_status: "partial",
      evidence_path: "data/outcome-coverage/feature-outcomes.csv;recipes/*/*/*/helm-pain-report.yaml",
      remaining_gap: "Not every template-language feature is field-provenanced yet.",
      next_action: "Add scanner axes and require clear disposition for each extension slot.",
    }),
    row({
      id: "dry-run-reality-gap",
      pain_point: "Dry-run does not match reality",
      root_cause: "Admission, defaulting, controllers, webhooks, and API availability affect stored/live state after render.",
      helm_expt_answer: "Keep render proof separate from live proof and record target facts/capability profile.",
      confighub_server_answer: "Gate promotion on target facts, approvals, and observation policy.",
      installer_answer: "Run preflight and target-fact collection where available.",
      cub_scout_answer: "Observe live state, freshness, API readiness, and workload health.",
      current_status: "partial-live-dependent",
      evidence_path: "docs/user/verification-lanes.md;data/live-kind-parity/summary.md;data/lifecycle-observations/cert-manager-eso/summary.md",
      remaining_gap: "Admission/defaulting parity is target-specific and requires live observation.",
      next_action: "Add target/live requirements to variant-path coverage rather than hiding them in notes.",
    }),
    row({
      id: "fork-burden",
      pain_point: "Chart ownership and fork burden",
      root_cause: "Small local changes often force teams to fork charts or maintain fragile overlays.",
      helm_expt_answer: "Route shape-changing changes to new bases and post-render changes to derived ConfigHub variants.",
      confighub_server_answer: "Support Creator flows, TransformPaths, functions, labels, links, and approvals over rendered Units.",
      installer_answer: "Provide maintained public and managed recipe bases.",
      cub_scout_answer: "Confirm the derived or promoted variant reached the target.",
      current_status: "partial-product-lane",
      evidence_path: "docs/user/change-routing-before-oci.md;docs/user/custom-overlays.md;docs/user/creating-variants.md",
      remaining_gap: "Creator UX and managed imports are product work beyond current static catalog proof.",
      next_action: "Keep base, derived, and managed overlay paths explicit in user docs and coverage rows.",
    }),
  ];
}

function row(input) {
  return input;
}

function summary(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.current_status, (counts.get(row.current_status) ?? 0) + 1);
  const countLines = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");
  const claimBuckets = [
    {
      bucket: "Strong static proof",
      rows: rows.filter((row) => row.current_status.startsWith("strong")),
      meaning: "The repo has useful static or base-scoped proof today. This is not a blanket live-production claim.",
    },
    {
      bucket: "Partial with current evidence",
      rows: rows.filter((row) => row.current_status === "partial" || row.current_status === "partial-strong-on-redis"),
      meaning: "The model is working for examples or parts of the lifecycle, but the proof is not broad enough yet.",
    },
    {
      bucket: "Live-dependent",
      rows: rows.filter((row) => row.current_status.includes("live")),
      meaning: "The answer depends on cluster, GitOps, runtime, or observation receipts.",
    },
    {
      bucket: "Product or handoff lane",
      rows: rows.filter((row) => row.current_status.includes("product") || row.current_status.includes("handoff")),
      meaning: "The repo explains the route, but the durable value belongs in ConfigHub Server, cub-scout, or a product workflow.",
    },
    {
      bucket: "Known gap or doctrine only",
      rows: rows.filter((row) => row.current_status.includes("known-gap") || row.current_status.includes("doctrine")),
      meaning: "The repo has the policy and detection path, but not complete execution receipts yet.",
    },
  ];
  return `# Helm Pain Point Coverage

This generated report maps the 15 common Helm pain points to the current
helm-expt catalog, the ConfigHub desired-state graph, \`cub installer\`, and
\`cub-scout\`.

The purpose is not to claim every pain is fully solved today. The purpose is to
show where each pain is handled now, where it is a handoff, and what evidence or
work remains.

## Status Counts

${countLines}

## Claim Buckets

| Bucket | Count | Pain points | Meaning |
| --- | ---: | --- | --- |
${claimBuckets.map((bucket) => `| ${bucket.bucket} | ${bucket.rows.length} | ${painList(bucket.rows)} | ${bucket.meaning} |`).join("\n")}

## Root Cause Model

Helm is a 1-to-many generator. One chart plus one values set can produce many
objects, and one high-density value can touch many fields across those objects.
After render, Helm loses the inverse: the output no longer explains which input
produced each field. Multiple generators such as Helm, Kustomize, GitOps
controllers, and agents multiply the problem unless their outputs and provenance
enter one graph.

## Pain Points And Next Actions

| Pain point | Current status | Remaining gap | Next action |
| --- | --- | --- | --- |
${rows.map((row) => `| ${row.pain_point} | \`${row.current_status}\` | ${escapePipes(row.remaining_gap)} | ${escapePipes(row.next_action)} |`).join("\n")}

## What To Open

| File | Purpose |
| --- | --- |
| [pain-points.csv](./pain-points.csv) | One row per pain point with current answer, handoff, evidence, and remaining gap. |
| [../../docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | User-facing explanation of the same matrix. |
| [../outcome-coverage/summary.md](../outcome-coverage/summary.md) | Outcome and proof-lane status per chart/base/feature. |
| [../variant-path-coverage/summary.md](../variant-path-coverage/summary.md) | Per chart/base/path proof status. |

## Regenerate

~~~sh
npm run pain-points:generate
npm run pain-points:verify
~~~
`;
}

function painList(rows) {
  if (!rows.length) return "-";
  return rows.map((row) => row.pain_point).join("<br>");
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
