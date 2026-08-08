#!/usr/bin/env node

// A published installer package is a promise: pull this OCI reference and you
// get the bytes this repository shows you. The promise breaks quietly. Editing
// a package after publication changes nothing a reader can see, the catalog
// still says published-receipt, and the site still prints a `cub installer
// setup --pull` command that now fetches something older than the tree beside
// it.
//
// This lane compares each published package's current tree digest against the
// sourceTreeSHA256 its publication receipt recorded, and fails when they differ
// without a declared reason. Drift is allowed, because a package sometimes has
// to be corrected before anyone can republish it. Silent drift is not.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// listFiles and sha256File come from the same helper the publisher uses, so a
// match here means exactly what it meant at publication time.
import { check, listFiles, readYaml, repoRoot, sha256File } from "./lib/proof-common.mjs";

// Each entry says which published package has moved, why, and what clears it.
// An entry is a debt with a date on it, not a permanent exemption.
const DECLARED_DRIFT = Object.freeze({
  "packages/argo-cd/argo-cd/10.1.3": "2026-08-08: gained its packaged CRD bundle for the no-crds base. Awaiting republication.",
  "packages/argo-cd/argo-cd/10.2.1": "2026-08-08: gained its packaged CRD bundle for the no-crds base. Awaiting republication.",
  "packages/external-secrets/external-secrets/2.7.0": "2026-08-08: gained its packaged CRD bundle for the no-crds base. Awaiting republication.",
  "packages/external-secrets/external-secrets/2.8.0": "2026-08-08: gained its packaged CRD bundle for the no-crds base. Awaiting republication.",
  "packages/jetstack/cert-manager/v1.21.0": "2026-08-08: gained its packaged CRD bundle for the default base. Awaiting republication.",
  "packages/karpenter/karpenter/1.14.0": "2026-08-08: gained its packaged CRD bundle for the crds-managed base. Awaiting republication.",
});

const mode = process.argv[2] ?? "--verify";
if (!["--verify", "--report"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-installer-package-publication-drift.mjs --verify
  node scripts/verify-installer-package-publication-drift.mjs --report`);
  process.exit(2);
}

const rows = readCatalogRows();
const published = rows.filter((row) => row.publication_status === "published-receipt");
check(published.length > 0, "no published installer packages found; the catalog is probably stale");

const drifted = [];
const matched = [];
const unbound = [];
for (const row of published) {
  const packageRoot = join(repoRoot, row.package_path);
  check(existsSync(packageRoot), `${row.package_path} is missing but the catalog calls it published`);
  const receiptPath = join(repoRoot, row.publication_receipt);
  check(existsSync(receiptPath), `${row.publication_receipt} is missing for ${row.package_path}`);
  const recorded = readYaml(receiptPath).spec?.package?.sourceTreeSHA256 ?? "";
  if (!recorded) {
    // The publisher only began recording a source tree digest partway through
    // this catalog's life. Older receipts cannot answer the question, and
    // pretending otherwise would be worse than counting them.
    unbound.push(row);
    continue;
  }
  check(/^[0-9a-f]{64}$/.test(recorded), `${row.publication_receipt} records an invalid source tree digest`);
  const actual = treeDigest(packageRoot);
  (actual === recorded ? matched : drifted).push({ ...row, recorded, actual });
}

if (mode === "--report") {
  for (const row of drifted) {
    console.log(`${row.package_path}\n  recorded ${row.recorded}\n  actual   ${row.actual}\n  reason   ${DECLARED_DRIFT[row.package_path] ?? "(undeclared)"}`);
  }
  console.log(`${matched.length} match, ${drifted.length} drifted, ${unbound.length} cannot be checked because their receipt predates the source-tree digest`);
} else {
  const undeclared = drifted.filter((row) => !DECLARED_DRIFT[row.package_path]);
  check(
    undeclared.length === 0,
    `these published packages no longer match the bytes their publication receipt recorded, and declare no reason in scripts/verify-installer-package-publication-drift.mjs: ${undeclared.map((row) => row.package_path).join(", ")}`,
  );
  const stale = Object.keys(DECLARED_DRIFT).filter(
    (path) => !drifted.some((row) => row.package_path === path),
  );
  check(
    stale.length === 0,
    `these packages declare publication drift but now match their receipt, so remove them from DECLARED_DRIFT: ${stale.join(", ")}`,
  );
  console.log(
    `verified ${published.length} published installer package(s): ${matched.length} match their publication receipt, ${drifted.length} declared as awaiting republication, ${unbound.length} unbound because their receipt predates the source-tree digest`,
  );
}

function readCatalogRows() {
  const csvPath = join(repoRoot, "data", "installer-oci-packages", "packages.csv");
  check(existsSync(csvPath), `${csvPath} is missing; run npm run installer-oci:catalog`);
  const lines = readFileSync(csvPath, "utf8").trim().split("\n");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

// The catalog quotes any cell containing a comma, so a naive split loses rows.
function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; continue; }
      quoted = !quoted;
      continue;
    }
    if (character === "," && !quoted) { cells.push(current); current = ""; continue; }
    current += character;
  }
  cells.push(current);
  return cells;
}

// Byte-for-byte identical to the digest the publisher records, so a match here
// means the same thing it meant at publication time.
function treeDigest(root) {
  const hash = createHash("sha256");
  for (const path of listFiles(root)) {
    hash.update(`${path.slice(root.length + 1).replaceAll("\\", "/")}\0`);
    hash.update(`${sha256File(path)}\n`);
  }
  return hash.digest("hex");
}


