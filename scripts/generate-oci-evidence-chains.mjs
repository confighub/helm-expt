#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

import {
  check,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "oci-evidence-chains");
const recordRoot = join(outputRoot, "records");
const supportedSourceTypes = [
  "helm",
  "aicr",
  "cub-installer",
  "kubara",
  "sveltos",
  "rendered-config",
];
const boundaryNames = [
  "source",
  "reviewedConfiguration",
  "configHubRecord",
  "outputOci",
  "delivery",
  "observation",
];

if (!["--generate", "--verify"].includes(mode)) {
  console.log(`Usage:
  node scripts/generate-oci-evidence-chains.mjs --generate
  node scripts/generate-oci-evidence-chains.mjs --verify`);
  process.exit(1);
}

const report = buildReport();

if (mode === "--generate") {
  rmSync(recordRoot, { recursive: true, force: true });
  for (const record of report.records) {
    writeYaml(join(recordRoot, `${record.metadata.name}.yaml`), record);
  }
  write(
    join(outputRoot, "chains.json"),
    `${JSON.stringify({ records: report.records }, null, 2)}\n`,
  );
  write(join(outputRoot, "matrix.csv"), report.csv);
  write(join(outputRoot, "summary.md"), report.summary);
  console.log(
    `wrote ${report.records.length} OCI evidence chain(s) -> ${relativeRepo(outputRoot)}`,
  );
} else {
  verifyFile(
    join(outputRoot, "chains.json"),
    `${JSON.stringify({ records: report.records }, null, 2)}\n`,
  );
  verifyFile(join(outputRoot, "matrix.csv"), report.csv);
  verifyFile(join(outputRoot, "summary.md"), report.summary);

  const expectedNames = new Set(
    report.records.map((record) => `${record.metadata.name}.yaml`),
  );
  const actualNames = existsSync(recordRoot)
    ? readdirSync(recordRoot).filter((name) => name.endsWith(".yaml"))
    : [];
  check(
    actualNames.length === expectedNames.size
      && actualNames.every((name) => expectedNames.has(name)),
    `${relativeRepo(recordRoot)} contains missing or stale records; run npm run oci-evidence:generate`,
  );
  for (const record of report.records) {
    verifyFile(
      join(recordRoot, `${record.metadata.name}.yaml`),
      `${toYaml(record)}\n`,
    );
  }
  console.log(`verified ${report.records.length} OCI evidence chain(s)`);
}

function buildReport() {
  const schema = JSON.parse(
    readFileSync(join(repoRoot, "schemas", "oci-evidence-chain.schema.json"), "utf8"),
  );
  check(
    JSON.stringify([...schema.definitions.sourceType.enum].sort())
      === JSON.stringify([...supportedSourceTypes].sort()),
    "OCI evidence-chain schema source types do not match the maintained source types",
  );
  check(
    JSON.stringify(schema.properties.spec.properties.boundaries.required)
      === JSON.stringify(boundaryNames),
    "OCI evidence-chain schema boundaries do not match the generated record order",
  );

  const receipts = {
    helmReview: loadReceipt("runs/byo-helm-values-proof/receipt.yaml"),
    helmUpload: loadReceipt("runs/byo-helm-values-proof/confighub-upload-receipt.yaml"),
    helmPromotion: loadReceipt("runs/byo-helm-values-promotion-proof/receipt.yaml"),
    helmStaging: loadReceipt("runs/byo-helm-values-staging-deploy-proof/receipt.yaml"),
    aicr: loadReceipt("runs/aicr-oci-roundtrip-proof/receipt.yaml"),
    installer: loadReceipt(
      "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
    ),
    installerPublic: loadReceipt(
      "runs/installer-oci/bitnami-nginx/24.0.2/installer-package-publication-receipt.yaml",
    ),
    installerServerless: loadReceipt("runs/serverless-oci-gitops-proof/receipt.yaml"),
    kubara: loadReceipt("runs/kubara-oci-delivery-proof/receipt.yaml"),
    sveltos: loadReceipt("runs/sveltos-oci-delivery-proof/receipt.yaml"),
    rendered: loadReceipt("runs/oci-deploy-stage-rollout-proof/receipt.yaml"),
  };

  const records = [
    buildHelmChain(receipts),
    buildAicrChain(receipts),
    buildInstallerChain(receipts),
    buildKubaraChain(receipts),
    buildSveltosChain(receipts),
    buildRenderedConfigChain(receipts),
  ].sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

  validateRecords(records);
  return {
    records,
    csv: renderCsv(records),
    summary: renderSummary(records),
  };
}

function buildHelmChain({ helmReview, helmUpload, helmPromotion, helmStaging }) {
  const source = helmReview.spec.source;
  const reviewed = helmReview.spec.reviewed;
  const staging = helmPromotion.spec.chain.staging;
  const release = helmStaging.spec.configHubDelivery.release;
  const application = helmStaging.spec.delivery.application;
  const deployment = helmStaging.spec.delivery.kubernetes.deployment;

  return record({
    name: "helm-byo-nginx-staging",
    sourceType: "helm",
    example: "A team-supplied NGINX chart and values, reviewed and promoted to staging",
    boundaries: {
      source: boundary("pass", {
        digest: sha256(source.chartPackageSha256),
        reference: `helm:${source.chart}@${source.version}`,
        identifiers: [
          `values-sha256:${reviewed.valuesSha256}`,
          `release:${source.releaseName}`,
          `namespace:${source.namespace}`,
        ],
        evidence: [
          "examples/byo-helm-values/reviewed-values.yaml",
          source.sourceLock,
          "runs/byo-helm-values-proof/receipt.yaml",
        ],
        detail: "The chart package, reviewed values, release name, namespace, and Kubernetes version are recorded.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: sha256(reviewed.objectSetSha256),
        reference: reviewed.renderedObjects,
        identifiers: ["objects:5", "decision:ready-for-upload"],
        evidence: [
          reviewed.renderedObjects,
          "data/byo-helm-values-review/review.yaml",
        ],
        detail: "The rejected AI values were corrected, and the five exact Kubernetes objects were approved.",
      }),
      configHubRecord: boundary("pass", {
        digest: sha256(staging.configurationUnit.dataHash),
        reference: `space:${staging.space}`,
        identifiers: [
          `space-id:${staging.id}`,
          `unit-id:${staging.configurationUnit.id}`,
          `unit-revision:${staging.configurationUnit.headRevision}`,
          `upstream-revision:${staging.configurationUnit.upstreamRevision}`,
        ],
        evidence: [
          "runs/byo-helm-values-proof/confighub-upload-receipt.yaml",
          "runs/byo-helm-values-promotion-proof/receipt.yaml",
        ],
        detail: "ConfigHub stores the reviewed base and the promoted staging variant as named, revisioned records.",
      }),
      outputOci: boundary("pass", {
        digest: release.manifestDigest,
        reference: release.reference,
        identifiers: [`release-id:${release.releaseId}`],
        evidence: ["runs/byo-helm-values-staging-deploy-proof/receipt.yaml"],
        detail: "ConfigHub published the promoted staging objects as a release OCI.",
      }),
      delivery: boundary("pass", {
        digest: application.revision,
        reference: application.source,
        identifiers: [
          "consumer:Argo CD",
          `application:${application.name}`,
          `namespace:${application.destinationNamespace}`,
        ],
        evidence: ["runs/byo-helm-values-staging-deploy-proof/receipt.yaml"],
        detail: "Argo CD reconciled the exact ConfigHub release digest.",
      }),
      observation: boundary("pass", {
        digest: sha256(helmStaging.spec.configHubDelivery.objectSetSha256),
        observedAt: helmStaging.spec.observedAt,
        identifiers: [
          `deployment:${deployment.name}`,
          `ready-replicas:${deployment.readyReplicas}`,
          `required-secret:${deployment.secretRef}`,
        ],
        evidence: ["runs/byo-helm-values-staging-deploy-proof/receipt.yaml"],
        detail: "The staging Deployment reached four ready replicas and used the required Secret reference.",
      }),
    },
    companionRecords: {
      sourceInputs: [
        source.sourceLock,
        "examples/byo-helm-values/reviewed-values.yaml",
      ],
      lifecycle: ["data/byo-helm-values-review/review.yaml"],
      checks: ["data/byo-helm-values-review/review.yaml"],
      receipts: [
        "runs/byo-helm-values-proof/receipt.yaml",
        "runs/byo-helm-values-proof/confighub-upload-receipt.yaml",
        "runs/byo-helm-values-promotion-proof/receipt.yaml",
        "runs/byo-helm-values-staging-deploy-proof/receipt.yaml",
      ],
    },
    coverage: "managed-and-observed",
    completeThrough: "observation",
    claim: "One supplied Helm chart and values file can be followed from locked source through review, ConfigHub promotion, release OCI, Argo CD, and a live staging workload.",
    limits: helmStaging.spec.limits,
  });
}

function buildAicrChain({ aicr }) {
  const input = aicr.spec.input;
  const base = aicr.spec.configHub.base;
  const release = aicr.spec.configHub.release;

  return record({
    name: "aicr-eks-h100-training-kubeflow",
    sourceType: "aicr",
    example: "AICR EKS H100 training configuration captured as 17 Argo CD Applications",
    boundaries: {
      source: boundary("pass", {
        digest: input.digest,
        reference: `oci-layout:${input.committedLayout}`,
        identifiers: [`applications:${input.applicationCount}`],
        evidence: [
          "examples/aicr/eks-h100-training-kubeflow/aicr.yaml",
          "examples/aicr/eks-h100-training-kubeflow/recipe.yaml",
          "runs/aicr-oci-roundtrip-proof/receipt.yaml",
        ],
        detail: "The AICR recipe and its literal Argo CD configuration OCI are recorded at an immutable digest.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: input.digest,
        reference: input.committedLayout,
        identifiers: [
          `applications:${input.applicationCount}`,
          `sync-waves:${input.syncWaves.length}`,
        ],
        evidence: [
          "examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml",
          "examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml",
        ],
        detail: "The reviewed input is the exact set of 17 Argo CD Application objects in the literal OCI.",
      }),
      configHubRecord: boundary("pass", {
        reference: `space:${base.space}`,
        identifiers: [
          `space-id:${base.spaceId}`,
          `unit-id:${base.unitId}`,
          `unit:${base.unit}`,
        ],
        evidence: ["runs/aicr-oci-roundtrip-proof/receipt.yaml"],
        detail: "ConfigHub imported the 17 objects into one base Space and confirmed that the source objects matched.",
      }),
      outputOci: boundary("pass", {
        digest: release.manifestDigest,
        reference: release.reference,
        identifiers: [
          `release-id:${release.releaseId}`,
          `bundle-digest:${release.bundleDigest}`,
        ],
        evidence: ["runs/aicr-oci-roundtrip-proof/receipt.yaml"],
        detail: "ConfigHub published a release OCI with the same Kubernetes objects plus its origin annotation.",
      }),
      delivery: boundary("not-run", {
        evidence: ["runs/aicr-oci-roundtrip-proof/receipt.yaml"],
        detail: "The 17 Applications were pulled back and compared, but no controller applied them.",
      }),
      observation: boundary("not-run", {
        evidence: ["runs/aicr-oci-roundtrip-proof/receipt.yaml"],
        detail: "No EKS cluster, H100 node, controller reconciliation, or GPU workload health was observed.",
      }),
    },
    companionRecords: {
      sourceInputs: [
        "examples/aicr/eks-h100-training-kubeflow/aicr.yaml",
        "examples/aicr/eks-h100-training-kubeflow/recipe.yaml",
      ],
      lifecycle: [
        "examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml",
      ],
      checks: [
        "examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml",
      ],
      receipts: [
        "examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml",
        "examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml",
        "runs/aicr-oci-roundtrip-proof/receipt.yaml",
      ],
    },
    coverage: "managed-to-oci",
    completeThrough: "outputOci",
    claim: "The AICR configuration can be followed from its recipe and literal OCI into ConfigHub and back to an object-preserving ConfigHub release OCI.",
    limits: aicr.spec.limits,
  });
}

function buildInstallerChain({ installer, installerPublic, installerServerless }) {
  const source = installerServerless.spec.source;
  const render = installer.spec.render;
  const release = installer.spec.releaseOci;
  const consumers = Object.values(installer.spec.legs);

  check(
    consumers.every((leg) => leg.digest === release.digest && leg.result === "pass"),
    "catalog OCI delivery consumers must all report the published release digest",
  );
  check(
    installerPublic.spec.ref === source.reference,
    "installer publication and live delivery receipts must name the same package",
  );
  check(
    installerPublic.spec.outputs.push.includes(source.expectedManifestDigest)
      && installerPublic.spec.outputs.push.includes(source.expectedPackageLayerDigest),
    "installer publication receipt must contain the manifest and package-layer digests used by the live proof",
  );

  return record({
    name: "cub-installer-nginx-three-consumers",
    sourceType: "cub-installer",
    example: "A public NGINX installer package rendered once and delivered three ways",
    boundaries: {
      source: boundary("pass", {
        digest: source.expectedManifestDigest,
        reference: source.reference,
        identifiers: [
          `package-layer:${source.expectedPackageLayerDigest}`,
          `preset:${source.base}`,
        ],
        evidence: [
          source.publicationReceipt,
          "packages/bitnami/nginx/24.0.2/installer.yaml",
        ],
        detail: "The public multi-preset installer package is identified by its OCI manifest and package-layer digests.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: sha256(render.manifestSha256),
        reference: installer.spec.source.committedObjects,
        identifiers: [`objects:${render.objectCount}`, `preset:${installer.spec.base}`],
        evidence: [
          installer.spec.source.renderIntent,
          installer.spec.source.committedObjects,
        ],
        detail: "The http-clusterip preset produced the committed catalog objects plus the requested Namespace.",
      }),
      configHubRecord: boundary("pass", {
        reference: `space:${release.workloadSpace}`,
        identifiers: [
          `release-id:${release.releaseId}`,
          `units:${release.unitCount}`,
        ],
        evidence: [
          "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
        ],
        detail: "ConfigHub held the selected, rendered configuration and published one release for all three consumers.",
      }),
      outputOci: boundary("pass", {
        digest: release.digest,
        reference: release.reference,
        identifiers: [
          `release-id:${release.releaseId}`,
          `bundle-digest:${release.bundleDigest}`,
        ],
        evidence: [
          "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
        ],
        detail: "ConfigHub published one immutable release OCI.",
      }),
      delivery: boundary("pass", {
        digest: release.digest,
        reference: release.reference,
        identifiers: consumers.map((leg) => `consumer:${leg.mode}`),
        evidence: [
          "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
        ],
        detail: "Argo CD, Flux, and direct apply all consumed the same release digest.",
      }),
      observation: boundary("pass", {
        digest: release.digest,
        observedAt: installer.spec.observedAt,
        identifiers: consumers.map(
          (leg) => `${leg.mode}:replicas-${leg.workload.replicas}`,
        ),
        evidence: [
          "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
        ],
        detail: "Each delivery method reported a ready NGINX workload with the expected image and replica count.",
      }),
    },
    companionRecords: {
      sourceInputs: [
        "packages/bitnami/nginx/24.0.2/installer.yaml",
        installer.spec.source.renderIntent,
      ],
      lifecycle: [installer.spec.source.renderIntent],
      checks: [
        "data/helm-render-intents/intents/bitnami-nginx-24-0-2-http-clusterip.yaml",
      ],
      receipts: [
        source.publicationReceipt,
        "runs/catalog-oci-delivery-proof/bitnami-nginx-24-0-2-http-clusterip.yaml",
      ],
    },
    coverage: "managed-and-observed",
    completeThrough: "observation",
    claim: "One public cub installer package can be followed from the package digest through a selected preset, one ConfigHub release OCI, and ready workloads delivered by Argo CD, Flux, and direct apply.",
    limits: installer.spec.limits,
  });
}

function buildKubaraChain({ kubara }) {
  const review = kubara.spec.configHubReview;
  const release = kubara.spec.portableRelease;
  const application = kubara.spec.cluster.bootstrapApplication;
  const workload = kubara.spec.cluster.kubara.workload;

  return record({
    name: "kubara-local-platform-argocd",
    sourceType: "kubara",
    example: "A Kubara platform configuration prepared, approved, and delivered through Argo CD",
    boundaries: {
      source: boundary("pass", {
        digest: sha256(kubara.spec.source.rawSha256),
        reference: kubara.spec.source.renderedObjects,
        identifiers: [
          `objects:${kubara.spec.source.rawObjectCount}`,
          `source-lock:${kubara.spec.source.sourceLock}`,
        ],
        evidence: [
          kubara.spec.source.renderedObjects,
          kubara.spec.source.sourceLock,
        ],
        detail: "The Kubara objects and source lock identify the exact starting configuration.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: sha256(release.preparedDataSha256),
        reference: "prepared Kubara configuration",
        identifiers: [
          `objects:${kubara.spec.preparation.outputObjectCount}`,
          `deferred:${kubara.spec.preparation.deferredObjects.length}`,
          `route-objects:${kubara.spec.preparation.executedBeforeDelivery.length}`,
        ],
        evidence: [
          "runs/kubara-oci-delivery-proof/receipt.yaml",
          kubara.spec.source.routeIntent,
        ],
        detail: "The target-specific edits, deferred objects, CRD order, and Redis initializer are recorded before packaging.",
      }),
      configHubRecord: boundary("pass", {
        digest: sha256(review.dataHash),
        reference: `space:${review.space}`,
        identifiers: [
          `unit-id:${review.unitId}`,
          `revision:${review.revision}`,
          `approval-count:${review.approval.recordedApprovals}`,
        ],
        evidence: ["runs/kubara-oci-delivery-proof/receipt.yaml"],
        detail: "ConfigHub stored revision 2 and required approval because this is system configuration.",
      }),
      outputOci: boundary("pass", {
        digest: release.manifestDigest,
        reference: release.reference,
        identifiers: [`objects:${release.objectCount}`],
        evidence: ["runs/kubara-oci-delivery-proof/receipt.yaml"],
        detail: "The prepared, approved objects were packaged as one portable OCI.",
      }),
      delivery: boundary("pass", {
        digest: application.revision,
        reference: release.reference,
        identifiers: ["consumer:Argo CD", `cluster:${kubara.spec.cluster.name}`],
        evidence: ["runs/kubara-oci-delivery-proof/receipt.yaml"],
        detail: "Bootstrap Argo CD reconciled the portable OCI at the recorded digest.",
      }),
      observation: boundary("pass", {
        digest: release.manifestDigest,
        observedAt: kubara.spec.recordedAt,
        identifiers: [
          `namespace:${workload.namespace}`,
          `downstream-app:${kubara.spec.cluster.kubara.selectedApplication.name}`,
          `ready-deployments:${workload.deployments.length}`,
        ],
        evidence: ["runs/kubara-oci-delivery-proof/receipt.yaml"],
        detail: "Kubara's Argo CD became ready and the selected Metrics Server application became Synced and Healthy.",
      }),
    },
    companionRecords: {
      sourceInputs: [
        kubara.spec.source.sourceLock,
        kubara.spec.source.renderedObjects,
      ],
      lifecycle: [
        kubara.spec.source.routeIntent,
        "runs/kubara-oci-delivery-proof/receipt.yaml",
      ],
      checks: ["examples/kubara/local-platform/confighub-upload-receipt.yaml"],
      receipts: ["runs/kubara-oci-delivery-proof/receipt.yaml"],
    },
    coverage: "managed-and-observed",
    completeThrough: "observation",
    claim: "One Kubara platform configuration can be followed from locked source through ConfigHub approval, target-specific preparation, portable OCI, Argo CD, and a healthy downstream service.",
    limits: kubara.spec.limits,
  });
}

function buildSveltosChain({ sveltos }) {
  const fleet = sveltos.spec.configHubReview.fleet;
  const release = fleet.portableRelease;
  const wave = sveltos.spec.management.waves.fleet;

  return record({
    name: "sveltos-kyverno-two-cluster-fleet",
    sourceType: "sveltos",
    example: "A Sveltos Kyverno profile expanded from a pilot to two clusters",
    boundaries: {
      source: boundary("pass", {
        digest: sha256(sveltos.spec.source.canonicalSha256),
        reference: sveltos.spec.source.profile,
        identifiers: [`source-lock:${sveltos.spec.source.sourceLock}`],
        evidence: [
          sveltos.spec.source.profile,
          sveltos.spec.source.sourceLock,
        ],
        detail: "The ClusterProfile and source lock identify the exact starting configuration.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: sha256(release.approvedDataSha256),
        reference: "approved Sveltos fleet ClusterProfile",
        identifiers: [
          `objects:${release.objectCount}`,
          "selector:environment=staging",
        ],
        evidence: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
        detail: "The approved selector change expands the reviewed profile from the pilot to both staging clusters.",
      }),
      configHubRecord: boundary("pass", {
        reference: `space:${sveltos.spec.configHubReview.space}`,
        identifiers: [
          `unit-id:${sveltos.spec.configHubReview.unitId}`,
          `pilot-revision:${sveltos.spec.configHubReview.pilot.approval.revision}`,
          `fleet-revision:${fleet.approval.revision}`,
          `approval-count:${fleet.approval.recordedApprovals}`,
        ],
        evidence: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
        detail: "ConfigHub stores and approves the pilot and fleet revisions separately.",
      }),
      outputOci: boundary("pass", {
        digest: release.manifestDigest,
        reference: release.reference,
        identifiers: [`target-revision:${release.targetRevision}`],
        evidence: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
        detail: "The approved fleet ClusterProfile was packaged as one portable OCI.",
      }),
      delivery: boundary("pass", {
        digest: wave.argo.revision,
        reference: wave.application.source,
        identifiers: [
          "consumer:Argo CD",
          "fleet-controller:Sveltos",
          `targets:${wave.targets.length}`,
        ],
        evidence: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
        detail: "Argo CD reconciled the OCI, and Sveltos selected both workload clusters.",
      }),
      observation: boundary("pass", {
        digest: release.manifestDigest,
        observedAt: sveltos.spec.recordedAt,
        identifiers: wave.targets.map(
          (target) => `${target.cluster}:${target.reconciliation.result}`,
        ),
        evidence: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
        detail: "Kyverno became ready on both clusters, and Sveltos repaired deliberate replica drift on each target.",
      }),
    },
    companionRecords: {
      sourceInputs: [
        sveltos.spec.source.profile,
        sveltos.spec.source.sourceLock,
      ],
      lifecycle: [
        "docs/demo/sveltos/kyverno-fleet.md",
        "runs/sveltos-oci-delivery-proof/receipt.yaml",
      ],
      checks: ["examples/sveltos/kyverno-fleet/live-receipt.yaml"],
      receipts: ["runs/sveltos-oci-delivery-proof/receipt.yaml"],
    },
    coverage: "managed-and-observed",
    completeThrough: "observation",
    claim: "One Sveltos system configuration can be followed from locked source through two approved ConfigHub revisions, portable OCI, Argo CD, and healthy Kyverno workloads on two clusters.",
    limits: sveltos.spec.limits,
  });
}

function buildRenderedConfigChain({ rendered }) {
  const source = rendered.spec.serverlessInput;
  const staging = rendered.spec.configHub.chain.staging;
  const release = rendered.spec.serverlessOutput;
  const target = rendered.spec.delivery.fleet.targets[0];

  return record({
    name: "rendered-config-nginx-two-cluster-fleet",
    sourceType: "rendered-config",
    example: "Literal NGINX OCI promoted through ConfigHub and rolled out to two clusters",
    boundaries: {
      source: boundary("pass", {
        digest: source.digest,
        reference: source.reference,
        identifiers: [`objects:${rendered.spec.source.objectCount}`],
        evidence: [
          rendered.spec.source.sourceRecord,
          "runs/oci-deploy-stage-rollout-proof/receipt.yaml",
        ],
        detail: "The literal Kubernetes OCI is resolved and compared with the recorded source objects before upload.",
      }),
      reviewedConfiguration: boundary("pass", {
        digest: sha256(release.yamlSha256),
        reference: "reviewed staging Kubernetes objects",
        identifiers: [
          `objects:${release.objectCount}`,
          "change:Deployment/nginx spec.replicas 1 -> 2",
        ],
        evidence: ["runs/oci-deploy-stage-rollout-proof/receipt.yaml"],
        detail: "The reviewed staging configuration contains the exact five objects after the replica change.",
      }),
      configHubRecord: boundary("pass", {
        reference: `space:${staging.space}`,
        identifiers: [
          `variant:${staging.variant}`,
          `upstream-space-id:${staging.upstreamSpaceId}`,
          `release-id:${rendered.spec.delivery.stagingRelease.releaseId}`,
        ],
        evidence: ["runs/oci-deploy-stage-rollout-proof/receipt.yaml"],
        detail: "ConfigHub stores the base, development, and staging chain and records both promotions.",
      }),
      outputOci: boundary("pass", {
        digest: release.digest,
        reference: release.reference,
        identifiers: [`objects:${release.objectCount}`],
        evidence: ["runs/oci-deploy-stage-rollout-proof/receipt.yaml"],
        detail: "The reviewed staging objects were exported as one portable OCI for both targets.",
      }),
      delivery: boundary("pass", {
        digest: rendered.spec.delivery.fleet.digest,
        reference: target.application.source,
        identifiers: [
          "consumer:Argo CD",
          `targets:${rendered.spec.delivery.fleet.size}`,
        ],
        evidence: ["runs/oci-deploy-stage-rollout-proof/receipt.yaml"],
        detail: "Argo CD reconciled the same portable OCI digest on both clusters.",
      }),
      observation: boundary("pass", {
        digest: release.digest,
        observedAt: rendered.spec.observedAt,
        expiresAt: target.observations.objectSet.expiresAt,
        identifiers: [
          `targets:${rendered.spec.delivery.fleet.size}`,
          "object-sets:matched",
          "workloads:converged",
        ],
        evidence: rendered.spec.delivery.fleet.targets.flatMap((item) => [
          item.observations.objectSet.receipt,
          item.observations.workloads.receipt,
        ]),
        detail: "Fingerprint receipts show that both live object sets matched and both NGINX workloads converged.",
      }),
    },
    companionRecords: {
      sourceInputs: [rendered.spec.source.sourceRecord],
      lifecycle: [rendered.spec.source.sourceRecord],
      checks: [
        "runs/oci-deploy-stage-rollout-proof/receipt.yaml",
        ...rendered.spec.delivery.fleet.targets.flatMap((item) => [
          item.observations.objectSet.receipt,
          item.observations.workloads.receipt,
        ]),
      ],
      receipts: ["runs/oci-deploy-stage-rollout-proof/receipt.yaml"],
    },
    coverage: "managed-and-observed",
    completeThrough: "observation",
    claim: "One literal Kubernetes OCI can be followed through ConfigHub variants and promotion to a portable OCI consumed at the same digest by Argo CD on two observed clusters.",
    limits: rendered.spec.limits,
  });
}

function record({
  name,
  sourceType,
  example,
  boundaries,
  companionRecords,
  coverage,
  completeThrough,
  claim,
  limits,
}) {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "OciEvidenceChain",
    metadata: {
      name,
      labels: {
        sourceType,
      },
    },
    spec: {
      sourceType,
      example,
      boundaries,
      companionRecords,
    },
    status: {
      coverage,
      completeThrough,
      claim,
      limits,
    },
  };
}

function boundary(
  result,
  {
    digest = "",
    reference = "",
    identifiers = [],
    evidence = [],
    detail,
    observedAt = "",
    expiresAt = "",
  },
) {
  return {
    result,
    digest,
    reference,
    identifiers,
    evidence,
    detail,
    observedAt,
    expiresAt,
  };
}

function validateRecords(records) {
  check(records.length === supportedSourceTypes.length, "expected one OCI evidence chain per supported source type");
  const sourceTypes = records.map((item) => item.spec.sourceType).sort();
  check(
    JSON.stringify(sourceTypes) === JSON.stringify([...supportedSourceTypes].sort()),
    "OCI evidence chains must cover every supported source type exactly once",
  );

  for (const item of records) {
    check(item.apiVersion === "catalog.confighub.com/v1alpha1", `${item.metadata.name}: unexpected apiVersion`);
    check(item.kind === "OciEvidenceChain", `${item.metadata.name}: unexpected kind`);
    check(item.metadata.labels.sourceType === item.spec.sourceType, `${item.metadata.name}: source type label mismatch`);
    check(item.spec.example.length > 0, `${item.metadata.name}: missing example`);
    check(boundaryNames.includes(item.status.completeThrough), `${item.metadata.name}: invalid completeThrough`);
    check(item.status.claim.length > 0, `${item.metadata.name}: missing claim`);
    check(Array.isArray(item.status.limits), `${item.metadata.name}: limits must be an array`);

    for (const name of boundaryNames) {
      const current = item.spec.boundaries[name];
      check(current, `${item.metadata.name}: missing ${name} boundary`);
      check(
        ["pass", "not-run", "not-used"].includes(current.result),
        `${item.metadata.name}: invalid ${name} result`,
      );
      check(current.detail.length > 0, `${item.metadata.name}: ${name} needs plain-English detail`);
      check(Array.isArray(current.identifiers), `${item.metadata.name}: ${name} identifiers must be an array`);
      check(Array.isArray(current.evidence), `${item.metadata.name}: ${name} evidence must be an array`);
      if (current.digest) checkDigest(current.digest, `${item.metadata.name}: ${name}`);
      for (const path of current.evidence) checkEvidencePath(path, item.metadata.name);
    }

    for (const paths of Object.values(item.spec.companionRecords)) {
      check(Array.isArray(paths), `${item.metadata.name}: companion record groups must be arrays`);
      for (const path of paths) checkEvidencePath(path, item.metadata.name);
    }

    const boundaries = item.spec.boundaries;
    if (boundaries.delivery.result === "pass") {
      check(boundaries.outputOci.result === "pass", `${item.metadata.name}: delivery requires an output OCI`);
      check(boundaries.delivery.digest === boundaries.outputOci.digest, `${item.metadata.name}: delivery digest must match output OCI digest`);
    }
    if (boundaries.observation.result === "pass") {
      check(boundaries.delivery.result === "pass", `${item.metadata.name}: observation requires delivery`);
      check(boundaries.observation.observedAt, `${item.metadata.name}: observation needs observedAt`);
    }
    if (item.status.coverage === "managed-and-observed") {
      for (const name of boundaryNames) {
        check(
          boundaries[name].result === "pass",
          `${item.metadata.name}: managed-and-observed requires ${name} to pass`,
        );
      }
    }
  }

  check(
    records.filter((item) => item.status.coverage === "managed-and-observed").length === 5,
    "expected five managed-and-observed source paths",
  );
  const aicr = records.find((item) => item.spec.sourceType === "aicr");
  check(aicr.status.coverage === "managed-to-oci", "AICR must remain managed-to-oci until live delivery runs");
  check(aicr.spec.boundaries.delivery.result === "not-run", "AICR delivery must remain not-run");
  check(aicr.spec.boundaries.observation.result === "not-run", "AICR observation must remain not-run");
}

function renderSummary(records) {
  const complete = records.filter(
    (item) => item.status.coverage === "managed-and-observed",
  ).length;
  const rows = records
    .map((item) => {
      const b = item.spec.boundaries;
      return `| \`${item.spec.sourceType}\` | ${item.spec.example} | ${result(b.configHubRecord.result)} | ${result(b.outputOci.result)} | ${result(b.delivery.result)} | ${result(b.observation.result)} | [record](./records/${item.metadata.name}.yaml) |`;
    })
    .join("\n");

  return `# OCI Evidence Chains

These records answer six questions in the same order for every starting format:

1. What source did we start with?
2. Which exact configuration did we review?
3. Which ConfigHub Space, Unit, or revision held it?
4. Which OCI did we publish?
5. Which controller or command consumed that OCI?
6. What did we observe on the target?

The record is companion information for people and tools. Kubernetes controllers do
not need to read it. The format is experimental while the project looks for a
compatible public standard.

## Current Coverage

${complete}/${records.length} source paths reach a ConfigHub-managed OCI, delivery,
and a recorded live result. AICR currently stops after ConfigHub republishes the 17
reviewed Argo CD Applications. It does not yet claim EKS, H100, controller, or GPU
workload health.

| Starting format | Example | ConfigHub record | Output OCI | Delivery | Observation | Full record |
| --- | --- | ---: | ---: | ---: | ---: | --- |
${rows}

## Why The Digests Can Differ

The input OCI and the ConfigHub release OCI are different artifacts, so their
manifest digests normally differ. The chain must say whether the Kubernetes content
was unchanged, changed deliberately, or gained ConfigHub's
\`confighub.com/origin\` annotation.

The digest used by Argo CD or Flux must match the output OCI named by that delivery
step. A live observation is separate: it records what the cluster showed at a
particular time and, where available, when that observation expires.

## Files

- [\`chains.json\`](./chains.json) contains every record for tools.
- [\`matrix.csv\`](./matrix.csv) is a compact source-by-boundary table.
- [\`records/\`](./records/) contains one readable YAML record per starting format.
- [\`schemas/oci-evidence-chain.schema.json\`](../../schemas/oci-evidence-chain.schema.json)
  defines the record fields.

## Verify

\`\`\`sh
npm run oci-evidence:verify
\`\`\`

This verification is network-free. It rebuilds the six records from committed
receipts, checks their digests and links, and refuses to call the AICR path delivered
or observed before that work has actually run.
`;
}

function renderCsv(records) {
  const headers = [
    "source_type",
    "name",
    "source",
    "reviewed_configuration",
    "confighub_record",
    "output_oci",
    "delivery",
    "observation",
    "coverage",
    "complete_through",
    "record",
  ];
  const rows = records.map((item) => {
    const b = item.spec.boundaries;
    return [
      item.spec.sourceType,
      item.metadata.name,
      b.source.result,
      b.reviewedConfiguration.result,
      b.configHubRecord.result,
      b.outputOci.result,
      b.delivery.result,
      b.observation.result,
      item.status.coverage,
      item.status.completeThrough,
      `data/oci-evidence-chains/records/${item.metadata.name}.yaml`,
    ].map(csvCell).join(",");
  });
  return `${headers.join(",")}\n${rows.join("\n")}\n`;
}

function loadReceipt(path) {
  const fullPath = join(repoRoot, path);
  check(existsSync(fullPath), `${path} is missing`);
  const receipt = readYaml(fullPath);
  const result = receipt?.status?.result ?? receipt?.spec?.result;
  if (result !== undefined) check(result === "pass", `${path} is not a passing receipt`);
  return receipt;
}

function sha256(value) {
  return String(value).startsWith("sha256:") ? String(value) : `sha256:${value}`;
}

function checkDigest(value, context) {
  check(/^sha256:[a-f0-9]{64}$/.test(value), `${context} has invalid digest ${value}`);
}

function checkEvidencePath(path, recordName) {
  check(
    typeof path === "string" && path.length > 0,
    `${recordName}: evidence path must be a non-empty string`,
  );
  check(
    existsSync(join(repoRoot, path)),
    `${recordName}: evidence path does not exist: ${path}`,
  );
}

function result(value) {
  if (value === "pass") return "yes";
  if (value === "not-used") return "not used";
  return "not run";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run npm run oci-evidence:generate`);
  check(
    readFileSync(path, "utf8") === expected,
    `${relativeRepo(path)} is stale; run npm run oci-evidence:generate`,
  );
}
