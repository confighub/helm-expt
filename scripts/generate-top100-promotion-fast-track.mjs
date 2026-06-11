import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "top100-promotion-wave");
const wavePath = join(outDir, "wave.csv");
const baseOutcomesPath = join(repoRoot, "data", "outcome-coverage", "base-outcomes.csv");
const chartUsePath = join(repoRoot, "data", "chart-use-guide", "chart-use-guide.csv");
const csvPath = join(outDir, "fast-track.csv");
const summaryPath = join(outDir, "fast-track.md");
const reviewDir = join(outDir, "fast-track-reviews");
const reviewIndexPath = join(reviewDir, "README.md");
const reviewCsvPath = join(reviewDir, "review-packets.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  write(reviewIndexPath, report.reviewIndex);
  write(reviewCsvPath, report.reviewCsv);
  for (const packet of report.reviewPackets) write(join(reviewDir, packet.fileName), packet.yaml);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`wrote ${relativeRepo(reviewIndexPath)}`);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "missing top100 fast-track CSV; run npm run top100:promotion-fast-track");
  check(existsSync(summaryPath), "missing top100 fast-track summary; run npm run top100:promotion-fast-track");
  check(existsSync(reviewIndexPath), "missing top100 fast-track review index; run npm run top100:promotion-fast-track");
  check(existsSync(reviewCsvPath), "missing top100 fast-track review packet CSV; run npm run top100:promotion-fast-track");
  check(readFileSync(csvPath, "utf8") === report.csv, "top100 fast-track CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "top100 fast-track summary is stale");
  check(readFileSync(reviewIndexPath, "utf8") === report.reviewIndex, "top100 fast-track review index is stale");
  check(readFileSync(reviewCsvPath, "utf8") === report.reviewCsv, "top100 fast-track review packet CSV is stale");
  for (const packet of report.reviewPackets) {
    const path = join(reviewDir, packet.fileName);
    check(existsSync(path), `missing top100 fast-track review packet ${relativeRepo(path)}`);
    check(readFileSync(path, "utf8") === packet.yaml, `top100 fast-track review packet ${packet.fileName} is stale`);
  }
  console.log(`verified top100 promotion fast-track for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top100-promotion-fast-track.mjs --generate
  node scripts/generate-top100-promotion-fast-track.mjs --verify`);
}

function buildReport() {
  const waveRows = parseCsvFile(wavePath);
  const baseRows = parseCsvFile(baseOutcomesPath);
  const chartUseRows = parseCsvFile(chartUsePath);
  const baseByKey = new Map(baseRows.map((row) => [`${row.chart},${row.base}`, row]));
  const chartUseByRef = new Map(chartUseRows.map((row) => [row.chart_ref, row]));
  const rows = waveRows
    .filter(isFastTrackCandidate)
    .map((row) => fastTrackRow(row, baseByKey, chartUseByRef))
    .sort((left, right) => left.chart_ref.localeCompare(right.chart_ref));

  check(rows.length > 0, "expected at least one fast-track promotion row");
  check(rows.every((row) => row.scan_gate_state === "clean"), "fast-track rows must have clean scan/gate state");
  check(rows.every((row) => row.lifecycle_class === "ordinary-stateful-workload"), "fast-track rows must avoid hook/CRD/webhook lifecycle classes");
  check(rows.every((row) => row.two_cluster_kind_parity === "pass"), "fast-track rows must have two-cluster kind parity");
  const packets = reviewPackets(rows);

  return {
    rows,
    csv: rowsToCsv(rows),
    summary: summary(rows),
    reviewPackets: packets,
    reviewIndex: reviewIndex(rows),
    reviewCsv: reviewPacketsToCsv(packets),
  };
}

function isFastTrackCandidate(row) {
  const features = new Set(splitList(row.source_features));
  return row.strongest_evidence === "two-cluster-kind-parity"
    && Number(row.scan_high) === 0
    && Number(row.scan_medium) === 0
    && splitList(row.gate_decisions).length === 1
    && splitList(row.gate_decisions)[0] === "allow"
    && !features.has("hooks")
    && !features.has("crds")
    && !features.has("webhooks")
    && !features.has("cluster-rbac");
}

function fastTrackRow(row, baseByKey, chartUseByRef) {
  const recommendedBase = firstListItem(row.variants) || "default";
  const base = baseByKey.get(`${row.chart_ref},${recommendedBase}`);
  check(base, `missing base outcome for ${row.chart_ref} ${recommendedBase}`);
  const chartUse = chartUseByRef.get(row.chart_ref);
  const missingLanes = [
    base.in_confighub === "pass" ? "" : "ConfigHub proof lane",
    base.local_live === "pass" ? "" : "local live observation",
    base.gitops_oci_live === "pass" ? "" : "GitOps/OCI live observation",
    base.live_helm_vs_confighub_parity === "pass" ? "" : "live Helm-vs-ConfigHub parity",
  ].filter(Boolean);
  const remaining = [
    "write storage and rollback policy",
    ...missingLanes.map((lane) => `complete ${lane}`),
    "record target-scoped support decision",
  ];
  return {
    chart: row.chart,
    version: row.version,
    chart_ref: row.chart_ref,
    recommended_base: recommendedBase,
    candidate_variants: row.variants,
    scan_gate_state: "clean",
    lifecycle_class: "ordinary-stateful-workload",
    two_cluster_kind_parity: base.two_cluster_kind_parity,
    missing_live_lanes: missingLanes.join(";"),
    remaining_required_work: remaining.join(";"),
    first_action: "write storage/rollback policy, then run selected live and ConfigHub lanes for the recommended base",
    not_a_claim: "not catalog-supported until support decision and selected live lanes exist",
    catalog_path: chartUse?.catalog_path || `${row.recipe_path}/CATALOG.md`,
    parity_receipt: receiptPathFromNotes(base.evidence_notes, "runs/live-kind-parity/"),
    recipe_path: row.recipe_path,
    package_path: row.package_path,
  };
}

function summary(rows) {
  return `# Top-100 Promotion Fast Track

This generated slice identifies the simplest rows in the first top-100
promotion wave. These charts already have two-cluster kind parity, multiple
variants, clean scan/gate state, and no hook/CRD/webhook lifecycle class in the
current source-feature model.

They are not catalog-supported. They are the first rows where the remaining
promotion work is narrow enough to be reviewed quickly.

## Summary

~~~text
fast-track rows: ${rows.length}
required next proof: ConfigHub/live lanes plus storage and rollback policy
~~~

## Rows

| Chart | Recommended base | Why this row is first | Remaining required work |
| --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart_ref}\` | \`${row.recommended_base}\` | clean scan/gate; two-cluster kind parity; no hook/CRD/webhook lifecycle class | ${escapePipes(formatList(row.remaining_required_work))} |`).join("\n")}

## How To Use This

1. Open the per-chart catalog page.
2. Confirm the recommended base is the user-facing base to promote.
3. Write the storage and rollback policy.
4. Run the missing ConfigHub, local live, GitOps/OCI, and live parity lanes for
   the selected base.
5. Record a target-scoped support decision.
6. Only then consider catalog status changes.

## Boundaries

- Fast-track means low promotion residue, not production support.
- Storage behavior still needs operator review.
- The \`ha\` variants remain candidates until they get their own selected live
  evidence.
- If populated extension slots change the object set, create a new reviewed
  base rather than treating the change as a derived variant.

## Files

| File | Use |
| --- | --- |
| [fast-track.csv](./fast-track.csv) | Spreadsheet row per fast-track candidate. |
| [fast-track-reviews/README.md](./fast-track-reviews/README.md) | Review packet index for the fast-track candidates. |
| [fast-track-reviews/review-packets.csv](./fast-track-reviews/review-packets.csv) | Spreadsheet form of the review packet status. |
| [wave.csv](./wave.csv) | Full first promotion wave. |
| [work-orders.md](./work-orders.md) | Full work-order list for the first promotion wave. |
`;
}

function reviewIndex(rows) {
  return `# Fast-Track Promotion Review Packets

These generated packets bind the low-residue promotion candidates to the
evidence and decisions needed before catalog support can be considered.

They are review inputs. They do not promote a chart, accept production risk, or
claim runtime support.

| Chart | Packet | Selected base | Decision state | Missing live lanes |
| --- | --- | --- | --- | --- |
${rows.map((row) => {
  const fileName = `${slug(row.chart)}.yaml`;
  return `| \`${row.chart_ref}\` | [${fileName}](./${fileName}) | \`${row.recommended_base}\` | review-input-only | ${escapePipes(formatList(row.missing_live_lanes))} |`;
}).join("\n")}

## Shared Review Rule

The selected base can move forward only after storage and rollback policy,
ConfigHub proof, local live observation, GitOps/OCI live observation, live
Helm-vs-ConfigHub parity, and a target-scoped support decision all exist for
that exact base.
`;
}

function reviewPackets(rows) {
  return rows.map((row) => {
    const painText = readFileSync(join(repoRoot, row.recipe_path, "helm-pain-report.yaml"), "utf8");
    const hasLifecyclePolicy = /id:\s*"lifecycle-policy"/.test(painText);
    const packet = {
      apiVersion: "helm-expt.confighub.com/v1alpha1",
      kind: "PromotionReviewPacket",
      metadata: {
        name: `${slug(row.chart)}-fast-track-review`,
      },
      spec: {
        chart: row.chart,
        version: row.version,
        selectedBaseCandidate: row.recommended_base,
        candidateVariants: splitList(row.candidate_variants),
        decisionState: "review-input-only",
        catalogSupportClaimAllowed: false,
        whyFastTrack: [
          "two-cluster kind parity passes for the selected base",
          "scan/gate state is clean for the selected base",
          "current feature model has no CRD or webhook lifecycle class for this row",
          "remaining work is a bounded operating review plus live evidence",
        ],
        currentEvidence: {
          catalog: row.catalog_path,
          parityReceipt: row.parity_receipt,
          helmPainReport: `${row.recipe_path}/helm-pain-report.yaml`,
          controlPoints: `${row.recipe_path}/control-points.yaml`,
          scanReceipt: `${row.recipe_path}/revisions/${row.recommended_base}/r001/receipts/scan-receipt.yaml`,
          installGate: `${row.recipe_path}/revisions/${row.recommended_base}/r001/receipts/install-gate.yaml`,
        },
        decisionsNeeded: [
          {
            decision: "storage-and-rollback-policy",
            required: true,
            reason: "The chart has stateful/storage behavior. Render parity does not prove backup, restore, rollback, storage-class fit, or data-retention behavior.",
          },
          {
            decision: "extension-slot-policy",
            required: true,
            reason: "The chart exposes template or extension surfaces. Populated slots that change the object set need a reviewed base, not an untracked derived variant.",
          },
          ...(hasLifecyclePolicy ? [{
            decision: "hook-or-test-lifecycle-boundary",
            required: true,
            reason: "The approved revision uses the no-hooks proof path. Any hook or test behavior must be explicit lifecycle work before support claims.",
          }] : []),
          {
            decision: "target-scoped-support",
            required: true,
            reason: "Catalog support is target-scoped and cannot be inferred from machine proof alone.",
          },
        ],
        missingProofLanes: splitList(row.missing_live_lanes),
        nextActions: splitList(row.remaining_required_work),
        boundaries: [
          "This packet is not a catalog status change.",
          "The HA variant remains a candidate until it has selected evidence of its own.",
          "Production backup, restore, retention, and rollback procedures remain target decisions.",
        ],
      },
    };
    return {
      chart: row.chart,
      version: row.version,
      chart_ref: row.chart_ref,
      fileName: `${slug(row.chart)}.yaml`,
      yaml: `${toYaml(packet)}\n`,
    };
  });
}

function reviewPacketsToCsv(packets) {
  const headers = ["chart", "version", "chart_ref", "packet", "decision_state", "support_claim_allowed"];
  const rows = packets.map((packet) => ({
    chart: packet.chart,
    version: packet.version,
    chart_ref: packet.chart_ref,
    packet: `data/top100-promotion-wave/fast-track-reviews/${packet.fileName}`,
    decision_state: "review-input-only",
    support_claim_allowed: "false",
  }));
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function rowsToCsv(rows) {
  const headers = [
    "chart",
    "version",
    "chart_ref",
    "recommended_base",
    "candidate_variants",
    "scan_gate_state",
    "lifecycle_class",
    "two_cluster_kind_parity",
    "missing_live_lanes",
    "remaining_required_work",
    "first_action",
    "not_a_claim",
    "catalog_path",
    "parity_receipt",
    "recipe_path",
    "package_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const result = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
}

function firstListItem(value) {
  return splitList(value)[0] ?? "";
}

function receiptPathFromNotes(notes, prefix) {
  return String(notes ?? "").split(/\s*\|\s*/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix)) ?? "";
}

function slug(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function formatList(value) {
  return splitList(value).join("<br>");
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}
