# Sveltos Kyverno fleet

This example is for a platform team that needs to install the same system component
on a group of clusters. The team should review the configuration once, keep its
history in ConfigHub, and let a fleet controller handle cluster selection and
reconciliation.

ConfigHub stores the reviewed configuration and runs the catalog's checks against it.
Sveltos runs on a management cluster, selects workload clusters by label, and installs
the declared add-on. ConfigHub keeps the reviewed record; Sveltos handles cluster
selection and reconciliation.

## The reviewed configuration

The [ClusterProfile](../../../examples/sveltos/kyverno-fleet/clusterprofile.yaml)
contains the decisions a reviewer needs to see:

- select clusters labeled `environment=staging`;
- install `kyverno/kyverno` chart version `3.8.1`;
- run three admission-controller replicas;
- use `ContinuousWithDriftDetection` so Sveltos restores the reviewed settings.

The [source lock](../../../examples/sveltos/kyverno-fleet/source-lock.yaml) pins
Sveltos v1.12.0, the upstream commits, downloaded manifest checksums, kind version,
and Kubernetes versions used by the test.

## What the live run proved

The test created separate kind management and workload clusters. It installed
Sveltos v1.12.0 on the management cluster and registered the workload cluster with
the `environment=staging` label.

The `ClusterProfile` was uploaded to the live `helm-catalog` ConfigHub organization
as the `clusterprofile` Unit in Space
`sveltos-kyverno-fleet-3-8-1-staging`. The standard catalog policy was attached to
that Space. It requires approval even in staging because the profile changes
cluster-wide admission policy. A human README in the same Space explains the
example before someone opens the YAML.

The exact object read back from ConfigHub was applied to the management cluster.
Sveltos then:

1. selected the staging workload cluster;
2. installed Kyverno 3.8.1;
3. reported the Helm feature as `Provisioned`;
4. brought all four Kyverno deployments to their requested replica counts.

The test changed the admission-controller deployment from three replicas to one.
Sveltos restored it to three. The
[live receipt](../../../examples/sveltos/kyverno-fleet/live-receipt.yaml) records
the ConfigHub IDs and hashes, cluster result, deployment counts, and drift test.

## What remains manual

ConfigHub did not deliver the `ClusterProfile` to the management cluster
automatically in this run. The checked Unit was exported and applied with
`kubectl`. Argo CD, Flux, or another ConfigHub delivery path could automate that
step, but this receipt does not claim it.

The test also used one workload cluster. It proves selection, installation, and
drift recovery for this profile. It does not yet prove a promotion wave across
several clusters.

## Check the evidence

Check the committed files without a live cluster:

```bash
npm run sveltos-example:verify
```

While logged into the `helm-catalog` ConfigHub organization, also check that the
live Space still contains the same profile and README under the recorded policy:

```bash
CUB_CONTEXT=<your-helm-catalog-context> npm run sveltos-example:hub-verify
```
