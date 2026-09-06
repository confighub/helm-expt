import { check, findingCounts, sha256, identityFor, imageTag, labelsMatch, workloadPodSpec, workloadTemplateLabels } from "./proof-common.mjs";

export function scanDocs(docs) {
  const findings = [];
  const serviceAccounts = new Set(
    docs.filter((doc) => doc.kind === "ServiceAccount").map((doc) => `${doc.metadata?.namespace ?? ""}/${doc.metadata?.name ?? ""}`),
  );
  const workloads = docs.filter((doc) => workloadPodSpec(doc));
  for (const doc of workloads) {
    const object = identityFor(doc);
    const podSpec = workloadPodSpec(doc);
    const containers = [...(podSpec.containers ?? []), ...(podSpec.initContainers ?? [])];
    for (const container of containers) {
      const tag = imageTag(container.image ?? "");
      if (!tag || tag === "latest") {
        findings.push({
          id: `mutable-image-tag:${object}:${container.name ?? "container"}`,
          rule: "mutable-image-tag",
          severity: "high",
          object,
          message: `container ${container.name ?? "container"} uses mutable image ${container.image ?? ""}`,
        });
      }
    }
    const serviceAccountName = podSpec.serviceAccountName;
    const namespace = doc.metadata?.namespace ?? "";
    if (serviceAccountName && !serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
      findings.push({
        id: `workload-service-account-exists:${object}`,
        rule: "workload-service-account-exists",
        severity: "high",
        object,
        message: `workload references missing ServiceAccount ${namespace}/${serviceAccountName}`,
      });
    }
    if (podSpec.hostNetwork || podSpec.hostPID || podSpec.hostIPC) {
      findings.push({
        id: `host-namespace-review:${object}`,
        rule: "host-namespace-review",
        severity: "medium",
        object,
        message: "workload uses host namespace settings and needs production review",
      });
    }
    for (const container of containers) {
      if (container.securityContext?.privileged === true) {
        findings.push({
          id: `privileged-container-review:${object}:${container.name ?? "container"}`,
          rule: "privileged-container-review",
          severity: "medium",
          object,
          message: `container ${container.name ?? "container"} is privileged`,
        });
      }
    }
  }
  for (const doc of docs.filter((item) => item.kind === "Service")) {
    const selector = doc.spec?.selector ?? {};
    if (!Object.keys(selector).length) continue;
    const match = workloads.some((workload) => labelsMatch(selector, workloadTemplateLabels(workload)));
    if (!match) {
      findings.push({
        id: `service-selector-has-workload-match:${identityFor(doc)}`,
        rule: "service-selector-has-workload-match",
        severity: "high",
        object: identityFor(doc),
        message: "Service selector matches no rendered workload pod template",
      });
    }
  }
  for (const doc of docs.filter((item) => ["ClusterRole", "ClusterRoleBinding"].includes(item.kind))) {
    findings.push({
      id: `cluster-rbac-review:${identityFor(doc)}`,
      rule: "cluster-rbac-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Cluster-scoped RBAC requires production review",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "CustomResourceDefinition")) {
    findings.push({
      id: `crd-lifecycle-review:${identityFor(doc)}`,
      rule: "crd-lifecycle-review",
      severity: "medium",
      object: identityFor(doc),
      message: "CRD lifecycle and upgrade behavior require review",
    });
  }
  for (const doc of docs.filter((item) => ["MutatingWebhookConfiguration", "ValidatingWebhookConfiguration"].includes(item.kind))) {
    findings.push({
      id: `webhook-readiness-review:${identityFor(doc)}`,
      rule: "webhook-readiness-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Webhook certificate and readiness behavior require observation after apply",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "APIService")) {
    findings.push({
      id: `apiservice-requires-observation:${identityFor(doc)}`,
      rule: "apiservice-requires-observation",
      severity: "medium",
      object: identityFor(doc),
      message: "APIService availability must be observed after apply",
    });
  }
  for (const doc of docs.filter((item) => item.kind === "Secret")) {
    findings.push({
      id: `rendered-secret-review:${identityFor(doc)}`,
      rule: "rendered-secret-review",
      severity: "medium",
      object: identityFor(doc),
      message: "Rendered Secret material or references require review before production promotion",
    });
  }
  findings.sort((left, right) => left.id.localeCompare(right.id));
  return dedupeFindings(findings);
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter((finding) => {
    if (seen.has(finding.id)) return false;
    seen.add(finding.id);
    return true;
  });
}

export function localScanPolicy() {
  return {
    scanner: "helm-expt-local-rendered-object-scan",
    version: "0.2.0",
    rules: [
      { id: "mutable-image-tag", severity: "high" },
      { id: "service-selector-has-workload-match", severity: "high" },
      { id: "workload-service-account-exists", severity: "high" },
      { id: "cluster-rbac-review", severity: "medium" },
      { id: "crd-lifecycle-review", severity: "medium" },
      { id: "webhook-readiness-review", severity: "medium" },
      { id: "apiservice-requires-observation", severity: "medium" },
      { id: "rendered-secret-review", severity: "medium" },
      { id: "privileged-container-review", severity: "medium" },
      { id: "host-namespace-review", severity: "medium" },
    ],
  };
}

export function variantScanEvidence(docs, renderedDigest) {
  const findings = scanDocs(docs);
  const policy = localScanPolicy();
  return {
    renderedObjectSetSHA256: renderedDigest,
    result: findings.length ? "warn" : "pass",
    scanner: { name: policy.scanner, version: policy.version },
    policyBundleDigest: sha256(JSON.stringify(policy)),
    findingCounts: findingCounts(findings),
    findings,
  };
}

export function selfTestVariantScan() {
  const clean = [{ apiVersion: "v1", kind: "ConfigMap", metadata: { name: "settings" } }];
  const secret = { apiVersion: "v1", kind: "Secret", metadata: { name: "credential" } };
  const workload = {
    apiVersion: "apps/v1", kind: "Deployment", metadata: { name: "app" },
    spec: { template: { metadata: { labels: { app: "app" } }, spec: {
      containers: [{ name: "app", image: "example/app:latest" }],
    } } },
  };
  const baseline = variantScanEvidence(clean, "baseline");
  check(baseline.result === "pass", "clean scan fixture did not pass");
  const credentials = variantScanEvidence([...clean, secret], "secret-delta");
  check(credentials.result === "warn" && credentials.findingCounts.medium === 1,
    "variant introducing a Secret inherited a clean default scan");
  const mutable = variantScanEvidence([...clean, workload], "image-delta");
  check(mutable.result === "warn" && mutable.findingCounts.high === 1,
    "variant introducing a mutable image inherited a clean default scan");
  check(mutable.renderedObjectSetSHA256 === "image-delta" &&
    mutable.policyBundleDigest === baseline.policyBundleDigest,
    "scan evidence lost the variant digest or policy binding");
  console.log("self-test passed: variant Secret and mutable-image deltas cannot inherit a clean scan");
}
