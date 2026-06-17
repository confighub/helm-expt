#!/usr/bin/env node

// Validate the per-recipe image-remediation cards.
//
// Every remote-image watch row (data/remote-image-runtime-workdown) must have a
// recipes/<chart>/<version>/image-remediation.yaml card, and every card must be a
// well-formed ImageRemediation that names the remediation without claiming the
// image is pullable or the cell passes. These cards are authored (not generated),
// so this validates shape AND grounds each base against the workdown row it cites
// (missing_images, receipt, and the full base set must match) so a card cannot
// drift from the committed evidence. Read-only.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const WORKDOWN = "data/remote-image-runtime-workdown/workdown.csv";
const REMEDIATION_CLASSES = new Set(["registry-remap", "image-override", "needs-decision"]);
// every remote-image row is recorded under the live-helm-vs-ConfigHub comparison,
// which is the G/P lane; the card's lane label must match that receipt provenance.
const LANE = "G/P";
const RECEIPT_LANE_MARKER = "live-helm-confighub-compare";

function parseCsv(text) {
  const rows = [];
  let field = "", row = [], q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else q = false; } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCsv(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

const rows = readCsv(WORKDOWN);

// index the authoritative workdown: per chart/version the set of bases, and per
// chart/version/base the cited missing_images + receipt.
const charts = new Map(); // chart|version -> { chart, version, bases: Map(base -> row) }
for (const r of rows) {
  const key = `${r.chart}|${r.version}`;
  if (!charts.has(key)) charts.set(key, { chart: r.chart, version: r.version, bases: new Map() });
  charts.get(key).bases.set(r.base, r);
}

let validated = 0;
let basesChecked = 0;
for (const { chart, version, bases } of charts.values()) {
  const rel = `recipes/${chart}/${version}/image-remediation.yaml`;
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `${chart}@${version}: missing image-remediation card ${rel}`);
  let doc;
  try {
    doc = readYaml(abs);
  } catch (e) {
    check(false, `${rel}: not valid YAML (${e.message})`);
  }
  check(doc?.kind === "ImageRemediation", `${rel}: kind must be ImageRemediation`);
  const spec = doc?.spec ?? {};
  check(spec.residue === "remote-image", `${rel}: spec.residue must be remote-image`);
  check(REMEDIATION_CLASSES.has(spec.remediation_class), `${rel}: spec.remediation_class must be one of ${[...REMEDIATION_CLASSES].join(" / ")}`);
  check(spec.automatic === false, `${rel}: spec.automatic must be false (a remediation card is a plan, not proof of a pullable image)`);
  check(Array.isArray(spec.not_claimed) && spec.not_claimed.length > 0, `${rel}: spec.not_claimed must record what the card does not prove`);
  check(Array.isArray(spec.bases) && spec.bases.length > 0, `${rel}: spec.bases must be a non-empty list`);

  // the card must cover exactly the bases the workdown records for this chart/version
  const cardBases = new Set(spec.bases.map((b) => b?.base));
  for (const wb of bases.keys()) {
    check(cardBases.has(wb), `${rel}: missing base "${wb}" that the workdown records as a remote-image watch`);
  }
  for (const cb of cardBases) {
    check(bases.has(cb), `${rel}: base "${cb}" is not a remote-image watch row in ${WORKDOWN}`);
  }

  for (const b of spec.bases) {
    const wrow = bases.get(b.base);
    check(typeof b.base === "string" && b.base.trim() !== "", `${rel}: each base needs a base name`);
    check(b.lane === LANE, `${rel}: base ${b.base} lane must be ${LANE} (remote-image rows live in the live-helm-vs-ConfigHub lane)`);
    check(typeof b.failure_signature === "string" && b.failure_signature.trim() !== "", `${rel}: base ${b.base} needs a failure_signature`);
    // ground the cited image + receipt against the workdown row, byte-for-byte
    check(b.missing_images === wrow.missing_images, `${rel}: base ${b.base} missing_images must match the workdown (card="${b.missing_images}" workdown="${wrow.missing_images}")`);
    check(b.receipt === wrow.receipt, `${rel}: base ${b.base} receipt must match the workdown (card="${b.receipt}" workdown="${wrow.receipt}")`);
    check(typeof b.receipt === "string" && b.receipt.includes(RECEIPT_LANE_MARKER), `${rel}: base ${b.base} receipt must be a ${RECEIPT_LANE_MARKER} receipt`);
    check(existsSync(join(repoRoot, b.receipt)), `${rel}: base ${b.base} receipt file is missing on disk: ${b.receipt}`);
    check(typeof b.rerun_command === "string" && b.rerun_command.startsWith("npm run live-parity:run"), `${rel}: base ${b.base} rerun_command must invoke the live-parity runner`);
    basesChecked += 1;
  }
  validated += 1;
}

console.log(`verified ${validated} image-remediation cards across ${basesChecked} bases (every chart in ${relativeRepo(join(repoRoot, WORKDOWN))} has a well-formed ImageRemediation grounded in its workdown row)`);
