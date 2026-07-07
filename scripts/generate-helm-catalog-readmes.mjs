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
      "This Space exists because ConfigHub always has a default Space.",
      "It is not the main Helm Catalog demo. Use it as orientation, then open one of the named chart, fleet, route, or environment spaces.",
    ],
    open: ["The `readme` Unit first.", "`platform` for the shared checks used by the demo org.", "Any chart preset Space whose name starts with a chart name."],
    why: [
      "The demo org is easier to understand when every Space explains what it is for.",
      "This README prevents a first-time user from landing in an empty or administrative place and thinking the demo is thin.",
    ],
    evidence: [
      ["Org sync summary", "data/helm-org/summary.md"],
      ["Helm Ops Catalog", "site/charts/index.html"],
    ],
    limits: ["This Space is not a chart recipe, a rendered app, or a production example."],
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
    open: ["The `readme` Unit.", "Trigger and filter Units that name the checks applied to other Spaces.", "Production Spaces such as `bitnami-redis-prod` and `hashicorp-vault-env-prod` to see where gates matter."],
    why: [
      "A catalog is not only rendered YAML. It also needs the rules that say when a change is safe to move.",
      "The platform Space shows those rules separately so chart examples do not hide policy decisions inside prose.",
    ],
    evidence: [
      ["Gate-scope fix in org summary", "data/helm-org/summary.md"],
      ["Verification landing page", "site/verification.html"],
    ],
    limits: ["This Space explains shared demo mechanics. It is not a replacement for a company policy model."],
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
    open: ["The `readme` Unit.", "Redis workload Units to see the captured render.", "`bitnami-redis-staging` and `bitnami-redis-prod` to see environment versions."],
    why: [
      "Helm can install Redis. The harder operations problem is what happens after install, when teams create staging and production versions and later upgrade the chart.",
      "This Space keeps the base chart output and the later environment changes separate enough to audit.",
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
    open: ["The `readme` Unit.", "Redis StatefulSet Units and their revision history.", "`bitnami-redis-base` for the upstream base."],
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
    open: ["The `readme` Unit.", "Redis workload Units and revision history.", "The `platform` Space for shared gates."],
    why: [
      "Teams need a way to explain why production differs, what was promoted, and which gates applied.",
      "This Space is the production side of the Redis environment demo.",
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
    open: ["The `readme` Unit.", "Redis workload Units.", "Revision history for the changed Units."],
    why: [
      "This Space exists to make the pilot concrete. It is easier to trust the story when the actual run has a place in the org.",
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
    open: ["The `readme` Unit.", "Nginx Deployment and Service Units.", "Sibling fleet Spaces to compare the lanes."],
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
      "A rendered chart can carry a render record next to the workload Units.",
      "Environment variants can inherit from the base and add their own settings, policies, and release choices.",
      "Placeholder checks prevent a known placeholder value from reaching a cluster by accident.",
    ],
    open: ["The `readme` Unit.", "The render-record Unit.", "`hashicorp-vault-env-dev`, `hashicorp-vault-env-staging`, and `hashicorp-vault-env-prod`."],
    why: [
      "Vault is useful because it is sensitive and operationally specific. It forces the demo to show how config records, variants, and gates fit together.",
      "The base is where the chart output and the recorded render context meet.",
    ],
    evidence: [
      ["Vault chart page", "site/charts/hashicorp-vault-0-32-0.html"],
      ["Org summary", "data/helm-org/summary.md"],
    ],
    limits: ["The render-record pattern is shown as an example in this org, not yet one record per rendered Unit."],
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
    open: ["The `readme` Unit.", "Vault StatefulSet and Service Units.", "`hashicorp-vault-demo-base` for the upstream base."],
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
    space: "hook-probe-base",
    title: "Hook delivery proof fixture",
    kind: "route",
    summary: "A small fixture proving that hook-like work can be packaged once and delivered through Argo CD, Flux, or a direct apply path.",
    shows: [
      "Some Helm work is not just static objects. Hooks and setup jobs need an execution plan.",
      "This fixture packages that work as an explicit route and proves the same OCI bundle can be consumed three ways.",
      "Argo CD, Flux, and a no-controller path all observed the routed hook running in the live proof.",
    ],
    open: ["The `readme` Unit.", "The hook fixture Units.", "The proof receipt linked below."],
    why: [
      "The claim is not that every hook can be translated automatically.",
      "The claim is that most real cases can be handled with chart-specific preset configs and tested patterns, then recorded so teams can maintain them.",
    ],
    evidence: [["Hook OCI delivery proof", "runs/oci-hook-delivery-proof/receipt.yaml"]],
    limits: ["This is one fixture. Real charts still need chart-specific decisions for hook semantics."],
  },
  {
    space: "route-sketch-kube-prometheus-stack",
    title: "Kube Prometheus Stack route sketch",
    kind: "route",
    summary: "A design sketch for handling the work around a complex chart: CRDs, setup jobs, webhook certificates, target facts, and receipts.",
    shows: [
      "Large Helm charts often need more than a rendered Deployment and Service.",
      "This Space names seven lifecycle routes so the extra work is reviewable instead of hidden in an install.",
      "Routes stay marked `automatic: false` until a live proof earns automation.",
    ],
    open: ["The `readme` Unit.", "LifecycleRoute Units.", "The Kube Prometheus Stack chart page."],
    why: [
      "Use this Space to see how we handle the hard parts around a Helm chart without pretending there is one universal answer.",
      "We keep the chart, then write down the chart-specific choices for CRDs, hooks, certificates, setup jobs, and target facts. Each choice can be tested, reused, and improved instead of rediscovered by every team.",
    ],
    evidence: [
      ["Kube Prometheus Stack chart page", "site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html"],
      ["CRD ordering proof", "runs/crd-ordering-gap/receipt.yaml"],
      ["How it works", "site/how-it-works.html"],
    ],
    limits: ["This is a sketch Space. It names the planned work but does not claim every route is automated today."],
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
  console.log(`wrote Helm Catalog README payloads -> ${relativeRepo(root)} (${report.readmes.length} space(s))`);
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
  console.log(`verified ${report.readmes.length} Helm Catalog README payload(s)`);
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
  check(readmes.length === 39, `expected 39 helm-catalog README payloads, got ${readmes.length}`);
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
  const summary = `A ready-to-use preset config for ${chart}@${version}. It keeps the Helm chart, records the values and render context, and stores the rendered objects as ConfigHub Units.`;
  const presetReason = guide.preset_reason || presetReasonFor(base);
  const markdown = `<!-- Generated by npm run helm-catalog-readmes. Do not edit by hand. -->

# ${title}

This Space is a ready-to-use preset config for \`${chart}@${version}\`. We keep the Helm chart. The catalog records the values, namespace, release name, Kubernetes capabilities, and source lock used for this preset config, then stores the rendered Kubernetes objects as ConfigHub Units.

Use this README as the first stop inside Hub. It tells you why this Space exists, what to open, what is already proven, and where to find the deeper chart evidence.

## What this Space shows

- Preset config: \`${base}\`. ${presetReason}
- Rendered objects: ${guide.object_count || "recorded"} object(s)${guide.main_kinds ? `, mainly ${guide.main_kinds}` : ""}.
- Prerequisites: ${prereqSummary}.
- Lifecycle work: ${routeCount ? `${routeCount} recorded route(s) for hook or surrounding work.` : "no hook route is recorded for this preset config."}

This is not a new chart language. It is a checked, repeatable way to use this Helm chart.

## What to open in Hub

1. Start with this \`readme\` Unit.
2. Open the workload Units to see the Kubernetes objects ConfigHub will manage.
3. Open revision history when you want to see how the Space changed.
4. Use the links below for the chart page, render intent, rendered YAML, and scripts.

## Why this matters

Plain Helm rebuilds the release from templates each time. That works for a first install, but it is easy to lose track of which values, target assumptions, Secrets, CRDs, hooks, and local edits mattered.

This preset config gives the team a named starting point. It can be tested without a ConfigHub account, uploaded when you want records and variants, and reused as a base for dev, staging, production, regions, or customers.

## Repeat it

No-account test:

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
| Full generated guide | [${guidePath}](${githubBlob(guidePath)}) |
| No-account script | [try.sh](${scriptBase}/try.sh) |
| ConfigHub upload script | [confighub.sh](${scriptBase}/confighub.sh) |

## What is proven

- Render parity: \`${guide.render_parity || "not recorded"}\`.
- Local kind run: \`${guide.local_kind || "not recorded"}\`.
- GitOps OCI live run: \`${guide.gitops_oci_live || "not recorded"}\`.
- Live Helm versus ConfigHub comparison: \`${guide.live_dual_parity || "not recorded"}\`.

These claims apply to this recorded preset config. They do not mean every possible values combination for the chart has been tested.

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

Use this README as the first stop inside Hub. It explains what this Space is for, what to open, why it matters, and where the evidence lives.

## What this Space shows

${model.shows.map((item) => `- ${item}`).join("\n")}

## What to open in Hub

${model.open.map((item) => `- ${item}`).join("\n")}

## Why this matters

${model.why.join("\n\n")}

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
  return `# Helm Catalog README Payloads

Generated by \`scripts/generate-helm-catalog-readmes.mjs\`.

These files are the source of the \`readme\` Unit in each Space of the \`helm-catalog\` ConfigHub demo org. The rule is one Space, one README. If a Space already has \`readme\`, the upload updates it. If a Space is missing it, the upload creates it. The upload must not create \`readme-2\` or any other duplicate.

The README is for someone who starts inside [hub.confighub.com](https://hub.confighub.com), opens the demo org, and wants to understand the example without reading this repository first.

## Counts

| Kind | Spaces |
| --- | ---: |
${[...byKind.entries()].sort((a, b) => sortKind(a[0]).localeCompare(sortKind(b[0]))).map(([kind, count]) => `| ${kind} | ${count} |`).join("\n")}
| total | ${readmes.length} |

## Outputs

- Human source: \`data/helm-catalog-readmes/spaces/<space>/README.md\`
- Exact Unit payload: \`data/helm-catalog-readmes/units/<space>/readme.yaml\`
- Inventory: [readmes.csv](./readmes.csv)

## Spaces

| Space | Kind | README source | Unit payload |
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
  const limits = ["This README covers this recorded preset config, not every possible values file."];
  if (base.includes("static-password")) limits.push("Do not use a static password preset as a production credential strategy.");
  if (!routeCount) limits.push("No hook route is recorded for this preset config.");
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
    fleet: "3-fleet",
    pilot: "4-pilot",
    route: "5-route",
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
  return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
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
