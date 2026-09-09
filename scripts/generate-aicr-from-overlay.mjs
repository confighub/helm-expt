#!/usr/bin/env node

// Mirror one overlay from NVIDIA's AICR recipe catalog into a first-class
// ConfigHub catalog entry under examples/aicr/<id>/, at the same quality bar
// as the hand-built eks-h100-inference-nim entry it is modeled on: source
// pinned by digest, render checked, one digest pinning the whole rendered
// shape, a generation receipt, and a page.
//
// Usage:
//   node scripts/generate-aicr-from-overlay.mjs <overlay-name> [--id <id>]
//
// <overlay-name> is a name from `aicr recipe list` (e.g. eks-inference,
// a100-aks-ubuntu-training-kubeflow). --id lets the entry directory and
// register id differ from the overlay name; it defaults to the overlay name,
// which is already catalog-safe kebab-case.
//
// What it does, in order:
//   1. Verifies (or downloads and verifies) the pinned AICR CLI release
//      binary. Nothing runs an unverified binary: the release tarball and the
//      extracted binary are both checked against sha256 values pinned in this
//      file before anything is executed.
//   2. Resolves the overlay's criteria from `aicr recipe list --format json`
//      and runs the proven offline pipeline: `aicr recipe` -> `aicr bundle
//      --deployer argocd-helm` -> `helm template`, exactly as
//      examples/aicr/eks-h100-inference-nim/generation-receipt.yaml records.
//   3. Writes examples/aicr/<id>/{recipe.yaml, generation-receipt.yaml,
//      index-config.yaml, argocd-rendered/{templates,checksums.txt}}. This
//      step fully replaces any existing examples/aicr/<id>/ directory: that
//      directory is owned exclusively by this entry, so regenerating it is
//      idempotent rather than destructive.
//   4. Compiles examples/aicr/<id>/digest-index/ by shelling out to the
//      existing, generic `scripts/generate-aicr-digest-index.mjs --example
//      <id>` compiler. That compiler already serves any AICR entry shaped
//      this way (it was generalized from the training entry to serve
//      eks-h100-inference-nim); this script does not reimplement it.
//   5. Appends (never rewrites) one entry to the shared
//      examples/aicr/claims/entry-names.yaml register, one set of quantities
//      and claims to the shared examples/aicr/claims/numeric-claims.yaml
//      register, and one row to the shared docs/README.md worked-examples
//      table -- each guarded by an existence check, so a second run for the
//      same id changes nothing and two agents mirroring different overlays
//      can both append without clobbering each other's block. They can still
//      produce a git merge conflict if their branches both touch the same
//      shared file; that is an ordinary merge, not a generator bug.
//   6. Writes docs/demo/aicr/<id>.md, a page in the same voice and shape as
//      the existing AICR entry pages.
//
// What it deliberately does not do: it does not add a
// data/base-variant-records/records.json entry. The entry this script is
// modeled on, eks-h100-inference-nim, has none either -- only the flagship,
// actually-published training entries carry one -- so a bare mirrored entry
// at the same tier stays consistent with that precedent rather than inventing
// a heavier one.
//
// After running this script, still run the gates by hand: `npm run
// aicr-example:verify`, `npm run aicr-entry-naming:generate` then `:verify`,
// `npm run aicr-claims:generate` then `:verify`, `npm run config-model:verify`,
// `npm run docs:verify`, `npm run doc-freshness` then `:verify`, and `npm run
// verify:no-personal-names`. In particular: `git add` the new files BEFORE
// `npm run doc-freshness` (or its snapshot omits them), and regenerate the
// site with the pinned HELM_EXPT_SITE_GENERATED_AT timestamp
// (`HELM_EXPT_SITE_GENERATED_AT=<value> npm run site:generate`) before `npm
// run docs:verify` / `npm run site:verify` / `npm run site:ux:verify`.
//
// Boundary, stated once and carried into every generated entry: config-plane
// only. No cluster, no GPU workload, and no NGC surface is contacted by this
// script or by anything it generates.

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { arch as osArch, homedir, platform as osPlatform, tmpdir } from "node:os";
import { join } from "node:path";

import { check, normalizeTempPaths, readYaml, relativeRepo, repoRoot, sha256, sha256File, write, writeYaml } from "./lib/proof-common.mjs";

// ---------------------------------------------------------------------------
// Pinned upstream release provenance. One CLI release backs every entry this
// generator produces; bumping it is a deliberate, separate decision, not a
// side effect of mirroring one more overlay.
// ---------------------------------------------------------------------------
const AICR_RELEASE = {
  name: "NVIDIA AICR",
  version: "v0.21.0",
  commit: "36f52ec9346b8ce4b6dcdb08f1d82f92c963bebe",
  repository: "https://github.com/NVIDIA/aicr",
};

// One row per `${os.platform()}-${os.arch()}` this generator has actually
// verified. Extend it by downloading the matching
// aicr_<version>_<os>_<arch>.tar.gz release asset, recording its sha256 (from
// the release's aicr_checksums.txt) and the sha256 of the "aicr" binary it
// extracts to, then adding a row here. The generator refuses to run on an
// unpinned platform rather than trust an unverified download.
const PLATFORM_PINS = {
  "darwin-arm64": {
    assetName: "aicr_0.21.0_darwin_arm64.tar.gz",
    assetSha256: "5dbe88fc8c5b8c937ca87c624f8f01c29eaefbfb3ced8f556a0136c47ff6be63",
    binarySha256: "1a4bea881a45480b1761f7e01670f02a61f5d02a4c0fdae3d93da65a47e51afb",
  },
};

const PLANNED_OCI_BASE = "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt";
const ENTRY_NAMES_PATH = join(repoRoot, "examples/aicr/claims/entry-names.yaml");
const NUMERIC_CLAIMS_PATH = join(repoRoot, "examples/aicr/claims/numeric-claims.yaml");
const DOC_MAP_PATH = join(repoRoot, "docs/README.md");

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];

function usage() {
  console.error(`Usage:
  node scripts/generate-aicr-from-overlay.mjs <overlay-name> [--id <id>] \\
    [--extra-bundle-arg <token>]...

<overlay-name> must be a name from \`aicr recipe list\`. --id overrides the
entry id (directory name and register id); it defaults to <overlay-name>.
--extra-bundle-arg passes one extra token through to \`aicr bundle\` and can
repeat; use it for the handful of overlays that refuse the generator's
defaults with a specific, actionable error, e.g. AKS overlays that need a
keyed accelerated-node toleration instead of the wildcard one:
  --extra-bundle-arg --accelerated-node-toleration --extra-bundle-arg nvidia.com/gpu:NoSchedule`);
}

function collectRepeatedFlag(argv, flag) {
  const values = [];
  for (let index = argv.indexOf(flag); index !== -1; index = argv.indexOf(flag, index + 1)) {
    check(index + 1 < argv.length, `${flag} needs a value`);
    values.push(argv[index + 1]);
  }
  return values;
}

function main() {
  const overlayName = process.argv[2];
  if (!overlayName || overlayName.startsWith("--")) {
    usage();
    process.exit(2);
  }
  const idFlagIndex = process.argv.indexOf("--id");
  const entryId = idFlagIndex === -1 ? overlayName : process.argv[idFlagIndex + 1];
  check(/^[a-z0-9][a-z0-9-]*$/.test(entryId), `entry id ${JSON.stringify(entryId)} must be lowercase kebab-case`);
  const extraBundleArgs = collectRepeatedFlag(process.argv, "--extra-bundle-arg");

  const binary = ensureVerifiedBinary();
  const overlay = resolveOverlay(binary.path, overlayName);

  const work = mkdtempSync(join(tmpdir(), `aicr-mirror-${entryId}-`));
  try {
    const generated = runPipeline(binary.path, overlay, work, extraBundleArgs);
    const entryRoot = writeEntry({ entryId, overlay, binary, generated });
    compileDigestIndex(entryId);
    const registerEntry = updateEntryNamesRegister({ entryId, overlay, generated });
    updateNumericClaims({ entryId, generated });
    writeDocsPage({ entryId, overlay, generated, registerEntry });
    updateDocMap({ entryId, generated });
    console.log(
      `generated ${relativeRepo(entryRoot)}: ${generated.componentCount} components from ${generated.overlaysResolved} overlays -> ${generated.renderedApplications} rendered Applications`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Step 1: a verified AICR binary
// ---------------------------------------------------------------------------

function platformKey() {
  const platformNames = { darwin: "darwin", linux: "linux" };
  const archNames = { arm64: "arm64", x64: "amd64" };
  const platformName = platformNames[osPlatform()];
  const archName = archNames[osArch()];
  return platformName && archName ? `${platformName}-${archName}` : null;
}

function ensureVerifiedBinary() {
  const key = platformKey();
  const pin = key ? PLATFORM_PINS[key] : undefined;
  check(
    pin,
    `no pinned AICR ${AICR_RELEASE.version} release checksum for platform ${key ?? `${osPlatform()}-${osArch()}`}; ` +
      "add one to PLATFORM_PINS in this script (download the matching release asset, record its sha256 " +
      "from the release's aicr_checksums.txt, and the sha256 of the extracted binary) before running it here",
  );

  const cacheDir = join(homedir(), ".cache", "aicr-mirror", AICR_RELEASE.version, key);
  const binaryPath = join(cacheDir, "aicr");

  if (existsSync(binaryPath) && sha256File(binaryPath) === pin.binarySha256) {
    return provenanceFor(pin, binaryPath);
  }

  console.log(`downloading ${pin.assetName} (verified against a pinned sha256, not trusted on receipt)...`);
  const downloadRoot = mkdtempSync(join(tmpdir(), "aicr-mirror-release-"));
  try {
    const tarPath = join(downloadRoot, pin.assetName);
    const url = `${AICR_RELEASE.repository}/releases/download/${AICR_RELEASE.version}/${pin.assetName}`;
    execFileSync("curl", ["-sL", "--fail", "-o", tarPath, url], { stdio: ["ignore", "inherit", "inherit"] });
    const tarSha256 = sha256File(tarPath);
    check(
      tarSha256 === pin.assetSha256,
      `downloaded ${pin.assetName} has sha256 ${tarSha256}, expected ${pin.assetSha256}; refusing to extract or run it`,
    );
    execFileSync("tar", ["-xzf", tarPath, "-C", downloadRoot], { stdio: "inherit" });
    const extractedBinary = join(downloadRoot, "aicr");
    check(existsSync(extractedBinary), `${pin.assetName} did not extract an "aicr" binary at its top level`);
    const binarySha256 = sha256File(extractedBinary);
    check(
      binarySha256 === pin.binarySha256,
      `extracted aicr binary has sha256 ${binarySha256}, expected ${pin.binarySha256}; refusing to run it`,
    );
    chmodSync(extractedBinary, 0o755);
    try {
      execFileSync("xattr", ["-d", "com.apple.quarantine", extractedBinary], { stdio: "ignore" });
    } catch {
      // Not macOS, or nothing to clear; either is fine.
    }
    mkdirSync(cacheDir, { recursive: true });
    write(binaryPath, readFileSync(extractedBinary));
    chmodSync(binaryPath, 0o755);
    return provenanceFor(pin, binaryPath);
  } finally {
    rmSync(downloadRoot, { recursive: true, force: true });
  }
}

// The receipt records what was verified, not whether this particular run hit
// a local cache: that circumstance is a property of the machine that ran the
// generator, not of the entry, and would otherwise make two equally valid
// generations of the same overlay disagree in a committed file.
function provenanceFor(pin, binaryPath) {
  const binaryVerifiedBeforeUse =
    "The release tarball and the binary it extracts to were both checked against the sha256 values pinned in scripts/generate-aicr-from-overlay.mjs before the binary ran.";
  const reported = execFileSync(binaryPath, ["--version"], { encoding: "utf8" });
  check(
    reported.includes(AICR_RELEASE.version.replace(/^v/, "")) && reported.includes(AICR_RELEASE.commit),
    `the verified binary reports ${JSON.stringify(reported.trim())}, which does not name the pinned version/commit; the PLATFORM_PINS table may be stale`,
  );
  return {
    path: binaryPath,
    source: {
      name: AICR_RELEASE.name,
      version: AICR_RELEASE.version,
      commit: AICR_RELEASE.commit,
      repository: AICR_RELEASE.repository,
      releaseAsset: { name: pin.assetName, sha256: pin.assetSha256 },
      binarySha256: pin.binarySha256,
      binaryVerifiedBeforeUse,
    },
  };
}

// ---------------------------------------------------------------------------
// Step 2: resolve the overlay's criteria and run the proven pipeline
// ---------------------------------------------------------------------------

function resolveOverlay(binaryPath, overlayName) {
  const listing = JSON.parse(execFileSync(binaryPath, ["recipe", "list", "--format", "json"], { encoding: "utf8" }));
  const overlay = listing.find((row) => row.name === overlayName);
  check(
    overlay,
    `${overlayName} is not a name in \`aicr recipe list\`; run it yourself to see the ${listing.length} available overlay names`,
  );
  return overlay;
}

function runPipeline(binaryPath, overlay, work, extraBundleArgs = []) {
  const criteria = overlay.criteria ?? {};
  const recipeArgs = ["recipe"];
  const criteriaFlags = [
    ["--service", criteria.Service],
    ["--accelerator", criteria.Accelerator],
    ["--os", criteria.OS],
    ["--intent", criteria.Intent],
    ["--platform", criteria.Platform],
  ];
  for (const [flag, value] of criteriaFlags) {
    if (value) recipeArgs.push(flag, value);
  }
  check(recipeArgs.length > 1, `overlay ${overlay.name} resolved no non-wildcard criteria to pass to \`aicr recipe\``);
  if (criteria.Nodes) recipeArgs.push("--nodes", String(criteria.Nodes));
  const recipePath = join(work, "recipe.yaml");
  recipeArgs.push("--output", recipePath);
  execFileSync(binaryPath, recipeArgs, { cwd: work, stdio: ["ignore", "inherit", "inherit"] });

  const recipe = readYaml(recipePath);
  check(Array.isArray(recipe.deploymentOrder) && recipe.deploymentOrder.length > 0, `${overlay.name}: recipe declares no deployment order`);

  // nodewright-customizations needs a workload selector when it is present at
  // all; the catalog's existing entries set it for both training and
  // inference intents, so this mirrors that rather than the CLI help text's
  // narrower "training only" wording.
  const workloadSelector = ["training", "inference"].includes(criteria.Intent)
    ? `app.kubernetes.io/part-of=${criteria.Intent}`
    : null;
  const bundleDir = join(work, "argocd-helm-bundle");
  const bundleArgs = [
    "bundle",
    "--recipe",
    recipePath,
    "--deployer",
    "argocd-helm",
    "--output",
    bundleDir,
    "--storage-class",
    "gp3",
    "--accelerated-node-selector",
    "nvidia.com/gpu.present=true",
    ...(workloadSelector ? ["--workload-selector", workloadSelector] : []),
    ...extraBundleArgs,
  ];
  execFileSync(binaryPath, bundleArgs, { cwd: work, stdio: ["ignore", "inherit", "inherit"] });

  const renderDir = join(work, "rendered");
  const renderArgs = [
    "template",
    "aicr-argocd",
    bundleDir,
    "--namespace",
    "argocd",
    "--set",
    `repoURL=${PLANNED_OCI_BASE}`,
    "--output-dir",
    renderDir,
  ];
  try {
    execFileSync("helm", renderArgs, { cwd: work, stdio: ["ignore", "inherit", "inherit"] });
  } catch (error) {
    throw new Error(`helm template failed; is helm installed and on PATH? (${error.message})`);
  }

  const templatesDir = findTemplatesDir(renderDir);
  const templateFiles = readdirSync(templatesDir).filter((name) => name.endsWith(".yaml")).sort();
  check(templateFiles.length > 0, `${overlay.name}: helm template produced no rendered Application templates`);

  return {
    overlay,
    criteria,
    recipePath,
    recipe,
    recipeArgs,
    bundleArgs,
    renderArgs,
    templatesDir,
    templateFiles,
    componentCount: recipe.deploymentOrder.length,
    overlaysResolved: (recipe.metadata?.appliedOverlays ?? []).length,
    renderedApplications: templateFiles.length,
    workloadSelector,
  };
}

function findTemplatesDir(renderDir) {
  for (const chartDir of readdirSync(renderDir)) {
    const candidate = join(renderDir, chartDir, "templates");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`${renderDir}: helm template did not write a templates/ directory under any chart`);
}

// ---------------------------------------------------------------------------
// Step 3-4: write the entry directory and compile its digest index
// ---------------------------------------------------------------------------

function writeEntry({ entryId, overlay, binary, generated }) {
  const entryRoot = join(repoRoot, "examples", "aicr", entryId);
  // This directory is owned exclusively by this entry id, so a full rewrite
  // on every run is idempotent rather than destructive.
  if (existsSync(entryRoot)) rmSync(entryRoot, { recursive: true });

  const checksumRows = [];
  for (const file of generated.templateFiles) {
    const bytes = readFileSync(join(generated.templatesDir, file));
    write(join(entryRoot, "argocd-rendered", "templates", file), bytes);
    checksumRows.push(`${sha256(bytes)}  templates/${file}`);
  }
  write(join(entryRoot, "argocd-rendered", "checksums.txt"), `${checksumRows.sort().join("\n")}\n`);
  write(join(entryRoot, "recipe.yaml"), readFileSync(generated.recipePath));

  const versionSlug = AICR_RELEASE.version.replace(/^v/, "").replaceAll(".", "-");
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceGenerationReceipt",
    metadata: { name: `aicr-${entryId}-v${versionSlug}` },
    spec: {
      purpose:
        `The ${overlay.name} overlay from NVIDIA AICR's recipe catalog, mirrored into a first-class ` +
        "catalog entry by scripts/generate-aicr-from-overlay.mjs so it can be reviewed the same way a Helm variant is: pinned source, checked render, one digest.",
      source: binary.source,
      criteria: generated.recipe.criteria ?? {},
      generationInputs: {
        storageClass: "gp3",
        acceleratedNodeSelector: "nvidia.com/gpu.present=true",
        ...(generated.workloadSelector ? { workloadSelector: generated.workloadSelector } : {}),
        repoURL: PLANNED_OCI_BASE,
      },
      // A generated record must be a function of the repository, not of the
      // machine that produced it: mkdtemp scratch paths churn on every run
      // and would otherwise make this receipt (and the digest that pins its
      // shape) differ between two runs over identical inputs.
      commands: {
        recipe: generated.recipeArgs.map(normalizeTempPaths),
        bundle: generated.bundleArgs.map(normalizeTempPaths),
        render: generated.renderArgs.map(normalizeTempPaths),
      },
      result: {
        componentCount: generated.componentCount,
        overlaysResolved: generated.overlaysResolved,
        renderedApplications: generated.renderedApplications,
      },
      boundary: {
        configPlaneOnly: true,
        gpuWorkloadsProven: false,
        published: false,
        publishedStatement:
          "This entry is generated, retained, and rendered. It has not been published to any registry, so it carries no public digest and no OCI transport receipts. The repoURL in its rendered Applications is the reference a publication would use, not a claim that one happened.",
        ngcContacted: false,
        imagesPulled: false,
        statement: "Config-plane only. No GPU workload ran, no container started, and no model was fetched to produce or verify this entry.",
      },
    },
    status: { result: "retained-offline", liveRegistryPublicationClaimed: false },
  };
  writeYaml(join(entryRoot, "generation-receipt.yaml"), receipt);

  const indexConfig = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "DigestIndexConfig",
    metadata: { name: `aicr-${entryId}` },
    spec: {
      description:
        "This entry was generated and retained but never published, so it has no OCI transport receipts. The references below are the ones a publication would use, and the compiled index records published as false.",
      published: false,
      plannedOCIBase: PLANNED_OCI_BASE,
      sourcePackageRepository: `${PLANNED_OCI_BASE}/aicr-bundle`,
      renderedApplications: generated.renderedApplications,
    },
  };
  writeYaml(join(entryRoot, "index-config.yaml"), indexConfig);

  return entryRoot;
}

function compileDigestIndex(entryId) {
  execFileSync("node", ["scripts/generate-aicr-digest-index.mjs", "--generate", "--example", entryId], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

// ---------------------------------------------------------------------------
// Step 5: append to the shared registers, idempotently
// ---------------------------------------------------------------------------

function updateEntryNamesRegister({ entryId, overlay, generated }) {
  const text = readFileSync(ENTRY_NAMES_PATH, "utf8");
  const marker = `    - id: ${entryId}\n`;
  if (text.includes(marker)) {
    const existing = readYaml(ENTRY_NAMES_PATH).spec.entries.find((entry) => entry.id === entryId);
    check(existing, `${relativeRepo(ENTRY_NAMES_PATH)} contains the id ${entryId} but it did not parse back out`);
    return existing;
  }

  const page = `docs/demo/aicr/${entryId}.md`;
  const entry = {
    id: entryId,
    page,
    retainedVersion: AICR_RELEASE.version,
    versionSource:
      "AICR's own release tag, recorded in this entry's generation receipt. Mirrored by scripts/generate-aicr-from-overlay.mjs from the pinned AICR CLI release.",
    names: [`${overlay.name} entry`, `AICR ${overlay.name} mirror`],
  };
  const block = [
    `    - id: ${entry.id}`,
    `      page: ${entry.page}`,
    `      retainedVersion: ${entry.retainedVersion}`,
    "      versionSource: >-",
    ...wrapProse(entry.versionSource, 8),
    "      names:",
    ...entry.names.map((name) => `        - ${name}`),
    "",
  ].join("\n");

  const anchor = "  # Pages that discuss the entries in general rather than any one of them.";
  check(text.includes(anchor), `${relativeRepo(ENTRY_NAMES_PATH)}: expected anchor comment is missing; the file shape changed`);
  write(ENTRY_NAMES_PATH, text.replace(anchor, `${block}\n${anchor}`));
  return entry;
}

function updateNumericClaims({ entryId, generated }) {
  const text = readFileSync(NUMERIC_CLAIMS_PATH, "utf8");
  const marker = `    - id: ${entryId}-applications\n`;
  if (text.includes(marker)) return;

  const applicationsPhrase = `${generated.renderedApplications} Applications`;
  const componentsPhrase = `${generated.componentCount} components`;
  const overlaysPhrase = `${numberWord(generated.overlaysResolved)} overlays`;

  const quantityBlock = [
    `    - id: ${entryId}-applications`,
    `      description: The Argo CD Applications the ${entryId} entry renders.`,
    `      compute: { kind: files, dir: examples/aicr/${entryId}/argocd-rendered/templates, suffix: .yaml }`,
    `    - id: ${entryId}-components`,
    `      description: The components the retained ${entryId} recipe declares an order for.`,
    `      compute: { kind: listLength, file: examples/aicr/${entryId}/recipe.yaml, path: deploymentOrder }`,
    `    - id: ${entryId}-overlays`,
    `      description: The overlays AICR resolved to produce the ${entryId} recipe.`,
    `      compute: { kind: number, file: examples/aicr/${entryId}/generation-receipt.yaml, path: spec.result.overlaysResolved }`,
  ].join("\n");

  const claimsAnchor = "  claims:\n";
  check(text.includes(claimsAnchor), `${relativeRepo(NUMERIC_CLAIMS_PATH)}: expected "claims:" key is missing; the file shape changed`);
  let updated = text.replace(claimsAnchor, `${quantityBlock}\n\n${claimsAnchor}`);

  const claimBlock = [
    "",
    `    - id: ${entryId}-renders-applications`,
    `      quantity: ${entryId}-applications`,
    `      page: ${entryId}.md`,
    `      phrases: ["${applicationsPhrase}"]`,
    `    - id: ${entryId}-declares-components`,
    `      quantity: ${entryId}-components`,
    `      page: ${entryId}.md`,
    `      phrases: ["${componentsPhrase}"]`,
    `    - id: ${entryId}-resolves-overlays`,
    `      quantity: ${entryId}-overlays`,
    `      page: ${entryId}.md`,
    `      phrases: ["${overlaysPhrase}"]`,
  ].join("\n");
  check(updated.endsWith("\n"), `${relativeRepo(NUMERIC_CLAIMS_PATH)}: expected the file to end with a newline`);
  updated = `${updated.slice(0, -1)}${claimBlock}\n`;
  write(NUMERIC_CLAIMS_PATH, updated);
}

function numberWord(value) {
  return NUMBER_WORDS[value] ?? String(value);
}

function wrapProse(text, indent, width = 78) {
  const pad = " ".repeat(indent);
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && (`${line} ${word}`).length > width) {
      lines.push(`${pad}${line}`);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(`${pad}${line}`);
  return lines;
}

// ---------------------------------------------------------------------------
// Step 6: the entry's page
// ---------------------------------------------------------------------------

function writeDocsPage({ entryId, overlay, generated, registerEntry }) {
  const pagePath = join(repoRoot, "docs", "demo", "aicr", `${entryId}.md`);
  if (existsSync(pagePath)) return; // idempotent: never overwrite a page a reviewer may have edited by hand.

  const criteriaLine = generated.recipeArgs
    .slice(1)
    .reduce((parts, token, index, all) => {
      if (index % 2 === 0 && token.startsWith("--") && token !== "--output") parts.push(`${token} ${all[index + 1]}`);
      return parts;
    }, [])
    .join(" ");
  const commandLines = [
    `aicr ${generated.recipeArgs.filter((token) => token !== generated.recipePath && token !== "--output").join(" ")} --output recipe.yaml`,
    "aicr bundle --recipe recipe.yaml --deployer argocd-helm --output ./argocd-helm-bundle \\",
    `  --storage-class gp3 --accelerated-node-selector nvidia.com/gpu.present=true${generated.workloadSelector ? ` \\\n  --workload-selector ${generated.workloadSelector}` : ""}`,
    `helm template aicr-argocd ./argocd-helm-bundle --namespace argocd \\`,
    `  --set repoURL=${PLANNED_OCI_BASE} --output-dir rendered`,
  ];

  const page = `# The ${overlay.name} overlay, mirrored as a catalog entry

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It was produced by
\`scripts/generate-aicr-from-overlay.mjs ${overlay.name}\`, the generator built
to mirror any overlay from NVIDIA's AICR recipe catalog into a first-class
entry at the same bar as this catalog's other entries: source pinned by
digest, render checked, one digest over the whole rendered shape.

## What it is

Criteria \`${criteriaLine}\` resolves ${numberWord(generated.overlaysResolved)} overlays into ${generated.componentCount} components,
and the Argo CD bundle renders into ${generated.renderedApplications} Applications (one platform root plus one
Application per rendered component, and some components render more than one
Application for their own pre- or post-install step).

\`\`\`bash
${commandLines.join("\n")}
\`\`\`

The [generation receipt](../../../examples/aicr/${entryId}/generation-receipt.yaml)
records the exact commands, the criteria, and the release binary this entry
was built with: AICR ${AICR_RELEASE.version}, verified against the checksum published
in that release before it ran.

## One digest pins this entry too

\`\`\`bash
node scripts/generate-aicr-digest-index.mjs --verify --example ${entryId}
\`\`\`

The [digest index](../../../examples/aicr/${entryId}/digest-index/README.md)
pins the upstream source, the recipe criteria, and all ${generated.renderedApplications} Applications
under one platform digest. The compiler is a generic one shared by every
entry in this catalog, not something built new for this one.

## What is proven and what is not

Proven: the entry was generated by a binary verified against a checksum
pinned before it ran, the recipe and every rendered Application are retained
byte for byte, and one digest pins the shape.

Not proven, and stated rather than implied: this entry was never published,
so it carries no public digest and no OCI transport receipts, and the
repository reference in its Applications is what a publication would use
rather than a record that one happened. No ConfigHub import or promotion
exists for it, no cluster ever ran it, and no NGC surface was contacted.
`;
  write(pagePath, page);
}

function updateDocMap({ entryId, generated }) {
  const text = readFileSync(DOC_MAP_PATH, "utf8");
  const target = `./demo/aicr/${entryId}.md`;
  if (text.includes(target)) return;

  const anchor = "| [AICR-native NIM inference example](./demo/aicr/eks-h100-inference-nim.md)";
  const anchorLineEnd = text.indexOf("\n", text.indexOf(anchor));
  check(anchorLineEnd !== -1, `${relativeRepo(DOC_MAP_PATH)}: expected AICR worked-examples row is missing; the file shape changed`);
  const row = `| [AICR ${entryId} example](./demo/aicr/${entryId}.md) | Mirrored from NVIDIA AICR's recipe catalog: ${generated.componentCount} components resolved into ${generated.renderedApplications} rendered Argo CD Applications, retained and digest-pinned, generated by \`scripts/generate-aicr-from-overlay.mjs\`. |`;
  write(DOC_MAP_PATH, `${text.slice(0, anchorLineEnd + 1)}${row}\n${text.slice(anchorLineEnd + 1)}`);
}

main();
