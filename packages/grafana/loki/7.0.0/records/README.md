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
| `simple-scalable-minio` | [source and intent](./simple-scalable-minio/source-and-intent.yaml) | [Helm render intent](./simple-scalable-minio/helm-render-intent.yaml) | [Kubernetes objects](../bases/simple-scalable-minio/upstream.yaml) |
| `single-binary-filesystem` | [source and intent](./single-binary-filesystem/source-and-intent.yaml) | [Helm render intent](./single-binary-filesystem/helm-render-intent.yaml) | [Kubernetes objects](../bases/single-binary-filesystem/upstream.yaml) |
