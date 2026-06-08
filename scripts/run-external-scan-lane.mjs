import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "external-scan-lane");
const resultsPath = join(outputRoot, "kube-linter-results.json");
const reviewCsvPath = join(outputRoot, "review.csv");
const chartWorkdownCsvPath = join(outputRoot, "chart-workdown.csv");
const summaryPath = join(outputRoot, "summary.md");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(resultsPath)}`);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(chartWorkdownCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(resultsPath), "missing external scan results; run npm run external-scan");
  check(existsSync(reviewCsvPath), "missing external scan review; run npm run external-scan");
  check(existsSync(chartWorkdownCsvPath), "missing external scan chart workdown; run npm run external-scan");
  check(existsSync(summaryPath), "missing external scan summary; run npm run external-scan");
  check(readFileSync(resultsPath, "utf8") === report.resultsJson, "external scan results are stale");
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "external scan review CSV is stale");
  check(readFileSync(chartWorkdownCsvPath, "utf8") === report.chartWorkdownCsv, "external scan chart workdown CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "external scan summary is stale");
  console.log("verified external scan lane outputs");
} else {
  console.log(`Usage:
  node scripts/run-external-scan-lane.mjs --generate
  node scripts/run-external-scan-lane.mjs --verify`);
}

function buildReport() {
  const tools = {
    kubeLinter: toolVersion("kube-linter", ["version"]),
    trivy: toolVersion("trivy", ["--version"]),
    kubeconform: toolVersion("kubeconform", ["-v"]),
  };
  check(tools.kubeLinter.available, "external scan lane currently requires kube-linter");
  const subjects = supportedVariantSubjects();
  check(subjects.length === 40, `expected 40 supported top-20 variant subjects, found ${subjects.length}`);
  const rows = subjects.map((subject) => scanSubject(subject, tools.kubeLinter.version));
  const summary = {
    subjects: rows.length,
    charts: new Set(rows.map((row) => row.chart)).size,
    pass: rows.filter((row) => row.result === "pass").length,
    warn: rows.filter((row) => row.result === "warn").length,
    fail: rows.filter((row) => row.result === "fail").length,
    totalFindings: sum(rows.map((row) => row.findingCount)),
    toolStatus: tools,
  };
  return {
    rows,
    summary,
    resultsJson: `${JSON.stringify({ generatedBy: "scripts/run-external-scan-lane.mjs", summary, rows }, null, 2)}\n`,
    csv: toCsv(rows),
    chartWorkdownCsv: chartWorkdownCsv(rows),
    summary: toSummary(summary, rows),
  };
}

function supportedVariantSubjects() {
  const subjects = [];
  for (const statusPath of listFiles(join(repoRoot, "recipes")).filter((file) => file.endsWith("/catalog-status.yaml"))) {
    const root = dirname(statusPath);
    const status = readYaml(statusPath);
    if (status.spec?.status !== "catalog-supported") continue;
    const index = readYaml(join(root, "artifact-index.yaml"));
    const chart = status.spec.chart;
    const version = String(status.spec.version);
    const supported = new Set(status.spec.supportedVariants ?? []);
    for (const variant of index.spec?.variants ?? []) {
      if (!supported.has(variant.name)) continue;
      const revision = variant.revisions?.[0];
      check(revision, `${relativeRepo(root)} variant ${variant.name} missing revision`);
      subjects.push({
        chart,
        version,
        variant: variant.name,
        recipePath: relativeRepo(root),
        renderedPath: revision.renderedObjects,
        renderedSHA256: revision.renderedObjectSetSHA256,
      });
    }
  }
  return subjects.sort((left, right) => `${left.chart}/${left.variant}`.localeCompare(`${right.chart}/${right.variant}`));
}

function scanSubject(subject, version) {
  const renderedPath = join(repoRoot, subject.renderedPath);
  check(existsSync(renderedPath), `${subject.chart} ${subject.variant} rendered object file missing`);
  check(sha256File(renderedPath) === subject.renderedSHA256, `${subject.chart} ${subject.variant} rendered digest mismatch`);
  const result = spawnSync("kube-linter", ["lint", "--format", "json", renderedPath], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  const output = result.stdout?.trim() ? JSON.parse(result.stdout) : { Reports: [], Summary: {} };
  const reports = (output.Reports ?? [])
    .map((report) => ({
      check: report.Check,
      message: report.Diagnostic?.Message ?? "",
      object: report.Object?.K8sObject?.Name
        ? {
            apiVersion: report.Object.K8sObject.APIVersion ?? "",
            kind: report.Object.K8sObject.Kind ?? "",
            namespace: report.Object.K8sObject.Namespace ?? "",
            name: report.Object.K8sObject.Name ?? "",
          }
        : {},
    }))
    .sort((left, right) => `${left.check}:${left.object.kind}:${left.object.namespace}:${left.object.name}:${left.message}`.localeCompare(`${right.check}:${right.object.kind}:${right.object.namespace}:${right.object.name}:${right.message}`));
  const checkCounts = countBy(reports, "check");
  return {
    chart: subject.chart,
    version: subject.version,
    variant: subject.variant,
    scanner: "kube-linter",
    scannerVersion: version,
    result: result.status === 0 ? "pass" : reports.length > 0 ? "warn" : "fail",
    exitCode: result.status,
    findingCount: reports.length,
    checkCounts,
    renderedPath: subject.renderedPath,
    renderedSHA256: subject.renderedSHA256,
    recipePath: subject.recipePath,
    findings: reports,
  };
}

function toolVersion(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    available: result.status === 0,
    version: result.status === 0 ? `${result.stdout}${result.stderr}`.trim().split("\n")[0] : "",
  };
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "variant",
    "scanner",
    "scannerVersion",
    "result",
    "exitCode",
    "findingCount",
    "topChecks",
    "renderedSHA256",
    "renderedPath",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(valueFor(row, header))).join(","))].join("\n")}\n`;
}

function toSummary(summary, rows) {
  const byCheck = {};
  for (const row of rows) {
    for (const [checkName, count] of Object.entries(row.checkCounts)) {
      byCheck[checkName] = (byCheck[checkName] ?? 0) + count;
    }
  }
  const topChecks = Object.entries(byCheck)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12);
  const chartWorkdown = chartWorkdownRows(rows);
  const closestProductionRows = chartWorkdown
    .filter((row) => row.chart === "bitnami/nginx" || row.priority === "high")
    .slice(0, 10);
  return `# External Scan Lane

This lane runs a market-standard rendered-manifest scanner against the exact
supported top-20 rendered object sets.

It is additive to the existing local scan/gate receipts. It does not replace
ConfigHub function checks or chart-specific production dispositions.

## Tool Status

| Tool | Available | Version |
| --- | --- | --- |
| kube-linter | ${summary.toolStatus.kubeLinter.available ? "yes" : "no"} | ${summary.toolStatus.kubeLinter.version || "n/a"} |
| Trivy | ${summary.toolStatus.trivy.available ? "yes" : "no"} | ${summary.toolStatus.trivy.version || "n/a"} |
| kubeconform | ${summary.toolStatus.kubeconform.available ? "yes" : "no"} | ${summary.toolStatus.kubeconform.version || "n/a"} |

## Summary

\`\`\`text
charts scanned: ${summary.charts}
variant rendered object sets scanned: ${summary.subjects}
pass: ${summary.pass}
warn: ${summary.warn}
fail: ${summary.fail}
total findings: ${summary.totalFindings}
\`\`\`

## Most Common Findings

| Check | Count |
| --- | ---: |
${topChecks.map(([checkName, count]) => `| \`${checkName}\` | ${count} |`).join("\n")}

## Chart Workdown

The chart workdown groups variant findings into the next production action.
Use it with [production-disposition](../production-disposition/summary.md)
when closing \`scan/gate warning disposition\`.

| Chart | Variants | Findings | Priority | Top checks | Next action |
| --- | ---: | ---: | --- | --- | --- |
${closestProductionRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.variantCount} | ${row.findingCount} | ${row.priority} | ${row.topChecks} | ${row.nextAction} |`).join("\n")}

## Interpretation

\`warn\` means the external scanner found issues that must receive a production
disposition before catalog production support is claimed. The rendered digest
is recorded per row, so each scanner result is bound to the exact objects we
would publish or install.
`;
}

function writeReport(report) {
  write(resultsPath, report.resultsJson);
  write(reviewCsvPath, report.csv);
  write(chartWorkdownCsvPath, report.chartWorkdownCsv);
  write(summaryPath, report.summary);
}

function chartWorkdownCsv(rows) {
  const workdown = chartWorkdownRows(rows);
  const headers = ["chart", "version", "variantCount", "findingCount", "priority", "topChecks", "nextAction", "variants"];
  return `${[headers.join(","), ...workdown.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function chartWorkdownRows(rows) {
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.chart}\u0000${row.version}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        chart: row.chart,
        version: row.version,
        variants: [],
        checks: {},
        findingCount: 0,
      });
    }
    const item = grouped.get(key);
    item.variants.push(row.variant);
    item.findingCount += row.findingCount;
    for (const [checkName, count] of Object.entries(row.checkCounts)) {
      item.checks[checkName] = (item.checks[checkName] ?? 0) + count;
    }
  }
  return [...grouped.values()]
    .map((row) => {
      const topChecks = Object.entries(row.checks)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([name, count]) => `${name}:${count}`)
        .join(";");
      return {
        chart: row.chart,
        version: row.version,
        variantCount: new Set(row.variants).size,
        variants: [...new Set(row.variants)].sort().join(";"),
        findingCount: row.findingCount,
        priority: scanPriority(row.checks),
        topChecks,
        nextAction: scanNextAction(row.checks),
      };
    })
    .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || right.findingCount - left.findingCount || left.chart.localeCompare(right.chart));
}

function scanPriority(checks) {
  if (checks["latest-tag"] || checks["privileged-container"] || checks["privilege-escalation-container"] || checks["sensitive-host-mounts"]) {
    return "high";
  }
  if (checks["dangling-service"] || checks["run-as-non-root"] || checks["no-read-only-root-fs"]) return "medium";
  return "standard";
}

function priorityRank(priority) {
  return { high: 0, medium: 1, standard: 2 }[priority] ?? 3;
}

function scanNextAction(checks) {
  const actions = [];
  if (checks["latest-tag"]) actions.push("pin image tag or digest in the installer base");
  if (checks["privileged-container"] || checks["privilege-escalation-container"] || checks["sensitive-host-mounts"]) {
    actions.push("record security acceptance or create a hardened base");
  }
  if (checks["dangling-service"]) actions.push("review service selectors and runtime endpoints");
  if (checks["pdb-unhealthy-pod-eviction-policy"]) actions.push("accept PDB behavior or add a reviewed patch where the chart supports it");
  if (checks["unset-cpu-requirements"] || checks["unset-memory-requirements"]) actions.push("add production resource policy or accept chart defaults for local-test only");
  if (checks["no-read-only-root-fs"] || checks["run-as-non-root"]) actions.push("review pod security posture for the production target");
  if (checks["liveness-port"] || checks["readiness-port"] || checks["startup-port"]) actions.push("review probe port wiring");
  return actions.length ? actions.join("; ") : "record explicit scan/gate disposition";
}

function valueFor(row, header) {
  if (header === "topChecks") {
    return Object.entries(row.checkCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([name, count]) => `${name}:${count}`)
      .join(";");
  }
  return row[header];
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const name = item[key] || "unknown";
    acc[name] = (acc[name] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
