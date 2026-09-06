#!/usr/bin/env node

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";
import { verifyBitnamiSourceFetch } from "./audit-bitnami-source-fetch.mjs";

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-bitnami-successors.mjs --generate
  node scripts/generate-bitnami-successors.mjs --verify
  node scripts/generate-bitnami-successors.mjs --self-test`);
  process.exit(2);
}

const surveyFile = "data/bitnami-successors/survey.json";
const outputFiles = [
  "data/bitnami-successors/successors.csv",
  "data/bitnami-successors/successors.md",
  "data/bitnami-successors/successors.html",
];
const expectedComponents = [
  "redis", "nginx", "postgresql", "mysql", "mongodb", "rabbitmq",
];

if (mode === "--generate") {
  const outputs = buildOutputs(loadSurvey(repoRoot));
  for (const [file, text] of Object.entries(outputs)) {
    write(join(repoRoot, file), text);
    console.log(`wrote ${file}`);
  }
} else if (mode === "--verify") {
  verifyBitnamiSourceFetch();
  const outputs = buildOutputs(loadSurvey(repoRoot));
  for (const [file, text] of Object.entries(outputs)) {
    check(
      readFileSync(join(repoRoot, file), "utf8") === text,
      `${file} is stale; run node scripts/generate-bitnami-successors.mjs --generate`,
    );
  }
  console.log("verified the chart successor survey surfaces");
} else {
  selfTest();
  console.log(
    "bitnami successor survey self-test passed: deterministic surfaces, survey contract refusals, and self-contained HTML",
  );
}

function loadSurvey(root) {
  const survey = JSON.parse(readFileSync(join(root, surveyFile), "utf8"));
  check(
    /^\d{4}-\d{2}-\d{2}$/.test(String(survey.measuredAt ?? "")),
    "the survey lost its measurement date",
  );
  check(
    String(survey.boundary ?? "").includes("changes no catalog entry"),
    "the survey lost its boundary statement",
  );
  const names = (survey.components ?? []).map((row) => row.component);
  check(
    JSON.stringify([...names].sort())
      === JSON.stringify([...expectedComponents].sort()),
    "the survey must cover exactly the six affected components",
  );
  for (const component of survey.components) {
    check(
      component.verdictConfirmed === true,
      `the ${component.component} top pick was not independently confirmed`,
    );
    check(
      (component.candidates ?? []).length >= 2
        && component.candidates.some((candidate) => candidate.rank === 1),
      `the ${component.component} survey lost its ranked candidates`,
    );
    for (const candidate of component.candidates) {
      check(
        Number.isInteger(candidate.indexHttpStatus)
          && Number.isInteger(candidate.tgzHttpStatus),
        `a ${component.component} candidate carries a non-measured source status`,
      );
      check(
        candidate.rank !== 1
          || (candidate.indexHttpStatus === 200 && candidate.tgzHttpStatus === 200),
        `the ${component.component} recommendation is not anonymously fetchable`,
      );
    }
  }
  check(
    (survey.exposure ?? []).length >= 6
      && survey.exposure.every((row) => Number.isInteger(row.httpStatus)),
    "the exposure rows lost their measured statuses",
  );
  return survey;
}

function buildOutputs(survey) {
  return {
    "data/bitnami-successors/successors.csv": renderCsv(survey),
    "data/bitnami-successors/successors.md": renderMarkdown(survey),
    "data/bitnami-successors/successors.html": renderHtml(survey),
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function renderCsv(survey) {
  const lines = [
    [
      "component", "rank", "candidate", "publisher", "license", "shape",
      "source", "latest_version", "index_status", "artifact_status",
      "caveats",
    ].join(","),
  ];
  for (const component of survey.components) {
    for (const candidate of [...component.candidates].sort((a, b) => a.rank - b.rank)) {
      lines.push([
        component.component, candidate.rank, candidate.name,
        candidate.publisher, candidate.license, candidate.shape,
        candidate.repositoryUrl, candidate.latestVersion,
        candidate.indexHttpStatus, candidate.tgzHttpStatus,
        candidate.caveats,
      ].map(csvCell).join(","));
    }
  }
  lines.push("");
  lines.push([
    "exposure_component", "pinned_version", "tgz_url", "http_status_today",
    "runtime_lanes",
  ].join(","));
  for (const row of survey.exposure) {
    lines.push([
      row.component, row.pinnedVersion, row.tgzUrl, row.httpStatus,
      row.runtimeLanes,
    ].map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function renderMarkdown(survey) {
  const lines = [
    "# Chart successors for the six affected components",
    "",
    `Measured ${survey.measuredAt}. ${survey.method}`,
    "",
    survey.boundary,
    "",
    "## Recommendations",
    "",
    "| Component | Recommendation | Publisher | License | Shape | Latest | Sources today |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const component of survey.components) {
    const pick = component.candidates.find((candidate) => candidate.rank === 1);
    lines.push(
      `| ${component.component} | ${pick.name} | ${pick.publisher.split("(")[0].trim()} | ${pick.license.split("(")[0].trim()} | ${pick.shape} | ${pick.latestVersion.split("(")[0].trim()} | index ${pick.indexHttpStatus}, artifact ${pick.tgzHttpStatus} |`,
    );
  }
  lines.push("");
  for (const component of survey.components) {
    lines.push(`## ${component.component}`);
    lines.push("");
    for (const candidate of [...component.candidates].sort((a, b) => a.rank - b.rank)) {
      lines.push(`### ${candidate.rank}. ${candidate.name}`);
      lines.push("");
      lines.push(`- Source: ${candidate.repositoryUrl} (index ${candidate.indexHttpStatus}, artifact ${candidate.tgzHttpStatus}); latest ${candidate.latestVersion}.`);
      lines.push(`- Publisher: ${candidate.publisher}. License: ${candidate.license}. Shape: ${candidate.shape}.`);
      lines.push(`- Values: ${candidate.valuesNotes}`);
      lines.push(`- Caveats: ${candidate.caveats}`);
      lines.push("");
    }
    if (component.corrections) {
      lines.push(`Independent verification notes: ${component.corrections}`);
      lines.push("");
    }
  }
  lines.push("## Today's exposure on the current pins");
  lines.push("");
  lines.push("| Component and pin | Direct tgz today | Which lanes fetch at run time |");
  lines.push("| --- | --- | --- |");
  for (const row of survey.exposure) {
    lines.push(`| ${row.component} ${row.pinnedVersion} | ${row.httpStatus} | ${row.runtimeLanes.split(". ")[0]} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderHtml(survey) {
  const head = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Chart successor survey</title>',
    "<style>:root{color-scheme:light dark}body{font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;margin:24px;background:#fff;color:#17212b}h1{font-size:1.7rem;margin-bottom:.25rem}.lede{max-width:95ch;color:#3f4d5a}.key{border-radius:.25rem;padding:.2rem .45rem;font-weight:700}.ok{background:#d7f2df;color:#14532d}.broken{background:#fadbd8;color:#7b241c}.shape{background:#dce9ff;color:#173b75}table{border-collapse:collapse;width:100%;margin:1.25rem 0;font-size:.84rem}caption{text-align:left;font-size:1rem;font-weight:700;padding:.5rem 0}th,td{border:1px solid #aeb8c2;padding:.5rem;text-align:left;vertical-align:top}thead th{background:#edf1f5;color:#17212b}code{white-space:normal;overflow-wrap:anywhere}@media(prefers-color-scheme:dark){body{background:#10161d;color:#eef4fa}.lede{color:#c6d1dc}thead th{background:#25313d;color:#fff}.ok{background:#14532d;color:#fff}.broken{background:#7b241c;color:#fff}.shape{background:#173b75;color:#fff}}</style></head>",
    "<body><main><h1>Chart successors for the six affected components</h1>",
    `<p class="lede">Measured ${survey.measuredAt}. ${survey.method}</p>`,
    `<p class="lede">${survey.boundary}</p>`,
  ];
  const status = (code) =>
    `<span class="key ${code === 200 ? "ok" : "broken"}">${code}</span>`;
  const recRows = survey.components.map((component) => {
    const pick = component.candidates.find((candidate) => candidate.rank === 1);
    return `<tr><td>${component.component}</td><td>${pick.name}</td><td>${pick.publisher.split("(")[0].trim()}</td><td>${pick.license.split("(")[0].trim()}</td><td><span class="key shape">${pick.shape}</span></td><td>${pick.latestVersion.split("(")[0].trim()}</td><td>${status(pick.indexHttpStatus)} ${status(pick.tgzHttpStatus)}</td></tr>`;
  }).join("");
  const exposureRows = survey.exposure.map((row) =>
    `<tr><td>${row.component} ${row.pinnedVersion}</td><td>${status(row.httpStatus)}</td><td>${row.runtimeLanes.split(". ")[0]}</td></tr>`).join("");
  const detailTables = survey.components.map((component) => {
    const rows = [...component.candidates].sort((a, b) => a.rank - b.rank).map((candidate) =>
      `<tr><td>${candidate.rank}</td><td>${candidate.name}</td><td><code>${candidate.repositoryUrl}</code><br>latest ${candidate.latestVersion}</td><td>${candidate.publisher}</td><td>${candidate.license}</td><td><span class="key shape">${candidate.shape}</span></td><td>${status(candidate.indexHttpStatus)} ${status(candidate.tgzHttpStatus)}</td><td>${candidate.caveats}</td></tr>`).join("");
    return `<table><caption>${component.component}</caption><thead><tr><th>Rank</th><th>Candidate</th><th>Source</th><th>Publisher</th><th>License</th><th>Shape</th><th>Status</th><th>Caveats</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("\n");
  const tail = [
    `<table><caption>Recommendations</caption><thead><tr><th>Component</th><th>Recommendation</th><th>Publisher</th><th>License</th><th>Shape</th><th>Latest</th><th>Sources today</th></tr></thead><tbody>${recRows}</tbody></table>`,
    detailTables,
    `<table><caption>Today's exposure on the current pins</caption><thead><tr><th>Component and pin</th><th>Direct tgz today</th><th>Which lanes fetch at run time</th></tr></thead><tbody>${exposureRows}</tbody></table>`,
    '<p class="lede">The full per-candidate values notes and run-time lane details live in <code>successors.md</code> and <code>successors.csv</code> beside this page; the raw measured survey is <code>survey.json</code>.</p>',
    "</main></body></html>",
  ];
  return `${[...head, ...tail].join("\n")}\n`;
}

function selfTest() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "helm-expt-bitnami-successors-self-test-"));
  try {
    const destination = join(fixtureRoot, surveyFile);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(repoRoot, surveyFile), destination);
    const first = buildOutputs(loadSurvey(fixtureRoot));
    const second = buildOutputs(loadSurvey(fixtureRoot));
    check(
      JSON.stringify(first) === JSON.stringify(second),
      "the survey surfaces are not deterministic",
    );
    for (const file of outputFiles) {
      check(
        first[file] === readFileSync(join(repoRoot, file), "utf8"),
        `${file} differs from the fixture compile; run --generate`,
      );
    }
    check(
      !/<script[^>]*src=|<link[^>]+rel="stylesheet"|url\(http/.test(
        first["data/bitnami-successors/successors.html"],
      ),
      "the survey HTML must stay self-contained",
    );

    const tampers = [
      ["missing component", (s) => { s.components = s.components.filter((row) => row.component !== "redis"); }, /exactly the six affected components/],
      ["unconfirmed pick", (s) => { s.components[0].verdictConfirmed = false; }, /not independently confirmed/],
      ["assumed status", (s) => { s.components[0].candidates[0].tgzHttpStatus = "assumed"; }, /non-measured source status/],
      ["unfetchable recommendation", (s) => {
        const pick = s.components[0].candidates.find((candidate) => candidate.rank === 1);
        pick.tgzHttpStatus = 403;
      }, /not anonymously fetchable/],
      ["boundary loss", (s) => { s.boundary = "This survey migrates the catalog."; }, /lost its boundary statement/],
      ["exposure loss", (s) => { s.exposure = []; }, /lost their measured statuses/],
    ];
    for (const [label, tamper, pattern] of tampers) {
      const clone = JSON.parse(readFileSync(destination, "utf8"));
      tamper(clone);
      writeFileSync(destination, JSON.stringify(clone));
      expectFailure(() => loadSurvey(fixtureRoot), pattern, label);
      cpSync(join(repoRoot, surveyFile), destination);
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function expectFailure(fn, pattern, label) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  check(
    error && pattern.test(String(error.message)),
    `${label}: expected ${pattern}, got ${error?.message ?? "success"}`,
  );
}
