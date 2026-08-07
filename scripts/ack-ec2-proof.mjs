// aws-controllers-k8s/ec2-chart proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/ack-ec2-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// Exact-artifact pinning is env-only. Every generate AND verify run needs:
//   HELM_EXPT_CHART_ARTIFACT_URL="oci://public.ecr.aws/aws-controllers-k8s/ec2-chart"
//   HELM_EXPT_CHART_ARTIFACT_SHA256="17c082eac9ef1f859fdf72d4e86788ab7add27876da9f2ba7cd145eeea75bc20"

import { runProofCli } from "./lib/proof-kit.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "1.18.4";
const chart = {
  repository: "aws-controllers-k8s",
  repositoryURL: "oci://public.ecr.aws/aws-controllers-k8s",
  name: "ec2-chart",
  version: chartVersion,
  releaseName: "ack-ec2",
  namespace: "ack-system",
  kubeVersion: "1.31.0",
};

const artifactManifestDigest = "sha256:93640fb691b06390968decea288af2d67457ca9bf42ffd933f973240fbb04728";
const artifactPackageSHA256 = "17c082eac9ef1f859fdf72d4e86788ab7add27876da9f2ba7cd145eeea75bc20";

const versionExpectations = {
  "1.18.4": { defaultObjects: 32, eksInferenceObjects: 32, crdCount: 22 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`ack ec2-chart ${chart.version} needs reviewed version-specific assertions`);

// Captured verbatim from the lean entry's variants/default/values.yaml.
// The comment-only file means chart defaults; the comment text is deliberate.
const defaultValuesText = `# Chart defaults. No overrides: this base audits the chart exactly as shipped.
`;

// Captured verbatim from the lean entry's variants/eks-inference/values.yaml
// (eks-inference producer src/ack-controllers/values/ec2.yaml at commit
// 2e1a8823920ca4fc6f124db754b7f8f2cfe7d574). The confighubplaceholder sentinel
// is deliberate and must never be replaced with a real region here.
const eksInferenceValuesText = `# ACK EC2 controller — provisions the VPC, subnets, gateways, and route tables.
#
# deletionPolicy: retain is deliberate and applies to every resource this
# controller manages. Argo CD prunes anything that leaves its bundle, and a
# pruned ACK resource means a deleted AWS resource. Retain makes that class of
# accident inert; teardown is an explicit operation instead. See docs/teardown.md.
aws:
  # PLACEHOLDER, deliberately. The region is not knowable at render time — it
  # belongs to the environment, not to the chart — so it renders as the ConfigHub
  # sentinel and is filled in per variant by a link from the platform-profile
  # Unit. \`vet-placeholders\` fails while any remain, so an unfilled region is
  # caught before it reaches a cluster rather than after.
  #
  # The link uses the set-env-var function rather than a raw path: AWS_REGION is
  # addressed BY NAME, so a chart bump that adds or reorders env vars cannot
  # silently redirect the write into a neighbouring variable.
  region: confighubplaceholder
  credentials:
    secretName: aws-creds
    secretKey: credentials
    profile: default

deletionPolicy: retain
installScope: cluster

log:
  level: info

metrics:
  service:
    create: false
`;

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: defaultValuesText,
    valuesSummary:
      "chart defaults with no overrides; audit base with empty AWS_REGION, no credential wiring, and deletionPolicy delete",
    expectedObjectCount: expected.defaultObjects,
    targetFactNote:
      "audit base only: renders empty AWS_REGION and no credentials, so the controller cannot reach AWS as rendered",
  },
  {
    name: "eks-inference",
    base: "eks-inference",
    displayName: "eks-inference",
    valuesFile: "effective-values-eks-inference.yaml",
    valuesText: eksInferenceValuesText,
    valuesSummary:
      "eks-inference producer values: deletionPolicy retain, aws-creds Secret mount, region rendered as the ConfigHub sentinel",
    expectedObjectCount: expected.eksInferenceObjects,
    targetFactNote:
      "requires target Secret ack-system/aws-creds (key credentials) before the controller starts, plus a non-placeholder aws.region bound before deploy",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "ack-system",
          name: "aws-creds",
          keys: ["credentials"],
          purpose: "AWS shared-credentials file mounted read-only at /var/run/secrets/aws",
        },
      ],
      requiredValues: [
        {
          path: "aws.region",
          purpose:
            "AWS region for the controller; rendered as the ConfigHub sentinel so an unbound environment fails vet-placeholders instead of reaching a cluster",
          stage: "pre-render",
          source: "environment-platform-profile",
          installerInput: "awsRegion",
        },
      ],
    },
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    {
      id: "mutable-image-tag",
      severity: "high",
      description: "Container image must use an immutable or non-latest tag.",
    },
    {
      id: "service-selector-has-workload-match",
      severity: "high",
      description: "Service selector must match a rendered workload pod template.",
    },
    {
      id: "workload-service-account-exists",
      severity: "high",
      description: "Workload serviceAccountName must reference a rendered ServiceAccount.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  receiptSlug: "ack-ec2",
  scriptPrefix: "ack-ec2",
  // Zero helm hooks and zero test hooks ship in this chart, so rendering with
  // hooks visible is byte-identical to --no-hooks; the declared policy matches
  // the lean entry's hooks-rendered-visible stance instead of hiding hooks.
  renderFlags: ["--include-crds", "--skip-tests"],
  hookPolicy: "hooks-rendered-visible",
  // The kit's exactArtifact block records url and sha256 only; the OCI manifest
  // digest from the original import survives as its own proof document.
  extraRequiredFiles: ["artifact-manifest-digest.yaml"],
  extraProofDocuments: () => [
    {
      path: "artifact-manifest-digest.yaml",
      document: {
        apiVersion: "helm-expt.confighub.com/v1alpha1",
        kind: "ArtifactManifestDigest",
        metadata: { name: `aws-controllers-k8s-ec2-chart-${chart.version}` },
        spec: {
          url: `oci://public.ecr.aws/aws-controllers-k8s/ec2-chart:${chart.version}`,
          packageSHA256: artifactPackageSHA256,
          manifestDigest: artifactManifestDigest,
          note: "OCI manifest digest observed at the original eks-inference import; the tarball packageSHA256 is the render-time pin.",
        },
      },
    },
  ],
  // single cub-only support object (the created Namespace)
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageInputs: [
    {
      name: "awsRegion",
      type: "string",
      default: "confighubplaceholder",
      prompt: "AWS region for the ACK EC2 controller",
      description:
        "Consumed by the eks-inference base, where it replaces the rendered sentinel in the AWS_REGION env var. The default stays confighubplaceholder so vet-placeholders keeps failing until an environment supplies a real region.",
    },
  ],
  packageTransformers: [
    {
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
      toolchain: "Kubernetes/YAML",
      whereResource: "",
    },
    {
      description:
        "Bind the controller AWS_REGION env var by name from the awsRegion input, so a chart bump that adds or reorders env vars cannot silently redirect the write.",
      invocations: [{ name: "set-env-var", args: ["controller", "AWS_REGION", "{{ .Inputs.awsRegion }}"] }],
      toolchain: "Kubernetes/YAML",
      whereResource:
        "{{ if eq .Selection.Base \"eks-inference\" }}ConfigHub.ResourceType = 'apps/v1/Deployment'{{ else }}ConfigHub.ResourceType = 'helm-expt.invalid/v1/Never'{{ end }}",
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "deletionPolicy",
        variant: "eks-inference",
        disposition: "retain-under-pruning-reconciler",
        reason:
          "The eks-inference base sets retain so a pruning reconciler cannot delete cloud infrastructure by pruning a manifest.",
        evidence:
          "values.yaml L134; templates/deployment.yaml DELETION_POLICY env (L128-129, L74-75); rendered eks-inference release-objects.yaml shows value: retain",
      },
      {
        path: "deletionPolicy",
        variant: "default",
        disposition: "chart-default-delete",
        reason:
          "Chart default is delete, which removes the AWS resource before the Kubernetes resource goes away; the single most consequential values choice for this chart under a pruning reconciler.",
        evidence:
          "values.yaml L134; templates/deployment.yaml DELETION_POLICY env (L128-129, L74-75); rendered default release-objects.yaml shows value: delete",
      },
      {
        path: "aws.region",
        variant: "eks-inference",
        disposition: "environment-placeholder-input",
        reason:
          "Deliberately renders the ConfigHub sentinel so an unfilled region fails vet-placeholders instead of reaching a cluster; bound per environment by a set-env-var link that addresses AWS_REGION by name.",
        evidence:
          "values.yaml L91; templates/deployment.yaml L116-117; rendered eks-inference Deployment env AWS_REGION value: confighubplaceholder; variants/eks-inference/values.yaml comment documents the set-env-var by-name link",
      },
      {
        path: "aws.region",
        variant: "default",
        disposition: "empty-at-chart-default",
        reason: "Empty by default, which renders an empty AWS_REGION env var.",
        evidence: "values.yaml L91; templates/deployment.yaml L116-117",
      },
      {
        path: "aws.credentials.secretName",
        variant: "eks-inference",
        disposition: "target-secret-reference",
        reason:
          "Set to aws-creds, which gates a Secret volume, a read-only mount at /var/run/secrets/aws, and the AWS_SHARED_CREDENTIALS_FILE plus AWS_PROFILE env vars. The Secret itself is never rendered; it must pre-exist in ack-system.",
        evidence:
          "values.yaml L97; templates/deployment.yaml L156-161 and L214-220; templates/_helpers.tpl aws.credentials.secret_mount_path L41-43",
      },
      {
        path: "aws.credentials.secretName",
        variant: "default",
        disposition: "inactive",
        reason: "Empty by default; no credential wiring renders at all.",
        evidence: "values.yaml L97; templates/deployment.yaml L156-161",
      },
      {
        path: "aws.credentials.secretKey",
        variant: "default, eks-inference",
        disposition: "checked-consistent",
        reason:
          "Set to credentials in both the chart default and eks-inference; it becomes the file name inside the mounted Secret and the tail of AWS_SHARED_CREDENTIALS_FILE.",
        evidence: "values.yaml L99; templates/_helpers.tpl aws.credentials.path L46-49",
      },
      {
        path: "installScope",
        variant: "default, eks-inference",
        disposition: "checked-at-cluster-scope",
        reason:
          "cluster in both audited bases, so the controller ClusterRole and ClusterRoleBinding render and ACK_WATCH_NAMESPACE renders empty. Setting namespace instead flips the RBAC shape and makes watchNamespace live.",
        evidence:
          "values.yaml L111; templates/_helpers.tpl watch-namespace L34-38; templates/cluster-role-controller.yaml; both rendered inventories contain ClusterRole ack-ec2-ec2-chart",
      },
      {
        path: "watchNamespace",
        variant: "default, eks-inference",
        disposition: "inactive-at-audited-values",
        reason:
          "Only consulted when installScope is namespace; empty falls back to the release namespace. Inactive at both audited bases.",
        evidence: "values.yaml L116; templates/_helpers.tpl L34-38",
      },
      {
        path: "serviceAccount.annotations",
        variant: "default, eks-inference",
        disposition: "alternate-credential-path-not-used",
        reason:
          "Empty in both bases. This is the IRSA hook (eks.amazonaws.com/role-arn); the eks-inference base uses the shared-credentials Secret path instead, so the two credential mechanisms do not overlap in the audited renders.",
        evidence: "values.yaml L179-180 including the commented role-arn example; templates/service-account.yaml",
      },
      {
        path: "metrics.service.create",
        variant: "default, eks-inference",
        disposition: "disabled-no-service-rendered",
        reason:
          "false in both bases, so no Service object renders and the object count excludes metrics-service.yaml.",
        evidence: "values.yaml L76; templates/metrics-service.yaml; neither object inventory contains a Service",
      },
      {
        path: "reconcile.resources",
        variant: "default, eks-inference",
        disposition: "chart-default-full-set",
        reason:
          "Lists all 20 EC2 kinds, joined into the RECONCILE_RESOURCES env var, so the controller reconciles its full surface at both bases.",
        evidence: "values.yaml L152-172; templates/deployment.yaml L126-127",
      },
      {
        path: "leaderElection.enabled",
        variant: "default, eks-inference",
        disposition: "checked-consistent-with-single-replica",
        reason:
          "false in both bases, so the leader-election args are absent. Safe because deployment.replicas stays 1; raising replicas without enabling leader election is the chart's own documented hazard.",
        evidence: "values.yaml L188 and L18-21; templates/deployment.yaml L76-80",
      },
      {
        path: "resourceTags",
        variant: "default, eks-inference",
        disposition: "runtime-substituted-passthrough",
        reason:
          "Four tag templates containing %TOKEN% markers (for example %CONTROLLER_VERSION%) render verbatim into ACK_RESOURCE_TAGS. The controller substitutes them at runtime; Helm does not. They look like unexpanded template variables in the rendered YAML but are intentional.",
        evidence: "values.yaml L122-129; templates/deployment.yaml L134-135; rendered Deployment env ACK_RESOURCE_TAGS",
      },
      {
        path: "image.repository, image.tag",
        variant: "default, eks-inference",
        disposition: "checked-pinned",
        reason:
          "Pinned to public.ecr.aws/aws-controllers-k8s/ec2-controller:1.18.4, matching the chart version and appVersion. Single image in the whole release.",
        evidence: "values.yaml L5-8; rendered Deployment image line; Chart.yaml appVersion 1.18.4",
      },
      {
        path: "featureGates",
        variant: "default, eks-inference",
        disposition: "chart-default-checked",
        reason:
          "Map rendered to a CSV FEATURE_GATES env var by a helper. Defaults enable ReadOnlyResources and ResourceAdoption and disable ServiceLevelCARM, TeamLevelCARM, and IAMRoleSelector. Both bases keep the defaults.",
        evidence: "values.yaml L205-215; templates/_helpers.tpl feature-gates L163-169; templates/deployment.yaml L152-155",
      },
      {
        path: "enableCARM, enableCrossNamespace",
        variant: "default, eks-inference",
        disposition: "chart-default-checked",
        reason:
          "Both true by default and passed straight into controller flags rather than env vars. Unchanged in both bases.",
        evidence: "values.yaml L195 and L200; templates/deployment.yaml L101-102",
      },
      {
        path: "everything-else",
        variant: "default, eks-inference",
        disposition: "not-exhaustively-checked",
        reason:
          "All remaining values (deployment.annotations, labels, tolerations, affinity, strategy, extraVolumes, extraVolumeMounts, extraEnvVars, hostNetwork, dnsPolicy, priorityClassName, log.enable_development_logging, aws.endpoint_url, aws.identity_endpoint_url, watchSelectors, reconcile resync maps, nameOverride, fullnameOverride, role.labels, image.pullSecrets) sit at chart defaults in both audited bases.",
        evidence: "values.yaml; no override in variants/default/values.yaml or variants/eks-inference/values.yaml",
      },
    ],
  },
  controlPoints: [
    {
      category: "source-lock",
      status: "handled",
      note: "source-lock.yaml pins the exact artifact oci://public.ecr.aws/aws-controllers-k8s/ec2-chart with packageSHA256 17c082ea... via the HELM_EXPT_CHART_ARTIFACT_URL/_SHA256 env pins, which must also be exported at verify time. The OCI manifestDigest has no kit field and is preserved in artifact-manifest-digest.yaml.",
    },
    {
      category: "dependency-lock",
      status: "handled",
      note: "The chart has zero dependencies (apiVersion v1, no charts/ directory, witness subcharts count 0). expectedDependencyCount is 0, the kit default.",
    },
    {
      category: "capability-profile",
      status: "handled",
      note: "kubeVersion 1.31.0, apiVersions empty. The chart uses no Capabilities checks (witness capabilities count 0), so the profile is declarative rather than render-affecting.",
    },
    {
      category: "lifecycle-policy",
      status: "handled",
      note: "The chart ships zero helm hooks and zero test hooks (witness counts 0), so no hook lifecycle exists to manage. This spec renders with hooks visible (no --no-hooks flag) and declares hookPolicy hooks-rendered-visible, matching the lean entry; with zero hooks the rendered bytes are identical either way. Never claim hooks exist for this chart.",
    },
    {
      category: "crd-policy",
      status: "handled-with-required-route",
      note: "22 CRDs (22 files, 22 documents in crds/) render with --include-crds and are counted in the 32 objects. Both flattening verdicts land flatten-with-routes with exactly one route, a CRD ordering declaration for the 22 EC2 CRDs; the eks-inference producer already emits it as the crds/controller split at Argo sync waves -20 and -10. The proof itself does not ship the route; it must travel with the bundle.",
    },
    {
      category: "namespace",
      status: "handled",
      note: "Both variants target ack-system with release name ack-ec2. The chart creates no Namespace object (witness namespace-creation 0), so the installer supplies v1|Namespace||ack-system as the single support object, matching the kit default.",
    },
    {
      category: "credentials-secrets",
      status: "required-for-eks-inference",
      note: "The chart generates no Secrets (witness generated-secrets 0; expectedSecretCount 0 for both bases). The eks-inference base references a pre-existing Secret ack-system/aws-creds with key credentials, mounted as the shared AWS credentials file. IRSA via serviceAccount annotation is the unmodeled alternative. The default base renders no credential wiring at all and cannot reach AWS.",
    },
    {
      category: "extension-slots",
      status: "unused-at-audited-values",
      note: "extraEnvVars, extraVolumes, extraVolumeMounts, deployment.annotations, deployment.labels, and image.pullSecrets are raw passthroughs into the Deployment and are empty in both audited bases. Renders with these populated are unaudited.",
    },
  ],
  dossier: {
    maintainedNotes: [
      "Both variants render exactly 32 objects: 22 CustomResourceDefinitions, 1 Deployment, 1 ServiceAccount, 2 ClusterRoles, 2 ClusterRoleBindings, 3 Roles, and 1 RoleBinding, everything cluster-scoped or in ack-system.",
      "The 22 CRDs split into 20 EC2 kinds (ec2.services.k8s.aws) plus the two common ACK CRDs fieldexports.services.k8s.aws and iamroleselectors.services.k8s.aws.",
      "The release runs one image, public.ecr.aws/aws-controllers-k8s/ec2-controller:1.18.4, pinned to the chart version.",
      "The witness scan is clean across every quirk class: zero hooks, zero lookups, zero resource-policy keep annotations, zero Capabilities checks, zero generated Secrets, zero webhooks, zero Namespace creation, zero subcharts (37 files scanned).",
      "The chart's one weird thing is resourceTags: the rendered ACK_RESOURCE_TAGS env var contains literal %CONTROLLER_VERSION% style tokens that the controller substitutes at runtime, so the rendered YAML shows what look like unexpanded template variables on purpose.",
      "deletionPolicy is the highest-stakes value: the chart default delete removes the AWS resource when the Kubernetes resource is deleted, so under a pruning reconciler a pruned manifest means deleted cloud infrastructure; the eks-inference base sets retain to make that accident inert.",
      "The eks-inference base renders aws.region as the literal string confighubplaceholder by design; the region belongs to the environment and is bound per variant by a set-env-var link that addresses AWS_REGION by name, with vet-placeholders failing while any sentinel remains.",
      "The default base is an audit base, not a deployable one: AWS_REGION renders empty and no credentials are wired, so the controller cannot reach AWS as rendered.",
      "installScope is cluster in both bases; switching to namespace changes the RBAC shape from ClusterRole to Role and activates watchNamespace, none of which is covered by these renders.",
    ],
    knownControlPoints: [
      "crd-ordering-route",
      "deletion-policy-vs-prune",
      "region-placeholder-binding",
      "target-secret-credentials",
      "capability-profile",
      "cluster-rbac-scan",
    ],
    extra: {
      caveats: [
        "ACK deletionPolicy: never flatten the default base into a pruning pipeline without changing deletionPolicy to retain or accepting that prune deletes AWS resources.",
        "The eks-inference base requires Secret ack-system/aws-creds (key credentials) to exist before the controller starts; IRSA via serviceAccount.annotations is a real alternative the audited bases do not use.",
        "aws.region must be filled before deploy; the eks-inference render intentionally ships confighubplaceholder and is not runnable as rendered.",
        "The CRD ordering route (crds/controller split, Argo sync waves -20 and -10) ships with the bundle producer, not with this recipe; a consumer flattening without that route is outside the verdict.",
        "Keep deployment.replicas at 1 unless leaderElection.enabled is turned on; the chart documents this and the audited bases hold both at defaults.",
        "The flattening scan is static; values-gated reachability is recorded judgment, not a render (verdict boundedness).",
      ],
    },
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction:
      "keep the CRD ordering declaration travelling with any flattened bundle and bind region and credentials per environment before any live scope opens",
    extraReadiness: {
      narrative:
        "Both bases render 32 objects deterministically from the artifact-addressed OCI package, and the witness finds no hook, lookup, keep, capabilities, or generated-secret quirks, so the flattening verdicts land flatten-with-routes with a single CRD ordering route. The controls that keep this usable are the route itself, the retain deletionPolicy on the eks-inference base, the pre-existing aws-creds Secret, and the region placeholder that vet-placeholders holds until an environment fills it. The default base exists to audit the chart as shipped; it renders an empty region, no credentials, and deletionPolicy delete, so it gates to local-test scopes only.",
    },
  },
  readme: {
    intro:
      "This recipe proves the ACK EC2 controller chart 1.18.4 renders deterministically and flattens safely. Two bases render 32 objects each, and the difference between them is operational posture rather than shape. The default base audits the chart exactly as shipped, where deletionPolicy delete means a pruned manifest deletes the AWS resource behind it. The eks-inference base sets retain, mounts credentials from a pre-existing aws-creds Secret, and renders the region as a ConfigHub placeholder so an unbound environment fails validation instead of reaching a cluster.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "both bases render the same 32-object shape deterministically from the artifact-addressed OCI package under the pinned Kubernetes capability profile;",
      "the chart carries no hooks, lookups, or generated secrets; its 22 CRDs are the one construct that needs a companion, and the ordering declaration ships with the bundle;",
      "the deletionPolicy-vs-prune hazard, the aws-creds target Secret, and the region placeholder are visible as recorded control points and gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) =>
    variant.name === "default"
      ? {
          decision: "warn",
          allowedScopes: ["local-test"],
          blockedScopes: ["production"],
          reasons: [
            "Helm equivalence passed for default",
            "audit base: renders empty AWS_REGION and no credential wiring, so the controller cannot reach AWS as rendered",
            "deletionPolicy is the chart default delete; a pruning reconciler that prunes a manifest deletes the AWS resource behind it",
            "cluster-scoped RBAC needs production review",
            variant.targetFactNote,
          ],
        }
      : {
          decision: "warn",
          allowedScopes: ["local-test"],
          blockedScopes: ["production"],
          reasons: [
            `Helm equivalence passed for ${variant.name}`,
            "requires Secret ack-system/aws-creds (key credentials) to exist before the controller starts",
            "aws.region ships as confighubplaceholder; vet-placeholders must fail until an environment binds a real region",
            "the CRD ordering route (crds/controller split, Argo sync waves -20 and -10) travels with the bundle producer, not this recipe",
            "cluster-scoped RBAC needs production review",
            variant.targetFactNote,
          ],
        },
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, ctx, variants, controlPoints, sourceLock, perVariant, check, readYaml, readFileSync, join }) {
    const manifestDoc = readYaml(join(root, "artifact-manifest-digest.yaml"));
    check(manifestDoc.kind === "ArtifactManifestDigest", "artifact-manifest-digest.yaml must be ArtifactManifestDigest");
    check(manifestDoc.spec.manifestDigest === artifactManifestDigest, "OCI manifest digest mismatch");
    check(manifestDoc.spec.packageSHA256 === artifactPackageSHA256, "artifact package SHA mismatch");
    check(sourceLock.spec.packageSHA256 === artifactPackageSHA256, "source-lock package SHA must match the pinned artifact");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(
      controlPoints.spec.points?.some((point) => point.category === "credentials-secrets"),
      "credentials-secrets control point missing",
    );
    for (const variant of variants) {
      const { identities, releasePath } = perVariant.get(variant.name);
      const crdCount = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|")).length;
      check(crdCount === expected.crdCount, `${variant.name} must render ${expected.crdCount} CRDs, got ${crdCount}`);
      check(
        identities.includes("apps/v1|Deployment|ack-system|ack-ec2-ec2-chart"),
        `${variant.name} controller Deployment missing`,
      );
      check(
        identities.includes("v1|ServiceAccount|ack-system|ack-ec2-controller"),
        `${variant.name} controller ServiceAccount missing`,
      );
      const release = readFileSync(releasePath, "utf8");
      check(!release.includes("kind: Service\n"), `${variant.name} must not render a metrics Service`);
      if (variant.name === "default") {
        check(release.includes("value: delete"), "default base must keep chart-default deletionPolicy delete");
      }
      if (variant.name === "eks-inference") {
        check(release.includes("value: confighubplaceholder"), "eks-inference AWS_REGION sentinel missing");
        check(release.includes("value: retain"), "eks-inference deletionPolicy retain missing");
        check(release.includes("secretName: aws-creds"), "eks-inference aws-creds Secret reference missing");
        check(
          release.includes("value: /var/run/secrets/aws/credentials"),
          "eks-inference AWS_SHARED_CREDENTIALS_FILE wiring missing",
        );
        const variantDoc = readYaml(join(root, "variants", "eks-inference", "variant.yaml"));
        const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.[0];
        check(requiredSecret?.name === "aws-creds", "eks-inference target Secret mismatch");
        check(requiredSecret?.keys?.includes("credentials"), "eks-inference credentials key missing");
        const requiredValue = variantDoc.spec.targetFacts?.requiredValues?.find((item) => item.path === "aws.region");
        check(requiredValue?.stage === "pre-render", "eks-inference aws.region target value must be pre-render");
      }
    }
  },
});
