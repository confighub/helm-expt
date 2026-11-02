#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { check, listFiles, relativeRepo, repoRoot } from "./lib/proof-common.mjs";

const registryPrefix =
  "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/";
const commandPattern = new RegExp(
  String.raw`cub installer (?:setup --pull|inspect)\s+(?:["']|&quot;|&#39;)?(${escapeRegExp(registryPrefix)}[A-Za-z0-9._/-]+:[A-Za-z0-9._-]+(?:@sha256:[0-9a-f]{64})?)`,
  "gu",
);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] ?? "--verify";
  if (mode === "--verify") {
    verifyMaintainedInstallerCommands();
  } else if (mode === "--self-test") {
    selfTest();
  } else {
    console.log(`Usage:
  node scripts/verify-installer-consumer-commands.mjs --verify
  node scripts/verify-installer-consumer-commands.mjs --self-test`);
    process.exit(1);
  }
}

export function verifyMaintainedInstallerCommands() {
  const files = maintainedFiles();
  const findings = files.flatMap((path) => mutableCommands(path, readFileSync(path, "utf8")));
  check(
    findings.length === 0,
    `mutable public installer command(s) found:\n${findings.map((item) => `- ${item}`).join("\n")}`,
  );
  const current = currentPackageDigests();
  const stale = authoredDocFiles().flatMap((path) => stalePins(path, readFileSync(path, "utf8"), current));
  check(
    stale.length === 0,
    `package digest(s) the registry no longer serves for that tag, which cub installer refuses:\n${stale.map((item) => `- ${item}`).join("\n")}`,
  );
  console.log(`verified digest-pinned cub installer commands across ${files.length} maintained file(s)`);
}

// The digest each published package tag resolves to now. cub installer refuses a
// pin that differs, so a page that prints an older digest gives a failing command.
function currentPackageDigests() {
  const rows = JSON.parse(readFileSync(join(repoRoot, "data/installer-oci-packages/packages.json"), "utf8"));
  const current = new Map();
  for (const row of Array.isArray(rows) ? rows : rows.packages) {
    const match = /\/helm-expt\/([^@]+)@(sha256:[0-9a-f]{64})$/u.exec(row.digest_pinned_ref ?? row.digestPinnedRef ?? "");
    if (match) current.set(match[1], match[2]);
  }
  check(current.size > 0, "data/installer-oci-packages/packages.json lists no digest-pinned package");
  return current;
}

// Authored docs a reader runs commands from. A dated log and a planning record
// keep the digest they ran with, because each is a record of that moment.
function authoredDocFiles() {
  return listFiles(join(repoRoot, "docs"))
    .filter((path) => extname(path) === ".md")
    .filter((path) => !/docs\/planning\/|\/live-|\d{4}-\d{2}-\d{2}/u.test(relativeRepo(path)));
}

function stalePins(path, source, current) {
  const findings = [];
  for (const match of source.matchAll(/\/helm-expt\/([a-z0-9.-]+:[A-Za-z0-9._-]+)@(sha256:[0-9a-f]{64})/gu)) {
    const expected = current.get(match[1]);
    if (!expected || expected === match[2]) continue;
    const line = source.slice(0, match.index).split("\n").length;
    findings.push(`${relativeRepo(path)}:${line}: ${match[1]} pins ${match[2].slice(0, 19)}, current ${expected.slice(0, 19)}`);
  }
  return findings;
}

function maintainedFiles() {
  const directFiles = ["README.md", "CATALOG.md", "docs/README.md"];
  const roots = [
    "docs/user",
    "docs/reference",
    "docs/demo",
    "docs/agent",
    "recipes",
    "data/installer-oci-packages",
    "data/confighub-example-guides",
    "data/top20-base-readiness",
    "data/chart-use-guide",
    "data/hard-chart-production-packets",
    "site",
  ];
  const allowedExtensions = new Set([".csv", ".html", ".json", ".md", ".sh", ".yaml", ".yml"]);
  const files = directFiles
    .map((path) => join(repoRoot, path))
    .filter(existsSync);

  for (const root of roots) {
    const absoluteRoot = join(repoRoot, root);
    if (!existsSync(absoluteRoot)) continue;
    if (statSync(absoluteRoot).isFile()) {
      files.push(absoluteRoot);
      continue;
    }
    files.push(...listFiles(absoluteRoot).filter((path) => allowedExtensions.has(extname(path))));
  }

  return [...new Set(files)].sort();
}

function mutableCommands(path, source) {
  const findings = [];
  for (const match of source.matchAll(commandPattern)) {
    const ref = match[1];
    if (ref.includes("@sha256:")) continue;
    const line = source.slice(0, match.index).split("\n").length;
    findings.push(`${relativeRepo(path)}:${line}: ${ref}`);
  }
  return findings;
}

export function selfTest() {
  const mutable = `${registryPrefix}bitnami-redis:25.5.3`;
  const exact = `${mutable}@sha256:${"a".repeat(64)}`;
  check(
    mutableCommands(join(repoRoot, "mutable.md"), `cub installer setup --pull ${mutable} --base default`).length === 1,
    "self-test did not refuse a mutable setup command",
  );
  check(
    mutableCommands(join(repoRoot, "exact.md"), `cub installer setup --pull ${exact} --base default`).length === 0,
    "self-test refused a digest-pinned setup command",
  );
  check(
    mutableCommands(join(repoRoot, "inspect.md"), `cub installer inspect '${mutable}' --json`).length === 1,
    "self-test did not refuse a mutable inspect command",
  );
  const current = new Map([["bitnami-redis:25.5.3", `sha256:${"a".repeat(64)}`]]);
  check(
    stalePins(join(repoRoot, "stale.md"), `${mutable}@sha256:${"b".repeat(64)}`, current).length === 1,
    "self-test did not refuse a stale package digest",
  );
  check(
    stalePins(join(repoRoot, "exact.md"), exact, current).length === 0,
    "self-test refused the current package digest",
  );
  console.log("installer consumer command self-test passed");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
