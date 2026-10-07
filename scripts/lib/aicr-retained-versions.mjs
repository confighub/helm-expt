// Per-version facts for the retained AICR EKS/H100/Kubeflow training entries.
//
// The source-catalog, provenance, and artifact scripts were written for
// v0.20.0 and carried its counts and names as constants. They now read those
// constants from here, so a new retained version adds one block of facts
// instead of three copied scripts. Every number below was read from the
// retained bytes of that version; none is a target.

import { join } from "node:path";

import { check, repoRoot } from "./proof-common.mjs";

const versions = {
  "0.20.0": {
    commit: "b8a6eadb2d6f7e5b62dcb93446874f383940de0f",
    sourceCatalog: {
      // Where the overlay inventory was read from. v0.20.0 was imported from
      // a checkout of the tagged commit.
      overlayInventoryOrigin: "source-checkout",
      overlayFiles: 103,
      catalogEntries: 102,
      leaves: 45,
      componentCount: 15,
      // v0.20.0 prints criteria keys capitalised (Service, Accelerator, ...).
      criteriaKeys: "capitalised",
      recipeHealth: { rows: 45, pass: 45, linked: 2, pending: 43 },
      catalogDigest:
        "sha256:676f2d59eacd79ae1b72e5cbe00216b577def1da412dbdabb032f317a62dc1d8",
    },
    artifacts: {
      renderedApplications: 17,
      componentWaves: 5,
      // The base-variant record this entry's source-catalog import feeds.
      baseVariantRecord: "aicr-eks-h100-training-kubeflow-v0-20-0-argocd",
      nestedSources: {
        status: "materialized-awaits-destination-execution",
        evidence: [
          "data/aicr-v0-20-0-nested-sources/summary.md",
          "data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux.yaml",
        ],
        gap: "https://github.com/confighub/helm-expt/issues/1615",
      },
    },
  },
  "1.0.0": {
    commit: "82bccef69855c70e151f8b5e6ed9d04d70a30f81",
    sourceCatalog: {
      // v1.0.0 was imported without a source checkout. The overlay inventory
      // is read from the recipes tree embedded in the attested release
      // binary, which also carries the two signed recipe-catalog files.
      overlayInventoryOrigin: "attested-binary",
      overlayFiles: 134,
      catalogEntries: 133,
      leaves: 59,
      componentCount: 16,
      // v1.0.0 prints criteria keys in lower case (service, accelerator, ...).
      criteriaKeys: "lowercase",
      // NVIDIA's recipe-health page was not retained for this version, so the
      // provider's linked-evidence counts are not recorded here.
      recipeHealth: null,
      catalogDigest:
        "sha256:30bcae956bf066c57068aee2a78bdf3983ee4d9ef77bd120229276dd9fdc0ac6",
    },
    artifacts: {
      renderedApplications: 17,
      componentWaves: 5,
      // The record aicr-eks-h100-training-kubeflow-v1-0-0-argocd exists and
      // says nothing is published. This stays null because the field means
      // "registered in config-catalog/source-catalog-imports.yaml", and that
      // registry's verifier requires the AICR page on the site to show the
      // imported catalog digest, which it does not yet do for v1.0.0. Until
      // then the artifact check validates the source-catalog record directly.
      baseVariantRecord: null,
      nestedSources: {
        status: "not-yet-materialized-for-v1.0.0",
        evidence: [],
        gap: null,
      },
    },
  },
};

export function aicrRetainedVersion(envName, fallback = "0.20.0") {
  const semver = process.env[envName]?.trim() || fallback;
  const facts = versions[semver];
  check(
    facts,
    `${envName} must be one of ${Object.keys(versions).join(", ")}; got ${semver}`,
  );
  const slug = `v${semver.replaceAll(".", "-")}`;
  const entryName = `eks-h100-training-kubeflow-${slug}`;
  return {
    ...facts,
    semver,
    version: `v${semver}`,
    slug,
    entryName,
    entryPath: `examples/aicr/${entryName}`,
    entryRoot: join(repoRoot, "examples", "aicr", entryName),
    signatureRoot: join(repoRoot, "examples", "aicr", "upstream-signatures", `v${semver}`),
    provenanceReceipt: `runs/aicr-provenance-${slug}/receipt.yaml`,
    provenanceSummary: `data/aicr-provenance-${slug}/summary.md`,
    // npm script names drop the dots: v0.20.0 is v0200, v1.0.0 is v100.
    npmSuffix: `v${semver.replaceAll(".", "")}`,
  };
}
