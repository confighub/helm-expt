import fs from "node:fs/promises";
import { join } from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const inputPath = "/Users/alexis/code/helm-expt/outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx";
const outputDir = "/Users/alexis/code/helm-expt/outputs/helm_top500_matrix";
const outputPath = join(outputDir, "helm_top500_import_feature_matrix.xlsx");
const sourceURL =
  "https://artifacthub.io/api/v1/packages/search?kind=0&sort=stars&limit=60&offset=0..480&deprecated=false";

const yn = (v) => (v ? "Y" : "");
const toNum = (v) => (typeof v === "number" ? v : Number(v) || 0);
function colName(n) {
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
function addValues(sheet, startCell, values) {
  const rows = values.length;
  const cols = values[0]?.length ?? 0;
  const startCol = startCell.match(/[A-Z]+/)[0];
  const startRow = Number(startCell.match(/\d+/)[0]);
  const startColNum = startCol.split("").reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0);
  const end = `${colName(startColNum + cols - 1)}${startRow + rows - 1}`;
  sheet.getRange(`${startCell}:${end}`).values = values;
  return `${startCell}:${end}`;
}
function styleHeader(range, fill = "#123047") {
  range.format = {
    fill,
    font: { color: "#FFFFFF", bold: true, size: 10 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#C7D2D6" },
  };
}
function styleBody(range) {
  range.format = {
    font: { size: 10, color: "#1F2933" },
    verticalAlignment: "top",
    borders: { preset: "outside", style: "thin", color: "#E5E7EB" },
  };
}

const input = await FileBlob.load(inputPath);
const sourceWorkbook = await SpreadsheetFile.importXlsx(input);
const matrixInspect = await sourceWorkbook.inspect({
  kind: "table",
  range: "Feature Matrix!A1:BK501",
  include: "values",
  tableMaxRows: 501,
  tableMaxCols: 63,
});
const parsed = JSON.parse(matrixInspect.ndjson.split("\n")[0]);
let [headers, ...rows] = parsed.values;
const lastHeader = headers.findLastIndex((h) => h !== null && h !== "");
headers = headers.slice(0, lastHeader + 1);
rows = rows.map((r) => r.slice(0, headers.length)).filter((r) => r[0] !== null && r[0] !== "");

const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
const notesIdx = idx["P0 notes / error"];
const archiveUnavailableIdx = idx["P0: archive unavailable/malformed"];
const scanStatusIdx = idx["Scan status"];
const classificationIdx = idx["Classification"];
const scoreIdx = idx["Problem score"];
const preRiskIdx = idx["Pre-recipe risk count"];

const newHeader = [...headers];
const rateColIndex = archiveUnavailableIdx + 1;
newHeader.splice(rateColIndex, 0, "P0: registry rate-limited during scan");

const newRows = rows.map((row) => {
  const out = [...row];
  const notes = String(row[notesIdx] ?? "");
  const rateLimited = /toomanyrequests|rate limit/i.test(notes);
  if (rateLimited) {
    out[scanStatusIdx] = "registry rate-limited";
    out[classificationIdx] = "P0 source throttled during scan";
    out[archiveUnavailableIdx] = "";
    out[scoreIdx] = 100;
    out[preRiskIdx] = 1;
  }
  out.splice(rateColIndex, 0, yn(rateLimited));
  return out;
});

const nidx = Object.fromEntries(newHeader.map((h, i) => [h, i]));
const count = (pred) => newRows.filter(pred).length;
const val = (row, name) => row[nidx[name]];
const numVal = (row, name) => toNum(val(row, name));
const classificationCount = (name) => count((r) => val(r, "Classification") === name);
const summary = {
  requested: newRows.length,
  scanned: count((r) => val(r, "Scan status") === "scanned"),
  unavailable: count(
    (r) => val(r, "Scan status") !== "scanned" && val(r, "P0: registry rate-limited during scan") !== "Y",
  ),
  rateLimited: count((r) => val(r, "P0: registry rate-limited during scan") === "Y"),
  p0SourceRisk: classificationCount("P0 source/dependency risk"),
  p1: classificationCount("P1 compiler policy needed"),
  p2: classificationCount("P2 recipe/render/install policy"),
  p3: classificationCount("P3 plain/static-ish"),
  hooks: count((r) => numVal(r, "Lifecycle: hooks") > 0),
  lookup: count((r) => numVal(r, "Early: lookup") > 0),
  generated: count((r) => numVal(r, "Generated facts: total candidates") > 0),
  requiredFail: count((r) => numVal(r, "Early: required/fail") > 0),
  tpl: count((r) => numVal(r, "Late/literal: tpl") > 0),
  capabilities: count(
    (r) => numVal(r, "Early: Capabilities.APIVersions") > 0 || numVal(r, "Early: Capabilities.KubeVersion") > 0,
  ),
  crds: count((r) => numVal(r, "Operate: CRD files") > 0 || numVal(r, "Operate: CRD manifests") > 0),
  webhooks: count((r) => numVal(r, "Operate: ValidatingWebhook") > 0 || numVal(r, "Operate: MutatingWebhook") > 0),
  clusterRBAC: count((r) => numVal(r, "Operate: ClusterRole") > 0 || numVal(r, "Operate: ClusterRoleBinding") > 0),
  depUpdateLikely: count((r) => val(r, "P0: dependency update likely needed") === "Y"),
  nonExactDeps: count((r) => numVal(r, "P0: non-exact dep constraints") > 0),
  httpRepo: count((r) => val(r, "P0: HTTP chart repo URL") === "Y"),
};

const workbook = Workbook.create();
const summarySheet = workbook.worksheets.add("Summary");
const matrixSheet = workbook.worksheets.add("Feature Matrix");
const defsSheet = workbook.worksheets.add("Definitions");
const failuresSheet = workbook.worksheets.add("Failures");

summarySheet.getRange("A1:H1").merge();
summarySheet.getRange("A1").values = [["Helm Top 500 Import Feature Matrix"]];
summarySheet.getRange("A1:H1").format = {
  fill: "#123047",
  font: { color: "#FFFFFF", bold: true, size: 16 },
  horizontalAlignment: "center",
};
summarySheet.getRange("A2:H2").merge();
summarySheet.getRange("A2").values = [[
  `Generated from Artifact Hub Helm packages sorted by stars. Static source scan; no hooks or templates were executed. Reclassified Docker Hub 429s separately from stale/malformed archives.`,
]];
summarySheet.getRange("A2:H2").format = { fill: "#EFF6F7", font: { italic: true, color: "#334155" }, wrapText: true };

const kpi1 = [
  ["Requested", "Scanned", "Unavailable/malformed", "Registry rate-limited"],
  [summary.requested, summary.scanned, summary.unavailable, summary.rateLimited],
];
const kpi2 = [
  ["P0 source/dependency risk", "P1 compiler policy", "P2 recipe policy", "P3 plain/static"],
  [summary.p0SourceRisk, summary.p1, summary.p2, summary.p3],
];
addValues(summarySheet, "A4", kpi1);
addValues(summarySheet, "A7", kpi2);
styleHeader(summarySheet.getRange("A4:D4"));
styleHeader(summarySheet.getRange("A7:D7"));
summarySheet.getRange("A5:D5").format = { fill: "#F8FAFC", font: { bold: true, size: 14 }, horizontalAlignment: "center" };
summarySheet.getRange("A8:D8").format = { fill: "#F8FAFC", font: { bold: true, size: 14 }, horizontalAlignment: "center" };

const featureCounts = [
  ["P0 unavailable/malformed", summary.unavailable, "Archive cannot be fetched or unpacked."],
  ["P0 registry rate-limited", summary.rateLimited, "Docker Hub/OCI registry throttled archive retrieval during this scan."],
  ["P0 source/dependency risk", summary.p0SourceRisk, "HTTP repo, likely dependency update, or non-exact dependency constraints."],
  ["Hooks", summary.hooks, "Lifecycle/procedural behavior; map to phases/tests/unsupported policy."],
  ["lookup", summary.lookup, "Cluster-state dependent render; map to collector/facts/reuse policy."],
  ["Generated fact candidates", summary.generated, "Random strings, certs, hashes, time/uuid; map to generated facts."],
  ["required/fail", summary.requiredFail, "Map to recipe input validation and constraints."],
  ["Capabilities checks", summary.capabilities, "Map to named capability profiles."],
  ["tpl", summary.tpl, "Template-evaluated values; bound or reject as late/literal escape hatch."],
  ["CRDs", summary.crds, "Install/operate ordering and ownership."],
  ["Cluster RBAC", summary.clusterRBAC, "Cluster-scope permission footprint."],
  ["Webhooks", summary.webhooks, "Admission/control-plane operational footprint."],
  ["Dependency update likely", summary.depUpdateLikely, "Source acquisition risk if chart lacks vendored/locked dependencies."],
];
addValues(summarySheet, "A11", [["Feature / risk", "Charts", "Interpretation"], ...featureCounts]);
styleHeader(summarySheet.getRange("A11:C11"), "#2F5D62");
styleBody(summarySheet.getRange(`A12:C${11 + featureCounts.length}`));

const classData = [
  ["P0 unavailable/malformed", summary.unavailable],
  ["P0 source throttled during scan", summary.rateLimited],
  ["P0 source/dependency risk", summary.p0SourceRisk],
  ["P1 compiler policy needed", summary.p1],
  ["P2 recipe/render/install policy", summary.p2],
  ["P3 plain/static-ish", summary.p3],
];
addValues(summarySheet, "E11", [["Class", "Charts"], ...classData]);
styleHeader(summarySheet.getRange("E11:F11"), "#2F5D62");
styleBody(summarySheet.getRange(`E12:F${11 + classData.length}`));
summarySheet.charts.add("bar", {
  title: "Charts by Import Class",
  categories: classData.map((r) => r[0]),
  series: [{ name: "Charts", values: classData.map((r) => r[1]) }],
  hasLegend: false,
  barOptions: { direction: "bar", grouping: "clustered", gapWidth: 80 },
  dataLabels: { showValue: true, position: "outEnd", textStyle: { fontSize: 9 } },
  from: { row: 18, col: 4 },
  extent: { widthPx: 620, heightPx: 310 },
});
addValues(summarySheet, "A28", [["Source"], [sourceURL], ["Caveat"], ["Rows marked registry rate-limited are source-acquisition observations from this scan, not evidence of inherent chart-template nondeterminism."]]);
summarySheet.getRange("A28:A31").format.font = { bold: true };
summarySheet.getRange("A1:H32").format.autofitRows();
summarySheet.getRange("A1:H32").format.autofitColumns();

const matrixRange = addValues(matrixSheet, "A1", [newHeader, ...newRows]);
styleHeader(matrixSheet.getRange(`A1:${colName(newHeader.length)}1`));
styleBody(matrixSheet.getRange(`A2:${colName(newHeader.length)}${newRows.length + 1}`));
matrixSheet.freezePanes.freezeRows(1);
matrixSheet.freezePanes.freezeColumns(2);
matrixSheet.getRange("A:A").format.columnWidthPx = 48;
matrixSheet.getRange("B:B").format.columnWidthPx = 250;
matrixSheet.getRange(`A1:${colName(newHeader.length)}${newRows.length + 1}`).format.wrapText = true;
matrixSheet.getRange(`I2:I${newRows.length + 1}`).conditionalFormats.add("containsText", {
  text: "P0",
  format: { fill: "#FECACA", font: { color: "#7F1D1D", bold: true } },
});
matrixSheet.getRange(`I2:I${newRows.length + 1}`).conditionalFormats.add("containsText", {
  text: "P1",
  format: { fill: "#FED7AA", font: { color: "#7C2D12", bold: true } },
});
matrixSheet.getRange(`I2:I${newRows.length + 1}`).conditionalFormats.add("containsText", {
  text: "P2",
  format: { fill: "#FEF3C7", font: { color: "#78350F", bold: true } },
});
matrixSheet.getRange(`I2:I${newRows.length + 1}`).conditionalFormats.add("containsText", {
  text: "P3",
  format: { fill: "#DCFCE7", font: { color: "#14532D", bold: true } },
});

const defs = [
  ["Group", "Feature", "Meaning", "Install-config-operate interpretation"],
  ["P0 pre-recipe", "Unavailable/malformed", "Archive fetch/unpack failed.", "True source/import blocker until mirrored or repaired."],
  ["P0 pre-recipe", "Registry rate-limited", "OCI registry throttled this scan.", "Real source acquisition risk; not inherent chart-template behavior."],
  ["P0 pre-recipe", "Dependency update likely / non-exact deps", "Import may depend on dependency resolution.", "Require lock/digest or fail before recipe creation."],
  ["P1 compiler", "Hooks / lookup / generated facts", "Procedural, cluster-state, or random behavior in templates.", "Deterministic importer needs explicit compiler policies."],
  ["P2 recipe/render", "required/fail / capabilities / tpl", "Checks and branches can be represented in the recipe.", "Evaluate after recipe creation against inputs/facts/capability profiles."],
  ["Operate", "CRDs / cluster RBAC / webhooks", "Cluster-scope install/operate footprint.", "Needs phase ordering, ownership, conflict, and uninstall policy."],
];
addValues(defsSheet, "A1", defs);
styleHeader(defsSheet.getRange("A1:D1"));
styleBody(defsSheet.getRange(`A2:D${defs.length}`));
defsSheet.freezePanes.freezeRows(1);
defsSheet.getRange("A:A").format.columnWidthPx = 150;
defsSheet.getRange("B:B").format.columnWidthPx = 220;
defsSheet.getRange("C:D").format.columnWidthPx = 430;
defsSheet.getRange(`A1:D${defs.length}`).format.wrapText = true;

const failureRows = newRows
  .filter((r) => valFromRow(r, "Scan status") !== "scanned")
  .map((r) => [
    valFromRow(r, "Rank"),
    valFromRow(r, "Chart"),
    valFromRow(r, "Version"),
    valFromRow(r, "Stars"),
    valFromRow(r, "Scan status"),
    valFromRow(r, "Repo URL"),
    valFromRow(r, "P0 notes / error"),
  ]);
function valFromRow(row, name) {
  return row[nidx[name]];
}
addValues(failuresSheet, "A1", [["Rank", "Chart", "Version", "Stars", "Scan status", "Repo URL", "Error"], ...failureRows]);
styleHeader(failuresSheet.getRange("A1:G1"));
if (failureRows.length) styleBody(failuresSheet.getRange(`A2:G${failureRows.length + 1}`));
failuresSheet.freezePanes.freezeRows(1);
failuresSheet.getRange("A:A").format.columnWidthPx = 55;
failuresSheet.getRange("B:B").format.columnWidthPx = 250;
failuresSheet.getRange("E:E").format.columnWidthPx = 160;
failuresSheet.getRange("F:G").format.columnWidthPx = 420;
failuresSheet.getRange(`A1:G${Math.max(2, failureRows.length + 1)}`).format.wrapText = true;

const check = await workbook.inspect({
  kind: "table",
  range: "Summary!A1:H18",
  include: "values,formulas",
  tableMaxRows: 18,
  tableMaxCols: 8,
});
console.log(check.ndjson.split("\n").slice(0, 10).join("\n"));
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
});
console.log(errors.ndjson);
await workbook.render({ sheetName: "Summary", range: "A1:H32", scale: 1 });
await workbook.render({ sheetName: "Feature Matrix", range: "A1:K25", scale: 1 });
await workbook.render({ sheetName: "Definitions", range: "A1:D8", scale: 1 });
await workbook.render({ sheetName: "Failures", range: "A1:G20", scale: 1 });
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`saved ${outputPath}`);
