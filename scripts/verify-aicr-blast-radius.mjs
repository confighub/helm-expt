#!/usr/bin/env node

// Check blast-radius parity for the AICR entries.
//
// A single-chart parity gate compares one render against one render, so it
// sees a wrong value and misses a wrong reach. Platform shapes fail the other
// way: the inference entry's reviewed rename had to land on sixteen model
// shapes and on nothing else, and a change that touched fifteen or seventeen
// would have been just as wrong with every value correct.
//
// Each entry commits a control-point record naming what a reviewer may change
// and which documents each control point governs. This checker holds that
// record to two facts it cannot fake:
//
//   1. The record matches the committed bytes. Every document the control
//      point's locator actually appears in must be declared, and every
//      declared document must actually contain it. A record that drifts from
//      the entry it describes is refused rather than trusted.
//   2. Every recorded reviewed change landed exactly on the declared set. The
//      receipts already list the documents each change touched, so the
//      declaration and the live evidence must agree.
//
// This is the blast-radius level of the Pilot parity design in
// docs/planning/aicr-pilot-variants-brief.md. It runs offline against
// committed bytes and needs no cluster, no organization, and no network.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

// The records live outside the entry directories on purpose. A compiler owns
// its entry directory and regenerates it wholesale, so a hand-authored file
// kept inside one would be deleted on the next generate.
//
// Every record in that directory is checked. Listing them by name here would
// mean a new entry's record could be added and never read, which is the failure
// this lane exists to prevent one level down.
const recordRoot = join(repoRoot, "examples", "aicr", "control-points");
const entryRecords = readdirSync(recordRoot)
  .filter((name) => name.endsWith(".yaml"))
  .sort()
  .map((name) => join(recordRoot, name));
const summaryPath = join(repoRoot, "data", "aicr-blast-radius", "summary.md");

const mode = process.argv[2] ?? "--verify";
if (!["--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/verify-aicr-blast-radius.mjs --generate
  node scripts/verify-aicr-blast-radius.mjs --verify
  node scripts/verify-aicr-blast-radius.mjs --self-test`);
  process.exit(2);
}

if (mode === "--generate") {
  const results = entryRecords.map((path) => checkRecord(path));
  write(summaryPath, renderSummary(results));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const results = entryRecords.map((path) => checkRecord(path));
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-blast-radius:generate`);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(results),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-blast-radius:generate`,
  );
  const controlPoints = results.reduce((total, row) => total + row.controlPoints.length, 0);
  const reviewedChanges = results.reduce(
    (total, row) => total + row.controlPoints.reduce((sum, point) => sum + point.reviewedChanges.length, 0),
    0,
  );
  console.log(
    `verified blast-radius parity for ${controlPoints} control point(s) and ${reviewedChanges} reviewed change(s) across ${results.length} entries`,
  );
} else {
  selfTest();
  console.log("verified the blast-radius checker against fake surfaces");
}

// checkRecord is the whole gate. It reads one control-point record, recomputes
// what the committed bytes say, and refuses any disagreement.

// A control point is located three ways, and which one fits is a property of
// where the value lives rather than a preference.
//
// A token is a substring of the rendered bytes. It is the bluntest form and the
// only one that reaches anywhere, which is why it stays.
//
// A path resolves through the parsed document. It says exactly which field it
// means, so a value that happens to appear in an unrelated string cannot be
// mistaken for the control point.
//
// A valuesPath resolves inside the Helm values these Applications carry as an
// embedded YAML string. That is where most platform choices actually live, and
// a path over the outer document cannot reach them. Parsing the string is what
// turns "the storage class" from a substring into a field.
function resolvePath(node, path) {
  return path.split(".").reduce((current, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }
    if (typeof current !== "object") return undefined;
    return current[segment];
  }, node);
}

function reaches(row, locator, form) {
  if (form === "token") return row.text.includes(String(locator.token));
  let root = row.doc;
  if (form === "valuesPath") {
    const values = resolvePath(row.doc, "spec.source.helm.values");
    if (typeof values !== "string") return false;
    const parsed = parseDocs(values);
    if (parsed.length !== 1) return false;
    root = parsed[0];
  }
  const value = resolvePath(root, String(locator[form === "valuesPath" ? "valuesPath" : "path"]));
  if (value === undefined || value === null) return false;
  if (locator.equals === undefined) return true;
  return String(value) === String(locator.equals);
}

function checkRecord(recordPath) {
  check(existsSync(recordPath), `${relativeRepo(recordPath)} is missing`);
  const record = readYaml(recordPath);
  check(record.kind === "ControlPointRecord", `${relativeRepo(recordPath)}: unexpected kind ${record.kind}`);
  const entryPath = String(record.spec?.entry ?? "");
  check(entryPath, `${relativeRepo(recordPath)}: the record names no entry`);
  const entryRoot = join(repoRoot, entryPath);
  check(existsSync(entryRoot), `${relativeRepo(recordPath)}: the entry ${entryPath} does not exist`);

  const scope = record.spec?.documentScope ?? [];
  check(Array.isArray(scope) && scope.length > 0, `${relativeRepo(recordPath)}: the record declares no document scope`);
  const documents = [];
  for (const relative of scope) {
    const scopeRoot = join(entryRoot, relative);
    check(existsSync(scopeRoot), `${relativeRepo(recordPath)}: scope directory ${relative} does not exist`);
    for (const file of listFiles(scopeRoot).filter((path) => path.endsWith(".yaml")).sort()) {
      const text = readFileSync(file, "utf8");
      for (const doc of parseDocs(text)) {
        documents.push({ identity: identity(doc), file: relativeRepo(file), text, doc });
      }
    }
  }
  check(documents.length > 0, `${relativeRepo(recordPath)}: the declared scope contains no documents`);
  const identities = documents.map((row) => row.identity);
  check(
    new Set(identities).size === identities.length,
    `${relativeRepo(recordPath)}: two documents in scope share an identity`,
  );

  const controlPoints = (record.spec?.controlPoints ?? []).map((point) => {
    const id = String(point.id ?? "");
    check(id, `${relativeRepo(recordPath)}: a control point has no id`);
    const locator = point.locator ?? {};
    const forms = ["token", "path", "valuesPath"].filter((form) => locator[form] !== undefined);
    check(
      forms.length === 1,
      `${relativeRepo(recordPath)}: control point ${id} must declare exactly one of token, path or valuesPath, and declares ${forms.length}`,
    );
    const form = forms[0];
    const token = form === "token" ? String(locator.token ?? "") : "";
    if (form === "token") check(token, `${relativeRepo(recordPath)}: control point ${id} has an empty locator token`);
    else check(String(locator[form] ?? ""), `${relativeRepo(recordPath)}: control point ${id} has an empty ${form}`);
    const declared = [...(point.governs ?? [])].sort();
    check(declared.length > 0, `${relativeRepo(recordPath)}: control point ${id} governs no documents`);
    check(
      new Set(declared).size === declared.length,
      `${relativeRepo(recordPath)}: control point ${id} lists a document twice`,
    );

    // Fact one: the declaration matches the committed bytes, in both
    // directions. Undeclared reach and phantom declarations fail alike.
    const actual = documents
      .filter((row) => reaches(row, locator, form))
      .map((row) => row.identity)
      .sort();
    const undeclared = actual.filter((row) => !declared.includes(row));
    const phantom = declared.filter((row) => !actual.includes(row));
    check(
      undeclared.length === 0,
      `${relativeRepo(recordPath)}: control point ${id} also reaches ${undeclared.join(", ")}, which the record does not declare`,
    );
    check(
      phantom.length === 0,
      `${relativeRepo(recordPath)}: control point ${id} declares ${phantom.join(", ")}, which does not contain its locator`,
    );

    // Fact one and a half: when a control point cites an upstream declaration,
    // the retained registry must actually declare those paths for that
    // component. This is what turns a hand-written scope into a derived one.
    const upstream = point.upstreamDeclaration ?? null;
    if (upstream) {
      const registryPath = join(repoRoot, String(upstream.registry ?? ""));
      check(existsSync(registryPath), `${relativeRepo(recordPath)}: control point ${id} cites a missing registry`);
      const registry = readYaml(registryPath);
      const component = (registry.components ?? []).find((row) => row.name === upstream.component);
      check(
        component,
        `${relativeRepo(recordPath)}: control point ${id} cites component ${upstream.component}, which the retained registry does not declare`,
      );
      const declared = collectPaths(component, String(upstream.pathsKey ?? ""));
      check(
        declared.length > 0,
        `${relativeRepo(recordPath)}: control point ${id} cites ${upstream.pathsKey} on ${upstream.component}, which the registry does not declare`,
      );
      const cited = [...(upstream.paths ?? [])].sort();
      check(
        JSON.stringify(declared.slice().sort()) === JSON.stringify(cited),
        `${relativeRepo(recordPath)}: control point ${id} cites paths the registry does not match (registry: ${declared.join(", ")})`,
      );
    }

    // Fact two: every recorded reviewed change landed on exactly that set.
    const reviewedChanges = (point.reviewedChanges ?? []).map((row) => {
      const receiptPath = join(repoRoot, String(row.receipt ?? ""));
      check(existsSync(receiptPath), `${relativeRepo(recordPath)}: control point ${id} names a missing receipt`);
      const receipt = readYaml(receiptPath);
      const changed = [...readPath(receipt, String(row.changedField ?? ""))].sort();
      check(
        changed.length > 0,
        `${relativeRepo(recordPath)}: control point ${id} reads no changed documents from ${row.receipt}`,
      );
      check(
        JSON.stringify(changed) === JSON.stringify(declared),
        `${relativeRepo(recordPath)}: control point ${id} declares ${declared.length} document(s) but ${row.receipt} changed ${changed.length} (${symmetricDifference(declared, changed).join(", ") || "different documents"})`,
      );
      return { receipt: String(row.receipt), changedCount: changed.length };
    });

    return { id, token, form, locator, upstream: Boolean(upstream), declaredCount: declared.length, declared, reviewedChanges };
  });
  check(controlPoints.length > 0, `${relativeRepo(recordPath)}: the record declares no control points`);

  return {
    record: relativeRepo(recordPath),
    entry: entryPath,
    name: record.metadata?.name ?? "",
    documentCount: documents.length,
    knownGaps: record.spec?.knownGaps ?? [],
    controlPoints,
  };
}

// collectPaths finds a named path list anywhere in a component declaration,
// because the registry nests scheduling paths under system and workload groups.
function collectPaths(value, key) {
  if (Array.isArray(value)) return value.flatMap((row) => collectPaths(row, key));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([name, child]) =>
    name === key && Array.isArray(child) ? child.map(String) : collectPaths(child, key),
  );
}

function readPath(value, path) {
  const result = path
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? current : current[key]), value);
  return Array.isArray(result) ? result : [];
}

function symmetricDifference(left, right) {
  return [
    ...left.filter((row) => !right.includes(row)).map((row) => `declared only: ${row}`),
    ...right.filter((row) => !left.includes(row)).map((row) => `changed only: ${row}`),
  ].sort();
}

function renderSummary(results) {
  const rows = results.flatMap((entry) =>
    entry.controlPoints.map((point) => {
      const derived = point.upstream ? " (upstream-derived)" : "";
      const reviewed = point.reviewedChanges.length
        ? point.reviewedChanges.map((row) => `\`${row.receipt}\``).join(", ")
        : "none yet";
      return `| \`${entry.name}\` | \`${point.id}\`${derived} | \`${point.form}\` | ${point.declaredCount} | ${reviewed} |`;
    }),
  );
  const allPoints = results.flatMap((entry) => entry.controlPoints);
  const covered = allPoints.filter((point) => point.reviewedChanges.length > 0).length;
  const gaps = results.flatMap((entry) =>
    (entry.knownGaps ?? []).map((gap) => ({ entry: entry.name, ...gap })),
  );
  const gapLines = gaps.length
    ? gaps.map((gap) => `- \`${gap.entry}\` declares no control point for \`${gap.control}\`. ${gap.reason}`).join("\n")
    : "- None. Every control point an entry documents is declared.";
  return `# AICR blast-radius parity

**UNOFFICIAL/EXPERIMENTAL.** This page is generated by
\`npm run aicr-blast-radius:generate\` and checked by
\`npm run aicr-blast-radius:verify\`.

A platform change fails differently from a chart change. The value can be
right while the reach is wrong, and a reviewer cannot see that by reading a
diff of one document. Each AICR entry therefore commits a control-point
record naming what may be changed and which documents each control point
governs, and this checker holds that record to the committed bytes and to the
receipts of every reviewed change already made.

| Entry | Control point | Locator | Documents governed | Reviewed changes checked |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

## Coverage

${covered} of ${allPoints.length} declared control points have a reviewed
change with a receipt behind it. A control point with none is not a defect; it
is a change nobody has needed yet, and listing it keeps the gap visible rather
than letting an empty column read as completeness.

## Control points an entry documents but does not declare

${gapLines}

## A control point is located three ways

Which form fits is a property of where the value lives rather than a
preference.

A \`token\` is a substring of the rendered bytes. It is the bluntest form and the
only one that reaches anywhere, which is why it stays.

A \`path\` resolves through the parsed document, so it names exactly which field
it means. A value that happens to appear in an unrelated string cannot be
mistaken for the control point.

A \`valuesPath\` resolves inside the Helm values these Applications carry as an
embedded YAML string. That is where most platform choices actually live, and a
path over the outer document cannot reach them. Parsing that string is what
turns "the storage class" from a substring into a field.

The checker refuses three ways. It refuses when a control point reaches a
document the record does not declare, which is how an under-declared change
gets caught. It refuses when the record declares a document that does not
contain the control point, which is how a record goes stale after the entry
moves. It refuses when a recorded reviewed change touched a different set than
the record declares, which is how a real change that over-reached or
under-reached gets caught against its own receipt.

Everything here runs offline against committed bytes. No cluster, no
organization, and no network is involved.
`;
}

// The self-test builds fake entries so every refusal is exercised without
// touching the committed records.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-blast-radius-self-test-"));
  try {
    const fixtureDoc = (name, extra = "") =>
      [
        "apiVersion: fixture.invalid/v1",
        "kind: FixtureDoc",
        "metadata:",
        `  name: ${name}`,
        "spec:",
        `  value: ${extra || "plain"}`,
        "",
      ].join("\n");

    const build = (name, { docs, controlPoints, receipt }) => {
      const entryRel = join("examples", "fixture", name);
      const entryRoot = join(repoRoot, entryRel);
      // Fixtures live under the repo root so relative paths resolve the way
      // the real records do, and are removed at the end of the run.
      for (const [file, text] of Object.entries(docs)) {
        write(join(entryRoot, "docs", file), text);
      }
      if (receipt) write(join(repoRoot, "runs", `fixture-${name}`, "receipt.yaml"), receipt);
      const recordPath = join(scratch, `${name}.yaml`);
      write(
        recordPath,
        `${JSON.stringify({
          apiVersion: "catalog.confighub.com/v1alpha1",
          kind: "ControlPointRecord",
          metadata: { name: `fixture-${name}` },
          spec: { entry: entryRel, documentScope: ["docs"], controlPoints },
        })}\n`,
      );
      return { recordPath, entryRoot, runRoot: receipt ? join(repoRoot, "runs", `fixture-${name}`) : null };
    };

    const created = [];
    const cleanup = () => {
      for (const row of created) {
        rmSync(row.entryRoot, { recursive: true, force: true });
        if (row.runRoot) rmSync(row.runRoot, { recursive: true, force: true });
      }
      rmSync(join(repoRoot, "examples", "fixture"), { recursive: true, force: true });
    };

    try {
      const goodReceipt = `${JSON.stringify({
        apiVersion: "catalog.confighub.com/v1alpha1",
        kind: "FixtureReceipt",
        metadata: { name: "fixture" },
        spec: { change: { changedDocuments: ["fixture.invalid/v1|FixtureDoc||alpha"] } },
      })}\n`;

      const baseline = build("baseline", {
        docs: {
          "alpha.yaml": fixtureDoc("alpha", "TOKEN-A"),
          "beta.yaml": fixtureDoc("beta"),
        },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
            reviewedChanges: [
              { receipt: "runs/fixture-baseline/receipt.yaml", changedField: "spec.change.changedDocuments" },
            ],
          },
        ],
        receipt: goodReceipt,
      });
      created.push(baseline);
      const result = checkRecord(baseline.recordPath);
      check(
        result.controlPoints.length === 1
          && result.controlPoints[0].declaredCount === 1
          && result.controlPoints[0].reviewedChanges.length === 1,
        "self-test baseline did not check the fixture control point",
      );

      const undeclared = build("undeclared", {
        docs: {
          "alpha.yaml": fixtureDoc("alpha", "TOKEN-A"),
          "beta.yaml": fixtureDoc("beta", "TOKEN-A"),
        },
        controlPoints: [
          { id: "token-a", locator: { token: "TOKEN-A" }, governs: ["fixture.invalid/v1|FixtureDoc||alpha"] },
        ],
      });
      created.push(undeclared);
      check(
        fails(() => checkRecord(undeclared.recordPath), /also reaches .*which the record does not declare/),
        "self-test accepted a control point reaching an undeclared document",
      );

      const phantom = build("phantom", {
        docs: { "alpha.yaml": fixtureDoc("alpha", "TOKEN-A") },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha", "fixture.invalid/v1|FixtureDoc||ghost"],
          },
        ],
      });
      created.push(phantom);
      check(
        fails(() => checkRecord(phantom.recordPath), /declares .*which does not contain its locator/),
        "self-test accepted a record declaring a document without the control point",
      );

      // The path forms resolve fields rather than text, so a value that only
      // appears inside an unrelated string must not count as a reach.
      const pathDoc = (name, storageClass, decoy) =>
        [
          "apiVersion: fixture.invalid/v1",
          "kind: FixtureDoc",
          "metadata:",
          `  name: ${name}`,
          "spec:",
          `  note: ${decoy}`,
          "  source:",
          "    helm:",
          "      values: |",
          "        prometheus:",
          "          prometheusSpec:",
          `            storageClassName: ${storageClass}`,
          "",
        ].join("\n");

      const paths = build("paths", {
        docs: {
          "alpha.yaml": pathDoc("alpha", "gp3", "plain"),
          // beta mentions the same text in prose and must not be reached.
          "beta.yaml": fixtureDoc("beta", "storageClassName:-gp3-in-a-sentence"),
        },
        controlPoints: [
          {
            id: "values-path",
            locator: {
              valuesPath: "prometheus.prometheusSpec.storageClassName",
              equals: "gp3",
            },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
          },
        ],
      });
      created.push(paths);
      const pathResult = checkRecord(paths.recordPath);
      check(
        pathResult.controlPoints[0].form === "valuesPath" && pathResult.controlPoints[0].declaredCount === 1,
        "self-test did not resolve a control point through the embedded values",
      );

      const wrongValue = build("wrong-value", {
        docs: { "alpha.yaml": pathDoc("alpha", "standard", "plain") },
        controlPoints: [
          {
            id: "values-path",
            locator: { valuesPath: "prometheus.prometheusSpec.storageClassName", equals: "gp3" },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
          },
        ],
      });
      created.push(wrongValue);
      check(
        fails(() => checkRecord(wrongValue.recordPath), /which does not contain its locator/),
        "self-test accepted a values path whose value no longer matches",
      );

      const twoForms = build("two-forms", {
        docs: { "alpha.yaml": pathDoc("alpha", "gp3", "plain") },
        controlPoints: [
          {
            id: "ambiguous",
            locator: { token: "gp3", path: "spec.note" },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
          },
        ],
      });
      created.push(twoForms);
      check(
        fails(() => checkRecord(twoForms.recordPath), /must declare exactly one of token, path or valuesPath/),
        "self-test accepted a control point declaring two locator forms",
      );

      const overReach = build("over-reach", {
        docs: { "alpha.yaml": fixtureDoc("alpha", "TOKEN-A") },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
            reviewedChanges: [
              { receipt: "runs/fixture-over-reach/receipt.yaml", changedField: "spec.change.changedDocuments" },
            ],
          },
        ],
        receipt: `${JSON.stringify({
          spec: {
            change: {
              changedDocuments: [
                "fixture.invalid/v1|FixtureDoc||alpha",
                "fixture.invalid/v1|FixtureDoc||beta",
              ],
            },
          },
        })}\n`,
      });
      created.push(overReach);
      check(
        fails(() => checkRecord(overReach.recordPath), /declares 1 document\(s\) but .* changed 2/),
        "self-test accepted a reviewed change that reached further than declared",
      );

      const badUpstream = build("bad-upstream", {
        docs: { "alpha.yaml": fixtureDoc("alpha", "TOKEN-A") },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            upstreamDeclaration: {
              registry: "examples/aicr/upstream-reference/v0.14.0/registry.yaml",
              component: "kube-prometheus-stack",
              pathsKey: "storageClassPaths",
              paths: ["not.the.path.the.registry.declares"],
            },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
          },
        ],
      });
      created.push(badUpstream);
      check(
        fails(() => checkRecord(badUpstream.recordPath), /cites paths the registry does not match/),
        "self-test accepted a control point citing paths upstream does not declare",
      );

      const missingComponent = build("missing-component", {
        docs: { "alpha.yaml": fixtureDoc("alpha", "TOKEN-A") },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            upstreamDeclaration: {
              registry: "examples/aicr/upstream-reference/v0.14.0/registry.yaml",
              component: "not-a-real-component",
              pathsKey: "storageClassPaths",
              paths: ["x"],
            },
            governs: ["fixture.invalid/v1|FixtureDoc||alpha"],
          },
        ],
      });
      created.push(missingComponent);
      check(
        fails(() => checkRecord(missingComponent.recordPath), /which the retained registry does not declare/),
        "self-test accepted a control point citing a component upstream does not have",
      );

      const underReach = build("under-reach", {
        docs: {
          "alpha.yaml": fixtureDoc("alpha", "TOKEN-A"),
          "beta.yaml": fixtureDoc("beta", "TOKEN-A"),
        },
        controlPoints: [
          {
            id: "token-a",
            locator: { token: "TOKEN-A" },
            governs: [
              "fixture.invalid/v1|FixtureDoc||alpha",
              "fixture.invalid/v1|FixtureDoc||beta",
            ],
            reviewedChanges: [
              { receipt: "runs/fixture-under-reach/receipt.yaml", changedField: "spec.change.changedDocuments" },
            ],
          },
        ],
        receipt: goodReceipt,
      });
      created.push(underReach);
      check(
        fails(() => checkRecord(underReach.recordPath), /declares 2 document\(s\) but .* changed 1/),
        "self-test accepted a reviewed change that reached less far than declared",
      );
    } finally {
      cleanup();
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function identity(doc) {
  return [
    doc.apiVersion ?? "",
    doc.kind ?? "",
    doc.metadata?.namespace ?? "",
    doc.metadata?.name ?? "",
  ].join("|");
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
