#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "site/index.html",
    terms: ["Simplify configuration testing and verification", "Using configuration tools can be tricky. We are here to help.", "Run a catalog package", "Check my config", "cub installer setup", "--output-oci", "Five simple things", "What you can do", "Four things you can prove before you ship", "One resource, three depths", "Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS"],
  },
  {
    file: "site/variants.html",
    terms: ["The Model In One Picture", "payments-api/prod-us", "The One Decision That Matters", "A Good Variant Flow"],
  },
  {
    file: "site/try.html",
    terms: ["Try one catalog package", "1. Install cub and the package plugin", "2. Render the Redis package", "3. Inspect the result", "reuse-existing-secret", "cub plugin install confighub/installer", "kustomize version", "--output-oci", "Local: no server", "Hosted: no sign-in", "ConfigHub: sign in", "Continue with the official tutorial", "Start with your own configuration", "AICR", "Open the detailed Redis walkthrough"],
  },
  {
    file: "site/redis-walkthrough.html",
    terms: ["Detailed Redis walkthrough", "Pull, inspect, and verify Redis", "reuse-existing-secret", "Redis 25.5.3", "27.0.0", "cub installer", "--output-oci", "No account: the package choice stays", "a reviewed object edit stays", "What is <code>--pull</code>?", "Managed upgrade and rollback"],
  },
  {
    file: "site/serverless.html",
    terms: ["Serverless mode", "Run it without ConfigHub Server", "both serverless and anonymous", "reuse-existing-secret", "--output-oci", "redis → redis", "normal default carries password material"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Helm Ops Catalog", "chart versions shown", "id=\"catalog-starting-points\"", "id=\"catalog-next-jobs\"", "Helm chart and values", "AICR recipe or bundle", "Existing OCI package", "Kubernetes YAML", "Build an App", "Helm values or a ConfigHub change?"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["This page exists so you do not have to guess your way through this Helm chart", "Pass means backed by evidence", "Where This Chart's Settings Come From", "What A Base Variant Records", "How To Try This Chart", "redis-existing-secret"],
  },
  {
    file: "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
    terms: ["Serious Chart Example", "CRDs", "target facts"],
  },
  {
    file: "site/hard-questions.html",
    terms: ["How is cub installer different from cub helm?", "My Helm chart broke", "What is safe for AI to change?", "SSA conflict gap"],
  },
  {
    file: "site/known-gaps.html",
    terms: ["Known Gaps We Surface", "Fixed placeholder credentials", "SSA conflict ergonomics"],
  },
  {
    file: "site/docs.html",
    terms: ["Docs/FAQ", "Official tutorial", "Try one catalog package", "Detailed Redis walkthrough", "Examples", "Detailed entry paths", "Start Here", "Working In This Repository?", "Agent And Operator Notes", "Five Stages", "Technical Guides", "Verification And Evidence", "How This Site Uses Technical Words", "AI and the catalog", "Existing Apps", "Security and provenance", "Future and managed ideas", "Per-chart cub adoption caveats"],
  },
  {
    file: "site/verification.html",
    terms: ["Verification", "Start With The Question", "Product Commands And Proof Commands", "Recipe, Render, Record, Route", "Fresh Evidence And Committed Evidence", "Verify It Yourself", "NPM Script Catalog"],
  },
  {
    file: "site/existing-apps.html",
    terms: ["Existing Apps", "Start Read-Only", "Argo or Flux app", "Live cluster"],
  },
  {
    file: "site/ai.html",
    terms: ["AI And The Catalog", "AI can suggest, but tests and receipts decide", "How AI Helps Build The Catalog", "Good AI Tasks", "RBAC Manager for Agents"],
  },
  {
    file: "site/custom-apps.html",
    terms: ["Custom Apps", "Agentic app or plugin", "RBAC Manager for Agents"],
  },
  {
    file: "site/security.html",
    terms: ["Security And Provenance", "Secrets", "Scans and gates", "Claims register"],
  },
  {
    file: "site/future.html",
    terms: ["Future And Managed Ideas", "What Exists In The Public Experiment", "roadmap", "managed"],
  },
  {
    file: "site/testing.html",
    terms: ["Examples", "Starting examples", "Where a starting example can run", "Continue in ConfigHub", "Platform and fleet examples", "ConfigHub App examples", "Where the material lives", "Local or CI", "Hosted without sign-in", "Kubernetes YAML or an existing app"],
  },
  {
    file: "site/entry-path-reference.html",
    terms: ["Detailed entry paths", "cub installer", "cub helm", "Choose where the work runs", "Most choices are made and checked before you install", "You can read the proof before you ship", "Hooks, CRDs, and setup work are listed", "You can reverse a change, not only keep it", "id=\"catalog-starting-points\"", "id=\"catalog-next-jobs\"", "Helm chart and values", "AICR recipe or bundle", "Existing OCI package", "Kubernetes YAML", "Build an App"],
  },
  {
    file: "site/how-it-works.html",
    terms: ["The recipe: your source of truth", "Where a setting belongs", "Variants, in one picture", "AI-assisted changes, with control", "What direct apply still has to handle", "Apply CRDs first", "Field conflicts and removals"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/verification.html",
  "site/hard-questions.html",
];

const humanSplitPages = [
  "site/index.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/how-it-works.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/verification.html",
  "site/hard-questions.html",
  "site/known-gaps.html",
  "site/quirks.html",
  "site/proof.html",
  "site/offering.html",
  "site/custom-apps.html",
  "site/existing-apps.html",
  "site/ai.html",
  "site/security.html",
  "site/testing.html",
  "site/entry-path-reference.html",
  "site/future.html",
  "site/private/index.html",
];

const guideOpeningChecks = [
  {
    file: "site/index.html",
    headerTerms: ["Simplify configuration testing and verification", "Run a catalog package", "Check my config"],
  },
  {
    file: "site/try.html",
    headerTerms: ["Try one catalog package", "does not contact ConfigHub Server", "do not need a ConfigHub account"],
  },
  {
    file: "site/how-it-works.html",
    headerTerms: ["Helm rebuilds your whole configuration", "Recipe, render, record, route", "official tutorial", "short package exercise"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["same chart, but change one thing", "does this change what Helm renders", "make a derived ConfigHub variant"],
  },
  {
    file: "site/journey.html",
    headerTerms: ["Apps on ConfigHub", "configuration already saved in ConfigHub", "official ConfigHub tutorial", "reviewed objects"],
  },
  {
    file: "site/operations.html",
    headerTerms: ["Ops starts when an app already exists", "what changed", "review diffs"],
  },
  {
    file: "site/verification.html",
    headerTerms: ["npm proof commands", "verification tools", "fresh live parity"],
  },
];

const technicalEnglishPages = [
  "site/try.html",
  "site/testing.html",
  "site/entry-path-reference.html",
  "site/how-it-works.html",
  "site/docs.html",
  "site/hard-questions.html",
  "site/demo-org.html",
];

const failures = [];

function decodeBasicHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function proseBlocks(html) {
  return [...html.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => {
    const text = match[2]
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, " command ")
      .replace(/<br\s*\/?>/gi, ". ")
      .replace(/<[^>]+>/g, " ");
    return decodeBasicHtml(text).replace(/\s+/g, " ").trim();
  });
}

function sentences(text) {
  const parts = [];
  let start = 0;
  const boundary = /[.!?]+(?=\s|$)/g;
  for (const match of text.matchAll(boundary)) {
    const end = match.index + match[0].length;
    parts.push(text.slice(start, end).trim());
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function wordCount(text) {
  return text.match(/[A-Za-z0-9][A-Za-z0-9'/:+._-]*/g)?.length ?? 0;
}

for (const check of checks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: missing file`);
    continue;
  }
  const text = fs.readFileSync(fullPath, "utf8");
  for (const term of check.terms) {
    if (!text.includes(term)) failures.push(`${check.file}: missing ${JSON.stringify(term)}`);
  }
}

for (const file of menuGuidePages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");
  const header = text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(header)) {
    failures.push(`${file}: generated timestamp appears in the hero/header`);
  }
  if (header.includes("DRAFT WEB SITE PLEASE SEND COMMENTS TO AUTHORS")) {
    failures.push(`${file}: draft banner still appears in the hero/header`);
  }
  for (const term of ["Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS", "Try it", "Catalog", "Tutorial", "How it works", "Docs", "Sign in"]) {
    if (!header.includes(term)) failures.push(`${file}: shared navigation missing ${JSON.stringify(term)}`);
  }
  const rawPathLinks = [...text.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .filter(([, , label]) => label.includes("../") || /\.md(#.*)?$/.test(label.trim()));
  for (const [, href, label] of rawPathLinks.slice(0, 5)) {
    failures.push(`${file}: raw file path shown as link text ${JSON.stringify(label)} for href ${JSON.stringify(href)}`);
  }
}

for (const file of humanSplitPages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const text = fs.readFileSync(fullPath, "utf8");
  const header = text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  if (header.includes("For humans")) failures.push(`${file}: hero/header must explain the page without a "For humans" label`);
  if (text.includes("Details and data")) failures.push(`${file}: should not use the old reference/details divider`);
  if (/<h2[^>]*>\s*Reference\s*<\/h2>/.test(text)) failures.push(`${file}: should not label the lower page as Reference`);
}

for (const check of guideOpeningChecks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: missing file`);
    continue;
  }
  const text = fs.readFileSync(fullPath, "utf8");
  const header = text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  for (const term of check.headerTerms) {
    if (!header.includes(term)) failures.push(`${check.file}: guide opening missing ${JSON.stringify(term)}`);
  }
}

for (const file of technicalEnglishPages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  for (const block of proseBlocks(html)) {
    for (const sentence of sentences(block)) {
      const count = wordCount(sentence);
      if (count > 25) {
        failures.push(`${file}: technical prose has ${count} words: ${JSON.stringify(sentence.slice(0, 180))}`);
      }
    }
  }
}

const shortTryPath = path.join(root, "site/try.html");
if (fs.existsSync(shortTryPath)) {
  const shortTry = fs.readFileSync(shortTryPath, "utf8");
  const commandBlocks = [...shortTry.matchAll(/<pre\b[^>]*>/g)].length;
  if (commandBlocks > 3) {
    failures.push(`site/try.html: short package exercise has ${commandBlocks} command blocks; maximum is 3`);
  }
  if (!shortTry.includes("https://docs.confighub.com/get-started/tutorial/")) {
    failures.push("site/try.html: missing the official ConfigHub tutorial link");
  }
  if (!shortTry.includes("Local: no server") || !shortTry.includes("Hosted: no sign-in")) {
    failures.push("site/try.html: local no-server and hosted no-sign-in choices must remain separate");
  }
  if (!shortTry.includes("anonymous service is planned") || !shortTry.includes("not released")) {
    failures.push("site/try.html: hosted anonymous service must retain its planned status");
  }
}

// Chart-card placeholder lint: a chart page must never render an unresolved
// "<action>: unknown;" Next-action placeholder or a raw "<tmp>" work-dir placeholder
// inside a command/action field. (The card text must read as something a user can act on.)
const chartCardsDir = path.join(root, "site/charts");
if (fs.existsSync(chartCardsDir)) {
  for (const name of fs.readdirSync(chartCardsDir).filter((f) => f.endsWith(".html"))) {
    const text = fs.readFileSync(path.join(chartCardsDir, name), "utf8");
    const header = text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(header)) {
      failures.push(`site/charts/${name}: generated timestamp appears in the chart header`);
    }
    const unresolved = [...new Set([...text.matchAll(/([a-z][a-z-]*): unknown;/g)].map((m) => m[1]))];
    if (unresolved.length) failures.push(`site/charts/${name}: unresolved action placeholder(s) ${JSON.stringify(unresolved.map((a) => `${a}: unknown`))}`);
    if (text.includes("&lt;tmp&gt;")) failures.push(`site/charts/${name}: raw <tmp> work-dir placeholder rendered in a command`);
    if (name !== "index.html" && !text.includes("id=\"setting-sources\"")) {
      failures.push(`site/charts/${name}: missing the Helm values, ConfigHub changes, install work, and live state provenance view`);
    }
  }
}

if (failures.length) {
  console.error("site UX contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`verified site UX contract: ${checks.length} page(s), ${humanSplitPages.length} guide page(s), ${guideOpeningChecks.length} actionable opening(s)`);
