#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const allowedModes = new Set(["--run", "--generate", "--verify"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-sveltos-oci-delivery-proof.mjs --run
  node scripts/run-sveltos-oci-delivery-proof.mjs --generate
  node scripts/run-sveltos-oci-delivery-proof.mjs --verify`);
  process.exit(2);
}

const expectedPolicyOrg = "helm-catalog";
const approvalFilterRef = "platform/helm-catalog-prod-gates";
const approvalGate = "platform/require-approval/vet-approvedby";
const catalogOciTargetRef =
  "bitnami-redis-27-0-0-stage-pilot-live-20260705/oci-target";
const expectedTriggers = [
  "platform/digest-pinned-images",
  "platform/lifecycle-route-evidence",
  "platform/probes-declared",
  "platform/require-approval",
  "platform/vet-placeholders",
  "platform/vet-schemas",
];
const configHubOciHost = "oci.hub.confighub.com:443";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
const sourceRoot = join(repoRoot, "examples", "sveltos", "kyverno-fleet");
const profilePath = join(sourceRoot, "clusterprofile.yaml");
const sourceLockPath = join(sourceRoot, "source-lock.yaml");
const receiptPath = join(
  repoRoot,
  "runs",
  "sveltos-oci-delivery-proof",
  "receipt.yaml",
);
const summaryPath = join(
  repoRoot,
  "data",
  "sveltos-oci-delivery-proof",
  "summary.md",
);
const profileName = "kyverno-staging";
const policyUnit = "clusterprofile";
const registrationNamespace = "projectsveltos";
const sveltosManifestUrl =
  "https://raw.githubusercontent.com/projectsveltos/sveltos/v1.12.0/manifest/manifest.yaml";

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else {
  check(
    existsSync(receiptPath),
    `${relativeRepo(receiptPath)} is missing; run the live proof`,
  );
  check(
    existsSync(summaryPath),
    `${relativeRepo(summaryPath)} is missing; run the generator`,
  );
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt);
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale`,
  );
  console.log("verified the Sveltos OCI delivery proof");
}

function run() {
  const policyContext = process.env.CUB_CONTEXT?.trim() ?? "";
  const clusterContext =
    process.env.SVELTOS_CLUSTER_CONTEXT?.trim() ?? "";
  check(
    process.env.HELM_EXPT_ALLOW_LIVE_SVELTOS_OCI_PROOF === "1",
    "set HELM_EXPT_ALLOW_LIVE_SVELTOS_OCI_PROOF=1 to confirm this live proof",
  );
  check(
    process.env.HELM_EXPT_ALLOW_SCRATCH_ORG === "1",
    "set HELM_EXPT_ALLOW_SCRATCH_ORG=1 to confirm the temporary cluster org",
  );
  check(policyContext, "set CUB_CONTEXT to an authenticated helm-catalog context");
  check(
    clusterContext,
    "set SVELTOS_CLUSTER_CONTEXT to an authenticated scratch context",
  );
  check(
    policyContext !== clusterContext,
    "use separate maintained-policy and scratch-cluster contexts",
  );
  for (const [tool, args] of [
    ["cub", ["version"]],
    ["curl", ["--version"]],
    ["docker", ["version"]],
    ["helm", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["tar", ["--version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for this proof`);
  }

  const policyContextInfo = cubJson(policyContext, [
    "context",
    "get",
    policyContext,
    "-o",
    "json",
  ]);
  const clusterContextInfo = cubJson(clusterContext, [
    "context",
    "get",
    clusterContext,
    "-o",
    "json",
  ]);
  check(
    policyContextInfo.metadata?.organizationName === expectedPolicyOrg,
    `refusing to create policy evidence outside ${expectedPolicyOrg}`,
  );
  check(
    clusterContextInfo.metadata?.organizationName
      && clusterContextInfo.metadata.organizationName !== expectedPolicyOrg,
    "the temporary clusters must use a scratch organization",
  );

  const sourceText = readFileSync(profilePath, "utf8");
  const sourceDocs = parseDocs(sourceText);
  check(sourceDocs.length === 1, "the Sveltos source must contain one object");
  check(
    sourceDocs[0].kind === "ClusterProfile"
      && sourceDocs[0].metadata?.name === profileName,
    "the Sveltos source identity changed",
  );
  const sourceLock = readYaml(sourceLockPath);
  const expectedManifestSha =
    sourceLock.spec?.sveltos?.manifestSha256;
  check(expectedManifestSha, "the Sveltos manifest lock is missing");

  const topology = readApprovalTopology(policyContext);
  const catalogTarget = cubJson(policyContext, [
    "target",
    "get",
    "--space",
    ...catalogOciTargetRef.split("/"),
    "-o",
    "json",
  ]).Target;
  check(
    catalogTarget?.ProviderType === "OCI",
    `${catalogOciTargetRef} is not an OCI target`,
  );

  const recordedAt = new Date().toISOString();
  const runId = safeRunId(
    process.env.HELM_EXPT_PROOF_RUN_ID || recordedAt,
  );
  const policySpace = `hx-sveltos-${runId}`;
  const managementName = `hx-sveltos-mgmt-${runId}`;
  const managementSpace = `${managementName}-cluster`;
  const workloadName = `hx-sveltos-work-${runId}`;
  const applicationName = `sveltos-profile-${runId}`;
  const applicationUnit = "sveltos-profile-application";
  const registryName = `hx-sveltos-registry-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-sveltos-oci-"));
  const workloadKubeconfig = join(workRoot, "workload.kubeconfig");
  const cleanup = {
    policySpace: "not-created",
    managementCluster: "not-created",
    managementSpace: "not-created",
    workloadCluster: "not-created",
    registry: "not-created",
    localFiles: "pending",
  };
  let policySpaceCreated = false;
  let managementStarted = false;
  let workloadStarted = false;
  let registryStarted = false;
  let receipt;

  try {
    phase("preflight complete");
    check(
      !spacePresent(policyContext, policySpace),
      `refusing to reuse ${policySpace}`,
    );
    check(
      !spacePresent(clusterContext, managementSpace),
      `refusing to reuse ${managementSpace}`,
    );
    check(
      !clusterPresent(managementName) && !clusterPresent(workloadName),
      "refusing to reuse an existing kind cluster",
    );
    check(
      !dockerContainerPresent(registryName),
      `refusing to reuse ${registryName}`,
    );

    const registry = startRegistry(registryName);
    registryStarted = true;
    cleanup.registry = "pending";
    phase("temporary OCI registry ready");

    clusterUp(clusterContext, managementName);
    managementStarted = true;
    cleanup.managementCluster = "pending";
    cleanup.managementSpace = "pending";
    phase("management cluster ready");

    createWorkloadCluster(workloadName, workloadKubeconfig);
    workloadStarted = true;
    cleanup.workloadCluster = "pending";
    phase("workload cluster ready");

    const sveltosInstall = installSveltos({
      managementName,
      workRoot,
      expectedManifestSha,
    });
    phase("Sveltos controllers converged");
    const registration = registerWorkload({
      managementName,
      workloadName,
      workloadKubeconfig,
      workRoot,
    });
    phase("workload cluster registered");

    createPolicySpace(policyContext, policySpace);
    policySpaceCreated = true;
    cleanup.policySpace = "pending";
    assertPolicySpace(
      policyContext,
      policySpace,
      topology.triggerIds,
      catalogTarget.TargetID,
    );
    cub(policyContext, [
      "unit",
      "create",
      "--space",
      policySpace,
      policyUnit,
      profilePath,
      "--target",
      catalogOciTargetRef,
      "--label",
      "App=sveltos-kyverno-fleet",
      "--label",
      "Proof=sveltos-oci-delivery",
      "--change-desc",
      "Store the reviewed Sveltos ClusterProfile",
      "--quiet",
    ]);
    const stored = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      true,
    );
    check(
      canonicalDocs(parseDocs(storedData(stored)))
        === canonicalDocs(sourceDocs),
      "ConfigHub stored a different ClusterProfile",
    );
    const blocked = blockedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    cub(policyContext, [
      "unit",
      "approve",
      "--space",
      policySpace,
      policyUnit,
      "--revision",
      "HeadRevisionNum",
      "--wait",
      "--quiet",
    ]);
    const approved = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      false,
    );
    check(
      approved.ContentHash === stored.ContentHash,
      "approval changed the ClusterProfile content",
    );
    const approvalCountValue = approvalCount(approved.ApprovedBy);
    check(approvalCountValue >= 1, "the ClusterProfile has no approval");
    const allowed = allowedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    const privateRelease = publishRelease(policyContext, policySpace);
    phase("ConfigHub review, approval, and private release passed");
    const approvedText = storedData(approved);
    const portableRelease = publishPortableOci({
      workRoot,
      approvedText,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
    });
    phase("portable OCI pushed, pulled, and compared");

    const application = addApplication({
      context: clusterContext,
      managementName,
      managementSpace,
      applicationName,
      applicationUnit,
      policySpace,
      sourceReference: portableRelease.clusterReference,
      anonymousOciHost: registry.clusterHost,
      workRoot,
    });
    const argo = waitForApplication({
      managementName,
      applicationName,
      expectedRevision: portableRelease.manifestDigest,
    });
    check(
      argo.result === "pass",
      `${applicationName} did not reconcile: ${argo.reason ?? "unknown"}`,
    );
    phase("Argo CD reconciled the portable OCI digest");
    const liveProfile = JSON.parse(
      managementCommand(managementName, [
        "get",
        "clusterprofile",
        profileName,
        "-o",
        "json",
      ]).output,
    );
    const approvedFieldsMatchLive = sourceFieldsMatchLive(
      sourceDocs[0],
      liveProfile,
    );
    const liveAddedFieldPaths = addedFieldPaths(
      sourceDocs[0],
      liveProfile,
    );
    check(
      approvedFieldsMatchLive,
      "a field from the approved ClusterProfile changed in the live object",
    );

    const reconciliation = waitForKyverno({
      managementName,
      workloadName,
      workloadKubeconfig,
    });
    check(
      reconciliation.result === "pass",
      `Sveltos did not install Kyverno: ${reconciliation.reason ?? "unknown"}`,
    );
    phase("Sveltos installed Kyverno on the selected workload cluster");
    const drift = runDriftTest(workloadKubeconfig);
    check(drift.result === "pass", "Sveltos did not repair the replica drift");
    phase("Sveltos repaired the replica drift");

    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "SveltosOciDeliveryProofReceipt",
      metadata: {
        name: "kyverno-staging-oci-delivery",
      },
      spec: {
        recordedAt,
        flow: {
          path: "source -> ConfigHub review -> local work -> OCI -> Argo CD -> Sveltos -> Kubernetes",
          portableShape: "work -> OCI",
          access: {
            configHubReview: "ConfigHub account and server required",
            portablePackaging: "local command; no ConfigHub Server required",
            portablePull: "anonymous; no ConfigHub account required",
          },
        },
        source: {
          profile: relativeRepo(profilePath),
          sourceLock: relativeRepo(sourceLockPath),
          rawSha256: sha256(sourceText),
          canonicalSha256: sha256(canonicalDocs(sourceDocs)),
        },
        prerequisite: sveltosInstall,
        configHubReview: {
          organization: expectedPolicyOrg,
          space: policySpace,
          unit: policyUnit,
          unitId: stored.UnitID,
          contentHash: stored.ContentHash,
          target: {
            ref: catalogOciTargetRef,
            id: catalogTarget.TargetID,
            provider: catalogTarget.ProviderType,
          },
          policy: {
            profile: "catalog-standard",
            resourceClass: "system-configuration",
            filter: topology,
            approvalGate,
          },
          beforeApproval: blocked,
          approval: {
            revision: approved.HeadRevisionNum,
            recordedApprovals: approvalCountValue,
            approverIdentityRecordedInReceipt: false,
            contentHashUnchanged: true,
          },
          afterApproval: allowed,
          approvedDataMatchesSource: true,
          privateRelease,
          portableRelease,
        },
        management: {
          organization: clusterContextInfo.metadata.organizationName,
          cluster: managementName,
          creationCommand: "cub cluster up",
          registration,
          delivery: {
            source: "approved ConfigHub Unit data",
            applicationDelivery: "ConfigHub cluster Space release OCI",
            workloadDelivery: "temporary portable OCI",
            portablePackaging: "scripted from the approved Unit data",
            application,
            argo,
            approvedFieldsMatchLive,
            liveAddedFieldPaths,
          },
          reconciliation,
        },
        workload: {
          cluster: workloadName,
          creationCommand: "kind create cluster",
          drift,
        },
        cleanup,
        limits: [
          "The pinned Sveltos controllers were installed directly as a prerequisite on the throwaway management cluster.",
          "The reviewed ClusterProfile, not the Sveltos controller installation, was delivered through ConfigHub, OCI, and Argo CD.",
          "The portable OCI used a temporary anonymous registry; this is not a permanent public package.",
          "The proof used one staging workload cluster. It does not prove a multi-cluster promotion wave.",
          "The proof covers this Kyverno ClusterProfile, not every Sveltos feature or add-on.",
        ],
      },
      status: {
        result: "pass",
        claim: "ConfigHub stored and approved one Sveltos ClusterProfile, published its private release, and delivered a portable OCI containing the approved object through Argo CD. Every approved field kept its value after admission. Sveltos selected one staging workload cluster, installed Kyverno 3.8.1, and restored a changed replica count.",
      },
    };
  } finally {
    phase("cleaning up temporary resources");
    if (managementStarted || clusterPresent(managementName)) {
      managementTry(managementName, [
        "delete",
        "application",
        applicationName,
        "-n",
        "argocd",
        "--wait=false",
      ]);
      clusterDown(clusterContext, managementName);
    }
    cleanup.managementCluster = clusterPresent(managementName)
      ? "fail"
      : "pass";
    cleanup.managementSpace = spacePresent(clusterContext, managementSpace)
      ? "fail"
      : "pass";

    if (workloadStarted || clusterPresent(workloadName)) {
      tryCommand("kind", ["delete", "cluster", "--name", workloadName], {
        timeout: 180_000,
      });
    }
    cleanup.workloadCluster = clusterPresent(workloadName) ? "fail" : "pass";

    if (policySpaceCreated || spacePresent(policyContext, policySpace)) {
      cubTry(policyContext, [
        "space",
        "delete",
        policySpace,
        "--recursive-force",
        "--quiet",
      ], { timeout: 240_000 });
    }
    cleanup.policySpace = spacePresent(policyContext, policySpace)
      ? "fail"
      : "pass";

    if (registryStarted || dockerContainerPresent(registryName)) {
      tryCommand("docker", ["rm", "-f", registryName], {
        timeout: 120_000,
      });
    }
    cleanup.registry = dockerContainerPresent(registryName) ? "fail" : "pass";

    rmSync(workRoot, { recursive: true, force: true });
    cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
  }

  check(receipt, "the Sveltos OCI delivery proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `Sveltos proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`,
  );
}

function installSveltos({
  managementName,
  workRoot,
  expectedManifestSha,
}) {
  const manifestPath = join(workRoot, "sveltos-manifest.yaml");
  command("curl", ["-fsSL", sveltosManifestUrl, "-o", manifestPath], {
    timeout: 180_000,
  });
  const manifestText = readFileSync(manifestPath, "utf8");
  check(
    sha256(manifestText) === expectedManifestSha,
    "the downloaded Sveltos manifest differs from the source lock",
  );
  const documents = parseDocs(manifestText);
  const serviceMonitors = documents.filter(
    (document) =>
      document.apiVersion === "monitoring.coreos.com/v1"
      && document.kind === "ServiceMonitor",
  );
  const crds = documents.filter(
    (document) =>
      document.apiVersion === "apiextensions.k8s.io/v1"
      && document.kind === "CustomResourceDefinition",
  );
  const resources = documents.filter(
    (document) =>
      !serviceMonitors.includes(document)
      && !crds.includes(document),
  );
  check(crds.length > 0, "the Sveltos manifest contains no CRDs");
  check(resources.length > 0, "the Sveltos manifest contains no resources");
  const crdPath = join(workRoot, "sveltos-crds.yaml");
  const resourcePath = join(workRoot, "sveltos-resources.yaml");
  writeDocuments(crdPath, crds);
  writeDocuments(resourcePath, resources);
  managementCommand(managementName, ["apply", "-f", crdPath], {
    timeout: 300_000,
  });
  for (const crd of crds) {
    managementCommand(managementName, [
      "wait",
      "--for=condition=Established",
      `crd/${crd.metadata.name}`,
      "--timeout=180s",
    ], { timeout: 240_000 });
  }
  managementCommand(managementName, ["apply", "-f", resourcePath], {
    timeout: 420_000,
  });
  managementCommand(managementName, [
    "-n",
    registrationNamespace,
    "wait",
    "--for=condition=Available",
    "deployment",
    "--all",
    "--timeout=420s",
  ], { timeout: 480_000 });
  const deployments = waitForExactDeployments({
    managementName,
    namespace: registrationNamespace,
    timeoutAttempts: 120,
    pollSeconds: 3,
  });
  check(
    deployments.length > 0,
    "the Sveltos management namespace contains no deployments",
  );
  return {
    source: sveltosManifestUrl,
    version: "v1.12.0",
    manifestSha256: expectedManifestSha,
    objectCount: documents.length,
    crdCount: crds.length,
    appliedObjectCount: crds.length + resources.length,
    omittedOptionalServiceMonitorCount: serviceMonitors.length,
    deployments,
    installationMethod: "pinned manifest applied as a management-cluster prerequisite",
  };
}

function waitForExactDeployments({
  managementName,
  namespace,
  timeoutAttempts,
  pollSeconds,
}) {
  let deployments = [];
  for (let attempt = 0; attempt < timeoutAttempts; attempt += 1) {
    deployments = JSON.parse(
      managementCommand(managementName, [
        "-n",
        namespace,
        "get",
        "deployments",
        "-o",
        "json",
      ]).output,
    ).items.map((deployment) => ({
      name: deployment.metadata.name,
      desired: Number(deployment.spec?.replicas ?? 0),
      updated: Number(deployment.status?.updatedReplicas ?? 0),
      ready: Number(deployment.status?.readyReplicas ?? 0),
      available: Number(deployment.status?.availableReplicas ?? 0),
      observedGenerationMatches:
        deployment.status?.observedGeneration === deployment.metadata?.generation,
    })).sort((left, right) => left.name.localeCompare(right.name));
    if (
      deployments.length > 0
      && deployments.every(
        (deployment) =>
          deployment.desired === deployment.updated
          && deployment.desired === deployment.ready
          && deployment.desired === deployment.available
          && deployment.observedGenerationMatches,
      )
    ) {
      return deployments;
    }
    sleep(pollSeconds * 1000);
  }
  throw new Error(
    `Sveltos management deployments did not converge: ${
      JSON.stringify(deployments)
    }`,
  );
}

function createWorkloadCluster(name, kubeconfigPath) {
  command("kind", [
    "create",
    "cluster",
    "--name",
    name,
    "--kubeconfig",
    kubeconfigPath,
    "--wait",
    "180s",
  ], { timeout: 420_000 });
}

function registerWorkload({
  managementName,
  workloadName,
  workloadKubeconfig,
  workRoot,
}) {
  const serviceAccountPath = join(workRoot, "sveltos-workload-access.yaml");
  writeFileSync(serviceAccountPath, `apiVersion: v1
kind: Namespace
metadata:
  name: ${registrationNamespace}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sveltos-manager
  namespace: ${registrationNamespace}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: sveltos-manager
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: sveltos-manager
    namespace: ${registrationNamespace}
`, { mode: 0o600 });
  workloadCommand(workloadKubeconfig, ["apply", "-f", serviceAccountPath]);
  const token = workloadCommand(workloadKubeconfig, [
    "-n",
    registrationNamespace,
    "create",
    "token",
    "sveltos-manager",
    "--duration=2h",
  ]).output.trim();
  check(token.length > 40, "Kubernetes returned no registration token");
  const workloadConfig = JSON.parse(
    workloadCommand(workloadKubeconfig, [
      "config",
      "view",
      "--raw",
      "-o",
      "json",
    ]).output,
  );
  const cluster = workloadConfig.clusters?.[0]?.cluster;
  check(
    cluster?.["certificate-authority-data"],
    "the workload kubeconfig contains no certificate authority",
  );
  const registeredKubeconfig = `apiVersion: v1
kind: Config
clusters:
  - name: workload
    cluster:
      server: https://${workloadName}-control-plane:6443
      certificate-authority-data: ${cluster["certificate-authority-data"]}
users:
  - name: sveltos-manager
    user:
      token: ${token}
contexts:
  - name: workload
    context:
      cluster: workload
      user: sveltos-manager
current-context: workload
`;
  const registrationPath = join(workRoot, "sveltos-registration.yaml");
  writeFileSync(registrationPath, `apiVersion: v1
kind: Secret
metadata:
  name: ${workloadName}-sveltos-kubeconfig
  namespace: ${registrationNamespace}
type: Opaque
data:
  kubeconfig: ${Buffer.from(registeredKubeconfig).toString("base64")}
---
apiVersion: lib.projectsveltos.io/v1beta1
kind: SveltosCluster
metadata:
  name: ${workloadName}
  namespace: ${registrationNamespace}
  labels:
    environment: staging
    sveltos-agent: present
spec: {}
`, { mode: 0o600 });
  managementCommand(managementName, ["apply", "-f", registrationPath]);
  const observed = waitForRegistration(managementName, workloadName);
  check(
    observed.ready,
    `Sveltos did not register ${workloadName}: ${observed.reason}`,
  );
  return {
    method: "programmatic SveltosCluster registration",
    namespace: registrationNamespace,
    cluster: workloadName,
    labels: {
      environment: "staging",
      "sveltos-agent": "present",
    },
    credential: {
      type: "short-lived Kubernetes service-account token",
      duration: "2h",
      storedInRepository: false,
      removedWithClusters: true,
    },
    ready: true,
    kubernetesVersion: observed.kubernetesVersion,
  };
}

function waitForRegistration(managementName, workloadName) {
  let reason = "SveltosCluster status is missing";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = managementTry(managementName, [
      "-n",
      registrationNamespace,
      "get",
      "sveltoscluster",
      workloadName,
      "-o",
      "json",
    ]);
    if (result.ok) {
      const cluster = JSON.parse(result.output);
      const conditions = cluster.status?.conditions ?? [];
      const readyCondition = conditions.find(
        (condition) =>
          ["Ready", "ConnectionStatus"].includes(condition.type)
          && condition.status === "True",
      );
      const ready =
        cluster.status?.ready === true
        || cluster.status?.connectionStatus === "Healthy"
        || Boolean(readyCondition);
      reason = conditions
        .map((condition) =>
          `${condition.type}=${condition.status}:${condition.message ?? ""}`)
        .join("; ")
        || JSON.stringify(cluster.status ?? {});
      if (ready) {
        return {
          ready: true,
          kubernetesVersion: String(
            cluster.status?.version
            ?? cluster.status?.kubernetesVersion
            ?? "",
          ),
        };
      }
    }
    sleep(3000);
  }
  return { ready: false, reason: sanitizeError(reason) };
}

function waitForKyverno({
  managementName,
  workloadName,
  workloadKubeconfig,
}) {
  let last = {
    summary: "missing",
    helmStatus: "missing",
    deployments: [],
  };
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const summaries = managementTry(managementName, [
      "get",
      "clustersummaries",
      "-A",
      "-o",
      "json",
    ]);
    const deployments = workloadTry(workloadKubeconfig, [
      "-n",
      "kyverno",
      "get",
      "deployments",
      "-o",
      "json",
    ]);
    if (summaries.ok) {
      const items = JSON.parse(summaries.output).items ?? [];
      const summary = items.find((item) => {
        const profileLabel =
          item.metadata?.labels?.["projectsveltos.io/cluster-profile-name"];
        const profileOwner = (item.metadata?.ownerReferences ?? []).some(
          (owner) =>
            owner.kind === "ClusterProfile" && owner.name === profileName,
        );
        return item.spec?.clusterName === workloadName
          && item.spec?.clusterNamespace === registrationNamespace
          && item.spec?.clusterType === "Sveltos"
          && (profileLabel === profileName || profileOwner);
      });
      if (summary) {
        const helmFeature = (summary.status?.featureSummaries ?? []).find(
          (feature) => String(feature.featureID ?? feature.featureId) === "Helm",
        );
        last.summary = `${summary.metadata.namespace}/${summary.metadata.name}`;
        last.helmStatus = String(helmFeature?.status ?? "missing");
      }
    }
    if (deployments.ok) {
      last.deployments = JSON.parse(deployments.output).items
        .map((deployment) => ({
          name: deployment.metadata.name,
          desired: Number(deployment.spec?.replicas ?? 0),
          available: Number(deployment.status?.availableReplicas ?? 0),
          observedGenerationMatches:
            deployment.status?.observedGeneration
            === deployment.metadata?.generation,
        }))
        .sort((left, right) => left.name.localeCompare(right.name));
    }
    const available =
      last.deployments.length === 4
      && last.deployments.every(
        (deployment) =>
          deployment.desired === deployment.available
          && deployment.observedGenerationMatches,
      );
    if (last.helmStatus === "Provisioned" && available) {
      const releases = JSON.parse(
        helmCommand(workloadKubeconfig, [
          "list",
          "-n",
          "kyverno",
          "-o",
          "json",
        ]).output,
      );
      const release = releases.find((item) => item.name === "kyverno");
      check(release, "the Kyverno Helm release is missing");
      return {
        result: "pass",
        selectedCluster: workloadName,
        clusterSummary: last.summary,
        helmFeatureStatus: last.helmStatus,
        helmRelease: {
          name: release.name,
          namespace: release.namespace,
          chart: release.chart,
          applicationVersion: release.app_version,
          status: release.status,
        },
        deployments: last.deployments,
      };
    }
    sleep(4000);
  }
  return {
    result: "blocked",
    reason: `summary=${last.summary}; helm=${last.helmStatus}; deployments=${
      JSON.stringify(last.deployments)
    }`,
  };
}

function runDriftTest(workloadKubeconfig) {
  const deployment = "kyverno-admission-controller";
  workloadCommand(workloadKubeconfig, [
    "-n",
    "kyverno",
    "scale",
    "deployment",
    deployment,
    "--replicas=1",
  ]);
  let changed = false;
  let attempts = 0;
  for (; attempts < 180; attempts += 1) {
    const current = JSON.parse(
      workloadCommand(workloadKubeconfig, [
        "-n",
        "kyverno",
        "get",
        "deployment",
        deployment,
        "-o",
        "json",
      ]).output,
    );
    const replicas = Number(current.spec?.replicas ?? 0);
    const available = Number(current.status?.availableReplicas ?? 0);
    if (replicas === 1) changed = true;
    if (
      changed
      && replicas === 3
      && available === 3
      && current.status?.observedGeneration === current.metadata?.generation
    ) {
      return {
        result: "pass",
        object: `apps/v1/Deployment/kyverno/${deployment}`,
        reviewedReplicas: 3,
        changedReplicas: 1,
        restoredReplicas: 3,
        pollAttempts: attempts + 1,
        pollIntervalSeconds: 3,
      };
    }
    sleep(3000);
  }
  return {
    result: "blocked",
    reason: `replica drift was not restored after ${attempts} attempts`,
  };
}

function writeDocuments(path, documents) {
  writeFileSync(
    path,
    `${documents.map((document) =>
      JSON.stringify(document, null, 2)).join("\n---\n")}\n`,
  );
}

function createPolicySpace(context, space) {
  cub(context, [
    "space",
    "create",
    space,
    "--label",
    "App=sveltos-kyverno-fleet",
    "--label",
    "ApplyPolicyProfile=catalog-standard",
    "--label",
    "Proof=sveltos-oci-delivery",
    "--label",
    "ResourceClass=system-configuration",
    "--label",
    "SourceType=sveltos",
    "--trigger-filter",
    approvalFilterRef,
    "--where-trigger",
    "-",
    "--quiet",
  ]);
  cub(context, [
    "space",
    "update",
    space,
    "--release-target",
    catalogOciTargetRef,
    "--quiet",
  ]);
  cub(context, [
    "space",
    "update",
    "--patch",
    space,
    "--refresh-triggers",
    "--quiet",
  ]);
}

function readApprovalTopology(context) {
  const filter = getByRef(context, "filter", approvalFilterRef).Filter;
  const triggers = expectedTriggers.map(
    (ref) => getByRef(context, "trigger", ref).Trigger,
  );
  return {
    ref: approvalFilterRef,
    id: filter.FilterID,
    hash: String(filter.Hash ?? "").trim(),
    triggerRefs: expectedTriggers,
    triggerIds: triggers.map((trigger) => trigger.TriggerID).sort(),
  };
}

function assertPolicySpace(
  context,
  space,
  expectedTriggerIds,
  expectedReleaseTargetId,
) {
  const actual = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(
    sameSet(actual.TriggerIDs ?? [], expectedTriggerIds),
    `${space} received the wrong Trigger set`,
  );
  check(
    actual.ReleaseTargetID === expectedReleaseTargetId,
    `${space} received the wrong release target`,
  );
}

function waitForPolicy(context, space, unit, approvalExpected) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const current = cubJson(
      context,
      ["unit", "get", unit, "--space", space, "-o", "json"],
    ).Unit;
    const waiting = current.ApplyGates?.["awaiting/triggers"] === true;
    const approvalPresent = current.ApplyGates?.[approvalGate] === true;
    if (!waiting && approvalPresent === approvalExpected) return current;
    sleep(1000);
  }
  throw new Error(
    `${space}/${unit} did not reach the expected policy state`,
  );
}

function blockedDryRun(context, space, unit) {
  const result = cubTry(context, [
    "unit",
    "apply",
    "--space",
    space,
    unit,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  check(!result.ok, `${space}/${unit} was not blocked before approval`);
  check(
    result.error.includes(approvalGate) || result.output.includes(approvalGate),
    `${space}/${unit} failed without naming ${approvalGate}`,
  );
  return {
    result: "blocked",
    gate: approvalGate,
    dryRun: true,
    exitCode: result.status,
  };
}

function allowedDryRun(context, space, unit) {
  const result = cubTry(context, [
    "unit",
    "apply",
    "--space",
    space,
    unit,
    "--dry-run",
    "--wait",
    "-o",
    "json",
  ]);
  check(
    result.ok,
    `${space}/${unit} was not allowed after approval: ${result.error}`,
  );
  const operation = JSON.parse(result.output);
  check(operation.DryRun === true, "ConfigHub did not return a dry-run operation");
  return {
    result: "allowed",
    dryRun: true,
    exitCode: 0,
  };
}

function publishRelease(context, space) {
  const response = cubJson(
    context,
    ["release", "publish", space, "-o", "json"],
    { timeout: 300_000 },
  );
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(
    release.ManifestDigest ?? release.manifestDigest,
  );
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return {
    space,
    reference: `oci://${configHubOciHost}/space/${space}:latest`,
    manifestDigest,
    bundleDigest: normalizeDigest(release.Digest ?? release.digest),
    releaseId: String(release.ReleaseID ?? release.releaseId ?? ""),
  };
}

function startRegistry(name) {
  const started = tryCommand("docker", [
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-p",
    "127.0.0.1::5000",
    "registry:2",
  ], { timeout: 120_000 });
  check(
    started.ok,
    `could not start the temporary OCI registry: ${started.error}`,
  );
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const port = tryCommand("docker", ["port", name, "5000/tcp"]);
    const match = port.output.match(/127\.0\.0\.1:(\d+)/);
    if (match) {
      const host = `127.0.0.1:${match[1]}`;
      if (tryCommand("curl", ["-fsS", `http://${host}/v2/`]).ok) {
        return {
          host,
          clusterHost: `host.docker.internal:${match[1]}`,
        };
      }
    }
    sleep(1000);
  }
  tryCommand("docker", ["rm", "-f", name], { timeout: 120_000 });
  throw new Error("temporary OCI registry did not publish a host port");
}

function publishPortableOci({
  workRoot,
  approvedText,
  registryHost,
  clusterRegistryHost,
}) {
  const outputRoot = join(workRoot, "portable-output");
  const pullRoot = join(workRoot, "portable-output-pulled");
  const outputFile = join(outputRoot, "clusterprofile.yaml");
  const bundleFile = join(outputRoot, "bundle.tar.gz");
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(outputFile, approvedText);
  command("tar", [
    "-czf",
    bundleFile,
    "clusterprofile.yaml",
  ], { cwd: outputRoot });
  const repository = "sveltos-kyverno-staging";
  const localReference = `${registryHost}/${repository}:latest`;
  command("oras", [
    "push",
    "--plain-http",
    "--artifact-type",
    artifactType,
    "--format",
    "json",
    localReference,
    `bundle.tar.gz:${deployableLayerType}`,
  ], { cwd: outputRoot, timeout: 180_000 });
  const descriptor = JSON.parse(command("oras", [
    "manifest",
    "fetch",
    "--plain-http",
    "--descriptor",
    localReference,
  ]).output);
  const manifestDigest = normalizeDigest(descriptor.digest);
  check(manifestDigest, "portable Sveltos OCI has no manifest digest");
  command("oras", [
    "pull",
    "--plain-http",
    "--output",
    pullRoot,
    `${registryHost}/${repository}@${manifestDigest}`,
  ], { timeout: 120_000 });
  const pulledBundle = join(pullRoot, "bundle.tar.gz");
  check(existsSync(pulledBundle), "pulled portable OCI is missing bundle.tar.gz");
  command("tar", ["-xzf", pulledBundle, "-C", pullRoot]);
  const pulledFile = join(pullRoot, "clusterprofile.yaml");
  check(existsSync(pulledFile), "pulled portable OCI is missing the profile");
  const pulledText = readFileSync(pulledFile, "utf8");
  check(
    canonicalDocs(parseDocs(pulledText))
      === canonicalDocs(parseDocs(approvedText)),
    "pulled portable OCI differs from the approved ConfigHub data",
  );
  return {
    reference: `oci://${localReference}`,
    clusterReference: `oci://${clusterRegistryHost}/${repository}`,
    manifestDigest,
    objectCount: 1,
    approvedDataSha256: sha256(approvedText),
    pulledDataSha256: sha256(pulledText),
    objectsMatchApprovedData: true,
    anonymousPull: true,
    registryLifetime: "temporary",
  };
}

function addApplication({
  context,
  managementName,
  managementSpace,
  applicationName,
  applicationUnit,
  policySpace,
  sourceReference,
  anonymousOciHost,
  workRoot,
}) {
  const targetRef = `${managementSpace}/oci`;
  const target = cubJson(context, [
    "target",
    "get",
    "--space",
    managementSpace,
    "oci",
    "-o",
    "json",
  ]).Target;
  check(target?.ProviderType === "OCI", `${targetRef} is not an OCI target`);
  const applicationPath = join(workRoot, `${applicationName}.yaml`);
  writeFileSync(applicationPath, `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${applicationName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${sourceReference}
    targetRevision: latest
    path: .
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - ServerSideApply=true
`, { mode: 0o600 });
  configureAnonymousOci(managementName, anonymousOciHost, workRoot);
  cub(context, [
    "unit",
    "create",
    "--space",
    managementSpace,
    applicationUnit,
    applicationPath,
    "--target",
    targetRef,
    "--change-desc",
    `Deliver the approved ClusterProfile from ${policySpace}`,
    "--quiet",
  ], { timeout: 180_000 });
  const rootRelease = publishRelease(context, managementSpace);
  managementCommand(managementName, [
    "annotate",
    "application",
    managementSpace,
    "-n",
    "argocd",
    "argocd.argoproj.io/refresh=hard",
    "--overwrite",
  ]);
  return {
    name: applicationName,
    unit: `${managementSpace}/${applicationUnit}`,
    source: sourceReference,
    approvedConfigHubSpace: policySpace,
    destinationCluster: "management",
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function configureAnonymousOci(managementName, registryHost, workRoot) {
  const secretPath = join(workRoot, "anonymous-oci.yaml");
  writeFileSync(secretPath, `apiVersion: v1
kind: Secret
metadata:
  name: helm-expt-anonymous-oci
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repo-creds
type: Opaque
stringData:
  url: oci://${registryHost}
  type: oci
  enableOCI: "true"
  insecureOCIForceHttp: "true"
`, { mode: 0o600 });
  managementCommand(managementName, ["apply", "-f", secretPath]);
}

function waitForApplication({
  managementName,
  applicationName,
  expectedRevision,
}) {
  let last = {
    sync: "",
    health: "",
    revision: "",
    comparisonError: "",
  };
  for (let attempt = 0; attempt < 72; attempt += 1) {
    const result = managementTry(managementName, [
      "-n",
      "argocd",
      "get",
      "application",
      applicationName,
      "-o",
      "json",
    ]);
    if (result.ok) {
      const application = JSON.parse(result.output);
      last = {
        sync: String(application.status?.sync?.status ?? ""),
        health: String(application.status?.health?.status ?? ""),
        revision: normalizeDigest(application.status?.sync?.revision),
        comparisonError: String(
          (application.status?.conditions ?? [])
            .find((condition) => condition.type === "ComparisonError")
            ?.message
          ?? "",
        ),
      };
      if (
        last.sync === "Synced"
        && last.health === "Healthy"
        && last.revision === expectedRevision
      ) {
        return {
          result: "pass",
          sync: last.sync,
          health: last.health,
          revision: last.revision,
          expectedRevision,
          digestMatchesPortableOci: true,
        };
      }
      if (attempt >= 3 && last.comparisonError) {
        return {
          result: "blocked",
          reason: sanitizeError(last.comparisonError),
        };
      }
    }
    sleep(5000);
  }
  return {
    result: "blocked",
    reason: `sync=${last.sync || "missing"}; health=${
      last.health || "missing"
    }; revision=${last.revision || "missing"}; expected=${expectedRevision}; error=${
      last.comparisonError || "none"
    }`,
  };
}

function clusterUp(context, name) {
  const result = cubTry(
    context,
    ["cluster", "up", "--name", name, "--no-ports"],
    { timeout: 900_000 },
  );
  check(
    result.ok || clusterPresent(name),
    `cub cluster up failed for ${name}: ${result.error}`,
  );
}

function clusterDown(context, name) {
  const result = cubTry(
    context,
    ["cluster", "down", "--name", name, "--force"],
    { timeout: 600_000 },
  );
  if (!result.ok && clusterPresent(name)) {
    tryCommand("kind", ["delete", "cluster", "--name", name], {
      timeout: 180_000,
    });
  }
  const space = `${name}-cluster`;
  for (
    let attempt = 0;
    attempt < 3 && spacePresent(context, space);
    attempt += 1
  ) {
    cubTry(context, [
      "space",
      "delete",
      space,
      "--recursive-force",
      "--quiet",
    ], { timeout: 240_000 });
    sleep(1000);
  }
}

function managementCommand(name, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig",
    managementKubeconfig(name),
    "--context",
    `kind-${name}`,
    ...args,
  ], options);
}

function managementTry(name, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig",
    managementKubeconfig(name),
    "--context",
    `kind-${name}`,
    ...args,
  ], options);
}

function workloadCommand(kubeconfig, args, options = {}) {
  return command("kubectl", [
    "--kubeconfig",
    kubeconfig,
    ...args,
  ], options);
}

function workloadTry(kubeconfig, args, options = {}) {
  return tryCommand("kubectl", [
    "--kubeconfig",
    kubeconfig,
    ...args,
  ], options);
}

function helmCommand(kubeconfig, args, options = {}) {
  return command("helm", [
    "--kubeconfig",
    kubeconfig,
    ...args,
  ], options);
}

function managementKubeconfig(name) {
  return join(homedir(), ".confighub", "clusters", `${name}.kubeconfig`);
}

function clusterPresent(name) {
  const result = tryCommand("kind", ["get", "clusters"]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function dockerContainerPresent(name) {
  const result = tryCommand("docker", [
    "ps",
    "-a",
    "--filter",
    `name=^/${name}$`,
    "--format",
    "{{.Names}}",
  ]);
  return result.ok && result.output.split(/\r?\n/).includes(name);
}

function spacePresent(context, space) {
  return cubTry(context, ["space", "get", space, "-o", "json"]).ok;
}

function getByRef(context, entity, ref) {
  const [space, slug] = ref.split("/");
  return cubJson(context, [entity, "get", "--space", space, slug, "-o", "json"]);
}

function storedData(unit) {
  check(unit.Data, `${unit.SpaceSlug}/${unit.Slug} has no stored data`);
  return Buffer.from(unit.Data, "base64").toString("utf8");
}

function approvalCount(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return value ? 1 : 0;
}

function canonicalDocs(documents) {
  return JSON.stringify(
    documents
      .map((document) => ({
        identity: identity(document),
        document: canonicalValue(document),
      }))
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) =>
        !key.startsWith("$comment$")
        && key !== "status"
        && key !== "managedFields"
        && key !== "creationTimestamp"
        && key !== "generation"
        && key !== "resourceVersion"
        && key !== "uid")
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function sourceFieldsMatchLive(source, live) {
  const canonicalSource = canonicalValue(source);
  const canonicalLive = canonicalValue(live);
  return JSON.stringify(projectToShape(canonicalLive, canonicalSource))
    === JSON.stringify(canonicalSource);
}

function projectToShape(actual, shape) {
  if (Array.isArray(shape)) {
    if (!Array.isArray(actual)) return actual;
    return shape.map((item, index) => projectToShape(actual[index], item));
  }
  if (!shape || typeof shape !== "object") return actual;
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
    return actual;
  }
  return Object.fromEntries(
    Object.keys(shape).map(
      (key) => [key, projectToShape(actual[key], shape[key])],
    ),
  );
}

function addedFieldPaths(source, live) {
  const additions = [];
  collectAddedPaths(
    canonicalValue(source),
    canonicalValue(live),
    "",
    additions,
  );
  return additions.sort();
}

function collectAddedPaths(source, live, path, additions) {
  if (Array.isArray(live)) {
    if (!Array.isArray(source)) return;
    for (let index = 0; index < live.length; index += 1) {
      const itemPath = `${path}[${index}]`;
      if (index >= source.length) {
        additions.push(itemPath);
      } else {
        collectAddedPaths(source[index], live[index], itemPath, additions);
      }
    }
    return;
  }
  if (!live || typeof live !== "object" || Array.isArray(source)) return;
  const sourceObject =
    source && typeof source === "object" ? source : {};
  for (const key of Object.keys(live).sort()) {
    const keyPath = path ? `${path}.${key}` : key;
    if (!(key in sourceObject)) {
      additions.push(keyPath);
    } else {
      collectAddedPaths(sourceObject[key], live[key], keyPath, additions);
    }
  }
}

function identity(document) {
  return [
    document.apiVersion ?? "",
    document.kind ?? "",
    document.metadata?.namespace ?? "",
    document.metadata?.name ?? "",
  ].join("|");
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function normalizeDigest(value) {
  const match = String(value ?? "").match(/sha256:[a-f0-9]{64}/i);
  return match ? match[0].toLowerCase() : "";
}

function cub(context, args, options = {}) {
  return command("cub", args, {
    ...options,
    env: cubEnvironment(context),
  }).output;
}

function cubTry(context, args, options = {}) {
  return tryCommand("cub", args, {
    ...options,
    env: cubEnvironment(context),
  });
}

function cubJson(context, args, options = {}) {
  return JSON.parse(cub(context, args, options));
}

function cubEnvironment(context) {
  return {
    ...process.env,
    CONFIGHUB_AGENT: "1",
    CUB_CONTEXT: context,
  };
}

function command(file, args, options = {}) {
  const result = tryCommand(file, args, options);
  if (!result.ok) {
    throw new Error(
      `${file} ${args.slice(0, 6).join(" ")} failed: ${result.error}`,
    );
  }
  return result;
}

function tryCommand(file, args, options = {}) {
  const result = spawnSync(file, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 100,
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: result.stdout ?? "",
    error: sanitizeError(
      result.error?.message
      ?? result.stderr
      ?? result.stdout
      ?? `exit ${result.status}`,
    ),
  };
}

function sanitizeError(value) {
  return String(value ?? "")
    .replace(/(?i:password|token|secret)\s*[:=]\s*\S+/g, "$1=<redacted>")
    .replace(/[A-Za-z0-9_-]{40,}/g, "<redacted-long-value>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
}

function safeRunId(value) {
  const compact = String(value).replace(/\D/g, "").slice(0, 14);
  check(
    compact.length >= 8,
    "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits",
  );
  return compact;
}

function sleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function phase(message) {
  console.log(`[sveltos-oci-delivery] ${message}`);
}

function verifyReceipt(receipt) {
  check(
    receipt.kind === "SveltosOciDeliveryProofReceipt",
    "Sveltos OCI receipt kind changed",
  );
  check(receipt.status?.result === "pass", "Sveltos OCI proof is not pass");
  check(
    receipt.spec?.flow?.portableShape === "work -> OCI"
      && receipt.spec.flow.access?.configHubReview
      === "ConfigHub account and server required"
      && receipt.spec.flow.access?.portablePackaging
      === "local command; no ConfigHub Server required"
      && receipt.spec.flow.access?.portablePull
      === "anonymous; no ConfigHub account required",
    "Sveltos flow access record changed",
  );
  const sourceText = readFileSync(profilePath, "utf8");
  const sourceDocs = parseDocs(sourceText);
  check(
    receipt.spec?.source?.profile === relativeRepo(profilePath)
      && receipt.spec.source.sourceLock === relativeRepo(sourceLockPath)
      && receipt.spec.source.rawSha256 === sha256(sourceText)
      && receipt.spec.source.canonicalSha256
      === sha256(canonicalDocs(sourceDocs)),
    "Sveltos source record changed",
  );
  const prerequisite = receipt.spec?.prerequisite;
  const sourceLock = readYaml(sourceLockPath);
  check(
    prerequisite?.version === "v1.12.0"
      && prerequisite.manifestSha256
      === sourceLock.spec.sveltos.manifestSha256
      && prerequisite.crdCount > 0
      && prerequisite.appliedObjectCount > prerequisite.crdCount
      && prerequisite.deployments?.length > 0
      && prerequisite.deployments.every(
        (deployment) =>
          deployment.desired === deployment.updated
          && deployment.desired === deployment.ready
          && deployment.desired === deployment.available
          && deployment.observedGenerationMatches === true,
      ),
    "Sveltos prerequisite record changed",
  );
  const review = receipt.spec?.configHubReview;
  check(
    review?.organization === expectedPolicyOrg
      && review.policy?.profile === "catalog-standard"
      && review.policy?.resourceClass === "system-configuration"
      && review.policy?.approvalGate === approvalGate
      && sameSet(review.policy.filter?.triggerRefs ?? [], expectedTriggers),
    "Sveltos policy record changed",
  );
  check(
    review?.beforeApproval?.result === "blocked"
      && review.beforeApproval.gate === approvalGate
      && review.afterApproval?.result === "allowed"
      && review.approval?.recordedApprovals >= 1
      && review.approval.approverIdentityRecordedInReceipt === false
      && review.approval.contentHashUnchanged === true
      && review.approvedDataMatchesSource === true,
    "Sveltos approval record changed",
  );
  check(
    normalizeDigest(review.privateRelease?.manifestDigest)
      === review.privateRelease.manifestDigest
      && review.portableRelease?.objectsMatchApprovedData === true
      && review.portableRelease.objectCount === 1
      && review.portableRelease.anonymousPull === true
      && review.portableRelease.registryLifetime === "temporary"
      && review.portableRelease.approvedDataSha256
      === review.portableRelease.pulledDataSha256,
    "Sveltos OCI records changed",
  );
  const management = receipt.spec?.management;
  check(
    management?.creationCommand === "cub cluster up"
      && management.registration?.method
      === "programmatic SveltosCluster registration"
      && management.registration.ready === true
      && management.registration.labels?.environment === "staging"
      && management.registration.credential?.storedInRepository === false,
    "Sveltos cluster registration record changed",
  );
  const delivery = management?.delivery;
  check(
    delivery?.source === "approved ConfigHub Unit data"
      && delivery.applicationDelivery
      === "ConfigHub cluster Space release OCI"
      && delivery.workloadDelivery === "temporary portable OCI"
      && delivery.application?.source
      === review.portableRelease.clusterReference
      && delivery.argo?.result === "pass"
      && delivery.argo.sync === "Synced"
      && delivery.argo.health === "Healthy"
      && delivery.argo.revision === review.portableRelease.manifestDigest
      && delivery.approvedFieldsMatchLive === true
      && Array.isArray(delivery.liveAddedFieldPaths),
    "Sveltos Argo delivery record changed",
  );
  const reconciliation = management?.reconciliation;
  check(
    reconciliation?.result === "pass"
      && reconciliation.selectedCluster
      === receipt.spec?.workload?.cluster
      && reconciliation.helmFeatureStatus === "Provisioned"
      && reconciliation.helmRelease?.name === "kyverno"
      && reconciliation.helmRelease?.chart === "kyverno-3.8.1"
      && reconciliation.deployments?.length === 4
      && reconciliation.deployments.every(
        (deployment) =>
          deployment.desired === deployment.available
          && deployment.observedGenerationMatches === true,
      ),
    "Sveltos reconciliation record changed",
  );
  check(
    receipt.spec?.workload?.creationCommand === "kind create cluster"
      && receipt.spec.workload.drift?.result === "pass"
      && receipt.spec.workload.drift.changedReplicas === 1
      && receipt.spec.workload.drift.restoredReplicas === 3,
    "Sveltos drift record changed",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every(
      (result) => result === "pass",
    ),
    "Sveltos cleanup did not pass",
  );
  const serialized = JSON.stringify(receipt);
  check(
    !serialized.includes("@confighub.com"),
    "Sveltos receipt contains a user identity",
  );
  check(!serialized.includes("ch_"), "Sveltos receipt contains a credential");
  check(
    !serialized.includes(["cub", "lk"].join("-"))
      && !serialized.includes(["cub", "lk"].join(" ")),
    "Sveltos receipt contains an obsolete cluster command",
  );
}

function renderSummary(receipt) {
  const review = receipt.spec.configHubReview;
  const management = receipt.spec.management;
  const workload = receipt.spec.workload;
  const reconciliation = management.reconciliation;
  return `# ConfigHub delivers a Sveltos fleet profile

This run starts with one reviewed Sveltos \`ClusterProfile\`. It selects workload
clusters labeled \`environment=staging\`, installs Kyverno 3.8.1, and asks for three
admission-controller replicas.

ConfigHub stored the exact profile under the system-configuration policy. Its
dry-run apply was blocked until the exact revision was approved. ConfigHub then
published its private release OCI.

The proof also packaged the approved profile as a temporary portable OCI. Argo CD
on the management cluster reconciled that exact digest. Sveltos selected the
registered staging workload cluster, installed Kyverno, and reported the Helm
feature as \`Provisioned\`.

This run uses ConfigHub for the stored review and approval. Packaging the approved
object as a portable OCI is a local \`work -> OCI\` step, and pulling that temporary
package needs no ConfigHub account. Those are composable choices: the public tools
can also build or inspect OCI packages without putting ConfigHub in the flow.

The test then changed the admission-controller deployment from three replicas to
one. Sveltos restored it to three.

| Check | Result |
| --- | --- |
| ConfigHub apply before approval | ${review.beforeApproval.result} |
| ConfigHub apply after approval | ${review.afterApproval.result} |
| Private ConfigHub release | \`${review.privateRelease.manifestDigest}\` |
| Portable OCI pulled back and compared | ${review.portableRelease.objectsMatchApprovedData ? "Pass" : "Fail"} |
| Argo CD | ${management.delivery.argo.sync} and ${management.delivery.argo.health}; digest matched |
| Approved fields in the live profile | ${management.delivery.approvedFieldsMatchLive ? "Pass" : "Fail"}; ${management.delivery.liveAddedFieldPaths.length} controller-added path(s) recorded |
| Sveltos cluster selection | \`${reconciliation.selectedCluster}\` |
| Sveltos Helm result | ${reconciliation.helmFeatureStatus} |
| Kyverno deployments available | ${reconciliation.deployments.length}/4 |
| Replica drift repaired | ${workload.drift.changedReplicas} -> ${workload.drift.restoredReplicas} |
| Cleanup | ${Object.values(receipt.spec.cleanup).every((value) => value === "pass") ? "Pass" : "Fail"} |

## What this proves

The reviewed fleet object can move from ConfigHub through OCI and Argo CD to a
Sveltos management cluster without being copied with \`kubectl\`. Sveltos then owns
cluster selection, Helm installation, and drift repair.

## Limits

Sveltos itself was installed directly as a pinned prerequisite on the management
cluster. The portable OCI used a temporary registry. This was one staging workload
cluster, not a multi-cluster promotion wave, and it proves this Kyverno profile
rather than every Sveltos feature.

- [Reviewed ClusterProfile](../../examples/sveltos/kyverno-fleet/clusterprofile.yaml)
- [Pinned source versions](../../examples/sveltos/kyverno-fleet/source-lock.yaml)
- [Committed receipt](../../runs/sveltos-oci-delivery-proof/receipt.yaml)
`;
}
