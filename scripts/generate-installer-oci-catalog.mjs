#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, sha256, sha256File, write } from "./lib/proof-common.mjs";
import {
  GHCR_PACKAGES_IDENTITY_REGEXP,
  GHCR_PACKAGES_OIDC_ISSUER,
  GHCR_PACKAGES_RECEIPT_ROOT,
  GHCR_PACKAGES_REGISTRY,
  GHCR_PACKAGES_WORKFLOW,
  ghcrPackageIdentity,
  ghcrPackagePublication,
} from "./lib/ghcr-packages.mjs";
import { pendingPublicationRecipes } from "./lib/installer-oci-publication.mjs";
import {
  DEFAULT_INSTALLER_OCI_REGISTRY,
  chartVersionFromPackagePath,
  installerOciDigestRef,
  installerOciRef,
} from "./lib/installer-oci.mjs";
import {
  installerPackagePublicationRecords,
  installerPackageSignatureReceiptMap,
  indexSignatureVerificationCommand,
  installerOciIndexSignaturePaths,
  signatureVerificationCommand,
} from "./lib/installer-package-signatures.mjs";

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
  write(outputs.json, catalogJson(report.index));
  console.log(`wrote installer OCI catalog -> ${relativeRepo(root)} (${report.rows.length} package(s))`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run installer-oci:catalog`);
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run installer-oci:catalog`);
  check(existsSync(outputs.json), `${relativeRepo(outputs.json)} is missing; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run installer-oci:catalog`);
  check(readFileSync(outputs.json, "utf8") === catalogJson(report.index), `${relativeRepo(outputs.json)} is stale; run npm run installer-oci:catalog`);
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
  const signatureReceipts = installerPackageSignatureReceiptMap();
  if (signatureReceipts.size > 0) verifyPackageSignatureEvidence();
  // A version declared pending publication is not in the signed index until
  // it is published, so adding one does not invalidate the index signature.
  const pending = pendingPublicationRecipes();
  const installerYamlPaths = listFiles(packagesRoot)
    .filter((path) => basename(path) === "installer.yaml")
    .map(relativeRepo)
    .filter((path) => !pending.has(path.replace(/^packages\//, "recipes/").replace(/\/installer\.yaml$/, "")))
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
    const signed = signatureReceipts.get(ref);
    const publicationStatus = receipt ? "published-receipt" : "assigned-ref";
    const pullRef = receipt?.digestPinnedRef ?? ref;
    const earlier = {
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
      published_at: receipt?.publishedAt ?? "",
      signature_status: signed ? "signed-receipt" : "unsigned",
      signature_receipt: signed?.path ?? "",
      signature_bundle: signed?.receipt?.spec?.signature?.bundlePath ?? "",
      signature_observed_at: signed?.receipt?.spec?.observedAt ?? "",
      signature_verification_command: receipt && signed ? signatureVerificationCommand(receipt) : "",
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
    return { earlier, row: catalogRow(earlier, ghcrPackagePublication(chart, version), ghcrPackageIdentity(chart, version), catalogEntry) };
  });
  // The signed index lists the packages in the earlier registry, with the
  // columns it was signed with, so its bytes and its signature stay valid
  // while GHCR becomes the published location (see summaryMd).
  const indexRows = rows.map((item) => item.earlier).filter((row) => row.publication_status === "published-receipt");
  const index = { rows: indexRows, generatedAt: latestRecordedTime(indexRows) };
  const catalogRows = rows.map((item) => item.row);
  const indexSignature = indexSignatureStatus(catalogJson(index));
  return { rows: catalogRows, csv: toCsv(catalogRows), index, summary: summaryMd(catalogRows, index.rows, indexSignature), indexSignature };
}

// A catalog row names the GHCR package when a receipt records it there: the
// name and tag `cub package install` takes, the digest-pinned reference for
// anyone who wants exact bytes, and the command that checks its signature.
// The installer_oci_*, publication_*, signature_* and digest columns describe
// the earlier Google registry copy, which stays where it is; a version that
// was never published there has them empty.
function catalogRow(earlier, ghcr, identity, catalogEntry) {
  const inEarlier = earlier.publication_status === "published-receipt";
  const earlierOnly = new Set([
    "installer_oci_ref",
    "publication_receipt",
    "published_digest",
    "manifest_digest",
    "layer_digest",
    "digest_pinned_ref",
    "published_at",
    "signature_receipt",
    "signature_bundle",
    "signature_observed_at",
    "signature_verification_command",
  ]);
  const earlierColumns = ghcr && !inEarlier
    ? Object.fromEntries(Object.entries(earlier).map(([key, value]) => [key, earlierOnly.has(key) ? "" : value]))
    : earlier;
  const row = {
    ...earlierColumns,
    publication_status: ghcr && !inEarlier ? "not-in-earlier-registry" : earlier.publication_status,
    signature_status: ghcr && !inEarlier ? "unsigned" : earlier.signature_status,
    package_name: identity?.name ?? "",
    package_tag: identity?.tag ?? "",
    install_command: ghcr?.installCommand ?? "",
    ghcr_status: ghcr ? "published-signed" : "not-published",
    ghcr_ref: identity ? `oci://${identity.reference}` : "",
    ghcr_digest_pinned_ref: ghcr?.exactRef ?? "",
    ghcr_manifest_digest: ghcr?.manifestDigest ?? "",
    ghcr_layer_digest: ghcr?.layerDigest ?? "",
    ghcr_receipt: ghcr?.receiptPath ?? "",
    ghcr_observed_at: ghcr?.observedAt ?? "",
    ghcr_verify_command: ghcr?.verifyCommand ?? "",
  };
  if (!ghcr) return row;
  const pullRef = ghcr.exactRef;
  return {
    ...row,
    setup_command: `cub installer setup --pull ${pullRef} --base ${earlier.default_base} --work-dir ./${demoStem(earlier.chart, earlier.version, earlier.default_base)} --non-interactive${catalogEntry?.namespace ? ` --namespace ${catalogEntry.namespace}` : ""}`,
    inspect_command: `cub installer inspect ${pullRef} --json`,
    verify_command: `cub installer inspect ${pullRef} --json`,
    list_command: `cub installer list ${ghcr.tagRef.replace(/:[^/:]+$/, "")}`,
  };
}


function verifyPackageSignatureEvidence() {
  execFileSync(process.execPath, ["scripts/generate-installer-package-signatures.mjs", "--verify"], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
    maxBuffer: 1024 * 1024 * 64,
  });
}

function publicationReceiptMap() {
  const result = new Map();
  for (const receipt of installerPackagePublicationRecords()) {
    const item = {
      path: receipt.publicationReceipt,
      ref: receipt.tagReference,
      packagePath: receipt.packagePath,
      packageSHA256: receipt.packageSHA256,
      digest: receipt.packageSHA256,
      manifestDigest: receipt.manifestDigest,
      layerDigest: receipt.layerDigest,
      digestPinnedRef: receipt.digestPinnedReference,
      immutableReference: receipt.immutableReference,
      publishedAt: receipt.publishedAt,
    };
    result.set(receipt.tagReference, item);
  }
  return result;
}

function summaryMd(rows, indexRows, indexSignature) {
  const publicRows = rows.filter((row) => row.public_catalog === "yes");
  const ghcrRows = rows.filter((row) => row.ghcr_status === "published-signed");
  const earlierRows = rows.filter((row) => row.publication_status === "published-receipt");
  const signedRows = rows.filter((row) => row.signature_status === "signed-receipt");
  return `# Installer OCI Packages

Generated by \`scripts/generate-installer-oci-catalog.mjs\`.

Every catalog package version is published to GitHub's registry as
\`oci://${GHCR_PACKAGES_REGISTRY}/<name>:<tag>\` by the
[package publish workflow](../../${GHCR_PACKAGES_WORKFLOW}), and signed
keylessly as that workflow. That is where \`cub package install\` looks a
package up by name, so installing one into a Space takes its name and tag:

~~~sh
cub package install <name>:<tag> --space <space>
~~~

For exact bytes, pin the manifest digest, or pull the package and render it
locally without a Space:

~~~sh
cub installer inspect oci://${GHCR_PACKAGES_REGISTRY}/<name>:<tag>@sha256:<manifest-digest> --json
cub installer setup --pull oci://${GHCR_PACKAGES_REGISTRY}/<name>:<tag>@sha256:<manifest-digest> --base default --work-dir ./out --non-interactive
~~~

Check who published it:

~~~sh
cosign verify \\
  --certificate-identity-regexp '${GHCR_PACKAGES_IDENTITY_REGEXP}' \\
  --certificate-oidc-issuer ${GHCR_PACKAGES_OIDC_ISSUER} \\
  ${GHCR_PACKAGES_REGISTRY}/<name>@sha256:<manifest-digest>
~~~

A package contains \`installer.yaml\`, its bases, and the files needed to
render them. A base has its own name because one package can hold
\`default\`, \`no-crds\`, \`existing-secret\`, \`ha\`, or other
preset chart configurations.

A version is listed as published on GitHub once a receipt under
\`${GHCR_PACKAGES_RECEIPT_ROOT}/<name>/<tag>.yaml\` records an anonymous
pull of the tag at its digest and a signature verified against the workflow
identity. The nightly package job writes those receipts with
\`node scripts/publish-ghcr-packages.mjs --observe --missing\`, which needs no
credential.

## Earlier location

Packages were first published to a Google Artifact Registry repository,
\`${DEFAULT_INSTALLER_OCI_REGISTRY}\`, signed by a Google service account.
Those copies stay where they are, readable without credentials, with their
receipts. In [packages.csv](./packages.csv) the \`installer_oci_ref\`,
\`digest_pinned_ref\`, \`manifest_digest\`, \`publication_*\` and
\`signature_*\` columns describe that earlier copy; the \`ghcr_*\` columns,
\`package_name\`, \`package_tag\` and \`install_command\` describe the
GitHub one, and the setup and inspect commands use it. The two are different
bytes: the GitHub build writes the published name and tag into its
\`installer.yaml\`.

## Counts

| Count | Value |
| --- | ---: |
| Installer packages | ${rows.length} |
| Public catalog packages | ${publicRows.length} |
| Published and signed on GitHub's registry | ${ghcrRows.length} |
| Not yet published on GitHub's registry | ${rows.length - ghcrRows.length} |
| Also in the earlier Google registry | ${earlierRows.length} |
| Earlier copies with signature receipts | ${signedRows.length} |

## Public Examples

| Chart | Install | Exact package |
| --- | --- | --- |
${publicRows.slice(0, 12).map((row) => `| ${row.chart}@${row.version} | \`${row.install_command || "not published on GitHub yet"}\` | \`${row.ghcr_digest_pinned_ref || row.digest_pinned_ref || row.installer_oci_ref}\` |`).join("\n")}

## Files

- [packages.csv](./packages.csv): one row per package version, both locations
- [packages.json](./packages.json): the signed index of the earlier location

## Signed Index

Status: **${indexSignature.status}**

\`packages.json\` lists the ${indexRows.length} packages in the earlier
registry, with the columns it was signed with, and is signed as a blob by the
same Google service account:

~~~sh
${indexSignature.command}
~~~

${indexSignature.status === "signed-receipt"
    ? `Evidence: [signature receipt](../../${indexSignature.receipt}) · [Sigstore bundle](../../${indexSignature.bundle})`
    : "The index must be regenerated and signed after the package evidence changes."}

A version published only on GitHub is not in it; its own signature, made by
the publish workflow, is checked with the \`cosign verify\` command above.
`;
}

function indexSignatureStatus(catalogText) {
  const paths = installerOciIndexSignaturePaths();
  const base = {
    command: indexSignatureVerificationCommand(),
    receipt: relativeRepo(paths.receiptPath),
    bundle: relativeRepo(paths.bundlePath),
  };
  if (!existsSync(paths.receiptPath) || !existsSync(paths.bundlePath)) return { ...base, status: "unsigned" };
  const receipt = readYaml(paths.receiptPath);
  if (receipt?.spec?.subject?.catalogSHA256 !== sha256(catalogText)) return { ...base, status: "stale-signature" };
  return { ...base, status: "signed-receipt" };
}

function latestRecordedTime(rows) {
  const times = rows
    .flatMap((row) => [row.signature_observed_at, row.published_at])
    .filter(Boolean)
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  check(times.length > 0, "installer OCI catalog has no recorded publication time");
  return new Date(Math.max(...times)).toISOString();
}

function catalogJson(report) {
  return `${JSON.stringify({
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "InstallerPackageCatalogIndex",
    metadata: {
      generatedAt: report.generatedAt,
      packageCount: report.rows.length,
      signingIdentity: "helm-expt-package-signer@nth-fort-499605-q5.iam.gserviceaccount.com",
    },
    packages: report.rows,
  }, null, 2)}\n`;
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
    "package_name",
    "package_tag",
    "install_command",
    "ghcr_status",
    "ghcr_ref",
    "ghcr_digest_pinned_ref",
    "ghcr_manifest_digest",
    "ghcr_layer_digest",
    "ghcr_receipt",
    "ghcr_observed_at",
    "ghcr_verify_command",
    "installer_oci_ref",
    "publication_status",
    "publication_receipt",
    "published_digest",
    "manifest_digest",
    "layer_digest",
    "digest_pinned_ref",
    "published_at",
    "signature_status",
    "signature_receipt",
    "signature_bundle",
    "signature_observed_at",
    "signature_verification_command",
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
  }
  for (const row of report.rows) {
    const exact = row.ghcr_status === "published-signed" ? row.ghcr_digest_pinned_ref : row.digest_pinned_ref;
    if (row.ghcr_status === "published-signed") {
      check(row.ghcr_digest_pinned_ref === `${row.ghcr_ref}@${row.ghcr_manifest_digest}`, `${row.chart}@${row.version}: exact GHCR ref drifted`);
      check(row.install_command === `cub package install ${row.package_name}:${row.package_tag} --space <space>`, `${row.chart}@${row.version}: install command does not name the GHCR package`);
    }
    if (!exact) continue;
    check(row.setup_command.includes(`--pull ${exact} `), `${row.chart}@${row.version}: setup command uses a mutable ref`);
    check(row.inspect_command === row.verify_command, `${row.chart}@${row.version}: inspect and verify commands differ`);
  }
  for (const row of report.index.rows) {
    check(row.setup_command.includes(`--pull ${row.digest_pinned_ref} `), `${row.chart}@${row.version}: the signed index's setup command uses a mutable ref`);
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
