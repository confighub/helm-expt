#!/usr/bin/env node
// User-story spine: the canonical, chart-agnostic product narrative
// (data/user-story/spine.yaml), with two measured properties:
//   1. chart-agnostic reach - each stage's coverageSignal is counted across the
//      whole catalog, so "works for all charts" is a number (catalog-wide /
//      broad / anchor-only / gap), not a claim;
//   2. visibility - which docs and demos carry the spine, so "visible in every
//      doc and demo" is tracked, with the gap listed.
// Deterministic --generate/--verify.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "user-story");
const spinePath = join(root, "spine.yaml");
const outputs = { summary: join(root, "summary.md"), map: join(root, "map.csv"), html: join(root, "matrix.html") };

const recipesFiles = () => listFiles(join(repoRoot, "recipes"));
const variantFiles = () => recipesFiles().filter((f) => /\/variants\/[^/]+\/variant\.yaml$/.test(f));

function withText(files, re) {
  let n = 0;
  for (const f of files) if (re.test(readFileSync(f, "utf8"))) n++;
  return n;
}

// coverageSignal id -> { count, of, note }
function coverage(signal) {
  const recipes = recipesFiles();
  const variants = variantFiles();
  switch (signal) {
    case "installer-packages":
      return { count: listFiles(join(repoRoot, "packages")).filter((f) => f.endsWith("/installer.yaml")).length, of: null, note: "charts with a serverless installer package" };
    case "recipes":
      return { count: recipes.filter((f) => f.endsWith("/recipe.yaml")).length, of: null, note: "imported recipes" };
    case "greenfield":
      return { count: 0, of: null, note: "no greenfield-authored units yet (import-focused)" };
    case "variants":
      return { count: variants.length, of: null, note: "committed variants" };
    case "capability-profile":
      return { count: withText(variants, /\bcapabilityProfile:/), of: variants.length, note: "variants that pin a capability profile (preview determinism)" };
    case "value-source-maps":
      return { count: recipes.filter((f) => f.endsWith("/value-source-map.yaml")).length, of: null, note: "charts with a value-source-map (dry-run provenance)" };
    case "target-fact-variants":
      return { count: withText(variants, /\btargetFacts:/), of: variants.length, note: "variants that declare target facts (lifecycle prerequisites)" };
    case "reverse-reconcile-design":
      return { count: null, of: null, note: "design example (#986, in review)" };
    default:
      return { count: null, of: null, note: `unknown coverage signal: ${signal}` };
  }
}

function reach({ count, of }) {
  if (count === null) return "qualitative";
  if (count === 0) return "gap";
  if (of && count / of >= 0.9) return "catalog-wide";
  if (count >= 20) return "broad";
  return "anchor-only";
}

function visibility() {
  const docs = listFiles(join(repoRoot, "docs")).filter((f) => f.endsWith(".md"));
  const ref = /user-story|User story/;
  const isDemo = (f) => f.includes("/docs/demo/");
  const carries = docs.filter((f) => ref.test(readFileSync(f, "utf8")));
  const demos = docs.filter(isDemo);
  const demosCarrying = demos.filter((f) => ref.test(readFileSync(f, "utf8")));
  const missingDemos = demos.filter((f) => !ref.test(readFileSync(f, "utf8"))).map((f) => relativeRepo(f)).sort();
  return { totalDocs: docs.length, docsCarrying: carries.length, totalDemos: demos.length, demosCarrying: demosCarrying.length, missingDemos };
}

function build() {
  check(existsSync(spinePath), `${relativeRepo(spinePath)} is missing`);
  const spine = readYaml(spinePath).spec ?? {};
  const stages = (spine.stages ?? []).map((s) => {
    const cov = coverage(s.coverageSignal);
    return { ...s, ...cov, reach: reach(cov) };
  });
  const cross = spine.crossCutting ?? [];
  const vis = visibility();
  return { spine, stages, cross, vis, summary: summaryMd(spine, stages, cross, vis), map: csv(stages), html: html(stages, vis) };
}

function covText(s) {
  if (s.count === null) return "qualitative";
  return s.of ? `${s.count}/${s.of}` : `${s.count}`;
}

function csv(stages) {
  const header = "stage_id,title,coverage_signal,coverage_count,coverage_of,reach,evidence";
  const lines = stages.map((s) => [s.id, `"${s.title}"`, s.coverageSignal, s.count === null ? "" : s.count, s.of ?? "", s.reach, `"${s.evidence}"`].join(","));
  return [header, ...lines].join("\n") + "\n";
}

function summaryMd(spine, stages, cross, vis) {
  const o = [];
  o.push("# User Story: Spine, Coverage, and Visibility", "");
  o.push("The canonical product narrative, **chart-agnostic** and **measured**. Every stage is a capability counted across the catalog (so \"works for all charts\" is a number), and doc/demo visibility is tracked (so \"visible everywhere\" stays honest). Narrative: [docs/user/user-story.md](../../docs/user/user-story.md); machine-readable: [spine.yaml](spine.yaml).", "");
  o.push(`> ${spine.oneLine.trim()}`, "");

  o.push("## Stage coverage across the catalog", "");
  o.push("| Stage | Story | Coverage | Reach | Evidence |", "| --- | --- | --- | --- | --- |");
  for (const s of stages) o.push(`| **${s.title}** | ${s.story} | ${covText(s)} | ${s.reach} | ${s.evidence} |`);
  o.push("");
  o.push("Reach: **catalog-wide** (>=90% of variants) · **broad** (>=20 charts) · **anchor-only** (a few) · **gap** (none yet) · **qualitative** (design/narrative).", "");

  o.push("## Cross-cutting lenses (every stage, every chart)", "");
  for (const c of cross) o.push(`- **${c.id}** — ${c.lens}`);
  o.push("");

  o.push("## Visibility across docs & demos", "");
  o.push(`- **${vis.docsCarrying}/${vis.totalDocs}** docs reference the user story.`);
  o.push(`- **${vis.demosCarrying}/${vis.totalDemos}** demo pages carry the spine.`);
  if (vis.missingDemos.length) {
    o.push("", "Demos still missing the spine banner (drive to zero):", "");
    for (const m of vis.missingDemos.slice(0, 12)) o.push(`- \`${m}\``);
    if (vis.missingDemos.length > 12) o.push(`- … and ${vis.missingDemos.length - 12} more`);
  }
  o.push("");

  o.push("## Honest gaps", "");
  for (const s of stages.filter((x) => x.reach === "gap" || x.reach === "anchor-only")) o.push(`- **${s.title}** (${covText(s)}, ${s.reach}) — ${s.note}`);
  o.push("");

  o.push("## Next", "");
  o.push("- Roll the one-line spine banner into every doc and demo until visibility is 100% (tracked above).");
  o.push("- The dry-run vs ArgoCD comparison (day-1 dry-run), chart-agnostic, under #989.");
  o.push("- Lift the thin stages: greenfield (write-green) authoring; value-source-map reach beyond the anchor charts; stacks-as-bundles.");
  o.push("");
  o.push("## Regenerate", "", "~~~sh", "npm run user-story:generate", "npm run user-story:verify", "~~~");
  return o.join("\n") + "\n";
}

function html(stages, vis) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const color = { "catalog-wide": "#d6f5d6", broad: "#e7f7d6", "anchor-only": "#ffe1c2", gap: "#f8d7da", qualitative: "#eef1f4" };
  const p = [];
  p.push("<!doctype html><html><head><meta charset=\"utf-8\"><title>User Story Spine</title>");
  p.push("<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23}h1{font-size:20px}h2{font-size:15px;margin-top:22px}table{border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #d0d7de;padding:6px 10px;font-size:12.5px;text-align:left}th{background:#f6f8fa}.note{color:#57606a;font-size:13px;max-width:62em}</style></head><body>");
  p.push("<h1>User Story Spine</h1>");
  p.push("<p class=\"note\">Chart-agnostic: each stage's reach is counted across the catalog. <span style=\"background:#d6f5d6\">&nbsp;catalog-wide&nbsp;</span> <span style=\"background:#ffe1c2\">&nbsp;anchor-only&nbsp;</span> <span style=\"background:#f8d7da\">&nbsp;gap&nbsp;</span> <span style=\"background:#eef1f4\">&nbsp;qualitative&nbsp;</span></p>");
  p.push("<table><tr><th>Stage</th><th>Coverage</th><th>Reach</th><th>Evidence</th></tr>");
  for (const s of stages) p.push(`<tr style="background:${color[s.reach] ?? "#fff"}"><td><b>${esc(s.title)}</b><br><span class="note">${esc(s.story)}</span></td><td>${esc(covText(s))}</td><td>${esc(s.reach)}</td><td>${esc(s.evidence)}</td></tr>`);
  p.push("</table>");
  p.push(`<h2>Visibility</h2><p class="note">${vis.docsCarrying}/${vis.totalDocs} docs reference the user story; ${vis.demosCarrying}/${vis.totalDemos} demo pages carry the spine. Driving this to 100% is tracked in the summary.</p>`);
  p.push("</body></html>");
  return p.join("\n") + "\n";
}

if (mode === "--generate") {
  const r = build();
  write(outputs.summary, r.summary);
  write(outputs.map, r.map);
  write(outputs.html, r.html);
  console.log(`wrote user-story -> ${relativeRepo(root)}/ (${r.stages.length} stages; visibility ${r.vis.demosCarrying}/${r.vis.totalDemos} demos)`);
} else if (mode === "--verify") {
  const r = build();
  const byName = { summary: r.summary, map: r.map, html: r.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run user-story:generate`);
    check(readFileSync(path, "utf8") === byName[name], `${relativeRepo(path)} is stale; run npm run user-story:generate`);
  }
  check(r.vis.demosCarrying === r.vis.totalDemos, `${r.vis.totalDemos - r.vis.demosCarrying} demo page(s) are missing the user-story spine banner; the story must be visible in every demo (run /tmp injector or add the banner; see ${relativeRepo(outputs.summary)})`);
  console.log(`verified user-story: ${r.stages.length} stages, ${r.cross.length} cross-cutting lenses, visibility ${r.vis.demosCarrying}/${r.vis.totalDemos} demos`);
} else {
  console.log("Usage:\n  node scripts/generate-user-story.mjs --generate\n  node scripts/generate-user-story.mjs --verify");
}
