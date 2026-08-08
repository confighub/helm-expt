#!/usr/bin/env node
// Records a flattening-safety witness for one packaged chart: a static scan of
// the chart source (templates, crds, Chart.yaml, subcharts) for the quirk
// classes that render-time flattening can lose. This tool needs the extracted
// chart on disk, so it runs once per chart version and its output is committed
// as data/flattening-safety/witnesses/<repo>-<chart>-<version>.yaml; the
// verdict generator then reads witnesses only and stays offline and
// deterministic. Usage:
//   node scripts/scan-flattening-witness.mjs <extracted-chart-dir> <repo> <chart> <version> <tarball-sha256> <observed-at>

import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { listFiles, repoRoot, toYaml, write } from "./lib/proof-common.mjs";

// The optional suffix and note exist for one case: upstream republished a
// version string under different bytes. Those bytes deserve a witness of their
// own, filed beside the locked one rather than overwriting it, and the note
// says which is which so neither can be mistaken for the other.
const [chartDir, repo, chart, version, tarballSha, observedAt, nameSuffix, packageNote] =
  process.argv.slice(2);
if (!chartDir || !repo || !chart || !version || !tarballSha || !observedAt) {
  console.error(
    "usage: node scripts/scan-flattening-witness.mjs <extracted-chart-dir> <repo> <chart> <version> <tarball-sha256> <observed-at> [name-suffix] [package-note]",
  );
  process.exit(1);
}

const FILE_CAP = 12;

const PATTERNS = {
  lookup: /\blookup\s+"/,
  capabilities: /\.Capabilities\./,
  "helm-hooks": /helm\.sh\/hook["']?\s*:/,
  "resource-policy-keep": /helm\.sh\/resource-policy/,
  "generated-secrets":
    /randAlphaNum|randAscii|randNumeric|genPrivateKey|genCA\b|genSelfSignedCert|genSignedCert|derivePassword|uuidv4|common\.secrets\.passwords\.manage/,
  "webhook-config": /kind:\s*(Mutating|Validating)WebhookConfiguration/,
  "namespace-creation": /kind:\s*Namespace\s*$/m,
};

const files = listFiles(chartDir)
  .filter((path) => /\.(yaml|yml|tpl|txt)$/.test(path))
  .sort();

const findings = {};
for (const key of Object.keys(PATTERNS)) findings[key] = { count: 0, files: [] };
findings["test-hooks"] = { count: 0, files: [] };
const hookValues = new Set();
let crdFiles = 0;
let crdDocs = 0;
let subchartCount = 0;
const subchartConditions = [];

for (const path of files) {
  const rel = relative(chartDir, path);
  const text = readFileSync(path, "utf8");
  const inSubchart = rel.split("/").includes("charts");
  for (const [key, pattern] of Object.entries(PATTERNS)) {
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      if (!pattern.test(lines[i])) continue;
      findings[key].count += 1;
      if (findings[key].files.length < FILE_CAP) findings[key].files.push(`${rel}:${i + 1}`);
      if (key === "helm-hooks") {
        const value = lines[i].replace(/.*helm\.sh\/hook["']?\s*:\s*/, "").trim();
        if (value) hookValues.add(value.replace(/["',]+$/g, "").replace(/^["']/, ""));
        if (/test/.test(value)) {
          findings["test-hooks"].count += 1;
          if (findings["test-hooks"].files.length < FILE_CAP)
            findings["test-hooks"].files.push(`${rel}:${i + 1}`);
        }
      }
    }
  }
  if (/(^|\/)crds\//.test(rel)) {
    crdFiles += 1;
    crdDocs += (text.match(/^kind:\s*CustomResourceDefinition/gm) ?? []).length || 1;
  } else {
    crdDocs += (text.match(/^kind:\s*CustomResourceDefinition/gm) ?? []).length;
  }
  if (rel.endsWith("Chart.yaml")) {
    if (inSubchart) subchartCount += 1;
    else {
      const depsBlock = text.match(/^dependencies:\n((?:(?:- .*|[ \t].*)\n|\n)*)/m);
      if (depsBlock) {
        for (const dep of depsBlock[1].split(/\n(?=-\s)/)) {
          const name = dep.match(/(?:^|\n)\s*(?:-\s+)?name:\s*([^\n]+)/);
          const condition = dep.match(/(?:^|\n)\s*(?:-\s+)?condition:\s*([^\n]+)/);
          if (name && condition) {
            subchartConditions.push({
              dependency: name[1].trim(),
              condition: condition[1].trim(),
            });
          }
        }
      }
    }
  }
}

const witness = {
  apiVersion: "evidence.confighub.com/v1alpha1",
  kind: "FlatteningWitness",
  metadata: { name: `${repo}-${chart}-${version}${nameSuffix ? `-${nameSuffix}` : ""}` },
  spec: {
    chart: { repository: repo, name: chart, version },
    package: {
      sha256: tarballSha,
      observedAt,
      scanner: "scripts/scan-flattening-witness.mjs",
      ...(packageNote ? { note: packageNote } : {}),
    },
    scannedFiles: files.length,
    subcharts: { count: subchartCount, conditions: subchartConditions },
    crds: { files: crdFiles, documents: crdDocs },
    hookValues: [...hookValues].sort(),
    findings: Object.fromEntries(
      Object.entries(findings).map(([key, value]) => [
        key,
        { count: value.count, files: value.files },
      ]),
    ),
  },
};

const out = join(
  repoRoot,
  "data",
  "flattening-safety",
  "witnesses",
  `${repo}-${chart}-${version}${nameSuffix ? `-${nameSuffix}` : ""}.yaml`,
);
write(out, `${toYaml(witness)}\n`);
console.log(`wrote ${relative(repoRoot, out)} (${files.length} files scanned)`);
