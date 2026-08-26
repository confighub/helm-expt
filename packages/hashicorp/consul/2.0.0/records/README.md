# Configuration records

These files explain how each ready-made configuration in this package was
produced. They are supporting records, not Kubernetes objects. Do not apply
them to a cluster.

The source-and-intent file uses the Catalog's cross-format record. The Helm
render-intent file adds the chart version, values, release context, target
requirements, and lifecycle review. Paths inside those records are relative to
the [helm-expt repository](https://github.com/confighub/helm-expt).

The package does not write its own final digest into these files. The immutable
digest and signature belong to the publication receipt outside the artifact;
including that digest inside the artifact would change the digest again.

| Configuration | Source and intent | Helm details | Objects |
| --- | --- | --- | --- |
| `default-control-plane` | [source and intent](./default-control-plane/source-and-intent.yaml) | [Helm render intent](./default-control-plane/helm-render-intent.yaml) | [Kubernetes objects](../bases/default-control-plane/upstream.yaml) |
| `secure-mesh-existing-secrets` | [source and intent](./secure-mesh-existing-secrets/source-and-intent.yaml) | [Helm render intent](./secure-mesh-existing-secrets/helm-render-intent.yaml) | [Kubernetes objects](../bases/secure-mesh-existing-secrets/upstream.yaml) |
