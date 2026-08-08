#!/usr/bin/env node

// Publish the AICR platform entries as evidence records.
//
// The catalog data model had no place for a platform shape, so consumers could
// not discover these entries at all. The decision behind this generator is that
// they are evidence rather than a product line: nobody is meant to install an
// AICR entry from the catalog the way they install a chart. They are meant to
// find what was proven, follow the path to the receipt, and check it.
//
// That decision changes what the record must carry. A product record promises
// installability, so it needs delivery paths and a support posture. An evidence
// record promises locatability and honesty, so it carries the digest that pins
// the shape, a path to every artifact a reader might want, the ladder rungs
// that have receipts, and the rungs that do not.
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
    id: "eks-h100-inference-nim",
    title: "EKS H100 NIM inference, AICR-native",
    provenance: "retained-upstream",
    page: "docs/demo/aicr/eks-h100-inference-nim.md",
    sourceReceipt: "generation-receipt.yaml",
    ladder: [],
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
        kind: "evidence",
        statement:
          "These entries are evidence, not a product line. They record what was proven about governing AI-platform configuration, with a path to every receipt. They are not offered for installation from the catalog the way a chart is, and no support posture attaches to them.",
        consumerExpectation:
          "Locate an entry, follow its paths, and check its receipts. Every path a consumer needs is published here, so nothing is reconstructed by convention.",
        boundary:
          "Every entry proves config-plane mechanics only. No GPU workload ran to produce or verify any of it.",
      },
      entries: rows,
      crossEntryEvidence: crossEntry,
      openRungs: [
        "Config-plane delivery for both inference entries.",
        "Any workload-plane claim, for every entry.",
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

These entries are evidence, not a product line. Nobody is meant to install an
AICR entry from the catalog the way they install a chart. The record exists so
a reader can locate what was proven, follow the path to the receipt, and check
it.

| Entry | Provenance | Platform digest | Ladder rungs with receipts |
| --- | --- | --- | --- |
${rows}

Cross-entry evidence covers the whole set rather than one entry:
${record.spec.crossEntryEvidence.map((row) => `\`${row.id}\``).join(", ")}.

The rungs no entry has climbed are listed in the record rather than left to
inference:

${record.spec.openRungs.map((row) => `- ${row}`).join("\n")}

Every path a consumer needs is published in the record, so nothing has to be
reconstructed by convention. That is the consumer-contract rule applied to a
shape the contract did not previously cover.
`;
}
