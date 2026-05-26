import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultChartsRoot = join(repoRoot, "archive", "render-and-vendor-top20", "charts");

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const chartsRoot = resolve(optionValue("--charts-root") ?? defaultChartsRoot);

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function byteLength(path) {
  return readFileSync(path).length;
}

function parseYamlFile(path) {
  const script = `
import json
import sys
import yaml

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    docs = list(yaml.safe_load_all(handle))
docs = [doc for doc in docs if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`;
  const output = execFileSync("python3", ["-c", script, path], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  return JSON.parse(output);
}

function parseRenderedObjects(path) {
  const script = `
import json
import sys
import yaml

objects = []
for doc in yaml.load_all(open(sys.argv[1], "r", encoding="utf-8"), Loader=yaml.BaseLoader):
    if not isinstance(doc, dict):
        continue
    metadata = doc.get("metadata")
    if not isinstance(metadata, dict):
        continue
    api_version = str(doc.get("apiVersion", ""))
    kind = str(doc.get("kind", ""))
    namespace = str(metadata.get("namespace", ""))
    name = str(metadata.get("name", ""))
    if kind or name or api_version:
        objects.append({
            "apiVersion": api_version,
            "kind": kind,
            "namespace": namespace,
            "name": name,
            "identity": "|".join([api_version, kind, namespace, name]),
        })
print(json.dumps(objects, sort_keys=True))
`;
  const output = execFileSync("python3", ["-c", script, path], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });
  return JSON.parse(output);
}

function requiredFiles(chartPath) {
  return [
    "helm-import.receipt.yaml",
    "helm-import.spec.yaml",
    "installer.yaml",
    "values.yaml",
    "base/upstream.yaml",
    "base/kustomization.yaml",
  ].map((relative) => join(chartPath, relative));
}

function sortedChartDirs(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name))
    .sort();
}

function sameJSON(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function verifyChart(chartPath, indexRow = null) {
  const failures = [];
  const chartName = basename(chartPath);
  const fail = (message) => failures.push(`${chartName}: ${message}`);
  const check = (condition, message) => {
    if (!condition) fail(message);
  };

  for (const file of requiredFiles(chartPath)) {
    check(existsSync(file), `missing required file ${file}`);
  }
  if (failures.length) return failures;

  const receiptPath = join(chartPath, "helm-import.receipt.yaml");
  const importSpecPath = join(chartPath, "helm-import.spec.yaml");
  const installerPath = join(chartPath, "installer.yaml");
  const valuesPath = join(chartPath, "values.yaml");
  const upstreamPath = join(chartPath, "base", "upstream.yaml");
  const kustomizationPath = join(chartPath, "base", "kustomization.yaml");

  const receipt = parseYamlFile(receiptPath);
  const importSpec = parseYamlFile(importSpecPath);
  const installer = parseYamlFile(installerPath);
  const kustomization = parseYamlFile(kustomizationPath);
  const objects = parseRenderedObjects(upstreamPath);
  const identities = objects.map((object) => object.identity);
  const duplicateIdentities = identities
    .filter((identity, index) => identities.indexOf(identity) !== index)
    .filter((identity, index, all) => all.indexOf(identity) === index);

  check(receipt.kind === "HelmImportReceipt", "helm-import.receipt.yaml kind must be HelmImportReceipt");
  check(importSpec.kind === "HelmImportSpec", "helm-import.spec.yaml kind must be HelmImportSpec");
  check(installer.kind === "Package", "installer.yaml kind must be Package");
  check(receipt.metadata?.name === chartName, `receipt metadata.name must equal directory name ${chartName}`);
  check(importSpec.metadata?.name === chartName, `import spec metadata.name must equal directory name ${chartName}`);
  check(installer.metadata?.name === chartName, `installer metadata.name must equal directory name ${chartName}`);

  const bases = installer.spec?.bases ?? [];
  const defaultBases = bases.filter((base) => base?.default === true);
  check(defaultBases.length === 1, "installer.yaml must declare exactly one default base");
  check(defaultBases[0]?.path === "base", "installer.yaml default base path must be base");
  check(
    Array.isArray(kustomization.resources) && kustomization.resources.includes("upstream.yaml"),
    "base/kustomization.yaml must reference upstream.yaml",
  );

  const receiptChart = receipt.spec?.chart ?? {};
  const importChart = importSpec.spec?.chart ?? {};
  for (const field of ["repositoryName", "repositoryURL", "resolvedRepositoryURL", "name", "version"]) {
    check(receiptChart[field] === importChart[field], `chart.${field} mismatch between receipt and import spec`);
  }

  const receiptRender = receipt.spec?.render ?? {};
  const importRender = importSpec.spec?.render ?? {};
  for (const field of ["releaseName", "namespace", "kubeVersion"]) {
    check(receiptRender[field] === importRender[field], `render.${field} mismatch between receipt and import spec`);
  }
  check(
    sameJSON(receiptRender.apiVersions ?? [], importRender.apiVersions ?? []),
    "render.apiVersions mismatch between receipt and import spec",
  );
  const receiptValueFiles = (receiptRender.values?.files ?? []).map((file) => file.path);
  check(
    sameJSON(receiptValueFiles, importRender.valuesFiles ?? []),
    "render values file list mismatch between receipt and import spec",
  );
  check(sameJSON(receiptValueFiles, ["values.yaml"]), "V0 expects exactly one values file: values.yaml");

  const receiptValue = receiptRender.values?.files?.[0] ?? {};
  check(receiptValue.sha256 === sha256File(valuesPath), "values.yaml SHA256 mismatch");
  check(receipt.spec?.outputs?.importSpecSHA256 === sha256File(importSpecPath), "helm-import.spec.yaml SHA256 mismatch");
  check(receipt.spec?.outputs?.upstreamYAMLSHA256 === sha256File(upstreamPath), "base/upstream.yaml SHA256 mismatch");
  check(receipt.spec?.outputs?.upstreamYAMLBytes === byteLength(upstreamPath), "base/upstream.yaml byte length mismatch");
  check(receipt.spec?.outputs?.resourceCount === objects.length, "rendered object count mismatch");

  const missingIdentity = objects.filter(
    (object) => !object.apiVersion || !object.kind || !object.name || !object.identity,
  );
  check(missingIdentity.length === 0, "every rendered object must have apiVersion, kind, and metadata.name");
  check(duplicateIdentities.length === 0, `duplicate rendered object identities: ${duplicateIdentities.join(", ")}`);

  const phase = receipt.spec?.status?.phase;
  if (phase === "rendered") {
    check(receipt.spec?.outputs?.deterministicAcrossTwoLocalRenders === true, "rendered chart must be deterministic");
    check(
      receipt.spec?.outputs?.secondRenderSHA256 === receipt.spec?.outputs?.upstreamYAMLSHA256,
      "secondRenderSHA256 must equal upstreamYAMLSHA256 for rendered chart",
    );
  } else if (phase === "render-failed") {
    check(receipt.spec?.outputs?.resourceCount === 0, "render-failed chart must have resourceCount 0");
  } else {
    fail(`unsupported receipt status.phase ${JSON.stringify(phase)}`);
  }

  if (indexRow) {
    check(indexRow.path?.endsWith(`/${chartName}`), "index path must end with chart directory name");
    check(indexRow.rank === receipt.spec?.ranking?.rank, "index rank mismatch");
    check(indexRow.repository === receiptChart.repositoryName, "index repository mismatch");
    check(indexRow.name === receiptChart.name, "index chart name mismatch");
    check(indexRow.version === receiptChart.version, "index version mismatch");
    check(indexRow.status === phase, "index status mismatch");
    check(
      indexRow.deterministicAcrossTwoLocalRenders === receipt.spec?.outputs?.deterministicAcrossTwoLocalRenders,
      "index determinism mismatch",
    );
    check(indexRow.resourceCount === receipt.spec?.outputs?.resourceCount, "index resourceCount mismatch");
    check(indexRow.upstreamYAMLSHA256 === receipt.spec?.outputs?.upstreamYAMLSHA256, "index upstream digest mismatch");
  }

  return failures;
}

function verifyArchive(root = chartsRoot) {
  const failures = [];
  const indexPath = join(root, "index.yaml");
  if (!existsSync(indexPath)) {
    throw new Error(`missing index ${indexPath}`);
  }
  const index = parseYamlFile(indexPath);
  if (index.kind !== "HelmImportIndex") {
    failures.push("index.yaml kind must be HelmImportIndex");
  }
  const rows = index.spec?.charts ?? [];
  const rowsByDir = new Map(rows.map((row) => [basename(row.path), row]));
  const chartDirs = sortedChartDirs(root);

  if (rows.length !== chartDirs.length) {
    failures.push(`index chart count ${rows.length} does not match directory count ${chartDirs.length}`);
  }

  for (const chartPath of chartDirs) {
    const row = rowsByDir.get(basename(chartPath));
    if (!row) {
      failures.push(`${basename(chartPath)}: missing index row`);
      continue;
    }
    failures.push(...verifyChart(chartPath, row));
  }

  if (failures.length) {
    throw new Error(`artifact verification failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  }

  return { chartCount: chartDirs.length };
}

function runSelfTest() {
  const source = join(defaultChartsRoot, "06-bitnami-redis");
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-verifier-"));
  const tempChart = join(tempRoot, "06-bitnami-redis");
  try {
    cpSync(source, tempChart, { recursive: true });
    writeFileSync(join(tempChart, "values.yaml"), "auth:\n  password: corrupted\n");
    const failures = verifyChart(tempChart);
    const expected = failures.some((failure) => failure.includes("values.yaml SHA256 mismatch"));
    if (!expected) {
      throw new Error(`self-test did not catch values.yaml tampering:\n${failures.join("\n")}`);
    }
    console.log("self-test passed: values.yaml tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (selfTest) {
  runSelfTest();
} else {
  const result = verifyArchive(chartsRoot);
  console.log(`verified artifact chain for ${result.chartCount} chart import(s)`);
}
