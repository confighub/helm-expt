#!/usr/bin/env node
// cub-scout diff (dry-run + drift). Verifies each ObjectSetDiffReceipt is
// consistent and GROUNDED: the diff's changed objects must equal the chart's
// value-source-map prediction for the changed value path (so provenance is real,
// not asserted), the diff must be tool-agnostic (deliveredBy includes argo +
// flux), and honesty markers must be present. --generate renders the capability
// comparison matrix (cub-scout, ArgoCD, Flux) + the example rollup.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const root = join(repoRoot, "data", "cub-scout-diff");
const matrixCsv = join(root, "capability-matrix.csv");
const outputs = { summary: join(root, "summary.md"), html: join(root, "matrix.html") };
const KNOWN_STATUS = new Set(["design-example", "proven"]);
const KNOWN_OP = new Set(["dry-run", "drift"]);

function parseCsv(text) {
  return text.split("\n").filter(Boolean).map((line) => {
    const cells = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { cells.push(cur); cur = ""; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

function exampleFiles() {
  const dir = join(root, "examples");
  if (!existsSync(dir)) return [];
  return listFiles(dir).filter((f) => f.endsWith(".yaml")).sort();
}

function checkReceipt(file) {
  const rel = relativeRepo(file);
  const doc = readYaml(file);
  check(doc.kind === "ObjectSetDiffReceipt", `${rel}: not an ObjectSetDiffReceipt`);
  const s = doc.spec ?? {};
  check(KNOWN_STATUS.has(s.status), `${rel}: unknown status "${s.status}"`);
  check(KNOWN_OP.has(s.operation), `${rel}: unknown operation "${s.operation}"`);
  check(Array.isArray(s.notClaimed) && s.notClaimed.length > 0, `${rel}: missing notClaimed honesty markers`);

  const tools = s.deliveredBy ?? [];
  check(s.toolAgnostic === true && tools.includes("argo") && tools.includes("flux"),
    `${rel}: toolAgnostic must be true and deliveredBy must include argo + flux (the diff must be invariant across deliverers)`);

  const diffObjects = [...new Set((s.diff?.changedObjects ?? []).map((o) => o.object))].sort();
  check(diffObjects.length > 0, `${rel}: diff.changedObjects is empty`);
  const predicted = [...new Set(s.provenance?.predictedObjects ?? [])].sort();
  check(JSON.stringify(diffObjects) === JSON.stringify(predicted),
    `${rel}: diff.changedObjects [${diffObjects.join(", ")}] != provenance.predictedObjects [${predicted.join(", ")}]`);

  // Ground the prediction in the real value-source-map (proven 13/13 in blast-radius-accuracy).
  const vsmRel = s.provenance?.valueSourceMapRef ?? "";
  const vsmPath = join(repoRoot, vsmRel);
  check(existsSync(vsmPath), `${rel}: missing value-source-map ${vsmRel}`);
  const entry = (readYaml(vsmPath).spec?.entries ?? []).find((e) => e.valuePath === s.provenance?.valuePath);
  check(entry, `${rel}: ${vsmRel} has no entry for ${s.provenance?.valuePath}`);
  const mapObjects = [...new Set((entry.renderedFields ?? []).map((f) => f.object))].sort();
  check(JSON.stringify(predicted) === JSON.stringify(mapObjects),
    `${rel}: provenance.predictedObjects disagrees with the value-source-map [${mapObjects.join(", ")}]; the diff is not grounded`);

  return { name: doc.metadata?.name ?? rel, chart: `${s.chart}@${s.version}`, operation: s.operation, change: s.change?.valuePath, objects: diffObjects.length, tools: tools.join(" + "), status: s.status };
}

function matrixRows() {
  check(existsSync(matrixCsv), `${relativeRepo(matrixCsv)} is missing`);
  const rows = parseCsv(readFileSync(matrixCsv, "utf8"));
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function build() {
  const matrix = matrixRows();
  const examples = exampleFiles().map(checkReceipt);
  return { matrix, examples, summary: summaryMd(matrix, examples), html: html(matrix, examples) };
}

function summaryMd(matrix, examples) {
  const o = [];
  o.push("# cub-scout Diff: dry-run + drift, GitOps-agnostic", "");
  o.push("Day-1 **dry-run** and day-2 **drift** are the same operation: *desired vs live*. cub-scout already does the boolean form (`object-set-matches`, `drift`); this is the field-level design. It diffs the **held render-once desired data** (deterministic) against the live cluster via **server-side dry-run**, is **GitOps-tool-agnostic** (works under Argo, Flux, or cub-direct), and adds value-provenance, fleet blast-radius, authority, and honest residue. See [the design](../../docs/user/cub-scout-diff-design.md).", "");

  o.push("## Comparison With ArgoCD And Flux", "");
  o.push("| Dimension | cub-scout diff | ArgoCD diff | Flux diff | Why it matters |", "| --- | --- | --- | --- | --- |");
  for (const r of matrix) o.push(`| ${r.dimension} | ${r.cub_scout_diff} | ${r.argocd_diff} | ${r.flux_diff} | ${r.why_it_matters} |`);
  o.push("");

  o.push("## Worked examples (machine-checked, grounded in the value-source-map)", "");
  if (examples.length) {
    o.push("| Receipt | Chart | Operation | Change | Objects | Tool-agnostic across | Status |", "| --- | --- | --- | --- | ---: | --- | --- |");
    for (const e of examples) o.push(`| \`${e.name}\` | ${e.chart} | ${e.operation} | \`${e.change}\` | ${e.objects} | ${e.tools} | ${e.status} |`);
    o.push("", "Each receipt's `diff.changedObjects` is checked to equal the chart's `value-source-map` prediction (proven 13/13 in `blast-radius-accuracy`), so the provenance is real, not asserted.", "");
  } else {
    o.push("_(no example receipts yet)_", "");
  }

  o.push("## Honest scope", "");
  o.push("The schema, the capability matrix, the tool-agnostic invariance, and the value-provenance check are real. The cub-scout **field-level diff command** that runs the server-side dry-run end-to-end is the product piece (frontier); examples are `design-example` until it lands and a live dry-run + drift run agree under Argo, Flux, and cub-direct.", "");
  o.push("## Regenerate", "", "~~~sh", "npm run cub-scout-diff:generate", "npm run cub-scout-diff:verify", "~~~");
  return o.join("\n") + "\n";
}

function html(matrix, examples) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const p = [];
  p.push("<!doctype html><html><head><meta charset=\"utf-8\"><title>cub-scout Diff vs ArgoCD/Flux</title>");
  p.push("<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23}h1{font-size:20px}h2{font-size:15px;margin-top:22px}table{border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #d0d7de;padding:6px 10px;font-size:12.5px;text-align:left;vertical-align:top}th{background:#f6f8fa}td.win{background:#d6f5d6;font-weight:600}.note{color:#57606a;font-size:13px;max-width:64em}</style></head><body>");
  p.push("<h1>cub-scout Diff: dry-run + drift, GitOps-agnostic</h1>");
  p.push("<p class=\"note\">One differ (desired vs live) that serves day-1 dry-run and day-2 drift, works under Argo / Flux / cub-direct, and adds catalog-specific layers such as value provenance, fleet blast radius, authority, and explicit runtime residue.</p>");
  p.push("<table><tr><th>Dimension</th><th>cub-scout diff</th><th>ArgoCD diff</th><th>Flux diff</th><th>Why it matters</th></tr>");
  for (const r of matrix) p.push(`<tr><td>${esc(r.dimension)}</td><td class="win">${esc(r.cub_scout_diff)}</td><td>${esc(r.argocd_diff)}</td><td>${esc(r.flux_diff)}</td><td>${esc(r.why_it_matters)}</td></tr>`);
  p.push("</table>");
  if (examples.length) {
    p.push("<h2>Worked examples (grounded in the value-source-map)</h2><table><tr><th>Receipt</th><th>Chart</th><th>Operation</th><th>Change</th><th>Objects</th><th>Tool-agnostic across</th><th>Status</th></tr>");
    for (const e of examples) p.push(`<tr><td>${esc(e.name)}</td><td>${esc(e.chart)}</td><td>${esc(e.operation)}</td><td>${esc(e.change)}</td><td>${e.objects}</td><td>${esc(e.tools)}</td><td>${esc(e.status)}</td></tr>`);
    p.push("</table>");
  }
  p.push("</body></html>");
  return p.join("\n") + "\n";
}

if (mode === "--generate") {
  const r = build();
  write(outputs.summary, r.summary);
  write(outputs.html, r.html);
  console.log(`wrote cub-scout-diff -> ${relativeRepo(root)}/ (${r.matrix.length} matrix rows, ${r.examples.length} example(s) checked)`);
} else if (mode === "--verify") {
  const r = build();
  const byName = { summary: r.summary, html: r.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run cub-scout-diff:generate`);
    check(readFileSync(path, "utf8") === byName[name], `${relativeRepo(path)} is stale; run npm run cub-scout-diff:generate`);
  }
  console.log(`verified cub-scout-diff: ${r.matrix.length} matrix rows, ${r.examples.length} example(s) grounded + tool-agnostic`);
} else {
  console.log("Usage:\n  node scripts/verify-cub-scout-diff.mjs --generate\n  node scripts/verify-cub-scout-diff.mjs --verify");
}
