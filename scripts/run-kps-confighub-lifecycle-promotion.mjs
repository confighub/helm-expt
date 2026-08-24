#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  check,
  cubEnv,
  identityFor,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  serializeYaml,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(
  ["--run", "--generate", "--verify", "--hub-verify"].includes(mode),
  "use --run, --generate, --verify, or --hub-verify",
);

const expectedOrg = "helm-catalog";
const chart = "prometheus-community/kube-prometheus-stack";
const currentVersion = "85.3.3";
const candidateVersion = "86.1.0";
const base = "no-crds";
const namespace = "monitoring";
const baseSpace = "kps-no-crds-upgrade-base";
const stagingSpace = "kps-no-crds-upgrade-staging";
const proofLabel = "kps-confighub-lifecycle-promotion";
const routeSlug = "candidate-route";
const readmeSlug = "readme";
const receiptPath = join(
  repoRoot,
  "runs",
  "kps-confighub-lifecycle-promotion",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "kps-confighub-lifecycle-promotion",
  "summary.md",
);
const exampleRoot = join(
  repoRoot,
  "examples",
  "promotions",
  "kube-prometheus-stack-85-3-3-to-86-1-0-no-crds",
);
const promotionReviewPath = join(exampleRoot, "promotion-review.yaml");
const lifecycleRoutePath = join(exampleRoot, "lifecycle-route.yaml");
const sourceProofPath = join(
  repoRoot,
  "runs",
  "kps-gitops-lifecycle-proof",
  "receipt.yaml",
);
const sourceProof = readYaml(sourceProofPath);
const currentArtifact = sourceProof.spec.deliveryArtifact;
const candidateArtifact = sourceProof.spec.upgradeArtifact;
const currentRenderedPath = join(
  repoRoot,
  "packages",
  chart,
  currentVersion,
  "bases",
  base,
  "upstream.yaml",
);
const candidateResolutionPath =
  "data/lifecycle-route-resolutions/kube-prometheus-stack-86-1-0-no-crds-argo-cd.yaml";
const crdNames = [
  "alertmanagerconfigs.monitoring.coreos.com",
  "alertmanagers.monitoring.coreos.com",
  "podmonitors.monitoring.coreos.com",
  "probes.monitoring.coreos.com",
  "prometheusagents.monitoring.coreos.com",
  "prometheuses.monitoring.coreos.com",
  "prometheusrules.monitoring.coreos.com",
  "scrapeconfigs.monitoring.coreos.com",
  "servicemonitors.monitoring.coreos.com",
  "thanosrulers.monitoring.coreos.com",
];
const workloads = [
  ["deployment", "kube-prometheus-stack-grafana"],
  ["deployment", "kube-prometheus-stack-kube-state-metrics"],
  ["deployment", "kube-prometheus-stack-operator"],
  ["daemonset", "kube-prometheus-stack-prometheus-node-exporter"],
  ["statefulset", "alertmanager-kube-prometheus-stack-alertmanager"],
  ["statefulset", "prometheus-kube-prometheus-stack-prometheus"],
];
const kubeSystemServiceNames = [
  "kube-prometheus-stack-coredns",
  "kube-prometheus-stack-kube-controller-manager",
  "kube-prometheus-stack-kube-etcd",
  "kube-prometheus-stack-kube-proxy",
  "kube-prometheus-stack-kube-scheduler",
];

check(
  sourceProof.kind === "KubePrometheusStackGitOpsLifecycleReceipt"
    && sourceProof.spec.result === "pass"
    && currentArtifact.anonymousPull === "pass"
    && candidateArtifact.anonymousPull === "pass",
  "the staged Kube Prometheus Stack source proof is not complete",
);

if (mode === "--run") {
  check(
    process.env.HELM_EXPT_ALLOW_KPS_CONFIGHUB_PROMOTION === "1",
    "set HELM_EXPT_ALLOW_KPS_CONFIGHUB_PROMOTION=1 to run this live proof",
  );
  const receipt = runProof();
  writeYaml(receiptPath, receipt);
  if (receipt.status.result !== "pass") {
    console.error(`Kube Prometheus Stack ConfigHub promotion blocked: ${receipt.status.reason}`);
    process.exit(1);
  }
  generateDerived(receipt);
  verifyReceipt(receipt);
  console.log(`wrote ${relativeRepo(receiptPath)}: pass`);
} else {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  if (mode === "--generate") {
    generateDerived(receipt);
    console.log(`regenerated ${relativeRepo(summaryPath)} and the worked promotion records`);
  } else if (mode === "--hub-verify") {
    verifyHub(receipt);
    console.log("verified the retained Kube Prometheus Stack base and staging variant in ConfigHub");
  } else {
    verifyGenerated(receipt);
    console.log("verified the Kube Prometheus Stack ConfigHub lifecycle promotion proof");
  }
}

function runProof() {
  assertContext();
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["kustomize", ["version"]],
    ["oras", ["version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required`);
  }
  check(!liveParityRunning(), "another live Helm parity or Kube Prometheus Stack proof is running");

  const observedAt = new Date().toISOString();
  const runId = `${observedAt.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const clusterName = `hx-kps-confighub-${runId}`;
  const deliverySpace = `${clusterName}-delivery`;
  const target = `${clusterName}/target`;
  const applicationName = deliverySpace;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-kps-confighub-"));
  const cleanup = {
    cluster: "not-created",
    deliverySpace: "not-created",
    localFiles: "pending",
  };
  let clusterCreated = false;
  let deliveryCreated = false;
  let failure = "";

  const receipt = {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "KubePrometheusStackConfigHubLifecyclePromotionReceipt",
    metadata: { name: "kube-prometheus-stack-85-3-3-to-86-1-0-no-crds" },
    spec: {
      observedAt,
      source: {
        chart,
        base,
        current: artifactRecord(currentVersion, currentArtifact),
        candidate: artifactRecord(candidateVersion, candidateArtifact),
      },
      comparison: { result: "not-run" },
      configHub: {
        organization: expectedOrg,
        base: { space: baseSpace, result: "not-run" },
        staging: { space: stagingSpace, result: "not-run" },
        delivery: { space: deliverySpace, result: "not-run" },
        promotion: { result: "not-run" },
        route: { result: "not-run" },
        approvals: { result: "not-run" },
        releases: { result: "not-run" },
      },
      delivery: {
        controller: "Argo CD",
        cluster: clusterName,
        application: applicationName,
        current: { result: "not-run" },
        candidate: { result: "not-run" },
      },
      cleanup,
      limits: [
        "This proves one 85.3.3 to 86.1.0 no-crds promotion through ConfigHub, one Argo CD destination, and one throwaway kind cluster.",
        "The target supplied the Alertmanager and Grafana Secrets separately. Their values are not present in OCI or this receipt.",
        "The operator removed the two completed setup Jobs before publishing the candidate. ConfigHub records and checks that route, but does not yet choose and run it automatically.",
        "The separate staged-OCI proof covers Flux for this version pair. This ConfigHub release proof covers Argo CD only.",
        "Rollback, long-running soak, and a production cluster were not tested in this run.",
      ],
    },
    status: {
      result: "blocked",
      reason: "the proof did not complete",
    },
  };

  try {
    const current = materializeArtifact({
      workRoot,
      label: "current",
      artifact: currentArtifact,
    });
    const candidate = materializeArtifact({
      workRoot,
      label: "candidate",
      artifact: candidateArtifact,
    });
    receipt.spec.source.current = { ...receipt.spec.source.current, ...current.record };
    receipt.spec.source.candidate = { ...receipt.spec.source.candidate, ...candidate.record };
    receipt.spec.comparison = compareObjectSets(current.docs, candidate.docs);

    replacePersistentSpace(baseSpace);
    replacePersistentSpace(stagingSpace);
    uploadBase(current.flatPath, currentArtifact, "Retain the checked 85.3.3 no-crds objects");
    createReadme(baseSpace, baseReadme());
    setPolicy(baseSpace, "platform/helm-catalog-checks");
    const baseBefore = inspectSpace(baseSpace);
    receipt.spec.configHub.base = {
      result: "pass",
      ...spaceRecord(baseBefore),
      version: currentVersion,
      objectSetSha256: current.objectSetSha256,
    };

    cub([
      "variant", "create", "staging", baseSpace,
      "--space-pattern", `template:${stagingSpace}`,
      "--environment", "Staging",
      "--wait",
    ], { timeout: 600_000, inherit: true });
    setPolicy(stagingSpace, "platform/helm-catalog-prod-gates");
    const stagingBefore = inspectSpace(stagingSpace);
    check(
      stagingBefore.objectSetSha256 === current.objectSetSha256,
      "staging did not start with the current object set",
    );

    clusterUp(clusterName);
    clusterCreated = true;
    cleanup.cluster = "pending";
    stageTargetSecrets(clusterName, workRoot);

    cub([
      "variant", "create", "delivery", stagingSpace,
      "--space-pattern", `template:${deliverySpace}`,
      "--environment", "Staging",
      "--target", target,
      "--wait",
    ], { timeout: 600_000, inherit: true });
    deliveryCreated = true;
    cleanup.deliverySpace = "pending";
    const deliveryBefore = inspectSpace(deliverySpace);
    check(
      deliveryBefore.objectSetSha256 === current.objectSetSha256,
      "the target-bound variant changed the checked starting objects",
    );
    const namespaceCheck = checkSourceNamespaces(deliveryBefore.docs);
    const applicationConfig = enableServerSideApply({
      clusterName,
      deliverySpace,
      workRoot,
    });
    applicationConfig.namespaceHandling = namespaceCheck;
    approveDeployableUnits(deliverySpace, "Approve the checked 85.3.3 starting configuration");
    const currentRelease = publishRelease(deliverySpace);
    const currentRuntime = waitForApplication({
      clusterName,
      applicationName,
      expectedDigest: currentRelease.manifestDigest,
    });
    receipt.spec.delivery.current = {
      result: "pass",
      release: currentRelease,
      runtime: currentRuntime,
    };

    const baseDryRun = cub([
      "variant", "upload", "--dry-run",
      "--component", "kube-prometheus-stack",
      "--variant", "no-crds-upgrade-base",
      "--space", baseSpace,
      "--granularity", "minimal",
      candidate.flatPath,
    ], { timeout: 600_000 });
    check(baseDryRun.trim(), "candidate upload dry run returned no plan");
    uploadBase(candidate.flatPath, candidateArtifact, "Retain the checked 86.1.0 no-crds candidate");
    const baseAfter = inspectSpace(baseSpace);
    check(
      baseAfter.objectSetSha256 === candidate.objectSetSha256,
      "the ConfigHub base does not match the candidate objects",
    );

    const stagingPreview = cub([
      "variant", "promote", stagingSpace,
      "--dry-run", "-o", "mutations",
    ], { timeout: 600_000 });
    check(stagingPreview.trim(), "staging promotion preview returned no mutations");
    cub([
      "variant", "promote", stagingSpace,
      "--change-desc", `Promote ${candidateVersion} to staging`,
    ], { timeout: 600_000, inherit: true });
    const stagingAfterPromotion = inspectSpace(stagingSpace);
    check(
      stagingAfterPromotion.objectSetSha256 === candidate.objectSetSha256,
      "staging does not match the promoted candidate",
    );
    updateReadme(stagingSpace, stagingReadme());

    const route = lifecycleRoute(receipt);
    const routePath = join(workRoot, "candidate-route.yaml");
    writeYaml(routePath, route);
    cub([
      "unit", "create", "--space", stagingSpace,
      routeSlug, routePath,
      "--provider", "None",
      "--label", "RecordType=lifecycle-route",
      "--label", `Proof=${proofLabel}`,
      "--change-desc", "Record the destination-specific 86.1.0 lifecycle route",
    ], { timeout: 300_000 });
    const stagingRouteApproval = approveExactUnit(stagingSpace, routeSlug);

    const deliveryPreview = cub([
      "variant", "promote", deliverySpace,
      "--dry-run", "-o", "mutations",
    ], { timeout: 600_000 });
    check(deliveryPreview.trim(), "delivery promotion preview returned no mutations");
    cub([
      "variant", "promote", deliverySpace,
      "--change-desc", `Promote ${candidateVersion} to the Argo CD delivery variant`,
    ], { timeout: 600_000, inherit: true });
    const deliveryAfterPromotion = inspectSpace(deliverySpace);
    check(
      deliveryAfterPromotion.objectSetSha256 === candidate.objectSetSha256,
      "delivery does not match the promoted candidate",
    );
    checkSourceNamespaces(deliveryAfterPromotion.docs);
    const deliveryRouteApproval = approveExactUnit(deliverySpace, routeSlug);
    const candidateApprovals = approveDeployableUnits(
      deliverySpace,
      "Approve the exact 86.1.0 candidate after route review",
    );

    const hookReplacement = replaceCompletedHookResources({
      clusterName,
      current,
      currentJobs: currentRuntime.jobs,
    });
    const candidateRelease = publishRelease(deliverySpace);
    refreshApplication(clusterName, applicationName);
    const candidateRuntime = waitForApplication({
      clusterName,
      applicationName,
      expectedDigest: candidateRelease.manifestDigest,
    });
    check(
      hookReplacement.before.every((item) =>
        candidateRuntime.jobs.some((job) => job.name === item.name && job.uid !== item.uid)),
      "the candidate did not replace both completed setup Jobs",
    );

    receipt.spec.configHub.base = {
      result: "pass",
      ...spaceRecord(baseAfter),
      version: candidateVersion,
      previousVersion: currentVersion,
      objectSetSha256: candidate.objectSetSha256,
      dryRunSha256: sha256(baseDryRun),
    };
    receipt.spec.configHub.staging = {
      result: "pass",
      ...spaceRecord(stagingAfterPromotion),
      upstreamSpace: baseSpace,
      version: candidateVersion,
      objectSetSha256: candidate.objectSetSha256,
    };
    receipt.spec.configHub.delivery = {
      result: "pass",
      ...spaceRecord(deliveryAfterPromotion),
      upstreamSpace: stagingSpace,
      target,
      version: candidateVersion,
      objectSetSha256: candidate.objectSetSha256,
      application: applicationConfig,
    };
    receipt.spec.configHub.promotion = {
      result: "pass",
      chain: `${baseSpace} -> ${stagingSpace} -> ${deliverySpace}`,
      stagingPreviewSha256: sha256(stagingPreview),
      deliveryPreviewSha256: sha256(deliveryPreview),
      currentObjectSetSha256: current.objectSetSha256,
      candidateObjectSetSha256: candidate.objectSetSha256,
      candidateAdded: receipt.spec.comparison.added,
      candidateRemoved: receipt.spec.comparison.removed,
      candidateChanged: receipt.spec.comparison.changed,
    };
    receipt.spec.configHub.route = {
      result: "pass",
      record: relativeRepo(lifecycleRoutePath),
      resolution: candidateResolutionPath,
      executionMode: route.spec.executionMode,
      automatic: route.spec.automatic,
      disposition: route.spec.disposition,
      stagingUnit: stagingRouteApproval,
      deliveryUnit: deliveryRouteApproval,
      completedHookJobsReplaced: hookReplacement.before.map((item) => item.name),
    };
    receipt.spec.configHub.approvals = {
      result: "pass",
      current: currentRuntime.approvals,
      candidate: candidateApprovals,
      route: [stagingRouteApproval, deliveryRouteApproval],
    };
    receipt.spec.configHub.releases = {
      result: "pass",
      current: currentRelease,
      candidate: candidateRelease,
    };
    receipt.spec.delivery.candidate = {
      result: "pass",
      release: candidateRelease,
      hookReplacement,
      runtime: candidateRuntime,
    };
    receipt.status = {
      result: "pass",
      claim: "ConfigHub retained the exact 85.3.3 no-crds objects, promoted the checked 86.1.0 candidate through staging and a target-bound variant, recorded and approved the destination route, published a new immutable OCI release, and Argo CD reran the ordered setup work before all checked runtime tests passed.",
    };
  } catch (error) {
    failure = sanitizeError(error?.message ?? String(error));
    receipt.status = { result: "blocked", reason: failure };
  } finally {
    if (clusterCreated || clusterPresent(clusterName)) {
      clusterDown(clusterName);
    }
    cleanup.cluster = clusterPresent(clusterName) ? "blocked" : "pass";
    cleanup.deliverySpace = spacePresent(deliverySpace) ? "blocked" : "pass";
    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "blocked" : "pass";
    if (Object.values(cleanup).includes("blocked")) {
      receipt.status = {
        result: "blocked",
        reason: `cleanup incomplete after ${failure || "the live run"}`,
      };
    }
  }
  return receipt;
}

function materializeArtifact({ workRoot, label, artifact }) {
  const rawRoot = join(workRoot, `${label}-staged`);
  mkdirSync(rawRoot, { recursive: true });
  command("oras", [
    "pull",
    `${artifact.reference.replace(/^oci:\/\//, "")}@${artifact.digest}`,
    "-o",
    rawRoot,
  ], { timeout: 600_000 });
  const archives = readdirSync(rawRoot)
    .filter((name) => name.endsWith(".tar.gz"))
    .map((name) => join(rawRoot, name));
  check(archives.length === 1, `${label} staged OCI did not contain one archive`);
  command("tar", ["-xzf", archives[0], "-C", rawRoot], { timeout: 300_000 });
  check(
    existsSync(join(rawRoot, ".confighub", "route.yaml")),
    `${label} staged OCI has no route record`,
  );
  const flat = command("kustomize", ["build", rawRoot], { timeout: 300_000 });
  const flatPath = join(workRoot, `${label}.yaml`);
  writeFileSync(flatPath, flat);
  const docs = parseDocs(flat);
  check(docs.length === 130, `${label} staged OCI produced ${docs.length} objects, expected 130`);
  check(
    docs.every((doc) => doc.kind !== "Secret"),
    `${label} staged OCI contains a Secret`,
  );
  const identities = docs.map(identityFor);
  check(new Set(identities).size === docs.length, `${label} staged OCI has duplicate objects`);
  const objectSetSha256 = objectSetDigest(docs);
  return {
    rawRoot,
    flatPath,
    docs,
    objectSetSha256,
    record: {
      materializedObjectCount: docs.length,
      materializedObjectSetSha256: objectSetSha256,
      crdCount: docs.filter((doc) => doc.kind === "CustomResourceDefinition").length,
      setupJobCount: docs.filter((doc) => doc.kind === "Job").length,
      containsSecrets: false,
      routeRecord: ".confighub/route.yaml",
    },
  };
}

function compareObjectSets(currentDocs, candidateDocs) {
  const current = new Map(currentDocs.map((doc) => [identityFor(doc), JSON.stringify(doc)]));
  const candidate = new Map(candidateDocs.map((doc) => [identityFor(doc), JSON.stringify(doc)]));
  const added = [...candidate.keys()].filter((key) => !current.has(key)).sort();
  const removed = [...current.keys()].filter((key) => !candidate.has(key)).sort();
  const changed = [...candidate.keys()]
    .filter((key) => current.has(key) && current.get(key) !== candidate.get(key))
    .sort();
  const unchanged = [...candidate.keys()]
    .filter((key) => current.get(key) === candidate.get(key))
    .sort();
  return {
    result: "pass",
    currentObjects: current.size,
    candidateObjects: candidate.size,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    unchanged: unchanged.length,
    addedObjects: added,
    removedObjects: removed,
  };
}

function uploadBase(path, artifact, description) {
  cub([
    "variant", "upload",
    "--component", "kube-prometheus-stack",
    "--variant", "no-crds-upgrade-base",
    "--space", baseSpace,
    "--granularity", "minimal",
    "--label", "ApplyPolicyProfile=catalog-standard",
    "--label", "SourceType=helm",
    "--label", "ResourceClass=system-configuration",
    "--label", `Proof=${proofLabel}`,
    "--layer", "Platform",
    "--owner", "Platform",
    "--annotation", `config-workshop.confighub.com/source-oci=${artifact.reference}`,
    "--annotation", `config-workshop.confighub.com/source-digest=${artifact.digest}`,
    "--change-desc", description,
    path,
  ], { timeout: 600_000, inherit: true });
  cub([
    "space", "update", "--patch", baseSpace,
    "--label", "ApplyPolicyProfile=catalog-standard",
    "--label", "SourceType=helm",
    "--label", "ResourceClass=system-configuration",
    "--label", `Proof=${proofLabel}`,
    "--annotation", `config-workshop.confighub.com/source-oci=${artifact.reference}`,
    "--annotation", `config-workshop.confighub.com/source-digest=${artifact.digest}`,
    "--annotation", `config-workshop.confighub.com/source-proof=${relativeRepo(sourceProofPath)}`,
    "--quiet",
  ]);
}

function setPolicy(space, filter) {
  cub([
    "space", "update", space,
    "--trigger-filter", filter,
    "--where-trigger", "-",
    "--quiet",
  ]);
  cub([
    "space", "update", "--patch", space,
    "--refresh-triggers", "--quiet",
  ]);
}

function createReadme(space, data) {
  const path = temporaryYaml(data);
  try {
    cub([
      "unit", "create", "--space", space,
      readmeSlug, path,
      "--provider", "None",
      "--label", "RecordType=readme",
      "--label", "helm-expt.confighub.com/readme=true",
      "--label", `Proof=${proofLabel}`,
      "--change-desc", "Explain the Kube Prometheus Stack promotion example",
    ]);
  } finally {
    rmSync(dirname(path), { recursive: true, force: true });
  }
}

function updateReadme(space, data) {
  const path = temporaryYaml(data);
  try {
    cub([
      "unit", "update", "--space", space,
      readmeSlug, path,
      "--provider", "None",
      "--change-desc", "Explain the promoted staging result",
    ]);
  } finally {
    rmSync(dirname(path), { recursive: true, force: true });
  }
}

function baseReadme() {
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "CatalogExampleReadme",
    metadata: { name: "kps-no-crds-upgrade-base" },
    spec: {
      title: "Kube Prometheus Stack upgrade base",
      purpose: "Show how an exact Helm-derived configuration becomes a retained ConfigHub base before promotion.",
      start: `${currentVersion} no-crds`,
      candidate: `${candidateVersion} no-crds`,
      whatToOpen: [
        "Open the Kubernetes Units to inspect the exact objects.",
        "Open revision history to see the chart-version update.",
        `Open ${stagingSpace} to see the promoted variant and its destination route.`,
      ],
      evidence: [
        "https://confighub.github.io/helm-expt/site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html",
        "https://confighub.github.io/helm-expt/site/charts/prometheus-community-kube-prometheus-stack-86-1-0.html",
        "https://confighub.github.io/helm-expt/site/d/data/kps-confighub-lifecycle-promotion/summary.html",
      ],
    },
  };
}

function stagingReadme() {
  const readme = baseReadme();
  readme.metadata.name = "kps-no-crds-upgrade-staging";
  readme.spec.title = "Kube Prometheus Stack staging promotion";
  readme.spec.purpose = "Show the exact candidate, route decision, approval, OCI release, and Argo CD result for one lifecycle-heavy promotion.";
  readme.spec.whatToOpen = [
    "Open the Kubernetes Units to inspect the promoted 86.1.0 objects.",
    `Open ${routeSlug} to see how CRDs and the two setup Jobs were handled for Argo CD.`,
    "Open revision history to see the change arrive from the base instead of being copied by hand.",
  ];
  return readme;
}

function temporaryYaml(value) {
  const root = mkdtempSync(join(tmpdir(), "helm-expt-kps-record-"));
  const path = join(root, "record.yaml");
  writeYaml(path, value);
  return path;
}

function inspectSpace(space) {
  const entity = cubJson(["space", "get", space, "-o", "json"]).Space;
  const units = listUnits(space);
  const configUnits = units.filter((unit) => ![readmeSlug, routeSlug].includes(unit.Slug));
  const docs = configUnits.flatMap((unit) =>
    parseDocs(Buffer.from(
      cubJson(["unit", "get", "--space", space, unit.Slug, "-o", "json"]).Unit.Data,
      "base64",
    ).toString("utf8")),
  );
  return {
    id: entity.SpaceID,
    slug: space,
    headUnits: units.length,
    configUnits: configUnits.length,
    configUnitSlugs: configUnits.map((unit) => unit.Slug).sort(),
    objectCount: docs.length,
    objectSetSha256: objectSetDigest(docs),
    labels: entity.Labels ?? {},
    annotations: entity.Annotations ?? {},
    docs,
  };
}

function spaceRecord(space) {
  return {
    id: space.id,
    slug: space.slug,
    unitCount: space.headUnits,
    configUnitCount: space.configUnits,
    configUnits: space.configUnitSlugs,
    objectCount: space.objectCount,
  };
}

function checkSourceNamespaces(docs) {
  const observed = kubeSystemServiceNames.map((name) => {
    const object = docs.find(
      (doc) => doc.kind === "Service" && doc.metadata?.name === name,
    );
    check(object, `the target-bound variant is missing Service/${name}`);
    check(
      object.metadata?.namespace === "kube-system",
      `Service/${name} moved from kube-system to ${object.metadata?.namespace ?? "no namespace"}`,
    );
    return `Service/${name}`;
  });
  return {
    mode: "preserve-source-namespaces",
    result: "pass",
    checkedNamespace: "kube-system",
    checkedObjects: observed,
  };
}

function approveDeployableUnits(space, description) {
  const units = listUnits(space).filter((unit) => ![readmeSlug, routeSlug].includes(unit.Slug));
  check(
    units.length === 4,
    `${space} must have namespace, CRD, ConfigMap, and workload Units`,
  );
  const approvals = [];
  for (const unit of units) {
    waitForChecks(space, unit.Slug, { allowApproval: true });
    const before = readUnit(space, unit.Slug);
    const approvalOutput = cub([
      "unit", "approve", "--space", space,
      unit.Slug,
    ], { timeout: 300_000 });
    check(approvalOutput.includes("has been approved"), `${space}/${unit.Slug} approval was not recorded`);
    waitForChecks(space, unit.Slug, { allowApproval: false });
    const after = readUnit(space, unit.Slug);
    approvals.push({
      unit: unit.Slug,
      revision: Number(after.HeadRevisionNum),
      dataHash: after.DataHash,
      approvalGateCleared: true,
      description,
    });
  }
  return approvals;
}

function approveExactUnit(space, slug) {
  const before = readUnit(space, slug);
  const approvalOutput = cub([
    "unit", "approve", "--space", space,
    slug,
  ], { timeout: 300_000 });
  check(approvalOutput.includes("has been approved"), `${space}/${slug} approval was not recorded`);
  const after = readUnit(space, slug);
  return {
    space,
    unit: slug,
    revision: Number(after.HeadRevisionNum),
    dataHash: after.DataHash,
    approved: true,
  };
}

function waitForChecks(space, slug, { allowApproval }) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const unit = readUnit(space, slug);
    const gates = Object.entries(unit.ApplyGates ?? {})
      .filter(([key, value]) => key !== "awaiting/triggers" && value === true)
      .map(([key]) => key)
      .sort();
    if (unit.ApplyGates?.["awaiting/triggers"] !== true) {
      const unexpected = gates.filter((gate) =>
        !(allowApproval && gate.includes("require-approval")));
      check(
        unexpected.length === 0,
        `${space}/${slug} has blocking checks: ${unexpected.join(", ")}`,
      );
      if (!allowApproval) {
        check(gates.length === 0, `${space}/${slug} still has an approval gate`);
      }
      return;
    }
    sleep(1000);
  }
  throw new Error(`${space}/${slug} checks did not finish`);
}

function publishRelease(space) {
  const response = cubJson(["release", "publish", space, "-o", "json"], {
    timeout: 300_000,
  });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  check(manifestDigest, `${space} release returned no manifest digest`);
  return {
    reference: `oci://oci.hub.confighub.com:443/space/${space}:latest`,
    manifestDigest,
    releaseId: release.ReleaseID ?? release.releaseId ?? "",
  };
}

function stageTargetSecrets(clusterName, workRoot) {
  kubectl(clusterName, [
    "create", "namespace", namespace,
    "--dry-run=client", "-o", "yaml",
  ], {
    transformOutput: (output) => kubectl(clusterName, ["apply", "-f", "-"], { input: output }),
  });
  const secrets = parseDocs(readFileSync(currentRenderedPath, "utf8"))
    .filter((object) => object.kind === "Secret");
  check(secrets.length === 2, "expected two target-owned Secrets in the checked render");
  const password = randomBytes(24).toString("base64url");
  const grafana = secrets.find(
    (object) => object.metadata?.name === "kube-prometheus-stack-grafana",
  );
  check(grafana, "the checked render has no Grafana Secret");
  grafana.data = {
    ...(grafana.data ?? {}),
    "admin-user": Buffer.from("admin").toString("base64"),
    "admin-password": Buffer.from(password).toString("base64"),
  };
  const path = join(workRoot, "target-owned-secrets.yaml");
  writeYaml(path, {
    apiVersion: "v1",
    kind: "List",
    items: secrets,
  });
  chmodSync(path, 0o600);
  try {
    kubectl(clusterName, ["apply", "-f", path], { redactOutput: true });
  } finally {
    rmSync(path, { force: true });
  }
}

function waitForApplication({ clusterName, applicationName, expectedDigest }) {
  refreshApplication(clusterName, `${clusterName}-argo-apps`);
  refreshApplication(clusterName, applicationName);
  let last = {};
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const result = kubectlTry(clusterName, [
      "get", "application", applicationName,
      "-n", "argocd", "-o", "json",
    ]);
    if (attempt > 0 && attempt % 12 === 0) {
      refreshApplication(
        clusterName,
        result.ok ? applicationName : `${clusterName}-argo-apps`,
      );
    }
    if (result.ok) {
      const app = JSON.parse(result.output);
      last = {
        sync: app.status?.sync?.status ?? "",
        health: app.status?.health?.status ?? "",
        revision: normalizeDigest(app.status?.sync?.revision ?? ""),
        phase: app.status?.operationState?.phase ?? "",
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.revision === expectedDigest
      ) {
        const runtime = observeRuntime(clusterName);
        const approvals = approveStateForDelivery(applicationName);
        return { ...last, ...runtime, approvals };
      }
    }
    sleep(5000);
  }
  throw new Error(
    `Argo CD did not reach ${expectedDigest}: sync=${last.sync || "missing"} health=${last.health || "missing"} revision=${last.revision || "missing"} phase=${last.phase || "missing"}`,
  );
}

function enableServerSideApply({ clusterName, deliverySpace, workRoot }) {
  const appsSpace = `${clusterName}-argo-apps`;
  const unit = readUnit(appsSpace, deliverySpace);
  const docs = parseDocs(Buffer.from(unit.Data, "base64").toString("utf8"));
  check(docs.length === 1 && docs[0].kind === "Application", "auto-created Argo Application Unit is missing");
  const application = docs[0];
  application.spec ??= {};
  application.spec.syncPolicy ??= {};
  application.spec.syncPolicy.automated ??= { allowEmpty: true, selfHeal: true };
  application.spec.syncPolicy.syncOptions = [
    "CreateNamespace=true",
    "ServerSideApply=true",
  ];
  const path = join(workRoot, "delivery-application.yaml");
  writeYaml(path, application);
  cub([
    "unit", "update", "--space", appsSpace,
    deliverySpace, path,
    "--change-desc", "Use server-side apply for the large Prometheus CRDs",
  ], { timeout: 300_000 });
  const release = publishRelease(appsSpace);
  refreshApplication(clusterName, appsSpace);
  return {
    unit: `${appsSpace}/${deliverySpace}`,
    serverSideApply: true,
    createNamespace: true,
    appsReleaseDigest: release.manifestDigest,
    reason: "Six Prometheus CRDs exceed the client-side apply annotation limit.",
  };
}

function approveStateForDelivery(applicationName) {
  const space = applicationName;
  return listUnits(space)
    .filter((unit) => ![readmeSlug, routeSlug].includes(unit.Slug))
    .map((unit) => {
      const current = readUnit(space, unit.Slug);
      return {
        unit: unit.Slug,
        revision: Number(current.HeadRevisionNum),
        approvalGateCleared:
          current.ApplyGates?.["platform/require-approval/vet-approvedby"] !== true,
      };
    });
}

function observeRuntime(clusterName) {
  const crds = crdNames.map((name) => {
    kubectl(clusterName, [
      "wait", "--for=condition=Established", "--timeout=180s", `crd/${name}`,
    ], { timeout: 240_000 });
    return { name, established: true };
  });
  for (const [kind, name] of workloads) {
    waitForResource(clusterName, namespace, kind, name);
    kubectl(clusterName, [
      "-n", namespace,
      "rollout", "status", `${kind}/${name}`, "--timeout=600s",
    ], { timeout: 660_000 });
  }
  const admission = kubectlJson(clusterName, [
    "-n", namespace,
    "get", "secret/kube-prometheus-stack-admission", "-o", "json",
  ]);
  const secretKeys = Object.keys(admission.data ?? {}).sort();
  for (const key of ["ca", "cert", "key"]) {
    check(secretKeys.includes(key), `admission Secret is missing ${key}`);
  }
  const bundles = [
    ...webhookBundles(kubectlJson(clusterName, [
      "get", "mutatingwebhookconfiguration/kube-prometheus-stack-admission", "-o", "json",
    ])),
    ...webhookBundles(kubectlJson(clusterName, [
      "get", "validatingwebhookconfiguration/kube-prometheus-stack-admission", "-o", "json",
    ])),
  ];
  check(bundles.length === 3, `expected three webhook CA bundles, found ${bundles.length}`);
  check(
    bundles.every((bundle) => bundle && bundle === admission.data.ca),
    "webhook CA bundles do not match the admission Secret",
  );
  const endpoint = kubectlJson(clusterName, [
    "-n", namespace,
    "get", "endpoints/kube-prometheus-stack-operator", "-o", "json",
  ]);
  const endpointAddresses = (endpoint.subsets ?? [])
    .flatMap((subset) => subset.addresses ?? []).length;
  check(endpointAddresses > 0, "operator endpoint has no ready address");
  const dryRunPath = join(tmpdir(), `kps-confighub-dry-run-${process.pid}.yaml`);
  writeFileSync(dryRunPath, `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kps-confighub-lifecycle-probe
  namespace: monitoring
spec:
  groups:
    - name: kps-confighub-lifecycle-probe
      rules:
        - alert: KpsConfigHubLifecycleProbe
          expr: vector(1)
`);
  try {
    kubectl(clusterName, [
      "apply", "--server-side", "--dry-run=server", "-f", dryRunPath,
    ]);
  } finally {
    rmSync(dryRunPath, { force: true });
  }
  const jobs = [
    "kube-prometheus-stack-admission-create",
    "kube-prometheus-stack-admission-patch",
  ].map((name) => jobCompletion(clusterName, name));
  return {
    crds,
    jobs,
    workloads: workloads.map(([kind, name]) => ({ kind, name, ready: true })),
    admissionSecretKeys: secretKeys.filter((key) => ["ca", "cert", "key"].includes(key)),
    matchingWebhookCABundles: bundles.length,
    operatorEndpointAddresses: endpointAddresses,
    serverDryRun: "pass",
  };
}

function waitForResource(clusterName, resourceNamespace, kind, name) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = kubectlTry(clusterName, [
      "-n", resourceNamespace,
      "get", `${kind}/${name}`, "-o", "name",
    ]);
    if (result.ok && result.output.trim()) return;
    sleep(5000);
  }
  throw new Error(
    `${kind}/${name} did not appear in ${resourceNamespace} within 10 minutes`,
  );
}

function jobCompletion(clusterName, name) {
  const live = kubectlTry(clusterName, [
    "-n", namespace, "get", `job/${name}`, "-o", "json",
  ]);
  if (live.ok) {
    const job = JSON.parse(live.output);
    if (job.status?.succeeded === 1) {
      return {
        name,
        uid: job.metadata.uid,
        succeeded: true,
        retained: true,
        evidence: "completed Job",
      };
    }
  }
  const eventsResult = kubectlTry(clusterName, [
    "-n", namespace,
    "get", "events",
    "--field-selector", `involvedObject.kind=Job,involvedObject.name=${name}`,
    "-o", "json",
  ]);
  check(eventsResult.ok, `could not read completion evidence for ${name}`);
  const events = JSON.parse(eventsResult.output).items ?? [];
  const completed = events
    .filter((event) => event.reason === "Completed" && event.involvedObject?.uid)
    .sort((left, right) => eventTime(left).localeCompare(eventTime(right)))
    .at(-1);
  check(completed, `${name} has neither a completed Job nor a Completed event`);
  return {
    name,
    uid: completed.involvedObject.uid,
    succeeded: true,
    retained: false,
    evidence: "Kubernetes Completed event after Job cleanup",
    completedAt: eventTime(completed),
  };
}

function eventTime(event) {
  return event.eventTime
    ?? event.series?.lastObservedTime
    ?? event.lastTimestamp
    ?? event.metadata?.creationTimestamp
    ?? "";
}

function replaceCompletedHookResources({ clusterName, current, currentJobs }) {
  check(
    currentJobs.length === 2 && currentJobs.every((job) => job.succeeded && job.uid),
    "both setup Jobs need completion evidence before replacement",
  );
  kubectl(clusterName, [
    "-n", namespace, "delete",
    "job/kube-prometheus-stack-admission-create",
    "job/kube-prometheus-stack-admission-patch",
    "--ignore-not-found", "--wait=true",
  ]);
  kubectl(clusterName, [
    "delete", "-f",
    join(current.rawRoot, "stages", "prepare", "hook-support.yaml"),
    "--ignore-not-found", "--wait=true",
  ]);
  return {
    result: "pass",
    action: "removed completed setup Jobs and their temporary support objects before candidate publication",
    before: currentJobs,
  };
}

function lifecycleRoute(receipt) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "LifecycleRoute",
    metadata: {
      name: "kube-prometheus-stack-86-1-0-no-crds-argo-cd-upgrade",
      labels: {
        chart: "prometheus-community-kube-prometheus-stack",
        base,
        lifecyclePhase: "upgrade",
      },
    },
    spec: {
      chart,
      version: candidateVersion,
      base,
      routeName: "upgrade-through-argocd-sync-waves",
      executionMode: "user-executes",
      automatic: false,
      disposition: "observed",
      source: {
        version: currentVersion,
        oci: `${currentArtifact.reference}@${currentArtifact.digest}`,
        objectSetSha256: receipt.spec.source.current.materializedObjectSetSha256,
      },
      candidate: {
        version: candidateVersion,
        oci: `${candidateArtifact.reference}@${candidateArtifact.digest}`,
        objectSetSha256: receipt.spec.source.candidate.materializedObjectSetSha256,
      },
      destination: {
        runtime: "Argo CD",
        type: "kind proof cluster",
      },
      work: [
        "Supply the target-owned Alertmanager and Grafana Secrets.",
        "Preserve the chart's monitoring and kube-system namespaces; do not apply one namespace override to every object.",
        "Apply and establish ten CRDs before dependent custom resources.",
        "Use server-side apply because six Prometheus CRDs exceed the client-side apply annotation limit.",
        "Remove the two completed setup Jobs and their temporary support objects before replacement.",
        "Let Argo CD apply sync waves -3, -2, -1, 0, and 1.",
        "Check both Jobs, webhook certificates, six workloads, the operator endpoint, and a server-side dry run.",
      ],
      whoRuns: "The destination owner supplies Secrets and removes completed setup Jobs; Argo CD applies the ordered objects; the proof runner records the checks.",
      evidence: [
        "runs/kps-gitops-lifecycle-proof/receipt.yaml",
        "runs/kps-confighub-lifecycle-promotion/receipt.yaml",
        candidateResolutionPath,
      ],
    },
  };
}

function refreshApplication(clusterName, applicationName) {
  kubectlTry(clusterName, [
    "annotate", "application", applicationName,
    "-n", "argocd",
    "argocd.argoproj.io/refresh=hard", "--overwrite",
  ]);
}

function clusterUp(name) {
  const result = spawnSync(
    "cub",
    ["cluster", "up", "--name", name, "--no-ports", "--no-argobot"],
    {
      cwd: repoRoot,
      env: cubEnv(),
      encoding: "utf8",
      stdio: ["ignore", "ignore", "pipe"],
      timeout: 900_000,
      maxBuffer: 1024 * 1024 * 50,
    },
  );
  check(result.status === 0, `cub cluster up failed: ${sanitizeError(result.stderr)}`);
  check(clusterPresent(name), `cub cluster up did not create ${name}`);
  check(spacePresent(name), `cub cluster up did not create Space ${name}`);
  check(spacePresent(`${name}-argo-apps`), `cub cluster up did not create ${name}-argo-apps`);
  check(
    cubTry(["target", "get", "target", "--space", name, "-o", "json"]).ok,
    `cub cluster up did not create ${name}/target`,
  );
}

function clusterDown(name) {
  cubTry([
    "cluster", "down", "--name", name, "--delete-config", "--force",
  ], { timeout: 600_000, inherit: true });
  if (clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
      inherit: true,
    });
  }
  for (const space of [`${name}-delivery`, `${name}-argo-apps`, name]) {
    if (spacePresent(space)) deleteSpace(space);
  }
}

function replacePersistentSpace(space) {
  if (!spacePresent(space)) return;
  const entity = cubJson(["space", "get", space, "-o", "json"]).Space;
  check(
    entity.Labels?.Proof === proofLabel,
    `refusing to replace existing Space ${space} without Proof=${proofLabel}`,
  );
  check(deleteSpace(space), `could not replace ${space}`);
}

function deleteSpace(space) {
  if (!spacePresent(space)) return true;
  cubTry(["space", "delete", space, "--recursive-force", "--quiet"], {
    timeout: 300_000,
  });
  return !spacePresent(space);
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "KubePrometheusStackConfigHubLifecyclePromotionReceipt",
    "receipt kind is wrong",
  );
  check(receipt.status?.result === "pass", "live promotion receipt is not pass");
  check(receipt.spec?.source?.chart === chart, "receipt chart is wrong");
  check(receipt.spec?.source?.base === base, "receipt base is wrong");
  check(receipt.spec?.comparison?.result === "pass", "object comparison did not pass");
  check(receipt.spec.comparison.currentObjects === 130, "current object count changed");
  check(receipt.spec.comparison.candidateObjects === 130, "candidate object count changed");
  check(receipt.spec.configHub?.promotion?.result === "pass", "promotion did not pass");
  check(receipt.spec.configHub?.route?.result === "pass", "route did not pass");
  check(receipt.spec.configHub?.approvals?.result === "pass", "approvals did not pass");
  check(receipt.spec.configHub?.releases?.result === "pass", "release publication did not pass");
  check(receipt.spec.delivery?.current?.result === "pass", "current delivery did not pass");
  check(receipt.spec.delivery?.candidate?.result === "pass", "candidate delivery did not pass");
  check(
    receipt.spec.delivery.candidate.runtime.crds.length === 10
      && receipt.spec.delivery.candidate.runtime.workloads.length === 6
      && receipt.spec.delivery.candidate.runtime.jobs.length === 2
      && receipt.spec.delivery.candidate.runtime.matchingWebhookCABundles === 3
      && receipt.spec.delivery.candidate.runtime.serverDryRun === "pass",
    "candidate runtime checks are incomplete",
  );
  check(
    receipt.spec.cleanup.cluster === "pass"
      && receipt.spec.cleanup.deliverySpace === "pass"
      && receipt.spec.cleanup.localFiles === "pass",
    "live proof cleanup is incomplete",
  );
  for (const path of [sourceProofPath, join(repoRoot, candidateResolutionPath)]) {
    check(existsSync(path), `${relativeRepo(path)} is missing`);
  }
}

function generateDerived(receipt) {
  write(summaryPath, renderSummary(receipt));
  writeYaml(lifecycleRoutePath, lifecycleRoute(receipt));
  writeYaml(promotionReviewPath, promotionReview(receipt));
}

function verifyGenerated(receipt) {
  const expectedSummary = renderSummary(receipt);
  check(
    existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === expectedSummary,
    `${relativeRepo(summaryPath)} is stale`,
  );
  check(
    existsSync(lifecycleRoutePath)
      && readFileSync(lifecycleRoutePath, "utf8") === serializeYaml(lifecycleRoute(receipt)),
    `${relativeRepo(lifecycleRoutePath)} is stale`,
  );
  check(
    existsSync(promotionReviewPath)
      && readFileSync(promotionReviewPath, "utf8") === serializeYaml(promotionReview(receipt)),
    `${relativeRepo(promotionReviewPath)} is stale`,
  );
}

function verifyHub(receipt) {
  assertContext();
  const baseState = inspectSpace(baseSpace);
  const stagingState = inspectSpace(stagingSpace);
  check(
    baseState.id === receipt.spec.configHub.base.id
      && baseState.objectSetSha256 === receipt.spec.configHub.base.objectSetSha256,
    "retained ConfigHub base differs from the receipt",
  );
  check(
    stagingState.id === receipt.spec.configHub.staging.id
      && stagingState.objectSetSha256 === receipt.spec.configHub.staging.objectSetSha256,
    "retained ConfigHub staging variant differs from the receipt",
  );
  check(
    listUnits(stagingSpace).filter((unit) => unit.Slug === readmeSlug).length === 1
      && listUnits(stagingSpace).filter((unit) => unit.Slug === routeSlug).length === 1,
    "staging must contain one README and one lifecycle route",
  );
}

function promotionReview(receipt) {
  const comparison = receipt.spec.comparison;
  const current = receipt.spec.source.current;
  const candidate = receipt.spec.source.candidate;
  return {
    apiVersion: "workshop.confighub.com/v1alpha2",
    kind: "PromotionReview",
    metadata: { createdAt: receipt.spec.observedAt },
    spec: {
      change: {
        source: chart,
        base,
        fromVersion: currentVersion,
        toVersion: candidateVersion,
        decision: "promoted",
      },
      current: {
        name: `${chart}@${currentVersion}/${base}`,
        sha256: `sha256:${current.materializedObjectSetSha256}`,
        objectCount: current.materializedObjectCount,
        objects: [],
      },
      candidate: {
        name: `${chart}@${candidateVersion}/${base}`,
        sha256: `sha256:${candidate.materializedObjectSetSha256}`,
        objectCount: candidate.materializedObjectCount,
        objects: [],
      },
      comparison: {
        added: comparison.added,
        removed: comparison.removed,
        changed: comparison.changed,
        unchanged: comparison.unchanged,
      },
      sourceAware: {
        class: "upstream-version-change",
        currentOci: `${current.reference}@${current.digest}`,
        candidateOci: `${candidate.reference}@${candidate.digest}`,
        localOverride: "none in this proof",
      },
      lifecycle: {
        route: relativeRepo(lifecycleRoutePath),
        crds: 10,
        setupJobs: 2,
        targetOwnedSecrets: 2,
        namespaceHandling: "preserve-source-namespaces",
        automatic: false,
      },
      destinationPreflight: {
        destinations: ["kind proof cluster"],
        namespaces: ["kube-system", "monitoring"],
        namespaceHandling: "preserve-source-namespaces",
        prerequisites: {
          recorded: 12,
          names: ["10 Prometheus CRDs", "Alertmanager Secret", "Grafana Secret"],
        },
        lifecycleResolution: {
          status: "observed",
          records: [candidateResolutionPath, relativeRepo(lifecycleRoutePath)],
          routeCount: 1,
        },
        delivery: {
          runtime: "Argo CD",
          status: "pass",
          options: ["ServerSideApply=true"],
        },
        checks: [
          {
            id: "source-namespaces",
            status: "pass",
            note: "The exact target-bound object digest preserved five Services in kube-system and the remaining namespaced objects in monitoring.",
            evidence: ["runs/kps-confighub-lifecycle-promotion/receipt.yaml"],
          },
          {
            id: "target-prerequisites",
            status: "pass",
            note: "The target supplied the two Secrets from the checked render and established all ten CRDs.",
            evidence: ["runs/kps-confighub-lifecycle-promotion/receipt.yaml"],
          },
          {
            id: "lifecycle-route",
            status: "pass",
            note: "The destination-specific route replaced completed setup Jobs and checked webhook certificate handoff after the final staging variant existed.",
            evidence: [relativeRepo(lifecycleRoutePath), "runs/kps-confighub-lifecycle-promotion/receipt.yaml"],
          },
          {
            id: "delivery-mechanics",
            status: "pass",
            note: "Argo CD used server-side apply for the large CRDs and reconciled the exact current and candidate release digests.",
            evidence: ["runs/kps-confighub-lifecycle-promotion/receipt.yaml"],
          },
        ],
      },
      targets: {
        controller: "Argo CD",
        testedTargets: 1,
        current: "pass",
        candidate: "pass",
      },
      browserChecks: {
        run: false,
        reason: "This record comes from the live ConfigHub and Argo CD proof, not the browser comparison.",
      },
      testsRequired: [
        "Keep the five kube-system Services in kube-system instead of applying one namespace to every object.",
        "Establish all ten CRDs before dependent custom resources.",
        "Replace both completed setup Jobs before the candidate sync.",
        "Check webhook certificate handoff, six workloads, the operator endpoint, and server admission.",
      ],
      nextAction: "Keep the staging variant and route record; rerun the destination checks before another chart, target, or controller version is promoted.",
      configHubPlan: {
        chain: receipt.spec.configHub.promotion.chain,
        currentRelease: receipt.spec.configHub.releases.current.manifestDigest,
        candidateRelease: receipt.spec.configHub.releases.candidate.manifestDigest,
        approvalRequired: true,
      },
    },
  };
}

function renderSummary(receipt) {
  const comparison = receipt.spec.comparison;
  const releases = receipt.spec.configHub.releases;
  return `# Kube Prometheus Stack promotion through ConfigHub

This example answers one practical question: can the checked
\`${currentVersion}\` \`${base}\` configuration move to \`${candidateVersion}\`
without losing the chart-specific CRD and admission setup work?

The answer for this exact version pair and test destination is **yes**.
ConfigHub retained the current object set, showed the candidate changes,
promoted the candidate through staging, required approval, stored the route,
published a new OCI release, and Argo CD completed the ordered work.

## What changed

| Check | Result |
| --- | --- |
| Current objects | ${comparison.currentObjects} |
| Candidate objects | ${comparison.candidateObjects} |
| Added | ${comparison.added} |
| Removed | ${comparison.removed} |
| Changed | ${comparison.changed} |
| Unchanged | ${comparison.unchanged} |

## What ConfigHub retained

| Stage | Space | Result |
| --- | --- | --- |
| Base | \`${baseSpace}\` | Exact candidate objects and source OCI digest |
| Staging | \`${stagingSpace}\` | Promoted candidate, README, route, and approval |
| Delivery | Temporary target-bound variant | Two immutable release digests and the Argo CD result |

The current release was \`${releases.current.manifestDigest}\`. The candidate
release was \`${releases.candidate.manifestDigest}\`.

## Lifecycle work

- The destination supplied the two Secrets from the checked chart render. Their values are not in the release OCI or this receipt.
- The target-bound variant preserved the chart's \`monitoring\` and \`kube-system\` namespaces. A global namespace override would have moved five Services incorrectly.
- Argo CD established ten CRDs before the chart's custom resources.
- The retained Argo Application used server-side apply for the large CRDs.
- The proof runner removed the two completed admission setup Jobs before replacement.
- Argo CD then applied the recorded sync waves and reran both Jobs.
- The proof checked three matching webhook CA bundles, six ready workloads, a ready operator endpoint, and one server-side dry run.

The route is recorded as \`automatic: false\`. ConfigHub keeps and checks the
decision, but a person or automation still starts the Job replacement step. A different
chart version, Kubernetes target, or delivery controller needs another route
resolution and another test.

## Open the records

- [Promotion review](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml)
- [Lifecycle route](../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml)
- [Destination resolution](../lifecycle-route-resolutions/kube-prometheus-stack-86-1-0-no-crds-argo-cd.yaml)
- [Earlier Argo CD and Flux staged-OCI proof](../../runs/kps-gitops-lifecycle-proof/receipt.yaml)
- [Live receipt](../../runs/kps-confighub-lifecycle-promotion/receipt.yaml)

## Limits

${receipt.spec.limits.map((item) => `- ${item}`).join("\n")}
`;
}

function artifactRecord(version, artifact) {
  return {
    version,
    reference: artifact.reference,
    digest: artifact.digest,
    anonymousPull: artifact.anonymousPull,
    containsSecrets: artifact.containsSecrets,
    stagedObjects: artifact.totalObjects,
    stages: artifact.stages.map((stage) => ({
      name: stage.name,
      objectCount: stage.objectCount,
    })),
  };
}

function readUnit(space, slug) {
  return cubJson(["unit", "get", "--space", space, slug, "-o", "json"]).Unit;
}

function listUnits(space) {
  return cubJson(["unit", "list", "--space", space, "-o", "json"])
    .map((item) => item.Unit ?? item);
}

function objectSetDigest(docs) {
  return createHash("sha256")
    .update(docs
      .slice()
      .sort((left, right) => identityFor(left).localeCompare(identityFor(right)))
      .map((doc) => JSON.stringify(doc))
      .join("\n"))
    .digest("hex");
}

function webhookBundles(object) {
  return (object.webhooks ?? []).map((webhook) =>
    webhook.clientConfig?.caBundle ?? "");
}

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[0-9a-f]{64}/);
  return match?.[0] ?? "";
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

function liveParityRunning() {
  const result = tryCommand("pgrep", ["-f", "tests/live-helm-confighub-parity-test"]);
  return result.ok && result.output
    .split(/\r?\n/)
    .filter(Boolean)
    .some((pid) => Number(pid) !== process.pid);
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

function kubectl(clusterName, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig", clusterKubeconfig(clusterName),
    "--context", `kind-${clusterName}`,
    ...args,
  ], options);
}

function kubectlTry(clusterName, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig", clusterKubeconfig(clusterName),
    "--context", `kind-${clusterName}`,
    ...args,
  ], options);
}

function kubectlJson(clusterName, args) {
  return JSON.parse(kubectl(clusterName, args));
}

function cub(args, options = {}) {
  return command("cub", args, { ...options, env: cubEnv() });
}

function cubTry(args, options = {}) {
  return tryCommand("cub", args, { ...options, env: cubEnv() });
}

function cubJson(args, options = {}) {
  return JSON.parse(cub(args, options));
}

function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
    stdio: options.inherit ? "inherit" : ["pipe", "pipe", "pipe"],
    timeout: options.timeout ?? 300_000,
    maxBuffer: 1024 * 1024 * 200,
  });
  check(
    result.status === 0,
    `${cmd} ${args.join(" ")} failed: ${sanitizeError(result.stderr || result.stdout)}`,
  );
  if (options.transformOutput) return options.transformOutput(result.stdout);
  return result.stdout ?? "";
}

function tryCommand(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    input: options.input,
    stdio: options.inherit ? "inherit" : ["pipe", "pipe", "pipe"],
    timeout: options.timeout ?? 300_000,
    maxBuffer: 1024 * 1024 * 200,
  });
  return {
    ok: result.status === 0,
    output: result.stdout ?? "",
    error: result.stderr ?? "",
  };
}

function sanitizeError(value) {
  return String(value ?? "")
    .replaceAll(repoRoot, "<repo>")
    .replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s"']+/g, "<tmp>")
    .trim()
    .slice(0, 4000);
}

function sleep(milliseconds) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}
