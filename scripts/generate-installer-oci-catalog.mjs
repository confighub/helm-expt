#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, sha256File, write } from "./lib/proof-common.mjs";
import {
  DEFAULT_INSTALLER_OCI_REGISTRY,
  chartVersionFromPackagePath,
  installerOciDigestRef,
  installerOciRef,
} from "./lib/installer-oci.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "installer-oci-packages");
const packagesRoot = join(repoRoot, "packages");
const top100Path = join(repoRoot, "data", "top100-catalog-analysis", "raw.json");
const matrixPath = join(repoRoot, "data", "master-catalog-matrix", "matrix.csv");

const outputs = {
  summary: join(root, "summary.md"),
  csv: join(root, "packages.csv"),
  json: join(root, "packages.json"),
};

if (mode === "--generate") {
  const report = buildReport();
  rmSync(root, { recursive: true, force: true });
  write(outputs.summary, report.summary);
  write(outputs.csv, report.csv);
  write(outputs.json, `${JSON.stringify({ packages: report.rows }, null, 2)}\n`);
  console.log(`wrote installer OCI catalog -> ${relativeRepo(root)} (${report.rows.length} package(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run installer-oci:catalog`);
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run installer-oci:catalog`);
  check(existsSync(outputs.json), `${relativeRepo(outputs.json)} is missing; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.json, "utf8") === `${JSON.stringify({ packages: report.rows }, null, 2)}\n`, `${relativeRepo(outputs.json)} is stale; run npm run installer-oci:catalog`);
  console.log(`verified installer OCI catalog for ${report.rows.length} package(s)`);
} else if (mode === "--self-test") {
  selfTest();
} else {
  console.log(`Usage:
  node scripts/generate-installer-oci-catalog.mjs --generate
  node scripts/generate-installer-oci-catalog.mjs --verify
  node scripts/generate-installer-oci-catalog.mjs --self-test`);
}

function buildReport() {
  check(existsSync(packagesRoot), "packages/ is missing");
  const top100 = existsSync(top100Path) ? JSON.parse(readFileSync(top100Path, "utf8")).entries ?? [] : [];
  const top100ByKey = new Map(top100.map((entry) => [`${entry.chart}|${entry.version}`, entry]));
  const matrixRows = existsSync(matrixPath) ? parseCsv(readFileSync(matrixPath, "utf8")) : [];
  const matrixByKey = groupBy(matrixRows, (row) => `${row.chart}|${row.version}`);
  const publicationReceipts = publicationReceiptMap();
  const installerYamlPaths = listFiles(packagesRoot)
    .filter((path) => basename(path) === "installer.yaml")
    .map(relativeRepo)
    .sort();
  const rows = installerYamlPaths.map((installerYamlPath) => {
    const packagePath = installerYamlPath.replace(/\/installer\.yaml$/, "");
    const { chart, version } = chartVersionFromPackagePath(packagePath);
    const ref = installerOciRef(chart, version);
    const installer = readYaml(join(repoRoot, installerYamlPath));
    const bases = installer?.spec?.bases ?? [];
    const baseNames = bases.map((base) => base.name).filter(Boolean).join(";");
    const defaultBase = bases.find((base) => base.default)?.name || bases[0]?.name || "default";
    const externalRequires = bases.reduce((count, base) => count + (base.externalRequires?.length ?? 0), 0);
    // Consumers fetch the rendered YAML directly over HTTPS, so publish both
    // its exact path and a digest of the bytes they will receive.
    const renderedYaml = bases
      .map((base) => base.name)
      .filter(Boolean)
      .map((name) => {
        const relPath = `${packagePath}/bases/${name}/upstream.yaml`;
        return existsSync(join(repoRoot, relPath))
          ? { path: relPath, sha256: sha256File(join(repoRoot, relPath)) }
          : { path: "", sha256: "" };
      });
    const collector = installer?.spec?.collector ? "yes" : "no";
    const transformers = installer?.spec?.transformers?.length ?? 0;
    const key = `${chart}|${version}`;
    const catalogEntry = top100ByKey.get(key);
    const rowsForChart = matrixByKey.get(key) ?? [];
    const receipt = publicationReceipts.get(ref);
    const publicationStatus = receipt ? "published-receipt" : "assigned-ref";
    const pullRef = receipt?.digestPinnedRef ?? ref;
    return {
      chart,
      version,
      package_path: packagePath,
      installer_yaml: installerYamlPath,
      installer_oci_ref: ref,
      publication_status: publicationStatus,
      publication_receipt: receipt?.path ?? "",
      published_digest: receipt?.digest ?? "",
      manifest_digest: receipt?.manifestDigest ?? "",
      layer_digest: receipt?.layerDigest ?? "",
      digest_pinned_ref: receipt?.digestPinnedRef ?? "",
      default_base: defaultBase,
      bases: baseNames,
      base_count: String(bases.length),
      rendered_yaml_paths: renderedYaml.map((item) => item.path).join(";"),
      rendered_yaml_sha256s: renderedYaml.map((item) => item.sha256).join(";"),
      external_requires_count: String(externalRequires),
      collector,
      transformers: String(transformers),
      public_catalog: catalogEntry ? "yes" : "no",
      proof_surface: catalogEntry?.proof_surface ?? "",
      chart_page: catalogEntry ? `site/charts/${chartPageFileName(chart, version)}` : "",
      matrix_rows: String(rowsForChart.length),
      setup_command: `cub installer setup --pull ${pullRef} --base ${defaultBase} --work-dir ./${demoStem(chart, version, defaultBase)} --non-interactive${catalogEntry?.namespace ? ` --namespace ${catalogEntry.namespace}` : ""}`,
      inspect_command: `cub installer inspect ${pullRef} --json`,
      verify_command: receipt ? `cub installer inspect ${pullRef} --json` : "",
      list_command: `cub installer list ${ref.replace(/:[^/:]+$/, "")}`,
    };
  });
  const csv = toCsv(rows);
  const summary = summaryMd(rows);
  return { rows, csv, summary };
}

function publicationReceiptMap() {
  const result = new Map();
  const receiptPaths = listFiles(join(repoRoot, "runs"))
    .filter((path) => path.endsWith("installer-package-publication-receipt.yaml"))
    .sort();
  for (const path of receiptPaths) {
    const receipt = readYaml(path);
    const ref = receipt?.spec?.ref || "";
    const packagePath = receipt?.spec?.package?.path || "";
    const packageDigest = receipt?.spec?.package?.sha256 || "";
    const pushOutput = String(receipt?.spec?.outputs?.push ?? "");
    const manifestDigest = receipt?.spec?.outputs?.manifestDigest
      ?? pushOutput.match(/manifest:\s+(sha256:[0-9a-f]{64})/)?.[1]
      ?? "";
    const layerDigest = receipt?.spec?.outputs?.layerDigest
      ?? pushOutput.match(/layer:\s+(sha256:[0-9a-f]{64})/)?.[1]
      ?? "";
    check(/^sha256:[0-9a-f]{64}$/.test(manifestDigest), `${relativeRepo(path)} has no valid manifest digest`);
    check(/^sha256:[0-9a-f]{64}$/.test(layerDigest), `${relativeRepo(path)} has no valid layer digest`);
    check(/^[0-9a-f]{64}$/.test(packageDigest), `${relativeRepo(path)} has no valid package digest`);
    check(layerDigest === `sha256:${packageDigest}`, `${relativeRepo(path)} layer and package digests differ`);
    const item = {
      path: relativeRepo(path),
      ref,
      packagePath,
      digest: packageDigest,
      manifestDigest,
      layerDigest,
      digestPinnedRef: installerOciDigestRef(ref, manifestDigest),
    };
    if (ref) result.set(ref, item);
  }
  return result;
}

function summaryMd(rows) {
  const publicRows = rows.filter((row) => row.public_catalog === "yes");
  const publishedRows = rows.filter((row) => row.publication_status === "published-receipt");
  return `# Installer OCI Packages

Generated by \`scripts/generate-installer-oci-catalog.mjs\`.

This is the package-pull surface for the upstream installer consumer path. A user
should pull the exact digest-pinned package, choose a base, and render locally:

~~~sh
cub installer inspect oci://...:<version>@sha256:<manifest-digest> --json
cub installer setup --pull oci://...:<version>@sha256:<manifest-digest> --base default --work-dir ./out --non-interactive
~~~

The package OCI ref points at the package root. The package contains
\`installer.yaml\`, the available bases, and the files needed to render those
bases. A base still has its own name because the same package can contain
\`default\`, \`no-crds\`, \`existing-secret\`, \`ha\`, or other preset chart
configurations.

Registry prefix:

~~~text
${DEFAULT_INSTALLER_OCI_REGISTRY}
~~~

Public read access is enabled for this Artifact Registry repository. Users can
run \`cub installer inspect\` and \`cub installer setup --pull\` against these
refs without a ConfigHub account, a Google Cloud account, or a local repo clone.
Maintainers still need registry write credentials to publish or replace
packages.

Published rows keep the readable version tag and add the manifest digest to the
same reference. The digest makes the pull immutable. \`cub installer inspect\`
prints the manifest and layer digests and refuses the pull when the registry
does not return the requested manifest.

## Counts

| Count | Value |
| --- | ---: |
| Installer packages | ${rows.length} |
| Public catalog packages | ${publicRows.length} |
| Package refs with publication receipts | ${publishedRows.length} |
| Assigned refs without publication receipts yet | ${rows.length - publishedRows.length} |

## Public Examples

| Chart | Package OCI ref | First command |
| --- | --- | --- |
${publicRows.slice(0, 12).map((row) => `| ${row.chart}@${row.version} | \`${row.digest_pinned_ref || row.installer_oci_ref}\` | \`${row.setup_command}\` |`).join("\n")}

## Files

- [packages.csv](./packages.csv)
- [packages.json](./packages.json)

## Publication Status

\`assigned-ref\` means the repo knows the public ref that should be pushed, but
does not have a committed publication receipt for that package yet.
\`published-receipt\` means a receipt records a package push and inspect for
that ref. The current repository grants anonymous read access to published
public catalog refs.
`;
}

function chartPageFileName(chart, version) {
  return `${chart}-${version}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .concat(".html");
}

function demoStem(chart, version, base) {
  return `${chart}-${version}-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function groupBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "package_path",
    "installer_yaml",
    "installer_oci_ref",
    "publication_status",
    "publication_receipt",
    "published_digest",
    "manifest_digest",
    "layer_digest",
    "digest_pinned_ref",
    "default_base",
    "bases",
    "base_count",
    "rendered_yaml_paths",
    "rendered_yaml_sha256s",
    "external_requires_count",
    "collector",
    "transformers",
    "public_catalog",
    "proof_surface",
    "chart_page",
    "matrix_rows",
    "setup_command",
    "inspect_command",
    "verify_command",
    "list_command",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function selfTest() {
  const digest = `sha256:${"a".repeat(64)}`;
  const ref = "oci://registry.example.test/catalog/example:1.2.3";
  check(
    installerOciDigestRef(ref, digest) === `${ref}@${digest}`,
    "digest-pinned ref did not preserve the readable version tag",
  );
  let badDigestRejected = false;
  try {
    installerOciDigestRef(ref, "sha256:bad");
  } catch (error) {
    badDigestRejected = /digest is invalid/.test(String(error.message));
  }
  check(badDigestRejected, "digest-pinned ref accepted an invalid manifest digest");
  const report = buildReport();
  for (const row of report.rows.filter((candidate) => candidate.publication_status === "published-receipt")) {
    check(row.digest_pinned_ref === `${row.installer_oci_ref}@${row.manifest_digest}`, `${row.chart}@${row.version}: exact ref drifted`);
    check(row.setup_command.includes(`--pull ${row.digest_pinned_ref} `), `${row.chart}@${row.version}: setup command uses a mutable ref`);
    check(row.inspect_command === row.verify_command, `${row.chart}@${row.version}: inspect and verify commands differ`);
  }
  console.log(`installer OCI catalog self-test passed for ${report.rows.length} package(s)`);
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length || !lines[0]) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}
