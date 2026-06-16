#!/usr/bin/env node

// Validate the per-recipe model-gap fix cards.
//
// Each catalog-owned model-gap row (data/model-gap-workdown) must have a
// recipes/<chart>/<version>/model-gap-fix.yaml fix card, and every card must be a
// well-formed ModelGapFix that names the fix without claiming the cell passes.
// These cards are authored (not generated), so this validates shape rather than
// byte-comparing. Read-only.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const WORKDOWN = "data/model-gap-workdown/workdown.csv";
const FIX_CLASSES = new Set(["base-scope-decision", "applicable-fix-spec", "needs-implementation"]);

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
// unique chart/version that need a fix card
const charts = new Map();
for (const r of rows) charts.set(`${r.chart}|${r.version}`, { chart: r.chart, version: r.version });

let validated = 0;
for (const { chart, version } of charts.values()) {
  const rel = `recipes/${chart}/${version}/model-gap-fix.yaml`;
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `${chart}@${version}: missing model-gap fix card ${rel}`);
  let doc;
  try {
    doc = readYaml(abs);
  } catch (e) {
    check(false, `${rel}: not valid YAML (${e.message})`);
  }
  check(doc?.kind === "ModelGapFix", `${rel}: kind must be ModelGapFix`);
  const spec = doc?.spec ?? {};
  check(typeof spec.gap_kind === "string" && spec.gap_kind.trim() !== "", `${rel}: spec.gap_kind required`);
  check(Array.isArray(spec.bases) && spec.bases.length > 0, `${rel}: spec.bases must be a non-empty list`);
  check(FIX_CLASSES.has(spec.fix_class), `${rel}: spec.fix_class must be one of ${[...FIX_CLASSES].join(" / ")}`);
  check(spec.automatic === false, `${rel}: spec.automatic must be false (a fix card is a plan, not proof of automated execution)`);
  check(Array.isArray(spec.not_claimed) && spec.not_claimed.length > 0, `${rel}: spec.not_claimed must record what the card does not prove`);
  for (const b of spec.bases) {
    check(b && typeof b.base === "string" && b.base.trim() !== "", `${rel}: each base needs a base name`);
    check(typeof b.failure_signature === "string" && b.failure_signature.trim() !== "", `${rel}: base ${b.base} needs a failure_signature`);
  }
  validated += 1;
}

console.log(`verified ${validated} model-gap fix cards (every chart in ${relativeRepo(join(repoRoot, WORKDOWN))} has a well-formed ModelGapFix)`);
