#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const checks = [
  {
    file: "site/index.html",
    terms: ["Simplify configuration testing and verification", "Using configuration tools can be tricky. We are here to help.", "Try Redis", "Check my Helm values", "cub installer setup", "--output-oci", "Choose where to start", "What happens next", "Check the result and the limits", "AICR recipe for AI infrastructure", "ConfigHub stores the reviewed objects as shared data", "Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS"],
  },
  {
    file: "site/variants.html",
    terms: ["The Model In One Picture", "payments-api/prod-us", "The One Decision That Matters", "A Good Variant Flow"],
  },
  {
    file: "site/try.html",
    terms: ["Try a simple example: Redis", "14 Kubernetes objects", "1. Install cub and the package plugin", "2. Render the Redis package", "3. Inspect the result", "reuse-existing-secret", "cub plugin install confighub/installer", "kustomize version", "--output-oci", "You have finished the first example", "Choose how to deploy the reviewed result", "Continue with the full Redis walkthrough", "Choose another worked example", "Keep it in ConfigHub"],
  },
  {
    file: "site/confighub.html",
    terms: ["Keep and manage your configuration with ConfigHub", "ConfigHub keeps reviewed Kubernetes configuration as shared data", "1. What ConfigHub adds", "2. Follow the official tutorial", "Review the tutorial", "3. Create an account", "Sign up for ConfigHub", "4. Read the background", "Read the ConfigHub blog"],
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
    file: "site/how-it-works.html",
    terms: ["Choose how to deploy it", "Come here after you have inspected the Kubernetes objects", "1. Choose what happens next", "Local files", "OCI package", "ConfigHub", "2. Track required setup", "source and intent record", "3. Decide where each change belongs", "4. Deliver the reviewed result", "5. Next step"],
  },
  {
    file: "site/deployment-reference.html",
    terms: ["Technical deployment reference", "The short version", "Where a setting belongs", "The recipe: your source of truth", "Variants, in one picture", "What a direct local apply still has to handle"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Configuration Catalog", "Find a tested starting configuration", "public library of checked configurations", "Search the catalog", "Readiness", "Ready to try", "Checked; review before use", "First configuration", "Missing something you need? Tell us.", "chart versions shown", "What each catalog entry contains", "Why the catalog offers several configurations", "How the catalog handles required setup", "After you choose", "Choose how to deploy the reviewed configuration"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Choose a tested starting configuration for bitnami/redis@25.5.3", "Evidence labels:", "Catalog readiness: Ready to try", "First-configuration status", "Production status", "Where This Chart's Settings Come From", "What A Base Variant Records", "How To Try This Chart", "redis-existing-secret"],
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
    terms: ["Find instructions for the step you are doing", "Start with a configuration", "Prepare it for deployment", "Change or operate saved configuration", "Check a result or solve a problem", "More references", "Try Redis", "Configuration Catalog", "Worked Examples", "Deployment", "What happens to hooks and CRDs?", "How do I make environment variants?", "How do I check a result?", "What is not working yet?", "Browse all technical references", "Continue with ConfigHub"],
  },
  {
    file: "site/docs-reference.html",
    terms: ["All technical references", "Official tutorial", "Detailed Redis walkthrough", "Detailed entry paths", "Working In This Repository?", "Agent And Operator Notes", "Where Example Materials Live", "Public OCI registry", "Five Stages", "Technical Guides", "Verification And Evidence", "How This Site Uses Technical Words", "AI and the catalog", "Existing Apps", "Security and provenance", "Future and managed ideas", "Per-chart cub adoption caveats"],
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
    terms: ["Choose a worked example", "1. Start with a configuration", "Bring your own Helm chart and values", "cub helm template", "cub helm install", "myapp-base", "myapp-helm", "2. Choose how to run a starting example", "3. Continue in ConfigHub", "4. Roll out a platform or fleet", "5. Use saved configuration for a repeated job", "Local or CI", "Hosted without sign-in", "Kubernetes YAML or an existing app"],
  },
  {
    file: "site/entry-path-reference.html",
    terms: ["Detailed entry paths", "cub installer", "cub helm", "Choose where the work runs", "Most choices are made and checked before you install", "You can read the proof before you ship", "Hooks, CRDs, and setup work are listed", "You can reverse a change, not only keep it", "id=\"catalog-starting-points\"", "id=\"catalog-next-jobs\"", "Helm chart and values", "AICR recipe or bundle", "Existing OCI package", "Kubernetes YAML", "Build an App"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/try.html",
  "site/confighub.html",
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
  "site/confighub.html",
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
    headerTerms: ["Simplify configuration testing and verification", "Try Redis", "Check my Helm values", "ConfigHub stores the reviewed objects as shared data"],
  },
  {
    file: "site/try.html",
    headerTerms: ["Try a simple example: Redis", "14 Kubernetes objects", "contacts neither ConfigHub Server nor Kubernetes", "No account or registry login is required"],
  },
  {
    file: "site/confighub.html",
    headerTerms: ["Keep and manage your configuration with ConfigHub", "ConfigHub keeps reviewed Kubernetes configuration as shared data", "public Catalog and first examples work without ConfigHub"],
  },
  {
    file: "site/how-it-works.html",
    headerTerms: ["Choose how to deploy it", "inspected the Kubernetes objects", "Helm, AICR, cub installer, an OCI package, or plain YAML", "ConfigHub keeps reviewed Kubernetes configuration as shared data"],
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
  "site/confighub.html",
  "site/testing.html",
  "site/entry-path-reference.html",
  "site/how-it-works.html",
  "site/docs.html",
  "site/hard-questions.html",
  "site/demo-org.html",
];

const failures = [];
const expectedNavLabels = ["Try Redis", "Examples", "Catalog", "Deployment", "ConfigHub", "Docs"];

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
  for (const term of ["Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS", "Try Redis", "Examples", "Catalog", "Deployment", "Docs", "ConfigHub"]) {
    if (!header.includes(term)) failures.push(`${file}: shared navigation missing ${JSON.stringify(term)}`);
  }
  let previousNavPosition = -1;
  for (const label of expectedNavLabels) {
    const position = header.indexOf(`>${label}</a>`);
    if (position <= previousNavPosition) {
      failures.push(`${file}: shared navigation is not ordered as ${expectedNavLabels.join(" -> ")}`);
      break;
    }
    previousNavPosition = position;
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
  for (const href of ["./how-it-works.html", "./redis-walkthrough.html", "./testing.html", "./confighub.html"]) {
    if (!shortTry.includes(`href="${href}"`)) failures.push(`site/try.html: missing next-step link ${href}`);
  }
  if (shortTry.includes("Start with your own configuration")) failures.push("site/try.html: first exercise must not expand into the bring-your-own chooser");
}

const examplesPath = path.join(root, "site/testing.html");
if (fs.existsSync(examplesPath)) {
  const examples = fs.readFileSync(examplesPath, "utf8");
  if (examples.includes("<h2 id=\"locations\">Technical sources</h2>")) {
    failures.push("site/testing.html: technical source map belongs in the technical reference, not the example chooser");
  }
  for (const section of ["start", "start-modes", "managed", "platforms", "apps"]) {
    if (!examples.includes(`id="${section}"`)) failures.push(`site/testing.html: missing example stage ${section}`);
  }
  for (const command of ["cub helm template", "cub helm install"]) {
    if (!examples.includes(command)) failures.push(`site/testing.html: bring-your-own flow is missing ${command}`);
  }
}

const homePath = path.join(root, "site/index.html");
if (fs.existsSync(homePath)) {
  const home = fs.readFileSync(homePath, "utf8");
  for (const oldStructure of ["Five simple things", "Four things you can prove before you ship", "One resource, three depths"]) {
    if (home.includes(oldStructure)) failures.push(`site/index.html: contains retired competing structure ${JSON.stringify(oldStructure)}`);
  }
  for (const href of ["./try.html", "./testing.html#bring-your-own", "./charts/index.html", "./how-it-works.html", "./confighub.html", "./verification.html", "./known-gaps.html"]) {
    if (!home.includes(`href="${href}"`)) failures.push(`site/index.html: missing story link ${href}`);
  }
}

const catalogIndexPath = path.join(root, "site/charts/index.html");
if (fs.existsSync(catalogIndexPath)) {
  const catalogIndex = fs.readFileSync(catalogIndexPath, "utf8");
  if (catalogIndex.includes("id=\"catalog-starting-points\"")) {
    failures.push("site/charts/index.html: catalog must not duplicate the multi-source example chooser");
  }
  for (const phrase of ["bring your own", "private chart", "Package OCI and evidence", "ConfigHub options"]) {
    if (catalogIndex.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`site/charts/index.html: catalog must not contain intake or workflow copy: ${JSON.stringify(phrase)}`);
    }
  }
  for (const machineOption of [">catalog-supported</option>", ">proof-grade / machine-proof-only</option>", ">start-here</option>", ">render-only</option>"]) {
    if (catalogIndex.includes(machineOption)) failures.push(`site/charts/index.html: exposes internal filter label ${JSON.stringify(machineOption)}`);
  }
}

const purposePageRules = [
  {
    file: "site/charts/index.html",
    maxH2: 5,
    requiredLinks: ["../how-it-works.html"],
  },
  {
    file: "site/how-it-works.html",
    maxH2: 5,
    requiredLinks: ["./docs.html", "./confighub.html", "./deployment-reference.html"],
    forbidden: ["Choose a starting configuration", "The recipe: your source of truth"],
  },
  {
    file: "site/docs.html",
    maxH2: 5,
    requiredLinks: ["./confighub.html", "./docs-reference.html"],
    forbidden: ["Technical Guides", "Verification And Evidence", "Five Stages"],
  },
  {
    file: "site/confighub.html",
    maxH2: 4,
    requiredLinks: ["./how-it-works.html", "./docs.html"],
    forbidden: ["Choose one place to start"],
  },
];

for (const rule of purposePageRules) {
  const fullPath = path.join(root, rule.file);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  const h2Count = [...html.matchAll(/<h2\b/gi)].length;
  if (h2Count > rule.maxH2) failures.push(`${rule.file}: has ${h2Count} h2 headings; purpose-page maximum is ${rule.maxH2}`);
  for (const href of rule.requiredLinks) {
    if (!html.includes(`href="${href}"`)) failures.push(`${rule.file}: missing next-step link ${href}`);
  }
  for (const phrase of rule.forbidden ?? []) {
    if (html.includes(phrase)) failures.push(`${rule.file}: contains material assigned to a deeper reference page: ${JSON.stringify(phrase)}`);
  }
}

function htmlFilesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...htmlFilesUnder(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

for (const file of htmlFilesUnder(path.join(root, "site"))) {
  const text = fs.readFileSync(file, "utf8");
  if (/helm ops/i.test(text)) {
    failures.push(`${path.relative(root, file)}: contains the retired \"Helm Ops\" label`);
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
    if (/class="tagline">(?:catalog-supported|proof-grade \/ machine-proof-only) page/.test(text)) {
      failures.push(`site/charts/${name}: exposes an internal catalog readiness label in the header`);
    }
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
