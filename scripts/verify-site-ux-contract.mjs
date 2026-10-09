#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import "./verify-configuration-review-contract.mjs";
import "./verify-config-processing-model.mjs";
import "./verify-site-inspection-record.mjs";

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

// The Catalog flags an AICR entry for review when its record says so, and the
// number moves with the retained AICR version. The flag sentence is required
// on the Catalog index when at least one AICR listing is flagged, and refused
// when none is, so the page cannot show a flag the data does not hold.
const aicrEntriesFlaggedForReview = countFlaggedAicrListings();

function countFlaggedAicrListings() {
  const listingDir = path.join(root, "site/listings");
  if (!fs.existsSync(listingDir)) return 0;
  return fs.readdirSync(listingDir)
    .filter((name) => name.startsWith("aicr-") && name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(listingDir, name), "utf8")))
    .filter((listing) => (listing.assessment?.stages ?? []).some((stage) => stage.id === "materialization" && stage.resultState === "watch"))
    .length;
}

const checks = [
  { file: "site/ai-chaos-in-production.html", terms: ["six local kind clusters", "two to three hours", "after onboarding", "40Mi", "mutating check", "The parity gate works.", "Workshop has not rerun", "teardown.sh --confighub", "agent contract", "assets/ai-chaos/r2-gui-refused-order.jpg"] },
  ...["index", "guides", "ai", "plugins", "bring-sveltos-into-confighub"].map(page => ({ file: `site/${page}.html`, terms: ["ai-chaos-in-production.html"] })),
  { file: "site/guides.html", terms: ['id="guides-deep-dives"', 'id="guides-gitops"', 'id="guides-stacks-and-platforms"'] },
  { file: "site/see-what-is-running.html", terms: ["cub scout map", "kubectl config current-context", "You can stop here", "view-and-change-config-with-uis.html"] },
  { file: "site/view-and-change-config-with-uis.html", terms: ["cub commander", "read-only", "separate", "scout-binding", "see-what-is-running.html"] },
  {
    file: "site/guides.html",
    terms: ["Five cool demos", "Topic based walkthroughs", "Helm questions", "Formats", "GitOps", "Stacks and platforms", "workshop-compose-guide.html", "workshop-adapt-guide.html", "workshop-match-guide.html", "guides.json"],
  },
  {
    file: "site/plugins.html",
    terms: ["Every public cub plugin, marked by its state", "cub plugin install confighub/cub-workshop", "cub plugin install confighub/kubara-confighub", "Released, ", "plugins.json"],
  },
  {
    file: "site/charts/bitnami-redis-25-5-3.html",
    terms: ["Keep this exact record", "examples/workshop-catalog-inspection/README.md", 'download="bitnami-redis-25-5-3-default.base-record.yaml"', 'download="bitnami-redis-25-5-3-default.render-intent.yaml"'],
  },
  ...["demo", "ai"].map((page) => ({
    file: `site/${page}.html`,
    terms: ["records/bitnami-redis-25-5-3-default.json", "Download record.json", "examples/workshop-catalog-inspection/README.md", "Inspect and keep an exact record", "workshop-compose-guide.html", "workshop-adapt-guide.html", "workshop-match-guide.html", "workshop-values-guide.html", "workshop-field-restore-guide.html", "workshop-upgrade-guide.html", "workshop-lifecycle-guide.html", "workshop-helm-questions-guide.html", "Answer the ten Helm questions", "expected results and a failure case"],
  })),
  ...[
    ["compose", ["cub stack sandbox", "--workspace", "resume.json", "refusal.json"]],
    ["adapt", ["Review your own file", "git show HEAD:k8s/deploy.yaml", "--protect", "cub unit update --upgrade", "cub config diff", "--exit-code", "revisionHistoryLimit"]],
    ["match", ["cub app match", "candidate.json", "mismatch.json", "unknown.json"]],
    ["values", ["Check your own chart", "--render-out candidate.yaml", "candidate-next.yaml", "Ask an assistant to do it", "mesage=reviewed", "corrected-diff.json", "baseline-repeat.yaml"]],
    ["field-restore", ["addition.json", "restoration.json", "review-hold.json"]],
    ["upgrade", ["unexpected-comparison.json", "review.md", "production"]],
    ["lifecycle", ["--no-hooks", "hook-diff.json", "lifecycle-incompatible"]],
    // The ten-question Guide is the known path a Helm user walks with an agent.
    // Each question must keep its four load-bearing parts: the pain id beneath
    // it, the local command, the gate plus its self-test, and the boundary. The
    // self-test is the part that decays first, because a passing gate looks
    // finished on its own, so it is named here explicitly.
    ["helm-questions", ["go-templated-yaml", "values-sprawl", "release-state-in-cluster", "cub config check metrics-server", "cub config check kube-prometheus-stack", "ai-install-shape:self-test", "ai-fleet-image:self-test", "ai-change-review:verify", "ed7efffe485b582b41f8d48dc568c8b85492fb74", "What this does not prove", "Follow one answer up the ladder"]],
  ].map(([guide, terms]) => ({
    file: `site/d/docs/user/workshop-${guide}-guide.html`,
    terms: ["56e261a87dc3b060a86474bc796d379dd9bb7f3d", ...terms],
  })),
  // The gpu-operator Guide renders a public chart that the Catalog also holds,
  // so it must say so, keep the one-field driver result, and keep the
  // limits of a file comparison beside the commands.
  {
    file: "site/d/docs/user/workshop-gpu-operator-upgrade-guide.html",
    terms: ["See what a gpu-operator upgrade changes", "cub plugin install confighub/cub-workshop@v0.6.56", "https://helm.ngc.nvidia.com/nvidia", "cub config diff gpu-operator-25.10.1.yaml gpu-operator-26.3.3.yaml --summary", "cub config diff gpu-operator-26.3.2.yaml gpu-operator-26.3.3.yaml --summary", "--set driver.version=580.126.20", "/spec/driver/version replace", "The Catalog holds this chart", "Hooks appear as ordinary objects", "--include-crds", "Exit 0 is not approval", "A task for an assistant", "workshop-upgrade-guide.html", "workshop-lifecycle-guide.html"],
  },
  // The stack Guide composes public Catalog entries and nothing more, so it
  // must keep the pinned plugin, the three entry ids, the compose and check
  // commands, the swapped entry, and the limits of a static check.
  {
    file: "site/d/docs/user/workshop-stack-from-catalog-guide.html",
    terms: ["Make a stack from Catalog entries", "cub plugin install confighub/cub-workshop@v0.6.57", "cub config list --role gpu", "nvidia-gpu-operator-v26-3-3-default", "nvidia-nvsentinel-v1-25-0-default", "nvidia-cluster-readiness-engine-v0-6-0-default", "cub stack compose --entry", "cub stack check ./gpu-node/stack.yaml", "nvidia-nvsentinel-v1-25-0-no-pod-monitor", "A passing composition is not runtime compatibility", "Routes are recorded and not executed", "The stack is not in ConfigHub", "The stack of three has not been deployed", "live-walk-entry-steps-2026-10-08.html", "A task for an assistant", "workshop-compose-guide.html", "compose-a-stack.html"],
  },
  {
    file: "site/index.html",
    terms: ["AICR recipes rendered as Argo CD Applications, and they have not been published or run", "Configuration catalog for Agents and Kubernetes", "Helm, AICR, OCI, YAML, Argo, Flux, Sveltos and more", "Other catalogs give you charts", "OCI is a shared transport for this configuration", "source-specific processing and checks", "run local checks without a ConfigHub account", "cub config check redis", "cub stack sandbox eks-inference", "cub release publish", "Getting Started Demos", "What is the Workshop?", "I have an existing app", "Check my charts and values", "Build a platform or fleet", "Set up my AI agent", "What the Catalog holds", "ConfigHub Workshop", "UNOFFICIAL CATALOG"],
  },
  {
    file: "site/ask.html",
    terms: ["Is my configuration right?", "Check your own chart and values", "question-guide", "why-did-helm-ignore-my-values.html#own-chart", "ai.html#confighub-review", "deploy-with-flux-or-argo.html#handover", "Use this page for your own chart, values, new version, or unexpected result", "Check it in this browser with no AI needed.", "Neither route deploys your configuration.", "The chart route builds instructions for your local AI assistant.", "cub helm", "cub installer", "Run the shared checks on your machine", "cub plugin install confighub/homebrew-tap@cub-scan-v0.7.3 --name scan", "cub check --format json --output cub-check.json ./rendered", "stable finding IDs", "Copy commands to keep this result", "Do not upload private files", "Keep secrets out of the form", "question-context", "See an illustrative object review", "AI wrote these values. What did they actually change?", "I set a value. Why did the rendered object not change?", "If Helm ignored a setting, check first for a misspelled or wrong values path", "Can I upgrade this chart without breaking production?", "The chart does not expose the field I need. Must I fork it?", "How should Argo CD or Flux handle this chart's hooks and CRDs?", "Can I roll back to exactly what ran before?", "How is this candidate different from production?", "Where does this vulnerable image run, and how can I update it safely?", "What will this install, and what must already exist?", "Do these version and digest records identify the same bytes?", "Start with a chart and values", "catalog-search-from-form", "Search the Catalog for this chart and version", "Optional comparison: add what you run today", "No, keep this investigation private", "Installed Helm release", "Read the existing-release commands", "Build instructions for my AI", "WORKSHOP FINDING", "Check rendered objects in this browser", "I have rendered YAML", "Check these objects", "Helm, AICR, and Timoni must produce their Kubernetes objects locally first", "Timoni module or bundle", "This is a first check, not a Helm render", "The checks on this page run in your browser", "This page does not send your files to an AI service", "Do not add credentials or Secret values", "Add the result from <code>cub check</code>", "accepts it only when its object count and object-set hash match", "Keep or share the reviewed result", "Find matching Catalog records", "Download complete result", "Create a pull-request report from this result", "Open the ConfigHub tutorial", "See what this check does not prove", "Read the upgrade and rollback walkthrough", "Download review record", "Only completed checks count as evidence. Everything else is not checked and cannot support a safety claim.", "WorkshopResult schema", "ConfigurationReview schema", "See how to keep this in ConfigHub", "Candidate file hash", "Local findings remain advisory", "Copy commands to keep this result", "Use your own AI assistant", "Copy handoff for my AI", "Optional: propose a public Catalog case", "A maintainer must reproduce and classify the case", "Four common Helm questions", "came up most often in a review of forty recent public Helm discussions", "Questions people are asking", "40 recent public Helm discussions", "not customer or site usage totals", "What happens to a public question", "What happens next", "The review finds a credential surprise", "See one NGINX configuration go from local finding to ConfigHub gate to promotion", "find configurations that use existing Secrets", "The render is surprising", "publish the reviewed files as OCI", "Save the reviewed result in ConfigHub", "delivery limitations", "checks and publication receipts", "promotion and fleet examples", "Choose the lowest-token route that can answer the question", "0 / 0 AI tokens", "6k–15k / 0.5k–2k", "10k–30k / 1k–4k", "20k–80k+ / 2k–8k", "Expected: an inventory, exact diff, check result, and downloadable hashes", "Not proven: source rendering the browser did not run", "The token-optimal path", "do not feed the model all of <code>configs.json</code> or <code>listings/index.json</code>", "From discovery to verified use: nine checkpoints", "1. Awareness", "2. Problem match", "3. Find", "4. Understand", "5. Start", "6. First value", "7. Delivery request", "8. Verified live", "9. Expand or return"],
  },
  {
    file: "site/why-did-helm-ignore-my-values.html",
    terms: ["Why did Helm ignore my values?", "Runs on your laptop", "auth.passwrod", "same object-set hash", "Check your own chart", "--repo https://oauth2-proxy.github.io/manifests", "--render-out candidate.yaml", "Keep the result for the next change", "cub config diff candidate.yaml candidate-next.yaml", "Know when ConfigHub helps", "2-my-fixes-survive", "Open the Redis values diagnostic", "workshop-values-guide.html#check-your-own-chart\">Values Guide</a> on your own chart", "Start this check"],
  },
  {
    file: "site/did-your-bitnami-chart-stop-pulling.html",
    terms: ["Did your Bitnami chart stop pulling?", "Check your own chart before you install", "cub config check render.yaml --images --exit-code", "images that pull anonymously: 0 of 1", "exits 1 when a registry confirms an image is missing", "Move your values to the successor", "comes back IGNORED", "a behavior the old chart turned on by default", "Exit 0 does not finish the move", "plan the move as a migration rather than a rename", "Compare what the two renders install", "cub config diff render.yaml successor.yaml --summary", "Matching counts do not prove matching behavior", "Keep the result for the next change", "Know when ConfigHub helps", "promotes that same switch to production as a recorded change", "keep it in ConfigHub so production gets the same reviewed change", "Find a successor in the Catalog"],
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
    file: "site/variants.html",
    terms: ["Turn a recipe and values into a base, and decide where a change belongs", "1. See the model", "payments-api/prod-us", "Three variant layers", "Four things called base", "Two words worth defining", "Change a config safely", "2. Tell what set a field", "Where each setting lives", "3. Understand a chart preset", "The claim", "What a chart preset records", "The short model", "4. See what is inside ConfigHub", "What the package contains", "5. Read the details", "Deciding whether to flatten"],
  },
  // Site IA phase 4, step 7b: where a change belongs, and how to make it, moved to its Guide.
  {
    file: "site/change-a-config-safely.html",
    terms: ["Change a config safely", "1. Decide where the change belongs", "Quick routing table", "Firm answers for four fields", "What protection means", "One worked example: ExternalDNS overlays", "The OCI boundary, and changing one field without ConfigHub", "2. Follow a safe flow", "The whole chain, with the variants labeled", "3. Run the commands", "reuse-existing-secret", "4. Open worked examples"],
  },
  // Site IA phase 4, step 7b: Operations split into two Guides, and its
  // commercial note went to the ConfigHub Server page.
  {
    file: "site/build-a-confighub-app.html",
    terms: ["Build a ConfigHub App", "1. Build a ConfigHub App", "Redis upgrade and rollback proof"],
  },
  {
    file: "site/confighub.html",
    terms: ["When the work carries private inputs, production responsibility"],
  },
  {
    file: "site/operate-a-fleet.html",
    terms: ["Operate a fleet", "1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Open the working App demonstrations", "compare a variant with its base", "publish OCI for a GitOps controller", "check the cluster after delivery", "Argo CD and Flux guide", "What each path can prove"],
  },
  {
    file: "site/try.html",
    terms: ["Try it: Redis in ten minutes", "Helm or <code>cub installer</code>?", "14 Kubernetes objects", "The chart renders 13 objects", "adds one explicit Namespace", "1. Install cub and the package plugin", "2. Render the Redis package", "3. Inspect the result", "reuse-existing-secret", "cub plugin install confighub/installer", "kustomize version", "--output-oci", "You have finished the first example", "choose how to deploy the reviewed result", "check your configuration with your AI assistant", "choose a Helm, AICR, OCI, YAML, promotion, or fleet example", "continue the detailed Redis walkthrough", "keep the result in ConfigHub"],
  },
  {
    file: "site/redis-walkthrough.html",
    terms: ["Detailed Redis walkthrough", "Pull, inspect, and verify Redis", "reuse-existing-secret", "Redis 25.5.3", "27.0.0", "cub installer", "--output-oci", "No account: the package choice stays", "review a stored change", "What is <code>--pull</code>?", "Managed upgrade and rollback"],
  },
  {
    file: "site/confighub.html",
    terms: ["Upload a reviewed configuration into ConfigHub, then release and promote", "Uploading a reviewed configuration into ConfigHub is the step that needs an account", "Use the Catalog or Check my config before you sign up", "the same answer tomorrow", "ConfigHub shows exact diffs", "Upload a reviewed result into ConfigHub", "1. What ConfigHub adds", "This page explains what that adds once you have an account", "The account path has three steps", "Upload also chains public configuration into your private org", "uploaded into a ConfigHub organization as a base variant", "publishes it so Argo CD or Flux pulls it", "During an upgrade, non-conflicting recorded changes remain", "Deployment commands", "The ConfigHub data model", "2. See one exact handoff", "Review locally", "Publish the OCI", "Upload the base to ConfigHub", "ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345", "sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683", "attach both file hashes", "Provider None", "3. Continue with the official tutorial", "Create a ConfigHub account", "official tutorial", "Read the ConfigHub blog"],
  },
  {
    file: "site/deploy-with-flux-or-argo.html",
    terms: ["Run it with Flux, Argo CD, or kubectl", "Keep the reconciler you have", "An OCI package works with your registry and reconciler", "1. Check a release before Argo CD or Flux takes it over", "change on every render", "A Flux HelmRelease runs Helm in the cluster", "cub config diff render-1.yaml render-2.yaml --exit-code", "lists each <code>lookup</code> in the chart's source", "spec.source.helm.releaseName", "<code>storageNamespace</code> to match the release Helm created", "flux create helmrelease grafana", "--storage-namespace=monitoring", "Give it a new name and create it before the upgrade", "Argo CD hardening Guide", "pass its <code>oci://</code> address in place of the name", "without writing Helm's release record", "For Argo CD, write the Application yourself", "Each chart names that value differently", "releaseName: grafana", "helm.sh/resource-policy: keep", "adopt-existing-argo-app.md", "ConfigHub helps once the handover is done", "2. Reconcile a published component now", "3. Verify before you reconcile", "cub config verify", "4. Render, inspect, then apply with kubectl", "Now deploy it, three ways", "5. Change an image without signing in", "6. Check the record", "source receipt -> object receipt -> delivery receipt -> runtime receipt", "reuse-existing-secret", "7. Do this next"],
  },
  {
    file: "site/stack.html",
    terms: ["Stacks \u00b7 ConfigHub Workshop", "<h1>Stacks</h1>", "Every shipped stack", "stacks.json", "cub stack check eks-inference", "Compose and check a stack", "Combine components into custom stacks and application platforms", "kubara-shop-platform", "How do I deploy with Argo CD or Flux?"],
  },
  // Site IA phase 4, step 5: the Apps how-to moved to its Guide.
  {
    file: "site/put-an-app-on-a-platform.html",
    terms: ["Check what your app needs, then check it against a platform", "What an app is", "A standalone app needs neither.", "Try it now", "cub app check shop-web", "cub stack sandbox shop-platform", "Follow the demo, step by step", "Deploy the first app, end to end", "https://confighub.github.io/helm-expt/site/examples/acme-web.yaml", 'href="./examples/acme-web.yaml"', "cub variant upload --component acme-web --variant base ./acme-web.yaml", "cub release publish acme-web-dev", "kubectl get application -n argocd acme-web-dev", "Bring an app that already runs", "Open working examples", "Read the known gaps"],
  },
  // Site IA phase 4, step 4: the Stacks how-to moved to its Guide.
  {
    file: "site/compose-a-stack.html",
    terms: ["Check your own app on a shipped platform", "cub stack sandbox web-platform --workspace my-platform", "cub plugin install confighub/cub-workshop@v0.6.56", "cub stack sandbox eks-inference", "=&gt; CHECKED", "=&gt; REFUSED", "Get a stack", "Want a ready-made one?", "What a stack is", "placed across many clusters as data", "An app, in turn, is", "cub stack from-kubara", "Checking your stack", "What each app needs", "Deploy a tiny first stack", "cub stack check web-tiny", "cub variant create dev first-stack-frontend-base --target workshop/target --namespace web", "cub release publish first-stack-backend-dev", "kubectl get applications -n argocd first-stack-frontend-dev first-stack-backend-dev", "The stacks that ship, by altitude", "Run and govern it", "What you can do with the workshop plugin", "cub fleet status demo-platform", "Fleet operations live here too", "cub changeorder create traefik-wave", "cub stack publish"],
  },
  {
    file: "site/proof.html",
    terms: ["remains <a href=\"./d/docs/planning/composition-certification.html\">proposed</a>"],
  },
  {
    file: "site/how-it-works.html",
    // Split across lines: verify-variant-command-surface.mjs scans line by line, so keep the
    // variant-create example and the unit-update space-flag example on separate lines, or it
    // reads the two unrelated tokens as one invalid invocation.
    terms: [
      "Operate", "How ConfigHub works", "Try it now", "1. Release", "2. Promote", "3. Gate and approve", "4. Roll back", "cub variant create demo-dev metrics-server-base", "cub release publish metrics-server-demo-dev", "cub variant promote cart-demo-dev --dry-run", "cub changeworkflow create --help", "AttestationPrerequisites", "ReleasePrerequisites", "cub variant approve cart-demo-dev",
      "cub unit update --space cart-demo-dev retail-deployment-cart --restore 2", "merely recording one does not install a gate", "Identical-content later revisions can remain covered", "docs.html#all-references",
    ],
  },
  {
    file: "site/config.html",
    terms: ["verdicts cover only the Argo CD Application wrapper of an AICR recipe", "A simple model for all your config, templates and recipes", "Start from what you have", "1. Follow one configuration from source to running", "2. See what each format becomes", "3. See whether a configuration can be flattened", "What each step means", "Four questions, asked in order", "What do I have?", "Can this destination accept it?", "The command at each stage", "Where ConfigHub fits", "defines what comes next", "The ways a configuration enters", "In terms you already use", "The four verdicts", "How the audited bases fall today", "One shape, from source to a synced digest"],
  },
  {
    file: "site/demo.html",
    terms: ["From one chart to a governed fleet in ten minutes", "3. Check a stack", "3. stack — check a whole stack, and watch a refusal (free)", "The first checks a real inference stack", "defines a stack as", "A platform, as", "is what a stack becomes once it runs under governance with apps on it"],
  },
  {
    file: "site/try-aicr.html",
    terms: ["Compare GPU nodes and pull an AICR config", "An &ldquo;AICR platform&rdquo; here is the composed set of Argo CD Applications AICR generates for one AI target, whether training or inference", "never becomes the running, governed platform that stack could be"],
  },
  {
    file: "site/oci.html",
    terms: ["Package and deliver it as OCI, and see what is signed", "1. Tell the OCI shapes apart, and match each to its consumer", "2. See how a certified bundle and a stack become one artifact", "3. See what a signature actually proves", "4. See how other tools already produce these shapes", "Nine shapes, side by side", "Which consumer needs which layout", "application/vnd.confighub.config.bundle.v1", "application/vnd.confighub.record.v1+json", "Every digest, and what it pins", "Where the receipt lives is still an open question", "The design center attaches it to the same digest as a referrer", "the catalog emits a receipt beside each published bundle", "What is signed today", "cub config verify", "cosign verify", "Timoni", "AICR is a manifest emitter rather than a competing format", "Kubara's own adoption step already compiles one OCI package per component"],
  },
  {
    file: "site/nimservice.html",
    terms: ["Choose a NIMService model variant", "<h2 id=\"variants\">Pick a model variant</h2>", "Every variant is <code>flatten-with-routes</code>", "NVIDIA gates the images and the model weights", "does not hold them and never redistributes them", "<th>Published as OCI</th>", "<th>GPU request</th>", "id=\"nimservice-publication\""],
  },
  {
    file: "site/formats.html",
    terms: ["model variants)", "An entry that needs nothing installed first is born flattened, and an entry that needs an operator or a Secret first is flatten-with-routes.", "<th>Published</th>", "Not published", "published as OCI", "flatten-with-routes, wrapper only, route recorded", "flagged for review"],
  },
  {
    file: "site/charts/index.html",
    terms: ["flatten-with-routes, wrapper only, route recorded, not published", ...(aicrEntriesFlaggedForReview > 0 ? ["<strong>This entry is flagged for review.</strong>"] : []), "It is not published and has not run.", "Listing JSON", "AICR entries", "An entry flagged for review reads <code>completed/watch</code>", "id=\"chart-filter\"", "Configs · ConfigHub Workshop", "<h1>Configs</h1>", "Search the catalog", "entries shown", "Readiness", "Ready to try", "Review before use", "Package published; review before use", "Not ready yet", "Workload category", "Security and secrets", "Databases and messaging", "First configuration", "Base variants by version", "Flattens as plain YAML?", "No entry matches these filters", "Check your chart and values locally", "provider-curated source variant", "A difference is not automatically a fault"],
  },
  // Site IA phase 4, step 3: the Catalog page's explanation moved to How
  // configuration works, its trust and verification to Why trust it, and its
  // next step to the ConfigHub Server page.
  {
    file: "site/config.html",
    terms: ["Every version has a local detail page", "What each catalog entry contains", "Read each result correctly", "A missing prerequisite is reported as blocked or not-run", "Why the catalog offers several configurations", "configuration processing model", "alignment report", "How the catalog handles required setup"],
  },
  {
    file: "site/proof.html",
    terms: ["Check why you can trust an entry", "The render matches Helm's own output", "A whole composition passes its checks", "A signature records who published the image"],
  },
  // Site IA phase 4, step 7b: sending a chart moved from Offering to its Guide.
  {
    file: "site/send-a-public-chart.html",
    terms: ["Send a missing or broken public chart", "1. Look for it in the Catalog", "2. Render it yourself, and note what differs", "3. Send the chart and values", "problem-chart.yml", "4. See what happens to it"],
  },
  // Site IA phase 4, step 7b: checking a claim moved to its Guide.
  {
    file: "site/check-a-claim-yourself.html",
    terms: ["Check a claim yourself", "1. Check one claim yourself", "A claim is checked only when the named command or receipt covers it", "cub check --format json --output cub-check.json", "2. Verify an entry yourself", "What this catalog does not claim", "cosign verify", "What stays available", "3. Choose the right verify command", "cosign verify-blob"],
  },
  {
    file: "site/take-a-config-further.html",
    terms: ["Take a config further", "1. Take an entry into a stack or into ConfigHub", "2. Continue from the retained answer", "Compare development and production", "Promote and publish", "Roll back", "Compare desired with live", "Roll out to a fleet"],
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
    terms: ["Delivery limitations and known gaps", "Rendering for Flux, Argo CD, or kubectl", "Plain <code>kubectl apply</code> does not infer CRD order", "Check one delivery result", "1. Read the current delivery limits", "2. Check the exact chart and configuration", "Fixed placeholder credentials", "SSA conflict ergonomics", "Do now:"],
  },
  {
    file: "site/docs.html",
    terms: ["Find your topic", "AI and agents", "GitOps", "Deployment and promotion", "Configuration as data", "How ConfigHub works", "Why trust it", "About Workshop", "catalog-docs.html", "records/bitnami-redis-25-5-3-default.json", "Download record.json", "examples/workshop-catalog-inspection/README.md", "Inspect and keep an exact record", "All technical references", "Technical Guides", "Verification and evidence", "Every doc, by area", "Try Redis", "Component Catalog", "Continue with ConfigHub"],
  },
  // Site IA phase 4, step 8: "Choose a tool and start" left How configuration works for its Guide.
  {
    file: "site/choose-a-tool.html",
    terms: ["Choose a tool and start", "1. Choose a tool and start", "Why this is more than a fast render command", "Three public jobs", "A graduation path, not a day-one choice", "When your chart is not in the catalog"],
  },
  // Site IA phase 4, step 8: explanation sections became agent docs.
  {
    file: "site/kubara-and-confighub.html",
    terms: ["Kubara and ConfigHub, explained", "Kubara manages a cluster's add-ons", "1. What stays Kubara, and what ConfigHub adds", "2. The current path: cub kubara", "bring-kubara-into-confighub.html", "It has run on kind only", "3. Benefits with explicit acceptance evidence", "Evidence or acceptance target", "current deterministic", "live receipt required", "4. The honest boundaries"],
  },
  {
    file: "site/aicr-configurations.html",
    terms: ["Where an AICR configuration comes from", "1. Where the selected configuration came from", "2. What the retained-configuration example proves"],
  },
  {
    file: "site/agents-maintain-the-catalog.html",
    terms: ["How agents help maintain the Catalog", "1. How agents help maintain the Catalog", "Propose useful configurations"],
  },
  {
    file: "site/public-questions.html",
    terms: ["What happens to a public question", "within two business days", "Within seven days"],
  },
  // Site IA phase 4, step 8: the model behind the four verbs became How ConfigHub works.
  {
    file: "site/how-confighub-works.html",
    terms: ["How ConfigHub works", "1. Where ConfigHub fits", "Come here after you have inspected the Kubernetes objects", "AICR recipe for AI infrastructure", "ConfigHub stores your approved configuration and its history", "2. The same commands run from a free check to a governed release", "deploy (a planned name, not yet a command)"],
  },
  // Site IA phase 4, step 8: the Docs page's task groups moved to the Guides list.
  {
    file: "site/guides.html",
    terms: ["Find a Guide by the step you are on", "Learn by doing", "Run the short example", "Follow one package end to end", "Start with a configuration", "Prepare it for deployment", "Change or operate saved configuration", "Check a result or solve a problem", "Worked Examples", "How do I check my own Helm values", "How do I turn reviewed files into a deployable OCI?", "What happens to hooks and CRDs?", "How do I make environment variants?", "How do I roll a change through a fleet?", "How complete is the live drift check?", "How do I check a result?", "What is not working yet?"]
  },
  {
    file: "site/proof.html",
    terms: ["Why trust it", "confirms the image is exactly what its receipt says", "refuses one that has none", "not that the configuration will run on your cluster", "A signature records who published the image", "1. Read the current counts", "2. See what each test covers", "3. Check the harder charts", "4. Review security before release", "Scans and gates", "Claims register", "5. Find tests designed to expose failure", "6. See what this project does not claim", "Helm render match", "Hooks and prerequisites"],
  },
  {
    file: "site/quirks.html",
    terms: ["See what happens to your chart's hooks, CRDs, and setup work", "1. Know the phases, the dispositions, and who runs the work", "2. Read the short answer and your practical choices", "3. See what a route tells you", "4. See how a bundle carries routes with the objects", "5. Understand each tracked requirement, chart by chart", "6. Check what remains before deployment", "automatic: false", "observe, then execute, then emit a receipt", "per-target", "target prerequisites", "Helm hooks", "CRDs", "Cluster lookups"],
  },
  // Site IA phase 4, step 7b: acting on hooks and CRDs moved to its Guide.
  {
    file: "site/handle-hooks-and-crds.html",
    terms: ["Handle hooks and CRDs", "1. Do the six steps", "Choose the chart preset", "2. Follow the worked examples through hooks and CRDs", "3. Decide who owns each CRD", "4. Stage target prerequisites before you apply", "CRD-guarded object"],
  },
  {
    file: "site/apps.html",
    terms: ["Apps \u00b7 ConfigHub Workshop", "<h1>Apps</h1>", "Every worked example app", "apps.json", "Put an app on a platform", "An app is a workload you bring."],
  },
  {
    file: "site/offering.html",
    terms: ["Offering", "1. See what is free, and what needs the commercial product", "2. Check what exists today", "3. Read the supporting detail", "Send a missing or broken public chart", "Payment starts at the first private or team need", "ConfigHub is free to start", "A hosted path without sign-in is planned"],
  },
  {
    file: "site/ai.html",
    terms: ["Use Claude or Codex for Kubernetes configuration", "1. Install the ConfigHub Workshop skill", "2. Ask for one result", "composed a five-component stack and had it certified", "cub check --format json --output cub-check.json ./rendered", "advisory and does not apply configuration", "3. Keep the answer tied to records", "4. Use the same steps across source formats", "5. Compare one non-Helm source", "Check the proof and limits", "6. Keep your fixes and reviewed results in ConfigHub", "Review an AI rewrite", "git show HEAD:k8s/deploy.yaml", "A diff catches the next rewrite; it does not prevent it", "cub unit update --space \"$SPACE\" app --upgrade", "expected/step-7.txt", "invoice-preservation/receipt.json", "kept all six", "app k8s/deploy.yaml --protect --change-desc", "@v0.6.56\ngit show HEAD:k8s/deploy.yaml", "protected local overrides", "invoice-protection/receipt.json", "it is not a general merge", "Missing coverage means the claim is unchecked", "Plan token cost before you start", "0 / 0 AI tokens", "6k–15k / 0.5k–2k", "8k–25k / 1k–3k", "15k–50k / 2k–6k", "20k–80k+ / 2k–8k", "Five rules for a token-optimal run", "do not load whole indexes or the whole catalog into context", "Expected:</strong> one rendered candidate", "Not proven:</strong> cluster admission, delivery, or workload health", "Expected first:</strong> a read-only inventory", "From discovery to verified use: nine checkpoints", "7. Delivery request", "8. Verified live", "9. Expand or return"],
  },
  {
    file: "site/testing.html",
    terms: ["Find a starting configuration", "The ConfigHub Workshop Catalog keeps exact versions", "1. What do you need?", "Six worked examples", "What will this package install?", "What did AI-written values change?", "Can I promote the reviewed change?", "How should hooks and CRDs run?", "Can I build a platform from tested parts?", "Can I inspect AI infrastructure without a GPU?", "2. Try a simple example: Redis", "See what Redis installs, before you install it", "cub installer setup", "reuse-existing-secret", "What you have", "Start with this example", "The advanced examples below continue into promotion, fleet rollout, and repeated operational jobs", "Each example includes the source files and the evidence behind its result", "Bring your own Helm chart and values", "An AICR recipe or inference stack", "A Timoni module", "Inspect the Timoni Redis example", "Base guide", "Development variant", "Proof and limits", "Get inference running", "certified-bundles/eks-inference-stack.md", "confighub/eks-inference", "cub helm template", "cub helm install", "3. Choose how to run a starting example", "4. Continue in ConfigHub", "5. Build or roll out a platform", "Build a small Kubara platform from tested Catalog components", "6. Use saved configuration for a repeated job", "Local or CI", "Hosted without sign-in", "Kubernetes YAML or an existing app"],
  },
  {
    file: "site/bring-kubara-into-confighub.html",
    terms: ["Bring Kubara's managed add-ons into ConfigHub", "Kubara composes; ConfigHub governs; Argo reconciles.", "1. See your platform the way ConfigHub would hold it", "about 15 minutes", "no ConfigHub account and no cluster", "cub plugin install confighub/kubara-confighub@v", "cub kubara init --out my-platform", "kubara --work-dir my-platform --config-file config.yaml --env-file .env generate --helm", "cub kubara plan my-platform", "cub kubara render my-platform --out my-platform-render", "Already run Kubara?", "the Workshop has checked every upstream chart version they pin", "To undo", "2. Govern it: apply, handover, check, handback", "What it changes", "How to undo it", "cub kubara apply my-platform --out my-platform-confighub", "bash my-platform-confighub/apply.sh", "cub kubara handover my-platform --out my-platform-confighub", "HUB_CONTEXT=&lt;hub context&gt; bash my-platform-confighub/handover.sh", "cub kubara check my-platform --hub-context &lt;hub context&gt;", "cub kubara handback my-platform --out my-platform-confighub", "--approve-stages dev", "exits with status 2 before it changes the hub", "After <code>kubara bootstrap</code>, run <code>handover.sh</code> again.", "Before you hand back", "cub-kubara.md#what-each-step-changes-and-how-to-undo-it", "3. Check the same platform as a Workshop stack", "cub stack from-kubara my-platform --out my-platform-stack", "cub stack check my-platform-stack/stack.yaml", "cub stack publish my-platform-stack/stack.yaml", "Need GitOps services and the shop app?", "kubara-gitops-shop", "./d/docs/user/workshop-compose-guide.html", "cub cluster up --name demo --space demo-cluster", "refusing a real conflict rather than reporting one", "4. Known limits", "It has run on kind only.", "The Healthy gate can read stale health.", "confighub/argobot#13", "An Argo CD self-upgrade through ConfigHub is not proven.", "The example index checks only the offline steps.", "5. The evidence behind this page", "Kind lab, recorded run", "Kind lab, recorded hand-back", "Kind lab on Kubara v0.16", "Kind lab, second approver", "Kind lab, re-bootstrap", "Kind lab on ConfigHub v0.8.0", "ConfigHub v0.8.0 or newer", "argobot v0.1.8", "runs no <code>cub</code> command", "Handover grants argobot more than live status needs.", "confighub/helm-expt#2063", "<code>check</code> judges health live", "proofs/from-kubara-live-2026-09-30", "not with a released binary", "6. Give your agent this prompt", "problem-chart.yml", "answered static chart questions at 96.7 percent", "Twelve of eighteen questions about time, live state, and accountability", "7. Earlier work, before cub kubara", "Website to command line", "Replace <code>https://github.com/acme/platform.git</code>", "env.example", "runtime-images.yaml", "Kubara does not deploy this record", "Package the reviewed Git revision as OCI", "See two applications added, promoted, released, and checked on the platform", "One adoption journey, in the user's order", "1. Choose components and wiring", "2. Generate the platform and push it to Git", "3. Check the platform as a stack", "4. Import the Git revision and create OCI", "5. Load the selected ConfigHub organization", "6. Deploy applications", "What we show in ConfigHub", "Keep all the detail"],
  },
];

const menuGuidePages = [
  "site/index.html",
  "site/ask.html",
  "site/promote.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/confighub.html",
  "site/charts/index.html",
  "site/variants.html",
  "site/operate-a-fleet.html",
  "site/build-a-confighub-app.html",
  "site/docs.html",
  "site/bring-kubara-into-confighub.html",
];

const humanSplitPages = [
  "site/bring-sveltos-into-confighub.html",
  "site/bring-argo-into-confighub.html",
  "site/bring-flux-into-confighub.html",
  "site/index.html",
  "site/ask.html",
  "site/promote.html",
  "site/try.html",
  "site/redis-walkthrough.html",
  "site/confighub.html",
  "site/how-it-works.html",
  "site/config.html",
  "site/variants.html",
  "site/oci.html",
  "site/operate-a-fleet.html",
  "site/build-a-confighub-app.html",
  "site/docs.html",
  "site/bring-kubara-into-confighub.html",
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
    headerTerms: ["Configuration catalog for Agents and Kubernetes", "ConfigHub Workshop lets an AI get Kubernetes configuration right on your behalf. It gives agents, and the people working with them, a catalog of tested configuration as data, tools to act on it, and a ConfigHub on-ramp.", "Start with your own chart or app", "Local checks need no account", "ConfigHub adds version history, approvals and releases", "Argo CD or Flux still delivers it using your existing setup."],
  },
  {
    file: "site/ask.html",
    headerTerms: ["Is my configuration right?", "Check your own chart and values", "Catalog", "Use this page for your own chart", "The chart route builds instructions for your local AI assistant", "Check it in this browser with no AI needed", "Neither route deploys your configuration", "Start with my chart and values", "See an illustrative object review", "I have rendered YAML", "Plan token cost"],
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
    headerTerms: ["Operate", "ConfigHub's own operations, the ones you run once a configuration is reviewed", "Try it now", "How ConfigHub works", "What ConfigHub adds"],
  },
  {
    file: "site/bring-kubara-into-confighub.html",
    headerTerms: ["Bring Kubara's managed add-ons into ConfigHub", "For teams who manage cluster add-ons with Kubara", "Manage your clusters' add-ons with Kubara, and approve every change to them in ConfigHub", "about 15 minutes and needs no account and no cluster", "Kubara is good at add-ons", "Kubara calls that set a platform", "Bring your own set.", "Promote, roll out and approve.", "Apps the same way.", "cub stack from-kubara --app", "cub app check", "Let an assistant do the work.", "shows its plan before it changes anything", "Kubara composes; ConfigHub governs; Argo reconciles.", "a base for each component and a variant for each cluster", "confighub/kubara-confighub", "#first-result", "#kubara-govern", "#kubara-stack", "#kubara-limits", "#kubara-evidence"],
  },
  {
    file: "site/variants.html",
    headerTerms: ["Turn a recipe and values into a base, and decide where a change belongs", "Render it with one set of values and you get a base", "Does the change rebuild the base, or does it belong to one environment", "make a derived ConfigHub variant"],
  },
  {
    file: "site/operate-a-fleet.html",
    headerTerms: ["Operate a fleet", "after an application and its target already exist", "approve it, deliver it, check the live result"],
  },
  {
    file: "site/deploy-with-flux-or-argo.html",
    headerTerms: ["Keep the reconciler you have", "nothing on this page needs an account", "into a registry you control"],
  },
  {
    file: "site/ai.html",
    headerTerms: ["Use Claude or Codex for Kubernetes configuration", "one configuration question", "the source, the Kubernetes objects and the diff", "Choose an AI journey", "Plan token cost", "Use the zero-token checks"],
  },
];

const technicalEnglishPages = [...new Set([...humanSplitPages])];

const failures = [];
if (aicrEntriesFlaggedForReview === 0 && fs.readFileSync(path.join(root, "site/charts/index.html"), "utf8").includes("<strong>This entry is flagged for review.</strong>")) {
  failures.push("site/charts/index.html: shows an entry flagged for review, and no AICR listing is flagged");
}
// The approved palette is light by default, even on a dark-mode device.
for (const page of ["index", "guides", "ai", "plugins", "ai-chaos-in-production"]) {
  const html = fs.readFileSync(path.join(root, `site/${page}.html`), "utf8");
  if (html.includes("prefers-color-scheme: dark") || !html.includes("color-scheme: light;")) {
    failures.push(`site/${page}.html must default to the approved light palette independently of device preference`);
  }
}
// Deep Dives are an extra entry point, never a replacement for topic discovery.
const topicGuides = JSON.parse(fs.readFileSync(path.join(root, "site/guides.json"), "utf8")).rows;
for (const [id, group] of [
  ["bring-argo-into-confighub", "gitops"],
  ["bring-flux-into-confighub", "gitops"],
  ["bring-sveltos-into-confighub", "gitops"],
  ["bring-kubara-into-confighub", "stacks-and-platforms"],
]) {
  if (!topicGuides.some(row => row.id === id && row.group === group)) failures.push(`Deep Dive ${id} must also remain in its original ${group} topic`);
}
const composeGuide = fs.readFileSync(path.join(root, "docs/user/workshop-compose-guide.md"), "utf8");
const composeAssistantTask = composeGuide.split("## A task for an AI assistant")[1]?.match(/```text\n([\s\S]*?)```/)?.[1] ?? "";
for (const term of ["After the refusal", "recovered/stack.yaml", "recovered/recovery.json", "Preserve incompatible unchanged", "prior successful"] ) {
  if (!composeAssistantTask.includes(term)) failures.push(`Compose assistant task omits separate recovery requirement: ${term}`);
}
const expectedNavLabels = ["Configs", "Stacks", "Apps", "Plugins", "Guides", "Docs", "ConfigHub Server"];

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
  // A container marked data-verbatim holds author prose reproduced word-for-word
  // from a docs source, kept identical to it. It is exempt from the
  // sentence-length register, so drop it before extracting prose blocks.
  const scoped = html.replace(/<(div|section)\b[^>]*\bdata-verbatim\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  return [...scoped.matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => {
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
// A chart page is the landing page for a whole chart, and it has a JSON file of
// the same name beside it. The rules for one version's page do not apply to
// it. Its own rules are near the end of this file.
const isChartLandingPage = (name) => fs.existsSync(path.join(chartPagesRoot, name.replace(/\.html$/, ".json")));
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
  for (const term of ["ConfigHub Workshop", "UNOFFICIAL CATALOG", "Configs", "Stacks", "Apps", "Plugins", "Guides", "Docs", "ConfigHub Server"]) {
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

// Human docs follow the writing rules of ASD-STE100, Simplified Technical
// English, without its dictionary (site IA phase 4, step 8). A step in a
// numbered list is a procedure sentence, at most 20 words; any other sentence
// is descriptive, at most 25; a paragraph holds at most six sentences. These
// pages are short docs for people, so the tighter register is deliberate
// here; the 32-word cap above still covers the rest of the site.
const steHumanDocPages = [
  "site/config.html",
  "site/variants.html",
  "site/oci.html",
  "site/quirks.html",
  "site/proof.html",
  "site/known-gaps.html",
  "site/how-confighub-works.html",
];
for (const file of steHumanDocPages) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${file}: missing file`);
    continue;
  }
  const html = fs.readFileSync(fullPath, "utf8").replace(/<(div|section)\b[^>]*\bdata-verbatim\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const procedures = new Set([...html.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)].flatMap((match) => proseBlocks(match[1])));
  for (const block of proseBlocks(html)) {
    const limit = procedures.has(block) ? 20 : 25;
    const kind = limit === 20 ? "procedure" : "descriptive";
    const parts = sentences(block);
    if (parts.length > 6) failures.push(`${file}: a paragraph has ${parts.length} sentences, above STE's six: ${JSON.stringify(block.slice(0, 120))}`);
    for (const sentence of parts) {
      const count = wordCount(sentence);
      if (count > limit) failures.push(`${file}: STE ${kind} sentence has ${count} words, above ${limit}: ${JSON.stringify(sentence.slice(0, 200))}`);
    }
  }
}

// Two AI-speak shapes are banned mechanically; the full pattern list lives in
// docs/planning/house-voice.md. A paragraph that opens by denying something
// teaches nothing until sentence two, and a predicate that unloads four
// abstract nouns signals breadth while informing nothing. Q&A pages are exempt
// from the opener rule because "Not yet." is the honest answer to a question.
const aiSpeakPages = [...new Set([...technicalEnglishPages, ...menuGuidePages, "site/deploy-with-flux-or-argo.html", "site/guides.html"])];
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
    file: "site/operate-a-fleet.html",
    ordered: ["1. Check the starting point", "2. Choose an operation", "3. Keep a fleet record", "4. Open the working App demonstrations"],
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
  for (const oldStructure of ["Five simple things", "Four things you can prove before you ship", "One resource, three depths", "What do you need help with?"]) {
    if (home.includes(oldStructure)) failures.push(`site/index.html: contains retired competing structure ${JSON.stringify(oldStructure)}`);
  }
  // The Configs line once called every entry tested and rendered to the
  // objects it installs. That overstates the AICR recipes that are rendered as
  // Argo CD Applications and were never published or run, so the old sentence
  // may not come back.
  if (home.includes("tested configurations, each rendered to the exact objects it installs")) {
    failures.push("site/index.html: the Configs line calls every entry tested and installable, which overstates the AICR recipes that are rendered and not published or run");
  }
  // Site IA phase 4: the home page keeps the mission, the five journeys, the
  // agent prompt and skill, and one line per Catalog section.
  for (const href of ["./charts/index.html", "./stack.html", "./apps.html", "./plugins.html", "./guides.html", "./docs.html", "./confighub.html", "./ai.html", "./try.html", "./llms.txt"]) {
    if (!home.includes(`href="${href}"`)) failures.push(`site/index.html: missing section or start link ${href}`);
  }
  for (const journey of ["journey-values-did-nothing", "journey-preserve-my-fixes", "journey-what-my-app-needs", "journey-before-gitops", "journey-installs-never-starts"]) {
    if (!home.includes(`href="./${journey}.html"`)) failures.push(`site/index.html: missing journey Guide ${journey}`);
    const page = path.join(root, `site/${journey}.html`);
    if (!fs.existsSync(page)) { failures.push(`site/${journey}.html: missing journey Guide`); continue; }
    const text = fs.readFileSync(page, "utf8");
    // Each journey Guide keeps both tracks, then the same steps on your own configuration.
    for (const term of ["Run it yourself", "./run.sh", "Or let your agent run it", "PROMPT.md", "The steps", "Use it on your own configuration", "Why it happens", "Where it continues"]) {
      if (!text.includes(term)) failures.push(`site/${journey}.html: missing "${term}"`);
    }
  }
  for (const heading of ["Getting Started Demos", "Common Questions"]) {
    if (!home.includes(`<p class="rail-h"><strong>${heading}</strong></p>`)) failures.push(`site/index.html: missing bold rail heading ${heading}`);
  }
  if (!home.includes('<p class="rail-h"><strong><a href="./ai.html">AI: Claude and Codex patterns</a></strong></p>')) failures.push("site/index.html: missing matching AI rail heading link");
  if (home.indexOf("Getting Started Demos") < 0 || home.indexOf("Getting Started Demos") > home.indexOf("<main>")) {
    failures.push("site/index.html: the five journeys must come first, before the main content");
  }
  if (!home.includes('href="./docs.html"') || !fs.readFileSync(path.join(root, "site/docs.html"), "utf8").includes('href="./ask.html#faq"')) {
    failures.push("site/index.html: Docs must remain in the main navigation and link to the FAQ");
  }
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
  // Every AICR row states its own verdict and publication state, read from
  // its listing. The generic sentences that used to stand in for them may not
  // return, the count beside the format must be the number of rows listed, and
  // a row with a listing must link it.
  const aicrRows = [...catalogIndex.matchAll(/<tr data-chart-row data-kind="ai-platform"[\s\S]*?<\/tr>/g)].map((match) => match[0]);
  const aicrChipCount = Number(catalogIndex.match(/AICR &amp; NIM <b>(\d+)<\/b>/)?.[1] ?? -1);
  if (aicrRows.length !== aicrChipCount) failures.push(`site/charts/index.html: the format panel counts ${aicrChipCount} AICR entries and the table lists ${aicrRows.length}`);
  for (const generic of ["Flattening is decided per generated layer", "An AI platform entry."]) {
    if (catalogIndex.includes(generic)) failures.push(`site/charts/index.html: an AICR row falls back to generic text ${JSON.stringify(generic)} in place of its own verdict and state`);
  }
  const aicrRowsWithoutState = aicrRows.filter((row) => !/, (not published|published)<\/td>/.test(row) && !row.includes("no Catalog record yet"));
  if (aicrRowsWithoutState.length > 0) failures.push(`site/charts/index.html: ${aicrRowsWithoutState.length} AICR row(s) do not say whether the entry is published`);
  const aicrRowsWithoutListing = aicrRows.filter((row) => !row.includes("no Catalog record yet") && !/href="\.\.\/listings\/aicr-[a-z0-9-]+\.json">Listing JSON<\/a> · <a href="[^"]+\/data\/base-variant-records\/records\/aicr-[a-z0-9-]+\.yaml">Record<\/a>/.test(row));
  if (aicrRowsWithoutListing.length > 0) failures.push(`site/charts/index.html: ${aicrRowsWithoutListing.length} AICR row(s) do not link their listing JSON and record`);
  if (!aicrRows.some((row) => row.includes(">eks-h100-training-kubeflow-v1-0-0<"))) failures.push("site/charts/index.html: the v1.0.0 AICR entry has a record and no row");
  const successorsRecordedMarks = [...catalogIndex.matchAll(/Successors recorded:/g)].length;
  const successorToMarks = [...catalogIndex.matchAll(/Successor to </g)].length;
  if (successorsRecordedMarks < 5) failures.push(`site/charts/index.html: expected at least 5 'Successors recorded' rows from data/chart-successions, found ${successorsRecordedMarks}`);
  if (successorToMarks < 6) failures.push(`site/charts/index.html: expected at least 6 'Successor to' rows from data/chart-successions, found ${successorToMarks}`);
}

const chartPagesDir = path.join(root, "site/charts");
if (fs.existsSync(chartPagesDir)) {
  const chartPages = fs.readdirSync(chartPagesDir)
    .filter((name) => name.endsWith(".html") && name !== "index.html" && !isChartLandingPage(name))
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
    if (!html.includes('data/catalog-shared-checks/summary.md')) failures.push(`${file}: shared check evidence does not link the human summary`);
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
    requiredLinks: ["./try.html", "./build-a-confighub-app.html#build-an-app", "./operate-a-fleet.html", "./confighub.html"],
  },
  {
    file: "site/bring-kubara-into-confighub.html",
    maxH2: 7,
    requiredLinks: ["d/docs/demo/kubara/adoption.html", "d/docs/demo/kubara/gui-tour.html", "d/docs/demo/kubara/checkpoints.html", "d/docs/demo/kubara/single-platform.html"],
  },
  {
    file: "site/charts/index.html",
    maxH2: 7,
    requiredLinks: ["../confighub.html#promote-a-change"],
  },
  {
    file: "site/how-it-works.html",
    maxH2: 4,
    requiredLinks: ["./docs.html", "./confighub.html"],
    forbidden: ["Choose a starting configuration", "The recipe: your source of truth"],
  },
  {
    file: "site/config.html",
    maxH2: 7,
    requiredLinks: ["./charts/index.html", "./confighub.html"],
  },
  {
    file: "site/oci.html",
    maxH2: 4,
    requiredLinks: ["./config.html", "./stack.html", "./deploy-with-flux-or-argo.html"],
  },
  {
    file: "site/quirks.html",
    maxH2: 9,
    requiredLinks: ["./charts/index.html", "./matrix.html"],
  },
  {
    file: "site/docs.html",
    maxH2: 5,
    requiredLinks: ["./confighub.html", "#all-references"],
    forbidden: [],
  },
  {
    file: "site/confighub.html",
    maxH2: 5,
    requiredLinks: ["./how-it-works.html", "./docs.html"],
    forbidden: ["Choose one place to start"],
  },
  {
    file: "site/ai.html",
    maxH2: 7,
    requiredLinks: ["./.well-known/agent-skills/config-workshop/SKILL.md", "./ask.html", "./promote.html", "./confighub.html", "./apps.html", "./guides.html", "./bring-argo-into-confighub.html", "./bring-flux-into-confighub.html", "./bring-sveltos-into-confighub.html", "./bring-kubara-into-confighub.html"],
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
  const commandNote = choosingCommands.indexOf("Here is what the command does.");
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
  if (text.includes("prefers-color-scheme: dark") || text.includes('data-theme="dark"') || text.includes("color-scheme: light dark")) {
    failures.push(`${path.relative(root, file)}: can revert from the fixed Workshop light appearance to a dark theme`);
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
    if (name !== "index.html" && !isChartLandingPage(name) && !text.includes("id=\"setting-sources\"")) {
      failures.push(`site/charts/${name}: missing the Helm values, ConfigHub changes, install work, and live state provenance view`);
    }
  }
}

// Deployment entry is a first-class route in every desktop and mobile left menu.
function checkServerEntryMenus(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { checkServerEntryMenus(file); continue; }
    if (!item.name.endsWith(".html")) continue;
    const html = fs.readFileSync(file, "utf8");
    for (const menu of html.matchAll(/<(?:nav|details) class="(?:home-rail|cw-sidebar|cw-mobile-nav)"[^>]*>([\s\S]*?)<\/(?:nav|details)>/g)) {
      if (!/<strong><a href="[^"]*confighub\.html#start-managing">ConfigHub: Deploy and manage<\/a><\/strong>/.test(menu[1])) {
        failures.push(`${path.relative(root, file)}: left menu lacks the prominent ConfigHub deployment entry`);
      }
    }
  }
}
checkServerEntryMenus(path.join(root, "site"));
const serverPage = fs.readFileSync(path.join(root, "site/confighub.html"), "utf8");
for (const id of ["start-managing", "import-and-deploy", "load-a-repo", "live-and-repo", "promote-a-change", "roll-out-a-change", "managed-result", "exact-handoff", "review-tutorial"]) {
  if (!serverPage.includes(`id="${id}"`)) failures.push(`site/confighub.html: missing action or retained section ${id}`);
}

// The short onboarding Guides must remain reachable without a GitHub detour,
// and their install/reference versions must agree with the plugin registry.
const onboardingPlugins = JSON.parse(fs.readFileSync(path.join(root, "site/plugins.json"), "utf8")).rows;
for (const kind of ["argo", "flux"]) {
  const name = `bring-${kind}-into-confighub.html`;
  const html = fs.readFileSync(path.join(root, "site", name), "utf8");
  const plugin = onboardingPlugins.find((row) => row.id === kind);
  for (const entry of ["index.html", "plugins.html", "confighub.html", "guides.html"]) {
    if (!fs.readFileSync(path.join(root, "site", entry), "utf8").includes(name)) failures.push(`${entry}: missing direct ${kind} onboarding Guide link`);
  }
  if (!html.includes(plugin.install) || !html.includes(`/blob/${plugin.release.tag}/cub-${kind}/docs/`)) failures.push(`${name}: install or reference does not match released plugin`);
  const sections = ["preview-setup", "save-confighub", "connect-deployment", "change-approve-release"];
  if (sections.some((id) => !html.includes(`id="${id}"`))) failures.push(`${name}: missing onboarding stage`);
  const planAt = html.indexOf(`cub ${kind} plan .`);
  const importAt = html.indexOf('bash onboard/apply.sh');
  if (planAt < 0 || importAt <= planAt) failures.push(`${name}: preview must precede ConfigHub import`);
}

// Downloadable Guide inputs are part of the runnable path, not decorative
// links. Resolve both the relative browser link and the public curl URL back
// into the generated site tree so a renamed or omitted asset fails before
// publication instead of becoming a GitHub Pages 404.
const downloadableGuideAssets = [
  {
    page: "site/put-an-app-on-a-platform.html",
    href: "./examples/acme-web.yaml",
    publicUrl: "https://confighub.github.io/helm-expt/site/examples/acme-web.yaml",
    expectedYamlDocuments: 4,
  },
];
const publicSitePrefix = "https://confighub.github.io/helm-expt/site/";
for (const asset of downloadableGuideAssets) {
  const pagePath = path.join(root, asset.page);
  if (!fs.existsSync(pagePath)) {
    failures.push(`${asset.page}: missing page for downloadable Guide asset`);
    continue;
  }
  const html = fs.readFileSync(pagePath, "utf8");
  if (!html.includes(`href="${asset.href}"`)) failures.push(`${asset.page}: missing asset link ${asset.href}`);
  if (!html.includes(asset.publicUrl)) failures.push(`${asset.page}: missing public download URL ${asset.publicUrl}`);

  const relativeAssetPath = path.resolve(path.dirname(pagePath), asset.href);
  const publicRelativePath = asset.publicUrl.startsWith(publicSitePrefix)
    ? asset.publicUrl.slice(publicSitePrefix.length)
    : null;
  const publicAssetPath = publicRelativePath ? path.resolve(root, "site", publicRelativePath) : null;
  if (!publicAssetPath) failures.push(`${asset.page}: download URL is outside the Workshop site prefix`);
  if (publicAssetPath && publicAssetPath !== relativeAssetPath) {
    failures.push(`${asset.page}: browser link and public download URL resolve to different assets`);
  }
  if (!fs.existsSync(relativeAssetPath)) {
    failures.push(`${asset.page}: downloadable Guide asset is missing at ${path.relative(root, relativeAssetPath)}`);
    continue;
  }
  const yaml = fs.readFileSync(relativeAssetPath, "utf8").trim();
  const documentCount = yaml ? yaml.split(/^---\s*$/m).filter((document) => document.trim()).length : 0;
  if (documentCount !== asset.expectedYamlDocuments) {
    failures.push(`${path.relative(root, relativeAssetPath)}: expected ${asset.expectedYamlDocuments} YAML documents, found ${documentCount}`);
  }
}

// Every Catalog entry page carries the same five steps under one fixed
// heading, built from the nextSteps array of the entry's own listing. This
// checks the pages against the listings, which is what keeps the block honest:
// every entry has exactly one block, the block shows the states its listing
// records, and a step with a missing precondition shows no command.
// A chart page repeats the block of one entry, the newest version's default
// base, so a reader who lands there can act. That entry's own page still
// carries the block. The repeat is counted apart from the one-page rule and
// checked against the chart's file further down.
const chartPageBlocks = new Map();
const ENTRY_STEPS_HEADING = '<h2 id="use-in-confighub">Use this entry in ConfigHub</h2>';
const ENTRY_STEP_LABELS = ["Get the exact objects", "Compare with another version or base", "Upload it as a variant", "Deploy it", "Promote a change"];
const ENTRY_STEP_STATE_TEXT = {
  "run-for-this-entry": "Run for this entry",
  "partly-run-for-this-entry": "Partly run for this entry",
  "not-run-for-this-entry": "Not run for this entry",
  "blocked-for-this-entry": "Blocked for this entry",
  "not-available": "Not available yet",
};
const ENTRY_STEPS_COMMENT_MAX = 88;
{
  const listingDir = path.join(root, "site/listings");
  const listings = new Map();
  if (fs.existsSync(listingDir)) {
    for (const name of fs.readdirSync(listingDir).filter((entry) => entry.endsWith(".json") && entry !== "index.json").sort()) {
      const listing = JSON.parse(fs.readFileSync(path.join(listingDir, name), "utf8"));
      listings.set(listing.identity.id, listing);
    }
  }
  const htmlFiles = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".html")) htmlFiles.push(full);
    }
  };
  for (const dir of ["site/charts", "site/d"]) {
    if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  }
  // An entry whose page is a generated site page, outside the chart pages and
  // the rendered docs. Each one must carry the block like any other entry page.
  const entrySitePages = ["site/nimservice.html"];
  for (const file of entrySitePages) {
    if (fs.existsSync(path.join(root, file))) htmlFiles.push(path.join(root, file));
    else failures.push(`${file}: the entry page is missing`);
  }
  const blocksById = new Map();
  for (const fullPath of htmlFiles) {
    const html = fs.readFileSync(fullPath, "utf8");
    const file = path.relative(root, fullPath);
    const isChartPage = /<body data-chart-page="/.test(html);
    const isEntryPage = (file.startsWith("site/charts/") && file !== "site/charts/index.html") || entrySitePages.includes(file);
    const section = html.match(/<section class="entry-steps"[\s\S]*?<\/section>/)?.[0] ?? "";
    if (!section) {
      if (isEntryPage) failures.push(`${file}: a Catalog entry page has no ${JSON.stringify("Use this entry in ConfigHub")} block`);
      continue;
    }
    if ([...html.matchAll(/<section class="entry-steps"/g)].length !== 1) failures.push(`${file}: the entry-steps block appears more than once`);
    if (!section.includes(ENTRY_STEPS_HEADING)) failures.push(`${file}: the entry-steps block does not carry its one fixed heading`);
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    if (!header.includes('href="#use-in-confighub"')) failures.push(`${file}: the top of the page does not link the entry-steps block`);
    if (!/<aside class="agent-note"[^>]*>[\s\S]*?nextSteps[\s\S]*?<\/aside>/.test(section)) failures.push(`${file}: the entry-steps block does not say in an agent box which listing fields it was built from`);
    if (section.includes("<table")) failures.push(`${file}: the entry-steps block holds a table, which does not fit a phone-width page`);
    // Phone width: a command block scrolls inside itself, and long ids,
    // references and listing links in the prose break instead of widening
    // the page.
    if (!html.includes(".entry-steps pre { max-width: 100%; }") || !html.includes("overflow-x: auto")) failures.push(`${file}: the entry-steps command blocks are not held to the page width`);
    if (!html.includes(".entry-steps p, .entry-steps .agent-note, .entry-steps :not(pre) > code { overflow-wrap: anywhere; }")) failures.push(`${file}: long ids in the entry-steps prose can widen a phone-width page`);
    const chunks = section.split(/(?=<(?:div|details class="entry-steps-base") data-entry-steps=")/).slice(1);
    if (chunks.length === 0) failures.push(`${file}: the entry-steps block names no entry`);
    for (const chunk of chunks) {
      const id = chunk.match(/data-entry-steps="([^"]+)"/)?.[1] ?? "";
      const listing = listings.get(id);
      if (!listing) {
        failures.push(`${file}: the entry-steps block names ${id}, which has no listing`);
        continue;
      }
      if (isChartPage) {
        if (!chartPageBlocks.has(file)) chartPageBlocks.set(file, []);
        chartPageBlocks.get(file).push(id);
      } else {
        if (!blocksById.has(id)) blocksById.set(id, []);
        blocksById.get(id).push(file);
      }
      const steps = [...chunk.matchAll(/<div class="entry-step" data-step="([^"]+)" data-state="([^"]+)">([\s\S]*?)<\/div>/g)];
      if (steps.length !== ENTRY_STEP_LABELS.length) {
        failures.push(`${file}: ${id} shows ${steps.length} steps, and every entry shows ${ENTRY_STEP_LABELS.length}`);
        continue;
      }
      steps.forEach((match, index) => {
        const [, stepId, state, body] = match;
        const recorded = listing.nextSteps?.[index] ?? {};
        if (!body.includes(`<h3>${index + 1}. ${ENTRY_STEP_LABELS[index]} `)) failures.push(`${file}: ${id} step ${index + 1} is not ${JSON.stringify(ENTRY_STEP_LABELS[index])}`);
        if (recorded.id !== stepId || recorded.state !== state) {
          failures.push(`${file}: ${id} step ${stepId} shows ${state}, and its listing records ${recorded.state ?? "no such step"}`);
        }
        if (!body.includes(`>${ENTRY_STEP_STATE_TEXT[state] ?? "\u0000"}</span>`)) failures.push(`${file}: ${id} step ${stepId} does not show its state in words`);
        const commandLines = [...body.matchAll(/<span class="term-prompt">\$<\/span> /g)].length;
        if (commandLines !== (recorded.commands ?? []).length) {
          failures.push(`${file}: ${id} step ${stepId} shows ${commandLines} command(s), and its listing records ${(recorded.commands ?? []).length}`);
        }
        // The live walk of 2026-10-08 changed the installer-package commands:
        // the reader names the Space and Component, the deploy and promote
        // steps delete the cloned installer-record Unit before they publish,
        // and a step links the log that ran them. The page must show each of
        // those, and a delivery that ran other commands may not read as run.
        const shown = decodeBasicHtml(body.replace(/<[^>]+>/g, ""));
        const installerListing = (listing.nextSteps ?? []).some((other) => (other.commands ?? []).some(({ command }) => /^cub installer upload /.test(command)));
        if (installerListing && stepId === "upload" && !/cub installer upload [^\n]*--space <your-space> --component <your-component>/.test(shown)) {
          failures.push(`${file}: ${id} step upload does not show the Space and Component placeholders the reader replaces`);
        }
        if (installerListing && ["deploy", "promote"].includes(stepId) && (recorded.commands ?? []).length > 0) {
          if (!/\$ cub unit delete --space <your-space>-dev installer-record\n[\s\S]*\$ cub release publish <your-space>-dev\s*$/.test(shown.replace(/\n\s*\n/g, "\n"))) {
            failures.push(`${file}: ${id} step ${stepId} does not end with the installer-record delete and a publish`);
          }
        }
        if (recorded.liveWalk && !body.includes(`d/${recorded.liveWalk.path.replace(/\.md$/, ".html")}`)) {
          failures.push(`${file}: ${id} step ${stepId} records a live walk and does not link its log`);
        }
        for (const note of recorded.notes ?? []) {
          if (!shown.includes(note.replaceAll("`", ""))) failures.push(`${file}: ${id} step ${stepId} does not show its note: ${JSON.stringify(note.slice(0, 60))}`);
        }
        if (stepId === "deploy" && state === "run-for-this-entry" && (recorded.commands ?? []).length > 0) {
          failures.push(`${file}: ${id} step deploy reads Run for this entry, and the recorded delivery ran other commands than the ones it shows`);
        }
        if (["not-available", "blocked-for-this-entry"].includes(state) && body.includes("<pre")) {
          failures.push(`${file}: ${id} step ${stepId} is ${state} and still shows a command`);
        }
        if (state === "not-available" && !recorded.unblock) failures.push(`${file}: ${id} step ${stepId} is not available and does not say what would unblock it`);
        // The code-block doctrine, applied here because its own check reads
        // only the top-level pages: the comment sits above its command, and a
        // comment is a short phrase.
        for (const pre of body.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)) {
          for (const line of decodeBasicHtml(pre[1].replace(/<[^>]+>/g, "")).split("\n")) {
            if (/^\s*#/.test(line) && line.length > ENTRY_STEPS_COMMENT_MAX) failures.push(`${file}: ${id} step ${stepId} has a ${line.length}-character comment, above ${ENTRY_STEPS_COMMENT_MAX}`);
            if (/^\$ /.test(line) && /\S\s{2,}#\s/.test(line)) failures.push(`${file}: ${id} step ${stepId} puts a comment after a command`);
          }
        }
      });
      const flagged = (listing.assessment?.stages ?? []).some((stage) => stage.id === "materialization" && stage.resultState === "watch");
      if (flagged !== chunk.includes('class="entry-steps-flag"')) {
        failures.push(`${file}: ${id} ${flagged ? "is flagged for review and its block does not show the open question" : "is not flagged and its block shows a flag"}`);
      }
    }
    // The block's own prose, held to the site's sentence cap. A flag quotes a
    // record's open question, which is evidence and not this page's prose.
    const prose = section.replace(/<p class="entry-steps-flag">[\s\S]*?<\/p>/g, " ").replace(/<aside[\s\S]*?<\/aside>/g, " ");
    for (const block of proseBlocks(prose)) {
      for (const sentence of sentences(block)) {
        if (wordCount(sentence) > 32) failures.push(`${file}: an entry-steps sentence has ${wordCount(sentence)} words: ${JSON.stringify(sentence.slice(0, 160))}`);
      }
      if (/\u2014/.test(block)) failures.push(`${file}: an entry-steps sentence uses an em dash`);
    }
  }
  for (const id of listings.keys()) {
    const pages = blocksById.get(id) ?? [];
    if (pages.length === 0) failures.push(`site/listings/${id}.json: no page carries this entry's five steps; give the entry a page or a fallback in entryStepsDocPlan()`);
    if (pages.length > 1) failures.push(`site/listings/${id}.json: ${pages.length} pages carry this entry's five steps (${pages.join(", ")})`);
  }
  const catalogIndexPath = path.join(root, "site/charts/index.html");
  if (fs.existsSync(catalogIndexPath)) {
    const catalogIndexHtml = fs.readFileSync(catalogIndexPath, "utf8");
    if (!/<p id="entry-steps-everywhere">Every entry page carries the same five steps under <strong>Use this entry in ConfigHub<\/strong>/.test(catalogIndexHtml)) {
      failures.push("site/charts/index.html: the Catalog page does not say that every entry page carries the five steps");
    }
  }
}

// The nimservice entry is one entry with one model variant per listing. The
// pages may say about publication only what the listings record, the variants
// may not be counted as tested and rendered, and they are never called born
// flattened. Every number here is recomputed from the listing files.
{
  const indexPath = path.join(root, "site/listings/index.json");
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : { listings: [] };
  const variants = (index.listings ?? [])
    .filter((row) => row.format === "kubernetes-yaml" && row.name === "nimservice")
    .map((row) => JSON.parse(fs.readFileSync(path.join(root, "site/listings", `${row.id}.json`), "utf8")));
  const isPublished = (listing) => (listing.oci?.bundles ?? []).some((bundle) => bundle.role === "literal-config" && bundle.referenceState === "published");
  const count = variants.length;
  const published = variants.filter(isPublished).length;
  const clause = published === 0
    ? "none is published as OCI yet"
    : published === count ? "all are published as OCI with their routes" : `${published} of them ${published === 1 ? "is" : "are"} published as OCI`;
  const readSite = (file) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "");
  if (count > 0) {
    const home = readSite("site/index.html");
    const line = home.match(/(\d+) configurations\. (\d+) are tested and rendered to the exact objects they install\. (\d+) are AICR recipes[^<]*/)?.[0] ?? "";
    const [total, tested, aicr] = (line.match(/\d+/g) ?? []).map(Number);
    if (!line.includes(`${count} are NIMService model variants kept as exact objects with their routes, and ${clause}.`)) {
      failures.push(`site/index.html: the Configs line does not say that ${count} NIMService model variants are kept as exact objects and that ${clause}`);
    }
    if (tested + aicr + count !== total) {
      failures.push(`site/index.html: the Configs line counts ${tested} tested and rendered configurations, which must be ${total} less the ${aicr} AICR recipes and the ${count} NIMService model variants`);
    }
    const page = readSite("site/nimservice.html");
    const visible = page.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
    const tableRows = [...(page.match(/<h2 id="variants">[\s\S]*?<\/table>/)?.[0] ?? "").matchAll(/<tr><td>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
    if (tableRows.length !== count) failures.push(`site/nimservice.html: the variants table has ${tableRows.length} rows, and the entry has ${count} model variants`);
    for (const listing of variants) {
      const id = listing.identity.id;
      const row = tableRows.find((candidate) => candidate.startsWith(`${listing.identity.base}</td>`)) ?? "";
      if (!row) { failures.push(`site/nimservice.html: the variants table has no row for ${listing.identity.base}`); continue; }
      const cells = row.split(/<\/td><td>/);
      const expected = isPublished(listing) ? "Published" : "Not published";
      if (cells[4] !== expected) failures.push(`site/nimservice.html: ${id} reads ${JSON.stringify(cells[4])} in the table, and its listing says ${JSON.stringify(expected)}`);
      const flagged = (listing.assessment?.stages ?? []).some((stage) => stage.id === "materialization" && stage.resultState === "watch");
      if ((cells[3] === "Flagged for review") !== flagged) failures.push(`site/nimservice.html: ${id} ${flagged ? "is flagged for review and its row does not say so" : "is not flagged and its row shows a flag"}`);
      for (const image of listing.images?.references ?? []) {
        if (!cells[1].includes(image.reference)) failures.push(`site/nimservice.html: the row for ${id} does not name the image ${image.reference}`);
      }
      if (!row.includes(`href="./listings/${id}.json"`) || !row.includes(`href="${listing.flattened?.objectsUrl}"`)) failures.push(`site/nimservice.html: the row for ${id} does not link its listing and its retained objects`);
    }
    if (published === 0 && !page.includes(`None of the ${count} variants is published as OCI yet.`)) {
      failures.push("site/nimservice.html: no variant is published, and the top of the page does not say so");
    }
    if (published < count && /All \d+ variants are published as OCI/.test(page)) {
      failures.push(`site/nimservice.html: the page says every variant is published, and ${count - published} are not`);
    }
    if (/born[ -]flattened/i.test(visible)) failures.push("site/nimservice.html: a NIMService variant is flatten-with-routes, and the page calls something born flattened");
    if (/\b[0-9a-f]{40}\b/.test(visible.replace(/\$ [^\n]*/g, " "))) failures.push("site/nimservice.html: the page shows a full 40-character commit as a version");
    const formats = readSite("site/formats.html");
    if ([...formats.matchAll(/<td>nimservice<\/td>/g)].length !== 1) failures.push("site/formats.html: the nimservice entry must take exactly one row, with its model variants on its own page");
    if (/href="\.\/listings\/nimservice-/.test(formats)) failures.push("site/formats.html: a NIMService model variant has a loose row of its own");
    const catalogPage = readSite("site/charts/index.html");
    const catalogRows = [...catalogPage.matchAll(/<tr data-chart-row data-kind="kubernetes-yaml" data-nimservice-entry[\s\S]*?<\/tr>/g)].map((match) => match[0]);
    if (catalogRows.length !== 1) failures.push(`site/charts/index.html: the nimservice entry has ${catalogRows.length} rows, and it must have one`);
    const publishedText = published === 0 ? "not published" : published === count ? "published" : `${published} of ${count} published`;
    if (catalogRows[0] && !catalogRows[0].includes(`<td>flatten-with-routes, route recorded, ${publishedText}</td>`)) {
      failures.push(`site/charts/index.html: the nimservice row does not read ${JSON.stringify(`flatten-with-routes, route recorded, ${publishedText}`)}`);
    }
  }
}

// A chart page is the landing page for one Helm chart, and its JSON file holds
// the same content as data. This checks each page against its file, and each
// file against the listings, with a version order computed here and not taken
// from the generator. It also holds the page to its one design rule: a diff is
// computed when the reader asks, so the page stores one summary line for each
// version step and no other diff content.
{
  const chartsDir = path.join(root, "site/charts");
  const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
  const chartFiles = fs.readdirSync(chartsDir).filter((name) => name.endsWith(".json")).sort();
  const catalogIndexHtml = fs.readFileSync(path.join(chartsDir, "index.html"), "utf8");
  if (chartFiles.length !== catalogCounts.components) {
    failures.push(`site/charts: ${chartFiles.length} chart file(s) for ${catalogCounts.components} Helm chart row(s) on the Catalog page`);
  }
  // Numbers compare as numbers, so 1.9.0 is older than 1.20.0.
  const versionNumbers = (version) => String(version).replace(/^v/, "").split(/[-+]/)[0].split(".").map(Number);
  const isNewer = (left, right) => {
    const [a, b] = [versionNumbers(left), versionNumbers(right)];
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) > (b[index] ?? 0);
    }
    return false;
  };
  const liveExamplesText = fs.readFileSync(path.join(root, "data/catalog-live-examples/examples.yaml"), "utf8");
  const liveExampleCharts = new Set([...liveExamplesText.matchAll(/^\s*- chart:\s*(\S+)\s*$/gm)].map((match) => match[1]));
  const schema = readJson("site/chart.schema.json");
  const vendored = readJson("scripts/site/vendor/config-diff.source.json");
  let pagesWithLiveExample = 0;
  for (const name of chartFiles) {
    const jsonFile = `site/charts/${name}`;
    const file = jsonFile.replace(/\.json$/, ".html");
    const chart = readJson(jsonFile);
    if (!fs.existsSync(path.join(root, file))) { failures.push(`${jsonFile}: the chart file has no page beside it`); continue; }
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const fail = (message) => failures.push(`${file}: ${message}`);
    for (const key of schema.required) if (!(key in chart)) failures.push(`${jsonFile}: missing the field ${key} that chart.schema.json requires`);
    for (const key of Object.keys(chart)) if (!(key in schema.properties)) failures.push(`${jsonFile}: carries a field ${key} that chart.schema.json does not define`);
    if (!html.includes(`<body data-chart-page="${chart.chart}"`)) fail("the page does not name its chart");
    if ([...html.matchAll(/<h1\b/g)].length !== 1 || !html.includes(`<h1>Find, compare and use ${chart.chart}</h1>`)) fail("the heading does not say what the reader can do with the chart");
    const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
    if (!/<p class="lead">The Catalog holds [^<]* of the Helm chart /.test(header)) fail("the opening does not say how many versions and bases the Catalog holds");
    if (!header.includes("data-chart-what") || !header.includes("data-chart-run-state")) fail("the opening does not say what the chart is and what has been run");

    // Versions, newest first, in the file and on the page.
    const versions = chart.versions.map((version) => version.version);
    for (let index = 0; index + 1 < versions.length; index += 1) {
      if (!isNewer(versions[index], versions[index + 1])) failures.push(`${jsonFile}: ${versions[index]} is listed before ${versions[index + 1]}, and versions go newest first`);
    }
    const shown = [...html.matchAll(/<article class="chart-version" data-chart-version="([^"]+)"/g)].map((match) => match[1]);
    if (JSON.stringify(shown) !== JSON.stringify(versions)) fail(`the page lists versions as ${shown.join(", ")}, and its file lists ${versions.join(", ")}`);
    if (chart.counts.versions !== versions.length || chart.counts.bases !== chart.versions.reduce((sum, version) => sum + version.bases.length, 0)) failures.push(`${jsonFile}: the counts differ from the versions and bases listed`);

    // Every base repeats its listing and claims nothing more.
    let comparable = 0;
    for (const version of chart.versions) {
      const pageName = version.page.split("/").pop();
      if (!fs.existsSync(path.join(chartsDir, pageName)) || !html.includes(`href="./${pageName}"`)) fail(`version ${version.version} does not link its version page`);
      for (const base of version.bases) {
        if (!base.listing) continue;
        const listingPath = `site/listings/${base.listing.id}.json`;
        if (!fs.existsSync(path.join(root, listingPath))) { failures.push(`${jsonFile}: ${base.listing.id} has no listing`); continue; }
        const listing = readJson(listingPath);
        const flagged = (listing.assessment?.stages ?? []).some((stage) => stage.id === "materialization" && stage.resultState === "watch");
        const published = (listing.oci?.bundles ?? []).some((bundle) => bundle.referenceState === "published");
        if (listing.identity.name !== chart.chart || listing.identity.version !== version.version || listing.identity.base !== base.base) failures.push(`${jsonFile}: ${base.listing.id} is the listing of another entry`);
        if (base.objectCount !== listing.flattened?.objectCount || base.verdict !== listing.flattened?.verdict || base.published !== published || base.flagged !== flagged) {
          failures.push(`${jsonFile}: ${base.listing.id} states an object count, verdict, publication or flag its listing does not record`);
        }
        if (base.objects) {
          comparable += 1;
          if (base.objects.path !== listing.flattened?.retainedObjects?.path || base.objects.sha256 !== (listing.flattened?.retainedObjects?.sha256 ?? null)) {
            failures.push(`${jsonFile}: ${base.listing.id} names an object file or a SHA-256 its listing does not record`);
          }
          if (!fs.existsSync(path.join(root, base.objects.path))) failures.push(`${jsonFile}: ${base.objects.path} is not in the repository, so the compare control cannot fetch it`);
        }
        if (!html.includes(`href="../listings/${base.listing.id}.json"`)) fail(`base ${base.base} of ${version.version} does not link its listing`);
        if (flagged && !new RegExp(`data-chart-version="${version.version.replace(/[.]/g, "\\.")}"[\\s\\S]*?class="status warn"`).test(html)) fail(`${base.listing.id} is flagged watch and the page does not show it`);
      }
    }

    // The compare control computes on demand, and says so.
    const compare = html.match(/<section aria-labelledby="see-what-changes"[\s\S]*?<\/section>/)?.[0] ?? "";
    if (!compare) fail("the page has no See what changes section");
    if (comparable >= 2) {
      for (const term of [
        "computes the diff on demand",
        "Nothing is precomputed or stored.",
        "checks each file's SHA-256 against the digest its listing records",
        `data-chart-json="./${name}"`,
        "data-compare-control hidden",
        'name="from-version"',
        'name="to-base"',
        "Run the same diff yourself",
        "--summary",
      ]) {
        if (!compare.includes(term)) fail(`the compare control is missing ${JSON.stringify(term)}`);
      }
      const noscript = compare.match(/<noscript>[\s\S]*?<\/noscript>/)?.[0] ?? "";
      if (!noscript.includes("cub config diff")) fail("with JavaScript off, the compare control does not name the command that gives the same diff");
      const commands = decodeBasicHtml((compare.match(/<div data-compare-command>[\s\S]*?<\/pre>/)?.[0] ?? "").replace(/<[^>]+>/g, ""));
      if ([...commands.matchAll(/^\$ curl -fsSL -o \S+\.yaml https:\/\/\S+$/gm)].length !== 2 || !/^\$ cub config diff \S+\.yaml \S+\.yaml --summary$/m.test(commands)) {
        fail("the fallback does not fetch both files with curl and compare them with cub config diff --summary");
      }
      if (!html.includes('<script type="module" src="../chart-compare.js"></script>') || !html.includes('<script src="../js-yaml-4.1.0.min.js"></script>')) fail("the page does not load the compare script and its YAML parser");
    } else if (!compare.includes("nothing to compare")) {
      fail("the chart has one base, and the page does not say there is nothing to compare");
    }
    // Phone width: the pickers stack and stay inside the page, a long field
    // path breaks, and a command block scrolls inside itself.
    if (compare.includes("<table")) fail("the compare section holds a table, which does not fit a phone-width page");
    for (const rule of [
      ".chart-compare-control select { max-width: 100%;",
      ".chart-compare-result { overflow-wrap: anywhere;",
      ".chart-compare pre { max-width: 100%; }",
      ".chart-compare-control, .chart-compare-control fieldset { flex-direction: column; align-items: stretch; }",
      "table { display: block; overflow-x: auto; white-space: nowrap; }",
    ]) {
      if (!html.includes(rule)) fail(`the phone-width rule ${JSON.stringify(rule)} is missing`);
    }

    // One stored line for each version step, and no other diff content.
    const lines = [...compare.matchAll(/<li data-chart-summary="[^"]*">([\s\S]*?)<\/li>/g)].map((match) => decodeBasicHtml(match[1].replace(/<a\b[\s\S]*$/, "")).trim());
    if (JSON.stringify(lines) !== JSON.stringify(chart.summaries.map((summary) => summary.line))) fail("the stored summary lines differ from the lines in the chart file");
    if (chart.summaries.length > Math.max(0, versions.length - 1)) failures.push(`${jsonFile}: holds ${chart.summaries.length} summary lines for ${versions.length} versions, and it may hold one for each version step`);
    chart.summaries.forEach((summary, index) => {
      if (summary.to.version !== versions[index] || summary.from.version !== versions[index + 1]) failures.push(`${jsonFile}: summary ${index + 1} does not join two adjacent versions`);
      if (sentences(summary.line).length !== 1 || !/ objects? (change|changes|are the same)\b/.test(summary.line)) failures.push(`${jsonFile}: summary ${index + 1} is not one sentence with a verb`);
      if (summary.changed + summary.unchanged + summary.removed < 1) failures.push(`${jsonFile}: summary ${index + 1} counts no objects`);
    });
    if (/chart-compare-change|data-compare-summary=|"changes":/.test(html) || "changes" in chart) fail("the page or its file stores a computed diff, and a diff is computed on demand");
    if (chart.compare?.computedOnDemand !== true || chart.compare.core.commit !== vendored.source.commit || chart.compare.core.sha256 !== vendored.core.sha256) {
      failures.push(`${jsonFile}: the compare recipe does not name the vendored cub config diff core`);
    }
    if (chart.compare.recipe.filter((command) => command.startsWith("curl ")).length !== 2 || !chart.compare.recipe.some((command) => command.startsWith("cub config diff "))) {
      failures.push(`${jsonFile}: the compare recipe is not two fetches and one cub config diff`);
    }

    // The five steps are those of the newest version's default base.
    const newest = chart.versions[0];
    const firstBase = newest.bases.find((base) => base.default && base.listing) ?? newest.bases.find((base) => base.listing);
    const blocks = chartPageBlocks.get(file) ?? [];
    if (blocks.length !== 1 || blocks[0] !== firstBase?.listing.id) fail(`the five steps are for ${blocks.join(", ") || "no entry"}, and they must be for ${firstBase?.listing.id}`);
    for (const version of chart.versions) {
      const others = version.bases.filter((base) => base.listing && base !== firstBase);
      if (others.length && !html.includes(`href="./${version.page.split("/").pop()}#use-in-confighub"`)) fail(`the page does not link the five steps of the other bases of ${version.version}`);
    }

    // A live example shows only when the data file names one for the chart.
    const live = html.match(/<section aria-labelledby="live-example"[\s\S]*?<\/section>/)?.[0] ?? "";
    const expectsLive = liveExampleCharts.has(chart.chart);
    if (Boolean(live) !== expectsLive || Boolean(chart.liveExample) !== expectsLive) {
      fail(expectsLive ? "the live examples file names this chart, and the page or its file shows no example" : "the page or its file shows a live example the live examples file does not name");
    }
    if (live) {
      pagesWithLiveExample += 1;
      const example = chart.liveExample ?? {};
      if (!/^\d{4}-\d{2}-\d{2}$/.test(example.observedOn ?? "") || !live.includes(`It was observed on ${example.observedOn}.`)) fail("the live example does not show the date it was observed");
      if (!example.done || !live.includes("data-live-example-done") || !example.notDone || !live.includes("data-live-example-not-done")) fail("the live example does not say what was done and what was not done");
      if (!(example.addresses ?? []).length || (example.addresses ?? []).some((address) => !/^https:\/\//.test(address.url) || !live.includes(`href="${address.url.replaceAll("&", "&amp;")}"`))) fail("the live example does not link each of its addresses");
      if (!/access to that organization/.test(live)) fail("the live example does not say who can open its links");
    }

    // The file is named in an agent box, and nowhere in prose for people.
    if (!new RegExp(`<aside class="agent-note"[^>]*>[\\s\\S]*?href="\\./${name.replace(/[.]/g, "\\.")}"[\\s\\S]*?<\\/aside>`).test(html)) fail("no agent box names the chart file");
    const outsideAgentBoxes = html.replace(/<aside class="agent-note"[\s\S]*?<\/aside>/g, " ").replace(/<section aria-labelledby="see-what-changes"[^>]*>/, " ");
    if (outsideAgentBoxes.includes(name)) fail("the chart file is named outside an agent box");

    // House style on the page's own prose. The five-step block is checked with
    // the other entry pages, and the listing's reason is a record's words.
    const own = html
      .replace(/<nav\b[\s\S]*?<\/nav>/g, " ")
      .replace(/<section class="entry-steps"[\s\S]*?<\/section>/, " ")
      .replace(/<span data-chart-rationale>[\s\S]*?<\/span>/, " ")
      .replace(/<aside[\s\S]*?<\/aside>/g, " ");
    const ownBody = own.slice(own.indexOf("<header"), own.lastIndexOf("</main>"));
    for (const block of proseBlocks(ownBody)) {
      for (const sentence of sentences(block)) {
        if (wordCount(sentence) > 32) fail(`a sentence has ${wordCount(sentence)} words: ${JSON.stringify(sentence.slice(0, 140))}`);
      }
      if (/\u2014/.test(block)) fail(`a sentence uses an em dash: ${JSON.stringify(block.slice(0, 100))}`);
      if (/^(No|Not|Nothing|None|Never|Neither)[ .,:]/.test(block)) fail(`a paragraph opens with a denial: ${JSON.stringify(block.slice(0, 100))}`);
    }
    for (const heading of ownBody.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/g)) {
      if (/:/.test(heading[1].replace(/<[^>]+>/g, ""))) fail(`a heading uses a colon: ${JSON.stringify(heading[1].slice(0, 80))}`);
    }

    // Findability: the Catalog row's main link is this page.
    if (!catalogIndexHtml.includes(`<td><a data-chart-page-link="${chart.chart}" href="./${name.replace(/\.json$/, ".html")}">`)) {
      failures.push(`site/charts/index.html: the row for ${chart.chart} does not open its chart page`);
    }
  }
  if (pagesWithLiveExample !== liveExampleCharts.size) failures.push(`site/charts: ${pagesWithLiveExample} page(s) show a live example, and the live examples file names ${liveExampleCharts.size}`);

  // A version page links back to the page of its chart.
  const chartPageNames = new Set(chartFiles.map((name) => name.replace(/\.json$/, ".html")));
  for (const name of fs.readdirSync(chartsDir)) {
    if (!name.endsWith(".html") || name === "index.html" || chartPageNames.has(name)) continue;
    const back = fs.readFileSync(path.join(chartsDir, name), "utf8").match(/<p class="chart-page-link"><a href="\.\/([^"]+)">/)?.[1] ?? "";
    if (!chartPageNames.has(back) || !name.startsWith(back.replace(/\.html$/, "-"))) failures.push(`site/charts/${name}: the version page does not link back to the page of its chart`);
  }

  // A search that arrives with a query lands on its results, with the count of
  // matches directly above the rows.
  const resultsAt = catalogIndexHtml.indexOf('<p id="chart-results"');
  const tableAt = catalogIndexHtml.indexOf('<table id="chart-table"');
  if (resultsAt < 0 || resultsAt > tableAt || tableAt - resultsAt > 400) failures.push("site/charts/index.html: the count of matches does not sit directly above the rows");
  for (const term of ["results.scrollIntoView", "scroll-margin-top", "Change the search"]) {
    if (!catalogIndexHtml.includes(term)) failures.push(`site/charts/index.html: a search that arrives with a query does not land on its results (${term})`);
  }

  // The home page's Catalog search sits in the hero head, above the fold. The
  // hero head keeps its headline, one typeface, and no code.
  const home = fs.readFileSync(path.join(root, "site/index.html"), "utf8");
  const heroHead = home.match(/<div class="hero-head">[\s\S]*?<\/div>/)?.[0] ?? "";
  if (!/<form class="hero-search"[^>]*action="\.\/charts\/index\.html"[^>]*method="get"><input type="search" name="q"/.test(heroHead)) failures.push("site/index.html: the Catalog search is not in the hero head");
  if ([...home.matchAll(/<form[^>]*action="\.\/charts\/index\.html"/g)].length !== 1) failures.push("site/index.html: the home page must carry the Catalog search once");
  if (/<code\b/.test(heroHead)) failures.push("site/index.html: the hero head holds code, and its prose keeps one typeface");
  if (!home.includes(".hero-search input { flex: 1; min-width: 0;") || !/\.hero-search input \{[^}]*font: inherit;/.test(home)) failures.push("site/index.html: the hero search does not take the page's typeface or can widen a phone-width page");

  const llms = fs.readFileSync(path.join(root, "site/llms.txt"), "utf8");
  for (const term of ["charts/{chart-slug}.json", "chart.schema.json", "A diff between two versions or two bases is not stored."]) {
    if (!llms.includes(term)) failures.push(`site/llms.txt: missing ${JSON.stringify(term)}`);
  }
}

if (failures.length) {
  console.error("site UX contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`verified site UX contract: ${checks.length} page(s), ${humanSplitPages.length} guide page(s), ${guideOpeningChecks.length} actionable opening(s)`);
