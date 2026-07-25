#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "site/index.html",
    terms: ["Helm Ops made simple", "open source tool", "cub installer", "Preview your installs", "Look first", "Prove it on a cluster", "Change it and keep it", "What the catalog gives you", "Store chart configurations", "Check Tests"],
  },
  {
    file: "site/variants.html",
    terms: ["The Model In One Picture", "payments-api/prod-us", "The One Decision That Matters", "A Good Variant Flow"],
  },
  {
    file: "site/try.html",
    terms: ["Try It Now with Kubernetes", "quick dev cluster", "Change it after install", "AI_API_KEY", "helm install", "cub installer", "prometheus → monitoring", "What is <code>--pull</code>?"],
  },
  {
    file: "site/serverless.html",
    terms: ["Serverless mode", "Install without an account", "Same chart, same running result", "redis → redis", "The chart carries its own password"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Helm Ops Catalog", "chart versions shown"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["This page exists so you do not have to guess your way through this Helm chart", "Pass means backed by evidence", "What A Base Variant Records", "How To Try This Chart", "redis-existing-secret"],
  },
  {
    file: "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
    terms: ["Serious Chart Example", "CRDs", "target facts"],
  },
  {
    file: "site/hard-questions.html",
    terms: ["My Helm chart broke", "What is safe for AI to change?", "SSA conflict gap"],
  },
  {
    file: "site/known-gaps.html",
    terms: ["Known Gaps We Surface", "Fixed placeholder credentials", "SSA conflict ergonomics"],
  },
  {
    file: "site/docs.html",
    terms: ["Docs/FAQ", "Start Here", "Working In This Repository?", "Agent And Operator Notes", "Five Stages", "Technical Guides", "Verification And Evidence", "AI and the catalog", "Existing Apps", "Security and provenance", "Future and managed ideas", "Per-chart cub adoption caveats"],
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
    terms: ["Making configuration easier to test", "Most choices are made and checked before you install", "You can read the proof before you ship", "The messy parts are proven, not hidden", "You can reverse a change, not only keep it", "AICR", "cub installer"],
  },
  {
    file: "site/how-it-works.html",
    terms: ["The recipe: your source of truth", "Variants, in one picture", "AI-assisted changes, with control", "Three adoption caveats we manage", "managed cub-direct applier", "cub adoption caveats"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/try.html",
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
  "site/future.html",
  "site/private/index.html",
];

const guideOpeningChecks = [
  {
    file: "site/index.html",
    headerTerms: ["Helm Ops made simple", "open source tool", "cub installer", "Preview your installs"],
  },
  {
    file: "site/try.html",
    headerTerms: ["quick dev cluster", "helm install", "cub installer"],
  },
  {
    file: "site/how-it-works.html",
    headerTerms: ["Helm rebuilds your whole configuration", "Recipe, render, record, route", "Get Started"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["same chart, but change one thing", "does this change what Helm renders", "make a derived ConfigHub variant"],
  },
  {
    file: "site/journey.html",
    headerTerms: ["applications your team owns", "new or updated base variant", "keeps the approved changes"],
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

const failures = [];

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
  const bannerIndex = header.indexOf("DRAFT WEB SITE PLEASE SEND COMMENTS TO AUTHORS");
  const navIndex = header.indexOf("class=\"topbar\"");
  if (bannerIndex < 0) failures.push(`${file}: missing experimental banner in the hero/header`);
  else if (navIndex >= 0 && bannerIndex > navIndex) failures.push(`${file}: experimental banner must appear before the home/menu row`);
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
  }
}

if (failures.length) {
  console.error("site UX contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`verified site UX contract: ${checks.length} page(s), ${humanSplitPages.length} guide page(s), ${guideOpeningChecks.length} actionable opening(s)`);
