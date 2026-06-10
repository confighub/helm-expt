import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const inputPath = join(repoRoot, "data", "production-disposition", "top20.csv");
const outputRoot = join(repoRoot, "data", "latest-top20-refresh");
const reviewPath = join(outputRoot, "review.csv");
const summaryPath = join(outputRoot, "summary.md");
const promotionReadinessPath = join(outputRoot, "promotion-readiness.csv");
const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";

if (mode === "--generate") {
  generate();
} else if (mode === "--verify") {
  verify();
} else {
  console.log(`Usage:
  node scripts/generate-top20-latest-refresh.mjs --generate
  node scripts/generate-top20-latest-refresh.mjs --verify`);
}

function generate() {
  const rows = readTop20();
  const promotionReadiness = existsSync(promotionReadinessPath)
    ? new Map(parseCsv(readFileSync(promotionReadinessPath, "utf8")).map((row) => [row.chart, row]))
    : new Map();
  const helmVersion = command("helm", ["version", "--short"]).trim();
  const generatedAt = new Date().toISOString();
  const reviewed = rows.map((row, index) => {
    const latest = latestChartVersion(row.chart);
    const status = row.version === latest ? "current" : "update-available";
    const readiness = promotionReadiness.get(row.chart);
    const proofComplete = readiness?.candidate_version === latest && readiness?.catalog_promotion === "root-path-present";
    const retainedCandidateSuperseded = readiness && readiness.candidate_version !== latest;
    return {
      rank: index + 1,
      chart: row.chart,
      currentVersion: row.version,
      latestVersion: latest,
      status,
      supportedVariants: row.supported_variants,
      currentRecipePath: row.recipe_path,
      currentPackagePath: row.package_path,
      nextAction:
        status === "current"
          ? "keep current proof; deepen variants or production disposition"
          : proofComplete
            ? "write target-scoped replacement decision before changing catalog support"
            : retainedCandidateSuperseded
              ? `refresh candidate from retained ${readiness.candidate_version} proof to latest ${latest} before replacement decision`
              : "create new recipe/package version and rerun proof chain before catalog promotion",
    };
  });

  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(reviewPath, csv(reviewed), "utf8");
  writeFileSync(summaryPath, summary(reviewed, { generatedAt, helmVersion }), "utf8");
  verify();
  console.log(`wrote ${relative(reviewPath)} and ${relative(summaryPath)}`);
}

function verify() {
  check(existsSync(reviewPath), `${relative(reviewPath)} is missing`);
  check(existsSync(summaryPath), `${relative(summaryPath)} is missing`);
  const rows = parseCsv(readFileSync(reviewPath, "utf8"));
  check(rows.length === 20, `expected 20 latest-refresh rows; found ${rows.length}`);
  const updates = rows.filter((row) => row.status === "update-available").length;
  const current = rows.filter((row) => row.status === "current").length;
  const summaryText = readFileSync(summaryPath, "utf8");
  check(summaryText.includes(`Current chart proofs: ${current} / 20`), "summary current count is stale");
  check(summaryText.includes(`Update candidates: ${updates} / 20`), "summary update count is stale");
  console.log(`verified latest top-20 refresh: ${current} current, ${updates} update candidates`);
}

function readTop20() {
  const rows = parseCsv(readFileSync(inputPath, "utf8"));
  check(rows.length === 20, `expected 20 production-disposition rows; found ${rows.length}`);
  return rows;
}

function latestChartVersion(chart) {
  const output = command("helm", ["search", "repo", chart, "--versions", "-o", "json"]);
  const rows = JSON.parse(output);
  const exact = rows.find((row) => row.name === chart);
  check(exact, `helm search repo did not return exact chart ${chart}`);
  check(exact.version, `helm search repo returned no version for ${chart}`);
  return exact.version;
}

function command(name, commandArgs) {
  return execFileSync(name, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });
}

function summary(rows, { generatedAt, helmVersion }) {
  const current = rows.filter((row) => row.status === "current");
  const updates = rows.filter((row) => row.status === "update-available");
  const replacementDecisionReady = updates.filter((row) => row.nextAction === "write target-scoped replacement decision before changing catalog support");
  const supersededRetainedCandidates = updates.filter((row) => row.nextAction.startsWith("refresh candidate from retained"));
  const noCandidateYet = updates.length - replacementDecisionReady.length - supersededRetainedCandidates.length;
  const candidateStatusPath = join(outputRoot, "candidates", "candidate-status.csv");
  const replacementDecisionPath = join(outputRoot, "replacement-decisions", "summary.md");
  const candidateSection = existsSync(candidateStatusPath)
    ? `## Candidate Proofs

The retained update candidates have proof-complete root paths under:

\`\`\`text
recipes/
packages/
\`\`\`

The retained candidate source artifacts remain under:

\`\`\`text
data/latest-top20-refresh/candidates/
\`\`\`

Verify them with:

\`\`\`sh
npm run top20:latest-candidates:verify
npm run top20:latest-promote-root-paths:verify
npm run top20:latest-promotion-readiness:verify
npm run top20:latest-replacement-decisions:verify
\`\`\`

Some retained candidates may already be behind the latest upstream chart
version. For those rows, refresh the candidate before making a replacement
decision. For rows where the retained candidate still matches the latest
upstream version, the proof shows that the candidate has its own recipe/package
paths, rendered objects, Helm-equivalence evidence, ConfigHub proof receipts,
live e2e receipts, live parity receipts, production-disposition boundary,
catalog status, and top-100/top-500 refresh coverage.

They are still not catalog-supported replacements. The next step is a
target-scoped replacement decision that chooses whether to replace, defer, or
keep both versions.

${existsSync(replacementDecisionPath) ? "The replacement-decision queue records that final review surface.\n" : ""}

\`\`\`text
update rows: ${updates.length}
replacement-decision-ready candidates: ${replacementDecisionReady.length}
retained candidates superseded by newer upstream versions: ${supersededRetainedCandidates.length}
update rows without a retained candidate: ${noCandidateYet}
\`\`\`

`
    : "";
  const updateTable =
    updates.length === 0
      ? "No updates available in the current Helm repo indexes.\n"
      : [
          "| Rank | Chart | Current proof | Latest chart | Next action |",
          "| ---: | --- | --- | --- | --- |",
          ...updates.map(
            (row) =>
              `| ${row.rank} | \`${row.chart}\` | \`${row.currentVersion}\` | \`${row.latestVersion}\` | ${row.nextAction} |`,
          ),
          "",
        ].join("\n");

  return `# Latest Top-20 Refresh

Generated: ${generatedAt}

Helm client: \`${helmVersion}\`

This snapshot compares the currently supported top-20 catalog proofs with the
latest versions available from the configured Helm repositories.

## Result

\`\`\`text
Current chart proofs: ${current.length} / 20
Update candidates: ${updates.length} / 20
\`\`\`

## Update Candidates

${updateTable}
## Doctrine

An update candidate is not automatically a supported catalog entry. It becomes
supported only after the new chart version has its own recipe/package path,
source and dependency locks, supported variants, rendered objects,
Helm-equivalence receipt, scan/gate receipts, ConfigHub proof receipts, and live
e2e evidence.

No public catalog row should silently roll forward from the current proof version
to the latest chart version.

${candidateSection}
## Next Work

1. Write or accept a target-scoped replacement decision for each candidate.
2. If replacement is accepted, update the production support decision and
   catalog-supported state for that target scope.
3. Keep the previous chart version available for legacy patch and rollback
   review even after a newer version is accepted.
`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
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
  const headers = [
    "rank",
    "chart",
    "current_version",
    "latest_version",
    "status",
    "supported_variants",
    "current_recipe_path",
    "current_package_path",
    "next_action",
  ];
  const body = rows.map((row) =>
    [
      row.rank,
      row.chart,
      row.currentVersion,
      row.latestVersion,
      row.status,
      row.supportedVariants,
      row.currentRecipePath,
      row.currentPackagePath,
      row.nextAction,
    ]
      .map(csvCell)
      .join(","),
  );
  return `${headers.join(",")}\n${body.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function relative(path) {
  return path.slice(repoRoot.length + 1);
}
