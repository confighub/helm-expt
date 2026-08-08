#!/usr/bin/env node

// Hold the AICR pages to the counts they claim.
//
// The pages say things like "seventeen components", "twenty Applications" and
// "sixteen model shapes". Every one of those numbers was true when someone
// typed it. None of them fails when an entry gains a component, because prose
// does not fail a lane, and the catalog's whole argument is that claims should
// be checkable rather than trusted.
//
// This lane closes that. Every counted claim is declared in
// examples/aicr/claims/numeric-claims.yaml and bound to a quantity computed
// from committed bytes. The checker recomputes each quantity, compares it to
// the number on the page, and refuses a disagreement. It also reads every AICR
// page looking for counted claims the register does not cover, so a new
// sentence with a new number cannot slip in undeclared.
//
// The claim-integrity discipline this follows already exists for chart pages
// in verify-chart-claim-integrity.mjs. This is the same idea applied to prose
// whose numbers come from directories and receipts rather than from lane
// columns.
//
// Everything runs offline against committed bytes. No cluster, no
// organization, and no network is involved.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const registerPath = join(repoRoot, "examples", "aicr", "claims", "numeric-claims.yaml");
const summaryPath = join(repoRoot, "data", "aicr-claim-integrity", "summary.md");

// Number words the pages actually use. Prose in this repository spells small
// numbers and uses digits for larger ones, so both forms have to parse.
const NUMBER_WORDS = new Map([
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6],
  ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11],
  ["twelve", 12], ["thirteen", 13], ["fourteen", 14], ["fifteen", 15],
  ["sixteen", 16], ["seventeen", 17], ["eighteen", 18], ["nineteen", 19],
  ["twenty", 20], ["twenty-one", 21], ["twenty-two", 22], ["twenty-three", 23],
  ["twenty-four", 24], ["twenty-five", 25], ["twenty-six", 26],
  ["twenty-seven", 27], ["twenty-eight", 28], ["twenty-nine", 29], ["thirty", 30],
]);

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-aicr-claim-integrity.mjs --generate
  node scripts/verify-aicr-claim-integrity.mjs --verify
  node scripts/verify-aicr-claim-integrity.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const report = audit(loadRegister(), repoRoot);
  write(summaryPath, renderSummary(report));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = audit(loadRegister(), repoRoot);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-claims:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(report),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-claims:generate`,
  );
  console.log(
    `verified ${report.claims.length} counted claim(s) across ${report.pages.length} AICR page(s) against ${report.quantities.length} computed quantities`,
  );
} else {
  selfTest();
  console.log("verified the claim-integrity checker against fake pages");
}

function loadRegister(path = registerPath) {
  check(existsSync(path), `${relativeRepo(path)} is missing`);
  const doc = readYaml(path);
  check(doc.kind === "NumericClaimRegister", `${relativeRepo(path)}: expected kind NumericClaimRegister`);
  const spec = doc.spec ?? {};
  check(spec.scope?.pages, `${relativeRepo(path)}: the register names no page directory`);
  check((spec.countedNouns ?? []).length > 0, `${relativeRepo(path)}: no counted nouns are declared`);
  check((spec.quantities ?? []).length > 0, `${relativeRepo(path)}: no quantities are declared`);
  check((spec.claims ?? []).length > 0, `${relativeRepo(path)}: no claims are declared`);

  const byId = new Map();
  for (const quantity of spec.quantities) {
    check(quantity.id && quantity.compute?.kind, `${relativeRepo(path)}: a quantity declares no id or compute`);
    check(!byId.has(quantity.id), `${relativeRepo(path)}: two quantities share the id ${quantity.id}`);
    check(quantity.description, `${relativeRepo(path)}: quantity ${quantity.id} says nothing about what it counts`);
    byId.set(quantity.id, quantity);
  }
  const seen = new Set();
  for (const claim of spec.claims) {
    check(claim.id, `${relativeRepo(path)}: a claim declares no id`);
    check(!seen.has(claim.id), `${relativeRepo(path)}: two claims share the id ${claim.id}`);
    seen.add(claim.id);
    check(byId.has(claim.quantity), `${relativeRepo(path)}: claim ${claim.id} names the unknown quantity ${claim.quantity}`);
    check(claim.page, `${relativeRepo(path)}: claim ${claim.id} names no page`);
    check((claim.phrases ?? []).length > 0, `${relativeRepo(path)}: claim ${claim.id} lists no phrases`);
    for (const phrase of claim.phrases) {
      check(
        parseLeadingNumber(phrase) !== null,
        `${relativeRepo(path)}: claim ${claim.id} phrase ${JSON.stringify(phrase)} starts with no number`,
      );
    }
  }
  // A quantity nothing cites is a computation with no claim behind it. A
  // quantity another quantity builds on counts as cited, because an
  // intermediate step is reached through whatever cites the result.
  const cited = new Set(spec.claims.map((claim) => claim.quantity));
  for (const quantity of spec.quantities) {
    if (quantity.compute.kind === "minus") cited.add(quantity.compute.from);
    if (quantity.compute.kind === "sum") for (const id of quantity.compute.of) cited.add(id);
  }
  const orphans = [...byId.keys()].filter((id) => !cited.has(id));
  check(orphans.length === 0, `${relativeRepo(path)}: ${orphans.join(", ")} computed but no claim cites them`);
  return { path, spec, quantitiesById: byId };
}

function parseLeadingNumber(phrase) {
  const word = phrase.match(/^([a-z]+(?:-[a-z]+)?)[ -]/i);
  if (word && NUMBER_WORDS.has(word[1].toLowerCase())) return NUMBER_WORDS.get(word[1].toLowerCase());
  const digits = phrase.match(/^(\d+)[ -]/);
  return digits ? Number(digits[1]) : null;
}

// Prose wraps at the column the house style uses, and it marks up code with
// backticks. Neither changes what a sentence claims, so both are flattened
// before anything is matched. Without this the gate would be a test of where
// the line breaks fall.
function normalizeProse(text) {
  return text.replace(/[`*]/g, "").replace(/\s+/g, " ");
}

function valueAt(value, path) {
  return path.split(".").reduce((node, key) => (node == null ? node : node[key]), value);
}

function readStructured(root, relative) {
  const path = join(root, relative);
  check(existsSync(path), `${relative} is missing, so a quantity cannot be computed from it`);
  return relative.endsWith(".json") ? JSON.parse(readFileSync(path, "utf8")) : readYaml(path);
}

// compute turns a declared quantity into a number, and fails loudly when the
// bytes it names have moved. A quantity that cannot be computed is a stronger
// signal than one that silently reads zero.
function compute(quantity, root, resolved) {
  const spec = quantity.compute;
  if (spec.kind === "files") {
    const dir = join(root, spec.dir);
    check(existsSync(dir), `${quantity.id}: ${spec.dir} does not exist`);
    const count = readdirSync(dir).filter((name) => name.endsWith(spec.suffix)).length;
    check(count > 0, `${quantity.id}: ${spec.dir} holds no ${spec.suffix} files`);
    return count;
  }
  if (spec.kind === "listLength") {
    const list = valueAt(readStructured(root, spec.file), spec.path);
    check(Array.isArray(list), `${quantity.id}: ${spec.file} has no list at ${spec.path}`);
    return list.length;
  }
  if (spec.kind === "number") {
    const value = valueAt(readStructured(root, spec.file), spec.path);
    check(Number.isInteger(value), `${quantity.id}: ${spec.file} has no integer at ${spec.path}`);
    return value;
  }
  if (spec.kind === "countWhere") {
    const list = valueAt(readStructured(root, spec.file), spec.path);
    check(Array.isArray(list), `${quantity.id}: ${spec.file} has no list at ${spec.path}`);
    const count = list.filter((row) => String(row?.[spec.key]) === String(spec.equals)).length;
    check(count > 0, `${quantity.id}: no row in ${spec.path} has ${spec.key} ${spec.equals}`);
    return count;
  }
  if (spec.kind === "selectField") {
    const list = valueAt(readStructured(root, spec.file), spec.listPath);
    check(Array.isArray(list), `${quantity.id}: ${spec.file} has no list at ${spec.listPath}`);
    const row = list.find((entry) => String(entry?.[spec.key]) === String(spec.equals));
    check(row, `${quantity.id}: ${spec.listPath} has no row where ${spec.key} is ${spec.equals}`);
    const value = valueAt(row, spec.field);
    check(Number.isInteger(value), `${quantity.id}: that row has no integer at ${spec.field}`);
    return value;
  }
  if (spec.kind === "minus") {
    const from = resolved.get(spec.from);
    check(from !== undefined, `${quantity.id}: names the quantity ${spec.from}, which is not computed before it`);
    return from - spec.subtract;
  }
  if (spec.kind === "sum") {
    return spec.of.reduce((total, id) => {
      const value = resolved.get(id);
      check(value !== undefined, `${quantity.id}: names the quantity ${id}, which is not computed before it`);
      return total + value;
    }, 0);
  }
  check(spec.kind === "literal", `${quantity.id}: unknown compute kind ${spec.kind}`);
  // A literal is a number no directory or receipt field holds. It carries the
  // evidence path so a reader can check it by hand, and saying so is better
  // than inventing a computation that only looks derived.
  check(spec.evidence, `${quantity.id}: a literal quantity must cite the evidence a reader can check`);
  check(existsSync(join(root, spec.evidence)), `${quantity.id}: cites ${spec.evidence}, which does not exist`);
  check(Number.isInteger(spec.value), `${quantity.id}: a literal quantity must declare an integer value`);
  return spec.value;
}

// findCountedPhrases returns every "<number> <noun>" occurrence on a page, so
// a claim nobody declared can be named rather than missed.
function findCountedPhrases(text, nouns) {
  const numbers = [...NUMBER_WORDS.keys(), "\\d+"].join("|");
  const found = [];
  for (const noun of nouns) {
    const pattern = new RegExp(`\\b(${numbers})[ -](${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      found.push({ phrase: `${match[1]} ${match[2]}`, raw: match[0], noun, index: match.index });
    }
  }
  return found;
}

function audit(register, root) {
  const spec = register.spec;
  const pagesDir = join(root, spec.scope.pages);
  check(existsSync(pagesDir), `${spec.scope.pages} does not exist`);
  const pages = readdirSync(pagesDir).filter((name) => name.endsWith(".md")).sort();
  check(pages.length > 0, `${spec.scope.pages} holds no pages`);

  const resolved = new Map();
  const quantities = [];
  for (const quantity of spec.quantities) {
    const value = compute(quantity, root, resolved);
    resolved.set(quantity.id, value);
    quantities.push({ id: quantity.id, value, description: quantity.description, kind: quantity.compute.kind });
  }

  const pageText = new Map(pages.map((name) => [name, normalizeProse(readFileSync(join(pagesDir, name), "utf8"))]));
  const claims = [];
  for (const claim of spec.claims) {
    const text = pageText.get(claim.page);
    check(text !== undefined, `claim ${claim.id} names the page ${claim.page}, which does not exist`);
    const expected = resolved.get(claim.quantity);
    for (const phrase of claim.phrases) {
      const declared = parseLeadingNumber(phrase);
      check(
        declared === expected,
        `claim ${claim.id} says ${JSON.stringify(phrase)} on ${claim.page}, and ${claim.quantity} computes to ${expected}`,
      );
      // Both spellings appear in prose, so a hyphen must not decide the match.
      const present = text.includes(phrase) || text.includes(phrase.replace(" ", "-"));
      check(present, `claim ${claim.id} declares ${JSON.stringify(phrase)}, which no longer appears on ${claim.page}`);
    }
    claims.push({ id: claim.id, page: claim.page, quantity: claim.quantity, value: expected, phrases: claim.phrases });
  }

  // Every counted phrase on every page has to be covered, or the register is
  // a curated list rather than a gate.
  const covered = new Map();
  for (const claim of spec.claims) {
    const set = covered.get(claim.page) ?? new Set();
    for (const phrase of claim.phrases) {
      set.add(phrase.toLowerCase());
      set.add(phrase.replace(" ", "-").toLowerCase());
    }
    covered.set(claim.page, set);
  }
  const uncovered = [];
  for (const [page, text] of pageText) {
    for (const hit of findCountedPhrases(text, spec.countedNouns)) {
      const set = covered.get(page) ?? new Set();
      if (set.has(hit.raw.toLowerCase()) || set.has(hit.phrase.toLowerCase())) continue;
      uncovered.push({ page, phrase: hit.raw });
    }
  }
  check(
    uncovered.length === 0,
    `these counted claims are on a page but not in ${relativeRepo(register.path)}: ${uncovered
      .map((row) => `${row.page}: ${JSON.stringify(row.phrase)}`)
      .join("; ")}`,
  );

  return { pages, quantities, claims, register };
}

function renderSummary(report) {
  const quantityRows = report.quantities.map(
    (row) => `| \`${row.id}\` | ${row.value} | \`${row.kind}\` | ${row.description.replace(/\s+/g, " ").trim()} |`,
  );
  const claimRows = report.claims.map(
    (row) => `| \`${row.id}\` | \`${row.page}\` | ${row.phrases.map((phrase) => `"${phrase}"`).join(", ")} | \`${row.quantity}\` = ${row.value} |`,
  );

  return `# The counts the AICR pages claim

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`npm run aicr-claims:generate\` and
checked by \`npm run aicr-claims:verify\`. The register this reads is
hand-authored at \`${relativeRepo(report.register.path)}\`.

The AICR pages count things in prose. An entry that gains a component makes
those sentences wrong without failing anything, because prose does not fail a
lane. This lane recomputes every counted claim from committed bytes, refuses a
disagreement, and refuses a counted claim on a page that the register does not
cover.

## What each quantity computes to today

| Quantity | Value | Computed by | What it counts |
| --- | --- | --- | --- |
${quantityRows.join("\n")}

## Which sentence each one holds up

| Claim | Page | Phrase | Bound to |
| --- | --- | --- | --- |
${claimRows.join("\n")}

${report.claims.length} claims across ${report.pages.length} pages are covered. A
sentence that adds a new count fails the lane until it is declared here, which
is the difference between a register and a list somebody once wrote.

## What this does not check

It checks numbers, not meaning. A page can count correctly and still describe
the wrong thing, and this lane will pass it. The claims that resist counting,
such as which rung an entry has climbed or what a proof did not prove, are held
by the receipts and by the platform evidence record rather than here.

Everything runs offline against committed bytes. No cluster, no organization,
and no network takes part.
`;
}

// The self-test builds fake pages and a fake register, so every refusal runs
// without touching the committed AICR surfaces.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-claim-integrity-self-test-"));
  try {
    const pagesDir = join(scratch, "pages");
    const entryDir = join(scratch, "entry");
    writeFileSync(join(scratch, "register.yaml"), "");
    const mk = (dir, files) => {
      for (const [name, text] of Object.entries(files)) write(join(dir, name), text);
    };
    mk(pagesDir, { "alpha.md": "The entry renders three Applications today.\n" });
    mk(entryDir, { "a.yaml": "a\n", "b.yaml": "b\n", "c.yaml": "c\n" });

    const base = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "NumericClaimRegister",
      metadata: { name: "fixture" },
      spec: {
        scope: { pages: "pages" },
        countedNouns: ["Applications"],
        quantities: [
          { id: "entry-applications", description: "fixture", compute: { kind: "files", dir: "entry", suffix: ".yaml" } },
        ],
        claims: [
          { id: "alpha-renders-three", quantity: "entry-applications", page: "alpha.md", phrases: ["three Applications"] },
        ],
      },
    };
    const writeRegister = (name, mutate) => {
      const value = JSON.parse(JSON.stringify(base));
      mutate(value);
      const path = join(scratch, `${name}.yaml`);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
      return path;
    };
    const fails = (fn, pattern) => {
      try {
        fn();
        return false;
      } catch (error) {
        return pattern.test(String(error.message));
      }
    };

    const good = loadRegister(writeRegister("good", () => {}));
    const report = audit(good, scratch);
    check(report.quantities[0].value === 3, "self-test did not compute the fixture quantity");
    check(report.claims.length === 1, "self-test did not audit the fixture claim");

    // The sentence the claim points at was rewritten.
    write(join(pagesDir, "alpha.md"), "The entry renders four Applications today.\n");
    check(
      fails(() => audit(good, scratch), /declares "three Applications", which no longer appears on alpha.md/),
      "self-test accepted a claim whose phrase left the page",
    );
    write(join(pagesDir, "alpha.md"), "The entry renders three Applications today.\n");

    // A count nobody declared.
    write(join(pagesDir, "beta.md"), "Nine Applications appeared from nowhere.\n");
    check(
      fails(() => audit(good, scratch), /not in .*: beta.md: "Nine Applications"/),
      "self-test accepted an undeclared counted claim",
    );
    rmSync(join(pagesDir, "beta.md"));

    // The bytes moved and the register did not.
    write(join(entryDir, "d.yaml"), "d\n");
    check(
      fails(() => audit(good, scratch), /entry-applications computes to 4/),
      "self-test accepted a claim after the entry gained a document",
    );
    rmSync(join(entryDir, "d.yaml"));
    audit(good, scratch);

    check(
      fails(() => loadRegister(writeRegister("orphan", (value) => {
        value.spec.quantities.push({ id: "unused", description: "fixture", compute: { kind: "files", dir: "entry", suffix: ".yaml" } });
      })), /unused computed but no claim cites them/),
      "self-test accepted a quantity no claim cites",
    );
    // An intermediate quantity is reached through the one that builds on it.
    loadRegister(writeRegister("intermediate", (value) => {
      value.spec.quantities.push({ id: "half", description: "fixture", compute: { kind: "files", dir: "entry", suffix: ".yaml" } });
      value.spec.quantities.push({ id: "doubled", description: "fixture", compute: { kind: "sum", of: ["half", "entry-applications"] } });
      value.spec.claims.push({ id: "beta-claim", quantity: "doubled", page: "alpha.md", phrases: ["six Applications"] });
    }));
    check(
      fails(() => loadRegister(writeRegister("unknown-quantity", (value) => {
        value.spec.claims[0].quantity = "missing";
      })), /names the unknown quantity missing/),
      "self-test accepted a claim naming an unknown quantity",
    );
    check(
      fails(() => loadRegister(writeRegister("numberless", (value) => {
        value.spec.claims[0].phrases = ["several Applications"];
      })), /starts with no number/),
      "self-test accepted a phrase with no number in it",
    );
    check(
      fails(() => audit(loadRegister(writeRegister("missing-dir", (value) => {
        value.spec.quantities[0].compute.dir = "absent";
      })), scratch), /absent does not exist/),
      "self-test accepted a quantity over a missing directory",
    );
    check(
      fails(() => audit(loadRegister(writeRegister("literal-without-evidence", (value) => {
        value.spec.quantities[0].compute = { kind: "literal", value: 3 };
      })), scratch), /must cite the evidence a reader can check/),
      "self-test accepted a literal quantity with no evidence path",
    );
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
