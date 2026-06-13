import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  runCub,
  sha256,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const args = process.argv.slice(2);
const generate = args.includes("--generate");
const verify = args.includes("--verify");

if (!generate && !verify) usage();

const outputPaths = {
  wave: "data/useful-base-realization-wave/wave.csv",
  summary: "data/useful-base-realization-wave/summary.md",
};

const wave = [
  usefulBase("prometheus-community/kube-state-metrics", "7.4.0", "cluster-metrics-readonly"),
  usefulBase("prometheus-community/prometheus-blackbox-exporter", "11.10.0", "cluster-metrics-readonly"),
  usefulBase("prometheus-community/prometheus-adapter", "5.3.0", "cluster-metrics-readonly"),
  usefulBase("stakater/reloader", "2.2.12", "controller-default-reviewed"),
  usefulBase("autoscaler/cluster-autoscaler", "9.57.0", "controller-default-reviewed"),
  usefulBase("argo-cd/argo-workflows", "1.0.14", "controller-default-reviewed"),
  usefulBase("elastic/filebeat", "8.5.1", "node-or-cluster-collector"),
  usefulBase("istio/gateway", "1.30.0", "controller-default-reviewed"),
  usefulBase("nats/surveyor", "0.20.9", "default-reviewed"),
  usefulBase("vm/victoria-metrics-single", "0.39.0", "default-reviewed"),
];

const liveFindings = new Map([
  [keyFor("autoscaler/cluster-autoscaler", "9.57.0", "controller-default-reviewed"), {
    status: "realized-alias-base-watch-required-values",
    remainingBeforeCatalog:
      "required render-time values: autoDiscovery.clusterName or autoscalingGroups[]; re-render as a non-alias base; ConfigHub proof lane; selected live lane; production disposition",
    proofNote:
      "Strict live parity reached semantic object parity, but Helm rendered no controller workload and printed that autoDiscovery or autoscalingGroups[] must be set. This alias base is not a functional controller install until those values are modeled and re-rendered.",
    note:
      "Strict live parity shows this alias base has object parity but no controller workload. The chart requires autoDiscovery.clusterName or autoscalingGroups[] before it becomes a functional install.",
  }],
]);

const queueRows = readCsv(join(repoRoot, "data", "useful-base-design-queue", "queue.csv"));
const queueByKey = new Map(queueRows.map((row) => [keyFor(row.chart, row.version, row.proposed_base), row]));
const rows = wave.map((item) => buildRow(item));
const report = {
  wave: csv(rows, [
    "chart",
    "version",
    "base",
    "status",
    "realization_strategy",
    "source_base",
    "rendered_object_set",
    "user_job",
    "remaining_before_catalog",
    "recipe_variant",
    "package_base",
    "revision",
    "proof_note",
  ]),
  summary: summary(rows),
};

if (generate) {
  for (const item of wave) realizeUsefulBase(item);
  write(join(repoRoot, outputPaths.wave), report.wave);
  write(join(repoRoot, outputPaths.summary), report.summary);
  console.log(`wrote useful base realization wave for ${wave.length} chart(s)`);
} else {
  for (const item of wave) verifyUsefulBase(item);
  assertFresh(outputPaths.wave, report.wave);
  assertFresh(outputPaths.summary, report.summary);
  console.log(`verified useful base realization wave for ${wave.length} chart(s)`);
}

function usefulBase(chart, version, base) {
  return { chart, version, base };
}

function buildRow(item) {
  const queueRow = queueByKey.get(keyFor(item.chart, item.version, item.base));
  const liveFinding = liveFindings.get(keyFor(item.chart, item.version, item.base));
  check(Boolean(queueRow), `useful base queue missing ${item.chart}@${item.version} ${item.base}`);
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  return {
    chart: item.chart,
    version: item.version,
    base: item.base,
    status: liveFinding?.status ?? "realized-alias-base",
    realization_strategy: "alias-of-default-render",
    source_base: "default",
    rendered_object_set: existsSync(join(recipeRoot, "revisions", item.base, "r001", "rendered", "release-objects.yaml"))
      ? sha256File(join(recipeRoot, "revisions", item.base, "r001", "rendered", "release-objects.yaml"))
      : "",
    user_job: queueRow.user_job,
    remaining_before_catalog: liveFinding?.remainingBeforeCatalog ?? "ConfigHub proof lane; selected live lane; production disposition",
    recipe_variant: relativeRepo(join(recipeRoot, "variants", item.base, "variant.yaml")),
    package_base: relativeRepo(join(packageRoot, "bases", item.base)),
    revision: relativeRepo(join(recipeRoot, "revisions", item.base, "r001", "variant-revision.yaml")),
    proof_note: liveFinding?.proofNote ?? "Kubernetes object set is intentionally identical to default; the base gives users a named start path before live and production review.",
  };
}

function realizeUsefulBase(item) {
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  const defaultBaseRoot = join(packageRoot, "bases", "default");
  const baseRoot = join(packageRoot, "bases", item.base);
  const defaultRevisionRoot = join(recipeRoot, "revisions", "default", "r001");
  const revisionRoot = join(recipeRoot, "revisions", item.base, "r001");

  check(existsSync(recipeRoot), `missing recipe root ${relativeRepo(recipeRoot)}`);
  check(existsSync(packageRoot), `missing package root ${relativeRepo(packageRoot)}`);
  check(existsSync(defaultBaseRoot), `${relativeRepo(packageRoot)} missing default base`);
  check(existsSync(defaultRevisionRoot), `${relativeRepo(recipeRoot)} missing default revision`);

  rmSync(baseRoot, { recursive: true, force: true });
  cpSync(defaultBaseRoot, baseRoot, { recursive: true });
  rmSync(revisionRoot, { recursive: true, force: true });
  cpSync(defaultRevisionRoot, revisionRoot, { recursive: true });

  writeVariant(item);
  updateRecipe(item);
  updateInstaller(item);
  updateCatalogStatus(item);
  updateRevisionTree(item);
  updatePackageReceipt(item);
}

function writeVariant(item) {
  const recipeRoot = recipeRootFor(item);
  const defaultVariant = readYaml(join(recipeRoot, "variants", "default", "variant.yaml"));
  const queueRow = queueByKey.get(keyFor(item.chart, item.version, item.base));
  const liveFinding = liveFindings.get(keyFor(item.chart, item.version, item.base));
  const variant = {
    ...defaultVariant,
    metadata: {
      ...(defaultVariant.metadata ?? {}),
      name: item.base,
      labels: {
        ...(defaultVariant.metadata?.labels ?? {}),
        "confighub.io/variant": item.base,
        "helm-expt.confighub.com/useful-base-status": "realized-alias-base",
      },
    },
    spec: {
      ...(defaultVariant.spec ?? {}),
      usefulBase:
        {
          realizationStrategy: "alias-of-default-render",
          sourceBase: "default",
          userJob: queueRow.user_job,
          renderTimeChoices: splitList(queueRow.render_time_choices),
          remainingBeforeCatalog: [
            ...(liveFinding
              ? [
                  "required render-time values: autoDiscovery.clusterName or autoscalingGroups[]",
                  "re-render as a non-alias base",
                ]
              : []),
            "ConfigHub proof lane",
            "selected live lane",
            "production disposition",
          ],
          note: liveFinding?.note ?? "This base intentionally reuses the default rendered object set and makes the user-facing install shape explicit.",
        },
    },
  };
  writeYaml(join(recipeRoot, "variants", item.base, "variant.yaml"), variant);
}

function updateRecipe(item) {
  const path = join(recipeRootFor(item), "recipe.yaml");
  const recipe = readYaml(path);
  const variantRef = `variants/${item.base}/variant.yaml`;
  const variants = recipe.spec?.variants ?? [];
  if (!variants.includes(variantRef)) variants.push(variantRef);
  recipe.spec.variants = variants;
  writeYaml(path, recipe);
}

function updateInstaller(item) {
  const path = join(packageRootFor(item), "installer.yaml");
  const installer = readYaml(path);
  const existingBase = (installer.spec?.bases ?? []).find((base) => base.name === item.base);
  const bases = (installer.spec?.bases ?? []).filter((base) => base.name !== item.base);
  bases.push({
    ...(existingBase ?? {}),
    name: item.base,
    path: `bases/${item.base}`,
    default: false,
    description: `${item.chart} ${item.base} useful base; aliases the default render with a named user start path`,
  });
  installer.spec.bases = sortBases(bases);
  writeYaml(path, installer);
}

function updateCatalogStatus(item) {
  const path = join(recipeRootFor(item), "catalog-status.yaml");
  const status = readYaml(path);
  const liveFinding = liveFindings.get(keyFor(item.chart, item.version, item.base));
  const candidates = new Set(status.spec?.candidateVariants ?? []);
  candidates.add(item.base);
  status.spec.candidateVariants = [...candidates].sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : a.localeCompare(b)));
  status.spec.supportedVariants = status.spec.supportedVariants ?? [];
  status.spec.productionReadiness = status.spec.productionReadiness || "not-reviewed-for-production";
  status.spec.notes = [
    ...(status.spec.notes ?? []).filter((note) => !String(note).includes(`${item.base} is a realized useful-base alias`)),
    liveFinding?.note
      ? `${item.base} is a realized useful-base alias of the default render, but ${liveFinding.note.charAt(0).toLowerCase()}${liveFinding.note.slice(1)}`
      : `${item.base} is a realized useful-base alias of the default render; catalog support still requires ConfigHub proof, selected live evidence, and production disposition.`,
  ];
  writeYaml(path, status);
}


function updateRevisionTree(item) {
  const recipeRoot = recipeRootFor(item);
  const aliasRevisionRoot = join(recipeRoot, "revisions", item.base, "r001");
  const defaultRevisionRoot = join(recipeRoot, "revisions", "default", "r001");
  const recipeDigest = sha256File(join(recipeRoot, "recipe.yaml"));
  for (const variantName of ["default", item.base]) {
    const revisionRoot = variantName === "default" ? defaultRevisionRoot : aliasRevisionRoot;
    updateRevisionYaml(recipeRoot, revisionRoot, variantName, recipeDigest);
    updateInventory(revisionRoot, item, variantName);
    updateReceipts(revisionRoot, item, variantName);
  }
}

function updateRevisionYaml(recipeRoot, revisionRoot, variantName, recipeDigest) {
  const path = join(revisionRoot, "variant-revision.yaml");
  const revision = readYaml(path);
  const variantPath = join(recipeRoot, "variants", variantName, "variant.yaml");
  const variantDigest = sha256File(variantPath);
  const effectiveValuesDigest = sha256File(join(recipeRoot, "effective-values.yaml"));
  const rendererFingerprint = revision.spec?.digestInputs?.rendererSHA256;
  const releaseDigest = sha256File(join(revisionRoot, "rendered", "release-objects.yaml"));
  const digest = sha256(
    JSON.stringify({
      recipeDigest,
      variantDigest,
      effectiveValuesDigest,
      rendererFingerprint,
      releaseDigest,
    }),
  );
  revision.metadata = {
    ...(revision.metadata ?? {}),
    name: `${variantName}-r001`,
    labels: variantLabels(revision.metadata?.labels, variantName),
  };
  revision.spec = {
    ...(revision.spec ?? {}),
    variant: `../../../variants/${variantName}/variant.yaml`,
    digest,
    digestInputs: {
      ...(revision.spec?.digestInputs ?? {}),
      recipeSHA256: recipeDigest,
      variantSHA256: variantDigest,
      effectiveValuesSHA256: effectiveValuesDigest,
      renderedObjectSetSHA256: releaseDigest,
    },
  };
  writeYaml(path, revision);
}

function updateInventory(revisionRoot, item, variantName) {
  const path = join(revisionRoot, "rendered", "object-inventory.yaml");
  const inventory = readYaml(path);
  inventory.metadata = {
    ...(inventory.metadata ?? {}),
    name: `${artifactName(item)}-${variantName}-r001`,
    labels: variantLabels(inventory.metadata?.labels, variantName),
  };
  inventory.spec.sourceSHA256 = sha256File(join(revisionRoot, "rendered", "release-objects.yaml"));
  writeYaml(path, inventory);
}

function updateReceipts(revisionRoot, item, variantName) {
  const receiptNames = [
    "render-receipt.yaml",
    "helm-equivalence-receipt.yaml",
    "scan-receipt.yaml",
    "install-gate.yaml",
  ];
  for (const receiptName of receiptNames) {
    const path = join(revisionRoot, "receipts", receiptName);
    const receipt = readYaml(path);
    receipt.metadata = {
      ...(receipt.metadata ?? {}),
      name: `${artifactName(item)}-${variantName}-r001`,
      labels: variantLabels(receipt.metadata?.labels, variantName),
    };
    if (variantName !== "default") {
      receipt.spec = {
        ...(receipt.spec ?? {}),
        usefulBaseAlias: {
          sourceBase: "default",
          realizationStrategy: "alias-of-default-render",
        },
      };
    } else if (receipt.spec?.usefulBaseAlias) {
      delete receipt.spec.usefulBaseAlias;
    }
    writeYaml(path, receipt);
  }
}

function updatePackageReceipt(item) {
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  const path = join(recipeRoot, "publication", "installer-package-receipt.yaml");
  const receipt = readYaml(path);
  receipt.spec.package.sourceFiles = listFiles(packageRoot).map((file) => ({
    path: relative(packageRoot, file).replaceAll("\\", "/"),
    sha256: sha256File(file),
    bytes: readFileSync(file).length,
  }));
  const defaultSetup = (receipt.spec.setupChecks ?? []).find((setup) => setup.variant === "default");
  check(Boolean(defaultSetup), `${relativeRepo(path)} missing default setup check`);
  const checks = (receipt.spec.setupChecks ?? []).filter((setup) => setup.variant !== item.base);
  checks.push({
    ...defaultSetup,
    variant: item.base,
    base: item.base,
    command: String(defaultSetup.command).replace("--base default", `--base ${item.base}`),
  });
  receipt.spec.setupChecks = checks.sort((a, b) => (a.variant === "default" ? -1 : b.variant === "default" ? 1 : a.variant.localeCompare(b.variant)));
  receipt.spec.deterministicBundle.sha256 = deterministicBundleSHA(packageRoot, item);
  writeYaml(path, receipt);
}

function verifyUsefulBase(item) {
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  const recipe = readYaml(join(recipeRoot, "recipe.yaml"));
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const catalogStatus = readYaml(join(recipeRoot, "catalog-status.yaml"));
  const receipt = readYaml(join(recipeRoot, "publication", "installer-package-receipt.yaml"));
  const variantPath = join(recipeRoot, "variants", item.base, "variant.yaml");
  const revisionRoot = join(recipeRoot, "revisions", item.base, "r001");
  const defaultRelease = join(recipeRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
  const aliasRelease = join(revisionRoot, "rendered", "release-objects.yaml");

  check(recipe.spec?.variants?.includes(`variants/${item.base}/variant.yaml`), `${item.chart} recipe missing ${item.base}`);
  check(installer.spec?.bases?.some((base) => base.name === item.base), `${item.chart} installer missing base ${item.base}`);
  check(catalogStatus.spec?.candidateVariants?.includes(item.base), `${item.chart} catalog status missing candidate ${item.base}`);
  check(existsSync(variantPath), `${item.chart} missing variant file ${item.base}`);
  check(existsSync(join(packageRoot, "bases", item.base, "upstream.yaml")), `${item.chart} missing package base upstream ${item.base}`);
  check(readFileSync(defaultRelease, "utf8") === readFileSync(aliasRelease, "utf8"), `${item.chart} ${item.base} must alias default rendered objects`);
  check(
    readFileSync(join(packageRoot, "bases", "default", "upstream.yaml"), "utf8") ===
      readFileSync(join(packageRoot, "bases", item.base, "upstream.yaml"), "utf8"),
    `${item.chart} ${item.base} package base must alias default upstream`,
  );

  const variant = readYaml(variantPath);
  check(variant.spec?.usefulBase?.realizationStrategy === "alias-of-default-render", `${item.chart} ${item.base} missing usefulBase alias metadata`);
  const revision = readYaml(join(revisionRoot, "variant-revision.yaml"));
  check(revision.spec?.digestInputs?.variantSHA256 === sha256File(variantPath), `${item.chart} ${item.base} variant digest mismatch`);
  check(revision.spec?.digestInputs?.renderedObjectSetSHA256 === sha256File(aliasRelease), `${item.chart} ${item.base} rendered digest mismatch`);
  check(receipt.spec?.setupChecks?.some((setup) => setup.variant === item.base), `${item.chart} package receipt missing setup check for ${item.base}`);
  for (const file of receipt.spec?.package?.sourceFiles ?? []) {
    const actual = join(packageRoot, file.path);
    check(existsSync(actual), `${item.chart} package receipt references missing ${file.path}`);
    check(sha256File(actual) === file.sha256, `${item.chart} package source SHA mismatch for ${file.path}`);
  }
  check(
    receipt.spec?.deterministicBundle?.sha256 === deterministicBundleSHA(packageRoot, item),
    `${item.chart} deterministic package bundle SHA mismatch`,
  );
}

function deterministicBundleSHA(packageRoot, item) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-useful-base-package-"));
  try {
    const output = join(tempRoot, `${artifactName(item)}.tgz`);
    runCub(["installer", "package", packageRoot, "-o", output]);
    return sha256File(output);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function sortBases(bases) {
  return bases.sort((a, b) => (a.name === "default" ? -1 : b.name === "default" ? 1 : a.name.localeCompare(b.name)));
}

function variantLabels(labels, variantName) {
  return {
    ...(labels ?? {}),
    "confighub.io/variant": variantName,
  };
}

function recipeRootFor(item) {
  return join(repoRoot, "recipes", ...item.chart.split("/"), item.version);
}

function packageRootFor(item) {
  return join(repoRoot, "packages", ...item.chart.split("/"), item.version);
}

function artifactName(item) {
  return `${item.chart.replaceAll("/", "-")}-${item.version.replaceAll(".", "-")}`;
}

function keyFor(chart, version, base) {
  return `${chart}@${version}#${base}`;
}

function splitList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function assertFresh(relativePath, expected) {
  const path = join(repoRoot, relativePath);
  check(existsSync(path), `${relativePath} is missing; run npm run top100:useful-base-realization`);
  check(readFileSync(path, "utf8") === expected, `${relativePath} is stale; run npm run top100:useful-base-realization`);
}

function summary(rows) {
  const tableRows = rows
    .map(
      (row) =>
        `| ${row.chart}@${row.version} | ${row.base} | ${row.realization_strategy} | ${row.remaining_before_catalog} |`,
    )
    .join("\n");
  return `# Useful Base Realization Wave

Generated. Do not edit by hand.

This wave turns selected useful-base proposals into real recipe variants and
\`cub installer\` package bases. Every row in this first wave is an
\`alias-of-default-render\`: the Kubernetes object set is intentionally identical
to the already-proved default render, but users now get a named start path that
matches the job they are trying to do.

These rows are not production-supported catalog offers yet. They still need the
ConfigHub proof lane, selected live evidence, and production disposition before
they can be promoted.

## Summary

~~~text
realized bases: ${rows.length}
strategy: alias-of-default-render
remaining status: candidate base, not production support
~~~

## Rows

| Chart | Base | Strategy | Remaining before catalog |
| --- | --- | --- | --- |
${tableRows}

## Reading Rule

- Use these bases as clearer start paths, not as production guarantees.
- The rendered YAML matches the default render by design.
- If a future useful base changes values or objects, it must be rendered and
  proved as its own object set rather than treated as an alias.

Machine-readable form:

- [wave.csv](./wave.csv)

Regenerate:

~~~sh
npm run top100:useful-base-realization
npm run top100:useful-base-realization:verify
~~~
`;
}

function csv(rows, headers) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

function csvEscape(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function readCsv(path) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const text = readFileSync(path, "utf8");
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
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((item) => item.length === headers.length)
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}

function usage() {
  console.log(`Usage:
  node scripts/generate-useful-base-realization-wave.mjs --generate
  node scripts/generate-useful-base-realization-wave.mjs --verify`);
  process.exit(1);
}
