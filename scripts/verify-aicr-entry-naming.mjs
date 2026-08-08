#!/usr/bin/env node

// Make a page that names an AICR entry name the version it retained.
//
// The catalog's argument for AICR is that it retains exact versions. The
// pages then say "the training entry", which is unambiguous only while one
// training entry exists. The moment a second retained version lands, every
// version-free reference becomes a guess, and the reader has no way to tell
// which one a sentence meant.
//
// This lane requires a page that mentions an entry to name that entry's
// retained version somewhere on the page. Once, not in every sentence, so the
// prose stays readable.
//
// It deliberately does not check which version a sentence attributes to which
// entry. Pages compare entries, so a page that correctly discusses the KServe
// entry alongside AICR v0.14.0 carries both identifiers legitimately, and a
// page-level rule cannot tell that from a mistake. A check that fires on
// correct prose is worse than no check, so attribution stays a reviewer's job.
//
// The register is examples/aicr/claims/entry-names.yaml. It exists so the
// naming decision is written down rather than carried in whoever wrote the
// last page.
//
// Everything runs offline against committed bytes.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const registerPath = join(repoRoot, "examples", "aicr", "claims", "entry-names.yaml");
const summaryPath = join(repoRoot, "data", "aicr-entry-naming", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-aicr-entry-naming.mjs --generate
  node scripts/verify-aicr-entry-naming.mjs --verify
  node scripts/verify-aicr-entry-naming.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const report = audit(loadRegister(), repoRoot);
  write(summaryPath, renderSummary(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = audit(loadRegister(), repoRoot);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-entry-naming:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-entry-naming:generate`,
  );
  console.log(
    `verified that ${report.rows.length} entry reference(s) across ${report.pages.length} AICR page(s) name the retained version`,
  );
} else {
  selfTest();
  console.log("verified the entry-naming checker against fake pages");
}

function loadRegister(path = registerPath) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const doc = readYaml(path);
  check(doc.kind === "EntryNamingRegister", `${relativeRepo(path)}: expected kind EntryNamingRegister`);
  const spec = doc.spec ?? {};
  check((spec.scope?.pages ?? []).length > 0, `${relativeRepo(path)}: the register names no page directories`);
  check((spec.entries ?? []).length > 0, `${relativeRepo(path)}: no entries are declared`);
  const seen = new Set();
  for (const entry of spec.entries) {
    check(entry.id, `${relativeRepo(path)}: an entry declares no id`);
    check(!seen.has(entry.id), `${relativeRepo(path)}: two entries share the id ${entry.id}`);
    seen.add(entry.id);
    check(entry.retainedVersion, `${relativeRepo(path)}: entry ${entry.id} declares no retained version`);
    check(entry.versionSource, `${relativeRepo(path)}: entry ${entry.id} does not say where its version comes from`);
    check((entry.names ?? []).length > 0, `${relativeRepo(path)}: entry ${entry.id} lists no names`);
    check(entry.page, `${relativeRepo(path)}: entry ${entry.id} names no page`);
  }
  return { path, spec };
}

function normalizeProse(text) {
  return text.replace(/[`*]/g, "").replace(/\s+/g, " ");
}

// Pages in scope are every markdown file under a declared directory, filtered
// by prefix where the directory holds more than AICR.
function pagesInScope(spec, root) {
  const pages = [];
  for (const dir of spec.scope.pages) {
    const absolute = join(root, dir);
    check(existsSync(absolute), `${dir} does not exist`);
    for (const name of readdirSync(absolute).sort()) {
      if (!name.endsWith(".md")) continue;
      const relative = `${dir}/${name}`;
      const isAicrDir = dir.includes("aicr");
      if (!isAicrDir && spec.scope.prefix && !name.startsWith(spec.scope.prefix)) continue;
      if ((spec.exemptPages ?? []).includes(relative)) continue;
      pages.push(relative);
    }
  }
  check(pages.length > 0, "no AICR pages are in scope");
  return pages;
}

// A page references an entry when it uses one of the entry's names or links
// to the entry's own page. Linking counts, because a page that sends a reader
// to an entry is talking about it.
function referencesEntry(text, entry) {
  const link = basename(entry.page);
  const byName = entry.names.filter((name) => text.includes(name));
  const byLink = text.includes(link);
  return { referenced: byName.length > 0 || byLink, byName, byLink };
}

function audit(register, root) {
  const spec = register.spec;
  const pages = pagesInScope(spec, root);
  const rows = [];
  const missing = [];

  for (const page of pages) {
    const text = normalizeProse(readFileSync(join(root, page), "utf8"));
    for (const entry of spec.entries) {
      const reference = referencesEntry(text, entry);
      if (!reference.referenced) continue;
      // The entry's own page always names its version, so it is checked the
      // same way rather than exempted.
      const namesVersion = text.includes(entry.retainedVersion);
      if (!namesVersion) {
        missing.push({ page, entry: entry.id, version: entry.retainedVersion, via: reference.byName[0] ?? basename(entry.page) });
        continue;
      }
      rows.push({ page, entry: entry.id, version: entry.retainedVersion, via: reference.byName[0] ?? `link to ${basename(entry.page)}` });
    }
  }

  check(
    missing.length === 0,
    `these pages name an entry without naming the version it retained: ${missing
      .map((row) => `${row.page} mentions ${row.entry} (as "${row.via}") and never says ${row.version}`)
      .join("; ")}`,
  );
  return { pages, rows, entries: spec.entries };
}

function renderSummary(report) {
  const entryRows = report.entries.map((entry) => {
    const cited = report.rows.filter((row) => row.entry === entry.id).map((row) => `\`${row.page.split("/").pop()}\``);
    return `| \`${entry.id}\` | ${entry.retainedVersion} | ${cited.length} | ${cited.join(", ")} |`;
  });

  return `# What the AICR entries are called, and which version each page names

**UNOFFICIAL/EXPERIMENTAL.** Generated by
\`npm run aicr-entry-naming:generate\` and checked by
\`npm run aicr-entry-naming:verify\`. The register this reads is hand-authored
at \`${relativeRepo(registerPath)}\`.

The catalog retains exact versions, so "the training entry" is unambiguous
only while one training entry exists. A second retained version turns every
version-free reference into a guess. This lane requires a page that mentions
an entry to name that entry's retained version somewhere on the page, once
rather than in every sentence.

| Entry | Retained version | Pages that name it | Where |
| --- | --- | --- | --- |
${entryRows.join("\n")}

${report.rows.length} entry references across ${report.pages.length} pages in scope all
name their version. A new page mentioning an entry fails the lane until it
does the same.

## What it does not check

It does not check which version a sentence attributes to which entry. These
pages compare entries, so one that correctly discusses the KServe entry
alongside AICR v0.14.0 carries both identifiers for good reason, and nothing at
page granularity can tell that from a mistake. That check was built, fired on
correct prose, and was removed rather than kept behind a list of exemptions.

## Why the version and not a nickname

Three of these entries retain an AICR release and carry its tag. The KServe
entry retains a GitHub subtree rather than a release, so its version is the
upstream commit its retention receipt pins, and prose uses the short form. The
CPU starter is derived rather than retained, so it carries the version of the
entry it came from until the decision on whether it tracks or forks is made.

Naming the source of each version in the register matters more than the string
itself. A version nobody can trace back to a receipt is decoration.

Everything runs offline against committed bytes. No cluster, no organization,
and no network takes part.
`;
}

function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-entry-naming-self-test-"));
  try {
    const base = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "EntryNamingRegister",
      metadata: { name: "fixture" },
      spec: {
        scope: { pages: ["aicr"], prefix: "aicr-" },
        entries: [
          {
            id: "alpha",
            page: "aicr/alpha.md",
            retainedVersion: "v1.0.0",
            versionSource: "fixture",
            names: ["alpha entry"],
          },
          {
            id: "beta",
            page: "aicr/beta.md",
            retainedVersion: "v2.0.0",
            versionSource: "fixture",
            names: ["beta entry"],
          },
        ],
        exemptPages: [],
      },
    };
    const writeRegister = (name, mutate) => {
      const value = JSON.parse(JSON.stringify(base));
      mutate(value);
      const path = join(scratch, `${name}.yaml`);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      return path;
    };
    const page = (name, text) => write(join(scratch, "aicr", name), text);
    const fails = (fn, pattern) => {
      try {
        fn();
        return false;
      } catch (error) {
        return pattern.test(String(error.message));
      }
    };

    page("alpha.md", "The alpha entry retains v1.0.0 and renders things.\n");
    page("beta.md", "The beta entry retains v2.0.0 and renders other things.\n");
    const good = loadRegister(writeRegister("good", () => {}));
    const report = audit(good, scratch);
    check(report.rows.length === 2, "self-test did not find both fixture references");

    page("gamma.md", "The alpha entry is worth reading about.\n");
    check(
      fails(() => audit(good, scratch), /mentions alpha \(as "alpha entry"\) and never says v1.0.0/),
      "self-test accepted a page naming an entry with no version",
    );
    rmSync(join(scratch, "aicr", "gamma.md"));

    // A page discussing both entries may name both versions.
    page("both.md", "The alpha entry retains v1.0.0 and the beta entry retains v2.0.0.\n");
    audit(good, scratch);
    rmSync(join(scratch, "aicr", "both.md"));

    // A link to the entry's page counts as a reference.
    page("linked.md", "See [the entry](./alpha.md) for the details.\n");
    check(
      fails(() => audit(good, scratch), /mentions alpha \(as "alpha.md"\) and never says v1.0.0/),
      "self-test accepted a page linking to an entry with no version",
    );
    rmSync(join(scratch, "aicr", "linked.md"));

    check(
      fails(() => loadRegister(writeRegister("no-source", (value) => {
        delete value.spec.entries[0].versionSource;
      })), /does not say where its version comes from/),
      "self-test accepted an entry with no version source",
    );
    check(
      fails(() => loadRegister(writeRegister("no-version", (value) => {
        delete value.spec.entries[1].retainedVersion;
      })), /declares no retained version/),
      "self-test accepted an entry with no retained version",
    );
    check(
      fails(() => audit(loadRegister(writeRegister("missing-dir", (value) => {
        value.spec.scope.pages = ["absent"];
      })), scratch), /absent does not exist/),
      "self-test accepted a scope naming a missing directory",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
