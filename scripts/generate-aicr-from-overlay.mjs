#!/usr/bin/env node

// Mirror overlays from NVIDIA's AICR recipe catalog into Catalog entries under
// examples/aicr/<id>/. One pinned AICR release backs every mirrored entry, so
// moving the pin replaces the whole mirror in place.
//
// Usage:
//   node scripts/generate-aicr-from-overlay.mjs <overlay-name> [--id <id>]
//   node scripts/generate-aicr-from-overlay.mjs --all
//   Either form takes --binary <path>, or AICR_MIRROR_BINARY=<path>, to use an
//   AICR binary already on disk. The binary is checked against the pinned
//   SHA-256 before it runs, wherever it came from.
//
// <overlay-name> is a name from `aicr recipe list`. --id lets the entry
// directory and register id differ from the overlay name. --all mirrors every
// overlay in the list, removes a mirrored directory whose overlay is gone or
// can no longer be generated, rewrites the registers, the pages and the doc
// map rows for the mirror, and writes data/aicr-overlay-mirror/.
//
// What one entry goes through, in order:
//   1. A verified AICR binary. Nothing runs an unverified binary.
//   2. `aicr recipe --criteria-strict` with the overlay's own criteria.
//   3. `aicr bundle --deployer argocd-helm`. AICR v1.0.0 refuses a bundle that
//      lacks an input it needs, and says which. Two refusals are answered
//      here, each with a value that is recorded with the refusal that asked
//      for it. A missing system node selector takes the placeholder
//      nodeGroup=system-worker. A wildcard toleration that AKS cannot accept
//      takes the keyed toleration AICR's own message names. Any other refusal
//      stops the entry.
//   4. `helm template` of the bundle, against the entry's own planned source
//      package reference.
//   5. examples/aicr/<id>/ is replaced with the recipe, the generation
//      receipt, the retained bundle with a checksum of every file in it, the
//      rendered Applications, and the digest index compiled by
//      scripts/generate-aicr-digest-index.mjs.
//   6. The entry's blocks in examples/aicr/claims/entry-names.yaml and
//      numeric-claims.yaml, its row in docs/README.md, and its page under
//      docs/demo/aicr/.
//
// An entry directory says what was generated and retained. It does not say
// whether the entry's two OCI artifacts are published. That state is read
// from tracked receipts by scripts/lib/aicr-mirror-artifacts.mjs, so a
// publication never needs this generator or the AICR binary to run again.
//
// Boundary, stated once and carried into every generated entry: config-plane
// only. No cluster, no GPU workload, no registry and no NGC surface is
// contacted by this script or by anything it generates. The one network use
// this script can make is the pinned release download in step 1, and only
// when no verified binary is given or cached.
//
// Whether the AICR commands themselves use the network was not observed for
// v0.21.0. It was observed for v1.0.0, and NETWORK_OBSERVATION below records
// what was seen. To repeat it on macOS, run this script under
// `sandbox-exec -f <profile>` with a profile of `(version 1)`,
// `(allow default)` and `(deny network*)`, and pass --binary.

import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { arch as osArch, homedir, platform as osPlatform, tmpdir } from "node:os";
import { join, relative } from "node:path";

import {
  INPUT_PLACEHOLDER,
  PLACEHOLDER_CONTAINER,
  landingCounts,
  placeholderLandings,
} from "./lib/aicr-required-inputs.mjs";
import {
  check,
  listFiles,
  normalizeTempPaths,
  readYaml,
  readYamlTexts,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

// ---------------------------------------------------------------------------
// Pinned upstream release provenance. One CLI release backs every entry this
// generator produces; bumping it is a deliberate, separate decision, not a
// side effect of mirroring one more overlay.
// ---------------------------------------------------------------------------
const AICR_RELEASE = {
  name: "NVIDIA AICR",
  version: "v1.0.0",
  commit: "82bccef69855c70e151f8b5e6ed9d04d70a30f81",
  repository: "https://github.com/NVIDIA/aicr",
};

// Where this repository already holds the release's signatures and the
// receipt of their offline verification. The generator reads the receipt and
// refuses to run when it names another binary than the pin below.
const AICR_PROVENANCE = {
  receipt: "runs/aicr-provenance-v1-0-0/receipt.yaml",
  checksumList: "examples/aicr/upstream-signatures/v1.0.0/aicr_checksums.txt",
  binaryAttestation: "examples/aicr/upstream-signatures/v1.0.0/aicr-attestation.sigstore.json",
  recipeCatalogSignature: "examples/aicr/upstream-signatures/v1.0.0/recipe-catalog.sigstore.json",
};

// One row per `${os.platform()}-${os.arch()}` this generator has actually
// verified. Extend it by recording the matching release asset's sha256 (from
// the release's aicr_checksums.txt) and the sha256 of the "aicr" binary it
// extracts to. The generator refuses to run on an unpinned platform rather
// than trust an unverified download.
const PLATFORM_PINS = {
  "darwin-arm64": {
    assetName: "aicr_1.0.0_darwin_arm64.tar.gz",
    assetSha256: "cb85cce54a82deb88e826c3e735c26e11a0863173b8aa5ff3ba4ebc2dc6af8b2",
    binarySha256: "972da08e016b3ea779cc5f51eafa3a0024a4f052fbdfbc5ea55cd6524766b8fc",
  },
};

// What was seen when the pinned release was run with the network denied. It is
// a dated observation of one platform, and it is written into the mirror's
// summary so the claim travels with the data.
const NETWORK_OBSERVATION =
  "On 2026-10-08, on darwin-arm64, the whole mirror was generated three times with all network access denied to the generator, the AICR binary and Helm. `aicr recipe list`, `aicr recipe`, `aicr bundle --deployer argocd-helm` and `helm template` completed for every mirrored overlay, and the runs produced the same bytes. No AICR command needed the network. Other platforms and other AICR commands were not observed.";

const PLANNED_OCI_BASE = "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt";
const BUNDLE_CHART_NAME = "aicr-bundle";
const BUNDLE_DIR = "argocd-helm-bundle";
const BUNDLE_INVENTORY = "argocd-helm-bundle-checksums.txt";
const ENTRY_NAMES_PATH = join(repoRoot, "examples/aicr/claims/entry-names.yaml");
const NUMERIC_CLAIMS_PATH = join(repoRoot, "examples/aicr/claims/numeric-claims.yaml");
const DOC_MAP_PATH = join(repoRoot, "docs/README.md");
const MIRROR_DATA_ROOT = "data/aicr-overlay-mirror";
const MIRROR_ARTIFACT_RECEIPT_ROOT = "runs/aicr-mirror-artifacts";
const GENERATOR = "scripts/generate-aicr-from-overlay.mjs";

// The system node selector every mirrored bundle carries when AICR asks for
// one. It is a placeholder, confirmed as one, and each entry records every
// place it lands. The wording follows the hand-retained v1.0.0 entry.
const SYSTEM_NODE_SELECTOR = {
  input: "systemNodeSelector",
  flag: "--system-node-selector",
  value: "nodeGroup=system-worker",
  // The maintainer confirmed the placeholder on 2026-10-07. The hand-retained
  // v1.0.0 entry records the same date. The later choice to carry it in every
  // mirrored entry is dated inside the confirmation text, not here.
  confirmedOn: "2026-10-07",
  route: "system-node-selector-placeholder",
  refusal: /requires --system-node-selector to be set/,
};

// AKS admission rejects the wildcard toleration AICR writes by default, and
// AICR's refusal names the keyed toleration to pass instead. The v0.21.0
// mirror carried the same value for the same overlays.
const KEYED_TOLERATION = {
  input: "acceleratedNodeToleration",
  flag: "--accelerated-node-toleration",
  value: "nvidia.com/gpu:NoSchedule",
  refusal: /Pass keyed tolerations instead, e\.g\. --accelerated-node-toleration nvidia\.com\/gpu:NoSchedule/,
};

// A recipe refusal that names an input only a real cluster can supply. The
// overlay is left out of the mirror and the refusal is recorded. Nothing here
// invents a value for it.
const CLUSTER_SPECIFIC_RECIPE_REFUSALS = [
  {
    pattern: /requires configuration\.gke\.tcpxoInterfaces/,
    reason:
      "AICR v1.0.0 refuses to generate this recipe without --gke-tcpxo-interfaces, the mapping of eight GPU network interfaces to the destination cluster's own network names. AICR documents that mapping as cluster-specific and fails closed without it. No value has been confirmed for this Catalog, so the overlay is not mirrored at this version.",
  },
];

const RECIPE_API_VERSIONS = ["aicr.run/v1", "aicr.run/v1beta2"];

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty",
];

function usage() {
  console.error(`Usage:
  node scripts/generate-aicr-from-overlay.mjs <overlay-name> [--id <id>] [--binary <path>]
  node scripts/generate-aicr-from-overlay.mjs --all [--binary <path>]
  node scripts/generate-aicr-from-overlay.mjs --redate-placeholder-confirmation

<overlay-name> must be a name from \`aicr recipe list\`. --id overrides the
entry id (directory name and register id); it defaults to <overlay-name>.
--all mirrors every overlay and removes mirrored directories that no longer
have one. --binary, or AICR_MIRROR_BINARY, names an AICR binary already on
disk. It is checked against the pinned SHA-256 before it runs.
--redate-placeholder-confirmation runs no AICR command and needs no binary. It
rewrites only the confirmedOn line of the system-node-selector placeholder in
each mirrored entry's generation receipt, to the date in SYSTEM_NODE_SELECTOR.`);
}

// One-off, non-rendering correction. The first v1.0.0 mirror recorded the
// placeholder's confirmation as 2026-10-08, the day it was chosen for every
// entry, while the maintainer confirmed it on 2026-10-07. Moving the constant
// changes what a full run writes. This mode brings the retained receipts to the
// same date without running AICR or Helm, so the bundles and Applications keep
// their bytes. It touches the one line, and refuses a receipt where that line
// is not exactly one match. Rerun the digest index and mirror artifacts
// generators afterwards, because both read the receipt.
function redatePlaceholderConfirmation() {
  const wanted = SYSTEM_NODE_SELECTOR.confirmedOn;
  let rewritten = 0;
  let unchanged = 0;
  for (const id of mirroredDirectories()) {
    const path = join(repoRoot, "examples", "aicr", id, "generation-receipt.yaml");
    const text = readFileSync(path, "utf8");
    const pattern = /^(\s*)confirmedOn: "(\d{4}-\d{2}-\d{2})"$/gm;
    const matches = [...text.matchAll(pattern)];
    if (!text.includes('valueStatus: "confirmed-placeholder"')) {
      check(matches.length === 0, `${relativeRepo(path)} has a confirmedOn line but no confirmed placeholder`);
      continue;
    }
    check(matches.length === 1, `${relativeRepo(path)} must have exactly one confirmedOn line, found ${matches.length}`);
    if (matches[0][2] === wanted) {
      unchanged += 1;
      continue;
    }
    write(path, text.replace(pattern, `$1confirmedOn: "${wanted}"`));
    rewritten += 1;
  }
  console.log(`placeholder confirmation is ${wanted}: ${rewritten} receipts rewritten, ${unchanged} already carried it`);
}

function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) return "";
  check(index + 1 < argv.length, `${flag} needs a value`);
  return argv[index + 1];
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--redate-placeholder-confirmation")) {
    redatePlaceholderConfirmation();
    return;
  }
  const all = argv.includes("--all");
  const overlayName = all ? "" : argv[0];
  if (!all && (!overlayName || overlayName.startsWith("--"))) {
    usage();
    process.exit(2);
  }
  const binary = ensureVerifiedBinary(flagValue(argv, "--binary") || process.env.AICR_MIRROR_BINARY || "");
  const listing = JSON.parse(execFileSync(binary.path, ["recipe", "list", "--format", "json"], { encoding: "utf8" }));
  const toolchain = { helm: execFileSync("helm", ["version", "--short"], { encoding: "utf8" }).trim() };

  if (all) {
    mirrorAll({ binary, listing, toolchain });
    return;
  }
  const entryId = flagValue(argv, "--id") || overlayName;
  check(/^[a-z0-9][a-z0-9-]*$/.test(entryId), `entry id ${JSON.stringify(entryId)} must be lowercase kebab-case`);
  const overlay = listing.find((row) => row.name === overlayName);
  check(
    overlay,
    `${overlayName} is not a name in \`aicr recipe list\`; run it yourself to see the ${listing.length} available overlay names`,
  );
  const outcome = mirrorOverlay({ binary, overlay, entryId, toolchain });
  check(outcome.mirrored, `${overlayName} was not mirrored: ${outcome.reason} ${outcome.observed}`);
  writeRegistersAndPages([outcome.generated], { replaceIds: [entryId] });
  console.log(describe(outcome.generated));
}

function describe(generated) {
  return `generated examples/aicr/${generated.entryId}: ${generated.componentCount} components from ${generated.overlaysResolved} overlays -> ${generated.renderedApplications} rendered Applications, ${generated.bundleFiles.length} bundle files retained`;
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

function ensureVerifiedBinary(givenPath) {
  const key = platformKey();
  const pin = key ? PLATFORM_PINS[key] : undefined;
  check(
    pin,
    `no pinned AICR ${AICR_RELEASE.version} release checksum for platform ${key ?? `${osPlatform()}-${osArch()}`}; ` +
      "add one to PLATFORM_PINS in this script (record the matching release asset's sha256 " +
      "from the release's aicr_checksums.txt, and the sha256 of the extracted binary) before running it here",
  );
  assertPinMatchesCommittedProvenance(pin);

  if (givenPath) {
    check(existsSync(givenPath), `${givenPath} does not exist`);
    const given = sha256File(givenPath);
    check(
      given === pin.binarySha256,
      `the binary at ${givenPath} has sha256 ${given}, expected ${pin.binarySha256}; refusing to run it`,
    );
    return provenanceFor(pin, givenPath);
  }

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

// The pin is only as good as what it was copied from. The repository holds
// NVIDIA's checksum list for this release and the receipt of an offline
// attestation check, and both have to name the pinned bytes.
function assertPinMatchesCommittedProvenance(pin) {
  const checksumList = readFileSync(join(repoRoot, AICR_PROVENANCE.checksumList), "utf8");
  check(
    checksumList.split("\n").some((line) => line.trim() === `${pin.assetSha256}  ${pin.assetName}`),
    `${AICR_PROVENANCE.checksumList} does not list ${pin.assetName} with sha256 ${pin.assetSha256}`,
  );
  const provenance = readYaml(join(repoRoot, AICR_PROVENANCE.receipt));
  check(
    provenance.status?.result === "pass"
      && provenance.spec?.upstream?.version === AICR_RELEASE.version
      && provenance.spec?.upstream?.commit === AICR_RELEASE.commit,
    `${AICR_PROVENANCE.receipt} is not a passing provenance receipt for ${AICR_RELEASE.version} at ${AICR_RELEASE.commit}`,
  );
  if (provenance.spec.upstream.archive === pin.assetName) {
    check(
      provenance.spec.upstream.archiveSha256 === pin.assetSha256
        && provenance.spec.binary?.attestedSha256 === pin.binarySha256,
      `${AICR_PROVENANCE.receipt} names another archive or binary than the pin for ${pin.assetName}`,
    );
  }
}

// The receipt records what was verified, not how this run found the binary.
// A cached copy, a fresh download and a copy named with --binary are all held
// to the same pinned SHA-256, and two equally valid generations of one overlay
// must agree in every committed byte.
function provenanceFor(pin, binaryPath) {
  const binaryVerifiedBeforeUse =
    `The binary was checked against the sha256 pinned in ${GENERATOR} before it ran. The pin is the binary NVIDIA's ${AICR_RELEASE.version} attestation names, and ${AICR_PROVENANCE.receipt} records the offline check of that attestation and of the release archive checksum.`;
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
      provenance: { ...AICR_PROVENANCE },
    },
  };
}

// ---------------------------------------------------------------------------
// Steps 2 to 4: recipe, bundle, render
// ---------------------------------------------------------------------------

function runAicr(binaryPath, args, cwd) {
  const result = spawnSync(binaryPath, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

// The one line AICR prints when it refuses, without the log prefix and the
// exit code, so the recorded text is the refusal itself.
function refusalText(result) {
  const line = `${result.stderr}\n${result.stdout}`.split("\n").find((row) => row.includes("command failed: error="));
  return normalizeTempPaths(
    String(line ?? `${result.stderr}${result.stdout}`.trim().split("\n").at(-1) ?? "")
      .replace(/^.*command failed: error=/, "")
      .replace(/\s+exitCode=\d+\s*$/, "")
      .trim(),
  );
}

function criteriaFlags(criteria) {
  const flags = [];
  for (const [flag, key] of [["--service", "service"], ["--accelerator", "accelerator"], ["--os", "os"], ["--intent", "intent"], ["--platform", "platform"]]) {
    const value = criteria[key];
    if (value && value !== "any") flags.push(flag, String(value));
  }
  return flags;
}

function runPipeline(binaryPath, overlay, entryId, work) {
  const criteria = overlay.criteria ?? {};
  const flags = criteriaFlags(criteria);
  if (flags.length === 0) {
    return {
      mirrored: false,
      stage: "recipe",
      reason: "The overlay declares no criterion that selects it, so `aicr recipe` cannot be asked for it by criteria. It reaches the mirror only through the entries that apply it.",
      observed: "",
    };
  }
  const recipeArgs = ["recipe", "--criteria-strict", ...flags, "--output", "recipe.yaml"];
  const recipeRun = runAicr(binaryPath, recipeArgs, work);
  if (recipeRun.status !== 0) {
    const observed = refusalText(recipeRun);
    const known = CLUSTER_SPECIFIC_RECIPE_REFUSALS.find((row) => row.pattern.test(observed));
    check(known, `${overlay.name}: aicr recipe refused with an error this generator does not know: ${observed}`);
    return { mirrored: false, stage: "recipe", reason: known.reason, observed };
  }
  const recipePath = join(work, "recipe.yaml");
  const recipe = readYaml(recipePath);
  // AICR v1.0.0 writes aicr.run/v1 for most recipes and aicr.run/v1beta2 for
  // the ones that use a feature it still calls beta, such as a profile. Both
  // are recorded. Anything else means the release changed under the pin.
  check(
    RECIPE_API_VERSIONS.includes(recipe.apiVersion),
    `${overlay.name}: the recipe apiVersion is ${recipe.apiVersion}, not one of ${RECIPE_API_VERSIONS.join(", ")}`,
  );
  check(Array.isArray(recipe.deploymentOrder) && recipe.deploymentOrder.length > 0, `${overlay.name}: recipe declares no deployment order`);
  check(
    recipe.metadata?.appliedOverlays?.at(-1) === overlay.name,
    `${overlay.name}: the criteria selected ${recipe.metadata?.appliedOverlays?.at(-1)}, which is another overlay`,
  );

  // nodewright-customizations needs a workload selector when it is present at
  // all; the catalog's existing entries set it for both training and
  // inference intents.
  const workloadSelector = ["training", "inference"].includes(criteria.intent)
    ? `app.kubernetes.io/part-of=${criteria.intent}`
    : null;
  const baseArgs = [
    "bundle",
    "--recipe",
    "recipe.yaml",
    "--deployer",
    "argocd-helm",
    "--output",
    `./${BUNDLE_DIR}`,
    "--storage-class",
    "gp3",
    "--accelerated-node-selector",
    "nvidia.com/gpu.present=true",
    ...(workloadSelector ? ["--workload-selector", workloadSelector] : []),
  ];
  // Ask with the defaults first, and answer only a refusal AICR itself makes.
  // Each answer is recorded with the refusal, so the receipt shows why the
  // entry carries the input.
  const bundleDir = join(work, BUNDLE_DIR);
  const answers = [];
  let bundleArgs = baseArgs;
  let bundleRun = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    rmSync(bundleDir, { recursive: true, force: true });
    bundleRun = runAicr(binaryPath, bundleArgs, work);
    if (bundleRun.status === 0) break;
    const observed = refusalText(bundleRun);
    const answer = [SYSTEM_NODE_SELECTOR, KEYED_TOLERATION].find(
      (candidate) => candidate.refusal.test(observed) && !answers.some((given) => given.input === candidate.input),
    );
    check(answer, `${overlay.name}: aicr bundle refused with an error this generator does not answer: ${observed}`);
    answers.push({ input: answer.input, flag: answer.flag, value: answer.value, observed });
    bundleArgs = [...bundleArgs, answer.flag, answer.value];
  }
  check(bundleRun.status === 0, `${overlay.name}: aicr bundle still refuses after ${answers.length} answered refusals`);

  const repoURL = `${PLANNED_OCI_BASE}/aicr-${entryId}`;
  const renderDir = join(work, "rendered");
  const renderArgs = ["template", "aicr-argocd", `./${BUNDLE_DIR}`, "--namespace", "argocd", "--set", `repoURL=${repoURL}`, "--output-dir", "rendered"];
  try {
    execFileSync("helm", renderArgs, { cwd: work, stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    throw new Error(`${overlay.name}: helm template failed; is helm installed and on PATH? (${error.message})`);
  }
  const templatesDir = findTemplatesDir(renderDir);
  const templateFiles = readdirSync(templatesDir).filter((name) => name.endsWith(".yaml")).sort();
  check(templateFiles.length > 0, `${overlay.name}: helm template produced no rendered Application templates`);

  const bundleFiles = listFiles(bundleDir).map((path) => relative(bundleDir, path).replaceAll("\\", "/")).sort();
  const bundledRecipe = readYaml(join(bundleDir, "recipe.yaml"));
  const bundleInfo = readYaml(join(bundleDir, "bundle-info.yaml"));
  const chart = readYaml(join(bundleDir, "Chart.yaml"));
  check(
    chart.name === BUNDLE_CHART_NAME && `v${chart.version}` === AICR_RELEASE.version,
    `${overlay.name}: the bundle chart is ${chart.name} ${chart.version}, not ${BUNDLE_CHART_NAME} ${AICR_RELEASE.version.slice(1)}`,
  );
  const bundledRecipeDigest = `sha256:${sha256File(join(bundleDir, "recipe.yaml"))}`;
  check(
    bundleInfo.build?.recipe?.digest === bundledRecipeDigest,
    `${overlay.name}: bundle-info.yaml records another recipe digest than the recipe the bundle carries`,
  );

  // A component the selected recipe names and the bundle leaves out, with the
  // reason AICR logged for it.
  const selectedNames = (recipe.componentRefs ?? []).map((component) => component.name);
  const bundledNames = new Set((bundledRecipe.componentRefs ?? []).map((component) => component.name));
  const loggedReasons = new Map();
  for (const line of bundleRun.stderr.split("\n")) {
    const disabled = /skipping disabled component: component=(\S+)/.exec(line);
    if (disabled) loggedReasons.set(disabled[1], "AICR logged this component as disabled in the recipe and skipped it.");
    const skipped = /skipping component: component=(\S+) reason=(.+)$/.exec(line);
    if (skipped) loggedReasons.set(skipped[1], `AICR skipped it and logged the reason: ${normalizeTempPaths(skipped[2].trim())}`);
  }
  const leftOut = selectedNames
    .filter((name) => !bundledNames.has(name))
    .sort()
    .map((name) => ({ name, reason: loggedReasons.get(name) ?? "AICR left it out of the bundle and logged no reason." }));
  const notes = bundleRun.stdout
    .split("\n")
    .map((line) => /^\s*⚠\s*(.+)$/.exec(line)?.[1])
    .filter(Boolean)
    .map((line) => normalizeTempPaths(line.trim()));

  return {
    mirrored: true,
    generated: {
      entryId,
      overlay,
      criteria,
      work,
      recipe,
      bundledRecipe,
      recipeArgs,
      bundleArgs,
      renderArgs,
      repoURL,
      answers,
      workloadSelector,
      templatesDir,
      templateFiles,
      bundleDir,
      bundleFiles,
      bundledRecipeDigest,
      selectedRecipeDigest: `sha256:${sha256File(recipePath)}`,
      leftOut,
      notes,
      componentCount: recipe.deploymentOrder.length,
      bundledComponentCount: bundledNames.size,
      overlaysResolved: (recipe.metadata?.appliedOverlays ?? []).length,
      renderedApplications: templateFiles.length,
    },
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
// Step 5: write the entry directory and compile its digest index
// ---------------------------------------------------------------------------

function systemNodeSelectorInput(generated, answer, applications) {
  const entryRel = `examples/aicr/${generated.entryId}`;
  const landings = placeholderLandings(applications, answer.value);
  const counts = landingCounts(landings);
  check(counts.fieldPaths > 0, `${entryRel}: the placeholder ${answer.value} lands in no rendered Application`);
  const token = answer.value.split("=")[1];
  const bundleFiles = generated.bundleFiles
    .filter((file) => readFileSync(join(generated.bundleDir, file), "utf8").includes(token))
    .map((file) => `${BUNDLE_DIR}/${file}`);
  return {
    input: answer.input,
    flag: answer.flag,
    value: answer.value,
    valueStatus: INPUT_PLACEHOLDER,
    confirmedOn: SYSTEM_NODE_SELECTOR.confirmedOn,
    confirmation:
      "The maintainer confirmed on 2026-10-07 that the hand-retained v1.0.0 entry carries nodeGroup=system-worker as a placeholder, and chose on 2026-10-08 that every mirrored v1.0.0 entry whose bundle needs a system node selector carries the same placeholder. The entry does not claim that any destination labels its system nodes this way. The value is recorded, named and given a route, and it is resolved for the destination like any other install-time requirement.",
    observed: `With --storage-class gp3 and no system node selector, AICR ${AICR_RELEASE.version} refuses to write this bundle. Its refusal reads: ${answer.observed}`,
    valueOrigin:
      "It is the value upstream's own v1.0.0 EKS training demo uses for its reference clusters (demos/cuj1-training.md in NVIDIA/aicr at tag v1.0.0), and that demo says its selector values are examples to be updated to match the cluster. The demo file is not retained in this repository. The value was not chosen from a real cluster, and it is carried for every service this mirror covers because it is a placeholder and not a claim about any of them.",
    effect:
      "The value is written into the generated system-component node selectors, so a different value changes the bundle bytes and every digest derived from them.",
    placeholder: {
      meaning: `${answer.value} stands in for the label that selects the destination cluster's system node group.`,
      changeTo: "the label on your own cluster's system node group",
      changeEffect:
        "A different value changes the bundle bytes and every digest in this entry, so the entry must be regenerated with the new value or a variant must be made from it.",
      route: SYSTEM_NODE_SELECTOR.route,
      renderedIn: `${entryRel}/argocd-rendered/templates`,
      container: PLACEHOLDER_CONTAINER,
      applications: counts.applications,
      fieldPaths: counts.fieldPaths,
      appearsIn: landings,
      bundleFiles,
    },
  };
}

function writeEntry({ binary, generated, toolchain }) {
  const { entryId, overlay } = generated;
  const entryRel = `examples/aicr/${entryId}`;
  const entryRoot = join(repoRoot, entryRel);
  // This directory is owned exclusively by this entry id, so a full rewrite
  // on every run is idempotent rather than destructive.
  if (existsSync(entryRoot)) rmSync(entryRoot, { recursive: true });

  const checksumRows = [];
  const templateTexts = [];
  for (const file of generated.templateFiles) {
    const bytes = readFileSync(join(generated.templatesDir, file));
    write(join(entryRoot, "argocd-rendered", "templates", file), bytes);
    checksumRows.push(`${sha256(bytes)}  templates/${file}`);
    templateTexts.push(bytes.toString("utf8"));
  }
  const applications = readYamlTexts(templateTexts);
  applications.forEach((doc, index) => {
    check(
      doc && !Array.isArray(doc) && doc.kind === "Application",
      `${entryRel}/argocd-rendered/templates/${generated.templateFiles[index]}: expected exactly one Argo CD Application`,
    );
  });
  write(join(entryRoot, "argocd-rendered", "checksums.txt"), `${checksumRows.sort().join("\n")}\n`);
  write(join(entryRoot, "recipe.yaml"), readFileSync(join(generated.work, "recipe.yaml")));

  // The bundle is retained byte for byte, and every file in it is listed with
  // its SHA-256, so the source package can be rebuilt and checked later
  // without the AICR binary.
  const inventoryRows = [];
  for (const file of generated.bundleFiles) {
    const bytes = readFileSync(join(generated.bundleDir, file));
    write(join(entryRoot, BUNDLE_DIR, file), bytes);
    inventoryRows.push(`${sha256(bytes)}  ${file}`);
  }
  const inventoryText = `${inventoryRows.join("\n")}\n`;
  write(join(entryRoot, BUNDLE_INVENTORY), inventoryText);

  const selectorAnswer = generated.answers.find((answer) => answer.input === SYSTEM_NODE_SELECTOR.input);
  const tolerationAnswer = generated.answers.find((answer) => answer.input === KEYED_TOLERATION.input);
  const newRequiredInputs = selectorAnswer ? [systemNodeSelectorInput(generated, selectorAnswer, applications)] : [];
  const sourcePackageRepository = `${generated.repoURL}/${BUNDLE_CHART_NAME}`;
  const sourcePackageTag = AICR_RELEASE.version.slice(1);
  generated.newRequiredInputs = newRequiredInputs;

  const versionSlug = AICR_RELEASE.version.replace(/^v/, "").replaceAll(".", "-");
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceGenerationReceipt",
    metadata: { name: `aicr-${entryId}-v${versionSlug}` },
    spec: {
      purpose:
        `The ${overlay.name} overlay from NVIDIA AICR's recipe catalog, mirrored into a Catalog entry by ${GENERATOR} so it can be reviewed the same way a Helm variant is: pinned source, retained bundle, checked render, one digest.`,
      source: binary.source,
      overlay: { name: overlay.name, leaf: overlay.is_leaf === true },
      criteria: generated.recipe.criteria ?? {},
      generationInputs: {
        storageClass: "gp3",
        acceleratedNodeSelector: "nvidia.com/gpu.present=true",
        ...(generated.workloadSelector ? { workloadSelector: generated.workloadSelector } : {}),
        ...(selectorAnswer ? { [selectorAnswer.input]: selectorAnswer.value } : {}),
        ...(tolerationAnswer ? { [tolerationAnswer.input]: tolerationAnswer.value } : {}),
        repoURL: generated.repoURL,
      },
      ...(newRequiredInputs.length > 0 ? { newRequiredInputs } : {}),
      ...(tolerationAnswer
        ? {
            answeredRefusals: [
              {
                input: tolerationAnswer.input,
                flag: tolerationAnswer.flag,
                value: tolerationAnswer.value,
                observed: tolerationAnswer.observed,
                valueOrigin:
                  "The value is the keyed toleration AICR's own refusal names. It matches a GPU node taint of nvidia.com/gpu with effect NoSchedule, and a destination whose GPU nodes carry another taint needs another value.",
              },
            ],
          }
        : {}),
      // A generated record must be a function of the repository, not of the
      // machine that produced it. The commands are recorded with the relative
      // paths they ran with, inside a scratch directory that is not recorded.
      commands: {
        recipe: ["aicr", ...generated.recipeArgs],
        bundle: ["aicr", ...generated.bundleArgs],
        render: ["helm", ...generated.renderArgs],
      },
      toolchain,
      result: {
        recipeApiVersion: generated.recipe.apiVersion,
        componentCount: generated.componentCount,
        bundledComponentCount: generated.bundledComponentCount,
        componentsLeftOutOfBundle: generated.leftOut,
        overlaysResolved: generated.overlaysResolved,
        renderedApplications: generated.renderedApplications,
        argocdBundleFiles: generated.bundleFiles.length,
        recipeDigests: {
          selectedRecipe: generated.selectedRecipeDigest,
          bundledRecipe: generated.bundledRecipeDigest,
          note: "The bundled recipe is the selected recipe without the components the bundle leaves out. bundle-info.yaml records its digest, and the rendered sync-waves are compared with it.",
        },
        bundleNotes: generated.notes,
      },
      retained: {
        recipe: `${entryRel}/recipe.yaml`,
        sourceBundle: `${entryRel}/${BUNDLE_DIR}`,
        sourceBundleInventory: { path: `${entryRel}/${BUNDLE_INVENTORY}`, sha256: sha256(inventoryText), files: generated.bundleFiles.length },
        renderedApplications: `${entryRel}/argocd-rendered`,
      },
      plannedArtifacts: {
        sourcePackage: {
          role: "source-package",
          reference: `${sourcePackageRepository}:${sourcePackageTag}`,
          statement: "The rendered Applications name this reference. It is the address a publication of the retained bundle uses.",
        },
        publication:
          `This receipt records generation and retention. It does not say whether the source package or the literal configuration bundle of this entry is published. Each one counts as published only when a tracked receipt under ${MIRROR_ARTIFACT_RECEIPT_ROOT}/${entryId}/ records a push and an anonymous pull of the digest planned for it.`,
      },
      boundary: {
        configPlaneOnly: true,
        gpuWorkloadsProven: false,
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
        "This entry carries no OCI transport receipt of its own. The references below are the ones a publication uses, and the compiled index does not say whether one has happened.",
      publication: { recordedBy: `${MIRROR_ARTIFACT_RECEIPT_ROOT}/${entryId}` },
      plannedOCIBase: PLANNED_OCI_BASE,
      sourcePackageRepository,
      renderedApplications: generated.renderedApplications,
    },
  };
  writeYaml(join(entryRoot, "index-config.yaml"), indexConfig);
  execFileSync("node", ["scripts/generate-aicr-digest-index.mjs", "--generate", "--example", entryId], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "inherit"],
  });
  generated.sourcePackageReference = `${sourcePackageRepository}:${sourcePackageTag}`;
  return entryRoot;
}

function mirrorOverlay({ binary, overlay, entryId, toolchain }) {
  const work = mkdtempSync(join(tmpdir(), `aicr-mirror-${entryId}-`));
  try {
    const outcome = runPipeline(binary.path, overlay, entryId, work);
    if (!outcome.mirrored) return { ...outcome, overlay };
    writeEntry({ binary, generated: outcome.generated, toolchain });
    return { mirrored: true, overlay, generated: outcome.generated };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// --all: the whole mirror, replaced in place
// ---------------------------------------------------------------------------

// A directory belongs to the mirror when its receipt names this generator.
// Everything else under examples/aicr is retained by hand and is never touched.
function mirroredDirectories() {
  const examples = join(repoRoot, "examples", "aicr");
  return readdirSync(examples)
    .filter((name) => statSync(join(examples, name)).isDirectory())
    .filter((name) => {
      const receiptPath = join(examples, name, "generation-receipt.yaml");
      return existsSync(receiptPath) && readFileSync(receiptPath, "utf8").includes("generate-aicr-from-overlay.mjs");
    })
    .sort();
}

function mirrorAll({ binary, listing, toolchain }) {
  const before = mirroredDirectories();
  const overlays = [...listing].sort((left, right) => (left.name < right.name ? -1 : 1));
  const outcomes = [];
  for (const overlay of overlays) {
    const outcome = mirrorOverlay({ binary, overlay, entryId: overlay.name, toolchain });
    outcomes.push(outcome);
    console.log(outcome.mirrored ? describe(outcome.generated) : `not mirrored ${overlay.name}: ${outcome.observed || outcome.reason}`);
  }
  const mirrored = outcomes.filter((outcome) => outcome.mirrored).map((outcome) => outcome.generated);
  const mirroredIds = new Set(mirrored.map((generated) => generated.entryId));
  const removed = before.filter((id) => !mirroredIds.has(id));
  for (const id of removed) {
    rmSync(join(repoRoot, "examples", "aicr", id), { recursive: true, force: true });
    rmSync(join(repoRoot, "docs", "demo", "aicr", `${id}.md`), { force: true });
  }
  writeRegistersAndPages(mirrored, { replaceIds: [...new Set([...before, ...mirroredIds])] });
  writeMirrorInventory({ outcomes, listing });
  // What this run changed is a fact about the run, so it is printed and not
  // written to a committed file. A second run over the same pin changes nothing.
  const added = [...mirroredIds].filter((id) => !before.includes(id)).sort();
  console.log(
    `mirrored ${mirrored.length} of ${overlays.length} overlays at AICR ${AICR_RELEASE.version}; ${mirrored.length - added.length} directories kept their name, ${added.length} new (${added.join(", ") || "none"}), ${removed.length} removed (${removed.join(", ") || "none"})`,
  );
}

function writeMirrorInventory({ outcomes, listing }) {
  const rows = outcomes.map((outcome) => {
    const name = outcome.overlay.name;
    const generated = outcome.generated;
    return {
      overlay: name,
      leaf: outcome.overlay.is_leaf === true,
      mirrored: outcome.mirrored,
      entry: outcome.mirrored ? `examples/aicr/${generated.entryId}` : "",
      components: outcome.mirrored ? generated.componentCount : "",
      bundledComponents: outcome.mirrored ? generated.bundledComponentCount : "",
      applications: outcome.mirrored ? generated.renderedApplications : "",
      bundleFiles: outcome.mirrored ? generated.bundleFiles.length : "",
      systemNodeSelectorPlaceholder: outcome.mirrored ? generated.answers.some((answer) => answer.input === SYSTEM_NODE_SELECTOR.input) : "",
      keyedToleration: outcome.mirrored ? generated.answers.some((answer) => answer.input === KEYED_TOLERATION.input) : "",
      sourcePackage: outcome.mirrored ? generated.sourcePackageReference : "",
      notMirroredStage: outcome.mirrored ? "" : outcome.stage,
      notMirroredReason: outcome.mirrored ? "" : outcome.reason,
      observedRefusal: outcome.mirrored ? "" : outcome.observed,
    };
  });
  const header = Object.keys(rows[0]);
  const cell = (value) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  write(
    join(repoRoot, MIRROR_DATA_ROOT, "overlays.csv"),
    `${[header, ...rows.map((row) => header.map((key) => row[key]))].map((row) => row.map(cell).join(",")).join("\n")}\n`,
  );
  const mirrored = rows.filter((row) => row.mirrored);
  const notMirrored = rows.filter((row) => !row.mirrored);
  const placeholders = mirrored.filter((row) => row.systemNodeSelectorPlaceholder === true).length;
  const tolerations = mirrored.filter((row) => row.keyedToleration === true).length;
  write(
    join(repoRoot, MIRROR_DATA_ROOT, "summary.md"),
    [
      "# The AICR overlay mirror",
      "",
      "**UNOFFICIAL/EXPERIMENTAL**",
      "",
      `<!-- Generated by ${GENERATOR} --all. Do not edit by hand. -->`,
      "",
      `The mirror is generated from AICR ${AICR_RELEASE.version}, commit \`${AICR_RELEASE.commit}\`. \`aicr recipe list\` names ${listing.length} overlays at that release, and ${mirrored.length} of them are mirrored as Catalog entries under \`examples/aicr/\`. Each entry retains the recipe, the argocd-helm bundle with a checksum of every file, and the rendered Argo CD Applications.`,
      "",
      `${placeholders} entries carry the placeholder system node selector \`${SYSTEM_NODE_SELECTOR.value}\`, because AICR refuses their bundle without a system node selector. Each of those entries records the refusal and every place the placeholder lands. ${tolerations} entries carry the keyed toleration \`${KEYED_TOLERATION.value}\`, which AICR's own refusal names for AKS.`,
      "",
      "This page does not say whether any entry is published. [overlays.csv](./overlays.csv) lists every overlay with its counts and its planned source package reference.",
      "",
      NETWORK_OBSERVATION,
      "",
      "## Overlays that are not mirrored",
      "",
      ...(notMirrored.length === 0
        ? ["Every overlay is mirrored.", ""]
        : [
            "| Overlay | Stage | Why | What AICR said |",
            "| --- | --- | --- | --- |",
            ...notMirrored.map((row) => `| ${row.overlay} | ${row.notMirroredStage} | ${row.notMirroredReason} | ${row.observedRefusal ? `\`${row.observedRefusal.replaceAll("|", "\\|")}\`` : "nothing, because no command could be formed"} |`),
            "",
          ]),
    ].join("\n"),
  );
}

// ---------------------------------------------------------------------------
// Step 6: registers, the doc map and the pages
// ---------------------------------------------------------------------------

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function writeRegistersAndPages(mirrored, { replaceIds }) {
  const sorted = [...mirrored].sort((left, right) => (left.entryId < right.entryId ? -1 : 1));
  updateEntryNamesRegister(sorted, replaceIds);
  updateNumericClaims(sorted, replaceIds);
  updateDocMap(sorted, replaceIds);
  for (const generated of sorted) writeDocsPage(generated);
}

function updateEntryNamesRegister(mirrored, replaceIds) {
  let text = readFileSync(ENTRY_NAMES_PATH, "utf8");
  for (const id of replaceIds) {
    const block = new RegExp(
      `    - id: ${escapeRegExp(id)}\\n      page: docs/demo/aicr/${escapeRegExp(id)}\\.md\\n      retainedVersion: \\S+\\n      versionSource: >-\\n(?:        .*\\n)+      names:\\n(?:        - .*\\n)+\\n`,
    );
    text = text.replace(block, "");
  }
  const anchor = "  # Pages that discuss the entries in general rather than any one of them.";
  check(text.includes(anchor), `${relativeRepo(ENTRY_NAMES_PATH)}: expected anchor comment is missing; the file shape changed`);
  const versionSource =
    `AICR's own release tag, recorded in this entry's generation receipt. Mirrored by ${GENERATOR} from the pinned AICR CLI release.`;
  const blocks = mirrored.map((generated) => {
    check(
      !text.includes(`    - id: ${generated.entryId}\n`),
      `${relativeRepo(ENTRY_NAMES_PATH)}: ${generated.entryId} is registered by hand, so the mirror cannot take that id`,
    );
    return [
      `    - id: ${generated.entryId}`,
      `      page: docs/demo/aicr/${generated.entryId}.md`,
      `      retainedVersion: ${AICR_RELEASE.version}`,
      "      versionSource: >-",
      ...wrapProse(versionSource, 8),
      "      names:",
      `        - ${generated.overlay.name} entry`,
      `        - AICR ${generated.overlay.name} mirror`,
      "",
    ].join("\n");
  });
  write(ENTRY_NAMES_PATH, text.replace(anchor, `${blocks.map((block) => `${block}\n`).join("")}${anchor}`));
}

function updateNumericClaims(mirrored, replaceIds) {
  let text = readFileSync(NUMERIC_CLAIMS_PATH, "utf8");
  for (const id of replaceIds) {
    const safe = escapeRegExp(id);
    text = text
      .replace(new RegExp(`    - id: ${safe}-(?:applications|components|overlays)\\n      description: .*\\n      compute: .*\\n`, "g"), "")
      .replace(new RegExp(`    - id: ${safe}-(?:renders-applications|declares-components|resolves-overlays)\\n      quantity: .*\\n      page: .*\\n      phrases: .*\\n`, "g"), "");
  }
  // Removing a block can leave the blank line that separated it from the next
  // one. Runs of blank lines are collapsed so a second run changes nothing.
  text = text.replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "\n");
  const claimsAnchor = "\n  claims:\n";
  check(text.includes(claimsAnchor), `${relativeRepo(NUMERIC_CLAIMS_PATH)}: expected "claims:" key is missing; the file shape changed`);
  const quantityBlocks = mirrored.map(({ entryId }) => [
    `    - id: ${entryId}-applications`,
    `      description: The Argo CD Applications the ${entryId} entry renders.`,
    `      compute: { kind: files, dir: examples/aicr/${entryId}/argocd-rendered/templates, suffix: .yaml }`,
    `    - id: ${entryId}-components`,
    `      description: The components the retained ${entryId} recipe declares an order for.`,
    `      compute: { kind: listLength, file: examples/aicr/${entryId}/recipe.yaml, path: deploymentOrder }`,
    `    - id: ${entryId}-overlays`,
    `      description: The overlays AICR resolved to produce the ${entryId} recipe.`,
    `      compute: { kind: number, file: examples/aicr/${entryId}/generation-receipt.yaml, path: spec.result.overlaysResolved }`,
  ].join("\n"));
  const claimBlocks = mirrored.map((generated) => [
    `    - id: ${generated.entryId}-renders-applications`,
    `      quantity: ${generated.entryId}-applications`,
    `      page: ${generated.entryId}.md`,
    `      phrases: ["${generated.renderedApplications} Applications"]`,
    `    - id: ${generated.entryId}-declares-components`,
    `      quantity: ${generated.entryId}-components`,
    `      page: ${generated.entryId}.md`,
    `      phrases: ["${generated.componentCount} components"]`,
    `    - id: ${generated.entryId}-resolves-overlays`,
    `      quantity: ${generated.entryId}-overlays`,
    `      page: ${generated.entryId}.md`,
    `      phrases: ["${numberWord(generated.overlaysResolved)} overlays"]`,
  ].join("\n"));
  const anchorAt = text.indexOf(claimsAnchor);
  const head = text.slice(0, anchorAt).replace(/\n+$/, "\n");
  const tail = text.slice(anchorAt + 1).replace(/\n+$/, "\n");
  write(
    NUMERIC_CLAIMS_PATH,
    `${head}${quantityBlocks.length > 0 ? `\n${quantityBlocks.join("\n\n")}\n` : ""}\n${tail}${claimBlocks.length > 0 ? `\n${claimBlocks.join("\n")}\n` : ""}`,
  );
}

function numberWord(value) {
  return NUMBER_WORDS[value] ?? String(value);
}

// Wrap prose to a width. A Markdown link is kept on one line, because a link
// broken across lines is easy for a link checker to miss.
function wrapProse(text, indent, width = 78) {
  const pad = " ".repeat(indent);
  const words = text
    .replace(/\[[^\]]+\]\([^)]+\)/g, (link) => link.replaceAll(" ", "\u0000"))
    .split(/\s+/)
    .map((word) => word.replaceAll("\u0000", " "));
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

function updateDocMap(mirrored, replaceIds) {
  let text = readFileSync(DOC_MAP_PATH, "utf8");
  for (const id of replaceIds) {
    const row = new RegExp(`\\| \\[AICR ${escapeRegExp(id)} example\\]\\(\\./demo/aicr/${escapeRegExp(id)}\\.md\\) \\| Mirrored from NVIDIA AICR's recipe catalog: .*\\n`);
    text = text.replace(row, "");
  }
  const anchor = "| [AICR-native NIM inference example](./demo/aicr/eks-h100-inference-nim.md)";
  const anchorLineEnd = text.indexOf("\n", text.indexOf(anchor));
  check(text.includes(anchor) && anchorLineEnd !== -1, `${relativeRepo(DOC_MAP_PATH)}: expected AICR worked-examples row is missing; the file shape changed`);
  const rows = mirrored.map((generated) =>
    `| [AICR ${generated.entryId} example](./demo/aicr/${generated.entryId}.md) | Mirrored from NVIDIA AICR's recipe catalog: ${generated.componentCount} components resolved into ${generated.renderedApplications} rendered Argo CD Applications, with the bundle retained and the shape digest-pinned, generated by \`${GENERATOR}\`. |\n`);
  write(DOC_MAP_PATH, `${text.slice(0, anchorLineEnd + 1)}${rows.join("")}${text.slice(anchorLineEnd + 1)}`);
}

// The page states what holds for the retained bytes. It is rewritten on every
// run, because it is generated text and its numbers follow the entry. It does
// not say whether the entry is published, because that state lives in tracked
// receipts and reaches the reader through the entry's Catalog record.
function writeDocsPage(generated) {
  const { entryId, overlay } = generated;
  const pagePath = join(repoRoot, "docs", "demo", "aicr", `${entryId}.md`);
  const entryLink = `../../../examples/aicr/${entryId}`;
  const criteriaLine = criteriaFlags(generated.criteria).reduce(
    (parts, token, index, all) => (index % 2 === 0 ? [...parts, `${token} ${all[index + 1]}`] : parts),
    [],
  ).join(" ");
  const bundleTail = generated.bundleArgs.slice(generated.bundleArgs.indexOf("--storage-class"));
  const bundleLines = [];
  for (let index = 0; index < bundleTail.length; index += 2) bundleLines.push(`  ${bundleTail[index]} ${bundleTail[index + 1]}`);
  const commandLines = [
    `aicr ${generated.recipeArgs.join(" ")}`,
    `aicr bundle --recipe recipe.yaml --deployer argocd-helm --output ./${BUNDLE_DIR} \\`,
    bundleLines.join(" \\\n"),
    `helm template aicr-argocd ./${BUNDLE_DIR} --namespace argocd \\`,
    `  --set repoURL=${generated.repoURL} --output-dir rendered`,
  ];
  const leftOut = generated.leftOut.map((row) => row.name);
  const leftOutSentence = wrapProse(
    leftOut.length === 0
      ? "The bundle carries everything the recipe selects."
      : `The bundle leaves out ${leftOut.join(", ")}, which the recipe selects, and the generation receipt records the reason AICR logged for ${leftOut.length === 1 ? "it" : "each of them"}.`,
    0,
  ).join("\n");
  const selector = (generated.newRequiredInputs ?? []).find((input) => input.input === SYSTEM_NODE_SELECTOR.input);
  const toleration = generated.answers.find((answer) => answer.input === KEYED_TOLERATION.input);
  const inputSection = [];
  if (selector || toleration) {
    inputSection.push("## Inputs you have to check", "");
    if (selector) {
      inputSection.push(
        ...wrapProse(
          `AICR ${AICR_RELEASE.version} refuses to write this bundle without a system node selector. The entry carries \`${selector.value}\` as a placeholder. It stands in for the label on your own cluster's system node group, and it is not a claim about any cluster. The [generation receipt](${entryLink}/generation-receipt.yaml) lists every place it lands in the rendered Applications and in the bundle. A different value changes the bundle bytes and every digest in this entry, so the entry has to be regenerated with your value, or a variant has to be made from it.`,
          0,
        ),
        "",
      );
    }
    if (toleration) {
      inputSection.push(
        ...wrapProse(
          `AICR also refuses the default wildcard toleration for this overlay, because AKS admission cannot accept it. The entry carries the keyed toleration \`${toleration.value}\`, which is the value AICR's own refusal names. A cluster whose GPU nodes carry another taint needs another value.`,
          0,
        ),
        "",
      );
    }
    inputSection.push("");
  }

  const page = `# The ${overlay.name} overlay, mirrored as a catalog entry

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It was produced by
\`${GENERATOR} ${overlay.name}\`, which mirrors an
overlay from NVIDIA's AICR recipe catalog into a Catalog entry. Its source is
pinned by digest, its bundle is retained, its render is checked, and one
digest covers the whole rendered shape. That shape is the Argo CD wrapper
only. The charts its Applications point at are not rendered or assessed here,
and the entry has never run on a cluster.

## What it is

Criteria \`${criteriaLine}\` resolves ${numberWord(generated.overlaysResolved)} overlays into ${generated.componentCount} components,
and the Argo CD bundle renders into ${generated.renderedApplications} Applications (one platform root plus one
Application per rendered component, and some components render more than one
Application for their own pre- or post-install step).

${leftOutSentence}

\`\`\`bash
${commandLines.join("\n")}
\`\`\`

The [generation receipt](${entryLink}/generation-receipt.yaml)
records the exact commands, the criteria, and the release binary this entry
was built with. That binary is AICR ${AICR_RELEASE.version}, and it was checked against a
pinned SHA-256 before it ran.

${inputSection.join("\n")}## What the entry retains

The [retained bundle](${entryLink}/${BUNDLE_DIR}) is the
Helm chart AICR generated, byte for byte, and
[its checksum list](${entryLink}/${BUNDLE_INVENTORY})
names every file in it. The rendered Applications take their source from
\`${generated.sourcePackageReference}\`,
which is the address a publication of that bundle uses.

## One digest pins this entry too

\`\`\`bash
node scripts/generate-aicr-digest-index.mjs --verify --example ${entryId}
\`\`\`

The [digest index](${entryLink}/digest-index/README.md)
pins the upstream source, the recipe criteria, and all ${generated.renderedApplications} Applications
under one platform digest. The compiler is a generic one shared by every
entry in this catalog, not something built new for this one.

## What is proven and what is not

The entry was generated by a binary checked against a pinned SHA-256 before
it ran. The recipe, the bundle and every rendered Application are retained
byte for byte, and one digest pins the shape.

This page does not say whether the entry's source package or its literal
configuration bundle is published. Each counts as published only when a
tracked receipt records a push and an anonymous pull of the planned digest,
and the entry's Catalog record carries that state. No ConfigHub import or
promotion exists for this entry, no cluster ever ran it, and no NGC surface
was contacted.
`;
  write(pagePath, page);
}

main();
