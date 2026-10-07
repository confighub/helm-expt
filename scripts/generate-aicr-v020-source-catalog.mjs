#!/usr/bin/env node

// Import and verify the exact provider catalog used by a retained AICR source
// variant. Counts are intentionally kept separate: source overlay files,
// embedded catalog entries, and resolved leaves are different inventories and
// must not be presented as one universal number.
//
// AICR_SOURCE_CATALOG_VERSION selects the retained version and defaults to
// 0.20.0. The per-version counts live in lib/aicr-retained-versions.mjs.
//
// The overlay inventory can be imported two ways. --source-root reads a
// checkout of the exact tagged commit. --binary reads the recipes tree that
// the release binary embeds, after checking that the binary is the attested
// one and that the two signed recipe-catalog files inside it match the
// retained bytes. The record says which origin was used.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { aicrRetainedVersion } from "./lib/aicr-retained-versions.mjs";
import { readGoEmbeddedFiles } from "./lib/go-embed-files.mjs";

import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--import", "--generate", "--verify"].includes(mode), "use --import, --generate, or --verify");

const retained = aicrRetainedVersion("AICR_SOURCE_CATALOG_VERSION");
const facts = retained.sourceCatalog;
const { version, semver } = retained;
const expectedCommit = retained.commit;
const exampleRoot = retained.entryRoot;
const selectedVariant = "h100-eks-ubuntu-training-kubeflow";
const catalogRoot = join(exampleRoot, "source-catalog");
const catalogListPath = join(catalogRoot, "catalog-list.json");
const recipeHealthPath = join(catalogRoot, "recipe-health.md");
const overlayInventoryPath = join(catalogRoot, "source-overlays.json");
const recordPath = join(catalogRoot, "source-catalog-record.yaml");
const recipePath = join(exampleRoot, "recipe.yaml");

if (mode === "--import") {
  const inventory = facts.overlayInventoryOrigin === "attested-binary"
    ? importFromBinary()
    : importFromCheckout();
  check(
    inventory.length === facts.overlayFiles,
    `expected ${facts.overlayFiles} source overlay files, found ${inventory.length}`,
  );
  write(overlayInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  writeYaml(recordPath, buildRecord(inventory));
  console.log(`wrote ${relativeRepo(recordPath)}`);
} else {
  check(existsSync(overlayInventoryPath), `${relativeRepo(overlayInventoryPath)} is missing; run --import`);
  check(existsSync(recordPath), `${relativeRepo(recordPath)} is missing; run --import`);
  const inventory = JSON.parse(readFileSync(overlayInventoryPath, "utf8"));
  check(
    inventory.length === facts.overlayFiles,
    `expected ${facts.overlayFiles} retained source overlay files, found ${inventory.length}`,
  );
  check(
    new Set(inventory.map((item) => item.path)).size === inventory.length,
    "source overlay inventory repeats a path",
  );
  for (const item of inventory) {
    check(item.path.startsWith("recipes/overlays/"), `${item.path}: unexpected overlay path`);
    check(/^[0-9a-f]{64}$/.test(item.sha256), `${item.path}: invalid SHA-256`);
  }
  const expected = buildRecord(inventory);
  if (mode === "--generate") {
    writeYaml(recordPath, expected);
    console.log(`wrote ${relativeRepo(recordPath)}`);
  } else {
    const committed = readYaml(recordPath);
    check(stableJson(committed) === stableJson(expected), `${relativeRepo(recordPath)} is stale; run --generate`);
    console.log(`verified the NVIDIA AICR ${version} source catalog and selected source variant`);
  }
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function importFromCheckout() {
  const sourceRoot = flagValue("--source-root");
  check(sourceRoot && existsSync(sourceRoot), `--source-root must name the exact AICR ${version} checkout`);
  const commit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  check(commit === expectedCommit, `source checkout is ${commit}, expected ${expectedCommit}`);
  const overlayRoot = join(sourceRoot, "recipes", "overlays");
  return listFiles(overlayRoot)
    .map((path) => ({
      path: relative(sourceRoot, path).replaceAll("\\", "/"),
      sha256: sha256(readFileSync(path)),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

// Read the overlay files out of the release binary. Three bindings make the
// result a statement about the attested release rather than about a file
// someone handed over: the binary's SHA-256 is the one the generation receipt
// records (which the provenance lane ties to the signed attestation), and the
// registry and validator catalog embedded beside the overlays are byte-equal
// to the retained files the recipe-catalog signature covers.
function importFromBinary() {
  const binaryPath = flagValue("--binary");
  check(binaryPath && existsSync(binaryPath), `--binary must name the extracted AICR ${version} binary`);
  const generation = readYaml(join(exampleRoot, "generation-receipt.yaml"));
  check(
    sha256(readFileSync(binaryPath)) === generation.spec?.source?.binary?.sha256,
    "the binary differs from the one the generation receipt records",
  );
  const embedded = readGoEmbeddedFiles(binaryPath, `overlays/${selectedVariant}.yaml`);
  const subjectRoot = join(retained.signatureRoot, "attested-subject");
  for (const [embeddedName, retainedName] of [
    ["registry.yaml", "registry.yaml"],
    ["validators/catalog.yaml", "catalog.yaml"],
  ]) {
    check(
      embedded.get(embeddedName)?.sha256 === sha256(readFileSync(join(subjectRoot, retainedName))),
      `embedded ${embeddedName} differs from the retained signed ${retainedName}`,
    );
  }
  return [...embedded.entries()]
    .filter(([name]) => /^overlays\/[^/]+\.yaml$/.test(name))
    .map(([name, file]) => ({ path: `recipes/${name}`, sha256: file.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function buildRecord(inventory) {
  const catalogList = JSON.parse(readFileSync(catalogListPath, "utf8"));
  const recipe = readYaml(recipePath);
  const leaves = catalogList.filter((item) => item.is_leaf === true);
  const selected = leaves.find((item) => item.name === selectedVariant);
  check(
    catalogList.length === facts.catalogEntries,
    `expected ${facts.catalogEntries} embedded catalog entries, found ${catalogList.length}`,
  );
  check(leaves.length === facts.leaves, `expected ${facts.leaves} embedded catalog leaves, found ${leaves.length}`);
  check(selected, "selected AICR source variant is absent from the embedded catalog list");
  check(
    `sha256:${sha256(readFileSync(catalogListPath))}` === facts.catalogDigest,
    "the retained embedded catalog list differs from the digest recorded for this version",
  );
  check(recipe.metadata?.version === semver, "selected recipe version changed");
  check(
    stableJson(recipe.criteria) === stableJson({
      accelerator: "h100",
      intent: "training",
      os: "ubuntu",
      platform: "kubeflow",
      service: "eks",
    }),
    "selected recipe criteria changed",
  );
  check(recipe.componentRefs?.length === facts.componentCount, "selected recipe component count changed");
  const criterion = (name) => selected.criteria[
    facts.criteriaKeys === "capitalised"
      ? { service: "Service", accelerator: "Accelerator", os: "OS", intent: "Intent", platform: "Platform" }[name]
      : name
  ];
  const dimensions = {
    service: criterion("service"),
    accelerator: criterion("accelerator"),
    os: criterion("os"),
    intent: criterion("intent"),
    platform: criterion("platform"),
  };
  check(
    stableJson(dimensions) === stableJson(recipe.criteria),
    "the catalog entry's criteria differ from the selected recipe's criteria",
  );

  const leafInventory = facts.recipeHealth ? healthPageLeaves(leaves, selected) : catalogListLeaves(leaves);

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceCatalogRecord",
    metadata: { name: `nvidia-aicr-${retained.slug}` },
    spec: {
      provider: {
        name: "NVIDIA",
        role: "source-catalog-curator",
        identity: "https://github.com/NVIDIA/aicr",
      },
      source: {
        project: "NVIDIA AICR",
        repository: "https://github.com/NVIDIA/aicr",
        version,
        tag: version,
        commit: expectedCommit,
      },
      catalog: {
        name: "NVIDIA AICR built-in catalog",
        format: "aicr-embedded-catalog",
        version,
        record: relativeRepo(catalogListPath),
        digest: `sha256:${sha256(readFileSync(catalogListPath))}`,
        digestRole: "source-catalog-content",
      },
      inventories: {
        sourceTreeOverlays: {
          count: inventory.length,
          record: relativeRepo(overlayInventoryPath),
          recordSha256: sha256(readFileSync(overlayInventoryPath)),
          ...(facts.overlayInventoryOrigin === "attested-binary"
            ? {
                origin: "attested-release-binary",
                originNote:
                  "The files were read from the recipes tree embedded in the attested release binary, not from a source checkout. The embedded registry and validator catalog are byte-equal to the retained files the recipe-catalog signature covers. Each path is the embedded name with the recipes/ prefix it has in the source tree.",
              }
            : {}),
        },
        embeddedCatalogEntries: {
          count: catalogList.length,
          record: relativeRepo(catalogListPath),
          recordSha256: sha256(readFileSync(catalogListPath)),
        },
        resolvedLeaves: leafInventory.resolvedLeaves,
      },
      selection: {
        name: selected.name,
        kind: "source-variant",
        source: selected.source,
        dimensions,
        structuralStatus: selected.health?.status,
        appliedOverlays: recipe.metadata.appliedOverlays,
        record: {
          path: relativeRepo(recipePath),
          digest: `sha256:${sha256(readFileSync(recipePath))}`,
          digestRole: "selected-source-variant",
        },
        componentCount: recipe.componentRefs.length,
        evidence: leafInventory.selectionEvidence,
      },
      interpretation: {
        sourceVariant: "The provider-curated leaf selected from this exact catalog instance.",
        retainedBaseVariant: "The exact objects later retained from this source variant, with separate digests and evidence.",
        derivedVariant: "A later reviewed ConfigHub change. It does not alter the identity or evidence of the provider source variant.",
        observedDifference: "A snapshot or diff reports what differs. It becomes a fault only when the intended source variant requires a different value.",
      },
      ...(leafInventory.normalization ? { normalization: leafInventory.normalization } : {}),
      limits: [
        "The three inventory counts describe different sets and are not interchangeable.",
        "Structural pass means the recipe resolves and pins chart versions; it is not runtime validation.",
        leafInventory.evidenceLimit,
        "The selected source variant does not prove that its generated objects ran on EKS or H100 through ConfigHub.",
      ],
    },
    status: {
      result: "pass",
      catalogDigestVerified: true,
      selectedVariantReproducible: true,
      runtimeProven: false,
    },
  };
}

// v0.20.0 retains NVIDIA's recipe-health page, which is where the provider's
// linked-evidence column comes from.
function healthPageLeaves(leaves, selected) {
  const expected = facts.recipeHealth;
  const recipeHealth = parseRecipeHealth(readFileSync(recipeHealthPath, "utf8"));
  check(
    recipeHealth.rows.length === expected.rows,
    `expected ${expected.rows} recipe-health rows, found ${recipeHealth.rows.length}`,
  );
  check(
    recipeHealth.pass === expected.pass,
    `expected ${expected.pass} structurally passing leaves, found ${recipeHealth.pass}`,
  );
  check(
    recipeHealth.linked === expected.linked,
    `expected ${expected.linked} leaves with linked evidence, found ${recipeHealth.linked}`,
  );
  check(
    recipeHealth.pending === expected.pending,
    `expected ${expected.pending} leaves with pending evidence, found ${recipeHealth.pending}`,
  );
  const selectedEvidence = recipeHealth.byName.get(selected.name)?.evidence;
  return {
    resolvedLeaves: {
      count: leaves.length,
      structuralPass: recipeHealth.pass,
      linkedEvidence: recipeHealth.linked,
      pendingEvidence: recipeHealth.pending,
      record: relativeRepo(recipeHealthPath),
      recordSha256: sha256(readFileSync(recipeHealthPath)),
    },
    selectionEvidence: {
      status: selectedEvidence === "pending" ? "provider-pending" : "provider-linked",
      records: [relativeRepo(recipeHealthPath)],
      references: selectedEvidence === "pending" ? [] : [selectedEvidence],
    },
    normalization: {
      recipeHealthLinks: "Relative source-tree documentation links were replaced with immutable links at the retained NVIDIA commit. Report data and evidence links are unchanged.",
    },
    evidenceLimit: "Only two of the 45 retained leaves have linked evidence in this upstream snapshot; 43 remain pending.",
  };
}

// Without the recipe-health page, the structural status still comes from the
// catalog list the binary prints. The provider's evidence links do not, so
// they are recorded as not recorded rather than as pending or absent.
function catalogListLeaves(leaves) {
  const structuralPass = leaves.filter((item) => item.health?.status === "pass").length;
  return {
    resolvedLeaves: {
      count: leaves.length,
      structuralPass,
      providerEvidence: "not-recorded",
      providerEvidenceReason:
        "NVIDIA's recipe-health page for this tag was not retained, so the number of leaves with linked or pending provider evidence is not recorded.",
      record: relativeRepo(catalogListPath),
      recordSha256: sha256(readFileSync(catalogListPath)),
    },
    selectionEvidence: {
      status: "not-recorded",
      records: [],
      references: [],
    },
    normalization: null,
    evidenceLimit:
      "Provider evidence links are not recorded for this version. That is a gap in this record, not a statement that NVIDIA publishes no evidence.",
  };
}

function parseRecipeHealth(text) {
  const rows = text
    .split("\n")
    .filter((line) => /^\| [^|]+ \|/.test(line))
    .filter((line) => !line.startsWith("| Recipe ") && !line.startsWith("|---"))
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      return {
        name: cells[0],
        status: cells[6],
        evidence: cells[8],
      };
    });
  return {
    rows,
    byName: new Map(rows.map((row) => [row.name, row])),
    pass: rows.filter((row) => row.status === "pass").length,
    linked: rows.filter((row) => row.evidence !== "pending").length,
    pending: rows.filter((row) => row.evidence === "pending").length,
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
