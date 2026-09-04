#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  listFiles,
  parseObjects,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  toYaml,
  write,
  writeYaml,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
check(["--generate", "--verify"].includes(mode), "use --generate or --verify");

const exampleRoot = join(
  repoRoot,
  "examples",
  "aicr",
  "eks-h100-training-kubeflow-v0-20-0",
);
const nestedCatalogPath = join(repoRoot, "data", "aicr-v0-20-0-nested-sources", "catalog.json");
const nestedSummaryPath = "data/aicr-v0-20-0-nested-sources/summary.md";
const baseRecordPath =
  "data/base-variant-records/records/aicr-eks-h100-training-kubeflow-v0-20-0-argocd.yaml";
const routeIntentPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/route-intent.yaml";
const generationReceiptPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml";
const fieldPolicyPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/field-policy-assessment.yaml";
const fluxChecksumsPath =
  "examples/aicr/eks-h100-training-kubeflow-v0-20-0/flux-bundle/checksums.txt";
const outputRoot = join(repoRoot, "data", "aicr-v0-20-0-route-resolution");
const inventoryPath = join(outputRoot, "inventory.yaml");
const fluxStructureReceiptPath = join(outputRoot, "flux-structure-receipt.yaml");
const summaryPath = join(outputRoot, "summary.md");
const routeOutputRoot = join(repoRoot, "data", "lifecycle-route-resolutions");
const argoRecordPath = join(
  routeOutputRoot,
  "aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd.yaml",
);
const fluxRecordPath = join(
  routeOutputRoot,
  "aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux.yaml",
);

const nestedCatalog = JSON.parse(readFileSync(nestedCatalogPath, "utf8"));
const baseRecord = readYaml(join(repoRoot, baseRecordPath));
const routeIntent = readYaml(join(repoRoot, routeIntentPath));
const applications = listFiles(join(exampleRoot, "argocd-rendered", "templates"))
  .filter((path) => path.endsWith(".yaml"))
  .map(readYaml)
  .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
const componentApplications = applications.filter(
  (application) => application.metadata?.name !== "aicr-stack",
);
const fluxRoot = join(exampleRoot, "flux-bundle");
const fluxOutput = normalizeOutput(
  execFileSync("kustomize", ["build", fluxRoot], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  }),
);
const fluxObjects = parseObjects(fluxOutput);
const helmReleases = listFiles(fluxRoot)
  .filter((path) => path.endsWith("/helmrelease.yaml"))
  .map(readYaml)
  .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
const fluxSources = listFiles(join(fluxRoot, "sources"))
  .filter((path) => path.endsWith(".yaml"))
  .map(readYaml)
  .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

validateInputs();

const inventory = buildInventory();
const fluxStructureReceipt = buildFluxStructureReceipt();
const routeRecords = [buildArgoResolution(), buildFluxResolution()];
const summary = renderSummary();

if (mode === "--generate") {
  writeYaml(inventoryPath, inventory);
  writeYaml(fluxStructureReceiptPath, fluxStructureReceipt);
  for (const record of routeRecords) {
    const path = record.metadata.name.endsWith("-flux") ? fluxRecordPath : argoRecordPath;
    writeYaml(path, record);
  }
  write(summaryPath, summary);
  console.log("wrote the AICR v0.20.0 nested inventory and two destination route resolutions");
} else {
  verifyFile(inventoryPath, `${toYaml(inventory)}\n`);
  verifyFile(fluxStructureReceiptPath, `${toYaml(fluxStructureReceipt)}\n`);
  verifyFile(argoRecordPath, `${toYaml(routeRecords[0])}\n`);
  verifyFile(fluxRecordPath, `${toYaml(routeRecords[1])}\n`);
  verifyFile(summaryPath, summary);
  console.log("verified the AICR v0.20.0 nested inventory and destination route resolutions");
}

function validateInputs() {
  check(applications.length === 17, `expected 17 wrapper Applications, found ${applications.length}`);
  check(componentApplications.length === 16, "expected 16 component Applications");
  check(nestedCatalog.entries?.length === 16, "expected 16 nested render records");
  check(
    nestedCatalog.entries.every((entry) => entry.render.status === "pass"),
    "every nested source must render before route resolution",
  );
  const applicationNames = componentApplications.map((item) => item.metadata.name).sort();
  const nestedNames = nestedCatalog.entries.map((item) => item.name).sort();
  check(
    JSON.stringify(applicationNames) === JSON.stringify(nestedNames),
    "nested source inventory does not reconcile with the wrapper Application graph",
  );
  for (const entry of nestedCatalog.entries) {
    check(
      /^[0-9a-f]{64}$/.test(entry.sourceArtifact?.sha256 ?? ""),
      `${entry.name}: source artifact is not digest-bound`,
    );
    check(
      /^[0-9a-f]{64}$/.test(entry.render?.objectSha256 ?? ""),
      `${entry.name}: rendered objects are not digest-bound`,
    );
  }
  check(helmReleases.length === 16, `expected 16 Flux HelmReleases, found ${helmReleases.length}`);
  check(fluxSources.length === 13, `expected 13 Flux source objects, found ${fluxSources.length}`);
  check(fluxObjects.length === 29, `expected 29 Flux controller objects, found ${fluxObjects.length}`);
  const nvsentinel = helmReleases.find((release) => release.metadata.name === "nvsentinel");
  check(nvsentinel, "NVSentinel HelmRelease is missing");
  check(
    nvsentinel.spec?.upgrade?.crds === "CreateReplace",
    "NVSentinel no longer records component-owned CRD replacement",
  );
  check(
    helmReleases
      .filter((release) => release.metadata.name !== "nvsentinel")
      .every((release) => release.spec?.upgrade?.crds === undefined),
    "CreateReplace leaked onto a component without the recorded sole-owner decision",
  );
  check(baseRecord.spec?.source?.version === "v0.20.0", "base record is for another AICR version");
  check(
    routeIntent.kind === "PlatformRouteIntent"
      && routeIntent.status?.routesExecuted === false,
    "route intent is missing or overstates execution",
  );
}

function buildInventory() {
  const waves = Object.fromEntries(
    componentApplications
      .map((application) => application.metadata.annotations?.["argocd.argoproj.io/sync-wave"] ?? "unassigned")
      .sort((left, right) => Number(left) - Number(right))
      .map((wave) => [
        wave,
        componentApplications
          .filter(
            (application) =>
              (application.metadata.annotations?.["argocd.argoproj.io/sync-wave"] ?? "unassigned")
              === wave,
          )
          .map((application) => application.metadata.name)
          .sort(),
      ]),
  );
  return {
    apiVersion: "catalog.confighub.com/v1alpha1",
    kind: "AicrNestedLifecycleInventory",
    metadata: { name: "aicr-eks-h100-training-kubeflow-v0-20-0" },
    spec: {
      sourceVariant: {
        name: "h100-eks-ubuntu-training-kubeflow",
        provider: "NVIDIA AICR",
        record: generationReceiptPath,
        baseVariantRecord: baseRecordPath,
        baseRevisionDigest: baseRecord.spec.baseVariant.digest,
      },
      wrapper: {
        format: "Argo CD Application objects",
        objectCount: applications.length,
        rootApplication: "aicr-stack",
        componentApplicationCount: componentApplications.length,
        componentNames: componentApplications.map((item) => item.metadata.name),
        syncWaves: waves,
      },
      nestedMaterialization: {
        sourceCount: nestedCatalog.entries.length,
        passed: nestedCatalog.entries.filter((entry) => entry.render.status === "pass").length,
        objectCount: sum("objectCount"),
        crdCount: sum("crdCount"),
        componentsWithCrds: nestedCatalog.entries
          .filter((entry) => entry.render.crdCount > 0)
          .map((entry) => entry.name),
        helmHookObjectCount: sum("hookObjectCount"),
        components: nestedCatalog.entries.map((entry) => ({
          name: entry.name,
          source: entry.source,
          sourceArtifactSha256: entry.sourceArtifact.sha256,
          valuesSha256: entry.values.sha256,
          objectSetSha256: entry.render.objectSha256,
          objectCount: entry.render.objectCount,
          crdCount: entry.render.crdCount,
          helmHookObjectCount: entry.render.hookObjectCount,
          receipt: entry.receipt,
        })),
      },
      fluxProjection: {
        objectCount: fluxObjects.length,
        objectSetSha256: sha256(fluxOutput),
        helmReleaseCount: helmReleases.length,
        sourceObjectCount: fluxSources.length,
        dependencyEdges: helmReleases.reduce(
          (total, release) => total + (release.spec?.dependsOn?.length ?? 0),
          0,
        ),
        componentOwnedCrdUpgrade: {
          component: "nvsentinel",
          policy: "CreateReplace",
          scope: "Only the component marked as the sole owner of its CRDs. Other components omit this setting.",
          record:
            "examples/aicr/eks-h100-training-kubeflow-v0-20-0/flux-bundle/nvsentinel/helmrelease.yaml",
        },
        inventory: fluxChecksumsPath,
      },
      boundaries: {
        wrapperObjects: "The 17 Applications are exact Kubernetes objects, but 16 still point to nested sources.",
        nestedObjects: "The 409 nested objects are local renders bound to exact chart and values digests.",
        lifecycleWork: "CRDs, ordering, controllers, credentials, setup, validation, and target facts remain destination-specific work.",
        runtime: "No EKS, H100, Argo CD, Flux, training, or NIM runtime result is inferred from these files.",
      },
    },
    status: {
      graphReconciled: true,
      nestedSourcesMaterialized: true,
      destinationRoutesRecorded: true,
      destinationRoutesExecuted: false,
      runtimeProven: false,
    },
  };
}

function buildFluxStructureReceipt() {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "FluxStructureReceipt",
    metadata: { name: "aicr-eks-h100-training-kubeflow-v0-20-0" },
    spec: {
      command: [
        "kustomize",
        "build",
        "examples/aicr/eks-h100-training-kubeflow-v0-20-0/flux-bundle",
      ],
      output: {
        objectCount: fluxObjects.length,
        sha256: sha256(fluxOutput),
        helmReleaseCount: helmReleases.length,
        sourceObjectCount: fluxSources.length,
      },
      crdUpgradeCase: {
        component: "nvsentinel",
        declaredOwnership: "sole component owner",
        configuredPolicy: "spec.upgrade.crds=CreateReplace",
        otherComponentsUsePolicy: false,
        liveResult: "not-run",
      },
      liveRerun: {
        prerequisites: [
          "An EKS context with the selected H100 and Ubuntu target facts",
          "Flux source-controller, kustomize-controller, and helm-controller",
          "A real Git repository containing the generated Flux bundle",
        ],
        commands: [
          "aicr bundle --recipe recipe.yaml --deployer flux --repo https://github.com/<org>/<repo>.git --output ./flux-bundle",
          "git -C <repo> add . && git -C <repo> commit -m 'Test AICR v0.20 Flux route' && git -C <repo> push",
          "flux reconcile kustomization aicr-v0-20-0 --with-source --context <eks-context>",
          "flux get helmreleases -A --context <eks-context>",
          "kubectl --context <eks-context> get crd -o name",
        ],
      },
    },
    status: {
      result: "partial",
      structureBuilt: true,
      crdPolicyChecked: true,
      controllerReconciliation: "not-run",
      crdUpgradeExecution: "blocked",
      blocker: "No recorded EKS/H100 target and Git source are available for this retained v0.20.0 configuration.",
    },
  };
}

function buildArgoResolution() {
  const evidence = commonEvidence();
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "LifecycleRouteResolution",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd",
    },
    spec: {
      configuration: {
        baseVariantRecord: baseRecordPath,
        variant: "argocd",
        revision: String(baseRecord.spec.baseVariant.revision),
        baseRevisionDigest: baseRecord.spec.baseVariant.digest,
        digest: baseRecord.spec.configuration.digest,
        digestRole: baseRecord.spec.configuration.digestRole,
        digestRecord: baseRecord.spec.configuration.digestRecord,
      },
      destination: {
        name: "eks-h100-staging",
        type: "Amazon EKS with H100 nodes",
        deliveryRuntime: "Argo CD",
      },
      requirements: commonRequirements("argo"),
      routes: [
        route("target-facts", ["source-variant-target-match", "destination-access"], "destination owner", "preflight", 5, "Check EKS, H100, Ubuntu, storage, node labels, networking, credentials, and the selected source variant before delivery.", false, evidence),
        route("argocd-prerequisite", ["argocd-prerequisite"], "destination owner", "preflight", 10, "Make the Argo CD Application API and controller available, then record their versions and readiness.", false, evidence),
        route("wrapper-applications", ["wrapper-graph"], "Argo CD", "apply", 20, "Apply the 17 retained Applications, including the root Application and 16 component Applications.", true, evidence),
        route("component-order", ["component-order"], "Argo CD", "apply", 30, "Process the five recorded sync waves in order and stop when a component is unhealthy.", true, evidence),
        route("nested-lifecycle", ["nested-materialization", "nested-crds", "nested-setup"], "Argo CD and each nested source processor", "pre-apply", 40, "Use each digest-bound nested source, establish its CRDs before dependent resources, and run any source-specific setup or certificate work.", false, evidence),
        route("aicr-validation", ["aicr-validation"], "AICR validator and workload test runner", "observe", 50, "Run only checks whose components and hardware prerequisites exist, then record each result separately.", false, evidence),
      ],
      protection: { records: [fieldPolicyPath] },
    },
    status: {
      decision: "blocked",
      evidence: "partly-observed",
      unresolved: [
        "The wrapper graph, source packages, values, and nested objects are recorded, but no EKS/H100 destination facts are attached.",
        "Argo CD has not reconciled the 17 Applications or their 16 nested sources for this exact revision.",
        "The retained AICR validation checks and a real training or NIM request have not run.",
      ],
      receipts: [nestedSummaryPath, relativeRepo(inventoryPath)],
    },
  };
}

function buildFluxResolution() {
  const evidence = commonEvidence();
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "LifecycleRouteResolution",
    metadata: {
      name: "aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux",
    },
    spec: {
      configuration: {
        baseVariantRecord: baseRecordPath,
        variant: "generated-flux-bundle",
        revision: "generated-v0.20.0",
        baseRevisionDigest: baseRecord.spec.baseVariant.digest,
        digest: sha256(fluxOutput),
        digestRole: "canonical-object-set",
        digestRecord: relativeRepo(fluxStructureReceiptPath),
      },
      destination: {
        name: "eks-h100-staging",
        type: "Amazon EKS with H100 nodes",
        deliveryRuntime: "Flux",
      },
      requirements: commonRequirements("flux"),
      routes: [
        route("target-facts", ["source-variant-target-match", "destination-access"], "destination owner", "preflight", 5, "Check EKS, H100, Ubuntu, storage, node labels, networking, credentials, and the selected source variant before delivery.", false, evidence),
        route("flux-prerequisite", ["flux-prerequisite", "flux-git-source"], "destination owner", "preflight", 10, "Install the required Flux controllers and replace the example Git URL with the repository that contains this bundle.", false, evidence),
        route("flux-sources", ["flux-source-objects"], "Flux source-controller", "pre-apply", 20, "Resolve the 13 pinned Helm and Git source objects before HelmRelease reconciliation.", true, evidence),
        route("component-owned-crds", ["component-owned-crds"], "Flux helm-controller", "pre-apply", 30, "Use CreateReplace only for NVSentinel, whose AICR component record says it solely owns its CRDs. Shared-CRD components keep the default policy.", true, evidence),
        route("component-order", ["component-order", "nested-crds", "nested-setup"], "Flux helm-controller", "apply", 40, "Follow the 16 HelmRelease dependsOn graph and let each selected chart handle its own declared CRDs and setup work.", true, evidence),
        route("aicr-validation", ["aicr-validation"], "AICR validator and workload test runner", "observe", 50, "Run only checks whose components and hardware prerequisites exist, then record each result separately.", false, evidence),
      ],
      protection: { records: [fieldPolicyPath] },
    },
    status: {
      decision: "blocked",
      evidence: "partly-observed",
      unresolved: [
        "The Flux bundle builds locally into 29 controller objects, but its example GitRepository still needs a real repository URL.",
        "NVSentinel records spec.upgrade.crds=CreateReplace, but no Flux controller has executed an install or CRD upgrade for this retained revision.",
        "Rerun the commands in data/aicr-v0-20-0-route-resolution/flux-structure-receipt.yaml after attaching an EKS/H100 target and Git source.",
      ],
      receipts: [
        nestedSummaryPath,
        relativeRepo(inventoryPath),
        relativeRepo(fluxStructureReceiptPath),
      ],
    },
  };
}

function commonRequirements(runtime) {
  return [
    requirement("source-variant-target-match", "base", "inherited", "blocked", "Observed target facts must match the EKS, H100, Ubuntu, training, and Kubeflow source variant, with any exception explained."),
    requirement("destination-access", "destination", "added", "blocked", "The destination must provide the required AWS access, storage, node labels, networking, and any workload or registry credentials."),
    requirement(runtime === "argo" ? "argocd-prerequisite" : "flux-prerequisite", "destination", "added", "blocked", runtime === "argo" ? "Argo CD and the Application CRD must be ready before the wrapper objects are applied." : "Flux source-controller, kustomize-controller, and helm-controller must be ready before reconciliation."),
    ...(runtime === "flux"
      ? [
          requirement("flux-git-source", "destination", "added", "blocked", "The generated placeholder GitRepository must be replaced by a real repository containing the Flux bundle."),
          requirement("flux-source-objects", "base", "inherited", "required", "Thirteen source objects must resolve the exact component charts or local chart tree."),
          requirement("component-owned-crds", "base", "inherited", "required", "NVSentinel alone receives CreateReplace because its AICR component record declares sole CRD ownership."),
        ]
      : [
          requirement("wrapper-graph", "base", "inherited", "required", "The retained root and 16 component Applications must stay bound to their exact source and values records."),
        ]),
    requirement("component-order", "base", "inherited", "required", "The 16 components must follow the dependency order generated from the AICR recipe."),
    requirement("nested-materialization", "base", "inherited", "satisfied", "All 16 nested sources are bound to chart, values, and output digests; together they render 409 objects."),
    requirement("nested-crds", "base", "inherited", "required", "Eight selected nested renders contain 36 CRDs that must be established before dependent resources."),
    requirement("nested-setup", "base", "inherited", "required", "Operators, certificates, setup work, and component health checks must run in their source-specific order. No Helm hook object appears in this selected render."),
    requirement("aicr-validation", "base", "inherited", "blocked", "AICR validation and workload checks require their declared components, destination facts, and hardware to exist."),
  ];
}

function requirement(id, origin, disposition, state, detail) {
  return { id, origin, disposition, state, detail };
}

function route(id, requirementRefs, actor, phase, order, mechanism, automatic, evidence) {
  return {
    id,
    requirementRefs,
    actor,
    phase,
    order,
    mechanism,
    automatic,
    retry: "Resolve the failed requirement, then retry this stage without advancing later stages.",
    onFailure: "Stop before later stages and retain the failed check with the exact configuration digest.",
    checks: ["Every requirement named by this stage must pass before the next ordered stage starts."],
    evidence,
  };
}

function commonEvidence() {
  return [
    generationReceiptPath,
    routeIntentPath,
    nestedSummaryPath,
    relativeRepo(inventoryPath),
    relativeRepo(fluxStructureReceiptPath),
  ];
}

function sum(key) {
  return nestedCatalog.entries.reduce((total, entry) => total + Number(entry.render[key] ?? 0), 0);
}

function renderSummary() {
  const crdComponents = nestedCatalog.entries
    .filter((entry) => entry.render.crdCount > 0)
    .map((entry) => entry.name)
    .join(", ");
  return `# AICR v0.20.0 nested lifecycle resolution

The retained AICR configuration contains 17 Argo CD Applications. One is the
root. The other 16 point to component sources. All 16 sources now have a
digest-bound local render: **409 Kubernetes objects**, including **36 CRDs in
eight components**.

That completes the local materialization record. It does not mean that EKS,
H100, Argo CD, or Flux ran. The two route resolutions state what each controller
must do for the recorded staging destination and keep the missing target work
blocked.

| Delivery path | Recorded result | Still required |
| --- | --- | --- |
| [Argo CD](../lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-argo-cd.yaml) | 17 wrapper Applications matched to 16 source and output records | EKS/H100 facts, controller reconciliation, component health, and workload result |
| [Flux](../lifecycle-route-resolutions/aicr-eks-h100-training-kubeflow-v0-20-0-staging-flux.yaml) | 29 controller objects build locally; NVSentinel alone has \`CreateReplace\` for component-owned CRDs | Real Git source, EKS/H100 target, controller reconciliation, CRD-upgrade receipt, and workload result |

Components with CRDs in the selected local renders: ${crdComponents}.

- [Full nested inventory](./inventory.yaml)
- [Flux structural receipt and rerun commands](./flux-structure-receipt.yaml)
- [Nested source receipts](../aicr-v0-20-0-nested-sources/summary.md)
`;
}

function normalizeOutput(value) {
  return `${value.replace(/[ \t]+$/gm, "").replace(/\n+$/, "")}\n`;
}

function verifyFile(path, expected) {
  check(existsSync(path), `${relativeRepo(path)} is missing; run --generate`);
  check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run --generate`);
}
