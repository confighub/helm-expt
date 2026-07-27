#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const sourcePath = join(repoRoot, "config-catalog", "top50.yaml");
const outputRoot = join(repoRoot, "data", "top50-completion");
const outputs = {
  json: join(outputRoot, "plan.json"),
  csv: join(outputRoot, "plan.csv"),
  summary: join(outputRoot, "summary.md"),
};
const allowedStatuses = ["available", "partial", "planned", "blocked"];

if (!["--generate", "--verify"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-top50-completion.mjs --generate
  node scripts/generate-top50-completion.mjs --verify`);
  process.exit(1);
}

const report = buildReport();

if (mode === "--generate") {
  write(outputs.json, report.json);
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(
    `wrote Top 50 completion tracker -> ${relativeRepo(outputRoot)}/ (${statusLine(report.counts)})`,
  );
} else {
  verifyFile(outputs.json, report.json);
  verifyFile(outputs.csv, report.csv);
  verifyFile(outputs.summary, report.summary);
  console.log(`verified Top 50 completion tracker (${statusLine(report.counts)})`);
}

function buildReport() {
  check(existsSync(sourcePath), `${relativeRepo(sourcePath)} is missing`);
  const plan = readYaml(sourcePath);
  check(plan?.apiVersion === "catalog.confighub.com/v1alpha1", "Top 50 apiVersion is invalid");
  check(plan?.kind === "CompletionPlan", "Top 50 kind is invalid");
  check(plan?.metadata?.name === "helm-expt-top-50", "Top 50 metadata.name is invalid");
  check(typeof plan?.spec?.purpose === "string" && plan.spec.purpose.trim(), "Top 50 purpose is missing");

  const definitions = plan?.spec?.statusDefinitions ?? {};
  for (const status of allowedStatuses) {
    check(
      typeof definitions[status] === "string" && definitions[status].trim(),
      `Top 50 status definition ${status} is missing`,
    );
  }

  const tasks = plan?.spec?.tasks;
  check(Array.isArray(tasks), "Top 50 tasks must be an array");
  check(tasks.length === 50, `Top 50 must contain exactly 50 tasks, found ${tasks.length}`);

  const packageScripts = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).scripts ?? {};
  const seenNames = new Set();
  const seenIds = new Set();
  for (const [index, task] of tasks.entries()) {
    const expectedId = `T${String(index + 1).padStart(2, "0")}`;
    check(task?.id === expectedId, `Top 50 task ${index + 1} must use id ${expectedId}`);
    check(!seenIds.has(task.id), `duplicate Top 50 id ${task.id}`);
    seenIds.add(task.id);
    for (const field of ["area", "name", "status", "outcome", "next"]) {
      check(
        typeof task?.[field] === "string" && task[field].trim(),
        `${task.id} is missing ${field}`,
      );
    }
    check(!seenNames.has(task.name), `duplicate Top 50 task name ${task.name}`);
    seenNames.add(task.name);
    check(
      allowedStatuses.includes(task.status),
      `${task.id} has invalid status ${task.status}`,
    );
    check(
      Array.isArray(task.evidence) && task.evidence.length > 0,
      `${task.id} must name at least one evidence path`,
    );
    for (const evidence of task.evidence) {
      check(typeof evidence === "string" && evidence.trim(), `${task.id} has an empty evidence path`);
      check(
        existsSync(join(repoRoot, evidence)),
        `${task.id} names missing evidence ${evidence}`,
      );
    }
    check(
      Array.isArray(task.verify) && task.verify.length > 0,
      `${task.id} must name at least one verification command`,
    );
    for (const command of task.verify) {
      const match = String(command).match(/^npm run ([a-zA-Z0-9:_-]+)$/);
      check(match, `${task.id} verification must be an exact npm script command: ${command}`);
      check(packageScripts[match[1]], `${task.id} names missing npm script ${match[1]}`);
    }
    if (task.issue !== undefined) {
      check(
        /^https:\/\/github\.com\/confighub\/helm-expt\/issues\/\d+$/.test(task.issue),
        `${task.id} has invalid issue URL ${task.issue}`,
      );
    }
  }

  const counts = Object.fromEntries(
    allowedStatuses.map((status) => [
      status,
      tasks.filter((task) => task.status === status).length,
    ]),
  );
  const generated = {
    apiVersion: plan.apiVersion,
    kind: plan.kind,
    metadata: plan.metadata,
    spec: {
      purpose: plan.spec.purpose,
      statusDefinitions: definitions,
      counts,
      tasks,
    },
  };

  return {
    counts,
    json: `${JSON.stringify(generated, null, 2)}\n`,
    csv: toCsv(tasks),
    summary: toSummary(generated),
  };
}

function toCsv(tasks) {
  const columns = [
    "id",
    "area",
    "name",
    "status",
    "outcome",
    "evidence",
    "verify",
    "next",
    "issue",
  ];
  const rows = tasks.map((task) => ({
    ...task,
    evidence: task.evidence.join(";"),
    verify: task.verify.join(";"),
    issue: task.issue ?? "",
  }));
  return `${columns.join(",")}\n${rows
    .map((row) => columns.map((column) => csvCell(row[column])).join(","))
    .join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toSummary(plan) {
  const { counts, tasks } = plan.spec;
  const areas = [...new Set(tasks.map((task) => task.area))];
  const sections = areas
    .map((area) => {
      const rows = tasks
        .filter((task) => task.area === area)
        .map(
          (task) =>
            `| ${task.id} | ${escapeCell(task.name)} | ${task.status} | ${evidenceLinks(task.evidence)} | ${escapeCell(task.next)}${task.issue ? ` [Issue](${task.issue})` : ""} |`,
        )
        .join("\n");
      return `## ${area}

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
${rows}`;
    })
    .join("\n\n");

  return `# Top 50 Completion Plan

This is the maintained completion tracker for the public configuration catalog
and its path into ConfigHub. It replaces conversational task counts with fifty
stable task IDs, current evidence, verification commands, and a concrete
completion step.

Generated from [config-catalog/top50.yaml](../../config-catalog/top50.yaml).
Edit that source and run \`npm run top50:completion\`.

## Current State

\`\`\`text
available: ${counts.available}
partial:   ${counts.partial}
planned:   ${counts.planned}
blocked:   ${counts.blocked}
total:     ${tasks.length}
\`\`\`

\`available\` means the named scope has a usable, verified path. It does not
claim that every chart, input format, target, or controller is complete.
\`partial\` means a representative path works but a material part remains.
\`planned\` has no complete end-to-end proof yet. \`blocked\` names the defect
that prevents its completion check from passing.

## Programme Boundary

${plan.spec.purpose}

The source status definitions are:

| Status | Meaning |
| --- | --- |
${allowedStatuses
  .map(
    (status) =>
      `| ${status} | ${escapeCell(plan.spec.statusDefinitions[status])} |`,
  )
  .join("\n")}

${sections}

## Verification

\`\`\`sh
npm run top50:completion:verify
\`\`\`

The verifier requires exactly fifty sequential IDs, valid status values,
existing evidence paths, and real npm verification commands. It also checks
that this Markdown summary, the CSV work queue, and the JSON record match the
YAML source.
`;
}

function evidenceLinks(paths) {
  return paths
    .map((path) => {
      const absolute = join(repoRoot, path);
      if (statSync(absolute).isDirectory()) return `\`${path}/\``;
      return `[${path}](../../${path})`;
    })
    .join("<br>");
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function statusLine(counts) {
  return allowedStatuses.map((status) => `${status} ${counts[status]}`).join(", ");
}

function verifyFile(path, expected) {
  check(
    existsSync(path) && readFileSync(path, "utf8") === expected,
    `${relativeRepo(path)} is stale or missing; run npm run top50:completion`,
  );
}
