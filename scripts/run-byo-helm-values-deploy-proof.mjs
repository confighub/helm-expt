#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  cubEnv,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const laneIndex = process.argv.indexOf("--lane");
const lane = laneIndex >= 0 ? process.argv[laneIndex + 1] : "reviewed";
if (!["--run", "--generate", "--verify"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-byo-helm-values-deploy-proof.mjs --run
  node scripts/run-byo-helm-values-deploy-proof.mjs --generate
  node scripts/run-byo-helm-values-deploy-proof.mjs --verify

Add \`--lane staging\` to run or verify the promoted staging configuration.`);
  process.exit(2);
}
check(
  ["reviewed", "staging"].includes(lane),
  `unknown deployment lane ${lane}; expected reviewed or staging`,
);

const sourcePath = join(
  repoRoot,
  "data",
  "byo-helm-values-review",
  "reviewed-render.yaml",
);
const localReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "receipt.yaml",
);
const publicReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "public-oci-receipt.yaml",
);
const hubReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-proof",
  "confighub-upload-receipt.yaml",
);
const reviewedReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-deploy-proof",
  "receipt.yaml",
);
const reviewedSummaryPath = join(
  repoRoot,
  "data",
  "byo-helm-values-deploy-proof",
  "summary.md",
);
const promotionReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-promotion-proof",
  "receipt.yaml",
);
const stagingReceiptPath = join(
  repoRoot,
  "runs",
  "byo-helm-values-staging-deploy-proof",
  "receipt.yaml",
);
const stagingSummaryPath = join(
  repoRoot,
  "data",
  "byo-helm-values-staging-deploy-proof",
  "summary.md",
);
const policyPath = join(
  repoRoot,
  "config-catalog",
  "policies",
  "catalog-standard.yaml",
);

const expectedOrg = "helm-catalog";
const baseSpace = "byo-nginx-ai-values-24-0-2-reviewed";
const stagingSpace = "byo-nginx-ai-values-24-0-2-staging";
const publicReceipt = readYaml(publicReceiptPath);
const hubReceipt = readYaml(hubReceiptPath);
const promotionReceipt = existsSync(promotionReceiptPath)
  ? readYaml(promotionReceiptPath)
  : null;
const policy = readYaml(policyPath);
const reviewedDocs = parseDocs(readFileSync(sourcePath, "utf8"));
const scenario = lane === "staging"
  ? {
      lane,
      receiptKind: "BringYourOwnHelmValuesStagingDeploymentReceipt",
      receiptName: "byo-nginx-ai-values-24-0-2-staging",
      receiptPath: stagingReceiptPath,
      summaryPath: stagingSummaryPath,
      persistentSpace: stagingSpace,
      namespace: "nginx-staging",
      replicas: 4,
      clusterPrefix: "hx-byo-nginx-staging",
      applicationName: "byo-nginx-staging",
      applicationUnit: "byo-nginx-staging-application",
      sourceMode: "variant-clone",
      sourceDocs: stagingDocs(reviewedDocs),
    }
  : {
      lane,
      receiptKind: "BringYourOwnHelmValuesDeploymentReceipt",
      receiptName: "byo-nginx-ai-values-24-0-2-reviewed",
      receiptPath: reviewedReceiptPath,
      summaryPath: reviewedSummaryPath,
      persistentSpace: baseSpace,
      namespace: "nginx",
      replicas: 3,
      clusterPrefix: "hx-byo-nginx",
      applicationName: "byo-nginx",
      applicationUnit: "byo-nginx-application",
      sourceMode: "public-oci",
      sourceDocs: reviewedDocs,
    };
const receiptPath = scenario.receiptPath;
const summaryPath = scenario.summaryPath;
const sourceDocs = scenario.sourceDocs;
const publicReference = publicReceipt.spec.artifact.reference;
const publicDigest = publicReceipt.spec.artifact.digest;
const expectedImage =
  "registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f";
const expectedIdentities = sourceDocs.map(identityFor).sort();
const expectedCheckSlugs = policy.spec.baseline.checks
  .map((item) => item.trigger.split("/").at(-1))
  .sort();
const historicalBaselineCheckSlugs = [
  "digest-pinned-images",
  "lifecycle-route-evidence",
  "probes-declared",
  "vet-placeholders",
  "vet-schemas",
];
check(
  historicalBaselineCheckSlugs.every((slug) =>
    expectedCheckSlugs.includes(slug)),
  "current catalog policy removed a check used by the recorded deployment proofs",
);

verifyInputs();

if (mode === "--run") {
  check(
    process.env.HELM_EXPT_ALLOW_BYO_HELM_VALUES_DEPLOY === "1",
    "set HELM_EXPT_ALLOW_BYO_HELM_VALUES_DEPLOY=1 to run this live proof",
  );
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  if (receipt.status.result !== "pass") {
    console.error(`bring-your-own deployment proof blocked: ${receipt.status.reason}`);
    process.exit(1);
  }
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
} else {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  if (mode === "--generate") {
    write(summaryPath, renderSummary(receipt));
    console.log(`wrote ${relativeRepo(summaryPath)}`);
  } else {
    check(
      existsSync(summaryPath)
        && readFileSync(summaryPath, "utf8") === renderSummary(receipt),
      `${relativeRepo(summaryPath)} is stale`,
    );
    console.log("verified the bring-your-own Helm values deployment proof");
  }
}

function verifyInputs() {
  check(sourceDocs.length === 5, "reviewed NGINX render must contain five objects");
  check(
    publicReceipt.kind === "PublicOciReceipt"
      && publicReceipt.status?.result === "pass"
      && publicReceipt.spec?.artifact?.anonymousPull === "pass"
      && publicReceipt.spec?.artifact?.objectSetSha256
        === objectSetSha256(reviewedDocs),
    "public OCI receipt is missing or differs from the reviewed objects",
  );
  check(
    hubReceipt.kind === "ConfigHubUploadReceipt"
      && hubReceipt.status?.result === "pass"
      && hubReceipt.spec?.space?.slug === baseSpace
      && hubReceipt.spec?.objectSetSha256 === objectSetSha256(reviewedDocs)
      && hubReceipt.spec?.sourceObjectsMatched === true,
    "persistent ConfigHub base receipt is missing or differs from the reviewed objects",
  );
  check(
    readYaml(localReceiptPath).status?.result === "pass",
    "local values-review receipt did not pass",
  );
  if (lane === "staging") {
    check(
      promotionReceipt?.kind === "BringYourOwnHelmValuesPromotionReceipt"
        && promotionReceipt.status?.result === "pass"
        && promotionReceipt.spec?.chain?.staging?.space === stagingSpace
        && promotionReceipt.spec?.chain?.staging?.replicas === 4
        && promotionReceipt.spec?.chain?.staging?.namespace === "nginx-staging"
        && sameSet(
          promotionReceipt.spec?.chain?.staging?.objectIdentities ?? [],
          sourceDocs.map(identityFor),
        ),
      "staging promotion receipt is missing or differs from the expected objects",
    );
    check(
      readYaml(reviewedReceiptPath).status?.result === "pass",
      "reviewed three-replica deployment must pass before the staging lane",
    );
  }
}

function runProof() {
  assertContext();
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required`);
  }

  const observedAt = new Date().toISOString();
  const suffix = `${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const clusterName = `${scenario.clusterPrefix}-${suffix}`;
  const clusterSpace = `${clusterName}-cluster`;
  const target = `${clusterSpace}/oci`;
  const deliverySpace = `${clusterName}-delivery`;
  const applicationName = scenario.applicationName;
  const applicationUnit = scenario.applicationUnit;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-byo-deploy-"));
  const cleanup = {
    deliverySpace: "pending",
    cluster: "pending",
    clusterSpace: "pending",
    localFiles: "pending",
  };
  let clusterCreated = false;
  let deliveryCreated = false;
  let failure = "";

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: scenario.receiptKind,
    metadata: {
      name: scenario.receiptName,
    },
    spec: {
      observedAt,
      source: {
        lane,
        chart: "bitnami/nginx",
        version: "24.0.2",
        reviewedObjects: relativeRepo(sourcePath),
        objectCount: sourceDocs.length,
        objectSetSha256: objectSetSha256(sourceDocs),
        publicOci: {
          reference: publicReference,
          digest: publicDigest,
          anonymousPull: "pass",
        },
        persistentConfigHubBase: {
          space: baseSpace,
          id: hubReceipt.spec.space.id,
          objectSetSha256: hubReceipt.spec.objectSetSha256,
        },
        ...(lane === "staging"
          ? {
              promotedConfigHubSource: {
                space: stagingSpace,
                id: promotionReceipt.spec.chain.staging.id,
                promotionReceipt: relativeRepo(promotionReceiptPath),
                objectSetSha256: objectSetSha256(sourceDocs),
              },
            }
          : {}),
      },
      configHubDelivery: {
        result: "not-run",
      },
      prerequisite: {
        kind: "Secret",
        namespace: scenario.namespace,
        name: "ai-provider-credentials",
        requiredKey: "AI_API_KEY",
        suppliedOutOfBand: "not-run",
        valueRecorded: false,
      },
      delivery: {
        result: "not-run",
      },
      run: {
        clusterCommand: "cub cluster up",
        targetShape: "one throwaway cub-managed kind cluster with Argo CD",
        organization: expectedOrg,
        clusterName,
        clusterSpace,
        deliverySpace,
        cleanup,
      },
      limits: [
        "The Secret value was a fake proof value and is not present in this receipt.",
        lane === "staging"
          ? "The persistent staging Space has no release target, so this run cloned its configuration Unit into a temporary target-bound delivery Space. The README was removed from that delivery copy before publication."
          : "The persistent base has no release target, so this run imported the same public OCI into a temporary delivery Space owned by the throwaway cluster target.",
        `This proves one fresh Argo CD deployment of the ${lane} lane on one local kind cluster.`,
        lane === "staging"
          ? "Rollback, chart upgrade, Flux delivery, fleet rollout, and ConfigHub observation storage did not run."
          : "Promotion, rollback, upgrade, Flux delivery, fleet rollout, and ConfigHub observation storage did not run.",
      ],
    },
    status: {
      result: "blocked",
      reason: "proof did not reach a passing delivery",
    },
  };

  try {
    clusterUp(clusterName);
    clusterCreated = true;

    receipt.spec.prerequisite = {
      ...receipt.spec.prerequisite,
      ...supplySecret(clusterName, workRoot),
    };

    const delivery = prepareDeliverySpace({
      deliverySpace,
      target,
    });
    deliveryCreated = true;
    const release = publishRelease(deliverySpace);
    receipt.spec.configHubDelivery = {
      result: "pass",
      space: deliverySpace,
      spaceId: delivery.spaceId,
      sourceType: delivery.sourceType,
      sourceReference: delivery.sourceReference,
      sourceDigest: delivery.sourceDigest,
      unit: delivery.unit,
      objectCount: delivery.objectCount,
      objectSetSha256: delivery.objectSetSha256,
      objectsMatched: true,
      policy: delivery.policy,
      release,
    };

    const application = addApplication({
      clusterName,
      clusterSpace,
      target,
      deliverySpace,
      applicationName,
      applicationUnit,
      workRoot,
    });
    const live = waitForApplication({
      clusterName,
      applicationName,
      releaseDigest: release.manifestDigest,
    });
    check(live.result === "pass", live.reason ?? "Argo CD delivery did not pass");
    receipt.spec.delivery = {
      result: "pass",
      application: {
        ...application,
        sync: live.sync,
        health: live.health,
        revision: live.revision,
      },
      kubernetes: {
        namespace: scenario.namespace,
        objectCount: live.objectIdentities.length,
        objectIdentities: live.objectIdentities,
        deployment: live.deployment,
        serviceType: live.serviceType,
        requiredSecret: live.requiredSecret,
      },
    };
    receipt.status = {
      result: "pass",
      claim: lane === "staging"
        ? "The promoted staging configuration was published by ConfigHub, reconciled by Argo CD at the recorded release digest, and reached four ready replicas while using the required existing Secret."
        : "The reviewed NGINX configuration was published by ConfigHub, reconciled by Argo CD at the recorded release digest, and reached three ready replicas while using the required existing Secret.",
    };
  } catch (error) {
    failure = sanitizeError(error?.message ?? String(error));
    receipt.status = {
      result: "blocked",
      reason: failure,
    };
  } finally {
    if (deliveryCreated || spacePresent(deliverySpace)) {
      cleanup.deliverySpace = deleteSpace(deliverySpace) ? "pass" : "blocked";
    } else {
      cleanup.deliverySpace = "n/a";
    }
    if (clusterCreated || clusterPresent(clusterName)) {
      clusterDown(clusterName);
    }
    cleanup.cluster = clusterPresent(clusterName) ? "blocked" : "pass";
    cleanup.clusterSpace = spacePresent(clusterSpace) ? "blocked" : "pass";
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "blocked" : "pass";
  }

  receipt.spec.run.cleanup = cleanup;
  if (Object.values(cleanup).some((value) => value === "blocked")) {
    receipt.status = {
      result: "blocked",
      reason: `cleanup incomplete after ${failure || "delivery run"}`,
    };
  }
  return receipt;
}

function prepareDeliverySpace({ deliverySpace, target }) {
  if (scenario.sourceMode === "variant-clone") {
    cub([
      "variant",
      "create",
      "staging-delivery",
      stagingSpace,
      "--space-pattern",
      `template:${deliverySpace}`,
      "--target",
      target,
      "--wait",
    ], { inherit: true, timeout: 420_000 });
    cub([
      "unit",
      "delete",
      "readme",
      "--space",
      deliverySpace,
      "--quiet",
    ]);
  } else {
    cub([
      "variant",
      "upload",
      "--component",
      "byo-nginx-ai-values",
      "--variant",
      "reviewed-deploy",
      "--space",
      deliverySpace,
      "--granularity",
      "minimal",
      "--target",
      target,
      "--label",
      "ApplyPolicyProfile=catalog-standard",
      "--label",
      "SourceType=helm",
      "--label",
      "ResourceClass=user-workload",
      "--layer",
      "Application",
      "--owner",
      "Application",
      "--change-desc",
      "Prepare the reviewed NGINX objects for one Argo CD deployment",
      publicReference,
    ], { inherit: true, timeout: 420_000 });
  }
  cub([
    "space",
    "update",
    deliverySpace,
    "--trigger-filter",
    "platform/helm-catalog-checks",
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub([
    "space",
    "update",
    "--patch",
    deliverySpace,
    "--refresh-triggers",
    "--quiet",
  ]);

  const space = cubJson(["space", "get", deliverySpace, "-o", "json"]).Space;
  const units = listUnits(deliverySpace);
  check(units.length === 1, "temporary delivery Space must have one Unit");
  const unit = cubJson([
    "unit",
    "get",
    "--space",
    deliverySpace,
    units[0].Slug,
    "-o",
    "json",
  ]).Unit;
  waitForChecks(deliverySpace, unit.Slug);
  const docs = parseDocs(storedData(
    cubJson(["unit", "get", "--space", deliverySpace, unit.Slug, "-o", "json"]).Unit,
  ));
  check(
    objectSetSha256(docs) === objectSetSha256(sourceDocs),
    "temporary ConfigHub delivery objects differ from the reviewed render",
  );
  const filter = cubJson([
    "filter",
    "get",
    "--space",
    "platform",
    "helm-catalog-checks",
    "-o",
    "json",
  ]).Filter;
  check(space.TriggerFilterID === filter.FilterID, "delivery Space lost its policy filter");
  const triggerSlugs = selectedTriggerSlugs(space);
  check(
    sameSet(triggerSlugs, expectedCheckSlugs),
    "delivery Space does not select the current catalog-standard checks",
  );
  if (scenario.sourceMode === "public-oci") {
    check(
      normalizeDigest(space.Annotations?.ExternalSourceDigest) === publicDigest,
      "delivery Space recorded a different source digest",
    );
  }
  return {
    spaceId: space.SpaceID,
    sourceType: scenario.sourceMode,
    sourceReference: scenario.sourceMode === "public-oci"
      ? space.Annotations?.ExternalSource
      : stagingSpace,
    sourceDigest: scenario.sourceMode === "public-oci"
      ? normalizeDigest(space.Annotations?.ExternalSourceDigest)
      : objectSetSha256(sourceDocs),
    unit: {
      slug: unit.Slug,
      id: unit.UnitID,
      dataHash: unit.DataHash,
    },
    objectCount: docs.length,
    objectSetSha256: objectSetSha256(docs),
    policy: {
      filter: "platform/helm-catalog-checks",
      filterId: filter.FilterID,
      filterHash: String(filter.Hash ?? "").trim(),
      checks: triggerSlugs,
    },
  };
}

function supplySecret(clusterName, workRoot) {
  kubectl(clusterName, ["create", "namespace", scenario.namespace]);
  const path = join(workRoot, "target-secret.yaml");
  writeFileSync(path, `apiVersion: v1
kind: Secret
metadata:
  name: ai-provider-credentials
  namespace: ${scenario.namespace}
type: Opaque
stringData:
  AI_API_KEY: proof-only-not-a-real-key
`, { mode: 0o600 });
  try {
    kubectl(clusterName, ["apply", "-f", path]);
  } finally {
    rmSync(path, { force: true });
  }
  const secret = kubectlJson(clusterName, [
    "get",
    "secret",
    "ai-provider-credentials",
    "-n",
    scenario.namespace,
    "-o",
    "json",
  ]);
  check(secret.data?.AI_API_KEY, "required Secret key was not created");
  return {
    suppliedOutOfBand: "pass",
    observedKeyNames: Object.keys(secret.data ?? {}).sort(),
    valueRecorded: false,
  };
}

function addApplication({
  clusterName,
  clusterSpace,
  target,
  deliverySpace,
  applicationName,
  applicationUnit,
  workRoot,
}) {
  const path = join(workRoot, "application.yaml");
  writeFileSync(path, `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${applicationName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: oci://oci.hub.confighub.com:443/space/${deliverySpace}
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: ${scenario.namespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
`);
  cub([
    "unit",
    "create",
    "--space",
    clusterSpace,
    applicationUnit,
    path,
    "--target",
    target,
    "--change-desc",
    `Deploy the ${lane} NGINX configuration`,
  ]);
  const rootRelease = publishRelease(clusterSpace);
  kubectl(clusterName, [
    "annotate",
    "application",
    clusterSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: applicationName,
    unit: `${clusterSpace}/${applicationUnit}`,
    source: `oci://oci.hub.confighub.com:443/space/${deliverySpace}`,
    destinationNamespace: scenario.namespace,
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function waitForApplication({ clusterName, applicationName, releaseDigest }) {
  let last = {};
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const appResult = kubectlTry(clusterName, [
      "get",
      "application",
      applicationName,
      "-n",
      "argocd",
      "-o",
      "json",
    ]);
    const deploymentResult = kubectlTry(clusterName, [
      "get",
      "deployment",
      "nginx",
      "-n",
      scenario.namespace,
      "-o",
      "json",
    ]);
    if (appResult.ok && deploymentResult.ok) {
      const app = JSON.parse(appResult.output);
      const deployment = JSON.parse(deploymentResult.output);
      const container = deployment.spec?.template?.spec?.containers?.find(
        (item) => item.name === "nginx",
      );
      const secretName = container?.envFrom?.find((item) => item.secretRef)
        ?.secretRef?.name;
      last = {
        sync: app.status?.sync?.status ?? "",
        health: app.status?.health?.status ?? "",
        revision: normalizeDigest(app.status?.sync?.revision),
        ready: Number(deployment.status?.readyReplicas ?? 0),
        available: Number(deployment.status?.availableReplicas ?? 0),
        replicas: Number(deployment.spec?.replicas ?? 0),
        image: container?.image ?? "",
        secretName,
        runAsNonRoot: container?.securityContext?.runAsNonRoot,
        allowPrivilegeEscalation:
          container?.securityContext?.allowPrivilegeEscalation,
        readOnlyRootFilesystem:
          container?.securityContext?.readOnlyRootFilesystem,
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.revision === releaseDigest
        && last.replicas === scenario.replicas
        && last.ready === scenario.replicas
        && last.available === scenario.replicas
        && last.image === expectedImage
        && last.secretName === "ai-provider-credentials"
        && last.runAsNonRoot === true
        && last.allowPrivilegeEscalation === false
        && last.readOnlyRootFilesystem === true
      ) {
        const identities = liveObjectIdentities(clusterName);
        check(
          sameSet(identities, expectedIdentities),
          "live NGINX object identities differ from the reviewed render",
        );
        const service = kubectlJson(clusterName, [
          "get",
          "service",
          "nginx",
          "-n",
          scenario.namespace,
          "-o",
          "json",
        ]);
        const secret = kubectlJson(clusterName, [
          "get",
          "secret",
          "ai-provider-credentials",
          "-n",
          scenario.namespace,
          "-o",
          "json",
        ]);
        return {
          result: "pass",
          sync: last.sync,
          health: last.health,
          revision: last.revision,
          objectIdentities: identities,
          serviceType: service.spec?.type,
          requiredSecret: {
            namespace: scenario.namespace,
            name: "ai-provider-credentials",
            observedKeyNames: Object.keys(secret.data ?? {}).sort(),
            valueRecorded: false,
          },
          deployment: {
            name: "nginx",
            replicas: scenario.replicas,
            readyReplicas: scenario.replicas,
            availableReplicas: scenario.replicas,
            image: last.image,
            secretRef: last.secretName,
            runAsNonRoot: true,
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
          },
        };
      }
    }
    sleep(5000);
  }
  return {
    result: "blocked",
    reason: `sync=${last.sync || "missing"} health=${last.health || "missing"} revision=${last.revision || "missing"} replicas=${last.ready ?? 0}/${scenario.replicas} image=${last.image || "missing"} secret=${last.secretName || "missing"}`,
  };
}

function liveObjectIdentities(clusterName) {
  return [
    ["serviceaccount", "nginx", "v1", "ServiceAccount"],
    ["deployment.apps", "nginx", "apps/v1", "Deployment"],
    ["service", "nginx", "v1", "Service"],
    ["networkpolicy.networking.k8s.io", "nginx", "networking.k8s.io/v1", "NetworkPolicy"],
    ["poddisruptionbudget.policy", "nginx", "policy/v1", "PodDisruptionBudget"],
  ].map(([resource, name, apiVersion, kind]) => {
    const object = kubectlJson(clusterName, [
      "get",
      resource,
      name,
      "-n",
      scenario.namespace,
      "-o",
      "json",
    ]);
    check(
      object.apiVersion === apiVersion
        && object.kind === kind
        && object.metadata?.name === name,
      `${kind}/${name} was not observed`,
    );
    return [apiVersion, kind, object.metadata?.namespace ?? "", name].join("|");
  }).sort();
}

function publishRelease(space) {
  const response = cubJson(["release", "publish", space, "-o", "json"], {
    timeout: 300_000,
  });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return {
    reference: `oci://oci.hub.confighub.com:443/space/${space}:latest`,
    manifestDigest,
    releaseId: release.ReleaseID ?? release.releaseId ?? "",
  };
}

function waitForChecks(space, slug) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const unit = cubJson(["unit", "get", "--space", space, slug, "-o", "json"]).Unit;
    if (unit.ApplyGates?.["awaiting/triggers"] !== true) {
      const blocking = Object.entries(unit.ApplyGates ?? {})
        .filter(([key, value]) => key !== "awaiting/triggers" && value === true)
        .map(([key]) => key);
      check(blocking.length === 0, `catalog checks blocked ${space}/${slug}: ${blocking.join(", ")}`);
      return;
    }
    sleep(1000);
  }
  throw new Error(`catalog checks did not finish for ${space}/${slug}`);
}

function selectedTriggerSlugs(space) {
  const selected = new Set(space.TriggerIDs ?? []);
  return cubJson(["trigger", "list", "--space", "platform", "-o", "json"])
    .map((item) => item.Trigger ?? item)
    .filter((item) => selected.has(item.TriggerID))
    .map((item) => item.Slug)
    .sort();
}

function listUnits(space) {
  return cubJson(["unit", "list", "--space", space, "-o", "json"])
    .map((item) => item.Unit ?? item);
}

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls, and it comes back as text.
function storedData(unit) {
  const space = unit.SpaceSlug || unit.SpaceID;
  const text = cub(["unit", "data", unit.UnitID ?? unit.Slug, "--space", space]);
  check(text, `${space}/${unit.Slug} has no data`);
  return text;
}

function clusterUp(name) {
  const result = spawnSync(
    "cub",
    ["cluster", "up", "--name", name, "--no-ports"],
    {
      cwd: repoRoot,
      env: cubEnv(),
      encoding: "utf8",
      stdio: "inherit",
      timeout: 900_000,
    },
  );
  check(
    result.status === 0 || clusterPresent(name),
    `cub cluster up failed for ${name}`,
  );
}

function clusterDown(name) {
  const result = tryCommand(
    "cub",
    ["cluster", "down", "--name", name, "--force"],
    { timeout: 600_000, env: cubEnv(), inherit: true },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
      inherit: true,
    });
  }
  if (spacePresent(`${name}-cluster`)) {
    deleteSpace(`${name}-cluster`);
  }
}

function deleteSpace(space) {
  if (!spacePresent(space)) return true;
  for (let attempt = 0; attempt < 3 && spacePresent(space); attempt += 1) {
    cubTry(["space", "delete", space, "--recursive-force", "--quiet"], {
      timeout: 240_000,
    });
    sleep(1000);
  }
  return !spacePresent(space);
}

function assertContext() {
  const context = process.env.CUB_CONTEXT?.trim();
  check(context, "set CUB_CONTEXT to the helm-catalog context");
  const current = cubJson(["context", "get", context, "-o", "json"]);
  check(
    current.metadata?.organizationName === expectedOrg,
    `refusing to run in ${current.metadata?.organizationName ?? "unknown"}; expected ${expectedOrg}`,
  );
}

function spacePresent(space) {
  return cubTry(["space", "get", space, "-o", "json"]).ok;
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function clusterKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function kubectl(clusterName, args) {
  return command("kubectl", [
    "--kubeconfig",
    clusterKubeconfig(clusterName),
    "--context",
    `kind-${clusterName}`,
    ...args,
  ]);
}

function kubectlTry(clusterName, args) {
  return tryCommand("kubectl", [
    "--kubeconfig",
    clusterKubeconfig(clusterName),
    "--context",
    `kind-${clusterName}`,
    ...args,
  ]);
}

function kubectlJson(clusterName, args) {
  return JSON.parse(kubectl(clusterName, args));
}

function cub(args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubTry(args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnv(),
  });
}

function cubJson(args, options = {}) {
  return JSON.parse(cub(args, options));
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 180_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  check(
    result.status === 0,
    `${commandName} ${args.join(" ")} failed: ${sanitizeError(result.stderr)}`,
  );
  return result.stdout ?? "";
}

function tryCommand(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 180_000,
    maxBuffer: 256 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === scenario.receiptKind
      && receipt.status?.result === "pass",
    "bring-your-own deployment receipt did not pass",
  );
  check(
    receipt.spec?.source?.publicOci?.reference === publicReference
      && receipt.spec?.source?.publicOci?.digest === publicDigest
      && (receipt.spec?.source?.lane ?? "reviewed") === lane
      && receipt.spec?.source?.objectSetSha256 === objectSetSha256(sourceDocs),
    "deployment receipt source changed",
  );
  if (lane === "staging") {
    check(
      receipt.spec?.source?.promotedConfigHubSource?.space === stagingSpace
        && receipt.spec.source.promotedConfigHubSource.id
          === promotionReceipt.spec.chain.staging.id
        && receipt.spec.source.promotedConfigHubSource.objectSetSha256
          === objectSetSha256(sourceDocs),
      "staging deployment no longer points to the promoted ConfigHub source",
    );
  }
  const managed = receipt.spec?.configHubDelivery;
  check(
    managed?.result === "pass"
      && (managed.sourceType ?? "public-oci") === scenario.sourceMode
      && managed.sourceDigest === (
        scenario.sourceMode === "public-oci"
          ? publicDigest
          : objectSetSha256(sourceDocs)
      )
      && managed.objectCount === 5
      && managed.objectSetSha256 === objectSetSha256(sourceDocs)
      && managed.objectsMatched === true
      && managed.release?.manifestDigest
      && recordedPolicyChecksMatch(managed.policy?.checks ?? []),
    "ConfigHub delivery evidence changed",
  );
  check(
    receipt.spec?.prerequisite?.suppliedOutOfBand === "pass"
      && receipt.spec?.prerequisite?.observedKeyNames?.includes("AI_API_KEY")
      && receipt.spec?.prerequisite?.valueRecorded === false,
    "required Secret evidence changed",
  );
  const delivery = receipt.spec?.delivery;
  check(
    delivery?.result === "pass"
      && delivery.application?.sync === "Synced"
      && delivery.application?.health === "Healthy"
      && delivery.application?.revision === managed.release.manifestDigest
      && delivery.kubernetes?.namespace === scenario.namespace
      && delivery.kubernetes?.objectCount === 5
      && sameSet(delivery.kubernetes?.objectIdentities ?? [], expectedIdentities)
      && delivery.kubernetes?.deployment?.replicas === scenario.replicas
      && delivery.kubernetes?.deployment?.readyReplicas === scenario.replicas
      && delivery.kubernetes?.deployment?.image === expectedImage
      && delivery.kubernetes?.deployment?.secretRef === "ai-provider-credentials"
      && delivery.kubernetes?.serviceType === "ClusterIP",
    "Argo CD or live NGINX evidence changed",
  );
  check(
    Object.values(receipt.spec?.run?.cleanup ?? {}).every(
      (value) => value === "pass",
    ),
    "deployment proof cleanup did not pass",
  );
  const serialized = JSON.stringify(receipt);
  check(
    !serialized.includes("proof-only-not-a-real-key"),
    "receipt contains the fake Secret value",
  );
}

function recordedPolicyChecksMatch(checks) {
  return sameSet(checks, expectedCheckSlugs)
    || sameSet(checks, historicalBaselineCheckSlugs);
}

function renderSummary(receipt) {
  const managed = receipt.spec.configHubDelivery;
  const delivery = receipt.spec.delivery;
  const title = lane === "staging"
    ? "Deploy the promoted staging result"
    : "Deploy the reviewed Helm values result";
  const introduction = lane === "staging"
    ? `This run starts with the four-replica NGINX configuration promoted from
development to staging. It clones that exact configuration into a temporary
target-bound Space, supplies the required Secret separately, publishes the
objects from ConfigHub, and lets Argo CD reconcile them on one throwaway
cluster created with \`cub cluster up\`.`
    : `This run starts with the same five NGINX objects produced by the
bring-your-own values review. It supplies the required Secret separately,
publishes the objects from ConfigHub, and lets Argo CD reconcile them on one
throwaway cluster created with \`cub cluster up\`.`;
  return `# ${title}

${introduction}

## What passed

- Public input OCI: \`${receipt.spec.source.publicOci.reference}@${receipt.spec.source.publicOci.digest}\`
- ConfigHub source: \`${scenario.persistentSpace}\`
- ConfigHub source match: **${managed.objectsMatched ? "pass" : "not-run"}**
- Catalog checks selected: ${managed.policy.checks.map((item) => `\`${item}\``).join(", ")}
- ConfigHub release digest: \`${managed.release.manifestDigest}\`
- Required Secret supplied out of band: **${receipt.spec.prerequisite.suppliedOutOfBand}**
- Argo CD: **${delivery.application.sync} / ${delivery.application.health}**
- NGINX Deployment: **${delivery.kubernetes.deployment.readyReplicas}/${delivery.kubernetes.deployment.replicas} replicas ready**
- Live image: \`${delivery.kubernetes.deployment.image}\`
- Live Service: \`${delivery.kubernetes.serviceType}\`

The Application reported the same digest that ConfigHub published. The live
Deployment uses the \`ai-provider-credentials\` Secret and keeps the reviewed
container security settings. All five reviewed Kubernetes object identities
were present.

## What was temporary

The ConfigHub delivery Space and the kind cluster were deleted after the
checks. The persistent \`${scenario.persistentSpace}\` Space remains in the
demo org.

## Run it again

\`\`\`bash
HELM_EXPT_ALLOW_BYO_HELM_VALUES_DEPLOY=1 \\
CUB_CONTEXT=river-bear \\
npm run ${lane === "staging"
    ? "byo-helm-values:staging-deploy-run"
    : "byo-helm-values:deploy-run"}
\`\`\`

## Limits

${receipt.spec.limits.map((item) => `- ${item}`).join("\n")}

Receipt: [\`${relativeRepo(receiptPath)}\`](../../${relativeRepo(receiptPath)})
`;
}

function objectSetSha256(docs) {
  return sha256(JSON.stringify(
    docs
      .map((doc) => [identityFor(doc), doc])
      .sort(([left], [right]) => left.localeCompare(right)),
  ));
}

function stagingDocs(docs) {
  return structuredClone(docs).map((doc) => {
    if (doc.metadata?.namespace) doc.metadata.namespace = "nginx-staging";
    if (doc.kind === "Deployment" && doc.metadata?.name === "nginx") {
      doc.spec.replicas = 4;
    }
    return doc;
  });
}

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[a-f0-9]{64}/i);
  return match ? match[0].toLowerCase() : "";
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function sanitizeError(value) {
  return String(value ?? "")
    .replaceAll(/(authorization|bearer|password|token|secret)[=: ]+\S+/gi, "$1=[redacted]")
    .slice(0, 1000);
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}
