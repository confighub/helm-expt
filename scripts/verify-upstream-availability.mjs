#!/usr/bin/env node

// Check data/upstream-availability/observations.yaml against the source locks
// it names, offline. With --check-live it also re-measures every https source
// lock against its repository's index and reports what has changed since.
//
//   node scripts/verify-upstream-availability.mjs
//   node scripts/verify-upstream-availability.mjs --check-live

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, readYamlText, repoRoot } from "./lib/proof-common.mjs";
import { OBSERVATIONS_PATH, STATUSES, upstreamObservations } from "./lib/upstream-availability.mjs";

const rows = upstreamObservations();
check(rows.length > 0, `${OBSERVATIONS_PATH} records no observation`);
const seen = new Set();
for (const row of rows) {
  const where = `${OBSERVATIONS_PATH}: ${row.chart}@${row.version}`;
  check(!seen.has(row.lock), `${where} is recorded twice`);
  seen.add(row.lock);
  check(existsSync(join(repoRoot, row.lock)), `${where} names a source lock that does not exist, ${row.lock}`);
  const lock = readYaml(join(repoRoot, row.lock)).spec;
  check(`${lock.repositoryName}/${lock.chart}` === row.chart || lock.ref === row.chart, `${where} does not match the chart its lock records, ${lock.ref}`);
  check(String(lock.version) === String(row.version), `${where} does not match the version its lock records, ${lock.version}`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(String(row.observedOn)), `${where} has no observation date`);
  check(STATUSES.includes(row.status), `${where} has status ${row.status}, not one of ${STATUSES.join(", ")}`);
  check(String(row.detail ?? "").trim().length > 0, `${where} says nothing about what was measured`);
  if (row.status === "moved") {
    check(/^https:\/\//.test(row.fetchFrom ?? ""), `${where} moved, and names no https address to fetch from`);
    check(row.fetchFrom.replace(/\/$/, "") !== String(lock.repositoryURL).replace(/\/$/, ""), `${where} moved to the address its lock already records`);
    check(row.sha256 === (lock.archiveSHA256 ?? lock.packageSHA256), `${where} moved, and the bytes at the new address are not the ones its lock records`);
  }
  if (row.status === "removed-upstream") check(String(row.catalogCopy ?? "").trim().length > 0, `${where} was removed upstream, and does not say where the Catalog's copy is`);
}
console.log(`verified ${rows.length} upstream availability observation(s) against their source locks`);

if (process.argv.includes("--check-live")) {
  const locks = readdirSync(join(repoRoot, "recipes"), { recursive: true }).filter((path) => String(path).endsWith("source-lock.yaml")).map((path) => `recipes/${path}`).sort();
  const indexes = new Map();
  const changed = [];
  for (const path of locks) {
    const lock = readYaml(join(repoRoot, path)).spec;
    if (!/^https:\/\//.test(lock.repositoryURL ?? "")) continue;
    const observed = rows.find((row) => row.lock === path);
    const url = (observed?.status === "moved" ? observed.fetchFrom : lock.repositoryURL).replace(/\/$/, "");
    if (!indexes.has(url)) {
      try { indexes.set(url, execFileSync("curl", ["-fsSL", "--max-time", "30", `${url}/index.yaml`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })); } catch { indexes.set(url, null); }
    }
    const index = indexes.get(url);
    const entries = index === null ? [] : (readYamlText(index)?.entries?.[lock.chart] ?? []);
    const listed = entries.some((entry) => String(entry.version) === String(lock.version));
    if (!listed && observed?.status !== "removed-upstream") changed.push(`${path}: ${index === null ? `${url}/index.yaml did not answer` : `${url} no longer lists ${lock.chart} ${lock.version}`}`);
  }
  console.log(changed.length ? `not yet recorded in ${OBSERVATIONS_PATH}:\n  ${changed.join("\n  ")}` : `every https source lock is served where this file says`);
  if (changed.length) process.exit(1);
}
