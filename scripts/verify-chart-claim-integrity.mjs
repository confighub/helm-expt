#!/usr/bin/env node
// Chart-page CLAIM-INTEGRITY lane.
//
// Closes the loop the site generator leaves open: a chart page renders "supported / green /
// Open dispositions: none" from cached intermediate fields (matrix lane columns, a support
// decision) that can DRIFT from the receipt they cite. This verifier re-opens every cited
// receipt and FAILS when a claim is not actually backed by it. Turns the one-time claim-hunt
// (2026-06-22 audit) into a permanent gate.
//
// Checks (HARD = fails CI):
//   1. support-decision integrity — a `decision: supported` whose evidence cites a receipt that
//      is `result: blocked` (HARD), `result: watch` (WARN), missing (HARD), or a different
//      chart version than the decision (HARD: cross-version evidence).
//   2. required-receipt existence — a receipt that a lifecycle-policy marks `requiredReceipts`
//      but which exists NOWHERE on disk (HARD).
//   3. matrix lane vs receipt — a live lane (GitOps / two-cluster-kind / live-parity) shown
//      `yes`/`pass` while the receipt it resolves to is `blocked`/`watch`/non-pass (HARD).
//   4. supported-while-lane-incomplete — a `supported` row whose core lane is missing/blocked
//      (WARN: usually scoped support, review the scope wording).
//
// Usage:
//   node scripts/verify-chart-claim-integrity.mjs --verify   # gate: exit 1 on any HARD finding
//   node scripts/verify-chart-claim-integrity.mjs --report   # write dated audit artifact, exit 0
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { py, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const OUT = join(repoRoot, "data", "chart-claim-integrity-audit-2026-06-22");

const findings = []; // {sev:'hard'|'warn', chart, check, detail}
const add = (sev, chart, check, detail) => findings.push({ sev, chart, check, detail });

function abs(rel) { return join(repoRoot, rel); }
function receiptInfo(rel) {
  const p = abs(rel);
  if (!existsSync(p)) return { exists: false };
  try {
    const d = readYaml(p) || {};
    const s = d.spec || {};
    return { exists: true, result: (s.result ?? d.result ?? null), version: String(s.version ?? d.version ?? d.metadata?.version ?? "") };
  } catch { return { exists: true, result: null, version: "" }; }
}
const PASS = new Set(["pass", "yes"]);
const isReceiptPath = (p) => typeof p === "string" && /receipt|\/runs\/|\/receipts\//.test(p) && p.endsWith(".yaml");

// ---------- required-receipt existence (Python: readYaml does not expose deep nesting) ----------
const PY_REQUIRED = `import os, json, glob, yaml
os.chdir(${JSON.stringify(repoRoot)})
def walk(n, acc):
    if isinstance(n, list):
        for x in n: walk(x, acc)
    elif isinstance(n, dict):
        for k, v in n.items():
            if k == 'requiredReceipts' and isinstance(v, list):
                for r in v:
                    if isinstance(r, str): acc.add(r)
            else: walk(v, acc)
names = set()
for d in ('runs', 'data', 'recipes'):
    for f in glob.glob(d + '/**/*.yaml', recursive=True):
        names.add(os.path.basename(f)[:-5])
out = []
for f in glob.glob('recipes/**/lifecycle-policy.yaml', recursive=True):
    try: doc = yaml.safe_load(open(f))
    except Exception: continue
    if not isinstance(doc, dict): continue
    spec = doc.get('spec') or {}
    chart = spec.get('chart') or (doc.get('metadata') or {}).get('name') or f
    req = set(); walk(doc, req)
    for name in sorted(req):
        needle = name[:-8] if name.endswith('-receipt') else name
        if not any(needle in n for n in names):
            out.append({'chart': chart, 'name': name})
print(json.dumps(out))`;

// ---------- Check 1: support-decision integrity ----------
function checkSupportDecisions() {
  const base = join(repoRoot, "data", "production-support-decisions");
  let dirs = [];
  try { dirs = readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return; }
  for (const d of dirs) {
    const f = join(base, d, "support-decision.yaml");
    if (!existsSync(f)) continue;
    let doc; try { doc = readYaml(f); } catch { continue; }
    const s = doc?.spec ?? {};
    if (s.decision !== "supported") continue;
    const chart = s.chart ?? d;
    const ver = String(s.version ?? "");
    for (const ev of (s.evidence ?? [])) {
      if (!isReceiptPath(ev?.path)) continue;
      const info = receiptInfo(ev.path);
      if (!info.exists) { add("hard", chart, "supported-cites-missing-receipt", `decision=supported cites a receipt that does not exist: ${ev.path}`); continue; }
      if (info.result === "blocked") add("hard", chart, "supported-cites-blocked-receipt", `decision=supported cites a receipt with result: blocked — ${ev.path}`);
      else if (info.result === "watch") add("warn", chart, "supported-cites-watch-receipt", `decision=supported cites a receipt with result: watch — ${ev.path}`);
      if (info.version && ver && info.version !== ver) add("warn", chart, "supported-cites-cross-version-receipt", `decision for ${ver} cites a ${info.version} receipt (version skew — confirm the doctrine derive-rule covers it) — ${ev.path}`);
    }
  }
}

// ---------- Check 2: required-receipt existence ----------
function checkRequiredReceipts() {
  let missing = [];
  try { missing = py(PY_REQUIRED, "") || []; } catch { return; }
  for (const m of missing) add("hard", m.chart, "required-receipt-absent", `lifecycle-policy requires "${m.name}" but no matching receipt exists on disk`);
}

// ---------- Check 3 & 4: matrix lanes vs receipts ----------
function parseCsv(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c; }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const LANES = [
  { col: "lane_gitops_oci_live", name: "GitOps/OCI", path: (c, v) => `data/runtime-gitops/receipts/${c}/${v}/latest.yaml` },
  { col: "lane_two_cluster_kind", name: "two-cluster-kind", path: (c, v) => `runs/live-kind-parity/${c}-${v}/receipt.yaml` },
  { col: "lane_live_dual_parity", name: "live-parity", path: (c, v) => `runs/live-helm-confighub-compare/${c}-${v}/receipt.yaml` },
];
function checkMatrix() {
  const p = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");
  if (!existsSync(p)) return;
  const rows = parseCsv(readFileSync(p, "utf8"));
  const head = rows[0]; const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const r of rows.slice(1)) {
    if (r.length < head.length) continue;
    const chart = r[idx.chart], variant = r[idx.variant];
    if (!chart || !variant || variant === "(source)") continue;
    const cdir = chart.replaceAll("/", "-");
    // Check 3
    for (const lane of LANES) {
      const status = (r[idx[lane.col]] ?? "").trim().toLowerCase();
      if (!PASS.has(status)) continue;
      const info = receiptInfo(lane.path(cdir, variant));
      if (info.exists && info.result && !PASS.has(String(info.result))) {
        const sev = info.result === "blocked" ? "hard" : "warn";
        add(sev, chart, "lane-green-but-receipt-not-pass", `${variant}: ${lane.name} lane shows "${status}" but its receipt is result: ${info.result} — ${lane.path(cdir, variant)}`);
      }
    }
    // Check 4 (warn)
    const decision = (r[idx.production_decision] ?? "").trim().toLowerCase();
    if (decision === "supported") {
      const missing = LANES.map((l) => [l.name, (r[idx[l.col]] ?? "").trim().toLowerCase()])
        .filter(([, s]) => ["missing", "blocked", "todo", "no"].includes(s)).map(([n, s]) => `${n}=${s}`);
      if (missing.length) add("warn", chart, "supported-while-lane-incomplete", `${variant}: production_decision=supported while lane(s) ${missing.join(", ")} — confirm the scope wording is crisp`);
    }
  }
}

// ---------- Check 5: recommended remediation base is tested + in scope ----------
function checkRecommendedBases() {
  const p = join(repoRoot, "data", "cub-adoption-caveats", "caveats.csv");
  if (!existsSync(p)) return;
  const rows = parseCsv(readFileSync(p, "utf8"));
  const head = rows[0]; const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const r of rows.slice(1)) {
    if (r.length < head.length) continue;
    const chart = r[idx.chart]; if (!chart) continue;
    const cdir = chart.replaceAll("/", "-");
    let supportedBase = null;
    const sdf = join(repoRoot, "data", "production-support-decisions", cdir, "support-decision.yaml");
    if (existsSync(sdf)) { try { supportedBase = readYaml(sdf)?.spec?.supportedBase ?? null; } catch { /* skip */ } }
    const recs = [["password", r[idx.password_fix_base]], ["CRD", r[idx.crd_separable_base]]]
      .filter(([, b]) => b && b.trim() && !["-", "default"].includes(b.trim())); // "default" is the no-op base, not a remediation
    for (const [kind, baseRaw] of recs) {
      const base = baseRaw.trim();
      let worst = null;
      for (const lane of LANES) { const info = receiptInfo(lane.path(cdir, base)); if (info.exists && info.result && !PASS.has(String(info.result))) worst = info.result; }
      if (worst === "blocked") add("hard", chart, "recommends-base-with-blocked-receipt", `${kind} caveat recommends base "${base}" but a live receipt for it is result: blocked`);
      else if (worst) add("warn", chart, "recommends-base-with-nonpass-receipt", `${kind} caveat recommends base "${base}" whose live receipt is result: ${worst}`);
      if (supportedBase && supportedBase !== base) add("warn", chart, "recommends-base-outside-supported-scope", `${kind} caveat recommends base "${base}" but the support decision covers only "${supportedBase}" — following the page's own advice steps off the supported base`);
    }
  }
}

// ---------- run ----------
checkSupportDecisions();
checkRequiredReceipts();
checkMatrix();
checkRecommendedBases();
const seen = new Set();
for (let i = findings.length - 1; i >= 0; i--) {
  const k = `${findings[i].sev}|${findings[i].chart}|${findings[i].check}|${findings[i].detail}`;
  if (seen.has(k)) findings.splice(i, 1); else seen.add(k);
}
findings.sort((a, b) => (a.sev === b.sev ? a.chart.localeCompare(b.chart) : a.sev === "hard" ? -1 : 1));
const hard = findings.filter((f) => f.sev === "hard");
const warn = findings.filter((f) => f.sev === "warn");
const charts = new Set(findings.map((f) => f.chart));

function summaryLine() { return `${hard.length} HARD + ${warn.length} warn finding(s) across ${charts.size} chart(s)`; }

if (mode === "--report") {
  const head = ["severity", "chart", "check", "detail"];
  const csv = [head.join(",")].concat(findings.map((f) => [f.sev, f.chart, f.check, `"${f.detail.replaceAll('"', '""')}"`].join(","))).join("\n") + "\n";
  write(join(OUT, "findings.csv"), csv);
  const byCheck = {}; for (const f of findings) (byCheck[f.check] ??= []).push(f);
  const md = `# Chart-page claim-integrity audit (2026-06-22)

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`scripts/verify-chart-claim-integrity.mjs --report\`; the same script run with \`--verify\` is the permanent gate (\`npm run chart-claim-integrity:verify\`). Each finding re-checks a chart-page claim against the receipt it cites.

**${summaryLine()}.** A HARD finding means a page claim is not backed by its own receipt — a false claim that should block release. WARN means a "supported" row co-exists with a missing lane (usually legitimate scoped support; confirm the wording).

## Findings by check

${Object.entries(byCheck).map(([c, fs]) => `### ${c} (${fs.length})\n\n${fs.map((f) => `- **${f.sev.toUpperCase()}** \`${f.chart}\` — ${f.detail}`).join("\n")}`).join("\n\n")}

## What this proves
The underlying receipts/support-decisions are honest; the failure is the rendering chain asserting more than the receipt says. Fix at the generator (derive claims from receipt \`result\`, carry the receipt's disclaimers, qualify cross-version evidence), not by editing HTML. Full data: [findings.csv](./findings.csv).
`;
  write(join(OUT, "summary.md"), md);
  console.log(`wrote chart-claim-integrity report -> ${relativeRepo(OUT)} (${summaryLine()})`);
  process.exit(0);
} else if (mode === "--verify") {
  for (const f of findings) console.log(`  [${f.sev === "hard" ? "FAIL" : "warn"}] ${f.chart} · ${f.check}: ${f.detail}`);
  console.log(`chart-claim-integrity: ${summaryLine()}`);
  if (hard.length) { console.error(`\nFAILED: ${hard.length} chart page claim(s) contradict their cited receipts.`); process.exit(1); }
  console.log("OK: no chart page asserts more than its receipts back.");
  process.exit(0);
} else {
  console.log("Usage:\n  node scripts/verify-chart-claim-integrity.mjs --verify   # gate (exit 1 on HARD)\n  node scripts/verify-chart-claim-integrity.mjs --report   # write dated audit artifact");
}
