import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import {
  canonicalObjectMaps,
  check,
  command,
  difference,
  findingCounts,
  identityFor,
  imageTag,
  labelsMatch,
  listFiles,
  listYamlFiles,
  objectFilesFromDirs,
  parseDocs,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  runCub,
  sha256,
  sha256File,
  workloadPodSpec,
  workloadTemplateLabels,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "successor-track");
const corpusPath = join(outputRoot, "corpus.yaml");
const args = process.argv.slice(2);
const mode = args[0] ?? "--generate";
const chartArg = optionValue("--chart");
const kubeVersion = "1.30.0";
const proofTier = "successor-full";

if (mode === "--generate") {
  generate(chartArg);
} else if (mode === "--verify") {
  verifyAll({ checkPackageExecution: false });
} else if (mode === "--verify-packages") {
  verifyAll({ checkPackageExecution: true });
} else if (mode === "--self-test") {
  verifySelfTest();
} else {
  console.log(`Usage:
  node scripts/generate-successor-track.mjs --generate [--chart <publisher>/<chart>]
  node scripts/generate-successor-track.mjs --verify
  node scripts/generate-successor-track.mjs --verify-packages
  node scripts/generate-successor-track.mjs --self-test`);
}

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function generate(chartKey) {
  const corpus = loadCorpus();
  check(corpus.length >= 1, `successor-track corpus must contain at least 1 chart; found ${corpus.length}`);
  const selected = chartKey ? corpus.filter((chart) => chart.ref === chartKey) : corpus;
  check(selected.length > 0, `--chart ${chartKey} matches no successor-track corpus entry`);
  mkdirSync(outputRoot, { recursive: true });
  const rows = [];
  const helmVersion = command("helm", ["version", "--short"]).trim();

  for (const chart of selected) {
    console.log(`generating ${chart.rank}: ${chart.ref}@${chart.version}`);
    ensureRepo(chart);
    const paths = pathsFor(chart);
    rmSync(paths.proofRoot, { recursive: true, force: true });
    rmSync(paths.packageRoot, { recursive: true, force: true });
    mkdirSync(paths.proofRoot, { recursive: true });
    mkdirSync(paths.packageRoot, { recursive: true });

    const source = pullSource(chart);
    try {
      check(
        !chart.appVersion || String(source.appVersion) === String(chart.appVersion),
        `${chart.ref}@${chart.version} corpus appVersion ${chart.appVersion} does not match pulled chart appVersion ${source.appVersion}`,
      );
      const features = detectSourceFeatures(source.chartRoot, source.chartYaml, source.defaultValuesText);
      const render = renderDefault(chart);
      check(render.deterministic, `${chart.ref}@${chart.version} did not render deterministically`);
      const releaseObjects = normalizeRelease(render.first);
      const releaseDigest = sha256(releaseObjects);
      const docs = parseDocs(releaseObjects);
      const objects = parseObjects(releaseObjects);
      check(objects.length > 0, `${chart.ref}@${chart.version} rendered zero Kubernetes objects`);
      const objectFeatures = detectObjectFeatures(docs);
      const scanFindings = scanDocs(docs);
      const scanCounts = findingCounts(scanFindings);
      const policyBundleDigest = sha256(JSON.stringify(localScanPolicy()));

      writeSourceArtifacts(chart, source, features, objectFeatures, paths);
      writeDefaultVariantArtifacts(chart, source, paths);
      const packageResult = writePackageAndRunCub(chart, paths, releaseObjects, objects);
      writeRevisionArtifacts(chart, paths, {
        helmVersion,
        releaseObjects,
        releaseDigest,
        docs,
        objects,
        scanFindings,
        scanCounts,
        policyBundleDigest,
        packageResult,
      });
      writePlanAndDossier(chart, paths, features, objectFeatures, scanCounts, packageResult);
      writeChartReadme(chart, paths, objects, scanCounts, packageResult);

      rows.push(indexRow(chart, paths, features, objectFeatures, scanCounts, packageResult, releaseDigest));
    } finally {
      rmSync(source.tempRoot, { recursive: true, force: true });
    }
  }

  const allRows = mergedRows(corpus, rows);
  check(
    chartKey !== null || allRows.length === corpus.length,
    `proof index holds ${allRows.length} row(s) for ${corpus.length} corpus chart(s); generate the missing charts`,
  );
  writeCorpusLock(corpus);
  writeIndex(allRows);
  writeSummary(allRows);
  if (chartKey) {
    for (const chart of selected) verifyChart(chart, { checkPackageExecution: false });
    if (allRows.length === corpus.length) {
      verifyIndex(corpus);
    } else {
      console.log(`proof index holds ${allRows.length} of ${corpus.length} corpus rows; generate the remaining charts, then run --verify`);
    }
  } else {
    verifyAll({ checkPackageExecution: false });
  }
  console.log(`generated ${rows.length} successor-track proof chart(s) in recipes/ and packages/`);
}

function verifyAll({ checkPackageExecution }) {
  const corpus = loadCorpus();
  check(corpus.length >= 1, `successor-track corpus must contain at least 1 chart; found ${corpus.length}`);
  for (const chart of corpus) verifyChart(chart, { checkPackageExecution });
  verifyIndex(corpus);
  console.log(`verified ${corpus.length} successor-track proof chart(s)${checkPackageExecution ? " with cub package/setup execution" : ""}`);
}

function verifySelfTest() {
  const chart = loadCorpus()[0];
  const paths = pathsFor(chart);
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-successor-self-test-"));
  try {
    const tempProofRoot = join(tempRoot, "proof");
    cpSync(paths.proofRoot, tempProofRoot, { recursive: true });
    const releasePath = join(tempProofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
    write(releasePath, `${readFileSync(releasePath, "utf8")}\n# tampered\n`);
    let rejected = false;
    try {
      verifyChart(chart, {
        checkPackageExecution: false,
        proofRootOverride: tempProofRoot,
        packageRootOverride: paths.packageRoot,
      });
    } catch (error) {
      rejected = String(error.message).includes("inventory source digest mismatch");
    }
    if (!rejected) throw new Error("self-test did not reject rendered object tampering");
    console.log("self-test passed: successor-track rendered object tampering is rejected");
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function loadCorpus() {
  const data = readYaml(corpusPath);
  check(data.kind === "SuccessorTrackCorpus", "corpus.yaml must be SuccessorTrackCorpus");
  return data.spec.charts.map((raw) => {
    check(typeof raw.key === "string" && raw.key.split("/").length === 2, `corpus entry key must look like <publisher>/<chart>; got ${raw.key}`);
    check(typeof raw.publisher === "string" && raw.publisher.length > 0, `${raw.key} must declare publisher`);
    check(typeof raw.version === "string" && raw.version.length > 0, `${raw.key} must declare version`);
    const chart = {
      namespace: "default",
      releaseName: raw.key.split("/")[1],
      chart: raw.key.split("/")[1],
      repository: raw.publisher,
      ref: raw.key,
      ...raw,
    };
    check(
      Boolean(chart.ociRef) || (Boolean(chart.repository) && Boolean(chart.repositoryURL)),
      `${chart.ref} must declare ociRef or repository plus repositoryURL`,
    );
    check(
      chart.values === undefined || (typeof chart.values === "object" && chart.values !== null && !Array.isArray(chart.values)),
      `${chart.ref} values must be a map of determinism pins when present`,
    );
    for (const rule of chart.allowedSemanticDiffs ?? []) {
      check(
        typeof rule.identity === "string" && rule.identity.split("|").length === 4,
        `${chart.ref} allowedSemanticDiffs identity must be apiVersion|kind|namespace|name; got ${rule.identity}`,
      );
      check(
        rule.rule === "leading-blank-line-pruned-by-kustomize",
        `${chart.ref} allowedSemanticDiffs carries unknown rule ${rule.rule}`,
      );
      check(typeof rule.reason === "string" && rule.reason.length > 0, `${chart.ref} allowedSemanticDiffs entries must carry a reason`);
    }
    const licenses = chart.licenses;
    check(
      typeof licenses?.chart?.spdx === "string" && licenses.chart.spdx.length > 0
        && typeof licenses?.chart?.evidence === "string" && licenses.chart.evidence.length > 0,
      `${chart.ref} licenses.chart must carry spdx and evidence`,
    );
    check(Array.isArray(licenses?.images) && licenses.images.length > 0, `${chart.ref} licenses.images must list at least one image component`);
    for (const image of licenses.images) {
      check(
        typeof image.component === "string" && image.component.length > 0
          && typeof image.spdx === "string" && image.spdx.length > 0,
        `${chart.ref} licenses.images entries must carry component and spdx`,
      );
    }
    return chart;
  });
}

function pullRef(chart) {
  return chart.ociRef ?? chart.ref;
}

function ensureRepo(chart) {
  if (chart.ociRef) return;
  const result = spawnSync("helm", ["repo", "add", chart.repository, chart.repositoryURL], {
    encoding: "utf8",
    cwd: repoRoot,
  });
  if (result.status !== 0 && !`${result.stderr}${result.stdout}`.includes("already exists")) {
    throw new Error(result.stderr || result.stdout);
  }
}

function pullSource(chart) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-source-"));
  try {
    command("helm", ["pull", pullRef(chart), "--version", chart.version, "--destination", tempRoot]);
    const packagePath = listFiles(tempRoot).find((path) => path.endsWith(".tgz"));
    check(Boolean(packagePath), `helm pull did not produce a chart archive for ${chart.ref}`);
    command("tar", ["-xzf", packagePath, "-C", tempRoot]);
    const chartYamlPath = listFiles(tempRoot).find((path) => path.endsWith("/Chart.yaml"));
    check(Boolean(chartYamlPath), `chart archive for ${chart.ref} did not contain Chart.yaml`);
    const chartRoot = dirname(chartYamlPath);
    const valuesPath = join(chartRoot, "values.yaml");
    const chartYaml = readYaml(chartYamlPath);
    const chartLockPath = join(chartRoot, "Chart.lock");
    const chartLock = existsSync(chartLockPath) ? readYaml(chartLockPath) : null;
    const dependencies = chartLock?.dependencies ?? chartYaml.dependencies ?? [];
    return {
      chartRoot,
      chartYaml,
      appVersion: chartYaml.appVersion ?? "",
      packageSHA256: sha256File(packagePath),
      packageBytes: readFileSync(packagePath).length,
      defaultValuesSHA256: existsSync(valuesPath) ? sha256File(valuesPath) : null,
      defaultValuesText: existsSync(valuesPath) ? readFileSync(valuesPath, "utf8") : "",
      chartLockDigest: chartLock?.digest ?? null,
      chartLockProvenance: chartLock || dependencies.length === 0 ? null : {
        status: "source-derived-from-packaged-chart-yaml",
        packageSHA256: sha256File(packagePath),
        packageContainsChartLock: false,
        dependencySource: "Chart.yaml dependencies from the chart package recorded in source-lock.yaml",
      },
      dependencies,
      tempRoot,
    };
  } catch (error) {
    rmSync(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function renderDefault(chart) {
  const renderArgs = [
    "template",
    chart.releaseName,
    pullRef(chart),
    "--version",
    chart.version,
    "--namespace",
    chart.namespace,
    "--kube-version",
    kubeVersion,
    "--include-crds",
    "--skip-tests",
    "--no-hooks",
  ];
  const tempRoot = chart.values ? mkdtempSync(join(tmpdir(), "helm-expt-successor-values-")) : null;
  try {
    if (tempRoot) {
      const valuesPath = join(tempRoot, "determinism-pins.yaml");
      writeYaml(valuesPath, chart.values);
      renderArgs.push("-f", valuesPath);
    }
    const first = command("helm", renderArgs);
    const second = command("helm", renderArgs);
    return { first, second, deterministic: sha256(first) === sha256(second) };
  } finally {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  }
}

function normalizeRelease(text) {
  return `${text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n*$/, "")}\n`;
}

function writeSourceArtifacts(chart, source, features, objectFeatures, paths) {
  writeYaml(join(paths.proofRoot, "source-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SourceLock",
    metadata: { name: artifactName(chart) },
    spec: {
      sourceType: "HelmChart",
      repositoryName: chart.repository,
      repositoryURL: chart.ociRef ?? chart.repositoryURL,
      chart: chart.chart,
      ref: chart.ref,
      version: chart.version,
      appVersion: source.appVersion,
      packageSHA256: source.packageSHA256,
      packageBytes: source.packageBytes,
      capturedAt: "generated-by-successor-track-harness",
    },
  });
  writeYaml(join(paths.proofRoot, "dependency-lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DependencyLock",
    metadata: { name: artifactName(chart) },
    spec: {
      chart: chart.ref,
      version: chart.version,
      dependencies: source.dependencies.map((dependency) => ({
        name: dependency.name,
        version: dependency.version,
        repository: dependency.repository,
        condition: dependency.condition,
        tags: dependency.tags,
        alias: dependency.alias,
      })),
      ...(source.chartLockDigest ? { chartLockDigest: source.chartLockDigest } : {}),
      ...(source.chartLockProvenance ? { chartLockProvenance: source.chartLockProvenance } : {}),
    },
  });
  writeYaml(join(paths.proofRoot, "value-model.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ValueModel",
    metadata: { name: artifactName(chart) },
    spec: {
      checkedValues: [
        {
          path: "<chart defaults>",
          variant: "default",
          disposition: "default-render-captured",
          reason: "default chart values are bound by source-lock.yaml and effective-values.yaml; rendered objects are digest-bound in the revision receipts",
        },
        ...flattenValuePaths(chart.values ?? {}).map((path) => ({
          path,
          variant: "default",
          disposition: "determinism-pin",
          reason: "the chart default generates random material at render time; this value is pinned in effective-values.yaml so the rendered object set stays digest-bound",
        })),
      ],
      sourceFeatureSignals: {
        usesLookup: features.usesLookup,
        usesGeneratedFacts: features.usesGeneratedFacts,
        usesCapabilities: features.usesCapabilities,
        usesTpl: features.usesTpl,
        hasExtensionSlots: features.hasExtensionSlots,
      },
      unknownValues: "not-exhaustively-checked-in-successor-track-lane",
      deadValues: "not-exhaustively-checked-in-successor-track-lane",
      ignoredValues: "not-exhaustively-checked-in-successor-track-lane",
    },
  });
  writeYaml(join(paths.proofRoot, "control-points.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ControlPoints",
    metadata: { name: artifactName(chart) },
    spec: { points: controlPointsFor(features, objectFeatures, source.dependencies.length) },
  });
  writeYaml(join(paths.proofRoot, "recipe.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Recipe",
    metadata: {
      name: `${chart.publisher}-${chart.chart}`,
      version: chart.version,
      labels: proofLabels(chart),
    },
    spec: {
      chartRef: { sourceLock: "source-lock.yaml", dependencyLock: "dependency-lock.yaml" },
      importMode: "render-and-vendor",
      currentExecutableFixture: {
        installerPackage: relativeRepo(paths.packageRoot),
        setupCommand: [
          "cub",
          "installer",
          "setup",
          "--pull",
          relativeRepo(paths.packageRoot),
          "--non-interactive",
          "--namespace",
          chart.namespace,
        ],
      },
      // Preserve promoted (non-default) variants when regenerating the default proof — no clobber on re-gen.
      variants: (() => {
        const existingPath = join(paths.proofRoot, "recipe.yaml");
        const existing = existsSync(existingPath) ? (readYaml(existingPath).spec?.variants ?? []) : [];
        const extra = existing.filter((v) => !String(v).includes("variants/default/"));
        return ["variants/default/variant.yaml", ...extra];
      })(),
    },
  });
}

function writeDefaultVariantArtifacts(chart, source, paths) {
  writeYaml(join(paths.proofRoot, "effective-values.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "EffectiveValues",
    metadata: { name: `${artifactName(chart)}-default`, labels: proofLabels(chart, "default") },
    spec: {
      profile: chart.values ? "chart-defaults-with-determinism-pins" : "chart-defaults",
      defaultValuesSHA256: source.defaultValuesSHA256,
      mergedValuesCaptured: false,
      values: chart.values ?? {},
    },
  });
  writeYaml(join(paths.proofRoot, "variants", "default", "variant.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "Variant",
    metadata: { name: "default", labels: proofLabels(chart, "default") },
    spec: {
      recipe: "../../recipe.yaml",
      namespace: chart.namespace,
      releaseName: chart.releaseName,
      valuesProfile: "../../effective-values.yaml",
      capabilityProfile: { kubeVersion, apiVersions: [] },
      hookPolicy: "no-hooks",
    },
  });
}

function writePackageAndRunCub(chart, paths, releaseObjects, objects) {
  const operationsGuide = chart.operationsGuide
    ? relative(paths.packageRoot, join(repoRoot, chart.operationsGuide)).replaceAll("\\", "/")
    : "";
  writeYaml(join(paths.packageRoot, "installer.yaml"), {
    apiVersion: "installer.confighub.com/v1alpha1",
    kind: "Package",
    metadata: { name: `${chart.publisher}-${chart.chart}`, version: chart.version },
    spec: {
      bases: [
        {
          name: "default",
          path: "bases/default",
          default: true,
          description: `${chart.ref} default variant rendered from ${chart.ref}@${chart.version}`,
        },
      ],
    },
  });
  write(
    join(paths.packageRoot, "README.md"),
    `# ${chart.ref} ${chart.version} Installer Package

This package is generated from the successor-track full proof artifacts.

${operationsGuide ? `Start with the [plain-English operations guide](${operationsGuide}). It explains why this package exists, what setup work it replaces, how to run it, and what remains unproven.\n\n` : ""}\`\`\`sh
node scripts/generate-successor-track.mjs --generate
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
\`\`\`
`,
  );
  writeYaml(join(paths.packageRoot, "bases", "default", "kustomization.yaml"), {
    apiVersion: "kustomize.config.k8s.io/v1beta1",
    kind: "Kustomization",
    resources: ["upstream.yaml"],
  });
  write(join(paths.packageRoot, "bases", "default", "upstream.yaml"), releaseObjects);

  const sourceFiles = listFiles(paths.packageRoot).map((path) => ({
    path: relative(paths.packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  const packageCheck = packageAndSetupCheck(chart, paths, releaseObjects, objects.length);
  writeYaml(join(paths.proofRoot, "publication", "installer-package-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InstallerPackageReceipt",
    metadata: { name: artifactName(chart) },
    spec: {
      chart: { repository: chart.repository, name: chart.chart, version: chart.version },
      package: {
        path: relativeRepo(paths.packageRoot),
        name: `${chart.publisher}-${chart.chart}`,
        version: chart.version,
        sourceFiles,
      },
      deterministicBundle: {
        command: `cub installer package ${relativeRepo(paths.packageRoot)} -o <tmp>/${artifactName(chart)}.tgz`,
        sha256: packageCheck.bundleSHA256,
        byteIdenticalAcrossTwoLocalBundles: true,
      },
      setupChecks: [
        {
          variant: "default",
          base: "default",
          command: `cub installer setup --pull ${relativeRepo(paths.packageRoot)} --base default --work-dir <tmp> --non-interactive --namespace ${chart.namespace}`,
          helmReleaseObjectCount: objects.length,
          cubInstallObjectCountIncludingSupport: packageCheck.cubObjectCount,
          semanticObjectMatches: packageCheck.semanticObjectMatches,
          separatedSecretCount: packageCheck.separatedSecretCount,
          allowedCubOnlyObjects: packageCheck.extraInCub,
        },
      ],
    },
  });
  return packageCheck;
}

function writeRevisionArtifacts(chart, paths, context) {
  const revisionRoot = join(paths.proofRoot, "revisions", "default", "r001");
  const renderedRoot = join(revisionRoot, "rendered");
  const receiptsRoot = join(revisionRoot, "receipts");
  const secretCount = context.docs.filter((doc) => doc.kind === "Secret").length;
  write(join(renderedRoot, "release-objects.yaml"), context.releaseObjects);
  writeYaml(join(renderedRoot, "object-inventory.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderedObjectInventory",
    metadata: { name: `${artifactName(chart)}-default-r001`, labels: proofLabels(chart, "default") },
    spec: {
      source: "rendered/release-objects.yaml",
      sourceSHA256: context.releaseDigest,
      objectCount: context.objects.length,
      objects: context.objects,
    },
  });

  const recipeDigest = sha256File(join(paths.proofRoot, "recipe.yaml"));
  const variantDigest = sha256File(join(paths.proofRoot, "variants", "default", "variant.yaml"));
  const effectiveValuesDigest = sha256File(join(paths.proofRoot, "effective-values.yaml"));
  const rendererFingerprint = sha256(
    JSON.stringify({
      renderer: "helm",
      helmVersion: context.helmVersion,
      kubeVersion,
      flags: ["--include-crds", "--skip-tests", "--no-hooks"],
    }),
  );
  const revisionDigest = sha256(
    JSON.stringify({
      recipeDigest,
      variantDigest,
      effectiveValuesDigest,
      rendererFingerprint,
      releaseDigest: context.releaseDigest,
    }),
  );

  writeYaml(join(revisionRoot, "variant-revision.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantRevision",
    metadata: { name: "default-r001", labels: proofLabels(chart, "default") },
    spec: {
      variant: "../../../variants/default/variant.yaml",
      revision: "r001",
      digest: revisionDigest,
      digestInputs: {
        recipeSHA256: recipeDigest,
        variantSHA256: variantDigest,
        effectiveValuesSHA256: effectiveValuesDigest,
        rendererSHA256: rendererFingerprint,
        renderedObjectSetSHA256: context.releaseDigest,
      },
      rendered: {
        releaseObjects: "rendered/release-objects.yaml",
        objectInventory: "rendered/object-inventory.yaml",
        objectCount: context.objects.length,
      },
    },
  });
  writeYaml(join(receiptsRoot, "render-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "RenderReceipt",
    metadata: { name: `${artifactName(chart)}-default-r001`, labels: proofLabels(chart, "default") },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderer: {
        name: "helm",
        version: context.helmVersion,
        kubeVersion,
        flags: ["--include-crds", "--skip-tests", "--no-hooks"],
      },
      inputs: {
        sourceLockSHA256: sha256File(join(paths.proofRoot, "source-lock.yaml")),
        dependencyLockSHA256: sha256File(join(paths.proofRoot, "dependency-lock.yaml")),
        effectiveValuesSHA256: effectiveValuesDigest,
      },
      outputs: {
        renderedObjectSetSHA256: context.releaseDigest,
        renderedObjectInventorySHA256: sha256File(join(renderedRoot, "object-inventory.yaml")),
        deterministicAcrossTwoLocalRenders: true,
        objectCount: context.objects.length,
        renderedSecretCount: secretCount,
        secretCountSeparatedByCubInstall: context.packageResult.separatedSecretCount,
      },
    },
  });
  writeYaml(join(receiptsRoot, "helm-equivalence-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmEquivalenceReceipt",
    metadata: { name: `${artifactName(chart)}-default-r001`, labels: proofLabels(chart, "default") },
    spec: {
      variantRevision: "../variant-revision.yaml",
      regularHelm: { renderedSHA256: context.releaseDigest, objectCount: context.objects.length },
      cubInstall: {
        objectCountIncludingSecretsAndSupportObjects: context.packageResult.cubObjectCount,
        uploadedManifestFiles: context.packageResult.uploadedManifestFiles,
        separatedSecretFiles: context.packageResult.separatedSecretCount,
        semanticObjectMatches: context.packageResult.semanticObjectMatches,
      },
      semanticNormalizations: [
        "prune-null-fields",
        ...new Set((context.packageResult.allowedDiffClassifications ?? []).map((item) => item.classification)),
      ],
      classifications: [
        ...context.packageResult.extraInCub.map((identity) => ({
          identity,
          classification: "installer-support-object",
          disposition: "allowed",
        })),
        ...(context.packageResult.allowedDiffClassifications ?? []),
      ],
      result: "pass",
      evidenceCommand: "node scripts/generate-successor-track.mjs --verify-packages",
    },
  });
  writeYaml(join(receiptsRoot, "scan-receipt.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ScanReceipt",
    metadata: { name: `${artifactName(chart)}-default-r001`, labels: proofLabels(chart, "default") },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderedObjectSetSHA256: context.releaseDigest,
      result: context.scanFindings.length ? "warn" : "pass",
      scanner: { name: localScanPolicy().scanner, version: localScanPolicy().version },
      policyBundleDigest: context.policyBundleDigest,
      findingCounts: context.scanCounts,
      findings: context.scanFindings,
    },
  });
  writeYaml(join(receiptsRoot, "install-gate.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "InstallGate",
    metadata: { name: `${artifactName(chart)}-default-r001`, labels: proofLabels(chart, "default") },
    spec: {
      variantRevision: "../variant-revision.yaml",
      renderedObjectSetSHA256: context.releaseDigest,
      decision: context.scanFindings.length ? "warn" : "allow",
      allowedScopes: context.scanFindings.length ? ["local-test", "review"] : ["local-test", "review", "production-candidate"],
      blockedScopes: context.scanFindings.length ? ["production-without-review"] : [],
      reasons: [
        `regular Helm output matches cub installer setup for ${chart.ref}@${chart.version}`,
        `${context.objects.length} Helm objects are bound to renderedObjectSetSHA256`,
        context.scanFindings.length
          ? "rendered-object scan has review findings; see scan-receipt.yaml"
          : "rendered-object scan produced no findings in the local proof policy",
      ],
    },
  });
}

function writePlanAndDossier(chart, paths, features, objectFeatures, scanCounts, packageResult) {
  const releaseDigest = sha256File(join(paths.proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"));
  const objectCount = parseObjects(readFileSync(join(paths.proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"), "utf8")).length;
  writeYaml(join(paths.proofRoot, "helm-plan.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmPlan",
    metadata: { name: artifactName(chart), labels: proofLabels(chart) },
    spec: {
      readiness: {
        status: "usable-with-controls",
        chart: chart.ref,
        version: chart.version,
        variants: ["default"],
        helmObjectsByVariant: { default: objectCount },
        cubInstallObjectsByVariant: { default: packageResult.cubObjectCount },
        helmMatchByVariant: { default: packageResult.semanticObjectMatches },
        renderedObjectSetSHA256: releaseDigest,
        scanGate: scanCounts.high > 0 || scanCounts.medium > 0 ? "warn-review-before-production" : "allow",
        nextAction: scanCounts.high > 0 || scanCounts.medium > 0
          ? "review scan findings, then promote the digest-bound variant"
          : "promote the digest-bound variant",
      },
      receipts: [
        "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
        "revisions/default/r001/receipts/render-receipt.yaml",
        "revisions/default/r001/receipts/scan-receipt.yaml",
        "revisions/default/r001/receipts/install-gate.yaml",
        "publication/installer-package-receipt.yaml",
      ],
    },
  });
  writeYaml(join(paths.proofRoot, "chart-dossier.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ChartDossier",
    metadata: { name: artifactName(chart), labels: proofLabels(chart) },
    spec: {
      chart: chart.ref,
      version: chart.version,
      ...(chart.category ? { category: chart.category } : {}),
      licenses: chart.licenses,
      maintainedNotes: dossierNotes(chart, features, objectFeatures),
      knownControlPoints: controlPointsFor(features, objectFeatures, 0).map((point) => point.category),
      proofFocus: chart.proofFocus,
      ...(chart.operationsGuide ? { operationsGuide: chart.operationsGuide } : {}),
    },
  });
}

function writeChartReadme(chart, paths, objects, scanCounts, packageResult) {
  const operationsGuide = chart.operationsGuide
    ? relative(paths.proofRoot, join(repoRoot, chart.operationsGuide)).replaceAll("\\", "/")
    : "";
  write(
    join(paths.proofRoot, "README.md"),
    `# ${chart.ref} ${chart.version} Proof

This chart belongs to the successor track. It is a full proof of a maintained
successor chart for an affected catalog component.

${operationsGuide ? `Start with the [plain-English operations guide](${operationsGuide}). It explains the chart-specific problem, the package's chosen route, how to repeat it, and the current limits.\n\n` : ""}Variant:

- \`default\`: chart defaults under Kubernetes ${kubeVersion}; ${objects.length} Helm objects, ${packageResult.cubObjectCount} \`cub installer\` objects including allowed support objects.
${chart.values ? `\nThe chart default generates random credential material at render time. The default variant pins ${flattenValuePaths(chart.values).join(", ")} to fixed demo values recorded in effective-values.yaml, so the rendered object set stays digest-bound. These demo values are identical on every install and readable from the manifest; replace them before any real use.\n` : ""}

What this proves:

- regular Helm output is preserved by \`cub installer setup\`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with \`cub installer package\`;
- the chart and image licenses are declared in chart-dossier.yaml with their evidence.

Current gate:

\`\`\`text
high: ${scanCounts.high}
medium: ${scanCounts.medium}
low: ${scanCounts.low}
semantic match: ${packageResult.semanticObjectMatches}
\`\`\`

Useful commands:

\`\`\`sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
\`\`\`
`,
  );
}

function packageAndSetupCheck(chart, paths, releaseObjects, expectedObjectCount) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-successor-package-"));
  try {
    const firstPackage = join(tempRoot, `${artifactName(chart)}-a.tgz`);
    const secondPackage = join(tempRoot, `${artifactName(chart)}-b.tgz`);
    runCub(["installer", "package", paths.packageRoot, "-o", firstPackage]);
    runCub(["installer", "package", paths.packageRoot, "-o", secondPackage]);
    const firstSHA = sha256File(firstPackage);
    const secondSHA = sha256File(secondPackage);
    check(firstSHA === secondSHA, `${chart.ref} package SHA changed across two local bundles`);
    check(readFileSync(firstPackage).equals(readFileSync(secondPackage)), `${chart.ref} package bytes changed across two local bundles`);
    const setup = runSetupAndCompare(chart, paths, tempRoot, releaseObjects, expectedObjectCount);
    return { bundleSHA256: firstSHA, ...setup };
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runSetupAndCompare(chart, paths, tempRoot, releaseObjects, expectedObjectCount) {
  const workDir = join(tempRoot, "work");
  runCub([
    "installer",
    "setup",
    "--pull",
    paths.packageRoot,
    "--base",
    "default",
    "--work-dir",
    workDir,
    "--non-interactive",
    "--namespace",
    chart.namespace,
  ]);
  const cubFiles = objectFilesFromDirs([join(workDir, "out", "manifests"), join(workDir, "out", "secrets")]);
  const cubYaml = cubFiles.map((file) => file.yaml).join("\n---\n");
  const semantic = canonicalObjectMaps(releaseObjects, cubYaml);
  const helmObjects = new Set(Object.keys(semantic.helm));
  const cubObjects = new Set(Object.keys(semantic.cub));
  check(helmObjects.size === expectedObjectCount, `${chart.ref} Helm object count mismatch`);
  const missingFromCub = difference(helmObjects, cubObjects);
  check(missingFromCub.length === 0, `${chart.ref} cub output missing Helm object(s): ${missingFromCub.join(", ")}`);
  const extraInCub = difference(cubObjects, helmObjects);
  const allowedExtras = new Set([`v1|Namespace||${chart.namespace}`]);
  const unexpectedExtras = extraInCub.filter((identity) => !allowedExtras.has(identity));
  check(unexpectedExtras.length === 0, `${chart.ref} unexpected cub-only objects: ${unexpectedExtras.join(", ")}`);
  const semanticDiffs = [];
  const allowedDiffClassifications = [];
  for (const key of helmObjects) {
    if (semantic.helm[key] === semantic.cub[key]) continue;
    const rule = (chart.allowedSemanticDiffs ?? []).find((item) => item.identity === key);
    if (rule?.rule === "leading-blank-line-pruned-by-kustomize") {
      const pruned = leadingBlankLinePruneMatches(semantic.helm[key], semantic.cub[key]);
      if (pruned.allowed) {
        allowedDiffClassifications.push({
          identity: key,
          classification: rule.rule,
          disposition: "allowed",
          paths: pruned.paths,
          reason: rule.reason,
        });
        continue;
      }
    }
    semanticDiffs.push(key);
  }
  check(semanticDiffs.length === 0, `${chart.ref} semantic diffs: ${semanticDiffs.join(", ")}`);
  return {
    cubObjectCount: cubObjects.size,
    uploadedManifestFiles: cubFiles.length,
    separatedSecretCount: listYamlFiles(join(workDir, "out", "secrets")).length,
    semanticObjectMatches: `${helmObjects.size}/${helmObjects.size}`,
    extraInCub,
    allowedDiffClassifications,
  };
}

// The installer's Kustomize round trip prunes a blank first line from block
// scalars. The only accepted difference for a declared object is the removal
// of exactly one leading newline from a string leaf; every other leaf and the
// whole structure must be strictly equal. The matched paths are recorded in
// the helm-equivalence receipt so the normalization is never silent.
function leadingBlankLinePruneMatches(helmJson, cubJson) {
  const paths = [];
  const matches = (left, right, path) => {
    if (typeof left === "string" && typeof right === "string") {
      if (left === right) return true;
      if (left.startsWith("\n") && left.slice(1) === right) {
        paths.push(path);
        return true;
      }
      return false;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      return left.every((item, index) => matches(item, right[index], `${path}[${index}]`));
    }
    if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
      const leftKeys = Object.keys(left).sort();
      const rightKeys = Object.keys(right).sort();
      if (JSON.stringify(leftKeys) !== JSON.stringify(rightKeys)) return false;
      return leftKeys.every((key) => matches(left[key], right[key], path ? `${path}.${key}` : key));
    }
    return left === right;
  };
  const allowed = matches(JSON.parse(helmJson), JSON.parse(cubJson), "");
  return { allowed: allowed && paths.length > 0, paths };
}

function verifyChart(chart, options) {
  const paths = pathsFor(chart, options);
  const required = [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "effective-values.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "publication/installer-package-receipt.yaml",
  ];
  for (const file of required) check(existsSync(join(paths.proofRoot, file)), `${chart.ref} missing ${file}`);
  check(existsSync(join(paths.packageRoot, "installer.yaml")), `${chart.ref} missing installer package`);

  const sourceLock = readYaml(join(paths.proofRoot, "source-lock.yaml"));
  const recipe = readYaml(join(paths.proofRoot, "recipe.yaml"));
  const dossier = readYaml(join(paths.proofRoot, "chart-dossier.yaml"));
  const inventory = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "rendered", "object-inventory.yaml"));
  const revision = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "variant-revision.yaml"));
  const renderReceipt = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "receipts", "render-receipt.yaml"));
  const equivalence = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "receipts", "helm-equivalence-receipt.yaml"));
  const scan = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "receipts", "scan-receipt.yaml"));
  const gate = readYaml(join(paths.proofRoot, "revisions", "default", "r001", "receipts", "install-gate.yaml"));
  const packageReceipt = readYaml(join(paths.proofRoot, "publication", "installer-package-receipt.yaml"));
  const releasePath = join(paths.proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml");
  const releaseDigest = sha256File(releasePath);
  const objects = parseObjects(readFileSync(releasePath, "utf8"));

  check(sourceLock.kind === "SourceLock", `${chart.ref} source lock kind mismatch`);
  check(sourceLock.spec.ref === chart.ref, `${chart.ref} source lock ref mismatch`);
  check(sourceLock.spec.version === chart.version, `${chart.ref} source lock version mismatch`);
  check(
    sourceLock.spec.repositoryURL === (chart.ociRef ?? chart.repositoryURL),
    `${chart.ref} source lock repositoryURL must record the corpus ociRef or repositoryURL`,
  );
  check(recipe.kind === "Recipe", `${chart.ref} recipe kind mismatch`);
  check(
    (recipe.spec.variants?.length ?? 0) >= 1 && recipe.spec.variants.some((v) => String(v).includes("variants/default/")),
    `${chart.ref} recipe must include the default variant (promoted charts may add more)`,
  );
  check(
    JSON.stringify(dossier.spec?.licenses) === JSON.stringify(chart.licenses),
    `${chart.ref} chart-dossier licenses must match the corpus licenses block verbatim`,
  );
  const effectiveValues = readYaml(join(paths.proofRoot, "effective-values.yaml"));
  check(
    JSON.stringify(effectiveValues.spec?.values) === JSON.stringify(chart.values ?? {}),
    `${chart.ref} effective-values must record the corpus determinism pins verbatim`,
  );
  check(inventory.spec.sourceSHA256 === releaseDigest, `${chart.ref} inventory source digest mismatch`);
  check(inventory.spec.objectCount === objects.length, `${chart.ref} inventory object count mismatch`);
  check(revision.spec.digestInputs.renderedObjectSetSHA256 === releaseDigest, `${chart.ref} revision rendered digest mismatch`);
  check(renderReceipt.spec.outputs.renderedObjectSetSHA256 === releaseDigest, `${chart.ref} render receipt digest mismatch`);
  check(renderReceipt.spec.outputs.deterministicAcrossTwoLocalRenders === true, `${chart.ref} render receipt determinism mismatch`);
  check(equivalence.spec.regularHelm.renderedSHA256 === releaseDigest, `${chart.ref} equivalence digest mismatch`);
  check(equivalence.spec.result === "pass", `${chart.ref} equivalence must pass`);
  check(scan.spec.renderedObjectSetSHA256 === releaseDigest, `${chart.ref} scan digest mismatch`);
  check(gate.spec.renderedObjectSetSHA256 === releaseDigest, `${chart.ref} install gate digest mismatch`);
  check(packageReceipt.kind === "InstallerPackageReceipt", `${chart.ref} package receipt kind mismatch`);
  check(packageReceipt.spec.package.path === relativeRepo(paths.packageRoot), `${chart.ref} package path mismatch`);

  const sourceFiles = packageReceipt.spec.package.sourceFiles ?? [];
  const actualFiles = listFiles(paths.packageRoot).map((path) => ({
    path: relative(paths.packageRoot, path),
    sha256: sha256File(path),
    bytes: readFileSync(path).length,
  }));
  check(sourceFiles.length === actualFiles.length, `${chart.ref} package source file count mismatch`);
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  for (const file of sourceFiles) {
    const actual = actualByPath.get(file.path);
    check(Boolean(actual), `${chart.ref} package receipt references missing file ${file.path}`);
    check(actual.sha256 === file.sha256, `${chart.ref} package SHA mismatch for ${file.path}`);
    check(actual.bytes === file.bytes, `${chart.ref} package byte count mismatch for ${file.path}`);
  }

  const upstream = readFileSync(join(paths.packageRoot, "bases", "default", "upstream.yaml"), "utf8");
  check(upstream === readFileSync(releasePath, "utf8"), `${chart.ref} package upstream must match rendered release objects`);
  if (options.checkPackageExecution) {
    const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-successor-verify-package-"));
    try {
      const firstPackage = join(tempRoot, `${artifactName(chart)}-a.tgz`);
      const secondPackage = join(tempRoot, `${artifactName(chart)}-b.tgz`);
      runCub(["installer", "package", paths.packageRoot, "-o", firstPackage]);
      runCub(["installer", "package", paths.packageRoot, "-o", secondPackage]);
      check(sha256File(firstPackage) === sha256File(secondPackage), `${chart.ref} package SHA changed across verify bundles`);
      check(sha256File(firstPackage) === packageReceipt.spec.deterministicBundle.sha256, `${chart.ref} package receipt bundle SHA mismatch`);
      const setup = runSetupAndCompare(chart, paths, tempRoot, readFileSync(releasePath, "utf8"), objects.length);
      const receiptSetup = packageReceipt.spec.setupChecks?.[0];
      check(setup.semanticObjectMatches === receiptSetup.semanticObjectMatches, `${chart.ref} setup semantic match mismatch`);
      check(setup.cubObjectCount === receiptSetup.cubInstallObjectCountIncludingSupport, `${chart.ref} setup object count mismatch`);
      check(setup.separatedSecretCount === receiptSetup.separatedSecretCount, `${chart.ref} setup secret count mismatch`);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function verifyIndex(corpus) {
  const lock = readYaml(join(outputRoot, "corpus.lock.yaml"));
  check(lock.kind === "SuccessorTrackCorpusLock", "missing or invalid corpus lock");
  check(lock.spec.chartCount === corpus.length, "corpus lock chart count mismatch");
  const indexPath = join(outputRoot, "proof-index.csv");
  check(existsSync(indexPath), "missing successor-track proof index");
  const indexText = readFileSync(indexPath, "utf8");
  for (const chart of corpus) {
    check(indexText.includes(`${chart.ref}@${chart.version}`), `proof index missing ${chart.ref}@${chart.version}`);
  }
}

function writeCorpusLock(corpus) {
  writeYaml(join(outputRoot, "corpus.lock.yaml"), {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SuccessorTrackCorpusLock",
    metadata: { name: "successor-track" },
    spec: {
      chartCount: corpus.length,
      kubeVersion,
      packageManager: "helm",
      charts: corpus.map((chart) => ({
        rank: chart.rank,
        ref: chart.ref,
        version: chart.version,
        recipe: relativeRepo(pathsFor(chart).proofRoot),
        package: relativeRepo(pathsFor(chart).packageRoot),
      })),
    },
  });
}

function mergedRows(corpus, rows) {
  const corpusKeys = new Set(corpus.map((chart) => `${chart.ref}@${chart.version}`));
  const generatedKeys = new Set(rows.map((row) => row.chart));
  const kept = readIndexRows().filter((row) => corpusKeys.has(row.chart) && !generatedKeys.has(row.chart));
  return [...kept, ...rows].sort((left, right) => Number(left.rank) - Number(right.rank));
}

function readIndexRows() {
  const indexPath = join(outputRoot, "proof-index.csv");
  if (!existsSync(indexPath)) return [];
  return parseCsv(readFileSync(indexPath, "utf8")).map((row) => ({
    ...row,
    rank: Number(row.rank),
    helm_objects: Number(row.helm_objects),
    cub_objects: Number(row.cub_objects),
    scan_high: Number(row.scan_high),
    scan_medium: Number(row.scan_medium),
    scan_low: Number(row.scan_low),
    uses_lookup: row.uses_lookup === "true",
    uses_generated_facts: row.uses_generated_facts === "true",
    uses_capabilities: row.uses_capabilities === "true",
    uses_tpl: row.uses_tpl === "true",
    has_hooks: row.has_hooks === "true",
    crds: Number(row.crds),
    cluster_rbac: row.cluster_rbac === "true",
    webhooks: row.webhooks === "true",
  }));
}

function writeIndex(rows) {
  const headers = [
    "rank",
    "chart",
    "version",
    "recipe_path",
    "package_path",
    "helm_objects",
    "cub_objects",
    "semantic_match",
    "rendered_sha256",
    "scan_high",
    "scan_medium",
    "scan_low",
    "uses_lookup",
    "uses_generated_facts",
    "uses_capabilities",
    "uses_tpl",
    "has_hooks",
    "crds",
    "cluster_rbac",
    "webhooks",
    "proof_focus",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  write(join(outputRoot, "proof-index.csv"), `${lines.join("\n")}\n`);
}

function writeSummary(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.helmObjects += row.helm_objects;
      acc.crds += row.crds;
      acc.clusterRbac += row.cluster_rbac ? 1 : 0;
      acc.webhooks += row.webhooks ? 1 : 0;
      acc.hooks += row.has_hooks ? 1 : 0;
      acc.capabilities += row.uses_capabilities ? 1 : 0;
      return acc;
    },
    { helmObjects: 0, crds: 0, clusterRbac: 0, webhooks: 0, hooks: 0, capabilities: 0 },
  );
  write(
    join(outputRoot, "summary.md"),
    `# Successor Track Full Proofs

This corpus holds full proofs for maintained successor charts. Each entry
replaces an affected catalog component and declares its chart and image
licenses in the chart dossier.

Each row has:

- \`recipes/<publisher>/<chart>/<version>/\` with Recipe, HelmPlan, ChartDossier, control points, Variant, VariantRevision, rendered objects, and receipts.
- \`packages/<publisher>/<chart>/<version>/\` with a \`cub installer\` package.
- A Helm equivalence receipt proving regular Helm output matches \`cub installer setup\`, aside from allowed installer support objects.
- A render receipt, scan receipt, install gate, and installer package receipt.
- A licenses block in chart-dossier.yaml carrying the chart SPDX id, its evidence, and the image component licenses.

Selection rule:

\`\`\`text
regular helm template output
  == cub installer setup output
  plus the allowed Namespace support object
\`\`\`

Charts that render with Helm but change semantics through the installer/Kustomize
round trip are excluded from this passing lane until the difference is classified
and mitigated.

Summary:

\`\`\`text
charts: ${rows.length}
rendered Helm objects: ${totals.helmObjects}
CRDs: ${totals.crds}
charts with cluster RBAC: ${totals.clusterRbac}
charts with webhooks: ${totals.webhooks}
charts with source hooks: ${totals.hooks}
charts with capabilities logic: ${totals.capabilities}
\`\`\`

Verification:

\`\`\`sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
\`\`\`
`,
  );
}

function indexRow(chart, paths, features, objectFeatures, scanCounts, packageResult, releaseDigest) {
  const objectCount = parseObjects(readFileSync(join(paths.proofRoot, "revisions", "default", "r001", "rendered", "release-objects.yaml"), "utf8")).length;
  return {
    rank: chart.rank,
    chart: `${chart.ref}@${chart.version}`,
    version: chart.version,
    recipe_path: relativeRepo(paths.proofRoot),
    package_path: relativeRepo(paths.packageRoot),
    helm_objects: objectCount,
    cub_objects: packageResult.cubObjectCount,
    semantic_match: packageResult.semanticObjectMatches,
    rendered_sha256: releaseDigest,
    scan_high: scanCounts.high,
    scan_medium: scanCounts.medium,
    scan_low: scanCounts.low,
    uses_lookup: features.usesLookup,
    uses_generated_facts: features.usesGeneratedFacts,
    uses_capabilities: features.usesCapabilities,
    uses_tpl: features.usesTpl,
    has_hooks: features.hasHooks,
    crds: objectFeatures.crdCount,
    cluster_rbac: objectFeatures.hasClusterRBAC,
    webhooks: objectFeatures.hasWebhooks,
    proof_focus: chart.proofFocus,
  };
}

function detectSourceFeatures(chartRoot, chartYaml, valuesText) {
  const templateFiles = listFiles(chartRoot).filter((file) => /\.(yaml|yml|tpl|txt)$/.test(file));
  const sourceText = templateFiles.map((file) => readFileSync(file, "utf8")).join("\n");
  const crdFiles = listFiles(join(chartRoot, "crds")).filter((file) => /\.(yaml|yml)$/.test(file));
  return {
    usesLookup: /\blookup\s+/.test(sourceText),
    usesGeneratedFacts: /\b(randAlpha|randAlphaNum|randAscii|randNumeric|genCA|genSelfSignedCert|genSignedCert|now)\b/.test(sourceText),
    usesCapabilities: /\.Capabilities\b/.test(sourceText),
    usesTpl: /\btpl\s+/.test(sourceText),
    hasHooks: /helm\.sh\/hook/.test(sourceText),
    hasExtensionSlots: /(extraManifests|extraDeploy|extraObjects|extraEnv|extraVolumes|extraVolumeMounts|raw|additionalManifest)/i.test(valuesText),
    crdSourceCount: crdFiles.length,
    dependencyCount: (chartYaml.dependencies ?? []).length,
    hasValuesSchema: existsSync(join(chartRoot, "values.schema.json")),
  };
}

function detectObjectFeatures(docs) {
  return {
    crdCount: docs.filter((doc) => doc.kind === "CustomResourceDefinition").length,
    hasClusterRBAC: docs.some((doc) => ["ClusterRole", "ClusterRoleBinding"].includes(doc.kind)),
    hasWebhooks: docs.some((doc) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(doc.kind)),
    hasAPIService: docs.some((doc) => doc.kind === "APIService"),
    hasStateful: docs.some((doc) => doc.kind === "StatefulSet"),
    hasPVC: docs.some((doc) => doc.kind === "PersistentVolumeClaim" || doc.spec?.volumeClaimTemplates),
    hasSecrets: docs.some((doc) => doc.kind === "Secret"),
    hasDaemonSet: docs.some((doc) => doc.kind === "DaemonSet"),
    hasJobs: docs.some((doc) => ["Job", "CronJob"].includes(doc.kind)),
  };
}

function controlPointsFor(features, objectFeatures, dependencyCount) {
  const points = [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", dependencyCount },
    { category: "capability-profile", status: "handled", kubeVersion },
    { category: "variant-revision", status: "handled", evidence: "revisions/default/r001/variant-revision.yaml" },
    { category: "rendered-manifest-scan", status: "handled", evidence: "revisions/default/r001/receipts/scan-receipt.yaml" },
    { category: "helm-equivalence", status: "handled", evidence: "revisions/default/r001/receipts/helm-equivalence-receipt.yaml" },
  ];
  if (features.usesLookup) points.push({ category: "target-facts", status: "source-signal-recorded", note: "default proof render was deterministic under pinned inputs; future variants must bind lookup-driven facts explicitly" });
  if (features.usesGeneratedFacts) points.push({ category: "generated-facts", status: "source-signal-recorded", note: "default proof render was deterministic; future generated material must be captured before approval" });
  if (features.usesTpl) points.push({ category: "tpl-extension-slots", status: "source-signal-recorded", note: "tpl use is recorded for review and variant analysis" });
  if (features.hasHooks) points.push({ category: "lifecycle-policy", status: "handled-by-no-hooks-proof", policy: "no-hooks", note: "hook templates are excluded from the approved rendered object revision" });
  if (features.hasExtensionSlots) points.push({ category: "extension-slots", status: "source-signal-recorded", note: "raw/extra manifest knobs require explicit variant ownership before promotion" });
  if (objectFeatures.crdCount) points.push({ category: "crds", status: "review-required", count: objectFeatures.crdCount });
  if (objectFeatures.hasClusterRBAC) points.push({ category: "cluster-rbac", status: "scan-and-review" });
  if (objectFeatures.hasWebhooks) points.push({ category: "webhooks", status: "scan-and-observe" });
  if (objectFeatures.hasAPIService) points.push({ category: "apiservice", status: "observe-after-apply" });
  if (objectFeatures.hasPVC || objectFeatures.hasStateful) points.push({ category: "stateful-storage", status: "review-before-production" });
  if (objectFeatures.hasSecrets) points.push({ category: "secret-material", status: "review-secret-handling" });
  return points;
}

function scanDocs(docs) {
  const findings = [];
  const serviceAccounts = new Set(
    docs.filter((doc) => doc.kind === "ServiceAccount").map((doc) => `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`),
  );
  const workloads = docs.filter((doc) => workloadPodSpec(doc));
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      const tag = imageTag(container.image ?? "");
      if (!tag || tag === "latest") {
        findings.push({
          id: `mutable-image-tag:${object}:${container.name ?? "container"}`,
          rule: "mutable-image-tag",
          severity: "high",
          object,
          message: `container ${container.name ?? "container"} uses mutable image ${container.image ?? ""}`,
        });
      }
    }
    const serviceAccountName = podSpec.serviceAccountName;
    const namespace = doc.metadata?.namespace ?? "";
    if (serviceAccountName && !serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
      findings.push({
        id: `workload-service-account-exists:${object}`,
        rule: "workload-service-account-exists",
        severity: "high",
        object,
        message: `workload references missing ServiceAccount ${namespace}/${serviceAccountName}`,
      });
    }
    if (podSpec.hostNetwork || podSpec.hostPID || podSpec.hostIPC) {
      findings.push({
        id: `host-namespace-review:${object}`,
        rule: "host-namespace-review",
        severity: "medium",
        object,
        message: "workload uses host namespace settings and needs production review",
      });
    }
    for (const container of containers) {
      if (container.securityContext?.privileged === true) {
        findings.push({
          id: `privileged-container-review:${object}:${container.name ?? "container"}`,
          rule: "privileged-container-review",
          severity: "medium",
          object,
          message: `container ${container.name ?? "container"} is privileged`,
        });
      }
    }
  }
  for (const doc of docs.filter((item) => item.kind === "Service")) {
    const selector = doc.spec?.selector ?? {};
    if (!Object.keys(selector).length) continue;
    const match = workloads.some((workload) => labelsMatch(selector, workloadTemplateLabels(workload)));
    if (!match) {
      findings.push({
        id: `service-selector-has-workload-match:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "high",
        object: identityFor(doc),
        message: "Service selector matches no rendered workload pod template",
      });
    }
  }
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Cluster-scoped RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
    findings.push({
      id: `crd-lifecycle-review:${identityFor(doc)}`,
      rule: "crd-lifecycle-review",
      severity: "medium",
      object: identityFor(doc),
      message: "CRD lifecycle and upgrade behavior require review",
    });
  }
  for (const doc of docs.filter((item) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(item.kind))) {
    findings.push({
      id: `webhook-readiness-review:${identityFor(doc)}`,
      rule: "webhook-readiness-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Webhook certificate and readiness behavior require observation after apply",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "APIService")) {
    findings.push({
      id: `apiservice-requires-observation:${identityFor(doc)}`,
      rule: "apiservice-requires-observation",
      severity: "medium",
      object: identityFor(doc),
      message: "APIService availability must be observed after apply",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Secret")) {
    findings.push({
      id: `rendered-secret-review:${identityFor(doc)}`,
      rule: "rendered-secret-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Rendered Secret material or references require review before production promotion",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return dedupeFindings(findings);
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

function localScanPolicy() {
  return {
    scanner: "helm-expt-local-rendered-object-scan",
    version: "0.2.0",
    rules: [
      { id: "mutable-image-tag", severity: "high" },
      { id: "service-selector-has-workload-match", severity: "high" },
      { id: "workload-service-account-exists", severity: "high" },
      { id: "cluster-rbac-review", severity: "medium" },
      { id: "crd-lifecycle-review", severity: "medium" },
      { id: "webhook-readiness-review", severity: "medium" },
      { id: "apiservice-requires-observation", severity: "medium" },
      { id: "rendered-secret-review", severity: "medium" },
      { id: "privileged-container-review", severity: "medium" },
      { id: "host-namespace-review", severity: "medium" },
    ],
  };
}

function dossierNotes(chart, features, objectFeatures) {
  const notes = [
    `${chart.ref}@${chart.version} renders deterministically under Kubernetes ${kubeVersion} with hooks and tests excluded.`,
    "The default variant is intended as a proof baseline; production promotion still follows scan/gate review.",
  ];
  if (chart.values) notes.push(`The default variant pins ${flattenValuePaths(chart.values).join(", ")} to fixed demo values recorded in effective-values.yaml because the chart default generates random material at render time; replace these before any real use.`);
  for (const rule of chart.allowedSemanticDiffs ?? []) {
    notes.push(`Rendered ${rule.identity} matches through the installer round trip under the recorded ${rule.rule} normalization; the helm-equivalence receipt lists the exact paths.`);
  }
  if (features.hasHooks) notes.push("Chart source contains Helm hooks; the proof revision uses no-hooks so hook lifecycle must be handled separately before production.");
  if (features.usesLookup) notes.push("Chart source contains lookup; future variants using lookup paths must bind target facts in the recipe.");
  if (features.usesGeneratedFacts) notes.push("Chart source contains generated/random/time helpers; generated values must be captured before approval if activated by a variant.");
  if (features.usesTpl) notes.push("Chart source contains tpl; raw templating extension slots need explicit ownership and review.");
  if (objectFeatures.crdCount) notes.push(`Rendered output includes ${objectFeatures.crdCount} CRDs; CRD lifecycle must be reviewed before upgrade/promotion.`);
  if (objectFeatures.hasClusterRBAC) notes.push("Rendered output includes cluster-scoped RBAC; production promotion needs RBAC review.");
  if (objectFeatures.hasWebhooks) notes.push("Rendered output includes admission webhooks; live readiness/certificate observations are required after apply.");
  if (objectFeatures.hasStateful || objectFeatures.hasPVC) notes.push("Rendered output has stateful/storage behavior; rollback and upgrade plans must be explicit.");
  return notes;
}

function pathsFor(chart, options = {}) {
  return {
    proofRoot: options.proofRootOverride ?? join(repoRoot, "recipes", chart.publisher, chart.chart, chart.version),
    packageRoot: options.packageRootOverride ?? join(repoRoot, "packages", chart.publisher, chart.chart, chart.version),
  };
}

function artifactName(chart) {
  return `${chart.publisher}-${chart.chart}-${chart.version}`.replaceAll("/", "-").replaceAll(".", "-");
}

function proofLabels(chart, variant) {
  const labels = {
    "confighub.io/chart-ref": chart.ref,
    "confighub.io/chart-version": chart.version,
    "confighub.io/proof-tier": proofTier,
  };
  if (variant) labels["confighub.io/variant"] = variant;
  return labels;
}

function flattenValuePaths(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, item]) => flattenValuePaths(item, prefix ? `${prefix}.${key}` : key));
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.some((fieldValue) => fieldValue !== ""));
  return body.map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] ?? ""])));
}
