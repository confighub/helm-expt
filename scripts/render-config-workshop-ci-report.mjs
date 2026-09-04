#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { buildWorkshopCiReport, renderWorkshopCiMarkdown, validateArtifactPath } from "./lib/config-workshop-ci-report.mjs";
import { write } from "./lib/proof-common.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.input) usage(1);
const result = JSON.parse(readFileSync(args.input, "utf8"));
const report = buildWorkshopCiReport(result, { artifactBase: args.artifactBase });
const output = args.format === "json"
  ? `${JSON.stringify(report, null, 2)}\n`
  : renderWorkshopCiMarkdown(report);

if (args.extractDir) {
  for (const file of result.spec.files) {
    validateArtifactPath(file.path);
    write(`${args.extractDir}/${file.path}`, file.content);
  }
  write(`${args.extractDir}/workshop-result.json`, `${JSON.stringify(result, null, 2)}\n`);
}
if (args.output) write(args.output, output);
else process.stdout.write(output);

const rank = { never: 99, blocked: 2, "needs-review": 1 };
const verdictRank = { blocked: 2, "needs-review": 1, unknown: 1, "clear-in-completed-checks": 0 };
if (verdictRank[report.verdict] >= rank[args.failOn]) process.exitCode = 2;

function parseArgs(argv) {
  const parsed = { input: "", output: "", format: "markdown", artifactBase: "", extractDir: "", failOn: "blocked" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input") parsed.input = argv[++index] ?? "";
    else if (arg === "--output") parsed.output = argv[++index] ?? "";
    else if (arg === "--format") parsed.format = argv[++index] ?? "";
    else if (arg === "--artifact-base") parsed.artifactBase = argv[++index] ?? "";
    else if (arg === "--extract-dir") parsed.extractDir = argv[++index] ?? "";
    else if (arg === "--fail-on") parsed.failOn = argv[++index] ?? "";
    else if (arg === "--help" || arg === "-h") usage(0);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!new Set(["markdown", "json"]).has(parsed.format)) throw new Error("--format must be markdown or json");
  if (!new Set(["blocked", "needs-review", "never"]).has(parsed.failOn)) throw new Error("--fail-on must be blocked, needs-review, or never");
  return parsed;
}

function usage(exitCode) {
  console.log(`Usage:
  node scripts/render-config-workshop-ci-report.mjs \\
    --input workshop-result.json \\
    [--format markdown|json] \\
    [--output report.md] \\
    [--extract-dir ./ci-artifacts] \\
    [--artifact-base https://github.com/OWNER/REPO/blob/SHA/path/] \\
    [--fail-on blocked|needs-review|never]

The default Markdown report is suitable for a pull-request comment. By default,
only a recorded block returns a non-zero exit status. Use --fail-on needs-review
when unresolved findings or omitted checks should also stop CI.`);
  process.exit(exitCode);
}
