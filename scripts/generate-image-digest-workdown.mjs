// Generated image-digest workdown.
//
// This script summarizes rendered image references already found by the attack
// plan generator. It does not resolve registries. Its job is to make the image
// pinning gap reviewable and to keep every mutable/floating image tied to a
// rendered manifest digest.
//
//   node scripts/generate-image-digest-workdown.mjs --generate
//   node scripts/generate-image-digest-workdown.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "image-digest-workdown");
const paths = {
  summary: join(outputRoot, "summary.md"),
  chartSummary: join(outputRoot, "chart-summary.csv"),
  prioritySubjects: join(outputRoot, "priority-subjects.csv"),
  allSubjects: join(outputRoot, "all-subjects.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) write(path, report.outputs[key]);
  console.log(`wrote image digest workdown -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(paths)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run image-digests:workdown`);
    check(readFileSync(path, "utf8") === report.outputs[key], `${relativeRepo(path)} is stale; run npm run image-digests:workdown`);
  }
  console.log(`verified image digest workdown: ${report.subjectRows.length} rendered subject(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-image-digest-workdown.mjs --generate
  node scripts/generate-image-digest-workdown.mjs --verify`);
}

function buildReport() {
  const imageRows = parseCsvFile(join(repoRoot, "data", "attack-plan-workdown", "image-digest-review.csv"));
  const top100Rows = parseCsvFile(join(repoRoot, "data", "top100-catalog-analysis", "review.csv"));
  const top100ByChart = new Map(top100Rows.map((row) => [row.chart, row]));

  const subjects = new Map();
  for (const row of imageRows) {
    const key = `${row.chart}@${row.version}/${row.variant}`;
    if (!subjects.has(key)) {
      subjects.set(key, {
        chart: row.chart,
        version: row.version,
        variant: row.variant,
        catalog_status: top100ByChart.get(row.chart)?.catalog_status ?? "unknown",
        proof_surface: top100ByChart.get(row.chart)?.proof_surface ?? "unknown",
        rendered_path: row.rendered_path,
        rendered_sha256: row.rendered_sha256,
        image_refs: 0,
        digest_pinned_refs: 0,
        mutable_tag_refs: 0,
        floating_latest_or_untagged_refs: 0,
        examples: [],
      });
    }
    const subject = subjects.get(key);
    subject.image_refs += 1;
    if (row.image_status === "digest-pinned") subject.digest_pinned_refs += 1;
    if (row.image_status === "mutable-tag") subject.mutable_tag_refs += 1;
    if (row.image_status === "floating-latest-or-untagged") subject.floating_latest_or_untagged_refs += 1;
    if (subject.examples.length < 3 && row.image_status !== "digest-pinned") subject.examples.push(row.image);
  }

  const subjectRows = [...subjects.values()]
    .map((row) => subjectRow(row))
    .sort(subjectSort);

  const chartRows = summarizeCharts(subjectRows);
  const priorityRows = subjectRows
    .filter((row) => row.needs_resolution === "yes")
    .sort(prioritySort)
    .slice(0, 30)
    .map((row, index) => ({ priority: index + 1, ...row }));

  check(subjectRows.length > 0, "expected rendered subject rows");
  check(priorityRows.length > 0, "expected priority image digest rows");
  check(subjectRows.every((row) => row.needs_resolution === "no" || row.next_action !== "none"), "unpinned image subjects need an action");

  const outputs = {
    summary: summary({ imageRows, subjectRows, chartRows, priorityRows }),
    chartSummary: csv(chartRows),
    prioritySubjects: csv(priorityRows),
    allSubjects: csv(subjectRows),
  };

  return { outputs, subjectRows };
}

function summarizeCharts(subjectRows) {
  const charts = new Map();
  for (const row of subjectRows) {
    if (!charts.has(row.chart)) {
      charts.set(row.chart, {
        chart: row.chart,
        version: row.version,
        catalog_status: row.catalog_status,
        proof_surface: row.proof_surface,
        rendered_subjects: 0,
        subjects_needing_resolution: 0,
        image_refs: 0,
        mutable_tag_refs: 0,
        floating_latest_or_untagged_refs: 0,
        resolution_receipts: 0,
        support_image_policy_decisions: 0,
        next_action: "",
      });
    }
    const chart = charts.get(row.chart);
    chart.rendered_subjects += 1;
    if (row.needs_resolution === "yes") chart.subjects_needing_resolution += 1;
    chart.image_refs += Number(row.image_refs);
    chart.mutable_tag_refs += Number(row.mutable_tag_refs);
    chart.floating_latest_or_untagged_refs += Number(row.floating_latest_or_untagged_refs);
    if (row.resolution_receipt_status === "recorded") chart.resolution_receipts += 1;
    if (row.support_image_policy_decision_status === "recorded") chart.support_image_policy_decisions = 1;
  }
  return [...charts.values()]
    .map((row) => ({
      ...row,
      next_action: chartNextAction(row),
    }))
    .sort((left, right) => {
      if (left.catalog_status !== right.catalog_status) return left.catalog_status === "catalog-supported" ? -1 : 1;
      return right.subjects_needing_resolution - left.subjects_needing_resolution || left.chart.localeCompare(right.chart);
    });
}

function chartNextAction(row) {
  if (row.subjects_needing_resolution === 0) return "none";
  if (row.resolution_receipts > 0 && row.resolution_receipts < row.subjects_needing_resolution) {
    return "finish digest-resolution receipts for remaining affected variants, then choose pinned bases or explicit mutable-image exceptions";
  }
  if (row.resolution_receipts >= row.subjects_needing_resolution) {
    if (Number(row.support_image_policy_decisions) > 0) {
      return "image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes";
    }
    return "choose pinned bases or explicit mutable-image exceptions before production OCI support";
  }
  return "resolve image digests for each affected variant before production OCI support";
}

function summary({ imageRows, subjectRows, chartRows, priorityRows }) {
  const refsNeedingResolution = imageRows.filter((row) => row.image_status !== "digest-pinned").length;
  const subjectsNeedingResolution = subjectRows.filter((row) => row.needs_resolution === "yes").length;
  const subjectsWithReceipts = subjectRows.filter((row) => row.resolution_receipt_status === "recorded").length;
  const subjectsWithPolicyDecisions = subjectRows.filter((row) => row.support_image_policy_decision_status === "recorded").length;
  const catalogSubjects = subjectRows.filter((row) => row.catalog_status === "catalog-supported").length;
  const catalogSubjectsNeedingResolution = subjectRows.filter((row) => row.catalog_status === "catalog-supported" && row.needs_resolution === "yes").length;
  return `# Image Digest Workdown

This generated workdown summarizes rendered image references from
\`data/attack-plan-workdown/image-digest-review.csv\`. It is a review queue for
image pinning, not a registry-resolution receipt.

## Current Reading

\`\`\`text
rendered image references:             ${imageRows.length}
rendered subjects:                     ${subjectRows.length}
image references needing resolution:   ${refsNeedingResolution}
rendered subjects needing resolution:  ${subjectsNeedingResolution}
resolution receipts recorded:          ${subjectsWithReceipts}
support policy decisions recorded:     ${subjectsWithPolicyDecisions}
catalog-supported subjects:            ${catalogSubjects}
catalog-supported needing resolution:  ${catalogSubjectsNeedingResolution}
charts with rendered image references: ${chartRows.length}
priority subjects listed:              ${priorityRows.length}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`priority-subjects.csv\` | First image-digest rows to work, with catalog-supported charts first. |
| \`chart-summary.csv\` | One row per chart with rendered image counts and image-resolution state. |
| \`all-subjects.csv\` | One row per chart/version/variant rendered subject. |

## Rule

A production OCI claim needs image digest evidence. Mutable tags and \`:latest\`
may be acceptable for local proof, but production support needs either pinned
image references or an explicit image override/proof receipt.
`;
}

function subjectRow(row) {
  const receipt = imageDigestReceipt(row);
  const policyDecision = imagePolicyDecision(row);
  const hasUnpinnedRefs = row.mutable_tag_refs + row.floating_latest_or_untagged_refs > 0;
  return {
    chart: row.chart,
    version: row.version,
    variant: row.variant,
    catalog_status: row.catalog_status,
    proof_surface: row.proof_surface,
    image_refs: row.image_refs,
    digest_pinned_refs: row.digest_pinned_refs,
    mutable_tag_refs: row.mutable_tag_refs,
    floating_latest_or_untagged_refs: row.floating_latest_or_untagged_refs,
    needs_resolution: hasUnpinnedRefs ? "yes" : "no",
    resolution_receipt_status: receipt.status,
    resolution_receipt_path: receipt.path,
    support_image_policy_decision_status: policyDecision.status,
    support_image_policy_decision_state: policyDecision.decision,
    support_image_policy_decision_path: policyDecision.path,
    example_unpinned_images: row.examples.join(";"),
    rendered_sha256: row.rendered_sha256,
    rendered_path: row.rendered_path,
    next_action: nextAction({ hasUnpinnedRefs, receipt, policyDecision }),
  };
}

function nextAction({ hasUnpinnedRefs, receipt, policyDecision }) {
  if (!hasUnpinnedRefs) return "none";
  if (policyDecision.status === "recorded") {
    return "covered by target-scoped image policy decision; create digest-pinned base or override for stricter scopes";
  }
  if (receipt.status === "recorded") {
    return "use the digest-resolution receipt to choose a digest-pinned base or explicit mutable-image exception before production OCI support";
  }
  return "resolve image digests and record image override/proof receipt before production OCI support";
}

function imageDigestReceipt(row) {
  const relativePath = [
    "data",
    "image-digest-workdown",
    "receipts",
    slug(row.chart),
    row.variant,
    "image-digest-resolution.yaml",
  ].join("/");
  const path = join(repoRoot, relativePath);
  if (!existsSync(path)) return { status: "missing", path: "" };
  const receipt = readYaml(path);
  const spec = receipt.spec ?? {};
  check(receipt.kind === "ImageDigestResolutionReceipt", `${relativePath} must be kind ImageDigestResolutionReceipt`);
  check(spec.chart === row.chart, `${relativePath} chart mismatch`);
  check(spec.version === row.version, `${relativePath} version mismatch`);
  check(spec.variant === row.variant, `${relativePath} variant mismatch`);
  check(spec.renderedObjectSet?.sha256 === row.rendered_sha256, `${relativePath} rendered sha mismatch`);
  return { status: "recorded", path: relativePath };
}

function imagePolicyDecision(row) {
  const relativePath = [
    "data",
    "production-support-decisions",
    slug(row.chart),
    "image-policy-decision.yaml",
  ].join("/");
  const path = join(repoRoot, relativePath);
  if (!existsSync(path)) return { status: "missing", decision: "", path: "" };
  const decision = readYaml(path);
  const spec = decision.spec ?? {};
  check(decision.kind === "ProductionImagePolicyDecision", `${relativePath} must be kind ProductionImagePolicyDecision`);
  check(spec.chart === row.chart, `${relativePath} chart mismatch`);
  check(spec.version === row.version, `${relativePath} version mismatch`);
  check((spec.variantsCovered ?? []).includes(row.variant), `${relativePath} does not cover variant ${row.variant}`);
  check((spec.limits ?? []).some((item) => item.includes("does not mean the rendered manifests are digest-pinned")), `${relativePath} must state digest-pinning limit`);
  return { status: "recorded", decision: spec.decision ?? "", path: relativePath };
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function subjectSort(left, right) {
  if (left.catalog_status !== right.catalog_status) return left.catalog_status === "catalog-supported" ? -1 : 1;
  return left.chart.localeCompare(right.chart) || left.variant.localeCompare(right.variant);
}

function prioritySort(left, right) {
  if (left.catalog_status !== right.catalog_status) return left.catalog_status === "catalog-supported" ? -1 : 1;
  return Number(right.floating_latest_or_untagged_refs) - Number(left.floating_latest_or_untagged_refs)
    || Number(right.mutable_tag_refs) - Number(left.mutable_tag_refs)
    || left.chart.localeCompare(right.chart)
    || left.variant.localeCompare(right.variant);
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
