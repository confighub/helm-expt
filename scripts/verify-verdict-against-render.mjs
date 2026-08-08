#!/usr/bin/env node
// A flattening verdict is drafted from a witness, which scans the packaged
// chart. Some hazards only become visible in the render, and one of them is not
// hypothetical: a Secret whose data is written statically from values is
// invisible to the witness, because the witness looks for generated credentials
// and a literal is not generated. The minio tenant chart renders
// MINIO_ROOT_PASSWORD that way, and its witness reports no generated secrets at
// all.
//
// So this gate asks a narrow question with a checkable answer: does any verdict
// say a class is absent while the committed render for that same base plainly
// contains it? Five classes can be settled from a render, and those are the
// five checked here. Everything the render cannot settle, such as a lookup or a
// capability branch, is left to the witness and is not second-guessed.
//
//   node scripts/verify-verdict-against-render.mjs --verify
//
// Deterministic over committed files. No network, no cluster, no wall clock.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readYaml, repoRoot } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";

// Only classes a rendered object set can settle. A render proves presence; it
// never proves absence for a template-time construct, so nothing here reads the
// other direction.
function scanRender(text) {
  const docs = text.split(/^---$/m);
  let secretsWithData = 0;
  for (const doc of docs) {
    if (!/^kind:\s*"?Secret"?\s*$/m.test(doc)) continue;
    if (/^(data|stringData):\s*\S/m.test(doc) || /^(data|stringData):\s*\n\s+\S/m.test(doc))
      secretsWithData += 1;
  }
  return {
    "helm-hooks": (text.match(/helm\.sh\/hook\s*:/g) ?? []).length,
    "resource-policy-keep": (text.match(/helm\.sh\/resource-policy/g) ?? []).length,
    "crd-ordering": (text.match(/^kind:\s*"?CustomResourceDefinition"?\s*$/gm) ?? []).length,
    "webhook-ca": (text.match(/^kind:\s*"?(?:Mutating|Validating)WebhookConfiguration"?\s*$/gm) ?? [])
      .length,
    "generated-secrets": secretsWithData,
  };
}

const WHAT_THE_RENDER_SHOWS = {
  "helm-hooks": "object(s) carrying a helm.sh/hook annotation",
  "resource-policy-keep": "object(s) carrying a helm.sh/resource-policy annotation",
  "crd-ordering": "CustomResourceDefinition(s)",
  "webhook-ca": "webhook configuration(s)",
  "generated-secrets": "Secret(s) carrying data",
};

function verdictPaths() {
  const index = join(repoRoot, "data", "flattening-safety", "verdicts.csv");
  // Read by header name. The column order has changed once already, and an
  // index that quietly points at the wrong cell is how a gate stops checking.
  const lines = readFileSync(index, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const at = (name) => {
    const position = header.indexOf(name);
    if (position < 0) throw new Error(`verdicts.csv has no ${name} column`);
    return position;
  };
  const columns = {
    repo: at("repo"),
    chart: at("chart"),
    version: at("version"),
    base: at("base"),
    path: at("verdict"),
  };
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return {
      repo: cells[columns.repo],
      chart: cells[columns.chart],
      version: cells[columns.version],
      base: cells[columns.base],
      path: cells[columns.path],
    };
  });
}

function run() {
  const findings = [];
  let compared = 0;
  let skipped = 0;

  for (const entry of verdictPaths()) {
    const renderRel = `recipes/${entry.repo}/${entry.chart}/${entry.version}/revisions/${entry.base}/r001/rendered/release-objects.yaml`;
    const renderPath = join(repoRoot, renderRel);
    // A base with no committed render is not a failure. Plenty of audited bases
    // are template-level only, and this gate has nothing to say about them.
    if (!existsSync(renderPath)) {
      skipped += 1;
      continue;
    }
    const verdict = readYaml(join(repoRoot, entry.path));
    const rendered = scanRender(readFileSync(renderPath, "utf8"));
    compared += 1;

    for (const [cls, count] of Object.entries(rendered)) {
      if (count === 0) continue;
      const row = verdict.spec.dispositions.find((item) => item.class === cls);
      if (!row) {
        findings.push(`${entry.path}: no disposition row for ${cls}`);
        continue;
      }
      // present-gated is a legitimate answer here: the audited base may render
      // the construct while the verdict records which values reach it.
      if (row.finding === "absent") {
        findings.push(
          `${entry.path}: ${cls} is recorded absent, and ${renderRel} contains ${count} ${WHAT_THE_RENDER_SHOWS[cls]}`,
        );
      }
    }
  }

  console.log(
    `verdict-against-render: ${compared} base(s) compared, ${skipped} with no committed render`,
  );
  if (findings.length > 0) {
    for (const finding of findings) console.log(`  ${finding}`);
    console.error(
      `\nverdict-against-render: ${findings.length} verdict(s) call a class absent that their own render contains. A witness scans the chart; some constructs only appear once it is rendered.`,
    );
    process.exit(1);
  }
  console.log("OK: no verdict calls a class absent that its own render contains.");
}

if (mode === "--verify") {
  run();
} else {
  console.log("usage: node scripts/verify-verdict-against-render.mjs --verify");
  process.exit(1);
}
