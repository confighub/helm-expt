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
const policyPath = join(
  repoRoot,
  "config-catalog",
  "policies",
  "catalog-standard.yaml",
);
const expectedTriggers = readYaml(policyPath).spec.approvalRequired.checks
  .map((item) => item.trigger)
  .sort();
// This run predates the two AICR-only checks. Preserve the trigger set it
// actually used while requiring those checks to remain in the current profile.
const historicalTriggers = [
  "platform/digest-pinned-images",
  "platform/lifecycle-route-evidence",
  "platform/probes-declared",
  "platform/require-approval",
  "platform/vet-placeholders",
  "platform/vet-schemas",
].sort();
const configHubOciHost = "oci.hub.confighub.com:443";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const deployableLayerType = "application/vnd.oci.image.layer.v1.tar+gzip";
const sourceRoot = join(repoRoot, "examples", "sveltos", "kyverno-fleet");
const profilePath = join(sourceRoot, "clusterprofile-pilot.yaml");
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
  const pilotName = `hx-sveltos-pilot-${runId}`;
  const secondName = `hx-sveltos-next-${runId}`;
  const applicationName = `sveltos-profile-${runId}`;
  const applicationUnit = "sveltos-profile-application";
  const registryName = `hx-sveltos-registry-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-sveltos-oci-"));
  const pilotKubeconfig = join(workRoot, "pilot.kubeconfig");
  const secondKubeconfig = join(workRoot, "next.kubeconfig");
  const fleetProfilePath = join(workRoot, "clusterprofile-fleet.yaml");
  const cleanup = {
    policySpace: "not-created",
    managementCluster: "not-created",
    managementSpace: "not-created",
    pilotCluster: "not-created",
    secondCluster: "not-created",
    registry: "not-created",
    localFiles: "pending",
  };
  let policySpaceCreated = false;
  let managementStarted = false;
  let pilotStarted = false;
  let secondStarted = false;
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
      !clusterPresent(managementName)
        && !clusterPresent(pilotName)
        && !clusterPresent(secondName),
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

    createWorkloadCluster(pilotName, pilotKubeconfig);
    pilotStarted = true;
    cleanup.pilotCluster = "pending";
    createWorkloadCluster(secondName, secondKubeconfig);
    secondStarted = true;
    cleanup.secondCluster = "pending";
    phase("two workload clusters ready");

    const sveltosInstall = installSveltos({
      managementName,
      workRoot,
      expectedManifestSha,
    });
    phase("Sveltos controllers converged");
    const pilotRegistration = registerWorkload({
      managementName,
      workloadName: pilotName,
      workloadKubeconfig: pilotKubeconfig,
      workRoot,
      rollout: "pilot",
    });
    const secondRegistration = registerWorkload({
      managementName,
      workloadName: secondName,
      workloadKubeconfig: secondKubeconfig,
      workRoot,
      rollout: "next",
    });
    phase("two workload clusters registered");

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
    const pilotStored = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      true,
    );
    check(
      canonicalDocs(parseDocs(storedData(pilotStored)))
        === canonicalDocs(sourceDocs),
      "ConfigHub stored a different ClusterProfile",
    );
    const pilotBlocked = blockedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    approveHeadRevision(
      policyContext,
      policySpace,
      policyUnit,
      "pilot",
      pilotStored.HeadRevisionNum,
    );
    const pilotApproved = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      false,
    );
    check(
      pilotApproved.ContentHash === pilotStored.ContentHash,
      "approval changed the ClusterProfile content",
    );
    const pilotApprovalCount = approvalCount(pilotApproved.ApprovedBy);
    check(pilotApprovalCount >= 1, "the pilot ClusterProfile has no approval");
    const pilotAllowed = allowedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    const pilotPrivateRelease = publishRelease(policyContext, policySpace);
    phase("pilot review, approval, and private release passed");
    const pilotApprovedText = storedData(pilotApproved);
    const pilotPortableRelease = publishPortableOci({
      workRoot,
      approvedText: pilotApprovedText,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
      tag: "pilot",
    });
    phase("pilot OCI pushed, pulled, and compared");

    const pilotApplication = addApplication({
      context: clusterContext,
      managementName,
      managementSpace,
      applicationName,
      applicationUnit,
      policySpace,
      sourceReference: pilotPortableRelease.clusterReference,
      sourceRevision: pilotPortableRelease.targetRevision,
      anonymousOciHost: registry.clusterHost,
      workRoot,
    });
    const pilotArgo = waitForApplication({
      managementName,
      applicationName,
      expectedRevision: pilotPortableRelease.manifestDigest,
    });
    check(
      pilotArgo.result === "pass",
      `${applicationName} did not reconcile the pilot: ${
        pilotArgo.reason ?? "unknown"
      }`,
    );
    phase("Argo CD reconciled the pilot OCI digest");
    const pilotLiveProfile = JSON.parse(
      managementCommand(managementName, [
        "get",
        "clusterprofile",
        profileName,
        "-o",
        "json",
      ]).output,
    );
    const pilotApprovedFieldsMatchLive = sourceFieldsMatchLive(
      sourceDocs[0],
      pilotLiveProfile,
    );
    const pilotLiveAddedFieldPaths = addedFieldPaths(
      sourceDocs[0],
      pilotLiveProfile,
    );
    check(
      pilotApprovedFieldsMatchLive,
      "a field from the approved pilot ClusterProfile changed in the live object",
    );

    const pilotReconciliation = waitForKyverno({
      managementName,
      workloadName: pilotName,
      workloadKubeconfig: pilotKubeconfig,
    });
    check(
      pilotReconciliation.result === "pass",
      `Sveltos did not install Kyverno on the pilot: ${
        pilotReconciliation.reason ?? "unknown"
      }`,
    );
    const secondBeforeExpansion = observeNoKyverno({
      managementName,
      workloadName: secondName,
      workloadKubeconfig: secondKubeconfig,
    });
    check(
      secondBeforeExpansion.result === "pass",
      `the second cluster was selected during the pilot: ${
        secondBeforeExpansion.reason ?? "unknown"
      }`,
    );
    phase("pilot selected one cluster and left the second cluster unchanged");

    const fleetDoc = structuredClone(sourceDocs[0]);
    check(
      fleetDoc.spec?.clusterSelector?.matchLabels?.rollout === "pilot",
      "the committed profile no longer declares rollout=pilot",
    );
    delete fleetDoc.spec.clusterSelector.matchLabels.rollout;
    writeDocuments(fleetProfilePath, [fleetDoc]);
    const fleetUpdate = cubTry(policyContext, [
      "unit",
      "update",
      "--space",
      policySpace,
      policyUnit,
      fleetProfilePath,
      "--change-desc",
      "Expand the approved Kyverno profile from pilot to all staging clusters",
      "-o",
      "json",
    ]);
    if (!fleetUpdate.ok) {
      const current = cubJson(policyContext, [
        "unit",
        "get",
        "--space",
        policySpace,
        policyUnit,
        "-o",
        "json",
      ]).Unit;
      check(
        canonicalDocs(parseDocs(storedData(current)))
          === canonicalDocs([fleetDoc]),
        `ConfigHub rejected the fleet update before storing it: ${
          fleetUpdate.error
        }`,
      );
      phase("fleet update stored; waiting for delayed trigger completion");
    }
    const fleetStored = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      true,
    );
    check(
      canonicalDocs(parseDocs(storedData(fleetStored)))
        === canonicalDocs([fleetDoc]),
      "ConfigHub stored a different fleet ClusterProfile",
    );
    check(
      Number(fleetStored.HeadRevisionNum) > Number(pilotApproved.HeadRevisionNum),
      "the fleet change did not create a new revision",
    );
    const fleetBlocked = blockedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    approveHeadRevision(
      policyContext,
      policySpace,
      policyUnit,
      "fleet",
      fleetStored.HeadRevisionNum,
    );
    const fleetApproved = waitForPolicy(
      policyContext,
      policySpace,
      policyUnit,
      false,
    );
    check(
      fleetApproved.ContentHash === fleetStored.ContentHash,
      "approval changed the fleet ClusterProfile content",
    );
    const fleetApprovalCount = approvalCount(fleetApproved.ApprovedBy);
    check(fleetApprovalCount >= 1, "the fleet ClusterProfile has no approval");
    const fleetAllowed = allowedDryRun(
      policyContext,
      policySpace,
      policyUnit,
    );
    const fleetPrivateRelease = publishRelease(policyContext, policySpace);
    const fleetApprovedText = storedData(fleetApproved);
    const fleetPortableRelease = publishPortableOci({
      workRoot,
      approvedText: fleetApprovedText,
      registryHost: registry.host,
      clusterRegistryHost: registry.clusterHost,
      tag: "fleet",
    });
    check(
      pilotPortableRelease.manifestDigest
        !== fleetPortableRelease.manifestDigest,
      "the selector change did not produce a new OCI digest",
    );
    phase("fleet expansion approved and published at a new OCI digest");

    const fleetApplication = updateApplication({
      context: clusterContext,
      managementName,
      managementSpace,
      applicationName,
      applicationUnit,
      policySpace,
      sourceReference: fleetPortableRelease.clusterReference,
      sourceRevision: fleetPortableRelease.targetRevision,
      workRoot,
    });
    const fleetArgo = waitForApplication({
      managementName,
      applicationName,
      expectedRevision: fleetPortableRelease.manifestDigest,
    });
    check(
      fleetArgo.result === "pass",
      `${applicationName} did not reconcile the fleet revision: ${
        fleetArgo.reason ?? "unknown"
      }`,
    );
    const fleetLiveProfile = JSON.parse(
      managementCommand(managementName, [
        "get",
        "clusterprofile",
        profileName,
        "-o",
        "json",
      ]).output,
    );
    const fleetApprovedFieldsMatchLive = sourceFieldsMatchLive(
      fleetDoc,
      fleetLiveProfile,
    );
    const fleetLiveAddedFieldPaths = addedFieldPaths(
      fleetDoc,
      fleetLiveProfile,
    );
    check(
      fleetApprovedFieldsMatchLive,
      "a field from the approved fleet ClusterProfile changed in the live object",
    );
    const pilotAfterExpansion = waitForKyverno({
      managementName,
      workloadName: pilotName,
      workloadKubeconfig: pilotKubeconfig,
    });
    const secondAfterExpansion = waitForKyverno({
      managementName,
      workloadName: secondName,
      workloadKubeconfig: secondKubeconfig,
    });
    check(
      pilotAfterExpansion.result === "pass"
        && secondAfterExpansion.result === "pass",
      "Sveltos did not reconcile Kyverno on both staging clusters",
    );
    phase("fleet revision selected both staging clusters");

    const pilotDrift = runDriftTest(pilotKubeconfig);
    const secondDrift = runDriftTest(secondKubeconfig);
    check(
      pilotDrift.result === "pass" && secondDrift.result === "pass",
      "Sveltos did not repair replica drift on both clusters",
    );
    phase("Sveltos repaired replica drift on both clusters");

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
          unitId: pilotStored.UnitID,
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
          pilot: {
            selector: {
              environment: "staging",
              rollout: "pilot",
            },
            contentHash: pilotStored.ContentHash,
            beforeApproval: pilotBlocked,
            approval: {
              revision: pilotApproved.HeadRevisionNum,
              recordedApprovals: pilotApprovalCount,
              approverIdentityRecordedInReceipt: false,
              contentHashUnchanged: true,
            },
            afterApproval: pilotAllowed,
            approvedDataMatchesSource: true,
            privateRelease: pilotPrivateRelease,
            portableRelease: pilotPortableRelease,
          },
          fleet: {
            selector: {
              environment: "staging",
            },
            change: {
              path: "spec.clusterSelector.matchLabels.rollout",
              before: "pilot",
              after: "removed",
              otherSourceFieldsChanged: false,
            },
            contentHash: fleetStored.ContentHash,
            beforeApproval: fleetBlocked,
            approval: {
              revision: fleetApproved.HeadRevisionNum,
              recordedApprovals: fleetApprovalCount,
              approverIdentityRecordedInReceipt: false,
              contentHashUnchanged: true,
            },
            afterApproval: fleetAllowed,
            approvedDataMatchesCandidate: true,
            privateRelease: fleetPrivateRelease,
            portableRelease: fleetPortableRelease,
          },
        },
        management: {
          organization: clusterContextInfo.metadata.organizationName,
          cluster: managementName,
          creationCommand: "cub cluster up",
          registrations: [
            pilotRegistration,
            secondRegistration,
          ],
          waves: {
            pilot: {
              source: "approved ConfigHub Unit data",
              applicationDelivery: "ConfigHub cluster Space release OCI",
              workloadDelivery: "temporary portable OCI",
              portablePackaging: "scripted from the approved Unit data",
              application: pilotApplication,
              argo: pilotArgo,
              approvedFieldsMatchLive: pilotApprovedFieldsMatchLive,
              liveAddedFieldPaths: pilotLiveAddedFieldPaths,
              targets: [
                {
                  cluster: pilotName,
                  selected: true,
                  reconciliation: pilotReconciliation,
                },
                {
                  cluster: secondName,
                  selected: false,
                  observation: secondBeforeExpansion,
                },
              ],
            },
            fleet: {
              source: "approved ConfigHub Unit data",
              applicationDelivery: "ConfigHub cluster Space release OCI",
              workloadDelivery: "temporary portable OCI",
              portablePackaging: "scripted from the approved Unit data",
              application: fleetApplication,
              argo: fleetArgo,
              approvedFieldsMatchLive: fleetApprovedFieldsMatchLive,
              liveAddedFieldPaths: fleetLiveAddedFieldPaths,
              targets: [
                {
                  cluster: pilotName,
                  selected: true,
                  reconciliation: pilotAfterExpansion,
                },
                {
                  cluster: secondName,
                  selected: true,
                  reconciliation: secondAfterExpansion,
                },
              ],
            },
          },
        },
        workloads: [
          {
            cluster: pilotName,
            role: "pilot",
            creationCommand: "kind create cluster",
            drift: pilotDrift,
          },
          {
            cluster: secondName,
            role: "second-wave",
            creationCommand: "kind create cluster",
            drift: secondDrift,
          },
        ],
        cleanup,
        limits: [
          "The pinned Sveltos controllers were installed directly as a prerequisite on the throwaway management cluster.",
          "The reviewed ClusterProfile, not the Sveltos controller installation, was delivered through ConfigHub, OCI, and Argo CD.",
          "The portable OCI used a temporary anonymous registry; this is not a permanent public package.",
          "The proof used two local kind workload clusters. It does not prove a large production fleet or a failure-and-pause rollout.",
          "The proof covers this Kyverno ClusterProfile, not every Sveltos feature or add-on.",
        ],
      },
      status: {
        result: "pass",
        claim: "ConfigHub stored and approved a pilot Sveltos ClusterProfile, then approved one selector change that added a second staging cluster. Each revision was published at a different OCI digest and reconciled through Argo CD. Sveltos installed Kyverno 3.8.1 on the pilot first, then on both clusters, and repaired replica drift on each target.",
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

    if (pilotStarted || clusterPresent(pilotName)) {
      tryCommand("kind", ["delete", "cluster", "--name", pilotName], {
        timeout: 180_000,
      });
    }
    cleanup.pilotCluster = clusterPresent(pilotName) ? "fail" : "pass";

    if (secondStarted || clusterPresent(secondName)) {
      tryCommand("kind", ["delete", "cluster", "--name", secondName], {
        timeout: 180_000,
      });
    }
    cleanup.secondCluster = clusterPresent(secondName) ? "fail" : "pass";

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
  rollout,
}) {
  check(
    rollout === "pilot" || rollout === "next",
    `unsupported rollout label ${rollout}`,
  );
  const serviceAccountPath = join(
    workRoot,
    `${workloadName}-sveltos-workload-access.yaml`,
  );
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
  const registrationPath = join(
    workRoot,
    `${workloadName}-sveltos-registration.yaml`,
  );
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
    rollout: ${rollout}
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
      rollout,
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

function observeNoKyverno({
  managementName,
  workloadName,
  workloadKubeconfig,
}) {
  const releases = JSON.parse(
    helmCommand(workloadKubeconfig, [
      "list",
      "-A",
      "-o",
      "json",
    ]).output,
  );
  const kyvernoRelease = releases.find((release) => release.name === "kyverno");
  const namespace = workloadTry(
    workloadKubeconfig,
    ["get", "namespace", "kyverno", "-o", "json"],
  );
  const summaries = managementTry(managementName, [
    "get",
    "clustersummaries",
    "-A",
    "-o",
    "json",
  ]);
  const clusterSummary = summaries.ok
    ? (JSON.parse(summaries.output).items ?? []).find(
      (item) =>
        item.spec?.clusterName === workloadName
        && item.spec?.clusterNamespace === registrationNamespace
        && item.spec?.clusterType === "Sveltos"
        && (
          item.metadata?.labels?.["projectsveltos.io/cluster-profile-name"]
            === profileName
          || (item.metadata?.ownerReferences ?? []).some(
            (owner) =>
              owner.kind === "ClusterProfile" && owner.name === profileName,
          )
        ),
    )
    : null;
  const absent = !kyvernoRelease && !namespace.ok && !clusterSummary;
  return {
    result: absent ? "pass" : "fail",
    selected: false,
    helmReleasePresent: Boolean(kyvernoRelease),
    namespacePresent: namespace.ok,
    clusterSummaryPresent: Boolean(clusterSummary),
    ...(absent
      ? {}
      : {
        reason: "Kyverno or its Sveltos ClusterSummary was present before the fleet expansion",
      }),
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

function approveHeadRevision(
  context,
  space,
  unit,
  phaseName,
  expectedRevision,
) {
  const result = cubTry(context, [
    "unit",
    "approve",
    "--space",
    space,
    unit,
    "--revision",
    "HeadRevisionNum",
    "--wait",
    "--quiet",
  ]);
  if (result.ok) return;
  const current = cubJson(
    context,
    ["unit", "get", unit, "--space", space, "-o", "json"],
  ).Unit;
  check(
    Number(current.HeadRevisionNum) === Number(expectedRevision)
      && approvalCount(current.ApprovedBy) >= 1,
    `ConfigHub rejected the ${phaseName} approval before recording it: ${
      result.error
    }`,
  );
  phase(`${phaseName} approval recorded; waiting for delayed trigger completion`);
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
  tag,
}) {
  check(tag === "pilot" || tag === "fleet", `unsupported OCI tag ${tag}`);
  const outputRoot = join(workRoot, `portable-output-${tag}`);
  const pullRoot = join(workRoot, `portable-output-${tag}-pulled`);
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
  const localReference = `${registryHost}/${repository}:${tag}`;
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
    targetRevision: tag,
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
  sourceRevision,
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
  writeApplication(
    applicationPath,
    applicationName,
    sourceReference,
    sourceRevision,
  );
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
    sourceRevision,
    approvedConfigHubSpace: policySpace,
    destinationCluster: "management",
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function updateApplication({
  context,
  managementName,
  managementSpace,
  applicationName,
  applicationUnit,
  policySpace,
  sourceReference,
  sourceRevision,
  workRoot,
}) {
  const applicationPath = join(
    workRoot,
    `${applicationName}-${sourceRevision}.yaml`,
  );
  writeApplication(
    applicationPath,
    applicationName,
    sourceReference,
    sourceRevision,
  );
  cub(context, [
    "unit",
    "update",
    "--space",
    managementSpace,
    applicationUnit,
    applicationPath,
    "--change-desc",
    `Deliver the approved ${sourceRevision} ClusterProfile from ${policySpace}`,
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
    sourceRevision,
    approvedConfigHubSpace: policySpace,
    destinationCluster: "management",
    clusterRootReleaseDigest: rootRelease.manifestDigest,
  };
}

function writeApplication(
  path,
  applicationName,
  sourceReference,
  sourceRevision,
) {
  check(
    sourceRevision === "pilot" || sourceRevision === "fleet",
    `unsupported application source revision ${sourceRevision}`,
  );
  writeFileSync(path, `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${applicationName}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${sourceReference}
    targetRevision: ${sourceRevision}
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
  check(
    sourceDocs[0]?.spec?.clusterSelector?.matchLabels?.environment === "staging"
      && sourceDocs[0]?.spec?.clusterSelector?.matchLabels?.rollout === "pilot",
    "Sveltos pilot selector changed",
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
  const recordedTriggers = review?.policy?.filter?.triggerRefs ?? [];
  check(
    review?.organization === expectedPolicyOrg
      && review.policy?.profile === "catalog-standard"
      && review.policy?.resourceClass === "system-configuration"
      && review.policy?.approvalGate === approvalGate
      && (
        sameSet(recordedTriggers, expectedTriggers)
        || sameSet(recordedTriggers, historicalTriggers)
      ),
    "Sveltos policy record changed",
  );
  check(
    historicalTriggers.every((trigger) => expectedTriggers.includes(trigger)),
    "the current approval policy dropped a check used by the historical Sveltos run",
  );
  const pilot = review?.pilot;
  const fleet = review?.fleet;
  for (const [name, phaseReview] of [
    ["pilot", pilot],
    ["fleet", fleet],
  ]) {
    check(
      phaseReview?.beforeApproval?.result === "blocked"
        && phaseReview.beforeApproval.gate === approvalGate
        && phaseReview.afterApproval?.result === "allowed"
        && phaseReview.approval?.recordedApprovals >= 1
        && phaseReview.approval.approverIdentityRecordedInReceipt === false
        && phaseReview.approval.contentHashUnchanged === true,
      `Sveltos ${name} approval record changed`,
    );
    check(
      normalizeDigest(phaseReview.privateRelease?.manifestDigest)
        === phaseReview.privateRelease.manifestDigest
        && phaseReview.portableRelease?.objectsMatchApprovedData === true
        && phaseReview.portableRelease.objectCount === 1
        && phaseReview.portableRelease.anonymousPull === true
        && phaseReview.portableRelease.registryLifetime === "temporary"
        && phaseReview.portableRelease.targetRevision === name
        && phaseReview.portableRelease.approvedDataSha256
        === phaseReview.portableRelease.pulledDataSha256,
      `Sveltos ${name} OCI records changed`,
    );
  }
  check(
    pilot?.selector?.environment === "staging"
      && pilot.selector.rollout === "pilot"
      && pilot.approvedDataMatchesSource === true
      && fleet?.selector?.environment === "staging"
      && Object.keys(fleet.selector).length === 1
      && fleet.change?.path === "spec.clusterSelector.matchLabels.rollout"
      && fleet.change.before === "pilot"
      && fleet.change.after === "removed"
      && fleet.change.otherSourceFieldsChanged === false
      && fleet.approvedDataMatchesCandidate === true
      && Number(fleet.approval.revision) > Number(pilot.approval.revision)
      && fleet.portableRelease.manifestDigest
      !== pilot.portableRelease.manifestDigest,
    "Sveltos fleet selector change record changed",
  );
  const management = receipt.spec?.management;
  check(
    management?.creationCommand === "cub cluster up"
      && management.registrations?.length === 2
      && management.registrations.every(
        (registration) =>
          registration.method === "programmatic SveltosCluster registration"
          && registration.ready === true
          && registration.labels?.environment === "staging"
          && ["pilot", "next"].includes(registration.labels?.rollout)
          && registration.credential?.storedInRepository === false,
      )
      && new Set(
        management.registrations.map(
          (registration) => registration.labels.rollout,
        ),
      ).size === 2,
    "Sveltos cluster registration record changed",
  );
  const pilotWave = management?.waves?.pilot;
  const fleetWave = management?.waves?.fleet;
  verifyWaveDelivery(pilotWave, pilot, "pilot");
  verifyWaveDelivery(fleetWave, fleet, "fleet");
  check(
    pilotWave.targets?.length === 2
      && pilotWave.targets[0].selected === true
      && reconciliationPassed(pilotWave.targets[0].reconciliation)
      && pilotWave.targets[1].selected === false
      && pilotWave.targets[1].observation?.result === "pass"
      && pilotWave.targets[1].observation.helmReleasePresent === false
      && pilotWave.targets[1].observation.namespacePresent === false
      && pilotWave.targets[1].observation.clusterSummaryPresent === false,
    "Sveltos pilot target record changed",
  );
  check(
    fleetWave.targets?.length === 2
      && fleetWave.targets.every(
        (target) =>
          target.selected === true
          && reconciliationPassed(target.reconciliation),
      )
      && new Set(fleetWave.targets.map((target) => target.cluster)).size === 2,
    "Sveltos fleet target record changed",
  );
  check(
    receipt.spec?.workloads?.length === 2
      && new Set(receipt.spec.workloads.map((workload) => workload.role)).size
      === 2
      && receipt.spec.workloads.every(
        (workload) =>
          workload.creationCommand === "kind create cluster"
          && workload.drift?.result === "pass"
          && workload.drift.changedReplicas === 1
          && workload.drift.restoredReplicas === 3,
      ),
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

function verifyWaveDelivery(wave, review, expectedRevision) {
  check(
    wave?.source === "approved ConfigHub Unit data"
      && wave.applicationDelivery === "ConfigHub cluster Space release OCI"
      && wave.workloadDelivery === "temporary portable OCI"
      && wave.application?.source
      === review.portableRelease.clusterReference
      && wave.application.sourceRevision === expectedRevision
      && wave.argo?.result === "pass"
      && wave.argo.sync === "Synced"
      && wave.argo.health === "Healthy"
      && wave.argo.revision === review.portableRelease.manifestDigest
      && wave.approvedFieldsMatchLive === true
      && Array.isArray(wave.liveAddedFieldPaths),
    `Sveltos ${expectedRevision} Argo delivery record changed`,
  );
}

function reconciliationPassed(reconciliation) {
  return reconciliation?.result === "pass"
    && reconciliation.helmFeatureStatus === "Provisioned"
    && reconciliation.helmRelease?.name === "kyverno"
    && reconciliation.helmRelease?.chart === "kyverno-3.8.1"
    && reconciliation.deployments?.length === 4
    && reconciliation.deployments.every(
      (deployment) =>
        deployment.desired === deployment.available
        && deployment.observedGenerationMatches === true,
    );
}

function renderSummary(receipt) {
  const review = receipt.spec.configHubReview;
  const management = receipt.spec.management;
  const pilotWave = management.waves.pilot;
  const fleetWave = management.waves.fleet;
  const pilotTarget = pilotWave.targets.find((target) => target.selected);
  const secondPilotTarget = pilotWave.targets.find((target) => !target.selected);
  return `# ConfigHub rolls out a Sveltos profile in two waves

This run starts with two staging clusters. The reviewed Sveltos
\`ClusterProfile\` selects only the cluster labeled \`rollout=pilot\`. It installs
Kyverno 3.8.1 with three admission-controller replicas.

ConfigHub blocked that profile until its exact revision was approved. The approved
pilot profile was published as a private ConfigHub release and as a temporary
portable OCI. Argo CD reconciled the portable OCI digest on the management cluster.
Sveltos installed Kyverno on \`${pilotTarget.cluster}\` and left
\`${secondPilotTarget.cluster}\` unchanged.

The second revision removed one selector label:
\`spec.clusterSelector.matchLabels.rollout\`. No chart setting or other profile
field changed. ConfigHub blocked the new revision until it was approved, then
published it at a different OCI digest. Sveltos kept the pilot healthy and installed
Kyverno on the second staging cluster.

The test finally changed the admission-controller deployment from three replicas to
one on each cluster. Sveltos restored both deployments to three.

The temporary portable packages can be pulled without a ConfigHub account.
ConfigHub was used here because the two revisions needed stored history, policy,
approval, and named release records.

| Check | Result |
| --- | --- |
| Pilot blocked before approval | ${review.pilot.beforeApproval.result} |
| Pilot OCI | \`${review.pilot.portableRelease.manifestDigest}\` |
| Pilot selected | \`${pilotTarget.cluster}\` |
| Second cluster before expansion | No Kyverno release, namespace, or ClusterSummary |
| Fleet revision blocked before approval | ${review.fleet.beforeApproval.result} |
| Fleet selector change | Removed \`${review.fleet.change.path}\` |
| Fleet OCI | \`${review.fleet.portableRelease.manifestDigest}\` |
| Argo CD after fleet revision | ${fleetWave.argo.sync} and ${fleetWave.argo.health}; digest matched |
| Healthy Sveltos targets after expansion | ${fleetWave.targets.filter((target) => reconciliationPassed(target.reconciliation)).length}/2 |
| Replica drift repaired | ${receipt.spec.workloads.filter((workload) => workload.drift.result === "pass").length}/2 |
| Cleanup | ${Object.values(receipt.spec.cleanup).every((value) => value === "pass") ? "Pass" : "Fail"} |

## What this proves

One reviewed platform record can start with a pilot, then add a second cluster by
changing one declared selector. Both revisions moved from ConfigHub through OCI and
Argo CD to the Sveltos management cluster. The receipt records the OCI digest and
the result for each workload cluster.

## Limits

Sveltos itself was installed directly as a pinned prerequisite on the management
cluster. The portable OCI used a temporary registry. This was a two-cluster local
wave, not a large production fleet or a failure-and-pause test. It proves this
Kyverno profile rather than every Sveltos feature.

- [Reviewed pilot ClusterProfile](../../examples/sveltos/kyverno-fleet/clusterprofile-pilot.yaml)
- [Pinned source versions](../../examples/sveltos/kyverno-fleet/source-lock.yaml)
- [Committed receipt](../../runs/sveltos-oci-delivery-proof/receipt.yaml)
`;
}
