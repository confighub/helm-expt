import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import {
  check,
  cubEnv,
  listYamlFiles,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";
import { CONFIGHUB_PROMOTION_PROOF_CHARTS, TOP20_CONFIGHUB_PROOF_CHARTS } from "./lib/top20-confighub-proof.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const cleanupSpaces = args.includes("--cleanup-spaces");
const latestCandidates = args.includes("--latest-candidates");
const promotionCandidates = args.includes("--promotion-candidates");
const variantPromotionProof = args.includes("--variant-promotion-proof");
const chartsArg = optionValue("--charts");
const baseOverride = optionValue("--base");
const smoke = args.includes("--smoke");
const verifyLegacy = args.includes("--verify");
const verifyCurrent = args.includes("--verify-current");
const proofDate = process.env.PROOF_DATE ?? "2026-05-27";
const proofDateCompact = proofDate.replaceAll("-", "");
const cubConfig = process.env.CUB_CONFIG ?? join(homedir(), ".confighub", "config.yaml");
const commandEnv = {
  ...cubEnv(),
  CUB_CONFIG: cubConfig,
  CONFIGHUB_AGENT: "1",
};

if (args.includes("--help")) usage();

check(!(verifyLegacy && verifyCurrent), "use either --verify for retained legacy receipts or --verify-current for attestation-v1 receipts");

if (args.includes("--self-test")) {
  selfTestApprovalAttestation();
  console.log("verified variant Approval attestation subject checks with fake results only");
  process.exit(0);
}

const selected = selectCharts();
check(selected.length > 0, "no charts selected for ConfigHub proof batch");

if (verifyLegacy || verifyCurrent) {
  for (const chart of selected) verifyProofReceipts(chart, { current: verifyCurrent });
  console.log(`verified ${verifyCurrent ? "attestation-v1" : "retained legacy"} receipts for ${selected.length} ConfigHub proof chart lane(s)`);
  process.exit(0);
}

for (const chart of selected) {
  console.log(`\n== ${chart.slug}: ${chart.chart}@${chart.chartVersion} ==`);
  runChart(chart);
}

console.log(`\ncompleted ${selected.length} ConfigHub proof chart lane(s)`);

function usage() {
  console.log(`Usage:
  node scripts/run-top20-confighub-proof.mjs
  node scripts/run-top20-confighub-proof.mjs --charts ingress-nginx,rabbitmq
  node scripts/run-top20-confighub-proof.mjs --charts kube-prometheus-stack --base no-crds --cleanup-spaces
  node scripts/run-top20-confighub-proof.mjs --promotion-candidates --charts keda --cleanup-spaces
  node scripts/run-top20-confighub-proof.mjs --charts redis --base default --variant-promotion-proof --cleanup-spaces
  node scripts/run-top20-confighub-proof.mjs --all --force
  node scripts/run-top20-confighub-proof.mjs --latest-candidates --charts nginx --cleanup-spaces
  node scripts/run-top20-confighub-proof.mjs --cleanup-spaces
  node scripts/run-top20-confighub-proof.mjs --verify --charts ingress-nginx
  node scripts/run-top20-confighub-proof.mjs --verify-current --charts ingress-nginx

Default: run top-20 charts whose ConfigHub proof receipt is missing.
--latest-candidates runs against generated latest-version candidate packages
under data/latest-top20-refresh/candidates/.
--promotion-candidates runs explicitly configured proof-grade promotion
candidate charts without changing the top-20 proof set.
--base selects one explicit package base for one selected chart and writes a
base-specific proof run without replacing the chart's default proof receipt.
--variant-promotion-proof mutates the upstream ConfigHub Space after clone,
previews and applies cub variant promote in the downstream Space, and writes a
VariantPromotionReceipt. It exercises changed upstream Units plus newly added
upstream Units; deletion handling remains an explicit non-claim.
--verify reads retained legacy receipts under latest; --verify-current reads
the current attestation-v1 receipts. Both modes are offline receipt checks.
--cleanup-spaces deletes the live proof spaces after receipts are written so
large chart runs can stay inside the demo org quota.
--smoke selects the first missing chart only.`);
  process.exit(0);
}

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function selectCharts() {
  check(!(latestCandidates && promotionCandidates), "--latest-candidates and --promotion-candidates are mutually exclusive");
  const sourceCharts = latestCandidates
    ? latestCandidateCharts()
    : promotionCandidates
      ? CONFIGHUB_PROMOTION_PROOF_CHARTS
      : TOP20_CONFIGHUB_PROOF_CHARTS;
  let charts;
  if (chartsArg) {
    charts = chartsArg
      .split(",")
      .map((slug) => slug.trim())
      .filter(Boolean)
      .map((slug) => {
        const chart = sourceCharts.find((candidate) =>
          [
            candidate.slug,
            candidate.baseSlug,
            candidate.chart,
            candidate.chart.split("/").at(-1),
          ].filter(Boolean).includes(slug),
        );
        check(chart, `unknown ${chartSetName()} chart selector: ${slug}`);
        return chart;
      });
  } else if (all || verifyLegacy || verifyCurrent) {
    charts = sourceCharts;
  } else {
    charts = sourceCharts.filter((chart) => force || !existsSync(configHubProofReceiptPath(chart)));
  }
  charts = smoke ? charts.slice(0, 1) : charts;
  if (baseOverride) {
    check(charts.length === 1, "--base requires exactly one selected chart");
    charts = [withBaseOverride(charts[0], baseOverride)];
  }
  return charts;
}

function chartSetName() {
  if (latestCandidates) return "latest-candidate";
  if (promotionCandidates) return "promotion-candidate";
  return "top-20";
}

function withBaseOverride(chart, base) {
  const baseSlug = versionSlug(base);
  return {
    ...chart,
    defaultBase: base,
    runRoot: join("runs", `${chart.slug}-${baseSlug}-confighub-proof`, "attestation-v1"),
    workDir: join(".tmp", "confighub-proof", `${chart.slug}-${baseSlug}`),
    archiveRoot: join(".tmp", "confighub-proof", `${chart.slug}-${baseSlug}-archives`),
    space: `helm-${chart.slug}-${baseSlug}-confighub-proof`,
    stagingSpace: `${chart.component}-${baseSlug}-staging`,
    spaceNamePattern: `template:${chart.component}-${baseSlug}-{{.Labels.Variant}}`,
    proofLabel: `${chart.slug}-${baseSlug}-confighub-proof`,
    skipDemoDocs: true,
    baseOverride: true,
    postUploadPlanTimeoutMs: 60_000,
  };
}

function latestCandidateCharts() {
  const readinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");
  const rows = parseCsv(readFileSync(readinessPath, "utf8"));
  return rows.map((row) => {
    const base = TOP20_CONFIGHUB_PROOF_CHARTS.find((chart) => chart.chart === row.chart);
    check(base, `no top-20 ConfigHub proof base row for latest candidate ${row.chart}`);
    const chartName = row.chart.split("/").at(-1);
    const runPathKey = `${chartName}-${row.candidate_version}`;
    const candidateSlug = `${base.slug}-${versionSlug(row.candidate_version)}`;
    return {
      ...base,
      slug: candidateSlug,
      baseSlug: base.slug,
      displayName: `${base.displayName} ${row.candidate_version}`,
      packagePath: row.candidate_package,
      chartVersion: row.candidate_version,
      defaultBase: undefined,
      runRoot: join("runs", "latest-top20-refresh", runPathKey, "confighub-proof", "attestation-v1"),
      workDir: join(".tmp", "latest-top20-refresh", runPathKey, "confighub-proof"),
      archiveRoot: join(".tmp", "latest-top20-refresh", runPathKey, "archives"),
      space: `helm-${candidateSlug}-candidate-proof`,
      stagingSpace: `${base.component}-${candidateSlug}-staging`,
      spaceNamePattern: `template:${base.component}-${candidateSlug}-{{.Labels.Variant}}`,
      proofLabel: `${candidateSlug}-candidate-proof`,
      skipDemoDocs: true,
      candidate: {
        currentVersion: row.current_version,
        candidateVersion: row.candidate_version,
        readiness: row.promotion_readiness,
      },
    };
  });
}

function runChart(chart) {
  const packageRoot = join(repoRoot, chart.packagePath);
  const installerPath = join(packageRoot, "installer.yaml");
  check(existsSync(installerPath), `${chart.packagePath}/installer.yaml is missing`);

  const installer = readYaml(installerPath);
  const bases = installer.spec?.bases ?? [];
  check(bases.length > 0, `${chart.packagePath} declares no bases`);
  const defaultBase = chart.defaultBase ?? bases.find((base) => base.default)?.name ?? bases[0].name;
  check(defaultBase, `${chart.packagePath} has no usable default base`);
  check(bases.some((base) => base.name === defaultBase), `${chart.slug} configured base ${defaultBase} is not in package bases`);

  const runRoot = join(repoRoot, chart.runRoot ?? join("runs", `${chart.slug}-confighub-proof`, "attestation-v1"));
  const demoRoot = join(repoRoot, "docs", "demo", chart.slug);
  const workDir = join(repoRoot, chart.workDir ?? join(".tmp", "confighub-proof", `${chart.slug}-${defaultBase}`));
  const archiveRoot = join(repoRoot, chart.archiveRoot ?? join(".tmp", "confighub-proof", `${chart.slug}-archives`));
  const logRoot = join(runRoot, "logs");
  const space = chart.space ?? `helm-${chart.slug}-confighub-proof`;
  const stagingVariant = "staging";
  const stagingSpace = chart.stagingSpace ?? `${chart.component}-${stagingVariant}`;
  const spaceNamePattern = chart.spaceNamePattern ?? "template:{{.Labels.Component}}-{{.Labels.Variant}}";
  const proofLabel = chart.proofLabel ?? `${chart.slug}-confighub-proof`;
  const selector = `Labels.Proof = '${proofLabel}'`;

  rmSync(runRoot, { recursive: true, force: true });
  mkdirSync(runRoot, { recursive: true });
  mkdirSync(logRoot, { recursive: true });
  mkdirSync(archiveRoot, { recursive: true });
  rmSync(workDir, { recursive: true, force: true });
  if (cleanupSpaces) deleteProofSpaces({ space, stagingSpace, logRoot, name: "00-space-cleanup-pre" });

  const docRun = run("cub", ["installer", "doc", chart.packagePath, "--json"], { logRoot, name: "01-install-doc" });
  check(docRun.status === 0, `${chart.slug} cub installer doc failed`);
  const doc = JSON.parse(docRun.stdout);
  const docBases = doc.spec?.bases ?? [];
  check(docBases.some((base) => base.name === defaultBase), `${chart.slug} doc does not expose default base`);

  const setupArgs = [
    "installer",
    "setup",
    "--pull",
    chart.packagePath,
    "--base",
    defaultBase,
    "--work-dir",
    relativeRepo(workDir),
    "--non-interactive",
    "--namespace",
    chart.namespace,
  ];
  const setupRun = run("cub", setupArgs, { logRoot, name: "02-install-setup" });
  check(setupRun.status === 0, `${chart.slug} cub installer setup failed`);

  const renderArgs = ["installer", "render", "--work-dir", relativeRepo(workDir)];
  const renderRun = run("cub", renderArgs, { logRoot, name: "03-install-render" });
  check(renderRun.status === 0, `${chart.slug} cub installer render failed`);

  const manifestObjects = renderedObjects(join(workDir, "out", "manifests"));
  const separatedSecrets = renderedObjects(join(workDir, "out", "secrets"));
  check(manifestObjects.length > 0, `${chart.slug} rendered no manifests`);

  const packageA = join(archiveRoot, `${chart.slug}-a.tgz`);
  const packageB = join(archiveRoot, `${chart.slug}-b.tgz`);
  const packageArgsA = ["installer", "package", chart.packagePath, "-o", relativeRepo(packageA)];
  const packageArgsB = ["installer", "package", chart.packagePath, "-o", relativeRepo(packageB)];
  const packageRunA = run("cub", packageArgsA, { logRoot, name: "04-install-package-a" });
  check(packageRunA.status === 0, `${chart.slug} first cub installer package failed`);
  const packageRunB = run("cub", packageArgsB, { logRoot, name: "05-install-package-b" });
  check(packageRunB.status === 0, `${chart.slug} second cub installer package failed`);
  const packageShaA = sha256File(packageA);
  const packageShaB = sha256File(packageB);
  check(packageShaA === packageShaB, `${chart.slug} package archives are not byte-identical`);

  const vetRun = run("cub", ["installer", "vet", "--work-dir", relativeRepo(workDir)], {
    logRoot,
    name: "06-install-vet",
  });
  check(vetRun.status === 0, `${chart.slug} cub installer vet failed`);

  const prePlanRun = run("cub", ["installer", "plan", "--work-dir", relativeRepo(workDir)], {
    logRoot,
    name: "07-install-plan-pre-upload",
    allowFailure: true,
  });

  const uploadArgs = [
    "installer",
    "upload",
    "--work-dir",
    relativeRepo(workDir),
    "--space",
    space,
    "--component",
    chart.component,
    "--layer",
    "App",
    "--environment",
    "Demo",
    "--owner",
    "ConfigHubHelm",
    "--variant",
    defaultBase,
    "--unit-label",
    `Component=${chart.component}`,
    "--unit-label",
    `HelmChart=${chart.chart.replaceAll("/", "-")}`,
    "--unit-label",
    `HelmChartVersion=${chart.chartVersion}`,
    "--unit-label",
    `Variant=${defaultBase}`,
    "--unit-label",
    `Proof=${proofLabel}`,
    "--retry",
  ];
  const uploadRun = run("cub", uploadArgs, { logRoot, name: "08-install-upload" });
  check(uploadRun.status === 0, `${chart.slug} cub installer upload failed`);

  const postPlanRun = run("cub", ["installer", "plan", "--work-dir", relativeRepo(workDir)], {
    logRoot,
    name: "09-install-plan-post-upload",
    allowFailure: Boolean(chart.baseOverride),
    timeout: chart.postUploadPlanTimeoutMs,
  });
  if (!chart.baseOverride) {
    check(postPlanRun.status === 0, `${chart.slug} post-upload cub installer plan failed`);
  }

  const variantArgs = [
    "variant",
    "create",
    stagingVariant,
    space,
    "--environment",
    "Staging",
    "--region",
    "local",
    "--namespace",
    chart.namespace,
    "--space-pattern",
    spaceNamePattern,
    "--allow-exists",
    "--wait",
    "--timeout",
    "10m",
  ];
  const variantRun = run("cub", variantArgs, { logRoot, name: "10-variant-create" });
  check(variantRun.status === 0, `${chart.slug} cub variant create failed`);

  const proofUnits = unitList(space, selector, logRoot, "11-unit-list-proof");
  check(proofUnits.length > 0, `${chart.slug} upload produced no proof-labeled Units`);
  const allUnits = unitList(space, "", logRoot, "12-unit-list-all");
  const clonedUnits = unitList(stagingSpace, "", logRoot, "13-unit-list-staging");
  check(clonedUnits.length >= allUnits.length, `${chart.slug} staging variant has fewer Units than upstream`);

  const representative = chooseRepresentativeUnit(proofUnits);
  const unitDataRun = run("cub", ["unit", "data", representative.slug, "--space", space], {
    logRoot,
    name: "14-unit-data",
  });
  check(unitDataRun.status === 0, `${chart.slug} representative unit data failed`);
  const revisionRun = run("cub", ["revision", "list", representative.slug, "--space", space], {
    logRoot,
    name: "15-revision-list",
  });
  check(revisionRun.status === 0, `${chart.slug} representative revision list failed`);
  const diffRun = run(
    "cub",
    [
      "unit",
      "diff",
      representative.slug,
      "--space",
      space,
      "--from",
      "1",
      "--to",
      "HeadRevisionNum",
      "-u",
    ],
    { logRoot, name: "16-unit-diff", allowFailure: true },
  );

  const validations = runFunctionScans({ chart, proofUnits, selector, space, logRoot });
  const safeOps = runSafeOps({ chart, representative, selector, space, proofLabel, logRoot });
  const variantPromotion = variantPromotionProof
    ? runVariantPromotionProof({
        chart,
        defaultBase,
        representative,
        proofLabel,
        space,
        stagingSpace,
        namespace: chart.namespace,
        logRoot,
      })
    : null;

  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ConfigHubProofReceipt",
    metadata: { name: `${chart.slug}-confighub-proof-${proofDateCompact}` },
    spec: {
      run: {
        date: proofDate,
        context: runContext(),
      },
      package: {
        path: chart.packagePath,
        name: installer.metadata?.name ?? chart.chart.replaceAll("/", "-"),
        chart: chart.chart,
        chartVersion: chart.chartVersion,
        bases: bases.map((base) => base.name),
        selectedBase: defaultBase,
        docVerified: true,
        targetFactRequirements: targetFactRequirements(bases),
      },
      render: {
        command: commandText("cub", setupArgs),
        result: "pass",
        manifestCount: manifestObjects.length,
        separatedSecretCount: separatedSecrets.length,
        facts: factsSummary(workDir),
      },
      rerender: {
        command: commandText("cub", renderArgs),
        result: "pass",
        manifestCount: manifestObjects.length,
        separatedSecretCount: separatedSecrets.length,
      },
      deterministicPackage: {
        command: commandText("cub", packageArgsA),
        sha256: packageShaA,
        byteIdenticalAcrossTwoLocalBundles: true,
      },
      vet: {
        command: "cub installer vet --work-dir " + relativeRepo(workDir),
        result: "pass",
        note: vetRun.stdout.trim() || "completed",
      },
      upload: {
        command: commandText("cub", uploadArgs),
        result: "pass",
        workaround: `CUB_CONFIG=${cubConfig}`,
        space,
        unitCount: allUnits.length,
        kubernetesUnitCount: proofUnits.length,
        installerRecordUnitCount: Math.max(allUnits.length - proofUnits.length, 0),
        separatedSecretsNotUploaded: separatedSecrets.map((object) => object.identity),
      },
      plan: {
        preUpload: {
          command: "cub installer plan --work-dir " + relativeRepo(workDir),
          result: prePlanRun.status === 0 ? "pass" : "expected-missing-upload-state",
        },
        command: "cub installer plan --work-dir " + relativeRepo(workDir),
        result: postPlanRun.status === 0 ? "pass" : postPlanRun.timedOut ? "timeout" : "fail",
        summary: shortSummary(postPlanRun.stdout || postPlanRun.stderr || ""),
      },
      serverSideVariant: {
        command: commandText("cub", variantArgs),
        result: "pass",
        upstreamSpace: space,
        downstreamSpace: stagingSpace,
        clonedUnitCount: clonedUnits.length,
        namespace: chart.namespace,
      },
      serverSidePromotion: variantPromotion
        ? {
            receipt: "variant-promotion-receipt.yaml",
            result: variantPromotion.spec.result,
            reason: variantPromotion.spec.reason,
            changedUnitCaughtUp: variantPromotion.spec.assertions.changedUnitCaughtUp,
            addedUnitCloned: variantPromotion.spec.assertions.addedUnitCloned,
            deletionHandling: variantPromotion.spec.assertions.deletionHandling,
          }
        : {
            result: "not-run",
            reason: "run with --variant-promotion-proof to exercise cub variant promote",
          },
      review: {
        unitList: "pass",
        unitData: "pass",
        revisionList: "pass",
        revisionDiff: diffRun.status === 0 ? "pass" : "single-revision-or-no-live-diff",
        representativeUnit: representative.slug,
      },
      retention: cleanupSpaces
        ? {
            liveSpacesDeletedAfterProof: true,
            reason:
              "Kubara demo org has a finite Link quota; receipts and command logs preserve the proof after the live spaces are removed.",
            spaces: [space, stagingSpace],
          }
        : {
            liveSpacesDeletedAfterProof: false,
            spaces: [space, stagingSpace],
          },
      observedFriction: observedFriction({ separatedSecrets, prePlanRun, postPlanRun }),
    },
  };

  const functionReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ConfigHubFunctionScanReceipt",
    metadata: { name: `${chart.slug}-function-scan-${proofDateCompact}` },
    spec: {
      observedAt: proofDate,
      context: {
        organization: "Kubara",
        server: "https://hub.confighub.com",
        space,
        selector,
      },
      subject: {
        chart: chart.chart,
        chartVersion: chart.chartVersion,
        packagePath: chart.packagePath,
        variant: defaultBase,
        configHubUnitCount: proofUnits.length,
      },
      unitRevisionBindings: proofUnits.map((unit) => ({
        slug: unit.slug,
        headRevisionNum: unit.headRevisionNum,
        dataHash: unit.dataHash,
      })),
      validations,
      result: validations.every((validation) => validation.result === "pass") ? "pass" : "fail",
      limitations: [
        "This is a ConfigHub-native validation receipt, not a full external vulnerability scan.",
        "Production readiness still depends on policy disposition in the recipe scan and install gate.",
      ],
    },
  };

  const safeOpsReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ConfigHubSafeOpsReceipt",
    metadata: { name: `${chart.slug}-safe-ops-${proofDateCompact}` },
    spec: {
      approvalModel: "space-attestation-v1",
      observedAt: proofDate,
      context: {
        organization: "Kubara",
        server: "https://hub.confighub.com",
        space,
        selector,
      },
      subject: {
        chart: chart.chart,
        chartVersion: chart.chartVersion,
        packagePath: chart.packagePath,
        variant: defaultBase,
      },
      changeset: safeOps.changeset,
      approval: safeOps.approval,
      applyDryRun: safeOps.applyDryRun,
      cancel: safeOps.cancel,
      safetyResult: safeOps.safetyResult,
      interpretation:
        "The reviewed Units are visible in ConfigHub, but without a target ConfigHub makes no live deployment claim and blocks apply at the operation boundary. The Space-level Approval attestation records a claim about one Unit revision; no ChangeWorkflow or release prerequisite was configured, so this record does not enforce approval on promotion or publication.",
    },
  };

  check(functionReceipt.spec.result === "pass", `${chart.slug} function scan did not pass`);
  check(safeOpsReceipt.spec.safetyResult === "pass", `${chart.slug} safe ops did not pass`);

  writeYaml(join(runRoot, "confighub-proof-receipt.yaml"), receipt);
  writeYaml(join(runRoot, "function-scan-receipt.yaml"), functionReceipt);
  writeYaml(join(runRoot, "safe-ops-receipt.yaml"), safeOpsReceipt);
  if (variantPromotion) {
    writeYaml(join(runRoot, "variant-promotion-receipt.yaml"), variantPromotion);
  }
  if (!chart.skipDemoDocs) {
    writeDemoDocs({ chart, bases, defaultBase, receipt, functionReceipt, safeOpsReceipt, demoRoot });
  }
  if (cleanupSpaces) deleteProofSpaces({ space, stagingSpace, logRoot, name: "99-space-cleanup-post" });
  console.log(
    `${chart.slug}: ${manifestObjects.length} rendered object(s), ${proofUnits.length} ConfigHub Unit(s), ${clonedUnits.length} staging clone Unit(s)`,
  );
}

function deleteProofSpaces({ space, stagingSpace, logRoot, name }) {
  const result = run(
    "cub",
    ["space", "delete", "--space", `${space},${stagingSpace}`, "--recursive-force"],
    { logRoot, name, allowFailure: true },
  );
  return result.status === 0;
}

function runFunctionScans({ chart, proofUnits, selector, space, logRoot }) {
  const functions = ["vet-format", "vet-placeholders", "vet-merge-keys"];
  return functions.map((fn, index) => {
    const result = run(
      "cub",
      [
        "function",
        "vet",
        fn,
        "--space",
        space,
        "--where",
        selector,
        "--quiet",
        "--wait",
        "--timeout",
        "10m",
      ],
      { logRoot, name: `${17 + index}-function-${fn}` },
    );
    return {
      function: fn,
      toolchain: "Kubernetes/YAML",
      hermetic: true,
      idempotent: true,
      result: result.status === 0 ? "pass" : "fail",
      scannedUnits: proofUnits.length,
      failedUnits: result.status === 0 ? 0 : proofUnits.length,
    };
  });
}

function runSafeOps({ chart, representative, selector, space, proofLabel, logRoot }) {
  const changesetSlug = `${chart.slug}-safe-ops-${proofDateCompact}`;
  const createRun = run(
    "cub",
    [
      "changeset",
      "create",
      changesetSlug,
      "--space",
      space,
      "--description",
      `${chart.displayName} safe-ops proof: record approval for the reviewed revision, dry-run apply only`,
      "--label",
      `Proof=${proofLabel}`,
      "--label",
      "Lane=safe-ops",
      "--annotation",
      "proof.confighub.com/scope=local-test",
      "--annotation",
      "proof.confighub.com/live-apply=false",
      "--allow-exists",
    ],
    { logRoot, name: "20-changeset-create" },
  );
  const updateRun = run(
    "cub",
    [
      "changeset",
      "update",
      changesetSlug,
      "--space",
      space,
      "--description",
      `${chart.displayName} safe-ops proof: record approval for the reviewed revision, dry-run apply only`,
      "--annotation",
      "proof.confighub.com/rechecked=true",
    ],
    { logRoot, name: "21-changeset-update" },
  );
  const reviewedUnit = oneUnit(space, representative.slug, logRoot, "22-unit-before-approval");
  check(typeof reviewedUnit.id === "string" && reviewedUnit.id.length > 0 && !/[\r\n']/u.test(reviewedUnit.id), `${space}/${representative.slug} has no safe UnitID for exact approval selection`);
  const reviewedRevision = reviewedUnit.headRevisionNum;
  check(Number.isSafeInteger(reviewedRevision) && reviewedRevision > 0, `${space}/${representative.slug} has no numeric head revision to approve`);
  const approvalWhere = `UnitID = '${reviewedUnit.id}'`;
  const approvalArgs = [
    "variant", "approve", space,
    "--all",
    "--where", approvalWhere,
    "--revision", String(reviewedRevision),
    "-o", "json",
  ];
  const approveRun = run(
    "cub",
    approvalArgs,
    { logRoot, name: "22-variant-approve" },
  );
  check(approveRun.status === 0, `${chart.slug} variant Approval attestation failed: ${shortSummary(approveRun.stderr || approveRun.stdout)}`);
  let approval;
  try {
    approval = assertApprovalAttestation(JSON.parse(approveRun.stdout), {
      space,
      unitID: reviewedUnit.id,
      revisionNum: reviewedRevision,
    });
  } catch (error) {
    throw new Error(`${chart.slug} approval proof gap: ${error.message}`);
  }
  const reviewedAfter = oneUnit(space, representative.slug, logRoot, "22-unit-after-approval");
  check(reviewedAfter.id === reviewedUnit.id, `${chart.slug} Unit identity changed during approval`);
  check(reviewedAfter.headRevisionNum === reviewedRevision, `${chart.slug} Unit head changed during approval`);
  const applyDryRun = run(
    "cub",
    [
      "unit",
      "apply",
      "--space",
      space,
      "--where",
      selector,
      "--dry-run",
      "--wait",
      "--timeout",
      "2m",
    ],
    { logRoot, name: "23-unit-apply-dry-run", allowFailure: true },
  );
  const cancelRun = run("cub", ["unit", "cancel", "--space", space, "--where", selector], {
    logRoot,
    name: "24-unit-cancel",
    allowFailure: true,
  });
  const applyOutput = `${applyDryRun.stdout}\n${applyDryRun.stderr}`;
  const blockedNoTarget = applyDryRun.status !== 0 && /without a target|no target|target/i.test(applyOutput);
  return {
    changeset: {
      slug: changesetSlug,
      createResult: createRun.status === 0 ? "pass" : "fail",
      updateResult: updateRun.status === 0 ? "pass" : "fail",
      description: `${chart.displayName} safe-ops proof: record approval for the reviewed revision, dry-run apply only`,
      labels: {
        Proof: proofLabel,
        Lane: "safe-ops",
      },
      annotations: {
        "proof.confighub.com/scope": "local-test",
        "proof.confighub.com/live-apply": "false",
      },
    },
    approval: {
      command: `cub variant approve ${space} --all --where "${approvalWhere}" --revision ${reviewedRevision} -o json`,
      result: "pass",
      attestationID: approval.attestationID,
      type: approval.type,
      attestationResult: approval.result,
      subject: approval.subject,
      workflowEnforcement: "not-configured",
      representativeUnit: representative.slug,
      output: shortSummary(approveRun.stdout || approveRun.stderr),
    },
    applyDryRun: {
      command: `cub unit apply --space ${space} --where "${selector}" --dry-run --wait --timeout 2m`,
      result: blockedNoTarget ? "blocked-no-target" : applyDryRun.status === 0 ? "pass" : "fail",
      expected: blockedNoTarget,
      message: shortSummary(applyOutput),
    },
    cancel: {
      command: `cub unit cancel --space ${space} --where "${selector}"`,
      result: cancelRun.status === 0 ? "pass" : "fail",
      message: shortSummary(cancelRun.stdout || cancelRun.stderr),
    },
    safetyResult:
      createRun.status === 0 && updateRun.status === 0 && blockedNoTarget ? "pass" : "fail",
  };
}

function assertApprovalAttestation(result, expected) {
  const spaces = result?.Spaces ?? result?.spaces;
  check(Array.isArray(spaces) && spaces.length === 1, "variant approve returned no unique Space attestation result");
  const row = spaces[0];
  check(row && typeof row === "object", "variant approve returned a malformed Space result");
  check((row.SpaceSlug ?? row.spaceSlug) === expected.space && !row.Error && !row.error, "variant approve result does not identify the reviewed Space");
  const attestation = row.Attestation ?? row.attestation;
  const attestationID = attestation?.AttestationID ?? attestation?.attestationID;
  check(typeof attestationID === "string" && attestationID.length > 0, "variant approve returned no attestation ID");
  const type = attestation.Type ?? attestation.type;
  const attestationResult = attestation.Result ?? attestation.result;
  check(type === "Approval" && attestationResult === "Pass", "variant approve did not return a passing Approval attestation");
  const subjects = row.Subjects ?? row.subjects;
  check(Array.isArray(subjects) && subjects.length === 1, "variant approve did not return exactly one reviewed subject");
  const subject = subjects[0];
  const unitID = subject?.UnitID ?? subject?.unitID;
  const revisionNum = subject?.RevisionNum ?? subject?.revisionNum;
  check(unitID === expected.unitID && Number.isSafeInteger(revisionNum) && revisionNum === expected.revisionNum, "Approval attestation subject differs from the reviewed Unit and numeric revision");
  const skippedUnits = row.SkippedUnits ?? row.skippedUnits;
  check(skippedUnits === undefined || Array.isArray(skippedUnits) && skippedUnits.length === 0, "variant approve skipped a selected Unit or returned malformed skipped-unit data");
  return {
    attestationID,
    type,
    result: attestationResult,
    subject: { unitID, revisionNum },
  };
}

function selfTestApprovalAttestation() {
  const expected = { space: "test-space", unitID: "unit-1", revisionNum: 7 };
  const valid = {
    Spaces: [{
      SpaceSlug: expected.space,
      Attestation: { AttestationID: "attestation-1", Type: "Approval", Result: "Pass" },
      Subjects: [{ UnitID: expected.unitID, RevisionNum: expected.revisionNum }],
      SkippedUnits: [],
    }],
  };
  check(assertApprovalAttestation(valid, expected).attestationID === "attestation-1", "self-test: exact Space Approval attestation was not accepted");
  const invalid = [
    { ...valid, Spaces: [{ ...valid.Spaces[0], Attestation: null }] },
    { ...valid, Spaces: [{ ...valid.Spaces[0], SpaceSlug: "other-space" }] },
    { ...valid, Spaces: [{ ...valid.Spaces[0], Subjects: [{ UnitID: "other-unit", RevisionNum: 7 }] }] },
    { ...valid, Spaces: [{ ...valid.Spaces[0], Subjects: [{ UnitID: "unit-1", RevisionNum: 8 }] }] },
    { ...valid, Spaces: [{ ...valid.Spaces[0], SkippedUnits: [{ UnitID: "unit-1" }] }] },
  ];
  for (const result of invalid) {
    let refused = false;
    try {
      assertApprovalAttestation(result, expected);
    } catch {
      refused = true;
    }
    check(refused, "self-test: malformed or mismatched Approval attestation was accepted");
  }
}

function runVariantPromotionProof({ chart, defaultBase, representative, proofLabel, space, stagingSpace, namespace, logRoot }) {
  const changedUnitSlug = representative.slug;
  const upstreamBefore = oneUnit(space, changedUnitSlug, logRoot, "25-promotion-upstream-before");
  const downstreamBefore = oneUnit(stagingSpace, changedUnitSlug, logRoot, "26-promotion-downstream-before");
  const marker = `${chart.slug}-${versionSlug(defaultBase)}-promotion-${proofDateCompact}`;
  const annotationKey = "helm-expt.confighub.com/promotion-proof";
  const unitDataPath = join(logRoot, "27-promotion-upstream-patched.yaml");
  const unitDataRun = run("cub", ["unit", "data", changedUnitSlug, "--space", space, "--output-file", relativeRepo(unitDataPath)], {
    logRoot,
    name: "27-promotion-unit-data-export",
  });
  check(unitDataRun.status === 0, `${chart.slug} promotion unit data export failed`);
  const doc = readYaml(unitDataPath);
  doc.metadata = doc.metadata ?? {};
  doc.metadata.annotations = doc.metadata.annotations ?? {};
  doc.metadata.annotations[annotationKey] = marker;
  writeYaml(unitDataPath, doc);

  const updateRun = run(
    "cub",
    [
      "unit",
      "update",
      changedUnitSlug,
      relativeRepo(unitDataPath),
      "--space",
      space,
      "--change-desc",
      `${chart.displayName} variant promotion proof: upstream annotation change`,
      "--wait",
      "--timeout",
      "10m",
    ],
    { logRoot, name: "28-promotion-upstream-update" },
  );

  const markerSlug = `promotion-marker-${versionSlug(chart.slug)}-${versionSlug(defaultBase)}`;
  const markerPath = join(logRoot, "29-promotion-marker-configmap.yaml");
  writeYaml(markerPath, {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: markerSlug,
      namespace,
      labels: {
        "app.kubernetes.io/managed-by": "helm-expt",
        "helm-expt.confighub.com/lane": "variant-promotion",
      },
      annotations: {
        [annotationKey]: marker,
      },
    },
    data: {
      chart: chart.chart,
      chartVersion: chart.chartVersion,
      variant: defaultBase,
      marker,
    },
  });
  const addRun = run(
    "cub",
    [
      "unit",
      "create",
      markerSlug,
      relativeRepo(markerPath),
      "--space",
      space,
      "--label",
      `Proof=${proofLabel}`,
      "--label",
      `Component=${chart.component}`,
      "--label",
      `HelmChart=${chart.chart.replaceAll("/", "-")}`,
      "--label",
      `HelmChartVersion=${chart.chartVersion}`,
      "--label",
      `Variant=${defaultBase}`,
      "--label",
      "Lane=variant-promotion",
      "--annotation",
      "proof.confighub.com/scope=server-promotion",
      "--allow-exists",
      "--change-desc",
      `${chart.displayName} variant promotion proof: added upstream unit`,
      "--wait",
      "--timeout",
      "10m",
    ],
    { logRoot, name: "29-promotion-upstream-add-unit" },
  );
  const upstreamAfter = oneUnit(space, changedUnitSlug, logRoot, "30-promotion-upstream-after");
  const markerUpstream = oneUnit(space, markerSlug, logRoot, "31-promotion-marker-upstream");

  const dryRun = run(
    "cub",
    ["variant", "promote", stagingSpace, "--dry-run", "-o", "mutations"],
    { logRoot, name: "32-variant-promote-dry-run" },
  );
  const changesetSlug = `${chart.slug}-${versionSlug(defaultBase)}-variant-promote-${proofDateCompact}`;
  const changesetRef = `${stagingSpace}/${changesetSlug}`;
  const changesetRun = run(
    "cub",
    [
      "changeset",
      "create",
      changesetSlug,
      "--space",
      stagingSpace,
      "--description",
      `${chart.displayName} variant promotion proof`,
      "--label",
      `Proof=${proofLabel}`,
      "--label",
      "Lane=variant-promotion",
      "--allow-exists",
    ],
    { logRoot, name: "33-variant-promote-changeset", allowFailure: true },
  );
  const changesetPromoteRun =
    changesetRun.status === 0
      ? run(
          "cub",
          [
            "variant",
            "promote",
            stagingSpace,
            "--changeset",
            changesetRef,
            "--change-desc",
            `${chart.displayName} variant promotion proof`,
            "--verbose",
          ],
          { logRoot, name: "34-variant-promote-apply", allowFailure: true },
        )
      : {
          status: 1,
          stdout: "",
          stderr: "changeset create failed; skipped changeset-bound promote",
        };
  const fallbackPromoteRun =
    changesetPromoteRun.status === 0
      ? null
      : run(
          "cub",
          [
            "variant",
            "promote",
            stagingSpace,
            "--change-desc",
            `${chart.displayName} variant promotion proof without changeset fallback`,
            "--verbose",
          ],
          { logRoot, name: "35-variant-promote-apply-no-changeset", allowFailure: true },
        );
  const effectivePromoteRun = changesetPromoteRun.status === 0 ? changesetPromoteRun : fallbackPromoteRun;
  const downstreamAfter =
    effectivePromoteRun?.status === 0 ? oneUnit(stagingSpace, changedUnitSlug, logRoot, "36-promotion-downstream-after") : null;
  const markerDownstream =
    effectivePromoteRun?.status === 0 ? oneUnit(stagingSpace, markerSlug, logRoot, "37-promotion-marker-downstream") : null;

  const changedUnitCaughtUp =
    Boolean(downstreamAfter) &&
    numberish(downstreamAfter.upstreamRevisionNum) >= numberish(upstreamAfter.headRevisionNum) &&
    numberish(upstreamAfter.headRevisionNum) > numberish(upstreamBefore.headRevisionNum);
  const addedUnitCloned = Boolean(markerDownstream?.slug) && Boolean(markerDownstream?.upstreamUnitID);
  const promotionMechanicsPassed = changedUnitCaughtUp && addedUnitCloned;
  const changesetPromotePassed = changesetRun.status === 0 && changesetPromoteRun.status === 0;
  const result = promotionMechanicsPassed && changesetPromotePassed ? "pass" : promotionMechanicsPassed ? "watch" : "fail";
  const reason =
    result === "pass"
      ? "server-side promotion passed through a changeset"
      : result === "watch"
        ? "server-side promotion mechanics passed, but changeset-bound promote failed and required the no-changeset fallback"
        : "server-side promotion did not prove changed-unit catch-up and added-unit cloning";

  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantPromotionReceipt",
    metadata: { name: `${chart.slug}-${versionSlug(defaultBase)}-variant-promotion-${proofDateCompact}` },
    spec: {
      observedAt: proofDate,
      context: runContext(),
      subject: {
        chart: chart.chart,
        chartVersion: chart.chartVersion,
        packagePath: chart.packagePath,
        variant: defaultBase,
        upstreamSpace: space,
        downstreamSpace: stagingSpace,
      },
      commands: {
        upstreamUpdate: `cub unit update ${changedUnitSlug} ${relativeRepo(unitDataPath)} --space ${space} --change-desc ...`,
        upstreamAddUnit: `cub unit create ${markerSlug} ${relativeRepo(markerPath)} --space ${space} --allow-exists`,
        dryRun: "cub variant promote " + stagingSpace + " --dry-run -o mutations",
        changeset: `cub changeset create ${changesetSlug} --space ${stagingSpace} --description ... --allow-exists`,
        promote: `cub variant promote ${stagingSpace} --changeset ${changesetRef} --change-desc ...`,
        fallbackPromote: `cub variant promote ${stagingSpace} --change-desc ...`,
      },
      upstreamChange: {
        changedUnit: changedUnitSlug,
        beforeHeadRevisionNum: upstreamBefore.headRevisionNum,
        afterHeadRevisionNum: upstreamAfter.headRevisionNum,
        annotation: `${annotationKey}=${marker}`,
        updateResult: updateRun.status === 0 ? "pass" : "fail",
      },
      upstreamAddition: {
        markerUnit: markerSlug,
        upstreamUnitID: markerUpstream.id,
        result: addRun.status === 0 ? "pass" : "fail",
        proofOnly: true,
      },
      preview: {
        result: dryRun.status === 0 ? "pass" : "fail",
        output: shortSummary(dryRun.stdout || dryRun.stderr),
      },
      changeset: {
        slug: changesetSlug,
        result: changesetRun.status === 0 ? "pass" : "fail",
        output: shortSummary(changesetRun.stdout || changesetRun.stderr),
      },
      promote: {
        result: changesetPromoteRun.status === 0 ? "pass" : "fail",
        output: shortSummary(changesetPromoteRun.stdout || changesetPromoteRun.stderr),
      },
      fallbackPromote: {
        used: fallbackPromoteRun ? true : false,
        result: fallbackPromoteRun ? (fallbackPromoteRun.status === 0 ? "pass" : "fail") : "not-used",
        output: fallbackPromoteRun ? shortSummary(fallbackPromoteRun.stdout || fallbackPromoteRun.stderr) : "",
      },
      assertions: {
        changedUnitCaughtUp: changedUnitCaughtUp ? "pass" : "fail",
        upstreamHeadRevisionNum: upstreamAfter.headRevisionNum,
        downstreamUpstreamRevisionNumBefore: downstreamBefore.upstreamRevisionNum,
        downstreamUpstreamRevisionNumAfter: downstreamAfter?.upstreamRevisionNum ?? "",
        addedUnitCloned: addedUnitCloned ? "pass" : "fail",
        addedUnitSlug: markerSlug,
        addedUnitDownstreamUpstreamUnitID: markerDownstream?.upstreamUnitID ?? "",
        deletionHandling: "not-tested",
        fieldOwnership: "not-tested",
      },
      result,
      reason,
      limitations: [
        "This receipt proves ConfigHub server-side promotion mechanics for changed Units and newly added Units.",
        ...(result === "watch"
          ? [
              "The changeset-bound promote path failed in this run; the no-changeset promote path was used to prove the server-side promotion mechanics.",
            ]
          : []),
        "It does not prove deletion handling, field ownership conflict handling, target apply, GitOps sync, or Kubernetes workload convergence.",
        "The added ConfigMap is proof-only and is not part of the Helm chart's rendered object set.",
      ],
    },
  };
}

function renderedObjects(root) {
  return listYamlFiles(root).flatMap((file) => {
    const docs = parseDocs(readFileSync(file, "utf8"));
    return docs
      .filter((doc) => doc.apiVersion && doc.kind && doc.metadata?.name)
      .map((doc) => {
        const namespace = doc.metadata?.namespace ?? "";
        const name = doc.metadata?.name ?? "";
        return {
          apiVersion: doc.apiVersion,
          kind: doc.kind,
          namespace,
          name,
          identity: `${doc.apiVersion}/${doc.kind} ${namespace ? `${namespace}/` : ""}${name}`,
          file: relativeRepo(file),
        };
      });
  });
}

function factsSummary(workDir) {
  const factsPath = join(workDir, "out", "spec", "facts.yaml");
  if (!existsSync(factsPath)) return {};
  return readYaml(factsPath).spec?.values ?? {};
}

function targetFactRequirements(bases) {
  return bases
    .filter((base) => Array.isArray(base.externalRequires) && base.externalRequires.length > 0)
    .map((base) => ({
      base: base.name,
      requirements: base.externalRequires.map((requirement) => ({
        kind: requirement.kind ?? "",
        name: requirement.name ?? "",
        namespace: requirement.namespace ?? "",
        suggestedSource: requirement.suggestedSource ?? "",
      })),
    }));
}

function unitList(space, where, logRoot, name) {
  const commandArgs = [
    "unit",
    "list",
    "--space",
    space,
    "--columns",
    "ID,Slug,HeadRevisionNum,UpstreamRevisionNum,UpstreamUnitID,DataHash,ToolchainType",
    "-o",
    "json",
  ];
  if (where) commandArgs.splice(4, 0, "--where", where);
  const result = run("cub", commandArgs, { logRoot, name });
  check(result.status === 0, `${space} unit list failed`);
  const rows = JSON.parse(result.stdout || "[]");
  return rows.map((row) => {
    const unit = row.Unit ?? row;
    return {
      slug: unit.Slug,
      id: unit.ID ?? unit.UnitID,
      headRevisionNum: unit.HeadRevisionNum,
      upstreamRevisionNum: unit.UpstreamRevisionNum,
      upstreamUnitID: unit.UpstreamUnitID,
      dataHash: unit.DataHash,
      toolchainType: unit.ToolchainType,
    };
  });
}

function oneUnit(space, slug, logRoot, name) {
  const rows = unitList(space, `Slug = '${slug}'`, logRoot, name);
  check(rows.length === 1, `${space} expected one Unit ${slug}, found ${rows.length}`);
  return rows[0];
}

function numberish(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chooseRepresentativeUnit(units) {
  const patterns = [
    /statefulset/i,
    /deployment/i,
    /daemonset/i,
    /apiservice/i,
    /service-/i,
    /customresourcedefinition/i,
  ];
  for (const pattern of patterns) {
    const found = units.find((unit) => pattern.test(unit.slug));
    if (found) return found;
  }
  return units[0];
}

function run(command, commandArgs, { logRoot, name, allowFailure = false, timeout } = {}) {
  mkdirSync(logRoot, { recursive: true });
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: command === "cub" ? commandEnv : process.env,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 500,
    timeout,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  writeFileSync(join(logRoot, `${name}.cmd.txt`), `${commandText(command, commandArgs)}\n`);
  writeFileSync(join(logRoot, `${name}.stdout.log`), stdout);
  writeFileSync(join(logRoot, `${name}.stderr.log`), stderr);
  writeFileSync(join(logRoot, `${name}.status.txt`), String(result.status ?? 1));
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `${commandText(command, commandArgs)} failed with status ${result.status}\n${shortSummary(stderr || stdout)}`,
    );
  }
  return { status: result.status ?? 1, stdout, stderr, timedOut };
}

function commandText(command, commandArgs) {
  return [command, ...commandArgs.map(shellToken)].join(" ");
}

function shellToken(token) {
  if (/^[A-Za-z0-9_./:=@{}+-]+$/.test(token)) return token;
  return JSON.stringify(token);
}

function runContext() {
  let cubVersion = "unknown";
  let serverVersion = "unknown";
  try {
    const version = execFileSync("cub", ["version"], {
      cwd: repoRoot,
      env: commandEnv,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
    });
    cubVersion = (version.match(/Version:\s+([^\n]+)/)?.[1] ?? "unknown").trim();
    serverVersion = (version.match(/Server Version:[\s\S]*?Version:\s+([^\n]+)/)?.[1] ?? "unknown").trim();
  } catch {
    // Keep the proof runnable even when version output is temporarily unavailable.
  }
  return {
    organization: "Kubara",
    server: "https://hub.confighub.com",
    cubClientVersion: cubVersion,
    cubServerVersion: serverVersion,
  };
}

function observedFriction({ separatedSecrets, prePlanRun, postPlanRun }) {
  const friction = [`cub installer upload needs explicit CUB_CONFIG in this local setup (${cubConfig}).`];
  if (prePlanRun.status !== 0) {
    friction.push("pre-upload cub installer plan is expected to fail until upload state exists.");
  }
  if (postPlanRun?.timedOut) {
    friction.push("post-upload cub installer plan timed out for this base-specific proof run; upload, variant, scan, and safe-ops were still checked.");
  } else if (postPlanRun && postPlanRun.status !== 0) {
    friction.push("post-upload cub installer plan did not pass for this base-specific proof run.");
  }
  if (separatedSecrets.length > 0) {
    friction.push("rendered Secret resources are separated from ConfigHub Units and must be managed out-of-band.");
  }
  friction.push("dry-run apply is blocked until a target is attached, which is the correct safe boundary.");
  return friction;
}

function shortSummary(text) {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");
}

function writeDemoDocs({ chart, bases, defaultBase, receipt, functionReceipt, safeOpsReceipt, demoRoot }) {
  mkdirSync(demoRoot, { recursive: true });
  const receiptDir = relative(
    demoRoot,
    join(repoRoot, chart.runRoot ?? join("runs", `${chart.slug}-confighub-proof`, "attestation-v1")),
  ).replaceAll("\\", "/");
  const baseRows = bases
    .map((base) => `| \`${base.name}\` | ${base.default ? "yes" : "no"} | ${base.description ?? ""} |`)
    .join("\n");
  const statusRows = [
    ["Package explanation", "Pass"],
    ["Deterministic setup", "Pass"],
    ["Re-render", "Pass"],
    ["Package determinism", "Pass"],
    ["Validator path", receipt.spec.vet.result],
    [
      "ConfigHub upload",
      `Pass; ${receipt.spec.upload.unitCount} ConfigHub Units (${receipt.spec.upload.kubernetesUnitCount} Kubernetes Units plus installer record)`,
    ],
    ["Server-side variant", `Pass; ${receipt.spec.serverSideVariant.clonedUnitCount} cloned Units`],
    ["ConfigHub function scan", functionReceipt.spec.result],
    ["Safe operations", safeOpsReceipt.spec.safetyResult],
  ]
    .map(([capability, status]) => `| ${capability} | ${status} |`)
    .join("\n");
  write(
    join(demoRoot, "confighub-proof.md"),
    `# ${chart.displayName} ConfigHub Proof

## Purpose

This example records \`${chart.chart}@${chart.chartVersion}\` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is \`${defaultBase}\`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
${baseRows}

## Acceptance Contract

| Capability | Status |
| --- | --- |
${statusRows}

## Receipts

\`\`\`text
${receiptDir}/confighub-proof-receipt.yaml
${receiptDir}/function-scan-receipt.yaml
${receiptDir}/safe-ops-receipt.yaml
\`\`\`
`,
  );
  write(
    join(demoRoot, "confighub-proof-transcript.md"),
    `# ${chart.displayName} ConfigHub Proof Transcript

Run date: ${proofDate}

Receipts:

\`\`\`text
${receiptDir}/confighub-proof-receipt.yaml
${receiptDir}/function-scan-receipt.yaml
${receiptDir}/safe-ops-receipt.yaml
\`\`\`

## Commands

\`\`\`sh
${receipt.spec.package.path && `cub installer doc ${chart.packagePath} --json`}
${receipt.spec.render.command}
cub installer render --work-dir .tmp/confighub-proof/${chart.slug}-${defaultBase}
${receipt.spec.deterministicPackage.command}
${receipt.spec.upload.command}
cub installer plan --work-dir .tmp/confighub-proof/${chart.slug}-${defaultBase}
${receipt.spec.serverSideVariant.command}
cub unit list --space ${receipt.spec.upload.space} --where "Labels.Proof = '${chart.slug}-confighub-proof'"
cub function vet vet-format --space ${receipt.spec.upload.space} --where "Labels.Proof = '${chart.slug}-confighub-proof'"
cub unit apply --space ${receipt.spec.upload.space} --where "Labels.Proof = '${chart.slug}-confighub-proof'" --dry-run
\`\`\`

## Result

\`\`\`text
rendered objects: ${receipt.spec.render.manifestCount}
separated secrets: ${receipt.spec.render.separatedSecretCount}
ConfigHub Units: ${receipt.spec.upload.unitCount}
Kubernetes Units: ${receipt.spec.upload.kubernetesUnitCount}
installer record Units: ${receipt.spec.upload.installerRecordUnitCount}
staging clone Units: ${receipt.spec.serverSideVariant.clonedUnitCount}
function scan: ${functionReceipt.spec.result}
safe ops: ${safeOpsReceipt.spec.safetyResult}
\`\`\`
`,
  );
}

function configHubProofReceiptPath(chart) {
  return join(repoRoot, chart.runRoot ?? join("runs", `${chart.slug}-confighub-proof`, "attestation-v1"), "confighub-proof-receipt.yaml");
}

function verifyProofReceipts(chart, { current }) {
  const currentRunRoot = chart.runRoot ?? join("runs", `${chart.slug}-confighub-proof`, "attestation-v1");
  check(currentRunRoot.endsWith("attestation-v1"), `${chart.slug} has no versioned attestation receipt path`);
  const runRoot = join(repoRoot, current ? currentRunRoot : currentRunRoot.replace(/attestation-v1$/u, "latest"));
  const receipt = readYaml(join(runRoot, "confighub-proof-receipt.yaml"));
  const functionReceipt = readYaml(join(runRoot, "function-scan-receipt.yaml"));
  const safeOpsReceipt = readYaml(join(runRoot, "safe-ops-receipt.yaml"));
  check(receipt.kind === "ConfigHubProofReceipt" && receipt.spec?.upload?.result === "pass", `${chart.slug} ConfigHub proof receipt is incomplete`);
  check(functionReceipt.kind === "ConfigHubFunctionScanReceipt" && functionReceipt.spec?.result === "pass", `${chart.slug} function-scan receipt is incomplete`);
  check(safeOpsReceipt.kind === "ConfigHubSafeOpsReceipt" && safeOpsReceipt.spec?.safetyResult === "pass", `${chart.slug} safe-ops receipt is incomplete`);
  const approval = safeOpsReceipt.spec?.approval;
  check(approval?.result === "pass", `${chart.slug} approval observation is incomplete`);
  if (current) {
    const subject = approval.subject;
    const expectedCommand = `cub variant approve ${safeOpsReceipt.spec.context.space} --all --where "UnitID = '${subject?.unitID}'" --revision ${subject?.revisionNum} -o json`;
    check(safeOpsReceipt.spec.approvalModel === "space-attestation-v1", `${chart.slug} current safe-ops receipt lacks its versioned approval model`);
    check(approval.command === expectedCommand, `${chart.slug} current approval command does not match its attested subject`);
    check(typeof approval.attestationID === "string" && approval.attestationID.length > 0, `${chart.slug} current approval attestation ID is missing`);
    check(approval.type === "Approval" && approval.attestationResult === "Pass", `${chart.slug} current approval is not a passing Approval attestation`);
    check(typeof subject?.unitID === "string" && Number.isSafeInteger(subject?.revisionNum) && subject.revisionNum > 0, `${chart.slug} current Approval subject is incomplete`);
    check(approval.workflowEnforcement === "not-configured", `${chart.slug} current approval workflow scope changed`);
  } else {
    check(safeOpsReceipt.spec.approvalModel === undefined, `${chart.slug} legacy verifier refuses a current approval receipt`);
    check(typeof approval.command === "string" && approval.command.startsWith("cub unit approve "), `${chart.slug} retained legacy approval command is missing`);
  }
}

function versionSlug(value) {
  return String(value)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
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
