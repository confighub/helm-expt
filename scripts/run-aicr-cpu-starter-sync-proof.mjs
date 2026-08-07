#!/usr/bin/env node

// Live sync proof for one reviewed CPU starter component on kind.
//
// This is the starter's first deliberate step past the config plane, and it
// takes exactly one step. The reviewed change from the committed variant
// receipt (the gp3 storage class overridden to the cluster-default standard
// class) is applied to the committed kube-prometheus-stack bytes, the result
// travels as one OCI artifact with the six untouched components, and a running
// Argo CD on a throwaway kind cluster syncs the reviewed component with its
// declared CRD prerequisite first, in the order the sync-waves state.
//
// The receipt requires the sync to succeed, the component to reach Healthy,
// and the reviewed field to become real: the Prometheus volume claim must bind
// with the standard storage class, which is exactly what the reviewed override
// exists to make possible on a cluster without AWS storage. Scope is proven,
// not implied: only the prerequisite and the reviewed component are applied,
// and every other component destination namespace stays absent.
//
// The receipt chains three records: the starter's committed platform digest,
// the training entry's digest behind it, and the variant receipt whose
// reviewed change this run realizes.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  readYamlText,
  relativeRepo,
  repoRoot,
  sha256,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const exampleRoot = join(repoRoot, "examples", "aicr", "cpu-starter");
const variantReceiptPath = join(repoRoot, "runs", "aicr-cpu-starter-variant", "receipt.yaml");
const receiptPath = join(repoRoot, "runs", "aicr-cpu-starter-sync", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "aicr-cpu-starter-sync", "summary.md");
const repository = "aicr-cpu-starter-reviewed";
const artifactType = "application/vnd.confighub.kubernetes.config.v1";
const argoVersion = "v3.4.5";
const argoManifestUrl = `https://raw.githubusercontent.com/argoproj/argo-cd/${argoVersion}/manifests/install.yaml`;
const SYNC_WAVE_ANNOTATION = "argocd.argoproj.io/sync-wave";
const REVIEWED_COMPONENT = "kube-prometheus-stack";
const PREREQUISITE_COMPONENT = "prometheus-operator-crds";

const mode = process.argv[2] ?? "--verify";
if (!["--run", "--generate", "--verify", "--self-test"].includes(mode)) {
  console.error(`Usage:
  node scripts/run-aicr-cpu-starter-sync-proof.mjs --run
  node scripts/run-aicr-cpu-starter-sync-proof.mjs --generate
  node scripts/run-aicr-cpu-starter-sync-proof.mjs --verify
  node scripts/run-aicr-cpu-starter-sync-proof.mjs --self-test`);
  process.exit(2);
}

if (mode === "--run") {
  run();
} else if (mode === "--generate") {
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  write(summaryPath, renderSummary(receipt));
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} is missing; run the live proof`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run aicr-starter-sync:generate`);
  const receipt = readYaml(receiptPath);
  verifyReceipt(receipt, loadExpectations());
  check(
    readFileSync(summaryPath, "utf8") === renderSummary(receipt),
    `${relativeRepo(summaryPath)} is stale; run npm run aicr-starter-sync:generate`,
  );
  console.log("verified the CPU starter reviewed-component sync proof");
} else {
  selfTest();
  console.log("verified the CPU starter sync receipt checks against fake surfaces");
}

// loadExpectations reads the committed surfaces this receipt must chain: the
// starter digest index, the rendered files, and the variant receipt whose
// reviewed change the sync realizes. Overrides exist only for the self-test.
function loadExpectations(rootOverride, variantReceiptOverride) {
  const root = rootOverride ?? exampleRoot;
  const index = JSON.parse(readFileSync(join(root, "digest-index", "platform-index.json"), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), "the starter digest index records no platform digest");
  const derivedFrom = index.spec?.derivedFrom ?? {};
  const renderedRoot = join(root, "argocd-rendered");
  const files = listFiles(join(renderedRoot, "templates"))
    .filter((path) => path.endsWith(".yaml"))
    .sort();
  const rows = files.map((path) => {
    const text = readFileSync(path, "utf8");
    const docs = parseDocs(text).map(stripCommentMetadata);
    check(docs.length === 1, `${relativeRepo(path)}: expected exactly one document`);
    return {
      file: relativeRepo(path).slice(`${relativeRepo(renderedRoot)}/`.length),
      text,
      sha256: sha256(text),
      doc: docs[0],
      name: docs[0].metadata?.name ?? "",
    };
  });
  const reviewedRow = rows.find((row) => row.name === REVIEWED_COMPONENT);
  check(reviewedRow, `the starter has no ${REVIEWED_COMPONENT} Application`);
  const prerequisiteRow = rows.find((row) => row.name === PREREQUISITE_COMPONENT);
  check(prerequisiteRow, `the starter has no ${PREREQUISITE_COMPONENT} Application`);

  const variantReceipt = readYaml(variantReceiptOverride ?? variantReceiptPath);
  const change = variantReceipt.spec?.change ?? {};
  check(
    typeof change.searchValue === "string" && change.searchValue.includes(change.before ?? ""),
    "the variant receipt records no reviewed search value",
  );
  const occurrences = reviewedRow.text.split(change.searchValue).length - 1;
  check(
    occurrences === 1,
    `the reviewed search value appears ${occurrences} times in the committed ${REVIEWED_COMPONENT} file; expected exactly one`,
  );
  const reviewedText = reviewedRow.text.replace(change.searchValue, change.replaceValue);
  const monitoringNamespace = String(reviewedRow.doc.spec?.destination?.namespace ?? "");
  check(monitoringNamespace, "the reviewed Application names no destination namespace");
  const otherDestinations = [...new Set(
    rows
      .filter((row) => ![REVIEWED_COMPONENT, PREREQUISITE_COMPONENT].includes(row.name))
      .map((row) => String(row.doc.spec?.destination?.namespace ?? ""))
      .filter((namespace) => namespace && namespace !== "argocd" && namespace !== monitoringNamespace),
  )].sort();

  return {
    platformDigest,
    derivedFrom,
    rows,
    reviewedRow,
    prerequisiteRow,
    reviewedText,
    reviewedSha256: sha256(reviewedText),
    monitoringNamespace,
    otherDestinations,
    change: {
      before: change.before,
      after: change.after,
      searchValue: change.searchValue,
      replaceValue: change.replaceValue,
      variantReceiptName: variantReceipt.metadata?.name ?? "",
    },
  };
}

function run() {
  check(
    process.env.HELM_EXPT_ALLOW_KIND_CLUSTER === "1",
    "set HELM_EXPT_ALLOW_KIND_CLUSTER=1 to confirm this throwaway kind cluster run",
  );
  for (const [tool, args] of [
    ["docker", ["version"]],
    ["kind", ["version"]],
    ["kubectl", ["version", "--client"]],
    ["oras", ["version"]],
    ["curl", ["--version"]],
  ]) {
    check(tryCommand(tool, args).ok, `${tool} is required for the sync proof`);
  }

  const expectations = loadExpectations();
  check(expectations.rows.length === 7, "the committed starter no longer holds seven Applications");
  check(expectations.change.after === "standard", "the reviewed change no longer targets the standard storage class");

  const observedAt = new Date().toISOString();
  const startedMs = Date.parse(observedAt);
  const runId = safeRunId(process.env.HELM_EXPT_PROOF_RUN_ID || observedAt);
  const clusterName = `hx-aicr-starter-sync-${runId}`;
  const container = `helm-expt-starter-sync-${runId}`;
  const workRoot = mkdtempSync(join(tmpdir(), "helm-expt-starter-sync-"));
  const kubeconfigPath = join(workRoot, "kubeconfig");
  let registryStarted = false;
  let clusterStarted = false;
  let receipt;
  const cleanup = { cluster: "not-created", registry: "not-started", localFiles: "pending" };

  try {
    check(
      !command("kind", ["get", "clusters"]).split("\n").includes(clusterName),
      `refusing to reuse existing kind cluster ${clusterName}`,
    );

    // Stage the reviewed artifact: six untouched files plus the reviewed
    // component, exactly the shape the variant proof reviewed in ConfigHub.
    const stagedRoot = join(workRoot, "staged");
    for (const row of expectations.rows) {
      const text = row.name === REVIEWED_COMPONENT ? expectations.reviewedText : row.text;
      write(join(stagedRoot, row.file), text);
    }

    command("docker", ["run", "-d", "--rm", "--name", container, "-p", "127.0.0.1::5000", "registry:2"]);
    registryStarted = true;
    cleanup.registry = "pending";
    const portOutput = command("docker", ["port", container, "5000/tcp"]).trim();
    const registryPort = portOutput.match(/:(\d+)$/)?.[1] ?? "";
    check(registryPort, `could not determine the temporary registry port from ${portOutput}`);
    const registry = `localhost:${registryPort}`;
    waitForRegistry(registry);

    const registryRef = `${registry}/${repository}:0.14.0`;
    command(
      "oras",
      [
        "push",
        "--plain-http",
        "--artifact-type",
        artifactType,
        registryRef,
        ...expectations.rows.map((row) => `${row.file}:application/yaml`),
      ],
      { cwd: stagedRoot },
    );
    const pushedDigest = command("oras", ["resolve", "--plain-http", registryRef]).trim();
    check(/^sha256:[0-9a-f]{64}$/.test(pushedDigest), `oras resolve returned no digest: ${pushedDigest}`);

    const pulledRoot = join(workRoot, "pulled");
    command("oras", ["pull", "--plain-http", "--output", pulledRoot, registryRef]);
    check(
      sha256(readFileSync(join(pulledRoot, expectations.reviewedRow.file), "utf8"))
        === expectations.reviewedSha256,
      "the OCI transport changed the reviewed component",
    );

    command("kind", ["create", "cluster", "--name", clusterName, "--kubeconfig", kubeconfigPath, "--wait", "180s"], {
      timeout: 420_000,
    });
    clusterStarted = true;
    cleanup.cluster = "pending";
    const kubectl = (args, options = {}) =>
      command("kubectl", ["--kubeconfig", kubeconfigPath, ...args], { timeout: 360_000, ...options });

    kubectl(["create", "namespace", "argocd"]);
    kubectl(["apply", "--server-side", "-n", "argocd", "-f", argoManifestUrl], { timeout: 300_000 });
    kubectl(["wait", "--for=condition=Established", "crd/applications.argoproj.io", "--timeout=120s"]);
    kubectl(["-n", "argocd", "rollout", "status", "deployment/argocd-repo-server", "--timeout=300s"]);
    kubectl(["-n", "argocd", "rollout", "status", "statefulset/argocd-application-controller", "--timeout=300s"]);

    const readApplication = (name) =>
      JSON.parse(kubectl(["get", "application", name, "-n", "argocd", "-o", "json"]));
    const awaitSyncedHealthy = (name, timeoutSeconds) => {
      for (let elapsed = 0; elapsed < timeoutSeconds; elapsed += 10) {
        const app = readApplication(name);
        const sync = app.status?.sync?.status ?? "";
        const health = app.status?.health?.status ?? "";
        const phase = app.status?.operationState?.phase ?? "";
        if (sync === "Synced" && health === "Healthy" && phase === "Succeeded") {
          return { syncStatus: sync, healthStatus: health, operationPhase: phase };
        }
        check(
          !["Failed", "Error"].includes(phase),
          `${name}: sync operation ended in ${phase}: ${app.status?.operationState?.message ?? "no message"}`,
        );
        command("sleep", ["10"]);
      }
      const app = readApplication(name);
      throw new Error(
        `${name} did not reach Synced/Healthy within ${timeoutSeconds}s (sync=${app.status?.sync?.status}, health=${app.status?.health?.status}, phase=${app.status?.operationState?.phase})`,
      );
    };

    // Wave order across Applications is a sequencing decision, so the proof
    // makes it explicitly: the CRD prerequisite first, awaited to Healthy,
    // then the reviewed component.
    kubectl(["apply", "-f", join(pulledRoot, expectations.prerequisiteRow.file)]);
    const prerequisite = awaitSyncedHealthy(PREREQUISITE_COMPONENT, 600);

    kubectl(["apply", "-f", join(pulledRoot, expectations.reviewedRow.file)]);
    const reviewed = awaitSyncedHealthy(REVIEWED_COMPONENT, 1200);

    // The reviewed field made real: the Prometheus volume claim exists, is
    // bound, and carries the standard storage class the review selected.
    const pvcList = JSON.parse(
      kubectl(["get", "pvc", "-n", expectations.monitoringNamespace, "-o", "json"]),
    );
    const pvcs = (pvcList.items ?? []).map((item) => ({
      name: item.metadata?.name ?? "",
      storageClassName: item.spec?.storageClassName ?? "",
      phase: item.status?.phase ?? "",
    }));
    check(pvcs.length > 0, `no PersistentVolumeClaim exists in ${expectations.monitoringNamespace}`);
    for (const pvc of pvcs) {
      check(
        pvc.storageClassName === expectations.change.after && pvc.phase === "Bound",
        `${pvc.name}: expected a Bound claim with the ${expectations.change.after} class, found ${pvc.phase}/${pvc.storageClassName}`,
      );
    }

    // Scope, proven: only the two Applications exist, and every other
    // component destination namespace stays absent.
    const applications = JSON.parse(kubectl(["get", "application", "-n", "argocd", "-o", "json"]));
    const applicationNames = (applications.items ?? []).map((item) => item.metadata?.name ?? "").sort();
    check(
      JSON.stringify(applicationNames) === JSON.stringify([REVIEWED_COMPONENT, PREREQUISITE_COMPONENT].sort()),
      `unexpected Applications on the cluster: ${applicationNames.join(", ")}`,
    );
    for (const namespace of expectations.otherDestinations) {
      check(
        !tryCommand("kubectl", ["--kubeconfig", kubeconfigPath, "get", "namespace", namespace]).ok,
        `component namespace ${namespace} exists; scope broke`,
      );
    }

    const durationSeconds = Math.round((Date.now() - startedMs) / 1000);
    receipt = {
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterSyncProofReceipt",
      metadata: { name: "aicr-cpu-starter-v0-14-0-sync" },
      spec: {
        observedAt,
        durationSeconds,
        input: {
          format: "reviewed CPU starter literal configuration OCI",
          committedEntry: relativeRepo(exampleRoot),
          starterPlatformDigest: expectations.platformDigest,
          derivedFromEntry: expectations.derivedFrom.entry,
          derivedFromPlatformDigest: expectations.derivedFrom.platformDigest,
          reviewedChange: {
            variantReceipt: relativeRepo(variantReceiptPath),
            variantReceiptName: expectations.change.variantReceiptName,
            before: expectations.change.before,
            after: expectations.change.after,
            reviewedComponentSha256: expectations.reviewedSha256,
          },
          temporaryReference: `oci://${registryRef}`,
          digest: pushedDigest,
        },
        cluster: {
          shape: "throwaway kind cluster with an isolated kubeconfig",
          creationCommand: "kind create cluster",
          argoCd: {
            version: argoVersion,
            installManifest: argoManifestUrl,
            method: "pinned upstream manifest applied server-side as a cluster prerequisite",
          },
        },
        sync: {
          prerequisite: {
            component: PREREQUISITE_COMPONENT,
            reason: "the reviewed component sets crds.enabled false and its sync-wave places the CRD chart first",
            ...prerequisite,
          },
          reviewed: {
            component: REVIEWED_COMPONENT,
            ...reviewed,
            persistentVolumeClaims: pvcs,
          },
          scope: {
            applicationsApplied: [PREREQUISITE_COMPONENT, REVIEWED_COMPONENT],
            otherComponentsApplied: false,
            otherNamespacesAbsent: expectations.otherDestinations,
          },
        },
        cleanup,
        limits: [
          "This receipt syncs exactly one reviewed component plus its declared CRD prerequisite. The other five starter components stay config-plane and were proven absent.",
          "The sync ran on a throwaway kind cluster; it claims nothing about production clusters, AWS, or GPU nodes.",
          "The reviewed change came from the committed variant receipt; this run realizes that change, it does not re-review it.",
          "Upstream charts were fetched from their public repository during the sync; their contents are pinned by the Application targetRevision, not re-verified here.",
        ],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        argoCdInstall: "pass",
        prerequisiteSynced: "pass",
        reviewedComponentSynced: "pass",
        reviewedFieldRealized: "pass",
        scopeHeld: "pass",
        claim:
          "The reviewed storage-class override from the variant receipt became real: Argo CD synced the CRD prerequisite and then kube-prometheus-stack on a throwaway kind cluster, both reached Synced and Healthy, every Prometheus volume claim bound with the cluster-default standard class the review selected, and the other five starter components stayed config-plane.",
      },
    };
  } finally {
    if (clusterStarted) {
      const deleted = tryCommand("kind", ["delete", "cluster", "--name", clusterName]);
      const gone = !command("kind", ["get", "clusters"]).split("\n").includes(clusterName);
      cleanup.cluster = deleted.ok && gone ? "pass" : "fail";
    }
    if (registryStarted) {
      const stopped = tryCommand("docker", ["stop", container]);
      const absent = waitForContainerRemoval(container);
      cleanup.registry = stopped.ok && absent ? "pass" : "fail";
    }
    try {
      rmSync(workRoot, { recursive: true, force: true });
      cleanup.localFiles = existsSync(workRoot) ? "fail" : "pass";
    } catch {
      cleanup.localFiles = "fail";
    }
  }

  check(receipt, "the CPU starter sync proof did not complete");
  check(
    Object.values(cleanup).every((value) => value === "pass"),
    `the CPU starter sync proof cleanup failed: ${JSON.stringify(cleanup)}`,
  );
  writeYaml(receiptPath, receipt);
  write(summaryPath, renderSummary(receipt));
  verifyReceipt(readYaml(receiptPath), loadExpectations());
  console.log(`wrote ${relativeRepo(receiptPath)} and ${relativeRepo(summaryPath)}`);
}

function verifyReceipt(receipt, expectations) {
  check(receipt.kind === "AicrCpuStarterSyncProofReceipt", "CPU starter sync receipt kind changed");
  check(receipt.status?.result === "pass", "CPU starter sync proof is not pass");
  for (const lane of [
    "ociTransport",
    "clusterUp",
    "argoCdInstall",
    "prerequisiteSynced",
    "reviewedComponentSynced",
    "reviewedFieldRealized",
    "scopeHeld",
  ]) {
    check(receipt.status?.[lane] === "pass", `CPU starter sync receipt lane ${lane} did not pass`);
  }
  const input = receipt.spec?.input ?? {};
  check(
    input.starterPlatformDigest === expectations.platformDigest,
    "CPU starter sync receipt no longer matches the committed starter platform digest",
  );
  check(
    input.derivedFromPlatformDigest === expectations.derivedFrom.platformDigest,
    "CPU starter sync receipt no longer matches the training-entry derivation digest",
  );
  check(
    input.reviewedChange?.reviewedComponentSha256 === expectations.reviewedSha256,
    "CPU starter sync receipt reviewed bytes differ from the committed variant change applied to the committed component",
  );
  check(
    input.reviewedChange?.before === expectations.change.before
      && input.reviewedChange?.after === expectations.change.after,
    "CPU starter sync receipt no longer records the reviewed before/after values",
  );
  const sync = receipt.spec?.sync ?? {};
  check(
    sync.prerequisite?.component === PREREQUISITE_COMPONENT
      && sync.prerequisite?.syncStatus === "Synced"
      && sync.prerequisite?.healthStatus === "Healthy",
    "CPU starter sync receipt prerequisite evidence is incomplete",
  );
  check(
    sync.reviewed?.component === REVIEWED_COMPONENT
      && sync.reviewed?.syncStatus === "Synced"
      && sync.reviewed?.healthStatus === "Healthy"
      && sync.reviewed?.operationPhase === "Succeeded",
    "CPU starter sync receipt reviewed-component evidence is incomplete",
  );
  const pvcs = sync.reviewed?.persistentVolumeClaims ?? [];
  check(
    pvcs.length > 0
      && pvcs.every((pvc) => pvc.storageClassName === expectations.change.after && pvc.phase === "Bound"),
    "CPU starter sync receipt does not show every volume claim Bound with the reviewed storage class",
  );
  check(
    sync.scope?.otherComponentsApplied === false
      && JSON.stringify(sync.scope?.otherNamespacesAbsent) === JSON.stringify(expectations.otherDestinations),
    "CPU starter sync receipt scope evidence does not cover every other component destination",
  );
  check(
    Object.values(receipt.spec?.cleanup ?? {}).every((value) => value === "pass"),
    "the CPU starter sync proof cleanup did not pass",
  );
  check(
    receipt.spec?.limits?.some((limit) => limit.includes("exactly one reviewed component")),
    "the CPU starter sync receipt must state its one-component scope",
  );
  check(
    !Number.isNaN(Date.parse(receipt.spec?.observedAt ?? "")),
    "the CPU starter sync receipt records no valid timestamp",
  );
}

function renderSummary(receipt) {
  const input = receipt.spec.input;
  const sync = receipt.spec.sync;
  return `# CPU starter reviewed-component sync proof

**UNOFFICIAL/EXPERIMENTAL.** This page is generated from the committed live
receipt. Rerun the throwaway-cluster proof with
\`npm run aicr-starter-sync:run\`; verify it without external access with
\`npm run aicr-starter-sync:verify\`.

The reviewed change from the
[variant receipt](../../runs/aicr-cpu-starter-variant/receipt.yaml) became
real on a cluster. The committed \`${sync.reviewed.component}\` bytes with the
reviewed \`${input.reviewedChange.before}\` to
\`${input.reviewedChange.after}\` storage-class override traveled as one OCI
artifact with the six untouched components, and Argo CD
${receipt.spec.cluster.argoCd.version} on a throwaway kind cluster synced the
\`${sync.prerequisite.component}\` CRD prerequisite first and then the
reviewed component, in the order the sync-waves state. Both reached Synced and
Healthy, and every Prometheus volume claim bound with the
\`${input.reviewedChange.after}\` class the review selected
(${sync.reviewed.persistentVolumeClaims.map((pvc) => `\`${pvc.name}\``).join(", ")}).

Scope was proven, not implied: exactly two Applications existed on the
cluster, and every other component destination namespace
(${sync.scope.otherNamespacesAbsent.join(", ")}) stayed absent. The run took
${receipt.spec.durationSeconds} seconds on ${receipt.spec.observedAt}; the
cluster, registry, and working files were removed afterward.

## Limits

${receipt.spec.limits.map((limit) => `- ${limit}`).join("\n")}
`;
}

// The self-test exercises the receipt verifier against fake surfaces only: a
// fake starter tree, a fake variant receipt, and a fake sync receipt
// consistent with both.
function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), "aicr-starter-sync-self-test-"));
  try {
    const root = join(scratch, "starter");
    const kpsTemplate = [
      "apiVersion: argoproj.io/v1alpha1",
      "kind: Application",
      "metadata:",
      "  annotations:",
      `    ${SYNC_WAVE_ANNOTATION}: "7"`,
      `  name: ${REVIEWED_COMPONENT}`,
      "  namespace: argocd",
      "spec:",
      "  destination:",
      "    namespace: monitoring",
      "    server: https://kubernetes.default.svc",
      "  source:",
      "    chart: kube-prometheus-stack",
      "    repoURL: https://charts.invalid/fixture",
      "    targetRevision: 1.2.3",
      "    helm:",
      "      values: |-",
      "        prometheus:",
      "          prometheusSpec:",
      "            storageSpec:",
      "              volumeClaimTemplate:",
      "                spec:",
      "                  storageClassName: gp3",
      "",
    ].join("\n");
    const crdsTemplate = kpsTemplate
      .replaceAll(REVIEWED_COMPONENT, PREREQUISITE_COMPONENT)
      .replace('sync-wave: "7"', 'sync-wave: "6"')
      .replace("storageClassName: gp3", "storageClassName: none");
    const otherTemplate = kpsTemplate
      .replaceAll(REVIEWED_COMPONENT, "fixture-other")
      .replace('sync-wave: "7"', 'sync-wave: "9"')
      .replace("namespace: monitoring", "namespace: fixture-other-ns")
      .replace("storageClassName: gp3", "storageClassName: none");
    write(join(root, "argocd-rendered", "templates", "kube-prometheus-stack.yaml"), kpsTemplate);
    write(join(root, "argocd-rendered", "templates", "prometheus-operator-crds.yaml"), crdsTemplate);
    write(join(root, "argocd-rendered", "templates", "other.yaml"), otherTemplate);
    const fixtureDigest = `sha256:${"6".repeat(64)}`;
    const trainingDigest = `sha256:${"7".repeat(64)}`;
    write(
      join(root, "digest-index", "platform-index.json"),
      `${JSON.stringify({
        spec: {
          platformDigest: fixtureDigest,
          derivedFrom: { entry: "fixture-training", platformDigest: trainingDigest },
        },
      }, null, 2)}\n`,
    );
    const gp3Line = "                  storageClassName: gp3";
    const fixtureVariantReceiptPath = join(root, "variant-receipt.yaml");
    writeFileSync(
      fixtureVariantReceiptPath,
      `${JSON.stringify({
        apiVersion: "catalog.confighub.com/v1alpha1",
        kind: "AicrCpuStarterVariantProofReceipt",
        metadata: { name: "fixture-variant" },
        spec: {
          change: {
            before: "gp3",
            after: "standard",
            searchValue: gp3Line,
            replaceValue: gp3Line.replace("gp3", "standard"),
          },
        },
      })}\n`,
    );
    const expectations = loadExpectations(root, fixtureVariantReceiptPath);
    check(
      expectations.reviewedText.includes("storageClassName: standard")
        && JSON.stringify(expectations.otherDestinations) === JSON.stringify(["fixture-other-ns"]),
      "self-test fixture expectations are wrong",
    );

    const receipt = () => ({
      apiVersion: "catalog.confighub.com/v1alpha1",
      kind: "AicrCpuStarterSyncProofReceipt",
      metadata: { name: "fixture" },
      spec: {
        observedAt: "1970-01-01T00:00:00.000Z",
        durationSeconds: 1,
        input: {
          starterPlatformDigest: fixtureDigest,
          derivedFromPlatformDigest: trainingDigest,
          reviewedChange: {
            before: "gp3",
            after: "standard",
            reviewedComponentSha256: expectations.reviewedSha256,
          },
        },
        cluster: { argoCd: { version: argoVersion } },
        sync: {
          prerequisite: { component: PREREQUISITE_COMPONENT, syncStatus: "Synced", healthStatus: "Healthy", operationPhase: "Succeeded" },
          reviewed: {
            component: REVIEWED_COMPONENT,
            syncStatus: "Synced",
            healthStatus: "Healthy",
            operationPhase: "Succeeded",
            persistentVolumeClaims: [{ name: "fixture-pvc", storageClassName: "standard", phase: "Bound" }],
          },
          scope: {
            applicationsApplied: [PREREQUISITE_COMPONENT, REVIEWED_COMPONENT],
            otherComponentsApplied: false,
            otherNamespacesAbsent: ["fixture-other-ns"],
          },
        },
        cleanup: { cluster: "pass", registry: "pass", localFiles: "pass" },
        limits: ["This receipt syncs exactly one reviewed component plus its declared CRD prerequisite."],
      },
      status: {
        result: "pass",
        ociTransport: "pass",
        clusterUp: "pass",
        argoCdInstall: "pass",
        prerequisiteSynced: "pass",
        reviewedComponentSynced: "pass",
        reviewedFieldRealized: "pass",
        scopeHeld: "pass",
      },
    });

    verifyReceipt(receipt(), expectations);

    const refusals = [
      [(r) => (r.spec.input.starterPlatformDigest = `sha256:${"9".repeat(64)}`), /committed starter platform digest/],
      [(r) => (r.spec.input.reviewedChange.reviewedComponentSha256 = "wrong"), /reviewed bytes differ/],
      [(r) => (r.spec.sync.reviewed.healthStatus = "Progressing"), /reviewed-component evidence/],
      [(r) => (r.spec.sync.reviewed.persistentVolumeClaims[0].storageClassName = "gp3"), /Bound with the reviewed storage class/],
      [(r) => (r.spec.sync.scope.otherNamespacesAbsent = []), /scope evidence/],
      [(r) => (r.spec.cleanup.cluster = "fail"), /cleanup did not pass/],
      [(r) => (r.spec.limits = []), /one-component scope/],
    ];
    for (const [mutate, pattern] of refusals) {
      const mutated = receipt();
      mutate(mutated);
      check(fails(() => verifyReceipt(mutated, expectations), pattern), `self-test accepted a receipt violating ${pattern}`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function listFiles(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function stripCommentMetadata(value) {
  if (Array.isArray(value)) return value.map(stripCommentMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("$comment$"))
      .map(([key, child]) => [key, stripCommentMetadata(child)]),
  );
}

function waitForRegistry(registry) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (tryCommand("curl", ["-fsS", `http://${registry}/v2/`]).ok) return;
    command("sleep", ["0.25"]);
  }
  throw new Error(`temporary registry ${registry} did not become ready`);
}

function waitForContainerRemoval(container) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const name = command("docker", [
      "ps",
      "-a",
      "--filter",
      `name=^/${container}$`,
      "--format",
      "{{.Names}}",
    ]).trim();
    if (!name) return true;
    command("sleep", ["0.1"]);
  }
  return false;
}

function command(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 100,
    ...options,
  });
}

function tryCommand(file, args, options = {}) {
  try {
    return { ok: true, out: command(file, args, options) };
  } catch (error) {
    return {
      ok: false,
      out: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim() || String(error),
    };
  }
}

function safeRunId(value) {
  const compact = String(value)
    .replace(/\D/g, "")
    .slice(0, 14);
  check(compact.length >= 8, "HELM_EXPT_PROOF_RUN_ID must contain at least eight digits");
  return compact;
}

function fails(action, pattern) {
  try {
    action();
  } catch (error) {
    return pattern.test(String(error?.message ?? error));
  }
  return false;
}
