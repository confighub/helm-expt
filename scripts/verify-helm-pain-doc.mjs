#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot } from "./lib/proof-common.mjs";

const csvPath = join(repoRoot, "data", "pain-point-coverage", "pain-points.csv");
const docPath = join(repoRoot, "docs", "user", "helm-pain-points.md");

const rows = parseCsv(readFileSync(csvPath, "utf8"));
const doc = readFileSync(docPath, "utf8");
const normalizedDoc = normalize(doc);

check(rows.length === 15, `expected 15 Helm pain points, found ${rows.length}`);
for (const row of rows) {
  check(doc.includes(`### ${row.pain_point}`), `missing pain point section in user doc: ${row.pain_point}`);
  check(normalizedDoc.includes(normalize(row.root_cause)), `missing root cause for pain point: ${row.pain_point}`);
  check(normalizedDoc.includes(normalize(`Status: \`${row.current_status}\``)), `missing current status for pain point: ${row.pain_point}`);
  check(normalizedDoc.includes(normalize(row.remaining_gap)), `missing remaining gap for pain point: ${row.pain_point}`);
}

console.log(`verified user Helm pain point doc for ${rows.length} pain point(s)`);

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
