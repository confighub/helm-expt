#!/usr/bin/env node
// The synthetic torture suite (sceptic plan T3): charts written to break the
// model. Every fixture must end in a NAMED outcome — pass or a named
// refusal/route — never silence. The harness probes each fixture chart and
// classifies it; recording HARD-FAILS if the classification does not match
// the fixture's declared expected_outcome, so a fixture that breaks the
// model breaks the build until it is routed.
//
// Outcome classes (precedence order — first match wins):
//   refused-template-error            render fails with a named tool error (or timeout)
//   refused-object-identity-collision two rendered docs share (apiVersion,kind,ns,name)
//   refused-nondeterministic-render   two same-env renders differ
//   environment-dependent-render      renders differ under changed TZ/locale/env
//   verb-dependent-render             install and upgrade renders differ (route: capture both)
//   routed-lookup-target-facts        templates read the cluster via lookup (route: target facts)
//   pass-deterministic                renders identically, no traps fired
//
//   node scripts/run-torture-suite.mjs --record    (needs helm; no network, charts are vendored)
//   node scripts/run-torture-suite.mjs --generate  (offline: summary/html from committed results)
//   node scripts/run-torture-suite.mjs --verify    (offline: consistency + every fixture present)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { check, parseDocs, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "torture-suite");
const chartsRoot = join(outputRoot, "charts");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  results: join(outputRoot, "results.csv"),
  html: join(outputRoot, "torture.html"),
  generatedAt: join(outputRoot, "generated-at.txt"),
};

// Same render contract as the proof scripts.
const RENDER_FLAGS = ["--kube-version", "1.30.0", "--include-crds", "--skip-tests", "--no-hooks"];
const RENDER_TIMEOUT_MS = 30000;

if (mode === "--record") {
  const generatedAt = new Date().toISOString();
  const rows = recordSuite();
  write(outputs.results, toCsv(rows));
  write(outputs.summary, summary(rows));
  write(outputs.html, htmlReport(rows, generatedAt));
  write(outputs.generatedAt, `${generatedAt}\n`);
  const mismatches = rows.filter((row) => row.result !== "match");
  console.log(`recorded torture suite -> ${relativeRepo(outputRoot)}/ (${rows.length} fixtures, ${mismatches.length} mismatch(es))`);
  check(mismatches.length === 0, `torture fixtures landed outside their declared outcome: ${mismatches.map((row) => `${row.fixture} got ${row.outcome}, expected ${row.expected_outcome}`).join("; ")}`);
} else if (mode === "--generate") {
  const generatedAt = new Date().toISOString();
  const rows = readResults();
  write(outputs.summary, summary(rows));
  write(outputs.html, htmlReport(rows, generatedAt));
  write(outputs.generatedAt, `${generatedAt}\n`);
  console.log(`wrote torture suite summary for ${rows.length} fixture(s)`);
} else if (mode === "--verify") {
  for (const path of Object.values(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run torture:record`);
  }
  const generatedAt = readFileSync(outputs.generatedAt, "utf8").trim();
  const rows = readResults();
  const fixtures = listFixtures();
  const recorded = new Set(rows.map((row) => row.fixture));
  for (const fixture of fixtures) {
    check(recorded.has(fixture), `torture fixture ${fixture} has no recorded result; run npm run torture:record — a fixture without an outcome is the silence this suite forbids`);
  }
  for (const row of rows) {
    check(fixtures.includes(row.fixture), `results list removed fixture ${row.fixture}; run npm run torture:record`);
    check(row.result === "match", `${row.fixture}: recorded outcome ${row.outcome} does not match declared ${row.expected_outcome}; route the fixture or fix the declaration, then re-record`);
    const declared = readYaml(join(chartsRoot, row.fixture, "fixture.yaml"));
    check(declared.expected_outcome === row.expected_outcome, `${row.fixture}: fixture.yaml expected_outcome changed since recording; run npm run torture:record`);
  }
  check(readFileSync(outputs.summary, "utf8") === summary(rows), `${relativeRepo(outputs.summary)} is stale; run npm run torture:suite`);
  check(readFileSync(outputs.html, "utf8") === htmlReport(rows, generatedAt), `${relativeRepo(outputs.html)} is stale; run npm run torture:suite`);
  console.log(`verified torture suite: ${rows.length} fixture(s), every one in a named outcome`);
} else {
  console.log(`Usage:
  node scripts/run-torture-suite.mjs --record
  node scripts/run-torture-suite.mjs --generate
  node scripts/run-torture-suite.mjs --verify`);
}

function listFixtures() {
  return readdirSync(chartsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function recordSuite() {
  return listFixtures().map((fixture) => {
    const dir = join(chartsRoot, fixture);
    const declared = readYaml(join(dir, "fixture.yaml"));
    const probes = probeFixture(dir);
    const outcome = classify(probes);
    return {
      fixture,
      attack: declared.attack ?? "",
      outcome,
      expected_outcome: declared.expected_outcome ?? "",
      result: outcome === declared.expected_outcome ? "match" : "MISMATCH",
      template_error: probes.error ? "yes" : "no",
      deterministic: probes.error ? "" : String(probes.deterministic),
      env_invariant: probes.error ? "" : String(probes.envInvariant),
      verb_invariant: probes.error ? "" : String(probes.verbInvariant),
      duplicate_identities: probes.error ? "" : String(probes.duplicates.length),
      lookup_flagged: String(probes.lookupFlagged),
      objects: probes.error ? "" : String(probes.objectCount),
      digest12: probes.error ? "" : probes.digest.slice(0, 12),
      detail: probes.error ? probes.errorSnippet : probes.duplicates[0] ?? "",
      notes: declared.notes ?? "",
    };
  });
}

function probeFixture(dir) {
  const baseEnv = { TZ: "UTC", LC_ALL: "C", HOME: process.env.HOME, TORTURE_CANARY: "alpha" };
  const altEnv = { TZ: "Asia/Tokyo", LC_ALL: "en_US.UTF-8", HOME: process.env.HOME, TORTURE_CANARY: "beta" };

  const first = render(dir, baseEnv, []);
  if (first.error) return { error: true, errorSnippet: first.errorSnippet, lookupFlagged: scanForLookup(dir) };
  const second = render(dir, baseEnv, []);
  const envRender = render(dir, altEnv, []);
  const upgradeRender = render(dir, baseEnv, ["--is-upgrade"]);

  const docs = parseDocs(first.text);
  const identities = docs
    .map((doc) => [doc.apiVersion ?? "", doc.kind ?? "", doc.metadata?.namespace ?? "", doc.metadata?.name ?? ""].join("|"))
    .filter((identity) => identity.replaceAll("|", ""));
  const seen = new Set();
  const duplicates = [];
  for (const identity of identities) {
    if (seen.has(identity)) duplicates.push(identity);
    seen.add(identity);
  }

  return {
    error: false,
    deterministic: !second.error && first.text === second.text,
    envInvariant: !envRender.error && first.text === envRender.text,
    verbInvariant: !upgradeRender.error && first.text === upgradeRender.text,
    duplicates: [...new Set(duplicates)].sort(),
    lookupFlagged: scanForLookup(dir),
    objectCount: identities.length,
    digest: createHash("sha256").update(first.text).digest("hex"),
  };
}

// scanForLookup flags templates that read the live cluster at render time.
// Offline, lookup returns empty and the render LOOKS fine — which is exactly
// why the flag comes from the source, not the output.
function scanForLookup(dir) {
  const templatesDir = join(dir, "templates");
  if (!existsSync(templatesDir)) return false;
  return readdirSync(templatesDir).some((file) => /\(\s*lookup\s+"/.test(readFileSync(join(templatesDir, file), "utf8")));
}

function render(dir, env, extraArgs) {
  try {
    const text = execFileSync("helm", ["template", "torture", dir, "--namespace", "torture", ...RENDER_FLAGS, ...extraArgs], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: RENDER_TIMEOUT_MS,
      maxBuffer: 1024 * 1024 * 50,
      env: { ...process.env, ...env },
    });
    return { error: false, text: normalize(text) };
  } catch (error) {
    const raw = `${error.stderr ?? ""}${error.message ?? ""}`.replaceAll("\n", " ").trim();
    return { error: true, errorSnippet: raw.slice(0, 220) || "render failed" };
  }
}

function normalize(text) {
  return `${text.split("\n").map((line) => line.trimEnd()).join("\n").replace(/\n*$/, "")}\n`;
}

function classify(probes) {
  if (probes.error) return "refused-template-error";
  if (probes.duplicates.length > 0) return "refused-object-identity-collision";
  if (!probes.deterministic) return "refused-nondeterministic-render";
  if (!probes.envInvariant) return "environment-dependent-render";
  if (!probes.verbInvariant) return "verb-dependent-render";
  if (probes.lookupFlagged) return "routed-lookup-target-facts";
  return "pass-deterministic";
}

function readResults() {
  check(existsSync(outputs.results), `${relativeRepo(outputs.results)} is missing; run npm run torture:record`);
  const [header, ...lines] = readFileSync(outputs.results, "utf8").trim().split("\n");
  const headers = parseCsvLine(header);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function outcomeBadge(outcome) {
  if (outcome === "pass-deterministic") return "✅";
  if (outcome.startsWith("refused-")) return "⛔";
  return "🔀";
}

function summary(rows) {
  const passes = rows.filter((row) => row.outcome === "pass-deterministic").length;
  const refusals = rows.filter((row) => row.outcome.startsWith("refused-")).length;
  const routed = rows.length - passes - refusals;

  const table = rows
    .map(
      (row) =>
        `| \`${row.fixture}\` | ${row.attack} | ${outcomeBadge(row.outcome)} \`${row.outcome}\` | ${row.detail ? `\`${row.detail.slice(0, 80)}\`` : "—"} |`,
    )
    .join("\n");

  return `# Synthetic Torture Suite

Charts written to break the model (sceptic plan T3). The standing rule:
every fixture ends in a NAMED outcome — pass, a named refusal, or a named
route — never silence. Recording hard-fails on any fixture whose behavior
does not match its declared outcome, so a new breaker chart fails the build
until it is classified and routed. That is the point: a sceptic's breaking
chart becomes a regression fixture here.

Colored rendering: [torture.html](torture.html). Fixture sources live under
[charts/](charts/), one directory per fixture with a \`fixture.yaml\`
declaring the attack and the expected outcome.

## Current Status

| Metric | Count |
| --- | ---: |
| Fixtures | ${rows.length} |
| Pass (deterministic, no traps fired) | ${passes} |
| Named refusals | ${refusals} |
| Named routes (policy, not refusal) | ${routed} |
| Silent outcomes | 0 by construction |

## Fixtures

| Fixture | Attack | Outcome | Detail |
| --- | --- | --- | --- |
${table}

## Adding a breaker

Add \`charts/<name>/\` with the chart and a \`fixture.yaml\` declaring
\`attack\` and \`expected_outcome\`, then run \`npm run torture:record\`.
If the harness cannot land your chart in a named outcome, recording fails —
which means you found a real gap: file it with the failing fixture attached.

## Regenerate

~~~sh
npm run torture:record   # needs helm; charts are vendored, no network
npm run torture:suite    # offline: summary/html from committed results
npm run torture:suite:verify
~~~
`;
}

function htmlReport(rows, generatedAt) {
  const passes = rows.filter((row) => row.outcome === "pass-deterministic").length;
  const refusals = rows.filter((row) => row.outcome.startsWith("refused-")).length;
  const routed = rows.length - passes - refusals;
  const cellClass = (outcome) => (outcome === "pass-deterministic" ? "y" : outcome.startsWith("refused-") ? "n" : "w");
  const body = rows
    .map(
      (row) =>
        `<tr><td class="fix">${escapeHtml(row.fixture)}</td><td class="note" title="${escapeHtml(row.notes)}">${escapeHtml(row.attack)}</td><td class="s ${cellClass(row.outcome)}">${escapeHtml(row.outcome)}</td><td class="note">${escapeHtml(row.detail)}</td></tr>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Synthetic Torture Suite</title>
<style>
body{font:13px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:24px;color:#202124}
h1{font-size:20px;margin:0 0 4px}
p.sub{color:#5f6368;margin:0 0 12px}
table{border-collapse:collapse;margin-top:16px;width:100%}
th,td{border:1px solid #dadce0;padding:4px 8px;text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:#f1f3f4;z-index:1}
td.fix{font-weight:600;white-space:nowrap}
td.s{font-weight:700;white-space:nowrap}
td.note{color:#5f6368}
.y{background:#1e8e3e;color:#fff}
.n{background:#d93025;color:#fff}
.w{background:#f9ab00;color:#202124}
</style>
</head>
<body>
<h1>Synthetic Torture Suite</h1>
<p class="sub"><b>Generated at:</b> ${escapeHtml(generatedAt)} UTC · source: committed torture-suite fixture results.</p>
<p class="sub">${rows.length} fixtures · ${passes} pass · ${refusals} named refusals · ${routed} named routes · 0 silent outcomes by construction. Charts written to break the model; every one must land in a named outcome or recording fails. Hover the attack column for the routing notes. Re-record with <code>npm run torture:record</code>.</p>
<table>
<thead><tr><th>Fixture</th><th>Attack</th><th>Outcome</th><th>Detail</th></tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>
`;
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
