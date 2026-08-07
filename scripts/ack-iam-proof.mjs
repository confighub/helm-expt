// aws-controllers-k8s/iam-chart proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/ack-iam-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// The chart is pulled as an exact artifact. Export both env pins at generate AND
// verify time so the source-lock exactArtifact block reproduces and re-checks:
//   HELM_EXPT_CHART_ARTIFACT_URL="oci://public.ecr.aws/aws-controllers-k8s/iam-chart"
//   HELM_EXPT_CHART_ARTIFACT_SHA256="598f87feacd5fc04403e37bda75ba6e56170f43778986ac411702d6207a82730"

import { runProofCli } from "./lib/proof-kit.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "1.7.3";
const chart = {
  repository: "aws-controllers-k8s",
  repositoryURL: "oci://public.ecr.aws/aws-controllers-k8s",
  name: "iam-chart",
  version: chartVersion,
  releaseName: "ack-iam",
  namespace: "ack-system",
  kubeVersion: "1.31.0",
};

const versionExpectations = {
  "1.7.3": { defaultObjects: 19, eksInferenceObjects: 19, crdCount: 9 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`aws-controllers-k8s/iam-chart ${chart.version} needs reviewed version-specific assertions`);

// Raw values captured byte-for-byte from the lean entry's
// recipes/aws-controllers-k8s/iam-chart/1.7.3/variants/<name>/values.yaml.
// The comment-only default file means chart defaults; the comment text is kept.
const defaultValuesText = `# Chart defaults. No overrides: this base audits the chart exactly as shipped.
`;

const eksInferenceValuesText = `# ACK IAM controller — provisions the EKS cluster and node roles.
#
# See ec2.yaml for why deletionPolicy is retain.
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
    valuesSummary: "chart defaults with no overrides; audits the chart exactly as shipped",
    expectedObjectCount: expected.defaultObjects,
    targetFactNote:
      "audits chart defaults: AWS_REGION renders with an empty value, deletionPolicy renders delete, and no credentials mount renders",
  },
  {
    name: "eks-inference",
    base: "eks-inference",
    displayName: "EKS inference (retained values)",
    valuesFile: "effective-values-eks-inference.yaml",
    valuesText: eksInferenceValuesText,
    valuesSummary:
      "retained inference values: region sentinel, deletionPolicy retain, aws-creds credentials Secret reference",
    expectedObjectCount: expected.eksInferenceObjects,
    targetFactNote:
      "requires target Secret ack-system/aws-creds with key credentials mounted read-only at /var/run/secrets/aws, and an aws.region value filled per environment before the confighubplaceholder sentinel clears vet-placeholders",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "ack-system",
          name: "aws-creds",
          keys: ["credentials"],
          purpose:
            "AWS shared credentials file; the Deployment mounts the Secret volume read-only at /var/run/secrets/aws and AWS_SHARED_CREDENTIALS_FILE points at /var/run/secrets/aws/credentials",
        },
      ],
      requiredValues: [
        {
          path: "aws.region",
          purpose:
            "AWS region for the controller; deliberately the confighubplaceholder sentinel because the region belongs to the environment, not the chart",
          stage: "pre-apply",
          source: "platform-profile",
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
  receiptSlug: "ack-iam",
  scriptPrefix: "ack-iam",
  // The lean entry declares hooks-rendered-visible: the chart has zero helm hooks
  // and zero test hooks, so the render drops --no-hooks and any future hook would
  // surface in the rendered objects instead of being silently skipped.
  hookPolicy: "hooks-rendered-visible",
  renderFlags: ["--include-crds", "--skip-tests"],
  // single cub-only support object (the created Namespace)
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageInputs: [
    {
      name: "awsRegion",
      type: "string",
      default: "confighubplaceholder",
      prompt: "AWS region for the ACK IAM controller (AWS_REGION)",
      description:
        "Used by the eks-inference base. Replaces the confighubplaceholder sentinel in the controller AWS_REGION env var, addressed by env var name so a chart bump that adds or reorders env vars cannot redirect the write. The default keeps the sentinel on purpose: vet-placeholders blocks any deploy that still carries it.",
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
        "Bind the controller AWS_REGION env var from the installer input, addressed by env var name.",
      invocations: [
        { name: "set-env-var", args: ["controller", "AWS_REGION", "{{ .Inputs.awsRegion }}"] },
      ],
      toolchain: "Kubernetes/YAML",
      whereResource:
        "{{ if eq .Selection.Base \"eks-inference\" }}ConfigHub.ResourceType = 'apps/v1/Deployment'{{ else }}ConfigHub.ResourceType = 'helm-expt.invalid/v1/Never'{{ end }}",
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "aws.region",
        variant: "default",
        disposition: "environment-input-placeholder",
        reason:
          "empty at chart defaults, so AWS_REGION renders with an empty value; the controller must get a region from somewhere at runtime",
      },
      {
        path: "aws.region",
        variant: "eks-inference",
        disposition: "environment-input-placeholder",
        reason:
          "renders the confighubplaceholder sentinel instead of a guess; filled per variant by a set-env-var link addressed by env var name, and vet-placeholders blocks any render that still carries the sentinel",
      },
      {
        path: "aws.credentials.secretName",
        variant: "default",
        disposition: "inert-at-audited-values",
        reason: "empty, so no credentials env vars, Secret volume, or mount render",
      },
      {
        path: "aws.credentials.secretName",
        variant: "eks-inference",
        disposition: "target-secret-reference",
        reason:
          "aws-creds/credentials/default adds AWS_SHARED_CREDENTIALS_FILE and AWS_PROFILE env vars plus a Secret volume mounted read-only at /var/run/secrets/aws; the Secret is never rendered by the chart and must exist before the pod starts",
      },
      {
        path: "deletionPolicy",
        variant: "default",
        disposition: "per-variant-choice",
        reason:
          "chart default delete renders as the DELETION_POLICY env var and the --deletion-policy flag; the single most consequential values choice under a pruning reconciler",
      },
      {
        path: "deletionPolicy",
        variant: "eks-inference",
        disposition: "per-variant-choice",
        reason: "set to retain so pruning the Kubernetes resource keeps the AWS-side resource",
      },
      {
        path: "installScope",
        variant: "eks-inference",
        disposition: "cluster-scope-rbac-choice",
        reason:
          "cluster in both audited bases, which renders the controller ClusterRole and ClusterRoleBinding; the namespace setting would instead render per-watch-namespace Roles",
      },
      {
        path: "watchNamespace",
        variant: "default",
        disposition: "inert-at-audited-values",
        reason: "empty in both bases and inert while installScope=cluster; only consulted for namespace scope",
      },
      {
        path: "metrics.service.create",
        variant: "eks-inference",
        disposition: "disabled-object-gate",
        reason:
          "false in both bases (chart default, pinned explicitly here), so the Prometheus metrics Service is not rendered; flipping it adds exactly one Service and changes the object count",
      },
      {
        path: "leaderElection.enabled",
        variant: "default",
        disposition: "disabled-object-gate",
        reason:
          "false; no leader-election Role or RoleBinding renders and the --enable-leader-election flag is absent; required before raising replicas above 1",
      },
      {
        path: "deployment.replicas",
        variant: "default",
        disposition: "chart-default-safe-at-one",
        reason: "1 in both bases; the chart's own comment says leader election should be enabled before increasing it",
      },
      {
        path: "serviceAccount.name",
        variant: "default",
        disposition: "fixed-identity-object",
        reason:
          "fixed name ack-iam-controller does not derive from the release name, so two releases in one namespace would collide; the IRSA annotation slot is empty in both audited bases",
      },
      {
        path: "image.repository",
        variant: "default",
        disposition: "chart-default-image",
        reason:
          "public.ecr.aws/aws-controllers-k8s/iam-controller:1.7.3 in both bases; the tag tracks the chart version and is the single image in the whole render",
      },
      {
        path: "reconcile.resources",
        variant: "default",
        disposition: "chart-default-reconcile-set",
        reason:
          "seven kinds (Group, InstanceProfile, OpenIDConnectProvider, Policy, Role, ServiceLinkedRole, User) joined into the RECONCILE_RESOURCES env var; unchanged in both bases",
      },
      {
        path: "featureGates.IAMRoleSelector",
        variant: "default",
        disposition: "gate-off-crd-still-installed",
        reason:
          "false, yet the iamroleselectors CRD ships from the crds/ directory regardless, and the FEATURE_GATES env var always renders because the default featureGates map is non-empty; the chart's known oddity",
      },
      {
        path: "log.level",
        variant: "eks-inference",
        disposition: "explicit-pin-of-default",
        reason: "info, pinned explicitly in the eks-inference values and matching the chart default",
      },
    ],
    unknownValues:
      "deployment.extraEnvVars, extraVolumes, extraVolumeMounts, tolerations, affinity, strategy, resourceTags, reconcile resync tuning, enableCARM, enableCrossNamespace and the remaining feature gates stay at chart defaults in both audited bases; not exhaustively checked",
  },
  controlPoints: [
    {
      category: "source-lock",
      status: "handled",
      evidence: "source-lock.yaml",
      note: "pins the exact artifact oci://public.ecr.aws/aws-controllers-k8s/iam-chart with packageSHA256 598f87feacd5fc04403e37bda75ba6e56170f43778986ac411702d6207a82730; resolution is artifact-addressed. Reproduction requires HELM_EXPT_CHART_ARTIFACT_URL and HELM_EXPT_CHART_ARTIFACT_SHA256 exported at generate and verify time.",
    },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "the chart has zero subcharts and zero subchart conditions, so the dependency lock records an empty dependency list",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "both variants pin kubeVersion 1.31.0 with an empty apiVersions list; no template consults .Capabilities, so the profile is a pin rather than a behavior switch",
    },
    {
      category: "lifecycle-policy",
      status: "handled",
      policy: "hooks-rendered-visible",
      note: "the chart renders zero helm hooks and zero test hooks; the render drops --no-hooks so any future hook would surface in the rendered objects instead of being silently skipped",
    },
    {
      category: "crd-policy",
      status: "route-required",
      note: "nine CRDs ship from the chart's crds/ directory. Both flattening verdicts land on flatten-with-routes with one route, the CRD ordering declaration; the eks-inference producer already emits exactly this as the crds/controller split at Argo sync waves -20 and -10. Never present this chart as flatten-clean without the route.",
    },
    {
      category: "namespace",
      status: "handled-by-installer",
      note: "both bases target ack-system with releaseName ack-iam; the chart creates no Namespace object, so the installer's default support object v1|Namespace||ack-system covers it",
    },
    {
      category: "credentials-secrets",
      status: "required-target-fact-for-eks-inference",
      note: "the chart generates no Secrets and renders none in either base. The eks-inference base references the external Secret ack-system/aws-creds (key credentials); the Deployment mounts the Secret volume read-only at /var/run/secrets/aws and AWS_SHARED_CREDENTIALS_FILE points at /var/run/secrets/aws/credentials, so the Secret must exist before the controller pod starts. The default base carries no credential reference at all.",
    },
    {
      category: "extension-slots",
      status: "unused-in-audited-bases",
      note: "deployment.extraEnvVars, extraVolumes, extraVolumeMounts, tolerations, affinity, strategy, annotations and labels are all empty at the audited values; the templates wire them through but nothing in either rendered revision exercises them",
    },
  ],
  dossier: {
    maintainedNotes: [
      "Both bases render exactly 19 objects with identical object inventories; the only rendered difference is the Deployment environment block, where AWS_REGION, DELETION_POLICY and the credentials mount change.",
      "Nine CRDs ship from the chart's crds/ directory: seven iam.services.k8s.aws kinds (groups, instanceprofiles, openidconnectproviders, policies, roles, servicelinkedroles, users) plus the shared services.k8s.aws fieldexports and iamroleselectors.",
      "The whole release runs one image, public.ecr.aws/aws-controllers-k8s/iam-controller:1.7.3, and appVersion equals the chart version.",
      "The chart has zero helm hooks, zero test hooks, zero lookups, zero generated secrets, zero webhook configs and zero subcharts; the CRDs are the single flattening companion this chart needs.",
      "The ServiceAccount name is fixed at ack-iam-controller and does not derive from the release name.",
      "The chart's one weird thing is that FEATURE_GATES always renders because the default featureGates map is non-empty, and the iamroleselectors CRD installs even while its IAMRoleSelector gate is false.",
      "The default base renders AWS_REGION with an empty value; the controller must get a region from somewhere at runtime, which is why the eks-inference base carries the confighubplaceholder sentinel instead of a guess.",
      "At installScope cluster the RBAC set is two ClusterRoles, two ClusterRoleBindings, three namespaced Roles (reader, writer, configmaps-cache) and one RoleBinding in ack-system.",
      "The eks-inference base mounts the aws-creds Secret volume read-only at /var/run/secrets/aws with AWS_PROFILE default; AWS_SHARED_CREDENTIALS_FILE points at /var/run/secrets/aws/credentials (mount path plus the credentials key). The Secret itself is never rendered.",
    ],
    knownControlPoints: [
      "crd-ordering-route",
      "environment-input-placeholder",
      "credentials-target-secret",
      "deletion-policy-variant-choice",
      "capability-profile",
      "cluster-rbac-scan",
    ],
    extra: {
      caveats: [
        "deletionPolicy is the consequential choice: the chart default delete removes the AWS-side resource when the Kubernetes resource is pruned, while the eks-inference base sets retain. Decide it per target, never by accident.",
        "aws.region stays confighubplaceholder until a platform-profile link fills it via set-env-var, addressed by env var name so a chart bump cannot redirect the write; vet-placeholders fails while the sentinel remains.",
        "Raising deployment.replicas above 1 without leaderElection.enabled=true puts multiple reconcilers in contention; the chart's own values comment says to enable leader election first.",
        "Two releases in one namespace collide on the fixed ack-iam-controller ServiceAccount name.",
        "The IRSA annotation slot (eks.amazonaws.com/role-arn) is empty in both audited bases; credentials come from the mounted aws-creds Secret, and switching to IRSA is an unaudited path.",
        "Any flattened bundle must carry the CRD ordering declaration for the nine CRDs; the eks-inference producer already ships it as sync waves -20 and -10.",
      ],
    },
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    extraReadiness: {
      flatteningVerdict:
        "flatten-with-routes; the CRD ordering declaration for the nine CRDs is the single route, and the eks-inference producer already ships it as sync waves -20 and -10",
    },
    nextAction:
      "fill the aws.region placeholder per environment, create the ack-system/aws-creds Secret before the eks-inference controller starts, and decide deletionPolicy per target before promotion",
  },
  readme: {
    intro:
      "This is the promoted proof slice for the ACK IAM controller chart 1.7.3, pulled as the exact artifact oci://public.ecr.aws/aws-controllers-k8s/iam-chart and pinned by digest in source-lock.yaml.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "both bases render the same 19 objects deterministically under the pinned 1.31.0 capability profile, and the only rendered difference sits in the controller environment (region, deletion policy, credentials mount);",
      "the aws.region value stays confighubplaceholder on purpose because the region belongs to the environment, and vet-placeholders blocks any render that still carries the sentinel;",
      "the chart has no hooks, no lookups and no generated secrets, so the flattening verdict is flatten-with-routes with the CRD ordering declaration for the nine crds/-shipped CRDs as the one companion;",
      "deletionPolicy (delete vs retain under a pruning reconciler) and cluster-scoped RBAC are visible as gate reasons and scan findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "deletionPolicy must be a deliberate per-target choice: delete removes the AWS-side resource when the Kubernetes resource is pruned",
      "Cluster-scoped RBAC needs production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, readFileSync, join }) {
    check(
      controlPoints.spec.points?.some((point) => point.category === "crd-policy" && point.status === "route-required"),
      "crd-policy route-required control point missing",
    );
    check(
      controlPoints.spec.points?.some((point) => point.category === "credentials-secrets"),
      "credentials-secrets control point missing",
    );
    for (const variant of variants) {
      const { identities, releasePath } = perVariant.get(variant.name);
      const crds = identities.filter((identity) => identity.includes("|CustomResourceDefinition|"));
      check(crds.length === expected.crdCount, `${variant.name} must ship ${expected.crdCount} CRDs, saw ${crds.length}`);
      check(
        crds.some((identity) => identity.endsWith("|iamroleselectors.services.k8s.aws")),
        `${variant.name} iamroleselectors CRD missing despite the IAMRoleSelector gate being false`,
      );
      check(
        identities.includes(`apps/v1|Deployment|${chart.namespace}|ack-iam-iam-chart`),
        `${variant.name} controller Deployment missing`,
      );
      check(
        identities.includes(`v1|ServiceAccount|${chart.namespace}|ack-iam-controller`),
        `${variant.name} fixed-name ServiceAccount missing`,
      );
      check(
        !identities.some((identity) => identity.startsWith("v1|Secret|")),
        `${variant.name} must render zero Secrets`,
      );
      const releaseText = readFileSync(releasePath, "utf8");
      if (variant.name === "default") {
        check(!releaseText.includes("confighubplaceholder"), "default must not carry the region sentinel");
        check(!releaseText.includes("mountPath: /var/run/secrets/aws"), "default must not mount credentials");
        check(/name: DELETION_POLICY\s+value: delete/.test(releaseText), "default DELETION_POLICY must be delete");
      }
      if (variant.name === "eks-inference") {
        check(
          /name: AWS_REGION\s+value: confighubplaceholder/.test(releaseText),
          "eks-inference AWS_REGION sentinel missing",
        );
        check(/name: DELETION_POLICY\s+value: retain/.test(releaseText), "eks-inference DELETION_POLICY must be retain");
        check(releaseText.includes("mountPath: /var/run/secrets/aws"), "eks-inference credentials mount missing");
        check(
          releaseText.includes("value: /var/run/secrets/aws/credentials"),
          "eks-inference AWS_SHARED_CREDENTIALS_FILE path missing",
        );
        const variantDoc = readYaml(join(root, "variants", "eks-inference", "variant.yaml"));
        const requiredSecret = variantDoc.spec.targetFacts?.requiredSecrets?.[0];
        check(requiredSecret?.namespace === "ack-system", "eks-inference target Secret namespace mismatch");
        check(requiredSecret?.name === "aws-creds", "eks-inference target Secret mismatch");
        check(requiredSecret?.keys?.includes("credentials"), "eks-inference credentials key missing");
        const requiredValue = variantDoc.spec.targetFacts?.requiredValues?.find((item) => item.path === "aws.region");
        check(requiredValue?.installerInput === "awsRegion", "eks-inference aws.region installer input missing");
      }
    }
  },
});
