import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const verify = args.includes("--verify");
const generate = args.includes("--generate") || !verify;
const recipeArg = optionValue("--recipe");

if (!generate && !verify) usage();

const statusContext = loadStatusContext();
const roots = recipeArg ? [resolve(repoRoot, recipeArg)] : recipeRoots();
check(roots.length > 0, "no recipe roots found");

const outputs = roots.map((root) => buildChartCatalog(root, statusContext));

if (verify) {
  for (const output of outputs) {
    assertFresh(output.indexPath, output.indexYaml);
    assertFresh(output.catalogPath, output.catalogMarkdown);
  }
  console.log(`verified ${outputs.length} chart catalog map(s)`);
} else {
  for (const output of outputs) {
    writeYaml(output.indexPath, output.index);
    write(output.catalogPath, output.catalogMarkdown);
  }
  console.log(`wrote ${outputs.length} chart catalog map(s)`);
}

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function usage() {
  console.log(`Usage:
  node scripts/generate-chart-catalogs.mjs --generate
  node scripts/generate-chart-catalogs.mjs --verify
  node scripts/generate-chart-catalogs.mjs --recipe recipes/bitnami/redis/25.5.3 --generate`);
  process.exit(1);
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function buildChartCatalog(root, context) {
  const required = (relativePath) => {
    const path = join(root, relativePath);
    check(existsSync(path), `${relativeRepo(root)} missing ${relativePath}`);
    return path;
  };

  const recipe = readYaml(required("recipe.yaml"));
  const sourceLock = readYaml(required("source-lock.yaml"));
  const dependencyLock = readYaml(required("dependency-lock.yaml"));
  const helmPlan = readYaml(required("helm-plan.yaml"));
  readYaml(required("chart-dossier.yaml"));
  const controlPoints = readYaml(required("control-points.yaml"));
  readYaml(required("value-model.yaml"));
  const catalogStatus = readYaml(required("catalog-status.yaml"));
  const packageReceipt = readYaml(required("publication/installer-package-receipt.yaml"));

  const chartRef =
    helmPlan.spec?.readiness?.chart ??
    sourceLock.spec?.ref ??
    `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? recipe.metadata?.version ?? "");
  const chartKey = `${chartRef}@${version}`;
  const proofSummary = proofSummaryFor(chartKey, context);
  const packagePath = packageReceipt.spec?.package?.path;
  check(packagePath, `${relativeRepo(root)} publication receipt missing package path`);
  const packageRoot = join(repoRoot, packagePath);
  const installerPath = join(packageRoot, "installer.yaml");
  const weirdnessPath = join(root, "weirdness-and-mitigations.md");
  const painReportPath = join(root, "helm-pain-report.yaml");
  const valueSourceMapPath = join(root, "value-source-map.yaml");
  check(existsSync(installerPath), `${relativeRepo(root)} package installer missing: ${packagePath}/installer.yaml`);
  const installer = readYaml(installerPath);
  const packageBases = (installer.spec?.bases ?? []).map((base) => ({
    name: base.name,
    path: `${packagePath}/${base.path}`,
    default: Boolean(base.default),
    description: base.description ?? "",
  }));
  const packageBaseNames = new Set(packageBases.map((base) => base.name));
  const setupChecks = packageReceipt.spec?.setupChecks ?? [];

  const variants = (recipe.spec?.variants ?? []).map((variantRel) =>
    buildVariantIndex({
      root,
      variantRel,
      packagePath,
      packageBases,
      packageBaseNames,
      setupChecks,
    }),
  );

  const controlPointCategories = [...new Set((controlPoints.spec?.points ?? []).map((point) => point.category))].sort();
  const index = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ChartArtifactIndex",
    metadata: {
      name: `${chartRef.replaceAll("/", "-")}-${version}`,
      chart: chartRef,
      version,
      generatedBy: "scripts/generate-chart-catalogs.mjs",
    },
    spec: {
      doctrine: "1 Helm chart version -> 1 core recipe -> N variants -> M variant revisions -> package bases -> receipts",
      chart: {
        ref: chartRef,
        version,
        appVersion: sourceLock.spec?.appVersion ?? "",
        sourceLock: relativeRepo(join(root, "source-lock.yaml")),
        dependencyLock: relativeRepo(join(root, "dependency-lock.yaml")),
        repository: sourceLock.spec?.repositoryURL ?? "",
        packageSHA256: sourceLock.spec?.packageSHA256 ?? sourceLock.spec?.archiveSHA256 ?? "",
      },
      recipe: {
        path: relativeRepo(join(root, "recipe.yaml")),
        importMode: recipe.spec?.importMode ?? "",
        helmPlan: relativeRepo(join(root, "helm-plan.yaml")),
        chartDossier: relativeRepo(join(root, "chart-dossier.yaml")),
        controlPoints: relativeRepo(join(root, "control-points.yaml")),
        valueModel: relativeRepo(join(root, "value-model.yaml")),
        ...(existsSync(valueSourceMapPath) ? { valueSourceMap: relativeRepo(valueSourceMapPath) } : {}),
        weirdnessAndMitigations: existsSync(weirdnessPath) ? relativeRepo(weirdnessPath) : "",
        ...(existsSync(painReportPath) ? { helmPainReport: relativeRepo(painReportPath) } : {}),
        controlPointCategories,
      },
      catalogStatus: {
        path: relativeRepo(join(root, "catalog-status.yaml")),
        status: catalogStatus.spec?.status ?? "",
        supportLevel: catalogStatus.spec?.supportLevel ?? "",
        supportedScopes: catalogStatus.spec?.supportedScopes ?? [],
        productionReadiness: catalogStatus.spec?.productionReadiness ?? "",
        supportedVariants: catalogStatus.spec?.supportedVariants ?? [],
        candidateVariants: catalogStatus.spec?.candidateVariants ?? [],
        deferredVariants: catalogStatus.spec?.deferredVariants ?? [],
      },
      proofSummary,
      installerPackage: {
        path: packagePath,
        installer: relativeRepo(installerPath),
        receipt: relativeRepo(join(root, "publication", "installer-package-receipt.yaml")),
        deterministicBundleSHA256: packageReceipt.spec?.deterministicBundle?.sha256 ?? "",
        deterministicAcrossTwoLocalBundles: Boolean(
          packageReceipt.spec?.deterministicBundle?.byteIdenticalAcrossTwoLocalBundles,
        ),
        bases: packageBases,
      },
      variants,
    },
  };

  return {
    indexPath: join(root, "artifact-index.yaml"),
    catalogPath: join(root, "CATALOG.md"),
    index,
    indexYaml: `${toComparableYaml(index)}\n`,
    catalogMarkdown: buildCatalogMarkdown({ root, index }),
  };
}

function buildVariantIndex({ root, variantRel, packagePath, packageBases, packageBaseNames, setupChecks }) {
  const variantPath = join(root, variantRel);
  check(existsSync(variantPath), `${relativeRepo(root)} references missing variant ${variantRel}`);
  const variant = readYaml(variantPath);
  const variantName = variant.metadata?.name ?? dirname(variantRel).split("/").at(-1);
  check(packageBaseNames.has(variantName), `${relativeRepo(root)} variant ${variantName} has no matching package base`);
  const base = packageBases.find((item) => item.name === variantName);
  const setupCheck = setupChecks.find((item) => item.variant === variantName || item.base === variantName) ?? {};
  const valueProfilePath = variant.spec?.valuesProfile
    ? resolve(dirname(variantPath), variant.spec.valuesProfile)
    : null;
  if (valueProfilePath) check(existsSync(valueProfilePath), `${relativeRepo(variantPath)} references missing values profile`);

  const revisionRoots = listFiles(join(root, "revisions", variantName))
    .filter((file) => file.endsWith("/variant-revision.yaml"))
    .map((file) => dirname(file))
    .sort();
  check(revisionRoots.length > 0, `${relativeRepo(root)} variant ${variantName} has no revision`);

  return {
    name: variantName,
    variant: relativeRepo(variantPath),
    namespace: variant.spec?.namespace ?? "",
    releaseName: variant.spec?.releaseName ?? "",
    valuesProfile: valueProfilePath ? relativeRepo(valueProfilePath) : "",
    capabilityProfile: variant.spec?.capabilityProfile ?? {},
    hookPolicy: variant.spec?.hookPolicy ?? "",
    targetFacts: variant.spec?.targetFacts ?? {},
    targetFactSummary: targetFactSummary(variant.spec?.targetFacts),
    packageBase: {
      name: variantName,
      path: base?.path ?? `${packagePath}/bases/${variantName}`,
      default: Boolean(base?.default),
      description: base?.description ?? "",
    },
    setupCheck: {
      command: setupCheck.command ?? "",
      helmReleaseObjectCount: setupCheck.helmReleaseObjectCount ?? "",
      cubInstallObjectCountIncludingSupport: setupCheck.cubInstallObjectCountIncludingSupport ?? "",
      semanticObjectMatches: setupCheck.semanticObjectMatches ?? "",
      separatedSecretCount: setupCheck.separatedSecretCount ?? "",
      allowedCubOnlyObjects: setupCheck.allowedCubOnlyObjects ?? [],
    },
    revisions: revisionRoots.map((revisionRoot) => buildRevisionIndex(root, variantName, revisionRoot)),
  };
}

function buildRevisionIndex(root, variantName, revisionRoot) {
  const revisionPath = join(revisionRoot, "variant-revision.yaml");
  const revision = readYaml(revisionPath);
  const releasePath = resolve(revisionRoot, revision.spec?.rendered?.releaseObjects ?? "rendered/release-objects.yaml");
  const inventoryPath = resolve(revisionRoot, revision.spec?.rendered?.objectInventory ?? "rendered/object-inventory.yaml");
  const receiptPaths = {
    render: join(revisionRoot, "receipts", "render-receipt.yaml"),
    helmEquivalence: join(revisionRoot, "receipts", "helm-equivalence-receipt.yaml"),
    scan: join(revisionRoot, "receipts", "scan-receipt.yaml"),
    installGate: join(revisionRoot, "receipts", "install-gate.yaml"),
  };

  check(existsSync(releasePath), `${relativeRepo(revisionRoot)} missing rendered release objects`);
  check(existsSync(inventoryPath), `${relativeRepo(revisionRoot)} missing object inventory`);
  for (const [name, path] of Object.entries(receiptPaths)) {
    check(existsSync(path), `${relativeRepo(revisionRoot)} missing ${name} receipt`);
  }

  const releaseSHA256 = sha256File(releasePath);
  const inventory = readYaml(inventoryPath);
  const render = readYaml(receiptPaths.render);
  const equivalence = readYaml(receiptPaths.helmEquivalence);
  const scan = readYaml(receiptPaths.scan);
  const gate = readYaml(receiptPaths.installGate);
  check(
    revision.spec?.digestInputs?.renderedObjectSetSHA256 === releaseSHA256,
    `${relativeRepo(revisionPath)} rendered object digest is stale`,
  );
  check(inventory.spec?.sourceSHA256 === releaseSHA256, `${relativeRepo(inventoryPath)} source digest is stale`);
  check(
    render.spec?.outputs?.renderedObjectSetSHA256 === releaseSHA256,
    `${relativeRepo(receiptPaths.render)} rendered object digest is stale`,
  );
  check(
    equivalence.spec?.regularHelm?.renderedSHA256 === releaseSHA256,
    `${relativeRepo(receiptPaths.helmEquivalence)} rendered object digest is stale`,
  );
  check(
    scan.spec?.renderedObjectSetSHA256 === releaseSHA256,
    `${relativeRepo(receiptPaths.scan)} rendered object digest is stale`,
  );
  check(
    gate.spec?.renderedObjectSetSHA256 === releaseSHA256,
    `${relativeRepo(receiptPaths.installGate)} rendered object digest is stale`,
  );

  return {
    name: `${variantName}-${revision.spec?.revision ?? dirname(revisionRoot).split("/").at(-1)}`,
    revision: revision.spec?.revision ?? "",
    variantRevision: relativeRepo(revisionPath),
    digest: revision.spec?.digest ?? "",
    renderedObjectSetSHA256: releaseSHA256,
    renderedObjects: relativeRepo(releasePath),
    objectInventory: relativeRepo(inventoryPath),
    objectCount: inventory.spec?.objectCount ?? revision.spec?.rendered?.objectCount ?? "",
    helmObjectCount: equivalence.spec?.regularHelm?.objectCount ?? "",
    cubInstallObjectCountIncludingSupport: equivalence.spec?.cubInstall?.objectCountIncludingSecretsAndSupportObjects ?? "",
    semanticObjectMatches: equivalence.spec?.cubInstall?.semanticObjectMatches ?? "",
    separatedSecretFiles: equivalence.spec?.cubInstall?.separatedSecretFiles ?? "",
    receipts: {
      render: receiptIndex(receiptPaths.render, render, {
        result: render.spec?.outputs?.deterministicAcrossTwoLocalRenders === false ? "not-deterministic" : "recorded",
        digest: releaseSHA256,
      }),
      helmEquivalence: receiptIndex(receiptPaths.helmEquivalence, equivalence, {
        result: equivalence.spec?.result ?? "",
        digest: equivalence.spec?.regularHelm?.renderedSHA256 ?? "",
      }),
      scan: receiptIndex(receiptPaths.scan, scan, {
        result: scan.spec?.result ?? "",
        digest: scan.spec?.renderedObjectSetSHA256 ?? "",
      }),
      installGate: receiptIndex(receiptPaths.installGate, gate, {
        result: gate.spec?.decision ?? "",
        digest: gate.spec?.renderedObjectSetSHA256 ?? "",
      }),
    },
  };
}

function receiptIndex(path, receipt, extra) {
  return {
    kind: receipt.kind ?? "",
    path: relativeRepo(path),
    result: extra.result,
    renderedObjectSetSHA256: extra.digest,
  };
}

function optionalArtifactRows(root) {
  const artifacts = [
    { label: "Operating policy", path: "operating-policy.yaml" },
    { label: "Target topology", path: "target-topology.yaml" },
    { label: "Lifecycle policy", path: "lifecycle-policy.yaml" },
    { label: "Render blocker", path: "default-render-blocker.yaml" },
  ];
  const rows = artifacts
    .filter((artifact) => existsSync(join(root, artifact.path)))
    .map((artifact) => `| ${artifact.label} | ${linkFrom(root, relativeRepo(join(root, artifact.path)))} |`);
  return rows.length ? `${rows.join("\n")}\n` : "";
}

function targetFactSummary(targetFacts) {
  if (!targetFacts || Object.keys(targetFacts).length === 0) return "none";
  const bits = [];
  for (const secret of targetFacts.requiredSecrets ?? []) {
    const namespace = secret.namespace ? `${secret.namespace}/` : "";
    const keys = (secret.keys ?? []).join(",");
    bits.push(`required Secret ${namespace}${secret.name}${keys ? ` keys ${keys}` : ""}`);
  }
  for (const configMap of targetFacts.requiredConfigMaps ?? []) {
    const namespace = configMap.namespace ? `${configMap.namespace}/` : "";
    const keys = (configMap.keys ?? []).join(",");
    bits.push(`required ConfigMap ${namespace}${configMap.name}${keys ? ` keys ${keys}` : ""}`);
  }
  for (const crd of targetFacts.requiredCRDs ?? []) {
    bits.push(`required CRD ${crd.name}`);
  }
  for (const value of targetFacts.requiredValues ?? []) {
    bits.push(`required Value ${value.path}${value.stage ? ` (${value.stage})` : ""}`);
  }
  return bits.length ? bits.join("; ") : "see variant targetFacts";
}

function buildCatalogMarkdown({ root, index }) {
  const chart = index.spec.chart;
  const recipe = index.spec.recipe;
  const status = index.spec.catalogStatus;
  const proofSummary = index.spec.proofSummary;
  const packageInfo = index.spec.installerPackage;
  const variants = index.spec.variants;
  const supported = status.supportedVariants.length ? status.supportedVariants.join(", ") : "none";
  const candidates = status.candidateVariants.length ? status.candidateVariants.join(", ") : "none";
  const controlPoints = recipe.controlPointCategories.length ? recipe.controlPointCategories.join(", ") : "none recorded";

  return `${generatedNotice()}

# ${chart.ref} ${chart.version} Catalog Map

This page makes the artifact chain explicit:

\`\`\`text
chart -> recipe -> variants -> variant revisions -> package bases -> receipts
\`\`\`

## Status

| Field | Value |
| --- | --- |
| Chart | ${chart.ref}@${chart.version} |
| Catalog status | ${status.status} |
| Support level | ${status.supportLevel} |
| Supported scopes | ${status.supportedScopes.length ? status.supportedScopes.join(", ") : "none"} |
| Production readiness | ${status.productionReadiness} |
| Supported variants | ${supported} |
| Candidate variants | ${candidates} |
| Control points | ${controlPoints} |

## Feature And Proof Summary

This is the chart-level summary. Use the variant table and receipt links below
for exact base-variant evidence.

| Field | Value |
| --- | --- |
| Adoption bucket | ${proofSummary.adoptionBucket || "-"} |
| User status | ${proofSummary.userStatus || "-"} |
| Strongest evidence | ${proofSummary.strongestEvidence || "-"} |
| Proof lanes | ${proofLaneText(proofSummary.proofLanes)} |
| Feature summary | ${proofSummary.featureSummary || "-"} |
| Hard gap | ${proofSummary.hardGap || "-"} |
| Next action | ${proofSummary.nextAction || "-"} |

## Artifact Chain

| Stage | Artifact |
| --- | --- |
| Source chart lock | ${linkFrom(root, chart.sourceLock)} |
| Dependency lock | ${linkFrom(root, chart.dependencyLock)} |
| Recipe | ${linkFrom(root, recipe.path)} |
| Helm plan | ${linkFrom(root, recipe.helmPlan)} |
| Chart dossier | ${linkFrom(root, recipe.chartDossier)} |
| Control points | ${linkFrom(root, recipe.controlPoints)} |
| Value model | ${linkFrom(root, recipe.valueModel)} |
${recipe.valueSourceMap ? `| Value source map | ${linkFrom(root, recipe.valueSourceMap)} |\n` : ""}${optionalArtifactRows(root)}${recipe.weirdnessAndMitigations ? `| Weirdness and mitigations | ${linkFrom(root, recipe.weirdnessAndMitigations)} |\n` : ""}| Catalog status | ${linkFrom(root, status.path)} |
${recipe.helmPainReport ? `| Helm pain report | ${linkFrom(root, recipe.helmPainReport)} |\n` : ""}| Installer package | ${linkFrom(root, packageInfo.path)} |
| Installer package receipt | ${linkFrom(root, packageInfo.receipt)} |
| Machine index | ${linkFrom(root, relativeRepo(join(root, "artifact-index.yaml")))} |

## Variants

${variantTable(root, variants)}

## Package Bases

${baseTable(root, packageInfo.bases)}

## Receipts

${receiptTable(root, variants)}

## Current Install Shape

\`\`\`sh
cub installer setup --pull ${packageInfo.path} --base <variant> --work-dir <tmp> --non-interactive --namespace <namespace>
\`\`\`

Use the variant table above to choose the package base. The proof path compares
regular Helm output with real \`cub installer setup\` output and explains every
intentional difference, such as the Namespace support object or separated
Secrets.
`;
}

function generatedNotice() {
  return "<!-- Generated by npm run catalog:maps. Do not edit by hand. -->";
}

function proofLaneText(lanes) {
  if (!lanes) return "-";
  return [
    `render parity ${lanes.renderParity || "-"}`,
    `ConfigHub ${lanes.inConfigHub || "-"}`,
    `local live ${lanes.localLive || "-"}`,
    `GitOps live ${lanes.gitopsLive || "-"}`,
    `live parity ${lanes.liveParity || "-"}`,
  ].join("; ");
}

function variantTable(root, variants) {
  const rows = variants.flatMap((variant) =>
    variant.revisions.map((revision) => [
      variant.name,
      linkFrom(root, variant.variant),
      linkFrom(root, variant.packageBase.path),
      linkFrom(root, revision.variantRevision),
      String(revision.helmObjectCount),
      String(revision.cubInstallObjectCountIncludingSupport),
      revision.semanticObjectMatches,
      revision.receipts.helmEquivalence.result,
      revision.receipts.scan.result,
      revision.receipts.installGate.result,
      variant.targetFactSummary,
    ]),
  );
  return markdownTable(
    [
      "Variant",
      "Variant file",
      "Package base",
      "Revision",
      "Helm objects",
      "cub installer objects",
      "Match",
      "Helm equivalence",
      "Scan",
      "Gate",
      "Target facts",
    ],
    rows,
  );
}

function baseTable(root, bases) {
  return markdownTable(
    ["Base", "Path", "Default", "Description"],
    bases.map((base) => [base.name, linkFrom(root, base.path), base.default ? "yes" : "no", base.description]),
  );
}

function receiptTable(root, variants) {
  const rows = variants.flatMap((variant) =>
    variant.revisions.flatMap((revision) =>
      Object.entries(revision.receipts).map(([name, receipt]) => [
        variant.name,
        revision.revision,
        name,
        receipt.kind,
        receipt.result,
        linkFrom(root, receipt.path),
      ]),
    ),
  );
  return markdownTable(["Variant", "Revision", "Receipt", "Kind", "Result", "Path"], rows);
}

function markdownTable(headers, rows) {
  const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replace(/\s+/g, " ").trim();
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

function linkFrom(root, repoRelativePath) {
  const target = join(repoRoot, repoRelativePath);
  const label = repoRelativePath;
  const href = relative(root, target).replaceAll("\\", "/") || ".";
  return `[${label}](${href})`;
}

function assertFresh(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run catalog:maps`);
  const actual = readFileSync(path, "utf8");
  check(actual === expected, `${relativeRepo(path)} is stale; run npm run catalog:maps`);
}

function toComparableYaml(value) {
  // Match writeYaml output without writing during verification.
  return toYaml(value).replace(/\n*$/, "");
}

function loadStatusContext() {
  return {
    outcomesByChart: readCsvMap("data/outcome-coverage/chart-outcomes.csv", "chart"),
    readinessByChart: readCsvMap("data/top100-readiness/readiness.csv", "chart"),
  };
}

function proofSummaryFor(chartKey, context) {
  const outcome = context.outcomesByChart.get(chartKey) ?? {};
  const readiness = context.readinessByChart.get(chartKey) ?? {};
  return {
    adoptionBucket: readiness.adoption_bucket ?? "",
    userStatus: readiness.user_status ?? "",
    strongestEvidence: readiness.strongest_evidence ?? "",
    proofLanes: {
      renderParity: readiness.render_parity || countText(outcome.render_parity_pass, outcome.base_rows),
      inConfigHub: readiness.in_confighub || countText(outcome.in_confighub_pass, outcome.base_rows),
      localLive: readiness.local_live || countText(outcome.local_live_pass, outcome.base_rows),
      gitopsLive: readiness.gitops_live || countText(outcome.gitops_live_pass, outcome.base_rows),
      liveParity: readiness.live_parity || countText(outcome.live_parity_pass, outcome.base_rows),
    },
    featureSummary: outcome.feature_summary ?? "",
    hardGap: readiness.hard_gap || outcome.hard_gap || "",
    nextAction: readiness.next_action ?? "",
  };
}

function countText(value, total) {
  if (value === undefined || value === "" || total === undefined || total === "") return "";
  return `${value}/${total}`;
}

function readCsvMap(path, key) {
  const rows = parseCsvFile(path);
  return new Map(rows.map((row) => [row[key], row]));
}

function parseCsvFile(path) {
  const fullPath = join(repoRoot, path);
  check(existsSync(fullPath), `${path} is missing`);
  return parseCsv(readFileSync(fullPath, "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.some((fieldValue) => fieldValue !== ""));
  return body.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}
