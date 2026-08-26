#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "confighub-example-guides");
const spacesRoot = join(root, "spaces");
const packagesPath = join(repoRoot, "data", "installer-oci-packages", "packages.json");
const intentsPath = join(repoRoot, "data", "helm-render-intents", "intents.json");
const matrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
const chartUseGuidePath = join(repoRoot, "data", "chart-use-guide", "chart-use-guide.csv");
const outputPaths = {
  summary: join(root, "summary.md"),
  csv: join(root, "guides.csv"),
};

const SITE_BASE_URL = "https://confighub.github.io/helm-expt/site/";
const GITHUB_BASE_URL = "https://github.com/confighub/helm-expt/blob/main/";
const FORBIDDEN_HUMAN_PHRASES = [
  "starting shape",
  "metrics shape",
  "collector shape",
  "high-availability shape",
  "local test shape",
  "credential shape",
  "curated proof lane",
  "bespoke teaching needed",
];

if (mode === "--generate") {
  const report = buildReport();
  rmSync(spacesRoot, { recursive: true, force: true });
  for (const guide of report.guides) write(guide.path, guide.markdown);
  write(outputPaths.summary, report.summary);
  write(outputPaths.csv, report.csv);
  console.log(`wrote ConfigHub example guides -> ${relativeRepo(root)} (${report.guides.length} guide(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputPaths.summary), `${relativeRepo(outputPaths.summary)} is missing; run npm run confighub-example-guides`);
  check(existsSync(outputPaths.csv), `${relativeRepo(outputPaths.csv)} is missing; run npm run confighub-example-guides`);
  check(readFileSync(outputPaths.summary, "utf8") === report.summary, `${relativeRepo(outputPaths.summary)} is stale; run npm run confighub-example-guides`);
  check(readFileSync(outputPaths.csv, "utf8") === report.csv, `${relativeRepo(outputPaths.csv)} is stale; run npm run confighub-example-guides`);
  for (const guide of report.guides) {
    check(existsSync(guide.path), `${relativeRepo(guide.path)} is missing; run npm run confighub-example-guides`);
    check(readFileSync(guide.path, "utf8") === guide.markdown, `${relativeRepo(guide.path)} is stale; run npm run confighub-example-guides`);
    verifyLocalScriptLinks(guide.markdown, guide.path);
    verifyHumanCopy(guide.markdown, guide.path);
  }
  console.log(`verified ${report.guides.length} ConfigHub example guide(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-confighub-example-guides.mjs --generate
  node scripts/generate-confighub-example-guides.mjs --verify`);
}

function buildReport() {
  check(existsSync(packagesPath), "data/installer-oci-packages/packages.json is missing; run npm run installer-oci:catalog");
  check(existsSync(intentsPath), "data/helm-render-intents/intents.json is missing; run npm run helm-render-intents");
  const packages = JSON.parse(readFileSync(packagesPath, "utf8")).packages ?? [];
  const publicPackages = packages.filter((item) => item.public_catalog === "yes");
  const packageByChartVersion = new Map(publicPackages.map((item) => [`${item.chart}@${item.version}`, item]));
  const matrixRows = existsSync(matrixPath) ? parseCsv(readFileSync(matrixPath, "utf8")) : [];
  const chartUseRows = existsSync(chartUseGuidePath) ? parseCsv(readFileSync(chartUseGuidePath, "utf8")) : [];
  const intents = JSON.parse(readFileSync(intentsPath, "utf8")).intents ?? [];
  const publicBaseIntents = intents
    .filter((intent) => packageByChartVersion.has(`${intent.spec.chart.name}@${intent.spec.chart.version}`))
    .filter((intent) => {
      const pkg = packageByChartVersion.get(`${intent.spec.chart.name}@${intent.spec.chart.version}`);
      return (pkg.bases ?? "").split(";").includes(intent.spec.baseVariant);
    })
    .sort((a, b) => {
      const left = `${a.spec.chart.name}@${a.spec.chart.version}/${a.spec.baseVariant}`;
      const right = `${b.spec.chart.name}@${b.spec.chart.version}/${b.spec.baseVariant}`;
      return left.localeCompare(right);
    });
  const guides = publicBaseIntents.map((intent) => {
    const pkg = packageByChartVersion.get(`${intent.spec.chart.name}@${intent.spec.chart.version}`);
    return buildGuide(intent, pkg, matrixRows, chartUseRows);
  });
  return {
    guides,
    summary: summaryMd(guides, publicPackages.length),
    csv: csvMd(guides),
  };
}

function buildGuide(intent, pkg, matrixRows, chartUseRows) {
  const chart = intent.spec.chart.name;
  const version = intent.spec.chart.version;
  const base = intent.spec.baseVariant;
  const slug = intent.metadata.name;
  const path = join(spacesRoot, slug, "README.md");
  const recipePath = intent.spec.renderInputs.recipe;
  const artifactIndexPath = join(repoRoot, recipePath, "artifact-index.yaml");
  const artifactIndex = existsSync(artifactIndexPath) ? readYaml(artifactIndexPath) : {};
  const variant = (artifactIndex.spec?.variants ?? []).find((item) => item.name === base) ?? {};
  const installer = existsSync(join(repoRoot, pkg.installer_yaml)) ? readYaml(join(repoRoot, pkg.installer_yaml)) : {};
  const packageBase = (installer.spec?.bases ?? []).find((item) => item.name === base) ?? {};
  const matrixRow = matrixRows.find((row) => row.row_kind === "base" && row.chart === chart && row.version === version && row.variant === base) ?? {};
  const chartUseRow = chartUseRows.find((row) => row.chart === `${chart}@${version}`) ?? {};
  const inventory = readInventory(intent.spec.renderOutput.objectInventory);
  const requirements = normalizeRequirements(packageBase.externalRequires ?? variant.targetFacts?.externalRequires ?? []);
  const routes = Array.isArray(intent.spec.lifecycle?.variantRoutes) ? intent.spec.lifecycle.variantRoutes : [];
  const routeCount = routes.length;
  const chartPage = chartPageUrl(pkg.chart_page);
  const scriptDir = presetScriptDir(pkg, base);
  const scriptBase = `${SITE_BASE_URL}${scriptDir.replace(/^site\//, "")}`;
  const setupCommand = setupCommandFor(intent, pkg, slug);
  const displaySpace = defaultSpaceFor(chart, base);
  const markdown = guideMd({
    chart,
    version,
    base,
    slug,
    displaySpace,
    path,
    pkg,
    intent,
    artifactIndex,
    variant,
    packageBase,
    matrixRow,
    chartUseRow,
    inventory,
    requirements,
    routes,
    routeCount,
    chartPage,
    scriptDir,
    tryScript: `${scriptBase}/try.sh`,
    confighubScript: `${scriptBase}/confighub.sh`,
    setupCommand,
  });
  return {
    chart,
    version,
    base,
    slug,
    guide_path: relativeRepo(path),
    chart_page: chartPage,
    preset_reason: presetReason(base, packageBase.description ?? variant.packageBase?.description ?? ""),
    object_count: inventory.objectCount,
    main_kinds: kindSummary(inventory.objects),
    prerequisite_count: requirements.length,
    prerequisite_summary: requirementSummary(requirements),
    route_count: routeCount,
    render_parity: intent.spec.evidence?.renderParity ?? "",
    local_kind: intent.spec.evidence?.localKind ?? "",
    gitops_oci_live: intent.spec.evidence?.gitopsOciLive ?? "",
    live_dual_parity: intent.spec.evidence?.liveDualParity ?? "",
    package_oci_ref: pkg.digest_pinned_ref || pkg.installer_oci_ref,
    markdown,
    path,
  };
}

function guideMd(model) {
  const {
    chart,
    version,
    base,
    slug,
    displaySpace,
    pkg,
    intent,
    variant,
    packageBase,
    matrixRow,
    chartUseRow,
    inventory,
    requirements,
    routes,
    routeCount,
    chartPage,
    scriptDir,
    tryScript,
    confighubScript,
    setupCommand,
  } = model;
  const title = `${chart} ${version} - ${base}`;
  const renderedObjects = intent.spec.renderOutput.renderedObjects;
  const renderIntentPath = `data/helm-render-intents/intents/${slug}.yaml`;
  const packageBasePath = intent.spec.renderInputs.packageBase;
  const valuesPath = intent.spec.renderInputs.valuesProfile;
  const routeSentence = lifecycleSentence(routes);
  const prereqSentence = requirementSentence(requirements, routes);
  const correctness = correctnessBullets(intent, inventory, routeCount, requirements);
  const whatChanged = changedFromHelm(base, requirements, routeCount, matrixRow);
  const limits = limitsFor(intent, matrixRow, chartUseRow, base);
  const mainKinds = kindSummary(inventory.objects);
  const requirementRows = prerequisiteAndRouteRows(requirements, routes);
  const packageRef = pkg.digest_pinned_ref || pkg.installer_oci_ref;
  return `<!-- Generated by npm run confighub-example-guides. Do not edit by hand. -->

# ${title}

This guide explains the journey from a public Helm chart to a ConfigHub Space. Use it when you want to know why this preset exists, what problem it solves, how to repeat it, and what still needs care.

It is generated from the same records that build the package, chart page, render intent, scripts, and receipts. The proof links are lower down.

## Why this preset exists

Helm charts often expose many settings, but a values file alone does not tell the whole operations story. A team still needs to know what Kubernetes objects will be created, which Secrets or CRDs must already exist, whether hooks or setup jobs need special handling, and what evidence backs the result.

This preset is a named answer for one useful operating choice. It keeps the upstream chart, records the inputs and rendered YAML, and gives the team a repeatable starting point instead of a private values-file guess.

## What this is

This is the \`${base}\` preset config for \`${chart}@${version}\`. The repo also calls this a base variant. ${presetReason(base, packageBase.description ?? variant.packageBase?.description ?? "")}

The matching catalog page is [${chart}@${version}](${chartPage}).

## The chart journey

We keep the Helm chart. We lock \`${chart}@${version}\`, choose the \`${base}\` preset config, render it with the recorded values, namespace, release name, and Kubernetes capabilities, then save the output as files.

That captured output is the render variant: [\`${renderedObjects}\`](${githubUrl(renderedObjects)}). It contains ${inventory.objectCount} Kubernetes object(s)${mainKinds ? `: ${mainKinds}` : ""}.

The public package is \`${packageRef}\`. Users can pull these exact bytes without cloning this repo. When someone runs \`cub installer upload\`, ConfigHub stores the rendered Kubernetes YAML in a Space so it can be searched, compared, reviewed, changed, and delivered. The example script defaults to Space \`${displaySpace}\`, but users can choose another name with \`CUB_SPACE=...\`.

## What to check

${prereqSentence}

${routeSentence}

${whatChanged}

## Why you can trust it

${correctness.map((item) => `- ${item}`).join("\n")}

This is a claim about this recorded preset config. It is not a claim that every possible values file for this chart has been checked.

## Repeat it

Fast path with no ConfigHub account:

\`\`\`sh
bash <(curl -fsSL ${tryScript})
\`\`\`

Fast path with a ConfigHub account:

\`\`\`sh
bash <(curl -fsSL ${confighubScript})
\`\`\`

The core render command is:

\`\`\`sh
${setupCommand}
\`\`\`

After upload, create environment versions with \`cub variant create\` and move reviewed changes with \`cub variant promote\`. The walkthrough is [After Upload: Create A Variant And Promote Changes](../../../../docs/user/variants-after-upload.md).

## Preset details

| Item | Value |
| --- | --- |
| Chart | \`${chart}@${version}\` |
| Preset config | \`${base}\` |
| Namespace | \`${intent.spec.renderInputs.namespace || "default"}\` |
| Release name | \`${intent.spec.renderInputs.releaseName || ""}\` |
| Values | [\`${valuesPath}\`](${githubUrl(valuesPath)}) |
| Render intent | [\`${renderIntentPath}\`](${githubUrl(renderIntentPath)}) |
| Render variant | [\`${renderedObjects}\`](${githubUrl(renderedObjects)}) |
| Package base | [\`${packageBasePath}\`](${githubTreeUrl(packageBasePath)}) |
| Scripts | [try.sh](${tryScript}) · [confighub.sh](${confighubScript}) |

## Prerequisites and lifecycle steps

| When | What | How it is handled |
| --- | --- | --- |
${requirementRows}

## Evidence

| Check | Status |
| --- | --- |
| Render parity | \`${intent.spec.evidence?.renderParity ?? "n/a"}\` |
| ConfigHub scan/upload proof | \`${intent.spec.evidence?.confighubScanOps ?? "n/a"}\` |
| Earlier local-cluster test | \`${intent.spec.evidence?.localKind ?? "n/a"}\` |
| GitOps OCI live run | \`${intent.spec.evidence?.gitopsOciLive ?? "n/a"}\` |
| Live Helm vs ConfigHub comparison | \`${intent.spec.evidence?.liveDualParity ?? "n/a"}\` |
| Lifecycle routes | \`${intent.spec.lifecycle?.routeCount ?? "0"}\` |

## Limits

${limits.map((item) => `- ${item}`).join("\n")}

## Source files

- Chart page: [${chartPage}](${chartPage})
- Render intent: [\`${renderIntentPath}\`](${githubUrl(renderIntentPath)})
- Rendered YAML: [\`${renderedObjects}\`](${githubUrl(renderedObjects)})
- Package source: [\`${intent.spec.renderInputs.packageBase}\`](${githubTreeUrl(intent.spec.renderInputs.packageBase)})
- Generated scripts: [\`${scriptDir}\`](${githubTreeUrl(scriptDir)})
- Preset doctrine: [Helm Chart Presets And Values](../../../../docs/user/helm-presets-and-values.md)
`;
}

function summaryMd(guides, packageCount) {
  const prereqCount = guides.filter((guide) => guide.prerequisite_count > 0).length;
  const routedCount = guides.filter((guide) => guide.route_count > 0).length;
  return `# ConfigHub Example Guides

Generated by \`scripts/generate-confighub-example-guides.mjs\`.

These guides explain each public chart preset config as a short path into ConfigHub. They are generated from the same committed records that create the package, chart page, render intent, scripts, and receipts.

They are for humans first. A reader should not need to understand the whole repo before they can answer:

~~~text
What did we do to this Helm chart?
Why is this preset config the right starting point?
How do I repeat it?
What extra work, such as CRDs, Secrets, hooks, or setup jobs, is still mine to handle?
~~~

## Counts

| Count | Value |
| --- | ---: |
| Public package charts | ${packageCount} |
| Public preset config guides | ${guides.length} |
| Guides with prerequisites | ${prereqCount} |
| Guides with recorded lifecycle routes | ${routedCount} |

## How To Use This

1. Start from the Configuration Catalog chart page.
2. Pick the preset config you want to try.
3. Open the guide for that preset config.
4. Run \`try.sh\` for a no-account test, or \`confighub.sh\` to upload the rendered objects into a ConfigHub Space.

The generated CSV is [guides.csv](./guides.csv).

## Guides

| Chart | Preset config | Why this preset exists | Guide | Chart page |
| --- | --- | --- | --- | --- |
${guides.map((guide) => `| \`${guide.chart}@${guide.version}\` | \`${guide.base}\` | ${escapeMd(guide.preset_reason)} | [guide](./spaces/${guide.slug}/README.md) | [chart page](${guide.chart_page}) |`).join("\n")}
`;
}

function csvMd(guides) {
  const headers = [
    "chart",
    "version",
    "base",
    "space_slug",
    "guide_path",
    "chart_page",
    "preset_reason",
    "object_count",
    "main_kinds",
    "prerequisite_count",
    "prerequisite_summary",
    "route_count",
    "render_parity",
    "local_kind",
    "gitops_oci_live",
    "live_dual_parity",
    "package_oci_ref",
  ];
  const rows = guides.map((guide) => ({
    chart: guide.chart,
    version: guide.version,
    base: guide.base,
    space_slug: guide.slug,
    guide_path: guide.guide_path,
    chart_page: guide.chart_page,
    preset_reason: guide.preset_reason,
    object_count: guide.object_count,
    main_kinds: guide.main_kinds,
    prerequisite_count: guide.prerequisite_count,
    prerequisite_summary: guide.prerequisite_summary,
    route_count: guide.route_count,
    render_parity: guide.render_parity,
    local_kind: guide.local_kind,
    gitops_oci_live: guide.gitops_oci_live,
    live_dual_parity: guide.live_dual_parity,
    package_oci_ref: guide.package_oci_ref,
  }));
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function readInventory(path) {
  if (!path || !existsSync(join(repoRoot, path))) return { objectCount: 0, objects: [] };
  const inventory = readYaml(join(repoRoot, path));
  return {
    objectCount: Number(inventory.spec?.objectCount ?? inventory.spec?.objects?.length ?? 0),
    objects: inventory.spec?.objects ?? [],
  };
}

function normalizeRequirements(items) {
  return items.map((item) => ({
    kind: item.kind ?? "Requirement",
    name: item.name ?? "",
    namespace: item.namespace ?? "",
    suggestedSource: item.suggestedSource ?? "",
  }));
}

function setupCommandFor(intent, pkg, slug) {
  const namespace = intent.spec.renderInputs.namespace ? ` --namespace ${intent.spec.renderInputs.namespace}` : "";
  const pullRef = pkg.digest_pinned_ref || pkg.installer_oci_ref;
  return `cub installer setup --pull ${pullRef} --base ${intent.spec.baseVariant} --work-dir ./${slug} --non-interactive${namespace}`;
}

function presetReason(base, description) {
  const lower = base.toLowerCase();
  if (lower.includes("no-crds")) return "Use this when your platform, GitOps bootstrap, or another chart owns the CRDs.";
  if (lower.includes("crds-enabled") || lower.includes("minimal-crds")) return "Use this when this package should bring the CRDs needed for the install.";
  if (lower.includes("existing-secret") || lower.includes("reuse-existing-secret")) return "Use this when secret material should come from a Secret you create, not from a generated chart default.";
  if (lower.includes("static-password")) return "Use this only to inspect and compare the fixed shared password. Do not use it as a production starting configuration.";
  if (lower.includes("legacy")) return "Use this when this package must use the legacy image location for the chart's containers.";
  if (lower.includes("reviewed")) return "Use this when you want a catalog-reviewed starting configuration instead of the chart's unreviewed default.";
  if (lower.includes("cluster-metrics-readonly")) return "Use this when the component should read cluster metrics without modifying cluster resources.";
  if (lower.includes("node-or-cluster-collector")) return "Use this when you need a node or cluster collector.";
  if (lower.includes("apiservice-v1-capability")) return "Use this when the target cluster serves apiregistration.k8s.io/v1.";
  if (lower.includes("sync-secret-rotation")) return "Use this when Secret sync and rotation are the operating choice you want to test.";
  if (lower.includes("external-tls-ca")) return "Use this when TLS CA material is supplied outside the chart.";
  if (lower.includes("ha")) return "Use this when you want the catalog's reviewed high-availability configuration.";
  if (lower.includes("ingress") || lower.includes("tls")) return "Use this when service exposure, TLS, or ingress ownership is the important operating choice.";
  if (lower.includes("internal") || lower.includes("clusterip")) return "Use this when the service should stay inside the cluster or platform network.";
  if (lower.includes("server-only") || lower.includes("single") || lower.includes("ephemeral")) return "Use this when you want a smaller configuration for first tests or local use.";
  if (lower.includes("dev")) return "Use this for development or local testing. It is not a production recommendation.";
  if (lower === "default") return "Use this when you want to start from the chart author's normal path, with the inputs recorded.";
  if (description) return cleanSentence(description);
  return "Use this as one recorded, repeatable way to render this chart.";
}

function changedFromHelm(base, requirements, routeCount, matrixRow) {
  const lines = [];
  if (base.includes("no-crds")) lines.push("CRDs are made into an explicit choice instead of being mixed into the application install.");
  if (base.includes("crds")) lines.push("CRD ownership is recorded as part of the preset config.");
  if (base.includes("existing-secret") || base.includes("reuse-existing-secret")) lines.push("Secret material is kept outside the chart render and supplied by you.");
  if (base.includes("static-password")) lines.push("The fixed shared password is shown plainly so nobody mistakes it for a generated credential.");
  if (requirements.some((item) => item.name.startsWith("CRD "))) lines.push("Some CRDs must already exist before the rendered objects are applied.");
  if (requirements.some((item) => item.name.startsWith("Secret "))) lines.push("At least one Secret must be created with your values before apply.");
  if (routeCount > 0) lines.push("Hooks, setup jobs, and other install or upgrade steps are listed separately, so you can see what must run and when.");
  if (matrixRow.hard_gap) lines.push(humanGap(matrixRow.hard_gap));
  if (!lines.length) return "For this preset, the main change from plain Helm is that the render inputs and output files are recorded before upload.";
  return lines.join(" ");
}

function requirementSentence(requirements, routes) {
  if (!requirements.length && preflightRoutes(routes).length) {
    return "This preset needs a setup step before Kubernetes can accept all of the rendered objects. The step is described below and is part of the tested install path.";
  }
  if (!requirements.length) {
    return "The current catalog record does not identify an extra Secret, CRD, or setup step that must be supplied before install.";
  }
  const packaged = requirements.filter((requirement) => packagedRequirementPath(requirement.suggestedSource));
  if (packaged.length === requirements.length) {
    return `This preset config records ${requirements.length} ${requirements.length === 1 ? "prerequisite" : "prerequisites"}: ${requirementSummary(requirements)}. The public package includes the files used to prepare them, and the generated try script applies them in the required order.`;
  }
  return `This preset config records ${requirements.length} ${requirements.length === 1 ? "prerequisite" : "prerequisites"}: ${requirementSummary(requirements)}. Follow the instructions below before you apply the rendered objects.`;
}

function requirementSummary(requirements) {
  if (!requirements.length) return "none";
  const crds = requirements.filter((item) => item.name.startsWith("CRD ")).length;
  const secrets = requirements.filter((item) => item.name.startsWith("Secret ")).length;
  const other = requirements.length - crds - secrets;
  return [
    crds ? `${crds} CRD${crds === 1 ? "" : "s"}` : "",
    secrets ? `${secrets} Secret${secrets === 1 ? "" : "s"}` : "",
    other ? `${other} other item${other === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(", ");
}

function lifecycleSentence(routes) {
  if (!routes.length) return "The catalog does not currently record a separate hook, setup job, or cleanup step for this preset.";
  const lines = orderedRoutes(routes).map((route) => `- **${routeWhen(route)}:** ${cleanSentence(route.operatingDetails || route.routeName)}`);
  return `The catalog records ${routes.length} extra ${routes.length === 1 ? "step" : "steps"} for this preset. We call these lifecycle routes because they say what must happen before, during, or after Kubernetes applies the main set of files.\n\n${lines.join("\n")}`;
}

function correctnessBullets(intent, inventory, routeCount, requirements) {
  const bullets = [
    `The chart version, source, namespace, release name, values, and capability profile are recorded in the render intent.`,
    `The render variant is committed as YAML and contains ${inventory.objectCount} Kubernetes object(s).`,
    `The installer package OCI ref points to the package users pull for this chart version.`,
  ];
  if (intent.spec.evidence?.renderParity === "yes") {
    bullets.push("Render parity is recorded as passing for this preset config.");
  } else {
    bullets.push(`Render parity is currently recorded as ${intent.spec.evidence?.renderParity || "not recorded"}; treat that as the boundary.`);
  }
  if (requirements.length) bullets.push("Prerequisites are named before apply, so they are not discovered after rollout.");
  if (routeCount) bullets.push("Hook and lifecycle work is counted and linked to the route record.");
  return bullets;
}

function prerequisiteAndRouteRows(requirements, routes) {
  const rows = [];
  const packagedGroups = new Map();
  for (const requirement of requirements) {
    const path = packagedRequirementPath(requirement.suggestedSource);
    if (!path) {
      rows.push(`| Before install | ${escapeMd(`${requirement.kind}: ${requirement.name}`)} | ${escapeMd(requirementHow(requirement))} |`);
      continue;
    }
    const group = packagedGroups.get(path) ?? [];
    group.push(requirement);
    packagedGroups.set(path, group);
  }
  for (const grouped of packagedGroups.values()) {
    const crdNames = grouped
      .map((item) => /^CRD\s+(.+)$/.exec(String(item.name ?? ""))?.[1])
      .filter(Boolean);
    const what = crdNames.length === grouped.length
      ? `${crdNames.length} ${crdNames.length === 1 ? "CRD" : "CRDs"}: ${crdNames.join(", ")}`
      : grouped.map((item) => `${item.kind}: ${item.name}`).join(", ");
    rows.push(`| Before install | ${escapeMd(what)} | ${escapeMd(requirementHow(grouped[0]))} |`);
  }
  for (const route of orderedRoutes(routes)) {
    rows.push(`| ${escapeMd(routeWhen(route))} | ${escapeMd(routeLabel(route))} | ${escapeMd(cleanSentence(route.operatingDetails || route.routeName))} |`);
  }
  return rows.length
    ? rows.join("\n")
    : "| No extra step recorded | The catalog has not identified a separate prerequisite or lifecycle step for this preset. | Check the limits and evidence before production use. |";
}

function requirementHow(requirement) {
  const path = packagedRequirementPath(requirement.suggestedSource);
  if (path) {
    return `Included in the public package as ${path}. The generated try script applies it and waits for the required CRD before installing the main objects.`;
  }
  return requirement.suggestedSource || "Choose the value for your target, then create it before apply.";
}

function packagedRequirementPath(value) {
  const match = /^package:\/\/([a-zA-Z0-9._/-]+)$/.exec(String(value ?? "").trim());
  if (!match || match[1].split("/").includes("..")) return "";
  return match[1];
}

function presetScriptDir(pkg, base) {
  const pageName = String(pkg.chart_page ?? "").split("/").at(-1) || "";
  const chartSlug = pageName.replace(/\.html$/, "");
  const baseSlug = String(base)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `site/sh/${chartSlug}/${baseSlug}`;
}

function verifyLocalScriptLinks(markdown, sourcePath) {
  for (const match of markdown.matchAll(/https:\/\/confighub\.github\.io\/helm-expt\/site\/(sh\/[^)\s]+\.sh)/g)) {
    const localPath = join(repoRoot, "site", match[1]);
    check(existsSync(localPath), `${relativeRepo(sourcePath)} links to missing ${relativeRepo(localPath)}`);
  }
}

function verifyHumanCopy(markdown, sourcePath) {
  for (const phrase of FORBIDDEN_HUMAN_PHRASES) {
    check(!markdown.toLowerCase().includes(phrase), `${relativeRepo(sourcePath)} contains unclear phrase: ${phrase}`);
  }
}

function humanGap(gap) {
  if (gap === "ha (curated proof lane - bespoke teaching needed)") {
    return "The catalog has not yet tested a realistic high-availability configuration for this chart.";
  }
  return `Known limitation: ${cleanSentence(gap)}`;
}

function preflightRoutes(routes) {
  return routes.filter((route) =>
    route.lifecyclePhase === "preflight"
    || route.routeName === "preflight-or-presync"
    || route.routeName === "crd-first-apply"
    || route.routeName === "preflight-or-presync-crd-apply"
    || route.routeName === "preserve-ordering"
    || route.routeName === "self-contained-crd-base"
    || route.routeName === "target-facts-or-preflight",
  );
}

function routeWhen(route) {
  if (["delete-cleanup-policy", "explicit-delete-cleanup-action", "preserve-cleanup-policy"].includes(route.routeName)) return "When uninstalling";
  if (route.routeName === "upgrade-action-with-receipt" || route.lifecyclePhase === "upgrade") return "During upgrade";
  if (preflightRoutes([route]).length) return "Before install";
  if (
    ["explicit-test-check", "postsync-check-or-observation", "webhook-readiness-observation"].includes(route.routeName)
    || ["post-apply", "post-install"].includes(route.lifecyclePhase)
  ) return "After install";
  return "As part of delivery";
}

function routeLabel(route) {
  const labels = {
    "preflight-or-presync": "Prepare the target",
    "crd-first-apply": "Install CRDs first",
    "preflight-or-presync-crd-apply": "Install CRDs first",
    "target-facts-or-preflight": "Prepare the target",
    "self-contained-crd-base": "Apply CRDs before custom resources",
    "preserve-ordering": "Keep the required apply order",
    "delete-cleanup-policy": "Use the chart's cleanup policy",
    "preserve-cleanup-policy": "Keep the chart's cleanup policy",
    "explicit-delete-cleanup-action": "Run the cleanup step",
    "upgrade-action-with-receipt": "Run the upgrade step",
    "explicit-test-check": "Run the chart check",
    "postsync-check-or-observation": "Check the completed install",
    "webhook-readiness-observation": "Wait for the webhook to be ready",
  };
  return labels[route.routeName] || route.routeName;
}

function orderedRoutes(routes) {
  const order = new Map([
    ["Before install", 0],
    ["As part of delivery", 1],
    ["After install", 2],
    ["During upgrade", 3],
    ["When uninstalling", 4],
  ]);
  return [...routes].sort((left, right) =>
    (order.get(routeWhen(left)) ?? 99) - (order.get(routeWhen(right)) ?? 99)
    || String(left.routeName).localeCompare(String(right.routeName)),
  );
}

function limitsFor(intent, matrixRow, chartUseRow, base) {
  const limits = [];
  if ((intent.spec.evidence?.localKind ?? "") !== "yes") {
    if (intent.spec.evidence?.liveDualParity === "yes") {
      limits.push("An older local-cluster test failed before the required setup was added. The newer end-to-end Helm and ConfigHub comparison passed with the setup described above.");
    } else {
      limits.push(`Local kind evidence is ${intent.spec.evidence?.localKind || "not recorded"} for this preset config.`);
    }
  }
  if ((intent.spec.evidence?.gitopsOciLive ?? "") !== "yes") limits.push(`GitOps OCI live evidence is ${intent.spec.evidence?.gitopsOciLive || "not recorded"} for this preset config.`);
  if (matrixRow.hard_gap) limits.push(humanGap(matrixRow.hard_gap));
  if (chartUseRow.production_note) limits.push(chartUseRow.production_note);
  if (base.includes("static-password")) limits.push("Do not use the static-passwords preset as a production credential strategy.");
  if (!limits.length) limits.push("No extra limit is recorded beyond the evidence table above.");
  return [...new Set(limits.map(cleanSentence))];
}

function kindSummary(objects) {
  const counts = new Map();
  for (const object of objects ?? []) counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([kind, count]) => `${kind} x${count}`)
    .join(", ");
}

function defaultSpaceFor(chart, base) {
  const chartName = chart.split("/").at(-1).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `helm-${chartName}-${base}`;
}

function chartPageUrl(path) {
  if (!path) return `${SITE_BASE_URL}charts/index.html`;
  return `${SITE_BASE_URL}${path.replace(/^site\//, "")}`;
}

function githubUrl(path) {
  if (!path) return "";
  return `${GITHUB_BASE_URL}${path}`;
}

function githubTreeUrl(path) {
  if (!path) return "";
  return `https://github.com/confighub/helm-expt/tree/main/${path}`;
}

function cleanSentence(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.endsWith(".") ? text : `${text}.`;
}

function escapeMd(value) {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
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
