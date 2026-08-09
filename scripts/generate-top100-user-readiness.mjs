// Generate the top-100 user-readiness view: a Helm-user-language projection of
// the curated top-100 readiness, chart facts, and top-20 base readiness data.
//
// It answers, per chart: can I try this today, what must I provide, what does
// ConfigHub/installer absorb, and what is the next concrete action. It invents
// no new judgments: every bucket is a deterministic mapping from curated
// fields, documented in docs/reference/top100-user-readiness.md.
//
// Usage:
//   npm run top100:user-readiness          # generate
//   npm run top100:user-readiness:verify   # check current

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CORPUS_FLOOR = 100;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = {
  top100: "data/top100-readiness/readiness.csv",
  chartFacts: "data/chart-facts/chart-facts.csv",
  baseReadiness: "data/top20-base-readiness/base-readiness.csv",
  baseOutcomes: "data/outcome-coverage/base-outcomes.csv",
};

const OUTPUTS = {
  csv: "data/top100-user-readiness/readiness.csv",
  summary: "data/top100-user-readiness/summary.md",
};

const BUCKETS = [
  "ready-to-try",
  "works-with-target-prerequisites",
  "works-with-operator-review",
  "needs-better-base-variant",
  "not-ready-yet",
];

const BUCKET_MEANING = {
  "ready-to-try":
    "Catalog-supported with live evidence; the recommended first base passes its lanes. Pull it and inspect the exact objects.",
  "works-with-target-prerequisites":
    "Proof-grade and review-queued; the named gap is something your cluster or team must provide (existing Secret, storage, CRD ownership).",
  "works-with-operator-review":
    "Proof-grade; render parity holds, but an operator should review the catalog shape (hooks, lifecycle, HA teaching, variant naming) before relying on it.",
  "needs-better-base-variant":
    "The mechanism is proven, but the install shapes a real user wants are not built or reviewed yet.",
  "not-ready-yet":
    "A named limitation or target compatibility issue needs a support / disclose / defer / refuse decision before this chart can be promoted.",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  return rows
    .filter((cells) => cells.length > 1 || (cells[0] ?? "").trim() !== "")
    .map((cells) => Object.fromEntries(header.map((name, idx) => [name, cells[idx] ?? ""])));
}

function readCsv(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(header, rows) {
  return [header.join(","), ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(","))].join("\n") + "\n";
}

const flagged = (value) => {
  const text = (value ?? "").trim();
  return text !== "" && text !== "—" && text !== "-" && !text.toLowerCase().startsWith("n/a");
};

function splitChartVersion(chartField) {
  const at = chartField.lastIndexOf("@");
  if (at === -1) return { chart: chartField, version: "" };
  return { chart: chartField.slice(0, at), version: chartField.slice(at + 1) };
}

function quirkTokens(facts, sourceFeatures) {
  const tokens = [];
  if (facts) {
    if (flagged(facts.post_deploy_hooks) || flagged(facts.other_hooks) || flagged(facts.hook_status)) tokens.push("hooks");
    if (flagged(facts.crds)) tokens.push("crds");
    if (flagged(facts.generates_secrets)) tokens.push("generated-secrets");
    if (flagged(facts.existing_secret)) tokens.push("existing-secret");
    if (flagged(facts.webhooks)) tokens.push("webhooks");
    if (flagged(facts.extension_slots)) tokens.push("extension-slots");
    if (flagged(facts.install_vs_upgrade)) tokens.push("install-vs-upgrade-divergence");
    if (flagged(facts.required_values)) tokens.push("required-values");
  }
  for (const raw of (sourceFeatures ?? "").split(";")) {
    const token = raw.trim();
    if (!token) continue;
    const mapped =
      token === "stateful-storage" ? "storage" : token === "cluster-rbac" ? "rbac" : token === "generated-facts" ? "generated-facts" : token;
    if (!tokens.includes(mapped)) tokens.push(mapped);
  }
  return tokens;
}

const PREREQ_PATTERN = /existing-secret|existing secret|storageclass|storage class|crd owner|pull secret|ingressclass/i;

function classify(row, facts) {
  if (row.catalog_tier === "top20-catalog-supported") return "ready-to-try";
  if (row.workability === "decision-needed-before-promotion") return "not-ready-yet";
  if (row.workability === "not-yet-a-good-catalog-offer") return "needs-better-base-variant";
  if (row.workability === "works-as-proof-needs-catalog-review") {
    const gapText = `${row.hard_gap ?? ""} ${facts?.existing_secret ?? ""} ${facts?.buildable_not_yet_run ?? ""}`;
    return PREREQ_PATTERN.test(gapText) ? "works-with-target-prerequisites" : "works-with-operator-review";
  }
  if (row.workability === "try-now-public-catalog") return "ready-to-try";
  return "works-with-operator-review";
}

function userMustProvide(bucket, row, facts, tokens) {
  const needs = [];
  if (flagged(facts?.existing_secret)) needs.push(`an existing Secret for some bases (${facts.existing_secret.trim()})`);
  if (tokens.includes("storage")) needs.push("a StorageClass / storage decision");
  if (tokens.includes("crds")) needs.push("a CRD ownership choice (crds vs no-crds base)");
  if (tokens.includes("webhooks")) needs.push("webhook/cert readiness at delivery time");
  if (tokens.includes("lookup") || tokens.includes("generated-facts")) needs.push("target facts at variant time");
  if (flagged(facts?.required_values)) needs.push("mandatory chart inputs");
  if (bucket === "not-ready-yet" && row.proof_focus === "api-service-target-compatibility") {
    needs.push("a compatible Kubernetes target profile or a compatibility base");
  } else if (bucket === "not-ready-yet") {
    needs.push("a decision on the named limitation before use");
  }
  if (bucket === "needs-better-base-variant") needs.push("your wanted install shape, until a reviewed base exists");
  return needs.length ? needs.join("; ") : "nothing beyond a cluster and namespace";
}

function confighubAbsorbs(facts, tokens) {
  const absorbs = ["exact rendered objects with render parity and receipts"];
  if (tokens.includes("generated-secrets")) absorbs.push("generated Secrets separated out of the published artifact");
  if (tokens.includes("crds")) absorbs.push("CRD handling split into explicit bases");
  if (tokens.includes("hooks")) absorbs.push("hooks classified and routed (not silently executed)");
  if (tokens.includes("extension-slots")) absorbs.push("extension slots routed to reviewed bases");
  if (tokens.includes("install-vs-upgrade-divergence")) absorbs.push("install-vs-upgrade render divergence captured per revision");
  if (tokens.includes("lookup") || tokens.includes("generated-facts")) absorbs.push("cluster lookups lifted into declared target facts");
  return absorbs.join("; ");
}

function proofStatus(row) {
  const lanes = [];
  if (row.render_parity) lanes.push(`render parity ${row.render_parity}`);
  if (row.local_live && row.local_live !== "0/0") lanes.push(`local live ${row.local_live}`);
  if (row.live_parity && row.live_parity !== "0/0") lanes.push(`live parity ${row.live_parity}`);
  return `${row.user_status}${lanes.length ? ` (${lanes.join(", ")})` : ""}`;
}

function evidenceScore(row) {
  let score = 0;
  if (row.complete_core_lane_set === "yes") score += 100;
  if (row.live_helm_vs_confighub_parity === "pass") score += 50;
  if (row.gitops_oci_live === "pass") score += 40;
  if (row.two_cluster_kind_parity === "pass") score += 35;
  if (row.in_confighub === "pass") score += 25;
  if (row.local_live === "pass") score += 20;
  if (row.render_parity === "pass") score += 5;
  if ((row.base ?? "") === "default") score += 1;
  return score;
}

function strongestEvidenceBase() {
  const strongest = new Map();
  for (const row of readCsv(SOURCES.baseOutcomes)) {
    const candidate = { base: row.base, score: evidenceScore(row) };
    const current = strongest.get(row.chart);
    if (!current || candidate.score > current.score) {
      strongest.set(row.chart, candidate);
    }
  }
  return new Map([...strongest].map(([chartVersion, value]) => [chartVersion, value.base]));
}

function buildReport() {
  const top100 = readCsv(SOURCES.top100);
  const facts = new Map(readCsv(SOURCES.chartFacts).map((row) => [row.chart, row]));
  const evidenceBase = strongestEvidenceBase();
  const recommendedBase = new Map();
  for (const row of readCsv(SOURCES.baseReadiness)) {
    if (row.recommended_first === "yes") recommendedBase.set(splitChartVersion(row.chart).chart, row.base);
  }

  const rows = top100.map((row) => {
    const { chart, version } = splitChartVersion(row.chart);
    const chartFacts = facts.get(chart);
    const tokens = quirkTokens(chartFacts, row.source_features);
    const bucket = classify(row, chartFacts);
    const firstBase = recommendedBase.get(chart) ?? evidenceBase.get(row.chart) ?? (row.variants ? row.variants.split(";")[0] : "");
    return {
      rank: row.proof_surface_rank,
      chart,
      version,
      bucket,
      current_proof: proofStatus(row),
      recommended_first_base: bucket === "ready-to-try" ? firstBase : firstBase ? `${firstBase} (unreviewed first guess)` : "",
      quirks: tokens.join(";") || "none-flagged",
      user_must_provide: userMustProvide(bucket, row, chartFacts, tokens),
      confighub_absorbs: confighubAbsorbs(chartFacts, tokens),
      next_action: row.next_action,
      pain_report: row.helm_pain_report ?? "",
    };
  });

  rows.sort((a, b) => Number(a.rank) - Number(b.rank));

  const header = [
    "rank",
    "chart",
    "version",
    "bucket",
    "current_proof",
    "recommended_first_base",
    "quirks",
    "user_must_provide",
    "confighub_absorbs",
    "next_action",
    "pain_report",
  ];
  return { rows, csv: toCsv(header, rows), summary: summaryMarkdown(rows) };
}

function summaryMarkdown(rows) {
  const counts = Object.fromEntries(BUCKETS.map((bucket) => [bucket, rows.filter((row) => row.bucket === bucket).length]));
  const lines = [];
  lines.push("# Top-100 User Readiness");
  lines.push("");
  lines.push("Generated. Do not edit by hand.");
  lines.push("");
  lines.push("```sh");
  lines.push("npm run top100:user-readiness          # regenerate");
  lines.push("npm run top100:user-readiness:verify   # check");
  lines.push("```");
  lines.push("");
  lines.push(
    "One row per top-100 chart, in Helm-user language: can I try it, what must I provide, what does ConfigHub/installer absorb, and what happens next. Buckets are deterministic projections of curated repo data; the mapping rules and limits are in [the reference doc](../../docs/reference/top100-user-readiness.md). Full detail per chart is in [readiness.csv](./readiness.csv).");
  lines.push("");
  lines.push("| Bucket | Charts | Meaning |");
  lines.push("| --- | --- | --- |");
  for (const bucket of BUCKETS) {
    lines.push(`| ${bucket} | ${counts[bucket]} | ${BUCKET_MEANING[bucket]} |`);
  }
  for (const bucket of BUCKETS) {
    const bucketRows = rows.filter((row) => row.bucket === bucket);
    if (!bucketRows.length) continue;
    lines.push("");
    lines.push(`## ${bucket} (${bucketRows.length})`);
    lines.push("");
    lines.push("| Chart | First base | You provide | Next action |");
    lines.push("| --- | --- | --- | --- |");
    for (const row of bucketRows) {
      lines.push(
        `| ${row.chart}@${row.version} | ${row.recommended_first_base || "-"} | ${row.user_must_provide} | ${row.next_action || "-"} |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

function generate() {
  const report = buildReport();
  mkdirSync(join(repoRoot, "data/top100-user-readiness"), { recursive: true });
  writeFileSync(join(repoRoot, OUTPUTS.csv), report.csv);
  writeFileSync(join(repoRoot, OUTPUTS.summary), report.summary);
  console.log(`wrote ${OUTPUTS.csv} (${report.rows.length} rows) and ${OUTPUTS.summary}`);
}

function verify() {
  const report = buildReport();
  const problems = [];
  for (const [key, path] of Object.entries(OUTPUTS)) {
    const absolute = join(repoRoot, path);
    if (!existsSync(absolute)) {
      problems.push(`${path} is missing; run npm run top100:user-readiness`);
      continue;
    }
    const expected = key === "csv" ? report.csv : report.summary;
    if (readFileSync(absolute, "utf8") !== expected) {
      problems.push(`${path} is stale; run npm run top100:user-readiness`);
    }
  }
  // One row per chart in the proof-surface corpus, which grows. A floor catches
  // a chart dropping out; a fixed size only froze the catalog.
  if (report.rows.length < CORPUS_FLOOR) {
    problems.push(`readiness fell to ${report.rows.length} charts, below the ${CORPUS_FLOOR} already covered`);
  }
  const unbucketed = report.rows.filter((row) => !BUCKETS.includes(row.bucket));
  if (unbucketed.length) problems.push(`rows without a known bucket: ${unbucketed.map((row) => row.chart).join(", ")}`);
  if (problems.length) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log(`verified top-100 user readiness (${report.rows.length} charts)`);
}

const mode = process.argv[2] ?? "--generate";
if (mode === "--generate") generate();
else if (mode === "--verify") verify();
else {
  console.error(`unknown mode ${mode}; use --generate or --verify`);
  process.exit(1);
}
