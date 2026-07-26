#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "helm-catalog-readmes");
const spacesRoot = join(root, "spaces");
const unitsRoot = join(root, "units");
const wave1Path = join(repoRoot, "data", "helm-org", "wave1.csv");
const guideCsvPath = join(repoRoot, "data", "confighub-example-guides", "guides.csv");
const outputPaths = {
  summary: join(root, "summary.md"),
  csv: join(root, "readmes.csv"),
};

const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const GITHUB_TREE_URL = "https://github.com/confighub/helm-expt/tree/main/";

const DEMO_SPACES = [
  {
    space: "default",
    title: "helm-catalog default space",
    kind: "org",
    summary: "A landing space for the demo org. Start with the chart and demo spaces instead of treating this as a chart example.",
    shows: [
      "ConfigHub always has a default Space, so the demo org has one too.",
      "It is not the main Helm Catalog demo. Use it as orientation, then open one of the named chart, fleet, route, or environment spaces.",
    ],
    open: ["This README first.", "`platform` for the shared checks used by the demo org.", "Any chart preset Space whose name starts with a chart name."],
    why: [
      "The demo org is easier to understand when every Space explains what it is for.",
      "This README prevents a first-time user from landing in an empty or administrative place and thinking the demo is thin.",
    ],
    evidence: [
      ["Org sync summary", "data/helm-org/summary.md"],
      ["Helm Ops Catalog", "site/charts/index.html"],
    ],
    limits: ["This is not a chart recipe, a rendered app, or a production example."],
  },
  {
    space: "platform",
    title: "Shared checks and gates for the demo org",
    kind: "org",
    summary: "Shared platform plumbing used by the demo Spaces: checks, gates, and filters that keep the examples honest.",
    shows: [
      "Production Spaces carry approval gates. Non-production Spaces do not pretend to have a human approval workflow.",
      "The demo uses checks such as placeholder detection and vetting to keep unsafe examples out of the happy path.",
    ],
    open: ["This README.", "The checks and filters used by the demo org.", "Production Spaces such as `bitnami-redis-prod` and `hashicorp-vault-env-prod` to see where gates matter."],
    why: [
      "A catalog is not only rendered YAML. It also needs the rules that say when a change is safe to move.",
      "The platform Space shows those rules separately so chart examples do not hide policy decisions inside prose.",
    ],
    evidence: [
      ["Gate-scope fix in org summary", "data/helm-org/summary.md"],
      ["Verification landing page", "site/verification.html"],
    ],
    limits: ["This example explains shared demo mechanics. It is not a replacement for a company policy model."],
  },
  {
    space: "bitnami-redis-base",
    title: "Redis base application",
    kind: "environment",
    summary: "The Redis starting point for the environment promotion demo.",
    shows: [
      "A chart render can become an application base instead of a one-off install.",
      "The base receives upstream chart refreshes. Environment Spaces can then take those refreshes without losing their local edits.",
      "This is the beginning of the 25.5.3 to 27.0.0 Redis upgrade story.",
    ],
    open: ["This README.", "The Redis workload YAML to see the captured render.", "`bitnami-redis-staging` and `bitnami-redis-prod` to see environment versions."],
    why: [
      "Helm can install Redis. The harder operations problem is what happens after install, when teams create staging and production versions and later upgrade the chart.",
      "This example keeps the base chart output and the later environment changes separate enough to audit.",
    ],
    evidence: [
      ["Redis chart page", "site/charts/bitnami-redis-25-5-3.html"],
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Org summary", "data/helm-org/summary.md"],
    ],
    limits: ["The Redis demo is a worked example, not a claim that every Redis values combination has been proven."],
  },
  {
    space: "bitnami-redis-staging",
    title: "Redis staging application",
    kind: "environment",
    summary: "A staging variant that keeps a local replica choice while the Redis base moves forward.",
    shows: [
      "Staging can carry its own change, such as a different replica count, while still receiving a base upgrade.",
      "The local change is a recorded revision, not a remembered Helm flag or a local values file that can be lost.",
    ],
    open: ["This README.", "The Redis StatefulSet YAML and its revision history.", "`bitnami-redis-base` for the upstream base."],
    why: [
      "This is the everyday Helm problem: a team needs one environment to differ from the base, then needs the next chart upgrade not to wipe that difference.",
      "ConfigHub makes the local decision visible and keeps it during upgrade.",
    ],
    evidence: [
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Promote proof notes", "runs/promote-silent-skip-proof/README.md"],
    ],
    limits: ["One map-shaped conflict in the promotion proof is still silent and is documented as a product issue."],
  },
  {
    space: "bitnami-redis-prod",
    title: "Redis production application",
    kind: "environment",
    summary: "The production Redis variant, with gates and promotion history separated from staging.",
    shows: [
      "Production can receive reviewed changes after staging proves them.",
      "Production gates live in the platform model instead of being buried in a Helm command.",
    ],
    open: ["This README.", "Redis workload YAML and revision history.", "The `platform` Space for shared gates."],
    why: [
      "Teams need a way to explain why production differs, what was promoted, and which gates applied.",
      "This is the production side of the Redis environment demo.",
    ],
    evidence: [
      ["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"],
      ["Gate-scope fix in org summary", "data/helm-org/summary.md"],
    ],
    limits: ["This is a demo production Space, not a live customer production environment."],
  },
  ...["default", "stage", "prod"].map((lane) => ({
    space: `bitnami-redis-27-0-0-${lane}-pilot-live-20260705`,
    title: `Redis 27.0.0 ${lane} pilot run`,
    kind: "pilot",
    summary: `A live pilot snapshot from the Redis 25.5.3 to 27.0.0 upgrade test for the ${lane} lane.`,
    shows: [
      "The chart upgrade was tested against a real throwaway cluster.",
      "The important question was whether a local operations edit survived the chart upgrade.",
      "The result was recorded so someone can inspect the run later instead of trusting a demo claim.",
    ],
    open: ["This README.", "Redis workload YAML.", "Revision history for the changed YAML."],
    why: [
      "This example makes the pilot concrete. It is easier to trust the story when the actual run has a place in the org.",
      "The lesson is practical: keep the Helm chart, but record the change so an upgrade does not depend on remembering the right flag.",
    ],
    evidence: [["Benchmark: upgrade keeps edit", "data/pilot-benchmark/task1-upgrade-keeps-edit.md"]],
    limits: ["This is a dated pilot snapshot from 2026-07-05."],
  })),
  ...["dev", "staging", "prod-us", "prod-eu"].map((lane) => ({
    space: `bitnami-nginx-fleet-${lane}`,
    title: `Nginx fleet ${lane}`,
    kind: "fleet",
    summary: `One lane in the Nginx fleet demo, showing how a chart-based app can vary by environment or region.`,
    shows: [
      "A chart can become several named application versions without forking the chart.",
      "Different lanes can receive base changes at different times.",
      lane === "prod-eu"
        ? "This lane deliberately lags so the demo has an obvious upgrade to inspect."
        : "This lane shows the normal path for carrying a reviewed base change forward.",
    ],
    open: ["This README.", "Nginx Deployment and Service YAML.", "Sibling fleet Spaces to compare the lanes."],
    why: [
      "The fleet demo is about scale. Once one chart becomes dev, staging, production, regions, or customers, values files and manual notes become hard to trust.",
      "ConfigHub keeps each lane named and inspectable while preserving the shared base.",
    ],
    evidence: [
      ["Nginx chart page", "site/charts/bitnami-nginx-24-0-2.html"],
      ["Org exhibit summary", "data/helm-org/exhibits.csv"],
    ],
    limits: ["The demo proves the shape of a fleet workflow. It is not a full production rollout policy."],
  })),
  {
    space: "hashicorp-vault-demo-base",
    title: "Vault base application",
    kind: "environment",
    summary: "The Vault base used to show environment variants, placeholders, promotion, and recorded render context.",
    shows: [
      "A rendered chart can carry a render record next to the workload YAML.",
      "Environment variants can inherit from the base and add their own settings, policies, and release choices.",
      "Placeholder checks prevent a known placeholder value from reaching a cluster by accident.",
    ],
    open: ["This README.", "The render-record YAML.", "`hashicorp-vault-env-dev`, `hashicorp-vault-env-staging`, and `hashicorp-vault-env-prod`."],
    why: [
      "Vault is useful because it is sensitive and operationally specific. It forces the demo to show how config records, variants, and gates fit together.",
      "The base is where the chart output and the recorded render context meet.",
    ],
    evidence: [
      ["Vault chart page", "site/charts/hashicorp-vault-0-32-0.html"],
      ["Org summary", "data/helm-org/summary.md"],
    ],
    limits: ["The render-record pattern is shown as an example in this org, not yet one record per rendered object."],
  },
  ...["dev", "staging", "prod"].map((lane) => ({
    space: `hashicorp-vault-env-${lane}`,
    title: `Vault ${lane} environment`,
    kind: "environment",
    summary: `The ${lane} Vault environment variant in the promotion and placeholder demo.`,
    shows: [
      "The environment starts from the Vault base and can carry local choices.",
      lane === "prod"
        ? "Production is wired with approval gates."
        : "This lane can accept or test changes before production.",
      "The placeholder example shows how a local real value can stay local while new safe base fields move forward.",
    ],
    open: ["This README.", "Vault StatefulSet and Service YAML.", "`hashicorp-vault-demo-base` for the upstream base."],
    why: [
      "This is a careful example of custom application delivery, not just chart installation.",
      "The important thing to inspect is how the environment records what changed and why.",
    ],
    evidence: [
      ["Org summary", "data/helm-org/summary.md"],
      ["Promote proof notes", "runs/promote-silent-skip-proof/README.md"],
    ],
    limits: lane === "dev"
      ? ["The dev lane includes a same-map departure that needed explicit reconciliation; that is part of the lesson."]
      : ["The environment is a demo lane, not a production recommendation for Vault."],
  })),
  {
    space: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
    title: "AICR GPU platform configuration",
    kind: "source",
    summary: "AICR selected and ordered a GPU training platform. ConfigHub stores the 17 exact Argo CD Applications produced from that recipe as one base variant.",
    shows: [
      "The AICR v0.14.0 recipe selected 15 versioned components for EKS, H100 accelerators, Ubuntu, Kubeflow, and training.",
      "The generated Argo CD configuration contains one parent Application and 16 component Applications, ordered with sync waves 0 through 15.",
      "ConfigHub imported those 17 Applications from one OCI configuration artifact without running AICR or rendering the source chart again.",
    ],
    open: [
      "This README.",
      "The `aicr-eks-h100-training-kubeflow` Unit to inspect the 17 Applications and their sync waves.",
      "The Space annotations to see the OCI source reference and resolved digest.",
    ],
    why: [
      "AICR can choose and package the parts of an AI platform, but a platform team still needs a record of which recipe, package, and generated configuration each cluster should run.",
      "This example keeps the AICR recipe and OCI digest connected to the exact Argo CD objects in ConfigHub. Teams can review the objects, create environment or cluster-class variants, and promote changes without rebuilding the package from memory.",
    ],
    evidence: [
      ["AICR example guide", "docs/demo/aicr/eks-h100-training-kubeflow.md"],
      ["AICR source and OCI receipt", "examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml"],
      ["ConfigHub upload receipt", "examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml"],
      ["Rendered Argo CD Applications", "examples/aicr/eks-h100-training-kubeflow/argocd-rendered"],
    ],
    limits: [
      "This proves the package-to-base-variant path. It does not claim that Argo CD reconciled the Applications or that the workloads ran on an EKS GPU cluster.",
      "The Space currently records a temporary local OCI source. The public Google Artifact Registry copy still needs a fresh Google login.",
      "The target must already provide the `argocd` Namespace, the default Argo CD AppProject, Argo CD itself, EKS, and the required GPU capacity.",
    ],
  },
  {
    space: "hook-probe-base",
    title: "A setup job delivered three ways",
    kind: "route",
    summary: "This small example shows the same setup job running from one OCI package through Argo CD, Flux, and direct apply.",
    shows: [
      "The workload and setup Job are stored as ordinary, reviewable Kubernetes objects.",
      "Argo CD, Flux, and the direct script each ran the Job and recorded its completion.",
      "The route is marked automatic only for this tested fixture and these three delivery paths.",
    ],
    open: ["This README.", "The workload and setup Job Units.", "The LifecycleRoute Unit that links the delivery receipts."],
    why: [
      "Some charts need a setup or migration Job as well as the main workload. Running that work inside one Helm command makes it difficult to see, repeat, or audit.",
      "This example moves the Job into the delivery plan. It proves the mechanism on a small fixture before we apply the same pattern to a complex chart.",
    ],
    evidence: [
      ["Hooks and CRDs guide", "docs/demo/hooks-crds/kube-prometheus-stack.md"],
      ["Hook execution proof", "runs/hook-execution-proof/receipt.yaml"],
      ["Hook OCI delivery proof", "runs/oci-hook-delivery-proof/receipt.yaml"],
    ],
    limits: ["This result does not make every Helm hook automatic. Each real chart still needs a recorded, chart-specific decision."],
  },
  {
    space: "route-sketch-kube-prometheus-stack",
    title: "Kube Prometheus Stack: hooks and CRDs",
    kind: "route",
    summary: "This example records the install and upgrade work around Kube Prometheus Stack 85.3.3, including CRDs, webhook certificates, setup jobs, and checks.",
    shows: [
      "The default preset owns ten CRDs, so they must be applied and established before the chart's custom resources.",
      "Eight route Units record the CRD order, webhook setup, upgrade jobs, checks, target facts, and cleanup behavior.",
      "Every route names its executor and evidence. These chart routes remain `automatic: false` until their individual delivery paths are proved.",
    ],
    open: ["This README.", "The eight LifecycleRoute Units.", "The Kube Prometheus Stack chart page and render intent."],
    why: [
      "A successful Helm render is not a complete install plan for this chart. Kubernetes must see the CRDs first, and the admission webhook needs certificate setup and readiness checks.",
      "We keep the upstream chart and record those choices beside the rendered objects. Teams can review, test, and update the plan instead of hiding it in an imperative install.",
    ],
    evidence: [
      ["Hooks and CRDs guide", "docs/demo/hooks-crds/kube-prometheus-stack.md"],
      ["Kube Prometheus Stack chart page", "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
      ["CRD ordering proof", "runs/crd-ordering-gap/receipt.yaml"],
      ["Lifecycle receipt", "data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml"],
      ["Render intent", "data/helm-render-intents/intents/prometheus-community-kube-prometheus-stack-85-3-3-default.yaml"],
    ],
    limits: ["The routes are live records, but ConfigHub does not yet execute all eight automatically. The delivery owner still chooses and runs the recorded Argo CD, Flux, or direct path."],
  },
];

if (mode === "--generate") {
  const report = buildReport();
  rmSync(root, { recursive: true, force: true });
  for (const readme of report.readmes) {
    write(readme.markdownPath, readme.markdown);
    write(readme.unitPath, readme.unitYaml);
  }
  write(outputPaths.summary, report.summary);
  write(outputPaths.csv, report.csv);
  console.log(`wrote Helm Catalog README files -> ${relativeRepo(root)} (${report.readmes.length} space(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputPaths.summary), `${relativeRepo(outputPaths.summary)} is missing; run npm run helm-catalog-readmes`);
  check(existsSync(outputPaths.csv), `${relativeRepo(outputPaths.csv)} is missing; run npm run helm-catalog-readmes`);
  check(readFileSync(outputPaths.summary, "utf8") === report.summary, `${relativeRepo(outputPaths.summary)} is stale; run npm run helm-catalog-readmes`);
  check(readFileSync(outputPaths.csv, "utf8") === report.csv, `${relativeRepo(outputPaths.csv)} is stale; run npm run helm-catalog-readmes`);
  for (const readme of report.readmes) {
    check(existsSync(readme.markdownPath), `${relativeRepo(readme.markdownPath)} is missing; run npm run helm-catalog-readmes`);
    check(existsSync(readme.unitPath), `${relativeRepo(readme.unitPath)} is missing; run npm run helm-catalog-readmes`);
    check(readFileSync(readme.markdownPath, "utf8") === readme.markdown, `${relativeRepo(readme.markdownPath)} is stale; run npm run helm-catalog-readmes`);
    check(readFileSync(readme.unitPath, "utf8") === readme.unitYaml, `${relativeRepo(readme.unitPath)} is stale; run npm run helm-catalog-readmes`);
  }
  console.log(`verified ${report.readmes.length} Helm Catalog README file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-helm-catalog-readmes.mjs --generate
  node scripts/generate-helm-catalog-readmes.mjs --verify`);
}

function buildReport() {
  check(existsSync(wave1Path), "data/helm-org/wave1.csv is missing; run npm run helm-org:sync");
  check(existsSync(guideCsvPath), "data/confighub-example-guides/guides.csv is missing; run npm run confighub-example-guides");
  const waveRows = parseCsv(readFileSync(wave1Path, "utf8"));
  const guideRows = parseCsv(readFileSync(guideCsvPath, "utf8"));
  const guideBySpace = new Map(guideRows.map((row) => [row.space_slug, row]));
  const readmes = [];

  for (const row of waveRows) {
    const guide = guideBySpace.get(row.space);
    check(guide, `missing generated guide metadata for ${row.space}`);
    readmes.push(buildPresetReadme(row, guide));
  }

  for (const model of DEMO_SPACES) readmes.push(buildDemoReadme(model));

  const spaces = readmes.map((item) => item.space);
  const unique = new Set(spaces);
  check(unique.size === spaces.length, "duplicate helm-catalog README space names");
  check(readmes.length === 40, `expected 40 helm-catalog README files, got ${readmes.length}`);
  readmes.sort((a, b) => sortKind(a.kind).localeCompare(sortKind(b.kind)) || a.space.localeCompare(b.space));

  return {
    readmes,
    summary: summaryMd(readmes),
    csv: csvMd(readmes),
  };
}

function buildPresetReadme(row, guide) {
  const space = row.space;
  const chart = row.chart;
  const version = row.version;
  const base = row.variant;
  const guidePath = guide.guide_path;
  const guideText = readFileSync(join(repoRoot, guidePath), "utf8");
  const chartPage = guide.chart_page || chartPageForSpace(space);
  const intentPath = `data/helm-render-intents/intents/${space}.yaml`;
  const intent = existsSync(join(repoRoot, intentPath)) ? readYaml(join(repoRoot, intentPath)) : {};
  const renderedObjects = intent.spec?.renderOutput?.renderedObjects ?? "";
  const renderIntentUrl = githubBlob(intentPath);
  const renderedUrl = renderedObjects ? githubBlob(renderedObjects) : "";
  const scriptBase = `${SITE_BASE_URL}sh/${space}`;
  const routeCount = Number(guide.route_count || intent.spec?.lifecycle?.routeCount || 0);
  const prereqSummary = guide.prerequisite_summary && guide.prerequisite_summary !== "none"
    ? guide.prerequisite_summary
    : "no chart-specific prerequisites recorded";
  const title = `${chart} ${version} - ${base}`;
  const summary = `A ready-to-use preset for ${chart}@${version}. It solves one operating problem for this chart, while keeping the upstream Helm chart and recording the settings, rendered YAML, and evidence.`;
  const presetReason = guide.preset_reason || presetReasonFor(base);
  const markdown = `<!-- Generated by npm run helm-catalog-readmes. Do not edit by hand. -->

# ${title}

This Space exists to answer one practical question: what is a safe, repeatable way to run \`${chart}@${version}\` for this operating choice?

For this Space, the answer is the \`${base}\` preset. ${presetReason}

The preset keeps the upstream Helm chart. The catalog records the chart version, values, namespace, release name, Kubernetes capabilities, source lock, rendered YAML, and evidence, so the team can repeat this choice later.

## Why this preset exists

With plain Helm, a values file and a successful install do not explain enough later. It can be hard to tell which values, Secrets, CRDs, hooks, target assumptions, and local edits mattered. A future upgrade can also wipe changes made after install.

This preset gives the team a named starting point instead of a private guess. You can test it without a ConfigHub account, upload it when you want Hub records and variants, and reuse it as a base for dev, staging, production, regions, or customers.

## What this preset contains

- Preset: \`${base}\`.
- Kubernetes YAML: ${guide.object_count || "recorded"} object(s)${guide.main_kinds ? `, mainly ${guide.main_kinds}` : ""}.
- Needs before install: ${prereqSummary}.
- Extra Helm work: ${routeCount ? `${routeCount} recorded route(s) for hooks or surrounding setup work.` : "no hook route is recorded for this preset."}

This is not a new chart language. It is a checked way to use this Helm chart, with the chosen inputs and output kept together.

## What to inspect in Hub

1. Read this page first.
2. Open the Kubernetes YAML to see the objects this preset manages.
3. Open the render intent to see the Helm inputs behind those objects.
4. Open routes or prerequisites when the chart needs CRDs, hooks, Secrets, setup jobs, or target facts.
5. Open revision history when you want to see what changed over time.

## Try it

Run without a ConfigHub account:

\`\`\`sh
bash <(curl -fsSL ${scriptBase}/try.sh)
\`\`\`

Upload to ConfigHub:

\`\`\`sh
bash <(curl -fsSL ${scriptBase}/confighub.sh)
\`\`\`

## Evidence and source

| Item | Link |
| --- | --- |
| Catalog chart page | [${chart}@${version}](${chartPage}) |
| Render intent | [${intentPath}](${renderIntentUrl}) |
| Rendered YAML | ${renderedObjects ? `[${renderedObjects}](${renderedUrl})` : "Recorded in the generated guide"} |
| Detailed guide | [${guidePath}](${githubBlob(guidePath)}) |
| No-account script | [try.sh](${scriptBase}/try.sh) |
| ConfigHub upload script | [confighub.sh](${scriptBase}/confighub.sh) |

## What is proven

- Render parity: \`${guide.render_parity || "not recorded"}\`.
- Local kind run: \`${guide.local_kind || "not recorded"}\`.
- GitOps OCI live run: \`${guide.gitops_oci_live || "not recorded"}\`.
- Live Helm versus ConfigHub comparison: \`${guide.live_dual_parity || "not recorded"}\`.

These claims apply to this preset. They do not mean every possible values combination for the chart has been tested.

## Limits

${presetLimits(base, routeCount).map((item) => `- ${item}`).join("\n")}
`;

  return readmeModel({
    space,
    title,
    kind: "preset",
    summary,
    markdown,
    links: [
      ["Catalog chart page", chartPage],
      ["Render intent", renderIntentUrl],
      ["Generated guide", githubBlob(guidePath)],
    ],
  });
}

function buildDemoReadme(model) {
  const links = model.evidence.map(([label, path]) => [label, linkFor(path)]);
  const markdown = `<!-- Generated by npm run helm-catalog-readmes. Do not edit by hand. -->

# ${model.title}

${model.summary}

Start here when you open this Space in Hub. This page explains the problem this example is meant to show, what to inspect, why it matters, and where the evidence lives.

## Why this example exists

${model.why.join("\n\n")}

## What this example shows

${model.shows.map((item) => `- ${item}`).join("\n")}

## What to inspect in Hub

${model.open.map((item) => `- ${item}`).join("\n")}

## Evidence and source

${links.map(([label, url]) => `- [${label}](${url})`).join("\n")}

## Limits

${model.limits.map((item) => `- ${item}`).join("\n")}
`;

  return readmeModel({
    space: model.space,
    title: model.title,
    kind: model.kind,
    summary: model.summary,
    markdown,
    links,
  });
}

function readmeModel({ space, title, kind, summary, markdown, links }) {
  const markdownPath = join(spacesRoot, space, "README.md");
  const unitPath = join(unitsRoot, space, "readme.yaml");
  const unitYaml = unitYamlFor({ space, title, kind, summary, markdown, links });
  return {
    space,
    title,
    kind,
    summary,
    markdown,
    markdownPath,
    unitPath,
    unitYaml,
    sourcePath: relativeRepo(markdownPath),
    unitSourcePath: relativeRepo(unitPath),
  };
}

function unitYamlFor({ space, title, kind, summary, markdown, links }) {
  return `apiVersion: helm-expt.confighub.com/v1alpha1
kind: HelmCatalogDemoReadme
metadata:
  name: readme
  labels:
    app.kubernetes.io/part-of: helm-catalog
    helm-expt.confighub.com/space: ${yamlString(space)}
    helm-expt.confighub.com/readme-kind: ${yamlString(kind)}
spec:
  space: ${yamlString(space)}
  title: ${yamlString(title)}
  summary: ${yamlString(summary)}
  sourcePath: ${yamlString(`data/helm-catalog-readmes/spaces/${space}/README.md`)}
  links:
${links.length ? links.map(([label, url]) => `    - label: ${yamlString(label)}
      url: ${yamlString(url)}`).join("\n") : "    []"}
  markdown: |-
${indent(markdown.trimEnd(), 4)}
`;
}

function summaryMd(readmes) {
  const byKind = countBy(readmes, "kind");
  return `# Helm Catalog Demo READMEs

Generated by \`scripts/generate-helm-catalog-readmes.mjs\`.

These are the README pages for the \`helm-catalog\` ConfigHub demo org. The rule is simple: one demo Space, one README. If the Space already has a README, the upload updates it. If it is missing a README, the upload creates one. It must not create duplicates such as \`readme-2\`.

The README is for someone who starts inside [hub.confighub.com](https://hub.confighub.com), opens the demo org, and wants to understand the example without reading this repository first.

## Counts

| Kind | Spaces |
| --- | ---: |
${[...byKind.entries()].sort((a, b) => sortKind(a[0]).localeCompare(sortKind(b[0]))).map(([kind, count]) => `| ${kind} | ${count} |`).join("\n")}
| total | ${readmes.length} |

## Files

- README text: \`data/helm-catalog-readmes/spaces/<space>/README.md\`
- Upload YAML: \`data/helm-catalog-readmes/units/<space>/readme.yaml\`
- Inventory: [readmes.csv](./readmes.csv)

## Spaces

| Space | Kind | README text | Upload YAML |
| --- | --- | --- | --- |
${readmes.map((item) => `| \`${item.space}\` | ${item.kind} | [README](${relativeLink(root, item.markdownPath)}) | [readme.yaml](${relativeLink(root, item.unitPath)}) |`).join("\n")}
`;
}

function csvMd(readmes) {
  const headers = ["space", "kind", "title", "summary", "source_path", "unit_source_path"];
  const rows = readmes.map((item) => ({
    space: item.space,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    source_path: item.sourcePath,
    unit_source_path: item.unitSourcePath,
  }));
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function presetReasonFor(base) {
  const lower = base.toLowerCase();
  if (lower.includes("existing-secret") || lower.includes("reuse-existing-secret")) return "Use this when secret values should come from a Secret you control.";
  if (lower.includes("static-password")) return "Use this for comparison only; it keeps a fixed credential visible so it is not mistaken for generated secret material.";
  if (lower.includes("no-crds")) return "Use this when the platform owns the CRDs.";
  if (lower.includes("internal") || lower.includes("clusterip")) return "Use this when the service should stay inside the cluster network.";
  if (lower.includes("default")) return "Use this when you want the chart author's normal path with the inputs recorded.";
  return "Use this as one named, repeatable chart starting point.";
}

function presetLimits(base, routeCount) {
  const limits = ["This README covers this recorded preset, not every possible values file."];
  if (base.includes("static-password")) limits.push("Do not use a static password preset as a production credential strategy.");
  if (!routeCount) limits.push("No hook route is recorded for this preset.");
  return limits;
}

function chartPageForSpace(space) {
  const parts = space.split("-");
  return `${SITE_BASE_URL}charts/${parts.slice(0, -1).join("-")}.html`;
}

function linkFor(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("site/")) return `${SITE_BASE_URL}${path.slice("site/".length)}`;
  return githubBlob(path);
}

function githubBlob(path) {
  return `${GITHUB_BASE_URL}${path}`;
}

function sortKind(kind) {
  return {
    org: "0-org",
    preset: "1-preset",
    environment: "2-environment",
    source: "3-source",
    fleet: "4-fleet",
    pilot: "5-pilot",
    route: "6-route",
  }[kind] ?? kind;
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  return counts;
}

function relativeLink(from, to) {
  const rel = relativeRepo(to).replace(`${relativeRepo(from)}/`, "");
  return rel;
}

function indent(text, spaces) {
  const prefix = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? `${prefix}${line}` : "")).join("\n");
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function parseCsv(text) {
  const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
