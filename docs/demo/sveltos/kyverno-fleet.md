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

## What the first live run proved

The test created separate kind management and workload clusters. It installed
Sveltos v1.12.0 on the management cluster and registered the workload cluster with
the `environment=staging` label.

The `ClusterProfile` was uploaded to the live `helm-catalog` ConfigHub organization
as the `clusterprofile` Unit in Space
`sveltos-kyverno-fleet-3-8-1-staging`. The standard catalog policy was attached to
that Space. It requires approval even in staging because the profile changes
cluster-wide admission policy. A human README in the same Space explains the
example before someone opens the YAML.

The exact object read back from ConfigHub was applied to the management cluster with
`kubectl`. Sveltos then:

1. selected the staging workload cluster;
2. installed Kyverno 3.8.1;
3. reported the Helm feature as `Provisioned`;
4. brought all four Kyverno deployments to their requested replica counts.

The test changed the admission-controller deployment from three replicas to one.
Sveltos restored it to three. The
[live receipt](../../../examples/sveltos/kyverno-fleet/live-receipt.yaml) records
the ConfigHub IDs and hashes, cluster result, deployment counts, and drift test.

## What the OCI delivery run added

The [OCI delivery receipt](../../../runs/sveltos-oci-delivery-proof/receipt.yaml)
records a second run that removed the manual copy:

1. ConfigHub stored the exact `ClusterProfile` under the catalog's
   system-configuration policy.
2. A dry-run apply was blocked until that revision was approved.
3. ConfigHub published its private Space release.
4. The runner packaged the approved Unit data as a portable OCI using a local,
   no-server step.
5. The package was pulled back without a ConfigHub account and compared with the
   approved data.
6. Argo CD reconciled that exact OCI digest on the Sveltos management cluster.
7. Sveltos selected the staging workload cluster, installed Kyverno, and repaired
   the deliberate replica change.

Kubernetes admission and Sveltos added seven controller-managed field paths to the
live `ClusterProfile`. The receipt lists those paths and confirms that every field
from the approved object kept its approved value.

This run shows that the public work can sit at different points in the delivery
flow. ConfigHub handled the stored review. Portable package creation was local and
did not need ConfigHub Server. Pulling that package needed no ConfigHub account.

## What remains

The runner installed Sveltos itself directly from its pinned manifest as a
management-cluster prerequisite. It used a temporary registry for the portable OCI
and one staging workload cluster. A permanent public package and a promotion wave
across several workload clusters still need their own evidence.

## Check the evidence

Check the committed files without a live cluster:

```bash
npm run sveltos-example:verify
npm run sveltos-oci-delivery:verify
```

While logged into the `helm-catalog` ConfigHub organization, also check that the
live Space still contains the same profile and README under the recorded policy:

```bash
CUB_CONTEXT=<your-helm-catalog-context> npm run sveltos-example:hub-verify
```
