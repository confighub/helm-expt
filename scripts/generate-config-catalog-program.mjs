#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { extname, join } from "node:path";

import {
  check,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256File,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const intentIndexPath = join(repoRoot, "data", "helm-render-intents", "intents.json");
const policySourcePath = join(repoRoot, "config-catalog", "policies", "catalog-standard.yaml");
const programSourcePath = join(repoRoot, "config-catalog", "program.yaml");
const operationalClassSourcePath = join(
  repoRoot,
  "config-catalog",
  "operational-class-examples.yaml",
);
const catalogOciDeliveryReceiptPath = join(
  repoRoot,
  "runs",
  "catalog-oci-delivery-proof",
  "bitnami-nginx-24-0-2-http-clusterip.yaml",
);
const catalogOciDeliveryRecord = "bitnami-nginx-24-0-2-http-clusterip";
const aicrPromotionReceiptPath = join(
  repoRoot,
  "runs",
  "aicr-variant-promotion-proof",
  "receipt.yaml",
);
const aicrPersistentPromotionReceiptPath = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow",
  "promotion-readiness-receipt.yaml",
);
const ociDeployStageRolloutReceiptPath = join(
  repoRoot,
  "runs",
  "oci-deploy-stage-rollout-proof",
  "receipt.yaml",
);
const anonymousOciFluxReceiptPath = join(
  repoRoot,
  "runs",
  "serverless-oci-gitops-proof",
  "receipt.yaml",
);
const anonymousOciCiReceiptPath = join(
  repoRoot,
  "runs",
  "anonymous-oci-ci-proof",
  "receipt.yaml",
);

const baseRoot = join(repoRoot, "data", "base-variant-records");
const recordRoot = join(baseRoot, "records");
const policyRoot = join(repoRoot, "data", "apply-policy-profiles");
const operationalClassRoot = join(repoRoot, "data", "operational-class-examples");
const demoRoot = join(repoRoot, "data", "demo-program");
const generatedGuidePath = join(repoRoot, "docs", "user", "config-catalog-demonstrations.md");
const supportedSourceTypes = [
  "helm",
  "aicr",
  "timoni",
  "cub-installer",
  "kubara",
  "sveltos",
  "source-oci",
  "configuration-oci",
  "kubernetes-yaml",
  "confighub",
  "rendered-config",
];
const policySourceTypeByRecordSource = {
  helm: "helm",
  aicr: "aicr",
  timoni: "timoni",
  "cub-installer": "cub-installer",
  kubara: "kubara",
  sveltos: "sveltos",
  "source-oci": "cub-installer",
  "configuration-oci": "rendered-config",
  "kubernetes-yaml": "rendered-config",
  confighub: "rendered-config",
  "rendered-config": "rendered-config",
};

if (mode === "--self-test") {
  runSelfTest();
  console.log("verified config catalog policy and delivery self-test");
  process.exit(0);
}

if (!["--generate", "--verify"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-config-catalog-program.mjs --generate
  node scripts/generate-config-catalog-program.mjs --verify
  node scripts/generate-config-catalog-program.mjs --self-test`);
  process.exit(1);
}

const report = buildReport();

if (mode === "--generate") {
  rmSync(recordRoot, { recursive: true, force: true });
  for (const record of report.records) {
    writeYaml(join(recordRoot, `${record.metadata.name}.yaml`), record);
  }
  write(join(baseRoot, "records.json"), `${JSON.stringify({ records: report.records }, null, 2)}\n`);
  write(join(baseRoot, "records.csv"), report.recordsCsv);
  write(join(baseRoot, "summary.md"), report.baseSummary);

  writeYaml(join(policyRoot, "catalog-standard.yaml"), report.policy);
  write(join(policyRoot, "catalog-standard.json"), `${JSON.stringify(report.policy, null, 2)}\n`);
  write(join(policyRoot, "summary.md"), report.policySummary);

  writeYaml(join(operationalClassRoot, "examples.yaml"), report.operationalClassExamples);
  write(
    join(operationalClassRoot, "examples.json"),
    `${JSON.stringify(report.operationalClassExamples, null, 2)}\n`,
  );
  write(join(operationalClassRoot, "summary.md"), report.operationalClassSummary);

  write(join(demoRoot, "program.json"), `${JSON.stringify(report.program, null, 2)}\n`);
  write(join(demoRoot, "summary.md"), report.demoSummary);
  write(generatedGuidePath, report.generatedGuide);

  console.log(
    `wrote config catalog program -> ${relativeRepo(baseRoot)}, ${relativeRepo(policyRoot)}, ${relativeRepo(demoRoot)} (${report.records.length} base record(s))`,
  );
} else {
  verifyFile(join(baseRoot, "records.json"), `${JSON.stringify({ records: report.records }, null, 2)}\n`);
  verifyFile(join(baseRoot, "records.csv"), report.recordsCsv);
  verifyFile(join(baseRoot, "summary.md"), report.baseSummary);
  verifyFile(join(policyRoot, "catalog-standard.yaml"), `${toYaml(report.policy)}\n`);
  verifyFile(join(policyRoot, "catalog-standard.json"), `${JSON.stringify(report.policy, null, 2)}\n`);
  verifyFile(join(policyRoot, "summary.md"), report.policySummary);
  verifyFile(
    join(operationalClassRoot, "examples.yaml"),
    `${toYaml(report.operationalClassExamples)}\n`,
  );
  verifyFile(
    join(operationalClassRoot, "examples.json"),
    `${JSON.stringify(report.operationalClassExamples, null, 2)}\n`,
  );
  verifyFile(join(operationalClassRoot, "summary.md"), report.operationalClassSummary);
  verifyFile(join(demoRoot, "program.json"), `${JSON.stringify(report.program, null, 2)}\n`);
  verifyFile(join(demoRoot, "summary.md"), report.demoSummary);
  verifyFile(generatedGuidePath, report.generatedGuide);

  const expectedNames = new Set(report.records.map((record) => `${record.metadata.name}.yaml`));
  const actualNames = existsSync(recordRoot)
    ? readdirSync(recordRoot).filter((name) => name.endsWith(".yaml"))
    : [];
  check(
    actualNames.length === expectedNames.size && actualNames.every((name) => expectedNames.has(name)),
    `${relativeRepo(recordRoot)} contains missing or stale record files; run npm run config-catalog`,
  );
  for (const record of report.records) {
    verifyFile(join(recordRoot, `${record.metadata.name}.yaml`), `${toYaml(record)}\n`);
  }
  console.log(`verified config catalog program for ${report.records.length} base record(s)`);
}

function buildReport() {
  check(existsSync(intentIndexPath), `${relativeRepo(intentIndexPath)} is missing; run npm run helm-render-intents`);
  const intents = JSON.parse(readFileSync(intentIndexPath, "utf8")).intents ?? [];
  const policy = readYaml(policySourcePath);
  const program = readYaml(programSourcePath);
  const operationalClassExamples = readYaml(operationalClassSourcePath);

  validatePolicy(policy);
  validateProgram(program);
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "run-config-catalog-policy-proof.mjs"), "--verify"],
    { cwd: repoRoot, stdio: ["ignore", "ignore", "inherit"] },
  );
  execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", "generate-hooks-crds-app.mjs"), "--verify"],
    { cwd: repoRoot, stdio: ["ignore", "ignore", "inherit"] },
  );

  const intentByName = new Map(intents.map((intent) => [intent.metadata.name, intent]));
  const records = [
    ...intents.map(buildHelmRecord),
    buildAicrRecord(),
    buildAicrArgoCdRecord(),
    buildAicrV019ArgoCdRecord(),
    buildTimoniRecord(),
    buildKubaraRecord(),
    buildSveltosRecord(),
    buildCubInstallerRecord(),
    buildConfigurationOciRecord(),
    buildPlainYamlRecord(),
  ]
    .map((record) => alignRecordWithProcessingModel(record, intentByName.get(record.metadata.name)))
    .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

  applyOperationalClassExamples(records, operationalClassExamples, policy);
  validateRecords(records);
  validateOperationalClassExamples(records, operationalClassExamples, policy);
  return {
    records,
    policy,
    program,
    operationalClassExamples,
    recordsCsv: renderRecordsCsv(records),
    baseSummary: renderBaseSummary(records),
    policySummary: renderPolicySummary(policy),
    operationalClassSummary: renderOperationalClassSummary(
      operationalClassExamples,
      policy,
      records,
    ),
    demoSummary: renderDemoSummary(program),
    generatedGuide: renderGeneratedGuide(program, policy),
  };
}

function buildHelmRecord(intent) {
  const intentPath = `data/helm-render-intents/intents/${intent.metadata.name}.yaml`;
  const revisionPath = intent.spec.renderOutput.revision;
  check(revisionPath && existsRepo(revisionPath), `${intentPath} points at a missing variant revision`);
  const revision = readYaml(join(repoRoot, revisionPath));
  const objectPath = intent.spec.renderOutput.renderedObjects;
  const inventoryPath = intent.spec.renderOutput.objectInventory;
  check(existsRepo(objectPath), `${intentPath} points at missing rendered objects`);
  check(existsRepo(inventoryPath), `${intentPath} points at a missing object inventory`);

  const fixedAtBuildTime = [
    `chart=${intent.spec.chart.name}`,
    `version=${intent.spec.chart.version}`,
    `base=${intent.spec.baseVariant}`,
    `valuesProfile=${intent.spec.renderInputs.valuesProfile || "none"}`,
    `namespace=${intent.spec.renderInputs.namespace || "chart-default"}`,
    `releaseName=${intent.spec.renderInputs.releaseName || "chart-default"}`,
    `capabilityProfile=${JSON.stringify(intent.spec.renderInputs.capabilityProfile ?? {})}`,
  ];
  const installTime = targetFactInputs(intent.spec.targetFacts.declared);
  const exactDelivery = intent.metadata.name === catalogOciDeliveryRecord
    ? readYaml(catalogOciDeliveryReceiptPath)
    : null;
  const deliveryReceipt = exactDelivery
    ? relativeRepo(catalogOciDeliveryReceiptPath)
    : "";
  const deliveryStatus = exactDelivery ? "pass" : "not-recorded-for-this-base";

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: intent.metadata.name,
      labels: {
        sourceType: "helm",
        component: intent.spec.component,
        sourceVersion: intent.spec.chart.version,
        base: intent.spec.baseVariant,
      },
    },
    spec: {
      source: {
        type: "helm",
        name: intent.spec.chart.name,
        version: intent.spec.chart.version,
        record: intentPath,
        packageOciRef: intent.spec.renderInputs.installerPackageOciRef,
      },
      baseVariant: {
        name: intent.spec.baseVariant,
        revision: String(revision.spec?.revision ?? ""),
        digest: String(revision.spec?.digest ?? ""),
      },
      configuration: {
        format: "kubernetes-yaml",
        objects: objectPath,
        inventory: inventoryPath,
        objectCount: Number(revision.spec?.rendered?.objectCount ?? 0),
      },
      inputs: {
        fixedAtBuildTime,
        installTime,
        installTimeStatus: installTime.length > 0 ? "partly-declared" : "not-yet-declared",
      },
      routing: {
        routes: intent.spec.lifecycle.variantRoutes ?? [],
        targetFacts: intent.spec.targetFacts,
        sourceRecord: intentPath,
      },
      delivery: {
        literalConfigOci: {
          status: exactDelivery
            ? "not-separately-published"
            : "not-published-in-this-record",
          note: exactDelivery
            ? "The selected installer base was uploaded directly as exact ConfigHub Units. This proof did not publish a separate literal-configuration OCI before ConfigHub."
            : "The installer package contains several preset configurations. A literal OCI bundle for this one base needs its own publication receipt.",
        },
        configHubReleaseOci: {
          status: deliveryStatus,
          ...(exactDelivery
            ? {
              observedReference: exactDelivery.spec.releaseOci.reference,
              digest: exactDelivery.spec.releaseOci.digest,
              receipt: deliveryReceipt,
              retained: "no",
            }
            : {}),
          note: exactDelivery
            ? "ConfigHub published the reviewed Units once; all three recorded consumers used this digest, then the test removed its temporary Space."
            : "No current ConfigHub Space release OCI receipt is recorded for this exact base.",
        },
        argoCd: deliveryStatus,
        flux: deliveryStatus,
        direct: deliveryStatus,
        historicalGitopsOciStatus: intent.spec.evidence.gitopsOciLive,
        ...(exactDelivery ? { receipt: deliveryReceipt } : {}),
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
      },
      evidence: intent.spec.evidence,
      operations: {
        resourceClass: "not-yet-classified",
        ownerClass: "not-yet-classified",
        changeCadence: "not-yet-classified",
      },
    },
    status: {
      level: "available",
      claim: "The Helm source record, committed rendered objects, revision digest, routes, target facts, and proof-lane statuses are indexed here.",
      limits: [
        exactDelivery
          ? "The base was uploaded to a temporary ConfigHub Space, published as a Space release OCI, delivered three ways, and then cleaned up."
          : "This record does not claim that the base has been uploaded to a live ConfigHub Space.",
        "The inputs still required at installation are not yet fully recorded for every Helm configuration.",
        "A multi-preset installer package OCI is not the same as a single literal configuration OCI.",
      ],
    },
  };
}

function buildAicrRecord() {
  const root = "examples/aicr/eks-h100-training-kubeflow";
  const receiptPath = `${root}/generation-receipt.yaml`;
  const recipePath = `${root}/recipe.yaml`;
  const receipt = readYaml(join(repoRoot, receiptPath));
  const bundlePath = receipt.spec.outputs.ociBundle;
  const checksumsPath = receipt.spec.outputs.ociBundleChecksums;
  const localOciManifestPath = receipt.spec.outputs.localOciManifest;
  const publicOciRef = `oci://${receipt.spec.oci.publicTarget}`;
  const fluxRequirements = receipt.spec.oci.fluxRequirements;
  const objects = objectsInDirectory(join(repoRoot, bundlePath));
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-14-0-base",
      labels: {
        sourceType: "aicr",
        component: "aicr-eks-h100-training-kubeflow",
        sourceVersion: "v0.14.0",
        base: "base",
      },
    },
    spec: {
      source: {
        type: "aicr",
        name: "eks-h100-training-kubeflow",
        version: "v0.14.0",
        record: receiptPath,
        packageOciRef: "",
      },
      baseVariant: {
        name: "base",
        revision: "generated-v0.14.0",
        digest: sha256File(join(repoRoot, checksumsPath)),
      },
      configuration: {
        format: "flux-kubernetes-yaml",
        objects: bundlePath,
        inventory: checksumsPath,
        objectCount: objects.length,
      },
      inputs: {
        fixedAtBuildTime: [
          ...Object.entries(receipt.spec.criteria).map(([key, value]) => `${key}=${value}`),
          ...Object.entries(receipt.spec.generationInputs)
            .filter(([key]) => key !== "gitBundleRepositoryUrl")
            .map(([key, value]) => `${key}=${value}`),
        ],
        installTime: [],
        installTimeStatus: "none-declared-for-this-generated-artifact",
      },
      routing: {
        routes: [
          {
            id: "flux-dependency-order",
            status: "generated-not-live",
            note: "AICR generated Flux dependsOn relationships for the component order. This repo has not reconciled the bundle on a live target.",
          },
          {
            id: "flux-external-artifact",
            status: "generated-not-live",
            note: "Two local charts use ArtifactGenerator and ExternalArtifact. Flux must run source-watcher and enable ExternalArtifact on helm-controller.",
          },
          {
            id: "flux-oci-source",
            status: "not-run",
            note: `The target needs an OCIRepository named ${fluxRequirements.source.name} in ${fluxRequirements.source.namespace} that points at the published AICR artifact.`,
          },
        ],
        targetFacts: {
          platform: "EKS",
          accelerator: "H100",
          operatingSystem: "Ubuntu",
          flux: {
            minimumVersion: fluxRequirements.minimumVersion,
            controllers: fluxRequirements.controllers,
            featureGates: fluxRequirements.featureGates,
            source: fluxRequirements.source,
          },
        },
        sourceRecord: recipePath,
      },
      delivery: {
        literalConfigOci: {
          status: "local-only",
          localDigest: receipt.spec.oci.localManifestDigest,
          localPush: receipt.status.localOciPush,
          localPull: receipt.status.localOciPull,
          publicPush: receipt.status.publicOciPush,
          publicPull: receipt.status.publicOciPull,
          plannedRef: publicOciRef,
        },
        configHubReleaseOci: {
          status: "not-run",
        },
        configHubUpload: {
          status: receipt.status.configHubUpload,
          receipt: receipt.spec.outputs.configHubUploadReceipt,
        },
        argoCd: "not-generated",
        flux: "oci-bundle-generated-local-pull-pass-not-live",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "approvalRequired",
        approvalReason: "system-configuration",
      },
      evidence: {
        generationReceipt: receiptPath,
        recipe: recipePath,
        checksums: checksumsPath,
        localOciManifest: localOciManifestPath,
        originalGitBundle: receipt.spec.outputs.bundle,
      },
      operations: {
        resourceClass: "system-configuration",
        ownerClass: "platform-team",
        changeCadence: "planned-platform-release",
      },
    },
    status: {
      level: "partial",
      claim: `AICR v0.14.0 generated the committed recipe and OCI-oriented Flux bundle. All ${objects.length} Kubernetes objects and every bundle file are recorded; the artifact was pushed to and pulled from a temporary local registry at ${receipt.spec.oci.localManifestDigest}.`,
      limits: [
        "The OCI artifact has not been published to the public Google Artifact Registry target.",
        "The bundle has not been uploaded to ConfigHub.",
        "Flux needs the recorded source-watcher controller, ExternalArtifact feature gate, and OCIRepository before this bundle can reconcile.",
        "No live Flux or GPU-cluster reconciliation is claimed.",
        "The older Git-oriented bundle is kept as separate evidence and still contains its recorded YOUR_ORG/YOUR_REPO placeholder.",
      ],
    },
  };
}

function buildAicrArgoCdRecord() {
  const root = "examples/aicr/eks-h100-training-kubeflow";
  const receiptPath = `${root}/argocd-oci-receipt.yaml`;
  const uploadReceiptPath = `${root}/confighub-upload-receipt.yaml`;
  const publicReceiptPath = `${root}/public-oci-receipt.yaml`;
  const receipt = readYaml(join(repoRoot, receiptPath));
  const uploadReceipt = readYaml(join(repoRoot, uploadReceiptPath));
  const promotionProof = readYaml(aicrPersistentPromotionReceiptPath);
  const publicReceipt = existsSync(join(repoRoot, publicReceiptPath))
    ? readYaml(join(repoRoot, publicReceiptPath))
    : null;
  const publicPassed = publicReceipt?.status?.result === "pass";
  const generationReceipt = readYaml(join(repoRoot, receipt.spec.source.generationReceipt));
  const bundlePath = receipt.spec.outputs.renderedApplications;
  const checksumsPath = receipt.spec.outputs.renderedChecksums;
  const objects = objectsInDirectory(join(repoRoot, bundlePath), { includeTemplates: true });
  check(objects.length === 17, `expected 17 rendered AICR Argo CD Applications, found ${objects.length}`);
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
      labels: {
        sourceType: "aicr",
        component: "aicr-eks-h100-training-kubeflow",
        sourceVersion: "v0.14.0",
        base: "argocd",
      },
    },
    spec: {
      source: {
        type: "aicr",
        name: "eks-h100-training-kubeflow",
        version: "v0.14.0",
        record: receiptPath,
        packageOciRef: publicPassed ? receipt.spec.artifacts.sourcePackage.publicTarget : "",
      },
      baseVariant: {
        name: "argocd",
        revision: "generated-v0.14.0",
        digest: sha256File(join(repoRoot, checksumsPath)),
      },
      configuration: {
        format: "argocd-application-yaml",
        objects: bundlePath,
        inventory: checksumsPath,
        objectCount: objects.length,
      },
      inputs: {
        fixedAtBuildTime: [
          ...Object.entries(generationReceipt.spec.criteria).map(([key, value]) => `${key}=${value}`),
          ...Object.entries(receipt.spec.generationInputs).map(([key, value]) => `${key}=${value}`),
          ...Object.entries(receipt.spec.renderInputs).map(([key, value]) => `${key}=${value}`),
        ],
        installTime: [],
        installTimeStatus: "none-declared-for-the-rendered-applications",
      },
      routing: {
        routes: [
          {
            id: "argocd-sync-waves",
            status: "generated-not-live",
            note: "AICR assigned the 16 component Applications to sync waves 0 through 15.",
          },
          {
            id: "argocd-source-package",
            status: publicPassed ? "published" : "local-only",
            note: publicPassed
              ? "The parent and two path-based child Applications refer to the public AICR Helm source package at its recorded version and digest."
              : "The parent and two path-based child Applications need the AICR Helm source package at the recorded OCI repository and revision.",
          },
        ],
        targetFacts: {
          platform: "EKS",
          accelerator: "H100",
          operatingSystem: "Ubuntu",
          argoCd: {
            required: true,
            applicationNamespace: "argocd",
            ociHelmSourceRequired: true,
          },
        },
        sourceRecord: receipt.spec.source.recipe,
      },
      delivery: {
        sourcePackageOci: {
          status: publicPassed ? "public-anonymous-pull-proved" : "local-only",
          localDigest: receipt.spec.artifacts.sourcePackage.portableDigest,
          plannedRef: receipt.spec.artifacts.sourcePackage.publicTarget,
          ociLayout: receipt.spec.artifacts.sourcePackage.ociLayout,
        },
        literalConfigOci: {
          status: publicPassed ? "public-anonymous-pull-proved" : "local-only",
          localDigest: receipt.spec.artifacts.literalConfiguration.digest,
          localPush: receipt.status.renderedLocalPush,
          localPull: receipt.status.renderedLocalPull,
          plannedRef: receipt.spec.artifacts.literalConfiguration.publicTarget,
          ociLayout: receipt.spec.artifacts.literalConfiguration.ociLayout,
        },
        configHubReleaseOci: {
          status: "base-variant-uploaded",
          sourceRef: uploadReceipt.spec.source.reference,
          sourceDigest: uploadReceipt.spec.source.digest,
          receipt: uploadReceiptPath,
        },
        argoCd: "applications-uploaded-not-reconciled",
        flux: "not-applicable-to-this-base",
      },
      promotion: {
        status: promotionProof.status.result,
        receipt: relativeRepo(aicrPersistentPromotionReceiptPath),
        path: promotionProof.spec.promotion.path,
        sourceDigest: promotionProof.spec.source.literalConfiguration.digest,
        changedApplications: [promotionProof.spec.change.resource],
        devDryRun: promotionProof.spec.change.preview.result,
        stagingDryRun: promotionProof.spec.promotion.preview.result,
        stagingMatchesReviewedDev: promotionProof.spec.promotion.stagingMatchesDevelopment,
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "approvalRequired",
        approvalReason: "system-configuration",
      },
      evidence: {
        generationReceipt: receiptPath,
        sourceChecksums: receipt.spec.outputs.sourceChecksums,
        renderedChecksums: receipt.spec.outputs.renderedChecksums,
        sourceManifest: receipt.spec.outputs.sourceManifest,
        renderedManifest: receipt.spec.outputs.renderedManifest,
        configHubUploadReceipt: uploadReceiptPath,
        variantPromotionReceipt: relativeRepo(aicrPersistentPromotionReceiptPath),
        scratchPromotionReceipt: relativeRepo(aicrPromotionReceiptPath),
        ...(publicPassed ? { publicOciReceipt: publicReceiptPath } : {}),
      },
      operations: {
        resourceClass: "system-configuration",
        ownerClass: "platform-team",
        changeCadence: "planned-platform-release",
      },
    },
    status: {
      level: "partial",
      claim: `AICR v0.14.0 generated a portable Argo CD Helm source package and ${objects.length} literal Application objects. ConfigHub imported those exact Applications from the recorded OCI digest, kept one reviewed Grafana Secret change in development, and promoted the same configuration to staging.`,
      limits: [
        ...(publicPassed
          ? ["The two public OCI artifacts were anonymously pulled at their recorded digests."]
          : ["The source package and literal configuration OCI artifacts have not been published to their public Google Artifact Registry targets."]),
        "The persistent helm-catalog demo contains the base, development, and staging Spaces. Exactly one Application changes in development and staging.",
        "No live Argo CD or GPU-cluster reconciliation is claimed.",
        "The target must provide monitoring/aicr-grafana-admin with the expected user and password keys.",
      ],
    },
  };
}

function buildAicrV019ArgoCdRecord() {
  const root = "examples/aicr/eks-h100-training-kubeflow-v0-19-0";
  const generationPath = `${root}/generation-receipt.yaml`;
  const routePath = `${root}/route-intent.yaml`;
  const fieldPolicyPath = `${root}/field-policy-assessment.yaml`;
  const verdictPath = `${root}/flattening-safety-verdict.yaml`;
  const indexPath = `${root}/digest-index/platform-index.json`;
  const publicReceiptPath = `${root}/public-oci-receipt.yaml`;
  const uploadReceiptPath = `${root}/confighub-upload-receipt.yaml`;
  const policyReceiptPath = `${root}/apply-policy-receipt.yaml`;
  const promotionReceiptPath = `${root}/promotion-readiness-receipt.yaml`;
  const releaseOciReceiptPath = `${root}/confighub-release-oci-receipt.yaml`;
  const nestedSourcesPath = "data/aicr-v0-19-0-nested-sources/summary.md";
  const routeResolutionPath =
    "data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml";
  const generation = readYaml(join(repoRoot, generationPath));
  const routeIntent = readYaml(join(repoRoot, routePath));
  const platformIndex = JSON.parse(readFileSync(join(repoRoot, indexPath), "utf8"));
  const publicReceipt = existsRepo(publicReceiptPath)
    ? readYaml(join(repoRoot, publicReceiptPath))
    : null;
  const uploadReceipt = existsRepo(uploadReceiptPath)
    ? readYaml(join(repoRoot, uploadReceiptPath))
    : null;
  const policyReceipt = existsRepo(policyReceiptPath)
    ? readYaml(join(repoRoot, policyReceiptPath))
    : null;
  const promotionReceipt = existsRepo(promotionReceiptPath)
    ? readYaml(join(repoRoot, promotionReceiptPath))
    : null;
  const releaseOciReceipt = existsRepo(releaseOciReceiptPath)
    ? readYaml(join(repoRoot, releaseOciReceiptPath))
    : null;
  const publicPassed = publicReceipt?.status?.result === "pass"
    && publicReceipt?.status?.anonymousPull === "pass";
  const uploadPassed = uploadReceipt?.status?.configHubBaseVariantUpload === "pass";
  const promotionPassed = promotionReceipt?.status?.result === "pass";
  const policyPassed = policyReceipt?.status?.requiredApprovalBlockedReleasePublish === "pass";
  const releaseOciPassed = releaseOciReceipt?.status?.result === "pass"
    && releaseOciReceipt?.status?.registryPull === "pass"
    && releaseOciReceipt?.status?.promotedConfigurationMatched === "pass";
  const sourcePackage = generation.spec.processing.transport.sourcePackage;
  const literalConfiguration = generation.spec.processing.transport.literalConfiguration;
  const applicationsRoot = `${root}/argocd-rendered`;
  const inventoryPath = `${root}/argocd-rendered/checksums.txt`;
  const objects = objectsInDirectory(join(repoRoot, applicationsRoot), { includeTemplates: true });
  check(objects.length === 17, `expected 17 AICR v0.19.0 Applications, found ${objects.length}`);
  check(
    platformIndex.spec?.platformDigest,
    "AICR v0.19.0 platform digest is missing",
  );

  const targetRequirements = routeIntent.spec.targetFacts.map((detail, index) => ({
    category: "target-fact",
    name: `aicr-target-fact-${index + 1}`,
    purpose: detail,
  }));
  const routeRows = routeIntent.spec.routes.map((route) => ({
    routeName: route.id,
    lifecyclePhase: "destination-resolution",
    actionKind: "resolve-lifecycle-work",
    executionMode: "destination-specific",
    automatic: false,
    whoRuns: route.owner,
    operatingDetails: route.lifecycleWork,
    disposition: route.status,
    evidenceRequired: route.evidenceRequired,
    order: route.order,
    evidence: [routePath],
  }));

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-19-0-argocd",
      labels: {
        sourceType: "aicr",
        component: "aicr-eks-h100-training-kubeflow",
        sourceVersion: "v0.19.0",
        base: "argocd",
      },
    },
    spec: {
      source: {
        type: "aicr",
        name: "eks-h100-training-kubeflow",
        version: "v0.19.0",
        record: generationPath,
        packageOciRef: publicPassed
          ? "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd:0.19.0"
          : "",
      },
      baseVariant: {
        name: "argocd",
        revision: "generated-v0.19.0",
        digest: String(platformIndex.spec.platformDigest).replace(/^sha256:/, ""),
      },
      configuration: {
        format: "argocd-application-yaml",
        objects: applicationsRoot,
        inventory: inventoryPath,
        objectCount: objects.length,
      },
      inputs: {
        fixedAtBuildTime: [
          ...Object.entries(generation.spec.sourceAndIntent.criteria)
            .map(([key, value]) => `${key}=${value}`),
          ...Object.entries(generation.spec.sourceAndIntent.generationInputs)
            .map(([key, value]) => `${key}=${value}`),
          "deployer=argocd-helm",
        ],
        installTime: targetRequirements,
        installTimeStatus: "destination-facts-recorded-not-run",
      },
      routing: {
        routes: routeRows,
        targetFacts: {
          platform: "EKS",
          accelerator: "H100",
          operatingSystem: "Ubuntu",
          requirements: targetRequirements,
        },
        sourceRecord: routePath,
      },
      delivery: {
        sourcePackageOci: {
          status: publicPassed ? "public-anonymous-pull-proved" : "local-layout-verified",
          localDigest: sourcePackage.digest,
          plannedRef:
            "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd:0.19.0",
          ociLayout: sourcePackage.ociLayout,
          ...(publicPassed ? { receipt: publicReceiptPath } : {}),
        },
        literalConfigOci: {
          status: publicPassed ? "public-anonymous-pull-proved" : "local-layout-verified",
          localDigest: literalConfiguration.digest,
          plannedRef:
            "oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.19.0",
          ociLayout: literalConfiguration.ociLayout,
          ...(publicPassed ? { receipt: publicReceiptPath } : {}),
        },
        configHubUpload: {
          status: uploadPassed ? "pass" : "not-run",
          ...(uploadPassed
            ? {
                sourceRef: uploadReceipt.spec.source.reference,
                sourceOciDigest: uploadReceipt.spec.source.digest,
                configHubDataHash: uploadReceipt.spec.unit.dataHash,
                objectIdentitiesMatched:
                  uploadReceipt.spec.provenanceBinding.objectIdentitiesMatched,
                bindingMethod: uploadReceipt.spec.provenanceBinding.method,
                receipt: uploadReceiptPath,
              }
            : {}),
        },
        configHubReleaseOci: {
          status: releaseOciPassed
            ? "published-and-pulled-by-digest"
            : policyPassed
              ? "not-published-approval-required"
              : "not-run",
          ...(releaseOciPassed
            ? {
                reference: releaseOciReceipt.spec.release.reference,
                manifestDigest: releaseOciReceipt.spec.release.manifestDigest,
                bundleDigest: releaseOciReceipt.spec.release.bundleDigest,
                promotedConfigurationMatched: true,
                receipt: releaseOciReceiptPath,
              }
            : policyPassed
            ? {
                policyReceipt: policyReceiptPath,
                reason: "The required approval was absent, so ConfigHub refused release publication.",
              }
            : {}),
        },
        argoCd: "applications-retained-not-reconciled",
        flux: "not-run-for-argo-application-wrapper",
      },
      ...(promotionPassed
        ? {
            promotion: {
              status: "pass",
              receipt: promotionReceiptPath,
              path: promotionReceipt.spec.promotion.path,
              sourceDigest: promotionReceipt.spec.source.literalConfiguration.digest,
              changedApplications: [promotionReceipt.spec.change.resource],
              devDryRun: promotionReceipt.spec.change.preview.result,
              stagingDryRun: promotionReceipt.spec.promotion.preview.result,
              stagingMatchesReviewedDev:
                promotionReceipt.spec.promotion.stagingMatchesDevelopment,
            },
          }
        : {}),
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "approvalRequired",
        approvalReason: "system-configuration",
      },
      evidence: {
        sourceGenerationReceipt: generationPath,
        sourceProvenance: "runs/aicr-provenance-v0-19-0/receipt.yaml",
        digestIndex: indexPath,
        flatteningVerdict: verdictPath,
        routeIntent: routePath,
        fieldPolicy: fieldPolicyPath,
        ...(publicPassed ? { publicOciReceipt: publicReceiptPath } : {}),
        ...(uploadPassed ? { configHubUploadReceipt: uploadReceiptPath } : {}),
        ...(policyPassed ? { applyPolicyReceipt: policyReceiptPath } : {}),
        ...(promotionPassed ? { variantPromotionReceipt: promotionReceiptPath } : {}),
        ...(releaseOciPassed ? { configHubReleaseOciReceipt: releaseOciReceiptPath } : {}),
        ...(existsRepo(nestedSourcesPath) ? { nestedSourceRenders: nestedSourcesPath } : {}),
        ...(existsRepo(routeResolutionPath) ? { stagingRouteResolution: routeResolutionPath } : {}),
      },
      operations: {
        resourceClass: "system-configuration",
        ownerClass: "platform-team",
        changeCadence: "planned-platform-release",
      },
    },
    status: {
      level: "partial",
      claim: publicPassed && uploadPassed && promotionPassed && releaseOciPassed
        ? "AICR v0.19.0 produced 17 exact Argo CD Applications. Their source and literal OCI artifacts are publicly pullable. ConfigHub retained those Applications, promoted one reviewed change to staging, and published the approved staging result as a release OCI that was pulled and compared by digest."
        : "AICR v0.19.0 produced 17 exact Argo CD Applications with signed source provenance, a scoped flattening verdict, lifecycle route intent, field ownership assessment, and two verified local OCI layouts.",
      limits: [
        publicPassed
          ? "Both OCI artifacts were anonymously pulled at their recorded digests."
          : "The two OCI layouts are verified locally but have not yet been published at their public references.",
        uploadPassed
          ? `ConfigHub recorded the literal OCI digest and its separate Unit data hash ${uploadReceipt.spec.unit.dataHash}; the upload receipt binds them by exact-object comparison.`
          : "This v0.19.0 base has not yet been uploaded to ConfigHub.",
        promotionPassed
          ? "The persistent development and staging variants contain the one reviewed Grafana Secret-reference change."
          : "No v0.19.0 derived-variant promotion has run.",
        policyPassed
          ? "The required-approval gate refused to publish an unapproved ConfigHub release."
          : "The ConfigHub apply policy has not been tested for this v0.19.0 base.",
        releaseOciPassed
          ? "After approval, ConfigHub published the staging release OCI; an authenticated pull resolved the exact manifest digest and matched the promoted 17-Application object set."
          : "No approved ConfigHub release OCI has been pulled and compared for this version.",
        existsRepo(nestedSourcesPath)
          ? "All 16 nested component sources rendered locally; eight rendered CRDs. Their destination-specific lifecycle handling still requires runtime evidence."
          : "The 16 nested component sources have not been materialized and recorded separately.",
        "Argo CD reconciliation, EKS, H100 execution, training, model requests, and exact runtime rollback have not run for this version.",
      ],
    },
  };
}

function buildTimoniRecord() {
  const root = "examples/timoni/redis-8-10-1";
  const sourcePath = `${root}/source-lock.yaml`;
  const receiptPath = `${root}/generation-receipt.yaml`;
  const lifecyclePath = `${root}/lifecycle-route-intent.yaml`;
  const flatteningPath = `${root}/flattening-safety-verdict.yaml`;
  const publicOciReceiptPath =
    "runs/timoni-redis-catalog-proof/public-oci-receipt.yaml";
  const configHubReceiptPath =
    "runs/timoni-redis-catalog-proof/confighub-receipt.yaml";
  const source = readYaml(join(repoRoot, sourcePath));
  const receipt = readYaml(join(repoRoot, receiptPath));
  const lifecycle = readYaml(join(repoRoot, lifecyclePath));
  const publicOciReceipt = existsRepo(publicOciReceiptPath)
    ? readYaml(join(repoRoot, publicOciReceiptPath))
    : null;
  const configHubReceipt = existsRepo(configHubReceiptPath)
    ? readYaml(join(repoRoot, configHubReceiptPath))
    : null;
  const publicOciPassed = publicOciReceipt?.status?.result === "pass"
    && publicOciReceipt?.spec?.artifact?.anonymousPull === "pass";
  const configHubPassed = configHubReceipt?.status?.result === "pass"
    && configHubReceipt?.status?.import === "pass"
    && configHubReceipt?.status?.derivedVariant === "pass";
  const sourceSpec = source.spec.source;
  const output = receipt.spec.output;
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "timoni-redis-8-10-1-default",
      labels: {
        sourceType: "timoni",
        component: "redis",
        sourceVersion: sourceSpec.version,
        base: "default",
      },
    },
    spec: {
      source: {
        type: "timoni",
        name: "redis",
        version: sourceSpec.version,
        record: sourcePath,
        packageOciRef: `${sourceSpec.module}@${sourceSpec.manifestDigest}`,
      },
      baseVariant: {
        name: "default",
        revision: "materialized-r001",
        digest: sourceSpec.manifestDigest.replace(/^sha256:/, ""),
        digestRole: "source-module-oci-manifest",
        digestRecord: sourcePath,
      },
      configuration: {
        format: "kubernetes-yaml",
        objects: `${root}/rendered/release-objects.yaml`,
        inventory: `${root}/rendered/object-inventory.json`,
        objectCount: Number(output.objectCount),
        digest: output.objectSetSha256,
        digestRole: "canonical-object-set",
        digestRecord: receiptPath,
      },
      inputs: {
        fixedAtBuildTime: [
          `module=${sourceSpec.module}@${sourceSpec.manifestDigest}`,
          `moduleVersion=${sourceSpec.version}`,
          "instance=redis",
          "namespace=redis",
          `values=${root}/selected-values.cue`,
          `schema=${root}/config-schema.cue`,
        ],
        installTime: [
          {
            name: "redis namespace",
            value: "redis",
            status: "required-not-live-checked",
          },
          {
            name: "Kubernetes version",
            value: "1.20.0 or newer",
            status: "required-not-live-checked",
          },
          {
            name: "StorageClass",
            value: "standard",
            status: "required-not-live-checked",
          },
        ],
        installTimeStatus: "three destination facts recorded; no destination selected",
      },
      routing: {
        routes: lifecycle.spec.routes,
        targetFacts: lifecycle.spec.targetFacts,
        sourceRecord: lifecyclePath,
      },
      delivery: {
        sourcePackageOci: {
          status: "immutable-public-source",
          reference: sourceSpec.module,
          digest: sourceSpec.manifestDigest,
        },
        literalConfigOci: {
          status: publicOciPassed
            ? "public-anonymous-pull-proved"
            : "not-published",
          ...(publicOciPassed
            ? {
                reference: publicOciReceipt.spec.artifact.immutableReference,
                manifestDigest: publicOciReceipt.spec.artifact.digest,
                objectSetSha256: publicOciReceipt.spec.artifact.objectSetSha256,
                receipt: publicOciReceiptPath,
              }
            : {}),
        },
        configHubUpload: {
          status: configHubPassed
            ? "base-and-development-variant-retained"
            : "not-run",
          ...(configHubPassed
            ? {
                sourceRef: configHubReceipt.spec.source.immutableReference,
                sourceObjectSetSha256:
                  configHubReceipt.spec.source.objectSetSha256,
                baseSpace: configHubReceipt.spec.base.slug,
                developmentSpace: configHubReceipt.spec.development.slug,
                linkedUnits:
                  configHubReceipt.spec.variantRelationship.linkedUnits,
                objectChange:
                  configHubReceipt.spec.variantRelationship.objectChange,
                receipt: configHubReceiptPath,
              }
            : {}),
        },
        configHubReleaseOci: {
          status: "not-run",
        },
        argoCd: "not-run",
        flux: "not-run",
        direct: "not-run",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "baseline",
      },
      evidence: {
        sourceLock: sourcePath,
        selectedValues: `${root}/selected-values.cue`,
        configSchema: `${root}/config-schema.cue`,
        renderedObjects: `${root}/rendered/release-objects.yaml`,
        objectInventory: `${root}/rendered/object-inventory.json`,
        materializationReceipt: receiptPath,
        lifecycleRouteIntent: lifecyclePath,
        flatteningVerdict: flatteningPath,
        readme: `${root}/README.md`,
        ...(publicOciPassed ? { publicOciReceipt: publicOciReceiptPath } : {}),
        ...(configHubPassed ? { configHubReceipt: configHubReceiptPath } : {}),
      },
      operations: {
        resourceClass: "user-workload",
        ownerClass: "application-team",
        changeCadence: "application-release",
      },
    },
    status: {
      level: "partial",
      claim: publicOciPassed && configHubPassed
        ? "The immutable Timoni Redis 8.10.1 module produced seven exact Kubernetes objects. The objects and their companion records are publicly pullable in one OCI. ConfigHub retained the same object set as a base and a linked development variant."
        : "The immutable Timoni Redis 8.10.1 module produced seven exact Kubernetes objects in a local, cluster-free build. Its typed options, selected defaults, object digest, master-first lifecycle, and destination requirements are retained together.",
      limits: [
        "Kubernetes schema validation, admission, apply, workload health, upgrade, and rollback have not been run for this entry.",
        publicOciPassed
          ? "The literal configuration OCI was anonymously pulled and compared with the recorded object set."
          : "No literal configuration OCI is recorded.",
        configHubPassed
          ? "ConfigHub retained a linked development variant with no Kubernetes field change; no destination was selected."
          : "No ConfigHub revision is recorded.",
        "No ConfigHub release OCI, Argo CD result, or Flux result is recorded.",
        "The output labels report app.kubernetes.io/version=0.0.0-devel; the source lock's version and immutable digest remain the source identity.",
      ],
    },
  };
}

function buildKubaraRecord() {
  const root = "examples/kubara/local-platform";
  const receiptPath = `${root}/generation-receipt.yaml`;
  const routePath = `${root}/route-intent.yaml`;
  const receipt = readYaml(join(repoRoot, receiptPath));
  const route = readYaml(join(repoRoot, routePath));
  const publicTarget = receipt.spec.artifacts.literalConfiguration.publicTarget;
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "kubara-local-platform-v0-12-0-base",
      labels: {
        sourceType: "kubara",
        component: "kubara-local-platform",
        sourceVersion: "v0.12.0",
        base: "base",
      },
    },
    spec: {
      source: {
        type: "kubara",
        name: "local-platform",
        version: "v0.12.0",
        record: receiptPath,
        packageOciRef: "",
      },
      baseVariant: {
        name: "base",
        revision: "generated-v0.12.0",
        digest: receipt.spec.outputs.literalConfigOciDigest,
      },
      configuration: {
        format: "kubara-argocd-bootstrap-yaml",
        objects: receipt.spec.outputs.renderedObjects,
        inventory: receipt.spec.outputs.renderedInventory,
        objectCount: Number(receipt.spec.outputs.objectCount),
      },
      inputs: {
        fixedAtBuildTime: [
          `cluster=${receipt.spec.generationInputs.cluster}`,
          `stage=${receipt.spec.generationInputs.stage}`,
          `clusterType=${receipt.spec.generationInputs.clusterType}`,
          `enabledServices=${receipt.spec.generationInputs.enabledServices.join(",")}`,
          `helmKubeVersion=${receipt.spec.generationInputs.helmKubeVersion}`,
          "releaseName=kubara-platform",
          "namespace=argocd",
        ],
        installTime: [
          "Argo CD target cluster",
          "External Secrets ClusterExternalSecret CRD",
          "ClusterSecretStore=test-cluster-local",
          "remote image-pull key when private images are used",
          "approved handling for argocd-secret and cluster-kubernetes.default.svc",
        ],
        installTimeStatus: "declared-not-live-checked",
      },
      routing: {
        routes: route.spec.routes,
        targetFacts: {
          clusterName: receipt.spec.generationInputs.cluster,
          clusterType: receipt.spec.generationInputs.clusterType,
          requiredApis: [
            "apiextensions.k8s.io/v1",
            "external-secrets.io/v1",
          ],
          requiredSecretStore: "test-cluster-local",
        },
        sourceRecord: routePath,
      },
      delivery: {
        literalConfigOci: {
          status: receipt.status.publicOciPull === "pass" ? "public-pull-pass" : "local-only",
          localDigest: receipt.spec.outputs.literalConfigOciDigest,
          localLayout: receipt.spec.outputs.literalConfigOciLayout,
          localPush: receipt.status.localRegistryPush,
          localPull: receipt.status.localRegistryPull,
          publicPush: receipt.status.publicOciPush,
          publicPull: receipt.status.publicOciPull,
          plannedRef: publicTarget,
        },
        configHubReleaseOci: {
          status: "not-run",
        },
        argoCd: receipt.status.liveArgoReconciliation,
        flux: "not-applicable-to-this-base",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "approvalRequired",
        approvalReason: "system-configuration",
      },
      evidence: {
        generationReceipt: receiptPath,
        sourceLock: `${root}/source-lock.yaml`,
        generatedChecksums: receipt.spec.outputs.generatedChecksums,
        renderedChecksums: receipt.spec.outputs.renderedChecksums,
        routeIntent: routePath,
        localOciManifest: receipt.spec.outputs.literalConfigOciManifest,
        configHubUploadReceipt: receipt.spec.outputs.configHubUploadReceipt,
      },
      operations: {
        resourceClass: "system-configuration",
        ownerClass: "platform-team",
        changeCadence: "planned-platform-release",
      },
    },
    status: {
      level: "partial",
      claim: `Kubara v0.12.0 generated the committed platform source and ${receipt.spec.outputs.objectCount} literal Argo CD bootstrap objects. The routes for ${receipt.spec.routing.crds} CRDs, ${receipt.spec.routing.helmHookObjects} Helm hook resources, ${receipt.spec.routing.renderedSecrets} Secrets, and the External Secrets prerequisite are recorded beside the base.`,
      limits: [
        "The literal OCI artifact is local until the public push and anonymous pull receipts pass.",
        "The recorded routes have not been executed on a live target.",
        "No live Argo CD reconciliation or downstream platform health is claimed.",
        "This base records the generated Argo CD bootstrap and platform assignments; it does not claim that every downstream service chart has been flattened into this one object set.",
      ],
    },
  };
}

function buildSveltosRecord() {
  const root = "examples/sveltos/kyverno-fleet";
  const objectPath = `${root}/clusterprofile.yaml`;
  const pilotProfilePath = `${root}/clusterprofile-pilot.yaml`;
  const sourceLockPath = `${root}/source-lock.yaml`;
  const receiptPath = `${root}/live-receipt.yaml`;
  const receipt = readYaml(join(repoRoot, receiptPath));
  const ociReceiptPath = "runs/sveltos-oci-delivery-proof/receipt.yaml";
  const ociReceipt = readYaml(join(repoRoot, ociReceiptPath));
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "sveltos-kyverno-fleet-3-8-1-staging",
      labels: {
        sourceType: "sveltos",
        component: "kyverno-fleet",
        sourceVersion: "v1.12.0",
        base: "staging",
      },
    },
    spec: {
      source: {
        type: "sveltos",
        name: "kyverno-fleet",
        version: "v1.12.0",
        record: sourceLockPath,
        packageOciRef: "",
      },
      baseVariant: {
        name: "staging",
        revision: "live-r001",
        digest: receipt.spec.source.rawSha256,
      },
      configuration: {
        format: "sveltos-clusterprofile-yaml",
        objects: objectPath,
        inventory: "",
        objectCount: parseObjects(readFileSync(join(repoRoot, objectPath), "utf8")).length,
      },
      inputs: {
        fixedAtBuildTime: [
          "sveltos=v1.12.0",
          "chart=kyverno/kyverno",
          "version=3.8.1",
          "clusterSelector=environment=staging",
          "syncMode=ContinuousWithDriftDetection",
          "admissionController.replicas=3",
        ],
        installTime: [
          {
            name: "management cluster",
            value: "Kubernetes v1.35.0 with Sveltos v1.12.0",
            status: "live-pass",
          },
          {
            name: "workload cluster registration",
            value: "SveltosCluster labeled environment=staging",
            status: "live-pass",
          },
        ],
        installTimeStatus: "declared",
      },
      routing: {
        routes: [
          {
            id: "confighub-to-management-cluster",
            status: "live-pass",
            note: "The current receipt records two approved ConfigHub revisions, two portable OCI digests, and Argo CD reconciliation on the management cluster.",
          },
          {
            id: "sveltos-cluster-selection",
            status: "live-pass",
            note: "Sveltos selected the rollout=pilot cluster first. Removing that one selector in the second approved revision selected both staging clusters.",
          },
          {
            id: "sveltos-helm-reconciliation",
            status: "live-pass",
            note: "Sveltos installed Kyverno 3.8.1 and reported the Helm feature as Provisioned on both targets.",
          },
          {
            id: "sveltos-drift-recovery",
            status: "live-pass",
            note: "After the admission-controller replica count was changed from three to one on each target, Sveltos restored both to three.",
          },
        ],
        targetFacts: {
          managementClusterRequiresSveltos: true,
          managementKubernetesVersion: receipt.spec.management.kubernetesVersion,
          sveltosVersion: receipt.spec.management.sveltosVersion,
          selectedClusterLabel: "environment=staging",
          workloadKubernetesVersion: receipt.spec.workload.kubernetesVersion,
        },
        sourceRecord: receiptPath,
      },
      delivery: {
        literalConfigOci: {
          status: "temporary-pass",
          pilotDigest: ociReceipt.spec.configHubReview.pilot.portableRelease.manifestDigest,
          fleetDigest: ociReceipt.spec.configHubReview.fleet.portableRelease.manifestDigest,
        },
        configHubReleaseOci: {
          status: "private-pass",
          pilotDigest: ociReceipt.spec.configHubReview.pilot.privateRelease.manifestDigest,
          fleetDigest: ociReceipt.spec.configHubReview.fleet.privateRelease.manifestDigest,
        },
        argoCd: "live-pass-two-revisions",
        flux: "not-used-in-this-run",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "approvalRequired",
        approvalReason: "system-configuration",
      },
      evidence: {
        readme: `${root}/README.md`,
        readmeUnit: "data/helm-catalog-readmes/units/sveltos-kyverno-fleet-3-8-1-staging/readme.yaml",
        sourceLock: sourceLockPath,
        liveReceipt: receiptPath,
        pilotProfile: pilotProfilePath,
        ociDeliveryReceipt: ociReceiptPath,
        ociDeliverySummary: "data/sveltos-oci-delivery-proof/summary.md",
        configHubSpace: receipt.spec.configHub.space.slug,
        configHubUnit: receipt.spec.configHub.unit.slug,
        clusterSummary: receipt.spec.management.selectedClusterSummary,
      },
      operations: {
        resourceClass: "system-configuration",
        ownerClass: "platform-team",
        changeCadence: "planned-platform-release",
      },
    },
    status: {
      level: "partial",
      claim: "ConfigHub approved a pilot Sveltos ClusterProfile and a second selector revision at different OCI digests. Sveltos installed Kyverno 3.8.1 on the pilot first, then on both staging clusters, and restored replica drift on each target.",
      limits: [
        "Sveltos itself was installed directly as a pinned management-cluster prerequisite.",
        "The portable OCI artifacts used a temporary local registry.",
        "The live test used two local kind clusters; it did not test a large production fleet or a rollout that pauses after a failed target.",
        "The receipt proves this profile and drift test, not every Sveltos feature.",
      ],
    },
  };
}

function buildCubInstallerRecord() {
  const publicationPath =
    "runs/installer-oci/bitnami-nginx/24.0.2/installer-package-publication-receipt.yaml";
  const publication = readYaml(join(repoRoot, publicationPath));
  const intentPath = "data/helm-render-intents/intents/bitnami-nginx-24-0-2-http-clusterip.yaml";
  const intent = readYaml(join(repoRoot, intentPath));
  const revisionPath = intent.spec.renderOutput.revision;
  const revision = readYaml(join(repoRoot, revisionPath));
  const manifestDigest = String(publication.spec.outputs.push)
    .match(/manifest:\s+(sha256:[a-f0-9]{64})/)?.[1];
  check(manifestDigest, "the NGINX installer publication receipt has no manifest digest");

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "cub-installer-bitnami-nginx-24-0-2-http-clusterip",
      labels: {
        sourceType: "cub-installer",
        component: "bitnami/nginx",
        sourceVersion: "24.0.2",
        base: "http-clusterip",
      },
    },
    spec: {
      source: {
        type: "cub-installer",
        name: "bitnami/nginx",
        version: "24.0.2",
        record: publicationPath,
        packageOciRef: publication.spec.ref,
      },
      baseVariant: {
        name: "http-clusterip",
        revision: "r001",
        digest: manifestDigest.replace(/^sha256:/, ""),
        digestRole: "source-package-oci-manifest",
        digestRecord: publicationPath,
      },
      configuration: {
        format: "kubernetes-yaml",
        objects: intent.spec.renderOutput.renderedObjects,
        inventory: intent.spec.renderOutput.objectInventory,
        objectCount: Number(revision.spec.rendered.objectCount),
        digest: revision.spec.digestInputs.renderedObjectSetSHA256,
        digestRole: "canonical-object-set",
        digestRecord: revisionPath,
      },
      inputs: {
        fixedAtBuildTime: [
          `sourcePackage=${publication.spec.ref}@${manifestDigest}`,
          "preset=http-clusterip",
          "releaseName=nginx",
          "namespace=nginx",
          "kubeVersion=1.30.0",
        ],
        installTime: [],
        installTimeStatus: "target facts require review before delivery",
      },
      routing: {
        routes: intent.spec.lifecycle.variantRoutes ?? [],
        targetFacts: intent.spec.targetFacts,
        sourceRecord: intentPath,
      },
      delivery: {
        sourcePackageOci: {
          status: "public",
          reference: publication.spec.ref,
          digest: manifestDigest,
          receipt: publicationPath,
        },
        literalConfigOci: {
          status: "not-published-for-this-five-object-base",
        },
        configHubReleaseOci: {
          status: "separately-proved-with-an-added-Namespace",
        },
        argoCd: "separately-proved-with-an-added-Namespace",
        flux: "separately-proved-with-an-added-Namespace",
        direct: "separately-proved-with-an-added-Namespace",
        receipt: "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "baseline",
      },
      evidence: {
        packagePublication: publicationPath,
        packageDefinition: "packages/bitnami/nginx/24.0.2/installer.yaml",
        selectedIntent: intentPath,
        selectedRevision: revisionPath,
        deliveryReceipt:
          "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
      },
      operations: {
        resourceClass: "user-workload",
        ownerClass: "application-team",
        changeCadence: "application-release",
      },
    },
    status: {
      level: "partial",
      claim: "The public cub installer package selects the http-clusterip preset and reproduces its five recorded Kubernetes objects without ConfigHub Server.",
      limits: [
        "The three-consumer delivery receipt adds the requested Namespace, so its six-object digest is separate from this five-object base digest.",
        "The source package is public. A separate literal configuration OCI for this exact five-object result is not recorded.",
        "Target facts remain an explicit Catalog gap for this preset.",
      ],
    },
  };
}

function buildConfigurationOciRecord() {
  const publicReceiptPath = "runs/anonymous-oci-transform-proof/public-oci-receipt.yaml";
  const uploadReceiptPath = "runs/existing-oci-upload-proof/receipt.yaml";
  const transformReceiptPath = "runs/anonymous-oci-transform-proof/receipt.yaml";
  const publicReceipt = readYaml(join(repoRoot, publicReceiptPath));
  const uploadReceipt = readYaml(join(repoRoot, uploadReceiptPath));
  const transformReceipt = readYaml(join(repoRoot, transformReceiptPath));
  const artifact = publicReceipt.spec.artifact;

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "configuration-oci-nginx-replicas-4",
      labels: {
        sourceType: "configuration-oci",
        component: "existing-oci-nginx",
        sourceVersion: artifact.digest,
        base: "replicas-4",
      },
    },
    spec: {
      source: {
        type: "configuration-oci",
        name: "nginx-replicas-4",
        version: artifact.digest,
        record: publicReceiptPath,
        packageOciRef: artifact.immutableReference,
      },
      baseVariant: {
        name: "replicas-4",
        revision: "reviewed-r001",
        digest: artifact.digest.replace(/^sha256:/, ""),
        digestRole: "literal-configuration-oci-manifest",
        digestRecord: publicReceiptPath,
      },
      configuration: {
        format: "kubernetes-yaml",
        objects: "examples/anonymous-oci-transform/reviewed-output/manifests/release-objects.yaml",
        inventory: uploadReceiptPath,
        objectCount: Number(artifact.objectCount),
        digest: artifact.objectSetSha256,
        digestRole: "canonical-object-set",
        digestRecord: uploadReceiptPath,
      },
      inputs: {
        fixedAtBuildTime: [
          `source=${artifact.immutableReference}`,
          `artifactType=${artifact.artifactType}`,
          "change=Deployment/nginx spec.replicas 3 -> 4",
        ],
        installTime: [
          {
            category: "secret",
            name: "nginx/ai-provider-credentials",
            purpose: "The Deployment references this Secret; the credential is not stored in the public OCI.",
          },
        ],
        installTimeStatus: "one target-owned Secret recorded",
      },
      routing: {
        routes: [],
        targetFacts: {
          declared: {
            requiredSecrets: [
              {
                namespace: "nginx",
                name: "ai-provider-credentials",
              },
            ],
          },
          requirements: [
            {
              category: "secret",
              name: "nginx/ai-provider-credentials",
              requiredBefore: "apply",
              purpose: "Supply the referenced AI provider credentials before the Deployment starts.",
            },
          ],
        },
        sourceRecord: transformReceiptPath,
      },
      delivery: {
        literalConfigOci: {
          status: "public-anonymous-pull-proved",
          reference: artifact.immutableReference,
          digest: artifact.digest,
          receipt: publicReceiptPath,
        },
        configHubUpload: {
          status: "pass",
          space: uploadReceipt.spec.space.slug,
          objectSetSha256: uploadReceipt.spec.storedObjectSetSha256,
          receipt: uploadReceiptPath,
        },
        configHubReleaseOci: {
          status: "not-run-for-this-base",
        },
        argoCd: "not-run-for-this-base",
        flux: "not-run-for-this-base",
        direct: "not-run-for-this-base",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "baseline",
      },
      evidence: {
        publicOci: publicReceiptPath,
        transformation: transformReceiptPath,
        configHubUpload: uploadReceiptPath,
      },
      operations: {
        resourceClass: "user-workload",
        ownerClass: "application-team",
        changeCadence: "application-release",
      },
    },
    status: {
      level: "available",
      claim: "The public literal configuration OCI contains five exact Kubernetes objects, pulls without registry credentials, and imports into ConfigHub without rerendering Helm.",
      limits: [
        "The target must supply nginx/ai-provider-credentials.",
        "This record proves publication, anonymous pull, checks, and ConfigHub import. It does not claim delivery or workload health.",
      ],
    },
  };
}

function buildPlainYamlRecord() {
  const receiptPath = "runs/literal-yaml-upload-proof/receipt.yaml";
  const receipt = readYaml(join(repoRoot, receiptPath));
  const objectDigest = receipt.spec.source.objectSetSha256;

  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "BaseVariantRecord",
    metadata: {
      name: "kubernetes-yaml-acme-web-base",
      labels: {
        sourceType: "kubernetes-yaml",
        component: "plain-yaml-acme-web",
        sourceVersion: "source-r001",
        base: "base",
      },
    },
    spec: {
      source: {
        type: "kubernetes-yaml",
        name: "plain-yaml-acme-web",
        version: "source-r001",
        record: receiptPath,
        packageOciRef: "",
      },
      baseVariant: {
        name: "base",
        revision: "source-r001",
        digest: objectDigest,
        digestRole: "source-file-set",
        digestRecord: receiptPath,
      },
      configuration: {
        format: "kubernetes-yaml-directory",
        objects: "examples/plain-yaml/acme-web",
        inventory: receiptPath,
        objectCount: Number(receipt.spec.source.objectCount),
        digest: objectDigest,
        digestRole: "canonical-object-set",
        digestRecord: receiptPath,
      },
      inputs: {
        fixedAtBuildTime: [
          "source=examples/plain-yaml/acme-web",
          `objectSetSha256=${objectDigest}`,
        ],
        installTime: [],
        installTimeStatus: "no target facts assessed",
      },
      routing: {
        routes: [],
        targetFacts: {},
        coverage: {
          state: "actionable-gap",
        },
        sourceRecord: receiptPath,
      },
      delivery: {
        literalConfigOci: {
          status: "not-published-for-this-base",
        },
        configHubUpload: {
          status: "pass",
          space: receipt.spec.space.slug,
          objectSetSha256: receipt.spec.storedObjectSetSha256,
          receipt: receiptPath,
        },
        configHubReleaseOci: {
          status: "not-run",
        },
        argoCd: "not-run",
        flux: "not-run",
        direct: "not-run",
      },
      policy: {
        profile: "catalog-standard",
        productionAdds: ["human-approval"],
        normalSet: "baseline",
      },
      evidence: {
        source: "examples/plain-yaml/acme-web",
        configHubUpload: receiptPath,
        guide: "data/literal-config-examples/summary.md",
      },
      operations: {
        resourceClass: "user-workload",
        ownerClass: "application-team",
        changeCadence: "application-release",
      },
    },
    status: {
      level: "partial",
      claim: "ConfigHub stored the four supplied Kubernetes objects unchanged, with no render step.",
      limits: [
        "The upload receipt does not assess lifecycle requirements or target facts, so the Catalog records that work as a gap.",
        "OCI publication, deployment, promotion, and live observation have not run for this base.",
      ],
    },
  };
}

function applyOperationalClassExamples(records, source, policy) {
  const recordsByName = new Map(
    records.map((record) => [record.metadata.name, record]),
  );
  const policyByClass = new Map(
    (policy.spec?.operationalClasses ?? []).map((item) => [item.name, item]),
  );
  for (const example of source.spec?.examples ?? []) {
    const record = recordsByName.get(example.record);
    check(record, `operational example ${example.id} points at missing record ${example.record}`);
    const classPolicy = policyByClass.get(example.operations?.resourceClass);
    check(
      classPolicy,
      `operational example ${example.id} uses unknown resource class ${example.operations?.resourceClass ?? ""}`,
    );
    record.spec.operations = {
      ...example.operations,
      classificationSource: relativeRepo(operationalClassSourcePath),
      classificationReason: example.why,
      liveSpace: example.liveSpace,
      target: example.target,
      gates: example.gates,
      rollout: example.rollout,
    };
    record.spec.policy.normalSet = example.gates.normalSet;
    if (example.operations.resourceClass === "system-configuration") {
      record.spec.policy.approvalReason = "system-configuration";
    } else {
      delete record.spec.policy.approvalReason;
    }
  }
}

function validateOperationalClassExamples(records, source, policy) {
  check(
    source.apiVersion === "catalog.confighub.com/v1alpha1",
    "operational class examples apiVersion is invalid",
  );
  check(
    source.kind === "OperationalClassExamples",
    "operational class examples kind is invalid",
  );
  check(
    source.metadata?.name === "catalog-operational-classes",
    "operational class examples name is invalid",
  );
  const examples = source.spec?.examples ?? [];
  const recordsByName = new Map(
    records.map((record) => [record.metadata.name, record]),
  );
  const policyByClass = new Map(
    (policy.spec?.operationalClasses ?? []).map((item) => [item.name, item]),
  );
  check(examples.length === policyByClass.size, "operational examples must cover every resource class once");
  check(unique(examples.map((item) => item.id)), "operational example ids must be unique");
  check(unique(examples.map((item) => item.record)), "operational example records must be unique");
  check(unique(examples.map((item) => item.liveSpace)), "operational example Spaces must be unique");
  check(
    sameSet(
      examples.map((item) => item.operations?.resourceClass),
      [...policyByClass.keys()],
    ),
    "operational examples do not cover the policy resource classes exactly",
  );

  const liveReceiptPath = join(
    repoRoot,
    "data",
    "apply-policy-profiles",
    "live-helm-catalog.yaml",
  );
  check(existsSync(liveReceiptPath), "live helm-catalog policy receipt is missing");
  const liveReceipt = readYaml(liveReceiptPath);
  const baselineSpaces = new Set(liveReceipt.spec?.spaces?.baseline ?? []);
  const approvalSpaces = new Set(
    liveReceipt.spec?.spaces?.approvalRequired ?? [],
  );
  const systemConfigurationSpaces = new Set(
    liveReceipt.spec?.spaces?.approvalReasons?.systemConfiguration ?? [],
  );

  for (const example of examples) {
    check(/^[a-z0-9-]+$/.test(example.id ?? ""), `invalid operational example id ${example.id ?? ""}`);
    check(example.name && example.why, `operational example ${example.id} needs a name and reason`);
    const record = recordsByName.get(example.record);
    check(record, `operational example ${example.id} has no base-variant record`);
    check(
      supportedSourceTypes.includes(example.sourceType),
      `operational example ${example.id} has an unsupported source type`,
    );
    check(
      record.spec.source.type === example.sourceType,
      `operational example ${example.id} source type differs from its base record`,
    );
    const classPolicy = policyByClass.get(example.operations?.resourceClass);
    check(classPolicy, `operational example ${example.id} has an unknown resource class`);
    check(
      example.gates?.normalSet === classPolicy.normalPolicy
        && example.gates?.productionSet === classPolicy.productionPolicy,
      `operational example ${example.id} gate sets differ from the policy`,
    );
    check(
      example.target?.ownerClass === example.operations?.ownerClass,
      `operational example ${example.id} target owner differs from its operating owner`,
    );
    check(
      Array.isArray(example.rollout?.sequence)
        && example.rollout.sequence.length >= 2
        && example.rollout.method
        && example.rollout.status
        && example.rollout.limit,
      `operational example ${example.id} has an incomplete rollout choice`,
    );
    check(
      Array.isArray(example.evidence)
        && example.evidence.length >= 2
        && example.evidence.some((path) => path.startsWith("runs/")),
      `operational example ${example.id} needs readable evidence and a run receipt`,
    );
    for (const path of example.evidence) {
      check(existsRepo(path), `operational example ${example.id} points at missing ${path}`);
    }
    check(
      sameJson(record.spec.operations, {
        ...example.operations,
        classificationSource: relativeRepo(operationalClassSourcePath),
        classificationReason: example.why,
        liveSpace: example.liveSpace,
        target: example.target,
        gates: example.gates,
        rollout: example.rollout,
      }),
      `operational example ${example.id} was not applied to its base record`,
    );
    check(
      record.spec.policy.normalSet === example.gates.normalSet,
      `operational example ${example.id} did not select its normal gate set`,
    );
    if (example.gates.normalSet === "approvalRequired") {
      check(
        approvalSpaces.has(example.liveSpace),
        `operational example ${example.id} is not on the approval-required live filter`,
      );
    } else {
      check(
        baselineSpaces.has(example.liveSpace),
        `operational example ${example.id} is not on the baseline live filter`,
      );
    }
    if (example.operations.resourceClass === "system-configuration") {
      check(
        systemConfigurationSpaces.has(example.liveSpace),
        `operational example ${example.id} is not recorded as live system configuration`,
      );
    }
  }
}

function validateRecords(records) {
  const names = new Set();
  for (const record of records) {
    check(record.apiVersion === "catalog.confighub.com/v1alpha1", "base record apiVersion is invalid");
    check(record.kind === "BaseVariantRecord", "base record kind is invalid");
    check(record.metadata?.name, "base record name is missing");
    check(!names.has(record.metadata.name), `duplicate base record ${record.metadata.name}`);
    names.add(record.metadata.name);
    check(supportedSourceTypes.includes(record.spec?.source?.type), `${record.metadata.name} has an invalid source type`);
    check(["available", "partial", "planned"].includes(record.status?.level), `${record.metadata.name} has an invalid status`);
    check(Number.isInteger(record.spec?.configuration?.objectCount), `${record.metadata.name} has an invalid object count`);
    check(record.spec?.policy?.profile === "catalog-standard", `${record.metadata.name} is not bound to catalog-standard`);
    check(
      [
        "helm-variant-revision",
        "aicr-platform-index",
        "source-output-inventory",
        "literal-configuration-oci-manifest",
        "source-package-oci-manifest",
        "source-module-oci-manifest",
        "source-file-set",
        "confighub-space-revision",
        "source-file",
        "source-output-record",
      ].includes(record.spec?.baseVariant?.digestRole),
      `${record.metadata.name} has no base-revision digest role`,
    );
    check(
      ["canonical-object-set", "inventory-file", "literal-yaml-file"]
        .includes(record.spec?.configuration?.digestRole),
      `${record.metadata.name} has no exact-object digest role`,
    );
    check(
      /^(sha256:)?[a-f0-9]{64}$/.test(record.spec?.configuration?.digest ?? ""),
      `${record.metadata.name} has an invalid exact-object digest`,
    );
    check(
      record.spec.processing?.materialization?.outputDigest
        === record.spec.configuration.digest,
      `${record.metadata.name} materialization does not name the exact-object digest`,
    );
    check(
      ["recorded", "partial", "gap"].includes(record.spec?.processing?.sourceIntent?.status),
      `${record.metadata.name} has no source-and-intent status`,
    );
    check(
      ["captured", "recorded-no-op", "not-run", "gap"].includes(
        record.spec?.processing?.materialization?.status,
      ),
      `${record.metadata.name} has no materialization status`,
    );
    check(
      [
        "born-flattened",
        "safe-to-flatten",
        "flatten-with-routes",
        "unsafe-to-flatten",
        "not-assessed",
      ].includes(record.spec?.processing?.flattening?.verdict),
      `${record.metadata.name} has no flattening verdict`,
    );
    check(
      ["recorded", "not-required", "gap"].includes(
        record.spec?.lifecycle?.requirements?.status,
      ),
      `${record.metadata.name} has no lifecycle-requirement status`,
    );
    check(
      ["recorded", "required-at-destination", "not-required", "gap"].includes(
        record.spec?.lifecycle?.routeIntent?.status,
      ),
      `${record.metadata.name} has no route-intent status`,
    );
    check(
      [
        "awaits-variant-and-target",
        "resolved-for-recorded-targets",
        "not-required",
        "blocked",
        "gap",
      ].includes(record.spec?.lifecycle?.resolution?.status),
      `${record.metadata.name} has no route-resolution status`,
    );
    check(
      ["declared", "partly-declared", "not-assessed"].includes(record.spec?.ownership?.status),
      `${record.metadata.name} has no field-ownership status`,
    );
    const requirementIds = record.spec.lifecycle.requirements.items.map((item) => item.id);
    check(unique(requirementIds), `${record.metadata.name} has duplicate lifecycle requirement ids`);
    const routeIds = record.spec.lifecycle.routeIntent.routes.map((route) => route.id);
    check(unique(routeIds), `${record.metadata.name} has duplicate route-intent ids`);
    for (const route of record.spec.lifecycle.routeIntent.routes) {
      check(
        route.requirementRefs.length > 0
          && route.requirementRefs.every((id) => requirementIds.includes(id)),
        `${record.metadata.name}/${route.id} points at an unknown lifecycle requirement`,
      );
      check(
        ["recorded", "requires-destination-resolution", "blocked"].includes(route.status),
        `${record.metadata.name}/${route.id} has an invalid route-intent status`,
      );
      check(
        typeof route.automatic === "boolean"
          && route.proposedActor
          && route.proposedMechanism,
        `${record.metadata.name}/${route.id} has an incomplete route intent`,
      );
    }
    check(
      record.spec.lifecycle.targetFacts.requirementRefs
        .every((id) => requirementIds.includes(id)),
      `${record.metadata.name} target facts point at an unknown lifecycle requirement`,
    );
    if (record.spec.lifecycle.routeIntent.status === "not-required") {
      check(
        record.spec.lifecycle.routeIntent.routes.length === 0,
        `${record.metadata.name} says no route is required but contains route intents`,
      );
    }
    if (record.spec.lifecycle.resolution.status === "resolved-for-recorded-targets") {
      check(
        record.spec.lifecycle.resolution.records.length > 0,
        `${record.metadata.name} claims a resolved route without a resolution record`,
      );
    }
    if (record.spec?.operations?.resourceClass === "system-configuration") {
      check(
        record.spec.policy.normalSet === "approvalRequired",
        `${record.metadata.name} must require approval as system configuration`,
      );
      check(
        record.spec.policy.approvalReason === "system-configuration",
        `${record.metadata.name} has the wrong approval reason`,
      );
    }
    for (const path of [
      record.spec.source.record,
      record.spec.configuration.objects,
      record.spec.configuration.inventory,
      record.spec.baseVariant.digestRecord,
      record.spec.configuration.digestRecord,
      record.spec.processing.sourceIntent.record,
      record.spec.processing.materialization.record,
      record.spec.processing.flattening.record,
      ...record.spec.lifecycle.requirements.records,
      ...record.spec.lifecycle.routeIntent.records,
      ...record.spec.lifecycle.resolution.records,
      ...record.spec.ownership.records,
    ].filter(Boolean)) {
      check(existsRepo(path), `${record.metadata.name} points at missing ${path}`);
    }
  }
  const exactDelivery = records.find(
    (record) => record.metadata.name === catalogOciDeliveryRecord,
  );
  check(exactDelivery, "exact catalog OCI delivery base record is missing");
  check(
    exactDelivery.spec.delivery.literalConfigOci.status === "not-separately-published"
      && exactDelivery.spec.delivery.configHubReleaseOci.status === "pass"
      && exactDelivery.spec.delivery.argoCd === "pass"
      && exactDelivery.spec.delivery.flux === "pass"
      && exactDelivery.spec.delivery.direct === "pass"
      && exactDelivery.spec.delivery.receipt === relativeRepo(catalogOciDeliveryReceiptPath),
    "exact catalog OCI delivery evidence is not attached to the NGINX base record",
  );
  check(
    exactDelivery.status.limits.some(
      (limit) => limit.includes("temporary ConfigHub Space"),
    )
      && !exactDelivery.status.limits.some(
        (limit) => limit.includes("does not claim that the base has been uploaded"),
      ),
    "exact catalog OCI delivery base record contradicts its live receipt",
  );
  for (const record of records.filter(
    (candidate) => candidate.spec.source.type === "helm"
      && candidate.metadata.name !== catalogOciDeliveryRecord,
  )) {
    check(
      record.spec.delivery.configHubReleaseOci.status === "not-recorded-for-this-base"
        && record.spec.delivery.argoCd === "not-recorded-for-this-base"
        && record.spec.delivery.flux === "not-recorded-for-this-base"
        && record.spec.delivery.direct === "not-recorded-for-this-base",
      `${record.metadata.name} has an unscoped current delivery claim`,
    );
  }
  const aicrArgo = records.find(
    (record) => record.metadata.name === "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
  );
  check(aicrArgo, "AICR Argo CD base record is missing");
  check(
    aicrArgo.spec.promotion?.status === "pass"
      && aicrArgo.spec.promotion?.receipt
        === relativeRepo(aicrPersistentPromotionReceiptPath)
      && aicrArgo.spec.promotion?.path === "base -> development -> staging"
      && aicrArgo.spec.promotion?.stagingMatchesReviewedDev === true,
    "AICR Argo CD base record is missing its exact variant promotion proof",
  );
  validateAicrPersistentPromotionReceipt(
    readYaml(aicrPersistentPromotionReceiptPath),
  );
  validateAicrVariantPromotionReceipt(readYaml(aicrPromotionReceiptPath));
  const aicrV019 = records.find(
    (record) => record.metadata.name === "aicr-eks-h100-training-kubeflow-v0-19-0-argocd",
  );
  check(aicrV019, "AICR v0.19.0 Argo CD base record is missing");
  check(
    aicrV019.spec.processing.flattening.verdict === "flatten-with-routes"
      && aicrV019.spec.processing.flattening.record
        === "examples/aicr/eks-h100-training-kubeflow-v0-19-0/flattening-safety-verdict.yaml"
      && aicrV019.spec.lifecycle.routeIntent.status === "recorded"
      && aicrV019.spec.lifecycle.resolution.status === "blocked"
      && aicrV019.spec.lifecycle.resolution.records.includes(
        "data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml",
      )
      && aicrV019.spec.ownership.status === "declared"
      && aicrV019.spec.delivery.configHubUpload.objectIdentitiesMatched === true
      && aicrV019.spec.delivery.configHubReleaseOci.status
        === "published-and-pulled-by-digest"
      && aicrV019.spec.delivery.configHubReleaseOci.promotedConfigurationMatched === true,
    "AICR v0.19.0 does not expose its processing, lifecycle, and ownership records",
  );
  const timoni = records.find(
    (record) => record.metadata.name === "timoni-redis-8-10-1-default",
  );
  check(timoni, "Timoni Redis base record is missing");
  check(
    timoni.spec.baseVariant.digestRole === "source-module-oci-manifest"
      && timoni.spec.configuration.digestRole === "canonical-object-set"
      && timoni.spec.processing.materialization.method === "timoni-build"
      && timoni.spec.processing.flattening.verdict === "flatten-with-routes"
      && timoni.spec.lifecycle.routeIntent.status === "recorded",
    "Timoni Redis does not expose its source, object, processing, and lifecycle identities",
  );
  if (existsRepo("runs/timoni-redis-catalog-proof/public-oci-receipt.yaml")) {
    check(
      timoni.spec.delivery.literalConfigOci.status
        === "public-anonymous-pull-proved"
        && timoni.spec.delivery.literalConfigOci.objectSetSha256
          === timoni.spec.configuration.digest,
      "Timoni Redis public OCI receipt is not attached to its Catalog record",
    );
  }
  if (existsRepo("runs/timoni-redis-catalog-proof/confighub-receipt.yaml")) {
    check(
      timoni.spec.delivery.configHubUpload.status
        === "base-and-development-variant-retained"
        && timoni.spec.delivery.configHubUpload.linkedUnits === 7
        && timoni.spec.delivery.configHubUpload.objectChange === "none"
        && timoni.spec.delivery.configHubReleaseOci.status === "not-run"
        && timoni.spec.delivery.argoCd === "not-run"
        && timoni.spec.delivery.flux === "not-run",
      "Timoni Redis ConfigHub receipt is missing or overclaims delivery",
    );
  }
}

function validatePolicy(policy) {
  check(policy.apiVersion === "catalog.confighub.com/v1alpha1", "policy apiVersion is invalid");
  check(policy.kind === "ApplyPolicyProfile", "policy kind is invalid");
  check(policy.metadata?.name === "catalog-standard", "policy name must be catalog-standard");
  check(policy.spec?.purpose, "policy must explain what its apply gates are for");
  check(policy.spec?.definitionSpace?.ref, "policy definition Space is missing");
  check(
    policy.spec?.definitionSpace?.whereTrigger,
    "policy definition Space needs an explicit Trigger selector",
  );
  check(
    policy.spec.definitionSpace.ref === "platform",
    "policy Trigger definitions must remain in the platform Space",
  );
  check(unique(policy.spec?.sourceTypes ?? []), "policy source types must be unique");
  check(
    sameSet(
      policy.spec?.sourceTypes ?? [],
      [...new Set(Object.values(policySourceTypeByRecordSource))],
    )
      && supportedSourceTypes.every((sourceType) => policySourceTypeByRecordSource[sourceType]),
    "policy must map every Catalog source type to one maintained live policy source label",
  );
  const definitions = policy.spec?.triggerDefinitions ?? [];
  const baseline = policy.spec?.baseline?.checks ?? [];
  const approvalRequired = policy.spec?.approvalRequired?.checks ?? [];
  const definitionRefs = definitions.map((item) => item.ref);
  const policyTriggerRefs = [...new Set(
    [...baseline, ...approvalRequired].map((item) => item.trigger),
  )];
  check(definitions.length > 0, "policy trigger definitions are missing");
  check(unique(definitionRefs), "policy trigger definitions must be unique");
  check(
    sameSet(definitionRefs, policyTriggerRefs),
    "policy must define every Trigger selected by the baseline or approval-required set",
  );
  for (const definition of definitions) {
    check(/^platform\/[a-z0-9-]+$/.test(definition.ref ?? ""), `invalid Trigger reference ${definition.ref ?? ""}`);
    check(definition.displayName, `${definition.ref} has no human display name`);
    check(
      /^(Block apply|Warn) - [A-Za-z0-9]/.test(definition.displayName),
      `${definition.ref} display name must state whether it blocks or warns`,
    );
    check(definition.event === "Mutation", `${definition.ref} must run on Mutation`);
    check(definition.toolchain === "Kubernetes/YAML", `${definition.ref} has an invalid toolchain`);
    check(definition.functionName, `${definition.ref} has no function`);
    check(["block", "warn"].includes(definition.effect), `${definition.ref} has an invalid effect`);
    check(definition.description, `${definition.ref} has no description`);
    check(
      definition.description.includes("catalog apply"),
      `${definition.ref} description must explain its catalog apply role`,
    );
    check(
      definition.effect === "warn"
        ? definition.displayName.startsWith("Warn - ")
        : definition.displayName.startsWith("Block apply - "),
      `${definition.ref} display name disagrees with its effect`,
    );
    check(Array.isArray(definition.arguments), `${definition.ref} arguments must be an array`);
    check(
      unique(definition.arguments.map((item) => item.name)),
      `${definition.ref} argument names must be unique`,
    );
  }
  check(policy.spec?.baseline?.displayName, "baseline policy filter has no human display name");
  check(
    policy.spec?.approvalRequired?.displayName,
    "approval-required policy filter has no human display name",
  );
  for (const checkDefinition of [...baseline, ...approvalRequired]) {
    const definition = definitions.find((item) => item.ref === checkDefinition.trigger);
    check(
      definition?.effect === checkDefinition.effect,
      `${checkDefinition.trigger} effect differs between its definition and policy set`,
    );
  }
  const lifecycleDefinition = definitions.find(
    (item) => item.ref === "platform/lifecycle-route-evidence",
  );
  check(lifecycleDefinition?.functionName === "vet-cel", "lifecycle route check must use vet-cel");
  const lifecycleExpression = lifecycleDefinition?.arguments
    ?.find((item) => item.name === "expression")?.value ?? "";
  for (const requiredTerm of [
    "LifecycleRoute",
    "chart",
    "version",
    "base",
    "routeName",
    "executionMode",
    "automatic",
    "disposition",
    "evidence",
  ]) {
    check(
      lifecycleExpression.includes(requiredTerm),
      `lifecycle route expression does not check ${requiredTerm}`,
    );
  }
  const expressionFor = (ref) => definitions
    .find((item) => item.ref === ref)
    ?.arguments?.find((item) => item.name === "expression")?.value ?? "";
  const ordinaryImageExpression = expressionFor(
    "platform/digest-pinned-images",
  );
  const ordinaryProbeExpression = expressionFor("platform/probes-declared");
  for (const requiredTerm of [
    "Deployment",
    "StatefulSet",
    "DaemonSet",
    "ReplicaSet",
  ]) {
    check(
      ordinaryImageExpression.includes(requiredTerm)
        && ordinaryProbeExpression.includes(requiredTerm),
      `ordinary workload checks do not scope ${requiredTerm}`,
    );
  }
  check(
    ordinaryImageExpression.includes("Job")
      && !ordinaryProbeExpression.includes('"Job"'),
    "ordinary workload checks must inspect Job images without requiring probes",
  );
  check(
    !ordinaryImageExpression.includes("ClusterTrainingRuntime")
      && !ordinaryProbeExpression.includes("ClusterTrainingRuntime"),
    "ordinary workload checks must not guess at custom-resource container paths",
  );
  const aicrImageDefinition = definitions.find(
    (item) => item.ref === "platform/aicr-training-images-pinned",
  );
  const aicrSecretDefinition = definitions.find(
    (item) => item.ref === "platform/aicr-training-secret-refs",
  );
  check(
    aicrImageDefinition?.effect === "warn"
      && aicrImageDefinition.functionName === "vet-cel",
    "AICR image check must remain an advisory CEL check",
  );
  check(
    aicrSecretDefinition?.effect === "block"
      && aicrSecretDefinition.functionName === "vet-cel",
    "AICR Secret check must remain a blocking CEL check",
  );
  const aicrImageExpression = expressionFor(
    "platform/aicr-training-images-pinned",
  );
  for (const requiredTerm of [
    "trainer.kubeflow.org/v1alpha1",
    "ClusterTrainingRuntime",
    "replicatedJobs",
    "containers",
    "image",
    "@sha256:",
  ]) {
    check(
      aicrImageExpression.includes(requiredTerm),
      `AICR image expression does not check ${requiredTerm}`,
    );
  }
  const aicrSecretExpression = expressionFor(
    "platform/aicr-training-secret-refs",
  );
  for (const requiredTerm of [
    "trainer.kubeflow.org/v1alpha1",
    "ClusterTrainingRuntime",
    "replicatedJobs",
    "containers",
    "AI_API_KEY",
    "secretKeyRef",
  ]) {
    check(
      aicrSecretExpression.includes(requiredTerm),
      `AICR Secret expression does not check ${requiredTerm}`,
    );
  }
  const baselineIds = baseline.map((item) => item.id);
  const approvalRequiredIds = approvalRequired.map((item) => item.id);
  const requiredBaseline = [
    "schema-valid",
    "no-placeholder-values",
    "lifecycle-route-evidence",
    "aicr-training-api-key-secret",
    "aicr-training-images-pinned",
    "images-pinned-by-digest",
    "workload-probes-declared",
    "workload-sensitive-env-secret-refs",
  ];
  const expectedFilterWhere = (policySet) => {
    const [space] = policySet.filter.split("/");
    const slugs = policySet.checks
      .map((item) => item.trigger.split("/")[1])
      .sort();
    return `Space.Slug = '${space}' AND Slug ~ '^(${slugs.join("|")})$'`;
  };
  check(unique(baselineIds), "baseline policy check ids must be unique");
  check(unique(approvalRequiredIds), "approval-required policy check ids must be unique");
  check(
    sameSet(baselineIds, requiredBaseline),
    "baseline policy must contain exactly the eight standard checks",
  );
  check(!baseline.some(isApprovalCheck), "baseline policy must exclude the approval trigger");
  check(
    approvalRequired.some(
      (item) => item.id === "human-approval" && item.effect === "block",
    ),
    "approval-required policy must require blocking human approval",
  );
  for (const baselineCheck of baseline) {
    const approvalCheck = approvalRequired.find((item) => item.id === baselineCheck.id);
    check(
      approvalCheck,
      `approval-required policy is missing baseline check ${baselineCheck.id}`,
    );
    check(
      approvalCheck.trigger === baselineCheck.trigger,
      `approval-required trigger differs for ${baselineCheck.id}`,
    );
    check(
      approvalCheck.effect === baselineCheck.effect,
      `approval-required effect differs for ${baselineCheck.id}`,
    );
  }
  check(
    approvalRequired.length === baseline.length + 1,
    "approval-required policy must add exactly one check to the baseline",
  );
  check(
    policy.spec.baseline.filterWhere === expectedFilterWhere(policy.spec.baseline),
    "baseline filter must name exactly its eight Triggers",
  );
  check(
    policy.spec.approvalRequired.filterWhere
      === expectedFilterWhere(policy.spec.approvalRequired),
    "approval-required filter must name exactly its eight Triggers",
  );
  check(
    policy.spec.baseline.spaceSelector?.labels?.ApplyPolicyProfile
      === policy.metadata.name,
    "baseline selector must use the policy profile label",
  );
  const approvalSelectors = policy.spec.approvalRequired.spaceSelector?.anyOf ?? [];
  check(
    approvalSelectors.length === 2
      && approvalSelectors.every(
        (item) => item.labels?.ApplyPolicyProfile === policy.metadata.name,
      )
      && approvalSelectors.some((item) => item.labels?.Environment === "Prod")
      && approvalSelectors.some(
        (item) => item.labels?.ResourceClass === "system-configuration",
      ),
    "approval-required selector must cover production and system configuration",
  );
  const operationalClasses = policy.spec?.operationalClasses ?? [];
  check(
    sameSet(
      operationalClasses.map((item) => item.name),
      ["user-workload", "system-service", "system-configuration"],
    ),
    "policy must define the three operational resource classes",
  );
  for (const resourceClass of operationalClasses) {
    check(resourceClass.reason, `${resourceClass.name} needs a plain-English reason`);
    check(
      ["baseline", "approvalRequired"].includes(resourceClass.normalPolicy),
      `${resourceClass.name} has an invalid normal policy`,
    );
    check(
      resourceClass.productionPolicy === "approvalRequired",
      `${resourceClass.name} must require approval in production`,
    );
  }
  check(
    operationalClasses.find((item) => item.name === "system-configuration")
      ?.normalPolicy === "approvalRequired",
    "system configuration must require approval in every environment",
  );
  for (const path of policy.status?.evidence ?? []) check(existsRepo(path), `policy evidence is missing: ${path}`);
  if (policy.status?.liveReverified) {
    const receiptPath = join(repoRoot, "data", "apply-policy-profiles", "live-helm-catalog.yaml");
    const receipt = readYaml(receiptPath);
    check(receipt.kind === "ApplyPolicyLiveReceipt", "live policy receipt kind is invalid");
    check(receipt.spec?.profile === policy.metadata.name, "live policy receipt profile drifted");
    check(receipt.status?.result === "pass" && !(receipt.status?.findings ?? []).length, "live policy receipt did not pass");
    check(
      String(receipt.spec?.verifiedAt ?? "").startsWith(policy.status.lastRecorded),
      "live policy receipt date does not match policy status",
    );
    for (const [name, policySet] of Object.entries({
      baseline: policy.spec.baseline,
      approvalRequired: policy.spec.approvalRequired,
    })) {
      const recorded = receipt.spec?.filters?.[name];
      const expectedChecks = policySet.checks
        .map((item) => `${item.trigger}:${item.effect}`)
        .sort();
      const recordedChecks = (recorded?.triggers ?? [])
        .map((item) => `${item.ref}:${item.effect}`)
        .sort();
      check(recorded?.ref === policySet.filter, `${name} live filter reference drifted`);
      check(recorded?.where === policySet.filterWhere, `${name} live filter selector drifted`);
      check(sameSet(recordedChecks, expectedChecks), `${name} live Trigger set drifted`);
      check((recorded?.triggers ?? []).every((item) => item.validating === true), `${name} live receipt includes a non-validating Trigger`);
    }
    const baselineSpaces = receipt.spec?.spaces?.baseline ?? [];
    const approvalRequiredSpaces = receipt.spec?.spaces?.approvalRequired ?? [];
    check(baselineSpaces.length > 0, "live policy receipt has no baseline Spaces");
    check(
      approvalRequiredSpaces.length > 0,
      "live policy receipt has no approval-required Spaces",
    );
    check(
      !baselineSpaces.some((space) => approvalRequiredSpaces.includes(space)),
      "live policy receipt assigns a Space to both filters",
    );
    const approvalReasons = receipt.spec?.spaces?.approvalReasons ?? {};
    check(
      (approvalReasons.production ?? []).length > 0,
      "live policy receipt has no production approval assignments",
    );
    check(
      (approvalReasons.systemConfiguration ?? []).length > 0,
      "live policy receipt has no system-configuration approval assignments",
    );
    const classifiedApprovalSpaces = new Set([
      ...(approvalReasons.production ?? []),
      ...(approvalReasons.systemConfiguration ?? []),
    ]);
    check(
      approvalRequiredSpaces.every((space) => classifiedApprovalSpaces.has(space)),
      "live policy receipt has an approval-required Space without a reason",
    );
    check(
      [...classifiedApprovalSpaces].every(
        (space) => approvalRequiredSpaces.includes(space),
      ),
      "live policy receipt records an approval reason for a Space without approval",
    );
    const sourceTypeSpaces = receipt.spec?.spaces?.sourceTypes ?? {};
    check(
      sameSet(Object.keys(sourceTypeSpaces), policy.spec.sourceTypes),
      "live policy receipt source types do not match the policy",
    );
    const selectedSpaces = new Set([...baselineSpaces, ...approvalRequiredSpaces]);
    const classifiedSourceSpaces = new Set();
    for (const sourceType of policy.spec.sourceTypes) {
      const sourceSpaces = sourceTypeSpaces[sourceType] ?? [];
      check(sourceSpaces.length > 0, `live policy receipt has no ${sourceType} Space`);
      for (const space of sourceSpaces) {
        check(selectedSpaces.has(space), `${space} has a source type but no policy filter`);
        check(
          !classifiedSourceSpaces.has(space),
          `${space} appears under more than one source type`,
        );
        classifiedSourceSpaces.add(space);
      }
    }
    check(
      [...selectedSpaces].every((space) => classifiedSourceSpaces.has(space)),
      "live policy receipt has a Space without a source type",
    );
  }
}

function validateProgram(program) {
  check(program.apiVersion === "catalog.confighub.com/v1alpha1", "demo program apiVersion is invalid");
  check(program.kind === "DemoProgram", "demo program kind is invalid");
  const architecture = program.spec?.architecture;
  check(
    architecture?.name === "OCI in, managed configuration, OCI out",
    "demo program is missing the OCI-in/OCI-out architecture",
  );
  check(
    architecture.frontDoor?.output?.includes("literal configuration OCI"),
    "front door must produce a literal configuration OCI",
  );
  check(
    architecture.frontDoor?.accessModel?.serverless
      ?.includes("does not depend on ConfigHub Server")
      && architecture.frontDoor?.accessModel?.anonymous
        ?.includes("no ConfigHub account")
      && architecture.frontDoor?.accessModel?.composable
        ?.includes("before OCI, after OCI"),
    "front door must distinguish serverless, anonymous, and composable work",
  );
  check(
    sameSet(
      (architecture.frontDoor?.anonymousFlows ?? []).map((flow) => flow.shape),
      ["work -> OCI", "OCI -> work", "OCI -> work -> OCI"],
    ),
    "front door must name the three anonymous OCI flows",
  );
  for (const flow of architecture.frontDoor.anonymousFlows) {
    check(flow.result, `anonymous flow ${flow.shape} needs a result`);
    check(flow.insertion, `anonymous flow ${flow.shape} must say where it fits`);
  }
  const executionModes = architecture.frontDoor?.executionModes ?? [];
  check(
    sameSet(
      executionModes.map((item) => item.id),
      ["local-command", "ci-job", "hosted-public"],
    ),
    "front door must distinguish local, CI, and hosted public execution",
  );
  check(
    executionModes.every((item) => item.name && item.status && item.result),
    "each anonymous execution mode needs a name, status, and result",
  );
  check(
    executionModes.find((item) => item.id === "local-command")?.status === "available"
      && executionModes.find((item) => item.id === "ci-job")?.status === "available"
      && executionModes.find((item) => item.id === "hosted-public")?.status === "planned",
    "anonymous execution modes must keep their evidence-bounded statuses",
  );
  check(
    executionModes.find((item) => item.id === "hosted-public")?.result
      ?.includes("does not create private history"),
    "the hosted public mode must state what requires claiming in ConfigHub",
  );
  check(
    architecture.frontDoor?.claimBoundary?.before?.includes("Anonymous users")
      && architecture.frontDoor?.claimBoundary?.action?.includes("Claim")
      && architecture.frontDoor?.claimBoundary?.after?.includes("ConfigHub")
      && architecture.frontDoor?.claimBoundary?.managedExamples
        ?.includes("use ConfigHub Server"),
    "front door must name the anonymous-to-ConfigHub claim boundary",
  );
  check(
    architecture.configHub?.operations?.length >= 4,
    "ConfigHub middle must name its stored operations",
  );
  check(
    architecture.configHub?.existingFlow?.withConfigHub
      ?.includes("OCI -> ConfigHub -> OCI")
      && architecture.configHub?.existingFlow?.firstStep
        ?.includes("unchanged")
      && architecture.configHub?.existingFlow?.later
        ?.includes("variants")
      && architecture.configHub?.existingFlow?.fanOut
        ?.includes("specific outputs"),
    "ConfigHub must explain its pass-through, transformation, and fan-out roles in an existing OCI flow",
  );
  check(
    architecture.delivery?.result?.includes("cub release publish")
      && sameSet(
        architecture.delivery?.consumers ?? [],
        ["Argo CD", "Flux", "direct apply"],
      ),
    "delivery must use cub release publish and name all three consumers",
  );
  check(
    architecture.delivery?.rule?.includes("its own release OCI"),
    "delivery claims must remain scoped to the exact configuration",
  );
  const catalogNavigation = program.spec?.catalogNavigation;
  check(
    catalogNavigation?.startingQuestion === "What do you already have?"
      && catalogNavigation?.nextQuestion === "What do you want to do next?",
    "catalog navigation must begin with the user's starting point and next job",
  );
  check(
    sameSet(
      catalogNavigation.startingPoints ?? [],
      [
        "Helm chart and values",
        "AICR recipe or bundle",
        "cub installer package",
        "Existing OCI package",
        "Kubernetes YAML",
      ],
    ),
    "catalog navigation starting points changed",
  );
  check(
    sameSet(
      catalogNavigation.nextJobs ?? [],
      [
        "Inspect and verify",
        "Install",
        "Upload and save",
        "Customize",
        "Promote",
        "Deliver",
        "Operate",
        "Build an App",
      ],
    ),
    "catalog navigation jobs changed",
  );
  check(
    (catalogNavigation.entryOrder ?? []).length === 7
      && catalogNavigation.entryOrder[0] === "Ready-made configurations"
      && catalogNavigation.entryOrder.at(-1) === "Current limits",
    "catalog entry pages need the maintained seven-part reading order",
  );

  const reviewQuestions = program.spec?.reviewQuestions;
  check(
    reviewQuestions?.rule?.includes("plain English"),
    "catalog review questions must require plain English",
  );
  const requiredQuestions = [
    "What can a new user do first?",
    "Is testing and understanding this configuration easier than using Helm normally?",
    "Can I find the hooks, CRDs, prerequisites, and other chart quirks?",
    "Can I use the rendered-manifest pattern without giving up my Helm chart?",
    "Can source-to-OCI be automated?",
    "Can I bring the chart and values my team or AI produced?",
    "What happens after the first deployment?",
    "What has not been proved?",
  ];
  check(
    sameSet(
      (reviewQuestions?.questions ?? []).map((item) => item.question),
      requiredQuestions,
    ),
    "catalog review questions changed",
  );
  for (const item of reviewQuestions.questions) {
    check(item.standard, `${item.question} needs an acceptance standard`);
  }

  const exampleJourney = program.spec?.exampleJourney;
  check(
    exampleJourney?.rule?.includes("one person getting one deployable result"),
    "the example journey must begin with one deployable result",
  );
  const examples = exampleJourney?.examples ?? [];
  check(examples.length === 7, `expected seven example levels, found ${examples.length}`);
  check(
    examples[0]?.id === "ready-made-package"
      && examples[1]?.id === "bring-your-own-configuration"
      && examples.at(-1)?.id === "apps",
    "the example journey must lead with ready-made and bring-your-own paths and end with Apps",
  );
  const exampleIds = new Set();
  for (const example of examples) {
    check(
      example.id && !exampleIds.has(example.id),
      `duplicate or missing example id ${example.id ?? ""}`,
    );
    exampleIds.add(example.id);
    check(
      ["basics", "managed", "delivery", "advanced", "apps"].includes(example.level),
      `${example.id} has an invalid example level`,
    );
    check(
      ["available", "partial", "example-only", "planned"].includes(example.status),
      `${example.id} has an invalid status`,
    );
    check(
      example.problem && example.result && (example.steps ?? []).length > 0,
      `${example.id} needs a problem, result, and steps`,
    );
    check(
      (example.evidence ?? []).length > 0 && (example.limits ?? []).length > 0,
      `${example.id} needs evidence and an explicit limit`,
    );
    for (const path of example.evidence) {
      check(existsRepo(path), `${example.id} points at missing ${path}`);
    }
  }
  const demos = [...(program.spec?.pathways ?? []), ...(program.spec?.apps ?? [])];
  const ids = new Set();
  for (const demo of demos) {
    check(demo.id && !ids.has(demo.id), `duplicate or missing demo id ${demo.id ?? ""}`);
    ids.add(demo.id);
    check(demo.problem && demo.result, `${demo.id} needs a problem and result`);
    check(["available", "partial", "example-only", "planned"].includes(demo.status), `${demo.id} has an invalid status`);
    check(
      demo.workedExample?.status === "working"
        && demo.workedExample?.result
        && demo.workedExample?.limit,
      `${demo.id} must distinguish its working example from broader product status`,
    );
    check((demo.steps ?? []).length > 0, `${demo.id} needs at least one step`);
    for (const path of [...(demo.entrypoints ?? []), ...(demo.evidence ?? [])]) {
      check(existsRepo(path), `${demo.id} points at missing ${path}`);
    }
  }
  const delivery = program.spec.pathways.find((pathway) => pathway.id === "oci-delivery");
  check(delivery, "demo program is missing the OCI delivery pathway");
  check(delivery.status === "partial", "OCI delivery must remain partial until catalog coverage is complete");
  check(
    delivery.limits.some(
      (limit) => limit.includes("every catalog base") && /(?:does|do) not prove/.test(limit),
    ),
    "OCI delivery must distinguish the fixture proof from catalog-wide delivery proof",
  );
  const deliveryReceipt = readYaml(join(
    repoRoot,
    "runs",
    "oci-hook-delivery-proof",
    "receipt.yaml",
  ));
  validateOciDeliveryMechanismReceipt(deliveryReceipt);
  check(
    existsSync(catalogOciDeliveryReceiptPath),
    `${relativeRepo(catalogOciDeliveryReceiptPath)} is missing`,
  );
  validateCatalogOciDeliveryReceipt(readYaml(catalogOciDeliveryReceiptPath));
  validateOciDeployStageRolloutReceipt(readYaml(ociDeployStageRolloutReceiptPath));
  validateAnonymousOciFluxReceipt(readYaml(anonymousOciFluxReceiptPath));
  validateAnonymousOciCiReceipt(readYaml(anonymousOciCiReceiptPath));

  const fleetSource = readYaml(join(
    repoRoot,
    "config-catalog",
    "demonstrations",
    "nginx-fleet-registry-migration.yaml",
  ));
  const fleetReceipt = readYaml(join(
    repoRoot,
    "data",
    "fleet-promotion",
    "live-nginx-registry-migration.yaml",
  ));
  validateFleetPromotionReceipt(fleetSource, fleetReceipt);
}

function validateOciDeliveryMechanismReceipt(receipt) {
  check(
    receipt.kind === "HookOciDeliveryProofReceipt",
    "OCI delivery mechanism receipt kind is invalid",
  );
  check(
    receipt.spec?.fixture === "tests/fixtures/hook-replacement-probe",
    "OCI delivery mechanism proof must remain scoped to the routed-hook fixture",
  );
  check(
    receipt.spec?.result === "pass" && receipt.spec?.run?.publish === "pass",
    "OCI delivery mechanism proof did not pass",
  );
  const legs = receipt.spec?.legs ?? {};
  check(
    sameSet(Object.keys(legs), ["argo", "flux", "cubDirect"]),
    "OCI delivery mechanism proof must contain Argo CD, Flux, and direct-apply legs",
  );
  for (const [name, leg] of Object.entries(legs)) {
    check(leg.result === "pass", `OCI delivery ${name} leg did not pass`);
    check(leg.workloadApplied === "yes", `OCI delivery ${name} leg did not apply the workload`);
    check(leg.hookRan === "yes", `OCI delivery ${name} leg did not run the hook`);
  }
}

function validateCatalogOciDeliveryReceipt(receipt) {
  check(
    receipt.kind === "CatalogOciDeliveryProofReceipt",
    "catalog OCI delivery receipt kind is invalid",
  );
  check(
    receipt.metadata?.name === catalogOciDeliveryRecord,
    "catalog OCI delivery receipt name drifted",
  );
  check(
    receipt.spec?.chart === "bitnami/nginx"
      && receipt.spec?.version === "24.0.2"
      && receipt.spec?.base === "http-clusterip",
    "catalog OCI delivery receipt source drifted",
  );
  check(
    receipt.spec?.result === "pass"
      && receipt.spec?.render?.result === "pass"
      && receipt.spec?.render?.exactCatalogObjects === "yes",
    "catalog OCI delivery did not reproduce the exact committed base",
  );
  const release = receipt.spec?.releaseOci ?? {};
  check(
    release.publish === "pass"
      && release.sameDigestAcrossConsumers === "yes"
      && /^sha256:[a-f0-9]{64}$/.test(release.digest ?? ""),
    "catalog OCI release publication or digest comparison did not pass",
  );
  const legs = receipt.spec?.legs ?? {};
  check(
    sameSet(Object.keys(legs), ["argo", "flux", "direct"]),
    "catalog OCI delivery receipt must contain Argo CD, Flux, and direct-apply legs",
  );
  for (const [name, leg] of Object.entries(legs)) {
    check(leg.result === "pass", `catalog OCI ${name} leg did not pass`);
    check(leg.controllerReady === "yes", `catalog OCI ${name} controller was not ready`);
    check(
      leg.digest === release.digest,
      `catalog OCI ${name} leg did not use the published release digest`,
    );
    check(
      leg.workload?.deploymentReady === "yes"
        && leg.workload?.podReady === "yes"
        && leg.workload?.serviceType === "ClusterIP",
      `catalog OCI ${name} workload was not ready`,
    );
  }
  check(
    receipt.spec?.run?.clusterCommand === "cub cluster up",
    "catalog OCI delivery did not use the current cub cluster command",
  );
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every((value) => value === "pass"),
    "catalog OCI delivery cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("does not prove another chart")),
    "catalog OCI delivery receipt is missing its exact-scope limit",
  );
}

function validateOciDeployStageRolloutReceipt(receipt) {
  check(
    receipt.kind === "OciDeployStageRolloutReceipt"
      && receipt.status?.result === "pass",
    "OCI deploy-stage-rollout receipt did not pass",
  );
  check(
    receipt.spec?.source?.chart === "bitnami/nginx"
      && receipt.spec?.source?.version === "24.0.2"
      && receipt.spec?.source?.presetConfig === "http-clusterip",
    "OCI deploy-stage-rollout source drifted",
  );
  const input = receipt.spec?.serverlessInput ?? {};
  const output = receipt.spec?.serverlessOutput ?? {};
  check(
    input.result === "pass"
      && input.objectsMatched === true
      && /^sha256:[a-f0-9]{64}$/.test(input.digest ?? ""),
    "anonymous OCI input did not pass",
  );
  check(
    output.result === "pass"
      && output.objectsMatched === true
      && output.objectCount === 5
      && /^sha256:[a-f0-9]{64}$/.test(output.digest ?? ""),
    "portable OCI output did not pass",
  );
  check(
    receipt.spec?.configHub?.import?.result === "pass"
      && receipt.spec.configHub.import.kubernetesFieldsMatched === true
      && receipt.spec.configHub.import.externalSourceDigest === input.digest,
    "ConfigHub OCI import did not preserve the input",
  );
  const passThrough = receipt.spec?.delivery?.passThrough ?? {};
  check(
    passThrough.result === "pass"
      && passThrough.userKubernetesFieldsMatched === true
      && passThrough.input?.manifestDigest === input.digest
      && passThrough.input?.objectCount === 5
      && passThrough.output?.objectCount === 5
      && passThrough.output?.manifestDigest
        === passThrough.output?.resolvedManifestDigest
      && passThrough.addedConfigHubMetadata
        ?.includes("/metadata/annotations/confighub.com/origin")
      && passThrough.addedConfigHubMetadata
        .every((path) =>
          path === "/metadata/annotations/confighub.com/origin"
          || path.endsWith("/$comment$head$")),
    "ConfigHub congruent OCI pass-through did not pass",
  );
  check(
    receipt.spec?.configHub?.chain?.result === "pass"
      && receipt.spec.configHub.chain.path === "base -> development -> staging"
      && receipt.spec?.configHub?.promotions?.development?.result === "pass"
      && receipt.spec?.configHub?.promotions?.staging?.result === "pass",
    "sequential development and staging promotions did not pass",
  );
  check(
    receipt.spec?.delivery?.development?.result === "pass"
      && receipt.spec?.delivery?.stagingRelease?.result === "pass",
    "ConfigHub environment delivery or release publication did not pass",
  );
  const fleet = receipt.spec?.delivery?.fleet ?? {};
  check(
    fleet.result === "pass"
      && fleet.size === 2
      && fleet.sameReleaseDigest === true
      && fleet.digest === output.digest
      && fleet.targets?.length === 2,
    "two-cluster portable OCI rollout did not pass",
  );
  for (const target of fleet.targets) {
    check(
      target.runtime?.result === "pass"
        && target.runtime?.sync === "Synced"
        && target.runtime?.health === "Healthy"
        && target.runtime?.revision === output.digest
        && target.runtime?.deployment?.replicas === "2/2",
      `${target.cluster ?? "fleet target"} did not reconcile the portable OCI`,
    );
    const objectSet = target.observations?.objectSet ?? {};
    const workloads = target.observations?.workloads ?? {};
    check(
      objectSet.result === "pass"
        && objectSet.desiredDigest === objectSet.liveDigest
        && objectSet.summary?.desired === 5
        && objectSet.summary?.matched === 5
        && objectSet.summary?.missing === 0
        && objectSet.summary?.mismatched === 0
        && /^sha256:[a-f0-9]{64}$/.test(objectSet.fingerprint ?? ""),
      `${target.cluster ?? "fleet target"} did not prove exact live objects`,
    );
    check(
      workloads.result === "pass"
        && workloads.summary?.desired === 5
        && workloads.summary?.converged === 5
        && workloads.summary?.progressing === 0
        && workloads.summary?.failed === 0
        && workloads.summary?.missing === 0
        && /^sha256:[a-f0-9]{64}$/.test(workloads.fingerprint ?? ""),
      `${target.cluster ?? "fleet target"} did not prove live convergence`,
    );
    for (const [observation, predicateName] of [
      [objectSet, "object-set-matches"],
      [workloads, "workloads-converged"],
    ]) {
      const path = join(repoRoot, observation.receipt ?? "");
      check(existsSync(path), `${observation.receipt ?? "observation receipt"} is missing`);
      const stored = JSON.parse(readFileSync(path, "utf8"));
      check(
        stored._type === "https://in-toto.io/Statement/v1"
          && stored.predicateType === "https://cub-scout.dev/receipt/v1"
          && stored.predicate?.predicateName === predicateName
          && stored.predicate?.verdict === "PASS"
          && stored.predicate?.fingerprint === observation.fingerprint,
        `${observation.receipt} does not match the rollout receipt`,
      );
      if (predicateName === "object-set-matches") {
        check(
          stored.predicate?.evidence?.objectSet?.normalizationProfile
            === "k8s-zero-defaults/v1",
          `${observation.receipt} lost its Kubernetes normalization profile`,
        );
      }
    }
  }
  check(
    receipt.spec?.run?.clusterCommand === "cub cluster up",
    "OCI deploy-stage-rollout proof did not use the current cluster command",
  );
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every((value) => value === "pass"),
    "OCI deploy-stage-rollout cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("target-scoped OCI credential")),
    "OCI deploy-stage-rollout receipt must state the target-credential boundary",
  );
}

function validateAicrPersistentPromotionReceipt(receipt) {
  check(
    receipt.kind === "VariantReadinessReceipt"
      && receipt.status?.result === "pass",
    "persistent AICR promotion receipt is invalid",
  );
  check(
    receipt.spec?.source?.literalConfiguration?.anonymousPull === "pass"
      && receipt.spec?.chain?.base?.applicationCount === 17
      && receipt.spec?.chain?.development?.applicationCount === 17
      && receipt.spec?.chain?.staging?.applicationCount === 17,
    "persistent AICR source or Application counts changed",
  );
  check(
    receipt.spec?.change?.resource
      === "argoproj.io/v1alpha1/Application argocd/kube-prometheus-stack"
      && receipt.spec?.change?.changedApplicationCount === 1
      && receipt.spec?.change?.preview?.result === "pass"
      && receipt.spec?.change?.preview?.storedDataUnchanged === true,
    "persistent AICR development change evidence changed",
  );
  check(
    receipt.spec?.promotion?.path === "base -> development -> staging"
      && receipt.spec?.promotion?.preview?.result === "pass"
      && receipt.spec?.promotion?.preview?.storedDataUnchanged === true
      && receipt.spec?.promotion?.result === "pass"
      && receipt.spec?.promotion?.stagingMatchesDevelopment === true,
    "persistent AICR promotion evidence changed",
  );
  check(
    receipt.spec?.chain?.development?.canonicalDataSha256
      === receipt.spec?.chain?.staging?.canonicalDataSha256
      && receipt.spec?.chain?.base?.canonicalDataSha256
        !== receipt.spec?.chain?.development?.canonicalDataSha256,
    "persistent AICR staging does not contain the reviewed development change",
  );
  for (const record of [
    receipt.spec.chain.base,
    receipt.spec.chain.development,
    receipt.spec.chain.staging,
  ]) {
    check(
      record.policyChecks?.length === 6
        && record.applyGates?.includes(
          "platform/require-approval/vet-approvedby",
        ),
      `${record.space} lost its AICR checks or approval gate`,
    );
  }
}

function validateAicrVariantPromotionReceipt(receipt) {
  check(
    receipt.kind === "AicrVariantPromotionProofReceipt",
    "AICR variant promotion receipt kind is invalid",
  );
  check(
    receipt.status?.result === "pass"
      && receipt.spec?.source?.applicationCount === 17
      && receipt.spec?.source?.exactSourceObjectsMatched === true
      && receipt.spec?.change?.changedApplicationCount === 1,
    "AICR variant promotion receipt did not pass its exact scope",
  );
  check(
    receipt.spec?.change?.changedApplications?.[0]
      === "argoproj.io/v1alpha1|Application|argocd|kube-prometheus-stack",
    "AICR variant promotion changed an unexpected Application",
  );
  check(
    receipt.spec?.promotion?.dryRun === "pass"
      && receipt.spec?.promotion?.dryRunLeftStagingUnchanged === true
      && receipt.spec?.promotion?.result === "pass"
      && receipt.spec?.promotion?.stagingMatchesReviewedDev === true,
    "AICR variant promotion preview or promotion evidence is incomplete",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("started no Kubernetes cluster")),
    "AICR variant promotion must not imply cluster delivery",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "AICR variant promotion cleanup did not pass",
  );
}

function validateAnonymousOciFluxReceipt(receipt) {
  check(
    receipt.kind === "AnonymousOciFluxProofReceipt"
      && receipt.status?.result === "pass",
    "anonymous public-OCI to Flux receipt did not pass",
  );
  check(
    receipt.spec?.pathway === "OCI -> work -> OCI"
      && receipt.spec?.source?.chart === "bitnami/nginx"
      && receipt.spec?.source?.version === "24.0.2"
      && receipt.spec?.source?.base === "http-clusterip",
    "anonymous public-OCI source drifted",
  );
  check(
    receipt.spec?.source?.anonymousManifestPull === "pass"
      && /^sha256:[a-f0-9]{64}$/.test(
        receipt.spec?.source?.expectedManifestDigest ?? "",
      ),
    "anonymous public installer OCI pull did not pass",
  );
  check(
    receipt.spec?.localWork?.configHubTokenFilePresent === false
      && receipt.spec?.localWork?.configHubOrganization === ""
      && receipt.spec?.localWork?.objectCount === 6,
    "anonymous local rendering used ConfigHub credentials or lost NGINX objects",
  );
  check(
    receipt.spec?.output?.anonymousPull === "pass"
      && receipt.spec?.output?.pulledFilesMatched === true
      && /^sha256:[a-f0-9]{64}$/.test(receipt.spec?.output?.digest ?? ""),
    "anonymous output OCI pull-back did not pass",
  );
  check(
    receipt.spec?.flux?.sourceReady === true
      && receipt.spec?.flux?.kustomizationReady === true
      && receipt.spec?.flux?.observedDigest === receipt.spec.output.digest
      && receipt.spec?.flux?.deployment?.readyReplicas === 1
      && receipt.spec?.flux?.deployment?.desiredReplicas === 1,
    "Flux did not reconcile the anonymous output OCI at 1/1 replicas",
  );
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every(
      (value) => value === "pass",
    ),
    "anonymous public-OCI proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) =>
      limit.includes("temporary local registry")),
    "anonymous public-OCI receipt must name its temporary registry limit",
  );
}

function validateAnonymousOciCiReceipt(receipt) {
  check(
    receipt.kind === "AnonymousOciCiProofReceipt"
      && receipt.status?.result === "pass",
    "anonymous OCI CI receipt did not pass",
  );
  check(
    receipt.spec?.pathway === "OCI -> work -> OCI"
      && receipt.spec?.executionMode === "ci-job"
      && receipt.spec?.environment?.provider === "GitHub Actions"
      && receipt.spec?.environment?.repository === "confighub/helm-expt"
      && /^https:\/\/github\.com\/confighub\/helm-expt\/actions\/runs\/\d+$/.test(
        receipt.spec?.environment?.runUrl ?? "",
      ),
    "anonymous OCI CI receipt lost its GitHub Actions identity",
  );
  check(
    receipt.spec?.source?.chart === "bitnami/nginx"
      && receipt.spec?.source?.version === "24.0.2"
      && receipt.spec?.source?.base === "http-clusterip"
      && receipt.spec?.source?.anonymousPull === "pass"
      && receipt.spec?.source?.observedManifestDigest
        === receipt.spec?.source?.expectedManifestDigest,
    "anonymous OCI CI source pull did not pass at the recorded digest",
  );
  check(
    receipt.spec?.credentials?.configHubTokenFiles?.length === 0
      && receipt.spec?.credentials?.configHubContexts?.length === 0
      && receipt.spec?.credentials
        ?.configHubCredentialEnvironmentVariables?.length === 0,
    "anonymous OCI CI receipt contains ConfigHub account state",
  );
  check(
    receipt.spec?.work?.objectCount === 6
      && receipt.spec?.work?.objectKinds?.length === 6
      && /^[a-f0-9]{64}$/.test(
        receipt.spec?.work?.reviewedObjectsSha256 ?? "",
      ),
    "anonymous OCI CI receipt lost its reviewed NGINX object set",
  );
  check(
    /^sha256:[a-f0-9]{64}$/.test(
      receipt.spec?.output?.manifestDigest ?? "",
    )
      && receipt.spec?.output?.workflowArtifactPath === "output-layout"
      && receipt.spec?.output?.pullBack === "pass"
      && receipt.spec?.output?.objectsMatched === true
      && receipt.spec?.output?.pulledObjectsSha256
        === receipt.spec?.work?.reviewedObjectsSha256,
    "anonymous OCI CI output did not reproduce the reviewed objects",
  );
  check(
    receipt.spec?.limits?.some((limit) =>
      limit.includes("not a public registry package"))
      && receipt.spec?.limits?.some((limit) =>
        limit.includes("hosted public service")),
    "anonymous OCI CI receipt must keep its public-registry and hosted-service limits",
  );
}

function validateFleetPromotionReceipt(source, receipt) {
  check(receipt.kind === "FleetPromotionLiveReceipt", "fleet promotion receipt kind is invalid");
  check(receipt.metadata?.name === source.metadata?.name, "fleet promotion receipt name drifted");
  check(receipt.spec?.organization === source.spec?.organization, "fleet promotion receipt organization drifted");
  check(receipt.status?.result === "pass" && !(receipt.status?.findings ?? []).length, "fleet promotion receipt did not pass");
  check(
    String(receipt.spec?.verifiedAt ?? "").startsWith(source.status?.lastRecorded),
    "fleet promotion receipt date drifted",
  );
  check(receipt.spec?.base?.space === source.spec?.base?.space, "fleet promotion base Space drifted");
  check(receipt.spec?.workload?.digest === source.spec?.workload?.digest, "fleet promotion digest drifted");

  const expectedSpaces = source.spec.variants.map((variant) => variant.space);
  const recordedSpaces = (receipt.spec?.variants ?? []).map((variant) => variant.space);
  check(sameSet(recordedSpaces, expectedSpaces), "fleet promotion variant Space set drifted");
  for (const expected of source.spec.variants) {
    const recorded = receipt.spec.variants.find((variant) => variant.space === expected.space);
    const expectedImage = source.spec.migration[expected.image === "current" ? "currentImage" : "previousImage"];
    check(recorded.images.every((image) => image.image === expectedImage), `${expected.space} image result drifted`);
    check(recorded.replicas === expected.replicas, `${expected.space} replica result drifted`);
    check(recorded.filter === expected.filter, `${expected.space} policy result drifted`);
    check(
      recorded.pendingUpstreamUnits === expected.pendingUpstreamUnits,
      `${expected.space} pending promotion result drifted`,
    );
  }
}

function runSelfTest() {
  const policy = readYaml(policySourcePath);
  validatePolicy(policy);
  const program = readYaml(programSourcePath);
  validateProgram(program);

  const approvalLeak = structuredClone(policy);
  approvalLeak.spec.baseline.checks.push({
    id: "human-approval",
    trigger: "platform/require-approval",
    effect: "block",
    reason: "bad fixture",
  });
  expectFailure(() => validatePolicy(approvalLeak), "approval leakage fixture unexpectedly passed");

  const missingBaselineWithApproval = structuredClone(policy);
  missingBaselineWithApproval.spec.approvalRequired.checks
    = missingBaselineWithApproval.spec.approvalRequired.checks
    .filter((item) => item.id !== "schema-valid");
  expectFailure(
    () => validatePolicy(missingBaselineWithApproval),
    "approval-required baseline-loss fixture unexpectedly passed",
  );

  const warningTurnedBlocking = structuredClone(policy);
  warningTurnedBlocking.spec.approvalRequired.checks
    .find((item) => item.id === "images-pinned-by-digest").effect = "block";
  expectFailure(
    () => validatePolicy(warningTurnedBlocking),
    "approval-required effect-drift fixture unexpectedly passed",
  );

  const routeEvidenceRemoved = structuredClone(policy);
  routeEvidenceRemoved.spec.triggerDefinitions
    .find((item) => item.ref === "platform/lifecycle-route-evidence")
    .arguments[0].value = 'r.kind != "LifecycleRoute"';
  expectFailure(
    () => validatePolicy(routeEvidenceRemoved),
    "incomplete lifecycle route expression unexpectedly passed",
  );

  const broadFilter = structuredClone(policy);
  broadFilter.spec.baseline.filterWhere = "Space.Slug = 'platform'";
  expectFailure(() => validatePolicy(broadFilter), "broad baseline filter fixture unexpectedly passed");

  const missingAicrCoverage = structuredClone(policy);
  missingAicrCoverage.spec.sourceTypes = missingAicrCoverage.spec.sourceTypes
    .filter((sourceType) => sourceType !== "aicr");
  expectFailure(
    () => validatePolicy(missingAicrCoverage),
    "missing AICR policy coverage fixture unexpectedly passed",
  );

  const blanketDeliveryClaim = structuredClone(program);
  blanketDeliveryClaim.spec.pathways
    .find((pathway) => pathway.id === "oci-delivery").limits
    = ["Every catalog base has delivery proof."];
  expectFailure(
    () => validateProgram(blanketDeliveryClaim),
    "blanket catalog delivery claim unexpectedly passed",
  );

  const rerenderedOutput = structuredClone(program);
  rerenderedOutput.spec.architecture.delivery.result
    = "The controller renders the source package again.";
  expectFailure(
    () => validateProgram(rerenderedOutput),
    "rerendered delivery architecture unexpectedly passed",
  );

  const incompleteDeliveryReceipt = readYaml(join(
    repoRoot,
    "runs",
    "oci-hook-delivery-proof",
    "receipt.yaml",
  ));
  incompleteDeliveryReceipt.spec.legs.flux.result = "watch";
  expectFailure(
    () => validateOciDeliveryMechanismReceipt(incompleteDeliveryReceipt),
    "incomplete OCI delivery mechanism fixture unexpectedly passed",
  );

  const mismatchedCatalogDelivery = readYaml(catalogOciDeliveryReceiptPath);
  mismatchedCatalogDelivery.spec.legs.flux.digest
    = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  expectFailure(
    () => validateCatalogOciDeliveryReceipt(mismatchedCatalogDelivery),
    "mismatched catalog OCI delivery digest unexpectedly passed",
  );
  const missingCatalogLeg = readYaml(catalogOciDeliveryReceiptPath);
  delete missingCatalogLeg.spec.legs.flux;
  expectFailure(
    () => validateCatalogOciDeliveryReceipt(missingCatalogLeg),
    "catalog OCI delivery receipt with no Flux leg unexpectedly passed",
  );
  const mismatchedFleetDigest = readYaml(ociDeployStageRolloutReceiptPath);
  mismatchedFleetDigest.spec.delivery.fleet.targets[1].runtime.revision
    = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  expectFailure(
    () => validateOciDeployStageRolloutReceipt(mismatchedFleetDigest),
    "mismatched two-cluster OCI digest unexpectedly passed",
  );
  const changedPassThrough = readYaml(ociDeployStageRolloutReceiptPath);
  changedPassThrough.spec.delivery.passThrough.userKubernetesFieldsMatched = false;
  expectFailure(
    () => validateOciDeployStageRolloutReceipt(changedPassThrough),
    "changed ConfigHub pass-through fixture unexpectedly passed",
  );
  const incompleteRolloutCleanup = readYaml(ociDeployStageRolloutReceiptPath);
  incompleteRolloutCleanup.spec.run.cleanup.clusterA = "fail";
  expectFailure(
    () => validateOciDeployStageRolloutReceipt(incompleteRolloutCleanup),
    "incomplete OCI rollout cleanup unexpectedly passed",
  );
  const incompleteLiveObservation = readYaml(ociDeployStageRolloutReceiptPath);
  incompleteLiveObservation.spec.delivery.fleet.targets[0]
    .observations.objectSet.summary.matched = 4;
  expectFailure(
    () => validateOciDeployStageRolloutReceipt(incompleteLiveObservation),
    "incomplete live object observation unexpectedly passed",
  );
  const credentialedAnonymousRun = readYaml(anonymousOciFluxReceiptPath);
  credentialedAnonymousRun.spec.localWork.configHubTokenFilePresent = true;
  expectFailure(
    () => validateAnonymousOciFluxReceipt(credentialedAnonymousRun),
    "credentialed anonymous-OCI fixture unexpectedly passed",
  );
  const mismatchedAnonymousDigest = readYaml(anonymousOciFluxReceiptPath);
  mismatchedAnonymousDigest.spec.flux.observedDigest
    = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  expectFailure(
    () => validateAnonymousOciFluxReceipt(mismatchedAnonymousDigest),
    "anonymous-OCI fixture with the wrong Flux digest unexpectedly passed",
  );
  const credentialedAnonymousCiRun = readYaml(anonymousOciCiReceiptPath);
  credentialedAnonymousCiRun.spec.credentials.configHubTokenFiles = [
    "unexpected-token.json",
  ];
  expectFailure(
    () => validateAnonymousOciCiReceipt(credentialedAnonymousCiRun),
    "credentialed anonymous-OCI CI fixture unexpectedly passed",
  );
  const mismatchedAnonymousCiOutput = readYaml(anonymousOciCiReceiptPath);
  mismatchedAnonymousCiOutput.spec.output.pulledObjectsSha256
    = "0000000000000000000000000000000000000000000000000000000000000000";
  expectFailure(
    () => validateAnonymousOciCiReceipt(mismatchedAnonymousCiOutput),
    "anonymous-OCI CI fixture with the wrong object hash unexpectedly passed",
  );

  const fleetSource = readYaml(join(
    repoRoot,
    "config-catalog",
    "demonstrations",
    "nginx-fleet-registry-migration.yaml",
  ));
  const fleetReceipt = readYaml(join(
    repoRoot,
    "data",
    "fleet-promotion",
    "live-nginx-registry-migration.yaml",
  ));
  validateFleetPromotionReceipt(fleetSource, fleetReceipt);
  const hiddenPendingPromotion = structuredClone(fleetReceipt);
  hiddenPendingPromotion.spec.variants
    .find((variant) => variant.space === "bitnami-nginx-fleet-prod-eu")
    .pendingUpstreamUnits = 0;
  expectFailure(
    () => validateFleetPromotionReceipt(fleetSource, hiddenPendingPromotion),
    "hidden pending-promotion fixture unexpectedly passed",
  );
}

function expectFailure(fn, message) {
  let failed = false;
  try {
    fn();
  } catch {
    failed = true;
  }
  check(failed, message);
}

function alignRecordWithProcessingModel(record, intent) {
  const legacyRouting = record.spec.routing ?? {
    routes: [],
    targetFacts: {},
    sourceRecord: record.spec.source.record,
  };
  const identity = identityRecord(record, intent);
  const processing = processingRecord(record, intent, identity);
  const lifecycle = lifecycleRecord(record, intent, legacyRouting);
  const ownership = ownershipRecord(record, intent, legacyRouting);
  const {
    source,
    baseVariant,
    configuration,
    inputs,
    delivery,
    promotion,
    policy,
    evidence,
    operations,
  } = record.spec;
  record.spec = {
    source,
    baseVariant: {
      ...baseVariant,
      digestRole: identity.baseRevision.digestRole,
      digestRecord: identity.baseRevision.digestRecord,
    },
    configuration: {
      ...configuration,
      digest: identity.objectSet.digest,
      digestRole: identity.objectSet.digestRole,
      digestRecord: identity.objectSet.digestRecord,
    },
    processing,
    inputs,
    lifecycle,
    ownership,
    delivery,
    ...(promotion ? { promotion } : {}),
    policy,
    evidence,
    operations,
  };
  return record;
}

function identityRecord(record, intent) {
  const source = record.spec.source;
  const configuration = record.spec.configuration;
  let baseDigestRole = record.spec.baseVariant.digestRole ?? "source-output-record";
  let baseDigestRecord = record.spec.baseVariant.digestRecord ?? source.record;
  let objectDigest = configuration.digest ?? "";
  let objectDigestRole = configuration.digestRole ?? "inventory-file";
  let objectDigestRecord = configuration.digestRecord ?? configuration.inventory;

  if (source.type === "helm" && intent) {
    const revisionPath = intent.spec.renderOutput.revision;
    const revision = readYaml(join(repoRoot, revisionPath));
    baseDigestRole = "helm-variant-revision";
    baseDigestRecord = revisionPath;
    objectDigest = String(revision.spec?.digestInputs?.renderedObjectSetSHA256 ?? "");
    objectDigestRole = "canonical-object-set";
    objectDigestRecord = revisionPath;
  } else if (source.type === "aicr" && source.version === "v0.19.0") {
    baseDigestRole = "aicr-platform-index";
    baseDigestRecord = record.spec.evidence.digestIndex;
  } else if (source.type === "aicr") {
    baseDigestRole = "source-output-inventory";
    baseDigestRecord = configuration.inventory;
  } else if (source.type === "kubara") {
    baseDigestRole = "literal-configuration-oci-manifest";
    baseDigestRecord = source.record;
  } else if (source.type === "sveltos") {
    baseDigestRole = "source-file";
    baseDigestRecord = configuration.objects;
  }

  if (!objectDigest && configuration.inventory && existsRepo(configuration.inventory)) {
    objectDigest = sha256File(join(repoRoot, configuration.inventory));
    objectDigestRole = "inventory-file";
    objectDigestRecord = configuration.inventory;
  }
  if (!objectDigest && configuration.objects && existsRepo(configuration.objects)) {
    const objectPath = join(repoRoot, configuration.objects);
    check(statSync(objectPath).isFile(), `${record.metadata.name} needs an inventory for a directory object set`);
    objectDigest = sha256File(objectPath);
    objectDigestRole = "literal-yaml-file";
    objectDigestRecord = configuration.objects;
  }
  check(objectDigest, `${record.metadata.name} has no exact-object identity`);

  return {
    baseRevision: {
      digestRole: baseDigestRole,
      digestRecord: baseDigestRecord,
    },
    objectSet: {
      digest: objectDigest,
      digestRole: objectDigestRole,
      digestRecord: objectDigestRecord,
    },
  };
}

function processingRecord(record, intent, identity) {
  const source = record.spec.source;
  const sourceRecord = source.record;
  let method = "generator";
  let materializationStatus = "captured";
  let boundaries = [
    `The ${source.type} processor produced the exact object set recorded by this base.`,
  ];

  if (source.type === "helm") {
    method = "helm-render";
    boundaries = [
      "Helm rendered the pinned chart and values into the exact objects retained by this base.",
    ];
  } else if (source.type === "aicr" && record.spec.configuration.format === "argocd-application-yaml") {
    method = "aicr-compose-then-helm-render";
    boundaries = [
      "AICR composed the platform and generated an Argo CD app-of-apps chart; Helm rendered that wrapper into exact Application objects.",
      "The component Applications still reference their own sources, so those nested sources are processed later by Argo CD.",
    ];
  } else if (source.type === "aicr") {
    method = "aicr-compose";
    boundaries = [
      "AICR composed the selected platform into the exact configuration retained by this base.",
      "Any nested source named by the generated configuration keeps its own processing boundary.",
    ];
  } else if (source.type === "timoni") {
    method = "timoni-build";
    boundaries = [
      "Timoni built the immutable module and selected values into the exact objects retained by this base.",
      "The module's ordered apply and optional test remain lifecycle work beside the literal objects.",
    ];
  } else if (source.type === "kubara") {
    method = "generator";
    boundaries = [
      "Kubara generated the exact platform bootstrap objects retained by this base.",
      "Referenced component sources keep their own processing and lifecycle decisions.",
    ];
  } else if (source.type === "sveltos") {
    method = "read-literal-configuration";
    materializationStatus = "recorded-no-op";
    boundaries = [
      "The Sveltos ClusterProfile is already a literal Kubernetes object.",
      "The Helm chart referenced by the ClusterProfile remains a nested source that Sveltos processes on selected clusters.",
    ];
  } else if (["configuration-oci", "kubernetes-yaml", "rendered-config"].includes(source.type)) {
    method = "read-literal-configuration";
    materializationStatus = "recorded-no-op";
    boundaries = [
      "The source already contains exact Kubernetes objects; parsing and canonicalization do not change their meaning.",
    ];
  } else if (source.type === "source-oci" || source.type === "cub-installer") {
    method = "source-oci-processor";
    boundaries = [
      "The source OCI is an input package. Its declared processor produces the exact objects retained by this base.",
    ];
  } else if (source.type === "confighub") {
    method = "read-confighub-revision";
    materializationStatus = "recorded-no-op";
    boundaries = [
      "The ConfigHub revision already contains the exact retained objects.",
    ];
  }

  return {
    sourceIntent: {
      status: sourceRecord && existsRepo(sourceRecord) ? "recorded" : "gap",
      record: sourceRecord ?? "",
    },
    materialization: {
      method,
      status: materializationStatus,
      outputDigest: identity.objectSet.digest,
      record: identity.objectSet.digestRecord,
    },
    flattening: flatteningRecord(record, intent),
    boundaries,
  };
}

function flatteningRecord(record, intent) {
  const source = record.spec.source;
  let verdictPath = "";
  let verdict = "not-assessed";

  if (source.type === "helm" && intent) {
    const publication = join(repoRoot, intent.spec.renderInputs.recipe, "publication");
    if (existsSync(publication)) {
      for (const name of readdirSync(publication).filter(
        (candidate) => candidate.startsWith("flattening-safety-verdict") && candidate.endsWith(".yaml"),
      )) {
        const candidatePath = join(publication, name);
        const candidate = readYaml(candidatePath);
        if (candidate.spec?.auditedBase === record.spec.baseVariant.name) {
          verdictPath = relativeRepo(candidatePath);
          verdict = candidate.spec?.verdict?.lane ?? "not-assessed";
          break;
        }
      }
    }
  } else if (
    source.type === "aicr"
    && record.spec.configuration.format === "argocd-application-yaml"
  ) {
    const candidates = [
      join(
        repoRoot,
        "examples",
        "aicr",
        `eks-h100-training-kubeflow-${String(source.version).replace(/^v/, "v").replaceAll(".", "-")}`,
        "flattening-safety-verdict.yaml",
      ),
      join(
        repoRoot,
        "data",
        "aicr-flattening-verdicts",
        "aicr-eks-h100-training-kubeflow",
        "flattening-safety-verdict.yaml",
      ),
    ];
    for (const candidatePath of candidates) {
      if (!existsSync(candidatePath)) continue;
      const candidate = readYaml(candidatePath);
      const candidateVersion = candidate.spec?.subject?.upstreamVersion;
      if (candidateVersion && candidateVersion !== source.version) continue;
      verdictPath = relativeRepo(candidatePath);
      verdict = candidate.spec?.verdict?.lane ?? "not-assessed";
      break;
    }
  } else if (source.type === "timoni") {
    const candidatePath = join(
      repoRoot,
      "examples",
      "timoni",
      "redis-8-10-1",
      "flattening-safety-verdict.yaml",
    );
    if (existsSync(candidatePath)) {
      const candidate = readYaml(candidatePath);
      verdictPath = relativeRepo(candidatePath);
      verdict = candidate.spec?.verdict?.lane ?? "not-assessed";
    }
  } else if (["configuration-oci", "kubernetes-yaml", "rendered-config", "sveltos"].includes(source.type)) {
    verdict = "born-flattened";
    verdictPath = source.record;
  }

  const action = {
    "born-flattened": "retain-exact-objects",
    "safe-to-flatten": "retain-exact-objects",
    "flatten-with-routes": "retain-exact-objects-with-routes",
    "unsafe-to-flatten": "process-source-late",
    "not-assessed": "assessment-required",
  }[verdict] ?? "assessment-required";
  return {
    status: verdict === "not-assessed" ? "not-assessed" : "decided",
    verdict,
    action,
    scope: `${source.name}@${source.version}/${record.spec.baseVariant.name}; recheck after source, lifecycle-sensitive variant, destination, or delivery-runtime changes`,
    record: verdictPath,
  };
}

function lifecycleRecord(record, intent, legacyRouting) {
  const routes = Array.isArray(legacyRouting.routes) ? legacyRouting.routes : [];
  const targetFactEnvelope = legacyRouting.targetFacts ?? {};
  const targetFacts = targetFactEnvelope.declared
    && typeof targetFactEnvelope.declared === "object"
    ? targetFactEnvelope.declared
    : Object.fromEntries(
      Object.entries(targetFactEnvelope).filter(
        ([key]) => !["status", "requirements", "coverage"].includes(key),
      ),
    );
  const targetRequirements = Array.isArray(targetFactEnvelope.requirements)
    ? targetFactEnvelope.requirements
    : [];
  const requirements = [
    ...routes.map((route, index) => ({
      id: String(route.routeName ?? route.id ?? `route-${index + 1}`),
      origin: "base",
      type: "lifecycle-action",
      detail: firstNonEmptyString(
        route.operatingDetails,
        route.note,
        route.reason,
        route.quirkClass,
        route.routeName,
        route.id,
        "Recorded lifecycle action",
      ),
    })),
    ...targetRequirements.map((requirement, index) => ({
      id: String(requirement.name ?? `${requirement.category ?? "target-fact"}-${index + 1}`),
      origin: "base",
      type: "target-fact",
      detail: targetRequirementDetail(requirement),
    })),
  ];
  if (requirements.length === 0 && record.spec.source.type !== "helm" && Object.keys(targetFacts).length > 0) {
    requirements.push({
      id: "source-target-facts",
      origin: "base",
      type: "target-facts",
      detail: "The source record declares destination facts that must be checked when a target is selected.",
    });
  }

  const lifecycleCoverage = intent?.spec?.lifecycle?.coverage?.state ?? "";
  const targetCoverage = intent?.spec?.targetFacts?.coverage?.state ?? "";
  const recordCoverage = legacyRouting.coverage?.state ?? "";
  const targetFactRecordCoverage = targetFactEnvelope.coverage?.state ?? "";
  const hasGap = [
    lifecycleCoverage,
    targetCoverage,
    recordCoverage,
    targetFactRecordCoverage,
  ]
    .includes("actionable-gap");
  const requirementsStatus = hasGap
    ? "gap"
    : requirements.length > 0
      ? "recorded"
      : "not-required";
  const routeIntentStatus = hasGap
    ? "gap"
    : routes.length > 0
      ? "recorded"
      : targetRequirements.length > 0 || (record.spec.source.type !== "helm" && requirements.length > 0)
        ? "required-at-destination"
        : "not-required";
  const records = uniqueExistingPaths([
    legacyRouting.sourceRecord,
    intent?.spec?.lifecycle?.contractPath,
    intent?.spec?.lifecycle?.jsonPath,
  ]);
  const normalizedRoutes = routes.map((route, index) => normalizeRouteIntent(route, index));
  const targetRequirementRefs = requirements
    .filter((requirement) => requirement.type === "target-fact" || requirement.type === "target-facts")
    .map((requirement) => requirement.id);
  const externalResolutionRecords = record.metadata.name
    === "prometheus-community-kube-prometheus-stack-85-3-3-no-crds"
    ? [
        "data/lifecycle-route-resolutions/kube-prometheus-stack-85-3-3-no-crds-direct.yaml",
        "data/lifecycle-route-resolutions/kube-prometheus-stack-85-3-3-no-crds-argo-cd.yaml",
        "data/lifecycle-route-resolutions/kube-prometheus-stack-85-3-3-no-crds-flux.yaml",
      ]
    : record.metadata.name === "aicr-eks-h100-training-kubeflow-v0-19-0-argocd"
      ? [
          "data/lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-19-0-staging-argo-cd.yaml",
        ]
      : [];
  const externalResolutions = externalResolutionRecords
    .filter(existsRepo)
    .map((path) => readYaml(join(repoRoot, path)));
  const hasBlockedResolution = externalResolutions.some(
    (resolution) => resolution.status?.decision === "blocked",
  );
  const hasRouteRuntimeResolution = routes.some(routeHasResolvedRuntime);
  const resolvedForRecordedTargets = externalResolutionRecords.length > 0
    || hasRouteRuntimeResolution;
  const resolvedRecords = resolvedForRecordedTargets || hasBlockedResolution
    ? uniqueExistingPaths([
      ...externalResolutionRecords,
      ...collectPathStrings(routes),
      ...(hasRouteRuntimeResolution ? collectPathStrings(record.spec.evidence) : []),
    ])
    : [];
  const resolutionStatus = hasGap
    ? "gap"
    : requirementsStatus === "not-required" && routeIntentStatus === "not-required"
      ? "not-required"
      : hasBlockedResolution
        ? "blocked"
      : resolvedForRecordedTargets
        ? "resolved-for-recorded-targets"
        : "awaits-variant-and-target";

  return {
    requirements: {
      status: requirementsStatus,
      items: requirements,
      records,
    },
    routeIntent: {
      status: routeIntentStatus,
      routes: normalizedRoutes,
      records,
    },
    targetFacts: {
      status: hasGap
        ? "gap"
        : Object.keys(targetFacts).length > 0
          ? "recorded"
          : "not-required",
      declared: targetFacts,
      requirementRefs: targetRequirementRefs,
      records,
    },
    resolution: {
      status: resolutionStatus,
      rule: "Re-resolve after a lifecycle-sensitive variant change, destination assignment, or delivery-runtime change; bind the result to the exact configuration digest.",
      records: resolvedRecords,
    },
  };
}

function normalizeRouteIntent(route, index) {
  const id = String(route.routeName ?? route.id ?? `route-${index + 1}`);
  const sourceStatus = String(route.disposition ?? route.status ?? "recorded");
  const routeText = [
    route.whoRuns,
    route.owner,
    route.operatingDetails,
    route.note,
    route.action,
    route.reason,
  ].filter(Boolean).join(" ");
  const supportedRuntimes = new Set(
    Object.keys(route.runners ?? {}).map(canonicalRuntimeName),
  );
  if (/argo\s*cd/i.test(routeText)) supportedRuntimes.add("Argo CD");
  if (/flux/i.test(routeText)) supportedRuntimes.add("Flux");
  if (/cub installer/i.test(routeText)) supportedRuntimes.add("cub installer");
  if (/direct|kubectl/i.test(routeText)) supportedRuntimes.add("direct apply");
  const status = /blocked|gap|refused/i.test(sourceStatus)
    ? "blocked"
    : /not[- ]run|not[- ]live|not[- ]evaluated|generated/i.test(sourceStatus)
      ? "requires-destination-resolution"
      : "recorded";
  return {
    id,
    requirementRefs: [id],
    phase: String(route.lifecyclePhase ?? "destination-resolution"),
    proposedActor: routeIntentActor(route),
    proposedMechanism: firstNonEmptyString(
      route.operatingDetails,
      route.note,
      route.action,
      route.reason,
      route.runners?.direct?.implementation,
      route.whoRuns,
      route.quirkClass,
      "Resolve this requirement for the selected destination.",
    ),
    automatic: route.automatic === true,
    status,
    sourceStatus,
    supportedRuntimes: [...supportedRuntimes].sort(),
    checks: [route.evidenceRequired, route.nextAction].filter(Boolean).map(String),
    evidence: uniqueExistingPaths(collectPathStrings(route)),
    ...(String(route.order ?? "").trim()
      ? { orderHint: Number.isInteger(route.order) ? route.order : String(route.order).trim() }
      : {}),
  };
}

function targetRequirementDetail(requirement) {
  if (String(requirement.purpose ?? "").trim()) return String(requirement.purpose).trim();
  const category = String(requirement.category ?? "target fact").trim();
  const name = String(requirement.name ?? "").trim();
  const timing = String(requirement.requiredBefore ?? "apply").trim();
  if (name) return `${category.toUpperCase() === "CRD" ? "CRD" : category} ${name} must exist before ${timing}.`;
  return `The destination must provide the recorded ${category}.`;
}

function canonicalRuntimeName(value) {
  return {
    argoCd: "Argo CD",
    flux: "Flux",
    direct: "direct apply",
    cubInstallerApply: "cub installer direct runner",
  }[value] ?? value;
}

function routeIntentActor(route) {
  if (String(route.owner ?? "").trim()) return String(route.owner).trim();
  const whoRuns = String(route.whoRuns ?? "").trim();
  if (/generated package script/i.test(whoRuns)) return "cub installer package script";
  if (/your delivery/i.test(whoRuns)) return "delivery workflow";
  if (/your applier/i.test(whoRuns)) return "selected applier";
  if (/your cluster/i.test(whoRuns)) return "Kubernetes";
  if (/\bCI\b|on demand/i.test(whoRuns)) return "CI or operator";
  if (/controller-created|operator-supplied/i.test(whoRuns)) {
    return "destination controller or operator";
  }
  if (/^prerequisite/i.test(whoRuns)) return "operator";
  if (/not tested|not selected/i.test(whoRuns)) return "not selected";
  return {
    "user-executes": "delivery workflow",
    "target-owned": "destination or delivery controller",
    "not-yet-executable": "not selected",
    "destination-specific": "selected destination actor",
  }[route.executionMode] ?? firstNonEmptyString(whoRuns, "not selected");
}

function firstNonEmptyString(...values) {
  const value = values.find((candidate) => String(candidate ?? "").trim());
  return String(value ?? "").trim();
}

function ownershipRecord(record, intent, legacyRouting) {
  const source = record.spec.source;
  const fieldPolicy = source.version === "v0.19.0"
    ? "examples/aicr/eks-h100-training-kubeflow-v0-19-0/field-policy-assessment.yaml"
    : "";
  const targetSupplied = (legacyRouting.targetFacts?.requirements ?? []).map(
    (requirement) => String(requirement.name ?? requirement.category ?? "target input"),
  );
  const deliveryProtected = (legacyRouting.routes ?? [])
    .filter((route) => /prune|resource-policy|cleanup/i.test(JSON.stringify(route)))
    .map((route, index) => String(route.routeName ?? route.id ?? `delivery-rule-${index + 1}`));
  let status = "not-assessed";
  let sourceControlled = [];
  let variantControlled = [];
  let records = [];

  if (source.type === "helm" && intent) {
    status = "partly-declared";
    sourceControlled = ["Fields produced from the recorded chart values and render context"];
    variantControlled = ["Post-render object fields recorded in ConfigHub after upload"];
    records = [source.record];
  } else if (fieldPolicy && existsRepo(fieldPolicy)) {
    status = "declared";
    sourceControlled = ["Fields classified as source-owned by the AICR v0.19 field-policy assessment"];
    variantControlled = ["Fields classified as safe reviewed ConfigHub changes by the AICR v0.19 field-policy assessment"];
    records = [fieldPolicy];
  } else if ([
    "aicr",
    "timoni",
    "cub-installer",
    "kubara",
    "sveltos",
    "source-oci",
    "configuration-oci",
    "kubernetes-yaml",
    "confighub",
    "rendered-config",
  ].includes(source.type)) {
    status = "partly-declared";
    sourceControlled = ["Choices fixed by the recorded source configuration"];
    variantControlled = ["Exact object changes retained after the base"];
    records = uniqueExistingPaths([
      source.record,
      record.spec.promotion?.receipt,
    ]);
  }

  return {
    status,
    sourceControlled,
    variantControlled,
    targetSupplied,
    deliveryProtected,
    records: uniqueExistingPaths(records),
    rule: "Re-evaluate ownership when the source, variant, destination, or delivery behavior changes; overlapping source and variant edits require review.",
  };
}

function routeHasResolvedRuntime(route) {
  if (route?.status === "live-pass") return true;
  return Object.values(route?.runners ?? {}).some((runner) => runner?.status === "pass");
}

function collectPathStrings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectPathStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(collectPathStrings);
  return [];
}

function uniqueExistingPaths(values) {
  return [...new Set((values ?? []).filter(
    (value) => typeof value === "string" && value.includes("/") && existsRepo(value),
  ))].sort();
}

function targetFactInputs(declared) {
  const result = [];
  for (const [kind, values] of Object.entries(declared ?? {})) {
    for (const [index, value] of (Array.isArray(values) ? values : [values]).entries()) {
      const object = value && typeof value === "object" ? value : { value };
      result.push({
        name: String(object.name ?? object.ref ?? object.value ?? `${kind}-${index + 1}`),
        type: kind,
        required: true,
        details: object,
      });
    }
  }
  return result;
}

function objectsInDirectory(root, { includeTemplates = false } = {}) {
  const files = listFiles(root)
    .filter((path) => [".yaml", ".yml"].includes(extname(path)))
    .filter((path) => (includeTemplates || !path.includes("/templates/")) && !path.endsWith("/Chart.yaml"))
    .sort();
  return parseObjects(files.map((path) => readFileSync(path, "utf8")).join("\n---\n"));
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function renderRecordsCsv(records) {
  const headers = [
    "name",
    "source_type",
    "source_name",
    "source_version",
    "base",
    "status",
    "object_count",
    "base_digest_role",
    "object_digest",
    "object_digest_role",
    "source_record",
    "objects",
    "source_intent_status",
    "materialization_status",
    "flattening_verdict",
    "lifecycle_requirements_status",
    "route_intent_status",
    "route_resolution_status",
    "field_ownership_status",
    "package_oci_ref",
    "literal_config_oci_status",
    "release_oci_status",
    "policy_profile",
    "resource_class",
    "owner_class",
    "change_cadence",
    "classification_source",
    "live_space",
  ];
  const rows = records.map((record) => {
    const row = {
      name: record.metadata.name,
      source_type: record.spec.source.type,
      source_name: record.spec.source.name,
      source_version: record.spec.source.version,
      base: record.spec.baseVariant.name,
      status: record.status.level,
      object_count: String(record.spec.configuration.objectCount),
      base_digest_role: record.spec.baseVariant.digestRole,
      object_digest: record.spec.configuration.digest,
      object_digest_role: record.spec.configuration.digestRole,
      source_record: record.spec.source.record,
      objects: record.spec.configuration.objects,
      source_intent_status: record.spec.processing.sourceIntent.status,
      materialization_status: record.spec.processing.materialization.status,
      flattening_verdict: record.spec.processing.flattening.verdict,
      lifecycle_requirements_status: record.spec.lifecycle.requirements.status,
      route_intent_status: record.spec.lifecycle.routeIntent.status,
      route_resolution_status: record.spec.lifecycle.resolution.status,
      field_ownership_status: record.spec.ownership.status,
      package_oci_ref: record.spec.source.packageOciRef,
      literal_config_oci_status: record.spec.delivery.literalConfigOci.status,
      release_oci_status: record.spec.delivery.configHubReleaseOci.status,
      policy_profile: record.spec.policy.profile,
      resource_class: record.spec.operations.resourceClass,
      owner_class: record.spec.operations.ownerClass,
      change_cadence: record.spec.operations.changeCadence,
      classification_source: record.spec.operations.classificationSource,
      live_space: record.spec.operations.liveSpace,
    };
    return headers.map((header) => csvCell(row[header] ?? "")).join(",");
  });
  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function renderBaseSummary(records) {
  const sourceCounts = countBy(records, (record) => record.spec.source.type);
  const statusCounts = countBy(records, (record) => record.status.level);
  const flatteningCounts = countBy(
    records,
    (record) => record.spec.processing.flattening.verdict,
  );
  const requirementCounts = countBy(
    records,
    (record) => record.spec.lifecycle.requirements.status,
  );
  const routeIntentCounts = countBy(
    records,
    (record) => record.spec.lifecycle.routeIntent.status,
  );
  const routeResolutionCounts = countBy(
    records,
    (record) => record.spec.lifecycle.resolution.status,
  );
  const ownershipCounts = countBy(records, (record) => record.spec.ownership.status);
  const resolvedRouteCount = records.filter(
    (record) => record.spec.lifecycle.resolution.status === "resolved-for-recorded-targets",
  ).length;
  const assessedFlatteningCount = records.filter(
    (record) => record.spec.processing.flattening.status === "decided",
  ).length;
  const declaredOwnershipCount = records.filter(
    (record) => record.spec.ownership.status === "declared",
  ).length;
  const classifiedRecords = records.filter(
    (record) => record.spec.operations.classificationSource,
  );
  const redis = records.find((record) => record.metadata.name === "bitnami-redis-25-5-3-default");
  const nginxDelivery = records.find(
    (record) => record.metadata.name === catalogOciDeliveryRecord,
  );
  const argo = records.find((record) => record.metadata.name === "argo-cd-argo-cd-9-5-15-no-crds");
  const aicrFlux = records.find(
    (record) => record.metadata.name === "aicr-eks-h100-training-kubeflow-v0-14-0-base",
  );
  const aicrArgoCd = records.find(
    (record) => record.metadata.name === "aicr-eks-h100-training-kubeflow-v0-14-0-argocd",
  );
  const kubara = records.find((record) => record.spec.source.type === "kubara");
  const sveltos = records.find((record) => record.spec.source.type === "sveltos");
  const cubInstaller = records.find((record) => record.spec.source.type === "cub-installer");
  const timoni = records.find((record) => record.spec.source.type === "timoni");
  const configurationOci = records.find(
    (record) => record.spec.source.type === "configuration-oci",
  );
  const plainYaml = records.find((record) => record.spec.source.type === "kubernetes-yaml");
  return `# Base variant records

Generated by \`scripts/generate-config-catalog-program.mjs\`. Do not edit the generated records by hand.

There are **${records.length} records**: ${formatCounts(sourceCounts)}. Their current statuses are ${formatCounts(statusCounts)}.

A base-variant record connects one exact configuration to its source and intent. It records how the objects were materialized, whether they can be retained as literal configuration, what lifecycle work may surround apply, which fields each layer controls, and which OCI and delivery results exist. It does not imply that every record is present in a live ConfigHub org.

The processing coverage is explicit rather than inferred:

- Flattening verdicts: ${formatCounts(flatteningCounts)}.
- Lifecycle requirements: ${formatCounts(requirementCounts)}.
- Portable route intents: ${formatCounts(routeIntentCounts)}.
- Variant-and-destination route resolution: ${formatCounts(routeResolutionCounts)}.
- Field ownership: ${formatCounts(ownershipCounts)}.

## Model and Catalog alignment

All **${records.length}/${records.length} records** use the same source-neutral structure. Every row identifies its source record, base-revision digest role, exact-object digest role, materialization result, flattening status, lifecycle requirements, route intent, target-resolution status, field ownership, delivery evidence, and current limits.

The evidence is not complete for every row:

| Area | Current Catalog coverage | Which is ahead? |
| --- | ---: | --- |
| Exact source and object records | ${records.length}/${records.length} | Catalog and model are aligned. |
| Concrete entry formats | ${Object.keys(sourceCounts).length} | The Catalog has Helm, AICR, Timoni, cub installer source OCI, Kubara, Sveltos, literal configuration OCI, and plain YAML examples. The model is ahead for a generic non-installer source OCI and ConfigHub-release re-entry. |
| Flattening verdicts | ${assessedFlatteningCount}/${records.length} | The model is ahead of the unassessed rows. |
| Destination-specific route resolutions | ${resolvedRouteCount}/${records.length} | The model is ahead. The resolved records cover one Helm configuration through direct apply, Argo CD, and Flux. |
| Fully declared field ownership | ${declaredOwnershipCount}/${records.length} | The model is ahead. Most Helm rows currently separate source values from post-render changes without field-by-field ownership. |

The record structure is aligned across every row. The evidence is not. The Catalog is ahead in one area: its Helm source and render evidence is much broader than the non-Helm corpus. The model is ahead where it defines generic source-OCI entry, ConfigHub-release re-entry, variant-time ownership, and destination-specific lifecycle handling that still need more examples or evidence. A row marked \`awaits-variant-and-target\`, \`not-assessed\`, or \`gap\` identifies that missing work.

${classifiedRecords.length} canonical records also name who owns the configuration, where it should run, which checks apply, and how it should roll out. The [operational class examples](../operational-class-examples/summary.md) explain those choices. The other records remain \`not-yet-classified\`; the generator does not guess from a chart name.

## What to read

| Question | Field |
| --- | --- |
| Where did this configuration come from? | \`spec.source\` |
| Which exact configuration is managed? | \`spec.configuration\` |
| How were the objects produced, and may they be flattened? | \`spec.processing\` |
| What was fixed and what remains to set? | \`spec.inputs\` |
| What must happen around ordinary apply, and has it been resolved for a target? | \`spec.lifecycle\` |
| Which layer controls each field? | \`spec.ownership\` |
| Which OCI artifact is this? | \`spec.delivery\` |
| Which checks run before apply? | \`spec.policy\` |
| Who owns it, where does it run, and how should it roll out? | \`spec.operations\` when classified |
| What has actually been proved? | \`spec.evidence\` and \`status\` |

## Examples

- [Redis default](${redis ? `records/${redis.metadata.name}.yaml` : ""}) connects a Helm render intent, 14 literal objects, and its revision digest without claiming a current controller-delivery receipt.
- [NGINX http-clusterip](${nginxDelivery ? `records/${nginxDelivery.metadata.name}.yaml` : ""}) records the first exact catalog base published as one ConfigHub release OCI and consumed at the same digest by Argo CD and Flux. A separate direct local test consumed the same artifact.
- [Argo CD no-crds](${argo ? `records/${argo.metadata.name}.yaml` : ""}) shows a base with external CRD requirements.
- [AICR EKS H100 training for Flux](${aicrFlux ? `records/${aicrFlux.metadata.name}.yaml` : ""}) records the generated Flux objects, their controller requirements, and a locally tested OCI bundle without claiming a live upload.
- [AICR EKS H100 training for Argo CD](${aicrArgoCd ? `records/${aicrArgoCd.metadata.name}.yaml` : ""}) connects AICR's generated Helm source package to the 17 rendered Application objects that ConfigHub can upload.
- [Timoni Redis default](${timoni ? `records/${timoni.metadata.name}.yaml` : ""}) records one immutable module, its typed configuration, seven exact objects, and the master-first lifecycle work that plain YAML does not carry.
- [cub installer source package](${cubInstaller ? `records/${cubInstaller.metadata.name}.yaml` : ""}) separates the public multi-preset package digest from the exact five-object output of one selected preset.
- [Literal configuration OCI](${configurationOci ? `records/${configurationOci.metadata.name}.yaml` : ""}) records a public five-object OCI, its separate object-set digest, its required Secret, and an unchanged ConfigHub import.
- [Plain Kubernetes YAML](${plainYaml ? `records/${plainYaml.metadata.name}.yaml` : ""}) records an unchanged four-object upload and leaves lifecycle assessment as a visible gap.
- [Kubara local platform](${kubara ? `records/${kubara.metadata.name}.yaml` : ""}) connects Kubara's generated platform source, 77 rendered bootstrap objects, and the recorded CRD, hook, Secret, and External Secrets work.
- [Sveltos Kyverno fleet](${sveltos ? `records/${sveltos.metadata.name}.yaml` : ""}) records a two-wave result: ConfigHub approved a pilot and one selector expansion at different OCI digests, then Sveltos installed Kyverno and repaired drift on both staging clusters.

## Files

- [records.csv](./records.csv) is the compact index.
- [records.json](./records.json) contains every generated record.
- [schemas/base-variant-record.schema.json](../../schemas/base-variant-record.schema.json) defines the record shape.
- [Config catalog doctrine](../../docs/reference/config-catalog-doctrine.md) explains how the sources, variants, policy, delivery, and Apps fit together.
`;
}

function renderOperationalClassSummary(source, policy, records) {
  const examples = source.spec.examples;
  const policyByClass = new Map(
    policy.spec.operationalClasses.map((item) => [item.name, item]),
  );
  const classNames = {
    "user-workload": "User workload",
    "system-service": "Shared system service",
    "system-configuration": "Cluster-wide system configuration",
  };
  const policyName = {
    baseline: "common checks",
    approvalRequired: "common checks plus approval",
  };
  const table = examples.map((example) => {
    const resourceClass = example.operations.resourceClass;
    return `| ${classNames[resourceClass]} | [${example.name}](../base-variant-records/records/${example.record}.yaml) | \`${example.operations.ownerClass}\` | \`${example.target.scope}\` | ${policyName[example.gates.normalSet]} | ${policyName[example.gates.productionSet]} |`;
  }).join("\n");
  const details = examples.map((example) => {
    const resourceClass = example.operations.resourceClass;
    const classPolicy = policyByClass.get(resourceClass);
    const evidence = example.evidence
      .map((path) => `- [${path}](../../${path})`)
      .join("\n");
    return `## ${classNames[resourceClass]}: ${example.name}

${example.why}

- **Owner:** \`${example.operations.ownerClass}\`
- **Target:** \`${example.target.scope}\`. ${example.target.selection}
- **Checks outside production:** ${policyName[example.gates.normalSet]}.
- **Checks in production:** ${policyName[example.gates.productionSet]}.
- **Rollout:** ${example.rollout.sequence.join(" -> ")}.
- **Recorded result:** \`${example.rollout.status}\`. ${example.rollout.limit}
- **Live demo Space:** \`${example.liveSpace}\`

Why these checks apply: ${classPolicy.reason}

Evidence:

${evidence}`;
  }).join("\n\n");
  return `# Who operates this configuration?

When a configuration reaches ConfigHub, the team must decide who owns it and how widely a mistake could spread. An application, a shared monitoring service, and cluster-wide platform configuration should not use identical approval and rollout rules, even when they started from the same package format.

These three examples are checked by the catalog generator and attached to their base-variant records:

| What it controls | Example | Owner | Target | Normal checks | Production checks |
| --- | --- | --- | --- | --- | --- |
${table}

${details}

## Current boundary

These are the three canonical examples, not an automatic classification of all ${records.length} base records. Unclassified records continue to say \`not-yet-classified\`; the generator does not guess from a chart name. Add a classification only when ownership, target scope, policy, rollout choice, and evidence are known.

Source: [config-catalog/operational-class-examples.yaml](../../config-catalog/operational-class-examples.yaml). Schema: [schemas/operational-class-examples.schema.json](../../schemas/operational-class-examples.schema.json).
`;
}

function renderPolicySummary(policy) {
  const baseline = policy.spec.baseline;
  const approvalRequired = policy.spec.approvalRequired;
  const baselineCheckCount = baseline.checks.length;
  const liveReceiptPath = join(
    repoRoot,
    "data",
    "apply-policy-profiles",
    "live-helm-catalog.yaml",
  );
  const liveReceipt = existsSync(liveReceiptPath)
    ? readYaml(liveReceiptPath)
    : null;
  const sourceTypeSpaces = liveReceipt?.spec?.spaces?.sourceTypes ?? {};
  const sourceCoverage = policy.spec.sourceTypes
    .map((sourceType) => `| \`${sourceType}\` | ${(sourceTypeSpaces[sourceType] ?? []).length} |`)
    .join("\n");
  return `# Apply policy profiles

Generated from [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

The \`${policy.metadata.name}\` profile applies to ${policy.spec.sourceTypes.join(", ")} after their configuration has become ConfigHub data.

The live receipt records at least one policy-covered Space for every maintained starting format:

| Starting format | Live Spaces |
| --- | ---: |
${sourceCoverage}

## Common checks

Filter: \`${baseline.filter}\`

This filter names the ${baselineCheckCount} common checks explicitly:

\`${baseline.filterWhere}\`

${renderChecksTable(baseline.checks)}

## Approval required

Filter: \`${approvalRequired.filter}\`

Production releases and system configuration keep the ${baselineCheckCount} common checks and add one required approval:

\`${approvalRequired.filterWhere}\`

${renderChecksTable(approvalRequired.checks)}

## Operational resource classes

The source format does not decide the risk. A Helm chart, AICR package, or ordinary YAML file can describe any of these:

| Resource class | Normal policy | Production policy | Why |
| --- | --- | --- | --- |
${policy.spec.operationalClasses.map((item) => `| \`${item.name}\` | ${renderPolicyName(item.normalPolicy)} | ${renderPolicyName(item.productionPolicy)} | ${item.reason} |`).join("\n")}

## Scope rules

${policy.spec.scopeAssertions.map((item) => `- ${item}`).join("\n")}

${policy.status.liveReverified
  ? `The live \`helm-catalog\` filters and their assigned Spaces were checked on **${policy.status.lastRecorded}**. Read the [live receipt](./live-helm-catalog.yaml).`
  : `The last committed live-org result is dated **${policy.status.lastRecorded}**. It has not been rechecked against the current org.`}

The [functional proof](../apply-policy-functional-proof/summary.md) uses temporary Units to show what happens at the delivery boundary. Placeholder values, invalid Kubernetes data, a literal credential, and unapproved system configuration receive blocking ApplyGates. After the test approves the exact head revision, the approval gate clears. An unpinned image and missing probes are reported as warnings without adding an ApplyGate. The separate Hooks and CRDs receipt proves that an unsupported automatic lifecycle route is blocked. No fixture was delivered to Kubernetes.

Run:

\`\`\`bash
npm run config-catalog:verify
npm run config-catalog:self-test
npm run config-catalog:policy:verify
npm run helm-org:policy:receipt:verify
# With a valid helm-catalog login:
npm run helm-org:policy:verify
\`\`\`

The self-test inserts an approval into the common checks, removes a common check from the approval-required set, and changes a warning into a block. Each broken profile must fail. The receipt verifier checks the committed result without contacting ConfigHub. The live verifier re-reads ConfigHub and fails if the filters, checks, or Space assignments have changed.
`;
}

function renderDemoSummary(program) {
  return `# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml).

This is the status index for the source pathways and ConfigHub App demonstrations. **Worked example** says whether one bounded example has run. **Broader status** says how much of the general path or product capability is supported. A working example does not turn its stated limits into a general claim.

${renderArchitecture(program.spec.architecture)}

${renderCatalogNavigation(program.spec.catalogNavigation)}

${renderReviewQuestions(program.spec.reviewQuestions)}

## Example journey

${renderExampleJourneyTable(program.spec.exampleJourney)}

## Source pathways

${renderDemoTable(program.spec.pathways)}

## ConfigHub Apps

${renderDemoTable(program.spec.apps)}

Read [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md) for the plain-English walkthrough and [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) for the shared model.
`;
}

function renderGeneratedGuide(program, policy) {
  const sections = [
    ["Ways to start", program.spec.pathways],
    ["Apps built from the same records", program.spec.apps],
  ];
  const rendered = sections.map(([heading, demos]) => {
    const body = demos.map((demo) => `### ${demo.name}

**Worked example: ${demo.workedExample.status}.** ${demo.workedExample.result}

**Broader status: ${demo.status}.** ${demo.workedExample.limit}

${demo.problem}

${demo.result}

${demo.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}

Start with ${demo.entrypoints.map((path) => repoLink(path)).join(" or ")}.

Evidence: ${demo.evidence.map((path) => repoLink(path)).join(", ")}.

Current limit: ${demo.limits.join(" ")}`).join("\n\n");
    return `## ${heading}\n\n${body}`;
  }).join("\n\n");
  const liveReceiptPath = join(
    repoRoot,
    "data",
    "apply-policy-profiles",
    "live-helm-catalog.yaml",
  );
  const liveReceipt = existsSync(liveReceiptPath)
    ? readYaml(liveReceiptPath)
    : null;
  const baselineCount = liveReceipt?.spec?.spaces?.baseline?.length;
  const approvalCount = liveReceipt?.spec?.spaces?.approvalRequired?.length;
  const productionCount = liveReceipt?.spec?.spaces?.approvalReasons?.production?.length;
  const systemConfigurationCount
    = liveReceipt?.spec?.spaces?.approvalReasons?.systemConfiguration?.length;
  const sourceTypeSpaces = liveReceipt?.spec?.spaces?.sourceTypes ?? {};
  const baselineCheckCount = policy.spec.baseline.checks.length;
  const liveCounts = Number.isInteger(baselineCount) && Number.isInteger(approvalCount)
    ? `On ${policy.status.lastRecorded}, the live \`helm-catalog\` org had ${baselineCount} Spaces on the ${baselineCheckCount} common checks and ${approvalCount} Spaces on those checks plus approval (${productionCount} production and ${systemConfigurationCount} system configuration).`
    : `The live receipt records which Spaces use the common checks and which also require approval.`;
  const sourceCoverage = policy.spec.sourceTypes
    .map((sourceType) => `${sourceType} ${(sourceTypeSpaces[sourceType] ?? []).length}`)
    .join(", ");

  return `# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml). Edit the programme file, then run \`npm run config-catalog\`.

The catalog begins with Helm and adds other configuration formats without making teams rewrite them.

${renderArchitecture(program.spec.architecture)}

${renderCatalogNavigation(program.spec.catalogNavigation)}

${renderReviewQuestions(program.spec.reviewQuestions)}

${renderExampleJourney(program.spec.exampleJourney)}

${rendered}

## What every maintained example receives

Each maintained example has one human-readable README, the exact configuration objects, identifying labels, and a **source and intent record**. The source and intent record explains where the objects came from, which choices produced them, what remains to be supplied, and which checks support the result.

This is one document role, not one forced schema. Helm uses \`HelmRenderIntent\`. AICR uses its recipe and generation or bundle receipts. Existing OCI and plain YAML use records that name their source digest or checksums, object inventory, remaining inputs, prerequisites, and transformations. A non-Helm source is never given a fake Helm record.

Hooks, CRDs, Secrets, setup jobs, and target facts are recorded when they apply to that exact configuration. A simple YAML example should remain simple. A chart with lifecycle work must name who performs it and link the evidence or state the gap.

New maintained examples follow this rule. Today, the source and intent role may use a source Unit, Space metadata plus a committed receipt, or a generated base-variant record. ConfigHub does not yet have one first-class source object for every format.

An arbitrary upload does not gain source history or chart-specific facts that ConfigHub cannot know. Generic checks can attach automatically. The source adapter or a reviewed catalog addition must supply the source-and-intent record and any required lifecycle records. Missing information remains a gap. Temporary experiments and legacy Spaces are not counted as conforming until their common and applicable helper records pass the same checks.

## The common policy

Every pathway uses [the catalog-standard apply policy](../../config-catalog/policies/catalog-standard.yaml) after upload. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Ordinary Kubernetes workloads and AICR training runtimes have checks for the fields they actually use. Production releases and system configuration keep the ${baselineCheckCount} common checks and add one required approval.

This choice is based on what the configuration controls, not whether it started as Helm, AICR, \`cub installer\`, Kubara, Sveltos, or YAML. ${liveCounts} The receipt includes every maintained starting format: ${sourceCoverage}.

The [live topology receipt](../../data/apply-policy-profiles/live-helm-catalog.yaml) records which checks are connected to which Spaces. The [functional proof](../../data/apply-policy-functional-proof/summary.md) tests the behavior with temporary records: placeholders, invalid Kubernetes data, literal credential environment values, and missing approval are blocked; a Secret-backed value and the same system configuration after approval are allowed; and an unpinned image and missing probes are reported without blocking a dry run. No fixture configuration was applied to Kubernetes. Rerun \`npm run helm-org:policy:verify\` while logged into the org to compare the current topology with its receipt.
`;
}

function renderArchitecture(architecture) {
  const anonymousRows = architecture.frontDoor.anonymousFlows
    .map((flow) => `| \`${flow.shape}\` | ${flow.result} | \`${flow.insertion}\` |`)
    .join("\n");
  const executionRows = architecture.frontDoor.executionModes
    .map((item) => `| ${item.name} | ${item.status} | ${item.result} |`)
    .join("\n");
  const boundary = architecture.frontDoor.claimBoundary;
  const access = architecture.frontDoor.accessModel;
  const existingFlow = architecture.configHub.existingFlow;
  const consumers = architecture.delivery.consumers;
  const consumerList = `${consumers.slice(0, -1).join(", ")}, and ${consumers.at(-1)}`;
  return `## ${architecture.name}

**Public catalog and tools:** ${architecture.frontDoor.result} The result is ${architecture.frontDoor.output.charAt(0).toLowerCase()}${architecture.frontDoor.output.slice(1)}

### Work without an account

**Serverless:** ${access.serverless}

**Anonymous:** ${access.anonymous}

**Composable:** ${access.composable}

| Path | What it does | Where it can fit |
| --- | --- | --- |
${anonymousRows}

Here, \`work\` means rendering, inspecting, explaining, testing, scanning, comparing, or editing configuration. These paths can be used on their own or inserted into a larger delivery flow.

| Where the work runs | Status | What that means |
| --- | --- | --- |
${executionRows}

${boundary.before} The boundary is **${boundary.action}** ${boundary.after}

${boundary.managedExamples}

**Inside ConfigHub:** ${architecture.configHub.result}

ConfigHub can join an existing delivery flow without replacing it:

- Existing: \`${existingFlow.before}\`
- With ConfigHub: \`${existingFlow.withConfigHub}\`
- First: ${existingFlow.firstStep}
- Later: ${existingFlow.later}
- Fan-out: ${existingFlow.fanOut}

**After ConfigHub:** ${architecture.delivery.result} ${consumerList} can consume that artifact without rendering the source package again.

These public paths can run before ConfigHub, after a ConfigHub output, or without ConfigHub. A person or team brings a configuration into ConfigHub when they want saved records and managed operations. A release OCI is one handoff from ConfigHub to delivery.`;
}

function renderCatalogNavigation(navigation) {
  return `## Find your path

Start with two questions:

1. **${navigation.startingQuestion}** ${navigation.startingPoints.join(", ")}.
2. **${navigation.nextQuestion}** ${navigation.nextJobs.join(", ")}.

Every catalog entry should then use the same reading order:

${navigation.entryOrder.map((item, index) => `${index + 1}. ${item}`).join("\n")}

${navigation.rule}`;
}

function renderExampleJourneyTable(exampleJourney) {
  return `${exampleJourney.rule}

| Level | Example | Status | Result |
| --- | --- | --- | --- |
${exampleJourney.examples.map((example) => `| ${example.level} | ${example.name} | ${example.status} | ${example.result} |`).join("\n")}`;
}

function renderReviewQuestions(reviewQuestions) {
  return `## Questions every example must answer

${reviewQuestions.rule}

| Question | A useful answer must |
| --- | --- |
${reviewQuestions.questions.map((item) => `| ${item.question} | ${item.standard} |`).join("\n")}`;
}

function renderExampleJourney(exampleJourney) {
  const examples = exampleJourney.examples.map((example, exampleIndex) => `### ${exampleIndex + 1}. ${example.name}

**Status: ${example.status}.**

${example.problem}

${example.result}

${example.steps.map((step, stepIndex) => `${stepIndex + 1}. ${step}`).join("\n")}

Evidence: ${example.evidence.map((path) => repoLink(path)).join(", ")}.

Current limit: ${example.limits.join(" ")}`).join("\n\n");
  return `## Examples from first deployment to Apps

${exampleJourney.rule}

${examples}`;
}

function renderDemoTable(demos) {
  return `| Demonstration | Worked example | Broader status | Problem | Result |
| --- | --- | --- | --- | --- |
${demos.map((demo) => `| ${demo.name} | ${demo.workedExample.status} | ${demo.status} | ${demo.problem} | ${demo.result} |`).join("\n")}`;
}

function renderChecksTable(checks) {
  return `| Check | Effect | Why |
| --- | --- | --- |
${checks.map((item) => `| \`${item.trigger}\` | ${item.effect} | ${item.reason} |`).join("\n")}`;
}

function renderPolicyName(name) {
  return name === "approvalRequired" ? "common checks plus approval" : "common checks";
}

function repoLink(path) {
  return `[${path}](../../${path})`;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run config-catalog`);
  check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run config-catalog`);
}

function existsRepo(path) {
  return existsSync(join(repoRoot, path));
}

function isApprovalCheck(checkItem) {
  return checkItem.id === "human-approval"
    || checkItem.trigger.includes("require-approval")
    || checkItem.trigger.includes("vet-approvedby");
}

function unique(values) {
  return new Set(values).size === values.length;
}

function sameSet(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${count} ${key}`)
    .join(", ");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
