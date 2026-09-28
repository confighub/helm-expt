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
const allowedModes = new Set(["--run", "--generate", "--verify", "--generate-current", "--verify-current", "--self-test"]);
if (!allowedModes.has(mode)) {
  console.error(`Usage:
  node scripts/run-sveltos-oci-delivery-proof.mjs --run
  node scripts/run-sveltos-oci-delivery-proof.mjs --generate
  node scripts/run-sveltos-oci-delivery-proof.mjs --verify
  node scripts/run-sveltos-oci-delivery-proof.mjs --generate-current
  node scripts/run-sveltos-oci-delivery-proof.mjs --verify-current
  node scripts/run-sveltos-oci-delivery-proof.mjs --self-test`);
  process.exit(2);
}

const expectedPolicyOrg = "helm-catalog";
const approvalGate = "platform/require-approval/vet-approvedby";
const catalogOciTargetRef =
  "bitnami-redis-27-0-0-default-pilot-live-20260705/oci-target";
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
const nativeCheckWhere = `Space.Slug = 'platform' AND Slug IN (${expectedTriggers.map((ref) => `'${ref.split("/")[1]}'`).join(", ")})`;
const componentName = "sveltos-kyverno-oci-delivery";
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
const workflowReceiptPath = join(repoRoot, "runs", "sveltos-oci-delivery-workflow-proof", "receipt.yaml");
const workflowSummaryPath = join(repoRoot, "data", "sveltos-oci-delivery-workflow", "summary.md");
const profileName = "kyverno-staging";
const policyUnit = "clusterprofile";
const registrationNamespace = "projectsveltos";
const sveltosManifestUrl =
  "https://raw.githubusercontent.com/projectsveltos/sveltos/v1.12.0/manifest/manifest.yaml";

// The self-test swaps these three seams for fake ConfigHub and OCI surfaces
// and a fake clock; every live lane uses the real defaults.
let commandRunner = runRealCommand;
let sleeper = realSleep;
let timeSource = () => Date.now();

if (mode === "--run") {
  run();
} else if (mode === "--self-test") {
  selfTest();
} else if (mode === "--generate-current") {
  check(existsSync(workflowReceiptPath), `${relativeRepo(workflowReceiptPath)} is missing; no current native workflow run has been recorded`);
  const receipt = readYaml(workflowReceiptPath);
  verifyCurrentReceipt(receipt);
  write(workflowSummaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(workflowSummaryPath)}`);
} else if (mode === "--verify-current") {
  check(existsSync(workflowReceiptPath), `${relativeRepo(workflowReceiptPath)} is missing; no current native workflow run has been recorded`);
  const receipt = readYaml(workflowReceiptPath);
  verifyCurrentReceipt(receipt);
  check(existsSync(workflowSummaryPath) && readFileSync(workflowSummaryPath, "utf8") === renderSummary(receipt), `${relativeRepo(workflowSummaryPath)} is missing or stale; run --generate-current`);
  console.log("verified the current Sveltos OCI delivery proof");
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

  const topology = readNativeCheckTopology(policyContext);
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
    const pilotStored = cubJson(policyContext, ["unit", "get", policyUnit, "--space", policySpace, "-o", "json"]).Unit;
    check(
      canonicalDocs(parseDocs(storedData(policyContext, pilotStored)))
        === canonicalDocs(sourceDocs),
      "ConfigHub stored a different ClusterProfile",
    );
    const pilotNative = approveAndReleaseChangeOrder(
      policyContext,
      policySpace,
      policyUnit,
      pilotStored,
      "pilot",
    );
    const pilotApproved = cubJson(policyContext, ["unit", "get", policyUnit, "--space", policySpace, "-o", "json"]).Unit;
    check(pilotApproved.DataHash === pilotStored.DataHash, "approval changed the ClusterProfile content");
    const pilotPrivateRelease = pilotNative.release;
    phase("pilot review, approval, and private release passed");
    const pilotApprovedText = storedData(policyContext, pilotApproved);
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
        canonicalDocs(parseDocs(storedData(policyContext, current)))
          === canonicalDocs([fleetDoc]),
        `ConfigHub rejected the fleet update before storing it: ${
          fleetUpdate.error
        }`,
      );
      phase("fleet update stored; waiting for delayed trigger completion");
    }
    const fleetStored = cubJson(policyContext, ["unit", "get", policyUnit, "--space", policySpace, "-o", "json"]).Unit;
    check(
      canonicalDocs(parseDocs(storedData(policyContext, fleetStored)))
        === canonicalDocs([fleetDoc]),
      "ConfigHub stored a different fleet ClusterProfile",
    );
    check(
      Number(fleetStored.HeadRevisionNum) > Number(pilotApproved.HeadRevisionNum),
      "the fleet change did not create a new revision",
    );
    const fleetNative = approveAndReleaseChangeOrder(
      policyContext,
      policySpace,
      policyUnit,
      fleetStored,
      "fleet",
    );
    const fleetApproved = cubJson(policyContext, ["unit", "get", policyUnit, "--space", policySpace, "-o", "json"]).Unit;
    check(fleetApproved.DataHash === fleetStored.DataHash, "approval changed the fleet ClusterProfile content");
    const fleetPrivateRelease = fleetNative.release;
    const fleetApprovedText = storedData(policyContext, fleetApproved);
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
      kind: "SveltosOciDeliveryWorkflowApprovalProofReceipt",
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
            checks: topology,
            workflowApproval: "server-attested-changeworkflow-changeorder-v1",
          },
          pilot: {
            selector: {
              environment: "staging",
              rollout: "pilot",
            },
            contentHash: pilotStored.DataHash,
            beforeApproval: pilotNative.beforeApproval,
            approval: pilotNative.approval,
            afterApproval: pilotNative.afterApproval,
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
            contentHash: fleetStored.DataHash,
            beforeApproval: fleetNative.beforeApproval,
            approval: fleetNative.approval,
            afterApproval: fleetNative.afterApproval,
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
  writeYaml(workflowReceiptPath, receipt);
  write(workflowSummaryPath, renderSummary(receipt));
  verifyCurrentReceipt(receipt);
  console.log(
    `wrote ${relativeRepo(workflowReceiptPath)} and ${relativeRepo(workflowSummaryPath)}`,
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
  cub(context, ["component", "create", componentName, "--allow-exists", "--quiet"]);
  const component = cubJson(context, ["component", "get", componentName, "-o", "json"]).Component;
  check(component?.ComponentID, `${space} component creation returned no ComponentID`);
  cub(context, [
    "space", "create", space,
    "--component", component.ComponentID,
    "--label", "App=sveltos-kyverno-fleet",
    "--label", "ApplyPolicyProfile=catalog-standard",
    "--label", "Proof=sveltos-oci-delivery",
    "--label", "ResourceClass=system-configuration",
    "--label", "SourceType=sveltos",
    "--where-trigger", nativeCheckWhere,
    "--quiet",
  ]);
  cub(context, ["space", "update", space, "--release-target", catalogOciTargetRef, "--quiet"]);
  const bound = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(bound.ComponentID === component.ComponentID, `${space} is not bound to its Component`);
}

function readNativeCheckTopology(context) {
  const triggers = expectedTriggers.map((ref) => getByRef(context, "trigger", ref).Trigger);
  return {
    attachment: "direct nonapproval Trigger selector",
    whereTrigger: nativeCheckWhere,
    triggerRefs: expectedTriggers,
    triggerIds: triggers.map((row) => row.TriggerID).sort(),
    observedAt: new Date().toISOString(),
  };
}

function assertPolicySpace(context, space, expectedTriggerIds, expectedReleaseTargetId) {
  const actual = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(sameSet(actual.TriggerIDs ?? [], expectedTriggerIds), `${space} received the wrong Trigger set`);
  check(actual.ReleaseTargetID === expectedReleaseTargetId, `${space} received the wrong release target`);
}

function approveAndReleaseChangeOrder(context, space, unit, stored, stageName) {
  const source = cubJson(context, ["space", "get", space, "-o", "json"]).Space;
  check(source.ComponentID, `${stageName} source Space has no ComponentID`);
  const members = cubJson(context, ["unit", "list", "--space", space, "-o", "json"]).map((row) => row.Unit ?? row);
  check(members.length === 1 && members[0]?.UnitID === stored.UnitID, `${stageName} release would include Units beyond the reviewed subject`);
  const slug = `review-${stored.HeadRevisionNum}`;
  const dir = mkdtempSync(join(tmpdir(), "sveltos-oci-workflow-"));
  const file = join(dir, "workflow.json");
  try {
    const requirement = { Name: "review", Type: "Approval", Count: 1, AllowAuthors: true, IgnoreFail: false };
    const stage = { Name: "reviewed", WhereSpace: `SpaceID = '${source.SpaceID}'`, ReleasePrerequisites: ["review"] };
    writeFileSync(file, `${JSON.stringify({ Stages: [stage], AttestationPrerequisites: [requirement] })}\n`);
    cub(context, ["changeworkflow", "create", "--space", space, slug, "--filename", file, "--quiet"]);
    const workflow = cubJson(context, ["changeworkflow", "get", "--space", space, slug, "-o", "json"]).ChangeWorkflow;
    const observedStage = (workflow.Stages ?? []).find((row) => row.Name === "reviewed");
    const observedRequirement = (workflow.AttestationPrerequisites ?? []).find((row) => row.Name === "review");
    check(
      observedStage?.WhereSpace === stage.WhereSpace
        && (observedStage.ReleasePrerequisites ?? []).includes("review")
        && (observedRequirement?.Type ?? "Approval") === "Approval"
        && observedRequirement?.Count === 1
        && observedRequirement.AllowAuthors === true
        && (observedRequirement.IgnoreFail ?? false) === false,
      `${stageName} workflow requirement changed`,
    );
    cub(context, ["changeorder", "create", "--space", space, slug, "--component", source.ComponentID, "--in-scope-space", space, "--change-workflow", `${space}/${slug}`, "--quiet"]);
    const order = cubJson(context, ["changeorder", "get", "--space", space, slug, "-o", "json"]).ChangeOrder;
    check(order.ChangeWorkflowID === workflow.ChangeWorkflowID && order.EndTagID && Array.isArray(order.InScopeSpaceIDs) && order.InScopeSpaceIDs.length === 1 && order.InScopeSpaceIDs[0] === source.SpaceID, `${stageName} ChangeOrder is not exactly bound`);
    const head = cubJson(context, ["revision", "list", "--space", space, "--by-unit-id", stored.UnitID, "--where", `RevisionNum = ${stored.HeadRevisionNum}`, "-o", "json"]).map((row) => row.Revision ?? row);
    const chosen = cubJson(context, ["revision", "list", "--space", space, "--by-unit-id", stored.UnitID, "--change-order", order.ChangeOrderID, "-o", "json"]).map((row) => row.Revision ?? row);
    check(
      head.length === 1 && head[0]?.RevisionID === stored.HeadRevisionID && head[0]?.UnitID === stored.UnitID && Number(head[0]?.RevisionNum) === Number(stored.HeadRevisionNum) && head[0]?.DataHash === stored.DataHash
        && chosen.length === 1 && chosen[0]?.UnitID === stored.UnitID && chosen[0]?.RevisionID === head[0].RevisionID && Number(chosen[0]?.RevisionNum) === Number(head[0].RevisionNum) && chosen[0]?.DataHash === head[0].DataHash,
      `${stageName} ChangeOrder end tag does not select exactly the reviewed Unit revision`,
    );
    const revision = `ChangeOrder:${order.ChangeOrderID}`;
    const refused = cubTry(context, ["release", "publish", "--revision", revision, space, "-o", "json"]);
    check(!refused.ok && /requires review: 1 Approval attestation\(s\)/.test(refused.error), `${stageName} release did not return the workflow prerequisite refusal`);
    const result = cubJson(context, ["variant", "approve", space, "--change-order", `${space}/${slug}`, "--stage", "reviewed", "--revision", revision, "--where", `Slug = '${unit}'`, "-o", "json"]);
    const attestation = assertApprovalCreateResult({ result, space, changeOrderID: order.ChangeOrderID, unitID: stored.UnitID, revisionID: chosen[0].RevisionID, revisionNum: chosen[0].RevisionNum, stageName });
    const release = publishRelease(context, space, revision);
    return {
      beforeApproval: { result: "blocked", authority: "ChangeWorkflow.ReleasePrerequisite", changeOrderID: order.ChangeOrderID },
      approval: { authority: "server-attested-changeworkflow-changeorder-v1", workflowID: workflow.ChangeWorkflowID, changeOrderID: order.ChangeOrderID, endTagID: order.EndTagID, attestationID: attestation.AttestationID, revision: chosen[0].RevisionNum, contentHashUnchanged: true },
      afterApproval: { result: "allowed", authority: "ChangeWorkflow.ReleasePrerequisite", changeOrderID: order.ChangeOrderID },
      release,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertApprovalCreateResult({ result, space, changeOrderID, unitID, revisionID, revisionNum, stageName }) {
  const row = result.Spaces?.[0];
  const attestation = row?.Attestation;
  const subject = row?.Subjects?.[0];
  const skippedUnitsAreEmpty = !Object.hasOwn(row ?? {}, "SkippedUnits") || (Array.isArray(row.SkippedUnits) && row.SkippedUnits.length === 0);
  check(
    Array.isArray(result.Spaces)
      && result.Spaces.length === 1
      && row.SpaceSlug === space
      && !row.Error
      && Array.isArray(row.Subjects)
      && row.Subjects.length === 1
      && skippedUnitsAreEmpty
      && typeof attestation?.AttestationID === "string"
      && attestation.AttestationID.length > 0
      && attestation.Type === "Approval"
      && attestation.Result === "Pass"
      && attestation.ChangeOrderID === changeOrderID
      && subject?.UnitID === unitID
      && subject?.RevisionID === revisionID
      && Number(subject?.RevisionNum) === Number(revisionNum),
    `${stageName} approval did not bind the ChangeOrder revision`,
  );
  return attestation;
}

function publishRelease(context, space, revision) {
  const args = ["release", "publish"];
  if (revision) args.push("--revision", revision);
  args.push(space, "-o", "json");
  const response = cubJson(context, args, { timeout: 300_000 });
  const release = response.Release ?? response.release ?? response;
  const manifestDigest = normalizeDigest(release.ManifestDigest ?? release.manifestDigest);
  check(manifestDigest, `${space} release publish returned no manifest digest`);
  return { space, reference: `oci://${configHubOciHost}/space/${space}:latest`, manifestDigest, bundleDigest: normalizeDigest(release.Digest ?? release.digest), releaseId: String(release.ReleaseID ?? release.releaseId ?? "") };
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

// Configuration data is not a Unit field any more. It is read from the Unit's own
// data endpoint, which `cub unit data` calls, and it comes back as text.
function storedData(context, unit) {
  const space = unit.SpaceSlug || unit.SpaceID;
  const text = cub(context, ["unit", "data", unit.Slug, "--space", space]);
  check(text, `${space}/${unit.Slug} has no stored data`);
  return text;
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
  return commandRunner(file, args, options);
}

function runRealCommand(file, args, options = {}) {
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
    // Inline flag groups are non-capturing, so the $1 this replacement uses was
    // always empty and the key name was dropped along with the value. They are
    // also newer than the Node this runs on in CI, where the expression throws
    // and takes the whole redaction with it. A capturing group with the i flag
    // does what the line always meant.
    .replace(/\b(password|token|secret)\s*[:=]\s*\S+/gi, "$1=<redacted>")
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
  sleeper(milliseconds);
}

function realSleep(milliseconds) {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    milliseconds,
  );
}

function now() {
  return timeSource();
}

function phase(message) {
  console.log(`[sveltos-oci-delivery] ${message}`);
}

function verifyCurrentReceipt(receipt) {
  verifyReceipt(receipt);
  check(
    receipt.kind === "SveltosOciDeliveryWorkflowApprovalProofReceipt"
      && receipt.spec?.configHubReview?.policy?.workflowApproval === "server-attested-changeworkflow-changeorder-v1",
    "current receipt does not use native workflow approval",
  );
}

function verifyReceipt(receipt) {
  check(
    ["SveltosOciDeliveryProofReceipt", "SveltosOciDeliveryWorkflowApprovalProofReceipt"].includes(receipt.kind),
    "Sveltos OCI receipt kind changed",
  );
  const nativeWorkflowReceipt = receipt.kind === "SveltosOciDeliveryWorkflowApprovalProofReceipt";
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
      && (nativeWorkflowReceipt
        ? review.policy?.workflowApproval === "server-attested-changeworkflow-changeorder-v1"
          && !Object.hasOwn(review.policy ?? {}, "approvalGate")
          && !Object.hasOwn(review.policy ?? {}, "filter")
          && sameSet(review.policy?.checks?.triggerRefs ?? [], expectedTriggers)
        : review.policy?.approvalGate === approvalGate
          && (sameSet(recordedTriggers, expectedTriggers) || sameSet(recordedTriggers, historicalTriggers))),
    "Sveltos policy record changed",
  );
  check(
    historicalTriggers.filter((trigger) => trigger !== "platform/require-approval").every((trigger) => expectedTriggers.includes(trigger)),
    "the current policy dropped a nonapproval check used by the historical Sveltos run",
  );
  const pilot = review?.pilot;
  const fleet = review?.fleet;
  for (const [name, phaseReview] of [
    ["pilot", pilot],
    ["fleet", fleet],
  ]) {
    check(
      nativeWorkflowReceipt
        ? phaseReview?.beforeApproval?.result === "blocked"
          && phaseReview.beforeApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
          && phaseReview.afterApproval?.result === "allowed"
          && phaseReview.afterApproval.authority === "ChangeWorkflow.ReleasePrerequisite"
          && phaseReview.approval?.authority === "server-attested-changeworkflow-changeorder-v1"
          && typeof phaseReview.approval.workflowID === "string"
          && typeof phaseReview.approval.changeOrderID === "string"
          && typeof phaseReview.approval.endTagID === "string"
          && typeof phaseReview.approval.attestationID === "string"
          && phaseReview.approval.contentHashUnchanged === true
        : phaseReview?.beforeApproval?.result === "blocked"
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
  const nativeWorkflowReceipt = receipt.kind === "SveltosOciDeliveryWorkflowApprovalProofReceipt";
  const pilotApprovalNarrative = nativeWorkflowReceipt
    ? "ConfigHub's configured ChangeWorkflow refused the pilot ChangeOrder release until\none Approval attestation was recorded for its exact selected revision. The scoped\nChangeOrder release was then published as a private ConfigHub release and as a temporary\nportable OCI."
    : "ConfigHub blocked that profile until its exact revision was approved. The approved\npilot profile was published as a private ConfigHub release and as a temporary\nportable OCI.";
  const fleetApprovalNarrative = nativeWorkflowReceipt
    ? "field changed. ConfigHub's configured ChangeWorkflow refused that ChangeOrder release\nuntil its selected revision received an Approval attestation, then published it at a different OCI digest."
    : "field changed. ConfigHub blocked the new revision until it was approved, then\npublished it at a different OCI digest.";
  return `# ConfigHub rolls out a Sveltos profile in two waves

This run starts with two staging clusters. The reviewed Sveltos
\`ClusterProfile\` selects only the cluster labeled \`rollout=pilot\`. It installs
Kyverno 3.8.1 with three admission-controller replicas.

${pilotApprovalNarrative} Argo CD reconciled the portable OCI digest on the management cluster.
Sveltos installed Kyverno on \`${pilotTarget.cluster}\` and left
\`${secondPilotTarget.cluster}\` unchanged.

The second revision removed one selector label:
\`spec.clusterSelector.matchLabels.rollout\`. No chart setting or other profile
${fleetApprovalNarrative} Sveltos kept the pilot healthy and installed
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
- [Committed receipt](${receipt.kind === "SveltosOciDeliveryWorkflowApprovalProofReceipt" ? "../../runs/sveltos-oci-delivery-workflow-proof/receipt.yaml" : "../../runs/sveltos-oci-delivery-proof/receipt.yaml"})
`;
}

function selfTest() {
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-sveltos-oci-self-test-"));
  const realRunner = commandRunner;
  const realSleeper = sleeper;
  const realTime = timeSource;
  const context = "self-test-context";
  try {
    const hub = createFakeConfigHub();
    commandRunner = (file, args, options = {}) => {
      if (file === "cub") return hub.handle(args, options);
      if (file === "oras") return createFakeOciRegistry().handle(args, options);
      if (file === "tar") return realRunner(file, args, options);
      return { ok: false, status: 1, output: "", error: `the self-test fake surface refuses ${file}` };
    };
    sleeper = () => hub.tick();
    timeSource = () => 0;
    selfTestHelpers();
    const topology = readNativeCheckTopology(context);
    check(topology.triggerIds.length === expectedTriggers.length, "the native check topology did not come from the fake control plane");
    const space = "self-test-sveltos-space";
    createPolicySpace(context, space);
    assertPolicySpace(context, space, topology.triggerIds, hub.catalogTargetId);
    const sourceText = readFileSync(profilePath, "utf8");
    cub(context, ["unit", "create", "--space", space, policyUnit, profilePath, "--quiet"]);
    const pilot = cubJson(context, ["unit", "get", policyUnit, "--space", space, "-o", "json"]).Unit;
    const nativePilot = approveAndReleaseChangeOrder(context, space, policyUnit, pilot, "pilot");
    check(nativePilot.beforeApproval.result === "blocked" && nativePilot.afterApproval.result === "allowed", "pilot ChangeOrder approval bracket did not complete");
    const fleetPath = join(workRoot, "clusterprofile-fleet.yaml");
    const fleetDoc = structuredClone(parseDocs(sourceText)[0]);
    delete fleetDoc.spec.clusterSelector.matchLabels.rollout;
    writeDocuments(fleetPath, [fleetDoc]);
    cub(context, ["unit", "update", "--space", space, policyUnit, fleetPath, "-o", "json"]);
    const fleet = cubJson(context, ["unit", "get", policyUnit, "--space", space, "-o", "json"]).Unit;
    const nativeFleet = approveAndReleaseChangeOrder(context, space, policyUnit, fleet, "fleet");
    check(nativePilot.release.manifestDigest !== nativeFleet.release.manifestDigest, "fleet ChangeOrder release did not produce a distinct digest");
    hub.state.mismatchedChangeOrderRevision = true;
    cub(context, ["unit", "update", "--space", space, policyUnit, profilePath, "-o", "json"]);
    const mismatch = cubJson(context, ["unit", "get", policyUnit, "--space", space, "-o", "json"]).Unit;
    expectFailure(() => approveAndReleaseChangeOrder(context, space, policyUnit, mismatch, "mismatch"), /end tag does not select exactly the reviewed Unit revision/, "ChangeOrder revision mismatch refusal");
    hub.state.mismatchedChangeOrderRevision = false;
    hub.state.mismatchedHeadRevisionNum = true;
    expectFailure(() => approveAndReleaseChangeOrder(context, space, policyUnit, mismatch, "head mismatch"), /end tag does not select exactly the reviewed Unit revision/, "head revision mismatch refusal");
    hub.state.mismatchedHeadRevisionNum = false;
    hub.state.malformedSkippedUnits = true;
    expectFailure(() => approveAndReleaseChangeOrder(context, space, policyUnit, mismatch, "skipped units"), /approval did not bind the ChangeOrder revision/, "malformed skipped-units refusal");
    hub.state.malformedSkippedUnits = false;
    selfTestReceipt();
    console.log("sveltos OCI delivery self-test passed: native ChangeOrder refusal, exact approval and publication for both waves, and strict revision/result-shape refusals");
  } finally {
    commandRunner = realRunner;
    sleeper = realSleeper;
    timeSource = realTime;
    rmSync(workRoot, { recursive: true, force: true });
  }
}

function selfTestHelpers() {
  const orderedA = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: sample\n  namespace: demo\ndata:\n  alpha: "1"\n  beta: "2"\n';
  const orderedB = 'kind: ConfigMap\napiVersion: v1\nmetadata:\n  namespace: demo\n  name: sample\ndata:\n  beta: "2"\n  alpha: "1"\nstatus:\n  observed: true\n';
  check(
    canonicalDocs(parseDocs(orderedA)) === canonicalDocs(parseDocs(orderedB)),
    "canonicalDocs is sensitive to key order or status noise",
  );
  check(
    canonicalDocs(parseDocs(orderedA))
      !== canonicalDocs(parseDocs(orderedA.replace('alpha: "1"', 'alpha: "9"'))),
    "canonicalDocs missed a data change",
  );

  const source = {
    apiVersion: "config.projectsveltos.io/v1beta1",
    kind: "ClusterProfile",
    metadata: { name: "kyverno-staging" },
    spec: { clusterSelector: { matchLabels: { environment: "staging" } } },
  };
  const live = structuredClone(source);
  live.metadata.labels = { "app.kubernetes.io/instance": "sveltos-profile" };
  live.spec.syncMode = "Continuous";
  check(
    sourceFieldsMatchLive(source, live) === true,
    "an added live field broke the source projection",
  );
  const added = addedFieldPaths(source, live);
  check(
    added.includes("metadata.labels") && added.includes("spec.syncMode"),
    "added live fields were not reported",
  );
  const drifted = structuredClone(live);
  drifted.spec.clusterSelector.matchLabels.environment = "production";
  check(
    sourceFieldsMatchLive(source, drifted) === false,
    "a changed live field was not detected",
  );

  check(
    normalizeDigest(`SHA256:${"A".repeat(64)}`) === `sha256:${"a".repeat(64)}`
      && normalizeDigest("not-a-digest") === "",
    "normalizeDigest behavior changed",
  );
  check(
    sameSet(["b", "a"], ["a", "b"]) && !sameSet(["a"], ["a", "b"]),
    "sameSet behavior changed",
  );
  check(
    approvalCount([{ user: "one" }, { user: "two" }]) === 2
      && approvalCount({ first: 1, second: 1 }) === 2
      && approvalCount(null) === 0,
    "approvalCount shape handling changed",
  );
  check(
    safeRunId("2026-08-07T10:11:12Z") === "20260807101112",
    "safeRunId digit extraction changed",
  );
  expectFailure(() => safeRunId("proof"), /at least eight digits/, "short run-id refusal");
  const sanitized = sanitizeError(`password: hunter2-value token=${"a".repeat(48)}`);
  check(
    !sanitized.includes("hunter2") && !sanitized.includes("a".repeat(48)),
    "sanitizeError leaked a credential shape",
  );
}

function selfTestReceipt() {
  const receipt = readYaml(receiptPath);
  verifyReceipt(structuredClone(receipt));
  const tampers = [
    ["kind", (c) => { c.kind = "OtherReceipt"; }, /receipt kind changed/],
    ["result", (c) => { c.status.result = "fail"; }, /is not pass/],
    ["portable access", (c) => { c.spec.flow.access.portablePull = "account required"; }, /flow access record changed/],
    ["source hash", (c) => { c.spec.source.rawSha256 = "0".repeat(64); }, /source record changed/],
    ["policy triggers", (c) => { c.spec.configHubReview.policy.filter.triggerRefs = ["platform/bogus"]; }, /policy record changed/],
    ["pilot approval", (c) => { c.spec.configHubReview.pilot.beforeApproval.result = "allowed"; }, /pilot approval record changed/],
    ["fleet approvals", (c) => { c.spec.configHubReview.fleet.approval.recordedApprovals = 0; }, /fleet approval record changed/],
    ["digest reuse", (c) => { c.spec.configHubReview.fleet.portableRelease.manifestDigest = c.spec.configHubReview.pilot.portableRelease.manifestDigest; }, /fleet selector change record changed/],
    ["pilot wave", (c) => { c.spec.management.waves.pilot.targets[1].selected = true; }, /pilot target record changed/],
    ["fleet wave", (c) => { c.spec.management.waves.fleet.targets[0].selected = false; }, /fleet target record changed/],
    ["argo revision", (c) => { c.spec.management.waves.pilot.argo.revision = `sha256:${"0".repeat(64)}`; }, /pilot Argo delivery record changed/],
    ["drift", (c) => { c.spec.workloads[0].drift.result = "fail"; }, /drift record changed/],
    ["cleanup", (c) => { c.spec.cleanup.registry = "fail"; }, /cleanup did not pass/],
    ["identity leak", (c) => { c.spec.notes = "approved by someone@confighub.com"; }, /contains a user identity/],
    ["credential leak", (c) => { c.spec.notes = "ch_selftesttoken"; }, /contains a credential/],
  ];
  for (const [label, tamper, pattern] of tampers) {
    const clone = structuredClone(receipt);
    tamper(clone);
    expectFailure(() => verifyReceipt(clone), pattern, `receipt ${label}`);
  }
}

function createFakeConfigHub() {
  const catalogTargetId = "self-test-oci-target-0001";
  const spaces = new Map();
  const components = new Map();
  const units = new Map();
  const workflows = new Map();
  const orders = new Map();
  const approvals = new Set();
  let releaseSequence = 0;
  const state = {
    stripReleaseManifestDigest: false,
    triggerIdOverride: null,
    releaseTargetOverride: null,
    mismatchedChangeOrderRevision: false,
    mismatchedHeadRevisionNum: false,
    malformedSkippedUnits: false,
  };
  const key = (space, unit) => `${space}/${unit}`;
  const triggerId = (ref) => `self-test-trigger-${String(ref).split("/").at(-1)}`;
  const ok = (output) => ({ ok: true, status: 0, output, error: "" });
  const refuse = (error) => ({ ok: false, status: 1, output: "", error });
  const publicUnit = (unit) => { const { Data, ...row } = structuredClone(unit); return row; };
  const handle = (args) => {
    const { positionals, flags } = parseCubCommand(args);
    const [entity, verb, ...rest] = positionals;
    if (entity === "filter" && verb === "get") return refuse("current fake server rejects retired approval filter reads");
    if (entity === "trigger" && verb === "get") {
      if (rest[0] === "platform/require-approval") return refuse("current fake server rejects retired approval trigger reads");
      return ok(JSON.stringify({ Trigger: { TriggerID: triggerId(rest[0]) } }));
    }
    if (entity === "component" && verb === "create") { components.set(rest[0], { ComponentID: `self-test-component-${rest[0]}`, Slug: rest[0] }); return ok(""); }
    if (entity === "component" && verb === "get") { const component = components.get(rest[0]); return component ? ok(JSON.stringify({ Component: component })) : refuse("component not found"); }
    if (entity === "space" && verb === "create") {
      if (flags["trigger-filter"] || flags["where-trigger"] !== nativeCheckWhere) return refuse("current fake server requires direct nonapproval Trigger selector");
      if (![...components.values()].some((item) => item.ComponentID === flags.component)) return refuse("unknown component");
      spaces.set(rest[0], { Slug: rest[0], SpaceID: `self-test-space-${rest[0]}`, ComponentID: flags.component, TriggerIDs: state.triggerIdOverride ?? expectedTriggers.map(triggerId).sort(), ReleaseTargetID: null });
      return ok("");
    }
    if (entity === "space" && verb === "update") {
      const space = spaces.get(rest[0]); if (!space) return refuse("space not found");
      if (flags["refresh-triggers"]) return refuse("current fake server rejects retired trigger refresh");
      if (flags["release-target"]) space.ReleaseTargetID = state.releaseTargetOverride ?? catalogTargetId;
      return ok("");
    }
    if (entity === "space" && verb === "get") { const space = spaces.get(rest[0]); return space ? ok(JSON.stringify({ Space: structuredClone(space) })) : refuse("space not found"); }
    if (entity === "unit" && verb === "create") {
      const slug = rest[0]; const data = readFileSync(rest[1], "utf8"); const unit = { Slug: slug, SpaceSlug: flags.space, UnitID: `self-test-unit-${flags.space}-${slug}`, HeadRevisionID: `self-test-revision-${flags.space}-${slug}-1`, HeadRevisionNum: 1, Data: data, DataHash: sha256(data), ValidationErrors: {} };
      units.set(key(flags.space, slug), unit); return ok("");
    }
    if (entity === "unit" && verb === "update") {
      const unit = units.get(key(flags.space, rest[0])); if (!unit) return refuse("unit not found");
      unit.Data = readFileSync(rest[1], "utf8"); unit.DataHash = sha256(unit.Data); unit.HeadRevisionNum += 1; unit.HeadRevisionID = `self-test-revision-${flags.space}-${unit.Slug}-${unit.HeadRevisionNum}`; return ok(JSON.stringify({ Unit: publicUnit(unit) }));
    }
    if (entity === "unit" && verb === "get") { const unit = units.get(key(flags.space, rest[0])); return unit ? ok(JSON.stringify({ Unit: publicUnit(unit) })) : refuse("unit not found"); }
    if (entity === "unit" && verb === "list") {
      if (/ApprovedBy|ApplyGates/.test(`${flags.where ?? ""} ${flags.select ?? ""}`)) return refuse("current fake server rejects retired Unit approval aliases");
      return ok(JSON.stringify([...units.values()].filter((item) => item.SpaceSlug === flags.space).map((item) => ({ Unit: publicUnit(item) }))));
    }
    if (entity === "unit" && verb === "data") { const unit = units.get(key(flags.space, rest[0])); return unit ? ok(unit.Data) : refuse("unit not found"); }
    if (entity === "changeworkflow" && verb === "create") { workflows.set(`${flags.space}/${rest[0]}`, { ...JSON.parse(readFileSync(flags.filename, "utf8")), ChangeWorkflowID: `self-test-workflow-${flags.space}-${rest[0]}` }); return ok(""); }
    if (entity === "changeworkflow" && verb === "get") { const workflow = workflows.get(`${flags.space}/${rest[0]}`); return workflow ? ok(JSON.stringify({ ChangeWorkflow: workflow })) : refuse("workflow not found"); }
    if (entity === "changeorder" && verb === "create") {
      const workflow = workflows.get(flags["change-workflow"]); const space = spaces.get(flags.space);
      if (!workflow || !space || flags.component !== space.ComponentID) return refuse("workflow, space, or component not found");
      orders.set(`${flags.space}/${rest[0]}`, { ChangeOrderID: `self-test-changeorder-${flags.space}-${rest[0]}`, ChangeWorkflowID: workflow.ChangeWorkflowID, EndTagID: `self-test-endtag-${flags.space}-${rest[0]}`, InScopeSpaceIDs: [space.SpaceID] }); return ok("");
    }
    if (entity === "changeorder" && verb === "get") { const order = orders.get(`${flags.space}/${rest[0]}`); return order ? ok(JSON.stringify({ ChangeOrder: order })) : refuse("order not found"); }
    if (entity === "revision" && verb === "list") {
      const unit = [...units.values()].find((item) => item.SpaceSlug === flags.space && item.UnitID === flags["by-unit-id"]); if (!unit) return refuse("revision not found");
      const mismatch = flags["change-order"] ? state.mismatchedChangeOrderRevision : state.mismatchedHeadRevisionNum;
      const row = mismatch ? { ...publicUnit(unit), RevisionID: `${unit.HeadRevisionID}-mismatch`, RevisionNum: unit.HeadRevisionNum + 1, DataHash: `mismatch-${unit.DataHash}` } : { ...publicUnit(unit), RevisionID: unit.HeadRevisionID, RevisionNum: unit.HeadRevisionNum };
      return ok(JSON.stringify([row]));
    }
    if (entity === "variant" && verb === "approve") {
      const order = orders.get(flags["change-order"]); const slug = String(flags.where).match(/'([^']+)'/)?.[1]; const unit = units.get(key(rest[0], slug));
      if (!order || !unit || flags.stage !== "reviewed" || flags.revision !== `ChangeOrder:${order.ChangeOrderID}`) return refuse("invalid scoped approval");
      approvals.add(order.ChangeOrderID);
      const row = { SpaceSlug: rest[0], Attestation: { AttestationID: `self-test-attestation-${approvals.size}`, Type: "Approval", Result: "Pass", ChangeOrderID: order.ChangeOrderID }, Subjects: [{ UnitID: unit.UnitID, RevisionID: unit.HeadRevisionID, RevisionNum: unit.HeadRevisionNum }] };
      if (state.malformedSkippedUnits) row.SkippedUnits = "";
      return ok(JSON.stringify({ Spaces: [row] }));
    }
    if (entity === "release" && verb === "publish") {
      const id = String(flags.revision ?? "").replace("ChangeOrder:", "");
      const order = [...orders.values()].find((item) => item.ChangeOrderID === id);
      if (flags.revision && (!order || !approvals.has(id))) return refuse("requires review: 1 Approval attestation(s)");
      const rows = [...units.values()].filter((item) => item.SpaceSlug === rest[0]); const input = rows.map((item) => `${item.Slug}:${item.DataHash}:${item.HeadRevisionNum}`).join("|"); releaseSequence += 1;
      return ok(JSON.stringify({ Release: { ReleaseID: `self-test-release-${releaseSequence}`, Digest: `sha256:${sha256(`bundle:${input}`)}`, ManifestDigest: state.stripReleaseManifestDigest ? "" : `sha256:${sha256(`manifest:${input}:${releaseSequence}`)}` } }));
    }
    return refuse(`the self-test fake hub refuses: cub ${args.join(" ")}`);
  };
  return { state, handle, catalogTargetId, tick() {} };
}

function parseCubCommand(args) {
  const booleans = new Set(["--quiet", "--wait", "--patch", "--refresh-triggers", "--allow-exists"]);
  const positionals = [];
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("-") || token === "-") {
      positionals.push(token);
      continue;
    }
    if (booleans.has(token)) {
      flags[token.slice(2)] = true;
      continue;
    }
    const name = token.replace(/^--?/, "");
    flags[name] = args[index + 1];
    index += 1;
  }
  return { positionals, flags };
}

function createFakeOciRegistry() {
  const tags = new Map();
  const blobs = new Map();
  const state = { dropBundleOnPull: false, substituteBundle: null };
  const ok = (output) => ({ ok: true, status: 0, output, error: "" });
  const refuse = (error) => ({ ok: false, status: 1, output: "", error });
  const positionalsOf = (args) => {
    const valueFlags = new Set(["--artifact-type", "--format", "--output"]);
    const positionals = [];
    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      if (valueFlags.has(token)) {
        index += 1;
        continue;
      }
      if (token.startsWith("--")) continue;
      positionals.push(token);
    }
    return positionals;
  };
  const outputFlag = (args) => args[args.indexOf("--output") + 1];
  const handle = (args, options = {}) => {
    const positionals = positionalsOf(args);
    if (positionals[0] === "push") {
      const [, reference, layerSpec] = positionals;
      const bytes = readFileSync(join(options.cwd, layerSpec.split(":")[0]));
      const digest = `sha256:${sha256(bytes)}`;
      tags.set(reference, digest);
      blobs.set(digest, Buffer.from(bytes));
      return ok(JSON.stringify({ reference, digest }));
    }
    if (positionals[0] === "manifest" && positionals[1] === "fetch") {
      const reference = positionals[2];
      if (!tags.has(reference)) return refuse(`unknown reference ${reference}`);
      return ok(JSON.stringify({
        digest: tags.get(reference),
        mediaType: "application/vnd.oci.image.manifest.v1+json",
      }));
    }
    if (positionals[0] === "pull") {
      const reference = positionals[1];
      const digest = reference.split("@")[1];
      const bytes = state.substituteBundle ?? blobs.get(digest);
      if (!bytes) return refuse(`unknown digest ${digest}`);
      const output = outputFlag(args);
      mkdirSync(output, { recursive: true });
      if (!state.dropBundleOnPull) {
        writeFileSync(join(output, "bundle.tar.gz"), bytes);
      }
      return ok("");
    }
    return refuse(`the self-test fake registry refuses: oras ${args.join(" ")}`);
  };
  return { state, handle };
}

function buildBundle(root, text) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "clusterprofile.yaml"), text);
  command("tar", ["-czf", join(root, "bundle.tar.gz"), "clusterprofile.yaml"], { cwd: root });
  return readFileSync(join(root, "bundle.tar.gz"));
}

function expectFailure(fn, pattern, label) {
  let error = null;
  try {
    fn();
  } catch (caught) {
    error = caught;
  }
  check(
    error && pattern.test(String(error.message)),
    `${label}: expected ${pattern}, got ${error?.message ?? "success"}`,
  );
}
