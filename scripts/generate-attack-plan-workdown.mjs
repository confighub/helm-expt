// Generated workdown for the current helm-expt execution queue.
//
// This is a reviewer-facing index over existing proof surfaces. It does not
// create product claims. It explains the next action for the remaining import,
// variant, production, runtime/GitOps, latest-version, and image-pinning work.
//
//   node scripts/generate-attack-plan-workdown.mjs --generate
//   node scripts/generate-attack-plan-workdown.mjs --verify
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  imageTag,
  listFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "attack-plan-workdown");

const outputPaths = {
  summary: join(outputRoot, "summary.md"),
  importContract: join(outputRoot, "helm-import-contract.csv"),
  secretGaps: join(outputRoot, "secret-gap-workdown.csv"),
  crdGaps: join(outputRoot, "crd-gap-workdown.csv"),
  variants: join(outputRoot, "variant-workdown.csv"),
  production: join(outputRoot, "production-workdown.csv"),
  runtime: join(outputRoot, "runtime-gitops-sweep.csv"),
  latest: join(outputRoot, "latest-candidate-workdown.csv"),
  images: join(outputRoot, "image-digest-review.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  mkdirSync(outputRoot, { recursive: true });
  for (const [key, path] of Object.entries(outputPaths)) write(path, report.outputs[key]);
  console.log(`wrote attack-plan workdown -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [key, path] of Object.entries(outputPaths)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run attack-plan:generate`);
    check(readFileSync(path, "utf8") === report.outputs[key], `${relativeRepo(path)} is stale; run npm run attack-plan:generate`);
  }
  console.log(
    `verified attack-plan workdown: ${report.secretRows.length} secret gaps, ${report.crdRows.length} CRD gaps, ${report.imageSummary.floatingOrLatestSubjects} rendered subject(s) with floating/latest or untagged images`,
  );
} else {
  console.log(`Usage:
  node scripts/generate-attack-plan-workdown.mjs --generate
  node scripts/generate-attack-plan-workdown.mjs --verify`);
}

function buildReport() {
  const chartFacts = parseCsvFile(join(repoRoot, "data", "chart-facts", "chart-facts.csv"));
  const top100 = parseCsvFile(join(repoRoot, "data", "top100-catalog-analysis", "review.csv"));
  const production = parseCsvFile(join(repoRoot, "data", "production-disposition", "top20.csv"));
  const latest = parseCsvFile(join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv"));
  const wave2 = readYaml(join(repoRoot, "data", "catalog-promotion-wave2", "variant-work-orders.yaml"));

  const top100ByChart = new Map(top100.map((row) => [row.chart, row]));
  const productionByChart = new Map(production.map((row) => [row.chart, row]));

  const importRows = buildImportRows();
  const secretRows = buildSecretRows(chartFacts, top100ByChart, productionByChart);
  const crdRows = buildCrdRows(chartFacts, top100ByChart, productionByChart);
  const variantRows = buildVariantRows(wave2);
  const productionRows = buildProductionRows(production);
  const runtimeRows = buildRuntimeRows(top100, productionByChart);
  const latestRows = latest.map((row) => ({
    chart: row.chart,
    current_version: row.current_version,
    candidate_version: row.candidate_version,
    readiness: row.promotion_readiness,
    next_action: "run ConfigHub proof, local/e2e, production disposition, catalog status, and top100/top500 regeneration before support",
  }));
  const { imageRows, imageSummary } = buildImageRows();

  check(importRows.every((row) => row.status === "complete"), "all import-contract examples must be complete");
  check(secretRows.length === 15, `expected 15 existing-secret hard-gap rows; found ${secretRows.length}`);
  check(crdRows.length === 3, `expected 3 no-crds hard-gap rows after CRD-publication reclassification; found ${crdRows.length}`);
  check(variantRows.length === 5, `expected 5 wave-2 variant work orders; found ${variantRows.length}`);
  check(productionRows.length === 20, `expected 20 production disposition rows; found ${productionRows.length}`);
  check(runtimeRows.length === 100, `expected 100 runtime/GitOps sweep rows; found ${runtimeRows.length}`);
  check(latestRows.length === 6, `expected 6 latest candidate rows; found ${latestRows.length}`);
  check(imageRows.length > 0, "expected rendered image review rows");

  const outputs = {
    summary: summary({
      importRows,
      secretRows,
      crdRows,
      variantRows,
      productionRows,
      runtimeRows,
      latestRows,
      imageSummary,
    }),
    importContract: csv(importRows),
    secretGaps: csv(secretRows),
    crdGaps: csv(crdRows),
    variants: csv(variantRows),
    production: csv(productionRows),
    runtime: csv(runtimeRows),
    latest: csv(latestRows),
    images: csv(imageRows),
  };

  return {
    outputs,
    secretRows,
    crdRows,
    imageSummary,
  };
}

function buildImportRows() {
  const rows = [
    {
      case: "public-chart-redis",
      import_unit: "bitnami/redis@25.5.3 public chart plus supported bases",
      route: "cub helm install can inspect quickly; recipe import creates maintained cub installer package",
      required_artifacts: [
        "recipes/bitnami/redis/25.5.3/source-lock.yaml",
        "recipes/bitnami/redis/25.5.3/dependency-lock.yaml",
        "recipes/bitnami/redis/25.5.3/helm-pain-report.yaml",
        "recipes/bitnami/redis/25.5.3/install-checks.yaml",
        "packages/bitnami/redis/25.5.3/installer.yaml",
        "recipes/bitnami/redis/25.5.3/publication/installer-package-receipt.yaml",
      ],
      decision_rule: "values or facts changing rendered objects become base variants; ConfigHub-only target/label/gate changes become derived variants",
    },
    {
      case: "managed-overlay-external-dns",
      import_unit: "wrapper chart plus platform values plus customer overlay values plus dependency closure",
      route: "managed overlay import; user choices are classified before render",
      required_artifacts: [
        "data/managed-overlay-goldens/external-dns-customer-acme-prod/overlay-classification.yaml",
        "data/managed-overlay-goldens/external-dns-customer-acme-prod/creator-contract.yaml",
        "data/managed-overlay-goldens/external-dns-customer-acme-prod/preview.yaml",
        "docs/user/custom-overlays.md",
      ],
      decision_rule: "platform/customer overlay values that change objects become a reviewed base; target/region/customer operation choices become derived ConfigHub variants",
    },
    {
      case: "post-render-promotion",
      import_unit: "reviewed base uploaded to ConfigHub, then cloned/refined",
      route: "cub variant create over cloned Spaces and Units",
      required_artifacts: [
        "data/variant-goldens/redis-prod-us-east/creator-contract.yaml",
        "data/variant-goldens/redis-prod-us-east/ux-preview.md",
        "docs/user/creating-variants.md",
        "docs/user/change-routing-before-oci.md",
      ],
      decision_rule: "no Helm rerender; preserve rendered digest and make target/gate/link changes explicit",
    },
  ];

  return rows.map((row) => {
    const missing = row.required_artifacts.filter((path) => !existsSync(join(repoRoot, path)));
    return {
      ...row,
      status: missing.length ? "missing-artifacts" : "complete",
      missing_artifacts: missing.join(";"),
      required_artifacts: row.required_artifacts.join(";"),
    };
  });
}

function buildSecretRows(chartFacts, top100ByChart, productionByChart) {
  return chartFacts
    .filter((row) => /chart ships no Secret toggle/.test(row.not_yet_enabled))
    .map((row) => {
      const top = top100ByChart.get(row.chart);
      const production = productionByChart.get(row.chart);
      return {
        chart: row.chart,
        version: row.version,
        proof_tier: top?.catalog_status ?? "proof-grade",
        production_scope: production ? "top20-local-test-supported" : "top100-proof-scope",
        current_variants: row.variants_built,
        gap: "no chart-native existing-secret toggle found",
        route: "do not invent a hidden Secret rewrite; either use generated-secret local-test scope, require external secret delivery before production, or update/upstream the chart values path",
        next_action: production
          ? "write production disposition for generated secret ownership and target-fact preflight"
          : "source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path",
      };
    })
    .sort((left, right) => left.chart.localeCompare(right.chart));
}

function buildCrdRows(chartFacts, top100ByChart, productionByChart) {
  return chartFacts
    .filter((row) => /template-baked CRDs/.test(row.not_yet_enabled))
    .map((row) => {
      const top = top100ByChart.get(row.chart);
      const production = productionByChart.get(row.chart);
      return {
        chart: row.chart,
        version: row.version,
        proof_tier: top?.catalog_status ?? "proof-grade",
        production_scope: production ? "top20-local-test-supported" : "top100-proof-scope",
        current_variants: row.variants_built,
        gap: "CRDs are rendered from templates and no clean no-crds value toggle is known",
        route: "confirm source value toggle; if absent, do not offer no-crds variant and require explicit CRD lifecycle disposition",
        next_action: "source-review CRD values, then classify as chart-toggle-found or no-crds-not-offered",
      };
    })
    .sort((left, right) => left.chart.localeCompare(right.chart));
}

function buildVariantRows(wave2) {
  return (wave2.spec?.workOrders ?? []).map((order) => ({
    chart: order.chart,
    version: order.version,
    state: order.state,
    proposed_variants: (order.variants ?? []).map((variant) => variant.name).join(";"),
    blockers: (order.variants ?? []).flatMap((variant) => variant.blockers ?? []).filter(Boolean).join(";"),
    next_action: "render variants into recipe/package bases, prove Helm equivalence, scan/gate, then decide catalog promotion",
  }));
}

function buildProductionRows(productionRows) {
  return productionRows.map((row) => ({
    chart: row.chart,
    version: row.version,
    supported_variants: row.supported_variants,
    live_e2e: row.live_e2e,
    production_support: row.production_support,
    required_dispositions: row.required_dispositions,
    next_action: "write disposition receipts for each blocker, then rerun production and runtime/GitOps lanes",
  }));
}

function buildRuntimeRows(top100, productionByChart) {
  return top100.map((row) => {
    const production = productionByChart.get(row.chart);
    const selectedBases = splitList(row.supported_variants || row.variants || row.current_variants || "default");
    return {
      chart: row.chart,
      version: row.version,
      catalog_status: row.catalog_status,
      selected_bases: selectedBases.join(";"),
      current_runtime_evidence: production?.live_e2e ?? "not-started",
      gitops_oci_status: "planned",
      controllers: "Argo CD OCI;Flux OCI",
      next_action: production
        ? "extend top20 local-kind evidence to declared GitOps/OCI controller receipt"
        : "run package setup/upload/publish, GitOps sync, and runtime observation for selected bases",
    };
  });
}

function buildImageRows() {
  const rows = [];
  const renderedPaths = listFiles(join(repoRoot, "recipes"))
    .filter((path) => /\/revisions\/[^/]+\/r001\/rendered\/release-objects\.yaml$/.test(path))
    .sort();

  for (const renderedPath of renderedPaths) {
    const rel = relativeRepo(renderedPath);
    const match = rel.match(/^recipes\/([^/]+)\/([^/]+)\/([^/]+)\/revisions\/([^/]+)\//);
    if (!match) continue;
    const [, repo, chartName, version, variant] = match;
    const chart = `${repo}/${chartName}`;
    const docs = parseDocs(readFileSync(renderedPath, "utf8"));
    const images = collectImages(docs);
    const unique = [...new Map(images.map((item) => [`${item.image}|${item.object}|${item.path}`, item])).values()].sort((a, b) =>
      `${a.image}|${a.object}|${a.path}`.localeCompare(`${b.image}|${b.object}|${b.path}`),
    );
    for (const item of unique) {
      rows.push({
        chart,
        version,
        variant,
        image: item.image,
        image_status: imageStatus(item.image),
        object: item.object,
        field_path: item.path,
        rendered_sha256: sha256File(renderedPath),
        rendered_path: rel,
        next_action: imageStatus(item.image) === "digest-pinned" ? "none" : "resolve digest and record image override/proof receipt before reproducible production OCI delivery",
      });
    }
  }

  const subjects = new Set(rows.map((row) => `${row.chart}@${row.version}/${row.variant}`));
  const floatingSubjects = new Set(rows.filter((row) => row.image_status !== "digest-pinned").map((row) => `${row.chart}@${row.version}/${row.variant}`));
  return {
    imageRows: rows,
    imageSummary: {
      rows: rows.length,
      renderedSubjects: subjects.size,
      floatingOrLatestSubjects: floatingSubjects.size,
      digestPinned: rows.filter((row) => row.image_status === "digest-pinned").length,
      mutableTag: rows.filter((row) => row.image_status === "mutable-tag").length,
      floatingLatestOrUntagged: rows.filter((row) => row.image_status === "floating-latest-or-untagged").length,
    },
  };
}

function collectImages(docs) {
  const result = [];
  for (const doc of docs) walk(doc, [], objectId(doc), result);
  return result;
}

function walk(value, path, object, result) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, String(index)], object, result));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (key === "image" && typeof child === "string") {
      result.push({ image: child, path: nextPath.join("."), object });
    }
    walk(child, nextPath, object, result);
  }
}

function objectId(doc) {
  const metadata = doc.metadata ?? {};
  return [doc.apiVersion ?? "", doc.kind ?? "", metadata.namespace ?? "", metadata.name ?? ""].join("/");
}

function imageStatus(image) {
  if (image.includes("@sha256:")) return "digest-pinned";
  const tag = imageTag(image);
  if (!tag || tag === "latest") return "floating-latest-or-untagged";
  return "mutable-tag";
}

function summary({ importRows, secretRows, crdRows, variantRows, productionRows, runtimeRows, latestRows, imageSummary }) {
  const localRuntime = runtimeRows.filter((row) => row.current_runtime_evidence === "local-kind-observed").length;
  return `# Attack Plan Workdown

This generated index tracks the current 1-10 execution queue. It points at the
dedicated proof artifacts rather than replacing them.

## Headline

\`\`\`text
import-contract examples complete: ${importRows.filter((row) => row.status === "complete").length} / ${importRows.length}
existing-secret hard gaps:         ${secretRows.length}
template-CRD/no-crds hard gaps:    ${crdRows.length}
wave-2 variant work orders:        ${variantRows.length}
top-20 production rows:            ${productionRows.length}
top-100 runtime/GitOps rows:       ${runtimeRows.length}
top-100 rows with local runtime:   ${localRuntime}
latest top-20 candidates:          ${latestRows.length}
rendered image rows reviewed:      ${imageSummary.rows}
rendered subjects with mutable/floating images: ${imageSummary.floatingOrLatestSubjects}
\`\`\`

## Files

| File | Purpose |
| --- | --- |
| \`helm-import-contract.csv\` | #76 import examples and required artifact chain. |
| \`secret-gap-workdown.csv\` | Charts where no chart-native existing-Secret toggle is known. |
| \`crd-gap-workdown.csv\` | Charts where no clean no-CRDs variant is currently available. |
| \`variant-workdown.csv\` | Wave-2 user-shaped variant jobs. |
| \`production-workdown.csv\` | Top-20 production-disposition blockers and next action. |
| \`runtime-gitops-sweep.csv\` | Top-100 runtime/GitOps sweep plan by chart. |
| \`latest-candidate-workdown.csv\` | Six latest-version candidate promotion lanes. |
| \`image-digest-review.csv\` | #99 rendered image tags/digests by chart and variant. |

## Read This With

\`\`\`text
data/chart-facts/summary.md
data/top100-catalog-analysis/summary.md
data/production-disposition/summary.md
data/latest-top20-refresh/promotion-readiness.md
tests/top100-runtime-gitops.md
docs/reference/helm-import-contract.md
\`\`\`
`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function splitList(value) {
  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function csv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
