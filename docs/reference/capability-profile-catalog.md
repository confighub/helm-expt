# Capability Profile Catalog

Helm charts often branch on `.Capabilities.KubeVersion` and
`.Capabilities.APIVersions`. The proof model turns that implicit render context
into a named, digest-bound capability profile.

The catalog lives at:

```text
data/capability-profiles/catalog.yaml
```

Each profile records:

- `name`
- `kubeVersion`
- `apiVersions`
- `digest`
- optional `description`

Variant revisions and render receipts should bind the chosen profile by name
and digest. Redis does this today with `k8s-1.30-default`.

## Bulk And Adversarial Runs

Bulk runs choose synthetic profiles deliberately:

- default public Kubernetes charts start with `k8s-1.30-default`
- charts that need Prometheus Operator APIs use
  `k8s-1.30-monitoring-operator`
- charts that need External Secrets APIs use `k8s-1.30-external-secrets`
- charts that need Gateway API use `k8s-1.30-gateway-api`
- OpenShift-specific branches use `openshift-4.14-default`

The verifier fails if a render receipt references an unknown profile or if the
stored digest no longer matches the catalog entry.
