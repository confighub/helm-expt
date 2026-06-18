#!/usr/bin/env node
// Fleet blast-radius demo: the paper's scenario #3 ("a fleet-wide change shows
// its blast radius before it happens") as data. For each committed fleet spec
// (recipes/**/fleet.yaml), and each candidate base-value change, compute which
// rendered objects the change touches in each environment, and which
// environments are SHIELDED by an override (override-protection).
//
// The per-environment object set is the PREDICTED blast radius from the chart's
// value-source-map, which data/blast-radius-accuracy proves accurate (13/13).
// Chart-agnostic: drop in another fleet.yaml + value-source-map, no code change.
//
//   node scripts/generate-blast-radius-fleet.mjs --generate
//   node scripts/generate-blast-radius-fleet.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "blast-radius-fleet");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  matrix: join(outputRoot, "matrix.csv"),
  html: join(outputRoot, "matrix.html"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.summary, report.summary);
  write(outputs.matrix, report.csv);
  write(outputs.html, report.html);
  console.log(`wrote blast-radius fleet -> ${relativeRepo(outputRoot)}/ (${report.fleets.length} fleet(s), ${report.rows.length} change-by-environment cell(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  const byName = { summary: report.summary, matrix: report.csv, html: report.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run blast-radius-fleet:generate`);
    check(readFileSync(path, "utf8") === byName[name], `${relativeRepo(path)} is stale; run npm run blast-radius-fleet:generate`);
  }
  console.log(`verified blast-radius fleet: ${report.fleets.length} fleet(s), ${report.rows.length} cell(s)`);
} else {
  console.log(`Usage:\n  node scripts/generate-blast-radius-fleet.mjs --generate\n  node scripts/generate-blast-radius-fleet.mjs --verify`);
}

function fleetSpecs() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((f) => f.endsWith("/fleet.yaml"))
    .sort()
    .map((f) => ({ path: f, doc: readYaml(f) }))
    .filter((x) => x.doc && x.doc.kind === "BlastRadiusFleet");
}

function buildReport() {
  const fleets = [];
  const rows = [];
  for (const { path, doc } of fleetSpecs()) {
    const spec = doc.spec ?? {};
    const vsmPath = join(repoRoot, spec.valueSourceMap);
    check(existsSync(vsmPath), `${relativeRepo(path)} points at missing ${spec.valueSourceMap}`);
    const entries = readYaml(vsmPath).spec?.entries ?? [];
    const envs = spec.environments ?? [];
    const fleet = {
      chart: spec.chart,
      version: String(spec.version),
      name: doc.metadata?.name ?? "",
      note: (spec.note ?? "").trim(),
      vsmRel: spec.valueSourceMap,
      specRel: relativeRepo(path),
      envs,
      changes: [],
    };
    for (const change of spec.changes ?? []) {
      const entry = entries.find((e) => e.valuePath === change.valuePath);
      check(entry, `${relativeRepo(path)}: value-source-map has no entry for ${change.valuePath}`);
      const objects = [...new Set((entry.renderedFields ?? []).map((f) => f.object))].sort();
      const cells = envs.map((env) => {
        const shielded = (env.overrides ?? []).includes(change.valuePath);
        const affected = shielded ? [] : objects;
        rows.push({
          chart: fleet.chart, version: fleet.version, change: change.valuePath, env: env.name,
          status: shielded ? "shielded" : "propagates", affectedCount: affected.length,
          affected, shieldedBy: shielded ? change.valuePath : "",
        });
        return { env: env.name, shielded, affectedCount: affected.length, affected };
      });
      fleet.changes.push({ valuePath: change.valuePath, description: change.description ?? "", baseObjects: objects, cells });
    }
    fleets.push(fleet);
  }
  rows.sort((a, b) => `${a.chart}@${a.version}/${a.change}/${a.env}`.localeCompare(`${b.chart}@${b.version}/${b.change}/${b.env}`));
  return { fleets, rows, summary: summaryMd(fleets), csv: csv(rows), html: html(fleets) };
}

function csv(rows) {
  const header = "chart,version,change_value_path,environment,status,affected_object_count,affected_objects,shielded_by";
  const lines = rows.map((r) => [r.chart, r.version, r.change, r.env, r.status, r.affectedCount, `"${r.affected.join("; ")}"`, r.shieldedBy].join(","));
  return [header, ...lines].join("\n") + "\n";
}

function summaryMd(fleets) {
  const out = [];
  out.push("# Fleet Blast-Radius Demo", "");
  out.push("This generated surface shows the paper's third scenario — *a fleet-wide change shows its blast radius before it happens* — as data: for a base config promoted across a fleet of environment variants, which rendered objects a base-value change would touch in each environment, and which environments are **shielded by an override** (override-protection).", "");
  out.push("The per-environment object set is the *predicted* blast radius from each chart's `value-source-map`, which [`data/blast-radius-accuracy`](../blast-radius-accuracy/summary.md) proves accurate (13/13 recorded cases). An environment that pins a value via an override is shielded from a base change to that value: its explicit choice wins. Re-rendering each environment to confirm the prediction is the rigor upgrade (see *Next*).", "");
  for (const f of fleets) {
    out.push(`## ${f.chart}@${f.version}`, "");
    if (f.note) out.push(f.note, "");
    out.push("Environments and the values each one pins:", "");
    out.push("| Environment | Pins (overrides) |", "| --- | --- |");
    for (const e of f.envs) {
      const pins = (e.overrides ?? []).length ? e.overrides.map((o) => `\`${o}\``).join(", ") : "_(tracks base)_";
      out.push(`| \`${e.name}\` | ${pins} |`);
    }
    out.push("");
    out.push("Blast radius of each base change, per environment:", "");
    const head = ["Base change", ...f.envs.map((e) => `\`${e.name}\``)];
    out.push(`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`);
    for (const c of f.changes) {
      const cells = c.cells.map((cell) => (cell.shielded ? "**shielded**" : `${cell.affectedCount} object${cell.affectedCount === 1 ? "" : "s"}`));
      out.push(`| \`${c.valuePath}\` | ${cells.join(" | ")} |`);
    }
    out.push("");
    out.push("Objects each change touches where it propagates:", "");
    for (const c of f.changes) {
      out.push(`- \`${c.valuePath}\` (${c.description}): ${c.baseObjects.map((o) => `\`${o}\``).join(", ")}`);
    }
    out.push("");
  }
  out.push("## How to read this", "");
  out.push("- **N objects** — the environment inherits the base change; those N rendered objects change there.");
  out.push("- **shielded** — the environment pins that value via an override, so the base change does not reach it. This is the bounded, override-protected case the paper describes: the fleet-wide change is contained *before* it ships.");
  out.push("");
  out.push("## Next (rigor upgrade)", "");
  out.push("- Re-render each environment (base + overrides) before/after the change and diff, like `scripts/record-blast-radius-case.mjs`, to confirm the predicted set against an actual render per environment.");
  out.push("- Add fleets for `bitnami/nginx@24.0.2` and `prometheus-community/kube-prometheus-stack@85.3.3` (the other charts with a value-source-map) by dropping in a `fleet.yaml` — no code change.");
  out.push("- Tie the redis fleet to the live ConfigHub promotion (`helm-redis-mapping-default` -> `helm-redis-mapping-prod-us-east`).");
  out.push("");
  out.push("## Regenerate", "", "~~~sh", "npm run blast-radius-fleet:generate", "npm run blast-radius-fleet:verify", "~~~");
  return out.join("\n") + "\n";
}

function html(fleets) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const maxCount = Math.max(1, ...fleets.flatMap((f) => f.changes.flatMap((c) => c.cells.map((x) => x.affectedCount))));
  const p = [];
  p.push("<!doctype html><html><head><meta charset=\"utf-8\"><title>Fleet Blast-Radius Demo</title>");
  p.push("<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23;background:#fff}h1{font-size:20px}h2{font-size:16px;margin-top:28px}table{border-collapse:collapse;margin:10px 0 18px}th,td{border:1px solid #d0d7de;padding:6px 10px;font-size:13px;text-align:center}th{background:#f6f8fa}td.change{text-align:left;font-family:ui-monospace,Menlo,monospace;white-space:nowrap}.shield{background:#d6f5d6;color:#0a5d0a;font-weight:600}.prop{font-weight:600}.note{color:#57606a;font-size:13px;max-width:62em}.sub{font-weight:400;color:#57606a;font-size:11px}</style></head><body>");
  p.push("<h1>Fleet Blast-Radius Demo</h1>");
  p.push("<p class=\"note\">The paper&#39;s scenario #3 as data: a base change&#39;s blast radius across a fleet of environments, and where an override <b>shields</b> an environment from it. Per-environment object sets are the predicted blast radius from each chart&#39;s value-source-map (proven 13/13 in blast-radius-accuracy). <span class=\"shield\">&nbsp;Green&nbsp;</span> = shielded by an override; red intensity scales with the number of objects touched.</p>");
  for (const f of fleets) {
    p.push(`<h2>${esc(f.chart)}@${esc(f.version)}</h2>`);
    if (f.note) p.push(`<p class="note">${esc(f.note)}</p>`);
    const heads = f.envs.map((e) => {
      const pins = (e.overrides ?? []).length ? `pins ${e.overrides.map(esc).join(", ")}` : "tracks base";
      return `<th>${esc(e.name)}<br><span class="sub">${pins}</span></th>`;
    }).join("");
    p.push(`<table><tr><th>Base change \\ Environment</th>${heads}</tr>`);
    for (const c of f.changes) {
      const cells = c.cells.map((cell) => {
        if (cell.shielded) return `<td class="shield" title="pins ${esc(c.valuePath)}">shielded</td>`;
        const t = Math.min(1, cell.affectedCount / maxCount);
        const bg = `rgba(207,34,46,${(0.1 + 0.5 * t).toFixed(2)})`;
        return `<td class="prop" style="background:${bg}" title="${esc(cell.affected.join(", "))}">${cell.affectedCount} obj</td>`;
      }).join("");
      p.push(`<tr><td class="change" title="${esc(c.description)}">${esc(c.valuePath)}</td>${cells}</tr>`);
    }
    p.push("</table>");
  }
  p.push("</body></html>");
  return p.join("\n") + "\n";
}
