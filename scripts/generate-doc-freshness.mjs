#!/usr/bin/env node
// Doc freshness: WHEN does an authored doc need updating?
//
// The corpus has two kinds of markdown. Generated docs (data/, recipes/,
// packages/, runs/, tests/, CATALOG.md, site/) cannot go stale silently:
// their generators' --verify modes fail the build when they drift from their
// sources. Authored docs (README.md, docs/**) CAN go stale silently — they
// describe evidence that keeps moving. This generator closes that gap:
//
// 1. Every authored doc's repo-relative markdown links to data/, scripts/,
//    tests/, recipes/, and packages/ are treated as its declared evidence
//    dependencies (the doc-map verifier already guarantees links resolve).
// 2. git history dates each doc and each dependency; a doc whose dependency
//    changed after the doc last changed is review-due, with the triggering
//    sources named.
// 3. Docs with no evidence links are surfaced too: they cannot be
//    auto-triggered, which is itself worth knowing.
//
// The committed snapshot records which commit it was computed at. --verify
// is a completeness gate, not a wall-clock gate: it fails when the authored
// doc set changes without regenerating, when a listed trigger path vanishes,
// or when the summary drifts from the CSV — and it stays quiet as history
// moves, so the build does not break on every unrelated merge. Refresh the
// snapshot with --generate (cheap; ride it on any docs PR).
//
//   node scripts/generate-doc-freshness.mjs --generate
//   node scripts/generate-doc-freshness.mjs --verify

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "doc-freshness");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  freshness: join(outputRoot, "freshness.csv"),
  html: join(outputRoot, "freshness.html"),
};
// Hand-maintained acknowledgments: a row here says "I reviewed this doc on
// this date and it is still accurate" — it clears review-due without a
// cosmetic doc edit. Reviewing-by-editing and reviewing-by-acknowledging are
// both legitimate; this file records the second kind.
const reviewedPath = join(outputRoot, "reviewed.csv");

// Evidence roots: a link into one of these is an update trigger for the doc.
const EVIDENCE_ROOTS = ["data/", "scripts/", "tests/", "recipes/", "packages/", "CATALOG.md"];

if (mode === "--generate") {
  const rows = buildRows();
  write(outputs.freshness, toCsv(rows));
  write(outputs.summary, summary(rows));
  write(outputs.html, htmlReport(rows));
  const due = rows.filter((row) => row.status === "review-due");
  console.log(`wrote doc freshness -> ${relativeRepo(outputRoot)}/ (${rows.length} authored docs, ${due.length} review-due)`);
  for (const row of due) console.log(`  review-due: ${row.doc} (${row.days_behind}d behind ${row.newer_sources.split("; ")[0]})`);
} else if (mode === "--verify") {
  for (const path of Object.values(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run doc-freshness`);
  }
  const committed = readCsv(outputs.freshness);
  const universe = authoredDocs();
  const committedDocs = new Set(committed.map((row) => row.doc));
  for (const doc of universe) {
    check(committedDocs.has(doc), `authored doc ${doc} is not in the freshness snapshot; run npm run doc-freshness`);
  }
  for (const row of committed) {
    check(universe.includes(row.doc), `freshness snapshot lists removed doc ${row.doc}; run npm run doc-freshness`);
    for (const source of row.newer_sources.split("; ").filter(Boolean)) {
      const path = source.replace(/ \(\d{4}-\d{2}-\d{2}\)$/, "");
      check(existsSync(join(repoRoot, path)), `freshness snapshot for ${row.doc} names missing source ${path}; run npm run doc-freshness`);
    }
  }
  for (const [doc] of readReviewed()) {
    check(universe.includes(doc), `data/doc-freshness/reviewed.csv acknowledges ${doc}, which is not an authored doc; remove the row`);
  }
  check(readFileSync(outputs.summary, "utf8") === summary(committed), `${relativeRepo(outputs.summary)} is stale against its CSV; run npm run doc-freshness`);
  check(existsSync(outputs.html) && readFileSync(outputs.html, "utf8") === htmlReport(committed), `${relativeRepo(outputs.html)} is stale against its CSV; run npm run doc-freshness`);
  console.log(`verified doc freshness snapshot: ${committed.length} authored docs (review-due state is as of commit ${committed[0]?.as_of_commit ?? "?"}; refresh with npm run doc-freshness)`);
} else {
  console.log(`Usage:
  node scripts/generate-doc-freshness.mjs --generate
  node scripts/generate-doc-freshness.mjs --verify`);
}

// authoredDocs returns the prose docs a human maintains. Generated trees and
// the frozen planning archive are excluded: their freshness is enforced by
// their own verifiers (or deliberately frozen).
function authoredDocs() {
  return git(["ls-files", "*.md"])
    .split("\n")
    .filter(Boolean)
    .filter(
      (file) =>
        file === "README.md" ||
        file === "docs/README.md" ||
        (/^docs\/(user|planning|reference|corpus)\/[^/]+\.md$/.test(file) && file !== "docs/README.md") ||
        /^docs\/demo\/[^/]+\/[^/]+\.md$/.test(file),
    )
    .sort();
}

function buildRows() {
  const asOfCommit = git(["rev-parse", "--short", "HEAD"]).trim();
  const asOfDate = isoDate(Number(git(["log", "-1", "--format=%ct"]).trim()));
  const dateCache = new Map();
  const lastChanged = (path) => {
    if (!dateCache.has(path)) {
      const out = git(["log", "-1", "--format=%ct", "--", path]).trim();
      dateCache.set(path, out ? Number(out) : null);
    }
    return dateCache.get(path);
  };

  const reviewed = readReviewed();
  return authoredDocs().map((doc) => {
    // A doc counts as current as of its last edit OR its last recorded
    // review acknowledgment (end of that day), whichever is later.
    const docTime = Math.max(lastChanged(doc) ?? 0, reviewed.get(doc) ?? 0) || null;
    const deps = [...new Set(evidenceLinks(doc))].sort();
    const newer = deps
      .map((dep) => ({ dep, time: lastChanged(dep) }))
      .filter((entry) => entry.time && docTime && entry.time > docTime)
      .sort((a, b) => b.time - a.time);
    const status = deps.length === 0 ? "no-linked-sources" : newer.length ? "review-due" : "fresh";
    return {
      doc,
      area: doc === "README.md" ? "root" : (doc.match(/^docs\/([^/]+)\//)?.[1] ?? "docs"),
      last_changed: docTime ? isoDate(docTime) : "",
      linked_sources: String(deps.length),
      status,
      days_behind: newer.length ? String(Math.ceil((newer[0].time - docTime) / 86400)) : "",
      newer_sources: newer
        .slice(0, 3)
        .map((entry) => `${entry.dep} (${isoDate(entry.time)})`)
        .join("; "),
      as_of_commit: asOfCommit,
      as_of_date: asOfDate,
    };
  });
}

// evidenceLinks extracts the doc's repo-relative markdown links into the
// evidence roots. The doc-map verifier guarantees links resolve, so what we
// collect here exists.
function evidenceLinks(doc) {
  const text = readFileSync(join(repoRoot, doc), "utf8");
  const fromDir = doc.includes("/") ? doc.slice(0, doc.lastIndexOf("/")) : "";
  const targets = [];
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = normalizePath(fromDir ? `${fromDir}/${target}` : target);
    if (EVIDENCE_ROOTS.some((root) => resolved === root || resolved.startsWith(root)) && existsSync(join(repoRoot, resolved))) {
      targets.push(resolved.replace(/\/$/, ""));
    }
  }
  return targets;
}

function normalizePath(path) {
  const parts = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
}

// readReviewed parses the acknowledgment file into doc -> epoch seconds at
// the END of the reviewed_on day (UTC), so a source that changed earlier the
// same day does not immediately re-trigger the doc just acknowledged.
function readReviewed() {
  const map = new Map();
  if (!existsSync(reviewedPath)) return map;
  for (const row of readCsv(reviewedPath)) {
    if (!row.doc || !row.reviewed_on) continue;
    check(/^\d{4}-\d{2}-\d{2}$/.test(row.reviewed_on), `data/doc-freshness/reviewed.csv: reviewed_on for ${row.doc} must be YYYY-MM-DD`);
    map.set(row.doc, Date.parse(`${row.reviewed_on}T23:59:59Z`) / 1000);
  }
  return map;
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 50 });
}

function isoDate(epochSeconds) {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 10);
}

function summary(rows) {
  const due = rows.filter((row) => row.status === "review-due").sort((a, b) => Number(b.days_behind) - Number(a.days_behind));
  const fresh = rows.filter((row) => row.status === "fresh").length;
  const unlinked = rows.filter((row) => row.status === "no-linked-sources");
  const asOf = rows[0] ? `${rows[0].as_of_date} (commit \`${rows[0].as_of_commit}\`)` : "?";

  const dueTable = due.length
    ? due
        .map((row) => `| [${row.doc}](../../${row.doc}) | ${row.area} | ${row.last_changed} | ${row.days_behind} | ${row.newer_sources.split("; ").map((source) => `\`${source}\``).join("<br>")} |`)
        .join("\n")
    : "| _none_ | | | | |";

  return `# Doc Freshness — when to update the authored docs

The corpus's generated docs cannot go stale silently: their verifiers fail
the build. The authored docs (README, docs/) CAN — they describe evidence
that keeps moving. This snapshot answers "which authored doc needs review
right now": a doc is **review-due** when an evidence source it links to
(under ${EVIDENCE_ROOTS.map((root) => `\`${root.replace(/\/$/, "")}\``).join(", ")})
changed more recently than the doc itself.

Colored rendering: [freshness.html](freshness.html) (open in a browser).
Snapshot as of ${asOf}. Refresh with \`npm run doc-freshness\` — cheap, ride
it on any docs PR. The verifier gates completeness (every authored doc is in
the snapshot) without breaking the build as history moves.

Two ways to clear a review-due row, both legitimate: **edit the doc** (its
last-changed date advances), or **acknowledge it** in
[reviewed.csv](reviewed.csv) with a \`doc,reviewed_on,note\` row saying it was
reviewed and is still accurate. Acknowledgments exist so docs that link
fast-churning dashboards do not sit permanently red until someone makes a
cosmetic edit.

## Current Status

| Metric | Count |
| --- | ---: |
| Authored docs tracked | ${rows.length} |
| Fresh (no linked source newer than the doc) | ${fresh} |
| **Review-due** | ${due.length} |
| No linked evidence sources (cannot auto-trigger) | ${unlinked.length} |

## Review queue

Sorted by how far behind the doc is. "Newer sources" shows up to the three
most recently changed triggers.

| Doc | Area | Doc last changed | Days behind | Newer sources |
| --- | --- | --- | ---: | --- |
${dueTable}

## Docs with no linked evidence sources

These cannot be auto-triggered by source changes. Either they are timeless,
or they should link the evidence they describe — linking is what wires a doc
into this freshness model.

${unlinked.length ? unlinked.map((row) => `- [${row.doc}](../../${row.doc})`).join("\n") : "_none_"}

## Regenerate

~~~sh
npm run doc-freshness
npm run doc-freshness:verify
~~~
`;
}


function htmlReport(rows) {
  const order = { "review-due": 0, fresh: 1, "no-linked-sources": 2 };
  const sorted = [...rows].sort((a, b) => (order[a.status] - order[b.status]) || (Number(b.days_behind || 0) - Number(a.days_behind || 0)) || a.doc.localeCompare(b.doc));
  const due = rows.filter((row) => row.status === "review-due").length;
  const fresh = rows.filter((row) => row.status === "fresh").length;
  const unlinked = rows.filter((row) => row.status === "no-linked-sources").length;
  const asOf = rows[0] ? `${rows[0].as_of_date} (commit ${rows[0].as_of_commit})` : "?";
  const statusCell = (status) =>
    status === "review-due"
      ? `<td class="s w">review-due</td>`
      : status === "fresh"
        ? `<td class="s y">fresh</td>`
        : `<td class="s t">no linked sources</td>`;
  const body = sorted
    .map((row) => {
      const sources = row.newer_sources
        ? row.newer_sources.split("; ").map((source) => `<code>${escapeHtml(source)}</code>`).join("<br>")
        : "";
      return `<tr><td class="doc">${escapeHtml(row.doc)}</td><td>${escapeHtml(row.area)}</td>${statusCell(row.status)}<td class="num">${escapeHtml(row.days_behind)}</td><td>${escapeHtml(row.last_changed)}</td><td class="num">${escapeHtml(row.linked_sources)}</td><td class="note">${sources}</td></tr>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Doc Freshness</title>
<style>
body{font:13px/1.45 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:24px;color:#202124}
h1{font-size:20px;margin:0 0 4px}
p.sub{color:#5f6368;margin:0 0 12px}
table{border-collapse:collapse;margin-top:16px;width:100%}
th,td{border:1px solid #dadce0;padding:3px 7px;text-align:left;vertical-align:top}
thead th{position:sticky;top:0;background:#f1f3f4;z-index:1}
td.doc{font-weight:600;white-space:nowrap}
td.s{text-align:center;font-weight:700;white-space:nowrap}
td.num{text-align:right}
td.note{color:#5f6368}
td.note code{font-size:11px}
.y{background:#1e8e3e;color:#fff}
.w{background:#f9ab00;color:#202124}
.t{background:#e8eaed;color:#5f6368}
</style>
</head>
<body>
<h1>Doc Freshness — when to update the authored docs</h1>
<p class="sub">${rows.length} authored docs · <b>${due} review-due</b> · ${fresh} fresh · ${unlinked} with no linked evidence sources. Snapshot as of ${escapeHtml(asOf)}; refresh with <code>npm run doc-freshness</code>. A review-due doc is cleared by editing it or acknowledging it in reviewed.csv ("reviewed on this date, still accurate").</p>
<table>
<thead><tr><th>Doc</th><th>Area</th><th>Status</th><th>Days behind</th><th>Doc last changed</th><th>Linked sources</th><th>Newer sources (triggers)</th></tr></thead>
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

function readCsv(path) {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split("\n");
  const headers = parseCsvLine(header);
  return lines.map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
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
