import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, sha256, toYaml, write } from "./lib/proof-common.mjs";

const redisRoot = join(repoRoot, "data", "variant-goldens", "redis-prod-us-east");
const kubaraRoot = join(repoRoot, "data", "managed-overlay-goldens", "external-dns-customer-acme-prod");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  for (const root of [redisRoot, kubaraRoot]) rmSync(root, { recursive: true, force: true });
  const outputs = buildOutputs();
  for (const [path, contents] of outputs) write(path, contents);
  console.log(`wrote ${relativeRepo(redisRoot)}`);
  console.log(`wrote ${relativeRepo(kubaraRoot)}`);
} else if (mode === "--verify") {
  const outputs = buildOutputs();
  for (const [path, contents] of outputs) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run variant-goldens`);
    check(readFileSync(path, "utf8") === contents, `${relativeRepo(path)} is stale`);
  }
  verifyRedisGolden();
  verifyKubaraGolden();
  console.log("verified Redis Creator and Kubara managed-overlay goldens");
} else {
  console.log(`Usage:
  node scripts/generate-variant-goldens.mjs --generate
  node scripts/generate-variant-goldens.mjs --verify`);
}

function buildOutputs() {
  const outputs = new Map();
  for (const [path, value] of Object.entries(redisGolden())) outputs.set(join(redisRoot, path), value);
  for (const [path, value] of Object.entries(kubaraGolden())) outputs.set(join(kubaraRoot, path), value);
  return outputs;
}

function redisGolden() {
  const recipeRoot = "recipes/bitnami/redis/25.5.3";
  const indexPath = join(repoRoot, recipeRoot, "artifact-index.yaml");
  const index = readYaml(indexPath);
  const defaultVariant = index.spec.variants.find((variant) => variant.name === "default");
  const existingSecretVariant = index.spec.variants.find((variant) => variant.name === "reuse-existing-secret");
  check(defaultVariant, "Redis default variant missing from artifact index");
  check(existingSecretVariant, "Redis reuse-existing-secret variant missing from artifact index");
  const revision = defaultVariant.revisions[0];
  const proofPath = join(repoRoot, "runs", "redis-confighub-proof", "latest", "confighub-proof-receipt.yaml");
  const proof = readYaml(proofPath);
  const inventoryPath = join(repoRoot, revision.objectInventory);
  const inventory = readYaml(inventoryPath);

  const digestInputs = {
    recipe: index.spec.recipe.path,
    package: index.spec.installerPackage.path,
    variant: defaultVariant.variant,
    variantRevision: revision.variantRevision,
    renderedObjectSetSHA256: revision.renderedObjectSetSHA256,
    confighubProofSHA256: sha256(readFileSync(proofPath)),
  };
  const contractDigest = sha256(JSON.stringify(digestInputs));

  const contract = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantCreatorGolden",
    metadata: {
      name: "redis-default-to-prod-us-east",
      generatedBy: "scripts/generate-variant-goldens.mjs",
    },
    spec: {
      purpose: "Golden for creating a production ConfigHub variant from the reviewed Redis default base.",
      source: {
        chart: "bitnami/redis",
        chartVersion: index.spec.chart.version,
        recipe: index.spec.recipe.path,
        package: index.spec.installerPackage.path,
        base: "default",
        sourceVariant: defaultVariant.variant,
        sourceRevision: revision.variantRevision,
        renderedObjectSetSHA256: revision.renderedObjectSetSHA256,
        objectCount: revision.objectCount,
        cubInstallerObjectCountIncludingSupport: revision.cubInstallObjectCountIncludingSupport,
      },
      target: {
        downstreamSpace: "helm-redis-prod-us-east",
        environment: "prod",
        region: "us-east",
        target: "redis-targets/prod-us-east",
        namespace: "redis-prod",
      },
      commandSurface: {
        primitive: "cub variant create",
        example:
          "cub variant create prod-us-east helm-redis-confighub-proof --environment Prod --region us-east --target redis-targets/prod-us-east --space-name-pattern template:{{.Labels.Component}}-{{.Labels.Variant}}",
        porcelainNeeded: ["preview", "checks", "receipt display"],
      },
      confighubPromotionModel: {
        implementation: "spaces-units-labels-upstream-links",
        reason:
          "ConfigHub Promotion examples use Units and labels to form the component graph. The Creator golden must preserve that model.",
        componentIdentity: {
          spaceLabel: "Component=Redis",
          unitLabel: "Component=Redis",
        },
        variantIdentity: {
          sourceSpaceLabel: "Variant=default",
          downstreamSpaceLabel: "Variant=prod-us-east",
        },
        promotionEdge: {
          source: "source Unit in helm-redis-confighub-proof",
          downstream: "cloned Unit in helm-redis-prod-us-east",
          field: "Unit.UpstreamUnitID",
        },
        labelContract: ["Component", "Variant", "Environment", "Region", "Owner", "HelmChart", "HelmChartVersion"],
      },
      boundary: {
        mode: "post-render ConfigHub refinement",
        allowed: [
          "clone the reviewed ConfigHub Space and Units",
          "set environment, region, target, and variant labels",
          "apply a namespace TransformPaths mutation across namespace-scoped Units",
          "preserve upstream links from source Units to cloned Units",
          "run checks and write receipts",
        ],
        routeBackToInstaller: [
          "switch Redis from generated Secret mode to existing Secret mode",
          "enable or disable chart components",
          "change storage or HA topology",
          "change Helm values that alter the rendered template structure",
        ],
      },
      secretHandling: {
        sourceBase: "default",
        mode: "preserve-generated-secret-reference",
        renderedSecret: "v1|Secret|redis|redis",
        targetFactsRequired: [],
        note:
          "The default base includes a Redis Secret in Helm output and separates it during cub installer handling. A request to use redis-existing-secret must start from the reuse-existing-secret base or go back through cub installer.",
      },
      proof: {
        contractDigest: `sha256:${contractDigest}`,
        sourceFiles: digestInputs,
      },
    },
  };

  const preview = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantCreatorPreview",
    metadata: {
      name: "redis-prod-us-east-preview",
    },
    spec: {
      from: "redis/default",
      blueprint: "environment-clone",
      creates: "redis/prod-us-east",
      unitSummary: {
        sourceUnits: proof.spec.upload.unitCount,
        clonedUnits: proof.spec.upload.unitCount,
        kubernetesUnits: proof.spec.upload.redisKubernetesUnitCount,
        installerRecordUnits: proof.spec.upload.installerRecordUnitCount,
      },
      mutationPreview: {
        changedPathCount: 3,
        changedPaths: [
          {
            path: "Space.Labels.Environment",
            from: "Demo",
            to: "Prod",
            primitive: "bulk clone label patch",
          },
          {
            path: "Space.Labels.Region",
            from: "local",
            to: "us-east",
            primitive: "bulk clone label patch",
          },
          {
            path: "metadata.namespace",
            from: "redis",
            to: "redis-prod",
            primitive: "TransformPaths over namespace-scoped Kubernetes Units",
          },
        ],
        linkChangeCount: 1,
        linkChanges: [
          {
            kind: "upstream-unit-links",
            action: "preserved-for-cloned-units",
            source: "helm-redis-confighub-proof",
            target: "helm-redis-prod-us-east",
          },
        ],
      },
      promotionGraphPreview: {
        implementation: "Units plus labels plus upstream links",
        sourceNode: {
          space: "helm-redis-confighub-proof",
          labels: { Component: "Redis", Variant: "default" },
        },
        downstreamNode: {
          space: "helm-redis-prod-us-east",
          labels: { Component: "Redis", Variant: "prod-us-east" },
        },
        edge: "cloned Units keep UpstreamUnitID pointing at source Units",
      },
      checks: [
        { name: "source-revision-bound", result: "pass", evidence: revision.variantRevision },
        { name: "no-hidden-helm-rerender", result: "pass", evidence: revision.renderedObjectSetSHA256 },
        { name: "unit-count-preserved", result: "pass", expected: 15, observed: 15 },
        { name: "redis-secret-mode-preserved", result: "pass", expected: "generated-secret", observed: "generated-secret" },
        {
          name: "existing-secret-request-routes-back-to-installer",
          result: "pass",
          evidence: "receipts/route-back-receipt.yaml",
        },
        { name: "scan-disposition-carried-forward", result: "warn", evidence: revision.receipts.scan.path },
      ],
    },
  };

  const cloneReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantCloneReceipt",
    metadata: { name: "redis-prod-us-east-clone" },
    spec: {
      sourceSpace: proof.spec.upload.space,
      downstreamSpace: "helm-redis-prod-us-east",
      sourceUnits: proof.spec.upload.unitCount,
      clonedUnits: proof.spec.upload.unitCount,
      upstreamLinks: "preserved",
      labels: {
        Component: "Redis",
        Environment: "Prod",
        Layer: "App",
        Owner: "ConfigHubHelm",
        Region: "us-east",
        Variant: "prod-us-east",
      },
      promotionGraph: {
        implementation: "Units plus labels plus upstream links",
        componentLabel: "Redis",
        sourceVariantLabel: "default",
        downstreamVariantLabel: "prod-us-east",
        edgeField: "Unit.UpstreamUnitID",
      },
      result: "golden-pass",
    },
  };

  const mutationReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantMutationReceipt",
    metadata: { name: "redis-prod-us-east-mutations" },
    spec: {
      sourceBase: "redis/default",
      downstreamVariant: "redis/prod-us-east",
      mutationSources: preview.spec.mutationPreview.changedPaths,
      affectedObjectScope: {
        namespaceScopedObjects: inventory.spec.objects.filter((object) => object.namespace === "redis").length,
        clusterScopedObjects: inventory.spec.objects.filter((object) => !object.namespace).length,
      },
      forbiddenMutations: [
        {
          request: "set Redis existingSecret to redis-existing-secret",
          result: "blocked",
          reason: "This changes the Helm-rendered Secret model and must use the reuse-existing-secret base or a new cub installer render.",
        },
      ],
      result: "golden-pass",
    },
  };

  const checkReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantCreatorCheckReceipt",
    metadata: { name: "redis-prod-us-east-checks" },
    spec: {
      sourceRevision: revision.variantRevision,
      contractDigest: `sha256:${contractDigest}`,
      checks: preview.spec.checks,
      result: "golden-pass-with-carried-scan-warning",
    },
  };

  const routeBackReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "VariantRouteBackReceipt",
    metadata: { name: "redis-default-existing-secret-route-back" },
    spec: {
      sourceBase: "redis/default",
      requestedChange: "use existing Redis Secret redis/redis-existing-secret",
      decision: "route-back-to-installer-base",
      correctBase: "redis/reuse-existing-secret",
      evidence: {
        defaultTargetFacts: defaultVariant.targetFacts,
        reuseExistingSecretTargetFacts: existingSecretVariant.targetFacts,
        defaultRenderedObjects: revision.renderedObjects,
        reuseExistingSecretRenderedObjects: existingSecretVariant.revisions[0].renderedObjects,
      },
      result: "pass",
    },
  };

  return {
    "README.md": redisReadme(contract, preview),
    "creator-contract.yaml": yaml(contract),
    "ux-preview.md": redisUxPreview(preview),
    "ax-task.yaml": yaml(redisAxTask(contract, preview)),
    "fx-matrix.yaml": yaml(redisFxMatrix(contract)),
    "preview.yaml": yaml(preview),
    "receipts/clone-receipt.yaml": yaml(cloneReceipt),
    "receipts/mutation-receipt.yaml": yaml(mutationReceipt),
    "receipts/check-receipt.yaml": yaml(checkReceipt),
    "receipts/route-back-receipt.yaml": yaml(routeBackReceipt),
  };
}

function kubaraGolden() {
  const recipeRoot = "recipes/external-dns/external-dns/1.21.1";
  const indexPath = join(repoRoot, recipeRoot, "artifact-index.yaml");
  const index = readYaml(indexPath);
  const defaultVariant = index.spec.variants.find((variant) => variant.name === "default");
  check(defaultVariant, "ExternalDNS default variant missing from artifact index");
  const revision = defaultVariant.revisions[0];

  const wrapperChart = {
    apiVersion: "v2",
    name: "kubara-external-dns-managed",
    description: "Managed wrapper chart for an ExternalDNS catalog import golden.",
    type: "application",
    version: "0.1.0",
    appVersion: index.spec.chart.appVersion,
    dependencies: [
      {
        name: "external-dns",
        version: index.spec.chart.version,
        repository: index.spec.chart.repository,
      },
    ],
  };

  const platformValues = {
    provider: "aws",
    policy: "upsert-only",
    registry: "txt",
    txtPrefix: "kubara-",
    sources: ["service", "ingress"],
    serviceAccount: {
      create: true,
    },
    rbac: {
      create: true,
    },
  };

  const customerValues = {
    domainFilters: ["acme.example.com"],
    txtOwnerId: "acme-prod-us-east",
    aws: {
      region: "us-east-1",
      zoneType: "public",
    },
    serviceAccount: {
      annotations: {
        "eks.amazonaws.com/role-arn": "arn:aws:iam::123456789012:role/external-dns-acme-prod",
      },
    },
    targetFacts: {
      requiredHostedZones: [{ name: "acme.example.com", provider: "aws", visibility: "public" }],
      requiredSecrets: [{ namespace: "external-dns", name: "external-dns-aws", keys: ["credentials"] }],
    },
    confighub: {
      customer: "acme",
      environment: "prod",
      region: "us-east",
      target: "prod-us-east",
      observationFreshness: "PT15M",
    },
  };

  const classification = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayClassification",
    metadata: {
      name: "external-dns-customer-acme-prod",
      generatedBy: "scripts/generate-variant-goldens.mjs",
    },
    spec: {
      managedImportUnit:
        "managed wrapper chart + platform values + customer overlay values + dependency closure + render context",
      source: {
        chart: index.spec.chart.ref,
        chartVersion: index.spec.chart.version,
        recipe: index.spec.recipe.path,
        package: index.spec.installerPackage.path,
        renderedObjectSetSHA256: revision.renderedObjectSetSHA256,
      },
      routes: [
        {
          input: "wrapper chart dependency",
          example: "external-dns@1.21.1",
          route: "cub installer recipe source/dependency lock",
          reason: "Changes the chart dependency closure.",
        },
        {
          input: "platform provider/sources/registry",
          example: "provider=aws, sources=service/ingress, registry=txt",
          route: "cub installer recipe/base",
          reason: "These values are rendered into controller arguments, RBAC, labels, or other Kubernetes objects.",
        },
        {
          input: "customer domain filters and TXT owner ID",
          example: "domainFilters=acme.example.com, txtOwnerId=acme-prod-us-east",
          route: "cub installer managed base unless an existing rendered placeholder is explicitly bound",
          reason: "ExternalDNS reads these from rendered arguments. Changing them post-render is allowed only when the Unit contains a deliberate bindable field.",
        },
        {
          input: "credential Secret, hosted zone, and IAM role",
          example: "external-dns-aws Secret, acme.example.com hosted zone, IAM role ARN",
          route: "target facts plus installer/base binding when rendered",
          reason: "The values come from the target environment and must be recorded as facts rather than hidden inside ad-hoc scripts.",
        },
        {
          input: "customer, environment, region, target, approval, observation freshness",
          example: "acme prod us-east prod-us-east PT15M",
          route: "post-render ConfigHub variant Creator",
          reason: "These are operating attributes of the cloned ConfigHub variant.",
        },
        {
          input: "RBAC and CRD lifecycle",
          example: "ClusterRole, ClusterRoleBinding, CRD",
          route: "lifecycle policy and gates",
          reason: "Cluster-wide resources need explicit operator review and production disposition.",
        },
      ],
      productTier: {
        suggestedTier: "managed",
        reason: "Wrapper charts, customer overlays, private targets, and target facts require ConfigHub Server features and support policy.",
      },
    },
  };

  const creatorContract = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayCreatorGolden",
    metadata: {
      name: "external-dns-customer-acme-prod",
      generatedBy: "scripts/generate-variant-goldens.mjs",
    },
    spec: {
      from: "external-dns/managed-aws",
      creates: "external-dns/customer-acme-prod",
      doctrine:
        "Customer overlay values are classified before render. Render-time choices go through cub installer. Post-render operating choices go through the Variant Creator contract.",
      ux: {
        from: "ExternalDNS managed AWS",
        blueprint: "Customer overlay",
        fill: ["customer", "environment", "region", "target", "domain filters", "hosted zone fact", "credential Secret fact"],
        preview: "6 Kubernetes Units, 1 Namespace support object, render-time overlay values bound to installer inputs, post-render labels/target bound by Creator.",
        checks: ["overlay classified", "target facts named", "no secret material in overlay", "RBAC/CRD disposition required"],
      },
      ax: {
        task: "create_managed_overlay_variant",
        requiredChecks: [
          "all-overlay-keys-classified",
          "render-time-values-route-to-installer",
          "target-facts-declared",
          "no-secret-material",
          "rbac-crd-disposition-present",
        ],
      },
      fx: {
        function: "ManagedOverlayCreatorContract(parameters) -> ConfigHubVariant + receipts",
        matrixColumns: ["customer", "environment", "region", "target", "domainFilters", "hostedZoneFact", "credentialSecretFact"],
      },
    },
  };

  const preview = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayPreview",
    metadata: { name: "external-dns-customer-acme-prod-preview" },
    spec: {
      sourceChart: index.spec.chart.ref,
      sourceVersion: index.spec.chart.version,
      sourceObjects: {
        kubernetesObjects: revision.objectCount,
        cubInstallerObjectsIncludingSupport: revision.cubInstallObjectCountIncludingSupport,
        renderedObjectSetSHA256: revision.renderedObjectSetSHA256,
      },
      overlayInputs: {
        wrapperChart: "wrapper-chart/Chart.yaml",
        platformValues: "values/platform-values.yaml",
        customerValues: "values/customer-acme-prod-values.yaml",
      },
      classificationSummary: {
        totalRoutes: classification.spec.routes.length,
        installerRoutes: 4,
        creatorRoutes: 1,
        lifecycleRoutes: 1,
      },
      checks: [
        { name: "wrapper-chart-present", result: "pass" },
        { name: "platform-values-present", result: "pass" },
        { name: "customer-values-present", result: "pass" },
        { name: "all-overlay-keys-classified", result: "pass" },
        { name: "render-time-values-route-to-installer", result: "pass" },
        { name: "target-facts-declared", result: "pass" },
        { name: "no-secret-material", result: "pass" },
        { name: "rbac-crd-disposition-present", result: "pass" },
      ],
    },
  };

  const overlayReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayClassificationReceipt",
    metadata: { name: "external-dns-customer-acme-prod-overlay-classification" },
    spec: {
      classification: "overlay-classification.yaml",
      result: "golden-pass",
      routeCounts: preview.spec.classificationSummary,
    },
  };

  const renderBoundaryReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayRenderBoundaryReceipt",
    metadata: { name: "external-dns-customer-acme-prod-render-boundary" },
    spec: {
      renderTime: [
        "wrapper chart dependency",
        "provider/sources/registry",
        "domain filters",
        "TXT owner ID",
        "credential Secret env/volume binding when rendered",
      ],
      postRender: ["customer/environment/region/target labels", "approval gates", "observation freshness"],
      result: "golden-pass",
    },
  };

  const checkReceipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedOverlayCheckReceipt",
    metadata: { name: "external-dns-customer-acme-prod-checks" },
    spec: {
      checks: preview.spec.checks,
      result: "golden-pass",
    },
  };

  return {
    "README.md": kubaraReadme(),
    "wrapper-chart/Chart.yaml": yaml(wrapperChart),
    "values/platform-values.yaml": yaml(platformValues),
    "values/customer-acme-prod-values.yaml": yaml(customerValues),
    "overlay-classification.yaml": yaml(classification),
    "creator-contract.yaml": yaml(creatorContract),
    "preview.yaml": yaml(preview),
    "receipts/overlay-classification-receipt.yaml": yaml(overlayReceipt),
    "receipts/render-boundary-receipt.yaml": yaml(renderBoundaryReceipt),
    "receipts/check-receipt.yaml": yaml(checkReceipt),
  };
}

function redisAxTask(contract, preview) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "AgentTaskGolden",
    metadata: { name: "redis-prod-us-east-agent-task" },
    spec: {
      task: "create_variant",
      fromSpace: "helm-redis-confighub-proof",
      fromBase: "redis/default",
      blueprint: "environment-clone",
      parameters: {
        environment: contract.spec.target.environment,
        region: contract.spec.target.region,
        target: contract.spec.target.target,
        namespace: contract.spec.target.namespace,
        redisSecretMode: contract.spec.secretHandling.mode,
      },
      requiredChecks: preview.spec.checks.map((checkItem) => checkItem.name),
      expectedReceipts: [
        "receipts/clone-receipt.yaml",
        "receipts/mutation-receipt.yaml",
        "receipts/check-receipt.yaml",
        "receipts/route-back-receipt.yaml",
      ],
    },
  };
}

function redisFxMatrix(contract) {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "FleetFunctionGolden",
    metadata: { name: "redis-environment-clone-matrix" },
    spec: {
      function: "VariantCreatorContract(parameters) -> ConfigHubVariant + receipts",
      sourceBase: "redis/default",
      matrix: [
        {
          variant: "prod-us-east",
          environment: "prod",
          region: "us-east",
          target: "prod-us-east",
          namespace: "redis-prod",
          redisSecretMode: contract.spec.secretHandling.mode,
        },
        {
          variant: "staging-us-east",
          environment: "staging",
          region: "us-east",
          target: "staging-us-east",
          namespace: "redis-staging",
          redisSecretMode: contract.spec.secretHandling.mode,
        },
      ],
      invariant: "Every row preserves the Redis Secret mode of the source base unless the row routes back to a cub installer base.",
    },
  };
}

function redisReadme(contract, preview) {
  return `# Redis Creator Golden

This generated golden shows how a reviewed Redis base can become a production
ConfigHub variant.

\`\`\`text
from: redis/default
blueprint: environment-clone
target variant: redis/prod-us-east
preview: ${preview.spec.unitSummary.clonedUnits} Units, ${preview.spec.mutationPreview.changedPathCount} changed paths, ${preview.spec.mutationPreview.linkChangeCount} link change
checks: ${preview.spec.checks.map((checkItem) => checkItem.name).join(", ")}
\`\`\`

The source base is the Redis \`default\` base from
\`${contract.spec.source.package}\`. The Creator contract is post-render: it
clones the reviewed ConfigHub Space and Units, sets operating labels and target,
applies an explicit namespace TransformPaths mutation, preserves upstream links,
and writes receipts.

The promotion model uses the same substrate as the ConfigHub promotions
example: Spaces and Units carry component and variant labels, and cloned Units
retain upstream links back to the source Units. The graph is not a separate
artifact invented by this repo.

Secret handling is part of the proof. The \`default\` base preserves the
generated Redis Secret reference from Helm output. It does not silently switch
to \`redis-existing-secret\`. A request to use an existing Secret routes back to
the maintained \`reuse-existing-secret\` base or to a new \`cub installer\`
render.

Generated files:

- \`creator-contract.yaml\`
- \`preview.yaml\`
- \`ux-preview.md\`
- \`ax-task.yaml\`
- \`fx-matrix.yaml\`
- \`receipts/clone-receipt.yaml\`
- \`receipts/mutation-receipt.yaml\`
- \`receipts/check-receipt.yaml\`
- \`receipts/route-back-receipt.yaml\`
`;
}

function redisUxPreview(preview) {
  return `# Redis Creator UX Preview

\`\`\`text
Create variant
From: redis/default
Blueprint: Environment clone
Target variant: prod-us-east
Fill: environment=prod, region=us-east, namespace=redis-prod, target=redis-targets/prod-us-east
Preview: ${preview.spec.unitSummary.clonedUnits} Units, ${preview.spec.mutationPreview.changedPathCount} changed paths, ${preview.spec.mutationPreview.linkChangeCount} link change
Checks: pass with carried Redis scan warning
Create
\`\`\`

The Redis Secret mode is not a free-form fill value in this preview. The source
base determines the Secret model. Use \`redis/reuse-existing-secret\` when the
variant must bind \`redis-existing-secret\`.
`;
}

function kubaraReadme() {
  return `# ExternalDNS Managed Overlay Golden

This generated golden models a Kubara-style managed app using ExternalDNS as the
first concrete example.

The managed import unit is:

\`\`\`text
managed wrapper chart + platform values + customer overlay values + dependency closure + render context
\`\`\`

The golden separates two decisions before rendering:

- values that change Kubernetes objects go through \`cub installer\`;
- operating labels, targets, approvals, and observation requirements go through
  the post-render Variant Creator contract.

This is not a claim that all Kubara applications are imported. It is a
verification target for the managed-overlay boundary.

Generated files:

- \`wrapper-chart/Chart.yaml\`
- \`values/platform-values.yaml\`
- \`values/customer-acme-prod-values.yaml\`
- \`overlay-classification.yaml\`
- \`creator-contract.yaml\`
- \`preview.yaml\`
- \`receipts/overlay-classification-receipt.yaml\`
- \`receipts/render-boundary-receipt.yaml\`
- \`receipts/check-receipt.yaml\`
`;
}

function verifyRedisGolden() {
  const contract = readYaml(join(redisRoot, "creator-contract.yaml"));
  const preview = readYaml(join(redisRoot, "preview.yaml"));
  const routeBack = readYaml(join(redisRoot, "receipts", "route-back-receipt.yaml"));
  check(contract.kind === "VariantCreatorGolden", "Redis creator contract has wrong kind");
  check(preview.spec.mutationPreview.changedPathCount === 3, "Redis preview must show 3 changed paths");
  check(preview.spec.mutationPreview.linkChangeCount === 1, "Redis preview must show 1 link change");
  check(contract.spec.secretHandling.mode === "preserve-generated-secret-reference", "Redis default golden must preserve generated Secret mode");
  check(routeBack.spec.decision === "route-back-to-installer-base", "Redis existing-secret change must route back to installer base");
  check(routeBack.spec.correctBase === "redis/reuse-existing-secret", "Redis route-back must point at reuse-existing-secret base");
}

function verifyKubaraGolden() {
  const wrapper = readYaml(join(kubaraRoot, "wrapper-chart", "Chart.yaml"));
  const classification = readYaml(join(kubaraRoot, "overlay-classification.yaml"));
  const preview = readYaml(join(kubaraRoot, "preview.yaml"));
  const customer = readYaml(join(kubaraRoot, "values", "customer-acme-prod-values.yaml"));
  check(wrapper.dependencies[0].name === "external-dns", "Kubara wrapper must depend on external-dns");
  check(classification.kind === "ManagedOverlayClassification", "Kubara classification has wrong kind");
  check(classification.spec.routes.length === 6, "Kubara classification must contain 6 route groups");
  check(preview.spec.classificationSummary.installerRoutes === 4, "Kubara preview installer route count changed");
  check(preview.spec.classificationSummary.creatorRoutes === 1, "Kubara preview Creator route count changed");
  check(customer.targetFacts.requiredSecrets[0].name === "external-dns-aws", "Kubara target Secret fact missing");
  const serialized = JSON.stringify(customer);
  check(!/secretAccessKey|accessKey|password/i.test(serialized), "Kubara customer overlay must not contain secret material");
}

function yaml(value) {
  return `${toYaml(value)}\n`;
}
