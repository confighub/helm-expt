#!/usr/bin/env node

// Import and verify the exact provider catalog used by the retained AICR
// v0.20.0 source variant. Counts are intentionally kept separate: source
// overlay files, embedded catalog entries, and resolved leaves are different
// inventories and must not be presented as one universal number.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

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
check(["--import", "--verify"].includes(mode), "use --import or --verify");

const expectedCommit = "b8a6eadb2d6f7e5b62dcb93446874f383940de0f";
const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow-v0-20-0",
);
const catalogRoot = join(exampleRoot, "source-catalog");
const catalogListPath = join(catalogRoot, "catalog-list.json");
const recipeHealthPath = join(catalogRoot, "recipe-health.md");
const overlayInventoryPath = join(catalogRoot, "source-overlays.json");
const recordPath = join(catalogRoot, "source-catalog-record.yaml");
const recipePath = join(exampleRoot, "recipe.yaml");

if (mode === "--import") {
  const sourceRoot = flagValue("--source-root");
  check(sourceRoot && existsSync(sourceRoot), "--source-root must name the exact AICR v0.20.0 checkout");
  const commit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  check(commit === expectedCommit, `source checkout is ${commit}, expected ${expectedCommit}`);
  const overlayRoot = join(sourceRoot, "recipes", "overlays");
  const inventory = listFiles(overlayRoot)
    .map((path) => ({
      path: relative(sourceRoot, path).replaceAll("\\", "/"),
      sha256: sha256(readFileSync(path)),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  check(inventory.length === 103, `expected 103 source overlay files, found ${inventory.length}`);
  write(overlayInventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  writeYaml(recordPath, buildRecord(inventory));
  console.log(`wrote ${relativeRepo(recordPath)}`);
} else {
  check(existsSync(overlayInventoryPath), `${relativeRepo(overlayInventoryPath)} is missing; run --import`);
  check(existsSync(recordPath), `${relativeRepo(recordPath)} is missing; run --import`);
  const inventory = JSON.parse(readFileSync(overlayInventoryPath, "utf8"));
  check(inventory.length === 103, `expected 103 retained source overlay files, found ${inventory.length}`);
  check(
    new Set(inventory.map((item) => item.path)).size === inventory.length,
    "source overlay inventory repeats a path",
  );
  for (const item of inventory) {
    check(item.path.startsWith("recipes/overlays/"), `${item.path}: unexpected overlay path`);
    check(/^[0-9a-f]{64}$/.test(item.sha256), `${item.path}: invalid SHA-256`);
  }
  const expected = buildRecord(inventory);
  const retained = readYaml(recordPath);
  check(stableJson(retained) === stableJson(expected), `${relativeRepo(recordPath)} is stale; run --import`);
  console.log("verified the NVIDIA AICR v0.20.0 source catalog and selected source variant");
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function buildRecord(inventory) {
  const catalogList = JSON.parse(readFileSync(catalogListPath, "utf8"));
  const recipeHealth = parseRecipeHealth(readFileSync(recipeHealthPath, "utf8"));
  const recipe = readYaml(recipePath);
  const leaves = catalogList.filter((item) => item.is_leaf === true);
  const selected = leaves.find((item) => item.name === "h100-eks-ubuntu-training-kubeflow");
  check(catalogList.length === 102, `expected 102 embedded catalog entries, found ${catalogList.length}`);
  check(leaves.length === 45, `expected 45 embedded catalog leaves, found ${leaves.length}`);
  check(selected, "selected AICR source variant is absent from the embedded catalog list");
  check(recipeHealth.rows.length === 45, `expected 45 recipe-health rows, found ${recipeHealth.rows.length}`);
  check(recipeHealth.pass === 45, `expected 45 structurally passing leaves, found ${recipeHealth.pass}`);
  check(recipeHealth.linked === 2, `expected two leaves with linked evidence, found ${recipeHealth.linked}`);
  check(recipeHealth.pending === 43, `expected 43 leaves with pending evidence, found ${recipeHealth.pending}`);
  check(recipe.metadata?.version === "0.20.0", "selected recipe version changed");
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
  check(recipe.componentRefs?.length === 15, "selected recipe component count changed");

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "SourceCatalogRecord",
    metadata: { name: "nvidia-aicr-v0-20-0" },
    spec: {
      provider: {
        name: "NVIDIA",
        role: "source-catalog-curator",
      },
      source: {
        project: "NVIDIA AICR",
        repository: "https://github.com/NVIDIA/aicr",
        version: "v0.20.0",
        tag: "v0.20.0",
        commit: expectedCommit,
      },
      inventories: {
        sourceTreeOverlays: {
          count: inventory.length,
          record: relativeRepo(overlayInventoryPath),
          recordSha256: sha256(readFileSync(overlayInventoryPath)),
        },
        embeddedCatalogEntries: {
          count: catalogList.length,
          record: relativeRepo(catalogListPath),
          recordSha256: sha256(readFileSync(catalogListPath)),
        },
        resolvedLeaves: {
          count: leaves.length,
          structuralPass: recipeHealth.pass,
          linkedEvidence: recipeHealth.linked,
          pendingEvidence: recipeHealth.pending,
          record: relativeRepo(recipeHealthPath),
          recordSha256: sha256(readFileSync(recipeHealthPath)),
        },
      },
      selectedSourceVariant: {
        name: selected.name,
        source: selected.source,
        dimensions: {
          service: selected.criteria.Service,
          accelerator: selected.criteria.Accelerator,
          os: selected.criteria.OS,
          intent: selected.criteria.Intent,
          platform: selected.criteria.Platform,
        },
        structuralStatus: selected.health?.status,
        linkedEvidence: recipeHealth.byName.get(selected.name)?.evidence ?? "pending",
        appliedOverlays: recipe.metadata.appliedOverlays,
        exactRecipe: {
          path: relativeRepo(recipePath),
          sha256: sha256(readFileSync(recipePath)),
          componentCount: recipe.componentRefs.length,
        },
      },
      interpretation: {
        sourceVariant: "The provider-curated leaf selected from this exact catalog instance.",
        retainedBaseVariant: "The exact objects later retained from this source variant, with separate digests and evidence.",
        derivedVariant: "A later reviewed ConfigHub change. It does not alter the identity or evidence of the provider source variant.",
        observedDifference: "A snapshot or diff reports what differs. It becomes a fault only when the intended source variant requires a different value.",
      },
      normalization: {
        recipeHealthLinks: "Relative source-tree documentation links were replaced with immutable links at the retained NVIDIA commit. Report data and evidence links are unchanged.",
      },
      limits: [
        "The three inventory counts describe different sets and are not interchangeable.",
        "Structural pass means the recipe resolves and pins chart versions; it is not runtime validation.",
        "Only two of the 45 retained leaves have linked evidence in this upstream snapshot; 43 remain pending.",
        "The selected source variant does not prove that its generated objects ran on EKS or H100 through ConfigHub.",
      ],
    },
    status: {
      result: "pass",
      sourceCatalogRetained: true,
      selectedVariantReproducible: true,
      runtimeProven: false,
    },
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
