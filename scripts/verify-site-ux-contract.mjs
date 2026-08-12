#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
// The catalog grows, so these are floors against losing a component or a
// version, not declarations of how many there are. Everything else here checks
// the pages against each other, which is the property that actually matters:
// the home card, the catalog index, and the per-version pages must agree.
const TOP100_EVIDENCE_COMPONENT_FLOOR = 100;
const PUBLIC_CATALOG_COMPONENT_FLOOR = 112;
const PUBLIC_CATALOG_VERSION_FLOOR = 139;

// Counted once from the generated catalog index so every later check can
// compare against what the site actually published.
const catalogCounts = readCatalogCounts();

function readCatalogCounts() {
  const indexPath = path.join(root, "site/charts/index.html");
  if (!fs.existsSync(indexPath)) return { components: 0, readinessComponents: 0, retainedVersions: 0 };
  const html = fs.readFileSync(indexPath, "utf8");
  return {
    components: [...html.matchAll(/<tr data-chart-row data-kind="helm-chart"/g)].length,
    readinessComponents: [...html.matchAll(/data-evidence-surface="readiness-evidence"/g)].length,
    retainedVersions: [...html.matchAll(/data-retained-version="[^"]+"\s+href="\.\/[^\"]+\.html"/g)].length,
  };
}

const checks = [
  {
    file: "site/index.html",
    terms: ["Detect and Stop Config Drift", "Drift starts before you deploy", "catalog of deployment previews and patterns, using standard config formats and ConfigHub", "Check a public chart", "Check my Helm values", "See a worked example", "cub installer setup", "--output-oci", "Choose where to start", "What happens next", "Check the result and the limits", "AICR recipe for AI</a>", "Store reviewed objects in ConfigHub", "Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS"],
  },
  {
    file: "site/guides.html",
    terms: ["Learn this by doing it", "Run a short example", "Work through an example like yours", "Follow one package end to end", "Open the short example", "Open the worked examples", "Open the detailed walkthrough", "After a guide"],
  },
  {
    file: "site/challenge.html",
    terms: ["Give your AI this prompt", "The prompt", "Six questions worth asking", "Why send us a chart?", "problem-chart", "changes.json", "secrets removed", "Zero fabricated receipts", "data/ai-benchmark"],
  },
  {
    file: "site/compare.html",
    terms: ["Versus what you already use", "Six jobs, four tools", "helm template", "kubectl diff", "Kustomize overlays", "you do not need this site", "This works with your tools, not instead of them"],
  },
  {
    file: "site/whats-new.html",
    terms: ["What changed recently", "Twenty newest receipts", "changes.json", "receipt-aging"],
  },
  {
    file: "site/variants.html",
    terms: ["Decide where a change belongs", "1. See the model", "payments-api/prod-us", "2. Decide where the change belongs", "3. Follow a safe flow", "4. Run the commands", "reuse-existing-secret", "5. Open worked examples", "6. Read the details"],
  },
  {
    file: "site/journey.html",
    terms: ["Build an App from saved configuration", "1. Confirm what the App operates", "2. Confirm the configuration is saved", "3. Follow the normal order", "4. See common uses", "5. Open the working demonstrations", "Record an existing application"],
  },
  {
    file: "site/operations.html",
    terms: ["Operate saved configuration", "1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Use managed ConfigHub when needed", "compare a variant with its base", "publish OCI for a GitOps controller", "check the cluster after delivery"],
  },
  {
    file: "site/try.html",
    terms: ["Try a simple example: Redis", "14 Kubernetes objects", "The chart renders 13 objects", "adds one explicit Namespace", "1. Install cub and the package plugin", "2. Render the Redis package", "3. Inspect the result", "reuse-existing-secret", "cub plugin install confighub/installer", "kustomize version", "--output-oci", "You have finished the first example", "choose how to deploy the reviewed result", "continue the detailed Redis walkthrough", "choose another worked example", "keep the result in ConfigHub"],
  },
  {
    file: "site/confighub.html",
    terms: ["Keep and manage your configuration with ConfigHub", "ConfigHub keeps reviewed Kubernetes configuration as shared data", "1. What ConfigHub adds", "2. Follow the official tutorial", "official tutorial", "3. Create an account", "Sign up for ConfigHub", "4. Read the background", "Read the ConfigHub blog"],
  },
  {
    file: "site/redis-walkthrough.html",
    terms: ["Detailed Redis walkthrough", "Pull, inspect, and verify Redis", "reuse-existing-secret", "Redis 25.5.3", "27.0.0", "cub installer", "--output-oci", "No account: the package choice stays", "review a stored change", "What is <code>--pull</code>?", "Managed upgrade and rollback"],
  },
  {
    file: "site/serverless.html",
    terms: ["Work without an account", "Everything on this page runs on your laptop", "1. Pull a public catalog package", "2. Choose a no-account task", "3. Change an existing OCI without signing in", "4. Render a Helm package before applying it", "5. Deliver the OCI with Argo CD or Flux", "6. Read the current limits", "reuse-existing-secret", "--output-oci", "redis → redis", "normal default carries password material"],
  },
  {
    file: "site/how-it-works.html",
    terms: ["Choose how to deploy it", "Come here after you have inspected the Kubernetes objects", "1. Choose what happens next", "Local files", "Catalog installer OCI", "rendered OCI", "ConfigHub release OCI", "non-conflicting recorded changes remain", "2. Track required setup", "source and intent record", "3. Decide where each change belongs", "4. Deliver the reviewed result", "kubectl apply", "pruning is enabled and tested", "5. Next step"],
  },
  {
    file: "site/deployment-reference.html",
    terms: ["Technical deployment reference", "1 · Three ConfigHub terms", "Where a setting belongs", "The recipe: the recorded inputs", "Variants and related records", "What a direct local apply still has to handle"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Component Catalog", "Choose a component, version, and configuration", "component-first public library of checked configurations", "all 139 retained package versions", "112 components", "Search the catalog", "Search components", "Readiness", "Ready to try", "Checked; review before use", "Published package; review first", "First configuration", "Missing something you need? Tell us.", "catalog entries shown, including 5 AI platform entries; 139 retained package versions remain available", "Every version has a local detail page", "Packaged configurations by version", "What each catalog entry contains", "Why the catalog offers several configurations", "How the catalog handles required setup", "After you choose", "Choose how to deploy the reviewed configuration"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Choose a tested starting configuration for bitnami/redis@25.5.3", "Evidence labels:", "Catalog readiness: Ready to try", "First-configuration status", "Production status", "Where This Chart's Settings Come From", "What The Starting Configuration Records", "Try This Chart", "redis-existing-secret"],
  },
  {
    file: "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
    terms: ["Serious Chart Example", "CRDs", "target facts"],
  },
  {
    file: "site/hard-questions.html",
    terms: ["Find a direct answer", "1. Start with the basics", "2. Follow the configuration into ConfigHub", "3. Handle hooks, Secrets, and cluster requirements", "4. Check delivery, upgrades, and live results", "5. Understand values, variants, and Catalog coverage", "6. Understand free use and the evidence", "7. Read current limitations", "How is cub installer different from cub helm?", "My Helm chart broke", "What is safe for AI to change?", "SSA conflict gap"],
  },
  {
    file: "site/known-gaps.html",
    terms: ["See what is not ready yet", "1. Read the current limits", "2. Check the exact chart and configuration", "Fixed placeholder credentials", "SSA conflict ergonomics", "Do now:"],
  },
  {
    file: "site/docs.html",
    terms: ["Find instructions for the step you are doing", "Start with a configuration", "Prepare it for deployment", "Change or operate saved configuration", "Check a result or solve a problem", "More references", "Try Redis", "Component Catalog", "Worked Examples", "Deployment", "What happens to hooks and CRDs?", "How do I make environment variants?", "How do I check a result?", "What is not working yet?", "Browse all technical references", "Continue with ConfigHub"],
  },
  {
    file: "site/docs-reference.html",
    terms: ["All technical references", "Official tutorial", "Detailed Redis walkthrough", "Detailed entry paths", "Working In This Repository?", "Agent And Operator Notes", "Where Example Materials Live", "Public OCI registry", "Five Stages", "Technical Guides", "Verification And Evidence", "How This Site Uses Technical Words", "AI and the catalog", "Understand an existing app", "Review security before release", "Current and planned work", "Per-chart cub adoption caveats"],
  },
  {
    file: "site/verification.html",
    terms: ["Check one claim", "1. Choose the question", "2. Tell product commands from project checks", "3. See what render, record, and route mean", "4. Choose saved evidence or a fresh run", "5. Open detailed instructions", "Verify It Yourself", "NPM Script Catalog"],
  },
  {
    file: "site/proof.html",
    terms: ["See what has been tested", "1. Read the current counts", "2. See what each test covers", "3. Check the harder charts", "4. Find tests designed to expose failure", "5. See what this project does not claim", "Helm render match", "Hooks and prerequisites"],
  },
  {
    file: "site/quirks.html",
    terms: ["Find the setup a Helm chart still needs", "1. Check the chart page first", "2. Understand each extra requirement", "3. Check what remains before deployment", "Helm hooks", "CRDs", "Cluster lookups"],
  },
  {
    file: "site/offering.html",
    terms: ["Choose how much of ConfigHub to use", "1. Start without ConfigHub Server", "2. Add ConfigHub when the result must live and change", "3. Use the commercial product for private and production work", "4. Check what exists today", "5. Send a missing or broken public chart", "A hosted path without sign-in is planned"],
  },
  {
    file: "site/existing-apps.html",
    terms: ["Understand an existing app before changing it", "1. Start from the system that owns it today", "2. Record the facts before making a change", "3. Choose the first managed step", "Argo CD or Flux app", "Live cluster"],
  },
  {
    file: "site/ai.html",
    terms: ["Use AI without hiding the result", "It does not decide whether a configuration is ready", "1. Use AI to maintain the Catalog", "2. Review configuration made by AI", "The agent proposes. The reviewed objects are what get released.", "3. See a checked ConfigHub example", "4. Choose a suitable AI task", "5. Give AI a purpose-built App", "6. Open guides and evidence", "RBAC Manager for Agents"],
  },
  {
    file: "site/demo-org.html",
    terms: ["Explore the live ConfigHub demo", "1. Open one Space and read its README", "2. See the records that explain the configuration", "3. Query and change the saved Kubernetes objects", "4. Choose another example by problem", "5. Follow a change through variants and promotions", "6. Check what ran on Kubernetes", "7. See how hooks, CRDs, and source records are represented", "Which source and choices produced this configuration?", "What was rendered, when, and which Units were produced?", "What must happen around the ordinary objects?", "8. See which checks can stop an apply", "9. Repeat the pattern with your own app"],
  },
  {
    file: "site/custom-apps.html",
    terms: ["Combine charts and your own service", "1. Decide where each piece belongs", "2. Start new, or record what already runs", "3. Open working examples", "Purpose-built App", "RBAC Manager for Agents"],
  },
  {
    file: "site/security.html",
    terms: ["Review security before release", "1. Inspect the objects and their source", "2. Apply checks before delivery", "3. Read the limits of each result", "Secrets", "Scans and gates", "Claims register"],
  },
  {
    file: "site/future.html",
    terms: ["Separate current work from planned work", "1. Use what exists today", "2. Review what remains planned", "3. Check the status before relying on a claim", "Failure and limit tests", "Accept a live fix"],
  },
  {
    file: "site/testing.html",
    terms: ["Choose a worked example", "See what Redis installs, before you install it", "cub installer setup", "reuse-existing-secret", "1. Start with a configuration", "What you have", "Start with this example", "After the starting examples, see how ConfigHub handles promotion, fleet rollouts, and repeated operational jobs", "Each example includes the source files and the evidence behind its result", "Bring your own Helm chart and values", "An AICR recipe for AI infrastructure", "cub helm template", "cub helm install", "--namespace &lt;namespace&gt;", "confighubplaceholder", "drops Helm hooks by default", "--include-hooks", "--skip-crds", "myapp-base", "myapp-helm", "2. Choose how to run a starting example", "3. Continue in ConfigHub", "4. Roll out a platform or fleet", "5. Use saved configuration for a repeated job", "Local or CI", "Hosted without sign-in", "Kubernetes YAML or an existing app"],
  },
  {
    file: "site/kubara.html",
    terms: ["Keep Kubara. Make the platform governable.", "ConfigHub simplifies Kubara without making it fundamentally different.", "Kubara composes; ConfigHub governs; Argo reconciles.", "Benefits with explicit acceptance evidence", "Evidence or acceptance target", "What stays Kubara, and what ConfigHub adds", "One adoption journey, in the user's order", "1. Choose components and wiring", "2. Run Kubara", "3. Push the complete hand-off to Git", "4. Import the Git revision and create OCI", "5. Load the selected ConfigHub organization", "6. Deploy applications", "What we show in ConfigHub", "The honest boundaries", "Keep all the detail", "Start the six-step tutorial", "current deterministic", "live receipt required"],
  },
  {
    file: "site/entry-path-reference.html",
    terms: ["Detailed entry paths", "cub installer", "cub helm", "Choose where the work runs", "Most choices are made and checked before you install", "You can read the proof before you ship", "Hooks, CRDs, and setup work are listed", "You can reverse a change, not only keep it", "id=\"catalog-starting-points\"", "id=\"catalog-next-jobs\"", "Helm chart and values", "AICR recipe or bundle", "Existing OCI package", "Kubernetes YAML", "Build an App"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/guides.html",
  "site/challenge.html",
  "site/compare.html",
  "site/whats-new.html",
  "site/try.html",
  "site/confighub.html",
  "site/redis-walkthrough.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/journey.html",
  "site/operations.html",
  "site/docs.html",
  "site/kubara.html",
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
  "site/kubara.html",
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
    headerTerms: ["Detect and Stop Config Drift", "catalog of deployment previews and patterns, using standard config formats and ConfigHub", "Check a public chart", "Check my Helm values", "See a worked example", "Store reviewed objects in ConfigHub"],
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
    headerTerms: ["Choose how to deploy it", "inspected the Kubernetes objects", "AICR recipe for AI infrastructure", "ConfigHub stores your approved configuration and its history"],
  },
  {
    file: "site/kubara.html",
    headerTerms: ["Keep Kubara. Make the platform governable.", "ConfigHub simplifies Kubara without making it fundamentally different.", "Kubara composes; ConfigHub governs; Argo reconciles.", "Start the six-step tutorial"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["Decide where a change belongs", "should a change rebuild the base, or belong to one environment", "change the Helm source and rebuild the base", "use a derived ConfigHub variant"],
  },
  {
    file: "site/journey.html",
    headerTerms: ["Build an App from saved configuration", "after configuration is saved in ConfigHub", "official tutorial", "reviewed objects and policy result decide what ships"],
  },
  {
    file: "site/operations.html",
    headerTerms: ["Operate saved configuration", "after an application and its target already exist", "review a change, approve it, deliver it, and check the live result", "OCI carries a reviewed release"],
  },
  {
    file: "site/serverless.html",
    headerTerms: ["Work without an account", "Everything on this page runs on your laptop", "A cluster is needed only when you choose to deploy"],
  },
  {
    file: "site/ai.html",
    headerTerms: ["Use AI without hiding the result", "It does not decide whether a configuration is ready", "exact Kubernetes objects and recorded checks decide what can proceed"],
  },
  {
    file: "site/verification.html",
    headerTerms: ["Choose the result you want to check", "test this project's published results", "do not install your application", "create clusters and produce a new live result"],
  },
];

const technicalEnglishPages = [...new Set([...humanSplitPages, "site/demo-org.html", "site/deployment-reference.html"])];

const failures = [];
const expectedNavLabels = ["Guides", "Catalog", "Deployment", "Docs", "ConfigHub"];

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
  if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(text)) {
    failures.push(`${check.file}: global generated timestamp appears on a human-facing page`);
  }
}

// Two of the generator's notes are placed by searching the rendered page for a
// landmark and splicing a paragraph in front of it. A stylesheet comment that
// merely named a tag was landmark enough: the note went into the <style> block,
// broke the rules after it, and every other gate passed. Nothing in a
// stylesheet is ever a paragraph, so this is cheap to state and impossible to
// argue with.
for (const file of [...menuGuidePages, "site/index.html"]) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");
  for (const style of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const stray = style[1].match(/<\/?(?:p|div|section|main|header|a|span)\b[^>]*>/);
    if (stray) failures.push(`${file}: HTML spliced into a <style> block near ${JSON.stringify(stray[0])}`);
  }
}

// Repository markdown uses <br> inside table cells, because a cell cannot hold
// a paragraph. The renderer escaped it, so every cell of the Kubara matrix
// printed the tag as text — 121 times on one published page, on the page whose
// whole purpose is keeping four facts legible. Nineteen rendered pages carried
// it. A line break that shows as markup is a rendering failure, so it fails
// here rather than being noticed in a screenshot.
for (const file of renderedDocPages()) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const escaped = (text.match(/&lt;br\s*\/?&gt;/g) ?? []).length;
  if (escaped) failures.push(`${file}: ${escaped} line break(s) rendered as escaped markup instead of <br>`);
}

function renderedDocPages() {
  const root_ = path.join(root, "site/d");
  if (!fs.existsSync(root_)) return [];
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".html")) out.push(path.relative(root, next));
    }
  };
  walk(root_);
  return out;
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
  for (const term of ["Config Workshop", "AN EXPERIMENTAL TEST SITE FOR CONFIG TOOLS", "Guides", "Catalog", "Deployment", "Docs", "ConfigHub"]) {
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
  if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(text)) {
    failures.push(`${file}: global generated timestamp appears on a human-facing page`);
  }
  const h1Count = [...text.matchAll(/<h1\b/gi)].length;
  if (h1Count !== 1) failures.push(`${file}: expected one h1, found ${h1Count}`);
  if (!/<p\b[^>]*class="[^"]*(?:lead|tagline)[^"]*"/i.test(header)) {
    failures.push(`${file}: header is missing one plain purpose statement`);
  }
  if (header.includes("For humans")) failures.push(`${file}: hero/header must explain the page without a "For humans" label`);
  if (text.includes("Details and data")) failures.push(`${file}: should not use the old reference/details divider`);
  if (/<h2[^>]*>\s*Reference\s*<\/h2>/.test(text)) failures.push(`${file}: should not label the lower page as Reference`);

  const invalidCommands = [
    [/(?:^|[^A-Za-z])cub install(?:\s|&lt;|<)/i, "cub install"],
    [/\bcub gitops\b/i, "cub gitops"],
    [/\bcub unit import\b/i, "cub unit import"],
    [/\bcub helm setup\b/i, "cub helm setup"],
    [/\bctc test\b/i, "ctc test"],
  ];
  for (const [pattern, label] of invalidCommands) {
    if (pattern.test(text)) failures.push(`${file}: contains unsupported public command ${JSON.stringify(label)}`);
  }

  for (const phrase of [
    "a plaque in the seat where the engine goes",
    "We guide; you decide",
    "The point is simple",
    "a reviewed object edit stays",
    "Argo and Flux are not affected because they prune declaratively",
    "bounded example",
    "public proof corpus",
    "install-time surface",
    "one named shape",
    "Base shape",
    "one common shape",
    "honest disposition",
    "Separate lanes make",
    "reported one lane at a time",
    "fresh live lane",
    "Live proof / disposition",
    "measured corpus",
    "Hook dispositions",
  ]) {
    if (text.includes(phrase)) failures.push(`${file}: contains retired or misleading prose ${JSON.stringify(phrase)}`);
  }
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

// Two AI-speak shapes are banned mechanically; the full pattern list lives in
// docs/planning/house-voice.md. A paragraph that opens by denying something
// teaches nothing until sentence two, and a predicate that unloads four
// abstract nouns signals breadth while informing nothing. Q&A pages are exempt
// from the opener rule because "Not yet." is the honest answer to a question.
const aiSpeakPages = [...new Set([...technicalEnglishPages, ...menuGuidePages, "site/serverless.html", "site/guides.html", "site/compare.html", "site/whats-new.html", "site/challenge.html"])];
const negationExemptPages = new Set(["site/hard-questions.html"]);
const abstractNouns = new Set(["changes", "approvals", "approval", "promotion", "promotions", "history", "rollouts", "rollout", "visibility", "governance", "workflows", "operations", "delivery", "observations", "releases", "scans", "records", "upgrades", "variants"]);
function paragraphTexts(html) {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => decodeBasicHtml(match[1]
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, " command ")
      .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}
for (const file of aiSpeakPages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  for (const text of paragraphTexts(html)) {
    if (!negationExemptPages.has(file) && /^(No|Not|Nothing|None|Never|Neither)[ .,:]/.test(text)) {
      failures.push(`${file}: paragraph opens with a denial; lead with what the reader gets: ${JSON.stringify(text.slice(0, 120))}`);
    }
    for (const match of text.matchAll(/\b([\w-]+(?: [\w-]+)?), ([\w-]+(?: [\w-]+)?), ([\w-]+(?: [\w-]+)?),(?: and| or)? ([\w-]+(?: [\w-]+)?)[.!?]/g)) {
      const items = [match[1], match[2], match[3], match[4]].map((item) => item.toLowerCase());
      if (items[3] === "more") continue;
      const abstract = items.filter((item) => abstractNouns.has(item.split(" ").pop())).length;
      if (abstract >= 3) {
        failures.push(`${file}: a sentence ends by unloading four abstract nouns; cap the list at three: ${JSON.stringify(match[0].slice(0, 120))}`);
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

const pageOwnershipRules = [
  {
    file: "site/deployment-reference.html",
    ordered: ["1 · Three ConfigHub terms", "2 · Choose a starting configuration"],
    forbidden: ["The short version: choose a deployment path"],
  },
  {
    file: "site/journey.html",
    ordered: ["1. Confirm what the App operates", "2. Confirm the configuration is saved", "3. Follow the normal order", "4. See common uses", "5. Open the working demonstrations"],
    forbidden: ["4. Start from an existing application", "cub variant upload --component payments"],
  },
  {
    file: "site/operations.html",
    ordered: ["1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Use managed ConfigHub when needed"],
  },
  {
    file: "site/demo-org.html",
    ordered: ["1. Open one Space and read its README", "2. See the records that explain the configuration", "3. Query and change the saved Kubernetes objects", "7. See how hooks, CRDs, and source records are represented", "8. See which checks can stop an apply", "9. Repeat the pattern with your own app"],
    forbidden: ["The sketch standing in for it", "one routed fixture", "Each proposal Unit mirrors"],
  },
];

for (const rule of pageOwnershipRules) {
  const fullPath = path.join(root, rule.file);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  let previous = -1;
  for (const heading of rule.ordered) {
    const position = html.indexOf(heading);
    if (position <= previous) {
      failures.push(`${rule.file}: sections are not ordered as ${rule.ordered.join(" -> ")}`);
      break;
    }
    previous = position;
  }
  for (const phrase of rule.forbidden ?? []) {
    if (html.includes(phrase)) failures.push(`${rule.file}: duplicates material owned by another guide: ${JSON.stringify(phrase)}`);
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
  if (!home.includes(`>${catalogCounts.components} components<`)) {
    failures.push(`site/index.html: the catalog route card must carry the count the catalog page publishes (${catalogCounts.components} components); a stale count contradicts the catalog page`);
  }
  if (!home.includes('href="./hard-questions.html"')) failures.push("site/index.html: home navigation must link the FAQ like every other page");
  if (!home.includes("Retained versions stay pullable")) failures.push("site/index.html: the front page must state that retained versions stay pullable from this catalog's registry");
}

const faqPath = path.join(root, "site/hard-questions.html");
if (fs.existsSync(faqPath)) {
  const faq = fs.readFileSync(faqPath, "utf8");
  if (!faq.includes("What happens when a chart's upstream source changes its terms?")) {
    failures.push("site/hard-questions.html: the FAQ must answer the upstream-terms-change question");
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
  const componentRows = [...catalogIndex.matchAll(/<tr data-chart-row data-kind="helm-chart"/g)].length;
  const readinessComponentRows = [...catalogIndex.matchAll(/data-evidence-surface="readiness-evidence"/g)].length;
  const publicationOnlyComponentRows = [...catalogIndex.matchAll(/data-evidence-surface="publication-only"/g)].length;
  const retainedVersionLinks = [...catalogIndex.matchAll(/data-retained-version="[^"]+"\s+href="\.\/[^\"]+\.html"/g)].length;
  const publicationReceiptLinks = [...catalogIndex.matchAll(/data-publication-receipt="[^"]+"/g)].length;
  const packagedConfigurationRecords = [...catalogIndex.matchAll(/data-packaged-configurations="[^"]+"/g)].length;
  if (componentRows < PUBLIC_CATALOG_COMPONENT_FLOOR) failures.push(`site/charts/index.html: component rows fell to ${componentRows}, below the floor of ${PUBLIC_CATALOG_COMPONENT_FLOOR}`);
  if (readinessComponentRows < TOP100_EVIDENCE_COMPONENT_FLOOR) failures.push(`site/charts/index.html: readiness component rows fell to ${readinessComponentRows}, below the floor of ${TOP100_EVIDENCE_COMPONENT_FLOOR}`);
  if (publicationOnlyComponentRows !== componentRows - readinessComponentRows) failures.push(`site/charts/index.html: ${componentRows} component rows minus ${readinessComponentRows} readiness rows should leave ${componentRows - readinessComponentRows} publication-only rows, found ${publicationOnlyComponentRows}`);
  if (retainedVersionLinks < PUBLIC_CATALOG_VERSION_FLOOR) failures.push(`site/charts/index.html: retained-version links fell to ${retainedVersionLinks}, below the floor of ${PUBLIC_CATALOG_VERSION_FLOOR}`);
  if (publicationReceiptLinks !== retainedVersionLinks) failures.push(`site/charts/index.html: ${retainedVersionLinks} retained versions but ${publicationReceiptLinks} publication-receipt links`);
  if (packagedConfigurationRecords !== retainedVersionLinks) failures.push(`site/charts/index.html: ${retainedVersionLinks} retained versions but ${packagedConfigurationRecords} per-version configuration records`);
  if (catalogIndex.includes("Search charts")) failures.push("site/charts/index.html: filter still uses chart-first naming");
  const successorsRecordedMarks = [...catalogIndex.matchAll(/Successors recorded:/g)].length;
  const successorToMarks = [...catalogIndex.matchAll(/Successor to </g)].length;
  if (successorsRecordedMarks < 5) failures.push(`site/charts/index.html: expected at least 5 'Successors recorded' rows from data/chart-successions, found ${successorsRecordedMarks}`);
  if (successorToMarks < 6) failures.push(`site/charts/index.html: expected at least 6 'Successor to' rows from data/chart-successions, found ${successorToMarks}`);
}

const chartPagesDir = path.join(root, "site/charts");
if (fs.existsSync(chartPagesDir)) {
  const chartPages = fs.readdirSync(chartPagesDir)
    .filter((name) => name.endsWith(".html") && name !== "index.html")
    .map((name) => path.join(chartPagesDir, name));
  if (chartPages.length !== catalogCounts.retainedVersions) failures.push(`site/charts: the catalog index lists ${catalogCounts.retainedVersions} retained versions but ${chartPages.length} package-version pages exist`);
  let retainedOnlyPages = 0;
  const requiredChartSections = [
    "What this page gives you",
    "Try This Chart",
    "Available Configurations",
    "What Has Been Tested",
    "What You Must Provide",
    "Before Production",
    "Source And Evidence Files",
  ];
  const forbiddenChartCopy = [
    "Proof Lanes",
    "Each lane proves",
    "useful operating shape",
    "proof grade needs user shaped variant",
    "wanted install shape",
    "curated proof lane",
    "bespoke teaching needed",
    "Production disposition",
    "ConfigHub absorbs",
    "Operator Playbooks And Fact Sheet",
  ];
  for (const fullPath of chartPages) {
    const html = fs.readFileSync(fullPath, "utf8");
    const file = path.relative(root, fullPath);
    if (html.includes("data-retained-only-version=")) {
      retainedOnlyPages += 1;
      const published = html.includes("Publication proof: recorded");
      const boundaryPhrases = published
        ? [
            "Publication proof: recorded · runtime proof: not inherited.",
            "It does not claim Argo CD sync, Kubernetes health, production readiness, or another version's test result.",
            "No version-specific runtime result is claimed here.",
            "You can check a pull yourself",
          ]
        : [
            "Publication proof: not yet earned · runtime proof: not inherited.",
            "it has not been published yet, so there is no publication receipt to show",
            "This page claims nothing about publication, Argo CD sync, Kubernetes health, or production readiness.",
            "No version-specific runtime result is claimed here.",
          ];
      for (const phrase of boundaryPhrases) {
        if (!html.includes(phrase)) failures.push(`${file}: retained-only page is missing proof boundary ${JSON.stringify(phrase)}`);
      }
    }
    for (const heading of requiredChartSections) {
      if (!html.includes(heading)) failures.push(`${file}: missing plain chart section ${JSON.stringify(heading)}`);
    }
    for (const phrase of forbiddenChartCopy) {
      if (html.toLowerCase().includes(phrase.toLowerCase())) failures.push(`${file}: contains internal chart wording ${JSON.stringify(phrase)}`);
    }
    if (!html.toLowerCase().includes("publication receipt")) failures.push(`${file}: does not expose its version-specific publication receipt`);
    if (!html.includes("Licenses: chart ")) failures.push(`${file}: does not state its chart license; every catalog page must carry one with its evidence basis`);
    if (html.includes("open the No ")) failures.push(`${file}: a fallback sentence was spliced into the evidence pointer; branch the sentence in the generator instead`);
    if (/href="\.\.\/\.\.\/packages\/[^"]*\/"/.test(html)) failures.push(`${file}: links a bare packages/ directory that GitHub Pages cannot serve; use the GitHub tree URL`);
  }
  const expectedRetainedOnlyPages = catalogCounts.retainedVersions - catalogCounts.readinessComponents;
  if (retainedOnlyPages !== expectedRetainedOnlyPages) failures.push(`site/charts: expected ${expectedRetainedOnlyPages} retained-only detail pages, found ${retainedOnlyPages}`);
}

// Copy-paste contract: command blocks on the hand-navigated pages must not
// carry a literal "$ " prompt, because pasting such a line into a shell fails.
// The decorative hero terminal marks its prompt with <span class="pr">.
const promptLintPages = fs.readdirSync(path.join(root, "site"))
  .filter((name) => name.endsWith(".html"))
  .map((name) => path.join(root, "site", name));
for (const fullPath of promptLintPages) {
  const html = fs.readFileSync(fullPath, "utf8");
  const file = path.relative(root, fullPath);
  if (/<pre><code>\$ /.test(html) || /\n\$ [a-z]/.test(html)) {
    failures.push(`${file}: a command block carries a literal "$ " prompt that breaks copy-paste`);
  }
}

const purposePageRules = [
  {
    file: "site/try.html",
    maxH2: 4,
    requiredLinks: ["./redis-walkthrough.html", "./how-it-works.html", "./testing.html", "./confighub.html"],
  },
  {
    file: "site/testing.html",
    maxH2: 5,
    requiredLinks: ["./try.html", "./journey.html", "./operations.html", "./confighub.html"],
  },
  {
    file: "site/kubara.html",
    maxH2: 6,
    requiredLinks: ["d/docs/demo/kubara/adoption.html", "d/docs/demo/kubara/gui-tour.html", "d/docs/demo/kubara/checkpoints.html", "d/docs/demo/kubara/single-platform.html"],
  },
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
  {
    file: "site/ai.html",
    maxH2: 6,
    requiredLinks: ["./journey.html", "d/data/ai-change-review-live-proof/summary.html"],
  },
  {
    file: "site/journey.html",
    maxH2: 5,
    requiredLinks: ["./testing.html", "./demo-org.html", "d/data/redis-upgrade-app-proof/summary.html"],
  },
  {
    file: "site/demo-org.html",
    maxH2: 9,
    requiredLinks: ["./charts/index.html", "./journey.html", "./variants.html"],
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

const choosingCommandsPath = path.join(root, "site/d/docs/user/choosing-commands.html");
if (fs.existsSync(choosingCommandsPath)) {
  const choosingCommands = fs.readFileSync(choosingCommandsPath, "utf8");
  const introduction = choosingCommands.indexOf("This guide explains which command path to use");
  const commandNote = choosingCommands.indexOf("What this command does.");
  const firstInstallerCommand = choosingCommands.indexOf("cub installer setup");
  if (!(introduction >= 0 && firstInstallerCommand > introduction && commandNote > firstInstallerCommand)) {
    failures.push("site/d/docs/user/choosing-commands.html: installer explanation must sit beside the first installer command, after the document introduction");
  }
}

const humanDocLeadChecks = [
  {
    file: "site/d/docs/user/choosing-commands.html",
    lead: "This guide explains which command path to use for a Helm chart.",
  },
  {
    file: "site/d/docs/user/chart-hooks-what-happens.html",
    lead: "Short answer: the catalog renders your chart's objects",
  },
  {
    file: "site/d/docs/demo/aicr/eks-h100-training-kubeflow.html",
    lead: "know AICR to follow it",
  },
  {
    file: "site/d/docs/reference/direct-cub-helm-model.html",
    lead: "This note covers the optional",
  },
];

const criticalDocChecks = [
  {
    file: "site/d/docs/user/variants-after-upload.html",
    required: [
      "<code>cub</code> v0.2.9",
      "installer-record",
      "cub variant promote my-redis-prod --dry-run -o mutations",
      "review that overlap before promotion",
    ],
    forbidden: [
      "currently prints nothing",
      "ConfigHub never sees the recipe",
      "Templates stay outside; data lives inside",
    ],
  },
  {
    file: "site/d/docs/user/chart-hooks-what-happens.html",
    required: [
      "A separate <code>no-crds</code> example has also run through Argo CD and Flux",
      "ConfigHub does not yet choose or run this chart-specific route automatically",
    ],
    forbidden: ["Its Argo CD, Flux, and upgrade paths have not run"],
  },
  {
    file: "site/d/docs/user/broken-chart-triage.html",
    required: [
      "Find Out Why A Chart Failed",
      "First find out whether the Kubernetes objects changed before deployment",
      "Check target prerequisites",
    ],
    forbidden: ["matrix <code>R</code> lane", "default-shaped", "active proof queue"],
  },
  {
    file: "site/d/docs/reference/what-hook-support-means.html",
    required: [
      "one status called a",
      "what the user still has to do",
      "Hooks from subcharts count",
    ],
    forbidden: ["phaseful actions", "dependency closure", "trust artifacts"],
  },
  {
    file: "site/d/docs/user/cub-deployment-path.html",
    required: [
      "Deploy ConfigHub Configuration Through OCI",
      "AICR recipe for AI infrastructure",
      "It does not render the source again during delivery",
    ],
    forbidden: ["The short version is"],
  },
  {
    file: "site/d/docs/user/gitops-adopter-guide.html",
    required: [
      "Use ConfigHub With Argo CD Or Flux",
      "A small tested setup Job answers the first two questions",
    ],
    forbidden: ["routed-hook fixture", "vs. raw Helm-through-Argo"],
  },
];

for (const check of humanDocLeadChecks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  const headerEnd = html.indexOf("</header>");
  const header = headerEnd >= 0 ? html.slice(0, headerEnd) : html;
  if (!header.includes(check.lead)) failures.push(`${check.file}: header does not use the guide's opening explanation`);
  if (header.includes("A repository document, rendered for the site")) failures.push(`${check.file}: header still uses the generic repository-document lead`);
  if (html.includes("<b>Generated at:</b>")) failures.push(`${check.file}: human guide still shows a generated timestamp before its instructions`);
  if (!html.includes("overflow-x: auto")) failures.push(`${check.file}: wide technical tables are not reachable on a phone-width page`);
}

for (const check of criticalDocChecks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: missing file`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  for (const term of check.required) {
    if (!html.includes(term)) failures.push(`${check.file}: critical guide text missing ${JSON.stringify(term)}`);
  }
  for (const phrase of check.forbidden) {
    if (html.includes(phrase)) failures.push(`${check.file}: contains retired guide text ${JSON.stringify(phrase)}`);
  }
}

const kubaraTutorialChapters = [
  ["site/d/docs/demo/kubara/adoption-1-choose.html", "adoption-2-generate.html"],
  ["site/d/docs/demo/kubara/adoption-2-generate.html", "adoption-1-choose.html", "adoption-3-git.html"],
  ["site/d/docs/demo/kubara/adoption-3-git.html", "adoption-2-generate.html", "adoption-4-oci.html"],
  ["site/d/docs/demo/kubara/adoption-4-oci.html", "adoption-3-git.html", "adoption-5-confighub-org.html"],
  ["site/d/docs/demo/kubara/adoption-5-confighub-org.html", "adoption-4-oci.html", "adoption-6-apps.html"],
  ["site/d/docs/demo/kubara/adoption-6-apps.html", "adoption-5-confighub-org.html", "gui-tour.html"],
];
for (const [file, ...links] of kubaraTutorialChapters) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: missing Kubara tutorial chapter`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8");
  for (const phrase of ["What ConfigHub adds", "Machine checkpoint", "Safe to stop"]) {
    if (!html.includes(phrase)) failures.push(`${file}: missing tutorial boundary ${JSON.stringify(phrase)}`);
  }
  if (!(html.includes("What remains Kubara") || html.includes("What stays Kubara"))) {
    failures.push(`${file}: missing the Kubara continuity boundary`);
  }
  if (!(html.includes("Screenshot checkpoint") || html.includes("Screenshot to capture") || html.includes("Screenshots to capture"))) {
    failures.push(`${file}: missing its screenshot checkpoint`);
  }
  for (const link of links) {
    if (!html.includes(`href="${link}"`)) failures.push(`${file}: missing linear tutorial link ${link}`);
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
