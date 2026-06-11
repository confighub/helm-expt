#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "claims-register");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  claims: join(outputRoot, "claims.csv"),
};

const claims = [
  {
    id: "render-parity",
    area: "core",
    status: "backed",
    claim: "For catalogued bases, cub installer output is compared with regular Helm output under recorded inputs.",
    evidence: [
      "data/outcome-coverage/base-outcomes.csv",
      "data/live-kind-parity/summary.md",
      "data/live-helm-confighub-compare/summary.md",
    ],
    verify: "npm run outcomes:verify; npm run kind-parity:verify; npm run live-parity:verify",
    limit: "The claim is per chart, version, base, values profile, and target profile. It is not a claim over the whole Helm values space.",
  },
  {
    id: "top20-live-evidence",
    area: "catalog",
    status: "backed",
    claim: "The top-20 catalog has committed live evidence, but exact strength still depends on the chart, base, and lane.",
    evidence: [
      "data/status-dashboard/top20-status.csv",
      "data/live-e2e/summary.md",
      "data/top20-base-readiness/summary.md",
      "data/outcome-coverage/base-outcomes.csv",
    ],
    verify: "npm run top20:verify-local-e2e; npm run top20:base-readiness:verify; npm run outcomes:verify",
    limit: "This is not a blanket production-support statement. Production support is target-scoped.",
  },
  {
    id: "top100-proof-corpus",
    area: "catalog",
    status: "backed",
    claim: "The top-100 corpus contains maintained proof-grade recipe and package artifacts, with readiness separated from production support.",
    evidence: [
      "data/top100-readiness/summary.md",
      "data/top100-coverage/summary.md",
      "data/top100-catalog-analysis/summary.md",
      "data/next80-full-proofs/summary.md",
    ],
    verify: "npm run top100:readiness:verify; npm run top100:coverage:verify; npm run next80:verify",
    limit: "Many top-100 rows still need catalog review, useful variants, production disposition, or selected live lanes.",
  },
  {
    id: "helm-pain-point-coverage",
    area: "pain-points",
    status: "partial",
    claim: "The project maps common Helm pain points to a general solution and per-chart pain reports.",
    evidence: [
      "docs/user/helm-pain-points.md",
      "data/pain-point-coverage/summary.md",
      "data/pain-point-coverage/pain-points.csv",
      "recipes/bitnami/redis/25.5.3/helm-pain-report.yaml",
    ],
    verify: "npm run pain-points:verify; npm run catalog:pain-reports:verify",
    limit: "Coverage is strongest for the top-20 and for pain points represented in current source scans and receipts.",
  },
  {
    id: "hooks-lifecycle",
    area: "lifecycle",
    status: "partial",
    claim: "Helm hooks and hook-like lifecycle behavior are inventoried and routed to lifecycle receipts, policy, or explicit refusal.",
    evidence: [
      "docs/user/hook-lifecycle-strategy.md",
      "data/hook-lifecycle/summary.md",
      "data/lifecycle-boundary/summary.md",
      "runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml",
    ],
    verify: "npm run hooks:lifecycle:verify; npm run lifecycle:boundary:verify; npm run lifecycle:gatekeeper-hooks:verify",
    limit: "Lifecycle proof is still partial. Some hook classes require per-chart observation or target-specific operating policy.",
  },
  {
    id: "crd-webhook-controller-observation",
    area: "lifecycle",
    status: "partial",
    claim: "CRDs, webhooks, and controller-populated fields are treated as lifecycle facts that need fresh observation, not as static YAML certainty.",
    evidence: [
      "data/lifecycle-observations/cert-manager-eso/summary.md",
      "data/lifecycle-boundary/summary.md",
      "docs/user/why-synced-is-not-working.md",
      "docs/user/what-we-refuse-to-claim.md",
    ],
    verify: "npm run lifecycle:cert-manager-eso:verify; npm run lifecycle:boundary:verify",
    limit: "CRD upgrade and controller mutation remain per-chart decisions until more live upgrade receipts exist.",
  },
  {
    id: "secrets-generated-facts",
    area: "facts",
    status: "partial",
    claim: "Generated values, existing secrets, and target facts are separated so secret handling is explicit.",
    evidence: [
      "docs/reference/generated-fact-receipts.md",
      "recipes/bitnami/redis/25.5.3/install-checks.yaml",
      "docs/user/try-now.md",
      "data/attack-plan-workdown/secret-gap-workdown.csv",
    ],
    verify: "npm run redis:verify-package; npm run attack-plan:verify",
    limit: "This does not make ConfigHub a universal secret manager. Some variants require a pre-existing target secret.",
  },
  {
    id: "config-variants",
    area: "variants",
    status: "partial",
    claim: "Base variants are render-time installer choices; derived ConfigHub variants are post-render refinements for target, environment, region, customer, or operations.",
    evidence: [
      "docs/user/creating-variants.md",
      "docs/user/change-routing-before-oci.md",
      "data/variant-goldens/redis-prod-us-east/README.md",
      "data/outcome-coverage/derived-variant-outcomes.csv",
    ],
    verify: "npm run variant-goldens:verify; npm run outcomes:verify",
    limit: "If a change requires a new Helm render, it belongs back in the installer recipe path.",
  },
  {
    id: "custom-overlays",
    area: "variants",
    status: "partial",
    claim: "Wrapper chart and values-overlay cases can be modeled as managed imports, with customer choices routed to installer bases or ConfigHub derived variants.",
    evidence: [
      "docs/user/custom-overlays.md",
      "docs/reference/customization-algorithm.md",
      "data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md",
      "docs/corpus/kubara-customized-overlays.md",
    ],
    verify: "npm run variant-goldens:verify",
    limit: "The Kubara-style case is a managed-import pattern, not a free public-catalog guarantee for arbitrary private overlays.",
  },
  {
    id: "scan-gates-safe-ops",
    area: "operations",
    status: "partial",
    claim: "Rendered objects can be scanned, gated, patched, approved, and recorded as ConfigHub operation evidence.",
    evidence: [
      "data/external-scan-lane/summary.md",
      "data/scan-disposition-workdown/summary.md",
      "docs/user/tutorial-sequence.md",
      "docs/demo/redis/function-scan-lane.md",
      "docs/demo/redis/safe-ops-lane.md",
    ],
    verify: "npm run external-scan:verify; npm run scan-disposition:workdown:verify",
    limit: "Scanner results and safe-operation examples do not imply every chart is production-approved.",
  },
  {
    id: "oci-gitops-runtime",
    area: "delivery",
    status: "partial",
    claim: "OCI and GitOps delivery are part of the live proof path, with Argo/Flux status separated from local apply evidence.",
    evidence: [
      "data/runtime-gitops/summary.md",
      "data/runtime-gitops/wave1.csv",
      "docs/user/adopting-existing-apps.md",
      "docs/user/chain-of-proof.md",
    ],
    verify: "npm run runtime-gitops:wave:verify",
    limit: "A green local live row is not the same thing as Argo or Flux pulling ConfigHub OCI successfully.",
  },
  {
    id: "public-fast-paths",
    area: "commands",
    status: "backed",
    claim: "The command story distinguishes quick inspection, quick ConfigHub import, maintained installer recipes, and post-render variants.",
    evidence: [
      "docs/user/choosing-commands.md",
      "docs/reference/direct-cub-helm-model.md",
      "docs/user/why-this-exists.md",
      "docs/user/verify-it-yourself.md",
    ],
    verify: "npm run docs:verify; npm run installer:command-surface:verify; npm run variant:command-surface:verify",
    limit: "Fast commands do not carry the same evidence as supported catalog packages unless the proof lanes are run.",
  },
  {
    id: "serverless-verified-install",
    area: "commercial",
    status: "planned",
    claim: "A low-friction verified-install path can exist before full paid ConfigHub operations.",
    evidence: [
      "docs/planning/serverless-verified-install-plan.md",
      "docs/planning/verified-install-commercial-model.md",
      "docs/user/product-support-tiers.md",
    ],
    verify: "npm run docs:verify",
    limit: "This is planning, not a current shipped anonymous service claim.",
  },
  {
    id: "commercial-security-signing",
    area: "commercial",
    status: "planned",
    claim: "Signed artifacts, factory scans, image digest inventory, refresh SLAs, private catalogs, and fleet queries are commercial directions.",
    evidence: [
      "docs/planning/verified-install-commercial-model.md",
      "data/image-digest-workdown/summary.md",
      "docs/user/product-support-tiers.md",
      "docs/user/maintenance-sla.md",
    ],
    verify: "npm run image-digests:workdown:verify; npm run docs:verify",
    limit: "Security signing and paid support claims require production key, policy, transparency, and SLA decisions.",
  },
  {
    id: "blast-radius-prediction",
    area: "sceptic-tests",
    status: "partial",
    claim: "Blast-radius prediction is scored by comparing predicted affected objects with actual rerender diffs, from committed base pairs and recorded single-value rerender receipts.",
    evidence: [
      "data/blast-radius-accuracy/summary.md",
      "data/blast-radius-accuracy/cases.csv",
      "docs/planning/robust-sceptic-plan.md",
      "data/edge-recovery/summary.md",
      "data/high-fanout-demo/summary.md",
    ],
    verify: "npm run blast-radius:accuracy:verify; npm run edges:verify; npm run high-fanout:verify",
    limit: "Measured coverage is still a small slice of the catalog (current counts are in data/blast-radius-accuracy/summary.md). Whole-release identity paths are measured with rename-aware pairing and currently fail, recording that the source maps under-predict them; the route is exhaustive enumeration or a declared whole-release impact scope.",
  },
  {
    id: "environment-determinism",
    area: "sceptic-tests",
    status: "partial",
    claim: "Rendering is recorded as environment-invariant across timezone and locale variations for the measured corpus, per flag profile.",
    evidence: [
      "data/environment-matrix/summary.md",
      "data/environment-matrix/matrix.csv",
      "docs/planning/robust-sceptic-plan.md",
    ],
    verify: "npm run environment-matrix:verify",
    limit: "The matrix covers the proof-grade corpus on one operating system, architecture, and helm version; other platforms and helm versions are open columns intended for CI runners. A divergent cell is recorded, not hidden.",
  },
  {
    id: "refused-blanket-verification",
    area: "refusals",
    status: "refused",
    claim: "The project refuses to claim that a chart is verified without naming the exact chart, version, base, lane, and target profile.",
    evidence: [
      "docs/user/what-we-refuse-to-claim.md",
      "docs/user/current-proof-status.md",
      "docs/user/live-parity.md",
      "data/live-parity-rerun-plan/summary.md",
    ],
    verify: "npm run docs:verify; npm run live-parity:rerun-plan:verify",
    limit: "This is a rule that constrains public claims. It does not reduce the work needed to pass more lanes.",
  },
];

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.claims, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote claims register -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run claims:register`);
    check(readFileSync(path, "utf8") === report[name === "claims" ? "csv" : name], `${relativeRepo(path)} is stale; run npm run claims:register`);
  }
  console.log(`verified claims register for ${claims.length} claim(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-claims-register.mjs --generate
  node scripts/generate-claims-register.mjs --verify`);
}

function buildReport() {
  for (const claim of claims) {
    for (const evidencePath of claim.evidence) {
      check(existsSync(join(repoRoot, evidencePath)), `claim ${claim.id} points at missing evidence: ${evidencePath}`);
    }
  }
  const rows = claims.map((claim) => ({
    id: claim.id,
    area: claim.area,
    status: claim.status,
    claim: claim.claim,
    evidence_paths: claim.evidence.join("; "),
    verify_commands: claim.verify,
    limit_or_refusal: claim.limit,
  }));
  return {
    csv: toCsv(rows),
    summary: summary(rows),
  };
}

function summary(rows) {
  const counts = countBy(rows, "status");
  const areas = countBy(rows, "area");
  const statuses = ["backed", "partial", "planned", "refused"];
  const areaLines = Object.entries(areas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([area, count]) => `| ${area} | ${count} |`)
    .join("\n");
  return `# Claims Register

This generated register maps public claims to evidence, verification commands,
and limits. It is a guardrail for reviewers: if a public page says something
stronger than this table, the page should be corrected or the missing evidence
should be added.

## Status

| Status | Count | Meaning |
| --- | ---: | --- |
${statuses.map((status) => `| \`${status}\` | ${counts[status] ?? 0} | ${meaning(status)} |`).join("\n")}

## Areas

| Area | Claims |
| --- | ---: |
${areaLines}

## Rules

| Rule | Practical effect |
| --- | --- |
| No evidence means no current claim. | Planned features can be described as plans, not shipped behavior. |
| Partial stays partial. | A row with a live receipt in one lane cannot be marketed as a blanket production guarantee. |
| Refusals are part of the product. | Watch, blocked, and refused claims stay visible because they explain where the model is honest. |
| Evidence paths must exist. | \`npm run claims:register:verify\` fails if a row points at missing evidence. |

## Claims

| ID | Area | Status | Claim | Evidence | Limit |
| --- | --- | --- | --- | --- | --- |
${rows
  .map(
    (row) =>
      `| \`${row.id}\` | ${row.area} | \`${row.status}\` | ${escapePipes(row.claim)} | ${row.evidence_paths
        .split("; ")
        .map((path) => `[${path}](${relativeLink(path)})`)
        .join("<br>")} | ${escapePipes(row.limit_or_refusal)} |`,
  )
  .join("\n")}

## Regenerate

~~~sh
npm run claims:register
npm run claims:register:verify
~~~
`;
}

function meaning(status) {
  return {
    backed: "Current claim with committed evidence and a scoped verifier.",
    partial: "Useful current evidence, but limited by lane, chart, base, target, or coverage.",
    planned: "Design or roadmap item. Do not market as shipped behavior.",
    refused: "Explicit non-claim used to keep public messaging narrow.",
  }[status];
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key]] = (acc[row[key]] ?? 0) + 1;
    return acc;
  }, {});
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function escapePipes(value) {
  return String(value).replaceAll("|", "\\|");
}

function relativeLink(path) {
  return path.startsWith("data/") ? `../${path.replace("data/", "")}` : `../../${path}`;
}
