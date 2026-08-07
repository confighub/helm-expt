// aws-controllers-k8s/eks-chart proof (ACK service controller for Amazon EKS).
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/ack-eks-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// The chart is artifact-addressed. Generate and verify runs must export:
//   HELM_EXPT_CHART_ARTIFACT_URL="oci://public.ecr.aws/aws-controllers-k8s/eks-chart"
//   HELM_EXPT_CHART_ARTIFACT_SHA256="3d76c60ddb8f3272236e0408899eddbb1710f6f59c6464bda43162d94d8a6054"

import { runProofCli } from "./lib/proof-kit.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "1.16.3";
const chart = {
  repository: "aws-controllers-k8s",
  repositoryURL: "oci://public.ecr.aws/aws-controllers-k8s",
  name: "eks-chart",
  version: chartVersion,
  releaseName: "ack-eks",
  namespace: "ack-system",
  kubeVersion: "1.31.0",
};

const versionExpectations = {
  "1.16.3": { defaultObjects: 20, eksInferenceObjects: 20 },
};
const artifactPackageSHA256 = "3d76c60ddb8f3272236e0408899eddbb1710f6f59c6464bda43162d94d8a6054";
const artifactManifestDigest = "sha256:77d88dd5a04ccc913da49bdb19dc962c83ac67579c0ae061f8c2aaf5ed12365c";
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`ack-eks ${chart.version} needs reviewed version-specific assertions`);

// Raw values text captured verbatim from the lean entry's variants/<name>/values.yaml
// files. The default base is a comment-only file: chart defaults, no overrides.
const defaultValuesText = `# Chart defaults. No overrides: this base audits the chart exactly as shipped.
`;

const eksInferenceValuesText = `# ACK EKS controller — provisions the cluster, its addons, and the system nodegroup.
#
# See ec2.yaml for why deletionPolicy is retain. It matters most here: a pruned
# eks.services.k8s.aws/Cluster would tear down the control plane.
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
    valuesSummary: "chart defaults with no overrides; audits the chart exactly as shipped, including deletionPolicy delete and an empty AWS_REGION",
    expectedObjectCount: expected.defaultObjects,
    targetFactNote:
      "deletionPolicy delete is the chart default, so flattening this base under a pruning reconciler inherits AWS-resource deletion on prune; AWS_REGION renders empty and the controller relies on ambient region and identity configuration",
  },
  {
    name: "eks-inference",
    base: "eks-inference",
    displayName: "eks-inference",
    valuesFile: "effective-values-eks-inference.yaml",
    valuesText: eksInferenceValuesText,
    valuesSummary: "deletionPolicy retain, aws-creds credentials Secret mounted read-only, aws.region held as the confighubplaceholder sentinel",
    expectedObjectCount: expected.eksInferenceObjects,
    targetFactNote:
      "requires target Secret ack-system/aws-creds with key credentials before the controller starts, and the aws.region confighubplaceholder sentinel must be bound per target before delivery",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "ack-system",
          name: "aws-creds",
          keys: ["credentials"],
          purpose: "AWS shared credentials file mounted read-only at /var/run/secrets/aws",
        },
      ],
      requiredValues: [
        {
          path: "aws.region",
          purpose: "AWS region for the controller's API calls; rendered as the confighubplaceholder sentinel and filled per target",
          stage: "setup",
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
  receiptSlug: "ack-eks",
  scriptPrefix: "ack-eks",
  // The chart ships zero hooks and zero test hooks, so rendering without --no-hooks
  // is byte-identical to rendering with it. The entry renders hooks visible and
  // declares hookPolicy hooks-rendered-visible so the declaration matches the flags.
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
        metadata: { name: `aws-controllers-k8s-eks-chart-${chart.version}` },
        spec: {
          url: `oci://public.ecr.aws/aws-controllers-k8s/eks-chart:${chart.version}`,
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
      prompt: "AWS region for the ACK EKS controller (fills the AWS_REGION env var)",
      description:
        "Used by the eks-inference base. Replaces the confighubplaceholder sentinel by writing the AWS_REGION env var by name; the default base keeps the chart's empty region and ignores this input.",
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
        "Bind AWS_REGION on the controller Deployment from the installer input, addressed by variable name so a chart bump that adds or reorders env vars cannot redirect the write.",
      invocations: [{ name: "set-env-var", args: ["controller", "AWS_REGION", "{{ .Inputs.awsRegion }}"] }],
      toolchain: "Kubernetes/YAML",
      whereResource:
        "{{ if eq .Selection.Base \"eks-inference\" }}ConfigHub.ResourceType = 'apps/v1/Deployment'{{ else }}ConfigHub.ResourceType = 'helm-expt.invalid/v1/Never'{{ end }}",
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "aws.region",
        variant: "eks-inference",
        disposition: "environment-owned-input",
        reason:
          "renders as the confighubplaceholder sentinel and flows into the AWS_REGION env var that the container args dereference by name; the awsRegion installer input fills it per target via set-env-var addressed by name",
      },
      {
        path: "aws.region",
        variant: "default",
        disposition: "chart-default-empty",
        reason: "renders empty, so the controller depends on ambient region configuration at the target",
      },
      {
        path: "aws.credentials.secretName",
        variant: "eks-inference",
        disposition: "target-secret-reference",
        reason:
          "mounts target Secret aws-creds key credentials read-only and adds AWS_SHARED_CREDENTIALS_FILE and AWS_PROFILE env vars; the chart renders no Secret object itself",
      },
      {
        path: "deletionPolicy",
        variant: "eks-inference",
        disposition: "variant-pinned-safety-control",
        reason:
          "pinned to retain because a pruned eks.services.k8s.aws/Cluster would otherwise tear down a live control plane under a pruning reconciler",
      },
      {
        path: "deletionPolicy",
        variant: "default",
        disposition: "chart-default-audited",
        reason:
          "chart default delete removes the AWS resource before the Kubernetes resource; the default base audits that behavior exactly as shipped",
      },
      {
        path: "installScope",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "cluster scope emits the ClusterRole and ClusterRoleBinding; namespace scope would replace the binding with per-namespace RoleBindings ranged over watchNamespace; both bases keep cluster scope",
      },
      {
        path: "watchNamespace",
        variant: "default",
        disposition: "dormant-at-audited-values",
        reason:
          "only read when installScope is namespace; the helper defaults it to the release namespace and accepts a comma-separated list; the namespace-scope branch is unexercised by both bases",
      },
      {
        path: "metrics.service.create",
        variant: "eks-inference",
        disposition: "chart-default-kept",
        reason:
          "false, so no metrics Service renders and no scrape endpoint ships with either base; the eks-inference base restates false explicitly",
      },
      {
        path: "serviceAccount.name",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "fixed at ack-eks-controller rather than release-derived; the empty annotations map is the IRSA wiring point for ambient credentials",
      },
      {
        path: "leaderElection.enabled",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "false, so the leader-election Role, RoleBinding, and flags do not render; the chart comment recommends enabling it before raising replicas above 1",
      },
      {
        path: "reconcile.resources",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "enumerates the eight EKS kinds the controller reconciles and feeds the RECONCILE_RESOURCES env var, matching the eight eks.services.k8s.aws CRDs in the render",
      },
      {
        path: "image.repository",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "public.ecr.aws/aws-controllers-k8s/eks-controller at tag 1.16.3, pinned to appVersion; the tag is a version tag, not a digest; single image across both bases",
      },
      {
        path: "featureGates",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "ReadOnlyResources and ResourceAdoption default true; ServiceLevelCARM, TeamLevelCARM, and IAMRoleSelector default false; the non-empty map always renders the FEATURE_GATES env var and flag",
      },
      {
        path: "enableCARM",
        variant: "default",
        disposition: "chart-default-kept",
        reason:
          "true by default and rendered directly into container args rather than through env vars, unlike almost every other setting in this chart",
      },
    ],
    unknownValues:
      "deployment.extraEnvVars, extraVolumes, extraVolumeMounts, tolerations, affinity, priorityClassName, hostNetwork, dnsPolicy, strategy, resources, resourceTags, log.*, the reconcile resync and concurrency maps, watchSelectors, aws.endpoint_url and identity_endpoint_url, role.labels, nameOverride, and fullnameOverride stay at chart defaults in both audited bases and were not exhaustively checked",
  },
  controlPoints: [
    {
      category: "source-lock",
      status: "handled",
      evidence: "source-lock.yaml",
      note: "artifact-addressed at oci://public.ecr.aws/aws-controllers-k8s/eks-chart version 1.16.3 with a recorded packageSHA256; the kit expresses exact-artifact pinning only through the HELM_EXPT_CHART_ARTIFACT_URL and HELM_EXPT_CHART_ARTIFACT_SHA256 env vars, so generate and verify runs must export both. The OCI manifestDigest has no kit field and is preserved in artifact-manifest-digest.yaml",
    },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "zero subchart dependencies; expectedDependencyCount stays at the default 0",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "empty apiVersions list in both variants; the render does not depend on the capability profile beyond kubeVersion",
    },
    {
      category: "hook-policy",
      status: "handled",
      policy: "hooks-rendered-visible",
      note: "the chart ships zero hooks and zero test hooks, so the render is identical with or without --no-hooks; this entry renders without --no-hooks and declares hooks-rendered-visible so the declaration matches the flags",
    },
    {
      category: "crd-policy",
      status: "needs-route",
      note: "ten CRDs ship in crds/ and render with --include-crds into both bases; the ordering declaration required by the flattening verdicts ships downstream as the crds/controller split at Argo sync waves -20 and -10; the route travels with the bundle, not inside the chart",
    },
    {
      category: "namespace",
      status: "handled",
      note: "all namespaced objects land in ack-system; the chart creates no Namespace, so the installer supplies v1|Namespace||ack-system as the single cub-only support object",
    },
    {
      category: "credentials-secrets",
      status: "required-for-eks-inference",
      evidence: "variants/eks-inference/variant.yaml",
      note: "the chart renders no Secret and generates none; the eks-inference base mounts target Secret ack-system/aws-creds with key credentials, which must exist before the controller starts; the default base carries no credential wiring and relies on ambient identity via the empty serviceAccount.annotations IRSA slot",
    },
    {
      category: "extension-slots",
      status: "open-unchecked",
      note: "deployment.extraEnvVars, extraVolumes, and extraVolumeMounts splice raw manifest fragments into the pod spec, and serviceAccount.annotations is the IRSA slot; all stay empty in both audited bases, so their behavior is asserted from template reading, not from a rendered check",
    },
  ],
  dossier: {
    extra: {
      caveats: [
        "aws.region renders as the confighubplaceholder sentinel in the eks-inference base and must be filled per target before delivery; vet-placeholders fails while it remains.",
        "deletionPolicy delete is the chart default; anyone flattening the default base under a pruning reconciler inherits AWS-resource deletion on prune. The eks-inference base pins retain.",
        "Target Secret ack-system/aws-creds with key credentials must exist before the eks-inference controller starts; the chart never creates it.",
        "The ten CRDs need the ordering declaration named in the flattening verdicts; the eks-inference producer ships it as the crds/controller split at sync waves -20 and -10.",
        "metrics.service.create false means no metrics Service and no scrape endpoint in either base.",
        "The chart comment recommends enabling leaderElection before raising deployment.replicas above 1; nothing in the templates enforces it.",
        "In the default base AWS_REGION renders empty; the controller then depends on ambient region configuration, and serviceAccount.annotations is the empty IRSA slot.",
        "This chart has no karpenter or NVIDIA/NFD surface; those caveats belong to sibling eks-inference charts, not this one.",
      ],
    },
    maintainedNotes: [
      "Both bases render exactly 20 objects: 10 CustomResourceDefinitions from crds/ plus a Deployment, a ServiceAccount named ack-eks-controller, 2 ClusterRoles, 2 ClusterRoleBindings, 3 Roles, and 1 RoleBinding.",
      "The chart runs one image, public.ecr.aws/aws-controllers-k8s/eks-controller:1.16.3, with the tag pinned to appVersion.",
      "The witness counts zero hooks, zero lookups, zero resource-policy keep annotations, zero Capabilities branches, zero generated secrets, and zero subcharts; both flattening verdicts place the chart in the flatten-with-routes lane with the CRD ordering declaration as the one route.",
      "The chart's one weird thing is its env-var indirection: almost every values setting renders as an env var that the container args dereference by name, for example --aws-region \"$(AWS_REGION)\". This makes AWS_REGION addressable by name, which is why the eks-inference pipeline binds the region with set-env-var rather than a positional path.",
      "deletionPolicy defaults to delete, which removes the AWS resource before the Kubernetes resource. The eks-inference base pins retain because a pruned eks.services.k8s.aws/Cluster CR would tear down a live EKS control plane under a pruning reconciler.",
      "Eight of the ten CRDs are eks.services.k8s.aws kinds matching the reconcile.resources list; the other two (fieldexports, iamroleselectors) belong to the shared services.k8s.aws group.",
      "installScope cluster produces the ClusterRole and ClusterRoleBinding; namespace scope would replace the binding with per-namespace RoleBindings ranged over watchNamespace. Neither base exercises the namespace branch.",
      "The container runs with readOnlyRootFilesystem, runAsNonRoot, all capabilities dropped, and a RuntimeDefault seccomp profile.",
    ],
    knownControlPoints: [
      "source-lock",
      "dependency-lock",
      "capability-profile",
      "hook-policy",
      "crd-ordering-route",
      "namespace-support-object",
      "target-credentials",
      "deletion-policy-variant-pin",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    extraReadiness: {
      summary:
        "Both bases render 20 objects deterministically from the artifact-addressed 1.16.3 package, and the flattening verdicts clear every quirk class except CRD ordering, which the shipped crds/controller split already routes. The default base audits the chart exactly as shipped, including deletionPolicy delete; the eks-inference base pins retain and defers aws.region to a placeholder filled per target. Nothing in either base depends on hooks, lookups, or generated secrets, so the flattened bundle equals the Helm render plus the ack-system Namespace support object.",
    },
    nextAction:
      "promote beyond local-test only after the ack-system/aws-creds target Secret exists, the aws.region placeholder is bound per target, and the CRD ordering route ships with the bundle",
  },
  readme: {
    intro:
      "This is the promoted proof slice for the ACK service controller for Amazon EKS, pulled from oci://public.ecr.aws/aws-controllers-k8s/eks-chart at version tag 1.16.3 and pinned by packageSHA256. Both bases render 20 objects: ten CRDs (eight eks.services.k8s.aws kinds plus two shared services.k8s.aws kinds) and ten controller objects, of which six are namespaced in ack-system and four are cluster-scoped RBAC objects.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "both bases render the same 20-object identity set deterministically under the pinned 1.31.0 capability profile;",
      "the chart ships no hooks, no lookups, and no generated secrets, so the flattened bundle equals the Helm render, and the ten CRDs carry the one required route, an ordering declaration shipped downstream as the crds/controller split;",
      "the eks-inference base pins deletionPolicy retain so a pruned Cluster resource cannot tear down a live control plane, mounts the aws-creds credentials Secret as an explicit target prerequisite, and holds aws.region as the confighubplaceholder sentinel until the awsRegion installer input fills AWS_REGION by name.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "cluster-scoped RBAC needs production review",
      "the ten CRDs need the bundle-side ordering declaration (crds/controller split) before flattened delivery",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, readFileSync, join }) {
    const manifestDoc = readYaml(join(root, "artifact-manifest-digest.yaml"));
    check(manifestDoc.kind === "ArtifactManifestDigest", "artifact-manifest-digest.yaml must be ArtifactManifestDigest");
    check(manifestDoc.spec.manifestDigest === artifactManifestDigest, "OCI manifest digest mismatch");
    check(manifestDoc.spec.packageSHA256 === artifactPackageSHA256, "artifact packageSHA256 mismatch");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-policy"), "crd-policy control point missing");
    check(
      controlPoints.spec.points?.some((point) => point.category === "credentials-secrets"),
      "credentials-secrets control point missing",
    );
    for (const variant of variants) {
      const { identities, releasePath, scan } = perVariant.get(variant.name);
      check(identities.includes("apps/v1|Deployment|ack-system|ack-eks-eks-chart"), `${variant.name} Deployment missing`);
      check(identities.includes("v1|ServiceAccount|ack-system|ack-eks-controller"), `${variant.name} ServiceAccount missing`);
      check(
        identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||clusters.eks.services.k8s.aws"),
        `${variant.name} Cluster CRD missing`,
      );
      check(
        identities.filter((identity) => identity.includes("|CustomResourceDefinition|")).length === 10,
        `${variant.name} must render exactly 10 CRDs`,
      );
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag cluster-scoped RBAC review`);
      const releaseText = readFileSync(releasePath, "utf8");
      if (variant.name === "eks-inference") {
        check(/name: DELETION_POLICY\s+value: retain/.test(releaseText), "eks-inference DELETION_POLICY retain missing");
        check(releaseText.includes("value: confighubplaceholder"), "eks-inference AWS_REGION placeholder missing");
        check(releaseText.includes("secretName: aws-creds"), "eks-inference aws-creds Secret mount missing");
        const variantDoc = readYaml(join(root, "variants", "eks-inference", "variant.yaml"));
        const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.[0];
        check(requiredSecret?.name === "aws-creds", "eks-inference target Secret mismatch");
        check(requiredSecret?.keys?.includes("credentials"), "eks-inference credentials key missing");
      }
      if (variant.name === "default") {
        check(/name: DELETION_POLICY\s+value: delete/.test(releaseText), "default DELETION_POLICY delete missing");
        check(!releaseText.includes("confighubplaceholder"), "default base must not carry the placeholder sentinel");
        check(!releaseText.includes("secretName: aws-creds"), "default base must not reference aws-creds");
      }
    }
  },
});
