# Redis Local Scan Spec

This slice replaces the Redis placeholder scan with a deterministic local scan
that is bound to the rendered object digest.

The goal is not to replace Trivy, Snyk, kube-linter, Kubescape, Checkov, or
ConfigHub policy functions. The goal is to prove the receipt/gate model with a
small scanner that always runs in this repo and catches real Redis risks.

## Scope

Input:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
```

Output:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/scan-receipt.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/install-gate.yaml
```

## Scanner Contract

The scanner name is:

```text
helm-expt-local-rendered-object-scan
```

The scanner must:

1. Bind findings to `renderedObjectSetSHA256`.
2. Emit a stable `policyBundleDigest`.
3. Emit deterministic finding IDs, severities, object identities, and messages.
4. Fail verification if the scan receipt digest does not match the rendered
   object set.
5. Fail verification if the install gate allows production while any high
   finding exists.

## Minimum Rules

V0 rules:

| Rule | Severity | Purpose |
| --- | --- | --- |
| `mutable-image-tag` | high | Catch unpinned or `latest` images. |
| `pdb-unhealthy-pod-eviction-policy` | medium | Catch PDBs missing explicit unhealthy pod eviction behavior. |
| `service-selector-has-workload-match` | high | Catch Services whose selector matches no workload pod template. |
| `workload-service-account-exists` | high | Catch workloads using a ServiceAccount absent from the rendered set. |

## Expected Redis Findings

For `bitnami/redis@25.5.3` default, V0 is expected to produce:

```text
high: 2
medium: 2
low: 0
info: 0
result: warn
```

Expected finding types:

- two `mutable-image-tag` findings for Redis StatefulSets using
  `registry-1.docker.io/bitnami/redis:latest`
- two `pdb-unhealthy-pod-eviction-policy` findings for Redis PDBs

Because high findings exist, the install gate must:

```text
decision: warn
allowedScopes: [local-test]
blockedScopes: [production]
```

This is the right outcome: the proof is correct and useful precisely because
it shows the chart is not production-clean under this policy yet.
