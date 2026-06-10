// Consul proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor, workloadPodSpec } from "./lib/proof-common.mjs";

const chart = {
  repository: "hashicorp",
  repositoryURL: "https://helm.releases.hashicorp.com",
  name: "consul",
  version: "2.0.0",
  releaseName: "consul",
  namespace: "consul",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "default-control-plane",
    base: "default-control-plane",
    displayName: "default control plane",
    valuesFile: "effective-values.yaml",
    valuesText: `server:
  disruptionBudget:
    enabled: false
connectInject:
  disruptionBudget:
    enabled: false
`,
    valuesSummary: "chart-default control plane with Kubernetes 1.30-compatible PDBs disabled, server, injector, webhook cert manager, CRDs, and RBAC",
    expectedObjectCount: 68,
    expectedCRDCount: 28,
    expectedSecretCount: 0,
    apiVersions: [],
    targetFactNote: "uses chart-default Consul control-plane posture; TLS and ACLs are disabled and must be policy-reviewed before production",
  },
  {
    name: "secure-mesh-existing-secrets",
    base: "secure-mesh-existing-secrets",
    displayName: "secure mesh with existing Secrets",
    valuesFile: "effective-values-secure-mesh-existing-secrets.yaml",
    valuesText: `global:
  tls:
    enabled: true
    caCert:
      secretName: consul-ca-cert
      secretKey: tls.crt
  gossipEncryption:
    autoGenerate: false
    secretName: consul-gossip-encryption-key
    secretKey: key
  acls:
    manageSystemACLs: true
    bootstrapToken:
      secretName: consul-bootstrap-acl-token
      secretKey: token
server:
  disruptionBudget:
    enabled: false
  replicas: 3
  bootstrapExpect: 3
  serverCert:
    secretName: consul-server-cert
connectInject:
  disruptionBudget:
    enabled: false
meshGateway:
  enabled: true
  service:
    type: ClusterIP
ingressGateways:
  enabled: true
  defaults:
    service:
      type: ClusterIP
terminatingGateways:
  enabled: true
ui:
  ingress:
    enabled: true
    hosts:
      - host: consul.example.invalid
        paths:
          - /
`,
    valuesSummary: "TLS, ACLs, gossip encryption, mesh gateways, and UI ingress with existing Secrets",
    expectedObjectCount: 97,
    expectedCRDCount: 28,
    expectedSecretCount: 1,
    apiVersions: [],
    targetFactNote: "requires target Secrets for CA, server certificate, gossip key, and ACL bootstrap token before apply",
    targetFacts: {
      requiredSecrets: [
        { namespace: "consul", name: "consul-ca-cert", keys: ["tls.crt"], purpose: "Consul TLS CA certificate" },
        { namespace: "consul", name: "consul-server-cert", keys: ["tls.crt", "tls.key"], purpose: "Consul server TLS certificate and private key" },
        { namespace: "consul", name: "consul-gossip-encryption-key", keys: ["key"], purpose: "Consul gossip encryption key" },
        { namespace: "consul", name: "consul-bootstrap-acl-token", keys: ["token"], purpose: "Consul ACL bootstrap token" },
      ],
    },
  },
];

const scanPolicy = {
  scanner: "helm-expt-local-rendered-object-scan",
  version: "0.1.0",
  rules: [
    { id: "mutable-image-tag", severity: "high", description: "Container image must use an immutable or non-latest tag." },
    { id: "service-selector-has-workload-match", severity: "high", description: "Service selector must match a rendered workload pod template." },
    { id: "workload-service-account-exists", severity: "high", description: "Workload serviceAccountName must reference a rendered ServiceAccount." },
    { id: "helm-hook-lifecycle-policy", severity: "medium", description: "Helm hook resources need explicit lifecycle policy." },
    { id: "dependency-lock-review", severity: "medium", description: "Chart dependencies need lock and provenance review." },
    { id: "generated-secret-ownership", severity: "medium", description: "Rendered Secrets need explicit ownership and observation policy." },
    { id: "crd-upgrade-policy", severity: "medium", description: "CRDs need explicit readiness, ordering, schema, and upgrade policy." },
    { id: "cluster-rbac-review", severity: "medium", description: "Cluster-scoped RBAC needs explicit review before production." },
    { id: "deployment-workload-review", severity: "medium", description: "Deployments need rollout, persistence, and rollback policy." },
    { id: "extension-slot-review", severity: "medium", description: "tpl/raw extension slots need provenance and scan coverage." },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  expectedDependencyCount: 0,
  recordChartLockDigest: true,
  recordDeprecated: true,
  expectedDeprecated: false,
  extraRequiredFiles: ["target-topology.yaml"],
  extraProofDocuments: () => [{ path: "target-topology.yaml", document: consulTargetTopology() }],
  semanticNormalizations: [
    "prune-null-fields",
    "trim-leading-command-block-newline",
    "consul-namespace-reference-normalization",
    "consul-statefulset-gitops-defaults",
  ],
  packageTransformers: [
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "",
      description: "Set the namespace on every namespaced resource.",
      invocations: [{ name: "set-namespace", args: ["{{ .Namespace }}"] }],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'rbac.authorization.k8s.io/v1/ClusterRoleBinding'",
      description: "Keep cluster-role binding subject namespaces aligned with the selected install namespace.",
      invocations: [{ name: "yq-i", args: ['.subjects[]?.namespace = "{{ .Namespace }}"'] }],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'v1/ConfigMap'",
      description: "Keep Consul service DNS and webhook Secret namespace references aligned with the selected install namespace.",
      invocations: [
        {
          name: "set-starlark",
          args: [
            `def rewrite(value):
  ns = params["namespace"]
  if type(value) == "dict":
    for key in value.keys():
      value[key] = rewrite(value[key])
    return value
  if type(value) == "list":
    for index in range(len(value)):
      value[index] = rewrite(value[index])
    return value
  if type(value) == "string":
    value = re.sub("consul-consul-server[.]consul[.]svc", "consul-consul-server." + ns + ".svc", value)
    value = re.sub("consul-consul-connect-injector[.]consul[.]svc[.]cluster[.]local", "consul-consul-connect-injector." + ns + ".svc.cluster.local", value)
    value = re.sub("consul-consul-connect-injector[.]consul[.]svc", "consul-consul-connect-injector." + ns + ".svc", value)
    value = re.sub('consul-consul-connect-injector[.]consul"', 'consul-consul-connect-injector.' + ns + '"', value)
    value = re.sub('"secretNamespace": "consul"', '"secretNamespace": "' + ns + '"', value)
    return value
  return value

rewrite(r)
`,
            "namespace={{ .Namespace }}",
          ],
        },
      ],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'apps/v1/Deployment'",
      description: "Keep Consul controller namespace flags and service references aligned with the selected install namespace.",
      invocations: [
        {
          name: "set-starlark",
          args: [
            `def rewrite(value):
  ns = params["namespace"]
  if type(value) == "dict":
    for key in value.keys():
      value[key] = rewrite(value[key])
    return value
  if type(value) == "list":
    for index in range(len(value)):
      value[index] = rewrite(value[index])
    return value
  if type(value) == "string":
    value = re.sub("consul-consul-server[.]consul[.]svc", "consul-consul-server." + ns + ".svc", value)
    value = re.sub('-release-namespace="consul"', '-release-namespace="' + ns + '"', value)
    value = re.sub("-deployment-namespace=consul", "-deployment-namespace=" + ns, value)
    return value
  return value

rewrite(r)
`,
            "namespace={{ .Namespace }}",
          ],
        },
      ],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource: "ConfigHub.ResourceType = 'apps/v1/StatefulSet'",
      description: "Make the Consul server StatefulSet stable under Kubernetes defaulting so GitOps can converge.",
      invocations: [
        {
          name: "yq-i",
          args: ['.spec.persistentVolumeClaimRetentionPolicy = {"whenDeleted": "Retain", "whenScaled": "Retain"} | .spec.revisionHistoryLimit = 10 | .spec.updateStrategy = {"type": "RollingUpdate", "rollingUpdate": {"partition": 0, "maxUnavailable": 1}}'],
        },
        {
          name: "yq-i",
          args: ['.spec.template.spec.dnsPolicy = "ClusterFirst" | .spec.template.spec.restartPolicy = "Always" | .spec.template.spec.schedulerName = "default-scheduler" | .spec.template.spec.serviceAccount = "consul-consul-server"'],
        },
        {
          name: "yq-i",
          args: ['(.spec.template.spec.containers[].env[]? | select(.valueFrom.fieldRef).valueFrom.fieldRef.apiVersion) = "v1" | (.spec.template.spec.initContainers[].env[]? | select(.valueFrom.fieldRef).valueFrom.fieldRef.apiVersion) = "v1"'],
        },
        {
          name: "yq-i",
          args: ['.spec.template.spec.containers[].imagePullPolicy = "IfNotPresent" | .spec.template.spec.initContainers[].imagePullPolicy = "IfNotPresent" | .spec.template.spec.initContainers[].resources = {}'],
        },
        {
          name: "yq-i",
          args: ['(.spec.template.spec.containers[].ports[] | select(.protocol == null).protocol) = "TCP" | .spec.template.spec.containers[].terminationMessagePath = "/dev/termination-log" | .spec.template.spec.containers[].terminationMessagePolicy = "File" | .spec.template.spec.initContainers[].terminationMessagePath = "/dev/termination-log" | .spec.template.spec.initContainers[].terminationMessagePolicy = "File"'],
        },
        {
          name: "yq-i",
          args: ['(.spec.template.spec.volumes[] | select(has("configMap")).configMap.defaultMode) = 420 | .spec.volumeClaimTemplates[].apiVersion = "v1" | .spec.volumeClaimTemplates[].kind = "PersistentVolumeClaim" | .spec.volumeClaimTemplates[].spec.volumeMode = "Filesystem"'],
        },
        {
          name: "yq-i",
          args: ["del(.spec.template.spec.containers[].volumeMounts[] | select(.readOnly == false).readOnly)"],
        },
      ],
    },
    {
      toolchain: "Kubernetes/YAML",
      whereResource:
        "ConfigHub.ResourceType IN ('admissionregistration.k8s.io/v1/MutatingWebhookConfiguration', 'admissionregistration.k8s.io/v1/ValidatingWebhookConfiguration')",
      description: "Keep admission webhook service references aligned with the selected install namespace.",
      invocations: [{ name: "yq-i", args: ['.webhooks[].clientConfig.service.namespace = "{{ .Namespace }}"'] }],
    },
  ],
  allowedSemanticDiff({ helmObjectJson, cubObjectJson }) {
    const helmObject = JSON.parse(helmObjectJson);
    const cubObject = JSON.parse(cubObjectJson);
    normalizeCommandBlocks(helmObject);
    normalizeCommandBlocks(cubObject);
    normalizeRoleBindingSubjectNamespaces(helmObject);
    normalizeRoleBindingSubjectNamespaces(cubObject);
    normalizeConsulStatefulSetForGitOps(helmObject);
    normalizeConsulStatefulSetForGitOps(cubObject);
    return JSON.stringify(helmObject) === JSON.stringify(cubObject);
  },
  valueModel: {
    checkedValues: [
      { path: "global.tls.enabled", variant: "default-control-plane", disposition: "policy-visible-default", reason: "chart default disables Consul TLS; the proof makes that posture explicit instead of hiding it" },
      { path: "global.acls.manageSystemACLs", variant: "default-control-plane", disposition: "policy-visible-default", reason: "chart default disables Consul ACL management; the proof makes that posture explicit instead of hiding it" },
      { path: "global.tls.caCert / server.serverCert", variant: "secure-mesh-existing-secrets", disposition: "target-fact-bound", reason: "TLS CA and server certificate material are declared target Secrets instead of generated or embedded chart inputs" },
      { path: "global.gossipEncryption.*", variant: "secure-mesh-existing-secrets", disposition: "target-fact-bound", reason: "gossip encryption auto-generation is disabled and the key is declared as a target Secret" },
      { path: "global.acls.bootstrapToken.*", variant: "secure-mesh-existing-secrets", disposition: "target-fact-bound", reason: "ACL bootstrap token is declared as a target Secret" },
      { path: "meshGateway / ingressGateways / terminatingGateways", variant: "secure-mesh-existing-secrets", disposition: "mesh-topology-bound", reason: "mesh gateway topology and ClusterIP service exposure are explicit variant choices" },
      { path: "ui.ingress.*", variant: "secure-mesh-existing-secrets", disposition: "ui-exposure-bound", reason: "UI exposure is only added by an explicit variant with host captured" },
      { path: "global.installK8sNetworkingCRDs / connectInject.apiGateway.manageExternalCRDs", variant: "all", disposition: "crd-ownership-review", reason: "Consul installs both Consul and Gateway API CRDs, which can conflict with cluster-managed CRD ownership" },
      { path: "server.extraConfig / connectInject.* / controller.* / gateway.*", variant: "all", disposition: "extension-slot", reason: "Consul exposes powerful config, injector, controller, and gateway extension slots that must stay explicit" },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    { category: "dependency-lock", status: "handled", evidence: "dependency-lock.yaml", note: "chart declares no subchart dependencies; the empty closure is recorded explicitly." },
    { category: "capability-profile", status: "handled", kubeVersion: chart.kubeVersion, note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile." },
    { category: "target-facts", status: "variant-controlled", evidence: "global.tls.caCert / server.serverCert / gossipEncryption / acl bootstrap token", note: "The secure-mesh-existing-secrets variant declares target Secrets for TLS, gossip encryption, and ACL bootstrap material." },
    { category: "crd-ownership", status: "scan-and-review", evidence: "28 rendered CRDs", note: "The chart templates 28 CRDs, including Gateway API CRDs that may already be cluster-managed." },
    { category: "stateful-workload", status: "scan-and-review", object: "apps/v1|StatefulSet|consul|consul-consul-server" },
    {
      category: "target-topology",
      status: "target-fit-required",
      evidence: "target-topology.yaml",
      note: "The secure-mesh-existing-secrets base renders three Consul server replicas with pod anti-affinity, so the strict one-node kind target is expected to leave two server pods pending. Use a multi-node target or a separate single-node/evaluation base for live readiness.",
    },
    { category: "admission-webhook", status: "scan-and-review", object: "admissionregistration.k8s.io/v1|MutatingWebhookConfiguration|consul|consul-consul-connect-injector" },
    { category: "cluster-rbac", status: "scan-and-review", note: "Default and secure variants render broad cluster RBAC for server, injector, gateway resources, and webhook certificate manager." },
    { category: "mesh-gateway-policy", status: "variant-controlled", note: "The secure-mesh-existing-secrets variant enables mesh, ingress, and terminating gateways with ClusterIP services." },
    { category: "ui-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|consul|consul-consul-ui" },
    { category: "lifecycle-policy", status: "scan-and-review", note: "Hooks are disabled in the proof render, while normal ACL init Job remains visible in the secure variant." },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "server extra config, injector, controller, gateway, and tpl-controlled strings are controlled in promoted variants." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||consul" },
  ],
  dossier: {
    maintainedNotes: [
      "default-control-plane records the chart-default posture: TLS and ACLs disabled, server StatefulSet, injector webhook, webhook cert manager, 28 CRDs, and broad RBAC.",
      "secure-mesh-existing-secrets enables TLS, ACL management, gossip encryption, mesh/ingress/terminating gateways, and UI ingress using declared target Secrets.",
      "The secure variant disables gossip auto-generation and uses existing Secrets for CA, server cert, gossip key, and ACL bootstrap token.",
      "Both variants render 28 CRDs, including Gateway API CRDs that can conflict with cluster-managed CRD ownership.",
      "Helm hooks are excluded from proof renders, while the secure variant's normal ACL init Job remains visible as an install lifecycle object.",
      "secure-mesh-existing-secrets needs a target topology that can schedule three Consul server replicas with pod anti-affinity; one-node kind is useful for object parity but not for live readiness.",
      "target-topology.yaml records the target shape required for the secure mesh base.",
      "server extra config, injector, controller, gateway, and tpl-controlled strings are powerful extension surfaces; promoted variants keep them controlled.",
    ],
    knownControlPoints: [
      "target-facts",
      "crd-ownership",
      "cluster-rbac",
      "admission-webhook",
      "stateful-workload",
      "target-topology",
      "mesh-gateway-policy",
      "ui-ingress-policy",
      "lifecycle-policy",
      "raw-template-extension-slots",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after TLS/ACL/gossip Secret ownership, CRD ownership, cluster RBAC, admission webhook, StatefulSet storage, gateway topology, UI ingress, hook/lifecycle, and raw/template extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the Consul public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "`default-control-plane` captures the chart-default Consul posture, including disabled TLS/ACLs, server StatefulSet, injector webhook, webhook cert manager, 28 CRDs, and RBAC;",
      "`secure-mesh-existing-secrets` enables TLS, ACLs, gossip encryption, mesh gateways, and UI ingress using declared target Secrets;",
      "CRD ownership, cluster RBAC, admission webhooks, lifecycle Jobs, rendered Secrets, StatefulSet storage, gateway topology, UI ingress, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
      "the secure mesh base is explicit about target topology: three server replicas with anti-affinity need a multi-node target, while one-node kind is only a parity target.",
      "target-topology.yaml records the target shape and receipts needed before secure mesh readiness can be claimed.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Consul TLS, ACL, gossip, gateway, CRD, and UI posture are explicit variant choices",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "Consul CRDs, cluster RBAC, injector webhooks, StatefulSet storage, gateway topology, UI ingress, ACL init Job, and extension slots need production review",
      variant.targetFactNote,
    ],
  }),
  scanExtra(docs) {
    const findings = [];
    for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
      findings.push({
        id: `crd-upgrade-policy:${identityFor(doc)}`,
        rule: "crd-upgrade-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "CRD readiness, ordering, schema validation, and upgrade compatibility require explicit policy",
      });
    }
    findings.push({
      id: "extension-slot-review:consul",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|server.extraConfig|connectInject|controller|gateway|tpl-strings",
      message: "Consul server, injector, controller, gateway, and templated-string extension slots must be scanned when populated",
    });
    findings.push({
      id: "target-secret-policy:secure-mesh",
      rule: "generated-secret-ownership",
      severity: "medium",
      object: "values|global.tls|global.gossipEncryption|global.acls",
      message: "Secure Consul variants depend on target Secrets for TLS CA, server cert, gossip key, and ACL bootstrap token",
    });
    for (const doc of docs.filter((item) => workloadPodSpec(item))) {
      const object = identityFor(doc);
      const podSpec = workloadPodSpec(doc);
      const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
      for (const container of containers) {
        for (const env of container.env ?? []) {
          const ref = env.valueFrom?.secretKeyRef;
          if (!ref?.name) continue;
          findings.push({
            id: `target-secret-fact:${object}:${container.name ?? "container"}:${env.name}`,
            rule: "generated-secret-ownership",
            severity: "medium",
            object,
            message: `container ${container.name ?? "container"} references target Secret ${ref.name}/${ref.key ?? ""}`,
          });
        }
      }
    }
    for (const doc of docs.filter((item) => ["Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Consul RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "StatefulSet")) {
      findings.push({
        id: `stateful-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Consul StatefulSet storage, rollout, and retention policy require production review",
      });
      if (doc.spec?.serviceName && !docs.some((item) => item.kind === "Service" && item.metadata?.name === doc.spec.serviceName)) {
        findings.push({
          id: `statefulset-service-risk:${identityFor(doc)}`,
          rule: "service-selector-has-workload-match",
          severity: "medium",
          object: identityFor(doc),
          message: `StatefulSet references serviceName ${doc.spec.serviceName}, but that Service is not rendered by the chart`,
        });
      }
    }
    for (const doc of docs.filter((item) => item.kind === "ServiceMonitor")) {
      findings.push({
        id: `servicemonitor-capability:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "ServiceMonitor requires the Prometheus Operator CRD to exist in the target cluster",
      });
    }
    for (const doc of docs.filter((item) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(item.kind))) {
      findings.push({
        id: `admission-webhook-review:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Consul injector webhook failure policy, certificates, and rollout impact require production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Job")) {
      findings.push({
        id: `lifecycle-job-review:${identityFor(doc)}`,
        rule: "helm-hook-lifecycle-policy",
        severity: "medium",
        object: identityFor(doc),
        message: "Consul lifecycle Job must be tied to install/upgrade ordering and rollback policy",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Secret")) {
      findings.push({
        id: `rendered-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "Rendered Consul Secret ownership, rotation, and observation policy require review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "NetworkPolicy")) {
      findings.push({
        id: `network-policy-review:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "NetworkPolicy intent must be reviewed against the target namespace and ingress controller topology",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "PodDisruptionBudget")) {
      findings.push({
        id: `availability-policy-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "PodDisruptionBudget needs production availability and rollout policy review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Ingress")) {
      findings.push({
        id: `edge-ingress-policy:${identityFor(doc)}`,
        rule: "extension-slot-review",
        severity: "medium",
        object: identityFor(doc),
        message: "Consul UI ingress requires host, TLS, class, and edge policy review",
      });
    }
    return findings;
  },
  verifyExtra({ root, sourceLock, dependencyLock, controlPoints, perVariant, check, readYaml, join }) {
    const topology = readYaml(join(root, "target-topology.yaml"));
    check(topology.kind === "TargetTopology", "target-topology.yaml must be a TargetTopology");
    check(topology.spec.bases.defaultControlPlane?.status === "single-node-compatible", "default-control-plane topology mismatch");
    check(topology.spec.bases.secureMeshExistingSecrets?.targetFit.minimumSchedulableNodes === 3, "secure mesh minimum node count mismatch");
    check(topology.spec.bases.secureMeshExistingSecrets?.requiredReceipts.includes("target-fit-observation-receipt"), "secure mesh target-fit receipt missing");
    check(topology.spec.notProvenBy.includes("one-node kind runtime readiness"), "one-node limitation must be explicit");
    check(sourceLock.spec.deprecated === false, "source deprecation marker must be recorded");
    check((dependencyLock.spec.dependencies ?? []).length === 0, "consul dependency lock must be empty");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "crd-ownership"), "crd-ownership control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "stateful-workload"), "stateful-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "admission-webhook"), "admission-webhook control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");

    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|StatefulSet|consul|consul-consul-server"), `${variant.name} server StatefulSet missing`);
      check(identities.includes("apps/v1|Deployment|consul|consul-consul-connect-injector"), `${variant.name} injector Deployment missing`);
      check(identities.includes("apps/v1|Deployment|consul|consul-consul-webhook-cert-manager"), `${variant.name} webhook cert manager missing`);
      check(identities.includes("v1|Service|consul|consul-consul-server"), `${variant.name} server Service missing`);
      check(identities.includes("v1|Service|consul|consul-consul-ui"), `${variant.name} UI Service missing`);
      check(identities.includes("v1|ServiceAccount|consul|consul-consul-server"), `${variant.name} server ServiceAccount missing`);
      check(identities.includes("v1|ConfigMap|consul|consul-consul-server-config"), `${variant.name} server ConfigMap missing`);
      check(identities.includes("admissionregistration.k8s.io/v1|MutatingWebhookConfiguration|consul|consul-consul-connect-injector"), `${variant.name} mutating webhook missing`);
      check(identities.includes("admissionregistration.k8s.io/v1|ValidatingWebhookConfiguration|consul|consul-consul-connect-injector"), `${variant.name} validating webhook missing`);
      check(identities.includes("rbac.authorization.k8s.io/v1|ClusterRole||consul-consul-connect-injector"), `${variant.name} injector ClusterRole missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||serviceintentions.consul.hashicorp.com"), `${variant.name} Consul CRD missing`);
      check(identities.includes("apiextensions.k8s.io/v1|CustomResourceDefinition||gateways.gateway.networking.k8s.io"), `${variant.name} Gateway API CRD missing`);
      if (variant.name === "default-control-plane") {
        check(!identities.includes("networking.k8s.io/v1|Ingress|consul|consul-consul-ui"), "default-control-plane must not render UI Ingress");
        check(!identities.includes("batch/v1|Job|consul|consul-consul-server-acl-init"), "default-control-plane must not render ACL init Job");
        check(!secretIdentities.length, "default-control-plane must not render a Secret");
      }
      if (variant.name === "secure-mesh-existing-secrets") {
        check(identities.includes("batch/v1|Job|consul|consul-consul-server-acl-init"), "secure-mesh-existing-secrets ACL init Job missing");
        check(identities.includes("networking.k8s.io/v1|Ingress|consul|consul-consul-ui"), "secure-mesh-existing-secrets UI Ingress missing");
        check(identities.includes("apps/v1|Deployment|consul|consul-consul-mesh-gateway"), "secure-mesh-existing-secrets mesh gateway missing");
        check(identities.includes("apps/v1|Deployment|consul|consul-consul-ingress-gateway"), "secure-mesh-existing-secrets ingress gateway missing");
        check(identities.includes("apps/v1|Deployment|consul|consul-consul-terminating-gateway"), "secure-mesh-existing-secrets terminating gateway missing");
        check(identities.includes("v1|Secret|consul|consul-consul-auth-method"), "secure-mesh-existing-secrets auth method Secret missing");
      }
      check(scan.spec.findingCounts.medium >= 3, `${variant.name} scan must flag storage/stateful/runtime risk and extension review`);
    }
  },
});

function consulTargetTopology() {
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "TargetTopology",
    metadata: { name: "hashicorp-consul-2.0.0" },
    spec: {
      chart: "hashicorp/consul@2.0.0",
      scope: "target shape required by each supported base after render parity has passed",
      bases: {
        defaultControlPlane: {
          variant: "default-control-plane",
          status: "single-node-compatible",
          reason:
            "the curated default base disables disruptive PDB behavior for local proof and has live parity on the standard proof target",
        },
        secureMeshExistingSecrets: {
          variant: "secure-mesh-existing-secrets",
          status: "target-fit-required",
          targetFit: {
            minimumSchedulableNodes: 3,
            requiresPersistentStorage: true,
            requiresIngressController: true,
            requiresGatewayPolicyReview: true,
            reason:
              "the base renders three Consul server replicas with pod anti-affinity, mesh gateway, ingress gateway, terminating gateway, UI ingress, injector webhook, and ACL init Job",
          },
          prerequisites: {
            secrets: [
              "consul/consul-ca-cert tls.crt",
              "consul/consul-server-cert tls.crt,tls.key",
              "consul/consul-gossip-encryption-key key",
              "consul/consul-bootstrap-acl-token token",
            ],
            policyReviews: [
              "CRD ownership",
              "cluster RBAC",
              "injector webhook readiness",
              "ACL bootstrap lifecycle",
              "mesh, ingress, and terminating gateway exposure",
              "UI ingress exposure",
            ],
          },
          requiredReceipts: [
            "target-fit-observation-receipt",
            "secret-preflight-receipt",
            "webhook-readiness-receipt",
            "gateway-policy-receipt",
          ],
        },
      },
      notProvenBy: [
        "one-node kind runtime readiness",
        "render parity alone",
        "presence of target Secret names without live Secret/preflight evidence",
      ],
    },
  };
}

function normalizeCommandBlocks(value) {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (typeof value[index] === "string") value[index] = value[index].replace(/^\n+/, "");
      else normalizeCommandBlocks(value[index]);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const child of Object.values(value)) normalizeCommandBlocks(child);
}

function normalizeRoleBindingSubjectNamespaces(object) {
  if (object?.kind !== "RoleBinding") return;
  const namespace = object.metadata?.namespace;
  if (!namespace) return;
  for (const subject of object.subjects ?? []) {
    if (subject.kind === "ServiceAccount" && subject.namespace === namespace) delete subject.namespace;
  }
}

function normalizeConsulStatefulSetForGitOps(object) {
  if (object?.kind !== "StatefulSet" || object?.metadata?.name !== "consul-consul-server") return;
  const spec = object.spec ?? {};
  delete spec.persistentVolumeClaimRetentionPolicy;
  delete spec.revisionHistoryLimit;
  delete spec.updateStrategy;
  const podSpec = spec.template?.spec ?? {};
  delete podSpec.dnsPolicy;
  delete podSpec.restartPolicy;
  delete podSpec.schedulerName;
  delete podSpec.serviceAccount;
  for (const container of podSpec.containers ?? []) {
    delete container.imagePullPolicy;
    delete container.terminationMessagePath;
    delete container.terminationMessagePolicy;
    for (const env of container.env ?? []) delete env.valueFrom?.fieldRef?.apiVersion;
    for (const port of container.ports ?? []) delete port.protocol;
    for (const mount of container.volumeMounts ?? []) {
      if (mount.readOnly === false) delete mount.readOnly;
    }
  }
  for (const container of podSpec.initContainers ?? []) {
    delete container.imagePullPolicy;
    if (container.resources && Object.keys(container.resources).length === 0) delete container.resources;
    delete container.terminationMessagePath;
    delete container.terminationMessagePolicy;
    for (const env of container.env ?? []) delete env.valueFrom?.fieldRef?.apiVersion;
  }
  for (const volume of podSpec.volumes ?? []) {
    if (volume.configMap) delete volume.configMap.defaultMode;
  }
  for (const claim of spec.volumeClaimTemplates ?? []) {
    delete claim.apiVersion;
    delete claim.kind;
    delete claim.spec?.volumeMode;
    delete claim.status;
  }
}
