#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  check,
  listFiles,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--run", "--verify"].includes(mode), "use --run or --verify");

const version = process.env.AICR_NESTED_VERSION ?? "0.19.0";
check(/^0\.(19|20)\.0$/.test(version), "AICR_NESTED_VERSION must be 0.19.0 or 0.20.0");
const versionSlug = version.replaceAll(".", "-");

const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  `eks-h100-training-kubeflow-v${versionSlug}`,
);
const applicationsRoot = join(exampleRoot, "argocd-rendered", "templates");
const bundleRoot = join(exampleRoot, "argocd-helm-bundle");
const outputRoot = join(exampleRoot, "nested-renders");
const dataRoot = join(repoRoot, "data", `aicr-v${versionSlug}-nested-sources`);
const catalogPath = join(dataRoot, "catalog.json");
const summaryPath = join(dataRoot, "summary.md");

const applications = loadApplications();
check(applications.length === 16, `expected 16 nested Applications, found ${applications.length}`);

if (mode === "--run") {
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
  const entries = applications.map(renderApplication);
  mkdirSync(dataRoot, { recursive: true });
  write(catalogPath, `${JSON.stringify({ entries }, null, 2)}\n`);
  write(summaryPath, renderSummary(entries));
  const passed = entries.filter((entry) => entry.render.status === "pass").length;
  console.log(`rendered ${passed}/${entries.length} AICR v${version} nested sources`);
  if (passed !== entries.length) process.exitCode = 1;
} else {
  verifyRetainedCatalog();
}

function loadApplications() {
  return readdirSync(applicationsRoot)
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => ({
      path: join(applicationsRoot, name),
      document: readYaml(join(applicationsRoot, name)),
    }))
    .filter(({ document }) => document.metadata?.name !== "aicr-stack")
    .map(({ path, document }) => {
      const slug = document.metadata.name;
      const source = document.spec?.source ?? {};
      const componentDir = readdirSync(bundleRoot)
        .find((name) => new RegExp(`^[0-9]{3}-${escapeRegExp(slug)}$`).test(name));
      check(componentDir, `${slug}: component values directory is missing`);
      const valuesPath = join(bundleRoot, componentDir, "values.yaml");
      check(existsSync(valuesPath), `${slug}: ${relativeRepo(valuesPath)} is missing`);
      return {
        slug,
        applicationPath: relativeRepo(path),
        namespace: document.spec?.destination?.namespace ?? "default",
        source: {
          repoURL: source.repoURL ?? "",
          chart: source.chart ?? "",
          path: source.path ?? "",
          targetRevision: String(source.targetRevision ?? ""),
        },
        valuesPath,
        valuesSha256: sha256(readFileSync(valuesPath)),
      };
    });
}

function renderApplication(application) {
  const componentRoot = join(outputRoot, application.slug);
  mkdirSync(componentRoot, { recursive: true });
  const objectsPath = join(componentRoot, "objects.yaml");
  const receiptPath = join(componentRoot, "receipt.yaml");
  const resolvedSource = resolveSource(application);
  const args = helmArgs(application, resolvedSource.chartPath);
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    stdout = execFileSync("helm", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    exitCode = Number(error.status ?? 1);
    stdout = String(error.stdout ?? "");
    stderr = String(error.stderr ?? error.message ?? "");
  } finally {
    resolvedSource.cleanup();
  }

  const normalizedOutput = normalizeRenderOutput(stdout);
  const objects = exitCode === 0 ? parseObjects(normalizedOutput) : [];
  if (exitCode === 0) write(objectsPath, normalizedOutput);
  const objectKinds = countBy(objects, (object) => object.kind ?? "Unknown");
  const hooks = objects.filter((object) => object.metadata?.annotations?.["helm.sh/hook"]);
  const crds = objects.filter((object) => object.kind === "CustomResourceDefinition");
  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "NestedSourceRenderReceipt",
    metadata: { name: `aicr-v${versionSlug}-${application.slug}` },
    spec: {
      parent: `aicr-eks-h100-training-kubeflow-v${versionSlug}-argocd`,
      application: application.applicationPath,
      source: application.source,
      sourceArtifact: resolvedSource.record,
      values: {
        path: relativeRepo(application.valuesPath),
        sha256: application.valuesSha256,
      },
      destinationNamespace: application.namespace,
      commands: {
        fetch: resolvedSource.command,
        render: [
          "helm",
          "template",
          application.slug,
          `<source-artifact sha256:${resolvedSource.record.sha256}>`,
          "--namespace",
          application.namespace,
          "--values",
          relativeRepo(application.valuesPath),
          "--include-crds",
        ],
      },
      output: exitCode === 0
        ? {
            path: relativeRepo(objectsPath),
            sha256: sha256(normalizedOutput),
            objectCount: objects.length,
            kinds: objectKinds,
            crdCount: crds.length,
            hookObjectCount: hooks.length,
          }
        : null,
      processingBoundary: {
        wrapper: "The parent Catalog entry retains the Argo CD Application object.",
        nestedSource: "This receipt runs the source named by that Application and records its exact rendered objects.",
        delivery: "Rendering does not prove that Argo CD reconciled the objects or that the workload became healthy.",
      },
    },
    status: {
      result: exitCode === 0 ? "pass" : "blocked",
      materialization: exitCode === 0 ? "captured" : "not-captured",
      flattening: "not-assessed",
      lifecycle: hooks.length || crds.length ? "requires-review" : "not-yet-reviewed",
      delivery: "not-run",
      error: exitCode === 0 ? "" : conciseError(stderr),
    },
  };
  writeYaml(receiptPath, receipt);
  return catalogEntry(receipt, receiptPath);
}

function helmArgs(application, chartPath) {
  const args = ["template", application.slug, chartPath];
  args.push(
    "--namespace",
    application.namespace,
    "--values",
    application.valuesPath,
    "--include-crds",
  );
  return args;
}

function resolveSource(application) {
  const source = application.source;
  const localPath = source.path ? join(bundleRoot, source.path) : "";
  if (localPath && existsSync(localPath)) {
    const files = listFiles(localPath)
      .map((path) => ({
        path: path.slice(`${localPath}/`.length),
        sha256: sha256(readFileSync(path)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    const treeSha256 = sha256(
      files.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n",
    );
    return {
      chartPath: localPath,
      command: ["read", relativeRepo(localPath)],
      record: {
        type: "local-chart-tree",
        path: relativeRepo(localPath),
        version: source.targetRevision,
        sha256: treeSha256,
        fileCount: files.length,
      },
      cleanup() {},
    };
  }

  const work = mkdtempSync(join(tmpdir(), `helm-expt-aicr-v${versionSlug}-${application.slug}-`));
  const pullArgs = source.repoURL.startsWith("oci://")
    ? ["pull", source.repoURL, "--version", source.targetRevision, "--destination", work]
    : [
        "pull",
        source.chart,
        "--repo",
        source.repoURL,
        "--version",
        source.targetRevision,
        "--destination",
        work,
      ];
  try {
    execFileSync("helm", pullArgs, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const archives = readdirSync(work).filter((name) => name.endsWith(".tgz"));
    check(archives.length === 1, `${application.slug}: expected one pulled chart archive`);
    const chartPath = join(work, archives[0]);
    return {
      chartPath,
      command: [
        "helm",
        ...pullArgs.map((value) => (value === work ? "<temporary-directory>" : value)),
      ],
      record: {
        type: "helm-chart-archive",
        source: source.path
          ? `${source.repoURL}/${source.path}`
          : source.repoURL.startsWith("oci://")
            ? source.repoURL
            : `${source.repoURL}/${source.chart}`,
        version: source.targetRevision,
        archiveName: archives[0],
        sha256: sha256(readFileSync(chartPath)),
      },
      cleanup() {
        rmSync(work, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(work, { recursive: true, force: true });
    throw error;
  }
}

function catalogEntry(receipt, receiptPath) {
  return {
    name: receipt.metadata.name.replace(new RegExp(`^aicr-v${versionSlug}-`), ""),
    application: receipt.spec.application,
    source: receipt.spec.source,
    sourceArtifact: receipt.spec.sourceArtifact,
    values: receipt.spec.values,
    destinationNamespace: receipt.spec.destinationNamespace,
    render: {
      status: receipt.status.result,
      objectCount: receipt.spec.output?.objectCount ?? 0,
      objectSha256: receipt.spec.output?.sha256 ?? "",
      crdCount: receipt.spec.output?.crdCount ?? 0,
      hookObjectCount: receipt.spec.output?.hookObjectCount ?? 0,
      error: receipt.status.error,
    },
    flattening: receipt.status.flattening,
    lifecycle: receipt.status.lifecycle,
    delivery: receipt.status.delivery,
    receipt: relativeRepo(receiptPath),
  };
}

function verifyRetainedCatalog() {
  check(existsSync(catalogPath), `${relativeRepo(catalogPath)} is missing; run with --run`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run with --run`);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  check(catalog.entries?.length === 16, "nested-source Catalog must contain 16 entries");
  const expectedNames = applications.map((item) => item.slug).sort();
  check(
    JSON.stringify(catalog.entries.map((item) => item.name).sort()) === JSON.stringify(expectedNames),
    "nested-source Catalog does not match the retained Applications",
  );
  for (const entry of catalog.entries) {
    const application = applications.find((item) => item.slug === entry.name);
    check(application, `${entry.name}: retained Application is missing`);
    check(entry.values.sha256 === application.valuesSha256, `${entry.name}: values digest changed`);
    check(entry.source.targetRevision === application.source.targetRevision, `${entry.name}: source version changed`);
    check(existsSync(join(repoRoot, entry.receipt)), `${entry.name}: receipt is missing`);
    const receipt = readYaml(join(repoRoot, entry.receipt));
    check(receipt.status?.result === entry.render.status, `${entry.name}: receipt status changed`);
    check(
      /^[0-9a-f]{64}$/.test(receipt.spec?.sourceArtifact?.sha256 ?? ""),
      `${entry.name}: source artifact digest is missing`,
    );
    check(
      entry.sourceArtifact?.sha256 === receipt.spec.sourceArtifact.sha256,
      `${entry.name}: Catalog source digest differs from its receipt`,
    );
    if (entry.render.status === "pass") {
      const outputPath = join(repoRoot, receipt.spec.output.path);
      check(existsSync(outputPath), `${entry.name}: rendered output is missing`);
      const output = readFileSync(outputPath);
      const objects = parseObjects(output.toString("utf8"));
      check(sha256(output) === entry.render.objectSha256, `${entry.name}: output digest changed`);
      check(objects.length === entry.render.objectCount, `${entry.name}: object count changed`);
    }
  }
  console.log(`verified ${catalog.entries.length} retained AICR v${version} nested-source records`);
}

function renderSummary(entries) {
  const passed = entries.filter((entry) => entry.render.status === "pass").length;
  const crdEntries = entries.filter((entry) => entry.render.crdCount > 0).length;
  const hookEntries = entries.filter((entry) => entry.render.hookObjectCount > 0).length;
  const rows = entries.map((entry) => {
    const source = entry.source.path
      ? `${entry.source.repoURL}/${entry.source.path}@${entry.source.targetRevision}`
      : entry.source.repoURL.startsWith("oci://")
        ? `${entry.source.repoURL}@${entry.source.targetRevision}`
      : `${entry.source.repoURL}${entry.source.chart ? `/${entry.source.chart}` : ""}@${entry.source.targetRevision}`;
    const result = entry.render.status === "pass"
      ? `${entry.render.objectCount} ${entry.render.objectCount === 1 ? "object" : "objects"}`
      : `blocked: ${entry.render.error}`;
    return `| ${entry.name} | \`${source}\` | \`${entry.sourceArtifact.sha256.slice(0, 12)}...\` | ${result} | ${entry.render.crdCount} | ${entry.render.hookObjectCount} | [receipt](../../${entry.receipt}) |`;
  });
  return `# AICR v${version} nested source processing\n\nThe parent AICR entry contains 17 literal Argo CD Applications. One is the root\nApplication. The other 16 name sources that Argo CD processes later. This table\nmakes that second boundary explicit.\n\nA successful row binds the fetched chart archive or local chart tree, retained\nvalues, and rendered object set with separate SHA-256 digests. It does not prove\nthat lifecycle work ran or that a controller reconciled the objects on EKS.\n\n- Local renders captured: **${passed}/${entries.length}**.\n- Components whose rendered output contains CRDs: **${crdEntries}**.\n- Components whose rendered output contains Helm hook objects: **${hookEntries}**.\n\n| Component | Exact nested source | Source SHA-256 | Local result | CRDs | hook objects | Evidence |\n| --- | --- | --- | --- | ---: | ---: | --- |\n${rows.join("\n")}\n`;
}

function countBy(values, keyFor) {
  const counts = {};
  for (const value of values) {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function conciseError(value) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, 600);
}

function normalizeRenderOutput(value) {
  const withoutTrailingSpace = value.replace(/[ \t]+$/gm, "");
  return `${withoutTrailingSpace.replace(/\n+$/, "")}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
