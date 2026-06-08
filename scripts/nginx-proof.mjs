// nginx proof.
//
// Chart-specific declaration only; all generate/verify/package machinery lives in
// scripts/lib/proof-kit.mjs. CLI surface unchanged. Supports the multi-version
// harness env overrides (HELM_EXPT_CHART_VERSION / HELM_EXPT_PROOF_OUTPUT_ROOT) via
// the kit.

import { runProofCli } from "./lib/proof-kit.mjs";
import { identityFor } from "./lib/proof-common.mjs";

const chart = {
  repository: "bitnami",
  repositoryURL: "https://charts.bitnami.com/bitnami",
  name: "nginx",
  version: "24.0.2",
  releaseName: "nginx",
  namespace: "nginx",
  kubeVersion: "1.30.0",
};

const variants = [
  {
    name: "http-clusterip",
    base: "http-clusterip",
    displayName: "plain HTTP ClusterIP",
    valuesFile: "effective-values.yaml",
    valuesText: `tls:
  enabled: false
service:
  type: ClusterIP
`,
    valuesSummary: "TLS generation disabled and service exposure kept internal",
    expectedObjectCount: 5,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "avoids chart-generated TLS material and renders a simple internal NGINX service deterministically",
  },
  {
    name: "existing-tls-ingress",
    base: "existing-tls-ingress",
    displayName: "existing TLS with ingress",
    valuesFile: "effective-values-existing-tls-ingress.yaml",
    valuesText: `tls:
  enabled: true
  existingSecret: nginx-backend-tls
ingress:
  enabled: true
  hostname: nginx.example.test
  ingressClassName: nginx
  tls: true
  extraTls:
    - hosts:
        - nginx.example.test
      secretName: nginx-ingress-tls
service:
  type: ClusterIP
`,
    valuesSummary: "target TLS Secrets supply backend and ingress certificates",
    expectedObjectCount: 6,
    expectedCRDCount: 0,
    expectedSecretCount: 0,
    targetFactNote: "requires target Secrets nginx/nginx-backend-tls and nginx/nginx-ingress-tls before apply",
    targetFacts: {
      requiredSecrets: [
        {
          namespace: "nginx",
          name: "nginx-backend-tls",
          keys: ["tls.crt", "tls.key", "ca.crt"],
          purpose: "TLS certificate material mounted by the NGINX pod",
        },
        {
          namespace: "nginx",
          name: "nginx-ingress-tls",
          keys: ["tls.crt", "tls.key"],
          purpose: "TLS certificate material referenced by the Ingress",
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
      id: "helm-hook-lifecycle-policy",
      severity: "medium",
      description: "Helm hook resources need explicit lifecycle policy.",
    },
    {
      id: "dependency-lock-review",
      severity: "medium",
      description: "Chart dependencies need lock and provenance review.",
    },
    {
      id: "generated-secret-ownership",
      severity: "medium",
      description: "Rendered Secrets need explicit ownership and observation policy.",
    },
    {
      id: "crd-upgrade-policy",
      severity: "medium",
      description: "CRDs need explicit readiness, ordering, schema, and upgrade policy.",
    },
    {
      id: "cluster-rbac-review",
      severity: "medium",
      description: "Cluster-scoped RBAC needs explicit review before production.",
    },
    {
      id: "deployment-workload-review",
      severity: "medium",
      description: "Deployments need rollout, persistence, and rollback policy.",
    },
    {
      id: "extension-slot-review",
      severity: "medium",
      description: "tpl/raw extension slots need provenance and scan coverage.",
    },
  ],
};

runProofCli({
  chart,
  variants,
  scanPolicy,
  // single cub-only support object (the created Namespace)
  supportObjects: ["v1|Namespace||nginx"],
  expectedDependencyCount: 1,
  recordChartLockDigest: true,
  recordDeprecated: true,
  valueModel: {
    checkedValues: [
      {
        path: "tls.enabled",
        variant: "http-clusterip",
        disposition: "generated-fact-avoided",
        reason: "default chart auto-generates self-signed TLS material; this variant disables TLS for a deterministic internal service",
      },
      {
        path: "tls.existingSecret",
        variant: "existing-tls-ingress",
        disposition: "target-fact-bound",
        reason: "externalizes backend TLS material into a declared target Secret instead of rendering generated certs",
      },
      {
        path: "ingress.enabled / ingress.hostname / ingress.ingressClassName / ingress.extraTls",
        variant: "existing-tls-ingress",
        disposition: "ui-exposure-bound",
        reason: "edge exposure is only added by an explicit variant with host, class, and external TLS Secret captured",
      },
      {
        path: "service.type",
        variant: "all",
        disposition: "exposure-profile-bound",
        reason: "promoted variants use ClusterIP to avoid implicit cloud load balancer behavior in the proof",
      },
      {
        path: "serverBlock / streamServerBlock / extraDeploy",
        variant: "all",
        disposition: "extension-slot",
        reason: "raw/template extension slots are powerful config surfaces; promoted variants keep them empty",
      },
      {
        path: "cloneStaticSiteFromGit.*",
        variant: "all",
        disposition: "supply-chain-slot-disabled",
        reason: "git-clone sidecars introduce external source and credential inputs; promoted variants keep them disabled",
      },
      {
        path: "metrics.enabled / metrics.serviceMonitor.enabled",
        variant: "all",
        disposition: "observability-addons-disabled",
        reason: "Prometheus exporter and ServiceMonitor objects are explicit later variants, not hidden defaults",
      },
    ],
  },
  controlPoints: [
    { category: "source-lock", status: "handled", evidence: "source-lock.yaml" },
    {
      category: "dependency-lock",
      status: "handled",
      evidence: "dependency-lock.yaml",
      note: "chart declares no subchart dependencies; the empty closure is recorded explicitly.",
    },
    {
      category: "capability-profile",
      status: "handled",
      kubeVersion: chart.kubeVersion,
      note: "Kubernetes API and version branches are bound to the named Kubernetes capability profile.",
    },
    {
      category: "generated-facts",
      status: "variant-controlled",
      evidence: "tls.autoGenerated / genCA / genSignedCert",
      note: "The chart default auto-generates TLS material; promoted variants either disable TLS or require existing TLS Secrets before render.",
    },
    {
      category: "target-facts",
      status: "variant-controlled",
      evidence: "tls.existingSecret / ingress.extraTls",
      note: "The existing-tls-ingress variant declares backend and ingress TLS Secrets instead of rendering generated certs.",
    },
    { category: "deployment-workload", status: "scan-and-review", object: "apps/v1|Deployment|nginx|nginx" },
    { category: "edge-ingress-policy", status: "variant-controlled", object: "networking.k8s.io/v1|Ingress|nginx|nginx" },
    { category: "network-policy", status: "scan-and-review", object: "networking.k8s.io/v1|NetworkPolicy|nginx|nginx" },
    { category: "availability-policy", status: "scan-and-review", object: "policy/v1|PodDisruptionBudget|nginx|nginx" },
    { category: "extension-slots", status: "controlled-by-empty-defaults", note: "serverBlock, streamServerBlock, extraDeploy, git-clone, metrics, and sidecar slots are empty or disabled in promoted variants." },
    { category: "installer-support-object", status: "handled", object: "v1|Namespace||nginx" },
  ],
  dossier: {
    maintainedNotes: [
      "Default chart rendering is nondeterministic because tls.autoGenerated creates fresh certificate material.",
      "http-clusterip disables TLS generation and keeps service exposure internal.",
      "existing-tls-ingress requires declared backend and ingress TLS Secrets instead of rendering generated certs.",
      "existing-tls-ingress adds explicit ingress host, ingress class, and TLS Secret reference.",
      "serverBlock, streamServerBlock, extraDeploy, git-clone, metrics, and sidecar slots are powerful extension surfaces; promoted variants keep them empty or disabled.",
    ],
    knownControlPoints: [
      "generated-facts",
      "target-facts",
      "edge-ingress-policy",
      "network-policy",
      "availability-policy",
      "raw-template-extension-slots",
      "static-site-supply-chain",
      "metrics-addon-policy",
    ],
  },
  plan: {
    status: "usable-with-controls",
    scanGate: "warn-production-blocked",
    nextAction: "publish only after TLS Secret ownership, ingress exposure, NetworkPolicy, PDB, deployment rollout, and raw/template extension-slot review are satisfied",
  },
  readme: {
    intro: "This is the promoted proof slice for the NGINX public Helm chart.",
    proves: [
      "regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;",
      "default chart rendering is nondeterministic because Helm generates self-signed TLS material;",
      "`http-clusterip` disables generated TLS and renders a small internal service;",
      "`existing-tls-ingress` uses declared target TLS Secrets, does not render a Secret, and adds explicit ingress exposure;",
      "generated TLS, target fact, ingress, NetworkPolicy, PDB, deployment, static-site supply-chain, metrics, and raw/template extension-slot risks are visible as scan/gate findings instead of hidden Helm behavior.",
    ],
  },
  installGate: (variant) => ({
    decision: "warn",
    reasons: [
      `Helm equivalence passed for ${variant.name}`,
      "Default generated TLS is either disabled or replaced by explicit target Secret requirements",
      "Helm hook behavior needs explicit lifecycle policy before production",
      "NGINX deployment, NetworkPolicy, PDB, service exposure, ingress, and extension slots need production review",
      variant.targetFactNote,
    ],
  }),
  // Chart-specific scan rules. The kit common ruleset already emits mutable-image-tag,
  // service-selector-has-workload-match, and workload-service-account-exists; everything
  // below (CRD policy, the generated nginx-tls Secret, the static generated-TLS and
  // extension-slot findings, RBAC incl. Role/RoleBinding, Deployment, NetworkPolicy, PDB,
  // and Ingress reviews) is the nginx-specific delta.
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
    for (const doc of docs.filter((item) => item.kind === "Secret" && item.metadata?.name === "nginx-tls")) {
      findings.push({
        id: `generated-secret-ownership:${identityFor(doc)}`,
        rule: "generated-secret-ownership",
        severity: "medium",
        object: identityFor(doc),
        message: "NGINX generated TLS Secret content and ownership must be explicit before production promotion",
      });
    }
    findings.push({
      id: "generated-tls-policy:tls.autoGenerated",
      rule: "generated-secret-ownership",
      severity: "medium",
      object: "values|tls.autoGenerated",
      message: "Default self-signed TLS generation must be disabled or replaced by declared target Secrets before promotion",
    });
    findings.push({
      id: "extension-slot-review:nginx",
      rule: "extension-slot-review",
      severity: "medium",
      object: "values|serverBlock|streamServerBlock|extraDeploy|cloneStaticSiteFromGit|metrics|sidecars",
      message: "NGINX server block, raw manifests, git clone, metrics, and sidecar extension slots must be scanned when populated",
    });
    for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(item.kind))) {
      findings.push({
        id: `cluster-rbac-review:${identityFor(doc)}`,
        rule: "cluster-rbac-review",
        severity: "medium",
        object: identityFor(doc),
        message: "NGINX RBAC requires production review",
      });
    }
    for (const doc of docs.filter((item) => item.kind === "Deployment")) {
      findings.push({
        id: `deployment-workload-review:${identityFor(doc)}`,
        rule: "deployment-workload-review",
        severity: "medium",
        object: identityFor(doc),
        message: "NGINX Deployment, service exposure, and rollout policy require production review",
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
        message: "NGINX ingress requires host, TLS Secret, class, and edge policy review",
      });
    }
    return findings;
  },
  // Chart-specific verify assertions the generic kit cannot infer.
  verifyExtra({ controlPoints, perVariant, check }) {
    check(controlPoints.spec.points?.some((point) => point.category === "generated-facts"), "generated-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "target-facts"), "target-facts control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "deployment-workload"), "deployment-workload control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "edge-ingress-policy"), "edge-ingress-policy control point missing");
    check(controlPoints.spec.points?.some((point) => point.category === "extension-slots"), "extension-slots control point missing");
    for (const variant of variants) {
      const { identities, scan } = perVariant.get(variant.name);
      const crdIdentities = identities.filter((identity) => identity.startsWith("apiextensions.k8s.io/v1|CustomResourceDefinition|"));
      const secretIdentities = identities.filter((identity) => identity.startsWith("v1|Secret|"));
      check(crdIdentities.length === variant.expectedCRDCount, `${variant.name} CRD count mismatch`);
      check(secretIdentities.length === variant.expectedSecretCount, `${variant.name} Secret count mismatch`);
      check(identities.includes("apps/v1|Deployment|nginx|nginx"), `${variant.name} Deployment missing`);
      check(identities.includes("v1|Service|nginx|nginx"), `${variant.name} Service missing`);
      check(identities.includes("v1|ServiceAccount|nginx|nginx"), `${variant.name} ServiceAccount missing`);
      check(identities.includes("networking.k8s.io/v1|NetworkPolicy|nginx|nginx"), `${variant.name} NetworkPolicy missing`);
      check(identities.includes("policy/v1|PodDisruptionBudget|nginx|nginx"), `${variant.name} PodDisruptionBudget missing`);
      check(!secretIdentities.length, `${variant.name} must not render a Secret`);
      check(scan.spec.findingCounts.medium >= 4, `${variant.name} scan must flag generated/target facts, RBAC, ingress/deployment, and extension review`);
      if (variant.name === "http-clusterip") {
        check(!identities.includes("networking.k8s.io/v1|Ingress|nginx|nginx"), "http-clusterip must not render an Ingress");
      }
      if (variant.name === "existing-tls-ingress") {
        check(identities.includes("networking.k8s.io/v1|Ingress|nginx|nginx"), "existing-tls-ingress Ingress missing");
      }
    }
  },
});
