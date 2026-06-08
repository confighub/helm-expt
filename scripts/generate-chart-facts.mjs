// Per-chart facts + "what we can't yet easily enable" — row by row, for every chart with a recipe.
//
// For each chart this answers, in plain readable columns:
//   - post-deploy hooks? other hooks? (from the source scan's hookTypesText)
//   - does it generate secrets, and is an existing-secret path available or a known gap?
//   - does it ship CRDs, and is a no-crds variant available or a known gap?
//   - admission webhooks? open extension slots (tpl / extraManifests) the user must review?
//   - which variants are built today
//   - NOT YET ENABLED: the honest per-chart gap — recommended capabilities we cannot yet build
//     because no solution/workaround exists yet, each annotated with the reason (#113 / #114 /
//     curated-lane). Empty means every recommended capability is built and the quirks are modeled.
//
// Sources: per-chart helm-pain-report.yaml (dispositions), the source-feature scan (hook types,
// secret-generating funcs, webhooks), the variant dirs, the variant-backlog (what's recommended but
// unbuilt), and the wave-results (why a variant was declined). Read-only; emits data/chart-facts/.
//
//   node scripts/generate-chart-facts.mjs --generate
//   node scripts/generate-chart-facts.mjs --verify
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { check, listFiles, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "chart-facts");
const csvPath = join(outDir, "chart-facts.csv");
const summaryPath = join(outDir, "summary.md");

function csv(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function normRef(s) {
  // "repo/chart@version" or "repo/chart/version" or "repo/chart" -> "repo/chart"
  const noVer = String(s).split("@")[0];
  const parts = noVer.split("/");
  return parts.length >= 3 ? parts.slice(0, 2).join("/") : noVer;
}

// --- source-feature scan: chart nature (hook types, secret-gen funcs, webhooks) ---
function loadSourceScan() {
  const path = join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json");
  const map = new Map();
  if (!existsSync(path)) return map;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const arr = Array.isArray(raw) ? raw : raw.rows ?? raw.charts ?? Object.values(raw);
  for (const e of arr) {
    const ref = normRef(e.chart ?? e.name ?? "");
    if (ref && !map.has(ref)) map.set(ref, e);
  }
  return map;
}

// --- variant-backlog: recommended-but-unbuilt variants per chart ---
function loadBacklog() {
  const path = join(repoRoot, "data", "variant-backlog", "backlog.csv");
  const map = new Map();
  if (!existsSync(path)) return map;
  const lines = readFileSync(path, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const ci = (name) => header.indexOf(name);
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const ref = normRef(cols[ci("chart")]);
    const rec = (cols[ci("recommend_to_build")] ?? "").split(";").map((s) => s.trim()).filter((s) => s && s !== "none");
    map.set(ref, rec);
  }
  return map;
}

// --- wave-results: why a variant was declined (the reason a capability is not built) ---
function loadWaveDeclines() {
  const dir = join(repoRoot, "data", "variant-backlog", "wave-results");
  const map = new Map(); // "<repo>/<chart>" -> { variant -> reason }
  if (!existsSync(dir)) return map;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const rows = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const r of rows) {
      if (r.status !== "declined") continue;
      const ref = normRef(r.chart);
      const entry = map.get(ref) ?? {};
      entry[r.variant ?? file.replace(".json", "")] = r.reason ?? r.note ?? r.error ?? "declined";
      map.set(ref, entry);
    }
  }
  return map;
}

// Classify an unbuilt recommended variant. "hard" = no solution/workaround yet (the real gap);
// "soft" = a known build path exists, just not run yet; "na" = doesn't apply to this chart.
function classifyGap(ref, variant, reason, secretsGen) {
  const r = String(reason ?? "");
  if (/single-node|single binary|data-plane|not a supported HA|not applicable/i.test(r)) return { kind: "na" };
  if (variant === "no-crds" && isCrdPublicationChart(ref)) return { kind: "na" };
  // template-baked CRDs first (these declines often also say "no chart CRD toggle")
  if (/#114|template-rendered|template-baked|template CRD|CRD set/i.test(r)) {
    return { kind: "hard", label: `${variant} (template-baked CRDs, no toggle — #114)` };
  }
  if (/curated proof lane|bespoke/i.test(r)) return { kind: "hard", label: `${variant} (curated proof lane — bespoke teaching needed)` };
  if (variant === "existing-secret") {
    if (/#113|existing-secret|no chart toggle/i.test(r) || (!reason && secretsGen)) {
      return { kind: "hard", label: "existing-secret (chart ships no Secret toggle — #113)" };
    }
    return { kind: "soft", label: "existing-secret (buildable — not yet run)" };
  }
  if (!reason) return { kind: "soft", label: `${variant} (buildable — not yet run)` };
  return { kind: "hard", label: `${variant} (${r})` };
}

function isCrdPublicationChart(ref) {
  return /(?:^|\/)(?:[^/]+-)?crds?$/.test(ref);
}

function hookFacts(scan) {
  const text = String(scan?.hookTypesText ?? "");
  const post = ["post-install", "post-upgrade", "post-delete"].filter((h) => text.includes(h));
  const pre = ["pre-install", "pre-upgrade", "pre-delete"].filter((h) => text.includes(h));
  const tests = (scan?.testHooks?.count ?? 0) > 0;
  const other = [...pre];
  if (tests) other.push("test");
  return { post, other };
}

function generatesSecrets(scan) {
  const n = (f) => scan?.[f]?.count ?? 0;
  return n("randFuncs") + n("certFuncs") + n("hashPasswordFuncs") > 0;
}

// True if the source scan recorded a non-zero count for a feature field (fields are {count, examples}).
function scanHas(scan, field) {
  const v = scan?.[field];
  if (v && typeof v === "object") return (v.count ?? 0) > 0;
  if (typeof v === "number") return v > 0;
  return Boolean(v);
}

function buildRows() {
  const scan = loadSourceScan();
  const backlog = loadBacklog();
  const declines = loadWaveDeclines();
  const recipeFiles = listFiles(join(repoRoot, "recipes")).filter((f) => f.endsWith("/recipe.yaml")).sort();

  const rows = [];
  for (const recipeFile of recipeFiles) {
    const recipeRoot = recipeFile.replace(/\/recipe\.yaml$/, "");
    const rel = recipeRoot.replace(`${repoRoot}/`, "");
    const parts = rel.split("/"); // recipes/<repo>/<chart>/<version>
    const ref = `${parts[1]}/${parts[2]}`;
    const version = parts[3];
    const s = scan.get(ref);

    const variants = existsSync(join(recipeRoot, "variants")) ? readdirSync(join(recipeRoot, "variants")).sort() : [];
    const hasVariant = (v) => variants.includes(v);
    const rec = backlog.get(ref) ?? [];
    const declined = declines.get(ref) ?? {};

    // hooks
    const { post, other } = hookFacts(s);
    const hookStatus = post.length || other.length ? "lifecycle-policy: ConfigHub applies / Flux|Argo runs (live receipt pending)" : "—";

    // pain-report quirks
    const painPath = join(recipeRoot, "helm-pain-report.yaml");
    let extensionSlots = false;
    if (existsSync(painPath)) {
      const pain = readFileSync(painPath, "utf8");
      extensionSlots = /tpl|extension-slot|extraManifest|raw manifest/i.test(pain) && /needs-operator-decision|source-signal-recorded/i.test(pain);
    }

    const secretsGen = generatesSecrets(s);
    const crdCount = s?.crdFiles?.count ?? s?.crdFiles ?? 0;
    const hasCrds = hasVariant("no-crds") || crdCount > 0 || Boolean(declined["no-crds"]);

    // Classify every recommended-but-unbuilt variant into hard gap (no solution yet) / soft backlog
    // (known build path, not yet run) / na (doesn't apply).
    const classified = rec.filter((v) => !hasVariant(v)).map((v) => ({ v, ...classifyGap(ref, v, declined[v], secretsGen) }));
    const hardGaps = classified.filter((c) => c.kind === "hard").map((c) => c.label);
    const softBacklog = classified.filter((c) => c.kind === "soft").map((c) => c.label);

    const esc = classified.find((c) => c.v === "existing-secret");
    let existingSecret;
    if (hasVariant("existing-secret")) existingSecret = "built";
    else if (esc?.kind === "hard") existingSecret = "NOT built — chart ships no Secret toggle (#113)";
    else if (esc?.kind === "soft") existingSecret = "buildable — not yet run";
    else existingSecret = secretsGen ? "n/a (generated only)" : "n/a";

    const ncc = classified.find((c) => c.v === "no-crds");
    let noCrds;
    if (hasVariant("no-crds")) noCrds = "built";
    else if (ncc?.kind === "hard") noCrds = "NOT built — template-baked CRDs, no toggle (#114)";
    else if (ncc?.kind === "soft" || (hasCrds && rec.includes("no-crds"))) noCrds = "buildable — not yet run";
    else noCrds = hasCrds ? "buildable — not yet run" : "n/a (no CRDs)";

    const webhooks = (s?.validatingWebhooks ?? 0) + (s?.mutatingWebhooks ?? 0);
    const notYetEnabled = hardGaps.length
      ? hardGaps.join("; ")
      : "— (no open gap: recommended capabilities built or n/a; quirks modeled — Level 2)";
    const buildableBacklog = softBacklog.length ? softBacklog.join("; ") : "—";

    rows.push({
      chart: ref,
      version,
      post_deploy_hooks: post.length ? post.join("+") : "—",
      other_hooks: other.length ? other.join("+") : "—",
      hook_status: hookStatus,
      generates_secrets: secretsGen ? "yes" : "—",
      existing_secret: existingSecret,
      crds: crdCount > 0 ? String(crdCount) : hasCrds ? "yes" : "—",
      no_crds_variant: noCrds,
      webhooks: webhooks > 0 ? String(webhooks) : "—",
      required_values: scanHas(s, "requiredOrFail") ? "yes — mandatory inputs (required/fail)" : "—",
      values_schema: scanHas(s, "valuesSchema") ? "yes — values.schema.json" : "—",
      install_vs_upgrade: scanHas(s, "releaseModeBranching") ? "yes — renders differ install vs upgrade" : "—",
      notes: scanHas(s, "notesFiles") ? "yes — NOTES.txt" : "—",
      extension_slots: extensionSlots ? "yes — per-use review" : "—",
      variants_built: variants.join("+"),
      buildable_not_yet_run: buildableBacklog,
      not_yet_enabled: notYetEnabled,
    });
  }
  return rows;
}

function render(rows) {
  const cols = [
    "chart", "version", "post_deploy_hooks", "other_hooks", "hook_status", "generates_secrets",
    "existing_secret", "crds", "no_crds_variant", "webhooks", "required_values", "values_schema",
    "install_vs_upgrade", "notes", "extension_slots", "variants_built",
    "buildable_not_yet_run", "not_yet_enabled",
  ];
  const csvOut = [cols.join(","), ...rows.map((r) => cols.map((c) => csv(r[c])).join(","))].join("\n") + "\n";

  const withGaps = rows.filter((r) => !r.not_yet_enabled.startsWith("—"));
  const buildable = rows.filter((r) => r.buildable_not_yet_run !== "—");
  const tally = (re) => rows.filter((r) => re.test(r.not_yet_enabled)).length;
  const summary = `# Chart Facts — what each chart is, and what we can't yet easily enable

One row per chart with a recipe (${rows.length} charts). The headline column is **not_yet_enabled**:
a recommended capability we cannot yet build because **no solution/workaround exists yet**. This is
kept distinct from **buildable_not_yet_run** — capabilities with a known build path that simply
haven't been run through the variant generator.

## Headline

\`\`\`text
charts with a recipe:                       ${rows.length}
no open gap (built or n/a; modeled L2):     ${rows.length - withGaps.length}
charts with a hard gap (no workaround yet):  ${withGaps.length}
charts with buildable backlog (path exists): ${buildable.length}
\`\`\`

## What the hard gaps are (charts affected)

\`\`\`text
existing-secret — chart ships no Secret toggle (#113):  ${tally(/#113/)}
no-crds — template-baked CRDs, no toggle (#114):        ${tally(/#114/)}
curated proof lane — needs bespoke teaching:            ${tally(/curated proof lane/)}
other hard gap:                                         ${withGaps.filter((r) => !/#11[34]|curated proof lane/.test(r.not_yet_enabled)).length}
\`\`\`

## How to read a row

| Column | Meaning |
| --- | --- |
| \`post_deploy_hooks\` | Helm post-install / post-upgrade / post-delete hooks the chart ships |
| \`other_hooks\` | pre-install / pre-upgrade / pre-delete / test hooks |
| \`hook_status\` | hooks have an execution home (ConfigHub applies; Flux/Argo runs) — live receipt still pending |
| \`generates_secrets\` | chart generates secret material (random / cert / password funcs) |
| \`existing_secret\` | bring-your-own-Secret path: built, a known gap, or n/a |
| \`no_crds_variant\` | a CRDs-off variant: built, a known gap, or n/a |
| \`webhooks\` | validating + mutating admission webhooks |
| \`required_values\` | chart uses \`required\`/\`fail\` — some inputs are mandatory or the render aborts |
| \`values_schema\` | chart ships \`values.schema.json\` — a machine-checked contract for user inputs |
| \`install_vs_upgrade\` | chart branches on \`.Release.IsInstall\`/\`.IsUpgrade\` — upgrade render differs from the captured install render |
| \`notes\` | chart ships \`NOTES.txt\` post-install guidance |
| \`extension_slots\` | open tpl / extraManifests injection points — safe to fill but need per-use review |
| \`buildable_not_yet_run\` | recommended variants with a known build path, just not run through the generator yet |
| \`not_yet_enabled\` | **the honest hard gap**: recommended capability with no solution/workaround yet, + reason |

## Charts with an open gap

| Chart | Not yet enabled |
| --- | --- |
${withGaps.map((r) => `| \`${r.chart}\` | ${r.not_yet_enabled} |`).join("\n")}

## Files

\`\`\`text
data/chart-facts/chart-facts.csv   one row per chart, all fact columns (open in a spreadsheet)
data/chart-facts/summary.md        this file
\`\`\`
`;
  return { csvOut, summary };
}

const rows = buildRows();
check(rows.length >= 100, `expected >= 100 charts with recipes, found ${rows.length}`);
const { csvOut, summary } = render(rows);
// Machine-readable map for the top-500/top-100 analysis to surface the same gap, keyed by "<repo>/<chart>".
const jsonPath = join(outDir, "chart-facts.json");
const jsonOut =
  JSON.stringify(
    Object.fromEntries(rows.map((r) => [r.chart, { version: r.version, not_yet_enabled: r.not_yet_enabled, buildable_not_yet_run: r.buildable_not_yet_run }])),
    null,
    2,
  ) + "\n";

if (mode === "--verify") {
  const okCsv = existsSync(csvPath) && readFileSync(csvPath, "utf8") === csvOut;
  const okMd = existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summary;
  const okJson = existsSync(jsonPath) && readFileSync(jsonPath, "utf8") === jsonOut;
  check(okCsv && okMd && okJson, "chart-facts outputs are stale; run npm run chart-facts");
  const gaps = rows.filter((r) => !r.not_yet_enabled.startsWith("—")).length;
  console.log(`verified chart-facts (${rows.length} charts; ${gaps} with a hard gap)`);
} else {
  mkdirSync(outDir, { recursive: true });
  write(csvPath, csvOut);
  write(summaryPath, summary);
  write(jsonPath, jsonOut);
  const gaps = rows.filter((r) => !r.not_yet_enabled.startsWith("—")).length;
  console.log(`wrote chart-facts for ${rows.length} charts (${gaps} with a hard gap) -> data/chart-facts/`);
}
