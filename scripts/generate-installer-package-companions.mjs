#!/usr/bin/env node

// Put the records that explain each packaged base beside the runnable files.
// The embedded copies omit the package's own immutable digest because an
// artifact cannot contain its final digest without creating a circular hash.

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  check,
  listFiles,
  readYaml,
  repoRoot,
  serializeYaml,
  sha256File,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify", "--self-test"].includes(mode), usage());

if (mode === "--self-test") {
  runSelfTest();
  process.exit(0);
}

const outputRoot = process.env.HELM_EXPT_PACKAGE_COMPANION_OUTPUT_ROOT
  ? resolve(process.env.HELM_EXPT_PACKAGE_COMPANION_OUTPUT_ROOT)
  : repoRoot;
const packageRoots = packageRootsFromDisk(outputRoot);
const groups = loadGroups(packageRoots);

let baseCount = 0;
for (const group of groups) {
  const outputs = outputsForGroup(group);
  baseCount += group.entries.length;
  if (mode === "--generate") writeOutputs(group, outputs);
  else verifyOutputs(group, outputs);
}

console.log(`${mode === "--generate" ? "wrote" : "verified"} companion records for ${baseCount} base(s) in ${groups.length} installer package(s)`);

function loadGroups(packageRoots) {
  const intents = JSON.parse(readFileSync(join(repoRoot, "data/helm-render-intents/intents.json"), "utf8")).intents;
  const records = JSON.parse(readFileSync(join(repoRoot, "data/base-variant-records/records.json"), "utf8")).records;
  const recordsByName = new Map(records.map((record) => [record.metadata.name, record]));
  const groupsByPath = new Map();

  for (const intent of intents) {
    const packageBase = String(intent?.spec?.renderInputs?.packageBase ?? "");
    check(packageBase.startsWith("packages/"), `${intent.metadata.name}: package base is not repository-relative`);
    const packagePath = dirname(dirname(packageBase));
    const packageRoot = join(outputRoot, packagePath);
    check(packageRoots.includes(packageRoot), `${intent.metadata.name}: package root is missing: ${packagePath}`);
    const sourceRecord = recordsByName.get(intent.metadata.name);
    check(sourceRecord, `${intent.metadata.name}: source-and-intent record is missing`);
    const group = groupsByPath.get(packagePath) ?? {
      packagePath,
      packageRoot,
      installer: readYaml(join(packageRoot, "installer.yaml")),
      entries: [],
    };
    group.entries.push({
      base: intent.spec.baseVariant,
      intent,
      sourceRecord,
    });
    groupsByPath.set(packagePath, group);
  }

  for (const packageRoot of packageRoots) {
    const packagePath = relative(outputRoot, packageRoot).replaceAll("\\", "/");
    check(groupsByPath.has(packagePath), `${packagePath}: package has no companion source records`);
  }

  const groups = [...groupsByPath.values()].sort((left, right) => left.packagePath.localeCompare(right.packagePath));
  for (const group of groups) {
    group.entries.sort((left, right) => left.base.localeCompare(right.base));
    const declaredBases = (group.installer?.spec?.bases ?? []).map((base) => String(base.name)).sort();
    const recordedBases = group.entries.map((entry) => entry.base).sort();
    check(JSON.stringify(declaredBases) === JSON.stringify(recordedBases), `${group.packagePath}: installer bases and companion records differ`);
  }
  return groups;
}

function outputsForGroup(group) {
  const outputs = new Map();
  const packageName = String(group.installer?.metadata?.name ?? "");
  const packageVersion = String(group.installer?.metadata?.version ?? "");
  check(packageName && packageVersion, `${group.packagePath}: installer package identity is incomplete`);

  const index = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "InstallerPackageRecordIndex",
    metadata: { name: `${packageName}-${packageVersion}` },
    spec: {
      package: {
        name: packageName,
        version: packageVersion,
        role: "multi-preset-source-package",
      },
      recordsAreDeployable: false,
      repository: {
        url: "https://github.com/confighub/helm-expt",
        evidenceBaseUrl: "https://github.com/confighub/helm-expt/blob/main/",
      },
      bases: group.entries.map((entry) => ({
        name: entry.base,
        objects: `bases/${entry.base}/upstream.yaml`,
        sourceAndIntent: `records/${entry.base}/source-and-intent.yaml`,
        sourceSpecificIntent: `records/${entry.base}/helm-render-intent.yaml`,
      })),
    },
  };
  outputs.set("records/index.yaml", serializeYaml(index));
  outputs.set("records/README.md", recordsReadme(group));

  for (const entry of group.entries) {
    outputs.set(
      `records/${entry.base}/source-and-intent.yaml`,
      serializeYaml(sanitizeSourceRecord(entry.sourceRecord)),
    );
    outputs.set(
      `records/${entry.base}/helm-render-intent.yaml`,
      serializeYaml(sanitizeRenderIntent(entry.intent)),
    );
  }
  return outputs;
}

function sanitizeSourceRecord(record) {
  const copy = structuredClone(record);
  delete copy.spec.source.packageOciRef;
  return copy;
}

function sanitizeRenderIntent(intent) {
  const copy = structuredClone(intent);
  delete copy.spec.renderInputs.installerPackageOciRef;
  copy.spec.provenance.fullModelPath = copy.spec.provenance.fullModelPath.filter(
    (item) => !String(item).startsWith("installer package OCI:"),
  );
  return copy;
}

function recordsReadme(group) {
  const rows = group.entries.map((entry) =>
    `| \`${entry.base}\` | [source and intent](./${entry.base}/source-and-intent.yaml) | [Helm render intent](./${entry.base}/helm-render-intent.yaml) | [Kubernetes objects](../bases/${entry.base}/upstream.yaml) |`
  ).join("\n");
  return `# Configuration records

These files explain how each ready-made configuration in this package was
produced. They are supporting records, not Kubernetes objects. Do not apply
them to a cluster.

The source-and-intent file uses the Catalog's cross-format record. The Helm
render-intent file adds the chart version, values, release context, target
requirements, and lifecycle review. Paths inside those records are relative to
the [helm-expt repository](https://github.com/confighub/helm-expt).

The package does not write its own final digest into these files. The immutable
digest and signature belong to the publication receipt outside the artifact;
including that digest inside the artifact would change the digest again.

| Configuration | Source and intent | Helm details | Objects |
| --- | --- | --- | --- |
${rows}
`;
}

function writeOutputs(group, outputs) {
  const recordsRoot = join(group.packageRoot, "records");
  rmSync(recordsRoot, { recursive: true, force: true });
  for (const [path, contents] of outputs) write(join(group.packageRoot, path), contents);
}

function verifyOutputs(group, outputs, verifyReceipt = true) {
  for (const [path, expected] of outputs) {
    const absolute = join(group.packageRoot, path);
    check(existsSync(absolute), `${group.packagePath}/${path}: companion file is missing`);
    check(readFileSync(absolute, "utf8") === expected, `${group.packagePath}/${path}: companion file is stale`);
  }
  const actual = listFiles(join(group.packageRoot, "records"))
    .map((path) => relative(group.packageRoot, path).replaceAll("\\", "/"))
    .sort();
  const expected = [...outputs.keys()].sort();
  check(JSON.stringify(actual) === JSON.stringify(expected), `${group.packagePath}: companion file set is stale`);
  if (verifyReceipt) verifyReceiptInventory(group);
}

function verifyReceiptInventory(group) {
  const recipePath = group.packagePath.replace(/^packages\//, "recipes/");
  const receiptPath = join(repoRoot, recipePath, "publication", "installer-package-receipt.yaml");
  check(existsSync(receiptPath), `${recipePath}: installer package receipt is missing`);
  const receipt = readYaml(receiptPath);
  const recorded = normalizeSourceFiles(receipt?.spec?.package?.sourceFiles ?? []);
  const actual = normalizeSourceFiles(listFiles(group.packageRoot).map((path) => ({
    path: relative(group.packageRoot, path).replaceAll("\\", "/"),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  })));
  check(
    JSON.stringify(recorded) === JSON.stringify(actual),
    `${group.packagePath}: installer package receipt does not describe the complete package tree; run npm run installer-package-companions:sync-receipts`,
  );
}

function normalizeSourceFiles(files) {
  return files
    .map((file) => ({
      path: String(file.path ?? "").replaceAll("\\", "/"),
      sha256: String(file.sha256 ?? ""),
      bytes: Number(file.bytes ?? -1),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

function packageRootsFromDisk(root) {
  const packagesRoot = join(root, "packages");
  return listFiles(packagesRoot)
    .filter((path) => path.endsWith("/installer.yaml"))
    .map((path) => dirname(path))
    .sort();
}

function runSelfTest() {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-package-companion-test-"));
  try {
    const packageRoot = join(tempRoot, "packages/example/chart/1.0.0");
    const group = {
      packagePath: "packages/example/chart/1.0.0",
      packageRoot,
      installer: {
        metadata: { name: "example-chart", version: "1.0.0" },
        spec: { bases: [{ name: "default" }] },
      },
      entries: [{
        base: "default",
        sourceRecord: {
          apiVersion: "catalog.confighub.com/v1alpha1",
          kind: "BaseVariantRecord",
          metadata: { name: "example-chart-1-0-0-default" },
          spec: { source: { packageOciRef: "oci://example.invalid/chart@sha256:old" } },
        },
        intent: {
          apiVersion: "helm-expt.confighub.com/v1alpha1",
          kind: "HelmRenderIntent",
          metadata: { name: "example-chart-1-0-0-default" },
          spec: {
            baseVariant: "default",
            renderInputs: { installerPackageOciRef: "oci://example.invalid/chart@sha256:old" },
            provenance: { fullModelPath: ["source", "installer package OCI: oci://example.invalid/chart@sha256:old"] },
          },
        },
      }],
    };
    const outputs = outputsForGroup(group);
    writeOutputs(group, outputs);
    verifyOutputs(group, outputs, false);
    const combined = [...outputs.values()].join("\n");
    check(!combined.includes("sha256:old"), "embedded records kept a circular package digest");
    check(combined.includes("recordsAreDeployable: false"), "index does not mark companion records as non-deployable");
    console.log("verified installer package companion generation");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function usage() {
  return "Usage: node scripts/generate-installer-package-companions.mjs --generate|--verify|--self-test";
}
