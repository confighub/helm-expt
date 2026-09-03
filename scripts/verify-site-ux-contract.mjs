#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import "./verify-configuration-review-contract.mjs";
import "./verify-config-processing-model.mjs";

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
    terms: ["See what your configuration will do", "Helm first", "AICR, Timoni, OCI and YAML examples", "Bring the configuration you or your AI just created", "ConfigHub Workshop renders it to the exact Kubernetes objects", "Check any chart before you install it", "Hand the result to Flux, Argo CD, or kubectl", "Find a configuration", "Check my config", "Promote my config", "I use Helm", "I run Flux or Argo CD", "I want a platform", "I need a stack", "cub config check redis", "cub stack sandbox eks-inference", "cub release publish", "cub plugin install confighub/cub-workshop", "Six starting questions", "What do you need help with?", "I need a configuration", "I have a configuration. Is it right?", "I have an accepted configuration. Can I promote it?", "Upload it into ConfigHub, release it, and promote it", "I want my own platform, with apps on it", "roll back one target without touching its peer", "I already run Flux or Argo CD", "I run many clusters. What needs attention?", "The vocabulary:", "see six worked examples", "Four common Helm questions", "small research sample, not customer or site usage data", "What will this install, and what must already exist?", "How is this candidate different from production?", "I set a value. Why did the rendered object not change?", "The chart does not expose the field I need. Must I fork it?", "Check the result and the limits", "ConfigHub Workshop", "UNOFFICIAL CONFIG TOOLS EXPERIMENT"],
  },
  {
    file: "site/ask.html",
    terms: ["Is my configuration right?", "Here is the chart and values my AI produced", "Use this page for your own chart, values, new version, or unexpected result", "In the website:", "build local instructions for the AI assistant you already use", "On the command line:", "cub helm", "cub installer", "Run the shared checks on your machine", "cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan", "cub check --format json --output cub-check.json ./rendered", "stable finding IDs", "copyable commands for keeping the same files and hashes in ConfigHub", "Do not upload private files", "Keep secrets out of the form", "question-context", "See an illustrative object review", "AI wrote these values. What did they actually change?", "I set a value. Why did the rendered object not change?", "If Helm ignored a setting, check first for a misspelled or wrong values path", "Can I upgrade this chart without breaking production?", "The chart does not expose the field I need. Must I fork it?", "How should Argo CD or Flux handle this chart's hooks and CRDs?", "Can I roll back to exactly what ran before?", "How is this candidate different from production?", "Where does this vulnerable image run, and how can I update it safely?", "What will this install, and what must already exist?", "Do these version and digest records identify the same bytes?", "Start with a chart and values", "catalog-search-from-form", "Search the Catalog for this chart and version", "Optional comparison: add what you run today", "No, keep this investigation private", "Installed Helm release", "Read the existing-release commands", "Build instructions for my AI", "WORKSHOP FINDING", "Check rendered objects in this browser", "I have rendered YAML", "Check these objects", "Helm, AICR, and Timoni must produce their Kubernetes objects locally first", "Timoni module or bundle", "This is a first check, not a Helm render", "The checks on this page run in your browser", "This page does not send your files to an AI service", "Do not add credentials or Secret values", "Add the result from <code>cub check</code>", "accepts it only when its object count and object-set hash match", "Keep or share the reviewed result", "Find matching Catalog records", "Download complete result", "Create a pull-request report from this result", "Open the ConfigHub tutorial", "See what this check does not prove", "Read the upgrade and rollback walkthrough", "Download review record", "Only completed checks count as evidence. Everything else is not checked and cannot support a safety claim.", "WorkshopResult schema", "ConfigurationReview schema", "See how to keep this in ConfigHub", "Candidate file hash", "Local findings remain advisory", "Copy commands to keep this result", "Use your own AI assistant", "Copy handoff for my AI", "Optional: propose a public Catalog case", "A maintainer must reproduce and classify the case", "Questions people are asking", "40 recent public Helm discussions", "not customer or site usage totals", "What happens to a public question", "within two business days", "Within seven days", "What happens next", "The review finds a credential surprise", "See one NGINX configuration go from local finding to ConfigHub gate to promotion", "find configurations that use existing Secrets", "The render is surprising", "publish the reviewed files as OCI", "Save the reviewed result in ConfigHub", "delivery limitations", "checks and publication receipts", "promotion and fleet examples"],
  },
  {
    file: "site/why-did-helm-ignore-my-values.html",
    terms: ["Why did Helm ignore my values?", "Runs on your laptop", "auth.passwrod", "same object-set hash", "Open the Redis values diagnostic", "Start this check"],
  },
  {
    file: "site/did-this-chart-version-change.html",
    terms: ["Did this chart version change upstream?", "A version string is only a label", "fairwinds-stable/goldilocks@10.3.0", "Open the upstream change record", "Start this check"],
  },
  {
    file: "site/why-do-dev-and-prod-differ.html",
    terms: ["Why do development and production differ?", "Needs a ConfigHub account", "development changed", "Staging stayed", "promotion receipt", "Start this check"],
  },
  {
    file: "site/does-cluster-match-approved-config.html",
    terms: ["Does the cluster match what we approved?", "Needs a ConfigHub account and a Kubernetes cluster", "found the replica change", "missed the environment-variable change", "What each path can tell you", "Local files or OCI", "kubectl apply", "Argo CD or Flux", "ConfigHub plus Argo CD or Flux", "Ordinary kubectl apply does not delete", "pruning is enabled and tested", "Workload readiness", "live drift receipt", "Read the current limitation"],
  },
  {
    file: "site/compare.html",
    terms: ["Versus what you already use", "Six jobs, four tools", "helm template", "kubectl diff", "Kustomize overlays", "you do not need this site", "This works with your tools, not instead of them", "local CI report"],
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
    file: "site/operations.html",
    terms: ["Operations", "1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Govern with the commercial product when needed", "5. Build an App from saved configuration", "6. Open the working App demonstrations", "Redis upgrade and rollback proof", "compare a variant with its base", "publish OCI for a GitOps controller", "check the cluster after delivery"],
  },
  {
    file: "site/try.html",
    terms: ["Try it: Redis in ten minutes", "14 Kubernetes objects", "The chart renders 13 objects", "adds one explicit Namespace", "1. Install cub and the package plugin", "2. Render the Redis package", "3. Inspect the result", "reuse-existing-secret", "cub plugin install confighub/installer", "kustomize version", "--output-oci", "You have finished the first example", "choose how to deploy the reviewed result", "check your configuration with your AI assistant", "choose a Helm, AICR, OCI, YAML, promotion, or fleet example", "continue the detailed Redis walkthrough", "keep the result in ConfigHub"],
  },
  {
    file: "site/redis-walkthrough.html",
    terms: ["Detailed Redis walkthrough", "Pull, inspect, and verify Redis", "reuse-existing-secret", "Redis 25.5.3", "27.0.0", "cub installer", "--output-oci", "No account: the package choice stays", "review a stored change", "What is <code>--pull</code>?", "Managed upgrade and rollback"],
  },
  {
    file: "site/confighub.html",
    terms: ["Upload a reviewed configuration into ConfigHub, then release and promote", "Uploading a reviewed configuration into ConfigHub is the step that needs an account", "Use the Catalog or Check my config before you sign up", "the same answer tomorrow", "ConfigHub shows exact diffs", "Upload a reviewed result into ConfigHub", "1. What ConfigHub adds", "The account path is three steps", "Upload also chains public configuration into your private org", "uploaded into a ConfigHub organization as a base variant", "publishes it so Argo CD or Flux pulls it", "2. See one exact handoff", "Review locally", "Publish the OCI", "Upload the base to ConfigHub", "ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345", "sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683", "attach both file hashes", "Provider None", "3. Continue from the retained answer", "Compare development and production", "Promote and publish", "Roll back", "Compare desired with live", "Roll out to a fleet", "4. Continue with the official tutorial", "Create a ConfigHub account", "official tutorial", "Read the ConfigHub blog"],
  },
  {
    file: "site/deploy-with-flux-or-argo.html",
    terms: ["Run it with Flux, Argo CD, or kubectl", "Keep the reconciler you have", "1. Reconcile a published component now", "2. Verify before you reconcile", "cub config verify", "3. Render, inspect, then apply with kubectl", "4. Change an image without signing in", "5. Check the record", "6. Read the current limits", "reuse-existing-secret", "7. Do this next"],
  },
  {
    file: "site/stack.html",
    terms: ["Build a stack from certified parts", "Combine components into custom stacks and application platforms", "A stack is a set of charts and YAML named in one manifest", "cub plugin install confighub/cub-workshop", "cub stack sandbox eks-inference", "=> CERTIFIED", "=> REJECTED", "1. What a stack is", "2. What certify checks", "3. Fourteen stacks ship with the plugin", "What each app needs", "kubara-shop-platform", "4. Upload it, then continue with the generic verbs", "cub stack publish", "5. The fleet", "125 deployments", "6. Receipts and boundaries", "remains <a href=\"./d/docs/planning/composition-certification.html\">proposed</a>"],
  },
  {
    file: "site/how-it-works.html",
    terms: ["Operate", "Come here after you have inspected the Kubernetes objects", "three things ConfigHub Workshop is", "1. Choose what happens next", "What you can do, and the command that does it", "With the workshop plugin", "With cub itself", "With cub installer", "cub stack sandbox kubara-shop-platform", "cub variant create demo-dev metrics-server-base", "cub variant promote cart-demo-dev --dry-run", "cub unit approve retail-deployment-cart", "cub fleet status demo-platform", "These run today as a plugin prototype", "cub plugin install confighub/cub-workshop", "OCI is the design center, not only the transport", "Local files", "Catalog installer OCI", "rendered OCI", "ConfigHub release OCI", "non-conflicting recorded changes remain", "2. Record the source and required setup", "materialization", "Literal YAML and configuration OCI already contain the objects", "flatten", "source and intent record", "lifecycle routes", "3. Decide where each change belongs", "4. Deliver the reviewed result", "kubectl apply", "pruning is enabled and tested", "What each path can prove", "5. Next step", "the managed examples", "the platform examples"],
  },
  {
    file: "site/charts/index.html",
    terms: ["id=\"chart-filter\"", "Component Catalog", "Find a Tested Configuration", "Choose a tested starting configuration for a Helm component, a typed module, or an AI infrastructure stack", "Each chart page shows the values", "check your own configuration", "A useful public result can become a new Catalog configuration", "Search Helm Configurations", "Search Helm charts", "Readiness", "Ready to try", "Review before use", "Package published; review before use", "Not ready yet", "Workload category", "Security and secrets", "Databases and messaging", "First configuration", "Helm charts shown; 139 retained package versions remain available", "all 139 retained package versions", "112 components", "Every version has a local detail page", "Packaged configurations by version", "What each catalog entry contains", "Why the catalog offers several configurations", "AI infrastructure configurations", "Timoni Redis", "anonymous OCI pull", "ConfigHub base and linked development variant", "No Helm chart matches these filters", "Check your chart and values locally", "Run one small model on CPU", "Inspect GPU state or an AICR platform", "Plan NVIDIA NIM serving", "Build the full EKS inference platform", "How the catalog handles required setup", "After you choose", "Choose how to deploy the reviewed configuration"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Choose a tested starting configuration for bitnami/redis@25.5.3", "Evidence labels:", "Catalog readiness: Ready to try", "Check this chart and version", "Try the package", "Plan an upgrade or promotion", "Keep it in ConfigHub", "First-configuration status", "Production status", "Where This Chart's Settings Come From", "pinned so a republished tag cannot change what you get", "What The Starting Configuration Records", "Try This Chart", "Available Configurations", "F2a · Chart default", "Helm output", "Saved in ConfigHub", "Additional scripts: apply it or upload it", "redis-existing-secret"],
  },
  {
    file: "site/d/docs/user/confighub-data-model.html",
    terms: ["The ConfigHub data model", "source + processing intent", "materialize exact Kubernetes objects", "decide the flattening lane for the intended path", "resolve lifecycle routes for the exact variant, destination, and runtime", "Protected local field", "Literal YAML and literal configuration OCI are already materialized", "no route required", "A source OCI and a literal configuration OCI have different jobs", "Helm's two linked records", "Do not create a fake render variant", "complete managed result is source and intent, exact configuration, lifecycle requirements, route resolutions, and runtime receipts"],
  },
  {
    file: "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
    terms: ["Serious Chart Example", "CRDs", "target facts"],
  },
  {
    file: "site/ask.html",
    terms: ["Find a direct answer", "1. Start with the basics", "2. Follow the configuration into ConfigHub", "3. Handle hooks, Secrets, and cluster requirements", "4. Check delivery, upgrades, and live results", "5. Understand values, variants, and Catalog coverage", "6. Understand free use and the evidence", "7. Read current limitations", "How is cub installer different from cub helm?", "My Helm chart broke", "What is safe for AI to change?", "SSA conflict gap"],
  },
  {
    file: "site/known-gaps.html",
    terms: ["Delivery limitations and known gaps", "Check one delivery result", "1. Read the current delivery limits", "2. Check the exact chart and configuration", "Fixed placeholder credentials", "SSA conflict ergonomics", "Do now:"],
  },
  {
    file: "site/docs.html",
    terms: ["Find instructions for the step you are doing", "All technical references", "Technical Guides", "Verification and evidence", "Learn by doing", "Run the short example", "Follow one package end to end", "Start with a configuration", "Prepare it for deployment", "Change or operate saved configuration", "Check a result or solve a problem", "More references", "Try Redis", "Component Catalog", "Worked Examples", "How do I check my own Helm values", "How do I turn reviewed files into a deployable OCI?", "What happens to hooks and CRDs?", "How do I make environment variants?", "How do I roll a change through a fleet?", "How complete is the live drift check?", "How do I check a result?", "What is not working yet?", "Browse all technical references", "Continue with ConfigHub"],
  },
  {
    file: "site/proof.html",
    terms: ["Why trust it", "Verified", "Certified", "Signed", "installer package signatures", "1. Read the current counts", "2. See what each test covers", "3. Check one claim yourself", "A claim is checked only when the named command or receipt covers it", "cub check --format json --output cub-check.json", "4. Check the harder charts", "5. Review security before release", "Scans and gates", "Claims register", "6. Find tests designed to expose failure", "7. See what this project does not claim", "Helm render match", "Hooks and prerequisites"],
  },
  {
    file: "site/quirks.html",
    terms: ["3. See how the image carries the work as routes", "What charts hide", "1. Check the chart page first", "2. Understand each extra requirement", "4. Check what remains before deployment", "Helm hooks", "CRDs", "Cluster lookups"],
  },
  {
    file: "site/apps.html",
    terms: ["Apps on a platform", "An app needs a platform under it", "1. Start from the system that owns it today", "2. Record the facts before making a change", "3. Decide where each piece belongs", "4. Check the app and put it in a stack", "cub app check shop-web", "cub stack sandbox shop-platform", "5. Choose the first managed step", "6. Open working examples"],
  },
  {
    file: "site/offering.html",
    terms: ["6. Read the supporting detail", "Offering", "1. Start without ConfigHub Server", "2. Add ConfigHub when the result must live and change", "3. Govern with the commercial product for private and production work", "4. Check what exists today", "5. Send a missing or broken public chart", "A hosted path without sign-in is planned"],
  },
  {
    file: "site/ai.html",
    terms: ["Use ConfigHub Workshop with your AI agent", "1. Install the ConfigHub Workshop skill", "2. Ask for one result", "composed a five-component stack and had it certified", "cub check --format json --output cub-check.json ./rendered", "advisory and does not apply configuration", "3. Keep the answer tied to records", "4. Use the same steps across source formats", "5. Compare one non-Helm source", "anonymous pull of the immutable public OCI", "ConfigHub base with a linked development variant", "Check the proof and limits", "6. Upload a reviewed result into ConfigHub", "7. How agents help maintain the Catalog", "Missing coverage means the claim is unchecked"],
  },
  {
    file: "site/testing.html",
    terms: ["Find a starting configuration", "The ConfigHub Workshop Catalog keeps exact versions", "1. What do you need?", "Six worked examples", "What will this package install?", "What did AI-written values change?", "Can I promote the reviewed change?", "How should hooks and CRDs run?", "Can I build a platform from tested parts?", "Can I inspect AI infrastructure without a GPU?", "2. Try a simple example: Redis", "See what Redis installs, before you install it", "cub installer setup", "reuse-existing-secret", "What you have", "Start with this example", "The advanced examples below continue into promotion, fleet rollout, and repeated operational jobs", "Each example includes the source files and the evidence behind its result", "Bring your own Helm chart and values", "An AICR recipe or inference stack", "A Timoni module", "Inspect the Timoni Redis example", "Base guide", "Development variant", "Proof and limits", "Get inference running", "certified-bundles/eks-inference-stack.html", "confighub/eks-inference", "cub helm template", "cub helm install", "--namespace &lt;namespace&gt;", "confighubplaceholder", "drops Helm hooks by default", "--include-hooks", "--skip-crds", "myapp-base", "myapp-helm", "3. Choose how to run a starting example", "4. Continue in ConfigHub", "5. Build or roll out a platform", "Build a small Kubara platform from tested Catalog components", "6. Use saved configuration for a repeated job", "Local or CI", "Hosted without sign-in", "Kubernetes YAML or an existing app"],
  },
  {
    file: "site/kubara.html",
    terms: ["Build an internal developer platform", "services your developers need", "AI can help with the selection and settings", "Kubara composes; ConfigHub governs; Argo reconciles.", "ConfigHub retains and promotes each of them", "Run this yourself", "cub cluster up --name demo --space demo-cluster", "Give your agent this prompt", "problem-chart.yml", "answered static chart questions at 96.7 percent", "Twelve of eighteen questions about time, live state, and accountability", "1. Choose services for your developers", "Website to command line", "Replace <code>https://github.com/acme/platform.git</code>", "env.example", "runtime-images.yaml", "Kubara does not deploy this record", "Package the reviewed Git revision as OCI", "See two applications added, promoted, released, and checked on the platform", "Benefits with explicit acceptance evidence", "Evidence or acceptance target", "What stays Kubara, and what ConfigHub adds", "refusing a real conflict rather than reporting one", "One adoption journey, in the user's order", "1. Choose components and wiring", "2. Run Kubara", "3. Push the complete hand-off to Git", "4. Import the Git revision and create OCI", "5. Load the selected ConfigHub organization", "6. Deploy applications", "What we show in ConfigHub", "The honest boundaries", "Keep all the detail", "current deterministic", "live receipt required"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/ask.html",
  "site/promote.html",
  "site/compare.html",
  "site/whats-new.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/confighub.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/operations.html",
  "site/docs.html",
  "site/kubara.html",
];

const humanSplitPages = [
  "site/index.html",
  "site/ask.html",
  "site/promote.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/confighub.html",
  "site/how-it-works.html",
  "site/variants.html",
  "site/operations.html",
  "site/docs.html",
  "site/kubara.html",
  "site/known-gaps.html",
  "site/quirks.html",
  "site/apps.html",
  "site/proof.html",
  "site/offering.html",
  "site/ai.html",
  "site/testing.html",
];

const guideOpeningChecks = [
  {
    file: "site/index.html",
    headerTerms: ["See what your configuration will do", "Helm first", "exact Kubernetes objects", "compares them with a configuration you already trust", "Catalog", "a reviewed result you can keep", "Certify a whole stack before anything runs", "No account until you upload", "Hand the result to Flux, Argo CD, or kubectl", "I use Helm", "I run Flux or Argo CD", "I want a platform", "I need a stack"],
  },
  {
    file: "site/ask.html",
    headerTerms: ["Is my configuration right?", "chart and values my AI produced", "Catalog", "Use this page for your own chart", "In the website", "In the website:", "On the command line", "On the command line:", "cub helm", "cub installer", "same files and hashes in ConfigHub", "Start with my chart and values", "See an illustrative object review", "I have rendered YAML"],
  },
  {
    file: "site/try.html",
    headerTerms: ["Try it: Redis in ten minutes", "14 Kubernetes objects", "Everything happens on your machine", "no account and no cluster"],
  },
  {
    file: "site/confighub.html",
    headerTerms: ["Upload a reviewed configuration into ConfigHub, then release and promote", "reviewed configuration into ConfigHub is the step that needs an account", "source, checks, approvals, and history", "Use the Catalog or Check my config before you sign up", "same answer tomorrow", "exact diffs", "Upload a reviewed result into ConfigHub", "Open the tutorial"],
  },
  {
    file: "site/how-it-works.html",
    headerTerms: ["Operate", "inspected the Kubernetes objects", "AICR recipe for AI infrastructure", "ConfigHub stores your approved configuration and its history"],
  },
  {
    file: "site/kubara.html",
    headerTerms: ["Build an internal developer platform", "services your developers need", "AI can help with the selection and settings", "Kubara composes; ConfigHub governs; Argo reconciles.", "platform components, developer tools, and applications", "ConfigHub retains and promotes each of them", "You can stop with Kubara's Git output and OCI packages"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["Decide where a change belongs", "should a change rebuild the base, or belong to one environment", "change the Helm source and rebuild the base", "use a derived ConfigHub variant"],
  },
  {
    file: "site/operations.html",
    headerTerms: ["Operations", "after an application and its target already exist", "review a change, approve it, deliver it, check the live result", "OCI carries a reviewed release"],
  },
  {
    file: "site/deploy-with-flux-or-argo.html",
    headerTerms: ["Keep the reconciler you have", "nothing on this page needs an account", "into a registry you control"],
  },
  {
    file: "site/ai.html",
    headerTerms: ["Use ConfigHub Workshop with your AI agent", "one configuration question", "the source, the Kubernetes objects and the diff"],
  },
];

const technicalEnglishPages = [...new Set([...humanSplitPages])];

const failures = [];
const expectedNavLabels = ["Catalog", "Stacks", "Operate", "Why trust it", "Docs", "ConfigHub Server"];

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

for (const file of ["site/ask.html"]) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => !/\btype=["']application\/json["']/i.test(match[1]));
  for (const [index, match] of scripts.entries()) {
    try {
      new vm.Script(match[2], { filename: `${file} inline script ${index + 1}` });
    } catch (error) {
      failures.push(`${file}: inline script ${index + 1} does not parse: ${error.message}`);
    }
  }
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

// A chart page is a public explanation, not a dump of matrix column names.
// Keep common internal phrases and the old one-letter check legend out of all
// generated version pages, not only the Redis page used by the positive check.
const chartPagesRoot = path.join(root, "site/charts");
for (const name of fs.readdirSync(chartPagesRoot)) {
  if (name === "index.html" || !name.endsWith(".html")) continue;
  const file = `site/charts/${name}`;
  const text = fs.readFileSync(path.join(root, file), "utf8");
  for (const phrase of [
    "Server side promotion receipt passed",
    "Candidate rows are planning rows",
    "The ConfigHub proof lane is missing",
    "changeset bound promote",
  ]) {
    if (text.includes(phrase)) failures.push(`${file}: contains internal Catalog wording ${JSON.stringify(phrase)}`);
  }
  if (/<b>[RCLYGPKV]<\/b>/.test(text)) {
    failures.push(`${file}: uses a one-letter check label instead of its full name`);
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
  // The shared navigation sits in the site banner above the page header.
  const banner = text.match(/<div class="cw-header" role="banner">[\s\S]*?<\/nav><\/div><\/div>/)?.[0] ?? "";
  const header = banner + (text.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "");
  if (/Generated at:\s*\d{4}-\d{2}-\d{2}T/.test(header)) {
    failures.push(`${file}: generated timestamp appears in the hero/header`);
  }
  if (header.includes("DRAFT WEB SITE PLEASE SEND COMMENTS TO AUTHORS")) {
    failures.push(`${file}: draft banner still appears in the hero/header`);
  }
  for (const term of ["ConfigHub Workshop", "UNOFFICIAL CONFIG TOOLS EXPERIMENT", "Catalog", "Stacks", "Operate", "Why trust it", "Docs", "ConfigHub Server"]) {
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
      // Raised from 25 to 32 during the register audit. A hard 25-word cap on
      // every sentence is what produced the site's uniform rhythm: 51% of
      // sentences carried no comma and no subordinator, and burstiness sat at
      // 0.60. 32 words admits one subordinate clause, which is what makes
      // consecutive sentences differ in shape. The cap still exists, so a
      // 40-word pile-up is still caught. Revert to 25 if the shorter ceiling
      // was deliberate for reasons outside the prose register.
      if (count > 32) {
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
const aiSpeakPages = [...new Set([...technicalEnglishPages, ...menuGuidePages, "site/deploy-with-flux-or-argo.html", "site/guides.html", "site/compare.html", "site/whats-new.html"])];
const negationExemptPages = new Set(["site/ask.html"]);
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
  for (const section of ["start", "worked-stories", "start-modes", "managed", "platforms", "apps"]) {
    if (!examples.includes(`id="${section}"`)) failures.push(`site/testing.html: missing example stage ${section}`);
  }
  for (const command of ["cub helm template", "cub helm install"]) {
    if (!examples.includes(command)) failures.push(`site/testing.html: bring-your-own flow is missing ${command}`);
  }
  for (const term of ["Find a starting configuration", "1. What do you need?", "A database or cache", "Cluster monitoring", "AI inference", "An internal developer platform", "Catalog components, Kubara, and AI", "A chart or configuration I already have", "2. Try a simple example: Redis"]) {
    if (!examples.includes(term)) failures.push(`site/testing.html: missing solution-chooser term ${term}`);
  }
}

const pageOwnershipRules = [
  {
    file: "site/operations.html",
    ordered: ["1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Govern with the commercial product when needed", "5. Build an App from saved configuration", "6. Open the working App demonstrations"],
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
  for (const href of ["./try.html", "./ask.html", "./promote.html", "./testing.html#worked-stories", "./charts/index.html", "./how-it-works.html", "./confighub.html", "./proof.html#check-one-claim", "./known-gaps.html"]) {
    if (!home.includes(`href="${href}"`)) failures.push(`site/index.html: missing story link ${href}`);
  }
  if (!home.includes(`>${catalogCounts.components} components<`)) {
    failures.push(`site/index.html: the catalog route card must carry the count the catalog page publishes (${catalogCounts.components} components); a stale count contradicts the catalog page`);
  }
  if (!home.includes('href="./docs.html"') || !fs.readFileSync(path.join(root, "site/docs.html"), "utf8").includes('href="./ask.html#faq"')) {
    failures.push("site/index.html: Docs must remain in the main navigation and link to the FAQ");
  }
  if (!home.includes("Every published version remains available from the public Catalog registry")) failures.push("site/index.html: the front page must state that published versions remain available from this catalog's registry");
}

const faqPath = path.join(root, "site/ask.html");
if (fs.existsSync(faqPath)) {
  const faq = fs.readFileSync(faqPath, "utf8");
  if (!faq.includes("What happens when a chart's upstream source changes its terms?")) {
    failures.push("site/ask.html: the FAQ must answer the upstream-terms-change question");
  }
}

const promotePath = path.join(root, "site/promote.html");
if (!fs.existsSync(promotePath)) {
  failures.push("site/promote.html: missing promotion workshop page");
} else {
  const promote = fs.readFileSync(promotePath, "utf8");
  for (const phrase of [
    "Can I promote this configuration?",
    "platform component, a developer tool, or an application",
    "1. Promotion review",
    "2. What are you changing?",
    "loads automatically",
    "changes an immutable StatefulSet field",
    "Exact configuration",
    "Next stage",
    "What blocks it",
    "Current result",
    "What changes",
    "What stays the same",
    "What you should test",
    "What to do next",
    "The comparison runs in your browser",
    "chart's 13 Kubernetes objects",
    "adds the explicit Namespace as the fourteenth deployable object",
    "Keep and run the promotion in ConfigHub",
    "Build a promotion review",
    "Roll back the selected release",
    "For a fleet rollout",
    "4. What has run",
    "Ordered stages and parallel targets",
    "Check hooks, CRDs, and setup order",
    "Check current evidence",
    "Promotion instructions",
  ]) {
    if (!promote.includes(phrase)) failures.push(`site/promote.html: missing user-facing promotion step ${JSON.stringify(phrase)}`);
  }
  const dataText = promote.match(/<script id="promotion-example-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!dataText) {
    failures.push("site/promote.html: missing embedded Redis promotion example");
  } else {
    try {
      const data = JSON.parse(dataText);
      for (const [label, yaml, version] of [
        ["current", data.currentYaml, "25.5.3"],
        ["candidate", data.candidateYaml, "27.0.0"],
      ]) {
        if (!yaml.includes(`helm.sh/chart: redis-${version}`)) failures.push(`site/promote.html: ${label} Redis example is not version ${version}`);
        if (yaml.split(/^---\s*$/m).filter((document) => document.trim()).length !== 13) failures.push(`site/promote.html: ${label} Redis example must contain 13 rendered Kubernetes objects`);
        if (!yaml.includes("secretName: redis-existing-secret")) failures.push(`site/promote.html: ${label} Redis example lost the external Secret reference`);
        if (/^kind:\s*Secret\s*$/m.test(yaml)) failures.push(`site/promote.html: ${label} Redis example must not contain credential data`);
        const replicaStatefulSet = yaml.split(/^---\s*$/m).find((document) => /^kind:\s*StatefulSet\s*$/m.test(document) && /^  name:\s*redis-replicas\s*$/m.test(document));
        if (!replicaStatefulSet || !/^  replicas:\s*2\s*$/m.test(replicaStatefulSet)) failures.push(`site/promote.html: ${label} Redis example must retain the two-replica change`);
      }
    } catch (error) {
      failures.push(`site/promote.html: embedded Redis promotion data is invalid JSON: ${error.message}`);
    }
  }
  const browserScript = path.join(root, "site/promote-config.js");
  if (!fs.existsSync(browserScript)) failures.push("site/promote-config.js: missing browser comparison script");
  else {
    const script = fs.readFileSync(browserScript, "utf8");
    for (const phrase of ["compareObjectSets", "PromotionReview", "canonicalFileText", "download-promotion-review", "download-promotion-current", "copy-ai-promotion"]) {
      if (!script.includes(phrase)) failures.push(`site/promote-config.js: missing ${JSON.stringify(phrase)}`);
    }
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
  const coverageQuestions = [
    "Can I pull these exact package bytes again?",
    "What does this chart contain?",
    "Does the recorded render match Helm?",
    "Did the supplied values change the render?",
    "Were hooks, CRDs, or setup steps checked?",
    "Did this version run on a local Kubernetes cluster?",
    "Did an OCI delivery through GitOps run?",
    "Did Helm and ConfigHub reach the same live result?",
    "Was the result compared on separate clusters?",
    "Was a ConfigHub promotion tested?",
    "Did this version string point at changed upstream bytes?",
  ];
  for (const fullPath of chartPages) {
    const html = fs.readFileSync(fullPath, "utf8");
    const file = path.relative(root, fullPath);
    if (html.includes("data-retained-only-version=")) {
      retainedOnlyPages += 1;
      const published = html.includes("Publication proof: recorded");
      const boundedRuntimeProof = html.includes('data-bounded-runtime-proof="managed-promotion"');
      const boundaryPhrases = published && boundedRuntimeProof
        ? [
            "Publication proof: recorded · managed upgrade proof: recorded for 85.3.3 to 86.1.0.",
            "A separate managed promotion proof covers this package as the 86.1.0 candidate",
            "Bounded version-specific result:",
            "This does not prove rollback, long soak, automatic route selection, or a standalone fresh install of 86.1.0.",
            "You can check a pull yourself",
          ]
        : published
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
    for (const phrase of [
      "Run shared local configuration checks",
      "cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan",
      "cub check --format json --output cub-check.json",
    ]) {
      if (!html.includes(phrase)) failures.push(`${file}: missing shared local check guidance ${JSON.stringify(phrase)}`);
    }
    for (const phrase of [
      "Local Configuration Checks",
      "We ran <code>cub check v0.7.3</code> against the exact rendered objects",
      "The result is advisory",
      "Exact input",
      "Full <code>cub check</code> result",
      "Exact YAML",
      "Separate Catalog review",
      "What this does not check:",
      "ConfigHub validation and approval are separate managed controls.",
    ]) {
      if (!html.includes(phrase)) failures.push(`${file}: missing shared check evidence ${JSON.stringify(phrase)}`);
    }
    if (!/sha256:[a-f0-9]{64}/.test(html)) failures.push(`${file}: shared check evidence does not expose an exact object digest`);
    if (!/data\/catalog-shared-checks\/receipts\/[^"#?]+\.json/.test(html)) failures.push(`${file}: shared check evidence does not link its full receipt`);
    if (!html.includes('../d/data/catalog-shared-checks/summary.html')) failures.push(`${file}: shared check evidence does not link the rendered human summary`);
    for (const question of coverageQuestions) {
      if (!html.includes(question)) failures.push(`${file}: does not state version-specific coverage for ${JSON.stringify(question)}`);
    }
    if (!html.includes("Not checked</strong> means this catalog has no version-specific result; it is not a pass.")) {
      failures.push(`${file}: does not explain that missing question coverage is not a pass`);
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
    requiredLinks: ["./try.html", "./operations.html#build-an-app", "./operations.html", "./confighub.html"],
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
    requiredLinks: ["./docs.html", "./confighub.html"],
    forbidden: ["Choose a starting configuration", "The recipe: your source of truth"],
  },
  {
    file: "site/docs.html",
    maxH2: 5,
    requiredLinks: ["./confighub.html", "#all-references"],
    forbidden: [],
  },
  {
    file: "site/confighub.html",
    maxH2: 4,
    requiredLinks: ["./how-it-works.html", "./docs.html"],
    forbidden: ["Choose one place to start"],
  },
  {
    file: "site/ai.html",
    maxH2: 7,
    requiredLinks: ["./.well-known/agent-skills/config-workshop/SKILL.md", "./ask.html", "./promote.html", "./confighub.html"],
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
