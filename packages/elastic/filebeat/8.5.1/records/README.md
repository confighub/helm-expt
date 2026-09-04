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
| `default` | [source and intent](./default/source-and-intent.yaml) | [Helm render intent](./default/helm-render-intent.yaml) | [Kubernetes objects](../bases/default/upstream.yaml) |
| `node-or-cluster-collector` | [source and intent](./node-or-cluster-collector/source-and-intent.yaml) | [Helm render intent](./node-or-cluster-collector/helm-render-intent.yaml) | [Kubernetes objects](../bases/node-or-cluster-collector/upstream.yaml) |
