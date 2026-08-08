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
  serializeYaml,
  sha256,
  sha256File,
  write,
} from "./lib/proof-common.mjs";
import { releaseBaselineFiles } from "./lib/kubara-catalog-release.mjs";

const baseline = releaseBaselineFiles(repoRoot);

// An alias base is re-derived from its default on every run, so this script
// rewrites files it has nothing to say about. The serializer quotes and orders
// keys differently from whatever wrote those files first, so an unconditional
// write reformats eight catalog-status files, an installer.yaml and a
// variant.yaml without changing a single fact, and that churn moves the very
// digests this script then records. Compare the rendered form against the
// file's own round trip and write only where the meaning actually differs.
function writeYaml(path, value) {
  if (existsSync(path) && canonical(readYaml(path)) === canonical(value)) return;
  // Re-deriving an alias must never rewrite a file the pinned Kubara release
  // baseline recorded, because that file is evidence someone already pulled.
  // Skipping is only acceptable because it is announced and because
  // generate-variant-revision-digests carries the resulting wrong record as a
  // named frozen state with the next release as its next action.
  const repoRelative = relative(repoRoot, path).replaceAll("\\", "/");
  if (baseline.has(repoRelative)) {
    console.log(`skipped ${repoRelative}: inside the pinned release baseline, so the next release re-records it`);
    return;
  }
  write(path, serializeYaml(value));
}

// Compare meaning, not layout. An alias variant is rebuilt field by field from
// its default, so its keys arrive in a different order than the file states
// them even when every fact is the same, and the serializer keeps whatever
// order it is given.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const args = process.argv.slice(2);
const generate = args.includes("--generate");
const verify = args.includes("--verify");

if (!generate && !verify) usage();

const outputPaths = {
  wave: "data/useful-base-realization-wave/wave.csv",
  summary: "data/useful-base-realization-wave/summary.md",
};

const wave = [
  monitoringBase("prometheus-community/kube-state-metrics", "7.4.0"),
  monitoringBase("prometheus-community/prometheus-blackbox-exporter", "11.10.0"),
  monitoringBase("prometheus-community/prometheus-adapter", "5.3.0"),
  controllerBase("stakater/reloader", "2.2.12"),
  controllerBase("autoscaler/cluster-autoscaler", "9.57.0"),
  controllerBase("argo-cd/argo-workflows", "1.0.14"),
  collectorBase("elastic/filebeat", "8.5.1"),
  controllerBase("istio/gateway", "1.30.0"),
  defaultReviewedBase("nats/surveyor", "0.20.9"),
  defaultReviewedBase("vm/victoria-metrics-single", "0.39.0"),
];

const liveFindings = new Map([
  [keyFor("autoscaler/cluster-autoscaler", "9.57.0", "controller-default-reviewed"), {
    status: "realized-values-profile-rerender",
    realizationStrategy: "values-profile-rerender",
    remainingBeforeCatalog: "production disposition",
    proofNote:
      "The earlier alias proved semantic parity but rendered no controller workload. This base is now re-rendered with autoDiscovery.clusterName and awsRegion pinned, and strict live parity passed regular Helm, ConfigHub apply, and ConfigHub OCI/Argo.",
    note:
      "controller-default-reviewed is a values-profile rerender with autoDiscovery.clusterName and awsRegion modeled as render-time inputs.",
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
  for (const item of wave) {
    // A rerender owns its own render, values profile and receipts, so this
    // script must not re-derive it from the default. It still owes the catalog
    // status the same two facts every realized base owes, and that is the part
    // no lane was keeping.
    if (realizationStrategyFor(item) === "values-profile-rerender") {
      updateCatalogStatus(item);
      continue;
    }
    realizeUsefulBase(item);
  }
  write(join(repoRoot, outputPaths.wave), report.wave);
  write(join(repoRoot, outputPaths.summary), report.summary);
  console.log(`wrote useful base realization wave for ${wave.length} chart(s)`);
} else {
  for (const item of wave) verifyUsefulBase(item);
  assertFresh(outputPaths.wave, report.wave);
  assertFresh(outputPaths.summary, report.summary);
  console.log(`verified useful base realization wave for ${wave.length} chart(s)`);
}

function monitoringBase(chart, version) {
  return {
    chart,
    version,
    base: "cluster-metrics-readonly",
    userJob: "collect or expose cluster metrics without changing application workloads",
    renderTimeChoices: [
      "service exposure",
      "RBAC scope",
      "persistence if the chart stores state",
      "CRD ownership if present",
    ],
  };
}

function controllerBase(chart, version) {
  return {
    chart,
    version,
    base: "controller-default-reviewed",
    userJob: "install a cluster controller with explicit CRD, RBAC, and lifecycle boundaries",
    renderTimeChoices: [
      "CRD ownership",
      "admission/webhook behavior",
      "RBAC scope",
      "leader-election or HA flags",
      "required values",
    ],
  };
}

function collectorBase(chart, version) {
  return {
    chart,
    version,
    base: "node-or-cluster-collector",
    userJob: "run an observability collector or security agent with explicit output destinations",
    renderTimeChoices: [
      "DaemonSet versus Deployment shape",
      "destination Secret or endpoint",
      "RBAC scope",
      "persistence if present",
    ],
  };
}

function defaultReviewedBase(chart, version) {
  return {
    chart,
    version,
    base: "default-reviewed",
    userJob: "turn the default render into a named, reviewed install shape",
    renderTimeChoices: [
      "required values",
      "Secret policy",
      "Service/Ingress shape",
      "storage if present",
    ],
  };
}

function buildRow(item) {
  const queueRow = queueByKey.get(keyFor(item.chart, item.version, item.base));
  const liveFinding = liveFindings.get(keyFor(item.chart, item.version, item.base));
  check(Boolean(queueRow) || Boolean(item.userJob), `useful base metadata missing ${item.chart}@${item.version} ${item.base}`);
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  return {
    chart: item.chart,
    version: item.version,
    base: item.base,
    status: liveFinding?.status ?? "realized-alias-base",
    realization_strategy: realizationStrategyFor(item),
    source_base: "default",
    rendered_object_set: existsSync(join(recipeRoot, "revisions", item.base, "r001", "rendered", "release-objects.yaml"))
      ? sha256File(join(recipeRoot, "revisions", item.base, "r001", "rendered", "release-objects.yaml"))
      : "",
    user_job: queueRow?.user_job ?? item.userJob,
    remaining_before_catalog: liveFinding?.remainingBeforeCatalog ?? "ConfigHub proof lane; selected live lane; production disposition",
    recipe_variant: relativeRepo(join(recipeRoot, "variants", item.base, "variant.yaml")),
    package_base: relativeRepo(join(packageRoot, "bases", item.base)),
    revision: relativeRepo(join(recipeRoot, "revisions", item.base, "r001", "variant-revision.yaml")),
    proof_note: liveFinding?.proofNote ?? "Kubernetes object set is intentionally identical to default; the base gives users a named start path before live and production review.",
  };
}

function realizeUsefulBase(item) {
  check(realizationStrategyFor(item) === "alias-of-default-render", `${item.chart} ${item.base} is not an alias base`);
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

  // The re-derivation deletes a tree and copies the default over it. That is
  // safe for a tree this script owns and destructive for one the pinned release
  // baseline recorded, because the delete lands first and the write that would
  // put the alias metadata back is refused. Leave a recorded tree exactly as it
  // was published.
  replaceFromDefault(defaultBaseRoot, baseRoot);
  replaceFromDefault(defaultRevisionRoot, revisionRoot);

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
  const variantPath = join(recipeRoot, "variants", item.base, "variant.yaml");
  const existingVariant = existsSync(variantPath) ? readYaml(variantPath) : null;
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
      ...(existingVariant?.spec?.targetFacts
        ? { targetFacts: existingVariant.spec.targetFacts }
        : {}),
      usefulBase:
        {
          realizationStrategy: "alias-of-default-render",
          sourceBase: "default",
          userJob: queueRow?.user_job ?? item.userJob,
          renderTimeChoices: queueRow ? splitList(queueRow.render_time_choices) : item.renderTimeChoices,
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
  writeYaml(variantPath, variant);
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
    ...(status.spec.notes ?? []).filter((note) => {
      const text = String(note);
      return !text.includes(`${item.base} is a realized useful-base alias`) && !text.includes(`${item.base} is a values-profile rerender`);
    }),
    usefulBaseNote(item),
  ];
  writeYaml(path, status);
}

// A rerender is not an alias, and its note has to say so. The wording here
// matches what realize-useful-base-rerenders.mjs wrote by hand, because no npm
// lane runs that script: it was run once, its output went unowned, and the note
// it left behind was dropped later with nothing to notice.
function usefulBaseNote(item) {
  if (realizationStrategyFor(item) === "values-profile-rerender") {
    return `${item.base} is a values-profile rerender that changes Helm inputs; catalog support still requires selected live evidence and production disposition.`;
  }
  const liveFinding = liveFindings.get(keyFor(item.chart, item.version, item.base));
  return liveFinding?.note
    ? `${item.base} is a realized useful-base alias of the default render, but ${liveFinding.note.charAt(0).toLowerCase()}${liveFinding.note.slice(1)}`
    : `${item.base} is a realized useful-base alias of the default render; catalog support still requires ConfigHub proof, selected live evidence, and production disposition.`;
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
  if (realizationStrategyFor(item) === "values-profile-rerender") {
    verifyValuesProfileRerender(item);
    return;
  }
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
  verifyCatalogStatusNote(catalogStatus, item);
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
  const revisionPath = join(revisionRoot, "variant-revision.yaml");
  const revision = readYaml(revisionPath);
  check(revision.spec?.digestInputs?.renderedObjectSetSHA256 === sha256File(aliasRelease), `${item.chart} ${item.base} rendered digest mismatch`);
  if (!frozenByRelease(revisionPath)) {
    check(revision.spec?.digestInputs?.variantSHA256 === sha256File(variantPath), `${item.chart} ${item.base} variant digest mismatch`);
  }
  // The alias and the default are one pair of records, and this lane used to
  // check only the alias half. When the Argo Workflows CRD route was written
  // into both variants by hand, both revisions went stale and only the alias
  // said so. Check the source half of the pair the same way.
  verifyRevisionDigests(recipeRoot, "default", `${item.chart} default`);
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

// This lane checked that the base appeared in the candidate list and never
// checked the note that says what the candidate is. Commit 65907b6fe rewrote
// catalog-status.yaml across 280 files with a different serializer and dropped
// that note on all nine alias charts, and nothing failed, because a fact this
// generator writes was a fact it never read back.
function verifyCatalogStatusNote(catalogStatus, item) {
  check(
    (catalogStatus.spec?.notes ?? []).includes(usefulBaseNote(item)),
    `${item.chart} catalog status is missing the ${item.base} useful-base note`,
  );
}

function verifyRevisionDigests(recipeRoot, variantName, label) {
  const revisionRoot = join(recipeRoot, "revisions", variantName, "r001");
  const revisionPath = join(revisionRoot, "variant-revision.yaml");
  const revision = readYaml(revisionPath);
  const inputs = revision.spec?.digestInputs ?? {};
  check(
    inputs.renderedObjectSetSHA256 === sha256File(join(revisionRoot, "rendered", "release-objects.yaml")),
    `${label} rendered digest mismatch`,
  );
  if (frozenByRelease(revisionPath)) return;
  check(
    inputs.variantSHA256 === sha256File(join(recipeRoot, "variants", variantName, "variant.yaml")),
    `${label} variant digest mismatch`,
  );
}

function replaceFromDefault(sourceRoot, targetRoot) {
  const recorded = existsSync(targetRoot)
    ? listFiles(targetRoot).map((file) => relative(repoRoot, file).replaceAll("\\", "/")).filter((file) => baseline.has(file))
    : [];
  if (recorded.length) {
    console.log(
      `kept ${relative(repoRoot, targetRoot).replaceAll("\\", "/")} as published: ${recorded.length} file(s) are in the pinned release baseline`,
    );
    return;
  }
  rmSync(targetRoot, { recursive: true, force: true });
  cpSync(sourceRoot, targetRoot, { recursive: true });
}

// A record inside the pinned release baseline cannot be corrected here without
// rewriting what the release published, so this lane stops claiming it is
// right. It is not passed over either: generate-variant-revision-digests counts
// it as frozen, names the next release as where it gets re-recorded, and
// refuses if the number grows.
function frozenByRelease(path) {
  return baseline.has(relative(repoRoot, path).replaceAll("\\", "/"));
}

function verifyValuesProfileRerender(item) {
  const recipeRoot = recipeRootFor(item);
  const packageRoot = packageRootFor(item);
  const recipe = readYaml(join(recipeRoot, "recipe.yaml"));
  const installer = readYaml(join(packageRoot, "installer.yaml"));
  const catalogStatus = readYaml(join(recipeRoot, "catalog-status.yaml"));
  const receipt = readYaml(join(recipeRoot, "publication", "installer-package-receipt.yaml"));
  const variantPath = join(recipeRoot, "variants", item.base, "variant.yaml");
  const revisionRoot = join(recipeRoot, "revisions", item.base, "r001");
  const releasePath = join(revisionRoot, "rendered", "release-objects.yaml");
  const baseUpstream = join(packageRoot, "bases", item.base, "upstream.yaml");
  const variant = readYaml(variantPath);
  const revision = readYaml(join(revisionRoot, "variant-revision.yaml"));
  const inventory = readYaml(join(revisionRoot, "rendered", "object-inventory.yaml"));
  const liveReceiptPath = join(
    repoRoot,
    "runs",
    "live-helm-confighub-compare",
    `${item.chart.replaceAll("/", "-")}-${item.base}`,
    "receipt.yaml",
  );
  const liveReceipt = readYaml(liveReceiptPath);

  check(recipe.spec?.variants?.includes(`variants/${item.base}/variant.yaml`), `${item.chart} recipe missing ${item.base}`);
  check(installer.spec?.bases?.some((base) => base.name === item.base), `${item.chart} installer missing base ${item.base}`);
  check(catalogStatus.spec?.candidateVariants?.includes(item.base), `${item.chart} catalog status missing candidate ${item.base}`);
  verifyCatalogStatusNote(catalogStatus, item);
  check(existsSync(variantPath), `${item.chart} missing variant file ${item.base}`);
  check(existsSync(join(packageRoot, "bases", item.base, "upstream.yaml")), `${item.chart} missing package base upstream ${item.base}`);
  check(readFileSync(baseUpstream, "utf8") === readFileSync(releasePath, "utf8"), `${item.chart} ${item.base} package base must match rendered objects`);
  check(variant.spec?.usefulBase?.realizationStrategy === "values-profile-rerender", `${item.chart} ${item.base} missing rerender metadata`);
  check(variant.spec?.valuesProfile === `../../effective-values-${item.base}.yaml`, `${item.chart} ${item.base} missing values profile`);
  check(existsSync(join(recipeRoot, `effective-values-${item.base}.yaml`)), `${item.chart} ${item.base} missing effective values profile`);
  check((variant.spec?.targetFacts?.requiredValues ?? []).length > 0, `${item.chart} ${item.base} missing required render values`);
  check(
    (variant.spec?.usefulBase?.addedObjects ?? []).every((identity) => (inventory.spec?.objects ?? []).some((object) => object.identity === identity)),
    `${item.chart} ${item.base} missing expected added object in inventory`,
  );
  check(revision.spec?.digestInputs?.variantSHA256 === sha256File(variantPath), `${item.chart} ${item.base} variant digest mismatch`);
  check(revision.spec?.digestInputs?.renderedObjectSetSHA256 === sha256File(releasePath), `${item.chart} ${item.base} rendered digest mismatch`);
  check(receipt.spec?.setupChecks?.some((setup) => setup.variant === item.base), `${item.chart} package receipt missing setup check for ${item.base}`);
  check(liveReceipt.spec?.result === "pass", `${item.chart} ${item.base} live parity receipt is not pass`);
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

function realizationStrategyFor(item) {
  return liveFindings.get(keyFor(item.chart, item.version, item.base))?.realizationStrategy ?? "alias-of-default-render";
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
\`cub installer\` package bases. Most rows in this first wave are
\`alias-of-default-render\`: the Kubernetes object set is intentionally identical
to the already-proved default render, but users get a named start path that
matches the job they are trying to do. Rows marked
\`values-profile-rerender\` change Helm inputs and carry their own rendered
object set.

These rows are not production-supported catalog offers yet. They still need the
ConfigHub proof lane, selected live evidence, and production disposition before
they can be promoted.

## Summary

~~~text
realized bases: ${rows.length}
alias bases: ${rows.filter((row) => row.realization_strategy === "alias-of-default-render").length}
values-profile rerenders: ${rows.filter((row) => row.realization_strategy === "values-profile-rerender").length}
remaining status: candidate base, not production support
~~~

## Rows

| Chart | Base | Strategy | Remaining before catalog |
| --- | --- | --- | --- |
${tableRows}

## Reading Rule

- Use these bases as clearer start paths, not as production guarantees.
- For \`alias-of-default-render\` rows, the rendered YAML matches the default
  render by design.
- For \`values-profile-rerender\` rows, the base has its own values profile,
  rendered objects, receipts, and live parity evidence.
- If a useful base changes values or objects, it must be rendered and proved as
  its own object set rather than treated as an alias.

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
