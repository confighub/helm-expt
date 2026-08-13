#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIGURATION_QUESTIONS } from "./lib/configuration-questions.mjs";

const root = process.cwd();
const selfTest = process.argv.includes("--self-test");

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function validateQuestions(questions) {
  const findings = [];
  const entries = Object.entries(questions);
  const labels = new Set();
  if (entries.length !== 10) findings.push(`expected 10 question definitions, found ${entries.length}`);
  if (entries.filter(([, item]) => item.group === "common").length !== 8) findings.push("expected eight common questions");
  for (const [code, item] of entries) {
    if (!/^[a-z][a-z0-9-]+$/.test(code)) findings.push(`${code}: invalid question code`);
    if (!['common', 'additional'].includes(item.group)) findings.push(`${code}: invalid group`);
    for (const field of ['label', 'answer', 'instruction', 'issueOption', 'recommendation']) {
      if (!String(item[field] || '').trim()) findings.push(`${code}: missing ${field}`);
    }
    if (labels.has(item.label)) findings.push(`${code}: duplicate label`);
    labels.add(item.label);
    if (!String(item.issueOption || '').startsWith(`${code}: `)) findings.push(`${code}: issueOption must start with the question code`);
  }
  return findings;
}

function verify() {
  const findings = validateQuestions(CONFIGURATION_QUESTIONS);
  check(findings.length === 0, `configuration question contract failed:\n- ${findings.join('\n- ')}`);

  const schemaText = read("schemas/config-workshop-review.schema.json");
  const schema = JSON.parse(schemaText);
  check(schema.properties?.apiVersion?.const === "workshop.confighub.com/v1alpha1", "review schema has the wrong apiVersion");
  check(schema.properties?.kind?.const === "ConfigurationReview", "review schema has the wrong kind");
  for (const field of ["question", "source", "candidate", "comparison", "checks", "finding", "recommendation"]) {
    check(schema.properties?.spec?.required?.includes(field), `review schema spec does not require ${field}`);
  }
  for (const field of ["method", "scope", "findings", "notChecked"]) {
    check(schema.properties?.spec?.properties?.checks?.required?.includes(field), `review schema checks do not require ${field}`);
  }

  const browserScript = read("scripts/site/check-config-browser.js");
  for (const term of [
    "config-workshop-browser-static-v1",
    "invalid-object-identity",
    "checks that did not run",
    "cub variant upload",
    "--provider None",
    "workshop-review.json",
    "candidate.yaml",
  ]) check(browserScript.includes(term), `browser review script is missing ${term}`);

  const askPage = read("site/ask.html");
  for (const [code, item] of Object.entries(CONFIGURATION_QUESTIONS)) {
    check(askPage.includes(`value=\"${code}\"`) || askPage.includes(`href=\"#${code}\"`), `ask page is missing ${code}`);
    check(askPage.includes(item.label), `ask page is missing question label: ${item.label}`);
  }
  for (const term of [
    "The Catalog</strong> answers questions we have already investigated",
    "Check and retain the rendered result",
    "Download review record",
    "Save the same result in ConfigHub",
    "Optional: propose a public Catalog case",
    "review.schema.json",
    "check-config.js",
  ]) check(askPage.includes(term), `ask page is missing ${term}`);

  check(read("site/review.schema.json") === schemaText, "generated review schema is stale");
  check(read("site/check-config.js") === browserScript, "generated browser review script is stale");

  const issueTemplate = read(".github/ISSUE_TEMPLATE/problem-chart.yml");
  for (const item of Object.values(CONFIGURATION_QUESTIONS)) {
    check(issueTemplate.includes(item.issueOption), `problem chart template is missing ${item.issueOption}`);
  }

  const workflow = read("docs/user/configuration-question-workflow.md");
  for (const item of Object.values(CONFIGURATION_QUESTIONS).filter((item) => item.group === "common")) {
    check(workflow.includes(item.label), `configuration question workflow is missing ${item.label}`);
  }
  for (const term of ["**Catalog**", "**Check my config**", "**ConfigHub**", "`ConfigurationReview` record"]) {
    check(workflow.includes(term), `configuration question workflow is missing ${term}`);
  }
}

if (selfTest) {
  const broken = structuredClone(CONFIGURATION_QUESTIONS);
  broken["ai-values"].answer = "";
  check(validateQuestions(broken).some((finding) => finding.includes("ai-values: missing answer")), "self-test did not reject a missing answer");
  console.log("verified configuration review contract self-test");
} else {
  verify();
  console.log(`verified configuration review contract: ${Object.keys(CONFIGURATION_QUESTIONS).length} questions, schema, browser check, handoff, and Catalog intake`);
}
