# Timoni Redis Catalog proof

The Config Workshop Catalog retains Timoni Redis 8.10.1 as a source-neutral configuration example.

## What now works

- The immutable Timoni module is recorded separately from the Kubernetes objects it produced.
- The seven exact objects are published as a public literal configuration OCI: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/timoni-redis-config@sha256:375bc7dee05f4629d3b297f05628ee52c104d7a6ced03a2c16b198c819b7ae65`.
- An anonymous pull reproduced object set `10f21f387715146838bc531cba4ce921e8eca127b0ab69a065e4f66a2a146fc2`.
- ConfigHub retained the same seven objects in `timoni-redis-8-10-1-base`.
- `timoni-redis-8-10-1-dev` is a linked environment variant. It currently changes no Kubernetes field, so its object-set hash remains identical.

## Four different identities

| Identity | Value |
| --- | --- |
| Source-module OCI manifest | `sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872` |
| Rendered YAML file | `91059402bdbb37011f40c711297fd3d665f7ffa8eb05fe35487fde252163476b` |
| Canonical Kubernetes object set | `10f21f387715146838bc531cba4ce921e8eca127b0ab69a065e4f66a2a146fc2` |
| Literal configuration OCI manifest | `sha256:375bc7dee05f4629d3b297f05628ee52c104d7a6ced03a2c16b198c819b7ae65` |

These values answer different questions and must not be substituted for one another. The base record inside the OCI is the publication-time snapshot. The Catalog record outside the artifact can add the assigned OCI digest and later ConfigHub receipts.

## What remains

The source says to apply the master objects first, wait for readiness, then apply the read-only replica. The optional PING test is disabled by default. No destination has been selected for the ConfigHub variant, so that lifecycle work has not run. Kubernetes admission, workload health, Argo CD, Flux, upgrade, and rollback remain not run.

## Evidence

- [Source and intent](../../examples/timoni/redis-8-10-1/source-lock.yaml)
- [Materialization receipt](../../examples/timoni/redis-8-10-1/generation-receipt.yaml)
- [Lifecycle route intent](../../examples/timoni/redis-8-10-1/lifecycle-route-intent.yaml)
- [Public OCI receipt](../../runs/timoni-redis-catalog-proof/public-oci-receipt.yaml)
- [ConfigHub receipt](../../runs/timoni-redis-catalog-proof/confighub-receipt.yaml)
- [BaseVariantRecord](../../data/base-variant-records/records/timoni-redis-8-10-1-default.yaml)

The ConfigHub receipt records 7 linked workload Units in the development variant.
