#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "site/index.html",
    terms: ["ConfigHub makes Helm work for you", "ConfigHub <code>cub helm install</code> is open source and lets teams turn Helm output into visible, versioned configuration", "Who We Are And Why This Exists", "cub helm install"],
  },
  {
    file: "site/variants.html",
    terms: ["The Model In One Picture", "payments-api/prod-us", "The One Decision That Matters", "A Good Variant Flow"],
  },
  {
    file: "site/try.html",
    terms: ["You should see something like this", "Expected Results And Clusters", "out/secrets"],
  },
  {
    file: "site/serverless.html",
    terms: ["Serverless mode", "without a ConfigHub account", "Render and install parity", "OCI for Argo and Flux"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Helm Catalog", "chart versions shown"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Everything we know about this Helm chart is on this page", "Pass means backed by evidence", "How To Try This Chart", "redis-existing-secret"],
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
    terms: ["Serverless mode", "AI-assisted operations", "Existing apps", "Security and provenance", "Future and managed ideas", "Per-chart cub adoption caveats"],
  },
  {
    file: "site/existing-apps.html",
    terms: ["Existing Apps", "Start Read-Only", "Argo or Flux app", "Live cluster"],
  },
  {
    file: "site/ai.html",
    terms: ["AI-Assisted Operations", "AI can help explain, propose, and check changes", "Good AI Tasks", "RBAC Manager for Agents"],
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
    file: "site/how-it-works.html",
    terms: ["Three adoption caveats we manage", "managed cub-direct applier", "cub adoption caveats"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/try.html",
  "site/serverless.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/hard-questions.html",
];

const humanSplitPages = [
  "site/index.html",
  "site/try.html",
  "site/serverless.html",
  "site/how-it-works.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/hard-questions.html",
  "site/known-gaps.html",
  "site/quirks.html",
  "site/proof.html",
  "site/offering.html",
  "site/custom-apps.html",
  "site/existing-apps.html",
  "site/ai.html",
  "site/security.html",
  "site/future.html",
  "site/private/index.html",
];

const guideOpeningChecks = [
  {
    file: "site/index.html",
    headerTerms: ["ConfigHub <code>cub helm install</code> is open source and lets teams turn Helm output into visible, versioned configuration", "See How It Works", "Pick a Helm Chart to Try"],
  },
  {
    file: "site/try.html",
    headerTerms: ["Pick one chart", "render the same chart with", "same chart, same values"],
  },
  {
    file: "site/serverless.html",
    headerTerms: ["without a ConfigHub account", "Render a public chart", "read the YAML first"],
  },
  {
    file: "site/how-it-works.html",
    headerTerms: ["Helm installs in one step", "render the chart", "Get Started"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["same chart, but change one thing", "does this change what Helm renders", "make a derived ConfigHub variant"],
  },
  {
    file: "site/journey.html",
    headerTerms: ["the thing your team operates", "Start with what you already have", "first safe result is visibility"],
  },
  {
    file: "site/operations.html",
    headerTerms: ["Ops starts when an app already exists", "what changed", "review diffs"],
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
  const bannerIndex = header.indexOf("THIS IS AN EXPERIMENTAL TEST PAGE AND NOT REAL");
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
