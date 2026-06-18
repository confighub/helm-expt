#!/usr/bin/env node
// Preview & Dry-Run readiness. Classifies each preview-breaking Helm quirk (from
// data/quirk-coverage/coverage.csv) by how it relates to a PRE-DEPLOY preview:
//   shift-left     - the live-dependence can be captured as config/data before
//                    deploy (capability profile, target fact, generated-fact
//                    receipt, pinned renderer), so the render is a pure function
//                    and is previewable + diffable;
//   runtime-residue- cannot be pre-rendered (post-renderer, getHostByName,
//                    uncaptured nondeterminism) -> declared + witnessed, not faked;
//   lifecycle      - a day-2 concern (uninstall/upgrade/ordering), not a
//                    pre-deploy preview question.
// Plus per-anchor-chart readiness from the real shift-left artifacts, and
// catalog-wide adoption of those artifacts. Deterministic --generate/--verify.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "preview-readiness");
const coveragePath = join(repoRoot, "data", "quirk-coverage", "coverage.csv");
const outputs = { summary: join(root, "summary.md"), quirks: join(root, "quirks.csv"), html: join(root, "matrix.html") };

// Authored: how each quirk axis relates to a pre-deploy preview.
// [disposition, mechanism]
const DISP = {
  "lookup-target-facts": ["shift-left", "target fact (read from config or live, pre-deploy)"],
  "generated-facts": ["shift-left", "generated-fact receipt (capture once, reuse)"],
  "capability-profile": ["shift-left", "capability profile pins kubeVersion + apiVersions"],
  "helm-flag-profile": ["shift-left", "pinned renderer flags in the render receipt"],
  "hook-phase": ["shift-left", "hook-minted object declared as a target fact; hook execution witnessed"],
  "crds": ["shift-left", "CRDs in the render, or staged as a target fact"],
  "install-vs-upgrade": ["shift-left", "render-once is install-shaped; upgrade reuse via held data"],
  "dependency-lock": ["shift-left", "dependencies locked -> deterministic render"],
  "library-chart": ["shift-left", "locked dependency"],
  "dependency-alias": ["shift-left", "locked dependency"],
  "import-values": ["shift-left", "deterministic given captured values (scan gap)"],
  "required-or-fail": ["shift-left", "required values captured as an input contract"],
  "values-schema": ["shift-left", "values.schema.json input contract"],
  "tpl-extension-slots": ["shift-left", "deterministic given captured values"],
  "explicit-extension-slot-control-points": ["shift-left", "captured as control points / values"],
  "semver-compare": ["shift-left", "deterministic given pinned versions"],
  "files-get": ["shift-left", "bundled files vendored with the chart"],
  "global-values": ["shift-left", "deterministic given captured values (scan gap)"],
  "helm-version-branching": ["shift-left", "pin the Helm version in the render receipt"],
  "time-uuid-functions": ["runtime-residue", "nondeterministic per render; capture-once or witness"],
  getHostByName: ["runtime-residue", "DNS at render; bind a captured fact or witness"],
  "post-renderer": ["runtime-residue", "final applied object differs from helm template; pin a recipe stage or witness"],
  "hook-delete-policy": ["lifecycle", "uninstall/rerun cleanup behavior (day-2, not preview)"],
  "hook-weight-ordering": ["lifecycle", "hook sequencing (day-2, not preview)"],
  "crd-upgrade-behavior": ["lifecycle", "CRD schema upgrade safety (day-2, not preview)"],
  "resource-policy-keep": ["lifecycle", "uninstall/prune orphans (day-2, not preview)"],
};

const ANCHORS = [
  { cv: "ingress-nginx/ingress-nginx/4.15.1", note: "lookup + hook-minted admission cert + capability-sensitive apiVersions" },
  { cv: "jetstack/cert-manager/v1.20.2", note: "CRDs as target facts; controller-minted webhook cert" },
  { cv: "bitnami/redis/25.5.3", note: "generated auth secret captured as a generated-fact receipt" },
  { cv: "prometheus-community/kube-prometheus-stack/85.3.3", note: "CRDs, admission webhook, capabilities, hooks" },
];

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

function previewable(disp, tier) {
  if (disp === "lifecycle") return "n/a (day-2)";
  if (disp === "runtime-residue") return "no (witness)";
  return tier === "tracked-and-surfaced" ? "yes" : "partial";
}

function quirkRows() {
  check(existsSync(coveragePath), `${relativeRepo(coveragePath)} is missing`);
  const rows = parseCsv(readFileSync(coveragePath, "utf8"));
  const header = rows[0];
  const col = (name) => header.indexOf(name);
  const out = rows.slice(1).map((r) => {
    const axis = r[col("axis")];
    const tier = r[col("coverage_tier")];
    const [disposition, mechanism] = DISP[axis] ?? ["unclassified", "(new axis - classify in generate-preview-readiness.mjs)"];
    return {
      axis,
      disposition,
      mechanism,
      coverage_tier: tier,
      source_top100: r[col("source_top100_count")],
      modeled: r[col("modeled_or_supported_count")],
      previewable: previewable(disposition, tier),
    };
  });
  out.sort((a, b) => {
    const order = { "shift-left": 0, "runtime-residue": 1, lifecycle: 2, unclassified: 3 };
    return (order[a.disposition] - order[b.disposition]) || a.axis.localeCompare(b.axis);
  });
  return out;
}

function adoption() {
  const files = listFiles(join(repoRoot, "recipes")).filter((f) => f.endsWith("/variants/default/variant.yaml") || /\/variants\/[^/]+\/variant\.yaml$/.test(f));
  let total = 0, cap = 0, tf = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    total++;
    if (/\bcapabilityProfile:/.test(text)) cap++;
    if (/\btargetFacts:/.test(text)) tf++;
  }
  const genfacts = listFiles(join(repoRoot, "recipes")).filter((f) => f.endsWith("/generated-fact-receipt.yaml")).length;
  const collectors = listFiles(join(repoRoot, "packages")).filter((f) => f.endsWith("/collector/target-facts.sh")).length;
  return { variants: total, cap, tf, genfacts, collectors };
}

function anchorReadiness() {
  return ANCHORS.map((a) => {
    const spec = readYaml(join(repoRoot, "recipes", a.cv, "variants", "default", "variant.yaml")).spec ?? {};
    const cap = !!spec.capabilityProfile;
    const tfObj = spec.targetFacts ?? {};
    const hasPrereqs = ["requiredSecrets", "requiredCRDs", "requiredValues"].some((k) => Array.isArray(tfObj[k]) && tfObj[k].length > 0);
    const genfacts = existsSync(join(repoRoot, "recipes", a.cv, "revisions", "default", "r001", "receipts", "generated-fact-receipt.yaml"));
    const verdict = !cap ? "render not yet pinned" : hasPrereqs ? "previewable + declared prerequisites (witnessed)" : "fully previewable pre-deploy";
    return { cv: a.cv, note: a.note, cap, hasPrereqs, genfacts, hookPolicy: spec.hookPolicy ?? "(unset)", verdict };
  });
}

function csv(rows) {
  const header = "axis,preview_disposition,mechanism,coverage_tier,source_top100_count,modeled_or_supported_count,previewable";
  const lines = rows.map((r) => [r.axis, r.disposition, `"${r.mechanism}"`, r.coverage_tier, r.source_top100, r.modeled, `"${r.previewable}"`].join(","));
  return [header, ...lines].join("\n") + "\n";
}

function summaryMd(rows, adopt, anchors) {
  const count = (d) => rows.filter((r) => r.disposition === d).length;
  const o = [];
  o.push("# Preview & Dry-Run Readiness", "");
  o.push("Helm's render is not a pure function of `(chart, values)` — it depends on live cluster state at install time (`lookup`, `.Capabilities`, hooks, generated values, post-render mutation), so a naive `helm template` preview is untrustworthy for serious charts. The answer is not to re-render on every preview; it is to **render once at import, capturing the live-dependence as data, then preview/diff the held data**. The quirks become a one-time import problem. This surface names every preview-breaking quirk and says whether it is **shift-left-resolved** (captured into config pre-deploy) or **runtime residue** (declared + witnessed, never faked).", "");
  o.push(`Of ${rows.length} tracked Helm quirk axes: **${count("shift-left")} shift-left** (config-resolvable, previewable), **${count("runtime-residue")} runtime residue** (witnessed after apply), **${count("lifecycle")} lifecycle/day-2** (not a preview question)${count("unclassified") ? `, ${count("unclassified")} unclassified` : ""}. The unpreviewable surface is small and named.`, "");

  o.push("## Quirk -> preview disposition", "");
  o.push("| Quirk axis | Disposition | Mechanism | Coverage tier | Previewable |", "| --- | --- | --- | --- | --- |");
  for (const r of rows) o.push(`| \`${r.axis}\` | ${r.disposition} | ${r.mechanism} | ${r.coverage_tier} | ${r.previewable} |`);
  o.push("");

  o.push("## Shift-left adoption across the catalog", "");
  o.push(`- **${adopt.cap}/${adopt.variants}** variants pin a \`capabilityProfile\` (capabilities shifted left)`);
  o.push(`- **${adopt.tf}** variants declare \`targetFacts\` (lookup / hook-minted state shifted left)`);
  o.push(`- **${adopt.collectors}** \`collector/target-facts.sh\` scripts (read a fact from config or live, pre-deploy)`);
  o.push(`- **${adopt.genfacts}** generated-fact receipts (generated values captured, not regenerated)`);
  o.push("");

  o.push("## Per-chart readiness (anchor charts)", "");
  o.push("| Chart | capabilities pinned | declared prerequisites | generated-fact captured | verdict |", "| --- | --- | --- | --- | --- |");
  for (const a of anchors) o.push(`| \`${a.cv}\` | ${a.cap ? "yes" : "no"} | ${a.hasPrereqs ? "yes (witnessed)" : "none"} | ${a.genfacts ? "yes" : "no"} | **${a.verdict}** |`);
  o.push("");

  o.push("## Worked example: ingress-nginx", "");
  o.push("ingress-nginx is the hard case — it has all three classic preview-breakers.", "");
  o.push("- **Naive `helm template`** is wrong: the admission webhook certificate is minted by a hook Job at install (absent from a no-hooks render), the webhook `caBundle` is hook-patched afterwards, and the emitted PDB/Ingress apiVersions depend on the target's `.Capabilities`.");
  o.push("- **Shift-left preview** is right: the committed render is captured with a pinned `capabilityProfile` (`kubeVersion: 1.30.0`), and the hook-minted admission cert is declared as a `targetFact` (`requiredSecrets: ingress-nginx/ingress-nginx-admission`, *\"normally created by Helm hook jobs\"*), resolvable from config or live via the collector (`record`/`live` modes). The preview now states exactly what deploys **and** what must pre-exist.");
  o.push("- **Residue:** the cert *content* and the live `caBundle` are not pre-rendered — they are witnessed after apply (cub-scout), not faked.");
  o.push("");

  o.push("## Honest residue (the genuinely unpreviewable surface)", "");
  o.push("These cannot be made a pure function of captured config; the honest answer is declare + witness, never a fake preview:", "");
  for (const r of rows.filter((x) => x.disposition === "runtime-residue")) o.push(`- \`${r.axis}\` — ${r.mechanism}`);
  o.push("");

  o.push("## Next (breadth + rigor upgrades)", "");
  o.push("- A full top-100 roll-up: join `data/chart-facts/chart-facts.csv` (which quirks each chart has) with recipe artifacts to give a per-chart previewable verdict for the whole catalog.");
  o.push("- A live `helm template` vs shift-left render diff for ingress-nginx, committed as evidence (turns the worked example from described to measured).");
  o.push("- Promote the `not-scanned` residue axes (post-renderer, getHostByName, helm-version-branching) into scanner detection so a chart cannot hide an unpreviewable dependence.");
  o.push("");
  o.push("## Regenerate", "", "~~~sh", "npm run preview-readiness:generate", "npm run preview-readiness:verify", "~~~");
  return o.join("\n") + "\n";
}

function html(rows, anchors) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const color = { "shift-left": "#d6f5d6", "runtime-residue": "#ffe1c2", lifecycle: "#eef1f4", unclassified: "#f8d7da" };
  const p = [];
  p.push("<!doctype html><html><head><meta charset=\"utf-8\"><title>Preview &amp; Dry-Run Readiness</title>");
  p.push("<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23}h1{font-size:20px}h2{font-size:15px;margin-top:24px}table{border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #d0d7de;padding:5px 9px;font-size:12.5px;text-align:left}th{background:#f6f8fa}code{font-family:ui-monospace,Menlo,monospace}.note{color:#57606a;font-size:13px;max-width:64em}</style></head><body>");
  p.push("<h1>Preview &amp; Dry-Run Readiness</h1>");
  p.push("<p class=\"note\">Each preview-breaking Helm quirk, classified by whether it is <b>shift-left</b> (captured into config pre-deploy &rarr; previewable), <b>runtime-residue</b> (witnessed after apply, never faked), or a <b>lifecycle</b> day-2 concern. <span style=\"background:#d6f5d6\">&nbsp;green&nbsp;</span> shift-left &middot; <span style=\"background:#ffe1c2\">&nbsp;amber&nbsp;</span> runtime-residue &middot; <span style=\"background:#eef1f4\">&nbsp;grey&nbsp;</span> lifecycle.</p>");
  p.push("<h2>Quirk &rarr; preview disposition</h2><table><tr><th>Quirk axis</th><th>Disposition</th><th>Mechanism</th><th>Coverage tier</th><th>Previewable</th></tr>");
  for (const r of rows) p.push(`<tr style="background:${color[r.disposition] ?? "#fff"}"><td><code>${esc(r.axis)}</code></td><td>${esc(r.disposition)}</td><td>${esc(r.mechanism)}</td><td>${esc(r.coverage_tier)}</td><td>${esc(r.previewable)}</td></tr>`);
  p.push("</table>");
  p.push("<h2>Per-chart readiness (anchor charts)</h2><table><tr><th>Chart</th><th>capabilities pinned</th><th>declared prerequisites</th><th>generated-fact captured</th><th>verdict</th></tr>");
  for (const a of anchors) p.push(`<tr><td><code>${esc(a.cv)}</code></td><td>${a.cap ? "yes" : "no"}</td><td>${a.hasPrereqs ? "yes (witnessed)" : "none"}</td><td>${a.genfacts ? "yes" : "no"}</td><td><b>${esc(a.verdict)}</b></td></tr>`);
  p.push("</table></body></html>");
  return p.join("\n") + "\n";
}

function build() {
  const rows = quirkRows();
  const adopt = adoption();
  const anchors = anchorReadiness();
  return { rows, summary: summaryMd(rows, adopt, anchors), csv: csv(rows), html: html(rows, anchors), counts: { quirks: rows.length, residue: rows.filter((r) => r.disposition === "runtime-residue").length } };
}

if (mode === "--generate") {
  const r = build();
  write(outputs.summary, r.summary);
  write(outputs.quirks, r.csv);
  write(outputs.html, r.html);
  console.log(`wrote preview-readiness -> ${relativeRepo(root)}/ (${r.counts.quirks} quirk axes, ${r.counts.residue} runtime-residue)`);
} else if (mode === "--verify") {
  const r = build();
  const byName = { summary: r.summary, quirks: r.csv, html: r.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run preview-readiness:generate`);
    check(readFileSync(path, "utf8") === byName[name], `${relativeRepo(path)} is stale; run npm run preview-readiness:generate`);
  }
  console.log(`verified preview-readiness: ${r.counts.quirks} quirk axes classified, ${r.counts.residue} runtime-residue`);
} else {
  console.log("Usage:\n  node scripts/generate-preview-readiness.mjs --generate\n  node scripts/generate-preview-readiness.mjs --verify");
}
