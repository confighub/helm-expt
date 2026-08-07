// karpenter proof.
//
// Chart-specific declaration only. All generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs and is shared across every chart proof. The CLI surface
// is unchanged:
//   node scripts/karpenter-proof.mjs --generate-proof|--generate-package|
//        --verify-proof|--verify-proof-self-test|--verify-package|--compare
//
// The chart is published as an exact OCI artifact, so generate and verify runs pin it:
//   HELM_EXPT_CHART_ARTIFACT_URL="oci://public.ecr.aws/karpenter/karpenter"
//   HELM_EXPT_CHART_ARTIFACT_SHA256="d576f955623fa421933d69ea2badc422b24df318b352747a5cd3d18de710ffe2"

import { runProofCli } from "./lib/proof-kit.mjs";

const chartVersion = process.env.HELM_EXPT_CHART_VERSION ?? "1.14.0";
const chart = {
  repository: "karpenter",
  repositoryURL: "oci://public.ecr.aws/karpenter",
  name: "karpenter",
  version: chartVersion,
  releaseName: "karpenter",
  namespace: "kube-system",
  kubeVersion: "1.31.0",
};

const versionExpectations = {
  "1.14.0": { defaultObjects: 18, eksInferenceObjects: 18, crdsManagedObjects: 13 },
};
const expected = versionExpectations[chart.version];
if (!expected) throw new Error(`karpenter ${chart.version} needs reviewed version-specific assertions`);

const requiredCRDNames = [
  "capacitybuffers.autoscaling.x-k8s.io",
  "ec2nodeclasses.karpenter.k8s.aws",
  "nodeclaims.karpenter.sh",
  "nodeoverlays.karpenter.sh",
  "nodepools.karpenter.sh",
];
const crdInstallCommand = `helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd --version ${chart.version} --namespace kube-system`;
const controllerImage =
  "public.ecr.aws/karpenter/controller:1.14.0@sha256:723130949e4cab989461ff07d1be4cd781d63515432494641b33c235f300ae23";

// Exact content of the audited default base values (variants/default/values.yaml
// in the lean entry). The confighubplaceholder sentinel is deliberate.
const defaultValuesText = `# Chart defaults plus the one required value. settings.clusterName has no chart
# default; it belongs to the environment, so this base renders it as the
# ConfigHub placeholder sentinel, the same discipline the eks-inference base
# uses for environment-owned values. Publishing gates refuse while it remains.
settings:
  clusterName: confighubplaceholder
`;

// Exact content of the audited platform values, shared byte-for-byte by the
// eks-inference and crds-managed bases (variants/{eks-inference,crds-managed}/values.yaml
// in the lean entry). The comments carry the AWS_REGION and interruptionQueue rationale.
const eksPlatformValuesText = `# Karpenter controller.
#
# Runs on the t4g.medium system nodegroup — the managed nodegroup exists
# precisely because Karpenter cannot schedule the node Karpenter runs on. That
# nodegroup is arm64, and Karpenter publishes multi-arch images, so this works;
# a chart that did not would CrashLoop with an exec format error rather than
# fail to schedule.
settings:
  clusterName: inference-demo

  # DELIBERATELY EMPTY. Karpenter's interruption queue is optional. Without it
  # you lose graceful handling of spot reclaims and scheduled maintenance —
  # nodes go away with less warning — but provisioning and consolidation work
  # normally. Enabling it would mean an SQS queue and EventBridge rules, and
  # therefore ACK controllers for both services in the mgmt plane. See
  # docs/karpenter.md before turning this on.
  interruptionQueue: ""

# The ServiceAccount name is load-bearing: it must match the serviceAccount in
# the PodIdentityAssociation created by the karpenter-aws component
# (kube-system/karpenter). Rename it here and the controller silently gets no
# AWS credentials.
serviceAccount:
  create: true
  name: karpenter

# One replica. The chart defaults to two with required pod anti-affinity, which
# needs two schedulable nodes; the system nodegroup has exactly two and also
# hosts CoreDNS and the pod identity agent. One replica means provisioning
# pauses if that node is lost, which is acceptable here and would not be in
# production.
replicas: 1

controller:
  # AWS_REGION is NOT optional here, and nothing in the chart supplies it.
  #
  # Karpenter resolves its region from IMDS when the variable is absent. Under
  # IRSA that still worked, because the IRSA webhook injects AWS_REGION into
  # every annotated pod. EKS Pod Identity — which is what this stack uses —
  # injects only the credential variables, so the fallback is reached and then
  # fails: EKS restricts pod access to IMDS, so the lookup times out and the
  # controller panics on startup rather than degrading.
  #
  #   panic: unable to determine region from IMDS: operation error ec2imds:
  #   GetRegion, canceled, context deadline exceeded
  #
  # Filled per variant by a link from platform-profile, same as the three ACK
  # controllers. The placeholder is what makes forgetting it a release-time
  # failure instead of a CrashLoop.
  env:
    - name: AWS_REGION
      value: confighubplaceholder

  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      memory: 512Mi

logLevel: info
`;

const variants = [
  {
    name: "default",
    base: "default",
    displayName: "default",
    valuesFile: "effective-values.yaml",
    valuesText: defaultValuesText,
    valuesSummary:
      "chart defaults plus the required settings.clusterName rendered as the confighubplaceholder sentinel; carries the 5 Karpenter CRDs in-bundle",
    expectedObjectCount: expected.defaultObjects,
    targetFactNote:
      "settings.clusterName must be bound per target before any publish scope opens; the render carries the confighubplaceholder sentinel",
    targetFacts: {
      requiredValues: [
        {
          path: "settings.clusterName",
          purpose: "EKS cluster name; required with no chart default, the deployment template refuses to render without it",
          stage: "pre-render",
          source: "platform-profile",
          installerInput: "clusterName",
        },
      ],
      requiredTopology: {
        minimumSchedulableNodes: 2,
        purpose:
          "replicas 2 with the chart-default required pod anti-affinity needs two schedulable non-Karpenter nodes",
      },
    },
  },
  {
    name: "eks-inference",
    base: "eks-inference",
    displayName: "EKS inference-demo platform",
    valuesFile: "effective-values-eks-inference.yaml",
    valuesText: eksPlatformValuesText,
    valuesSummary:
      "inference-demo platform values: replicas 1, pinned serviceAccount name, AWS_REGION placeholder env, bounded resources; carries the 5 Karpenter CRDs in-bundle",
    expectedObjectCount: expected.eksInferenceObjects,
    targetFactNote:
      "requires the EKS Pod Identity association for kube-system/karpenter and a bound AWS_REGION value; both live outside the chart",
    targetFacts: {
      requiredValues: [
        {
          path: "controller.env[AWS_REGION]",
          purpose:
            "AWS region for the controller; the chart supplies nothing and EKS Pod Identity does not inject it, so an absent value panics the controller at startup",
          stage: "pre-render",
          source: "platform-profile",
          installerInput: "awsRegion",
        },
      ],
      requiredTopology: {
        minimumSchedulableNodes: 1,
        purpose: "replicas 1 needs one schedulable non-Karpenter node on the system nodegroup",
      },
    },
  },
  {
    name: "crds-managed",
    base: "crds-managed",
    displayName: "platform values without CRDs",
    // Same render without --include-crds: the karpenter-crd chart owns the CRDs out of band.
    renderFlags: ["--skip-tests", "--no-hooks"],
    valuesFile: "effective-values-crds-managed.yaml",
    valuesText: eksPlatformValuesText,
    valuesSummary:
      "same platform values as eks-inference rendered without CRDs for platforms where the karpenter-crd chart owns them",
    expectedObjectCount: expected.crdsManagedObjects,
    targetFactNote:
      "requires the 5 Karpenter CRDs pre-installed by the karpenter-crd chart, plus the Pod Identity association and a bound AWS_REGION value",
    targetFacts: {
      requiredCRDs: requiredCRDNames.map((name) => ({
        name,
        suggestedSource: crdInstallCommand,
      })),
      requiredValues: [
        {
          path: "controller.env[AWS_REGION]",
          purpose:
            "AWS region for the controller; the chart supplies nothing and EKS Pod Identity does not inject it, so an absent value panics the controller at startup",
          stage: "pre-render",
          source: "platform-profile",
          installerInput: "awsRegion",
        },
      ],
      requiredTopology: {
        minimumSchedulableNodes: 1,
        purpose: "replicas 1 needs one schedulable non-Karpenter node on the system nodegroup",
      },
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
  receiptSlug: "karpenter",
  scriptPrefix: "karpenter",
  supportObjects: [`v1|Namespace||${chart.namespace}`],
  packageInputs: [
    {
      name: "clusterName",
      type: "string",
      default: "confighubplaceholder",
      prompt: "EKS cluster name for Karpenter (settings.clusterName)",
      description:
        "Used by the default base. Replaces the confighubplaceholder sentinel in the CLUSTER_NAME env on the controller Deployment. The install gate stays blocked while the sentinel remains.",
    },
    {
      name: "awsRegion",
      type: "string",
      default: "confighubplaceholder",
      prompt: "AWS region for the Karpenter controller (AWS_REGION env)",
      description:
        "Used by the eks-inference and crds-managed bases. The chart supplies no AWS_REGION and EKS Pod Identity does not inject it; an unbound value panics the controller at startup, so the sentinel keeps the failure at release time.",
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
      description: "Bind the CLUSTER_NAME env on the controller Deployment from the clusterName input.",
      invocations: [
        {
          name: "set-string-path",
          args: [
            "apps/v1/Deployment",
            "spec.template.spec.containers.?name=controller.env.?name=CLUSTER_NAME.value",
            "{{ .Inputs.clusterName }}",
          ],
        },
      ],
      toolchain: "Kubernetes/YAML",
      whereResource:
        "{{ if eq .Selection.Base \"default\" }}ConfigHub.ResourceType = 'apps/v1/Deployment'{{ else }}ConfigHub.ResourceType = 'helm-expt.invalid/v1/Never'{{ end }}",
    },
    {
      description: "Bind the AWS_REGION env on the controller Deployment from the awsRegion input.",
      invocations: [
        {
          name: "set-string-path",
          args: [
            "apps/v1/Deployment",
            "spec.template.spec.containers.?name=controller.env.?name=AWS_REGION.value",
            "{{ .Inputs.awsRegion }}",
          ],
        },
      ],
      toolchain: "Kubernetes/YAML",
      whereResource:
        "{{ if or (eq .Selection.Base \"eks-inference\") (eq .Selection.Base \"crds-managed\") }}ConfigHub.ResourceType = 'apps/v1/Deployment'{{ else }}ConfigHub.ResourceType = 'helm-expt.invalid/v1/Never'{{ end }}",
    },
  ],
  valueModel: {
    checkedValues: [
      {
        path: "settings.clusterName",
        variant: "default",
        disposition: "environment-owned-placeholder",
        reason:
          "required with no chart default; the deployment template wraps it in a required guard and the chart refuses to render without it, so the default base carries the confighubplaceholder sentinel",
      },
      {
        path: "controller.env",
        variant: "eks-inference",
        disposition: "environment-owned-placeholder",
        reason:
          "the chart supplies no AWS_REGION; under EKS Pod Identity the IMDS fallback is unreachable and the controller panics on startup, so the eks bases inject it as a placeholder env entry (crds-managed shares this)",
      },
      {
        path: "settings.interruptionQueue",
        variant: "eks-inference",
        disposition: "deliberately-empty",
        reason:
          "optional; empty string disables interruption handling and the INTERRUPTION_QUEUE env is simply not rendered. The eks bases leave it deliberately empty to avoid pulling SQS and EventBridge into the platform",
      },
      {
        path: "replicas",
        variant: "eks-inference",
        disposition: "target-fit-override",
        reason:
          "chart defaults to 2 combined with required pod anti-affinity, which needs two schedulable non-Karpenter nodes; the eks bases set 1 to fit a two-node system nodegroup that also hosts CoreDNS",
      },
      {
        path: "serviceAccount.name",
        variant: "eks-inference",
        disposition: "load-bearing-identity",
        reason:
          "default is a generated fullname; the eks bases pin it to karpenter because it must match the PodIdentityAssociation, and renaming it silently removes AWS credentials from the controller",
      },
      {
        path: "affinity",
        variant: "all",
        disposition: "chart-default-kept",
        reason:
          "the default node affinity requires karpenter.sh/nodepool DoesNotExist, forbidding scheduling onto Karpenter-provisioned nodes, so the controller always needs a pre-existing nodegroup; all three bases keep the default",
      },
      {
        path: "serviceMonitor.enabled",
        variant: "all",
        disposition: "gated-off-in-audited-renders",
        reason:
          "false by default, and the template additionally gates on a monitoring.coreos.com/v1 capability check; all audited renders pin kubeVersion 1.31.0 with no extra api-versions, so the guard stays closed",
      },
      {
        path: "controller.image",
        variant: "all",
        disposition: "chart-default-digest-pinned",
        reason:
          "single controller image, digest-pinned in chart defaults; the render carries the tag and the sha256 digest together",
      },
      {
        path: "controller.resources",
        variant: "eks-inference",
        disposition: "target-fit-override",
        reason:
          "empty by default; the eks bases set cpu 200m request and 512Mi request and limit to make the controller schedulable and bounded on the small system nodegroup",
      },
      {
        path: "settings.featureGates",
        variant: "all",
        disposition: "chart-default-kept",
        reason:
          "six gates render into one FEATURE_GATES env string; only reservedCapacity is on by default and all bases keep chart defaults",
      },
      {
        path: "priorityClassName",
        variant: "all",
        disposition: "chart-default-kept",
        reason:
          "defaults to system-cluster-critical, which only resolves in a cluster that grants that priority class, consistent with the kube-system namespace placement",
      },
      {
        path: "hostNetwork",
        variant: "all",
        disposition: "not-exercised",
        reason:
          "false by default; the chart comments it is required when using a custom CNI. Not exercised by any audited base",
      },
    ],
    unknownValues:
      "extraVolumes, controller.sidecarContainer, additionalClusterRoleRules, initContainers, dnsConfig, logOutputPaths, and the remaining settings.* are not exhaustively checked; no audited base sets them",
  },
  controlPoints: [
    {
      category: "source-lock",
      status: "handled",
      evidence: "source-lock.yaml",
      note:
        "source-lock.yaml pins the exact artifact oci://public.ecr.aws/karpenter/karpenter at 1.14.0 with packageSHA256 d576f955..., resolution artifact-addressed. Regeneration must export HELM_EXPT_CHART_ARTIFACT_URL and HELM_EXPT_CHART_ARTIFACT_SHA256.",
    },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "the packaged chart declares no dependencies and the witness records zero subcharts, so expectedDependencyCount is 0",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note:
        "every variant pins kubeVersion 1.31.0 with an empty apiVersions list. Two capability sites exist: the PDB apiVersion helper resolves to policy/v1 at 1.31.0, and the ServiceMonitor guard stays closed without monitoring.coreos.com/v1",
    },
    {
      category: "lifecycle-policy",
      status: "handled",
      note:
        "the witness records zero helm-hooks and zero test-hooks, so the emitted hookPolicy no-hooks is truthful: renders pass --no-hooks and there are no hooks to hide",
    },
    {
      category: "crd-policy",
      status: "split-by-variant",
      note:
        "the chart ships 5 CRDs as crds-directory files. default and eks-inference render them in-bundle (verdict lane flatten-with-routes, route = CRD ordering declaration); crds-managed excludes them via variant renderFlags without --include-crds, and the karpenter-crd chart owns them out of band, so that base's lane is safe-to-flatten with CRD presence recorded as a platform precondition",
    },
    {
      category: "namespace",
      status: "handled",
      note:
        "all namespaced objects land in kube-system; the chart creates no Namespace and kube-system pre-exists on every cluster. The installer supportObjects default v1|Namespace||kube-system covers the cub-side namespace object",
    },
    {
      category: "credentials-secrets",
      status: "none-generated",
      note:
        "zero generated secrets, zero lookup sites, no Secret rendered in any base (expectedSecretCount 0). AWS credentials arrive at runtime through the EKS Pod Identity association bound to the kube-system/karpenter ServiceAccount, outside the chart; AWS_REGION is the one credential-adjacent value and it ships as a placeholder env entry",
    },
    {
      category: "extension-slots",
      status: "open-unaudited",
      note:
        "extraVolumes, controller.extraVolumeMounts, controller.sidecarContainer, initContainers, and additionalClusterRoleRules are live template slots that no audited base exercises. additionalClusterRoleRules in particular can widen cluster RBAC and stays subject to scan-and-review",
    },
  ],
  dossier: {
    extra: {
      caveats: [
        "settings.clusterName is required with no default; the default base carries the confighubplaceholder sentinel and publishing gates must refuse while it remains.",
        "Under EKS Pod Identity the controller panics at startup without an explicit AWS_REGION env because the IMDS region lookup is blocked; IRSA masked this by injecting the variable. The eks bases carry it as a placeholder so forgetting it fails at release time, not as a CrashLoop.",
        "Renaming serviceAccount.name away from karpenter breaks the PodIdentityAssociation match and the controller silently loses AWS credentials.",
        "settings.interruptionQueue is deliberately empty in the eks bases; spot reclaims and maintenance events get no graceful handling until an SQS queue and EventBridge rules exist.",
        "The crds-managed base only works when the karpenter-crd chart has already installed the 5 CRDs; that precondition belongs to the platform CRD owner per the crds-managed verdict.",
        "serviceMonitor.enabled together with monitoring.coreos.com in api-versions opens the capability guard; render inputs must pin the api-versions list explicitly or a flattened bundle silently lacks the ServiceMonitor.",
      ],
    },
    maintainedNotes: [
      "The chart renders 18 objects in the default and eks-inference bases and 13 in crds-managed; the difference is exactly the 5 CRDs.",
      "The 5 CRDs are ec2nodeclasses.karpenter.k8s.aws, nodeclaims.karpenter.sh, nodepools.karpenter.sh, nodeoverlays.karpenter.sh, and capacitybuffers.autoscaling.x-k8s.io, shipped as 5 files in the crds/ directory.",
      "Everything namespaced lands in kube-system with releaseName karpenter; the chart creates no Namespace and renders no Secret.",
      `One container image, digest-pinned in chart defaults: ${controllerImage}.`,
      "The chart's one weird thing is that Karpenter cannot schedule the node Karpenter runs on. The default nodeAffinity requires karpenter.sh/nodepool DoesNotExist, so the controller always needs a pre-existing nodegroup, and default replicas 2 plus required pod anti-affinity needs two such nodes.",
      "settings.clusterName has no chart default and the deployment template hard-fails the render without it.",
      "The witness records zero hooks, zero lookups, zero generated secrets, and zero namespace-creation sites across 19 scanned files; the only quirk classes present are capabilities-api-versions (2 sites) and crd-ordering (5 CRDs).",
      "All settings.* values flatten into plain env vars on the controller container (CLUSTER_NAME, FEATURE_GATES, BATCH_MAX_DURATION and friends), so the whole runtime configuration is readable off the rendered Deployment.",
      "RBAC is substantial: 3 ClusterRoles, 2 ClusterRoleBindings, 2 Roles, and 2 RoleBindings, including a karpenter-admin aggregation ClusterRole.",
    ],
    knownControlPoints: [
      "crd-ordering",
      "capability-profile",
      "environment-owned-values",
      "pod-identity-credentials",
      "cluster-rbac-scan",
      "extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    extraReadiness: {
      notes:
        "The chart is clean by witness standards: no hooks, no lookups, no generated secrets, and deterministic renders keyed to a digest-pinned oci artifact. The controls that remain are real: the two environment-owned values (settings.clusterName and AWS_REGION) ship as confighubplaceholder and must be bound before any publish gate opens, and the CRD story splits by variant, with default and eks-inference carrying the 5 CRDs plus an ordering declaration while crds-managed depends on the karpenter-crd chart having installed them. Production scope also needs the Pod Identity association and at least two schedulable non-Karpenter nodes for the default replica count.",
    },
    nextAction:
      "bind the confighubplaceholder values per target and keep the CRD ordering route attached to the in-bundle bases",
  },
  readme: {
    intro:
      "This recipe covers karpenter/karpenter 1.14.0, the AWS node provisioner, rendered against kubeVersion 1.31.0 from the digest-pinned artifact oci://public.ecr.aws/karpenter/karpenter:1.14.0. Three bases exist. The default base renders chart defaults plus the one required value, settings.clusterName, as the confighubplaceholder sentinel, and produces 18 objects including the 5 Karpenter CRDs. The eks-inference base carries the platform values for the inference-demo cluster and also produces 18 objects, while crds-managed renders the same values without CRDs for platforms where the karpenter-crd chart owns them, producing 13. The chart has no hooks, no lookups, and no generated secrets; its hazards are the required cluster name, the AWS_REGION env the chart never supplies, and CRD ordering.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "renders are deterministic and keyed to the digest-pinned oci artifact under the pinned 1.31.0 capability profile;",
      "the CRD story splits by variant: default and eks-inference carry the 5 CRDs in-bundle while crds-managed renders without them for platforms where the karpenter-crd chart owns them;",
      "the environment-owned values (settings.clusterName and AWS_REGION) stay visible as confighubplaceholder sentinels and the install gate refuses while they remain.",
    ],
  },
  installGate: (variant) => {
    const reasons = {
      default: [
        "settings.clusterName is still the confighubplaceholder sentinel; bind it per target before any publish scope opens",
        "at least 2 schedulable non-Karpenter nodes are required by replicas 2 with the chart-default required pod anti-affinity",
        "cluster-scoped RBAC needs production review",
      ],
      "eks-inference": [
        "AWS_REGION is still the confighubplaceholder sentinel; an unbound value panics the controller at startup under EKS Pod Identity",
        "the EKS Pod Identity association for kube-system/karpenter must exist; this runtime credential precondition cannot be collector-checked from inside the cluster",
        "cluster-scoped RBAC needs production review",
      ],
      "crds-managed": [
        "AWS_REGION is still the confighubplaceholder sentinel; an unbound value panics the controller at startup under EKS Pod Identity",
        `the 5 Karpenter CRDs must pre-exist; the karpenter-crd chart owns them (${crdInstallCommand})`,
        "the EKS Pod Identity association for kube-system/karpenter must exist; this runtime credential precondition cannot be collector-checked from inside the cluster",
        "cluster-scoped RBAC needs production review",
      ],
    };
    return {
      decision: "blocked",
      allowedScopes: ["local-test"],
      blockedScopes: ["staging", "production"],
      reasons: [...reasons[variant.name], variant.targetFactNote],
    };
  },
  // Chart-specific verify assertions that the generic kit cannot infer.
  verifyExtra({ root, controlPoints, perVariant, check, readYaml, readFileSync, join }) {
    const crdIdentities = requiredCRDNames.map(
      (name) => `apiextensions.k8s.io/v1|CustomResourceDefinition||${name}`,
    );
    check(
      controlPoints.spec.points?.some((point) => point.category === "crd-policy"),
      "crd-policy control point missing",
    );
    check(
      controlPoints.spec.points?.some((point) => point.category === "credentials-secrets"),
      "credentials-secrets control point missing",
    );
    check(
      controlPoints.spec.points?.some((point) => point.category === "extension-slots"),
      "extension-slots control point missing",
    );
    for (const variant of variants) {
      const { identities, releasePath, scan } = perVariant.get(variant.name);
      const release = readFileSync(releasePath, "utf8");
      check(identities.includes("apps/v1|Deployment|kube-system|karpenter"), `${variant.name} Deployment missing`);
      check(identities.includes("v1|ServiceAccount|kube-system|karpenter"), `${variant.name} ServiceAccount missing`);
      check(release.includes(controllerImage), `${variant.name} digest-pinned controller image missing`);
      check(release.includes("confighubplaceholder"), `${variant.name} confighubplaceholder sentinel missing`);
      check(scan.spec.findingCounts.medium >= 5, `${variant.name} scan must flag the 5 cluster RBAC objects`);
      if (variant.name === "crds-managed") {
        for (const identity of crdIdentities) {
          check(!identities.includes(identity), `crds-managed must not carry ${identity}`);
        }
        check(release.includes("AWS_REGION"), "crds-managed AWS_REGION env missing");
        const variantDoc = readYaml(join(root, "variants", "crds-managed", "variant.yaml"));
        check(
          variantDoc.spec.targetFacts?.requiredCRDs?.length === requiredCRDNames.length,
          "crds-managed must declare the 5 required CRDs as target facts",
        );
      } else {
        for (const identity of crdIdentities) {
          check(identities.includes(identity), `${variant.name} missing ${identity}`);
        }
      }
      if (variant.name === "default") {
        check(release.includes("CLUSTER_NAME"), "default CLUSTER_NAME env missing");
      }
      if (variant.name === "eks-inference") {
        check(release.includes("AWS_REGION"), "eks-inference AWS_REGION env missing");
      }
    }
  },
});
