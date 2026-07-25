#!/usr/bin/env node
// Per-chart "adoption caveats": where a chart needs a heads-up vs plain Helm, and how it's managed.
// Synthesizes the adoption-audit findings (PRs #1009/#1012/#1013/#1015/#1017 + the managed fixes
// #1019/#1020) into a per-chart surface, so a user evaluating a specific chart sees the rough edges
// that apply to IT and the exact remediation.
//
// Two kinds of caveat:
//   - PER-CHART (vary by chart): default bases that still bake shared placeholder passwords
//     (#1012), CRDs that need first-ordering on cub-direct (#1015). Detected offline from each
//     package's default base.
//   - UNIVERSAL (every chart, cub-direct path): customize via --input not --set (#1009),
//     upgrades don't auto-prune (#1013), server-side-apply conflicts on a manual edit (#1017).
//     Stated once; all are handled by a controller or the managed applier (#1019/#1020).
//
// Fully offline: reads packages/<owner>/<chart>/<ver>/installer.yaml (spec.bases[].default + the
// reuse-secret base's suggestedSource) and the default base's upstream.yaml. Secret VALUES are
// never decoded or printed — only password key names are read (credential constraint).
//
// CRD first-ordering is counted from two places, because a chart that separates its CRDs out
// removes them from the render: (a) CustomResourceDefinition objects in the default base's rendered
// upstream.yaml, and (b) CRD entries in the default base's externalRequires (the first-ordering
// requirements the lifecycle table reads). Counting only (a) reported ships_crds=no for exactly the
// charts that pull CRDs into (b), which is the first-ordering case the caveat exists to flag.
//
// Usage:
//   node scripts/generate-cub-adoption-caveats.mjs --generate
//   node scripts/generate-cub-adoption-caveats.mjs --verify
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { check, py, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const packagesDir = join(repoRoot, "packages");
const csvPath = join(repoRoot, "data", "cub-adoption-caveats", "caveats.csv");
const mdPath = join(repoRoot, "data", "cub-adoption-caveats", "summary.md");
const htmlPath = join(repoRoot, "data", "cub-adoption-caveats", "summary.html");

const UNIVERSAL = [
  { id: "customize", title: "Customize with `--input` or a base edit, not Helm's `--set`", detail: "cub rejects `--set`/`--values` (the typo guard); declared values use `--input`, the rest by choosing/editing a kustomize base.", managed: "Guided errors + migration cheat-sheet (#1020, docs/user/helm-to-cub-migration.md)." },
  { id: "prune", title: "Upgrades don't auto-delete removed objects on cub-direct", detail: "A plain `kubectl apply` leaves orphans when an upgrade removes a resource.", managed: "Managed applier uses `--prune` (#1019), or use a controller (Argo/Flux) which prunes natively." },
  { id: "ssa-conflict", title: "A manual `kubectl edit` conflicts on server-side re-apply", detail: "Safer than Helm's silent overwrite, but a Helm user expects the overwrite.", managed: "Managed applier surfaces a plain-words message + `--force-conflicts` (#1019)." },
];

// One python pass over all default-base upstream files: report baked password KEY names + CRD names.
// Never decodes/prints Secret values.
const PY_DETECT = `import sys, json, yaml
items = json.loads(sys.stdin.read())
out = {}
for it in items:
    res = {'pw': [], 'crd': []}
    try:
        for o in yaml.safe_load_all(open(it['path'])):
            if not isinstance(o, dict):
                continue
            if o.get('kind') == 'Secret':
                for k, v in (o.get('data') or {}).items():
                    if ('password' in k.lower() or 'passwd' in k.lower()) and isinstance(v, str) and v.strip():
                        res['pw'].append(k)
                for k, v in (o.get('stringData') or {}).items():
                    if ('password' in k.lower() or 'passwd' in k.lower()) and isinstance(v, str) and v.strip():
                        res['pw'].append(k)
            if o.get('kind') == 'CustomResourceDefinition':
                nm = (o.get('metadata') or {}).get('name')
                if nm:
                    res['crd'].append(nm)
    except Exception as e:
        res['error'] = str(e)[:140]
    res['pw'] = sorted(set(res['pw']))
    res['crd'] = sorted(set(res['crd']))
    out[it['key']] = res
print(json.dumps(out))`;

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };

// Enumerate one row per chart: the latest version dir that has an installer.yaml.
function listCharts() {
  const charts = [];
  for (const owner of readdirSync(packagesDir).filter((o) => isDir(join(packagesDir, o)))) {
    const ownerDir = join(packagesDir, owner);
    for (const name of readdirSync(ownerDir).filter((c) => isDir(join(ownerDir, c)))) {
      const chartDir = join(ownerDir, name);
      const versions = readdirSync(chartDir).filter((v) => existsSync(join(chartDir, v, "installer.yaml"))).sort();
      if (!versions.length) continue;
      const version = versions[versions.length - 1];
      charts.push({ key: `${owner}/${name}`, owner, name, version, dir: join(chartDir, version) });
    }
  }
  return charts.sort((a, b) => a.key.localeCompare(b.key));
}

function basesOf(dir) {
  try { return readYaml(join(dir, "installer.yaml"))?.spec?.bases ?? []; } catch { return []; }
}

function chartSlug(chart) {
  return chart.replaceAll("/", "-");
}

function receiptResult(rel) {
  const p = join(repoRoot, rel);
  if (!existsSync(p)) return "";
  try {
    const doc = readYaml(p) ?? {};
    return doc.spec?.result ?? doc.result ?? "";
  } catch {
    return "";
  }
}

function hasBlockedLiveReceipt(chart, base) {
  const slug = chartSlug(chart);
  const paths = [
    `data/runtime-gitops/receipts/${slug}/${base}/latest.yaml`,
    `runs/live-kind-parity/${slug}-${base}/receipt.yaml`,
    `runs/live-helm-confighub-compare/${slug}-${base}/receipt.yaml`,
  ];
  return paths.some((path) => receiptResult(path) === "blocked");
}

function analyze() {
  const charts = listCharts();
  const detectItems = [];
  const meta = charts.map((c) => {
    const bases = basesOf(c.dir);
    const defBase = bases.find((b) => b.default) ?? bases[0] ?? { name: "(none)", path: "" };
    const upstream = defBase.path ? join(c.dir, defBase.path, "upstream.yaml") : "";
    if (upstream && existsSync(upstream)) detectItems.push({ key: c.key, path: upstream });
    // remediation bases from the package's own declared variants
    const secretFixBase = bases.find((b) => (b.externalRequires ?? []).some((r) => /secret/i.test(r?.name ?? "")) || /existing-secret|reuse/i.test(b.name ?? ""));
    const fixCmd = secretFixBase?.externalRequires?.find((r) => /secret/i.test(r?.name ?? ""))?.suggestedSource ?? "";
    const crdSeparableBase = bases.find((b) => /no-?crds|crds-disabled/i.test(b.name ?? ""));
    // CRDs the default base pulls out into first-ordering requirements (kind ClusterFeature,
    // name "CRD <group.kind>"). Normalize to the bare CRD name so they union cleanly with the
    // CRD objects detected in the render, without double-counting a CRD present in both.
    const requiredCrds = (defBase.externalRequires ?? [])
      .filter((r) => /^CRD\b/i.test(r?.name ?? "") || String(r?.kind ?? "").toLowerCase() === "customresourcedefinition")
      .map((r) => String(r?.name ?? "").replace(/^CRD\s+/i, "").trim())
      .filter(Boolean);
    const chart = c.key;
    const secretBaseName = secretFixBase?.name ?? "";
    const crdBaseName = crdSeparableBase?.name ?? "";
    return {
      ...c,
      defaultBase: defBase.name,
      requiredCrds,
      secretFixBase: secretBaseName && !hasBlockedLiveReceipt(chart, secretBaseName) ? secretBaseName : "",
      fixCmd: secretBaseName && !hasBlockedLiveReceipt(chart, secretBaseName) ? fixCmd : "",
      crdSeparableBase: crdBaseName && !hasBlockedLiveReceipt(chart, crdBaseName) ? crdBaseName : "",
    };
  });
  const detected = detectItems.length ? py(PY_DETECT, JSON.stringify(detectItems)) : {};
  return meta.map((m) => {
    const d = detected[m.key] ?? { pw: [], crd: [] };
    const crdNames = Array.from(new Set([...(d.crd ?? []), ...(m.requiredCrds ?? [])]));
    return {
      chart: m.key, version: m.version, defaultBase: m.defaultBase,
      bakesPassword: d.pw.length > 0, passwordKeys: d.pw,
      passwordFixBase: m.secretFixBase, passwordFixCmd: m.fixCmd,
      shipsCRD: crdNames.length > 0, crdCount: crdNames.length, crdSeparableBase: m.crdSeparableBase,
    };
  });
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function buildCsv(rows) {
  const head = ["chart", "version", "default_base", "bakes_shared_password", "password_keys", "password_fix_base", "password_fix_command", "ships_crds", "crd_count", "crd_separable_base", "universal_caveats"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([
      r.chart, r.version, r.defaultBase, r.bakesPassword ? "yes" : "no", r.passwordKeys.join(";"),
      r.passwordFixBase, r.passwordFixCmd, r.shipsCRD ? "yes" : "no", r.crdCount, r.crdSeparableBase,
      "customize;prune;ssa-conflict",
    ].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

function buildMd(rows) {
  const pw = rows.filter((r) => r.bakesPassword);
  const crd = rows.filter((r) => r.shipsCRD);
  const uni = UNIVERSAL.map((u, i) => `${i + 1}. **${u.title}** — ${u.detail}\n   - *Managed:* ${u.managed}`).join("\n");
  const pwRows = pw.map((r) => `| ${r.chart} | \`${r.defaultBase}\` | ${r.passwordKeys.length} | ${r.passwordFixBase ? `use the \`${r.passwordFixBase}\` base${r.passwordFixCmd ? ` → \`${r.passwordFixCmd}\`` : ""}` : "replace the placeholder before prod"} |`).join("\n");
  const crdRows = crd.map((r) => `| ${r.chart} | \`${r.defaultBase}\` | ${r.crdCount} | ${r.crdSeparableBase ? `\`${r.crdSeparableBase}\` base separates CRDs; ` : ""}apply CRDs first + wait, or use a controller (#1015/#1019) |`).join("\n");
  return `# Per-chart cub adoption caveats — where a chart needs a heads-up vs plain Helm

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`scripts/generate-cub-adoption-caveats.mjs\`; do not hand-edit. Regenerate with \`npm run cub-adoption-caveats:generate\`. Secret values are never decoded or printed — only password key names are read.

This is the per-chart view of the adoption audit (docs/planning/helm-vs-cub-adoption-audit.md, PR #1016): for each of the ${rows.length} charts, which "worse-than / more-confusing-than plain Helm" rough edges apply, and the exact fix.

## Three caveats that apply to EVERY chart (cub-direct path)

These are the same for all ${rows.length} charts, so they are stated once here rather than repeated per chart. **Use a controller (Argo/Flux) and all three are handled for you**; on the bare cub-direct path the managed applier handles them.

${uni}

## Per-chart caveats (these vary by chart)

**${pw.length}/${rows.length} charts** still bake a shared placeholder password in their default setup; **${crd.length}/${rows.length} charts** ship CRDs that need first-ordering on cub-direct. Full data for all ${rows.length} charts: [caveats.csv](./caveats.csv) · [summary.html](./summary.html).

### Shared placeholder password (#1012) — ${pw.length} charts

If a chart appears here, its default base bakes a password Secret that is **the same for everyone**. The safer package shape is an existing-Secret base: create or supply the Secret before apply, keep the Secret material outside the rendered chart, and make any fixed-password demo base explicit.

| Chart | Default base | Password keys | Fix |
| --- | --- | --- | --- |
${pwRows || "| _(none detected)_ | | | |"}

### CRDs need first-ordering on cub-direct (#1015) — ${crd.length} charts

On the bare \`kubectl apply\` path a chart's CRs can apply before its CRDs are established. A controller handles ordering; on cub-direct, apply CRDs first and wait, or use the managed applier (#1019).

| Chart | Default base | CRDs | Fix |
| --- | --- | --- | --- |
${crdRows || "| _(none detected)_ | | | |"}

## How to read this

- A chart **not** listed in either per-chart table still has the three universal caveats — those are the floor.
- Every fix here is proven: managed delivery applier ([#1019](https://github.com/confighub/helm-expt/pull/1019)) and setup guidance ([#1020](https://github.com/confighub/helm-expt/pull/1020)).
- The cleanest blanket fix for the delivery caveats (prune, CRD ordering, SSA) is **use a controller** — they were never config quirks, only bare-apply behaviors.
`;
}

function buildHtml(rows) {
  const pw = rows.filter((r) => r.bakesPassword);
  const crd = rows.filter((r) => r.shipsCRD);
  const yn = (v) => v ? '<span class="chip warn">yes</span>' : '<span class="chip ok">no</span>';
  const allRows = rows.map((r) => `<tr><td>${r.chart}</td><td><code>${r.defaultBase}</code></td><td>${yn(r.bakesPassword)}</td><td>${r.passwordFixBase ? `<code>${r.passwordFixBase}</code>` : "—"}</td><td>${yn(r.shipsCRD)}${r.shipsCRD ? ` (${r.crdCount})` : ""}</td><td>${r.crdSeparableBase ? `<code>${r.crdSeparableBase}</code>` : "—"}</td></tr>`).join("");
  const uni = UNIVERSAL.map((u) => `<li><b>${u.title}</b> — ${u.detail}<br><span class="mg">Managed: ${u.managed}</span></li>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Per-chart cub adoption caveats</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:1000px;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .25rem}h2{font-size:1.02rem;margin:1.6rem 0 .5rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .uni{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:.6rem 1rem .6rem 1.4rem;margin:.5rem 0}
  .uni li{margin:.4rem 0}.mg{color:#1a7f37;font-size:.85rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden;margin:.5rem 0}
  th,td{text-align:left;padding:.45rem .65rem;border-bottom:1px solid #eaeef2;font-size:.84rem}th{background:#f6f8fa;font-size:.72rem;text-transform:uppercase;color:#57606a;position:sticky;top:0}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.05rem .5rem;border-radius:999px;font-size:.76rem;font-weight:600}.chip.ok{background:#eef2f5;color:#57606a}.chip.warn{background:#fff1d6;color:#9a6700}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.82em}
  .counts{display:flex;gap:1rem;margin:.5rem 0}.card{flex:1;background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:.7rem 1rem}.card b{font-size:1.5rem;display:block}
  footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Per-chart cub adoption caveats</h1>
  <p class="sub">where a chart needs a heads-up vs plain Helm · ${rows.length} charts · generated from package sources</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/generate-cub-adoption-caveats.mjs</code>; do not hand-edit. Secret values are never decoded or printed.</div>
  <div class="counts">
    <div class="card"><b>${pw.length}</b> charts bake a shared placeholder password</div>
    <div class="card"><b>${crd.length}</b> charts ship CRDs (need first-ordering on cub-direct)</div>
    <div class="card"><b>${rows.length}</b> charts carry the 3 universal caveats</div>
  </div>
  <h2>Three caveats that apply to every chart (cub-direct path)</h2>
  <ul class="uni">${uni}</ul>
  <p style="font-size:.85rem;color:#57606a">Use a controller (Argo/Flux) and all three are handled for you; on bare cub-direct the managed applier (#1019) handles them.</p>
  <h2>Per-chart caveats — all ${rows.length} charts</h2>
  <table><thead><tr><th>Chart</th><th>Default base</th><th>Shared password?</th><th>Secret fix base</th><th>Ships CRDs?</th><th>CRD-separable base</th></tr></thead><tbody>${allRows}</tbody></table>
  <footer>Per-chart view of the adoption audit. Fixes proven in #1019 (managed delivery applier) + #1020 (setup guidance). A chart not flagged still has the 3 universal caveats — those are the floor.</footer>
</main></body></html>
`;
}

function generateAll() {
  const rows = analyze();
  return { rows, csv: buildCsv(rows), md: buildMd(rows), html: buildHtml(rows) };
}

if (mode === "--generate") {
  const g = generateAll();
  write(csvPath, g.csv);
  write(mdPath, g.md);
  write(htmlPath, g.html);
  const pw = g.rows.filter((r) => r.bakesPassword).length;
  const crd = g.rows.filter((r) => r.shipsCRD).length;
  console.log(`wrote cub-adoption-caveats: ${g.rows.length} charts -> ${relativeRepo(csvPath)} (password ${pw}, crd ${crd})`);
} else if (mode === "--verify") {
  const g = generateAll();
  check(existsSync(csvPath) && readFileSync(csvPath, "utf8") === g.csv, `${relativeRepo(csvPath)} is stale; run npm run cub-adoption-caveats:generate`);
  check(existsSync(mdPath) && readFileSync(mdPath, "utf8") === g.md, `${relativeRepo(mdPath)} is stale; run npm run cub-adoption-caveats:generate`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === g.html, `${relativeRepo(htmlPath)} is stale; run npm run cub-adoption-caveats:generate`);
  console.log(`verified cub-adoption-caveats: ${g.rows.length} charts`);
} else {
  console.log("Usage:\n  node scripts/generate-cub-adoption-caveats.mjs --generate\n  node scripts/generate-cub-adoption-caveats.mjs --verify");
}
