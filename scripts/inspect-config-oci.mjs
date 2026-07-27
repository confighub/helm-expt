#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
} from "./lib/proof-common.mjs";

const dataRoot = join(repoRoot, "data", "oci-inspection");
const reportsRoot = join(dataRoot, "reports");
const summaryPath = join(dataRoot, "summary.md");
const nginxRepository =
  "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx";
const nginxDigest =
  "sha256:08947210de607a6b9b8e7b8423b024e3fe89a0fc2b09581f80e2401008e445a1";
const examples = [
  {
    id: "aicr-literal-config",
    reference:
      "oci-layout:examples/aicr/eks-h100-training-kubeflow/oci-layouts/argocd-config:0.14.0",
    description: "AICR literal Kubernetes configuration",
  },
  {
    id: "kubara-literal-config",
    reference:
      "oci-layout:examples/kubara/local-platform/oci-layout:0.12.0-local",
    description: "Kubara literal Kubernetes configuration",
  },
  {
    id: "aicr-helm-source",
    reference:
      "oci-layout:examples/aicr/eks-h100-training-kubeflow/oci-layouts/argocd-source:0.14.0",
    description: "AICR Helm source package",
  },
  {
    id: "nginx-installer",
    reference: `oci://${nginxRepository}@${nginxDigest}`,
    description: "Public cub installer package rendered with its default config",
    options: {
      render: true,
      base: "http-clusterip",
      namespace: "nginx",
    },
    live: true,
  },
];

const args = parseArgs(process.argv.slice(2));

if (args.mode === "generate") {
  generateExamples();
} else if (args.mode === "verify") {
  verifyExamples({ live: false });
} else if (args.mode === "verify-live") {
  verifyExamples({ live: true });
} else if (args.mode === "inspect") {
  inspectFromCli(args);
} else {
  printHelp();
}

function inspectFromCli(options) {
  check(options.reference, "provide an OCI reference");
  const report = inspectReference(options.reference, options);
  if (options.reportPath) {
    const path = resolve(process.cwd(), options.reportPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stableJson(report));
  }
  process.stdout.write(options.json ? stableJson(report) : renderHuman(report));
  if (report.status.result === "fail") process.exitCode = 1;
}

function generateExamples() {
  mkdirSync(reportsRoot, { recursive: true });
  const reports = [];
  for (const example of examples) {
    const report = inspectReference(example.reference, example.options ?? {});
    check(
      report.status.result !== "fail",
      `${example.id} inspection failed: ${report.status.failures.join("; ")}`,
    );
    reports.push({ ...example, report });
    writeFileSync(join(reportsRoot, `${example.id}.json`), stableJson(report));
  }
  writeFileSync(summaryPath, renderSummary(reports));
  console.log(`wrote ${relativeRepo(summaryPath)} and ${reports.length} report(s)`);
}

function verifyExamples({ live }) {
  const reports = [];
  for (const example of examples) {
    const reportPath = join(reportsRoot, `${example.id}.json`);
    check(existsSync(reportPath), `${relativeRepo(reportPath)} is missing`);
    const committed = JSON.parse(readFileSync(reportPath, "utf8"));
    if (!example.live || live) {
      const observed = inspectReference(example.reference, example.options ?? {});
      check(
        stableJson(observed) === stableJson(committed),
        `${relativeRepo(reportPath)} does not match a fresh inspection`,
      );
    } else {
      verifyCommittedInstallerReport(committed);
    }
    reports.push({ ...example, report: committed });
  }
  check(
    existsSync(summaryPath)
      && readFileSync(summaryPath, "utf8") === renderSummary(reports),
    `${relativeRepo(summaryPath)} is stale; run npm run oci:inspect:generate`,
  );
  console.log(
    live
      ? "verified all committed OCI inspections, including the public package"
      : "verified committed OCI inspections without network access",
  );
}

function verifyCommittedInstallerReport(report) {
  const receiptPath = join(
    repoRoot,
    "runs",
    "installer-oci",
    "bitnami-nginx",
    "24.0.2",
    "installer-package-publication-receipt.yaml",
  );
  const installerPath = join(
    repoRoot,
    "packages",
    "bitnami",
    "nginx",
    "24.0.2",
    "installer.yaml",
  );
  const renderedPath = join(
    repoRoot,
    "recipes",
    "bitnami",
    "nginx",
    "24.0.2",
    "revisions",
    "http-clusterip",
    "r001",
    "rendered",
    "release-objects.yaml",
  );
  const receipt = readYaml(receiptPath);
  const installer = readYaml(installerPath);
  const rendered = kubernetesObjects(parseDocs(readFileSync(renderedPath, "utf8")));
  const publishedDigest = String(receipt.spec?.outputs?.push ?? "").match(
    /manifest:\s+(sha256:[a-f0-9]{64})/,
  )?.[1];
  check(publishedDigest === nginxDigest, "NGINX publication receipt digest changed");
  check(
    report.source.resolvedDigest === publishedDigest,
    "committed NGINX inspection has the wrong manifest digest",
  );
  check(
    report.package.role === "cub-installer-package",
    "committed NGINX inspection has the wrong package role",
  );
  check(
    sameStrings(
      report.installer.configs.map((item) => item.name),
      installer.spec.bases.map((item) => item.name),
    ),
    "committed NGINX inspection has stale preset config names",
  );
  check(
    report.installer.selectedConfig ===
      installer.spec.bases.find((item) => item.default)?.name,
    "committed NGINX inspection has the wrong default config",
  );
  check(
    report.contents.kubernetesObjects === rendered.length + 1,
    "committed NGINX object count differs from the checked render plus its setup Namespace",
  );
  const setupObjects = [...rendered, { kind: "Namespace" }];
  check(
    sameKindCounts(report.contents.kinds, countKinds(setupObjects)),
    "committed NGINX object kinds differ from the checked render plus its setup Namespace",
  );
}

function inspectReference(reference, options = {}) {
  requireCommand("oras");
  const source = parseReference(reference);
  const descriptor = JSON.parse(
    command("oras", orasArgs(source, ["manifest", "fetch", "--descriptor"])),
  );
  const manifest = JSON.parse(
    command("oras", orasArgs(source, ["manifest", "fetch"])),
  );
  const role = classifyPackage(manifest);
  const report = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "OciInspectionReport",
    source: {
      reference,
      location: source.location,
      resolvedDigest: descriptor.digest ?? "",
      manifestMediaType: descriptor.mediaType ?? manifest.mediaType ?? "",
    },
    package: {
      role: role.id,
      name: role.name,
      artifactType: manifest.artifactType ?? "",
      configMediaType: manifest.config?.mediaType ?? "",
      title: manifest.annotations?.["org.opencontainers.image.title"] ?? "",
      version: manifest.annotations?.["org.opencontainers.image.version"] ?? "",
    },
    contents: {
      layers: (manifest.layers ?? []).map((layer) => ({
        title: layer.annotations?.["org.opencontainers.image.title"] ?? "",
        mediaType: layer.mediaType ?? "",
        digest: layer.digest ?? "",
        size: layer.size ?? 0,
      })),
      files: [],
      companionRecords: [],
      kubernetesObjects: 0,
      kinds: [],
      namespaces: [],
    },
    lifecycle: {
      customResourceDefinitions: 0,
      helmHooks: 0,
      jobs: 0,
      secrets: 0,
    },
    installer: {
      packageFiles: [],
      configs: [],
      selectedConfig: "",
      externalRequirements: [],
      rendered: false,
    },
    checks: [
      {
        name: "manifest-resolved",
        result: descriptor.digest ? "pass" : "fail",
        detail: descriptor.digest
          ? "The OCI manifest resolved to a digest."
          : "The OCI manifest did not resolve to a digest.",
      },
    ],
    nextSteps: [],
    limits: [
      "These checks cover OCI integrity, readable Kubernetes object shape, duplicate identities, and obvious placeholders.",
      "They do not prove cluster admission, controller reconciliation, runtime health, provenance signatures, or production safety.",
    ],
    status: {
      result: "pass",
      failures: [],
      warnings: [],
    },
  };

  if (role.id === "cub-installer-package") {
    inspectInstaller(source, reference, report, options);
  } else if (role.id === "helm-chart-source") {
    report.checks.push({
      name: "kubernetes-objects",
      result: "not-applicable",
      detail:
        "This is a Helm chart source package. Render it with its values and target assumptions before inspecting Kubernetes objects.",
    });
    report.nextSteps.push(
      "Render the chart with the intended values, release name, namespace, and Kubernetes capabilities.",
      "Inspect the rendered objects and any hooks or CRDs before publishing a literal configuration OCI.",
    );
  } else {
    inspectPulledFiles(source, report, options);
  }

  finishReport(report);
  return report;
}

function inspectInstaller(source, reference, report, options) {
  requireCommand("cub");
  const inspectReference = source.location === "registry"
    ? withOciPrefix(source.target)
    : reference;
  check(
    source.location === "registry",
    "cub installer inspection currently requires a registry reference",
  );
  const details = JSON.parse(
    command("cub", ["installer", "inspect", inspectReference, "--json"]),
  );
  const manifest = details.Config?.manifest ?? {};
  const bundle = details.Config?.bundle ?? {};
  const configs = manifest.spec?.bases ?? [];
  const defaultConfig = configs.find((item) => item.default)?.name ?? "";
  const selectedConfig =
    options.base || defaultConfig || (configs.length === 1 ? configs[0].name : "");
  const packageFiles = [...(bundle.files ?? [])].sort();
  const packageCompanions = packageFiles
    .filter(isCompanionPath)
    .map((path) => `package/${path}`);

  report.contents.files = packageFiles;
  report.contents.companionRecords = packageCompanions;
  report.installer.packageFiles = packageFiles;
  report.installer.configs = configs.map((item) => ({
    name: item.name ?? "",
    default: Boolean(item.default),
    description: item.description ?? "",
    externalRequirements: item.externalRequires?.length ?? 0,
  }));
  report.installer.selectedConfig = selectedConfig;
  report.checks.push({
    name: "installer-metadata",
    result: configs.length ? "pass" : "fail",
    detail: configs.length
      ? `${configs.length} preset config(s) are named in installer.yaml.`
      : "installer.yaml does not name any preset configs.",
  });

  if (!options.render) {
    report.checks.push({
      name: "kubernetes-objects",
      result: "not-run",
      detail: "Add --render to render one preset config without applying it.",
    });
    report.nextSteps.push(
      selectedConfig
        ? `Run this command again with --render --base ${selectedConfig} to inspect the Kubernetes objects.`
        : "Choose one of the listed preset configs and run this command again with --render --base NAME.",
    );
    return;
  }

  check(
    selectedConfig,
    "the installer package has no default config; pass --base NAME",
  );
  check(
    configs.some((item) => item.name === selectedConfig),
    `installer config ${selectedConfig} does not exist`,
  );
  const selected = configs.find((item) => item.name === selectedConfig);
  const workspace = prepareWorkspace(options.workDir, "helm-expt-oci-installer-");
  try {
    const setupArgs = [
      "installer",
      "setup",
      "--pull",
      inspectReference,
      "--base",
      selectedConfig,
      "--work-dir",
      workspace.path,
      "--non-interactive",
    ];
    if (options.namespace) setupArgs.push("--namespace", options.namespace);
    command("cub", setupArgs);
    const manifestsRoot = join(workspace.path, "out", "manifests");
    const analysis = analyzeFiles(manifestsRoot);
    applyAnalysis(report, analysis);
    report.contents.companionRecords = [
      ...new Set([
        ...packageCompanions,
        ...report.contents.companionRecords.map((path) => `rendered/${path}`),
      ]),
    ].sort();
    report.installer.rendered = true;
    report.installer.externalRequirements = (selected.externalRequires ?? []).map(
      (item) => ({
        kind: item.kind ?? "",
        name: item.name ?? "",
        namespace: item.namespace ?? "",
      }),
    );
    report.checks.push({
      name: "installer-render",
      result: analysis.objects.length ? "pass" : "fail",
      detail: analysis.objects.length
        ? `${selectedConfig} rendered ${analysis.objects.length} Kubernetes object(s) without applying them.`
        : `${selectedConfig} rendered no Kubernetes objects.`,
    });
    report.nextSteps.push(
      "Read the rendered files and the listed requirements before applying anything.",
      options.workDir
        ? `The files are kept in ${relative(process.cwd(), workspace.path) || "."}/out/manifests.`
        : "Pass --work-dir DIR if you want to keep the rendered files.",
    );
  } finally {
    if (workspace.temporary) {
      rmSync(workspace.path, { recursive: true, force: true });
    }
  }
}

function inspectPulledFiles(source, report, options) {
  const workspace = prepareWorkspace(options.workDir, "helm-expt-oci-pull-");
  try {
    command(
      "oras",
      orasArgs(source, [
        "pull",
        "--no-tty",
        "--output",
        workspace.path,
      ]),
    );
    const analysis = analyzeFiles(workspace.path);
    applyAnalysis(report, analysis);
    report.checks.push({
      name: "layers-fetched",
      result: "pass",
      detail: `${report.contents.layers.length} referenced layer(s) were fetched by ORAS.`,
    });
    report.checks.push({
      name: "kubernetes-objects",
      result: analysis.objects.length ? "pass" : "warn",
      detail: analysis.objects.length
        ? `${analysis.objects.length} Kubernetes object(s) were parsed.`
        : "No Kubernetes objects were found in readable YAML or JSON layers.",
    });
    report.nextSteps.push(
      analysis.objects.length
        ? "Review the objects, lifecycle counts, companion records, and warnings before choosing a consumer."
        : "Check the package role and use its source tool to produce literal Kubernetes objects.",
      options.workDir
        ? `The pulled files are kept in ${relative(process.cwd(), workspace.path) || "."}.`
        : "Pass --work-dir DIR if you want to keep the pulled files.",
    );
  } finally {
    if (workspace.temporary) {
      rmSync(workspace.path, { recursive: true, force: true });
    }
  }
}

function analyzeFiles(root) {
  const files = walkFiles(root);
  const objects = [];
  const parseFailures = [];
  const companionRecords = [];
  const placeholderPaths = [];

  for (const path of files) {
    const rel = relative(root, path).replaceAll("\\", "/");
    if (isCompanionPath(rel)) companionRecords.push(rel);
    if (!isStructuredText(path)) continue;
    const text = readFileSync(path, "utf8");
    let docs;
    try {
      docs = parseDocs(text);
    } catch (error) {
      parseFailures.push(`${rel}: ${firstLine(error.message)}`);
      continue;
    }
    for (const doc of docs) {
      for (const object of kubernetesObjects([doc])) {
        objects.push({ ...object, sourceFile: rel });
        findPlaceholders(object, `${rel}:${object.kind}/${object.metadata.name}`, placeholderPaths);
      }
      if (!kubernetesObjects([doc]).length && isCompanionDocument(doc)) {
        companionRecords.push(rel);
      }
    }
  }

  const identities = objects.map(identityFor);
  const duplicates = [...new Set(identities.filter(
    (identity, index) => identities.indexOf(identity) !== index,
  ))].sort();
  return {
    files: files.map((path) => relative(root, path).replaceAll("\\", "/")).sort(),
    companionRecords: [...new Set(companionRecords)].sort(),
    objects,
    parseFailures,
    placeholderPaths: [...new Set(placeholderPaths)].sort(),
    duplicates,
  };
}

function applyAnalysis(report, analysis) {
  report.contents.files = analysis.files;
  report.contents.companionRecords = analysis.companionRecords;
  report.contents.kubernetesObjects = analysis.objects.length;
  report.contents.kinds = countKinds(analysis.objects);
  report.contents.namespaces = [
    ...new Set(
      analysis.objects
        .map((object) => object.metadata?.namespace ?? "")
        .filter(Boolean),
    ),
  ].sort();
  report.lifecycle.customResourceDefinitions = analysis.objects.filter(
    (object) => object.kind === "CustomResourceDefinition",
  ).length;
  report.lifecycle.helmHooks = analysis.objects.filter(
    (object) => object.metadata?.annotations?.["helm.sh/hook"],
  ).length;
  report.lifecycle.jobs = analysis.objects.filter(
    (object) => ["Job", "CronJob"].includes(object.kind),
  ).length;
  report.lifecycle.secrets = analysis.objects.filter(
    (object) => object.kind === "Secret",
  ).length;
  report.checks.push(
    {
      name: "structured-files-parse",
      result: analysis.parseFailures.length ? "fail" : "pass",
      detail: analysis.parseFailures.length
        ? analysis.parseFailures.join("; ")
        : "All YAML and JSON files parsed.",
    },
    {
      name: "object-identities-unique",
      result: analysis.duplicates.length ? "fail" : "pass",
      detail: analysis.duplicates.length
        ? `Duplicate objects: ${analysis.duplicates.join(", ")}`
        : "No duplicate Kubernetes object identities were found.",
    },
    {
      name: "obvious-placeholders",
      result: analysis.placeholderPaths.length ? "warn" : "pass",
      detail: analysis.placeholderPaths.length
        ? `Review placeholder-like values in ${analysis.placeholderPaths.join(", ")}.`
        : "No common unfinished-value markers were found.",
    },
  );
}

function finishReport(report) {
  const failures = report.checks
    .filter((item) => item.result === "fail")
    .map((item) => `${item.name}: ${item.detail}`);
  const warnings = report.checks
    .filter((item) => item.result === "warn")
    .map((item) => `${item.name}: ${item.detail}`);
  report.status = {
    result: failures.length ? "fail" : warnings.length ? "pass-with-warnings" : "pass",
    failures,
    warnings,
  };
}

function classifyPackage(manifest) {
  if (
    manifest.artifactType ===
    "application/vnd.confighub.installer.package.v1+json"
  ) {
    return {
      id: "cub-installer-package",
      name: "cub installer source package",
    };
  }
  if (
    manifest.config?.mediaType === "application/vnd.cncf.helm.config.v1+json"
    || (manifest.layers ?? []).some((layer) =>
      layer.mediaType === "application/vnd.cncf.helm.chart.content.v1.tar+gzip"
    )
  ) {
    return { id: "helm-chart-source", name: "Helm chart source package" };
  }
  if (
    [
      "application/vnd.confighub.kubernetes.config.v1",
      "application/vnd.confighub.config.v1",
    ].includes(manifest.artifactType)
  ) {
    return {
      id: "literal-kubernetes-config",
      name: "literal Kubernetes configuration",
    };
  }
  if ((manifest.layers ?? []).some((layer) => isYamlMediaType(layer.mediaType))) {
    return {
      id: "portable-kubernetes-bundle",
      name: "portable package with readable Kubernetes YAML",
    };
  }
  return { id: "unknown", name: "unrecognized OCI package" };
}

function kubernetesObjects(docs) {
  const result = [];
  for (const doc of docs) {
    if (doc?.kind === "List" && Array.isArray(doc.items)) {
      result.push(...kubernetesObjects(doc.items));
      continue;
    }
    if (
      typeof doc?.apiVersion === "string"
      && typeof doc?.kind === "string"
      && typeof doc?.metadata?.name === "string"
    ) {
      result.push(doc);
    }
  }
  return result;
}

function identityFor(object) {
  return [
    object.apiVersion,
    object.kind,
    object.metadata?.namespace ?? "",
    object.metadata?.name ?? "",
  ].join("|");
}

function countKinds(objects) {
  const counts = new Map();
  for (const object of objects) {
    counts.set(object.kind, (counts.get(object.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([kind, count]) => ({ kind, count }));
}

function findPlaceholders(value, path, findings) {
  if (typeof value === "string") {
    if (
      /confighubplaceholder|change[-_ ]?me|replace[-_ ]?me|your_org|your_repo/i.test(
        value,
      )
    ) {
      findings.push(path);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPlaceholders(item, `${path}[${index}]`, findings));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      findPlaceholders(item, `${path}.${key}`, findings);
    }
  }
}

function isCompanionDocument(doc) {
  return [
    "HelmRenderIntent",
    "BaseVariantRecord",
    "Route",
    "Receipt",
    "InstallerPackagePublicationReceipt",
  ].some((term) => String(doc?.kind ?? "").includes(term));
}

function isCompanionPath(path) {
  return /(^|\/)(readme|installer|values|inputs|selection|facts|route|receipt|render[-_]?intent|metadata)(\.|\/|$)/i.test(
    path,
  );
}

function isStructuredText(path) {
  return [".yaml", ".yml", ".json"].includes(extname(path).toLowerCase());
}

function isYamlMediaType(mediaType) {
  return /yaml|yml|kubernetes/i.test(mediaType ?? "");
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) result.push(...walkFiles(path));
    else if (stat.isFile()) result.push(path);
  }
  return result;
}

function prepareWorkspace(requested, prefix) {
  if (!requested) {
    return { path: mkdtempSync(join(tmpdir(), prefix)), temporary: true };
  }
  const path = resolve(process.cwd(), requested);
  if (existsSync(path)) {
    check(
      readdirSync(path).length === 0,
      `${path} is not empty; choose an empty --work-dir`,
    );
  } else {
    mkdirSync(path, { recursive: true });
  }
  return { path, temporary: false };
}

function parseReference(value) {
  if (value.startsWith("oci-layout://")) {
    return {
      location: "local-layout",
      target: resolveLayoutTarget(value.slice("oci-layout://".length)),
    };
  }
  if (value.startsWith("oci-layout:")) {
    return {
      location: "local-layout",
      target: resolveLayoutTarget(value.slice("oci-layout:".length)),
    };
  }
  return {
    location: "registry",
    target: value.replace(/^oci:\/\//, ""),
  };
}

function resolveLayoutTarget(target) {
  const digestSeparator = target.lastIndexOf("@sha256:");
  if (digestSeparator > 0) {
    return `${resolve(repoRoot, target.slice(0, digestSeparator))}${target.slice(digestSeparator)}`;
  }
  const separator = target.lastIndexOf(":");
  check(separator > 0, "local OCI layout reference must end in :TAG or @sha256:DIGEST");
  const layoutPath = target.slice(0, separator);
  const revision = target.slice(separator);
  return `${resolve(repoRoot, layoutPath)}${revision}`;
}

function orasArgs(source, beforeTarget) {
  return [
    ...beforeTarget,
    ...(source.location === "local-layout" ? ["--oci-layout"] : []),
    source.target,
  ];
}

function withOciPrefix(reference) {
  return reference.startsWith("oci://") ? reference : `oci://${reference}`;
}

function command(name, commandArgs) {
  const result = spawnSync(name, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
    env: { ...process.env, CONFIGHUB_AGENT: "1" },
  });
  if (result.status !== 0) {
    throw new Error(
      `${name} ${commandArgs.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function requireCommand(name) {
  const result = spawnSync(name, ["--help"], { encoding: "utf8" });
  check(result.error?.code !== "ENOENT", `${name} is required`);
}

function renderHuman(report) {
  const lines = [
    "OCI package inspection",
    "",
    `Reference: ${report.source.reference}`,
    `Digest: ${report.source.resolvedDigest}`,
    `Package: ${report.package.name}`,
  ];
  if (report.package.artifactType) {
    lines.push(`Artifact type: ${report.package.artifactType}`);
  }
  if (report.package.title) lines.push(`Title: ${report.package.title}`);
  lines.push(
    "",
    `Kubernetes objects: ${report.contents.kubernetesObjects}`,
    `Kinds: ${formatKinds(report.contents.kinds) || "none"}`,
    `Companion records: ${report.contents.companionRecords.length}`,
    `CRDs: ${report.lifecycle.customResourceDefinitions}`,
    `Helm hooks still present: ${report.lifecycle.helmHooks}`,
    `Jobs: ${report.lifecycle.jobs}`,
    `Secrets: ${report.lifecycle.secrets}`,
  );
  if (report.installer.configs.length) {
    lines.push(
      "",
      "Preset configs:",
      ...report.installer.configs.map(
        (item) =>
          `  ${item.default ? "*" : "-"} ${item.name}: ${item.description || "no description"}`,
      ),
    );
  }
  if (report.installer.externalRequirements.length) {
    lines.push(
      "",
      "Required before install:",
      ...report.installer.externalRequirements.map(
        (item) =>
          `  - ${item.kind} ${item.namespace ? `${item.namespace}/` : ""}${item.name}`,
      ),
    );
  }
  lines.push(
    "",
    "Checks:",
    ...report.checks.map(
      (item) => `  ${item.result.toUpperCase()}: ${item.name} - ${item.detail}`,
    ),
  );
  if (report.nextSteps.length) {
    lines.push("", "Next:", ...report.nextSteps.map((item) => `  - ${item}`));
  }
  lines.push("", `Result: ${report.status.result}`, "");
  return lines.join("\n");
}

function renderSummary(rows) {
  return `# Inspect existing OCI packages

Use one command to identify a supported OCI package, resolve its immutable digest,
and report what is actually inside it:

\`\`\`sh
npm run oci:inspect -- OCI_REFERENCE
\`\`\`

The command distinguishes source packages from literal Kubernetes configuration.
For a literal bundle it pulls the layers, parses the Kubernetes objects, counts CRDs,
hooks, Jobs, and Secrets, checks duplicate identities, and flags common unfinished
values. For a cub installer source package, add \`--render\` to select a preset config
and inspect the objects without applying them.

## Checked examples

| Example | Package kind | Objects | Result | Report |
| --- | --- | ---: | --- | --- |
${rows
  .map(
    ({ id, description, report }) =>
      `| ${description} | ${report.package.name} | ${report.contents.kubernetesObjects} | ${report.status.result} | [JSON](./reports/${id}.json) |`,
  )
  .join("\n")}

The AICR and Kubara examples are committed local OCI image layouts and are re-read by
\`npm run oci:inspect:verify\`. The NGINX report was produced from the public package
at its immutable digest; the network-free verifier checks it against the publication
receipt, package definition, and checked render. Use
\`npm run oci:inspect:verify-live\` to pull and render that public package again.

## Keep the package roles separate

| Package role | What the report can inspect |
| --- | --- |
| Helm chart source | Chart metadata and layers. Render it before expecting Kubernetes objects. |
| cub installer source package | Preset configs, package files, and requirements; use \`--render\` for the selected objects. |
| Literal Kubernetes configuration | Exact objects, object kinds, obvious lifecycle work, companion records, and basic checks. |
| Unknown OCI package | Manifest and layer metadata, plus any readable YAML or JSON objects found. |

This report is deliberately narrower than a deployment proof. It does not claim that
Kubernetes admitted the objects, a controller reconciled them, or the workload became
healthy.
`;
}

function parseArgs(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) {
    return { mode: "help" };
  }
  if (argv.length === 1 && argv[0] === "--generate") return { mode: "generate" };
  if (argv.length === 1 && argv[0] === "--verify") return { mode: "verify" };
  if (argv.length === 1 && argv[0] === "--verify-live") {
    return { mode: "verify-live" };
  }
  const result = {
    mode: "inspect",
    reference: "",
    json: false,
    render: false,
    base: "",
    namespace: "",
    workDir: "",
    reportPath: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") result.json = true;
    else if (arg === "--render") result.render = true;
    else if (["--base", "--namespace", "--work-dir", "--report"].includes(arg)) {
      const value = argv[index + 1];
      check(value && !value.startsWith("--"), `${arg} requires a value`);
      index += 1;
      if (arg === "--base") result.base = value;
      else if (arg === "--namespace") result.namespace = value;
      else if (arg === "--work-dir") result.workDir = value;
      else result.reportPath = value;
    } else if (arg.startsWith("--")) {
      throw new Error(`unknown option ${arg}`);
    } else {
      check(!result.reference, "provide one OCI reference");
      result.reference = arg;
    }
  }
  return result;
}

function printHelp() {
  console.log(`Inspect an OCI package without applying it.

Usage:
  npm run oci:inspect -- oci://REGISTRY/REPOSITORY:TAG
  npm run oci:inspect -- oci-layout:PATH:TAG
  npm run oci:inspect -- OCI_REFERENCE --json
  npm run oci:inspect -- INSTALLER_REFERENCE --render --base NAME [--namespace NAME]
  npm run oci:inspect -- OCI_REFERENCE --work-dir DIR --report report.json

Repository checks:
  npm run oci:inspect:generate
  npm run oci:inspect:verify
  npm run oci:inspect:verify-live`);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sameStrings(left, right) {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

function sameKindCounts(left, right) {
  return stableJson(left) === stableJson(right);
}

function formatKinds(rows) {
  return rows.map(({ kind, count }) => `${kind} ${count}`).join(", ");
}

function firstLine(value) {
  return String(value ?? "").split("\n")[0].trim();
}
