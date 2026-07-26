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

const baseRoot = join(repoRoot, "data", "base-variant-records");
const recordRoot = join(baseRoot, "records");
const policyRoot = join(repoRoot, "data", "apply-policy-profiles");
const demoRoot = join(repoRoot, "data", "demo-program");
const generatedGuidePath = join(repoRoot, "docs", "user", "config-catalog-demonstrations.md");
const supportedSourceTypes = [
  "helm",
  "aicr",
  "cub-installer",
  "kubara",
  "sveltos",
  "rendered-config",
];

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

  const records = [
    ...intents.map(buildHelmRecord),
    buildAicrRecord(),
    buildAicrArgoCdRecord(),
    buildKubaraRecord(),
    buildSveltosRecord(),
  ].sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

  validateRecords(records);
  return {
    records,
    policy,
    program,
    recordsCsv: renderRecordsCsv(records),
    baseSummary: renderBaseSummary(records),
    policySummary: renderPolicySummary(policy),
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
        "The small typed install-time surface is not yet complete for every Helm base.",
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
  const promotionProof = readYaml(aicrPromotionReceiptPath);
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
        receipt: relativeRepo(aicrPromotionReceiptPath),
        path: promotionProof.spec.promotion.path,
        sourceDigest: promotionProof.spec.source.digest,
        changedApplications: promotionProof.spec.change.changedApplications,
        devDryRun: promotionProof.spec.change.devDryRun,
        stagingDryRun: promotionProof.spec.promotion.dryRun,
        stagingMatchesReviewedDev: promotionProof.spec.promotion.stagingMatchesReviewedDev,
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
        variantPromotionReceipt: relativeRepo(aicrPromotionReceiptPath),
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
        "No live Argo CD or GPU-cluster reconciliation is claimed.",
        "The variant and promotion proof ran in a temporary scratch organization, started no Kubernetes cluster, and cleaned up its Spaces.",
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
  const sourceLockPath = `${root}/source-lock.yaml`;
  const receiptPath = `${root}/live-receipt.yaml`;
  const receipt = readYaml(join(repoRoot, receiptPath));
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
            status: "manual-pass",
            note: "The checked ConfigHub Unit was exported and applied to the management cluster with kubectl. Automated ConfigHub delivery did not run.",
          },
          {
            id: "sveltos-cluster-selection",
            status: "live-pass",
            note: "Sveltos selected the registered workload cluster labeled environment=staging.",
          },
          {
            id: "sveltos-helm-reconciliation",
            status: "live-pass",
            note: "Sveltos installed Kyverno 3.8.1 and reported the Helm feature as Provisioned.",
          },
          {
            id: "sveltos-drift-recovery",
            status: "live-pass",
            note: "After the admission-controller replica count was changed from three to one, Sveltos restored it to three.",
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
          status: "not-used-direct-unit-upload",
        },
        configHubReleaseOci: {
          status: "not-run",
        },
        argoCd: "not-used-in-this-run",
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
      claim: "ConfigHub stored the reviewed ClusterProfile under the catalog policy. Sveltos selected one staging workload cluster, installed Kyverno 3.8.1, and restored a changed replica count.",
      limits: [
        "ConfigHub did not deliver the ClusterProfile automatically; the checked Unit was exported and applied with kubectl.",
        "The live test used one staging workload cluster, not a multi-cluster promotion wave.",
        "The receipt proves this profile and drift test, not every Sveltos feature.",
      ],
    },
  };
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
      record.spec.routing.sourceRecord,
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
      && aicrArgo.spec.promotion?.receipt === relativeRepo(aicrPromotionReceiptPath)
      && aicrArgo.spec.promotion?.path === "base -> dev -> staging"
      && aicrArgo.spec.promotion?.stagingMatchesReviewedDev === true,
    "AICR Argo CD base record is missing its exact variant promotion proof",
  );
  validateAicrVariantPromotionReceipt(readYaml(aicrPromotionReceiptPath));
}

function validatePolicy(policy) {
  check(policy.apiVersion === "catalog.confighub.com/v1alpha1", "policy apiVersion is invalid");
  check(policy.kind === "ApplyPolicyProfile", "policy kind is invalid");
  check(policy.metadata?.name === "catalog-standard", "policy name must be catalog-standard");
  check(unique(policy.spec?.sourceTypes ?? []), "policy source types must be unique");
  check(
    sameSet(policy.spec?.sourceTypes ?? [], supportedSourceTypes),
    "policy must cover every supported configuration source type",
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
    check(definition.event === "Mutation", `${definition.ref} must run on Mutation`);
    check(definition.toolchain === "Kubernetes/YAML", `${definition.ref} has an invalid toolchain`);
    check(definition.functionName, `${definition.ref} has no function`);
    check(["block", "warn"].includes(definition.effect), `${definition.ref} has an invalid effect`);
    check(definition.description, `${definition.ref} has no description`);
    check(Array.isArray(definition.arguments), `${definition.ref} arguments must be an array`);
    check(
      unique(definition.arguments.map((item) => item.name)),
      `${definition.ref} argument names must be unique`,
    );
  }
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
  const baselineIds = baseline.map((item) => item.id);
  const approvalRequiredIds = approvalRequired.map((item) => item.id);
  const requiredBaseline = [
    "schema-valid",
    "no-placeholder-values",
    "lifecycle-route-evidence",
    "images-pinned-by-digest",
    "workload-probes-declared",
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
  check(sameSet(baselineIds, requiredBaseline), "baseline policy must contain exactly the five standard checks");
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
    "baseline filter must name exactly its five Triggers",
  );
  check(
    policy.spec.approvalRequired.filterWhere
      === expectedFilterWhere(policy.spec.approvalRequired),
    "approval-required filter must name exactly its six Triggers",
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
      && executionModes.find((item) => item.id === "ci-job")?.status === "partial"
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
      && architecture.frontDoor?.claimBoundary?.after?.includes("ConfigHub"),
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
  const demos = [...(program.spec?.pathways ?? []), ...(program.spec?.apps ?? [])];
  const ids = new Set();
  for (const demo of demos) {
    check(demo.id && !ids.has(demo.id), `duplicate or missing demo id ${demo.id ?? ""}`);
    ids.add(demo.id);
    check(demo.problem && demo.result, `${demo.id} needs a problem and result`);
    check(["available", "partial", "example-only", "planned"].includes(demo.status), `${demo.id} has an invalid status`);
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
    "source_record",
    "objects",
    "package_oci_ref",
    "literal_config_oci_status",
    "release_oci_status",
    "policy_profile",
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
      source_record: record.spec.source.record,
      objects: record.spec.configuration.objects,
      package_oci_ref: record.spec.source.packageOciRef,
      literal_config_oci_status: record.spec.delivery.literalConfigOci.status,
      release_oci_status: record.spec.delivery.configHubReleaseOci.status,
      policy_profile: record.spec.policy.profile,
    };
    return headers.map((header) => csvCell(row[header] ?? "")).join(",");
  });
  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function renderBaseSummary(records) {
  const sourceCounts = countBy(records, (record) => record.spec.source.type);
  const statusCounts = countBy(records, (record) => record.status.level);
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
  return `# Base variant records

Generated by \`scripts/generate-config-catalog-program.mjs\`. Do not edit the generated records by hand.

There are **${records.length} records**: ${formatCounts(sourceCounts)}. Their current statuses are ${formatCounts(statusCounts)}.

A base-variant record connects the literal configuration to the source that produced it, the choices fixed before install, the remaining target inputs, hooks and CRDs, proof results, policy, and OCI handoffs. It does not imply that every record is present in a live ConfigHub org.

## What to read

| Question | Field |
| --- | --- |
| Where did this configuration come from? | \`spec.source\` |
| Which exact configuration is managed? | \`spec.configuration\` |
| What was fixed and what remains to set? | \`spec.inputs\` |
| What must happen around ordinary apply? | \`spec.routing\` |
| Which OCI artifact is this? | \`spec.delivery\` |
| Which checks run before apply? | \`spec.policy\` |
| What has actually been proved? | \`spec.evidence\` and \`status\` |

## Examples

- [Redis default](${redis ? `records/${redis.metadata.name}.yaml` : ""}) connects a Helm render intent, 14 literal objects, and its revision digest without claiming a current three-consumer delivery receipt.
- [NGINX http-clusterip](${nginxDelivery ? `records/${nginxDelivery.metadata.name}.yaml` : ""}) records the first exact catalog base published as one ConfigHub release OCI and consumed at the same digest by Argo CD, Flux, and direct apply.
- [Argo CD no-crds](${argo ? `records/${argo.metadata.name}.yaml` : ""}) shows a base with external CRD requirements.
- [AICR EKS H100 training for Flux](${aicrFlux ? `records/${aicrFlux.metadata.name}.yaml` : ""}) records the generated Flux objects, their controller requirements, and a locally tested OCI bundle without claiming a live upload.
- [AICR EKS H100 training for Argo CD](${aicrArgoCd ? `records/${aicrArgoCd.metadata.name}.yaml` : ""}) connects AICR's generated Helm source package to the 17 rendered Application objects that ConfigHub can upload.
- [Kubara local platform](${kubara ? `records/${kubara.metadata.name}.yaml` : ""}) connects Kubara's generated platform source, 77 rendered bootstrap objects, and the recorded CRD, hook, Secret, and External Secrets work.
- [Sveltos Kyverno fleet](${sveltos ? `records/${sveltos.metadata.name}.yaml` : ""}) records a live one-cluster result: ConfigHub stored the reviewed profile, Sveltos installed Kyverno, and Sveltos repaired a changed replica count.

## Files

- [records.csv](./records.csv) is the compact index.
- [records.json](./records.json) contains every generated record.
- [schemas/base-variant-record.schema.json](../../schemas/base-variant-record.schema.json) defines the record shape.
- [Config catalog doctrine](../../docs/reference/config-catalog-doctrine.md) explains how the sources, variants, policy, delivery, and Apps fit together.
`;
}

function renderPolicySummary(policy) {
  const baseline = policy.spec.baseline;
  const approvalRequired = policy.spec.approvalRequired;
  return `# Apply policy profiles

Generated from [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).

The \`${policy.metadata.name}\` profile applies to ${policy.spec.sourceTypes.join(", ")} after their configuration has become ConfigHub data.

## Common checks

Filter: \`${baseline.filter}\`

This filter names the five common checks explicitly:

\`${baseline.filterWhere}\`

${renderChecksTable(baseline.checks)}

## Approval required

Filter: \`${approvalRequired.filter}\`

Production releases and system configuration keep the five common checks and add one required approval:

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

The [functional proof](../apply-policy-functional-proof/summary.md) uses temporary Units to show what happens at the apply boundary. Placeholder values, invalid Kubernetes data, and unapproved system configuration are blocked. An unpinned image and missing probes are reported as warnings without blocking a dry run. The separate Hooks and CRDs receipt proves that an unsupported automatic lifecycle route is blocked.

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

This is the status index for the source pathways and ConfigHub App demonstrations. \`available\` means the committed evidence supports the described path. \`partial\`, \`example-only\`, and \`planned\` keep the missing work visible.

${renderArchitecture(program.spec.architecture)}

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

**Status: ${demo.status}.**

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
  const liveCounts = Number.isInteger(baselineCount) && Number.isInteger(approvalCount)
    ? `On ${policy.status.lastRecorded}, the live \`helm-catalog\` org had ${baselineCount} Spaces on the five common checks and ${approvalCount} Spaces on those checks plus approval (${productionCount} production and ${systemConfigurationCount} system configuration).`
    : `The live receipt records which Spaces use the common checks and which also require approval.`;

  return `# Config catalog demonstrations

Generated from [config-catalog/program.yaml](../../config-catalog/program.yaml). Edit the programme file, then run \`npm run config-catalog\`.

The catalog begins with Helm and adds other configuration formats without making teams rewrite them.

${renderArchitecture(program.spec.architecture)}

${rendered}

## The common policy

Every pathway uses [the catalog-standard apply policy](../../config-catalog/policies/catalog-standard.yaml) after upload. Schema, placeholder, and lifecycle-route checks block incomplete configuration. Digest pinning and workload probes produce warnings. Production releases and system configuration keep those five checks and add one required approval.

This choice is based on what the configuration controls, not whether it started as Helm, AICR, \`cub installer\`, Kubara, Sveltos, or YAML. ${liveCounts}

The [live topology receipt](../../data/apply-policy-profiles/live-helm-catalog.yaml) records which checks are connected to which Spaces. The [functional proof](../../data/apply-policy-functional-proof/summary.md) tests the behavior with temporary records: placeholders, invalid Kubernetes data, and missing approval are blocked; an unpinned image and missing probes are reported without blocking a dry run. No fixture configuration was applied to Kubernetes. Rerun \`npm run helm-org:policy:verify\` while logged into the org to compare the current topology with its receipt.
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
  const existingFlow = architecture.configHub.existingFlow;
  const consumers = architecture.delivery.consumers;
  const consumerList = `${consumers.slice(0, -1).join(", ")}, and ${consumers.at(-1)}`;
  return `## ${architecture.name}

**Before ConfigHub:** ${architecture.frontDoor.result} The result is ${architecture.frontDoor.output.charAt(0).toLowerCase()}${architecture.frontDoor.output.slice(1)}

### Work without an account

| Path | What it does | Where it can fit |
| --- | --- | --- |
${anonymousRows}

Here, \`work\` means rendering, inspecting, explaining, testing, scanning, comparing, or editing configuration. These paths can be used on their own or inserted into a larger delivery flow.

| Where the work runs | Status | What that means |
| --- | --- | --- |
${executionRows}

${boundary.before} The boundary is **${boundary.action}** ${boundary.after}

**Inside ConfigHub:** ${architecture.configHub.result}

ConfigHub can join an existing delivery flow without replacing it:

- Existing: \`${existingFlow.before}\`
- With ConfigHub: \`${existingFlow.withConfigHub}\`
- First: ${existingFlow.firstStep}
- Later: ${existingFlow.later}
- Fan-out: ${existingFlow.fanOut}

**After ConfigHub:** ${architecture.delivery.result} ${consumerList} can consume that artifact without rendering the source package again.

The website and catalog cover the work that happens before ConfigHub, including anonymous OCI inspection and packaging. ConfigHub begins when a person or team chooses to save the configuration and operate it over time. The release OCI is the handoff to delivery.`;
}

function renderDemoTable(demos) {
  return `| Demonstration | Status | Problem | Result |
| --- | --- | --- | --- |
${demos.map((demo) => `| ${demo.name} | ${demo.status} | ${demo.problem} | ${demo.result} |`).join("\n")}`;
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
