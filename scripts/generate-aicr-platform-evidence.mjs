#!/usr/bin/env node

// Publish retained AICR platform configurations and their evidence records.
//
// A reader should be able to find a tested starting configuration, pull any
// published artifact, and see exactly which later steps have receipts. A public
// OCI package is useful before ConfigHub, but it is not delivery or runtime
// proof. Keeping those stages separate prevents a downloadable entry from
// silently acquiring stronger claims.
//
// Every value here is derived from committed bytes. The consumer-contract rule
// holds: every path a consumer needs appears in the record, so nothing has to
// be reconstructed by convention.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const outputJson = join(repoRoot, "data", "aicr-platform-evidence", "platform-evidence.json");
const outputSummary = join(repoRoot, "data", "aicr-platform-evidence", "summary.md");

// Each entry names where its facts live. The generator reads them; it does not
// restate them.
const entries = [
  {
    id: "eks-h100-training-kubeflow",
    title: "EKS H100 Kubeflow training",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-training-kubeflow.md",
    sourceReceipt: "generation-receipt.yaml",
    ladder: [
      {
        rung: "oci-round-trip",
        receipt: "runs/aicr-oci-roundtrip-proof/receipt.yaml",
        summary: "data/aicr-oci-roundtrip-proof/summary.md",
      },
      {
        rung: "confighub-variant-and-promotion",
        receipt: "runs/aicr-variant-promotion-proof/receipt.yaml",
        summary: "data/aicr-variant-promotion-proof/summary.md",
      },
    ],
  },
  {
    id: "eks-h100-training-kubeflow-v0-18-0",
    title: "EKS H100 Kubeflow training, AICR v0.18.0",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-training-kubeflow-v0-18-0.md",
    sourceReceipt: "generation-receipt.yaml",
    // The second retained version has climbed no rung beyond retention. It is
    // listed with an empty ladder rather than left out, because an entry that
    // exists and has proven nothing further is a fact worth publishing.
    ladder: [],
  },
  {
    id: "eks-h100-training-kubeflow-v0-19-0",
    title: "EKS H100 Kubeflow training, AICR v0.19.0",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-training-kubeflow-v0-19-0.md",
    sourceReceipt: "generation-receipt.yaml",
    ladder: [
      {
        rung: "public-source-and-literal-configuration-oci",
        receipt: "examples/aicr/eks-h100-training-kubeflow-v0-19-0/public-oci-receipt.yaml",
        summary: "data/aicr-v0-19-0-chain/summary.md",
      },
      {
        rung: "confighub-base-policy-and-promotion",
        receipt: "examples/aicr/eks-h100-training-kubeflow-v0-19-0/promotion-readiness-receipt.yaml",
        summary: "data/aicr-v0-19-0-chain/summary.md",
      },
    ],
  },
  {
    id: "eks-h100-training-kubeflow-v0-20-0",
    title: "EKS H100 Kubeflow training, AICR v0.20.0",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-training-kubeflow-v0-20-0.md",
    sourceReceipt: "generation-receipt.yaml",
    ladder: [
      {
        rung: "public-source-and-literal-configuration-oci",
        receipt: "examples/aicr/eks-h100-training-kubeflow-v0-20-0/public-oci-receipt.yaml",
        summary: "examples/aicr/eks-h100-training-kubeflow-v0-20-0/public-oci-summary.md",
      },
    ],
  },
  {
    id: "eks-h100-inference-nim",
    title: "EKS H100 NIM inference, AICR-native",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-inference-nim.md",
    sourceReceipt: "generation-receipt.yaml",
    ladder: [
      {
        rung: "operator-config-plane-delivery",
        receipt: "runs/aicr-nim-operator-delivery/receipt.yaml",
        summary: "data/aicr-nim-operator-delivery/summary.md",
      },
    ],
  },
  {
    id: "kserve-nim-inference",
    title: "NIM on KServe model shapes",
    provenance: "retained-third-party",
    page: "docs/demo/aicr/kserve-nim-inference.md",
    sourceReceipt: "retention-receipt.yaml",
    ladder: [
      {
        rung: "confighub-import-variant-and-promotion",
        receipt: "runs/aicr-kserve-nim-import/receipt.yaml",
        summary: "data/aicr-kserve-nim-import/summary.md",
      },
      {
        rung: "config-plane-delivery",
        receipt: "runs/aicr-kserve-delivery/receipt.yaml",
        summary: "data/aicr-kserve-delivery/summary.md",
      },
    ],
  },
  {
    id: "cpu-starter",
    title: "CPU starter, derived",
    provenance: "derived",
    page: "docs/demo/aicr/cpu-starter.md",
    sourceReceipt: "derivation-receipt.yaml",
    ladder: [
      {
        rung: "local-platform-variant-parity",
        receipt: "runs/aicr-platform-variant/accepted-receipt.yaml",
        summary: "data/aicr-platform-variant/summary.md",
      },
      {
        rung: "confighub-variant-and-promotion",
        receipt: "runs/aicr-cpu-starter-variant/receipt.yaml",
        summary: "data/aicr-cpu-starter-variant/summary.md",
      },
      {
        rung: "config-plane-delivery",
        receipt: "runs/aicr-cpu-starter-delivery/receipt.yaml",
        summary: "data/aicr-cpu-starter-delivery/summary.md",
      },
      {
        rung: "one-reviewed-component-synced",
        receipt: "runs/aicr-cpu-starter-sync/receipt.yaml",
        summary: "data/aicr-cpu-starter-sync/summary.md",
      },
    ],
  },
];

const crossEntryEvidence = [
  {
    id: "upstream-signature-verification",
    receipt: "runs/aicr-signature-verification/receipt.yaml",
    summary: "data/aicr-signature-verification/summary.md",
  },
  {
    id: "upstream-provenance-v0-19-0",
    receipt: "runs/aicr-provenance-v0-19-0/receipt.yaml",
    summary: "data/aicr-provenance-v0-19-0/summary.md",
  },
  {
    id: "upstream-provenance-v0-20-0",
    receipt: "runs/aicr-provenance-v0-20-0/receipt.yaml",
    summary: "data/aicr-provenance-v0-20-0/summary.md",
  },
  { id: "blast-radius-parity", summary: "data/aicr-blast-radius/summary.md" },
  { id: "ordering-parity", summary: "data/aicr-ordering-parity/summary.md" },
];

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/generate-aicr-platform-evidence.mjs --generate
  node scripts/generate-aicr-platform-evidence.mjs --verify`);
  process.exit(2);
}

const record = buildRecord();
const recordText = `${JSON.stringify(record, null, 2)}\n`;
const summaryText = renderSummary(record);

if (mode === "--generate") {
  write(outputJson, recordText);
  write(outputSummary, summaryText);
  console.log(`wrote ${relativeRepo(outputJson)} for ${record.spec.entries.length} entries`);
} else {
  check(existsSync(outputJson), `${relativeRepo(outputJson)} is missing; run npm run aicr-platform-evidence:generate`);
  check(
    readFileSync(outputJson, "utf8") === recordText,
    `${relativeRepo(outputJson)} is stale; run npm run aicr-platform-evidence:generate`,
  );
  check(
    readFileSync(outputSummary, "utf8") === summaryText,
    `${relativeRepo(outputSummary)} is stale; run npm run aicr-platform-evidence:generate`,
  );
  console.log(`verified the AICR platform evidence record for ${record.spec.entries.length} entries`);
}

function buildRecord() {
  const rows = entries.map((entry) => {
    const entryRoot = join(repoRoot, "examples", "aicr", entry.id);
    check(existsSync(entryRoot), `${entry.id}: the entry directory is missing`);

    const indexPath = join(entryRoot, "digest-index", "platform-index.json");
    check(existsSync(indexPath), `${entry.id}: the digest index is missing`);
    const index = JSON.parse(readFileSync(indexPath, "utf8"));
    const platformDigest = index.spec?.platformDigest ?? "";
    check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), `${entry.id}: the digest index records no platform digest`);

    const sourceReceiptPath = join(entryRoot, entry.sourceReceipt);
    check(existsSync(sourceReceiptPath), `${entry.id}: ${entry.sourceReceipt} is missing`);
    const sourceReceipt = readYaml(sourceReceiptPath);
    const source = sourceReceipt.spec?.source ?? sourceReceipt.spec?.derivedFrom?.upstream ?? {};

    // The ladder is only as long as its receipts. A rung with no committed
    // receipt is not listed as climbed.
    const climbed = entry.ladder.map((rung) => {
      const receiptPath = join(repoRoot, rung.receipt);
      check(existsSync(receiptPath), `${entry.id}: rung ${rung.rung} names a missing receipt`);
      const receipt = readYaml(receiptPath);
      check(
        receipt.status?.result === "pass",
        `${entry.id}: rung ${rung.rung} cites a receipt whose result is not pass`,
      );
      check(
        existsSync(join(repoRoot, rung.summary)),
        `${entry.id}: rung ${rung.rung} names a missing summary`,
      );
      return { rung: rung.rung, receipt: rung.receipt, summary: rung.summary, result: receipt.status.result };
    });

    const boundary = index.spec?.boundary ?? {};
    return {
      id: entry.id,
      title: entry.title,
      provenance: entry.provenance,
      platformDigest,
      upstream: {
        name: source.name ?? null,
        version: source.version ?? null,
        commit: source.commit ?? null,
        repository: source.repository ?? null,
      },
      // Every path a reader needs, published rather than reconstructed.
      paths: {
        entry: relativeRepo(entryRoot),
        page: entry.page,
        digestIndex: relativeRepo(indexPath),
        digestIndexReadme: relativeRepo(join(entryRoot, "digest-index", "README.md")),
        sourceReceipt: relativeRepo(sourceReceiptPath),
      },
      ladder: { climbed, climbedCount: climbed.length },
      boundary: {
        configPlaneOnly: boundary.configPlaneOnly ?? true,
        gpuWorkloadsProven: boundary.gpuWorkloadsProven ?? false,
        published: boundary.published ?? null,
      },
    };
  });

  const crossEntry = crossEntryEvidence.map((row) => {
    for (const key of ["receipt", "summary"]) {
      if (!row[key]) continue;
      check(existsSync(join(repoRoot, row[key])), `${row.id}: ${row[key]} is missing`);
    }
    return row;
  });

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "PlatformEvidenceRecord",
    metadata: { name: "aicr" },
    spec: {
      // The decision, made machine-readable rather than left in prose.
      contract: {
        kind: "tested-starting-configurations",
        statement:
          "These entries are retained AICR configurations. A published entry can be pulled and inspected as an exact starting point. Its receipts state separately whether ConfigHub retention, promotion, delivery, and runtime testing have happened.",
        consumerExpectation:
          "Choose an exact version, inspect its source and generated Applications, pull its public OCI artifacts when available, and check the receipt for every later claim.",
        boundary:
          "Public availability and byte identity do not prove ConfigHub delivery or GPU runtime behavior. Those stages require separate receipts.",
      },
      entries: rows,
      crossEntryEvidence: crossEntry,
      openRungs: [
        "ConfigHub base and derived variants for AICR v0.20.0.",
        "Destination-specific route resolution for the AICR v0.20.0 nested sources.",
        "EKS, H100, Argo CD, Flux, and workload runtime proof for AICR v0.20.0.",
      ],
    },
  };
}

function renderSummary(record) {
  const rows = record.spec.entries
    .map(
      (entry) =>
        `| \`${entry.id}\` | ${entry.provenance} | \`${entry.platformDigest.slice(0, 19)}…\` | ${entry.ladder.climbedCount} |`,
    )
    .join("\n");
  return `# AICR platform evidence

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-platform-evidence:generate\` and checked by
\`npm run aicr-platform-evidence:verify\`. The same record is published in
\`site/catalog.json\` under \`platformEvidence\`, so a consumer can find these
entries without reading the repository.

These entries are tested starting configurations for exact AICR versions. When
an entry has public OCI artifacts, a user can pull and inspect them without a
ConfigHub account. The ladder counts only later steps that have matching
receipts; publication, promotion, delivery, and runtime are not treated as the
same result.

| Entry | Provenance | Platform digest | Ladder rungs with receipts |
| --- | --- | --- | --- |
${rows}

Cross-entry evidence covers the whole set rather than one entry:
${record.spec.crossEntryEvidence.map((row) => `\`${row.id}\``).join(", ")}.

The next v0.20.0 steps are listed directly:

${record.spec.openRungs.map((row) => `- ${row}`).join("\n")}

Every path needed to inspect a claim is published in the record.
`;
}
