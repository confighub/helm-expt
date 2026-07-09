#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, toYaml, write, writeYaml } from "./lib/proof-common.mjs";
import { installerOciRef } from "./lib/installer-oci.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "helm-render-intents");
const intentsRoot = join(root, "intents");
const matrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
const lifecycleByVariantPath = join(repoRoot, "data", "lifecycle-routes-by-variant", "by-variant.json");
const gitopsRouteEmissionPath = join(repoRoot, "data", "gitops-route-emission", "emission.json");
const targetPrereqActionsPath = join(repoRoot, "data", "target-prerequisite-actions", "actions.csv");

const outputs = {
  summary: join(root, "summary.md"),
  csv: join(root, "intents.csv"),
  json: join(root, "intents.json"),
  contract: join(root, "contract.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  rmSync(intentsRoot, { recursive: true, force: true });
  for (const intent of report.intents) writeYaml(join(intentsRoot, `${intent.metadata.name}.yaml`), intent);
  write(outputs.summary, report.summary);
  write(outputs.csv, report.csv);
  write(outputs.json, `${JSON.stringify({ intents: report.intents }, null, 2)}\n`);
  write(outputs.contract, report.contract);
  console.log(`wrote helm render intents -> ${relativeRepo(root)} (${report.intents.length} intent(s), ${report.candidates} candidate row(s) skipped)`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run helm-render-intents`);
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run helm-render-intents`);
  check(existsSync(outputs.json), `${relativeRepo(outputs.json)} is missing; run npm run helm-render-intents`);
  check(existsSync(outputs.contract), `${relativeRepo(outputs.contract)} is missing; run npm run helm-render-intents`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run helm-render-intents`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run helm-render-intents`);
  check(readFileSync(outputs.json, "utf8") === `${JSON.stringify({ intents: report.intents }, null, 2)}\n`, `${relativeRepo(outputs.json)} is stale; run npm run helm-render-intents`);
  check(readFileSync(outputs.contract, "utf8") === report.contract, `${relativeRepo(outputs.contract)} is stale; run npm run helm-render-intents`);
  for (const intent of report.intents) {
    const path = join(intentsRoot, `${intent.metadata.name}.yaml`);
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run helm-render-intents`);
    check(readFileSync(path, "utf8") === `${toYaml(intent)}\n`, `${relativeRepo(path)} is stale; run npm run helm-render-intents`);
  }
  console.log(`verified helm render intents for ${report.intents.length} real base row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-helm-render-intents.mjs --generate
  node scripts/generate-helm-render-intents.mjs --verify`);
}

function buildReport() {
  check(existsSync(matrixPath), "data/master-catalog-matrix/matrix.csv is missing; run npm run master-matrix");
  const matrixRows = parseCsv(readFileSync(matrixPath, "utf8"));
  const lifecycleByVariant = existsSync(lifecycleByVariantPath)
    ? JSON.parse(readFileSync(lifecycleByVariantPath, "utf8")).charts ?? []
    : [];
  const gitopsRouteEmission = existsSync(gitopsRouteEmissionPath)
    ? JSON.parse(readFileSync(gitopsRouteEmissionPath, "utf8")).charts ?? []
    : [];
  const targetPrereqRows = existsSync(targetPrereqActionsPath)
    ? parseCsv(readFileSync(targetPrereqActionsPath, "utf8"))
    : [];
  const realBases = matrixRows.filter((row) => row.row_kind === "base" && row.row_status !== "candidate" && !row.row_status.startsWith("candidate-"));
  const candidates = matrixRows.filter((row) => row.row_kind === "candidate" || row.row_status.startsWith("candidate")).length;
  const intents = realBases.map((row) => buildIntent(row, lifecycleByVariant, gitopsRouteEmission, targetPrereqRows)).sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  const summary = summaryMd(intents, matrixRows, candidates);
  const csv = renderCsv(intents);
  const contract = contractMd(intents, candidates);
  return { intents, candidates, summary, csv, contract };
}

function buildIntent(row, lifecycleByVariant, gitopsRouteEmission, targetPrereqRows) {
  const variantSpec = readVariantSpec(row.variant_path);
  const chartLifecycle = lifecycleByVariant.find((item) => item.chart === row.chart);
  const variantLifecycle = chartLifecycle?.variants?.find((item) => item.base === row.variant && (!item.recipeVersion || item.recipeVersion === row.version));
  const chartGitops = gitopsRouteEmission.find((item) => item.chart === row.chart);
  const variantGitops = chartGitops?.variants?.find((item) => item.base === row.variant && (!item.recipeVersion || item.recipeVersion === row.version));
  const targetFacts = targetPrereqRows.filter((item) => item.chart === row.chart && item.version === row.version && item.base === row.variant);
  const sourceLock = row.source_lock_path && existsSync(join(repoRoot, row.source_lock_path)) ? readYaml(join(repoRoot, row.source_lock_path)) : null;
  const chartName = sourceLock?.spec?.ref || (sourceLock?.spec?.repositoryName && sourceLock?.spec?.chart ? `${sourceLock.spec.repositoryName}/${sourceLock.spec.chart}` : row.chart);
  const name = intentSlug(row.chart, row.version, row.variant);
  const lifecycleRoutes = (variantLifecycle?.routes ?? []).map((route) => {
    const emission = variantGitops?.routes?.find((item) => item.route_name === route.route_name && item.action_kind === route.action_kind);
    check(emission, `missing GitOps route emission for ${row.chart}@${row.version} ${row.variant} ${route.route_name}`);
    const routeEvidence = splitList(route.evidence);
    check(route.sourceVersion, `missing route source version for ${row.chart}@${row.version} ${row.variant} ${route.route_name}`);
    check(routeEvidence.length > 0, `missing route evidence for ${row.chart}@${row.version} ${row.variant} ${route.route_name}`);
    return {
      routeName: route.route_name,
      quirkClass: route.quirk_class,
      lifecyclePhase: route.lifecycle_phase,
      actionKind: route.action_kind,
      executionMode: route.execution_mode,
      automatic: route.automatic === true,
      whoRuns: route.whoRuns,
      command: route.command,
      disposition: route.disposition,
      delta: route.delta,
      reason: route.reason,
      routeSourceVersion: route.sourceVersion,
      evidence: routeEvidence,
      nextAction: route.nextAction,
      evidenceRequired: route.evidenceRequired,
      sourceDrift: route.sourceDrift,
      gitOps: {
        emitsControllerStep: emission.emit === true,
        argoCd: emission.argo,
        flux: emission.flux,
        argoCdSnippet: emission.snippet,
      },
    };
  });
  const targetActions = targetFacts.map((fact) => ({
    lane: fact.lane,
    prerequisiteKind: fact.prerequisite_kind,
    prerequisiteName: fact.prerequisite_name,
    actionKind: fact.action_kind,
    ownerClass: fact.owner_class,
    requiredInputs: fact.required_inputs,
    evidenceRequired: fact.evidence_required,
    automatic: fact.automatic === "true",
    supportArtifact: fact.support_artifact,
    sourceReceipt: fact.source_receipt,
    rerunCommand: fact.rerun_command,
  }));
  const declaredTargetFacts = variantSpec.targetFacts ?? {};
  const declaredTargetFactCount = targetFactCount(declaredTargetFacts);
  const targetStatus = declaredTargetFactCount > 0 && targetActions.length > 0
    ? "declared-target-facts-and-observed-action-records"
    : declaredTargetFactCount > 0
      ? "declared-target-facts"
      : targetActions.length > 0
        ? "observed-action-records"
        : "none-declared-or-observed";
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmRenderIntent",
    metadata: {
      name,
      labels: {
        component: row.chart,
        chart: row.chart,
        version: row.version,
        base: row.variant,
        catalogLayer: row.catalog_layer,
      },
    },
    spec: {
      component: row.chart,
      chart: {
        name: chartName,
        version: row.version,
        sourceRepository: row.source_repository_url || sourceLock?.spec?.repositoryURL || "",
        sourceContent: row.source_content_url || "",
      },
      baseVariant: row.variant,
      renderInputs: {
        recipe: row.recipe_path || "",
        variant: row.variant_path || "",
        revision: row.variant_revision_path || "",
        packageBase: row.package_base_path || "",
        installerPackageOciRef: installerOciRef(row.chart, row.version),
        sourceLock: row.source_lock_path || "",
        namespace: variantSpec.namespace ?? "",
        releaseName: variantSpec.releaseName ?? "",
        valuesProfile: resolveVariantPath(row.variant_path, variantSpec.valuesProfile),
        capabilityProfile: variantSpec.capabilityProfile ?? {},
        hookPolicy: variantSpec.hookPolicy ?? "",
      },
      renderOutput: {
        renderedObjects: renderedObjectsPath(row.variant_revision_path),
        objectInventory: objectInventoryPath(row.variant_revision_path),
        revision: row.variant_revision_path || "",
        packageBase: row.package_base_path || "",
      },
      evidence: {
        renderParity: lane(row.lane_render_parity),
        confighubScanOps: lane(row.lane_confighub_scan_ops),
        localKind: lane(row.lane_local_kind),
        lifecycleObserved: lane(row.lane_lifecycle_observed),
        gitopsOciLive: lane(row.lane_gitops_oci_live),
        liveDualParity: lane(row.lane_live_dual_parity),
        twoClusterKind: lane(row.lane_two_cluster_kind),
        variantPromotion: lane(row.variant_promotion_status || row.variant_promotion),
      },
      lifecycle: {
        routeContract: row.lifecycle_route_contract || "n/a",
        routeCount: row.lifecycle_route_count || "0",
        dispositions: row.lifecycle_route_dispositions || "n/a",
        executionModes: row.lifecycle_route_execution_modes || "n/a",
        safeAutomatic: row.lifecycle_route_safe_automatic || "n/a",
        contractPath: row.lifecycle_route_contract_path || "",
        jsonPath: row.lifecycle_route_json_path || "",
        variantRoutes: lifecycleRoutes,
      },
      targetFacts: {
        status: targetStatus,
        declared: declaredTargetFacts,
        actions: targetActions,
      },
      provenance: {
        matrixRowKind: row.row_kind,
        catalogLayer: row.catalog_layer,
        customizationLayer: row.customization_layer,
        rowStatus: row.row_status,
        githubRecipeUrl: row.github_recipe_url || "",
        githubPackageBaseUrl: row.github_package_base_url || "",
        fullModelPath: [
          `chart/version: ${row.chart}@${row.version}`,
          `recipe: ${row.recipe_path || "(missing)"}`,
          `base variant: ${row.variant}`,
          `render intent: data/helm-render-intents/intents/${name}.yaml`,
          `rendered revision: ${row.variant_revision_path || "(missing)"}`,
          `full rendered YAML: ${renderedObjectsPath(row.variant_revision_path) || "(missing)"}`,
          `installer package OCI: ${installerOciRef(row.chart, row.version)}`,
          `package base: ${row.package_base_path || "(missing)"}`,
          "ConfigHub Units: created when the package is uploaded",
          "managed variants: created after upload with cub variant create/promote",
          "targets and observations: recorded by the live lanes when run",
        ],
      },
    },
    status: {
      disposition: "real-base-render-intent",
      claim: "This intent describes a committed real base variant and its render inputs. It is not a claim that every live delivery lane is green.",
      limits: [
        "Candidate and custom-discussion rows are not emitted as runnable render intents.",
        "Declared target facts are copied from the base variant. Observed action records appear only when committed failure evidence exists; their absence does not erase the declaration.",
        "Missing lifecycle route data is not treated as proof that no route is needed.",
        "ConfigHub server objects and managed variants are created after upload. This file records the render intent, not a live server object.",
      ],
    },
  };
}

function readVariantSpec(path) {
  if (!path) return {};
  const absolute = join(repoRoot, path);
  if (!existsSync(absolute)) return {};
  return readYaml(absolute).spec ?? {};
}

function targetFactCount(targetFacts) {
  return Object.values(targetFacts ?? {}).reduce((count, value) => count + (Array.isArray(value) ? value.length : 0), 0);
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function resolveVariantPath(variantPath, value) {
  if (!value) return "";
  if (!variantPath || value.startsWith("/")) return value;
  const base = variantPath.split("/").slice(0, -1).join("/");
  return normalizePath(`${base}/${value}`);
}

function lane(value) {
  return String(value || "").trim() || "blank";
}

function intentSlug(chart, version, base) {
  return `${chart}-${version}-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizePath(path) {
  const out = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function renderedObjectsPath(revisionPath) {
  if (!revisionPath) return "";
  return revisionPath.replace(/variant-revision\.yaml$/, "rendered/release-objects.yaml");
}

function objectInventoryPath(revisionPath) {
  if (!revisionPath) return "";
  return revisionPath.replace(/variant-revision\.yaml$/, "rendered/object-inventory.yaml");
}

function renderCsv(intents) {
  const headers = [
    "name",
    "chart",
    "version",
    "base",
    "catalog_layer",
    "recipe_path",
    "variant_path",
    "rendered_objects_path",
    "package_base_path",
    "installer_package_oci_ref",
    "intent_path",
    "render_parity",
    "confighub_scan_ops",
    "local_kind",
    "gitops_oci_live",
    "live_dual_parity",
    "two_cluster_kind",
    "variant_promotion",
    "lifecycle_route_contract",
    "lifecycle_route_count",
    "gitops_route_count",
    "declared_target_fact_count",
    "target_fact_action_count",
    "source_repository_url",
  ];
  const rows = intents.map((intent) => {
    const row = {
      name: intent.metadata.name,
      chart: intent.spec.chart.name,
      version: intent.spec.chart.version,
      base: intent.spec.baseVariant,
      catalog_layer: intent.spec.provenance.catalogLayer,
      recipe_path: intent.spec.renderInputs.recipe,
      variant_path: intent.spec.renderInputs.variant,
      package_base_path: intent.spec.renderInputs.packageBase,
      installer_package_oci_ref: intent.spec.renderInputs.installerPackageOciRef,
      rendered_objects_path: intent.spec.renderOutput.renderedObjects,
      intent_path: `data/helm-render-intents/intents/${intent.metadata.name}.yaml`,
      render_parity: intent.spec.evidence.renderParity,
      confighub_scan_ops: intent.spec.evidence.confighubScanOps,
      local_kind: intent.spec.evidence.localKind,
      gitops_oci_live: intent.spec.evidence.gitopsOciLive,
      live_dual_parity: intent.spec.evidence.liveDualParity,
      two_cluster_kind: intent.spec.evidence.twoClusterKind,
      variant_promotion: intent.spec.evidence.variantPromotion,
      lifecycle_route_contract: intent.spec.lifecycle.routeContract,
      lifecycle_route_count: intent.spec.lifecycle.routeCount,
      gitops_route_count: String(intent.spec.lifecycle.variantRoutes.filter((route) => route.gitOps).length),
      declared_target_fact_count: String(targetFactCount(intent.spec.targetFacts.declared)),
      target_fact_action_count: String(intent.spec.targetFacts.actions.length),
      source_repository_url: intent.spec.chart.sourceRepository,
    };
    return headers.map((header) => csvCell(row[header])).join(",");
  });
  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function summaryMd(intents, matrixRows, candidates) {
  const byLayer = countBy(intents, (intent) => intent.spec.provenance.catalogLayer);
  const routeCount = intents.filter((intent) => Number(intent.spec.lifecycle.routeCount || 0) > 0).length;
  const gitopsRouteCount = intents.filter((intent) => intent.spec.lifecycle.variantRoutes.some((route) => route.gitOps)).length;
  const declaredTargetFactCount = intents.filter((intent) => targetFactCount(intent.spec.targetFacts.declared) > 0).length;
  const targetActionCount = intents.filter((intent) => intent.spec.targetFacts.actions.length > 0).length;
  const realBaseRows = matrixRows.filter((row) => row.row_kind === "base" && row.row_status !== "candidate" && !row.row_status.startsWith("candidate-")).length;
  const o = [];
  o.push("# Helm Render Intents", "");
  o.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by `scripts/generate-helm-render-intents.mjs`; do not hand-edit. Regenerate with `npm run helm-render-intents`.");
  o.push("");
  o.push("This report connects the full helm-expt chain to the shorter ConfigHub model. A render intent is one reviewed base-variant path: chart, version, values profile, namespace, capability profile, source lock, package base, installer package OCI ref, evidence lanes, lifecycle routes, and target prerequisites.");
  o.push("");
  o.push("The generator emits files only for real base rows in the master matrix. Candidate and custom-discussion rows stay visible in the matrix, but they are not emitted as runnable render-intent configs yet.");
  o.push("");
  o.push("## Snapshot", "");
  o.push("| Measure | Count |");
  o.push("| --- | ---: |");
  o.push(`| Real base rows in the matrix | ${realBaseRows} |`);
  o.push(`| Generated HelmRenderIntent objects | ${intents.length} |`);
  o.push(`| Candidate/custom-discussion rows skipped | ${candidates} |`);
  o.push(`| Intents with lifecycle routes attached | ${routeCount} |`);
  o.push(`| Intents whose routes name the Argo CD and Flux handling | ${gitopsRouteCount} |`);
  o.push(`| Intents with target facts declared by the base variant | ${declaredTargetFactCount} |`);
  o.push(`| Intents with action records from observed prerequisite failures | ${targetActionCount} |`);
  o.push("");
  o.push("## By Catalog Layer", "");
  o.push("| Layer | Intents |");
  o.push("| --- | ---: |");
  for (const [layer, count] of byLayer) o.push(`| ${layer || "(blank)"} | ${count} |`);
  o.push("");
  o.push("## Model", "");
  o.push("Simple view:");
  o.push("");
  o.push("```text");
  o.push("Component");
  o.push("  base variants: the named render choices for Helm");
  o.push("    render variants: the captured Kubernetes output for one base");
  o.push("  managed variants: how ConfigHub operates the rendered config");
  o.push("```");
  o.push("");
  o.push("Full helm-expt view:");
  o.push("");
  o.push("```text");
  o.push("chart/version");
  o.push("  recipe");
  o.push("    base variant");
  o.push("      render intent");
  o.push("        render variant / rendered revision");
  o.push("          package base");
  o.push("            ConfigHub Units");
  o.push("              managed variants");
  o.push("                promotions / targets / observations");
  o.push("```");
  o.push("");
  o.push("A render intent keeps two kinds of prerequisite information separate. `targetFacts.declared` copies what the base says must exist, such as a Secret or CRD. `targetFacts.actions` contains follow-up records derived from observed prerequisite failures. Lifecycle routes also state how Argo CD and Flux handle each step for that exact chart version and base.");
  o.push("");
  const examples = renderVariantExamples(intents);
  if (examples.length) {
    o.push("## Render Variant Examples", "");
    o.push("A render variant is the captured output of one base render. Open `rendered/release-objects.yaml` for the full Kubernetes YAML. That file is the object output, not the whole record. The render intent, `variant-revision`, lifecycle routes, target facts, and receipts explain the inputs, checksums, hooks, CRDs, setup work, and prerequisites around that output.");
    o.push("");
    o.push("| Component | Base variant | Render intent | Full rendered YAML | Package OCI | Other render records | Why it exists |");
    o.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const example of examples) {
      o.push(`| ${example.component} | \`${example.base}\` | [${example.name}](./intents/${example.name}.yaml) | [release-objects.yaml](../../${example.renderedObjects}) | \`${example.installerPackageOciRef}\` | [revision](../../${example.revision}) and [package base](../../${example.packageBase}) | ${example.reason} |`);
    }
    o.push("");
  }
  o.push("## Files", "");
  o.push("- [`intents.csv`](./intents.csv) - one row per generated render intent.");
  o.push("- [`intents.json`](./intents.json) - all generated render intents in one object.");
  o.push("- [`intents/`](./intents/) - one YAML file per generated render intent.");
  o.push("- [`contract.md`](./contract.md) - what the generated object claims and refuses to claim.");
  o.push("");
  o.push("## Regenerate", "");
  o.push("```sh");
  o.push("npm run helm-render-intents");
  o.push("npm run helm-render-intents:verify");
  o.push("```");
  return `${o.join("\n")}\n`;
}

function renderVariantExamples(intents) {
  const wanted = [
    {
      name: "bitnami-redis-25-5-3-default",
      reason: "The Redis default render. Use it to compare with the existing-secret render.",
    },
    {
      name: "bitnami-redis-25-5-3-reuse-existing-secret",
      reason: "A Redis render that points at an existing Secret instead of using generated password material.",
    },
    {
      name: "argo-cd-argo-cd-9-5-15-no-crds",
      reason: "An Argo CD render that keeps CRDs out of this base so CRD ordering can be handled explicitly.",
    },
    {
      name: "prometheus-community-kube-prometheus-stack-85-3-3-no-crds",
      reason: "A kube-prometheus-stack render with CRDs owned outside the base and seven recorded lifecycle routes.",
    },
    {
      name: "prometheus-community-prometheus-29-8-0-server-only-ephemeral",
      reason: "A Prometheus render for the server path without the extra default components.",
    },
  ];
  return wanted
    .map((item) => {
      const intent = intents.find((candidate) => candidate.metadata.name === item.name);
      if (!intent) return null;
      return {
        ...item,
        component: `${intent.spec.chart.name} ${intent.spec.chart.version}`,
        base: intent.spec.baseVariant,
        renderedObjects: intent.spec.renderOutput.renderedObjects,
        revision: intent.spec.renderOutput.revision,
        packageBase: intent.spec.renderOutput.packageBase,
        installerPackageOciRef: intent.spec.renderInputs.installerPackageOciRef,
      };
    })
    .filter(Boolean);
}

function contractMd(intents, candidates) {
  return `# Helm Render Intent Contract

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`scripts/generate-helm-render-intents.mjs\`; do not hand-edit.

A \`HelmRenderIntent\` is a generated config object for one real base variant in the master matrix. It records the Helm render inputs and attaches the evidence and route facts that already exist in the repository.

## What It Claims

- The row is a real base variant, not a candidate row.
- The chart, version, recipe, source lock, variant file, full rendered YAML, rendered revision, and package base are named.
- The same evidence lanes shown in the master matrix are copied onto the object.
- Target facts declared in the base variant are copied onto the object.
- Lifecycle routes are attached by exact chart version and base, including the recorded Argo CD and Flux handling.
- Action records derived from observed prerequisite failures stay separate from declared target facts.

## What It Does Not Claim

- It does not mean every live lane is green.
- It does not make hook execution automatic.
- It does not replace the full helm-expt chain.
- It does not create ConfigHub server state by itself. Upload and variant creation still happen later.
- It does not emit candidate/custom-discussion rows as runnable configs. Current skipped candidate rows: ${candidates}.

## Current Coverage

Generated objects: ${intents.length}.

The verifier fails if the generated CSV, JSON, summary, contract, or per-intent YAML files drift from the master matrix, variant declarations, or joined route/prerequisite data.
`;
}

function countBy(items, fn) {
  const counts = new Map();
  for (const item of items) counts.set(fn(item), (counts.get(fn(item)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
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
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
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
